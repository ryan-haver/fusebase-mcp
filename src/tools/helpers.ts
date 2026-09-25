/**
 * Shared helpers and utilities for MCP tools.
 */

import * as path from "path";
import { fileURLToPath } from "url";
import TurndownService from "turndown";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Directory that download_attachment may write into (FUSEBASE_DOWNLOAD_DIR or data/downloads). */
export function downloadRoot(): string {
  return path.resolve(process.env.FUSEBASE_DOWNLOAD_DIR || path.join(PROJECT_ROOT, "data", "downloads"));
}

/**
 * Resolve where a downloaded attachment may be written. Both the filename and outputPath
 * come from tool arguments, so the result must stay inside downloadRoot(): the filename
 * is reduced to its base name, and outputPath is resolved relative to the root.
 */
export function resolveDownloadPath(filename: string, outputPath?: string): string {
  const root = downloadRoot();
  const target = outputPath
    ? path.resolve(root, outputPath)
    // eslint-disable-next-line no-control-regex -- stripping control characters from a remote filename is the point
    : path.join(root, path.basename(filename.replace(/\\/g, "/")).replace(/[\x00-\x1f]/g, "") || "attachment");
  if (!target.startsWith(root + path.sep)) {
    throw new Error(`Refusing to write outside the download directory (${root}). Use a path inside it, or set FUSEBASE_DOWNLOAD_DIR.`);
  }
  return target;
}

