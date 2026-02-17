/**
 * Test Y.js WebSocket writer v7b — Fixed V2 encoding handling.
 * Server requires encv2=true. Need to handle the update decoding correctly.
 */

import { WebSocket } from "ws";
import * as Y from "yjs";
import { loadEncryptedCookie } from "../src/crypto.js";

const HOST = "inkabeam.nimbusweb.me";
const TEXT_HOST = "text.nimbusweb.me";
const WS_ID = "45h7lom5ryjak34u";
const PAGE = "0ylYPzWyJEE9GHQN";

function writeVarUint(num: number): Uint8Array {
  const bytes: number[] = [];
  while (num > 0x7f) { bytes.push(0x80 | (num & 0x7f)); num >>>= 7; }
  bytes.push(num & 0x7f);
  return new Uint8Array(bytes);
}

function readVarUint(data: Uint8Array, offset: number): [number, number] {
  let result = 0, shift = 0;
  let byte: number;
  do {
    byte = data[offset++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  return [result, offset];
}

function randomAlphaNum(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored?.cookie) { console.error("No cookie"); process.exit(1); }

  // Get JWT
  console.log("🔑 Getting JWT...");
  const tokenRes = await fetch(
    `https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${PAGE}/tokens`,
    { method: "POST", headers: { cookie: stored.cookie, "content-type": "application/json" }, body: JSON.stringify({ tokens: [] }) },
  );
  const { token: jwt } = await tokenRes.json() as { token: string };
  console.log(`   JWT: ${jwt.length} chars`);

  // Prepare doc
  const ydoc = new Y.Doc();
  const sv = Y.encodeStateVector(ydoc);
  const svLenV = writeVarUint(sv.length);
  const syncStep1 = new Uint8Array(2 + svLenV.length + sv.length);
  syncStep1[0] = 0; syncStep1[1] = 0;
  syncStep1.set(svLenV, 2); syncStep1.set(sv, 2 + svLenV.length);
  const syncStep1B64 = Buffer.from(syncStep1).toString("base64");

  // Build URL
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const wsUrl = [
    `wss://${TEXT_HOST}/socket.io.editor/${WS_ID}/${PAGE}`,
    `?token=${jwt}`,
    `&cid=${ydoc.clientID}`,
    `&app=web&reason=editor&web-editor=1.1.10`,
    `&frame_id=${randomAlphaNum(7)}`,
    `&ratempt=0&widx=0`,
    `&encv2=true`,
    `&timezone=${encodeURIComponent(tz)}`,
    `&syncStep1=${encodeURIComponent(syncStep1B64)}`,
  ].join("");

  console.log(`🔌 Connecting... (${wsUrl.length} chars)`);

  const ws = new WebSocket(wsUrl, {
    headers: { origin: `https://${HOST}`, cookie: stored.cookie },
  });

  let syncComplete = false;

  ws.on("open", () => console.log("✅ Open!"));
  ws.on("error", (e) => console.error("❌", e.message));
  ws.on("close", (code) => console.log(`🔒 Closed: ${code}`));

  ws.on("message", (raw: Buffer, isBinary: boolean) => {
    if (!isBinary) {
      console.log(`   [text] ${raw.toString("utf-8").slice(0, 120)}`);
      return;
    }

    const data = new Uint8Array(raw);
    if (data.length === 0) return;

    const msgType = data[0];

    // Ping/Pong
    if (msgType === 17) { ws.send(Buffer.from(new Uint8Array([18]))); return; }
    if (msgType === 18) return;

    // Awareness
    if (msgType === 1) {
      console.log(`   🧠 Awareness (${data.length}b)`);
      return;
    }

    // Sync (type 0)
    if (msgType === 0) {
      // Read the sub-type
      const [subType, subOff] = readVarUint(data, 1);
      console.log(`📨 Sync sub=${subType} (${data.length}b)`);
      
      // Dump hex of first 30 bytes for debugging
      const hexDump = Array.from(data.slice(0, Math.min(30, data.length)))
        .map(b => b.toString(16).padStart(2, "0")).join(" ");
      console.log(`   Hex: ${hexDump}`);

      if (subType === 0) {
        // Sync Step 1: server's state vector
        // Read the state vector
        const [svLen, svStart] = readVarUint(data, subOff);
        const serverSv = data.slice(svStart, svStart + svLen);
        console.log(`   Server SV: ${svLen}b (from offset ${svStart})`);

        // Respond with sync step 2 (our state, V2)
        const update = Y.encodeStateAsUpdate(ydoc, serverSv);
        const uLenV = writeVarUint(update.length);
        const step2 = new Uint8Array(2 + uLenV.length + update.length);
        step2[0] = 0x00; step2[1] = 0x01;
        step2.set(uLenV, 2); step2.set(update, 2 + uLenV.length);
        ws.send(Buffer.from(step2));
        console.log(`   → Sent Step 2 (${step2.length}b)`);
      }

      else if (subType === 1) {
        // Sync Step 2: server's full document state
        // Read the update data
        const [uLen, uStart] = readVarUint(data, subOff);
        console.log(`   Update: ${uLen}b from offset ${uStart}, total=${data.length}`);
        console.log(`   Available: ${data.length - uStart}b`);
        
        const updateData = data.slice(uStart, uStart + uLen);
        
        // Try different apply strategies
        let applied = false;
        
        // Strategy 1: Try as V2 update
        try {
          (Y as any).applyUpdateV2(ydoc, updateData);
          console.log("   ✅ Applied as V2 update");
          applied = true;
        } catch (e) {
          console.log(`   V2 failed: ${(e as Error).message}`);
        }

        // Strategy 2: Try as V1 update
        if (!applied) {
          try {
            Y.applyUpdate(ydoc, updateData);
            console.log("   ✅ Applied as V1 update");
            applied = true;
          } catch (e) {
            console.log(`   V1 failed: ${(e as Error).message}`);
          }
        }

        // Strategy 3: Try the raw data from offset 2 (skip sync header)
        if (!applied) {
          try {
            (Y as any).applyUpdateV2(ydoc, data.slice(2));
            console.log("   ✅ Applied raw from offset 2 as V2");
            applied = true;
          } catch (e) {
            console.log(`   Raw V2 failed: ${(e as Error).message}`);
          }
        }
        
        // Strategy 4: Try raw from subOff
        if (!applied) {
          try {
            (Y as any).applyUpdateV2(ydoc, data.slice(subOff));
            console.log("   ✅ Applied raw from subOff as V2");
            applied = true;
          } catch (e) {
            console.log(`   Raw subOff V2 failed: ${(e as Error).message}`);
          }
        }

        if (applied) {
          const root = ydoc.getMap("root");
          const ch = root.get("children") as Y.Array<string> | undefined;
          const blk = root.get("blocks") as Y.Map<unknown> | undefined;
          console.log(`   📄 Doc: ${ch?.length ?? 0} children, ${blk?.size ?? 0} blocks`);
          syncComplete = true;

          // Send awareness
          const awarenessUpdate = encodeAwarenessUpdate(ydoc.clientID, 0, "{}");
          const aLenV = writeVarUint(awarenessUpdate.length);
          const awarenessMsg = new Uint8Array(1 + aLenV.length + awarenessUpdate.length);
          awarenessMsg[0] = 1;
          awarenessMsg.set(aLenV, 1);
          awarenessMsg.set(awarenessUpdate, 1 + aLenV.length);
          ws.send(Buffer.from(awarenessMsg));
          console.log("   → Sent Awareness");

          // Write content
          setTimeout(() => writeContent(ws, ydoc, stored.cookie), 1500);
        } else {
          console.log("   ❌ Could not apply update with any strategy");
        }
      }

      else if (subType === 2) {
        // Update 
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);
        try { (Y as any).applyUpdateV2(ydoc, updateData); } catch {
          try { Y.applyUpdate(ydoc, updateData); } catch {}
        }
        console.log(`   Applied update (${uLen}b)`);
      }
    }
  });

  setTimeout(() => {
    if (!syncComplete) console.log("\n⚠️ Sync incomplete");
    ws.close();
  }, 30000);
}

