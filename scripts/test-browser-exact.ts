/**
 * Browser-exact test: mimics browser's WebSocket behavior EXACTLY.
 * 
 * Key differences from previous tests:
 * 1. Apply server's SyncStep2 as V1 FIRST (not V2)
 * 2. Wait 3s after sync before writing (browser waits ~4s)
 * 3. Send content as Y.UPDATE, not as part of SyncStep2
 * 4. Keep connection open for 8s after write (browser stays open)
 * 5. Log every byte for debugging
 * 
 * Run: npx tsx scripts/test-browser-exact.ts > data/browser-exact-output.txt 2>&1
 */

import * as Y from "yjs";
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

function encodeAwareness(clientId: number, clock: number): Uint8Array {
  const state = "{}";
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

let blockCounter = 0;
function genBlockId(): string { return `b${Date.now()}_${blockCounter++}`; }

async function getJWT(pageId: string): Promise<string> {
  const res = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
    method: "POST",
    headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({ tokens: [] }),
  });
  if (!res.ok) throw new Error(`JWT: ${res.status}`);
  return ((await res.json()) as any).token;
}

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
  if (!res.ok) throw new Error(`Create: ${res.status} ${await res.text()}`);
  return ((await res.json()) as any).globalId || noteId;
}

async function checkDump(pageId: string, label: string): Promise<void> {
  const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
  const bin = new Uint8Array(await res.arrayBuffer());
  console.log(`[${label}] Dump: ${bin.length}b hex=${Buffer.from(bin).toString("hex").slice(0, 80)}`);
}

