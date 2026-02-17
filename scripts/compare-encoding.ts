/**
 * Compare our manual encoding vs the standard y-protocols/sync encoding.
 * The issue might be subtle differences in the message format.
 * 
 * Run: npx tsx scripts/compare-encoding.ts
 */

import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";

// Create a doc with some content
const ydoc = new Y.Doc();
const root = ydoc.getMap("root");
ydoc.transact(() => {
  const children = new Y.Array<string>();
  const rootChildren = new Y.Array<string>();
  const blocksMap = new Y.Map();
  const blockId = `b${Date.now()}_0`;
  const bm = new Y.Map();
  bm.set("id", blockId);
  bm.set("type", "paragraph");
  bm.set("indent", 0);
  bm.set("color", "transparent");
  bm.set("align", "left");
  const chars = new Y.Array();
  for (const c of "Hello") chars.push([c]);
  bm.set("characters", chars);
  blocksMap.set(blockId, bm);
  children.push([blockId]);
  rootChildren.push([blockId]); 
  root.set("children", children);
  root.set("rootChildren", rootChildren);
  root.set("blocks", blocksMap);
});

console.log("=== ENCODING COMPARISON ===\n");
console.log(`Doc clientID: ${ydoc.clientID}`);

// --- Our manual SyncStep1 ---
function manualSyncStep1(doc: Y.Doc): Uint8Array {
  const sv = Y.encodeStateVector(doc);
  const header: number[] = [0x00, 0x00]; // type=sync, sub=step1
  // writeVarUint for length
  let n = sv.length;
  while (n > 0x7f) { header.push(0x80 | (n & 0x7f)); n >>>= 7; }
  header.push(n & 0x7f);
  const msg = new Uint8Array(header.length + sv.length);
  msg.set(header);
  msg.set(sv, header.length);
  return msg;
}

// --- Standard y-protocols SyncStep1 ---
function protocolSyncStep1(doc: Y.Doc): Uint8Array {
  const enc = encoding.createEncoder();
  syncProtocol.writeSyncStep1(enc, doc);
  return encoding.toUint8Array(enc);
}

const manual1 = manualSyncStep1(ydoc);
const protocol1 = protocolSyncStep1(ydoc);

console.log("\n--- SyncStep1 ---");
console.log(`Manual:   [${Array.from(manual1).join(",")}] (${manual1.length}b)`);
console.log(`Protocol: [${Array.from(protocol1).join(",")}] (${protocol1.length}b)`);
console.log(`Match: ${Buffer.from(manual1).equals(Buffer.from(protocol1))}`);

// --- SyncStep2 (responding to empty state vector) ---
const emptyDoc = new Y.Doc();
const emptySv = Y.encodeStateVector(emptyDoc);

function manualSyncStep2(doc: Y.Doc, sv: Uint8Array): Uint8Array {
  const update = Y.encodeStateAsUpdateV2(doc, sv);
  const header: number[] = [0x00, 0x01]; // type=sync, sub=step2
  let n = update.length;
  while (n > 0x7f) { header.push(0x80 | (n & 0x7f)); n >>>= 7; }
  header.push(n & 0x7f);
  const msg = new Uint8Array(header.length + update.length);
  msg.set(header);
  msg.set(update, header.length);
  return msg;
}

function protocolSyncStep2V2(doc: Y.Doc, sv: Uint8Array): Uint8Array {
  const enc = encoding.createEncoder();
  // y-protocols writeSyncStep2 encodes the doc as a V1 update by default
  // but we need V2 for encv2=true mode
  // Let's see what writeSyncStep2 actually does:
  const update = Y.encodeStateAsUpdate(doc, sv); // V1!!
  encoding.writeVarUint(enc, 0); // messageYjsSyncStep2
  encoding.writeVarUint8Array(enc, update);
  return encoding.toUint8Array(enc);
}

function protocolSyncStep2V1(doc: Y.Doc, sv: Uint8Array): Uint8Array {
  const enc = encoding.createEncoder();
  syncProtocol.writeSyncStep2(enc, doc, sv);
  return encoding.toUint8Array(enc);
}

const manual2v2 = manualSyncStep2(ydoc, emptySv);
const proto2v1 = protocolSyncStep2V1(ydoc, emptySv);

console.log("\n--- SyncStep2 ---");
console.log(`Manual (V2): [${Array.from(manual2v2.slice(0, 30)).join(",")}...] (${manual2v2.length}b)`);
console.log(`Protocol (V1): [${Array.from(proto2v1.slice(0, 30)).join(",")}...] (${proto2v1.length}b)`);

// Key insight: the standard syncProtocol.writeSyncStep2 uses V1 encoding!
// Check what encoding format the standard uses
console.log("\n--- KEY INSIGHT ---");
const v1Update = Y.encodeStateAsUpdate(ydoc, emptySv);
const v2Update = Y.encodeStateAsUpdateV2(ydoc, emptySv);
console.log(`V1 update: ${v1Update.length} bytes, first=[${Array.from(v1Update.slice(0, 10)).join(",")}]`);
console.log(`V2 update: ${v2Update.length} bytes, first=[${Array.from(v2Update.slice(0, 10)).join(",")}]`);

// --- Now test: what does the BROWSER's SyncStep2 look like? ---
// From the HAR capture: Frame 3: [00, 01, e6,01, ...] 
// 00 = sync type
// 01 = step2
// e6,01 = varuint for 230 (0xe6 = 0x66 | 0x80 = 102+128=230? No...)
// Actually: e6 = 1100110 with high bit = 0x66 (102), 01 = 1 
// varuint decode: (0xe6 & 0x7f) | (0x01 << 7) = 102 | 128 = 230
// So the update is 230 bytes
console.log(`\nBrowser SyncStep2 format: [0x00, 0x01, varuint(230), ...230 bytes of update]`);
console.log(`Our header:  [0x00, 0x01, varuint(${v2Update.length})]`);

