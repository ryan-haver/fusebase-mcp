/**
 * Test: Use encv2=false (no v2 encoding) to force all-V1 protocol.
 * The inconsistency between V2 SyncStep2 from server and V1 updates from us
 * might cause state corruption that makes loading fail.
 * 
 * Run: npx tsx scripts/test-no-encv2.ts > data/no-encv2.txt 2>&1
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
  const pageId = await createPage("NoEncV2 Test " + new Date().toISOString());
  console.log("Page:", pageId);
  console.log("URL:", `https://${HOST}/ws/${WS_ID}/note/${pageId}`);
  
  const jwt = await getToken(pageId);
  const ydoc = new Y.Doc();
  
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, 0);
  encoding.writeVarUint(enc, 0);
  encoding.writeVarUint8Array(enc, Y.encodeStateVector(ydoc));
  const ss1B64 = Buffer.from(encoding.toUint8Array(enc)).toString("base64");
  
  // KEY CHANGE: NO encv2 parameter — force V1 everywhere
  const wsUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}?token=${jwt}&cid=${ydoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=noencv2&ratempt=0&widx=0&timezone=${encodeURIComponent("America/Denver")}&syncStep1=${encodeURIComponent(ss1B64)}`;
  
  return new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${HOST}`, cookie: COOKIE },
    });
    
    const tid = setTimeout(() => { console.log("TIMEOUT"); ws.close(); resolve(); }, 15000);
    let contentSent = false;
    
    ws.on("open", () => {
      console.log("Connected, clientID:", ydoc.clientID);
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
      
      console.log(`Sync ${subType === 0 ? "Step1" : subType === 1 ? "Step2" : "Update"}: ${payload.length}b`);
      
      if (subType === 0) {
        // All V1 now
        const update = Y.encodeStateAsUpdate(ydoc, payload);
        const resp: number[] = [0x00, 0x01];
        writeVarUint(resp, update.length);
        const respMsg = new Uint8Array(resp.length + update.length);
        respMsg.set(resp);
        respMsg.set(update, resp.length);
        ws.send(Buffer.from(respMsg));
        console.log(`  → SyncStep2 (V1, ${update.length}b)`);
      }
      
      if (subType === 1 && !contentSent) {
        contentSent = true;
        
        // Try V1 first (no encv2), then V2 fallback
        try { Y.applyUpdate(ydoc, payload); console.log("  Applied as V1"); }
        catch {
          try { Y.applyUpdateV2(ydoc, payload); console.log("  Applied as V2"); }
          catch (e) { console.log("  FAILED:", (e as Error).message); }
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
          for (const ch of "Hello without encv2!") {
            chars.push([ch]);
          }
          bm.set("characters", chars);
          
          blocksMap.set(blockId, bm);
          rootChildren.push([blockId]);
        });
        
        // V1 update
        const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
        const msg: number[] = [0x00, 0x02];
        writeVarUint(msg, diff.length);
        const updateMsg = new Uint8Array(msg.length + diff.length);
        updateMsg.set(msg);
        updateMsg.set(diff, msg.length);
        ws.send(Buffer.from(updateMsg));
        console.log(`Sent V1 update: ${diff.length}b`);
        console.log(`blocks: ${ydoc.getMap("blocks").size}, rootChildren: ${ydoc.getArray("rootChildren").length}`);
        
        setTimeout(async () => {
          const dumpRes = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
          const dumpBuf = new Uint8Array(await dumpRes.arrayBuffer());
          console.log(`\nDump: ${dumpBuf.length}b`);
          
          // Verify the dump contains our data
          if (dumpBuf.length > 10) {
            let len = 0, sh = 0, i = 1;
            let b;
            do { b = dumpBuf[i++]; len |= (b & 0x7f) << sh; sh += 7; } while (b & 0x80);
            const dumpData = dumpBuf.slice(i, i + len);
            const verifyDoc = new Y.Doc();
            try {
              Y.applyUpdate(verifyDoc, dumpData);
              console.log("Dump contains V1 data");
            } catch {
              try { Y.applyUpdateV2(verifyDoc, dumpData); console.log("Dump contains V2 data"); }
              catch { console.log("Dump decode failed"); }
            }
            
            console.log("Dump doc share keys:", Array.from((verifyDoc as any).share.keys()));
            console.log("blocks:", verifyDoc.getMap("blocks").size);
            console.log("rootChildren:", verifyDoc.getArray("rootChildren").length);
          }
          
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
