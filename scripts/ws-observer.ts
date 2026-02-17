/**
 * Step 1: Create a page and set up a WebSocket observer.
 * 
 * First, create a page. Then connect via WS and just LISTEN.
 * The user types something in the browser. We capture the updates
 * that flow through and analyze them.
 * 
 * We'll also try our own write after observing what worked.
 */
import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { WebSocket } from "ws";

const host = "inkabeam.nimbusweb.me";
const stored = loadEncryptedCookie();
const cookie = stored?.cookie || "";
const wsId = "45h7lom5ryjak34u";
const client = new FusebaseClient({ host, cookie });

// Accept pageId as CLI arg, or create one fresh
const existingPageId = process.argv[2];

function randomAlphaNum(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

console.log("═══ Step 1: WebSocket Observer ═══\n");

let pageId: string;
if (existingPageId) {
  pageId = existingPageId;
  console.log(`Using existing page: ${pageId}`);
} else {
  const page = await client.createPage(wsId, `WS_Test_${Date.now()}`);
  pageId = page.globalId;
  console.log(`Created page: ${pageId} "${page.title}"`);
  await new Promise(r => setTimeout(r, 2000));
}

console.log(`\n📝 Open in browser: https://${host}/note/${pageId}`);
console.log("   Type some content, then press Ctrl+C to stop.\n");

// Get JWT
const tokenResp = await fetch(
  `https://${host}/v4/api/workspaces/${wsId}/texts/${pageId}/tokens`,
  { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ tokens: [] }) }
);
const { token: jwt } = await tokenResp.json() as { token: string };
console.log("JWT obtained");

// Build sync step 1
const ydoc = new Y.Doc();
const sv = Y.encodeStateVector(ydoc);
const svEncoder = encoding.createEncoder();
encoding.writeVarUint(svEncoder, 0);
encoding.writeVarUint8Array(svEncoder, sv);
const step1Payload = encoding.toUint8Array(svEncoder);
const step1Msg = new Uint8Array(1 + step1Payload.length);
step1Msg[0] = 0;
step1Msg.set(step1Payload, 1);
const syncStep1B64 = Buffer.from(step1Msg).toString("base64");

// Connect WITHOUT encv2
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const wsUrl = [
  `wss://text.nimbusweb.me/socket.io.editor/${wsId}/${pageId}`,
  `?token=${jwt}`,
  `&cid=${ydoc.clientID}`,
  `&app=web&reason=editor&web-editor=1.1.10`,
  `&frame_id=${randomAlphaNum(7)}`,
  `&ratempt=0&widx=0`,
  `&timezone=${encodeURIComponent(tz)}`,
  `&syncStep1=${encodeURIComponent(syncStep1B64)}`,
].join("");

console.log("Connecting...");
const ws = new WebSocket(wsUrl, { headers: { origin: `https://${host}`, Cookie: cookie } });

let syncComplete = false;
let msgCount = 0;

ws.on("open", () => console.log("Connected\n"));

