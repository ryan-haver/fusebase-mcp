/**
 * Y.js Document → HTML Decoder
 *
 * Converts a synced Y.Doc into clean, semantic HTML.
 * Used by readContentViaWebSocket() after syncing the document state.
 *
 * Y.Doc structure (Fusebase schema):
 *   doc.getArray("rootChildren") — ordered block IDs
 *   doc.getMap("blocks")         — block data keyed by ID
 *   Each block: Y.Map with id, type, indent, color, align, characters (Y.Text)
 *
 * @module yjs-html-decoder
 */

import * as Y from "yjs";

// ─── HTML escaping ───

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Y.Text delta → HTML conversion ───

interface DeltaOp {
  insert: string | object;
  attributes?: Record<string, unknown>;
}

function deltaToHtml(delta: DeltaOp[]): string {
  let html = "";
  for (const op of delta) {
    if (typeof op.insert !== "string") {
      // Embedded object (mention, dropdown, etc.) — render as placeholder
      const obj = op.insert as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length > 0) {
        const key = keys[0];
        const val = obj[key];
        if (key === "mention" && typeof val === "object" && val !== null) {
          const m = val as Record<string, string>;
          html += `<span class="mention" data-type="${escapeHtml(m.type || "")}">${escapeHtml(m.name || "")}</span>`;
        } else {
          html += `[${escapeHtml(key)}]`;
        }
      }
      continue;
    }

    let text = op.insert;
    // Strip trailing newline (block terminator, not content)
    if (text === "\n") continue;
    if (text.endsWith("\n")) text = text.slice(0, -1);
    if (text.length === 0) continue;

    const escaped = escapeHtml(text);
    const attrs = op.attributes || {};
    let segment = escaped;

    // Apply inline formatting in nesting order
    if (attrs.code) segment = `<code>${segment}</code>`;
    if (attrs.bold) segment = `<strong>${segment}</strong>`;
    if (attrs.italic) segment = `<em>${segment}</em>`;
    if (attrs.strikethrough) segment = `<del>${segment}</del>`;
    if (attrs.underline) segment = `<u>${segment}</u>`;
    if (attrs.link) segment = `<a href="${escapeHtml(String(attrs.link))}">${segment}</a>`;

    html += segment;
  }
  return html;
}

// ─── Block rendering ───

