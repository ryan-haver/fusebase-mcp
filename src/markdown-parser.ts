/**
 * Markdown Parser — Converts Markdown strings to Content Schema IR.
 *
 * Parsing is done by a real CommonMark + GFM parser (`mdast-util-from-markdown` with
 * `micromark-extension-gfm` / `mdast-util-gfm`, see decision D2 in
 * docs/PLAN-review-remediation.md). This module only maps the resulting mdast tree onto
 * the block IR in `content-schema.ts`, plus a few extensions the IR supports but
 * CommonMark does not:
 *
 * - `==highlight==` (a post-pass over text nodes; only `==` pairs whose inner boundaries are
 *   not whitespace, so `a == b` stays literal)
 * - inline HTML formatting tags: `<u>`, `<ins>`, `<mark>`, `<b>`, `<strong>`, `<i>`, `<em>`,
 *   `<s>`, `<del>`, `<strike>`, `<code>`, `<br>` (paired with a linear stack scan — CON-9b)
 * - GitHub callouts `> [!NOTE]` etc. → hint blocks; `>> text` → hint without colour
 * - `<details><summary>…</summary>…</details>` → toggle blocks
 * - GFM tables → table blocks with conservative column type inference
 *
 * Mapping notes / IR limits:
 * - H4–H6 become level-3 headings (FuseBase has three heading levels).
 * - Soft line breaks become a space (one paragraph); hard breaks (`  \n`, `\`, `<br>`)
 *   become "\n" inside the block.
 * - `ListBlock` has no start number, so `3. foo` is written as a list starting at 1.
 * - `ChecklistItemBlock` has no indent, so nested task items are flattened into one checklist.
 * - A list block has one style, so a list mixing bullets / numbers / tasks is split into
 *   consecutive list blocks.
 * - Other raw HTML is kept as literal text (HTML comments are dropped).
 */

import { fromMarkdown } from "mdast-util-from-markdown";
import { gfm } from "micromark-extension-gfm";
import { gfmFromMarkdown } from "mdast-util-gfm";
import type * as M from "mdast";

import type {
  ContentBlock,
  InlineSegment,
  ListItemBlock,
  ChecklistItemBlock,
  ImageBlock,
  ToggleBlock,
  TableBlock,
  TableColumn,
  TableRow,
  TableCell,
  TableCellType,
} from "./content-schema.js";

/**
 * Only allow link schemes that can't run script when the link is clicked in FuseBase:
 * http(s), mailto, tel, and relative / fragment links. Anything else (javascript:,
 * vbscript:, data:, file:, ...) keeps its text but loses the link.
 */
export function safeLinkUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  // Browsers ignore control characters and whitespace inside a scheme ("java\tscript:").
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const compact = url.replace(/[\u0000-\u0020]/g, "");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1]?.toLowerCase();
  if (scheme === undefined) return url; // relative, fragment or query link
  return ["http", "https", "mailto", "tel"].includes(scheme) ? url : undefined;
}

/* ------------------------------------------------------------------ */
/*  Parsing                                                            */
/* ------------------------------------------------------------------ */

/*
 * Parsing runs in two phases, both with micromark:
 *
 * 1. Block phase: the whole document with every inline construct disabled. Paragraph,
 *    heading and table-cell text comes out as raw inline markdown (container prefixes such
 *    as `> ` and list indentation already stripped). This phase is linear.
 * 2. Inline phase: each raw run is parsed on its own with every block construct disabled.
 *    micromark's inline resolution is superlinear within one very large paragraph, so runs
 *    longer than INLINE_CHUNK_THRESHOLD are parsed in whitespace-separated chunks (an inline
 *    construct spanning a chunk boundary in such a huge paragraph is kept as literal text).
 */

/** Constructs that create blocks; disabled for the inline phase. */
const FLOW_CONSTRUCTS = [
  "blockQuote",
  "codeFenced",
  "codeIndented",
  "definition",
  "headingAtx",
  "htmlFlow",
  "list",
  "setextUnderline",
  "thematicBreak",
  "table",
  "gfmFootnoteDefinition",
];

/** Constructs that create inline content; disabled for the block phase. */
const INLINE_CONSTRUCTS = [
  "attention",
  "autolink",
  "characterEscape",
  "characterReference",
  "codeText",
  "hardBreakEscape",
  "htmlText",
  "labelEnd",
  "labelStartImage",
  "labelStartLink",
  "strikethrough",
  "gfmFootnoteCall",
  "gfmPotentialFootnoteCall",
  "wwwAutolink",
  "protocolAutolink",
  "emailAutolink",
];

const GFM_SYNTAX = gfm({ singleTilde: false });
const GFM_MDAST = gfmFromMarkdown();