ws.on("message", (raw: Buffer, isBinary: boolean) => {
  if (!isBinary) {
    console.log(`  TEXT: "${raw.toString().substring(0, 120)}"`);
    return;
  }
  const data = new Uint8Array(raw);
  if (data.length === 0) return;
  
  msgCount++;
  const msgType = data[0];
  const hex = Buffer.from(data.slice(0, Math.min(data.length, 100))).toString("hex");
  
  if (msgType === 17) {
    ws.send(Buffer.from([18]));
    // Don't log pings after initial
    if (syncComplete) return;
    console.log(`  [${msgCount}] PING → PONG`);
    return;
  }
  if (msgType === 18) { return; } // pong
  
  if (msgType === 1) {
    // Awareness
    console.log(`  [${msgCount}] AWARENESS [${data.length}b]`);
    try {
      const decoder = decoding.createDecoder(data.subarray(1));
      const count = decoding.readVarUint(decoder);
      for (let i = 0; i < count; i++) {
        const clientId = decoding.readVarUint(decoder);
        const clock = decoding.readVarUint(decoder);
        const stateJson = decoding.readVarString(decoder);
        console.log(`    client=${clientId} clock=${clock} state=${stateJson.substring(0, 200)}`);
      }
    } catch (e) {
      console.log(`    (parse error: ${(e as Error).message})`);
    }
    return;
  }
  
  if (msgType !== 0) {
    console.log(`  [${msgCount}] UNKNOWN type=0x${msgType.toString(16)} [${data.length}b]`);
    console.log(`    hex: ${hex}`);
    return;
  }
  
  // Sync message (type 0)
  const decoder = decoding.createDecoder(data.subarray(1));
  const subType = decoding.readVarUint(decoder);
  
  if (subType === 0) {
    // Step 1
    const svData = decoding.readVarUint8Array(decoder);
    console.log(`  [${msgCount}] SYNC Step 1: server wants state [sv=${svData.length}b]`);
    
    // Send our state
    const update = Y.encodeStateAsUpdate(ydoc, svData);
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, 1);
    encoding.writeVarUint8Array(enc, update);
    const step2 = encoding.toUint8Array(enc);
    const msg = new Uint8Array(1 + step2.length);
    msg[0] = 0;
    msg.set(step2, 1);
    ws.send(Buffer.from(msg));
    console.log(`    → Sent step 2 [${msg.length}b]`);
  } else if (subType === 1) {
    // Step 2
    const updateData = decoding.readVarUint8Array(decoder);
    console.log(`  [${msgCount}] SYNC Step 2: server doc [${updateData.length}b]`);
    
    try {
      Y.applyUpdate(ydoc, updateData);
      console.log("    Applied V1 ✅");
    } catch {
      try {
        (Y as any).applyUpdateV2(ydoc, updateData);
        console.log("    Applied V2 ✅");
      } catch (e) {
        console.log(`    Failed: ${(e as Error).message}`);
      }
    }
    
    const root = ydoc.getMap("root");
    const children = root.get("children") as Y.Array<unknown> | undefined;
    const blocks = root.get("blocks") as Y.Map<unknown> | undefined;
    console.log(`    keys=[${[...root.keys()]}] children=${children?.length ?? 0} blocks=${blocks ? [...blocks.keys()].length : 0}`);
    
    syncComplete = true;
    console.log("\n✅ Sync complete. Listening for updates...\n");
    console.log(`📝 Now type content at: https://${host}/note/${pageId}\n`);
  } else if (subType === 2) {
    // Update from another client (browser!)
    const updateData = decoding.readVarUint8Array(decoder);
    console.log(`  [${msgCount}] 📨 UPDATE from remote [${updateData.length}b]`);
    console.log(`    hex(first 60): ${Buffer.from(updateData.slice(0, 60)).toString("hex")}`);
    
    try {
      Y.applyUpdate(ydoc, updateData);
      console.log("    Applied V1 ✅");
    } catch {
      try {
        (Y as any).applyUpdateV2(ydoc, updateData);
        console.log("    Applied V2 ✅");
      } catch (e) {
        console.log(`    Failed: ${(e as Error).message}`);
      }
    }
    
    // Dump current doc state
    const root = ydoc.getMap("root");
    const children = root.get("children") as Y.Array<unknown> | undefined;
    const blocks = root.get("blocks") as Y.Map<unknown> | undefined;
    console.log(`    keys=[${[...root.keys()]}] children=${children?.length ?? 0} blocks=${blocks ? [...blocks.keys()].length : 0}`);
    
    if (blocks && blocks.size > 0) {
      for (const [bid, bval] of blocks.entries()) {
        const b = bval as Y.Map<unknown>;
        const type = b.get("type");
        const chars = b.get("characters") as Y.Array<unknown> | undefined;
        let text = "";
        if (chars) {
          for (let i = 0; i < Math.min(chars.length, 50); i++) {
            const c = chars.get(i);
            if (typeof c === "string") text += c;
            else if (Array.isArray(c) && typeof c[0] === "string") text += c[0];
          }
        }
        console.log(`    block "${bid}": type=${type} text="${text}"`);
      }
    }
  }
});

ws.on("error", (e: Error) => console.log(`ERROR: ${e.message}`));
ws.on("close", () => {
  console.log("\nWS closed");
  process.exit(0);
});

// Keep alive for 5 minutes
setTimeout(() => {
  console.log("\n⏰ Timeout (5m). Closing.");
  ws.close();
}, 300000);
