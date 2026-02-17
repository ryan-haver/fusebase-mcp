/**
 * Test with ALL protocol fixes from frame-analysis findings:
 * 1. Fix awareness: [0x01, varuint(payloadLen), ...payload]
 * 2. No encv2 param (pure V1 throughout)
 * 3. Top-level shared types
 * 4. Correct SyncStep1 URL format
 * 
 * Run: npx tsx scripts/test-fixed-protocol.ts > data/fixed-protocol.txt 2>&1
 */
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { WebSocket } from "ws";

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

function writeVarUintBuf(buf: number[], num: number): void {
  while (num > 0x7f) { buf.push(0x80 | (num & 0x7f)); num >>>= 7; }
  buf.push(num & 0x7f);
}

function varuintBytes(num: number): number[] {
  const buf: number[] = [];
  writeVarUintBuf(buf, num);
  return buf;
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

async function getToken(pageId: string): Promise<string> {
  const res = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
    method: "POST", headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({ tokens: [] }),
  });
  return ((await res.json()) as any).token;
}

/**
 * Build CORRECT awareness message matching browser format:
 * [0x01(type), varuint(payloadLen), payload]
 * where payload = [varuint(clientCount), for each: varuint(clientID), varuint(clock), varuint(stateLen), stateBytes]
 */
function buildAwarenessMessage(clientID: number): Uint8Array {
  // Build payload first
  const payload: number[] = [];
  writeVarUintBuf(payload, 1); // 1 client
  writeVarUintBuf(payload, clientID);
  writeVarUintBuf(payload, 0); // clock=0
  const stateBytes = new TextEncoder().encode("{}");
  writeVarUintBuf(payload, stateBytes.length);
  payload.push(...stateBytes);
  
  // Wrap with type + length
  const msg: number[] = [0x01]; // awareness type
  writeVarUintBuf(msg, payload.length); // LENGTH PREFIX
  msg.push(...payload);
  
  return new Uint8Array(msg);
}

async function main() {
  const pageId = await createPage("Fixed Protocol " + new Date().toISOString());
  console.log("Page:", pageId);
  console.log("URL:", `https://${HOST}/ws/${WS_ID}/note/${pageId}`);
  
  const jwt = await getToken(pageId);
  const ydoc = new Y.Doc();
  
  // Build syncStep1 for URL — use same format as browser:
  // [0x00(syncType), 0x00(step1Sub), varuint(svLen), sv]
  const sv = Y.encodeStateVector(ydoc);
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, 0); // sync msg type
  encoding.writeVarUint(enc, 0); // step1 sub-type
  encoding.writeVarUint8Array(enc, sv);
  const ss1B64 = Buffer.from(encoding.toUint8Array(enc)).toString("base64");
  
  // No encv2=true — pure V1
  const wsUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}?token=${jwt}&cid=${ydoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=fixed${Date.now()}&ratempt=0&widx=0&timezone=${encodeURIComponent("America/Denver")}&syncStep1=${encodeURIComponent(ss1B64)}`;
  
  return new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${HOST}`, cookie: COOKIE },
    });
    
    const tid = setTimeout(() => { console.log("TIMEOUT"); ws.close(); resolve(); }, 15000);
    let contentSent = false;
    
    ws.on("open", () => {
      console.log("Connected, clientID:", ydoc.clientID);
      
      // Send CORRECT awareness with length prefix
      const awMsg = buildAwarenessMessage(ydoc.clientID);
      ws.send(Buffer.from(awMsg));
      console.log("Sent awareness:", Array.from(awMsg).map(b => "0x" + b.toString(16).padStart(2, "0")).join(", "));
    });
    
    ws.on("message", (raw: Buffer) => {
      const data = new Uint8Array(raw);
      if (data.length === 0) return;
      if (data[0] === 0x11) { ws.send(Buffer.from(new Uint8Array([0x12]))); return; }
      if (data[0] === 0x01) return; // awareness from server
      if (data[0] !== 0x00) { console.log(`Msg type: 0x${data[0].toString(16)}`); return; }
      
      let idx = 1;
      let subType = 0, shift = 0, byte;
      do { byte = data[idx++]; subType |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
      
      let payloadLen = 0;
      shift = 0;
      do { byte = data[idx++]; payloadLen |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
      const payload = data.slice(idx, idx + payloadLen);
      
      console.log(`\nSync ${subType === 0 ? "Step1" : subType === 1 ? "Step2" : "Update"}: ${payload.length}b`);
      
      if (subType === 0) {
        // SyncStep2 response in V1
        const update = Y.encodeStateAsUpdate(ydoc, payload);
        const resp: number[] = [0x00, 0x01];
        writeVarUintBuf(resp, update.length);
        const respMsg = new Uint8Array(resp.length + update.length);
        respMsg.set(resp);
        respMsg.set(update, resp.length);
        ws.send(Buffer.from(respMsg));
        console.log(`  → SyncStep2 response (${update.length}b)`);
      }
      
      if (subType === 1 && !contentSent) {
        contentSent = true;
        
        // Apply server state V1
        try { Y.applyUpdate(ydoc, payload); console.log("  Applied as V1"); }
        catch { 
          try { Y.applyUpdateV2(ydoc, payload); console.log("  Applied as V2"); }
          catch {} 
        }
        
        const beforeSv = Y.encodeStateVector(ydoc);
        
        ydoc.transact(() => {
          const blocksMap = ydoc.getMap("blocks");
          const rootChildren = ydoc.getArray<string>("rootChildren");
          
          const blockId = `b${ydoc.clientID}_0`;
          const bm = new Y.Map();
          bm.set("id", blockId);
          bm.set("type", "paragraph");
          bm.set("number", "0");
          bm.set("indent", 0);
          bm.set("selectorId", "0");
          bm.set("capsule", false);
          bm.set("contentId", "");
          bm.set("mode", "none");
          bm.set("parent", "");
          
          const chars = new Y.Array();
          for (const ch of "Hello from fixed protocol!") {
            chars.push([ch]);
          }
          bm.set("characters", chars);
          
          blocksMap.set(blockId, bm);
          rootChildren.push([blockId]);
        });
        
        // V1 update
        const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
        const msg: number[] = [0x00, 0x02];
        writeVarUintBuf(msg, diff.length);
        const updateMsg = new Uint8Array(msg.length + diff.length);
        updateMsg.set(msg);
        updateMsg.set(diff, msg.length);
        ws.send(Buffer.from(updateMsg));
        console.log(`  Sent V1 update: ${diff.length}b`);
        console.log(`  blocks: ${ydoc.getMap("blocks").size}, rootChildren: ${ydoc.getArray("rootChildren").length}`);
        
        setTimeout(async () => {
          const dumpRes = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
          const dumpBuf = new Uint8Array(await dumpRes.arrayBuffer());
          console.log(`\n  Dump: ${dumpBuf.length}b`);
          clearTimeout(tid);
          ws.close();
          resolve();
        }, 4000);
      }
      
      if (subType === 2) {
        try { Y.applyUpdate(ydoc, payload); } catch {
          try { Y.applyUpdateV2(ydoc, payload); } catch {}
        }
        console.log("  Applied echo");
      }
    });
    
    ws.on("error", (e) => { console.log("Error:", e.message); });
    ws.on("close", () => { console.log("Closed"); });
  });
}

main().catch(console.error);