const BLOCK_OPTIONS = {
  extensions: [GFM_SYNTAX, { disable: { null: INLINE_CONSTRUCTS } }],
  // The autolink-literal extension links bare URLs with a tree transform; that belongs to
  // the inline phase.
  mdastExtensions: GFM_MDAST.filter((ext) => !ext.transforms),
};
const AUTOLINK_LITERAL_CONSTRUCTS = ["wwwAutolink", "protocolAutolink", "emailAutolink"];
/** Could the run contain a GFM literal autolink (bare URL / www. / e-mail)? */
const AUTOLINK_HINT = /@|www\.|:\/\//i;

function inlineOptions(withDefs: boolean, autolinks: boolean) {
  let disabled = withDefs ? FLOW_CONSTRUCTS.filter((c) => c !== "definition") : FLOW_CONSTRUCTS;
  // Literal autolinks are the most expensive GFM extension; skip them when no run can match.
  if (!autolinks) disabled = [...disabled, ...AUTOLINK_LITERAL_CONSTRUCTS];
  return {
    extensions: [GFM_SYNTAX, { disable: { null: disabled } }],
    mdastExtensions: autolinks ? GFM_MDAST : GFM_MDAST.filter((ext) => !ext.transforms),
  };
}

/** Inline-phase options, indexed by `withDefs * 2 + autolinks`. */
const INLINE_OPTIONS = [
  inlineOptions(false, false),
  inlineOptions(false, true),
  inlineOptions(true, false),
  inlineOptions(true, true),
];

const INLINE_CHUNK_THRESHOLD = 10_000;
const INLINE_CHUNK_SIZE = 5_000;

function normalizeNewlines(md: string): string {
  return md.replace(/\r\n?/g, "\n");
}

interface Ctx {
  /** The (newline-normalised) source the tree was parsed from; used for `<details>`. */
  src: string;
  /** Link reference definitions: identifier → url. */
  defs: Map<string, string>;
  /** The definitions as markdown, prepended to inline runs that may use them. */
  defsSource: string;
}

function collectDefinitions(root: M.Root): { defs: Map<string, string>; defsSource: string } {
  const defs = new Map<string, string>();
  let defsSource = "";
  const stack: M.Nodes[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.type === "definition") {
      if (!defs.has(node.identifier)) {
        defs.set(node.identifier, node.url);
        // Only lets micromark recognise the reference; the URL itself comes from `defs`.
        defsSource += `[${node.label ?? node.identifier}]: x\n`;
      }
    } else if ("children" in node) {
      for (const child of node.children) stack.push(child);
    }
  }
  return { defs, defsSource: defsSource ? defsSource + "\n" : "" };
}

/** Split a huge inline run at whitespace into pieces of about INLINE_CHUNK_SIZE. */
function chunkInline(raw: string): { text: string; spaceBefore: boolean }[] {
  const pieces: { text: string; spaceBefore: boolean }[] = [];
  let start = 0;
  let spaceBefore = false;
  while (raw.length - start > INLINE_CHUNK_SIZE) {
    const limit = start + INLINE_CHUNK_SIZE;
    let cut = raw.lastIndexOf(" ", limit);
    if (cut <= start) cut = raw.lastIndexOf("\n", limit);
    if (cut <= start) {
      pieces.push({ text: raw.slice(start, limit), spaceBefore });
      start = limit;
      spaceBefore = false;
      continue;
    }
    pieces.push({ text: raw.slice(start, cut), spaceBefore });
    start = cut + 1;
    spaceBefore = true;
  }
  pieces.push({ text: raw.slice(start), spaceBefore });
  return pieces;
}

/**
 * Inline phase: parse a raw run into mdast phrasing content. Separate paragraphs (only
 * possible via `parseInline`) are joined with a line break.
 */
function parsePhrasing(raw: string, ctx: Ctx): M.PhrasingContent[] {
  const pieces = raw.length > INLINE_CHUNK_THRESHOLD ? chunkInline(raw) : [{ text: raw, spaceBefore: false }];
  const out: M.PhrasingContent[] = [];
  for (const piece of pieces) {
    if (piece.spaceBefore) out.push({ type: "text", value: " " });
    const withDefs = ctx.defsSource !== "" && piece.text.includes("[");
    const autolinks = AUTOLINK_HINT.test(piece.text);
    const tree = fromMarkdown(
      withDefs ? ctx.defsSource + piece.text : piece.text,
      INLINE_OPTIONS[(withDefs ? 2 : 0) + (autolinks ? 1 : 0)],
    );
    let first = true;
    for (const node of tree.children) {
      if (node.type !== "paragraph") continue;
      if (!first) out.push({ type: "break" });
      out.push(...node.children);
      first = false;
    }
  }
  return out;
}

/** Raw inline markdown of a block-phase node's children (text and hard breaks only). */
function rawOf(nodes: M.PhrasingContent[]): string {
  let raw = "";
  for (const node of nodes) {
    if (node.type === "text") raw += node.value;
    else if (node.type === "break") raw += "  \n";
  }
  return raw;
}

