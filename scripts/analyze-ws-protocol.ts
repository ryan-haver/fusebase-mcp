/**
 * Deep analysis of captured WebSocket messages to understand the exact
 * Y.js sync protocol used by Fusebase.
 * 
 * Decodes base64 binary messages and identifies the protocol structure.
 */

import * as Y from "yjs";

// Key messages from ws-capture.json
const messages = [
  // Initial sync from client (sent)
  { dir: "sent", data: "AQoBjZa4/gcAAnt9", label: "Client sync init" },
  
  // Server response - full Y.doc state
  { dir: "recv", data: "AAAHAdGa9qQPCg==", label: "Server sync step 1 (state vector)" },
  
  // Client response to sync
  { dir: "sent", data: "AAECAAA=", label: "Client sync step 2 (empty diff)" },
  
  // Full Y.doc state from server
  { dir: "recv", data: "AAHCAQAABtG17MkeBgQCAQMMAAknASgEJwAEAAhZTHJvb3RjaGlsZHJlbmJsb2Nrc2I0MTAzOTY2MDMzXzFpZHR5cGVpbmRlbnRjb2xvcmFsaWduY2hhcmFjdGVycwpyb290Q2hpbGRyZW4ECAYNAgQGRQAKAQwFAQEABgEDAAECAkEEAQoAdw1iNDEwMzk2NjAzM18xdwlwYXJhZ3JhcGh9AHcLdHJhbnNwYXJlbnR3BGxlZnR3DWI0MTAzOTY2MDMzXzEA", label: "Server full Y.doc" },
  
  // Auth token sent by client (JWT, very long - truncated for clarity)
  // { dir: "sent", data: "rALPBWV5..." }
  
  // Awareness updates (bidirectional)
  { dir: "recv", data: "AQoBtquxuQQaAnt9", label: "Awareness recv" },
  { dir: "sent", data: "AQoBtquxuQQaAnt9", label: "Awareness echo" },
  
  // Y.js awareness update (sent periodically)
  { dir: "sent", data: "AQoBjZa4/gcBAnt9", label: "Client awareness update" },
  
  // Binary awareness message
  { dir: "sent", data: "Eg==", label: "Short binary msg" },
  
  // CONTENT EDITS — individual character inserts for "CAPTURE TEST"
  { dir: "sent", data: "AAISAQGNlrj+BwBE0Zr2pA8IAUMA", label: "First char 'C'" },
  { dir: "sent", data: "AAIYAQGNlrj+BwHEjZa4/gcA0Zr2pA8IAUEA", label: "Second char 'A'" },
  { dir: "sent", data: "AAIYAQGNlrj+BwLEjZa4/gcB0Zr2pA8IAVAA", label: "Third char 'P'" },
  { dir: "sent", data: "AAIYAQGNlrj+BwPEjZa4/gcC0Zr2pA8IAVQA", label: "Fourth char 'T'" },
  { dir: "sent", data: "AAIYAQGNlrj+BwTEjZa4/gcD0Zr2pA8IAVUA", label: "Fifth char 'U'" },
  { dir: "sent", data: "AAIYAQGNlrj+BwXEjZa4/gcE0Zr2pA8IAVIA", label: "Sixth char 'R'" },
  { dir: "sent", data: "AAIYAQGNlrj+BwbEjZa4/gcF0Zr2pA8IAUUA", label: "Seventh char 'E'" },
  { dir: "sent", data: "AAIYAQGNlrj+BwfEjZa4/gcG0Zr2pA8IASAA", label: "Space" },
  { dir: "sent", data: "AAIYAQGNlrj+BwjEjZa4/gcH0Zr2pA8IAVQA", label: "Char 'T'" },
  { dir: "sent", data: "AAIYAQGNlrj+BwnEjZa4/gcI0Zr2pA8IAUUA", label: "Char 'E'" },
  { dir: "sent", data: "AAIYAQGNlrj+BwrEjZa4/gcJ0Zr2pA8IAVMA", label: "Char 'S'" },
  { dir: "sent", data: "AAIYAQGNlrj+BwvEjZa4/gcK0Zr2pA8IAVQA", label: "Char 'T'" },
  
  // NEW BLOCK — creates a new paragraph block with structure 
  { dir: "sent", data: "AALQAQEJjZa4/gcMJwEGYmxvY2tzDmIyMTQ0MjA5Njc3XzEyASgAjZa4/gcMAmlkAXcOYjIxNDQyMDk2NzdfMTIoAI2WuP4HDAR0eXBlAXcJcGFyYWdyYXBoKACNlrj+BwwGaW5kZW50AX0AKACNlrj+BwwFY29sb3IBdwt0cmFuc3BhcmVudCgAjZa4/gcMBWFsaWduAXcEbGVmdCcAjZa4/gcMCmNoYXJhY3RlcnMCBACNlrj+BxIBCojRmvakDwkBdw5iMjE0NDIwOTY3N18xMgA=", label: "New block creation" },
  
  // Characters for "Second line" typed into the new block
  { dir: "sent", data: "AAISAQGNlrj+BxVEjZa4/gcTAVMA", label: "Char 'S' in new block" },
  { dir: "sent", data: "AAIYAQGNlrj+BxbEjZa4/gcVjZa4/gcTAWUA", label: "Char 'e'" },
];

console.log("═══ WebSocket Protocol Analysis ═══\n");

