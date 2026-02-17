/**
 * Deep diagnostic: Replicate the EXACT browser WebSocket protocol.
 * 
 * From the CDP capture, the browser:
 *   Frame 1 SENT: [01, 0a, 01, af,a7,d9,a9,09, 00, 02, 7b,7d] = AWARENESS
 *   Frame 2 RECV: [00, 00, 01, 00] = SyncStep1 (empty state vector)
 *   Frame 3 SENT: [00, 01, e6,01, ...234 bytes...] = SyncStep2 (initial doc with paragraph)
 *   Frame 4 RECV: [00, 01, 0d, 00...] = SyncStep2 (server state, 16 bytes, nearly empty)
 *   Frame 5+ SENT: [00, 02, ...] = Updates for each character
 *
 * KEY INSIGHT: The browser creates its initial doc structure (empty paragraph)
 * BEFORE connecting, encodes a syncStep1 from that, puts it in the URL,
 * then in SyncStep2 sends the full initial doc including the paragraph.
 * 
 * Our previous attempt sent SyncStep2 from an EMPTY doc, then later added 
 * content via an update. The server may not process content-adding updates
 * the same way as initial doc sync.
 *
 * Run: npx tsx scripts/test-exact-protocol.ts 2>&1 | tee data/exact-protocol-output.txt
 */

import * as Y from "yjs";
import { WebSocket } from "ws";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
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
    if (!process.env[trimmed.slice(0, eq).trim()]) process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}
loadEnv();

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const WS_ID = process.env.FUSEBASE_WS_ID || "45h7lom5ryjak34u";
const COOKIE = process.env.FUSEBASE_COOKIE || "";

function writeVarUint(buf: number[], num: number): void {
  while (num > 0x7f) { buf.push(0x80 | (num & 0x7f)); num >>>= 7; }
  buf.push(num & 0x7f);
}

function readVarUint(data: Uint8Array, offset: number): [number, number] {
  let result = 0, shift = 0, byte: number;
  do { byte = data[offset++]; result |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
  return [result, offset];
}

function encodeSyncMsg(subType: number, data: Uint8Array): Uint8Array {
  const header: number[] = [0x00, subType];
  writeVarUint(header, data.length);
  const msg = new Uint8Array(header.length + data.length);
  msg.set(header);
  msg.set(data, header.length);
  return msg;
}

function encodeAwareness(clientId: number, clock: number, state: string): Uint8Array {
  const buf: number[] = [0x01];
  writeVarUint(buf, 1);
  writeVarUint(buf, clientId);
  writeVarUint(buf, clock);
  const sb = new TextEncoder().encode(state);
  writeVarUint(buf, sb.length);
  const r = new Uint8Array(buf.length + sb.length);
  r.set(buf);
  r.set(sb, buf.length);
  return r;
}

function randomAlpha(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

let blockCounter = 0;
function genBlockId(): string { return `b${Date.now()}_${blockCounter++}`; }

async function getJWT(pageId: string): Promise<string> {
  const res = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
    method: "POST",
    headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({ tokens: [] }),
  });
  if (!res.ok) throw new Error(`JWT failed: ${res.status}`);
  return ((await res.json()) as any).token;
}