/* ------------------------------------------------------------------ */
/*  Inline mapping                                                     */
/* ------------------------------------------------------------------ */

interface Marks {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  code?: boolean;
  highlight?: boolean;
  link?: string;
}

type MarkKey = "bold" | "italic" | "strikethrough" | "underline" | "code" | "highlight";

interface ImageItem {
  kind: "image";
  src: string;
  alt: string;
  title: string;
}

type InlineItem = InlineSegment | ImageItem;

const HTML_MARK_TAGS: Record<string, MarkKey> = {
  u: "underline",
  ins: "underline",
  mark: "highlight",
  b: "bold",
  strong: "bold",
  i: "italic",
  em: "italic",
  s: "strikethrough",
  del: "strikethrough",
  strike: "strikethrough",
  code: "code",
};

const OPEN_TAG = /^<([a-z][a-z0-9]*)(?:\s[^>]*)?>$/i;
const CLOSE_TAG = /^<\/([a-z][a-z0-9]*)\s*>$/i;
const BR_TAG = /^<br\s*\/?>$/i;
const COMMENT = /^<!--[\s\S]*-->$/;

function makeSegment(text: string, m: Marks): InlineSegment {
  const seg: InlineSegment = { text };
  if (m.bold) seg.bold = true;
  if (m.italic) seg.italic = true;
  if (m.strikethrough) seg.strikethrough = true;
  if (m.underline) seg.underline = true;
  if (m.code) seg.code = true;
  if (m.link !== undefined) seg.link = m.link;
  if (m.highlight) seg.highlight = { color: "yellow" };
  return seg;
}

const isSpace = (ch: string): boolean => /\s/.test(ch);

/** Character just outside a text node, for `==` flanking checks. */
function neighbourChar(nodes: M.PhrasingContent[], index: number, fromEnd: boolean): string {
  const node = nodes[index];
  if (!node) return " "; // start/end of the run counts as whitespace
  if (node.type === "text") {
    if (!node.value) return " ";
    return fromEnd ? node.value[node.value.length - 1] : node.value[0];
  }
  if (node.type === "break") return " ";
  return "x"; // any other inline node (emphasis, code, link…) is non-whitespace
}

/**
 * Walk one level of phrasing content. HTML formatting tags and `==` delimiters are paired
 * within the level in a single linear pass, then applied as counters while walking.
 */
