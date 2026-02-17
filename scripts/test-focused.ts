/**
 * Focused test on Strategy 1 with extra debugging.
 * Strategy 1 was the only one that completed the full handshake.
 * 
 * This test adds:
 * - Listen for server-echoed updates  
 * - Longer wait before close
 * - Multiple dump checks at different intervals
 * - Check if server sends our update back to us (echo confirmation)
 * 
 * Run: npx tsx scripts/test-focused.ts > data/focused-output.txt 2>&1
 */

import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import { WebSocket } from "ws";
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
      note: { textVersion: 2, title: `Focused Test ${Date.now()}`, parentId: "default", is_portal_share: false },
    }),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as any).globalId || noteId;
}

async function checkDump(pageId: string, label: string): Promise<void> {
  const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
  const binary = new Uint8Array(await res.arrayBuffer());
  const hex = Buffer.from(binary).toString("hex");
  const text = Buffer.from(binary).toString("utf-8", 0, Math.min(500, binary.length));
  
  console.log(`\n[${label}] Dump: ${binary.length}b`);
  console.log(`  Hex: ${hex.slice(0, 100)}`);
  console.log(`  Has 'Hello': ${text.includes("Hello")}`);
  console.log(`  Has 'blocks': ${text.includes("blocks")}`);
  
  // Try decoding as Y.Doc
  const testDoc = new Y.Doc();
  try {
    Y.applyUpdateV2(testDoc, binary);
    const root = testDoc.getMap("root");
    console.log(`  V2 decode: root keys = [${Array.from(root.keys())}]`);
    const ch = root.get("children") as Y.Array<string> | undefined;
    console.log(`  children count: ${ch?.length ?? 0}`);
  } catch {
    try {
      Y.applyUpdate(testDoc, binary);
      const root = testDoc.getMap("root");
      console.log(`  V1 decode: root keys = [${Array.from(root.keys())}]`);
    } catch (e) {
      console.log(`  Decode failed: ${(e as Error).message}`);
    }
  }
}

