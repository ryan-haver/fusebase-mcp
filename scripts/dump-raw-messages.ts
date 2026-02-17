/**
 * Dump raw hex of ALL WebSocket messages from server. 
 * Also grab the y-protocols/sync source to understand expected format.
 * 
 * Run: npx tsx scripts/dump-raw-messages.ts > data/raw-msgs.txt 2>&1
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

async function getToken(pageId: string): Promise<string> {
  const res = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
    method: "POST", headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({ tokens: [] }),
  });
  return ((await res.json()) as any).token;
}

async function main() {
  // Use a page that HAS content (the browser-typed one)
  const pageId = "GQpaE49Ecnkx5LEF";
  console.log("Testing with page:", pageId);
  
  const jwt = await getToken(pageId);
  const ydoc = new Y.Doc();
  
  // Generate syncStep1 the same way we do in production
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, 0); // sync message type
  encoding.writeVarUint(enc, 0); // SyncStep1 sub-type  
  encoding.writeVarUint8Array(enc, Y.encodeStateVector(ydoc));
  const ss1Msg = encoding.toUint8Array(enc);
  console.log("Our syncStep1 msg:", Buffer.from(ss1Msg).toString("hex"), `(${ss1Msg.length}b)`);
  
  // Also generate using y-protocols
  const enc2 = encoding.createEncoder();
  syncProtocol.writeSyncStep1(enc2, ydoc);
  const ss1Proto = encoding.toUint8Array(enc2);
  console.log("y-protocols syncStep1:", Buffer.from(ss1Proto).toString("hex"), `(${ss1Proto.length}b)`);
  
  // Note: y-protocols writeSyncStep1 does NOT include the outer message type byte (0x00)
  // It only writes: [syncStep1Type=0, stateVector]
  // So the full message should be: [0x00, 0x00, ...stateVector]
  
  const ss1B64 = Buffer.from(ss1Msg).toString("base64");
  
  const wsUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}?token=${jwt}&cid=${ydoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=rawdump&ratempt=0&widx=0&encv2=true&timezone=${encodeURIComponent("America/Denver")}&syncStep1=${encodeURIComponent(ss1B64)}`;
  
  let msgCount = 0;
  
  return new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${HOST}`, cookie: COOKIE },
    });
    
    const tid = setTimeout(() => { console.log("TIMEOUT"); ws.close(); resolve(); }, 10000);
    
    ws.on("open", () => {
      console.log("\nConnected");
    });
    
    ws.on("message", (raw: Buffer) => {
      const data = new Uint8Array(raw);
      msgCount++;
      const hex = Buffer.from(data.slice(0, Math.min(200, data.length))).toString("hex");
      
      console.log(`\nMSG #${msgCount}: ${data.length}b type=0x${data[0]?.toString(16)}`);
      console.log(`  hex: ${hex}${data.length > 200 ? "..." : ""}`);
      console.log(`  bytes: [${Array.from(data.slice(0, Math.min(40, data.length))).join(", ")}]${data.length > 40 ? "..." : ""}`);
      
      if (data[0] === 0x11) {
        ws.send(Buffer.from(new Uint8Array([0x12])));
        console.log("  → Pong");
        return;
      }
      
      if (data[0] === 0x00) {
        // Try to parse sync sub-type
        let idx = 1;
        let subType = 0, shift = 0, byte;
        do { byte = data[idx++]; subType |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
        console.log(`  Sync sub-type: ${subType} (${subType === 0 ? "Step1" : subType === 1 ? "Step2" : "Update"})`);
        
        // Parse the payload
        let payloadLen = 0;
        shift = 0;
        do { byte = data[idx++]; payloadLen |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
        const payload = data.slice(idx, idx + payloadLen);
        console.log(`  Payload: ${payloadLen}b from offset ${idx}`);
        console.log(`  Payload hex: ${Buffer.from(payload.slice(0, Math.min(80, payload.length))).toString("hex")}${payload.length > 80 ? "..." : ""}`);
        
        if (subType === 0) {
          // SyncStep1 — server sending its state vector
          console.log("  State vector length:", payloadLen);
          
          // Respond with SyncStep2
          const update = Y.encodeStateAsUpdate(ydoc, payload);
          console.log("  Our SyncStep2 update:", update.length, "bytes");
          
          const resp: number[] = [0x00, 0x01];
          writeVarUint(resp, update.length);
          const respMsg = new Uint8Array(resp.length + update.length);
          respMsg.set(resp);
          respMsg.set(update, resp.length);
          ws.send(Buffer.from(respMsg));
          console.log("  → Sent SyncStep2");
        }
        
        if (subType === 1) {
          // SyncStep2 — contains our content
          console.log("  Applying SyncStep2 data...");
          try {
            Y.applyUpdateV2(ydoc, payload);
            console.log("  Applied as V2");
          } catch {
            try {
              Y.applyUpdate(ydoc, payload);
              console.log("  Applied as V1");
            } catch (e2) {
              console.log("  FAILED:", (e2 as Error).message);
            }
          }
          
          // Check what's in the doc now
          console.log("  doc.share keys:", Array.from((ydoc as any).share.keys()));
          const blocks = ydoc.getMap("blocks");
          const rc = ydoc.getArray("rootChildren");
          console.log(`  blocks: ${blocks.size}, rootChildren: ${rc.length}`);
          
          setTimeout(() => {
            clearTimeout(tid);
            ws.close();
            resolve();
          }, 2000);
        }
      }
    });
    
    ws.on("error", (e) => { console.log("Error:", e.message); });
    ws.on("close", () => { console.log("\nClosed"); });
  });
}

main().catch(console.error);