function walkPhrasing(
  nodes: M.PhrasingContent[],
  marks: Marks,
  ctx: Ctx,
  out: InlineItem[],
  splitImages: boolean,
): void {
  // 1. Pair HTML formatting tags (stack per tag name → linear, see CON-9b).
  const htmlDelta = new Map<number, { key: MarkKey; delta: 1 | -1 }>();
  const stacks = new Map<string, number[]>();
  for (let k = 0; k < nodes.length; k++) {
    const node = nodes[k];
    if (node.type !== "html") continue;
    const value = node.value.trim();
    const open = OPEN_TAG.exec(value);
    if (open) {
      const name = open[1].toLowerCase();
      if (HTML_MARK_TAGS[name] && !value.endsWith("/>")) {
        let stack = stacks.get(name);
        if (!stack) stacks.set(name, (stack = []));
        stack.push(k);
      }
      continue;
    }
    const close = CLOSE_TAG.exec(value);
    if (close) {
      const name = close[1].toLowerCase();
      const opener = stacks.get(name)?.pop();
      if (opener !== undefined) {
        htmlDelta.set(opener, { key: HTML_MARK_TAGS[name], delta: 1 });
        htmlDelta.set(k, { key: HTML_MARK_TAGS[name], delta: -1 });
      }
    }
  }

  // 2. Pair `==` highlight delimiters in text nodes (runs of exactly two `=`).
  const hlDelims = new Map<number, { off: number; delta: 1 | -1 }[]>();
  let pending: { k: number; off: number } | null = null;
  for (let k = 0; k < nodes.length; k++) {
    const node = nodes[k];
    if (node.type !== "text") continue;
    const v = node.value;
    let idx = v.indexOf("==");
    while (idx !== -1) {
      let end = idx;
      while (end < v.length && v[end] === "=") end++;
      if (end - idx === 2) {
        const prev = idx > 0 ? v[idx - 1] : neighbourChar(nodes, k - 1, true);
        const next = end < v.length ? v[end] : neighbourChar(nodes, k + 1, false);
        const canOpen = !isSpace(next);
        const canClose = !isSpace(prev);
        if (pending && canClose) {
          if (!hlDelims.has(pending.k)) hlDelims.set(pending.k, []);
          hlDelims.get(pending.k)!.push({ off: pending.off, delta: 1 });
          if (!hlDelims.has(k)) hlDelims.set(k, []);
          hlDelims.get(k)!.push({ off: idx, delta: -1 });
          pending = null;
        } else if (canOpen) {
          pending = { k, off: idx };
        }
      }
      idx = v.indexOf("==", end);
    }
  }

  // 3. Walk, applying counters.
  const counters: Record<MarkKey, number> = {
    bold: 0,
    italic: 0,
    strikethrough: 0,
    underline: 0,
    code: 0,
    highlight: 0,
  };
  const effective = (): Marks => ({
    bold: marks.bold || counters.bold > 0,
    italic: marks.italic || counters.italic > 0,
    strikethrough: marks.strikethrough || counters.strikethrough > 0,
    underline: marks.underline || counters.underline > 0,
    code: marks.code || counters.code > 0,
    highlight: marks.highlight || counters.highlight > 0,
    link: marks.link,
  });
  const emit = (text: string, extra?: Marks): void => {
    if (!text) return;
    out.push(makeSegment(text, extra ? { ...effective(), ...extra } : effective()));
  };

  for (let k = 0; k < nodes.length; k++) {
    const node = nodes[k];
    switch (node.type) {
      case "text": {
        // Soft line breaks inside a paragraph render as a space.
        const v = node.value.replace(/\n/g, " ");
        // `<br>` at the end of a line already broke it; drop the soft break that follows.
        const prev = nodes[k - 1];
        const afterBr = prev?.type === "html" && BR_TAG.test(prev.value.trim()) && node.value.startsWith("\n");
        let pos = afterBr ? 1 : 0;
        for (const d of hlDelims.get(k) ?? []) {
          emit(v.slice(pos, d.off));
          counters.highlight += d.delta;
          pos = d.off + 2;
        }
        emit(v.slice(pos));
        break;
      }
      case "html": {
        const role = htmlDelta.get(k);
        if (role) {
          counters[role.key] += role.delta;
          break;
        }
        const value = node.value.trim();
        if (BR_TAG.test(value)) emit("\n");
        else if (!COMMENT.test(value)) emit(node.value.replace(/\n/g, " "));
        break;
      }
      case "strong":
        walkPhrasing(node.children, { ...effective(), bold: true }, ctx, out, false);
        break;
      case "emphasis":
        walkPhrasing(node.children, { ...effective(), italic: true }, ctx, out, false);
        break;
      case "delete":
        walkPhrasing(node.children, { ...effective(), strikethrough: true }, ctx, out, false);
        break;
      case "inlineCode":
        emit(node.value.replace(/\n/g, " "), { code: true });
        break;
      case "link": {
        const url = safeLinkUrl(node.url);
        walkPhrasing(node.children, url !== undefined ? { ...effective(), link: url } : effective(), ctx, out, false);
        break;
      }
      case "linkReference": {
        const url = safeLinkUrl(ctx.defs.get(node.identifier));
        walkPhrasing(node.children, url !== undefined ? { ...effective(), link: url } : effective(), ctx, out, false);
        break;
      }
      case "image":
      case "imageReference": {
        const src = node.type === "image" ? node.url : ctx.defs.get(node.identifier) ?? "";
        const title = node.type === "image" ? node.title ?? "" : "";
        const alt = node.alt ?? "";
        if (splitImages && src) {
          out.push({ kind: "image", src, alt, title });
        } else {
          // IR segments cannot hold an image: keep it as a link to the image.
          const m = effective();
          const link = m.link ?? safeLinkUrl(src);
          emit(alt || src, link !== undefined ? { link } : {});
        }
        break;
      }
      case "break":
        emit("\n");
        break;
      case "footnoteReference":
        emit(`[^${node.label ?? node.identifier}]`);
        break;
      default: {
        const anyNode = node as M.Nodes;
        if ("children" in anyNode) {
          walkPhrasing(anyNode.children as M.PhrasingContent[], effective(), ctx, out, false);
        } else if ("value" in anyNode && typeof anyNode.value === "string") {
          emit(anyNode.value);
        }
      }
    }
  }
}

function sameFormat(a: InlineSegment, b: InlineSegment): boolean {
  const hl = (s: InlineSegment): string | undefined =>
    s.highlight === undefined ? undefined : typeof s.highlight === "string" ? s.highlight : s.highlight.color;
  return (
    !a.embed &&
    !b.embed &&
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.strikethrough === !!b.strikethrough &&
    !!a.underline === !!b.underline &&
    !!a.code === !!b.code &&
    a.link === b.link &&
    hl(a) === hl(b)
  );
}

/** Merge adjacent segments with identical formatting and drop empty ones. */
function mergeSegments(segs: InlineSegment[]): InlineSegment[] {
  const out: InlineSegment[] = [];
  for (const seg of segs) {
    if (!seg.embed && !seg.text) continue;
    const last = out[out.length - 1];
    if (last && sameFormat(last, seg)) {
      out[out.length - 1] = { ...last, text: (last.text ?? "") + (seg.text ?? "") };
    } else {
      out.push(seg);
    }
  }
  return out;
}