function renderBlock(
  type: string,
  content: string,
  align: string,
  color: string,
  indent: number,
  block: Y.Map<unknown>,
): string {
  const style = buildStyleAttrs(align, color, indent);

  switch (type) {
    case "hLarge":
      return `<h1${style}>${content}</h1>`;
    case "hMedium":
      return `<h2${style}>${content}</h2>`;
    case "hSmall":
      return `<h3${style}>${content}</h3>`;
    case "paragraph":
      return `<p${style}>${content}</p>`;
    case "blockquote":
      return `<blockquote${style}>${content}</blockquote>`;
    case "code": {
      const lang = block.get("language") as string | undefined;
      const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      return `<pre><code${langAttr}>${content}</code></pre>`;
    }
    case "hLine":
      return "<hr>";
    case "listItemBullet":
      return `<li${style}>${content}</li>`;
    case "listItemNumber":
      return `<li${style}>${content}</li>`;
    case "listItemChecked":
      return `<li${style}><input type="checkbox" checked disabled> ${content}</li>`;
    case "listItemUnchecked":
      return `<li${style}><input type="checkbox" disabled> ${content}</li>`;
    case "toggle": {
      const collapsed = block.get("collapsed") as boolean | undefined;
      return `<details${collapsed ? "" : " open"}><summary>${content}</summary></details>`;
    }
    case "hint":
      return `<div class="hint"${style}>${content}</div>`;
    case "collapsibleHLarge":
    case "collapsibleHMedium":
    case "collapsibleHSmall": {
      const tag = type === "collapsibleHLarge" ? "h1" : type === "collapsibleHMedium" ? "h2" : "h3";
      return `<details><summary><${tag}>${content}</${tag}></summary></details>`;
    }
    case "table":
      return `<div class="table-block">[Table: ${content || "inline table"}]</div>`;
    case "foreign-component": {
      const compType = block.get("componentType") as string | undefined;
      return `<div class="embedded">[Embedded: ${escapeHtml(compType || "component")}]</div>`;
    }
    case "board":
      return `<div class="board">[Kanban Board]</div>`;
    case "tasks-list":
      return `<div class="task-list">[Task List]</div>`;
    // ─── Phase 4 block types ───
    case "image": {
      const src = block.get("src") as string | undefined;
      const width = block.get("width") as number | undefined;
      const widthAttr = width ? ` width="${width}"` : "";
      return src ? `<img src="${escapeHtml(src)}"${widthAttr} alt="">` : `<!-- image: no src -->`;
    }
    case "file": {
      const fileId = block.get("fileId") as string | undefined;
      return `<div class="file-block">[File: ${escapeHtml(fileId || "attachment")}]</div>`;
    }
    case "bookmark": {
      const src = block.get("src") as string | undefined;
      const name = block.get("name") as string | undefined;
      const desc = block.get("description") as string | undefined;
      return `<a class="bookmark" href="${escapeHtml(src || "")}">${escapeHtml(name || src || "Bookmark")}${desc ? ` — ${escapeHtml(desc)}` : ""}</a>`;
    }
    case "remote-frame": {
      const src = block.get("src") as string | undefined;
      return src ? `<iframe src="${escapeHtml(src)}" frameborder="0"></iframe>` : `<!-- remote-frame: no src -->`;
    }
    case "outline":
      return `<nav class="outline">[Table of Contents]</nav>`;
    case "button-single": {
      const url = block.get("url") as string | undefined;
      return `<a class="button" href="${escapeHtml(url || "")}">${content || "Button"}</a>`;
    }
    case "step":
      return `<div class="step">${content}</div>`;
    case "step-aggregator":
      return `<div class="steps">[Steps]</div>`;
    case "syntax": {
      // "syntax" is the actual Y.js type for code blocks (writer uses "syntax")
      const lang = block.get("data-language") as string | undefined;
      const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      return `<pre><code${langAttr}>${content}</code></pre>`;
    }
    case "list":
      // Parent list container — children are rendered separately
      return "";
    case "listItemCheckbox": {
      const checked = block.get("checked") as boolean | undefined;
      return checked
        ? `<li${style}><input type="checkbox" checked disabled> ${content}</li>`
        : `<li${style}><input type="checkbox" disabled> ${content}</li>`;
    }
    case "caption":
      return content ? `<figcaption${style}>${content}</figcaption>` : "";
    case "uploader":
      return `<div class="uploader">[File Upload]</div>`;
    case "foreign-dashboard": {
      const dbId = block.get("dashboardId") as string | undefined;
      return `<div class="database">[Database: ${escapeHtml(dbId || "dashboard")}]</div>`;
    }
    case "grid":
      return `<div class="grid-layout">[Grid Layout]</div>`;
    case "gridCol":
      return content ? `<div class="grid-column">${content}</div>` : "";
    default:
      return content ? `<div class="unknown-block" data-type="${escapeHtml(type)}">${content}</div>` : `<!-- unknown block: ${escapeHtml(type)} -->`;
  }
}

function buildStyleAttrs(align: string, color: string, indent: number): string {
  const parts: string[] = [];
  if (align && align !== "left") parts.push(`text-align:${align}`);
  if (color && color !== "transparent") parts.push(`color:${color}`);
  if (indent > 0) parts.push(`margin-left:${indent * 2}em`);
  return parts.length > 0 ? ` style="${parts.join(";")}"` : "";
}

// ─── List grouping ───

interface RenderedBlock {
  type: string;
  html: string;
}

