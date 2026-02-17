/**
 * Test: Send update as V2 to match server's encoding format.
 * Server SyncStep2 comes as V2, so we should send V2 updates.
 * 
 * Run: npx tsx scripts/test-v2-update.ts > data/v2-update.txt 2>&1
 */
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
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

function writeVarUint(buf: number[], num: number): void {
  while (num > 0x7f) { buf.push(0x80 | (num & 0x7f)); num >>>= 7; }
  buf.push(num & 0x7f);
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

async function main() {
  const pageId = await createPage("V2 Update Test " + new Date().toISOString());
  console.log("Page:", pageId);
  console.log("URL:", `https://${HOST}/ws/${WS_ID}/note/${pageId}`);
  
  const jwt = await getToken(pageId);
  const ydoc = new Y.Doc();
  
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, 0); // msg type
  encoding.writeVarUint(enc, 0); // step1
  encoding.writeVarUint8Array(enc, Y.encodeStateVector(ydoc));
  const ss1B64 = Buffer.from(encoding.toUint8Array(enc)).toString("base64");
  
  const wsUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}?token=${jwt}&cid=${ydoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=v2test&ratempt=0&widx=0&encv2=true&timezone=${encodeURIComponent("America/Denver")}&syncStep1=${encodeURIComponent(ss1B64)}`;
  
  return new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${HOST}`, cookie: COOKIE },
    });
    
    const tid = setTimeout(() => { console.log("TIMEOUT"); ws.close(); resolve(); }, 15000);
    let contentSent = false;
    
    ws.on("open", () => {
      console.log("Connected, clientID:", ydoc.clientID);
      // Send awareness
      const buf: number[] = [0x01];
      writeVarUint(buf, 1);
      writeVarUint(buf, ydoc.clientID);
      writeVarUint(buf, 0);
      const stateBytes = new TextEncoder().encode("{}");
      writeVarUint(buf, stateBytes.length);
      const awMsg = new Uint8Array(buf.length + stateBytes.length);
      awMsg.set(buf);
      awMsg.set(stateBytes, buf.length);
      ws.send(Buffer.from(awMsg));
    });
    
    ws.on("message", (raw: Buffer) => {
      const data = new Uint8Array(raw);
      if (data.length === 0) return;
      if (data[0] === 0x11) { ws.send(Buffer.from(new Uint8Array([0x12]))); return; }
      if (data[0] !== 0x00) return;
      
      let idx = 1;
      let subType = 0, shift = 0, byte;
      do { byte = data[idx++]; subType |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
      
      let payloadLen = 0;
      shift = 0;
      do { byte = data[idx++]; payloadLen |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
      const payload = data.slice(idx, idx + payloadLen);
      
      console.log(`Sync ${subType === 0 ? "Step1" : subType === 1 ? "Step2" : "Update"}: ${payload.length}b payload`);
      
      if (subType === 0) {
        // Respond with SyncStep2 as V2 (server uses V2 for encv2=true)
        const update = Y.encodeStateAsUpdateV2(ydoc, payload);
        const resp: number[] = [0x00, 0x01];
        writeVarUint(resp, update.length);
        const respMsg = new Uint8Array(resp.length + update.length);
        respMsg.set(resp);
        respMsg.set(update, resp.length);
        ws.send(Buffer.from(respMsg));
        console.log(`  → SyncStep2 response (V2, ${update.length}b)`);
      }
      
      if (subType === 1 && !contentSent) {
        contentSent = true;
        
        // Apply server state as V2
        try { Y.applyUpdateV2(ydoc, payload); } catch {
          try { Y.applyUpdate(ydoc, payload); } catch {}
        }
        console.log("Applied server state");
        
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
          for (const ch of "Hello from V2 update!") {
            chars.push([ch]);
          }
          bm.set("characters", chars);
          
          blocksMap.set(blockId, bm);
          rootChildren.push([blockId]);
        });
        
        // Send as V2 update
        const diffV2 = Y.encodeStateAsUpdateV2(ydoc, beforeSv);
        const v2Msg: number[] = [0x00, 0x02];
        writeVarUint(v2Msg, diffV2.length);
        const v2MsgArr = new Uint8Array(v2Msg.length + diffV2.length);
        v2MsgArr.set(v2Msg);
        v2MsgArr.set(diffV2, v2Msg.length);
        ws.send(Buffer.from(v2MsgArr));
        console.log(`Sent V2 update: ${diffV2.length}b`);
        
        // Verify
        console.log(`blocks: ${ydoc.getMap("blocks").size}, rootChildren: ${ydoc.getArray("rootChildren").length}`);
        
        setTimeout(async () => {
          // Check dump
          const dumpRes = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
          const dumpBuf = new Uint8Array(await dumpRes.arrayBuffer());
          console.log(`Dump: ${dumpBuf.length}b`);
          clearTimeout(tid);
          ws.close();
          resolve();
        }, 4000);
      }
      
      if (subType === 2) {
        try { Y.applyUpdateV2(ydoc, payload); } catch {
          try { Y.applyUpdate(ydoc, payload); } catch {}
        }
        console.log("  Applied server echo");
      }
    });
    
    ws.on("error", (e) => { console.log("Error:", e.message); });
    ws.on("close", () => { console.log("Closed"); });
  });
}

main().catch(console.error);
