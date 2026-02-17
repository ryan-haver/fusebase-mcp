/**
 * Verbose write test — logs every step of the WebSocket protocol
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
  while (pos < data.length) {
    const b = data[pos++];
    num += (b & 0x7f) * mult;
    if ((b & 0x80) === 0) return [num, pos];
    mult *= 128;
  }
  return [num, pos];
}

function encodeSyncMsg(subType: number, payload: Uint8Array): Uint8Array {
  const varLen = writeVarUint(payload.length);
  const msg = new Uint8Array(2 + varLen.length + payload.length);
  msg[0] = 0; msg[1] = subType;
  msg.set(varLen, 2);
  msg.set(payload, 2 + varLen.length);
  return msg;
}

function encodeAwareness(clientID: number, clock: number, state: string): Uint8Array {
  const stateBytes = new TextEncoder().encode(state);
  const clientIdBuf = writeVarUint(clientID);
  const clockBuf = writeVarUint(clock);
  const stateLenBuf = writeVarUint(stateBytes.length);
  const countBuf = writeVarUint(1);
  const msg = new Uint8Array(1 + countBuf.length + clientIdBuf.length + clockBuf.length + stateLenBuf.length + stateBytes.length);
  let off = 0;
  msg[off++] = 1; // awareness msgType
  msg.set(countBuf, off); off += countBuf.length;
  msg.set(clientIdBuf, off); off += clientIdBuf.length;
  msg.set(clockBuf, off); off += clockBuf.length;
  msg.set(stateLenBuf, off); off += stateLenBuf.length;
  msg.set(stateBytes, off);
  return msg;
}

function addBlocks(doc: Y.Doc) {
  const root = doc.getMap("root");
  let children = root.get("children") as Y.Array<string> | undefined;
  let rootChildren = root.get("rootChildren") as Y.Array<string> | undefined;
  let blocks = root.get("blocks") as Y.Map<unknown> | undefined;

  if (!children) { children = new Y.Array<string>(); root.set("children", children); }
  if (!rootChildren) { rootChildren = new Y.Array<string>(); root.set("rootChildren", rootChildren); }
  if (!blocks) { blocks = new Y.Map(); root.set("blocks", blocks); }

  const blockId = `b${doc.clientID}_0`;
  const blockMap = new Y.Map();
  blockMap.set("id", blockId);
  blockMap.set("type", "paragraph");
  blockMap.set("indent", 0);
  blockMap.set("color", "transparent");
  blockMap.set("align", "left");

  const chars = new Y.Array();
  for (const ch of "Hello from verbose test!") chars.push([ch]);
  blockMap.set("characters", chars);

  blocks.set(blockId, blockMap);
  children.push([blockId]);
  rootChildren.push([blockId]);
}

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored) throw new Error("No cookie");
  const cookie = stored.cookie;

  // Create fresh page
  const cs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let noteId = ""; for (let i = 0; i < 16; i++) noteId += cs.charAt(Math.floor(Math.random() * cs.length));
  
  console.log(`Creating page (id: ${noteId})...`);
  const createResp = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WS_ID, noteId,
      note: { textVersion: 2, title: "Verbose Test " + Date.now(), parentId: "default", is_portal_share: false },
    }),
  });
  const createData = await createResp.json() as any;
  const pageId = createData.globalId || noteId;
  console.log(`Created: ${pageId}`);

  // Get JWT
  const tokenResp = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const tokenData = await tokenResp.json() as any;
  const jwt = tokenData.token;
  console.log(`JWT: ${jwt ? jwt.substring(0, 30) + "..." : "MISSING!"}`);

  // Build Y.Doc
  const ydoc = new Y.Doc();
  const sv = Y.encodeStateVector(ydoc);
  const svLen = writeVarUint(sv.length);
  const syncStep1 = new Uint8Array(2 + svLen.length + sv.length);
  syncStep1[0] = 0; syncStep1[1] = 0;
  syncStep1.set(svLen, 2); syncStep1.set(sv, 2 + svLen.length);
  const syncStep1B64 = Buffer.from(syncStep1).toString("base64");

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const wsUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}?token=${jwt}&cid=${ydoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=test123&ratempt=0&widx=0&timezone=${encodeURIComponent(tz)}&syncStep1=${encodeURIComponent(syncStep1B64)}`;

  console.log(`\nConnecting WebSocket...`);
  console.log(`Client ID: ${ydoc.clientID}`);

  return new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl, { headers: { origin: `https://${HOST}`, cookie } });
    let msgCount = 0;

    const done = (msg: string) => {
      console.log(`\nDONE: ${msg}`);
      try { ws.close(); } catch {}
      resolve();
    };

    const timeout = setTimeout(() => done("TIMEOUT"), 20000);

    ws.on("error", (e: Error) => { console.log(`WS ERROR: ${e.message}`); done("error"); });
    ws.on("close", () => console.log("WS CLOSED"));

    ws.on("message", (raw: Buffer, isBinary: boolean) => {
      msgCount++;
      const data = new Uint8Array(raw);
      console.log(`\nMSG #${msgCount}: binary=${isBinary} len=${data.length} firstBytes=[${Array.from(data.slice(0, 10)).join(",")}]`);

      if (!isBinary) { console.log(`  TEXT: ${raw.toString()}`); return; }

      const msgType = data[0];
      console.log(`  msgType: ${msgType}${msgType === 0 ? " (SYNC)" : msgType === 1 ? " (AWARENESS)" : msgType === 17 ? " (PING)" : msgType === 18 ? " (PONG)" : ""}`);

      if (msgType === 17) { ws.send(Buffer.from(new Uint8Array([18]))); console.log("  → Sent PONG"); return; }
      if (msgType !== 0) return;

      const [subType, subOff] = readVarUint(data, 1);
      console.log(`  subType: ${subType}${subType === 0 ? " (Step1-request)" : subType === 1 ? " (Step2-document)" : subType === 2 ? " (Update)" : ""}`);

      if (subType === 0) {
        // Server sends SyncStep1 — respond with our sync step 2
        const [svLen2, svStart] = readVarUint(data, subOff);
        const serverSv = data.slice(svStart, svStart + svLen2);
        console.log(`  Server SV length: ${svLen2}`);
        const update = Y.encodeStateAsUpdate(ydoc, serverSv);
        console.log(`  Our update to send: ${update.length} bytes`);
        ws.send(Buffer.from(encodeSyncMsg(0x01, update)));
        console.log(`  → Sent SyncStep2 (${update.length} bytes)`);
      }

      else if (subType === 1) {
        // Server sends SyncStep2 — apply their document
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);
        console.log(`  Server doc update: ${uLen} bytes`);

        let applied = false;
        try {
          Y.applyUpdate(ydoc, updateData);
          applied = true;
          console.log(`  V1 applyUpdate: SUCCESS`);
        } catch (e) {
          console.log(`  V1 applyUpdate: FAILED - ${(e as Error).message}`);
        }

        if (!applied) {
          try {
            Y.applyUpdateV2(ydoc, updateData);
            applied = true;
            console.log(`  V2 applyUpdate: SUCCESS`);
          } catch (e) {
            console.log(`  V2 applyUpdate: FAILED - ${(e as Error).message}`);
          }
        }

        // Check doc state
        const root = ydoc.getMap("root");
        console.log(`  Doc root keys after apply: [${Array.from(root.keys()).join(", ")}]`);

        // Send awareness
        ws.send(Buffer.from(encodeAwareness(ydoc.clientID, 0, "{}")));
        console.log(`  → Sent awareness`);

        // Write content
        setTimeout(() => {
          console.log(`\n--- Writing content ---`);
          const beforeSv = Y.encodeStateVector(ydoc);
          console.log(`  Before SV: ${beforeSv.length} bytes`);

          ydoc.transact(() => { addBlocks(ydoc); });

          const root2 = ydoc.getMap("root");
          console.log(`  After write, root keys: [${Array.from(root2.keys()).join(", ")}]`);
          const children = root2.get("children") as Y.Array<string> | undefined;
          console.log(`  children length: ${children?.length}`);

          const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
          console.log(`  Diff update: ${diff.length} bytes`);
          console.log(`  Diff first 30 bytes: [${Array.from(diff.slice(0, 30)).join(",")}]`);

          ws.send(Buffer.from(encodeSyncMsg(0x02, diff)));
          console.log(`  → Sent update (subType=2)`);

          // Wait and check dump
          setTimeout(async () => {
            console.log(`\n--- Checking dump after 5s ---`);
            const dumpResp = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, {
              headers: { cookie },
            });
            console.log(`  Dump status: ${dumpResp.status}`);
            if (dumpResp.ok) {
              const dumpBinary = new Uint8Array(await dumpResp.arrayBuffer());
              console.log(`  Dump size: ${dumpBinary.length} bytes`);
              const readable = new TextDecoder("utf-8", { fatal: false }).decode(dumpBinary).replace(/[^\x20-\x7E]/g, "·");
              const helloIdx = readable.indexOf("Hello");
              console.log(`  Contains "Hello": ${helloIdx >= 0}`);
              if (helloIdx >= 0) {
                console.log(`  Context: ...${readable.substring(Math.max(0, helloIdx - 20), helloIdx + 50)}...`);
              }
            }
            clearTimeout(timeout);
            done("Complete");
          }, 5000);
        }, 500);
      }
    });
  });
}

main().catch(e => { console.error(e); process.exit(1); });
