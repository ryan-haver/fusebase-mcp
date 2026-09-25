/**
 * Y.js Document → HTML Decoder
 *
 * Converts a synced Y.Doc into clean, semantic HTML.
 * Used by readContentViaWebSocket() after syncing the document state.
 *
 * Y.Doc structure (Fusebase schema, see addBlocksToDoc in yjs-ws-writer.ts):
 *   doc.getArray("rootChildren") — ordered block IDs
 *   doc.getMap("blocks")         — block data keyed by ID
 *   Each block: Y.Map with id, type, indent, color, align, characters (Y.Text)
 *   Containers (list, toggle, collapsible heading, step, grid, gridCol) hold a
 *   `children` Y.Array of block IDs. Tables hold `columns` / `rows` arrays of IDs; each
 *   row's `children` holds cell IDs (or `false` for an empty cell); text-like cells hold
 *   a `tableText` child. Images, code, files, frames and tables reference a `caption` block.
 *
 * Output conventions (htmlToMarkdown in tools/helpers.ts relies on them):
 *   - list items are nested into real <ul>/<ol> trees by their `indent`
 *   - checklist items: <li data-checked="true|false"><input type="checkbox" …> text</li>
 *   - hints: <aside class="hint" data-color="…">
 *   - toggles: <details><summary>…</summary>…</details>
 *   - headings with children: <details class="collapsible-heading"><summary><hN>…</hN></summary>…</details>
 *   - images: <figure><img …><figcaption>…</figcaption></figure>
 *   - tables: <table><thead> (column titles) <tbody> (cell values)
 *
 * A decode failure throws YjsDecodeError rather than returning empty HTML.
 *
 * @module yjs-html-decoder
 */

import * as Y from "yjs";

// ─── Errors ───

/** Thrown when a Y.js update or document cannot be decoded. */
export class YjsDecodeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "YjsDecodeError";
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Apply a Y.js update to a doc, trying the V2 encoding first and then V1.
 * Throws YjsDecodeError when neither encoding applies, so callers can report the
 * failure instead of decoding a partially-synced (or empty) document.
 */
export function applyYjsUpdate(doc: Y.Doc, update: Uint8Array): void {
  let v2Error: unknown;
  try {
    Y.applyUpdateV2(doc, update);
    return;
  } catch (e) {
    v2Error = e;
  }
  try {
    Y.applyUpdate(doc, update);
  } catch (v1Error) {
    throw new YjsDecodeError(
      `Could not apply Y.js update (${update.length} bytes): V2: ${errMsg(v2Error)}; V1: ${errMsg(v1Error)}`,
      { cause: v1Error },
    );
  }
}

// ─── HTML escaping ───

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** ` name="value"` with the value HTML-escaped, or "" when the value is empty. */
function attr(name: string, value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  return ` ${name}="${escapeHtml(String(value))}"`;
}

/** A CSS value from the doc, or null if it is not a plain token (no quotes, `;`, `:`, `<`…). */
function cssValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const s = String(value).trim();
  return s && /^[#\w.,%() -]+$/.test(s) ? s : null;
}

// ─── Y.Text delta → HTML conversion ───

interface DeltaOp {
  insert: string | object;
  attributes?: Record<string, unknown>;
}

function embedToHtml(obj: Record<string, unknown>): string {
  const key = Object.keys(obj)[0];
  if (!key) return "";
  const val = obj[key];
  if (key === "mention" && typeof val === "object" && val !== null) {
    const m = val as Record<string, unknown>;
    return `<span class="mention"${attr("data-type", m.type)}>${escapeHtml(String(m.name ?? ""))}</span>`;
  }
  if (key === "date" && typeof val === "object" && val !== null) {
    const d = val as Record<string, unknown>;
    const label = d.name ?? d.value ?? "";
    return `<time${attr("datetime", d.value)}>${escapeHtml(String(label))}</time>`;
  }
  return `[${escapeHtml(key)}]`;
}

/** Drop the block terminator: the single trailing "\n" of the whole delta. */
function stripTerminator(delta: DeltaOp[]): DeltaOp[] {
  const last = delta[delta.length - 1];
  if (!last || typeof last.insert !== "string" || !last.insert.endsWith("\n")) return delta;
  const text = last.insert.slice(0, -1);
  return text ? [...delta.slice(0, -1), { ...last, insert: text }] : delta.slice(0, -1);
}

