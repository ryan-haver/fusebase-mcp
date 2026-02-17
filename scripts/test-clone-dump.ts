/**
 * Clone a known working browser-created page by:
 * 1. Downloading the /dump of a working page
 * 2. Creating a new page
 * 3. Connecting via WebSocket and sending the dump as a V1 update
 * 
 * If this renders, the issue is in how we BUILD Y.js content.
 * If this fails too, the issue is in our WebSocket protocol.
 *
 * Run: npx tsx scripts/test-clone-dump.ts > data/clone-dump.txt 2>&1
 */
import * as Y from "yjs";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import WebSocket from "ws";

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

// Known browser-created page with valid content
const SOURCE_PAGE = "1tZiv20EWydrHyaB";

function writeVarUint(n: number): number[] {
  const b: number[] = [];
  while (n > 0x7f) { b.push(0x80 | (n & 0x7f)); n >>>= 7; }
  b.push(n & 0x7f);
  return b;
}

async function main() {
  console.log("=== CLONE DUMP TEST ===\n");

  // 1. Download the working page's dump
  console.log(`1. Downloading dump of ${SOURCE_PAGE}...`);
  const dumpRes = await fetch(`https://${HOST}/dump/${WS_ID}/${SOURCE_PAGE}`, {
    headers: { cookie: COOKIE },
  });
  const dumpBuf = new Uint8Array(await dumpRes.arrayBuffer());
  console.log(`   Dump size: ${dumpBuf.length} bytes`);

  // Parse the dump into a Y.Doc to inspect
  const srcDoc = new Y.Doc();
  try {
    Y.applyUpdate(srcDoc, dumpBuf);
    console.log("   Parsed as V1");
  } catch {
    try {
      Y.applyUpdateV2(srcDoc, dumpBuf);
      console.log("   Parsed as V2");
    } catch (e) {
      console.log(`   FAILED to parse dump: ${(e as Error).message}`);
      return;
    }
  }
  
  console.log(`   Share keys: ${JSON.stringify(Array.from(srcDoc.share.keys()))}`);
  const blocks = srcDoc.getMap("blocks");
  const rootChildren = srcDoc.getArray("rootChildren");
  console.log(`   blocks: ${blocks.size}, rootChildren: ${rootChildren.length}`);

  // 2. Create a new page
  console.log("\n2. Creating new page...");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const noteId = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const createRes = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WS_ID, noteId,
      note: { textVersion: 2, title: `Clone Test ${Date.now()}`, parentId: "default", is_portal_share: false },
    }),
  });
  const created = (await createRes.json()) as any;
  const newPageId = created.globalId || noteId;
  console.log(`   Page: ${newPageId}`);
  console.log(`   URL: https://${HOST}/ws/${WS_ID}/note/${newPageId}`);

  // 3. Get WebSocket token
  const tokenRes = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${newPageId}/tokens`, {
    method: "POST", headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({ tokens: [] }),
  });
  const jwt = ((await tokenRes.json()) as any).token;

  // 4. Connect and send the EXACT browser dump as update
  console.log("\n3. Connecting WS and sending cloned data...");

  const localDoc = new Y.Doc();
  const sv = Y.encodeStateVector(localDoc);
  const svLen = writeVarUint(sv.length);
  const s1 = new Uint8Array(2 + svLen.length + sv.length);
  s1[0] = 0; s1[1] = 0; s1.set(svLen, 2); s1.set(sv, 2 + svLen.length);
  const s1B64 = Buffer.from(s1).toString("base64");
  const tz = encodeURIComponent("America/Denver");

  // No encv2
  const wsUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${newPageId}?token=${jwt}&cid=${localDoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=clone${Date.now()}&ratempt=0&widx=0&timezone=${tz}&syncStep1=${encodeURIComponent(s1B64)}`;

  await new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${HOST}`, cookie: COOKIE },
    });
    const tid = setTimeout(() => { console.log("TIMEOUT"); ws.close(); resolve(); }, 15000);
    let sent = false;

    ws.on("open", () => {
      console.log("   Connected");
      // Send awareness
      const aw: number[] = [0x01];
      const payload: number[] = [];
      writeVarUint(1).forEach(b => payload.push(b));
      writeVarUint(localDoc.clientID).forEach(b => payload.push(b));
      writeVarUint(0).forEach(b => payload.push(b));
      const stateBytes = new TextEncoder().encode("{}");
      writeVarUint(stateBytes.length).forEach(b => payload.push(b));
      payload.push(...stateBytes);
      writeVarUint(payload.length).forEach(b => aw.push(b));
      aw.push(...payload);
      ws.send(Buffer.from(new Uint8Array(aw)));
    });

    ws.on("message", async (raw: Buffer) => {
      const data = new Uint8Array(raw);
      if (data.length === 0) return;
      if (data[0] === 0x11) { ws.send(Buffer.from(new Uint8Array([0x12]))); return; }
      if (data[0] === 0x01) return;
      if (data[0] !== 0x00) return;

      // Decode sync message
      let idx = 1;
      let subType = 0, shift = 0, byte;
      do { byte = data[idx++]; subType |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
      let payloadLen = 0; shift = 0;
      do { byte = data[idx++]; payloadLen |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
      const payload = data.slice(idx, idx + payloadLen);

      if (subType === 0) {
        console.log(`   SyncStep1: sv=${payload.length}b`);
        // Send SyncStep2 with empty update for our empty doc
        const upd = Y.encodeStateAsUpdate(localDoc, payload);
        const resp: number[] = [0x00, 0x01];
        writeVarUint(upd.length).forEach(b => resp.push(b));
        const rm = new Uint8Array(resp.length + upd.length);
        rm.set(resp); rm.set(upd, resp.length);
        ws.send(Buffer.from(rm));
      }

      if (subType === 1 && !sent) {
        sent = true;
        console.log(`   SyncStep2: ${payload.length}b`);
        try { Y.applyUpdate(localDoc, payload); } catch {
          try { Y.applyUpdateV2(localDoc, payload); } catch {}
        }

        // NOW send the browser dump as a V1 update
        // The dumpBuf IS a V1 update — just wrap in sync update message
        const msg: number[] = [0x00, 0x02]; // sync, update
        writeVarUint(dumpBuf.length).forEach(b => msg.push(b));
        const updateMsg = new Uint8Array(msg.length + dumpBuf.length);
        updateMsg.set(msg);
        updateMsg.set(dumpBuf, msg.length);
        ws.send(Buffer.from(updateMsg));
        console.log(`   Sent browser dump as V1 update: ${dumpBuf.length}b`);

        // Verify
        setTimeout(async () => {
          const dr = await fetch(`https://${HOST}/dump/${WS_ID}/${newPageId}`, { headers: { cookie: COOKIE } });
          const db = new Uint8Array(await dr.arrayBuffer());
          console.log(`\n4. Dump check: ${db.length}b`);
          
          // Parse to verify content
          const vDoc = new Y.Doc();
          try { Y.applyUpdate(vDoc, db); } catch { try { Y.applyUpdateV2(vDoc, db); } catch {} }
          console.log(`   Share keys: ${JSON.stringify(Array.from(vDoc.share.keys()))}`);
          console.log(`   blocks: ${vDoc.getMap("blocks").size}`);
          console.log(`   rootChildren: ${vDoc.getArray("rootChildren").length}`);

          clearTimeout(tid);
          ws.close();
          resolve();
        }, 4000);
      }
    });

    ws.on("error", (e) => console.log(`   Error: ${e.message}`));
    ws.on("close", () => console.log("   Closed"));
  });
}

main().catch(console.error);