export function errorResult(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${msg}` }],
    isError: true,
  };
}

/** Guess MIME type from file extension */
export function guessMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeMap: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf",
    txt: "text/plain", md: "text/markdown", html: "text/html", css: "text/css",
    js: "application/javascript", json: "application/json", csv: "text/csv",
    zip: "application/zip", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    mp4: "video/mp4", mp3: "audio/mpeg", wav: "audio/wav",
  };
  return mimeMap[ext] || "application/octet-stream";
}

// ─── HTML → Markdown (get_page_content format "markdown") ───

/**
 * Hint colour → GitHub callout type. Mirrors the callout mapping in markdown-parser.ts
 * (NOTE→indigo, TIP→green, IMPORTANT→purple, WARNING→yellow, CAUTION→red) so that a
 * read → write round trip keeps the hint and its colour.
 */
const HINT_CALLOUT: Record<string, string> = {
  indigo: "NOTE",
  green: "TIP",
  purple: "IMPORTANT",
  yellow: "WARNING",
  red: "CAUTION",
};

let turndownService: TurndownService | undefined;

const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * Backslash-escape text so CommonMark + GFM (markdown-parser.ts) reads it back as the same
 * literal text. Lighter than turndown's default: `_` inside a word (snake_case) cannot start
 * emphasis and is left alone, and `~` (GFM strikethrough) and tag-like `<` are escaped too.
 * Turndown already skips text inside code spans and code blocks.
 */
function escapeMarkdownText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/[*`[\]~]/g, "\\$&")
    .replace(/_/g, (m, off: number, s: string) =>
      WORD_CHAR.test(s[off - 1] ?? "") && WORD_CHAR.test(s[off + 1] ?? "") ? m : "\\_")
    .replace(/<(?=[A-Za-z/!?])/g, "\\<")
    .replace(/&(?=#?\w+;)/g, "\\&")
    .replace(/^(\s*)([-+>]|#{1,6}(?=\s|$)|=+(?=\s*$))/, "$1\\$2")
    .replace(/^(\s*\d+)([.)])(?=\s|$)/, "$1\\$2");
}

function childElements(node: Element): Element[] {
  return Array.from(node.children);
}

/** The first <tr> of a table, looking through thead/tbody/tfoot. */
function firstTableRow(table: Element): Element | undefined {
  for (const child of childElements(table)) {
    if (child.nodeName === "TR") return child;
    if (/^T(HEAD|BODY|FOOT)$/.test(child.nodeName)) {
      const tr = childElements(child).find((c) => c.nodeName === "TR");
      if (tr) return tr;
    }
  }
  return undefined;
}

function tableOf(row: Element): Element | null {
  const parent = row.parentElement;
  if (!parent) return null;
  return parent.nodeName === "TABLE" ? parent : parent.parentElement;
}

function cellSpan(cell: Element): number {
  return Math.max(1, Number(cell.getAttribute("colspan")) || 1);
}

/** One-line inline markdown of an element's children (captions, summaries, headings). */
function inlineMarkdown(service: TurndownService, el: Element | null | undefined): string {
  if (!el) return "";
  return service.turndown(el.innerHTML).replace(/\s*\n+\s*/g, " ").trim();
}

function createTurndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    fence: "```",
    emDelimiter: "*",
    strongDelimiter: "**",
    // A CommonMark hard break ("\" + newline). A bare newline is a soft break, which the
    // parser joins into the same line, so read → write would merge the lines.
    br: "\\",
  });
  service.escape = escapeMarkdownText;
  service.remove(["script", "style"]);

  // Lists: tight items; nested content is indented by the marker width ("- " = 2,
  // "1. " = 3), which is what CommonMark requires for it to stay inside the item.
  service.addRule("listItem", {
    filter: "li",
    replacement(content, node) {
      const parent = node.parentNode as Element | null;
      let prefix = "- ";
      if (parent?.nodeName === "OL") {
        const start = Number(parent.getAttribute("start")) || 1;
        prefix = `${start + childElements(parent).indexOf(node)}. `;
      }
      const pad = " ".repeat(prefix.length);
      const body = content.replace(/^\n+/, "").replace(/\n+$/, "").replace(/\n+/g, "\n").replace(/\n/g, `\n${pad}`);
      return prefix + body + (node.nextSibling ? "\n" : "");
    },
  });

  service.addRule("checkbox", {
    filter: (node) => node.nodeName === "INPUT" && node.getAttribute("type") === "checkbox",
    replacement: (_content, node) => (node.hasAttribute("checked") ? "[x]" : "[ ]"),
  });

  service.addRule("strikethrough", {
    filter: (node) => ["DEL", "S", "STRIKE"].includes(node.nodeName),
    replacement: (content) => (content.trim() ? `~~${content}~~` : content),
  });
  service.addRule("underline", {
    filter: ["u"],
    replacement: (content) => (content.trim() ? `<u>${content}</u>` : content),
  });
  service.addRule("highlight", {
    filter: ["mark"],
    replacement: (content) => (content.trim() ? `==${content}==` : content),
  });

  // GFM tables. A table without a header row uses its first row as the header.
  service.addRule("tableCell", {
    filter: ["th", "td"],
    replacement(content, node) {
      const text = content.trim().replace(/\s*\n+\s*/g, " ").replace(/\|/g, "\\|");
      return ` ${text} |` + "  |".repeat(cellSpan(node) - 1);
    },
  });
  service.addRule("tableRow", {
    filter: "tr",
    replacement(content, node) {
      let row = `\n|${content}`;
      const table = tableOf(node);
      if (table && firstTableRow(table) === node) {
        const count = childElements(node)
          .filter((c) => c.nodeName === "TD" || c.nodeName === "TH")
          .reduce((n, c) => n + cellSpan(c), 0);
        row += `\n|${" --- |".repeat(Math.max(1, count))}`;
      }
      return row;
    },
  });
  service.addRule("tableSection", {
    filter: ["thead", "tbody", "tfoot"],
    replacement: (content) => content,
  });
  service.addRule("tableCaption", {
    filter: ["caption"],
    replacement: () => "",
  });
  service.addRule("table", {
    filter: "table",
    replacement(content, node) {
      const caption = inlineMarkdown(service, childElements(node).find((c) => c.nodeName === "CAPTION"));
      return `\n\n${content.replace(/^\n+/, "")}${caption ? `\n\n*${caption}*` : ""}\n\n`;
    },
  });

  // Hints → GitHub callouts (read back by markdown-parser.ts as hints of the same colour).
  service.addRule("hint", {
    filter: (node) => node.nodeName === "ASIDE" && node.classList.contains("hint"),
    replacement(content, node) {
      const type = HINT_CALLOUT[node.getAttribute("data-color") || ""] || "NOTE";
      const lines = content.trim().replace(/\n{3,}/g, "\n\n").split("\n");
      return `\n\n> [!${type}]\n${lines.map((l) => (l ? `> ${l}` : ">")).join("\n")}\n\n`;
    },
  });

  // Toggles → <details> (markdown-parser.ts reads them back as toggles); collapsible
  // headings → the heading followed by its body.
  service.addRule("summary", {
    filter: ["summary"],
    replacement: () => "",
  });
  service.addRule("details", {
    filter: ["details"],
    replacement(content, node) {
      const summary = childElements(node).find((c) => c.nodeName === "SUMMARY");
      const heading = summary && childElements(summary).find((c) => /^H[1-6]$/.test(c.nodeName));
      const body = content.trim();
      if (heading) {
        const hashes = "#".repeat(Number(heading.nodeName[1]));
        return `\n\n${hashes} ${inlineMarkdown(service, heading)}${body ? `\n\n${body}` : ""}\n\n`;
      }
      const title = inlineMarkdown(service, summary) || "Details";
      const open = node.hasAttribute("open") ? " open" : "";
      return `\n\n<details${open}>\n<summary>${title}</summary>\n\n${body}\n\n</details>\n\n`;
    },
  });

  // Images with captions → ![caption](src) (markdown-parser.ts uses the alt text as caption).
  service.addRule("imageFigure", {
    filter: (node) => node.nodeName === "FIGURE" && node.querySelector("img") !== null,
    replacement(_content, node) {
      const img = node.querySelector("img")!;
      const caption = inlineMarkdown(service, node.querySelector("figcaption"));
      const alt = caption || img.getAttribute("alt") || "";
      return `\n\n![${alt}](${img.getAttribute("src") || ""})\n\n`;
    },
  });
  service.addRule("figcaption", {
    filter: ["figcaption"],
    replacement: (content) => (content.trim() ? `\n\n*${content.trim()}*\n\n` : ""),
  });
  service.addRule("iframe", {
    filter: ["iframe"],
    replacement: (_content, node) => {
      const src = node.getAttribute("src");
      return src ? `\n\n[Embedded frame](${src})\n\n` : "";
    },
  });

  return service;
}

/** Convert decoded page HTML to markdown for token-efficient document reading. */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  turndownService ??= createTurndown();
  return turndownService
    .turndown(html)
    .replace(/\u00a0/g, " ") // non-breaking spaces
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

