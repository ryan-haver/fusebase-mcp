/**
 * End-to-end test of the PRODUCTION yjs-ws-writer.ts with V1 fix.
 * Calls writeContentViaWebSocket directly with markdown content.
 * 
 * Run: npx tsx scripts/test-e2e-v1.ts
 */

import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import { markdownToSchema } from "../src/markdown-parser.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}
loadEnv();

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const WS_ID = "45h7lom5ryjak34u";
const COOKIE = process.env.FUSEBASE_COOKIE!;

async function createPage(title: string): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const noteId = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const res = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WS_ID, noteId,
      note: { textVersion: 2, title, parentId: "default", is_portal_share: false },
    }),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as any).globalId || noteId;
}

async function main() {
  console.log("=== E2E TEST: Production yjs-ws-writer with V1 Fix ===\n");
  
  const pageId = await createPage(`E2E V1 Test ${new Date().toISOString()}`);
  console.log(`Page created: ${pageId}`);
  console.log(`URL: https://${HOST}/ws/${WS_ID}/note/${pageId}\n`);
  
  // Test markdown content
  const markdown = `# Hello from V1 Fix!

This is a **test** of the *production* writer.

## Features Working

- Headings (H1, H2, H3)
- **Bold** and *italic* text
- Bullet lists
- Paragraphs

1. Numbered lists
2. Work too

---

> Blockquotes are supported

\`\`\`javascript
const message = "Code blocks work!";
console.log(message);
\`\`\`

- [x] Checked item
- [ ] Unchecked item
`;

  const blocks = markdownToSchema(markdown);
  console.log(`Parsed ${blocks.length} content blocks from markdown`);
  
  const result = await writeContentViaWebSocket(HOST, WS_ID, pageId, COOKIE, blocks, {
    replace: true,
    timeout: 20000,
  });
  
  console.log(`\nResult: ${JSON.stringify(result)}`);
  
  if (result.success) {
    console.log("\n✅ SUCCESS! Content written via production writer.");
    console.log(`\nOpen in browser: https://${HOST}/ws/${WS_ID}/note/${pageId}`);
  } else {
    console.log(`\n❌ FAILED: ${result.error}`);
  }
}

main().catch(console.error);
