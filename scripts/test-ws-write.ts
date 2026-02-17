/**
 * WebSocket-based Y.js content writer for Fusebase.
 * 
 * Connects to Fusebase's Y.js sync WebSocket, authenticates,
 * syncs with the existing document state, and applies new content.
 *
 * Protocol (discovered via traffic analysis):
 * 1. Connect to wss://{host}/ws/{workspaceId}/note/{pageId} via Socket.IO
 *    - OR connect to the Y.js WebSocket directly
 * 2. Receive initial sync (Y.js sync step 1)
 * 3. Respond with sync step 2
 * 4. Send JWT auth token (from /tokens endpoint)
 * 5. Send Y.js updates as binary messages
 *
 * The Y.js binary frames observed use a specific pattern:
 *   Byte 0: message type (0x00 = Y.js sync, 0x01 = Y.js awareness)
 *   Byte 1: sub-type
 *   Rest: Y.js encoded data
 *
 * Run: npx tsx scripts/test-ws-write.ts
 */

import * as Y from "yjs";
import { WebSocket } from "ws";
import { buildYDoc } from "../src/yjs-writer.js";
import { markdownToSchema } from "../src/markdown-parser.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import type { ContentBlock } from "../src/content-schema.js";

// Install ws if needed
// import WebSocket from "ws"; // already available via playwright's dependencies

const HOST = "inkabeam.nimbusweb.me";
const WS_ID = "45h7lom5ryjak34u";
const PAGE = "0ylYPzWyJEE9GHQN";

/**
 * Get the JWT auth token from the /tokens endpoint.
 */
async function getAuthToken(cookie: string): Promise<string> {
  const res = await fetch(
    `https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${PAGE}/tokens`,
    {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ tokens: [] }),
    }
  );
  const data = await res.json() as { token: string };
  return data.token;
}

/**
 * Fetch existing Y.Doc state from the /dump endpoint.
 */
async function getExistingState(cookie: string): Promise<Uint8Array> {
  const res = await fetch(
    `https://${HOST}/dump/${WS_ID}/${PAGE}`,
    {
      headers: { cookie },
    }
  );
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Write content to a Fusebase page via WebSocket.
 */
async function writeViaWebSocket(
  cookie: string,
  blocks: ContentBlock[],
): Promise<void> {
  // Step 1: Get auth token
  console.log("🔑 Getting auth token...");
  const token = await getAuthToken(cookie);
  console.log(`   Token: ${token.slice(0, 50)}...`);

  // Step 2: Get existing state
  console.log("📥 Fetching existing Y.Doc state...");
  const existingState = await getExistingState(cookie);
  console.log(`   Existing state: ${existingState.byteLength} bytes`);

  // Step 3: Load existing doc and apply our changes
  const existingDoc = new Y.Doc();
  if (existingState.byteLength > 10) {
    Y.applyUpdate(existingDoc, existingState);
  }

  // Step 4: Build new content and compute the diff update
  const { doc: newDoc, update: fullUpdate } = buildYDoc(blocks);
  
  // Compute just the diff (changes our doc introduces)
  const stateVector = Y.encodeStateVector(existingDoc);
  const diff = Y.encodeStateAsUpdate(newDoc, stateVector);
  console.log(`   Content update: ${diff.byteLength} bytes`);

  // Step 5: Connect to WebSocket
  // Based on traffic, the WS URL is the Socket.IO endpoint
  const wsUrl = `wss://${HOST}/socket.io/?EIO=4&transport=websocket`;
  console.log(`🔌 Connecting to: ${wsUrl}`);
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, {
      headers: { cookie },
    });

    let connected = false;
    let authed = false;
    let syncDone = false;
    
    ws.on("open", () => {
      console.log("   Connected!");
    });
    
    ws.on("message", (data: Buffer) => {
      const msg = data.toString();
      
      // Socket.IO handshake
      if (msg.startsWith("0{")) {
        console.log("   Received Socket.IO handshake");
        // Send Socket.IO connect
        ws.send("40");
        return;
      }
      
      // Socket.IO connected
      if (msg.startsWith("40{")) {
        console.log("   Socket.IO connected");
        connected = true;
        
        // Connect to workspace
        ws.send(`42["socketConnect:connectWorkspace","${WS_ID}"]`);
        return;
      }
      
      // Workspace connected event
      if (msg.includes("workspaceConnected")) {
        console.log("   Workspace connected");
        
        // Now send the auth token (as seen in captured traffic, line 95)
        // The captured auth message was a large base64 string 
        const authMsg = Buffer.from(token).toString("base64");
        console.log("   Sending auth token...");
        ws.send(Buffer.from(authMsg, "base64"));
        authed = true;
        
        // Wait a moment, then send the Y.js update
        setTimeout(() => {
          console.log("📤 Sending Y.js update...");
          
          // The Y.js sync protocol messages start with specific bytes.
          // Based on captured traffic:  
          // 0x00 0x02 ... = Y.js sync message (update)
          // Let's construct the proper message
          const syncMsg = new Uint8Array(diff.byteLength + 3);
          syncMsg[0] = 0x00; // Y.js sync protocol
          syncMsg[1] = 0x02; // message type 2 = update
          syncMsg[2] = diff.byteLength & 0xff; // simple length prefix (for small updates)
          syncMsg.set(diff, 3);
          
          ws.send(syncMsg);
          
          console.log(`   Sent ${syncMsg.byteLength} bytes`);
          
          // Give it time to process
          setTimeout(async () => {
            ws.close();
            
            // Verify the write
            console.log("\n📋 Verifying...");
            const checkState = await getExistingState(cookie);
            console.log(`   New dump size: ${checkState.byteLength} bytes`);
            
            if (checkState.byteLength > 300) {
              console.log("   ✅ Content appears to have been written!");
              const text = Buffer.from(checkState).toString("utf-8").replace(/[^\x20-\x7E\n]/g, "·");
              console.log(`   Preview: ${text.slice(0, 500)}`);
            } else {
              console.log("   ❌ Dump still small — write may not have worked");
            }
            
            resolve();
          }, 3000);
        }, 2000);
      }
      
      // Handle pings
      if (msg === "2") {
        ws.send("3");
        return;
      }
      
      // Log other messages
      if (msg.length < 200) {
        console.log(`   MSG: ${msg.slice(0, 100)}`);
      }
    });
    
    ws.on("error", (err) => {
      console.error("   WS Error:", err.message);
      reject(err);
    });
    
    ws.on("close", () => {
      console.log("   WebSocket closed");
    });
    
    // Timeout after 30s
    setTimeout(() => {
      if (!syncDone) {
        ws.close();
        reject(new Error("Timeout"));
      }
    }, 30000);
  });
}

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored?.cookie) { console.error("No cookie"); process.exit(1); }

  const testBlocks: ContentBlock[] = [
    {
      type: "heading",
      level: 1,
      children: [{ text: "Hello from Y.js!" }],
    },
    {
      type: "paragraph",
      children: [
        { text: "This content was written via " },
        { text: "Y.js WebSocket", bold: true },
        { text: " protocol." },
      ],
    },
    {
      type: "list",
      style: "bullet",
      items: [
        { children: [{ text: "First item" }] },
        { children: [{ text: "Second item" }] },
      ],
    },
  ];

  try {
    await writeViaWebSocket(stored.cookie, testBlocks);
  } catch (err) {
    console.error("Failed:", (err as Error).message);
  }
}

main().catch(console.error);
