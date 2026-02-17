/**
 * Y.js Content Writer — constructs a Y.Doc matching Fusebase's schema
 * and sends binary updates via the Fusebase WebSocket.
 *
 * Fusebase uses Y.js for collaborative editing.  The Y.Doc structure is:
 *   root.children  (Y.Array<string>) — ordered block IDs
 *   root.blocks    (Y.Map)           — id → block Y.Map
 *
 * Each block Y.Map has:
 *   id         (string)
 *   type       (string)   — "paragraph", "hLarge", etc.
 *   indent     (number)
 *   color      (string)   — "transparent"
 *   align      (string)   — "left"
 *   characters (Y.Array)  — alternating text strings and formatting objects
 *
 * @module yjs-writer
 */

import * as Y from "yjs";
import type {
  ContentBlock,
  InlineSegment,
} from "./content-schema.js";

/** Counter for generating unique block IDs */
let blockIdCounter = 0;

/** Generate a Fusebase-compatible block ID */
function genBlockId(): string {
  return `b${Date.now()}_${blockIdCounter++}`;
}

/**
 * Convert InlineSegments into the characters array format.
 * Fusebase uses alternating strings and formatting toggle objects:
 *   ["text", {bold:"true"}, "bold text", {bold:"null"}, "more text"]
 */
function segmentsToCharacters(segments: InlineSegment[]): (string | Record<string, string>)[] {
  const chars: (string | Record<string, string>)[] = [];

  for (const seg of segments) {
    // Open formatting
    if (seg.bold) chars.push({ bold: "true" });
    if (seg.italic) chars.push({ italic: "true" });

    // Insert text character by character (Fusebase stores individual characters)
    for (const ch of seg.text) {
      chars.push(ch);
    }

    // Close formatting
    if (seg.italic) chars.push({ italic: "null" });
    if (seg.bold) chars.push({ bold: "null" });
  }

  return chars;
}

/**
 * Build a Y.Doc from ContentBlocks matching Fusebase's internal schema.
 * Returns the doc and its encoded state as a Uint8Array.
 */
export function buildYDoc(blocks: ContentBlock[]): { doc: Y.Doc; update: Uint8Array } {
  const doc = new Y.Doc();
  const root = doc.getMap("root");

  // children: ordered array of block IDs
  const children = new Y.Array<string>();
  root.set("children", children);

  // blocks: map of id → block data
  const blocksMap = new Y.Map();

  // rootChildren: separate list (Fusebase uses this too)
  const rootChildren = new Y.Array<string>();
  root.set("rootChildren", rootChildren);

  for (const block of blocks) {
    const blockId = genBlockId();
    const blockMap = new Y.Map();

    blockMap.set("id", blockId);
    blockMap.set("indent", 0);
    blockMap.set("color", "transparent");
    blockMap.set("align", "left");

    switch (block.type) {
      case "heading": {
        blockMap.set("type", block.level === 1 ? "hLarge" : "hMedium");
        const chars = new Y.Array();
        chars.push(segmentsToCharacters(block.children));
        blockMap.set("characters", chars);
        break;
      }

      case "paragraph": {
        blockMap.set("type", "paragraph");
        if (block.indent) blockMap.set("indent", block.indent);
        if (block.align) blockMap.set("align", block.align);
        if (block.color) blockMap.set("color", block.color);
        const chars = new Y.Array();
        chars.push(segmentsToCharacters(block.children));
        blockMap.set("characters", chars);
        break;
      }

      case "divider": {
        blockMap.set("type", "divider");
        const chars = new Y.Array();
        blockMap.set("characters", chars);
        break;
      }

      case "list": {
        const listType = block.style === "bullet" ? "listItemBullet" : "listItemNumber";
        // Each list item becomes its own block
        for (const item of block.items) {
          const itemId = genBlockId();
          const itemMap = new Y.Map();
          itemMap.set("id", itemId);
          itemMap.set("type", listType);
          itemMap.set("indent", item.indent || 0);
          itemMap.set("color", "transparent");
          itemMap.set("align", "left");
          const chars = new Y.Array();
          chars.push(segmentsToCharacters(item.children));
          itemMap.set("characters", chars);

          blocksMap.set(itemId, itemMap);
          children.push([itemId]);
          rootChildren.push([itemId]);
        }
        continue; // Skip the outer block — items are individual
      }

      case "checklist": {
        for (const item of block.items) {
          const itemId = genBlockId();
          const itemMap = new Y.Map();
          itemMap.set("id", itemId);
          itemMap.set("type", item.checked ? "listItemChecked" : "listItemUnchecked");
          itemMap.set("indent", 0);
          itemMap.set("color", "transparent");
          itemMap.set("align", "left");
          const chars = new Y.Array();
          chars.push(segmentsToCharacters(item.children));
          itemMap.set("characters", chars);

          blocksMap.set(itemId, itemMap);
          children.push([itemId]);
          rootChildren.push([itemId]);
        }
        continue;
      }

      case "blockquote": {
        blockMap.set("type", "blockQuote");
        const chars = new Y.Array();
        chars.push(segmentsToCharacters(block.children));
        blockMap.set("characters", chars);
        break;
      }

      case "code": {
        blockMap.set("type", "code");
        if (block.language) blockMap.set("language", block.language);
        const chars = new Y.Array();
        chars.push(block.code.split(""));
        blockMap.set("characters", chars);
        break;
      }
    }

    blocksMap.set(blockId, blockMap);
    children.push([blockId]);
    rootChildren.push([blockId]);
  }

  root.set("blocks", blocksMap);

  // Encode the full state as a Y.js update
  const update = Y.encodeStateAsUpdate(doc);
  return { doc, update };
}

/**
 * Merge our content into an existing Y.Doc state.
 * First fetches the current state from /dump, then applies changes.
 * This avoids creating conflicts with the existing CRDT state.
 */
export function mergeIntoExistingDoc(
  existingState: Uint8Array,
  blocks: ContentBlock[],
): Uint8Array {
  // Create a doc from the existing state
  const remoteDoc = new Y.Doc();
  Y.applyUpdate(remoteDoc, existingState);

  // Build our content doc
  const { doc: localDoc } = buildYDoc(blocks);

  // Get the local state as an update
  const localUpdate = Y.encodeStateAsUpdate(localDoc);

  // Apply our update to the remote doc
  Y.applyUpdate(remoteDoc, localUpdate);

  // Return the merged state
  return Y.encodeStateAsUpdate(remoteDoc);
}
