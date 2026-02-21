/**
 * Fusebase Y.js WebSocket Content Writer
 *
 * Writes rich content to Fusebase pages using the native Y.js WebSocket connection.
 *
 * Protocol (reverse-engineered from browser CDP capture + Fusebase client):
 *
 *   1. Get JWT via POST /v4/api/workspaces/{wsId}/texts/{pageId}/tokens
 *   2. Build initial Y.Doc with empty paragraph (this is what the browser does)
 *   3. Encode SyncStep1 from initial doc state, embed in URL as base64
 *   4. Open WebSocket to wss://text.nimbusweb.me/socket.io.editor/{ws}/{page}
 *      with ?token=JWT&cid=...&encv2=true&syncStep1=...
 *   5. IMMEDIATELY send AWARENESS message (before any sync)
 *   6. Server sends SyncStep1 → respond with SyncStep2 (our state)
 *   7. Server sends SyncStep2 → apply update to our doc (try V2 then V1)
 *   8. Write content blocks → send incremental V1 updates
 *   9. Wait for processing, then close
 *
 * Message types (raw binary ArrayBuffer):
 *   0x00 = sync: sub 0x00=step1, 0x01=step2, 0x02=update
 *   0x01 = awareness
 *   0x11 = ping → respond with 0x12 (pong)
 *
 * Critical: Despite encv2=true in URL, the server expects V1-encoded
 * outbound updates (encodeStateAsUpdate). The server may send V2 inbound.
 *
 * @module yjs-ws-writer
 */

import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { WebSocket } from "ws";
import type { ContentBlock } from "./content-schema.js";

// ─── Encoding helpers ───

function writeVarUint(buf: number[], num: number): void {
  while (num > 0x7f) {
    buf.push(0x80 | (num & 0x7f));
    num >>>= 7;
  }
  buf.push(num & 0x7f);
}

