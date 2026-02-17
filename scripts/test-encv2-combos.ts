/**
 * Test: Write with encv2=true in the URL (matching what the browser uses)
 * but still use V1 encoding for the Y.js data.
 *
 * Then also test pure V2 encoding.
 *
 * Goal: determine which combo makes content visible in the browser.
 */
import * as Y from "yjs";
import { loadEncryptedCookie } from "../src/crypto.js";
import WebSocket from "ws";

const WS_ID = "45h7lom5ryjak34u";
const HOST = "inkabeam.nimbusweb.me";
const TEXT_HOST = "text.nimbusweb.me";

function writeVarUint(num: number): Uint8Array {
  const bytes: number[] = [];
  while (num > 0x7f) { bytes.push(0x80 | (num & 0x7f)); num >>>= 7; }
  bytes.push(num & 0x7f);
  return new Uint8Array(bytes);
}
function readVarUint(data: Uint8Array, offset: number): [number, number] {
  let num = 0, mult = 1, pos = offset;
  while (pos < data.length) { const b = data[pos++]; num += (b & 0x7f) * mult; if ((b & 0x80) === 0) return [num, pos]; mult *= 128; }
  return [num, pos];
}
function encodeSyncMsg(sub: number, payload: Uint8Array): Uint8Array {
  const vl = writeVarUint(payload.length);
  const m = new Uint8Array(2 + vl.length + payload.length);
  m[0] = 0; m[1] = sub; m.set(vl, 2); m.set(payload, 2 + vl.length);
  return m;
}
function encodeAwareness(cid: number): Uint8Array {
  const state = new TextEncoder().encode("{}");
  const cidBuf = writeVarUint(cid), clockBuf = writeVarUint(0), slBuf = writeVarUint(state.length), countBuf = writeVarUint(1);
  const m = new Uint8Array(1 + countBuf.length + cidBuf.length + clockBuf.length + slBuf.length + state.length);
  let o = 0; m[o++] = 1; m.set(countBuf, o); o += countBuf.length;
  m.set(cidBuf, o); o += cidBuf.length; m.set(clockBuf, o); o += clockBuf.length;
  m.set(slBuf, o); o += slBuf.length; m.set(state, o);
  return m;
}

function addContent(doc: Y.Doc, text: string) {
  const root = doc.getMap("root");
  let ch = root.get("children") as Y.Array<string> | undefined;
  let rch = root.get("rootChildren") as Y.Array<string> | undefined;
  let blk = root.get("blocks") as Y.Map<unknown> | undefined;
  if (!ch) { ch = new Y.Array<string>(); root.set("children", ch); }
  if (!rch) { rch = new Y.Array<string>(); root.set("rootChildren", rch); }
  if (!blk) { blk = new Y.Map(); root.set("blocks", blk); }

  const bid = `b${doc.clientID}_0`;
  const bm = new Y.Map();
  bm.set("id", bid);
  bm.set("type", "paragraph");
  bm.set("indent", 0);
  bm.set("color", "transparent");
  bm.set("align", "left");
  const chars = new Y.Array();
  for (const c of text) chars.push([c]);
  bm.set("characters", chars);
  blk.set(bid, bm);
  ch.push([bid]);
  rch.push([bid]);
}

async function createPage(cookie: string, title: string): Promise<string> {
  const cs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nid = ""; for (let i = 0; i < 16; i++) nid += cs.charAt(Math.floor(Math.random() * cs.length));
  const r = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ workspaceId: WS_ID, noteId: nid, note: { textVersion: 2, title, parentId: "default", is_portal_share: false } }),
  });
  const d = await r.json() as any;
  return d.globalId || nid;
}