/** Trim ASCII whitespace at the edges of a run (leaves `&nbsp;` and code alone). */
function trimSegments(segs: InlineSegment[]): InlineSegment[] {
  const out = segs.map((s) => ({ ...s }));
  while (out.length && !out[0].code && out[0].text !== undefined) {
    out[0].text = out[0].text.replace(/^[ \t\n]+/, "");
    if (out[0].text) break;
    out.shift();
  }
  while (out.length) {
    const last = out[out.length - 1];
    if (last.code || last.text === undefined) break;
    last.text = last.text.replace(/[ \t\n]+$/, "");
    if (last.text) break;
    out.pop();
  }
  return out;
}

/** Map already-parsed (inline phase) phrasing content to segments. */
function segmentsOf(nodes: M.PhrasingContent[], ctx: Ctx): InlineSegment[] {
  const items: InlineItem[] = [];
  walkPhrasing(nodes, {}, ctx, items, false);
  return mergeSegments(items as InlineSegment[]);
}

/** Inline-parse the raw children of a block-phase node and map them to segments. */
function inlineOf(nodes: M.PhrasingContent[], ctx: Ctx): InlineSegment[] {
  return segmentsOf(parsePhrasing(rawOf(nodes), ctx), ctx);
}

function plainText(segs: InlineSegment[]): string {
  return segs.map((s) => s.text ?? "").join("");
}

/**
 * Parse inline markdown formatting into InlineSegment[].
 * Block syntax (headings, lists, quotes, tables…) is not interpreted.
 */
export function parseInline(text: string): InlineSegment[] {
  const src = normalizeNewlines(text);
  const ctx: Ctx = { src, defs: new Map(), defsSource: "" };
  return segmentsOf(parsePhrasing(src, ctx), ctx);
}

/* ------------------------------------------------------------------ */
/*  Block mapping                                                      */
/* ------------------------------------------------------------------ */

function imageBlock(img: ImageItem): ImageBlock {
  const block: ImageBlock = { type: "image", src: img.src };
  const caption = img.title || img.alt;
  if (caption) block.caption = [{ text: caption }];
  return block;
}

/** A paragraph; images directly inside it are split out into image blocks. */
function paragraphBlocks(p: M.Paragraph, ctx: Ctx): ContentBlock[] {
  const items: InlineItem[] = [];
  walkPhrasing(parsePhrasing(rawOf(p.children), ctx), {}, ctx, items, true);
  const blocks: ContentBlock[] = [];
  let run: InlineSegment[] = [];
  const flush = (): void => {
    const segs = trimSegments(mergeSegments(run));
    if (segs.length) blocks.push({ type: "paragraph", children: segs });
    run = [];
  };
  for (const item of items) {
    if ("kind" in item) {
      flush();
      blocks.push(imageBlock(item));
    } else {
      run.push(item);
    }
  }
  flush();
  return blocks;
}

/* ---------------------------- Blockquotes ------------------------- */

const CALLOUT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i;
const CALLOUT_COLORS: Record<string, string> = {
  NOTE: "indigo",
  TIP: "green",
  IMPORTANT: "purple",
  WARNING: "yellow",
  CAUTION: "red",
};

/** If a blockquote is a GitHub callout, return its colour and its children without the marker. */
function detectCallout(bq: M.Blockquote): { color: string; children: M.BlockContent[] } | null {
  const first = bq.children[0];
  if (!first || first.type !== "paragraph") return null;
  const firstText = first.children[0];
  if (!firstText || firstText.type !== "text") return null;
  const m = CALLOUT.exec(firstText.value);
  if (!m) return null;
  const rest = firstText.value.slice(m[0].length).replace(/^[ \t]*\n?/, "");
  const para: M.Paragraph = {
    ...first,
    children: rest ? [{ ...firstText, value: rest }, ...first.children.slice(1)] : first.children.slice(1),
  };
  const children = [...(para.children.length ? [para] : []), ...bq.children.slice(1)] as M.BlockContent[];
  return { color: CALLOUT_COLORS[m[1].toUpperCase()] ?? "indigo", children };
}

/**
 * Map a container whose IR block only holds inline text (blockquote / hint). Paragraphs and
 * headings are joined with "\n"; other blocks (lists, code…) are emitted after it in order.
 */
function inlineContainer(
  children: M.RootContent[],
  make: (segs: InlineSegment[]) => ContentBlock,
  ctx: Ctx,
  alwaysEmit: boolean,
): ContentBlock[] {
  const out: ContentBlock[] = [];
  let segs: InlineSegment[] = [];
  let has = false;
  let emitted = false;
  let other: M.RootContent[] = [];
  const flushOther = (): void => {
    if (other.length) out.push(...convertFlow(other, ctx));
    other = [];
  };
  const flushInline = (): void => {
    if (has) {
      out.push(make(mergeSegments(segs)));
      emitted = true;
    }
    segs = [];
    has = false;
  };
  for (const node of children) {
    if (node.type === "paragraph" || node.type === "heading") {
      flushOther();
      const s = inlineOf(node.children, ctx);
      if (!s.length) continue;
      if (has) segs.push({ text: "\n" });
      segs.push(...s);
      has = true;
    } else {
      flushInline();
      other.push(node);
    }
  }
  flushInline();
  flushOther();
  if (alwaysEmit && !emitted) out.unshift(make([]));
  return out;
}