function groupAndJoinBlocks(rendered: RenderedBlock[]): string {
  const output: string[] = [];
  let currentListType: string | null = null;

  function closeList() {
    if (currentListType === "listItemBullet") output.push("</ul>");
    else if (currentListType === "listItemNumber") output.push("</ol>");
    else if (currentListType === "listItemChecked" || currentListType === "listItemUnchecked") output.push("</ul>");
    currentListType = null;
  }

  for (const block of rendered) {
    const isList = ["listItemBullet", "listItemNumber", "listItemChecked", "listItemUnchecked"].includes(block.type);

    if (isList) {
      const listGroup = block.type === "listItemNumber" ? "listItemNumber"
        : (block.type === "listItemChecked" || block.type === "listItemUnchecked") ? "listItemChecked"
          : "listItemBullet";

      if (currentListType !== listGroup) {
        closeList();
        if (listGroup === "listItemNumber") output.push("<ol>");
        else output.push(`<ul${listGroup === "listItemChecked" ? ' class="checklist"' : ""}>`);
        currentListType = listGroup;
      }
      output.push(block.html);
    } else {
      closeList();
      output.push(block.html);
    }
  }
  closeList();
  return output.join("\n");
}

// ─── Y.Doc → HTML ───

/**
 * Convert a synced Y.Doc into semantic HTML.
 *
 * This is the core decoder: given a properly-synced Y.Doc (from WebSocket sync),
 * it walks the doc structure and renders each block to HTML.
 *
 * @param doc - Synced Y.Doc containing Fusebase page content
 * @returns Clean HTML string
 */
export function decodeYDocToHtml(doc: Y.Doc): string {
  const blocksMap = doc.getMap("blocks");
  const rootChildren = doc.getArray<string>("rootChildren");

  // Determine block ordering
  let blockIds: string[] = rootChildren.toArray();
  if (blockIds.length === 0) {
    const root = doc.getMap("root");
    const children = root.get("children");
    if (children instanceof Y.Array) {
      blockIds = children.toArray() as string[];
    }
  }
  if (blockIds.length === 0 && blocksMap.size === 0) return "";
  if (blockIds.length === 0) blockIds = Array.from(blocksMap.keys());

  const rendered: RenderedBlock[] = [];

  for (const blockId of blockIds) {
    const block = blocksMap.get(blockId);
    if (!(block instanceof Y.Map)) continue;

    const type = (block.get("type") as string) || "paragraph";
    const align = (block.get("align") as string) || "left";
    const color = (block.get("color") as string) || "transparent";
    const indent = (block.get("indent") as number) || 0;

    // Extract text content from Y.Text characters
    let content = "";
    const chars = block.get("characters");
    if (chars instanceof Y.Text) {
      const delta = chars.toDelta() as DeltaOp[];
      content = deltaToHtml(delta);
    }

    // hLine (divider) has no characters
    if (type === "hLine" && !content) {
      rendered.push({ type, html: "<hr>" });
      continue;
    }

    const html = renderBlock(type, content, align, color, indent, block);
    rendered.push({ type, html });
  }

  if (rendered.length === 0) return "";
  return groupAndJoinBlocks(rendered);
}

/**
 * Legacy compatibility: attempt to decode raw binary.
 * NOTE: Fusebase dump binary is NOT a standard Y.js update format.
 * This will work only if the binary happens to be a valid Y.js update.
 * For reliable decoding, use readContentViaWebSocket() from yjs-ws-writer.ts.
 */
export function decodeYjsToHtml(binary: Uint8Array): string {
  if (!binary || binary.length === 0) return "";
  try {
    const doc = new Y.Doc();
    try { Y.applyUpdateV2(doc, binary); } catch {
      try { Y.applyUpdate(doc, binary); } catch { return ""; }
    }
    return decodeYDocToHtml(doc);
  } catch {
    return "";
  }
}
