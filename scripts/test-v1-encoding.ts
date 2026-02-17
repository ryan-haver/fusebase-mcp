/**
 * DEFINITIVE Y.js WebSocket Writer Test
 * 
 * Based on decoded browser WebSocket capture, key findings:
 * 1. Uses V1 encoding (not V2) despite encv2=true in URL
 * 2. SyncStep2: encodeStateAsUpdate (V1), NOT encodeStateAsUpdateV2
 * 3. Updates: encodeStateAsUpdate (V1) diffs
 * 4. JWT-REAUTH (msg type 300) sent after initial sync
 * 5. Awareness + PING/PONG keepalive
 * 
 * Run: npx tsx scripts/test-v1-encoding.ts
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

// Encode sync message: [0x00, subType, varuint(dataLen), data]
function encodeSyncMsg(subType: number, data: Uint8Array): Uint8Array {
  const header: number[] = [0x00, subType];
  writeVarUint(header, data.length);
  const msg = new Uint8Array(header.length + data.length);
  msg.set(header);
  msg.set(data, header.length);
  return msg;
}

// Encode awareness: [0x01, varuint(1), varuint(clientId), varuint(clock), varuint(stateLen), state]
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

// Encode JWT re-auth: varuint(300), varuint(jwtLen), jwtBytes
function encodeJwtReauth(jwt: string): Uint8Array {
  const jwtBytes = new TextEncoder().encode(jwt);
  const header: number[] = [];
  writeVarUint(header, 300);
  writeVarUint(header, jwtBytes.length);
  const msg = new Uint8Array(header.length + jwtBytes.length);
  msg.set(header);
  msg.set(jwtBytes, header.length);
  return msg;
}

async function getJWT(pageId: string): Promise<string> {
  const res = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
    method: "POST",
    headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({ tokens: [] }),
  });
  if (!res.ok) throw new Error(`JWT: ${res.status}`);
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
      note: { textVersion: 2, title: `V1Test ${Date.now()}`, parentId: "default", is_portal_share: false },
    }),
  });
  if (!res.ok) throw new Error(`Create: ${res.status} ${await res.text()}`);
  return ((await res.json()) as any).globalId || noteId;
}

async function checkDump(pageId: string, label: string): Promise<boolean> {
  const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
  const bin = new Uint8Array(await res.arrayBuffer());
  console.log(`[${label}] Dump: ${bin.length}b hex=${Buffer.from(bin).toString("hex").slice(0, 60)}`);
  
  if (bin.length > 10) {
    // Try to decode as Y.Doc to check content
    const doc = new Y.Doc();
    try {
      Y.applyUpdate(doc, bin);
      const root = doc.getMap("root");
      const ch = root.get("children");
      const blk = root.get("blocks");
      console.log(`  Y.Doc decoded: children=${ch?.toJSON?.()?.length}, blocks keys=${blk && Array.from((blk as any).keys()).length}`);
      return true;
    } catch (e) {
      console.log(`  V1 decode failed, trying V2...`);
      try {
        Y.applyUpdateV2(doc, bin);
        const root = doc.getMap("root");
        console.log(`  V2 decoded: root keys=${Array.from(root.keys())}`);
        return true;
      } catch { console.log(`  Both decodings failed`); }
    }
  }
  return false;
}

async function main() {
  console.log("=== DEFINITIVE V1 ENCODING TEST ===\n");
  
  const pageId = await createPage();
  console.log(`Page: ${pageId}`);
  
  // Pre-populate Y.Doc with initial paragraph (like browser does)
  const ydoc = new Y.Doc();
  ydoc.transact(() => {
    const root = ydoc.getMap("root");
    const ch = new Y.Array<string>();
    const rch = new Y.Array<string>();
    const blk = new Y.Map();
    const bId = `b${Date.now()}_init_0`;
    const bm = new Y.Map();
    bm.set("id", bId); bm.set("type", "paragraph"); bm.set("indent", 0);
    bm.set("color", "transparent"); bm.set("align", "left");
    bm.set("characters", new Y.Array());
    blk.set(bId, bm); ch.push([bId]); rch.push([bId]);
    root.set("children", ch); root.set("rootChildren", rch); root.set("blocks", blk);
  });
  
  // Build syncStep1 for URL (V1, with outer type byte — confirmed working)
  const sv = Y.encodeStateVector(ydoc);
  const svBuf: number[] = [0x00, 0x00];
  writeVarUint(svBuf, sv.length);
  const ss1 = new Uint8Array(svBuf.length + sv.length);
  ss1.set(svBuf);
  ss1.set(sv, svBuf.length);
  
  const jwt = await getJWT(pageId);
  console.log(`JWT: ${jwt.slice(0, 40)}...`);
  
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
  
  console.log("Connecting...");
  
  await new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${HOST}`, cookie: COOKIE },
    });
    
    let awarenessClk = 0;
    let done = false;
    let updateSent = false;
    const finish = () => { if (!done) { done = true; try { ws.close(); } catch {} resolve(); } };
    setTimeout(() => { console.log("\nTIMEOUT"); finish(); }, 30000);
    
    ws.on("error", (e) => console.log(`ERROR: ${e.message}`));
    ws.on("close", (code) => { console.log(`CLOSED: ${code}`); if (!done) finish(); });
    
    ws.on("open", () => {
      console.log("\n[1] CONNECTED — Sending AWARENESS");
      ws.send(Buffer.from(encodeAwareness(ydoc.clientID, awarenessClk++)));
    });
    
    ws.on("message", (raw: Buffer, isBinary: boolean) => {
      if (!isBinary) {
        // Text message — respond if engine.io ping
        const text = raw.toString("utf-8");
        if (text === "2") ws.send("3");
        return;
      }
      
      const data = new Uint8Array(raw);
      if (data.length === 0) return;
      
      // PING → PONG
      if (data[0] === 0x11) { ws.send(Buffer.from([0x12])); return; }
      if (data[0] === 0x12 || data[0] === 0x01) return;
      if (data[0] !== 0x00) return;
      
      const [subType, subOff] = readVarUint(data, 1);
      
      if (subType === 0) {
        // SyncStep1 from server
        const [svLen, svStart] = readVarUint(data, subOff);
        const serverSv = data.slice(svStart, svStart + svLen);
        console.log(`[2] RECV SyncStep1 [${data.length}b] sv=[${Array.from(serverSv).join(",")}]`);
        
        // Send SyncStep2 with *** V1 encoding *** (the key fix!)
        const update = Y.encodeStateAsUpdate(ydoc, serverSv);
        const step2 = encodeSyncMsg(0x01, update);
        ws.send(Buffer.from(step2));
        console.log(`[3] SENT SyncStep2 [${step2.length}b] (V1 encoded)`);
        console.log(`    First bytes: [${Array.from(step2.slice(0, 20)).join(",")}]`);
      }
      
      else if (subType === 1) {
        // SyncStep2 from server
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);
        console.log(`[4] RECV SyncStep2 [${data.length}b] update=${uLen}b`);
        
        // Apply server's update (try V1 first, then V2)
        try { Y.applyUpdate(ydoc, updateData); console.log("    Applied V1"); }
        catch {
          try { Y.applyUpdateV2(ydoc, updateData); console.log("    Applied V2"); }
          catch { console.log("    Failed to apply"); }
        }
        
        // Send JWT re-auth (like browser does at +12s)
        console.log(`[5] SENDING JWT-REAUTH (type 300)...`);
        const jwtMsg = encodeJwtReauth(jwt);
        ws.send(Buffer.from(jwtMsg));
        console.log(`    Sent [${jwtMsg.length}b]`);
        
        // Wait 1s, then send awareness + content update
        setTimeout(() => {
          if (updateSent || done) return;
          updateSent = true;
          
          // Send awareness
          ws.send(Buffer.from(encodeAwareness(ydoc.clientID, awarenessClk++)));
          console.log(`[6] SENT AWARENESS clock=${awarenessClk - 1}`);
          
          // Capture state before changes
          const beforeSv = Y.encodeStateVector(ydoc);
          
          // Add content like the browser does
          ydoc.transact(() => {
            const root = ydoc.getMap("root");
            const ch = root.get("children") as Y.Array<string>;
            const rch = root.get("rootChildren") as Y.Array<string>;
            const blk = root.get("blocks") as Y.Map<unknown>;
            
            // Clear old content
            if (ch?.length > 0) ch.delete(0, ch.length);
            if (rch?.length > 0) rch.delete(0, rch.length);
            if (blk) for (const k of Array.from(blk.keys())) blk.delete(k);
            
            // Add heading
            const hId = `b${Date.now()}_h`;
            const hm = new Y.Map();
            hm.set("id", hId); hm.set("type", "hLarge"); hm.set("indent", 0);
            hm.set("color", "transparent"); hm.set("align", "left");
            const hChars = new Y.Array();
            for (const c of "Hello World!") hChars.push([c]);
            hm.set("characters", hChars);
            blk.set(hId, hm); ch.push([hId]); rch.push([hId]);
            
            // Add paragraph
            const pId = `b${Date.now()}_p`;
            const pm = new Y.Map();
            pm.set("id", pId); pm.set("type", "paragraph"); pm.set("indent", 0);
            pm.set("color", "transparent"); pm.set("align", "left");
            const pChars = new Y.Array();
            for (const c of "Content written by V1 protocol!") pChars.push([c]);
            pm.set("characters", pChars);
            blk.set(pId, pm); ch.push([pId]); rch.push([pId]);
          });
          
          // Encode diff as V1 (NOT V2!)
          const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
          const updateMsg = encodeSyncMsg(0x02, diff);
          ws.send(Buffer.from(updateMsg));
          console.log(`\n[7] SENT Y.UPDATE [${updateMsg.length}b] (V1 encoded)`);
          console.log(`    First bytes: [${Array.from(updateMsg.slice(0, 30)).join(",")}]`);
          
          // Wait 5s, then verify
          setTimeout(async () => {
            console.log("\n--- VERIFICATION ---");
            const r1 = await checkDump(pageId, "T+6s");
            
            // Close connection cleanly
            ws.close();
            await new Promise(r => setTimeout(r, 2000));
            
            const r2 = await checkDump(pageId, "T+8s");
            
            if (r1 || r2) {
              console.log("\n✅ SUCCESS! Content persisted!");
            } else {
              console.log("\n❌ FAILED — content not persisted");
            }
            
            // Also check page via API
            try {
              const pageRes = await fetch(`https://${HOST}/v2/api/web-editor/notes/${pageId}`, {
                headers: { cookie: COOKIE },
              });
              if (pageRes.ok) {
                const pageData = await pageRes.json() as any;
                console.log(`\nAPI check: title="${pageData.title}", textVersion=${pageData.textVersion}`);
              }
            } catch {}
            
            finish();
          }, 5000);
          
        }, 1000); // Wait 1s after sync before writing content
      }
      
      else if (subType === 2) {
        const [uLen] = readVarUint(data, subOff);
        console.log(`RECV Y.UPDATE [${data.length}b] len=${uLen}`);
      }
    });
  });
}

main().catch(console.error);