for (const msg of messages) {
  const buf = Buffer.from(msg.data, "base64");
  const hex = Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join(" ");
  const ascii = Array.from(buf).map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : "·").join("");
  
  console.log(`${msg.dir === "sent" ? "📤" : "📥"} ${msg.label}`);
  console.log(`   Base64: ${msg.data}`);
  console.log(`   Hex:    ${hex}`);
  console.log(`   ASCII:  ${ascii}`);
  console.log(`   Length: ${buf.length} bytes`);
  
  // Decode the message type
  if (buf[0] === 0x00) {
    console.log(`   Type:   Y.js SYNC protocol (0x00)`);
    if (buf[1] === 0x00) console.log(`   Sub:    Sync Step 1 (state vector request)`);
    if (buf[1] === 0x01) console.log(`   Sub:    Sync Step 2 (state diff)`);
    if (buf[1] === 0x02) console.log(`   Sub:    Update`);
    
    // Try to decode the Y.js payload
    const payload = buf.slice(1);
    try {
      // Check if sub-type is sync step 1 (contains state vector)
      if (buf[1] === 0x00) {
        // After sub-type, we have the encoded state vector
        console.log(`   Payload: State vector (${payload.length - 1} bytes)`);
      }
      if (buf[1] === 0x01) {
        console.log(`   Payload: State diff (${payload.length - 1} bytes)`);
      }
      if (buf[1] === 0x02) {
        console.log(`   Payload: Y.js update (${payload.length - 1} bytes)`);
        // Try decoding as Y.js update
        try {
          const doc = new Y.Doc();
          // The update data starts after the message type bytes
          // Need to figure out exact offset
          Y.applyUpdate(doc, new Uint8Array(payload.slice(1)));
          console.log(`   ✅ Decoded as Y.js update!`);
        } catch (e) {
          // Try different offsets
          for (let off = 2; off <= 4; off++) {
            try {
              const doc = new Y.Doc();
              Y.applyUpdate(doc, new Uint8Array(buf.slice(off)));
              console.log(`   ✅ Decoded with offset ${off}!`);
              break;
            } catch { /* continue */ }
          }
        }
      }
    } catch (e) {
      console.log(`   Decode failed: ${(e as Error).message}`);
    }
  } else if (buf[0] === 0x01) {
    console.log(`   Type:   Y.js AWARENESS protocol (0x01)`);
  } else if (buf[0] === 0x12) {
    console.log(`   Type:   Unknown (0x12 = 18)`);
  }
  
  console.log();
}

// Now try to decode the "new block" message to understand the structure
console.log("\n═══ Deep Decode: New Block Creation ═══\n");
const blockMsg = Buffer.from("AALQAQEJjZa4/gcMJwEGYmxvY2tzDmIyMTQ0MjA5Njc3XzEyASgAjZa4/gcMAmlkAXcOYjIxNDQyMDk2NzdfMTIoAI2WuP4HDAR0eXBlAXcJcGFyYWdyYXBoKACNlrj+BwwGaW5kZW50AX0AKACNlrj+BwwFY29sb3IBdwt0cmFuc3BhcmVudCgAjZa4/gcMBWFsaWduAXcEbGVmdCcAjZa4/gcMCmNoYXJhY3RlcnMCBACNlrj+BxIBCojRmvakDwkBdw5iMjE0NDIwOTY3N18xMgA=", "base64");
console.log(`   Total length: ${blockMsg.length} bytes`);
console.log(`   Message type: 0x${blockMsg[0].toString(16)} 0x${blockMsg[1].toString(16)}`);

// The structure appears to be: 0x00 0x02 <Y.js update>
// Let's try decoding just the update part
for (let off = 0; off <= 5; off++) {
  try {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, new Uint8Array(blockMsg.slice(off)));
    const root = doc.getMap("root");
    console.log(`   ✅ Decoded with offset ${off}!`);
    console.log(`   Root keys: ${JSON.stringify(Array.from(root.keys()))}`);
    
    const blocks = root.get("blocks");
    if (blocks instanceof Y.Map) {
      console.log(`   Blocks: ${blocks.size}`);
      for (const [key, val] of blocks.entries()) {
        if (val instanceof Y.Map) {
          console.log(`     Block ${key}: type=${(val as Y.Map<unknown>).get("type")}`);
        }
      }
    }
    break;
  } catch { /* continue */ }
}

// Now try to decode individual char messages
console.log("\n═══ Deep Decode: Character Inserts ═══\n");
const charMsgs = [
  { data: "AAISAQGNlrj+BwBE0Zr2pA8IAUMA", char: "C" },
  { data: "AAIYAQGNlrj+BwHEjZa4/gcA0Zr2pA8IAUEA", char: "A" },
  { data: "AAIYAQGNlrj+BwfEjZa4/gcG0Zr2pA8IASAA", char: " (space)" },
];

for (const cm of charMsgs) {
  const buf = Buffer.from(cm.data, "base64");
  console.log(`Char '${cm.char}': ${Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join(" ")}`);
  console.log(`  Byte 0: ${buf[0]} (0x00 = sync protocol)`);
  console.log(`  Byte 1: ${buf[1]} (0x02 = update type)`);
  
  // Try decoding
  for (let off = 0; off <= 5; off++) {
    try {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, new Uint8Array(buf.slice(off)));
      console.log(`  ✅ Decoded at offset ${off}`);
      // Check what changed
      const root = doc.getMap("root");
      for (const [k, v] of root.entries()) {
        if (v instanceof Y.Map) {
          for (const [bk, bv] of (v as Y.Map<unknown>).entries()) {
            if (bv instanceof Y.Map) {
              const chars = (bv as Y.Map<unknown>).get("characters");
              if (chars instanceof Y.Array) {
                console.log(`  characters: ${JSON.stringify(chars.toArray())}`);
              }
            }
          }
        }
      }
      break;
    } catch { /* continue */ }
  }
  console.log();
}
