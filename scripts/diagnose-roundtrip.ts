/**
 * End-to-end test: Verify the V1 encoding fix works via writeContentViaWebSocket.
 */
import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import type { ContentBlock } from "../src/content-schema.js";

const host = "inkabeam.nimbusweb.me";
const stored = loadEncryptedCookie();
const cookie = stored?.cookie || "";
const wsId = "45h7lom5ryjak34u";
const client = new FusebaseClient({ host, cookie });

const ts = new Date().toISOString();
const marker = `V1FIX_${ts}`;

console.log("═══ E2E Test: V1 Encoding Fix ═══\n");

// 1. Create page
console.log("1. Creating page...");
const page = await client.createPage(wsId, `V1 Fix Test ${ts}`);
console.log(`   Page: ${page.globalId} "${page.title}"`);

// 2. Wait for registration
await new Promise(r => setTimeout(r, 2000));

// 3. Write content via the fixed writer
console.log("\n2. Writing content via writeContentViaWebSocket (V1)...");
const blocks: ContentBlock[] = [
  { type: "heading", level: 1, children: [{ text: "V1 Fix Verification" }] },
  { type: "paragraph", children: [{ text: marker }] },
  { type: "divider" },
  { type: "paragraph", children: [
    { text: "Bold text", bold: true },
    { text: " normal " },
    { text: "italic text", italic: true },
  ]},
  { type: "list", style: "bullet", items: [
    { children: [{ text: "Item 1" }] },
    { children: [{ text: "Item 2" }] },
    { children: [{ text: "Item 3" }] },
  ]},
  { type: "code", language: "typescript", code: "const x = 42;" },
  { type: "blockquote", children: [{ text: "A wise quote" }] },
];

const result = await writeContentViaWebSocket(host, wsId, page.globalId, cookie, blocks, {
  replace: true,
  timeout: 30000,
});
console.log(`   Result: ${JSON.stringify(result)}`);

if (!result.success) {
  console.log("\n   ❌ WRITE FAILED");
  process.exit(1);
}

// 4. Wait for persistence
console.log("\n3. Waiting 5s for persistence...");
await new Promise(r => setTimeout(r, 5000));

// 5. Read back via /dump endpoint
console.log("4. Reading HTML dump...");
try {
  const html = await client.getPageContent(wsId, page.globalId);
  const hStr = String(html);
  console.log(`   Length: ${hStr.length} chars`);
  
  if (hStr.length > 50) {
    console.log("\n   ✅✅✅ CONTENT PERSISTED SUCCESSFULLY! ✅✅✅");
    // Check for key content markers
    const hasBlocks = hStr.includes("paragraph") || hStr.includes("hLarge") || hStr.includes("listItemBullet");
    const hasChars = hStr.length > 100;
    console.log(`   Has block types: ${hasBlocks}`);
    console.log(`   Has content: ${hasChars}`);
    console.log(`\n   First 500 chars: "${hStr.substring(0, 500)}"`);
  } else {
    console.log(`   Content: "${hStr}"`);
    console.log("\n   ❌ Content too short — may not be persisted");
  }
} catch (e) {
  console.log(`   ❌ ${(e as Error).message}`);
}

console.log(`\n   Page URL: https://${host}/note/${page.globalId}`);
console.log("\n═══ DONE ═══");
