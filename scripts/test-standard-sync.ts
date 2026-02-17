/**
 * Test using STANDARD y-protocols/sync for message handling.
 * 
 * Instead of our custom encodeSyncMessage, use the official y-protocols
 * library to handle the sync protocol correctly.
 * 
 * Run: npx tsx scripts/test-standard-sync.ts > data/standard-sync.txt 2>&1
 */
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
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
  const pageId = await createPage("StdSync Test " + new Date().toISOString());
  console.log("Page:", pageId);
  console.log("URL:", `https://${HOST}/ws/${WS_ID}/note/${pageId}`);
  
  const jwt = await getToken(pageId);
  const ydoc = new Y.Doc();
  
  // Build the URL syncStep1 using standard y-protocols
  const urlEncoder = encoding.createEncoder();
  syncProtocol.writeSyncStep1(urlEncoder, ydoc);
  const ss1Bytes = encoding.toUint8Array(urlEncoder);
  const ss1B64 = Buffer.from(ss1Bytes).toString("base64");
  
  const wsUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}?token=${jwt}&cid=${ydoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=stdsync&ratempt=0&widx=0&encv2=true&timezone=${encodeURIComponent("America/Denver")}&syncStep1=${encodeURIComponent(ss1B64)}`;
  
  return new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${HOST}`, cookie: COOKIE },
    });
    
    const tid = setTimeout(() => { console.log("TIMEOUT"); ws.close(); resolve(); }, 20000);
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
      console.log("Sent awareness");
    });
    
    ws.on("message", (raw: Buffer) => {
      const data = new Uint8Array(raw);
      if (data.length === 0) return;
      
      const msgType = data[0];
      
      // Ping → Pong
      if (msgType === 0x11) { ws.send(Buffer.from(new Uint8Array([0x12]))); return; }
      if (msgType === 0x12 || msgType === 0x01) return; // pong, awareness
      
      if (msgType !== 0x00) {
        console.log(`Unknown msg type: 0x${msgType.toString(16)} (${data.length}b)`);
        return;
      }
      
      // Sync message — use standard y-protocols to handle it
      const decoder = decoding.createDecoder(data);
      const messageType = decoding.readVarUint(decoder); // should be 0
      
      // Try to read with standard sync protocol
      // readSyncMessage returns messageYjsSyncStep1=0, messageYjsSyncStep2=1, messageYjsUpdate=2
      const syncType = decoding.readVarUint(decoder);
      console.log(`\nSync message: type=${syncType} (${syncType === 0 ? "Step1" : syncType === 1 ? "Step2" : "Update"}) raw=${data.length}b`);
      
      if (syncType === 0) {
        // SyncStep1 from server: server wants our state
        // Re-create decoder, use standard protocol to generate response
        const dec2 = decoding.createDecoder(data);
        decoding.readVarUint(dec2); // skip message type (0)
        
        const respEncoder = encoding.createEncoder();
        encoding.writeVarUint(respEncoder, 0); // sync message type prefix
        syncProtocol.readSyncStep1(dec2, respEncoder, ydoc);
        const resp = encoding.toUint8Array(respEncoder);
        ws.send(Buffer.from(resp));
        console.log(`  → Sent SyncStep2 response (${resp.length}b) via y-protocols`);
      }
      
      else if (syncType === 1) {
        // SyncStep2 from server: contains document state
        // The data after syncType is the update data
        
        // Read using y-protocols
        // readSyncStep2 reads the update and applies it
        const dec2 = decoding.createDecoder(data);
        decoding.readVarUint(dec2); // skip message type (0)
        
        try {
          syncProtocol.readSyncStep2(dec2, ydoc, "server");
          console.log("  Applied server state via y-protocols (V2 first?)");
        } catch (e) {
          console.log(`  y-protocols readSyncStep2 failed: ${(e as Error).message}`);
          // Manual fallback: read the update data and try V1
          const dec3 = decoding.createDecoder(data);
          decoding.readVarUint(dec3); // skip 0
          decoding.readVarUint(dec3); // skip 1
          const updateData = decoding.readVarUint8Array(dec3);
          console.log(`  Update data: ${updateData.length}b`);
          try {
            Y.applyUpdate(ydoc, updateData);
            console.log("  Applied as V1");
          } catch (e2) {
            console.log(`  V1 also failed: ${(e2 as Error).message}`);
          }
        }
        
        // Now write content if not already sent
        if (!contentSent) {
          contentSent = true;
          
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
            for (const ch of "Hello from standard sync!") {
              chars.push([ch]);
            }
            bm.set("characters", chars);
            
            blocksMap.set(blockId, bm);
            rootChildren.push([blockId]);
          });
          
          // Send as Y.UPDATE using standard encoding
          const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
          const updateEncoder = encoding.createEncoder();
          encoding.writeVarUint(updateEncoder, 0); // sync message
          syncProtocol.writeUpdate(updateEncoder, diff);
          const updateMsg = encoding.toUint8Array(updateEncoder);
          ws.send(Buffer.from(updateMsg));
          console.log(`\n  Sent content update (${updateMsg.length}b) via y-protocols`);
          
          // Verify
          const blocks = ydoc.getMap("blocks");
          const rc = ydoc.getArray("rootChildren");
          console.log(`  blocks: ${blocks.size}, rootChildren: ${rc.length}`);
          console.log(`  rootChildren: ${JSON.stringify(rc.toJSON())}`);
          
          // Also check dump after a delay
          setTimeout(async () => {
            try {
              const dumpRes = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
              const dumpBuf = new Uint8Array(await dumpRes.arrayBuffer());
              console.log(`\n  Dump after write: ${dumpBuf.length}b`);
            } catch {}
            
            clearTimeout(tid);
            ws.close();
            console.log("Done");
            resolve();
          }, 5000);
        }
      }
      
      else if (syncType === 2) {
        // Update from server (echo or other client)
        const dec2 = decoding.createDecoder(data);
        decoding.readVarUint(dec2); // skip 0
        try {
          syncProtocol.readUpdate(dec2, ydoc, "server");
          console.log("  Applied server update via y-protocols");
        } catch {
          // Manual V1 fallback
          const dec3 = decoding.createDecoder(data);
          decoding.readVarUint(dec3);
          decoding.readVarUint(dec3);
          const updateData = decoding.readVarUint8Array(dec3);
          try {
            Y.applyUpdate(ydoc, updateData);
            console.log("  Applied server update as V1");
          } catch {}
        }
      }
    });
    
    ws.on("error", (e) => { console.log("Error:", e.message); });
    ws.on("close", () => { console.log("Closed"); });
  });
}

main().catch(console.error);
