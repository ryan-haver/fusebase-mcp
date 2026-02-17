/**
 * Focused analysis: Compare EXACT browser bytes from HAR capture
 * with our generated messages byte-by-byte.
 *
 * The HAR captured these critical frames:
 *
 * Frame 1 SENT (Awareness): 
 *   [0x01, 0x0a, 0x01, 0xaf, 0xa7, 0xd9, 0xa9, 0x09, 0x00, 0x02, 0x7b, 0x7d] (12 bytes)
 *
 * Frame 2 RECV (SyncStep1): 
 *   [0x00, 0x00, 0x01, 0x00] (4 bytes)
 *
 * Frame 3 SENT (SyncStep2):
 *   [0x00, 0x01, 0xe6, 0x01, ...] (234 bytes total)
 *
 * Frame 5 SENT (Update for char 'T'):
 *   [0x00, 0x02, 0x15, ...] (23 bytes)
 *
 * Run: npx tsx scripts/analyze-browser-frames.ts
 */

import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";

console.log("=== BROWSER FRAME ANALYSIS ===\n");

// ─── Frame 1: AWARENESS ───
console.log("--- Frame 1: AWARENESS (SENT by browser) ---");
const browserAwareness = Buffer.from("010a01afa7d9a90900027b7d", "hex");
console.log(`Bytes: [${Array.from(browserAwareness).map(b => '0x'+b.toString(16).padStart(2,'0')).join(", ")}]`);
console.log(`Length: ${browserAwareness.length}`);

// Decode manually
let offset = 0;
console.log(`  [0] msgType: 0x${browserAwareness[offset].toString(16)} (awareness)`);
offset++;
console.log(`  [1] byte: 0x${browserAwareness[offset].toString(16)} (${browserAwareness[offset]})`);
// Is 0x0a the LENGTH of the rest? 0x0a = 10, rest is 10 bytes -> YES!
const restLen = browserAwareness.length - 2;
console.log(`  Rest of message: ${restLen} bytes (0x${browserAwareness[1].toString(16)} = ${browserAwareness[1]})`);
console.log(`  >>> Message format: [0x01(type), varuint(${browserAwareness[1]}=payloadLen), ...payload]`);
console.log(`  This means awareness wraps ALL data in a length-prefixed envelope!`);

// The awareness payload (bytes 2-11):
const awarenessPayload = browserAwareness.slice(2);
console.log(`  Payload: [${Array.from(awarenessPayload).map(b => '0x'+b.toString(16).padStart(2,'0')).join(", ")}]`);
// Decode awareness payload
let aOff = 0;
const aCount = awarenessPayload[aOff]; aOff++;
console.log(`  count: ${aCount}`);
// Client ID (varuint)
let clientId = 0, aShift = 0;
do {
  const b = awarenessPayload[aOff++];
  clientId |= (b & 0x7f) << aShift;
  aShift += 7;
  if (!(b & 0x80)) break;
} while (true);
console.log(`  clientId: ${clientId} (${clientId >>> 0})`);
const clock = awarenessPayload[aOff++];
console.log(`  clock: ${clock}`);
const strLen = awarenessPayload[aOff++];
console.log(`  stateLen: ${strLen}`);
const stateStr = Buffer.from(awarenessPayload.slice(aOff, aOff + strLen)).toString();
console.log(`  state: "${stateStr}"`);

// ─── Frame 2: SERVER SyncStep1 ───
console.log("\n--- Frame 2: SyncStep1 (RECV from server) ---");
const serverStep1 = Buffer.from("00000100", "hex");
console.log(`Bytes: [${Array.from(serverStep1).map(b => '0x'+b.toString(16).padStart(2,'0')).join(", ")}]`);
console.log(`  [0] msgType: 0x${serverStep1[0].toString(16)} (sync)`);
console.log(`  [1] subType: 0x${serverStep1[1].toString(16)} (step1)`);
console.log(`  [2] svLen: 0x${serverStep1[2].toString(16)} (${serverStep1[2]})`);
console.log(`  [3] sv data: 0x${serverStep1[3].toString(16)}`);

// Compare with standard y-protocols format
// standard: writeSyncStep1 writes: writeVarUint(0=step1), writeVarUint8Array(sv)
// So after outer messageType byte: [0x00(step1), 0x01(svLen), 0x00(sv)]
// Full: [msgType=0x00, 0x00, 0x01, 0x00]
// This matches! No extra length prefix on sync messages.

console.log(`  >>> Sync messages DO NOT have an extra length prefix.`);
console.log(`  >>> Format: [0x00(syncType), 0x00(step1Sub), 0x01(svLen=1), 0x00(sv)]`);
console.log(`  >>> This matches standard y-protocols format.`);

// ─── Frame 3: BROWSER SyncStep2 ───
console.log("\n--- Frame 3: SyncStep2 (SENT by browser) ---");
// From the HAR: first bytes are [00, 01, e6, 01, ...]
// 00 = sync type
// 01 = step2 sub
// e6, 01 = varuint for update length
// Decode varuint: (0xe6 & 0x7f) | ((0x01 & 0x7f) << 7) = 0x66 | 0x80 = 102 + 128 = 230
const updateLen = (0xe6 & 0x7f) | ((0x01 & 0x7f) << 7);
console.log(`  varuint(0xe6, 0x01) = ${updateLen} bytes of update data`);
console.log(`  Total message: 4 header bytes + ${updateLen} data bytes = ${4 + updateLen}`);
console.log(`  >>> Format: [0x00(sync), 0x01(step2), varuint(${updateLen}), ...updateData]`);
console.log(`  >>> This matches standard y-protocols format (NO extra length prefix)`);