function convertBlockquote(bq: M.Blockquote, ctx: Ctx): ContentBlock[] {
  const callout = detectCallout(bq);
  if (callout) {
    const { color } = callout;
    return inlineContainer(callout.children, (children) => ({ type: "hint", color, children }), ctx, true);
  }
  // `>> text` (a quote that only holds a quote) is the legacy syntax for an uncoloured hint.
  const only = bq.children[0];
  if (bq.children.length === 1 && only.type === "blockquote" && !detectCallout(only)) {
    return inlineContainer(only.children, (children) => ({ type: "hint", children }), ctx, true);
  }
  return inlineContainer(bq.children, (children) => ({ type: "blockquote", children }), ctx, false);
}

/* ------------------------------- Lists ---------------------------- */

type ListKind = "bullet" | "number" | "check";

interface ListEntry {
  kind: ListKind;
  indent: number;
  children: InlineSegment[];
  checked: boolean;
}

type FlatListItem = { entry: ListEntry } | { block: ContentBlock };

function flattenList(list: M.List, indent: number, ctx: Ctx, out: FlatListItem[]): void {
  for (const item of list.children) {
    const isTask = item.checked === true || item.checked === false;
    const kind: ListKind = isTask ? "check" : list.ordered ? "number" : "bullet";
    let entry = null as ListEntry | null; // assigned inside ensureEntry()
    let pending: M.RootContent[] = [];
    const ensureEntry = (): ListEntry => {
      if (!entry) {
        entry = { kind, indent, children: [], checked: item.checked === true };
        out.push({ entry });
      }
      return entry;
    };
    const flushPending = (): void => {
      if (pending.length) for (const block of convertFlow(pending, ctx)) out.push({ block });
      pending = [];
    };
    for (const child of item.children) {
      if (child.type === "paragraph" || child.type === "heading") {
        const segs = inlineOf(child.children, ctx);
        const last = out[out.length - 1];
        if (!entry) {
          ensureEntry().children = segs;
        } else if (pending.length === 0 && last && "entry" in last && last.entry === entry) {
          // A further paragraph of the same item (or a list continuation).
          if (segs.length) entry.children = mergeSegments([...entry.children, { text: "\n" }, ...segs]);
        } else {
          flushPending();
          if (segs.length) out.push({ block: { type: "paragraph", indent: indent + 1, children: segs } });
        }
      } else if (child.type === "list") {
        ensureEntry();
        flushPending();
        flattenList(child, indent + 1, ctx, out);
      } else {
        ensureEntry();
        pending.push(child);
      }
    }
    ensureEntry();
    flushPending();
  }
}