function encodeAwarenessUpdate(clientId: number, clock: number, state: string): Uint8Array {
  const stateBytes = new TextEncoder().encode(state);
  const cidV = writeVarUint(clientId);
  const clkV = writeVarUint(clock);
  const sLenV = writeVarUint(stateBytes.length);
  const cntV = writeVarUint(1);
  const buf = new Uint8Array(cntV.length + cidV.length + clkV.length + sLenV.length + stateBytes.length);
  let off = 0;
  buf.set(cntV, off); off += cntV.length;
  buf.set(cidV, off); off += cidV.length;
  buf.set(clkV, off); off += clkV.length;
  buf.set(sLenV, off); off += sLenV.length;
  buf.set(stateBytes, off);
  return buf;
}

async function writeContent(ws: WebSocket, ydoc: Y.Doc, cookie: string) {
  console.log("\n✍️ Writing content...");
  const sv = Y.encodeStateVector(ydoc);

  ydoc.transact(() => {
    const root = ydoc.getMap("root");
    let children = root.get("children") as Y.Array<string>;
    let rootChildren = root.get("rootChildren") as Y.Array<string>;
    let blocks = root.get("blocks") as Y.Map<unknown>;
    if (!children) { children = new Y.Array(); root.set("children", children); }
    if (!rootChildren) { rootChildren = new Y.Array(); root.set("rootChildren", rootChildren); }
    if (!blocks) { blocks = new Y.Map(); root.set("blocks", blocks); }

    if (children.length > 0) children.delete(0, children.length);
    if (rootChildren.length > 0) rootChildren.delete(0, rootChildren.length);
    for (const k of Array.from(blocks.keys())) blocks.delete(k);

    const id = `b${Date.now()}_1`;
    const h1 = new Y.Map();
    h1.set("id", id); h1.set("type", "hLarge"); h1.set("indent", 0);
    h1.set("color", "transparent"); h1.set("align", "left");
    const chars = new Y.Array();
    for (const ch of "🚀 Native Y.js Write " + new Date().toISOString()) chars.push([ch]);
    h1.set("characters", chars);
    blocks.set(id, h1); children.push([id]); rootChildren.push([id]);
  });

  const diff = Y.encodeStateAsUpdate(ydoc, sv);
  console.log(`   Diff: ${diff.length} bytes`);

  const uLenV = writeVarUint(diff.length);
  const msg = new Uint8Array(2 + uLenV.length + diff.length);
  msg[0] = 0x00; msg[1] = 0x02;
  msg.set(uLenV, 2); msg.set(diff, 2 + uLenV.length);
  ws.send(Buffer.from(msg));
  console.log("   ✅ Sent update!");

  setTimeout(async () => {
    console.log("\n📋 Verify...");
    const dumpRes = await fetch(`https://${HOST}/dump/${WS_ID}/${PAGE}`, { headers: { cookie } });
    const dumpBuf = Buffer.from(await dumpRes.arrayBuffer());
    console.log(`   Dump: ${dumpBuf.length}b`);
    try {
      const vDoc = new Y.Doc();
      Y.applyUpdate(vDoc, new Uint8Array(dumpBuf.slice(3)));
      const root = vDoc.getMap("root");
      const blk = root.get("blocks") as Y.Map<unknown>;
      if (blk) for (const [, b] of blk.entries()) {
        if (b instanceof Y.Map) {
          const chars = b.get("characters") as Y.Array<unknown>;
          const text = chars?.toArray().filter(c => typeof c === "string").join("") ?? "";
          console.log(`   [${b.get("type")}] "${text.slice(0, 80)}"`);
        }
      }
    } catch (e) { console.error(`   ${(e as Error).message}`); }
    ws.close();
  }, 3000);
}

main().catch(console.error);
