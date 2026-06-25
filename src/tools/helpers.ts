/**
 * Shared helpers and utilities for MCP tools.
 */

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