function readVarUint(data: Uint8Array, offset: number): [number, number] {
  let result = 0, shift = 0, byte: number;
  do {
    byte = data[offset++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  return [result, offset];
}

function randomAlphaNum(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ─── Y.js message builders ───

/**
 * Encode a sync protocol message in the exact format Fusebase expects.
 * Format: [0x00, subType, varUint(data.length), ...data]
 */
function encodeSyncMessage(subType: number, data: Uint8Array): Uint8Array {
  const header: number[] = [0x00, subType];
  writeVarUint(header, data.length);
  const msg = new Uint8Array(header.length + data.length);
  msg.set(header);
  msg.set(data, header.length);
  return msg;
}

/**
 * Encode an awareness message in the exact format the browser sends.
 * Format: [0x01, varUint(1), varUint(clientId), varUint(clock), varUint(stateLen), ...stateBytes]
 */
function encodeAwarenessMessage(clientId: number, clock: number, state: string): Uint8Array {
  const buf: number[] = [0x01]; // awareness type
  writeVarUint(buf, 1); // count = 1
  writeVarUint(buf, clientId);
  writeVarUint(buf, clock);
  const stateBytes = new TextEncoder().encode(state);
  writeVarUint(buf, stateBytes.length);
  const result = new Uint8Array(buf.length + stateBytes.length);
  result.set(buf);
  result.set(stateBytes, buf.length);
  return result;
}

// ─── Block ID generator ───

let blockCounter = 0;
function genBlockId(): string {
  return `b${Date.now()}_${blockCounter++}`;
}

/**
 * Build Y.Doc content blocks matching Fusebase's exact browser schema.
 *
 * Y.Doc structure (decoded from live browser CDP capture):
 *   doc.getMap("blocks")          — Y.Map<string, Y.Map> — block data keyed by ID (TOP-LEVEL)
 *   doc.getArray("rootChildren")  — Y.Array<string> — ordered block IDs (TOP-LEVEL)
 *   doc.getMap("root").get("children") — Y.Array<string> — EMPTY (vestige, must exist)
 *
 * Each block (Y.Map) — ONLY these fields (matching browser exactly):
 *   id         (string)
 *   type       (string)   — "paragraph", "hLarge", etc.
 *   indent     (number)
 *   color      (string)   — "transparent"
 *   align      (string)   — "left"
 *   characters (Y.Text)   — Quill delta formatted text (NOT Y.Array!)
 *
 * CRITICAL: characters is Y.Text, supporting .insert(pos, text, {bold: true}) etc.
 * Every block's characters MUST end with "\n".
 */
function addBlocksToDoc(doc: Y.Doc, blocks: ContentBlock[]): void {
  const blocksMap = doc.getMap("blocks");
  const rootChildren = doc.getArray<string>("rootChildren");

  /**
   * Insert formatted segments into a Y.Text at the given offset.
   * Returns the new offset after insertion.
   */
  function insertInlineText(ytext: Y.Text, offset: number, segments: { text?: string; embed?: any; bold?: boolean; italic?: boolean; strikethrough?: boolean; underline?: boolean; code?: boolean; link?: string }[]): number {
    for (const seg of segments) {
      const attrs: Record<string, any> = {};
      if (seg.bold) attrs.bold = true;
      if (seg.italic) attrs.italic = true;
      if (seg.strikethrough) attrs.strikethrough = true;
      if (seg.underline) attrs.underline = true;
      if (seg.code) attrs.code = true;
      if (seg.link) attrs.link = seg.link;
      const hasAttrs = Object.keys(attrs).length > 0;

      if (seg.embed) {
        ytext.insert(offset, seg.embed, hasAttrs ? attrs : undefined);
        offset += 1; // object embed takes 1 unit of length
      } else if (seg.text) {
        ytext.insert(offset, seg.text, hasAttrs ? attrs : undefined);
        offset += seg.text.length;
      }
    }
    // CRITICAL: Every block's characters MUST end with "\n" — Fusebase block terminator
    ytext.insert(offset, "\n");
    offset += 1;
    return offset;
  }

  /**
   * Add a block to the Y.Doc. Returns the block ID.
   * For blocks with children (toggle, collapsible), set props.childIds to the array of child block IDs.
   * For blocks without text (hLine), set props.noCharacters = true.
   */
  function addBlock(type: string, props: Record<string, unknown> = {}): string {
    const id = genBlockId();
    const bm = new Y.Map();
    bm.set("id", id);
    bm.set("type", type);

    // hLine blocks have only id + type — no other fields
    if (props.noCharacters) {
      blocksMap!.set(id, bm);
      rootChildren!.push([id]);
      return id;
    }

    bm.set("indent", (props.indent as number) || 0);
    bm.set("color", (props.color as string) || "transparent");
    bm.set("align", (props.align as string) || "left");
    if (props.language) bm.set("language", props.language);

    // Toggle/collapsible blocks have children (array of child block IDs) and collapsed flag
    if (props.childIds) {
      const childArr = new Y.Array<string>();
      childArr.push(props.childIds as string[]);
      bm.set("children", childArr);
      bm.set("collapsed", (props.collapsed as boolean) ?? false);
    }

    // characters is Y.Text with Quill delta formatting
    // Callers must include trailing "\n" in the text content
    const chars = (props.characters as Y.Text) || (() => { const t = new Y.Text(); t.insert(0, "\n"); return t; })();
    bm.set("characters", chars);
    blocksMap!.set(id, bm);
    rootChildren!.push([id]);
    return id;
  }

  /**
   * Add a child block (not added to rootChildren — only referenced by parent's children array).
   */
  function addChildBlock(type: string, props: Record<string, unknown> = {}): string {
    const id = genBlockId();
    const bm = new Y.Map();
    bm.set("id", id);
    bm.set("type", type);
    bm.set("indent", (props.indent as number) || 0);
    bm.set("color", (props.color as string) || "transparent");
    bm.set("align", (props.align as string) || "left");
    const chars = (props.characters as Y.Text) || (() => { const t = new Y.Text(); t.insert(0, "\n"); return t; })();
    bm.set("characters", chars);
    blocksMap!.set(id, bm);
    return id; // NOT added to rootChildren
  }

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const type = block.level === 1 ? "hLarge" : block.level === 2 ? "hMedium" : "hSmall";
        const chars = new Y.Text();
        insertInlineText(chars, 0, block.children);
        addBlock(type, { characters: chars });
        break;
      }
      case "paragraph": {
        const chars = new Y.Text();
        insertInlineText(chars, 0, block.children);
        addBlock("paragraph", { indent: block.indent, color: block.color, align: block.align, characters: chars });
        break;
      }
      case "list": {
        const listType = block.style === "bullet" ? "listItemBullet" : "listItemNumber";
        for (const item of block.items) {
          const chars = new Y.Text();
          insertInlineText(chars, 0, item.children);
          addBlock(listType, { indent: item.indent, characters: chars });
        }
        break;
      }
      case "checklist": {
        for (const item of block.items) {
          const chars = new Y.Text();
          insertInlineText(chars, 0, item.children);
          addBlock(item.checked ? "listItemChecked" : "listItemUnchecked", { characters: chars });
        }
        break;
      }
      case "divider":
        // Divider is Y.js type "hLine" — only has id + type, no characters
        addBlock("hLine", { noCharacters: true });
        break;
      case "blockquote": {
        const chars = new Y.Text();
        insertInlineText(chars, 0, block.children);
        addBlock("blockquote", { characters: chars });  // MUST be lowercase — "blockQuote" triggers version error
        break;
      }
      case "code": {
        const id = genBlockId();
        const bm = new Y.Map();
        bm.set("id", id);
        bm.set("type", "syntax");
        bm.set("setCursor", false);
        bm.set("wrap", false);
        bm.set("lineNumbers", true);
        bm.set("align", "left");
        bm.set("indent", 0);
        bm.set("data-language", block.language || "plaintext");
        const chars = new Y.Text();
        chars.insert(0, block.code + "\n");
        bm.set("characters", chars);
        // Caption sub-block (required by FuseBase client)
        const capId = genBlockId();
        const cap = new Y.Map();
        cap.set("id", capId);
        cap.set("type", "caption");
        cap.set("align", "left");
        cap.set("indent", 0);
        const capChars = new Y.Text();
        capChars.insert(0, "\n");
        cap.set("characters", capChars);
        blocksMap!.set(capId, cap);
        bm.set("caption", capId);
        blocksMap!.set(id, bm);
        rootChildren!.push([id]);
        break;
      }
      case "toggle": {
        // Toggle block: parent block has characters (summary text) + children (array of child block IDs)
        // Create child blocks first, then reference them in the parent
        const childIds: string[] = [];
        for (const child of block.children) {
          // Recursively process child blocks but add them as child blocks (not root)
          const childChars = new Y.Text();
          if (child.type === "paragraph") {
            insertInlineText(childChars, 0, child.children);
            childIds.push(addChildBlock("paragraph", { characters: childChars }));
          } else {
            // For simplicity, treat other child types as paragraphs
            insertInlineText(childChars, 0, [{ text: "(nested block)" }]);
            childIds.push(addChildBlock("paragraph", { characters: childChars }));
          }
        }
        const summaryChars = new Y.Text();
        insertInlineText(summaryChars, 0, block.summary);
        addBlock("toggle", {
          characters: summaryChars,
          childIds,
          collapsed: block.collapsed ?? false,
        });
        break;
      }
      case "hint": {
        // Hint/callout block — same structure as paragraph
        const chars = new Y.Text();
        insertInlineText(chars, 0, block.children);
        addBlock("hint", { color: block.color || "transparent", characters: chars });
        break;
      }
      case "collapsible-heading": {
        // Collapsible heading: like toggle but with heading type name
        const typeMap = { 1: "collapsibleHLarge", 2: "collapsibleHMedium", 3: "collapsibleHSmall" } as const;
        const childIds: string[] = [];
        for (const child of block.children) {
          const childChars = new Y.Text();
          if (child.type === "paragraph") {
            insertInlineText(childChars, 0, child.children);
            childIds.push(addChildBlock("paragraph", { characters: childChars }));
          } else {
            insertInlineText(childChars, 0, [{ text: "(nested block)" }]);
            childIds.push(addChildBlock("paragraph", { characters: childChars }));
          }
        }
        const summaryChars = new Y.Text();
        insertInlineText(summaryChars, 0, block.summary);
        addBlock(typeMap[block.level], {
          characters: summaryChars,
          childIds,
          collapsed: block.collapsed ?? false,
        });
        break;
      }
      case "table": {
        // Create table, columns, and rows
        const colIds: string[] = [];
        for (const col of block.columns) {
          const colId = genBlockId();
          const cm = new Y.Map();
          cm.set("id", colId);
          cm.set("type", "column");
          cm.set("text", col.text);
          cm.set("columnType", col.type);
          if (col.type === "singleselect" && col.dbSelect) {
            cm.set("dbSelect", col.dbSelect);
          }
          blocksMap!.set(colId, cm);
          colIds.push(colId);
        }

        const rowIds: string[] = [];
        for (const row of block.rows) {
          const cellIds: string[] = [];
          for (const cell of row.cells) {
            const cellId = genBlockId();
            const cellMap = new Y.Map();
            cellMap.set("id", cellId);

            if (cell.cellType === "text") {
              cellMap.set("type", "tableCellText");
              cellMap.set("cellType", "text");
              const textId = genBlockId();
              const tm = new Y.Map();
              tm.set("id", textId);
              tm.set("type", "tableText");
              const chars = new Y.Text();
              insertInlineText(chars, 0, cell.children);
              tm.set("characters", chars);
              blocksMap!.set(textId, tm);
              const kids = new Y.Array<string>();
              kids.push([textId]);
              cellMap.set("children", kids);
            } else if (cell.cellType === "singleselect") {
              cellMap.set("type", "tableCellSelect");
              cellMap.set("cellType", "singleselect");
              const sel = new Y.Array<string>();
              sel.push(cell.selected);
              cellMap.set("selected", sel);
            } else if (cell.cellType === "progress") {
              cellMap.set("type", "tableCellProgress");
              cellMap.set("cellType", "progress");
              cellMap.set("progress", cell.progress);
            } else if (cell.cellType === "checkbox") {
              cellMap.set("type", "tableCellCheckbox");
              cellMap.set("cellType", "checkbox");
              cellMap.set("checked", cell.checked);
            } else if (cell.cellType === "date") {
              cellMap.set("type", "tableCellDate");
              cellMap.set("cellType", "date");
              cellMap.set("timestamp", cell.timestamp);
            }

            blocksMap!.set(cellId, cellMap);
            cellIds.push(cellId);
          }
          const rowId = genBlockId();
          const rm = new Y.Map();
          rm.set("id", rowId);
          rm.set("type", "row");
          const rowKids = new Y.Array<string>();
          rowKids.push(cellIds);
          rm.set("children", rowKids);
          blocksMap!.set(rowId, rm);
          rowIds.push(rowId);
        }

        const tableId = genBlockId();
        const tm = new Y.Map();
        tm.set("id", tableId);
        tm.set("type", "table");
        tm.set("version", 2);
        tm.set("size", { cols: block.columns.length, rows: block.rows.length, visibleRows: block.rows.length });

        const colArr = new Y.Array<string>();
        colArr.push(colIds);
        tm.set("columns", colArr);

        const rowArr = new Y.Array<string>();
        rowArr.push(rowIds);
        tm.set("rows", rowArr);
        tm.set("indent", 0);

        // Add empty caption
        const capId = genBlockId();
        const cap = new Y.Map();
        cap.set("id", capId);
        cap.set("type", "caption");
        cap.set("align", "left");
        cap.set("indent", 0);
        const chars = new Y.Text();
        chars.insert(0, "\n");
        cap.set("characters", chars);
        blocksMap!.set(capId, cap);
        tm.set("caption", capId);

        blocksMap!.set(tableId, tm);
        rootChildren!.push([tableId]);
        break;
      }
      case "grid": {
        const colIds: string[] = [];
        for (const col of block.columns) {
          const colId = genBlockId();
          const cm = new Y.Map();
          cm.set("id", colId);
          cm.set("type", "gridCol");
          cm.set("width", col.width);

          const kids = new Y.Array<string>();
          const kidIds: string[] = [];
          for (const child of col.children) {
            const childChars = new Y.Text();
            if (child.type === "paragraph") {
              insertInlineText(childChars, 0, child.children);
              kidIds.push(addChildBlock("paragraph", { characters: childChars }));
            } else {
              insertInlineText(childChars, 0, [{ text: "(nested item)" }]);
              kidIds.push(addChildBlock("paragraph", { characters: childChars }));
            }
          }
          if (kidIds.length > 0) kids.push(kidIds);
          cm.set("children", kids);
          blocksMap!.set(colId, cm);
          colIds.push(colId);
        }

        const gridId = genBlockId();
        const gm = new Y.Map();
        gm.set("id", gridId);
        gm.set("type", "grid");
        gm.set("widths", new Y.Map());
        const colsArr = new Y.Array<string>();
        colsArr.push(colIds);
        gm.set("children", colsArr);

        blocksMap!.set(gridId, gm);
        rootChildren!.push([gridId]);
        break;
      }
      case "file": {
        const id = genBlockId();
        const m = new Y.Map();
        m.set("id", id);
        m.set("type", "file");
        m.set("syncedViewerState", new Y.Map());
        m.set("syncedInterfaceState", new Y.Map());
        if (block.fileId) m.set("fileId", block.fileId);
        const capId = genBlockId();
        const cap = new Y.Map();
        cap.set("id", capId);
        cap.set("type", "caption");
        cap.set("align", "left");
        cap.set("indent", 0);
        const chars = new Y.Text();
        if (block.caption) {
          insertInlineText(chars, 0, block.caption);
        } else {
          chars.insert(0, "\n");
        }
        cap.set("characters", chars);
        blocksMap!.set(capId, cap);
        m.set("caption", capId);

        blocksMap!.set(id, m);
        rootChildren!.push([id]);
        break;
      }
      case "remote-frame": {
        const id = genBlockId();
        const m = new Y.Map();
        m.set("id", id);
        m.set("type", "remote-frame");
        m.set("src", block.src);
        m.set("embed-type", null);
        m.set("html", null);
        m.set("signature", "");
        m.set("allowOverWidth", false);

        const capId = genBlockId();
        const cap = new Y.Map();
        cap.set("id", capId);
        cap.set("type", "caption");
        cap.set("align", "left");
        cap.set("indent", 0);
        const chars = new Y.Text();
        if (block.caption) {
          insertInlineText(chars, 0, block.caption);
        } else {
          chars.insert(0, "\n");
        }
        cap.set("characters", chars);
        blocksMap!.set(capId, cap);
        m.set("caption", capId);

        blocksMap!.set(id, m);
        rootChildren!.push([id]);
        break;
      }
      case "uploader": {
        const id = genBlockId();
        const m = new Y.Map();
        m.set("id", id);
        m.set("type", "uploader");
        m.set("children", new Y.Array<string>());
        m.set("enabledInPublicPage", true);
        blocksMap!.set(id, m);
        rootChildren!.push([id]);
        break;
      }
      case "foreign-dashboard": {
        const id = genBlockId();
        const m = new Y.Map();
        m.set("id", id);
        m.set("type", "foreign-dashboard");
        m.set("componentType", "dashboard");
        m.set("componentData", {
          entityType: "database",
          databaseId: block.databaseId,
          dashboardId: block.dashboardId,
          dashboardViewId: block.dashboardViewId,
          tableSelector: false,
          viewSelector: true
        });
        m.set("blotParams", { forbidInColumn: true });
        m.set("fullwidthMode", true);
        blocksMap!.set(id, m);
        rootChildren!.push([id]);
        break;
      }
      case "board": {
        const id = genBlockId();
        const m = new Y.Map();
        m.set("id", id);
        m.set("type", "board");
        m.set("layout", { "add-new-column": true });
        m.set("boardId", block.boardId);
        blocksMap!.set(id, m);
        rootChildren!.push([id]);
        break;
      }
      case "tasks-list": {
        const id = genBlockId();
        const m = new Y.Map();
        m.set("id", id);
        m.set("type", "tasks-list");
        m.set("tasksListId", block.tasksListId);
        blocksMap!.set(id, m);
        rootChildren!.push([id]);
        break;
      }
      case "button-single": {
        const id = genBlockId();
        const m = new Y.Map();
        m.set("id", id);
        m.set("type", "button-single");
        m.set("showForm", false);
        m.set("title", block.title);
        m.set("url", block.url);
        blocksMap!.set(id, m);
        rootChildren!.push([id]);
        break;
      }
      case "step": {
        const childIds: string[] = [];
        for (const child of block.children) {
          const childChars = new Y.Text();
          if (child.type === "paragraph") {
            insertInlineText(childChars, 0, child.children);
            childIds.push(addChildBlock("paragraph", { characters: childChars }));
          } else {
            insertInlineText(childChars, 0, [{ text: "(nested block)" }]);
            childIds.push(addChildBlock("paragraph", { characters: childChars }));
          }
        }

        const id = genBlockId();
        const m = new Y.Map();
        m.set("id", id);
        m.set("type", "step");
        m.set("collapsed", false);
        m.set("show-arrow", true);
        const chars = new Y.Text();
        chars.insert(0, "\n");
        m.set("characters", chars);

        const kids = new Y.Array<string>();
        if (childIds.length > 0) kids.push(childIds);
        m.set("children", kids);

        blocksMap!.set(id, m);
        rootChildren!.push([id]);
        break;
      }
      case "image": {
        const id = genBlockId();
        const m = new Y.Map();
        m.set("id", id);
        m.set("type", "image");
        m.set("src", block.src);
        m.set("imageShadow", false);
        m.set("allowOverWidth", false);
        m.set("indent", 0);
        m.set("color", "transparent");
        m.set("align", "center");
        if (block.width) {
          m.set("width", block.width);
          m.set("noGridWidth", block.width);
        }
        if (block.ratio) m.set("ratio", block.ratio);
        if (block.originalSize) m.set("originalSize", block.originalSize);

        const capId = genBlockId();
        const cap = new Y.Map();
        cap.set("id", capId);
        cap.set("type", "caption");
        cap.set("align", "left");
        cap.set("indent", 0);
        const chars = new Y.Text();
        if (block.caption) {
          insertInlineText(chars, 0, block.caption);
        } else {
          chars.insert(0, "\n");
        }
        cap.set("characters", chars);
        blocksMap!.set(capId, cap);
        m.set("caption", capId);

        blocksMap!.set(id, m);
        rootChildren!.push([id]);
        break;
      }
      case "bookmark": {
        const id = genBlockId();
        const m = new Y.Map();
        m.set("id", id);
        m.set("type", "bookmark");
        m.set("viewMode", "card");
        m.set("name", null);
        m.set("description", null);
        m.set("attachmentGlobalId", null);
        m.set("icon", null);
        m.set("src", block.url || null);
        m.set("color", "yellow-green");
        m.set("previewId", null);

        blocksMap!.set(id, m);
        rootChildren!.push([id]);
        break;
      }
      case "outline": {
        const id = genBlockId();
        const m = new Y.Map();
        m.set("id", id);
        m.set("type", "outline");
        m.set("name", null);
        m.set("bordered", block.bordered ?? true);
        m.set("numbered", block.numbered ?? true);
        m.set("expanded", block.expanded ?? true);

        blocksMap!.set(id, m);
        rootChildren!.push([id]);
        break;
      }
      case "step-aggregator": {
        const id = genBlockId();
        const m = new Y.Map();
        m.set("id", id);
        m.set("type", "step-aggregator");

        blocksMap!.set(id, m);
        rootChildren!.push([id]);
        break;
      }
    }
  }
}

