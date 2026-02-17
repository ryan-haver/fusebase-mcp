/**
 * Debug test for the Y.js WebSocket protocol.
 * Traces every message during the Socket.IO + Y.js handshake.
 */

import { WebSocket } from "ws";
import * as Y from "yjs";
import { loadEncryptedCookie } from "../src/crypto.js";

const HOST = "inkabeam.nimbusweb.me";
const WS_ID = "45h7lom5ryjak34u";
const PAGE = "0ylYPzWyJEE9GHQN";

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored?.cookie) { console.error("No cookie"); process.exit(1); }

  const wsUrl = `wss://${HOST}/socket.io/?EIO=4&transport=websocket`;
  console.log(`Connecting to: ${wsUrl}`);

  const ws = new WebSocket(wsUrl, {
    headers: { cookie: stored.cookie },
  });

  ws.on("open", () => {
    console.log("✅ WebSocket opened");
  });

  ws.on("error", (err) => {
    console.error("❌ WebSocket error:", err.message);
  });

  ws.on("close", (code, reason) => {
    console.log(`🔒 WebSocket closed: code=${code}, reason=${reason.toString()}`);
  });

  let phase = 0;
  let msgCount = 0;

  ws.on("message", (rawData: Buffer | ArrayBuffer, isBinary: boolean) => {
    const data = rawData instanceof ArrayBuffer ? Buffer.from(rawData) : rawData;
    msgCount++;
    const hex = Array.from(data.slice(0, 40)).map(b => b.toString(16).padStart(2, "0")).join(" ");

    if (isBinary) {
      console.log(`\n📨 [${msgCount}] BINARY msg (${data.length}b): ${hex}`);
      
      if (data[0] === 0x00) {
        console.log(`   Y.js SYNC — sub=${data[1]}`);
        if (data[1] === 0x00) console.log("   → Sync Step 1 (state vector request)");
        if (data[1] === 0x01) console.log("   → Sync Step 2 (state diff/full doc)");
        if (data[1] === 0x02) console.log("   → Update");
        
        // Try to decode it as Y.js
        for (let off = 2; off <= 5; off++) {
          try {
            const doc = new Y.Doc();
            Y.applyUpdate(doc, new Uint8Array(data.slice(off)));
            const root = doc.getMap("root");
            console.log(`   ✅ Y.js decoded at offset ${off}, root keys: [${Array.from(root.keys())}]`);
            const blocks = root.get("blocks");
            if (blocks instanceof Y.Map) {
              console.log(`   Blocks: ${blocks.size}`);
            }
            break;
          } catch { /* continue */ }
        }
      } else if (data[0] === 0x01) {
        console.log("   Y.js AWARENESS update");
      } else {
        console.log("   Unknown binary");
      }
    } else {
      const str = data.toString("utf-8");
      console.log(`\n📨 [${msgCount}] TEXT msg (${str.length}c): ${str.slice(0, 200)}`);

      // Handle Socket.IO protocol
      if (str.startsWith("0{") && phase === 0) {
        console.log("   → Socket.IO OPEN handshake");
        const handshake = JSON.parse(str.slice(1));
        console.log(`   sid=${handshake.sid}, pingInterval=${handshake.pingInterval}`);
        phase = 1;
        ws.send("40");
        console.log("   📤 Sent 40 (connect)");
        return;
      }

      if (str.startsWith("40") && phase === 1) {
        console.log("   → Socket.IO CONNECTED");
        phase = 2;

        // Join workspace  
        ws.send(`42["socketConnect:connectWorkspace","${WS_ID}"]`);
        console.log("   📤 Sent connectWorkspace");
        
        // Join page
        ws.send(`42["noteOpen:join","${PAGE}"]`);
        console.log("   📤 Sent noteOpen:join");
        return;
      }

      if (str === "2") {
        console.log("   → PING");
        ws.send("3");
        console.log("   📤 Sent PONG");
        return;
      }

      if (str.startsWith("42")) {
        try {
          const payload = JSON.parse(str.slice(2));
          if (Array.isArray(payload)) {
            console.log(`   → Event: ${payload[0]}`);
            if (payload[0] === "workspaceConnected") {
              console.log("   ✅ Workspace connected!");
            }
            if (payload[0] === "noteOpen:joined" || payload[0] === "note:joined") {
              console.log("   ✅ Page joined!");
              phase = 3;
            }
          }
        } catch { /* not JSON */ }
        return;
      }
    }
  });

  // Auto-close after 15 seconds
  setTimeout(() => {
    console.log(`\n🔚 Auto-closing after 15s. Total messages: ${msgCount}`);
    ws.close();
  }, 15000);
}

main().catch(console.error);
