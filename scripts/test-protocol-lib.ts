/**
 * Test with standard y-protocols library AND correct syncStep1 URL format.
 * 
 * Key fixes being tested:
 * 1. SyncStep1 URL param: use standard y-protocols format WITHOUT outer sync type byte
 * 2. Awareness: use y-protocols/awareness with proper [type, payload] wrapping
 * 3. Use standard y-protocols for sync messages where possible
 * 4. Test BOTH V1 (standard) and V2 encoding in the updates
 *
 * Run: npx tsx scripts/test-protocol-lib.ts
 */

import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
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

function randomAlpha(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function readVarUint(data: Uint8Array, offset: number): [number, number] {
  let result = 0, shift = 0, byte: number;
  do { byte = data[offset++]; result |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
  return [result, offset];
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

async function createPage(title: string): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const noteId = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const body = {
    workspaceId: WS_ID, noteId,
    note: { textVersion: 2, title, parentId: "default", is_portal_share: false },
  };
  const res = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Create failed: ${res.status} - ${errText}`);
  }
  return ((await res.json()) as any).globalId || noteId;
}

async function checkDump(pageId: string): Promise<{size: number, hasHello: boolean}> {
  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
  const binary = new Uint8Array(await res.arrayBuffer());
  const text = Buffer.from(binary).toString("utf-8", 0, Math.min(2000, binary.length));
  return { size: binary.length, hasHello: text.includes("Hello") };
}

// Test a specific encoding strategy
async function testStrategy(name: string, opts: {
  useEncv2: boolean,
  useV2ForSync: boolean,
  useV2ForUpdate: boolean,
  syncStep1HasOuterType: boolean,
  preCreateContent: boolean,
}): Promise<void> {
  console.log(`\n========================================`);
  console.log(`Strategy: ${name}`);
  console.log(`  encv2=${opts.useEncv2}, V2sync=${opts.useV2ForSync}, V2update=${opts.useV2ForUpdate}`);
  console.log(`  syncStep1HasOuterType=${opts.syncStep1HasOuterType}, preCreate=${opts.preCreateContent}`);
  console.log(`========================================\n`);

  const pageId = await createPage(`${name} - ${Date.now()}`);
  console.log(`Page: ${pageId}`);

  const ydoc = new Y.Doc();
  
  // Optionally pre-create an initial paragraph (like browser does)
  if (opts.preCreateContent) {
    ydoc.transact(() => {
      const root = ydoc.getMap("root");
      const children = new Y.Array<string>();
      const rootChildren = new Y.Array<string>();
      const blocksMap = new Y.Map();
      const bId = `b${Date.now()}_init`;
      const bm = new Y.Map();
      bm.set("id", bId);
      bm.set("type", "paragraph");
      bm.set("indent", 0);
      bm.set("color", "transparent");
      bm.set("align", "left");
      bm.set("characters", new Y.Array());
      blocksMap.set(bId, bm);
      children.push([bId]);
      rootChildren.push([bId]);
      root.set("children", children);
      root.set("rootChildren", rootChildren);
      root.set("blocks", blocksMap);
    });
  }

  // Build SyncStep1 for URL
  let syncStep1B64: string;
  if (opts.syncStep1HasOuterType) {
    // Our original format: [0x00(syncType), 0x00(step1Sub), svLen, ...sv]
    const sv = Y.encodeStateVector(ydoc);
    const buf: number[] = [0x00, 0x00]; // outer sync type + step1 sub
    let n = sv.length;
    while (n > 0x7f) { buf.push(0x80 | (n & 0x7f)); n >>>= 7; }
    buf.push(n & 0x7f);
    const msg = new Uint8Array(buf.length + sv.length);
    msg.set(buf);
    msg.set(sv, buf.length);
    syncStep1B64 = Buffer.from(msg).toString("base64");
  } else {
    // Standard y-protocols format: [0x00(step1Sub), svLen, ...sv] — NO outer type
    const enc = encoding.createEncoder();
    syncProtocol.writeSyncStep1(enc, ydoc);
    syncStep1B64 = Buffer.from(encoding.toUint8Array(enc)).toString("base64");
  }
  console.log(`SyncStep1 URL: ${syncStep1B64}`);

  const jwt = await getJWT(pageId);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const urlParts = [
    `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}`,
    `?token=${jwt}`,
    `&cid=${ydoc.clientID}`,
    `&app=web&reason=editor&web-editor=1.1.10`,
    `&frame_id=${randomAlpha(7)}`,
    `&ratempt=0&widx=0`,
  ];
  if (opts.useEncv2) urlParts.push(`&encv2=true`);
  urlParts.push(
    `&timezone=${encodeURIComponent(tz)}`,
    `&syncStep1=${encodeURIComponent(syncStep1B64)}`,
  );
  const wsUrl = urlParts.join("");

  return new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${HOST}`, cookie: COOKIE },
    });

    let done = false;
    const finish = () => { if (!done) { done = true; try { ws.close(); } catch {} resolve(); } };
    setTimeout(() => { console.log(`  TIMEOUT`); finish(); }, 15000);

    ws.on("error", (e) => { console.log(`  ERROR: ${e.message}`); finish(); });
    ws.on("close", () => { if (!done) { console.log(`  CLOSED`); finish(); } });

    ws.on("open", () => {
      console.log(`  Connected!`);
      
      // Send awareness (using y-protocols library)
      const awareness = new awarenessProtocol.Awareness(ydoc);
      awareness.setLocalState({});
      const awarenessData = awarenessProtocol.encodeAwarenessUpdate(awareness, [ydoc.clientID]);
      // Wrap with message type byte
      const awMsg = new Uint8Array(1 + awarenessData.length);
      awMsg[0] = 0x01;
      awMsg.set(awarenessData, 1);
      ws.send(Buffer.from(awMsg));
      console.log(`  SENT: awareness [${awMsg.length}b]`);
      
      // Clean up awareness interval
      awareness.destroy();
    });

    let updateSent = false;

    ws.on("message", (raw: Buffer, isBinary: boolean) => {
      if (!isBinary) return;
      const data = new Uint8Array(raw);
      if (data.length === 0) return;
      
      const msgType = data[0];
      if (msgType === 0x11) { ws.send(Buffer.from([0x12])); return; }
      if (msgType === 0x12 || msgType === 0x01) return;
      if (msgType !== 0x00) return;

      const [subType, subOff] = readVarUint(data, 1);

      if (subType === 0) {
        // Server SyncStep1
        console.log(`  RECV: SyncStep1 [${data.length}b]`);
        const [svLen, svStart] = readVarUint(data, subOff);
        const serverSv = data.slice(svStart, svStart + svLen);
        
        // Respond with SyncStep2
        let step2Msg: Uint8Array;
        if (opts.useV2ForSync) {
          const update = Y.encodeStateAsUpdateV2(ydoc, serverSv);
          // Manual: [0x00(sync), 0x01(step2), varuint(len), ...data]
          const hdr: number[] = [0x00, 0x01];
          let n = update.length;
          while (n > 0x7f) { hdr.push(0x80 | (n & 0x7f)); n >>>= 7; }
          hdr.push(n & 0x7f);
          step2Msg = new Uint8Array(hdr.length + update.length);
          step2Msg.set(hdr);
          step2Msg.set(update, hdr.length);
        } else {
          // Standard y-protocols (V1)
          const enc = encoding.createEncoder();
          encoding.writeVarUint(enc, 0); // sync message type
          syncProtocol.writeSyncStep2(enc, ydoc, serverSv);
          step2Msg = encoding.toUint8Array(enc);
        }
        ws.send(Buffer.from(step2Msg));
        console.log(`  SENT: SyncStep2 [${step2Msg.length}b] (V2=${opts.useV2ForSync})`);
      }

      else if (subType === 1) {
        // Server SyncStep2
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);
        console.log(`  RECV: SyncStep2 [${data.length}b] update=${uLen}b`);
        
        // Apply server state
        let applied = false;
        if (opts.useEncv2) {
          try { Y.applyUpdateV2(ydoc, updateData); applied = true; } catch {}
        }
        if (!applied) {
          try { Y.applyUpdate(ydoc, updateData); applied = true; } catch {}
        }
        if (!applied) {
          try { Y.applyUpdateV2(ydoc, updateData); applied = true; } catch {}
        }
        console.log(`  Applied: ${applied}`);

        // Write content
        if (!updateSent) {
          updateSent = true;
          
          const beforeSv = Y.encodeStateVector(ydoc);
          
          ydoc.transact(() => {
            const root = ydoc.getMap("root");
            // Clear existing content
            const ch = root.get("children") as Y.Array<string> | undefined;
            const rch = root.get("rootChildren") as Y.Array<string> | undefined;
            const blk = root.get("blocks") as Y.Map<unknown> | undefined;
            if (ch && ch.length > 0) ch.delete(0, ch.length);
            if (rch && rch.length > 0) rch.delete(0, rch.length);
            if (blk) for (const k of Array.from(blk.keys())) blk.delete(k);
            
            // Add content
            const children = root.get("children") as Y.Array<string> || (() => { const a = new Y.Array<string>(); root.set("children", a); return a; })();
            const rootChildren = root.get("rootChildren") as Y.Array<string> || (() => { const a = new Y.Array<string>(); root.set("rootChildren", a); return a; })();
            const blocksMap = root.get("blocks") as Y.Map<unknown> || (() => { const m = new Y.Map(); root.set("blocks", m); return m; })();
            
            const hId = `b${Date.now()}_h`;
            const hm = new Y.Map();
            hm.set("id", hId);
            hm.set("type", "hLarge");
            hm.set("indent", 0);
            hm.set("color", "transparent");
            hm.set("align", "left");
            const hChars = new Y.Array();
            for (const c of "Hello World!") hChars.push([c]);
            hm.set("characters", hChars);
            blocksMap.set(hId, hm);
            children.push([hId]);
            rootChildren.push([hId]);
          });
          
          // Send update
          let updateMsg: Uint8Array;
          if (opts.useV2ForUpdate) {
            const diff = Y.encodeStateAsUpdateV2(ydoc, beforeSv);
            const hdr: number[] = [0x00, 0x02];
            let n = diff.length;
            while (n > 0x7f) { hdr.push(0x80 | (n & 0x7f)); n >>>= 7; }
            hdr.push(n & 0x7f);
            updateMsg = new Uint8Array(hdr.length + diff.length);
            updateMsg.set(hdr);
            updateMsg.set(diff, hdr.length);
          } else {
            const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
            const hdr: number[] = [0x00, 0x02];
            let n = diff.length;
            while (n > 0x7f) { hdr.push(0x80 | (n & 0x7f)); n >>>= 7; }
            hdr.push(n & 0x7f);
            updateMsg = new Uint8Array(hdr.length + diff.length);
            updateMsg.set(hdr);
            updateMsg.set(diff, hdr.length);
          }
          ws.send(Buffer.from(updateMsg));
          console.log(`  SENT: UPDATE [${updateMsg.length}b] (V2=${opts.useV2ForUpdate})`);
          
          // Wait, then check
          setTimeout(async () => {
            ws.close();
            const result = await checkDump(pageId);
            console.log(`  DUMP: ${result.size}b, hasHello: ${result.hasHello}`);
            console.log(`  ${result.hasHello ? '✅ SUCCESS!' : '❌ FAILED'}`);
            finish();
          }, 3000);
        }
      }

      else if (subType === 2) {
        const [uLen, uStart] = readVarUint(data, subOff);
        console.log(`  RECV: UPDATE [${data.length}b]`);
        const updateData = data.slice(uStart, uStart + uLen);
        try { Y.applyUpdateV2(ydoc, updateData); } catch {
          try { Y.applyUpdate(ydoc, updateData); } catch {}
        }
      }
    });
  });
}