async function main() {
  console.log("=== BROWSER-EXACT TEST ===\n");
  
  const pageId = await createPage(`BrowserExact ${new Date().toISOString()}`);
  console.log(`Page: ${pageId}`);
  console.log(`URL: https://${HOST}/ws/${WS_ID}/note/${pageId}\n`);
  
  await checkDump(pageId, "BEFORE");
  
  // 1. Start with COMPLETELY EMPTY Y.Doc (like browser)
  const ydoc = new Y.Doc();
  console.log(`ClientID: ${ydoc.clientID}`);
  
  // 2. Build SyncStep1 URL from empty state
  const sv = Y.encodeStateVector(ydoc);  // Should be [0]
  const svBuf: number[] = [0x00, 0x00];
  writeVarUint(svBuf, sv.length);
  const ss1 = new Uint8Array(svBuf.length + sv.length);
  ss1.set(svBuf); ss1.set(sv, svBuf.length);
  console.log(`SyncStep1 URL: ${Buffer.from(ss1).toString("base64")} bytes=[${Array.from(ss1)}]`);
  
  const jwt = await getJWT(pageId);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const wsUrl = [
    `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}`,
    `?token=${jwt}&cid=${ydoc.clientID}`,
    `&app=web&reason=editor&web-editor=1.1.10`,
    `&frame_id=${Math.random().toString(36).slice(2, 9)}&ratempt=0&widx=0`,
    `&encv2=true`,
    `&timezone=${encodeURIComponent(tz)}`,
    `&syncStep1=${encodeURIComponent(Buffer.from(ss1).toString("base64"))}`,
  ].join("");
  
  console.log("Connecting...\n");
  
  await new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${HOST}`, cookie: COOKIE },
    });
    
    let awarenessClk = 0;
    let done = false;
    const finish = () => { if (!done) { done = true; try { ws.close(); } catch {} resolve(); } };
    setTimeout(() => { console.log("\nTIMEOUT"); finish(); }, 45000);
    
    ws.on("error", (e) => console.log(`ERROR: ${e.message}`));
    ws.on("close", (code) => { console.log(`CLOSED: ${code}`); if (!done) finish(); });
    
    // STEP 1: On connect, send awareness (like browser)
    ws.on("open", () => {
      console.log("[0s] CONNECTED — Sending AWARENESS");
      ws.send(Buffer.from(encodeAwareness(ydoc.clientID, awarenessClk++)));
    });
    
    let syncDone = false;
    
    ws.on("message", (raw: Buffer, isBinary: boolean) => {
      if (!isBinary) {
        console.log(`RECV text: "${raw.toString().slice(0, 100)}"`);
        return;
      }
      
      const data = new Uint8Array(raw);
      if (data.length === 0) return;
      
      // PING → PONG
      if (data[0] === 0x11) { ws.send(Buffer.from([0x12])); return; }
      if (data[0] === 0x12 || data[0] === 0x01) return; // pong, awareness
      if (data[0] !== 0x00) {
        console.log(`RECV unknown type=0x${data[0].toString(16)} [${data.length}b]`);
        return;
      }
      
      const [subType, subOff] = readVarUint(data, 1);
      
      if (subType === 0) {
        // Server SyncStep1
        const [svLen, svStart] = readVarUint(data, subOff);
        const serverSv = data.slice(svStart, svStart + svLen);
        console.log(`RECV SyncStep1 [${data.length}b] sv=[${Array.from(serverSv)}]`);
        
        // Respond with SyncStep2 (our empty state, V1)
        const update = Y.encodeStateAsUpdate(ydoc, serverSv);
        const step2 = encodeSyncMsg(0x01, update);
        ws.send(Buffer.from(step2));
        console.log(`SENT SyncStep2 [${step2.length}b] update=[${Array.from(update)}]`);
      }
      
      else if (subType === 1 && !syncDone) {
        syncDone = true;
        // Server SyncStep2
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);
        console.log(`RECV SyncStep2 [${data.length}b] update=${uLen}b`);
        console.log(`  Raw update: [${Array.from(updateData)}]`);
        
        // Try V1 FIRST (critical change from previous tests!)
        let applied = false;
        try {
          Y.applyUpdate(ydoc, updateData);
          applied = true;
          console.log(`  Applied as V1 ✓`);
        } catch (e) {
          console.log(`  V1 failed: ${(e as Error).message}`);
        }
        if (!applied) {
          try {
            Y.applyUpdateV2(ydoc, updateData);
            applied = true;
            console.log(`  Applied as V2 ✓`);
          } catch (e) {
            console.log(`  V2 also failed: ${(e as Error).message}`);
          }
        }
        
        console.log(`  Doc state after sync: root keys=[${Array.from(ydoc.getMap("root").keys())}]`);
        
        // WAIT 3s like browser does (browser waits ~4s)
        console.log(`\nWaiting 3s before writing content (like browser)...`);
        
        setTimeout(() => {
          if (done) return;
          
          // Send awareness update
          ws.send(Buffer.from(encodeAwareness(ydoc.clientID, awarenessClk++)));
          console.log(`\nSENT AWARENESS clock=${awarenessClk - 1}`);
          
          // Capture state BEFORE changes
          const beforeSv = Y.encodeStateVector(ydoc);
          console.log(`Before write sv: [${Array.from(beforeSv)}]`);
          
          // Write content in a single transaction
          ydoc.transact(() => {
            const root = ydoc.getMap("root");
            
            // Create arrays if needed
            let ch = root.get("children") as Y.Array<string> | undefined;
            if (!ch) { ch = new Y.Array<string>(); root.set("children", ch); }
            
            let rch = root.get("rootChildren") as Y.Array<string> | undefined;
            if (!rch) { rch = new Y.Array<string>(); root.set("rootChildren", rch); }
            
            let blk = root.get("blocks") as Y.Map<unknown> | undefined;
            if (!blk) { blk = new Y.Map(); root.set("blocks", blk); }
            
            // Clear any existing
            if (ch.length > 0) ch.delete(0, ch.length);
            if (rch.length > 0) rch.delete(0, rch.length);
            for (const k of Array.from(blk.keys())) blk.delete(k);
            
            // Add a heading block with ALL browser fields
            const hId = genBlockId();
            const hm = new Y.Map();
            hm.set("id", hId);
            hm.set("type", "hLarge");
            hm.set("number", "0");
            hm.set("indent", 0);
            hm.set("selectorId", "0");
            hm.set("capsule", false);
            hm.set("contentId", "");
            hm.set("mode", "none");
            hm.set("parent", "");
            const hChars = new Y.Array();
            for (const c of "Hello World!") hChars.push([c]);
            hm.set("characters", hChars);
            blk.set(hId, hm);
            ch.push([hId]);
            rch.push([hId]);
            
            // Add a paragraph block
            const pId = genBlockId();
            const pm = new Y.Map();
            pm.set("id", pId);
            pm.set("type", "paragraph");
            pm.set("number", "0");
            pm.set("indent", 0);
            pm.set("selectorId", "0");
            pm.set("capsule", false);
            pm.set("contentId", "");
            pm.set("mode", "none");
            pm.set("parent", "");
            const pChars = new Y.Array();
            for (const c of "This content was written programmatically!") pChars.push([c]);
            pm.set("characters", pChars);
            blk.set(pId, pm);
            ch.push([pId]);
            rch.push([pId]);
          });
          
          // Encode diff as V1
          const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
          const updateMsg = encodeSyncMsg(0x02, diff);
          ws.send(Buffer.from(updateMsg));
          console.log(`SENT Y.UPDATE [${updateMsg.length}b] diff=${diff.length}b`);
          console.log(`  First 40 bytes: [${Array.from(updateMsg.slice(0, 40))}]`);
          
          // Verify doc state
          const root = ydoc.getMap("root");
          const ch = root.get("children") as Y.Array<string>;
          const blk = root.get("blocks") as Y.Map<unknown>;
          console.log(`  Doc has ${ch?.length} children, ${blk ? Array.from(blk.keys()).length : 0} blocks`);
          
          // Wait 8s for server to process, then verify
          console.log(`\nWaiting 8s for server processing...`);
          
          setTimeout(async () => {
            await checkDump(pageId, "T+11s");
            
            // Close and check again
            ws.close();
            await new Promise(r => setTimeout(r, 2000));
            
            await checkDump(pageId, "T+13s FINAL");
            
            console.log(`\nPage URL: https://${HOST}/ws/${WS_ID}/note/${pageId}`);
            finish();
          }, 8000);
          
        }, 3000); // 3s delay after sync
      }
      
      else if (subType === 2) {
        const [uLen] = readVarUint(data, subOff);
        console.log(`RECV Y.UPDATE [${data.length}b] update=${uLen}b`);
      }
    });
  });
}

main().catch(console.error);
