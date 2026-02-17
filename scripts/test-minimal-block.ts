/**
 * Minimal test: write ONE simple block with plain text to see if it renders.
 * Uses top-level shared types, no formatting, no children array.
 * 
 * Run: npx tsx scripts/test-minimal-block.ts > data/minimal-output.txt 2>&1
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

function readVarUint(data: Uint8Array, offset: number): [number, number] {
  let result = 0, shift = 0, byte: number;
  do { byte = data[offset++]; result |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
  return [result, offset];
}

function encodeSyncMessage(subType: number, data: Uint8Array): Uint8Array {
  const header: number[] = [0x00, subType];
  writeVarUint(header, data.length);
  const msg = new Uint8Array(header.length + data.length);
  msg.set(header);
  msg.set(data, header.length);
  return msg;
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
  const pageId = await createPage("Minimal Block Test " + new Date().toISOString());
  console.log("Page:", pageId);
  console.log("URL:", `https://${HOST}/ws/${WS_ID}/note/${pageId}`);
  
  const jwt = await getToken(pageId);
  const ydoc = new Y.Doc();
  
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0);
  encoding.writeVarUint(encoder, 0);
  encoding.writeVarUint8Array(encoder, Y.encodeStateVector(ydoc));
  const ss1 = Buffer.from(encoding.toUint8Array(encoder)).toString("base64");
  
  const wsUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}?token=${jwt}&cid=${ydoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=min1234&ratempt=0&widx=0&encv2=true&timezone=${encodeURIComponent("America/Denver")}&syncStep1=${encodeURIComponent(ss1)}`;
  
  return new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${HOST}`, cookie: COOKIE },
    });
    
    const tid = setTimeout(() => { console.log("TIMEOUT"); ws.close(); resolve(); }, 15000);
    
    ws.on("open", () => {
      console.log("Connected");
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
      
      const msgType = data[0];
      if (msgType === 0x11) { ws.send(Buffer.from(new Uint8Array([0x12]))); return; }
      if (msgType !== 0x00) return;
      
      const [subType, subOff] = readVarUint(data, 1);
      
      if (subType === 0) {
        // SyncStep1 from server
        const [svLen, svStart] = readVarUint(data, subOff);
        const serverSv = data.slice(svStart, svStart + svLen);
        const update = Y.encodeStateAsUpdate(ydoc, serverSv);
        ws.send(Buffer.from(encodeSyncMessage(0x01, update)));
        console.log("Sent SyncStep2 response");
      }
      
      if (subType === 1) {
        // SyncStep2 from server - apply it
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);
        try { Y.applyUpdateV2(ydoc, updateData); } catch {
          try { Y.applyUpdate(ydoc, updateData); } catch {}
        }
        console.log("Applied server state");
        
        // Now write a MINIMAL block matching EXACTLY what the browser creates
        const beforeSv = Y.encodeStateVector(ydoc);
        
        ydoc.transact(() => {
          // Use ONLY top-level shared types, exactly matching browser
          const blocksMap = ydoc.getMap("blocks");
          const rootChildren = ydoc.getArray<string>("rootChildren");
          
          // Create ONE simple block with plain text
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
          
          // Characters: just plain text, each char as a separate string item
          const chars = new Y.Array();
          for (const ch of "Hello from programmatic writer!") {
            chars.push([ch]);
          }
          bm.set("characters", chars);
          
          blocksMap.set(blockId, bm);
          rootChildren.push([blockId]);
        });
        
        const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
        ws.send(Buffer.from(encodeSyncMessage(0x02, diff)));
        console.log("Sent content update:", diff.length, "bytes");
        
        // Verify what we wrote
        const blocks = ydoc.getMap("blocks");
        const rc = ydoc.getArray("rootChildren");
        console.log(`blocks: ${blocks.size} entries, rootChildren: ${rc.length} items`);
        console.log("rootChildren:", rc.toJSON());
        for (const [k, v] of blocks.entries()) {
          if (v instanceof Y.Map) {
            console.log(`  block "${k}": type=${v.get("type")}, chars=${(v.get("characters") as Y.Array<unknown>)?.length}`);
          }
        }
        
        setTimeout(() => {
          clearTimeout(tid);
          ws.close();
          console.log("Done");
          resolve();
        }, 3000);
      }
    });
    
    ws.on("error", (e) => { console.log("Error:", e.message); });
    ws.on("close", () => { console.log("Closed"); });
  });
}

main().catch(console.error);
