/**
 * Y.js Binary → HTML Decoder
 *
 * Decodes raw Y.js binary state (from Fusebase `/dump/` endpoint)
 * into clean, semantic HTML.
 *
 * IMPORTANT: We cannot use Y.applyUpdate() because Fusebase uses custom Y.js
 * content types that the standard yjs library doesn't recognize. Instead, we
 * parse the binary update format manually using lib0/decoding.
 *
 * Y.js Update Binary Format (relevant parts):
 *   - varuint: struct count
 *   - for each struct group: clientId, clock, structs...
 *   - structs contain: info byte, then type-specific data
 *   - Content types we care about:
 *     - ContentString (info & 0x1F = 4): wraps a string value
 *     - ContentAny (info & 0x1F = 8): wraps arbitrary JSON data
 *     - ContentType (info & 0x1F = 7): wraps a Y type (Map, Array, etc.)
 *
 * Our strategy: Extract all readable text content from the binary by looking
 * for the known structural patterns (root, blocks, children, characters).
 *
 * @module yjs-html-decoder
 */

import * as decoding from "lib0/decoding";

// ─── HTML escaping ───

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Regex-based extraction from raw binary text ───

interface ExtractedBlock {
  id: string;
  type: string;
  indent: number;
  color: string;
  align: string;
  language?: string;
  text: string;
  formatting: FormattingSpan[];
  componentType?: string;
  componentData?: string;
  boardId?: string;
  tasksListId?: string;
}

interface FormattingSpan {
  format: string; // 'bold', 'italic', 'strike', 'code'
  value: string;  // 'true' or 'null'
  position: number; // char position in extracted text
}

/**
 * Extract blocks from the raw binary by decoding readable text segments.
 *
 * The binary contains clearly readable strings like:
 *   root·children·blocks·b1770671822054_0·id·type·paragraph·characters·H·e·l·l·o
 */
function extractBlocksFromBinary(binary: Uint8Array): ExtractedBlock[] {
  // Convert to text, replacing non-printable bytes with null char for splitting
  const text = new TextDecoder("utf-8", { fatal: false }).decode(binary);

  // Find block definitions: look for patterns like type·w·{blockType} preceded by id·w·{blockId}
  const blocks: ExtractedBlock[] = [];
  const blockOrder: string[] = [];

  // Extract children array (block ordering) first
  // Pattern: children followed by block IDs separated by markers
  const childrenMatch = text.match(/children[\x00-\x1f]*(.+?)(?=rootChildren|blocks)/s);
  if (childrenMatch) {
    const childText = childrenMatch[1];
    const idMatches = childText.match(/b\d+_\d+/g);
    if (idMatches) blockOrder.push(...idMatches);
  }

  // Extract each block — find all block IDs that appear in the blocks map
  // Pattern: blocks map contains entries like {blockId}·(data)
  const blockIdRegex = /b\d+_\d+/g;
  const allBlockIds = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = blockIdRegex.exec(text)) !== null) {
    allBlockIds.add(m[0]);
  }

  // For each unique block ID, extract its properties
  for (const blockId of allBlockIds) {
    // Find the section of data for this block
    // Look for patterns: blockId...type...{typeValue}...characters...{charData}
    const blockStart = text.indexOf(blockId);
    if (blockStart === -1) continue;

    // Find type value after this block
    const typeSearchRegion = text.substring(blockStart, blockStart + 500);
    const typeMatch = typeSearchRegion.match(/type[\x00-\x1f\x80-\xff]*w[\x00-\x1f\x80-\xff]*([a-zA-Z][a-zA-Z0-9-]*)/);

    const block: ExtractedBlock = {
      id: blockId,
      type: typeMatch ? typeMatch[1] : "paragraph",
      indent: 0,
      color: "transparent",
      align: "left",
      text: "",
      formatting: [],
    };

    // Extract indent
    const indentMatch = typeSearchRegion.match(/indent[\x00-\x1f\x80-\xff]*}([\x00-\xff])/);
    if (indentMatch) block.indent = indentMatch[1].charCodeAt(0);

    // Extract color
    const colorMatch = typeSearchRegion.match(/color[\x00-\x1f\x80-\xff]*w[\x00-\x1f\x80-\xff]*([a-zA-Z]+)/);
    if (colorMatch) block.color = colorMatch[1];

    // Extract align
    const alignMatch = typeSearchRegion.match(/align[\x00-\x1f\x80-\xff]*w[\x00-\x1f\x80-\xff]*([a-zA-Z]+)/);
    if (alignMatch) block.align = alignMatch[1];

    // Extract language (for code blocks)
    const langMatch = typeSearchRegion.match(/language[\x00-\x1f\x80-\xff]*w[\x00-\x1f\x80-\xff]*([a-zA-Z]+)/);
    if (langMatch) block.language = langMatch[1];

    // Extract component type (for foreign-component blocks)
    const compMatch = typeSearchRegion.match(/componentType[\x00-\x1f\x80-\xff]*w[\x00-\x1f\x80-\xff]*([a-zA-Z-]+)/);
    if (compMatch) block.componentType = compMatch[1];

    // Extract boardId
    const boardMatch = typeSearchRegion.match(/boardId[\x00-\x1f\x80-\xff]*w[\x00-\x1f\x80-\xff]*([a-zA-Z0-9]+)/);
    if (boardMatch) block.boardId = boardMatch[1];

    // Extract tasksListId
    const tasksMatch = typeSearchRegion.match(/tasksListId[\x00-\x1f\x80-\xff]*w[\x00-\x1f\x80-\xff]*([a-zA-Z0-9]+)/);
    if (tasksMatch) block.tasksListId = tasksMatch[1];

    blocks.push(block);
  }

  // Now extract character content for each block by looking at the character
  // sequences. Characters are stored as: w·{char}w·{char}w·{char}
  // with format toggles as: v·{format}w·{value}
  extractCharacterContent(text, blocks);

  // Order blocks according to children array
  if (blockOrder.length > 0) {
    const blockMap = new Map(blocks.map(b => [b.id, b]));
    const ordered: ExtractedBlock[] = [];
    for (const id of blockOrder) {
      const block = blockMap.get(id);
      if (block) {
        ordered.push(block);
        blockMap.delete(id);
      }
    }
    // Add any blocks not in children (shouldn't happen but safety)
    for (const [, block] of blockMap) ordered.push(block);
    return ordered;
  }

  return blocks;
}

