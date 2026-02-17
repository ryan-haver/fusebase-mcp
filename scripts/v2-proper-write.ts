/**
 * Write content using proper V2 encoding when connected with encv2=true.
 * This should be what the browser actually does.
 * 
 * The key insight: when encv2=true is in the URL, the server
 * uses V2 encoding for all Y.js messages. Our updates MUST also be V2.
 */
import * as Y from "yjs";
import { loadEncryptedCookie } from "../src/crypto.js";
import WebSocket from "ws";

const WS_ID = "45h7lom5ryjak34u";
const HOST = "inkabeam.nimbusweb.me";

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

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored) throw new Error("No cookie");
  const cookie = stored.cookie;

  // Create fresh page with textVersion=2
  const cs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let noteId = ""; for (let i = 0; i < 16; i++) noteId += cs.charAt(Math.floor(Math.random() * cs.length));
  
  console.log("Creating page...");
  const createResp = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ workspaceId: WS_ID, noteId, note: { textVersion: 2, title: "V2 Proper Test " + Date.now(), parentId: "default", is_portal_share: false } }),
  });
  const cd = await createResp.json() as any;
  const pageId = cd.globalId || noteId;
  console.log(`Page: ${pageId}`);

  const tokenResp = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
    method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}",
  });
  const jwt = ((await tokenResp.json()) as any).token;

  // Connect WITH encv2=true (matching browser behavior)
  const ydoc = new Y.Doc();
  const sv = Y.encodeStateVector(ydoc);
  const svLen = writeVarUint(sv.length);
  const s1 = new Uint8Array(2 + svLen.length + sv.length);
  s1[0] = 0; s1[1] = 0; s1.set(svLen, 2); s1.set(sv, 2 + svLen.length);
  const s1B64 = Buffer.from(s1).toString("base64");

  const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const wsUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}?token=${jwt}&cid=${ydoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=test${Date.now()}&ratempt=0&widx=0&encv2=true&timezone=${tz}&syncStep1=${encodeURIComponent(s1B64)}`;

  console.log("Connecting with encv2=true...");

  return new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl, { headers: { origin: `https://${HOST}`, cookie } });
    const to = setTimeout(() => { console.log("TIMEOUT"); try { ws.close(); } catch {} resolve(); }, 20000);
    ws.on("error", (e: Error) => { console.log(`ERROR: ${e.message}`); clearTimeout(to); resolve(); });
    ws.on("close", () => console.log("CLOSED"));

    ws.on("message", (raw: Buffer, isBinary: boolean) => {
      if (!isBinary) return;
      const data = new Uint8Array(raw);
      if (data[0] === 17) { ws.send(Buffer.from(new Uint8Array([18]))); return; }
      if (data[0] !== 0) return;
      const [sub, off] = readVarUint(data, 1);

      if (sub === 0) {
        // SyncStep1 — server wants our state
        console.log("Server SyncStep1 received");
        // Send our state as V2 (since encv2=true mode)
        const updateV2 = Y.encodeStateAsUpdateV2(ydoc);
        console.log(`Sending SyncStep2 with V2 update: ${updateV2.length} bytes`);
        ws.send(Buffer.from(encodeSyncMsg(0x01, updateV2)));
      }

      else if (sub === 1) {
        // SyncStep2 — apply server's V2 document
        const [uLen, uStart] = readVarUint(data, off);
        const updateData = data.slice(uStart, uStart + uLen);
        console.log(`Server SyncStep2: ${uLen} bytes`);

        // Try V2 first (expected with encv2), fallback to V1
        let applied = false;
        try { Y.applyUpdateV2(ydoc, updateData); applied = true; console.log("Applied server state as V2"); }
        catch (e) { console.log(`V2 failed: ${(e as Error).message}`); }
        if (!applied) {
          try { Y.applyUpdate(ydoc, updateData); applied = true; console.log("Applied server state as V1 (fallback)"); }
          catch (e) { console.log(`V1 also failed: ${(e as Error).message}`); }
        }

        // Send awareness
        ws.send(Buffer.from(encodeAwareness(ydoc.clientID)));
        console.log("Sent awareness");

        // Write content
        setTimeout(() => {
          console.log("\n--- Writing content ---");
          const beforeSv = Y.encodeStateVector(ydoc);

          ydoc.transact(() => {
            const root = ydoc.getMap("root");
            let ch = root.get("children") as Y.Array<string> | undefined;
            let rch = root.get("rootChildren") as Y.Array<string> | undefined;
            let blk = root.get("blocks") as Y.Map<unknown> | undefined;
            if (!ch) { ch = new Y.Array<string>(); root.set("children", ch); }
            if (!rch) { rch = new Y.Array<string>(); root.set("rootChildren", rch); }
            if (!blk) { blk = new Y.Map(); root.set("blocks", blk); }

            const bid = `b${ydoc.clientID}_0`;
            const bm = new Y.Map();
            bm.set("id", bid);
            bm.set("type", "paragraph");
            bm.set("indent", 0);
            bm.set("color", "transparent");
            bm.set("align", "left");
            const chars = new Y.Array();
            for (const c of "Hello from V2-encoded writer!") chars.push([c]);
            bm.set("characters", chars);
            blk.set(bid, bm);
            ch.push([bid]);
            rch.push([bid]);
          });

          // Encode diff as V2 (critical — match encv2=true mode)
          const diffV2 = Y.encodeStateAsUpdateV2(ydoc, beforeSv);
          console.log(`V2 diff: ${diffV2.length} bytes`);
          console.log(`First 20 bytes: [${Array.from(diffV2.slice(0, 20)).join(",")}]`);

          // Send as update (subType=2)
          ws.send(Buffer.from(encodeSyncMsg(0x02, diffV2)));
          console.log("Sent V2 update");

          // Wait for server to process, then verify
          setTimeout(async () => {
            console.log("\n--- Verifying via dump ---");
            const dr = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie } });
            console.log(`Dump status: ${dr.status}, size: ${(await dr.clone().arrayBuffer()).byteLength} bytes`);

            // Also try reading back via WS as a fresh client with encv2=true
            console.log("\n--- Re-reading via fresh WS connection ---");
            const tokenResp3 = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
              method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}",
            });
            const jwt3 = ((await tokenResp3.json()) as any).token;
            const readDoc = new Y.Doc();
            const readSv = Y.encodeStateVector(readDoc);
            const readSvLen = writeVarUint(readSv.length);
            const readS1 = new Uint8Array(2 + readSvLen.length + readSv.length);
            readS1[0] = 0; readS1[1] = 0; readS1.set(readSvLen, 2); readS1.set(readSv, 2 + readSvLen.length);
            const readUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}?token=${jwt3}&cid=${readDoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=r${Date.now()}&ratempt=0&widx=0&encv2=true&timezone=${tz}&syncStep1=${encodeURIComponent(Buffer.from(readS1).toString("base64"))}`;

            await new Promise<void>((res2) => {
              const ws2 = new WebSocket(readUrl, { headers: { origin: `https://${HOST}`, cookie } });
              const to2 = setTimeout(() => { console.log("READ TIMEOUT"); try { ws2.close(); } catch {} res2(); }, 10000);
              ws2.on("error", () => { clearTimeout(to2); res2(); });
              ws2.on("message", (raw2: Buffer, isB: boolean) => {
                if (!isB) return;
                const d2 = new Uint8Array(raw2);
                if (d2[0] === 17) { ws2.send(Buffer.from(new Uint8Array([18]))); return; }
                if (d2[0] !== 0) return;
                const [sub2, off2] = readVarUint(d2, 1);
                if (sub2 === 0) {
                  const upd = Y.encodeStateAsUpdateV2(readDoc);
                  ws2.send(Buffer.from(encodeSyncMsg(0x01, upd)));
                }
                if (sub2 === 1) {
                  const [uLen2, uStart2] = readVarUint(d2, off2);
                  const ud2 = d2.slice(uStart2, uStart2 + uLen2);
                  console.log(`Re-read: server sent ${uLen2} bytes`);
                  try {
                    Y.applyUpdateV2(readDoc, ud2);
                    const root = readDoc.getMap("root");
                    console.log(`Re-read V2 apply: root keys: [${Array.from(root.keys())}]`);
                    const children = root.get("children") as Y.Array<string> | undefined;
                    console.log(`Re-read children: ${children?.length}`);
                    const blocks = root.get("blocks") as Y.Map<unknown> | undefined;
                    if (blocks) {
                      for (const [k, v] of blocks.entries()) {
                        const bm = v as Y.Map<unknown>;
                        const chars = bm.get("characters") as Y.Array<unknown> | undefined;
                        if (chars) {
                          let text = "";
                          for (let i = 0; i < chars.length; i++) {
                            const item = chars.get(i);
                            if (typeof item === "string") text += item;
                          }
                          console.log(`Block ${k}: "${text}"`);
                        }
                      }
                    }
                  } catch (e) {
                    console.log(`Re-read V2 FAILED: ${(e as Error).message}`);
                    try {
                      Y.applyUpdate(readDoc, ud2);
                      console.log(`Re-read V1 fallback: root keys: [${Array.from(readDoc.getMap("root").keys())}]`);
                    } catch (e2) { console.log(`Re-read V1 also FAILED: ${(e2 as Error).message}`); }
                  }
                  clearTimeout(to2); try { ws2.close(); } catch {} res2();
                }
              });
            });

            clearTimeout(to);
            try { ws.close(); } catch {};
            resolve();
          }, 5000);
        }, 500);
      }
    });
  });
}

main().catch(e => { console.error(e); process.exit(1); });