async function createPage(): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const noteId = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const res = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WS_ID, noteId,
      note: { textVersion: 2, title: `ExactProto Test ${Date.now()}`, parentId: "default", is_portal_share: false },
    }),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status}`);
  return ((await res.json()) as any).globalId || noteId;
}

async function main() {
  console.log("=== EXACT BROWSER PROTOCOL REPLICATION ===\n");

  // Step 1: Create page
  const pageId = await createPage();
  console.log(`Page: ${pageId}`);
  console.log(`URL: https://${HOST}/ws/${WS_ID}/note/${pageId}\n`);

  // Step 2: Pre-build Y.Doc WITH initial content (like the browser does)
  const ydoc = new Y.Doc();
  
  // The browser creates an initial paragraph block BEFORE connecting
  const root = ydoc.getMap("root");
  ydoc.transact(() => {
    const children = new Y.Array<string>();
    const rootChildren = new Y.Array<string>();
    const blocksMap = new Y.Map();
    
    // Add initial paragraph block (exactly like browser)
    const blockId = genBlockId();
    const bm = new Y.Map();
    bm.set("id", blockId);
    bm.set("type", "paragraph");
    bm.set("indent", 0);
    bm.set("color", "transparent");
    bm.set("align", "left");
    bm.set("characters", new Y.Array());
    blocksMap.set(blockId, bm);
    children.push([blockId]);
    rootChildren.push([blockId]); 
    
    root.set("children", children);
    root.set("rootChildren", rootChildren);
    root.set("blocks", blocksMap);
  });
  
  console.log(`Doc clientID: ${ydoc.clientID}`);
  const fullState = Y.encodeStateAsUpdateV2(ydoc);
  console.log(`Initial doc V2 state: ${fullState.length} bytes`);
  
  // Step 3: Build SyncStep1 for URL
  const sv = Y.encodeStateVector(ydoc);
  const svBuf: number[] = [0x00, 0x00];
  writeVarUint(svBuf, sv.length);
  const syncStep1Bytes = new Uint8Array(svBuf.length + sv.length);
  syncStep1Bytes.set(svBuf);
  syncStep1Bytes.set(sv, svBuf.length);
  const syncStep1B64 = Buffer.from(syncStep1Bytes).toString("base64");
  console.log(`SyncStep1 (URL): ${syncStep1B64}`);
  
  // Step 4: Get JWT
  const jwt = await getJWT(pageId);
  console.log(`JWT: ...${jwt.slice(-30)}`);
  
  // Step 5: Build URL
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const wsUrl = [
    `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}`,
    `?token=${jwt}`,
    `&cid=${ydoc.clientID}`,
    `&app=web&reason=editor&web-editor=1.1.10`,
    `&frame_id=${randomAlpha(7)}`,
    `&ratempt=0&widx=0`,
    `&encv2=true`,
    `&timezone=${encodeURIComponent(tz)}`,
    `&syncStep1=${encodeURIComponent(syncStep1B64)}`,
  ].join("");
  
  console.log(`\nWS URL params: encv2=true, syncStep1=${syncStep1B64}\n`);
  console.log("--- CONNECTING ---");

  return new Promise<void>((resolveMain) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${HOST}`, cookie: COOKIE },
    });

    let syncStep2Count = 0;
    let updateSent = false;

    ws.on("error", (e) => { console.error(`WS Error: ${e.message}`); resolveMain(); });
    ws.on("close", () => { console.log("WS Closed"); resolveMain(); });
    (ws as any).on("unexpected-response", (_: any, res: any) => {
      console.error(`WS upgrade failed: HTTP ${res.statusCode}`);
      resolveMain();
    });

    ws.on("open", () => {
      console.log("WS Connected!");
      
      // IMMEDIATE awareness (matching browser Frame 1)
      const awarenessBytes = encodeAwareness(ydoc.clientID, 0, "{}");
      ws.send(Buffer.from(awarenessBytes));
      console.log(`SENT: AWARENESS [${awarenessBytes.length}b] first=[${Array.from(awarenessBytes.slice(0, 12)).join(",")}]`);
    });

    ws.on("message", (raw: Buffer, isBinary: boolean) => {
      if (!isBinary) return;
      const data = new Uint8Array(raw);
      if (data.length === 0) return;
      
      const msgType = data[0];
      
      // Ping → Pong
      if (msgType === 0x11) {
        ws.send(Buffer.from(new Uint8Array([0x12])));
        return;
      }
      if (msgType === 0x12) return; // Pong
      if (msgType === 0x01) {
        console.log(`RECV: AWARENESS [${data.length}b]`);
        return;
      }

      if (msgType !== 0x00) {
        console.log(`RECV: UNKNOWN type=${msgType} [${data.length}b]`);
        return;
      }

      const [subType, subOff] = readVarUint(data, 1);
      
      if (subType === 0) {
        // Server SyncStep1 (matching browser Frame 2)
        console.log(`RECV: SyncStep1 [${data.length}b] first=[${Array.from(data.slice(0, 8)).join(",")}]`);
        
        const [svLen, svStart] = readVarUint(data, subOff);
        const serverSv = data.slice(svStart, svStart + svLen);
        console.log(`  Server state vector: ${svLen} bytes`);
        
        // Respond with SyncStep2 containing our FULL doc (including initial paragraph)
        // Use V2 encoding since encv2=true
        const update = Y.encodeStateAsUpdateV2(ydoc, serverSv);
        const step2Msg = encodeSyncMsg(0x01, update);
        ws.send(Buffer.from(step2Msg));
        console.log(`SENT: SyncStep2 [${step2Msg.length}b] (V2 update: ${update.length} bytes)`);
        console.log(`  first=[${Array.from(step2Msg.slice(0, 20)).join(",")}]`);
      }
      
      else if (subType === 1) {
        syncStep2Count++;
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);
        console.log(`RECV: SyncStep2 #${syncStep2Count} [${data.length}b] update: ${updateData.length} bytes`);
        console.log(`  first=[${Array.from(data.slice(0, 20)).join(",")}]`);
        
        // Apply server state (V2)
        try {
          Y.applyUpdateV2(ydoc, updateData);
          console.log(`  Applied (V2) OK`);
        } catch (e1) {
          try {
            Y.applyUpdate(ydoc, updateData);
            console.log(`  Applied (V1 fallback) OK`);
          } catch (e2) {
            console.log(`  FAILED to apply: ${(e1 as Error).message}`);
          }
        }
        
        // After receiving server's SyncStep2, add our ACTUAL content
        if (!updateSent) {
          updateSent = true;
          
          const beforeSv = Y.encodeStateVector(ydoc);
          
          // Now modify the doc — add a heading and paragraph 
          ydoc.transact(() => {
            const root = ydoc.getMap("root");
            const ch = root.get("children") as Y.Array<string>;
            const rch = root.get("rootChildren") as Y.Array<string>;
            const blk = root.get("blocks") as Y.Map<unknown>;
            
            // Clear existing empty paragraph
            if (ch && ch.length > 0) ch.delete(0, ch.length);
            if (rch && rch.length > 0) rch.delete(0, rch.length);
            if (blk) for (const k of Array.from(blk.keys())) blk.delete(k);
            
            // Add heading  
            const hId = genBlockId();
            const hm = new Y.Map();
            hm.set("id", hId);
            hm.set("type", "hLarge");
            hm.set("indent", 0);
            hm.set("color", "transparent");
            hm.set("align", "left");
            const hChars = new Y.Array();
            for (const c of "Hello World!") hChars.push([c]);
            hm.set("characters", hChars);
            blk.set(hId, hm);
            ch.push([hId]);
            rch.push([hId]);
            
            // Add paragraph
            const pId = genBlockId();
            const pm = new Y.Map();
            pm.set("id", pId);
            pm.set("type", "paragraph");
            pm.set("indent", 0);
            pm.set("color", "transparent");
            pm.set("align", "left");
            const pChars = new Y.Array();
            for (const c of "This is a test.") pChars.push([c]);
            pm.set("characters", pChars);
            blk.set(pId, pm);
            ch.push([pId]);
            rch.push([pId]);
          });
          
          // Encode as V2 update diff
          const diff = Y.encodeStateAsUpdateV2(ydoc, beforeSv);
          const updateMsg = encodeSyncMsg(0x02, diff);
          ws.send(Buffer.from(updateMsg));
          console.log(`\nSENT: UPDATE [${updateMsg.length}b] (V2 diff: ${diff.length} bytes)`);
          console.log(`  first=[${Array.from(updateMsg.slice(0, 20)).join(",")}]`);
          
          // Now wait 3s then close and verify
          setTimeout(async () => {
            ws.close();
            console.log("\n--- VERIFYING ---");
            
            await new Promise(r => setTimeout(r, 2000));
            
            const dumpRes = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, {
              headers: { cookie: COOKIE },
            });
            const dumpBinary = new Uint8Array(await dumpRes.arrayBuffer());
            console.log(`Dump: ${dumpBinary.length} bytes`);
            
            // Try applying the dump as V2
            const verifyDoc = new Y.Doc();
            try {
              Y.applyUpdateV2(verifyDoc, dumpBinary);
              const vRoot = verifyDoc.getMap("root");
              console.log(`V2 apply OK — root keys: [${Array.from(vRoot.keys()).join(",")}]`);
              const vChildren = vRoot.get("children") as Y.Array<string> | undefined;
              console.log(`  children: ${vChildren?.length ?? "N/A"}`);
              const vBlocks = vRoot.get("blocks") as Y.Map<unknown> | undefined;
              console.log(`  blocks: ${vBlocks ? Array.from(vBlocks.keys()).join(", ") : "N/A"}`);
            } catch {
              // Try V1
              try {
                Y.applyUpdate(verifyDoc, dumpBinary);
                const vRoot = verifyDoc.getMap("root");
                console.log(`V1 apply OK — root keys: [${Array.from(vRoot.keys()).join(",")}]`);
              } catch (e) {
                console.log(`Both V1/V2 failed: ${(e as Error).message}`);
              }
            }
            
            const dumpText = Buffer.from(dumpBinary).toString("utf-8", 0, Math.min(500, dumpBinary.length));
            console.log(`Contains 'Hello': ${dumpText.includes("Hello")}`);
            console.log(`Contains 'paragraph': ${dumpText.includes("paragraph")}`);
            console.log(`Contains 'blocks': ${dumpText.includes("blocks")}`);
            
            resolveMain();
          }, 3000);
        }
      }
      
      else if (subType === 2) {
        const [uLen, uStart] = readVarUint(data, subOff);
        console.log(`RECV: UPDATE [${data.length}b] update: ${uLen} bytes`);
        const updateData = data.slice(uStart, uStart + uLen);
        try { Y.applyUpdateV2(ydoc, updateData); } catch {
          try { Y.applyUpdate(ydoc, updateData); } catch {}
        }
      }
    });
  });
}

main().catch(console.error);
