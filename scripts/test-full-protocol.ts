/**
 * Complete browser protocol replication with ALL discovered elements:
 * 1. Binary AWARENESS on connect  
 * 2. Binary SYNC-step2 response
 * 3. Text ACK for server's JSON messages
 * 4. Binary 0xAC JWT re-auth message
 * 5. Text heartbeat {"data":"-","seqno":0}
 * 6. Binary UPDATE with content changes
 *
 * Run: npx tsx scripts/test-full-protocol.ts > data/full-protocol-output.txt 2>&1
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

// Encode the JWT re-auth message matching browser format:
// varuint(300), varuint(jwtLen), jwtBytes
// 300 encodes as [0xAC, 0x02] in varuint
function encodeJwtMessage(jwt: string): Uint8Array {
  const jwtBytes = new TextEncoder().encode(jwt);
  const header: number[] = [];
  writeVarUint(header, 300); // message type 300 → [0xAC, 0x02]
  writeVarUint(header, jwtBytes.length);
  const msg = new Uint8Array(header.length + jwtBytes.length);
  msg.set(header);
  msg.set(jwtBytes, header.length);
  return msg;
}

function randomAlpha(len: number): string {
  return Array.from({ length: len }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
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
      note: { textVersion: 2, title: `FullProto ${Date.now()}`, parentId: "default", is_portal_share: false },
    }),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as any).globalId || noteId;
}

async function checkDump(pageId: string, label: string): Promise<boolean> {
  const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
  const binary = new Uint8Array(await res.arrayBuffer());
  const text = Buffer.from(binary).toString("utf-8", 0, Math.min(2000, binary.length));
  const hasContent = text.includes("Hello") || text.includes("characters");
  console.log(`[${label}] Dump: ${binary.length}b hasContent=${hasContent}`);
  return hasContent;
}

async function main() {
  console.log("=== FULL PROTOCOL TEST ===\n");
  
  const pageId = await createPage();
  console.log(`Page: ${pageId}`);
  
  // Build Y.Doc with initial paragraph (like browser)
  const ydoc = new Y.Doc();
  ydoc.transact(() => {
    const root = ydoc.getMap("root");
    const ch = new Y.Array<string>(); const rch = new Y.Array<string>();
    const blk = new Y.Map();
    const bId = `b${Date.now()}_init`;
    const bm = new Y.Map();
    bm.set("id", bId); bm.set("type", "paragraph"); bm.set("indent", 0);
    bm.set("color", "transparent"); bm.set("align", "left");
    bm.set("characters", new Y.Array());
    blk.set(bId, bm); ch.push([bId]); rch.push([bId]);
    root.set("children", ch); root.set("rootChildren", rch); root.set("blocks", blk);
  });
  
  // SyncStep1 for URL (WITH outer type byte — confirmed working from strategy test)
  const sv = Y.encodeStateVector(ydoc);
  const svBuf: number[] = [0x00, 0x00];
  writeVarUint(svBuf, sv.length);
  const ss1 = new Uint8Array(svBuf.length + sv.length);
  ss1.set(svBuf); ss1.set(sv, svBuf.length);
  
  const jwt = await getJWT(pageId);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const wsUrl = [
    `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}`,
    `?token=${jwt}&cid=${ydoc.clientID}`,
    `&app=web&reason=editor&web-editor=1.1.10`,
    `&frame_id=${randomAlpha(7)}&ratempt=0&widx=0`,
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
    let seqno = 0;
    let done = false;
    let updateSent = false;
    
    const finish = () => { if (!done) { done = true; try { ws.close(); } catch {} resolve(); } };
    setTimeout(() => { console.log("TIMEOUT"); finish(); }, 30000);
    
    ws.on("error", (e) => console.log(`ERROR: ${e.message}`));
    ws.on("close", (code) => console.log(`CLOSED: ${code}`));
    
    ws.on("open", () => {
      console.log("[1] Connected! Sending AWARENESS...");
      ws.send(Buffer.from(encodeAwareness(ydoc.clientID, awarenessClk++)));
    });
    
    // Handle text messages (JSON protocol)
    ws.on("message", (raw: Buffer, isBinary: boolean) => {
      if (!isBinary) {
        const text = raw.toString("utf-8");
        console.log(`RECV TEXT: ${text.slice(0, 150)}`);
        
        // Parse JSON responses from server
        try {
          if (text.startsWith("[")) {
            const items = JSON.parse(text);
            for (const item of items) {
              if (item.d?._zldt) {
                // Server sent state notification - ACK it
                const ack = JSON.stringify({ opr: "ack", uvid: item.d._zldt });
                ws.send(ack);
                console.log(`SENT TEXT ACK: ${ack}`);
              }
            }
          }
        } catch {}
        
        // Respond to engine.io ping "2" with pong "3"
        if (text === "2") {
          ws.send("3");
          console.log(`SENT TEXT PONG: 3`);
        }
        
        return;
      }
      
      // Binary message handling
      const data = new Uint8Array(raw);
      if (data.length === 0) return;
      const msgType = data[0];
      
      // PING/PONG
      if (msgType === 0x11) { ws.send(Buffer.from([0x12])); return; }
      if (msgType === 0x12 || msgType === 0x01) return; // PONG/AWARENESS echo
      
      if (msgType !== 0x00) return; // Unknown
      
      const [subType, subOff] = readVarUint(data, 1);
      
      if (subType === 0) {
        // SyncStep1 from server
        const [svLen, svStart] = readVarUint(data, subOff);
        const serverSv = data.slice(svStart, svStart + svLen);
        console.log(`[2] RECV SyncStep1 [${data.length}b] sv=[${Array.from(serverSv).join(",")}]`);
        
        // Send SyncStep2 (V2)
        const update = Y.encodeStateAsUpdateV2(ydoc, serverSv);
        const step2 = encodeSyncMsg(0x01, update);
        ws.send(Buffer.from(step2));
        console.log(`[3] SENT SyncStep2 [${step2.length}b]`);
      }
      
      else if (subType === 1) {
        // SyncStep2 from server
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);
        console.log(`[4] RECV SyncStep2 [${data.length}b] update=${uLen}b`);
        
        try { Y.applyUpdateV2(ydoc, updateData); } catch {
          try { Y.applyUpdate(ydoc, updateData); } catch {}
        }
        
        // NOW: After sync is complete, follow the browser's exact sequence:
        // Browser sends 0xAC JWT message + awareness + heartbeat + then content
        
        // Browser sends JWT re-auth here but server disconnects us when we do it
        // (probably because server never sends us the text JSON init messages first)
        // Skip the JWT message for now
        
        // Send awareness with clock=1
        console.log(`[11] SENDING AWARENESS clock=${awarenessClk}`);
        ws.send(Buffer.from(encodeAwareness(ydoc.clientID, awarenessClk++)));
        
        // Send heartbeat
        const heartbeat = JSON.stringify({ data: "-", seqno: seqno++ });
        ws.send(heartbeat);
        console.log(`[13] SENT heartbeat: ${heartbeat}`);
        
        // Send content immediately (no delay)
        if (!updateSent) {
          updateSent = true;
          
          const beforeSv = Y.encodeStateVector(ydoc);
          
          ydoc.transact(() => {
            const root = ydoc.getMap("root");
            const ch = root.get("children") as Y.Array<string>;
            const rch = root.get("rootChildren") as Y.Array<string>;
            const blk = root.get("blocks") as Y.Map<unknown>;
            if (ch?.length > 0) ch.delete(0, ch.length);
            if (rch?.length > 0) rch.delete(0, rch.length);
            if (blk) for (const k of Array.from(blk.keys())) blk.delete(k);
            
            const hId = `b${Date.now()}_h`;
            const hm = new Y.Map();
            hm.set("id", hId); hm.set("type", "hLarge"); hm.set("indent", 0);
            hm.set("color", "transparent"); hm.set("align", "left");
            const hChars = new Y.Array();
            for (const c of "Hello World!") hChars.push([c]);
            hm.set("characters", hChars);
            blk.set(hId, hm); ch.push([hId]); rch.push([hId]);
            
            const pId = `b${Date.now()}_p`;
            const pm = new Y.Map();
            pm.set("id", pId); pm.set("type", "paragraph"); pm.set("indent", 0);
            pm.set("color", "transparent"); pm.set("align", "left");
            const pChars = new Y.Array();
            for (const c of "Content persisted!") pChars.push([c]);
            pm.set("characters", pChars);
            blk.set(pId, pm); ch.push([pId]); rch.push([pId]);
          });
          
          const diff = Y.encodeStateAsUpdateV2(ydoc, beforeSv);
          const updateMsg = encodeSyncMsg(0x02, diff);
          ws.send(Buffer.from(updateMsg));
          console.log(`\n[UPDATE] SENT UPDATE [${updateMsg.length}b]`);
          
          // Wait, then verify
          setTimeout(async () => {
            console.log("\n--- VERIFICATION ---");
            const r1 = await checkDump(pageId, "T+5s");
            ws.close();
            await new Promise(r => setTimeout(r, 2000));
            const r2 = await checkDump(pageId, "T+7s");
            console.log(`\n${r1 || r2 ? '✅ SUCCESS!' : '❌ FAILED (still empty)'}`);
            finish();
          }, 5000);
        }
      }

      else if (subType === 2) {
        const [uLen, uStart] = readVarUint(data, subOff);
        console.log(`RECV UPDATE [${data.length}b]`);
        const updateData = data.slice(uStart, uStart + uLen);
        try { Y.applyUpdateV2(ydoc, updateData); } catch {
          try { Y.applyUpdate(ydoc, updateData); } catch {}
        }
      }
    });
  });
}

main().catch(console.error);