// ─── JWT ───

async function getAuthToken(host: string, workspaceId: string, pageId: string, cookie: string): Promise<string> {
  const res = await fetch(
    `https://${host}/v4/api/workspaces/${workspaceId}/texts/${pageId}/tokens`,
    { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ tokens: [] }) },
  );
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  const data = (await res.json()) as { token: string };
  return data.token;
}

// ─── Main writer ───

/**
 * Write content to a Fusebase page using the native Y.js WebSocket protocol.
 *
 * @param host - Fusebase host (e.g., "inkabeam.nimbusweb.me")
 * @param workspaceId - Workspace ID
 * @param pageId - Page/note ID
 * @param cookie - Auth cookie string
 * @param blocks - Content blocks to write
 * @param options - Options
 */
export async function writeContentViaWebSocket(
  host: string,
  workspaceId: string,
  pageId: string,
  cookie: string,
  blocks: ContentBlock[],
  options: {
    /** Replace existing content (default: true) */
    replace?: boolean;
    /** Timeout in ms (default: 20000) */
    timeout?: number;
  } = {},
): Promise<{ success: boolean; error?: string }> {
  const { replace = true, timeout = 20000 } = options;

  // Step 1: Get JWT
  let jwt: string;
  try {
    jwt = await getAuthToken(host, workspaceId, pageId, cookie);
  } catch (e) {
    return { success: false, error: `JWT auth failed: ${(e as Error).message}` };
  }

  // Step 2: Prepare initial Y.Doc
  // The browser creates its doc with the initial content BEFORE connecting.
  // The SyncStep1 in the URL is encoded from this initial state.
  const ydoc = new Y.Doc();

  // Build the SyncStep1 for the URL parameter
  // This is the state vector of our (empty) doc
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0); // sync message type
  encoding.writeVarUint(encoder, 0); // sub-type: step1
  const sv = Y.encodeStateVector(ydoc);
  encoding.writeVarUint8Array(encoder, sv);
  const syncStep1Bytes = encoding.toUint8Array(encoder);
  const syncStep1B64 = Buffer.from(syncStep1Bytes).toString("base64");

  // Step 3: Build WebSocket URL — MUST include encv2=true
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const textHost = "text.nimbusweb.me";
  const wsUrl = [
    `wss://${textHost}/socket.io.editor/${workspaceId}/${pageId}`,
    `?token=${jwt}`,
    `&cid=${ydoc.clientID}`,
    `&app=web&reason=editor&web-editor=1.1.10`,
    `&frame_id=${randomAlphaNum(7)}`,
    `&ratempt=0&widx=0`,
    `&encv2=true`,  // CRITICAL: enables V2 encoding on server
    `&timezone=${encodeURIComponent(tz)}`,
    `&syncStep1=${encodeURIComponent(syncStep1B64)}`,
  ].join("");

  // Step 4: Connect and sync
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${host}`, cookie },
    });

    let resolved = false;
    const done = (result: { success: boolean; error?: string }) => {
      if (!resolved) { resolved = true; clearTimeout(timeoutId); resolve(result); }
      try { ws.close(); } catch { }
    };

    const timeoutId = setTimeout(() => done({ success: false, error: "Timeout" }), timeout);

    ws.on("error", (e: Error) => done({ success: false, error: `WebSocket error: ${e.message}` }));
    ws.on("close", () => { if (!resolved) done({ success: false, error: "Connection closed before sync" }); });
    (ws as any).on("unexpected-response", (_req: unknown, res: { statusCode: number }) => {
      done({ success: false, error: `WebSocket upgrade failed: HTTP ${res.statusCode} (text sync server may be down)` });
    });

    ws.on("open", () => {
      // CRITICAL: Send awareness IMMEDIATELY upon connection, BEFORE any sync
      // This is what the browser does — awareness is the FIRST message sent
      const awarenessMsg = encodeAwarenessMessage(ydoc.clientID, 0, "{}");
      ws.send(Buffer.from(awarenessMsg));
    });

    let syncStep2Received = false;

    ws.on("message", (raw: Buffer, isBinary: boolean) => {
      if (!isBinary) return;
      const data = new Uint8Array(raw);
      if (data.length === 0) return;

      const msgType = data[0];

      // Ping → Pong
      if (msgType === 0x11) { ws.send(Buffer.from(new Uint8Array([0x12]))); return; }
      if (msgType === 0x12 || msgType === 0x01) return; // Pong, awareness

      // Sync (type 0)
      if (msgType !== 0x00) return;
      const [subType, subOff] = readVarUint(data, 1);

      if (subType === 0) {
        // Server SyncStep1: server sends its state vector, wants our state
        // We respond with SyncStep2 containing our complete document state
        // CRITICAL: Use V1 encoding — server expects V1 despite encv2=true in URL
        const [svLen, svStart] = readVarUint(data, subOff);
        const serverSv = data.slice(svStart, svStart + svLen);
        const update = Y.encodeStateAsUpdate(ydoc, serverSv);
        ws.send(Buffer.from(encodeSyncMessage(0x01, update)));
      }

      else if (subType === 1) {
        // Server SyncStep2: server sends its document state
        // With encv2=true, the data is V2-encoded
        syncStep2Received = true;
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);

        // Apply server state using V2 encoding (encv2=true mode)
        let applied = false;
        try { Y.applyUpdateV2(ydoc, updateData); applied = true; } catch { }
        if (!applied) {
          // Fallback to V1 just in case
          try { Y.applyUpdate(ydoc, updateData); applied = true; } catch { }
        }

        if (!applied) {
          done({ success: false, error: "Failed to apply server document state" });
          return;
        }

        // Now write our content and send the update
        try {
          const beforeSv = Y.encodeStateVector(ydoc);

          ydoc.transact(() => {
            if (replace) {
              // Clear existing content from both structures
              const rch = ydoc.getArray<string>("rootChildren");
              const blk = ydoc.getMap("blocks");
              if (rch.length > 0) rch.delete(0, rch.length);
              for (const k of Array.from(blk.keys())) blk.delete(k);
              // Also clear root.children if it exists (browser keeps it empty)
              const root = ydoc.getMap("root");
              const rootCh = root.get("children");
              if (rootCh instanceof Y.Array && rootCh.length > 0) rootCh.delete(0, rootCh.length);
            }
            // Ensure root.children exists (browser creates it, even if empty)
            const root = ydoc.getMap("root");
            if (!root.has("children")) {
              root.set("children", new Y.Array<string>());
            }
            addBlocksToDoc(ydoc, blocks);
          });

          // Encode diff as V1 — server expects V1 despite encv2=true in URL
          const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
          ws.send(Buffer.from(encodeSyncMessage(0x02, diff)));

          // Wait for server to process the update before closing
          setTimeout(() => done({ success: true }), 3000);
        } catch (e) {
          done({ success: false, error: `Write failed: ${(e as Error).message}` });
        }
      }

      else if (subType === 2) {
        // Incremental update from server or another client
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);
        try { Y.applyUpdateV2(ydoc, updateData); } catch {
          try { Y.applyUpdate(ydoc, updateData); } catch { }
        }
      }
    });
  });
}
