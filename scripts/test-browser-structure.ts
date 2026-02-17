/**
 * Test with EXACT browser block structure:
 * Browser blocks have: id, type, indent, color, align, characters
 * (NOT: number, selectorId, capsule, contentId, mode, parent)
 * 
 * Also includes: root, children, blocks, rootChildren shared types
 *
 * Run: npx tsx scripts/test-browser-structure.ts > data/browser-structure.txt 2>&1
 */
import * as Y from "yjs";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import WebSocket from "ws";
import { loadEncryptedCookie } from "../src/crypto.js";

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
const stored = loadEncryptedCookie();
const COOKIE = stored?.cookie || process.env.FUSEBASE_COOKIE!;

function writeVarUint(n: number): number[] {
  const b: number[] = [];
  while (n > 0x7f) { b.push(0x80 | (n & 0x7f)); n >>>= 7; }
  b.push(n & 0x7f);
  return b;
}

async function main() {
  // Create page
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const noteId = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const createRes = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WS_ID, noteId,
      note: { textVersion: 2, title: `Browser Structure Test ${Date.now()}`, parentId: "default", is_portal_share: false },
    }),
  });
  const created = (await createRes.json()) as any;
  const pageId = created.globalId || noteId;
  console.log("Page:", pageId);
  console.log("URL:", `https://${HOST}/ws/${WS_ID}/note/${pageId}`);

  // Get token
  const tokenRes = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
    method: "POST", headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({ tokens: [] }),
  });
  const jwt = ((await tokenRes.json()) as any).token;

  // Build the Y.Doc with EXACT browser structure
  const ydoc = new Y.Doc();

  // SyncStep1 for URL
  const sv = Y.encodeStateVector(ydoc);
  const svLen = writeVarUint(sv.length);
  const s1 = new Uint8Array(2 + svLen.length + sv.length);
  s1[0] = 0; s1[1] = 0; s1.set(svLen, 2); s1.set(sv, 2 + svLen.length);
  const s1B64 = Buffer.from(s1).toString("base64");
  const tz = encodeURIComponent("America/Denver");

  // No encv2
  const wsUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}?token=${jwt}&cid=${ydoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=bs${Date.now()}&ratempt=0&widx=0&timezone=${tz}&syncStep1=${encodeURIComponent(s1B64)}`;

  await new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${HOST}`, cookie: COOKIE },
    });
    const tid = setTimeout(() => { console.log("TIMEOUT"); ws.close(); resolve(); }, 15000);
    let sent = false;

    ws.on("open", () => {
      console.log("Connected, clientID:", ydoc.clientID);
      // Send awareness
      const aw: number[] = [0x01];
      const payload: number[] = [];
      writeVarUint(1).forEach(b => payload.push(b));
      writeVarUint(ydoc.clientID).forEach(b => payload.push(b));
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

      let idx = 1;
      let subType = 0, shift = 0, byte;
      do { byte = data[idx++]; subType |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
      let payloadLen = 0; shift = 0;
      do { byte = data[idx++]; payloadLen |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
      const payload = data.slice(idx, idx + payloadLen);

      if (subType === 0) {
        console.log(`SyncStep1: sv=${payload.length}b`);
        const upd = Y.encodeStateAsUpdate(ydoc, payload);
        const resp: number[] = [0x00, 0x01];
        writeVarUint(upd.length).forEach(b => resp.push(b));
        const rm = new Uint8Array(resp.length + upd.length);
        rm.set(resp); rm.set(upd, resp.length);
        ws.send(Buffer.from(rm));
      }

      if (subType === 1 && !sent) {
        sent = true;
        console.log(`SyncStep2: ${payload.length}b`);
        try { Y.applyUpdate(ydoc, payload); } catch {
          try { Y.applyUpdateV2(ydoc, payload); } catch {}
        }

        const beforeSv = Y.encodeStateVector(ydoc);

        ydoc.transact(() => {
          // BROWSER STRUCTURE: root, children, blocks, rootChildren
          const root = ydoc.getMap("root");
          const children = root.get("children") as Y.Array<string> || new Y.Array<string>();
          if (!root.has("children")) root.set("children", children);

          const blocksMap = ydoc.getMap("blocks");
          const rootChildren = ydoc.getArray<string>("rootChildren");

          const blockId = `b${ydoc.clientID}_1`;

          // EXACT browser block fields: id, type, indent, color, align, characters
          const bm = new Y.Map();
          bm.set("id", blockId);
          bm.set("type", "paragraph");
          bm.set("indent", 0);
          bm.set("color", "transparent");
          bm.set("align", "left");

          // Characters as Y.Array
          const charArr = new Y.Array();
          for (const ch of "Hello from browser-matched structure!") {
            charArr.push([ch]);
          }
          bm.set("characters", charArr);

          blocksMap.set(blockId, bm);
          rootChildren.push([blockId]);
          children.push([blockId]);
        });

        const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
        const msg: number[] = [0x00, 0x02];
        writeVarUint(diff.length).forEach(b => msg.push(b));
        const um = new Uint8Array(msg.length + diff.length);
        um.set(msg); um.set(diff, msg.length);
        ws.send(Buffer.from(um));
        console.log(`Sent V1 update: ${diff.length}b`);
        
        // Verify
        console.log(`blocks: ${ydoc.getMap("blocks").size}, rootChildren: ${ydoc.getArray("rootChildren").length}`);
        console.log(`root.children: ${(ydoc.getMap("root").get("children") as Y.Array<string>)?.length}`);

        setTimeout(async () => {
          const dr = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
          const db = new Uint8Array(await dr.arrayBuffer());
          console.log(`\nDump: ${db.length}b`);
          
          // Parse readable
          const strs: string[] = [];
          let cur = "";
          for (let i = 0; i < Math.min(db.length, 500); i++) {
            const b = db[i];
            if (b >= 0x20 && b < 0x7f) cur += String.fromCharCode(b);
            else { if (cur.length >= 2) strs.push(cur); cur = ""; }
          }
          if (cur.length >= 2) strs.push(cur);
          console.log("Strings:", strs.join(", "));

          clearTimeout(tid);
          ws.close();
          resolve();
        }, 4000);
      }

      if (subType === 2) {
        try { Y.applyUpdate(ydoc, payload); } catch {
          try { Y.applyUpdateV2(ydoc, payload); } catch {}
        }
      }
    });

    ws.on("error", (e) => console.log("Error:", e.message));
    ws.on("close", () => console.log("Closed"));
  });
}

main().catch(console.error);