async function main() {
  console.log("=== FOCUSED STRATEGY 1 TEST ===\n");
  
  const pageId = await createPage();
  console.log(`Page: ${pageId}`);
  console.log(`URL: https://${HOST}/ws/${WS_ID}/note/${pageId}\n`);
  
  // Pre-check dump of empty page
  await checkDump(pageId, "BEFORE");
  
  // Build Y.Doc with initial content
  const ydoc = new Y.Doc();
  ydoc.transact(() => {
    const root = ydoc.getMap("root");
    const children = new Y.Array<string>();
    const rootChildren = new Y.Array<string>();
    const blocksMap = new Y.Map();
    const bId = `b${Date.now()}_init`;
    const bm = new Y.Map();
    bm.set("id", bId); bm.set("type", "paragraph"); bm.set("indent", 0);
    bm.set("color", "transparent"); bm.set("align", "left");
    bm.set("characters", new Y.Array());
    blocksMap.set(bId, bm);
    children.push([bId]); rootChildren.push([bId]);
    root.set("children", children);
    root.set("rootChildren", rootChildren);
    root.set("blocks", blocksMap);
  });
  
  console.log(`Doc clientID: ${ydoc.clientID}`);
  
  // SyncStep1 for URL (WITH outer type byte, like Strategy 1)
  const sv = Y.encodeStateVector(ydoc);
  const svBuf: number[] = [0x00, 0x00];
  writeVarUint(svBuf, sv.length);
  const ss1 = new Uint8Array(svBuf.length + sv.length);
  ss1.set(svBuf); ss1.set(sv, svBuf.length);
  const ss1B64 = Buffer.from(ss1).toString("base64");
  
  // Get JWT  
  const jwt = await getJWT(pageId);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const wsUrl = [
    `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}`,
    `?token=${jwt}&cid=${ydoc.clientID}`,
    `&app=web&reason=editor&web-editor=1.1.10`,
    `&frame_id=${randomAlpha(7)}&ratempt=0&widx=0`,
    `&encv2=true`,
    `&timezone=${encodeURIComponent(tz)}`,
    `&syncStep1=${encodeURIComponent(ss1B64)}`,
  ].join("");
  
  console.log(`\nSyncStep1 URL: ${ss1B64}`);
  console.log("Connecting...\n");
  
  return new Promise<void>((resolveMain) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${HOST}`, cookie: COOKIE },
    });
    
    let msgsRecv = 0;
    let msgsSent = 0;
    let closed = false;
    
    ws.on("error", (e) => { console.log(`ERROR: ${e.message}`); });
    ws.on("close", (code, reason) => {
      closed = true;
      console.log(`\nWS CLOSED: code=${code} reason="${reason.toString()}"`);
    });
    (ws as any).on("unexpected-response", (_: any, res: any) => {
      console.log(`WS UPGRADE FAILED: ${res.statusCode}`);
      resolveMain();
    });
    
    ws.on("open", () => {
      console.log("Connected!");
      
      // Send awareness
      const aw = encodeAwareness(ydoc.clientID, 0, "{}");
      ws.send(Buffer.from(aw));
      msgsSent++;
      console.log(`SENT[${msgsSent}]: AWARENESS [${aw.length}b]`);
    });
    
    let updateSent = false;
    let serverStep2Applied = false;
    
    ws.on("message", (raw: Buffer, isBinary: boolean) => {
      if (!isBinary) { console.log(`RECV: text "${raw.toString().slice(0, 100)}"`); return; }
      const data = new Uint8Array(raw);
      if (data.length === 0) return;
      
      msgsRecv++;
      const msgType = data[0];
      
      if (msgType === 0x11) {
        console.log(`RECV[${msgsRecv}]: PING`);
        ws.send(Buffer.from([0x12]));
        msgsSent++;
        console.log(`SENT[${msgsSent}]: PONG`);
        return;
      }
      if (msgType === 0x12) { console.log(`RECV[${msgsRecv}]: PONG`); return; }
      if (msgType === 0x01) {
        console.log(`RECV[${msgsRecv}]: AWARENESS [${data.length}b]`);
        return;
      }
      
      if (msgType !== 0x00) {
        console.log(`RECV[${msgsRecv}]: UNKNOWN type=0x${msgType.toString(16)} [${data.length}b]`);
        return;
      }
      
      const [subType, subOff] = readVarUint(data, 1);
      
      if (subType === 0) {
        const [svLen, svStart] = readVarUint(data, subOff);
        const serverSv = data.slice(svStart, svStart + svLen);
        console.log(`RECV[${msgsRecv}]: SyncStep1 [${data.length}b] svLen=${svLen}`);
        console.log(`  ServerSv: [${Array.from(serverSv).join(",")}]`);
        
        // Respond with SyncStep2 (V1 encoded — matching browser behavior)
        const update = Y.encodeStateAsUpdate(ydoc, serverSv);
        const step2 = encodeSyncMsg(0x01, update);
        ws.send(Buffer.from(step2));
        msgsSent++;
        console.log(`SENT[${msgsSent}]: SyncStep2 [${step2.length}b] update=${update.length}b`);
        console.log(`  First bytes: [${Array.from(step2.slice(0, 20)).join(",")}]`);
      }
      
      else if (subType === 1) {
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);
        console.log(`RECV[${msgsRecv}]: SyncStep2 [${data.length}b] update=${uLen}b`);
        console.log(`  First bytes: [${Array.from(data.slice(0, 20)).join(",")}]`);
        
        // Try V2 first (since encv2=true)
        let applied = false;
        try { Y.applyUpdateV2(ydoc, updateData); applied = true; console.log(`  Applied V2 OK`); } catch {}
        if (!applied) {
          try { Y.applyUpdate(ydoc, updateData); applied = true; console.log(`  Applied V1 OK`); } catch {}
        }
        if (!applied) { console.log(`  FAILED to apply`); return; }
        
        serverStep2Applied = true;
        
        // NOW write our content
        if (!updateSent) {
          updateSent = true;
          
          const beforeSv = Y.encodeStateVector(ydoc);
          console.log(`\n  Before write - Y.Doc root keys: [${Array.from(ydoc.getMap("root").keys())}]`);
          
          ydoc.transact(() => {
            const root = ydoc.getMap("root");
            const ch = root.get("children") as Y.Array<string>;
            const rch = root.get("rootChildren") as Y.Array<string>;
            const blk = root.get("blocks") as Y.Map<unknown>;
            // Clear existing 
            if (ch && ch.length > 0) ch.delete(0, ch.length);
            if (rch && rch.length > 0) rch.delete(0, rch.length);
            if (blk) for (const k of Array.from(blk.keys())) blk.delete(k);
            
            // Add heading
            const hId = `b${Date.now()}_h`;
            const hm = new Y.Map();
            hm.set("id", hId); hm.set("type", "hLarge"); hm.set("indent", 0);
            hm.set("color", "transparent"); hm.set("align", "left");
            const hChars = new Y.Array();
            for (const c of "Hello World!") hChars.push([c]);
            hm.set("characters", hChars);
            blk.set(hId, hm);
            ch.push([hId]); rch.push([hId]);
            
            // Add paragraph
            const pId = `b${Date.now()}_p`;
            const pm = new Y.Map();
            pm.set("id", pId); pm.set("type", "paragraph"); pm.set("indent", 0);
            pm.set("color", "transparent"); pm.set("align", "left");
            const pChars = new Y.Array();
            for (const c of "Content works!") pChars.push([c]);
            pm.set("characters", pChars);
            blk.set(pId, pm);
            ch.push([pId]); rch.push([pId]);
          });
          
          console.log(`  After write - Y.Doc root keys: [${Array.from(ydoc.getMap("root").keys())}]`);
          console.log(`  Children: ${(ydoc.getMap("root").get("children") as Y.Array<string>).length}`);
          
          // Encode and send as V1 update (matching browser behavior)
          const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
          const updateMsg = encodeSyncMsg(0x02, diff);
          ws.send(Buffer.from(updateMsg));
          msgsSent++;
          console.log(`\nSENT[${msgsSent}]: UPDATE [${updateMsg.length}b] diff=${diff.length}b`);
          console.log(`  First bytes: [${Array.from(updateMsg.slice(0, 30)).join(",")}]`);
          
          // Keep connection open and listen for server responses for 8 seconds
          console.log("\nWaiting 8s for server responses...");
          
          setTimeout(async () => {
            console.log("\n--- VERIFICATION ---");
            console.log(`WebSocket still open: ${!closed}`);
            console.log(`Total messages sent: ${msgsSent}`);
            console.log(`Total messages received: ${msgsRecv}`);
            
            // Check dump multiple times
            await checkDump(pageId, "T+8s");
            
            ws.close();
            await new Promise(r => setTimeout(r, 2000));
            await checkDump(pageId, "T+10s");
            
            resolveMain();
          }, 8000);
        }
      }
      
      else if (subType === 2) {
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);
        console.log(`RECV[${msgsRecv}]: UPDATE [${data.length}b] update=${uLen}b`);
        console.log(`  First bytes: [${Array.from(data.slice(0, 20)).join(",")}]`);
        try { Y.applyUpdateV2(ydoc, updateData); console.log(`  Applied V2 OK`); } catch {
          try { Y.applyUpdate(ydoc, updateData); console.log(`  Applied V1 OK`); } catch {
            console.log(`  FAILED to apply`);
          }
        }
      }
    });
  });
}

main().catch(console.error);
