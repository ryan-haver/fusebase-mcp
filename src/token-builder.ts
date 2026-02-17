/**
 * Token Builder — converts Schema IR → Quill Delta tokens for Fusebase API.
 *
 * Fusebase's /tokens endpoint accepts Quill Delta format:
 *   { insert: string, attributes?: { bold?: true, italic?: true, ... } }
 *
 * Line-level formatting (headings, lists, etc.) is applied via
 * attributes on the trailing newline character.
 *
 * @module token-builder
 */

import type {
  ContentBlock,
  InlineSegment,
  ParagraphBlock,
  HeadingBlock,
  DividerBlock,
  ListBlock,
  ChecklistBlock,
  BlockquoteBlock,
  CodeBlock,
} from "./content-schema.js";

/** A single Quill Delta operation (insert only — no retain/delete needed for fresh writes) */
export interface DeltaOp {
  insert: string;
  attributes?: Record<string, unknown>;
}

// ─── Inline Helpers ──────────────────────────────────────────────

/** Convert an InlineSegment[] into Delta ops (without trailing newline). */
function inlineToDeltas(segments: InlineSegment[]): DeltaOp[] {
  const ops: DeltaOp[] = [];

  for (const seg of segments) {
    const attrs: Record<string, unknown> = {};
    if (seg.bold) attrs.bold = true;
    if (seg.italic) attrs.italic = true;

    if (Object.keys(attrs).length > 0) {
      ops.push({ insert: seg.text, attributes: attrs });
    } else {
      ops.push({ insert: seg.text });
    }
  }

  return ops;
}

// ─── Block Converters ────────────────────────────────────────────

function paragraphToDeltas(block: ParagraphBlock): DeltaOp[] {
  const ops = inlineToDeltas(block.children);
  // Trailing newline → paragraph (no special attributes needed)
  ops.push({ insert: "\n" });
  return ops;
}

function headingToDeltas(block: HeadingBlock): DeltaOp[] {
  const ops = inlineToDeltas(block.children);
  // Trailing newline carries the header attribute
  ops.push({ insert: "\n", attributes: { header: block.level } });
  return ops;
}

function dividerToDeltas(_block: DividerBlock): DeltaOp[] {
  // Quill represents dividers/HRs with a special embed or just a divider attribute
  // Fusebase may use a custom blot — try a newline with divider attribute first
  return [{ insert: "\n", attributes: { divider: true } }];
}

function listToDeltas(block: ListBlock): DeltaOp[] {
  const ops: DeltaOp[] = [];
  const listType = block.style === "bullet" ? "bullet" : "ordered";

  for (const item of block.items) {
    // Item content
    const itemOps = inlineToDeltas(item.children);
    ops.push(...itemOps);
    // Trailing newline with list attribute
    ops.push({ insert: "\n", attributes: { list: listType } });
  }

  return ops;
}

function checklistToDeltas(block: ChecklistBlock): DeltaOp[] {
  const ops: DeltaOp[] = [];

  for (const item of block.items) {
    const itemOps = inlineToDeltas(item.children);
    ops.push(...itemOps);
    ops.push({
      insert: "\n",
      attributes: { list: "checked", checked: item.checked },
    });
  }

  return ops;
}

function blockquoteToDeltas(block: BlockquoteBlock): DeltaOp[] {
  const ops = inlineToDeltas(block.children);
  ops.push({ insert: "\n", attributes: { blockquote: true } });
  return ops;
}

function codeToDeltas(block: CodeBlock): DeltaOp[] {
  // Code blocks: each line gets a code-block attribute on its newline
  const lines = block.code.split("\n");
  const ops: DeltaOp[] = [];

  for (const line of lines) {
    if (line.length > 0) {
      ops.push({ insert: line });
    }
    ops.push({
      insert: "\n",
      attributes: { "code-block": block.language || true },
    });
  }

  return ops;
}

// ─── Main Export ─────────────────────────────────────────────────

/**
 * Convert an array of ContentBlock (Schema IR) into Quill Delta ops
 * suitable for Fusebase's /tokens API.
 */
export function schemaToTokens(blocks: ContentBlock[]): DeltaOp[] {
  const ops: DeltaOp[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
        ops.push(...paragraphToDeltas(block));
        break;
      case "heading":
        ops.push(...headingToDeltas(block));
        break;
      case "divider":
        ops.push(...dividerToDeltas(block));
        break;
      case "list":
        ops.push(...listToDeltas(block));
        break;
      case "checklist":
        ops.push(...checklistToDeltas(block));
        break;
      case "blockquote":
        ops.push(...blockquoteToDeltas(block));
        break;
      case "code":
        ops.push(...codeToDeltas(block));
        break;
    }
  }

  return ops;
}
