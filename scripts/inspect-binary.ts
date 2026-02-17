/**
 * Deep binary inspection: understand exactly what the dump format is.
 */
import * as Y from "yjs";
import * as decoding from "lib0/decoding";
import { loadEncryptedCookie } from "../src/crypto.js";

const WS_ID = "45h7lom5ryjak34u";
const HOST = "inkabeam.nimbusweb.me";

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored) throw new Error("No cookie");
  const cookie = stored.cookie;

  // Use our V1-written page (small, known)
  const pageId = "7SGBAZlCo2B88dfg";
  console.log(`=== Page: ${pageId} ===`);

  const resp = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, {
    headers: { cookie },
  });
  const binary = new Uint8Array(await resp.arrayBuffer());
  console.log(`Size: ${binary.length} bytes`);
  console.log(`First 20 bytes hex: ${Array.from(binary.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

  // Try to decode header manually
  const decoder = decoding.createDecoder(binary);

  // Y.js update format starts with:
  //   varuint: number of client structs
  //   for each struct group:
  //     varuint: client ID
  //     varuint: clock start
  //     for each struct:
  //       byte: info (content type + additional info)
  console.log("\n--- Manual decode attempt ---");
  try {
    // First byte should be update format or a version byte
    const firstByte = decoding.readUint8(decoder);
    console.log(`First byte: ${firstByte} (0x${firstByte.toString(16)})`);

    // If firstByte is 0 or 1, it might be a version header
    // Then try reading the actual structure count
    const structCount = decoding.readVarUint(decoder);
    console.log(`Struct count (or next varuint): ${structCount}`);

    // Try reading next few values
    for (let i = 0; i < 5; i++) {
      try {
        const val = decoding.readVarUint(decoder);
        console.log(`  varuint[${i}]: ${val}`);
      } catch { break; }
    }
  } catch (e) {
    console.log(`Manual decode error: ${(e as Error).message}`);
  }

  // The key question: is this a V2 update with a version prefix?
  // Y.js V2 updates start with version byte 0x01 then the actual data
  // Let's try stripping the first byte and applying as V1
  console.log("\n--- Try skip first byte, apply as V1 ---");
  try {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, binary.slice(1));
    console.log("SUCCESS! Skipping first byte works for V1");
    const root = doc.getMap("root");
    console.log(`root keys: ${JSON.stringify(Array.from(root.keys()))}`);
  } catch (e) {
    console.log(`FAILED: ${(e as Error).message}`);
  }

  // Or maybe the format is: first byte = version, rest = V2 update
  console.log("\n--- Try skip first byte, apply as V2 ---");
  try {
    const doc = new Y.Doc();
    Y.applyUpdateV2(doc, binary.slice(1));
    console.log("SUCCESS! Skipping first byte works for V2");
    const root = doc.getMap("root");
    console.log(`root keys: ${JSON.stringify(Array.from(root.keys()))}`);
  } catch (e) {
    console.log(`FAILED: ${(e as Error).message}`);
  }

  // Try Y.encodeStateAsUpdate / Y.encodeStateAsUpdateV2 to understand expected format
  console.log("\n--- Create a known doc, compare format ---");
  const testDoc = new Y.Doc();
  testDoc.getMap("root").set("test", "hello");
  const v1Update = Y.encodeStateAsUpdate(testDoc);
  const v2Update = Y.encodeStateAsUpdateV2(testDoc);
  console.log(`V1 update first 20 bytes: [${Array.from(v1Update.slice(0, 20)).join(", ")}]`);
  console.log(`V2 update first 20 bytes: [${Array.from(v2Update.slice(0, 20)).join(", ")}]`);

  // What if the dump contains multiple updates concatenated?
  // Or what if it's a document state (not an update)?
  console.log("\n--- Try as document state (encodeStateVector + full state) ---");
  // In the WebSocket protocol, the server sends syncStep2 which IS an update
  // But the dump endpoint might use a different format

  // Actually let me check: does the WS URL have encv2=true? 
  // Our V1 writer dropped encv2=true from the URL
  // But maybe the server still stores in V2 format?
  
  // Let me look at the actual binary content as text to see structure
  console.log("\n--- Binary as text (showing readable segments) ---");
  const text = new TextDecoder('utf-8', { fatal: false }).decode(binary);
  const readable = text.replace(/[^\x20-\x7E\n]/g, '·');
  // Show first 500 chars
  console.log(readable.substring(0, 500));
}

main().catch(e => { console.error(e); process.exit(1); });