// --- Update message encoding ---
function manualUpdate(doc: Y.Doc, sv: Uint8Array): Uint8Array {
  const update = Y.encodeStateAsUpdateV2(doc, sv);
  const header: number[] = [0x00, 0x02]; // type=sync, sub=update
  let n = update.length;
  while (n > 0x7f) { header.push(0x80 | (n & 0x7f)); n >>>= 7; }
  header.push(n & 0x7f);
  const msg = new Uint8Array(header.length + update.length);
  msg.set(header);
  msg.set(update, header.length);
  return msg;
}

console.log("\n--- Update Encoding ---");
const manualUpd = manualUpdate(ydoc, emptySv);
console.log(`Manual update: [${Array.from(manualUpd.slice(0, 30)).join(",")}...] (${manualUpd.length}b)`);

// Check: does the standard y-protocols HAVE a V2 mode?
console.log("\n--- y-protocols API check ---");
console.log(`syncProtocol keys: ${Object.keys(syncProtocol).join(", ")}`);
console.log(`Y keys with 'V2': ${Object.keys(Y).filter(k => k.includes("V2")).join(", ")}`);

// --- awareness encoding ---
function manualAwareness(clientId: number): Uint8Array {
  const buf: number[] = [0x01];
  let n = 1; // count
  while (n > 0x7f) { buf.push(0x80 | (n & 0x7f)); n >>>= 7; }
  buf.push(n & 0x7f);
  n = clientId;
  while (n > 0x7f) { buf.push(0x80 | (n & 0x7f)); n >>>= 7; }
  buf.push(n & 0x7f);
  n = 0; // clock
  buf.push(n & 0x7f);
  const sb = new TextEncoder().encode("{}");
  n = sb.length;
  while (n > 0x7f) { buf.push(0x80 | (n & 0x7f)); n >>>= 7; }
  buf.push(n & 0x7f);
  const r = new Uint8Array(buf.length + sb.length);
  r.set(buf);
  r.set(sb, buf.length);
  return r;
}

// Standard awareness
const awareness = new awarenessProtocol.Awareness(ydoc);
awareness.setLocalState({});
const protoAwareness = awarenessProtocol.encodeAwarenessUpdate(awareness, [ydoc.clientID]);

const manualAw = manualAwareness(ydoc.clientID);
console.log("\n--- Awareness ---");
console.log(`Manual:   [${Array.from(manualAw).join(",")}] (${manualAw.length}b)`);
console.log(`Protocol: [${Array.from(protoAwareness).join(",")}] (${protoAwareness.length}b)`);
console.log(`Match: ${Buffer.from(manualAw).equals(Buffer.from(protoAwareness))}`);

// The browser sends: [01, 0a, 01, af,a7,d9,a9,09, 00, 02, 7b,7d]
// Let's decode: 01=awareness, 0a=? 
// Wait, 0a in the browser capture...
// Ah - the browser awareness message wraps with a MESSAGE_AWARENESS header
// In y-protocols, the message type is written first:
// encoding.writeVarUint(encoder, messageAwareness) // = 1
// Then the awareness data
// So the full message is: [messageType=1, ...awarenessData]
// But our manual encoding already starts with 0x01 as the first byte...
// 
// Actually, let me re-read the browser frame: [01, 0a, 01, af,a7,d9,a9,09, 00, 02, 7b,7d]
// 01 = messageAwareness (the Fusebase wrapper)
// 0a = varuint length of the awareness data? (10 bytes)
// Then: 01 = count of clients, 
// af,a7,d9,a9,09 = varuint clientId (BIG number)
// 00 = clock
// 02 = varuint string length (2 bytes)
// 7b,7d = "{}"

// Hmm wait — does the server expect [messageType, varuintLength, ...data]?
// That would be: [0x01, 0x0a, 0x01, <clientId>, 0x00, 0x02, 0x7b, 0x7d]
// 0x0a = 10, which is length of awareness payload

console.log("\n--- CRITICAL: Browser awareness format analysis ---");
// Browser: [01, 0a, 01, af,a7,d9,a9,09, 00, 02, 7b,7d]
// 01 = message type (awareness)
// 0a = 10 (varuint) - length of the remaining awareness payload
// 01 = 1 (client count)
// af,a7,d9,a9,09 = varuint client ID (let's decode)
const browserClientBytes = [0xaf, 0xa7, 0xd9, 0xa9, 0x09];
let browserCid = 0, shift = 0;
for (const b of browserClientBytes) {
  browserCid |= (b & 0x7f) << shift;
  shift += 7;
}
console.log(`Browser clientId: ${browserCid}`);
console.log(`Browser awareness: [01, 0a(len=10), 01(count=1), clientId(5b), 00(clock=0), 02(strLen=2), 7b,7d("{}")]`);

// Our awareness: [01, 01, clientId, 00, 02, 7b, 7d]
// We're MISSING the length prefix after the message type!
console.log(`\nOur awareness starts with: [01, 01(count), ...clientId, 00(clock), ...]`);
console.log(`Browser starts with: [01, 0a(PAYLOAD_LENGTH=10), 01(count), ...clientId, 00(clock), ...]`);
console.log(`\n>>> MISMATCH: We're missing the PAYLOAD LENGTH after the message type byte! <<<`);