/**
 * Extract character sequences from the binary text.
 *
 * Character encoding in Y.js binary:
 *   w + (length byte) + char = regular character
 *   v + field count + format_name + w + value = format toggle
 */
function extractCharacterContent(text: string, blocks: ExtractedBlock[]): void {
  for (const block of blocks) {
    // Find the characters section for this block
    // Pattern: after block's type/indent/color/align, find "characters" then char data
    const blockIdx = text.indexOf(block.id);
    if (blockIdx === -1) continue;

    // Find "characters" keyword after this block
    const charKeyword = text.indexOf("characters", blockIdx);
    if (charKeyword === -1) continue;

    // Find the next block ID or end of data to bound our search
    const nextBlockRegex = /b\d+_\d+/g;
    nextBlockRegex.lastIndex = charKeyword + 15;
    const nextMatch = nextBlockRegex.exec(text);
    const endIdx = nextMatch ? nextMatch.index : charKeyword + 2000;

    // Extract the character region
    const charRegion = text.substring(charKeyword + 10, endIdx);

    // Parse character-by-character
    // The pattern is: 'w' byte followed by '\x01' (length=1) followed by actual char
    // OR 'v' for format toggle objects
    const chars: string[] = [];
    const formatting: FormattingSpan[] = [];

    let i = 0;
    while (i < charRegion.length) {
      const c = charRegion[i];

      if (c === 'w' && i + 1 < charRegion.length) {
        const next = charRegion[i + 1];
        if (next === '\x01') {
          // Single char follows
          if (i + 2 < charRegion.length) {
            const ch = charRegion[i + 2];
            if (ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) < 0x7f) {
              chars.push(ch);
            }
            i += 3;
            continue;
          }
        } else if (next.charCodeAt(0) >= 0x20 && next.charCodeAt(0) < 0x7f && next !== 'w' && next !== 'v') {
          // Sometimes the length byte is omitted or different
          chars.push(next);
          i += 2;
          continue;
        }
      }

      // Check for format toggle: v + field_count + field_name + w + value
      if (c === 'v' && i + 1 < charRegion.length) {
        const fieldCount = charRegion.charCodeAt(i + 1);
        if (fieldCount >= 1 && fieldCount <= 5) {
          // Try to extract format name
          const rest = charRegion.substring(i + 2, i + 30);
          const formatMatch = rest.match(/^[\x00-\x1f\x80-\xff]*(bold|italic|strike|code|link)[\x00-\x1f\x80-\xff]*w[\x00-\x1f\x80-\xff]*(true|null|false)/);
          if (formatMatch) {
            formatting.push({
              format: formatMatch[1],
              value: formatMatch[2],
              position: chars.length,
            });
            i += 2 + formatMatch.index! + formatMatch[0].length;
            continue;
          }
        }
      }

      i++;
    }

    block.text = chars.join("");
    block.formatting = formatting;
  }
}

// ─── Block → HTML rendering ───

