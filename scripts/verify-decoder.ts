/**
 * End-to-end verification: Y.js HTML decoder
 *
 * 1. Reads known browser-created page via decoded getPageContent
 * 2. Creates new page, writes content via WebSocket, reads back decoded HTML
 * 3. Validates HTML contains expected structure
 */
import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import { decodeYjsToHtml } from "../src/yjs-html-decoder.js";
import { loadEncryptedCookie } from "../src/crypto.js";

const WS_ID = "45h7lom5ryjak34u";
const HOST = "inkabeam.nimbusweb.me";
const BROWSER_PAGE = "1tZiv20EWydrHyaB";

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored) throw new Error("No cookie found");
  const cookie = stored.cookie;

  console.log("═══ Y.js HTML Decoder Verification ═══\n");

  // ── Test 1: Decode known browser-created page ──
  console.log("TEST 1: Decode browser-created page");
  const dumpResp = await fetch(`https://${HOST}/dump/${WS_ID}/${BROWSER_PAGE}`, {
    headers: { cookie },
  });
  if (!dumpResp.ok) {
    console.log(`   ✗ FAILED to fetch dump: ${dumpResp.status}`);
  } else {
    const binary = new Uint8Array(await dumpResp.arrayBuffer());
    console.log(`   Binary size: ${binary.length} bytes`);
    const html = decodeYjsToHtml(binary);
    console.log(`   HTML length: ${html.length} chars`);
    console.log(`   Contains <p>: ${html.includes("<p>")}  ← expect: true`);
    console.log(`   Contains embed: ${html.includes("embed-placeholder")}  ← expect: true (page has dashboard/board)`);
    console.log(`   First 1000 chars:`);
    console.log(html.substring(0, 1000));
    console.log("   ---");
  }

  // ── Test 2: Write content then read back ──
  console.log("\nTEST 2: Round-trip (write → read → decode)");

  // Create page
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let noteId = "";
  for (let i = 0; i < 16; i++) noteId += chars.charAt(Math.floor(Math.random() * chars.length));

  const createResp = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WS_ID, noteId,
      note: { textVersion: 2, title: "DecoderTest_" + Date.now(), parentId: "default", is_portal_share: false },
    }),
  });
  const createData = await createResp.json() as any;
  const pageId = createData.globalId || noteId;
  console.log(`   Created page: ${pageId}`);

  // Write rich content
  const blocks: any[] = [
    { type: "heading", level: 1, children: [{ text: "Welcome to Fusebase" }] },
    { type: "paragraph", children: [{ text: "This is a " }, { text: "bold", bold: true }, { text: " and " }, { text: "italic", italic: true }, { text: " test." }] },
    { type: "divider" },
    { type: "list", style: "bullet", items: [
      { children: [{ text: "First item" }] },
      { children: [{ text: "Second item" }] },
    ]},
    { type: "list", style: "number", items: [
      { children: [{ text: "Step one" }] },
      { children: [{ text: "Step two" }] },
    ]},
    { type: "checklist", items: [
      { checked: true, children: [{ text: "Done task" }] },
      { checked: false, children: [{ text: "Pending task" }] },
    ]},
    { type: "blockquote", children: [{ text: "A wise quote" }] },
    { type: "code", language: "javascript", code: "console.log('hello');" },
    { type: "paragraph", children: [{ text: "Final paragraph." }] },
  ];

  const writeResult = await writeContentViaWebSocket(HOST, WS_ID, pageId, cookie, blocks);
  console.log(`   Write result: ${JSON.stringify(writeResult)}`);
  if (!writeResult.success) { console.log("   ✗ WRITE FAILED — aborting"); return; }

  // Wait for persistence
  console.log("   Waiting 8s for persistence...");
  await new Promise(r => setTimeout(r, 8000));

  // Read back
  const readResp = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, {
    headers: { cookie },
  });
  if (!readResp.ok) {
    console.log(`   ✗ FAILED to read back: ${readResp.status}`);
    return;
  }
  const readBinary = new Uint8Array(await readResp.arrayBuffer());
  const html = decodeYjsToHtml(readBinary);

  console.log(`\n   Decoded HTML (${html.length} chars):`);
  console.log(html);

  // Validate
  console.log("\n   ── Validation ──");
  const checks = [
    ["<h1>", html.includes("<h1>"), "Heading"],
    ["Welcome to Fusebase", html.includes("Welcome to Fusebase"), "Heading text"],
    ["<strong>bold</strong>", html.includes("<strong>bold</strong>"), "Bold formatting"],
    ["<em>italic</em>", html.includes("<em>italic</em>"), "Italic formatting"],
    ["<hr>", html.includes("<hr>"), "Divider"],
    ["<ul>", html.includes("<ul>"), "Bullet list wrapper"],
    ["<ol>", html.includes("<ol>"), "Number list wrapper"],
    ["First item", html.includes("First item"), "Bullet list item"],
    ["Step one", html.includes("Step one"), "Number list item"],
    ["☑", html.includes("☑"), "Checked checkbox"],
    ["☐", html.includes("☐"), "Unchecked checkbox"],
    ["<blockquote>", html.includes("<blockquote>"), "Blockquote"],
    ["<pre><code", html.includes("<pre><code"), "Code block"],
    ["console.log", html.includes("console.log"), "Code content"],
    ["Final paragraph", html.includes("Final paragraph"), "Final paragraph"],
  ] as const;

  let passed = 0;
  let failed = 0;
  for (const [label, result, desc] of checks) {
    if (result) { passed++; console.log(`   ✓ ${desc}`); }
    else { failed++; console.log(`   ✗ ${desc} — expected ${label}`); }
  }

  console.log(`\n   Results: ${passed}/${passed + failed} passed`);
  console.log(failed === 0 ? "\n   ✓ ALL TESTS PASSED" : `\n   ✗ ${failed} TESTS FAILED`);
  console.log("\n═══ DONE ═══");
}

main().catch(e => { console.error(e); process.exit(1); });