// ─── Summary ───
console.log("\n=== FINDINGS ===\n");
console.log("1. SYNC messages: [0x00(type), sub, varuint(dataLen), ...data]");
console.log("   → Our encodeSyncMessage IS CORRECT for the sync type");
console.log("");
console.log("2. AWARENESS messages: [0x01(type), varuint(payloadLen), ...payload]");
console.log("   → The browser wraps awareness data WITH a length prefix");
console.log("   → Our code currently does: [0x01(type), varuint(count), ...data] = NO length prefix");
console.log("   → Standard awarenessProtocol.encodeAwarenessUpdate = just the payload");
console.log("   → Answer: awareness uses [0x01(type), varuint(payloadLen), ...payload]");
console.log("");

// However, let me also check if the mismatch in awareness could actually prevent writes...
// The server receives awareness and ignores it for content. The SYNC messages are what matter.
// Let me instead focus on whether we need the Fusebase-specific SyncStep2 format.

// ─── CRITICAL: Check if the y-protocols standard writeSyncStep2 uses V1 encoding ───
console.log("=== V1 vs V2 in SyncStep2 ===\n");
const doc = new Y.Doc();
doc.getMap("root").set("test", "hello");

const sv = Y.encodeStateVector(new Y.Doc()); // empty remote

// Standard y-protocols writeSyncStep2 
const stdEnc = encoding.createEncoder();
syncProtocol.writeSyncStep2(stdEnc, doc, sv);
const stdStep2 = encoding.toUint8Array(stdEnc);
console.log(`Standard writeSyncStep2: ${stdStep2.length} bytes`);
console.log(`  Starts: [${Array.from(stdStep2.slice(0, 10)).join(",")}]`);

// V1 manual
const v1Update = Y.encodeStateAsUpdate(doc, sv);
console.log(`V1 update: ${v1Update.length} bytes, starts: [${Array.from(v1Update.slice(0, 10)).join(",")}]`);

// V2 manual
const v2Update = Y.encodeStateAsUpdateV2(doc, sv);
console.log(`V2 update: ${v2Update.length} bytes, starts: [${Array.from(v2Update.slice(0, 10)).join(",")}]`);

// Check: does the standard step2 contain V1 or V2?
// Standard writeSyncStep2 calls encodeStateAsUpdate (V1)
// So if we use encv2=true, we must NOT use writeSyncStep2 because it sends V1!
console.log(`\nStandard step2 content matches V1: ${Buffer.from(stdStep2.slice(3)).slice(0, v1Update.length).equals(Buffer.from(v1Update))}`);
console.log(`Standard step2 content matches V2: ${Buffer.from(stdStep2.slice(3)).slice(0, v2Update.length).equals(Buffer.from(v2Update))}`);

console.log("\n>>> CRITICAL: If encv2=true, server expects V2 updates in SyncStep2,");
console.log("    but standard y-protocols writeSyncStep2 sends V1!");
console.log("    We MUST manually encode SyncStep2 with V2 data (which we do).");

// ─── Key remaining question: is our V2 SyncStep2 being accepted or rejected? ───
// From the test output, the server does NOT send an error. It just doesn't persist.
// Let's check if maybe the issue is that the server expects V1 even with encv2=true
// for the SyncStep2, but V2 for updates?

console.log("\n\n=== ALTERNATIVE THEORY ===");
console.log("Maybe the server expects:");
console.log("  SyncStep2: V1 encoding (always, even with encv2=true)");
console.log("  Updates (sub=2): V2 encoding (when encv2=true)");
console.log("  SyncStep1 URL param: standard y-protocols format");
console.log("");
console.log("Let's test by looking at the browser's SyncStep2 data.");
console.log("Browser doc has an initial empty paragraph → ~230 bytes V2 or ~300 bytes V1");
console.log("Browser sends 230 bytes → V2 (smaller = V2)");
console.log(">>> So NO, the browser DOES use V2 for SyncStep2.");

// ─── SyncStep1 URL parameter ───
console.log("\n\n=== SYNCSTEP1 URL PARAMETER FORMAT ===");
// Our exact-protocol test created: AAAHAZmao+sDDA==
// Decode it
const ourSyncStep1 = Buffer.from("AAAHAZmao+sDDA==", "base64");
console.log(`Our syncStep1 URL param decoded: [${Array.from(ourSyncStep1).join(",")}] (${ourSyncStep1.length}b)`);
// [0,0,7,1,...] - 0=sync, 0=step1, 7=svLen, 1,... = sv bytes
// But the standard y-protocols format is just: [0(step1Sub), svLen, sv]
// We have an EXTRA leading 0x00!! 

// Standard format
const stdEnc2 = encoding.createEncoder();
syncProtocol.writeSyncStep1(stdEnc2, doc);
const stdStep1 = encoding.toUint8Array(stdEnc2);
console.log(`Standard writeSyncStep1: [${Array.from(stdStep1).join(",")}] (${stdStep1.length}b)`);
// This is [0, svLen, sv] — just the step1 sub content

// Full message (with outer type byte)
console.log(`With outer sync type: [0, ${Array.from(stdStep1).join(",")}]`);
console.log("");
console.log(">>> Our syncStep1 URL param has format: [0x00(syncType), 0x00(step1Sub), svLen, sv]");
console.log(">>> But the browser might only send: [0x00(step1Sub), svLen, sv] in URL param");
console.log(">>> because the outer 0x00 sync type is IMPLICIT in the context 'syncStep1'");
console.log("");

// Actually — let me reconsider. The URL parameter is 'syncStep1' which the server 
// processes as a sync protocol message. Let me check what format the browser actually 
// sends by checking the query string from the HAR capture.

console.log("TO VERIFY: We need the browser's syncStep1 URL parameter from the HAR or CDP capture.");
console.log("This might be the root cause if the server parses it differently.");

process.exit(0);