async function testWrite(cookie: string, pageId: string, useEncV2Url: boolean, useV2Encoding: boolean, label: string): Promise<boolean> {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`${label} (encv2URL=${useEncV2Url}, V2encoding=${useV2Encoding})`);
  console.log(`Page: ${pageId}`);
  console.log(`${"═".repeat(50)}`);

  const tokenResp = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
    method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}",
  });
  const jwt = ((await tokenResp.json()) as any).token;
  
  const ydoc = new Y.Doc();
  const sv = Y.encodeStateVector(ydoc);
  const svLen = writeVarUint(sv.length);
  const s1 = new Uint8Array(2 + svLen.length + sv.length);
  s1[0] = 0; s1[1] = 0; s1.set(svLen, 2); s1.set(sv, 2 + svLen.length);
  const s1B64 = Buffer.from(s1).toString("base64");

  const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const wsUrl = `wss://${TEXT_HOST}/socket.io.editor/${WS_ID}/${pageId}?token=${jwt}&cid=${ydoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=test${Date.now()}&ratempt=0&widx=0${useEncV2Url ? "&encv2=true" : ""}&timezone=${tz}&syncStep1=${encodeURIComponent(s1B64)}`;

  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl, { headers: { origin: `https://${HOST}`, cookie } });
    const to = setTimeout(() => { console.log("  TIMEOUT"); try { ws.close(); } catch {} resolve(false); }, 15000);
    ws.on("error", (e: Error) => { console.log(`  ERROR: ${e.message}`); clearTimeout(to); resolve(false); });

    ws.on("message", (raw: Buffer, isBinary: boolean) => {
      if (!isBinary) return;
      const data = new Uint8Array(raw);
      if (data[0] === 17) { ws.send(Buffer.from(new Uint8Array([18]))); return; }
      if (data[0] !== 0) return;
      const [sub, off] = readVarUint(data, 1);

      if (sub === 0) {
        // SyncStep1 request
        console.log(`  Server SyncStep1 received`);
        const update = Y.encodeStateAsUpdate(ydoc);
        ws.send(Buffer.from(encodeSyncMsg(0x01, update)));
      }

      else if (sub === 1) {
        // SyncStep2 — server doc
        const [uLen, uStart] = readVarUint(data, off);
        const updateData = data.slice(uStart, uStart + uLen);
        console.log(`  Server SyncStep2: ${uLen} bytes`);

        // Try to apply server state
        if (useEncV2Url) {
          try { Y.applyUpdateV2(ydoc, updateData); console.log(`  Applied V2 server state`); } 
          catch { try { Y.applyUpdate(ydoc, updateData); console.log(`  Applied V1 server state (fallback)`); } catch (e2) { console.log(`  Failed to apply server state: ${(e2 as Error).message}`); }}
        } else {
          try { Y.applyUpdate(ydoc, updateData); console.log(`  Applied V1 server state`); } 
          catch { try { Y.applyUpdateV2(ydoc, updateData); console.log(`  Applied V2 server state (fallback)`); } catch (e2) { console.log(`  Failed to apply server state: ${(e2 as Error).message}`); }}
        }

        // Send awareness
        ws.send(Buffer.from(encodeAwareness(ydoc.clientID)));

        // Write content
        setTimeout(() => {
          const beforeSv = Y.encodeStateVector(ydoc);
          ydoc.transact(() => { addContent(ydoc, `Test content (encv2url=${useEncV2Url}, v2enc=${useV2Encoding})`); });

          let diff: Uint8Array;
          if (useV2Encoding) {
            diff = Y.encodeStateAsUpdateV2(ydoc, beforeSv);
            console.log(`  Encoded diff as V2: ${diff.length} bytes`);
          } else {
            diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
            console.log(`  Encoded diff as V1: ${diff.length} bytes`);
          }

          ws.send(Buffer.from(encodeSyncMsg(0x02, diff)));
          console.log(`  Sent update`);

          setTimeout(() => {
            clearTimeout(to);
            try { ws.close(); } catch {}
            console.log(`  Done`);
            resolve(true);
          }, 3000);
        }, 500);
      }
    });
  });
}

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored) throw new Error("No cookie");
  const cookie = stored.cookie;

  // Test 4 combinations:
  // 1. No encv2 URL + V1 encoding (current approach)
  // 2. encv2=true URL + V1 encoding  
  // 3. No encv2 URL + V2 encoding
  // 4. encv2=true URL + V2 encoding (what browser does)

  const tests = [
    { encv2Url: false, v2Enc: false, label: "1: No encv2 + V1 encoding" },
    { encv2Url: true,  v2Enc: false, label: "2: encv2=true + V1 encoding" },
    { encv2Url: false, v2Enc: true,  label: "3: No encv2 + V2 encoding" },
    { encv2Url: true,  v2Enc: true,  label: "4: encv2=true + V2 encoding" },
  ];

  for (const test of tests) {
    const pageId = await createPage(cookie, `EncTest: ${test.label}`);
    await testWrite(cookie, pageId, test.encv2Url, test.v2Enc, test.label);
    console.log(`\nPage created: ${pageId} — CHECK IN BROWSER!`);
  }

  console.log("\n\n=== ALL 4 PAGES CREATED ===");
  console.log("Open each in the browser to see which one has content.");
}

main().catch(e => { console.error(e); process.exit(1); });
