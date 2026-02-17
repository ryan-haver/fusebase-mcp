/**
 * Fetch dump of a FRESH page (just created, no content written)
 * to see the server's initial Y.Doc structure.
 * 
 * Run: npx tsx scripts/fresh-page-dump.ts > data/fresh-dump.txt 2>&1
 */
import * as Y from "yjs";
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

async function main() {
  // 1. Create a fresh page
  const pageId = await createPage("Fresh Page " + Date.now());
  console.log("Created fresh page:", pageId);
  
  // 2. Fetch the dump immediately (before any WebSocket connection)
  const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, {
    headers: { cookie: COOKIE },
  });
  const buf = new Uint8Array(await res.arrayBuffer());
  console.log("Dump size:", buf.length, "bytes");
  console.log("First 30 bytes:", Array.from(buf.slice(0, 30)));
  console.log("Hex:", Buffer.from(buf.slice(0, 30)).toString("hex"));
  
  if (buf.length <= 4) {
    console.log("\nDump is too small (likely empty/initial).");
    console.log("Raw bytes:", Array.from(buf));
    return;
  }
  
  // 3. Try to decode
  // Parse varuint
  let len = 0, shift = 0, idx = 1;
  let byte: number;
  do {
    byte = buf[idx++];
    len |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  
  console.log(`\nFormat: version=${buf[0]}, updateLen=${len}, dataOffset=${idx}`);
  
  const data = buf.slice(idx, idx + len);
  const doc = new Y.Doc();
  
  try {
    Y.applyUpdate(doc, data);
    console.log("V1 decode SUCCESS");
  } catch {
    try {
      Y.applyUpdateV2(doc, data);
      console.log("V2 decode SUCCESS");
    } catch(e) {
      console.log("Decode failed:", (e as Error).message);
      return;
    }
  }
  
  // 4. Inspect the initial state
  const root = doc.getMap("root");
  const keys = Array.from(root.keys()).sort();
  console.log("\nRoot keys:", keys);
  
  for (const k of keys) {
    const v = root.get(k);
    if (v instanceof Y.Array) {
      console.log(`  "${k}" → Y.Array (len=${v.length}) = ${JSON.stringify(v.toJSON())}`);
    } else if (v instanceof Y.Map) {
      const mapKeys = Array.from(v.keys());
      console.log(`  "${k}" → Y.Map (${mapKeys.length} entries)`);
      for (const mk of mapKeys) {
        const mv = v.get(mk);
        if (mv instanceof Y.Map) {
          const bkeys = Array.from(mv.keys()).sort();
          console.log(`    "${mk}" → Y.Map { ${bkeys.join(", ")} }`);
          for (const bk of bkeys) {
            const bv = mv.get(bk);
            if (bv instanceof Y.Array) {
              console.log(`      ${bk}: Y.Array[${bv.length}]`);
            } else {
              console.log(`      ${bk}: ${typeof bv} = ${JSON.stringify(bv)}`);
            }
          }
        }
      }
    } else {
      console.log(`  "${k}" → ${typeof v} = ${JSON.stringify(v)}`);
    }
  }
  
  // 5. Check state vector
  const sv = Y.encodeStateVector(doc);
  console.log("\nState vector length:", sv.length, "bytes");
  console.log("State vector:", Array.from(sv));
  
  // 6. Now also connect via WebSocket, do the sync, and see what the server sends
  console.log("\n--- Connecting via WebSocket to see server sync ---");
  
  const tokenRes = await fetch(
    `https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`,
    { method: "POST", headers: { cookie: COOKIE, "content-type": "application/json" }, body: JSON.stringify({ tokens: [] }) }
  );
  const jwt = ((await tokenRes.json()) as any).token;
  
  const wsDoc = new Y.Doc();
  const sv1 = Y.encodeStateVector(wsDoc);
  
  const { WebSocket } = await import("ws");
  const wsUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}?token=${jwt}&cid=${wsDoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=test123&ratempt=0&widx=0&encv2=true&timezone=${encodeURIComponent("America/Denver")}&syncStep1=${encodeURIComponent(Buffer.from(Y.encodeStateVector(wsDoc)).toString("base64"))}`;
  
  const ws = new WebSocket(wsUrl, {
    headers: { origin: `https://${HOST}`, cookie: COOKIE },
  });
  
  const timeout = setTimeout(() => {
    console.log("\nTimeout - closing");
    ws.close();
    process.exit(0);
  }, 10000);
  
  ws.on("open", () => {
    console.log("WebSocket connected");
  });
  
  ws.on("message", (raw: Buffer) => {
    const d = new Uint8Array(raw);
    if (d.length === 0) return;
    
    const msgType = d[0];
    console.log(`\nReceived ${d.length}b: type=0x${msgType.toString(16)}`);
    
    if (msgType === 0x00) {
      // Sync message
      let subOff = 1;
      let subType = 0, sz = 0;
      let b = d[subOff++];
      subType = b & 0x7f;
      while (b & 0x80) { b = d[subOff++]; subType |= (b & 0x7f) << sz; sz += 7; }
      
      console.log(`  Sync sub-type: ${subType} (${subType === 0 ? "SyncStep1" : subType === 1 ? "SyncStep2" : "Update"})`);
      console.log(`  Data (after subtype): ${d.length - subOff} bytes remaining`);
      console.log(`  First 20 bytes of payload: [${Array.from(d.slice(subOff, subOff + 20))}]`);
      
      if (subType === 1) {
        // SyncStep2 from server - this is the full document
        // Try to parse the length-prefixed update data
        let uLen = 0, uShift = 0, uIdx = subOff;
        let uByte: number;
        do {
          uByte = d[uIdx++];
          uLen |= (uByte & 0x7f) << uShift;
          uShift += 7;
        } while (uByte & 0x80);
        
        console.log(`  Update length: ${uLen}, starts at offset ${uIdx}`);
        const updateData = d.slice(uIdx, uIdx + uLen);
        
        if (updateData.length > 0) {
          // Try to decode
          const tempDoc = new Y.Doc();
          try {
            Y.applyUpdate(tempDoc, updateData);
            console.log("  V1 decode of SyncStep2 payload: SUCCESS");
            const r = tempDoc.getMap("root");
            console.log("  Root keys:", Array.from(r.keys()));
          } catch (e) {
            console.log("  V1 decode failed:", (e as Error).message.slice(0, 60));
          }
          try {
            const tempDoc2 = new Y.Doc();
            Y.applyUpdateV2(tempDoc2, updateData);
            console.log("  V2 decode of SyncStep2 payload: SUCCESS");
            const r = tempDoc2.getMap("root");
            console.log("  Root keys:", Array.from(r.keys()));
          } catch (e) {
            console.log("  V2 decode failed:", (e as Error).message.slice(0, 60));
          }
        }
        
        // Close after getting SyncStep2
        clearTimeout(timeout);
        setTimeout(() => { ws.close(); process.exit(0); }, 1000);
      }
    } else if (msgType === 0x01) {
      console.log("  (awareness message)");
    } else if (msgType === 0x11) {
      console.log("  (ping)");
      ws.send(Buffer.from(new Uint8Array([0x12])));
    }
  });
  
  ws.on("close", () => console.log("WebSocket closed"));
  ws.on("error", (e) => console.log("WebSocket error:", e.message));
}

main().catch(console.error);
