/**
 * Final verification: Write content with correct ContentBlock schema, 
 * then read it back via API to confirm persistence.
 */
import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import type { ContentBlock } from "../src/content-schema.js";

const host = "inkabeam.nimbusweb.me";
const stored = loadEncryptedCookie();
const cookie = stored?.cookie || "";
const wsId = "45h7lom5ryjak34u";
const pageId = "FLkcqYXSj0gZ6KMQ";

console.log(`Host: ${host}`);
console.log(`Cookie: ${cookie.length} chars`);

// Correct ContentBlock schema using `children` not `text`
const timestamp = new Date().toISOString();
const blocks: ContentBlock[] = [
  { type: "heading", level: 1, children: [{ text: "Y.js Write Test" }] },
  { type: "paragraph", children: [{ text: `Written at: ${timestamp}` }] },
  { type: "paragraph", children: [
    { text: "This text is " },
    { text: "bold", bold: true },
    { text: " and " },
    { text: "italic", italic: true },
    { text: "." }
  ]},
  { type: "divider" },
  { type: "paragraph", children: [{ text: "If you can read this, the Y.js WebSocket writer is working!" }] },
];

console.log(`\n--- PHASE 1: WRITING ${blocks.length} blocks ---`);
const t0 = Date.now();
const result = await writeContentViaWebSocket(host, wsId, pageId, cookie, blocks, {
  replace: true,
  timeout: 15000,
});
console.log(`Completed in ${Date.now() - t0}ms`);
console.log(`Result: ${JSON.stringify(result)}`);

if (!result.success) {
  console.log("\n❌ Write FAILED. Aborting.");
  process.exit(1);
}

// Phase 2: Read back via API to confirm persistence
console.log(`\n--- PHASE 2: READING PAGE CONTENT ---`);
await new Promise(resolve => setTimeout(resolve, 2000)); // Give server time to persist

const readUrl = `https://${host}/v4/api/note/${pageId}?workspaceId=${wsId}`;
const resp = await fetch(readUrl, {
  headers: { Cookie: cookie, "Content-Type": "application/json" }
});
console.log(`Read API status: ${resp.status}`);
if (resp.ok) {
  const data = await resp.json() as any;
  const title = data.title || data.name || "(no title)";
  const contentLen = JSON.stringify(data.content || data.body || "").length;
  console.log(`Page title: ${title}`);
  console.log(`Content length: ${contentLen} chars`);
  console.log(`\n✅ Write appears successful! Check: https://${host}/note/${pageId}`);
} else {
  console.log(`Read failed: ${resp.status} ${resp.statusText}`);
}
