/**
 * FINAL verification: Fixed block format + correct dump endpoint.
 */
import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import { loadEncryptedCookie } from "../src/crypto.js";

const WS_ID = "45h7lom5ryjak34u";
const HOST = "inkabeam.nimbusweb.me";

async function main() {
  console.log("═══ Content Render Verification (FIXED) ═══\n");

  const stored = loadEncryptedCookie();
  if (!stored) throw new Error("No cookie found");
  const cookie = stored.cookie;

  // 1. Create a fresh page
  console.log("1. Creating page...");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let noteId = "";
  for (let i = 0; i < 16; i++) noteId += chars.charAt(Math.floor(Math.random() * chars.length));

  const createResp = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WS_ID, noteId,
      note: { textVersion: 2, title: "RenderTest_" + Date.now(), parentId: "default", is_portal_share: false },
    }),
  });
  const createData = await createResp.json() as any;
  const pageId = createData.globalId || noteId;
  console.log(`   Page ID: ${pageId}`);

  // 2. Write content with CORRECT ContentBlock format
  console.log("\n2. Writing content via V1 WebSocket (correct format)...");
  const blocks: any[] = [
    { type: "paragraph", children: [{ text: "Hello world this is a test" }] },
    { type: "heading", level: 1, children: [{ text: "Big Header" }] },
    { type: "paragraph", children: [{ text: "Some body text with " }, { text: "bold", bold: true }, { text: " and " }, { text: "italic", italic: true }] },
    { type: "divider" },
    { type: "paragraph", children: [{ text: "Final paragraph" }] },
  ];
  const result = await writeContentViaWebSocket(HOST, WS_ID, pageId, cookie, blocks);
  console.log(`   Result: ${JSON.stringify(result)}`);

  // 3. Wait for persistence
  console.log("\n3. Waiting 8s for persistence...");
  await new Promise(r => setTimeout(r, 8000));

  // 4. Check via CORRECT dump endpoint (on main host, not text.nimbusweb.me)
  console.log("\n4. Checking via /dump endpoint on MAIN HOST...");
  const dumpResp = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, {
    headers: { cookie },
  });
  const dumpText = await dumpResp.text();
  console.log(`   Status: ${dumpResp.status}`);
  console.log(`   Content-Type: ${dumpResp.headers.get('content-type')}`);
  console.log(`   Length: ${dumpText.length} chars`);
  console.log(`   Contains "Hello": ${dumpText.includes("Hello")}`);
  console.log(`   Contains "<p>": ${dumpText.includes("<p>")}`);
  console.log(`   Contains "Big Header": ${dumpText.includes("Big Header")}`);
  console.log(`   Full dump:`);
  console.log(dumpText.substring(0, 2000));

  // 5. Also check for a known browser-created page for comparison
  console.log("\n═══ COMPARISON: Browser page 1tZiv20EWydrHyaB ═══");
  const dumpResp2 = await fetch(`https://${HOST}/dump/${WS_ID}/1tZiv20EWydrHyaB`, {
    headers: { cookie },
  });
  const dumpText2 = await dumpResp2.text();
  console.log(`   Status: ${dumpResp2.status}`);
  console.log(`   Length: ${dumpText2.length} chars`);
  console.log(`   Content-Type: ${dumpResp2.headers.get('content-type')}`);
  console.log(`   Full dump:`);
  console.log(dumpText2.substring(0, 2000));

  console.log("\n═══ DONE ═══");
}

main().catch(e => { console.error(e); process.exit(1); });