function groupList(flat: FlatListItem[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let kind: ListKind | null = null;
  let listItems: ListItemBlock[] = [];
  let checkItems: ChecklistItemBlock[] = [];
  const close = (): void => {
    if (kind === "check" && checkItems.length) blocks.push({ type: "checklist", items: checkItems });
    else if ((kind === "bullet" || kind === "number") && listItems.length) {
      blocks.push({ type: "list", style: kind, items: listItems });
    }
    kind = null;
    listItems = [];
    checkItems = [];
  };
  for (const item of flat) {
    if ("block" in item) {
      close();
      blocks.push(item.block);
      continue;
    }
    const e = item.entry;
    if (e.kind !== kind) {
      close();
      kind = e.kind;
    }
    if (e.kind === "check") checkItems.push({ children: e.children, checked: e.checked });
    else listItems.push({ children: e.children, indent: e.indent });
  }
  close();
  return blocks;
}

/* ------------------------------- Tables --------------------------- */

type InferredType = Extract<TableCellType, "number" | "currency" | "checkbox" | "date">;

const NUMBER_RE = /^-?(?:0|[1-9]\d{0,2}(?:,\d{3})+|[1-9]\d*)(?:\.\d+)?$/;
const CURRENCY_RE = /^-?\$(?:0|[1-9]\d{0,2}(?:,\d{3})+|[1-9]\d*)(?:\.\d{1,2})?$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Classify a cell value, only when coercing it loses no information: no leading zeros,
 * no ambiguous separators (`1,2`), no percentages, no precision loss, ISO dates only.
 */
function classifyValue(v: string): InferredType | null {
  if (v === "[x]" || v === "[X]" || v === "[ ]" || v === "true" || v === "false") return "checkbox";
  if (CURRENCY_RE.test(v)) {
    const n = Number(v.replace(/[$,]/g, ""));
    return Number.isFinite(n) && Math.abs(n) < 1e13 ? "currency" : null;
  }
  if (NUMBER_RE.test(v)) {
    const stripped = v.replace(/,/g, "");
    return String(Number(stripped)) === stripped ? "number" : null;
  }
  if (ISO_DATE_RE.test(v)) {
    const ts = Date.parse(`${v}T00:00:00Z`);
    return !isNaN(ts) && new Date(ts).toISOString().slice(0, 10) === v ? "date" : null;
  }
  return null;
}

function inferColumnType(cells: M.PhrasingContent[][]): TableCellType {
  let type: InferredType | null = null;
  let seen = false;
  for (const cell of cells) {
    if (cell.length === 0) continue;
    // Only plain text can be coerced; any formatting keeps the column as text.
    if (cell.length !== 1 || cell[0].type !== "text") return "text";
    const v = cell[0].value.trim();
    if (!v) continue;
    const t = classifyValue(v);
    if (!t || (seen && t !== type)) return "text";
    type = t;
    seen = true;
  }
  return type ?? "text";
}

/** GFM: `\|` inside a code span in a table cell is a literal pipe. */
function unescapeCellPipes(nodes: M.PhrasingContent[]): M.PhrasingContent[] {
  return nodes.map((node): M.PhrasingContent => {
    if (node.type === "inlineCode") return { ...node, value: node.value.replace(/\\\|/g, "|") };
    if ("children" in node) {
      return { ...node, children: unescapeCellPipes(node.children as M.PhrasingContent[]) } as M.PhrasingContent;
    }
    return node;
  });
}

function convertTable(table: M.Table, ctx: Ctx): TableBlock {
  const parseCell = (cell: M.TableCell | undefined): M.PhrasingContent[] =>
    cell ? unescapeCellPipes(parsePhrasing(rawOf(cell.children), ctx)) : [];
  const [head, ...body] = table.children;
  const headCells = (head?.children ?? []).map(parseCell);
  const width = headCells.length;
  const bodyCells = body.map((row) => Array.from({ length: width }, (_, c) => parseCell(row.children[c])));
  const columns: TableColumn[] = headCells.map((cell, c) => ({
    text: plainText(segmentsOf(cell, ctx)),
    type: inferColumnType(bodyCells.map((row) => row[c])),
  }));

  const rows: TableRow[] = bodyCells.map((row) => {
    const cells: (TableCell | null)[] = [];
    for (let c = 0; c < width; c++) {
      const cell = row[c];
      const type = columns[c].type;
      if (type === "text") {
        const align = table.align?.[c];
        const text: TableCell = { cellType: "text", children: segmentsOf(cell, ctx) };
        if (align === "center" || align === "right") text.align = align;
        cells.push(text);
        continue;
      }
      const v = plainText(segmentsOf(cell, ctx)).trim();
      if (!v) {
        cells.push(null); // empty cell, rather than a made-up 0 / date
      } else if (type === "currency") {
        cells.push({ cellType: "currency", value: Number(v.replace(/[$,]/g, "")) });
      } else if (type === "number") {
        cells.push({ cellType: "number", value: Number(v.replace(/,/g, "")) });
      } else if (type === "date") {
        cells.push({ cellType: "date", timestamp: Date.parse(`${v}T00:00:00Z`) });
      } else {
        cells.push({ cellType: "checkbox", checked: v === "[x]" || v === "[X]" || v === "true" });
      }
    }
    return { cells };
  });

  return { type: "table", columns, rows };
}

/* ------------------------------ Details --------------------------- */

const DETAILS_TAG = /<(\/?)details\b[^>]*>/gi;

function dedent(text: string): string {
  const lines = text.split("\n");
  let min = Infinity;
  for (const line of lines) {
    if (!line.trim()) continue;
    const indent = /^[ \t]*/.exec(line)![0].length;
    if (indent < min) min = indent;
  }
  if (!isFinite(min) || min === 0) return text;
  return lines.map((l) => l.slice(Math.min(min, /^[ \t]*/.exec(l)![0].length))).join("\n");
}

/**
 * Map `<details>` … `</details>` to a toggle. The opening tag starts the html node at
 * `nodes[start]`; the matching close tag may be in the same node or a later sibling
 * (blank lines inside the details split it into several mdast nodes). Content between
 * the tags is re-parsed as markdown from the source.
 */
function convertDetails(
  nodes: M.RootContent[],
  start: number,
  ctx: Ctx,
): { blocks: ContentBlock[]; next: number } | null {
  let depth = 0;
  let openEnd = -1;
  let openTag = "";
  let closeStart = -1;
  let closeEnd = -1;
  let j = start;
  for (; j < nodes.length; j++) {
    const n = nodes[j];
    if (n.type !== "html" && n.type !== "paragraph") continue;
    const s = n.position?.start.offset;
    const e = n.position?.end.offset;
    if (s === undefined || e === undefined) continue;
    const text = ctx.src.slice(s, e);
    DETAILS_TAG.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DETAILS_TAG.exec(text))) {
      if (!m[1]) {
        if (depth === 0 && openEnd < 0) {
          openEnd = s + m.index + m[0].length;
          openTag = m[0];
        }
        depth++;
      } else if (depth > 0) {
        depth--;
        if (depth === 0) {
          closeStart = s + m.index;
          closeEnd = closeStart + m[0].length;
          break;
        }
      }
    }
    if (closeStart >= 0 || openEnd < 0) break;
  }
  if (openEnd < 0) return null;

  const last = closeStart >= 0 ? j : nodes.length - 1;
  const lastEnd = nodes[last].position?.end.offset ?? ctx.src.length;
  const inner = ctx.src.slice(openEnd, closeStart >= 0 ? closeStart : lastEnd);

  const summaryMatch = /<summary\b[^>]*>([\s\S]*?)<\/summary\s*>/i.exec(inner);
  const summaryText = summaryMatch ? summaryMatch[1].trim() : "Details";
  const body = summaryMatch
    ? inner.slice(0, summaryMatch.index) + inner.slice(summaryMatch.index + summaryMatch[0].length)
    : inner;

  const toggle: ToggleBlock = {
    type: "toggle",
    summary: parseInline(summaryText),
    children: body.trim() ? markdownToSchema(dedent(body)) : [],
    collapsed: !/\sopen\b/i.test(openTag),
  };
  const blocks: ContentBlock[] = [toggle];
  if (closeEnd >= 0) {
    const tail = ctx.src.slice(closeEnd, lastEnd);
    if (tail.trim()) blocks.push(...markdownToSchema(dedent(tail)));
  }
  return { blocks, next: last + 1 };
}

