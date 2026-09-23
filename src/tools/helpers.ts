/**
 * Shared helpers and utilities for MCP tools.
 */

import * as path from "path";
import { fileURLToPath } from "url";

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

/** Simple HTML to Markdown converter for token-efficient document reading */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  let md = html;

  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n\n");
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "#### $1\n\n");
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "##### $1\n\n");
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "###### $1\n\n");

  // Code blocks
  md = md.replace(/<pre[^>]*><code(?: class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/gi, (_, lang, code) => {
    return `\`\`\`${lang || ""}\n${code}\n\`\`\`\n\n`;
  });

  // Inline formats
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");
  md = md.replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, "~~$1~~");
  md = md.replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, "~~$1~~");
  md = md.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, "~~$1~~");
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

  // Links & Images
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, "![$2]($1)");
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, "![]($1)");

  // Lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<\/?ul[^>]*>/gi, "\n");
  md = md.replace(/<\/?ol[^>]*>/gi, "\n");

  // Blockquotes & Dividers
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, "> $1\n\n");
  md = md.replace(/<hr[^>]*\/?>/gi, "---\n\n");

  // Paragraphs & Breaks
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n");
  md = md.replace(/<br[^>]*\/?>/gi, "\n");

  // Strip any remaining tags
  md = md.replace(/<[^>]+>/g, "");

  // Unescape entities
  md = md
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  return md.replace(/\n{3,}/g, "\n\n").trim();
}