function deltaToHtml(delta: DeltaOp[]): string {
  let html = "";
  for (const op of stripTerminator(delta)) {
    if (typeof op.insert !== "string") {
      html += embedToHtml(op.insert as Record<string, unknown>);
      continue;
    }
    if (op.insert.length === 0) continue;

    const attrs = op.attributes || {};
    // Soft line breaks inside a block become <br>; each line is formatted separately.
    html += op.insert.split("\n").map((line) => {
      if (!line) return "";
      let segment = escapeHtml(line);
      // Apply inline formatting in nesting order
      if (attrs.code) segment = `<code>${segment}</code>`;
      if (attrs.bold) segment = `<strong>${segment}</strong>`;
      if (attrs.italic) segment = `<em>${segment}</em>`;
      if (attrs.strikethrough) segment = `<del>${segment}</del>`;
      if (attrs.underline) segment = `<u>${segment}</u>`;
      if (attrs.link) segment = `<a${attr("href", attrs.link)}>${segment}</a>`;
      if (attrs.highlight) segment = `<mark>${segment}</mark>`;
      return segment;
    }).join("<br>");
  }
  return html;
}

// ─── Doc access helpers ───

interface Ctx {
  blocks: Y.Map<unknown>;
  visited: Set<string>;
}

function getBlock(ctx: Ctx, id: unknown): Y.Map<unknown> | undefined {
  if (typeof id !== "string") return undefined;
  const b = ctx.blocks.get(id);
  return b instanceof Y.Map ? b : undefined;
}

function idList(value: unknown): unknown[] {
  if (value instanceof Y.Array) return value.toArray();
  if (Array.isArray(value)) return value;
  return [];
}