/* ------------------------------- Flow ----------------------------- */

/** Raw HTML that is not a toggle: keep it as literal text, one paragraph per line. */
function htmlFlowBlocks(value: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const line of value.replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
    if (!line.trim()) continue;
    const segs = trimSegments(parseInline(line.trim()));
    if (segs.length) blocks.push({ type: "paragraph", children: segs });
  }
  return blocks;
}

function convertFlow(nodes: M.RootContent[], ctx: Ctx): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    switch (node.type) {
      case "paragraph":
        blocks.push(...paragraphBlocks(node, ctx));
        break;
      case "heading":
        blocks.push({
          type: "heading",
          // FuseBase has three heading levels; H4–H6 map to H3.
          level: Math.min(node.depth, 3) as 1 | 2 | 3,
          children: inlineOf(node.children, ctx),
        });
        break;
      case "thematicBreak":
        blocks.push({ type: "divider" });
        break;
      case "blockquote":
        blocks.push(...convertBlockquote(node, ctx));
        break;
      case "list": {
        const flat: FlatListItem[] = [];
        flattenList(node, 0, ctx, flat);
        blocks.push(...groupList(flat));
        break;
      }
      case "code":
        blocks.push(node.lang ? { type: "code", language: node.lang, code: node.value } : { type: "code", code: node.value });
        break;
      case "table":
        blocks.push(convertTable(node, ctx));
        break;
      case "html": {
        if (/^\s*<details\b/i.test(node.value)) {
          const details = convertDetails(nodes, i, ctx);
          if (details) {
            blocks.push(...details.blocks);
            i = details.next - 1;
            break;
          }
        }
        blocks.push(...htmlFlowBlocks(node.value));
        break;
      }
      case "footnoteDefinition": {
        const inner = convertFlow(node.children, ctx);
        const marker: InlineSegment = { text: `[^${node.label ?? node.identifier}]: ` };
        const first = inner[0];
        if (first?.type === "paragraph") inner[0] = { ...first, children: mergeSegments([marker, ...first.children]) };
        else inner.unshift({ type: "paragraph", children: [marker] });
        blocks.push(...inner);
        break;
      }
      case "definition":
        break; // used to resolve reference links; not content
      default: {
        const anyNode = node as M.Nodes;
        if ("children" in anyNode) blocks.push(...convertFlow(anyNode.children as M.RootContent[], ctx));
        else if ("value" in anyNode && typeof anyNode.value === "string" && anyNode.value.trim()) {
          blocks.push({ type: "paragraph", children: [{ text: anyNode.value }] });
        }
      }
    }
  }
  return blocks;
}

/**
 * Parse a markdown string into an array of ContentBlock objects.
 */
export function markdownToSchema(md: string): ContentBlock[] {
  const src = normalizeNewlines(md);
  const tree = fromMarkdown(src, BLOCK_OPTIONS);
  const ctx: Ctx = { src, ...collectDefinitions(tree) };
  return convertFlow(tree.children, ctx);
}