function renderBlock(block: ExtractedBlock): string {
  const styleAttrs = buildStyleAttrs(block.align, block.color, block.indent);
  const content = applyFormatting(block.text, block.formatting);

  switch (block.type) {
    case "hLarge":
      return `<h1${styleAttrs}>${content}</h1>`;
    case "hMedium":
      return `<h2${styleAttrs}>${content}</h2>`;
    case "hSmall":
      return `<h3${styleAttrs}>${content}</h3>`;
    case "paragraph":
      return `<p${styleAttrs}>${content}</p>`;
    case "divider":
      return "<hr>";
    case "code":
      return `<pre><code${block.language ? ` class="language-${escapeHtml(block.language)}"` : ""}>${escapeHtml(block.text)}</code></pre>`;
    case "blockQuote":
      return `<blockquote${styleAttrs}>${content}</blockquote>`;
    case "listItemBullet":
      return `<li${styleAttrs}>${content}</li>`;
    case "listItemNumber":
      return `<li${styleAttrs}>${content}</li>`;
    case "listItemChecked":
      return `<li${styleAttrs}>☑ ${content}</li>`;
    case "listItemUnchecked":
      return `<li${styleAttrs}>☐ ${content}</li>`;
    case "toggle":
      return `<details><summary>${content}</summary></details>`;
    case "foreign-component":
    case "foreigncomponent": {
      const comp = block.componentType || "unknown";
      return `<div class="embed-placeholder">[Embedded ${escapeHtml(comp)}]</div>`;
    }
    case "board": {
      return `<div class="embed-placeholder">[Kanban Board${block.boardId ? ` id:${block.boardId}` : ""}]</div>`;
    }
    case "tasks-list":
    case "tasksList": {
      return `<div class="embed-placeholder">[Task List${block.tasksListId ? ` id:${block.tasksListId}` : ""}]</div>`;
    }
    default:
      if (content) {
        return `<div data-block-type="${escapeHtml(block.type)}">${content}</div>`;
      }
      return `<!-- unknown block: ${escapeHtml(block.type)} -->`;
  }
}

function applyFormatting(text: string, formatting: FormattingSpan[]): string {
  if (!text) return "";
  if (formatting.length === 0) return escapeHtml(text);

  // Sort formatting by position
  const sorted = [...formatting].sort((a, b) => a.position - b.position);

  // Build formatted HTML
  const parts: string[] = [];
  let lastPos = 0;
  const openTags: Set<string> = new Set();

  for (const span of sorted) {
    // Add text before this format change
    if (span.position > lastPos) {
      parts.push(escapeHtml(text.substring(lastPos, span.position)));
      lastPos = span.position;
    }

    if (span.value === "true") {
      const tag = formatTag(span.format);
      if (tag && !openTags.has(span.format)) {
        parts.push(`<${tag}>`);
        openTags.add(span.format);
      }
    } else {
      const tag = formatTag(span.format);
      if (tag && openTags.has(span.format)) {
        parts.push(`</${tag}>`);
        openTags.delete(span.format);
      }
    }
  }

  // Add remaining text
  if (lastPos < text.length) {
    parts.push(escapeHtml(text.substring(lastPos)));
  }

  // Close any remaining open tags
  for (const fmt of openTags) {
    const tag = formatTag(fmt);
    if (tag) parts.push(`</${tag}>`);
  }

  return parts.join("");
}

function formatTag(format: string): string | null {
  switch (format) {
    case "bold": return "strong";
    case "italic": return "em";
    case "strike": return "s";
    case "code": return "code";
    default: return null;
  }
}

function buildStyleAttrs(align: string, color: string, indent: number): string {
  const styles: string[] = [];
  if (align && align !== "left") styles.push(`text-align:${align}`);
  if (color && color !== "transparent") styles.push(`color:${color}`);
  if (indent > 0) styles.push(`margin-left:${indent * 2}em`);
  return styles.length > 0 ? ` style="${styles.join(";")}"` : "";
}

// ─── List grouping ───

function groupAndJoinBlocks(blocks: ExtractedBlock[]): string {
  const output: string[] = [];
  let currentListTag: string | null = null;

  function closeList() {
    if (currentListTag) {
      output.push(`</${currentListTag}>`);
      currentListTag = null;
    }
  }

  for (const block of blocks) {
    const html = renderBlock(block);
    const isListItem = ["listItemBullet", "listItemChecked", "listItemUnchecked"].includes(block.type)
      || block.type === "listItemNumber";

    if (isListItem) {
      const tag = block.type === "listItemNumber" ? "ol" : "ul";
      if (currentListTag !== tag) {
        closeList();
        output.push(`<${tag}>`);
        currentListTag = tag;
      }
      output.push(html);
    } else {
      closeList();
      output.push(html);
    }
  }

  closeList();
  return output.join("\n");
}

// ─── Main decoder ───

/**
 * Decode raw Y.js binary state into semantic HTML.
 *
 * Uses a custom binary parser since standard Y.applyUpdate() fails
 * on Fusebase's custom content types.
 *
 * @param binary - Raw Y.js binary (`Uint8Array`) from `/dump/` endpoint
 * @returns Clean HTML string
 */
export function decodeYjsToHtml(binary: Uint8Array): string {
  if (!binary || binary.length === 0) return "";

  try {
    const blocks = extractBlocksFromBinary(binary);
    if (blocks.length === 0) return "";
    return groupAndJoinBlocks(blocks);
  } catch (e) {
    return `<!-- Failed to decode Y.js binary: ${(e as Error).message} -->`;
  }
}