function textOf(value: unknown): string {
  if (value instanceof Y.Text) return value.toString();
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

function charsHtml(block: Y.Map<unknown>): string {
  const chars = block.get("characters");
  return chars instanceof Y.Text ? deltaToHtml(chars.toDelta() as DeltaOp[]) : "";
}

/** Raw text of a block (code blocks): no formatting, terminator removed, escaped. */
function charsRaw(block: Y.Map<unknown>): string {
  const chars = block.get("characters");
  if (!(chars instanceof Y.Text)) return "";
  return escapeHtml(chars.toString().replace(/\n$/, ""));
}

/** Inline HTML of the block's caption sub-block ("" when it has none or it is empty). */
function captionHtml(ctx: Ctx, block: Y.Map<unknown>): string {
  const capId = block.get("caption");
  const cap = getBlock(ctx, capId);
  if (!cap) return "";
  ctx.visited.add(capId as string);
  return charsHtml(cap);
}

function buildStyleAttrs(align: unknown, color: unknown, indent: unknown): string {
  const parts: string[] = [];
  const a = cssValue(align);
  const c = cssValue(color);
  const n = Number(indent);
  if (a && a !== "left") parts.push(`text-align:${a}`);
  if (c && c !== "transparent") parts.push(`color:${c}`);
  if (Number.isFinite(n) && n > 0) parts.push(`margin-left:${n * 2}em`);
  return parts.length > 0 ? attr("style", parts.join(";")) : "";
}

// ─── Rendered block + list grouping ───

type ListKind = "bullet" | "number" | "check";

interface ListItem {
  kind: ListKind;
  indent: number;
  checked: boolean;
  /** Attributes for the <li> (style) */
  attrs: string;
  /** Inner HTML of the <li> */
  inner: string;
}

interface RenderedBlock {
  type: string;
  html: string;
  list?: ListItem;
}

const LIST_TAG: Record<ListKind, string> = { bullet: "ul", number: "ol", check: "ul" };
const LIST_OPEN: Record<ListKind, string> = { bullet: "<ul>", number: "<ol>", check: '<ul class="checklist">' };

/** Turn a run of consecutive list items into nested <ul>/<ol> trees using their indent. */
function renderListRun(items: ListItem[]): string {
  const out: string[] = [];
  const stack: { kind: ListKind; indent: number }[] = [];
  const closeLi = () => { out[out.length - 1] += "</li>"; };
  const closeTop = () => {
    const top = stack.pop()!;
    closeLi();
    out.push(`</${LIST_TAG[top.kind]}>`);
  };

  for (const item of items) {
    while (stack.length && stack[stack.length - 1].indent > item.indent) closeTop();
    const top = stack[stack.length - 1];
    if (top && top.indent === item.indent) {
      if (top.kind === item.kind) {
        closeLi();
      } else {
        closeTop();
        out.push(LIST_OPEN[item.kind]);
        stack.push({ kind: item.kind, indent: item.indent });
      }
    } else {
      // Deeper than the open item (or first item): open a list, nested in the open <li> if any.
      out.push(LIST_OPEN[item.kind]);
      stack.push({ kind: item.kind, indent: item.indent });
    }
    const check = item.kind === "check"
      ? `<input type="checkbox"${item.checked ? " checked" : ""} disabled> `
      : "";
    const dataChecked = item.kind === "check" ? ` data-checked="${item.checked}"` : "";
    out.push(`<li${dataChecked}${item.attrs}>${check}${item.inner}`);
  }
  while (stack.length) closeTop();
  return out.join("\n");
}

function groupAndJoinBlocks(rendered: RenderedBlock[]): string {
  const output: string[] = [];
  let run: ListItem[] = [];
  const flush = () => {
    if (run.length) output.push(renderListRun(run));
    run = [];
  };
  for (const block of rendered) {
    if (block.list) {
      run.push(block.list);
    } else {
      flush();
      if (block.html) output.push(block.html);
    }
  }
  flush();
  return output.join("\n");
}

// ─── Tables ───

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", INR: "₹" };

function selectNames(col: Y.Map<unknown> | undefined, selected: unknown[]): string {
  let options: unknown = col?.get("dbSelect");
  if (options instanceof Y.Map) options = options.toJSON();
  const opts = (options && typeof options === "object" ? options : {}) as Record<string, { name?: string }>;
  return selected
    .filter((id): id is string => typeof id === "string")
    .map((id) => escapeHtml(opts[id]?.name ?? id))
    .join(", ");
}

function formatTimestamp(ts: unknown): { iso: string; label: string } | null {
  const n = Number(ts);
  if (ts === null || ts === undefined || ts === "" || !Number.isFinite(n)) return null;
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return null;
  const iso = d.toISOString();
  return { iso, label: iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso };
}

function renderCell(ctx: Ctx, cell: Y.Map<unknown>, col: Y.Map<unknown> | undefined): string {
  const cellType = (cell.get("cellType") as string | undefined)
    ?? String(cell.get("type") ?? "").replace(/^tableCell/, "").toLowerCase();

  switch (cellType) {
    case "checkbox":
      return `<input type="checkbox"${cell.get("checked") ? " checked" : ""} disabled>`;
    case "date": {
      const t = formatTimestamp(cell.get("timestamp"));
      return t ? `<time${attr("datetime", t.iso)}>${t.label}</time>` : "";
    }
    case "singleselect":
    case "multiselect":
    case "select":
      return selectNames(col, idList(cell.get("selected")));
    case "progress": {
      const p = Number(cell.get("progress"));
      return Number.isFinite(p) ? `${p}%` : "";
    }
    case "rating": {
      const r = Number(cell.get("rating"));
      const fmt = col?.get("format") as { ratingAmount?: number } | undefined;
      return Number.isFinite(r) ? `${r}/${Number(fmt?.ratingAmount) || 5}` : "";
    }
  }

  // Text-like cells (text, number, currency, link, mention, collaborator, …): children
  const parts: string[] = [];
  for (const childId of idList(cell.get("children"))) {
    const child = getBlock(ctx, childId);
    if (!child) continue;
    ctx.visited.add(childId as string);
    if (child.get("type") === "tableText" || child.get("type") === undefined) {
      parts.push(charsHtml(child));
    } else {
      const r = renderNode(ctx, childId as string);
      if (r) parts.push(r.list ? renderListRun([r.list]) : r.html);
    }
  }
  let html = parts.join("<br>");
  if (!html) {
    const value = cell.get("value");
    if (value !== undefined && value !== null) html = escapeHtml(textOf(value));
  }
  if (cellType === "currency" && /^[-+]?\d[\d,]*(\.\d+)?$/.test(html)) {
    const fmt = col?.get("format") as { currency?: string; customSymbol?: string } | undefined;
    const symbol = fmt?.customSymbol || CURRENCY_SYMBOLS[fmt?.currency ?? "USD"] || `${fmt?.currency} `;
    html = html.startsWith("-") ? `-${escapeHtml(symbol)}${html.slice(1)}` : `${escapeHtml(symbol)}${html}`;
  }
  return html;
}

function renderTable(ctx: Ctx, block: Y.Map<unknown>): string {
  const colIds = idList(block.get("columns"));
  const cols = colIds.map((id) => {
    const c = getBlock(ctx, id);
    if (c) ctx.visited.add(id as string);
    return c;
  });
  const order = idList(block.get("rowsOrder"));
  const rowIds = order.length > 0 ? order : idList(block.get("rows"));

  const head = cols.map((c) => `<th>${escapeHtml(textOf(c?.get("text")))}</th>`).join("");
  const bodyRows: string[] = [];
  for (const rowId of rowIds) {
    const row = getBlock(ctx, rowId);
    if (!row) continue;
    ctx.visited.add(rowId as string);
    const cells: string[] = [];
    idList(row.get("children")).forEach((cellId, ci) => {
      const cell = getBlock(ctx, cellId);
      if (!cell) {
        cells.push("<td></td>");
        return;
      }
      ctx.visited.add(cellId as string);
      if (cell.get("hidden")) return; // covered by a neighbour's colspan
      const span = attr("colspan", Number(cell.get("colspan")) > 1 ? Number(cell.get("colspan")) : "")
        + attr("rowspan", Number(cell.get("rowspan")) > 1 ? Number(cell.get("rowspan")) : "");
      cells.push(`<td${span}>${renderCell(ctx, cell, cols[ci])}</td>`);
    });
    bodyRows.push(`<tr>${cells.join("")}</tr>`);
  }

  const caption = captionHtml(ctx, block);
  return [
    "<table>",
    ...(caption ? [`<caption>${caption}</caption>`] : []),
    `<thead><tr>${head}</tr></thead>`,
    "<tbody>",
    ...bodyRows,
    "</tbody>",
    "</table>",
  ].join("\n");
}

// ─── Block rendering ───

const HEADING_TAG: Record<string, string> = {
  hLarge: "h1", hMedium: "h2", hSmall: "h3",
  collapsibleHLarge: "h1", collapsibleHMedium: "h2", collapsibleHSmall: "h3",
};

const LIST_ITEM_KIND: Record<string, ListKind> = {
  listItemBullet: "bullet",
  listItemNumber: "number",
  listItemCheckbox: "check",
  listItemChecked: "check",
  listItemUnchecked: "check",
};

function renderChildren(ctx: Ctx, block: Y.Map<unknown>): string {
  const rendered: RenderedBlock[] = [];
  for (const childId of idList(block.get("children"))) {
    if (typeof childId !== "string") continue;
    const r = renderNode(ctx, childId);
    if (r) rendered.push(r);
  }
  return rendered.length > 0 ? groupAndJoinBlocks(rendered) : "";
}

function figure(inner: string, caption: string, className?: string): string {
  if (!caption) return inner;
  return `<figure${attr("class", className)}>${inner}<figcaption>${caption}</figcaption></figure>`;
}

function renderNode(ctx: Ctx, blockId: string): RenderedBlock | null {
  if (ctx.visited.has(blockId)) return null;
  ctx.visited.add(blockId);
  const block = getBlock(ctx, blockId);
  if (!block) return null;

  try {
    return renderBlock(ctx, block);
  } catch (e) {
    if (e instanceof YjsDecodeError) throw e;
    throw new YjsDecodeError(`Failed to decode block ${blockId} (${String(block.get("type"))}): ${errMsg(e)}`, { cause: e });
  }
}

function renderBlock(ctx: Ctx, block: Y.Map<unknown>): RenderedBlock {
  const type = (block.get("type") as string) || "paragraph";
  const style = buildStyleAttrs(block.get("align"), block.get("color"), block.get("indent"));
  const content = charsHtml(block);
  const childHtml = renderChildren(ctx, block);
  const body = childHtml ? `\n${childHtml}\n` : "";
  const out = (html: string): RenderedBlock => ({ type, html });

  // List items: grouped and nested later by groupAndJoinBlocks
  const kind = LIST_ITEM_KIND[type];
  if (kind) {
    const checked = type === "listItemChecked" || (type === "listItemCheckbox" && Boolean(block.get("checked")));
    return {
      type,
      html: "",
      list: {
        kind,
        indent: Math.max(0, Number(block.get("indent")) || 0),
        checked,
        attrs: buildStyleAttrs(block.get("align"), block.get("color"), 0),
        inner: content + (childHtml ? `\n${childHtml}` : ""),
      },
    };
  }

  const heading = HEADING_TAG[type];
  if (heading) {
    const h = `<${heading}${style}>${content}</${heading}>`;
    if (!childHtml && !type.startsWith("collapsible")) return out(h);
    // A heading with children is a collapsible section: keep both its title and its body (CON-3).
    const open = block.get("collapsed") ? "" : " open";
    return out(`<details class="collapsible-heading"${open}><summary>${h}</summary>${body}</details>`);
  }

  switch (type) {
    case "paragraph":
      return out(`<p${style}>${content}</p>${body.trimEnd()}`);
    case "blockquote":
      return out(`<blockquote${style}>${content}${body}</blockquote>`);
    case "code":
    case "syntax": {
      const lang = (block.get("data-language") ?? block.get("language")) as string | undefined;
      const langAttr = lang && lang !== "plaintext" ? attr("class", `language-${lang}`) : "";
      return out(figure(`<pre><code${langAttr}>${charsRaw(block)}</code></pre>`, captionHtml(ctx, block), "code"));
    }
    case "hLine":
      return out("<hr>");
    case "toggle": {
      const open = block.get("collapsed") ? "" : " open";
      return out(`<details${open}><summary>${content || "Toggle"}</summary>${body}</details>`);
    }
    case "hint": {
      const color = cssValue(block.get("color"));
      const inner = childHtml ? `<p>${content}</p>\n${childHtml}` : content;
      return out(`<aside class="hint"${attr("data-color", color && color !== "transparent" ? color : "")}>${inner}</aside>`);
    }
    case "table":
      return out(renderTable(ctx, block));
    case "image": {
      const src = block.get("src") as string | undefined;
      if (!src) return out("<!-- image: no src -->");
      const width = cssValue(block.get("width"));
      const caption = captionHtml(ctx, block);
      const alt = caption.replace(/<[^>]*>/g, "");
      return out(figure(`<img${attr("src", src)}${attr("width", width)} alt="${alt}">`, caption, "image"));
    }
    case "file": {
      const fileId = block.get("fileId") as string | undefined;
      return out(figure(`<div class="file-block"${attr("data-file-id", fileId)}>[File: ${escapeHtml(fileId || "attachment")}]</div>`, captionHtml(ctx, block), "file"));
    }
    case "bookmark": {
      const src = block.get("src") as string | undefined;
      const name = block.get("name") as string | undefined;
      const desc = block.get("description") as string | undefined;
      return out(`<p><a class="bookmark"${attr("href", src || "")}>${escapeHtml(name || src || "Bookmark")}</a>${desc ? ` — ${escapeHtml(desc)}` : ""}</p>`);
    }
    case "remote-frame": {
      const src = block.get("src") as string | undefined;
      const frame = src ? `<iframe${attr("src", src)} frameborder="0"></iframe>` : "<!-- remote-frame: no src -->";
      return out(figure(frame, captionHtml(ctx, block), "frame"));
    }
    case "outline":
      return out(`<nav class="outline">[Table of Contents]</nav>`);
    case "button-single": {
      const url = block.get("url") as string | undefined;
      const title = block.get("title");
      const label = typeof title === "string" && title ? escapeHtml(title) : content || "Button";
      return out(`<p><a class="button"${attr("href", url || "")}>${label}</a></p>`);
    }
    case "step":
      return out(`<div class="step">${content ? `<p>${content}</p>` : ""}${body}</div>`);
    case "step-aggregator":
      return out(`<div class="steps">[Steps]</div>`);
    case "list":
      // Container of list items: the items are grouped / nested by groupAndJoinBlocks.
      return out(childHtml);
    case "caption":
      return out(content ? `<figcaption${style}>${content}</figcaption>` : "");
    case "grid":
      return out(childHtml ? `<div class="grid-layout">\n${childHtml}\n</div>` : "");
    case "gridCol":
      return out(content || childHtml ? `<div class="grid-column">${content}${body}</div>` : "");
    case "foreign-component": {
      const compType = block.get("componentType") as string | undefined;
      return out(`<div class="embedded">[Embedded: ${escapeHtml(compType || "component")}]</div>`);
    }
    case "board":
      return out(`<div class="board">[Kanban Board]</div>`);
    case "tasks-list":
      return out(`<div class="task-list">[Task List]</div>`);
    case "uploader":
      return out(`<div class="uploader">[File Upload]</div>`);
    case "foreign-dashboard": {
      const data = block.get("componentData") as { dashboardId?: string } | undefined;
      const dbId = (block.get("dashboardId") as string | undefined) ?? data?.dashboardId;
      return out(`<div class="database">[Database: ${escapeHtml(dbId || "dashboard")}]</div>`);
    }
    default:
      return out(content || childHtml
        ? `<div class="unknown-block"${attr("data-type", type)}>${content}${body}</div>`
        : `<!-- unknown block: ${escapeHtml(type).replace(/--/g, "- -")} -->`);
  }
}

// ─── Y.Doc → HTML ───

/** IDs referenced as children / captions / table parts, i.e. not top-level blocks. */
function referencedIds(blocks: Y.Map<unknown>): Set<string> {
  const refs = new Set<string>();
  blocks.forEach((b) => {
    if (!(b instanceof Y.Map)) return;
    for (const key of ["children", "columns", "rows"]) {
      for (const id of idList(b.get(key))) if (typeof id === "string") refs.add(id);
    }
    const cap = b.get("caption");
    if (typeof cap === "string") refs.add(cap);
  });
  return refs;
}

/**
 * Convert a synced Y.Doc into semantic HTML.
 *
 * This is the core decoder: given a properly-synced Y.Doc (from WebSocket sync),
 * it walks the doc structure and renders each block to HTML.
 *
 * @param doc - Synced Y.Doc containing Fusebase page content
 * @returns Clean HTML string ("" for an empty document)
 * @throws YjsDecodeError when a block cannot be decoded, or when the document lists
 *   top-level blocks but none of them exist (a broken or partial sync).
 */
export function decodeYDocToHtml(doc: Y.Doc): string {
  const blocksMap = doc.getMap("blocks") as Y.Map<unknown>;
  const rootChildren = doc.getArray<string>("rootChildren");

  // Determine block ordering
  let blockIds: unknown[] = rootChildren.toArray();
  if (blockIds.length === 0) {
    const root = doc.getMap("root");
    const children = root.get("children");
    if (children instanceof Y.Array) blockIds = children.toArray();
  }
  if (blockIds.length === 0 && blocksMap.size === 0) return "";
  if (blockIds.length === 0) {
    // No ordering array: render every block that is not nested inside another one.
    const refs = referencedIds(blocksMap);
    blockIds = Array.from(blocksMap.keys()).filter((id) => !refs.has(id));
  }

  const ctx: Ctx = { blocks: blocksMap, visited: new Set<string>() };
  const rendered: RenderedBlock[] = [];
  let found = 0;
  for (const blockId of blockIds) {
    if (typeof blockId !== "string") continue;
    if (getBlock(ctx, blockId)) found++;
    const item = renderNode(ctx, blockId);
    if (item) rendered.push(item);
  }

  if (found === 0 && blockIds.length > 0) {
    throw new YjsDecodeError(`Document lists ${blockIds.length} top-level blocks but none exist in the blocks map (incomplete sync?)`);
  }
  return groupAndJoinBlocks(rendered);
}

/**
 * Decode a raw Y.js update (V2 or V1) to HTML.
 * NOTE: the Fusebase dump binary is NOT a standard Y.js update. For reliable decoding,
 * use readContentViaWebSocket() from yjs-ws-writer.ts.
 *
 * @throws YjsDecodeError when the binary is not a valid Y.js update or cannot be decoded.
 */
export function decodeYjsToHtml(binary: Uint8Array): string {
  if (!binary || binary.length === 0) return "";
  const doc = new Y.Doc();
  applyYjsUpdate(doc, binary);
  return decodeYDocToHtml(doc);
}
