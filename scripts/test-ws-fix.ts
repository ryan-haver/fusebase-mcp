/**
 * Quick test of the fixed Y.js WebSocket writer.
 * Creates a test page, writes content via WebSocket, then reads it back.
 * 
 * Run: npx tsx scripts/test-ws-fix.ts 
 */

import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import type { ContentBlock } from "../src/content-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
function loadEnv() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const WS_ID = process.env.FUSEBASE_WS_ID || "45h7lom5ryjak34u";
const COOKIE = process.env.FUSEBASE_COOKIE || "";

async function main() {
  // Create a fresh test page
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const noteId = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const title = `WS Fix Test - ${new Date().toISOString().slice(11, 19)}`;

  console.log("📄 Creating test page...");
  const createRes = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WS_ID,
      noteId,
      note: { textVersion: 2, title, parentId: "default", is_portal_share: false },
    }),
  });

  if (!createRes.ok) {
    console.error(`❌ Failed to create page: ${createRes.status}`);
    return;
  }
  
  const pageData = await createRes.json() as any;
  const pageId = pageData.globalId || noteId;
  console.log(`   Page: ${pageId}`);
  console.log(`   URL: https://${HOST}/ws/${WS_ID}/note/${pageId}`);

  // Write test content
  const testBlocks: ContentBlock[] = [
    {
      type: "heading",
      level: 1,
      children: [{ text: "Hello from WebSocket!" }],
    },
    {
      type: "paragraph",
      children: [
        { text: "This content was written via the " },
        { text: "fixed Y.js WebSocket writer", bold: true },
        { text: "." },
      ],
    },
    {
      type: "paragraph",
      children: [
        { text: "Written at: " },
        { text: new Date().toISOString() },
      ],
    },
  ];

  console.log("\n✏️ Writing content via WebSocket...");
  const result = await writeContentViaWebSocket(HOST, WS_ID, pageId, COOKIE, testBlocks);
  
  if (result.success) {
    console.log("✅ Write succeeded!");
  } else {
    console.error(`❌ Write failed: ${result.error}`);
    return;
  }

  // Wait a moment then read back via dump endpoint
  console.log("\n📖 Reading back via /dump endpoint...");
  await new Promise(r => setTimeout(r, 2000));
  
  const dumpRes = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, {
    headers: { cookie: COOKIE },
  });
  
  if (!dumpRes.ok) {
    console.error(`❌ Dump failed: ${dumpRes.status}`);
    return;
  }
  
  const dumpBinary = new Uint8Array(await dumpRes.arrayBuffer());
  console.log(`   Dump size: ${dumpBinary.length} bytes`);
  
  // Quick check for our content in the binary
  const dumpText = Buffer.from(dumpBinary).toString("utf-8", 0, Math.min(2000, dumpBinary.length));
  const hasHello = dumpText.includes("Hello");
  const hasFixed = dumpText.includes("fixed");
  const hasBlocks = dumpText.includes("blocks");
  const hasParagraph = dumpText.includes("paragraph");
  
  console.log(`   Contains 'Hello': ${hasHello}`);
  console.log(`   Contains 'fixed': ${hasFixed}`);
  console.log(`   Contains 'blocks': ${hasBlocks}`);
  console.log(`   Contains 'paragraph': ${hasParagraph}`);
  
  if (hasHello && hasFixed) {
    console.log("\n🎉 SUCCESS! Content was written and persisted!");
  } else {
    console.log("\n⚠️ Content may not have persisted. Check the page in browser:");
  }
  
  console.log(`\n🔗 Open in browser: https://${HOST}/ws/${WS_ID}/note/${pageId}`);
}

main().catch(console.error);