async function main() {
  console.log("=== MULTI-STRATEGY Y.JS WRITE TEST ===\n");

  // Strategy 1: Current approach (V2 everywhere, outer type in syncStep1)
  await testStrategy("V2_all_outerType", {
    useEncv2: true,
    useV2ForSync: true,
    useV2ForUpdate: true,
    syncStep1HasOuterType: true,
    preCreateContent: true,
  });

  // Strategy 2: Fix syncStep1 (NO outer type byte)
  await testStrategy("V2_all_fixedSyncStep1", {
    useEncv2: true,
    useV2ForSync: true,
    useV2ForUpdate: true,
    syncStep1HasOuterType: false,
    preCreateContent: true,
  });

  // Strategy 3: V1 for sync, V2 for updates, fixed syncStep1
  await testStrategy("V1sync_V2update_fixedSS1", {
    useEncv2: true,
    useV2ForSync: false,
    useV2ForUpdate: true,
    syncStep1HasOuterType: false,
    preCreateContent: true,
  });

  // Strategy 4: NO encv2, all V1
  await testStrategy("noEncv2_allV1", {
    useEncv2: false,
    useV2ForSync: false,
    useV2ForUpdate: false,
    syncStep1HasOuterType: false,
    preCreateContent: true,
  });

  // Strategy 5: encv2=true but standard y-protocols V1 sync, V1 update (mixed)
  await testStrategy("encv2_but_allV1", {
    useEncv2: true,
    useV2ForSync: false,
    useV2ForUpdate: false,
    syncStep1HasOuterType: false,
    preCreateContent: true,
  });

  // Strategy 6: V2 all, no outer type, no pre-created content
  await testStrategy("V2_all_noPreCreate", {
    useEncv2: true,
    useV2ForSync: true,
    useV2ForUpdate: true,
    syncStep1HasOuterType: false,
    preCreateContent: false,
  });

  console.log("\n=== ALL TESTS COMPLETE ===");
}

main().catch(console.error);
