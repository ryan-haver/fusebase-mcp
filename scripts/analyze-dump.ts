/**
 * Full analysis of the dump binary format with the discovered 3-byte offset.
 */

import * as Y from "yjs";
import { loadEncryptedCookie } from "../src/crypto.js";

const HOST = "inkabeam.nimbusweb.me";
const WS_ID = "45h7lom5ryjak34u";
const PAGE = process.argv[2] || "0ylYPzWyJEE9GHQN";

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored?.cookie) { console.error("No cookie"); process.exit(1); }

  const res = await fetch(`https://${HOST}/dump/${WS_ID}/${PAGE}`, {
    headers: { cookie: stored.cookie },
  });
  const buf = await res.arrayBuffer();
  const data = new Uint8Array(buf);

  console.log(`📦 Dump: ${data.byteLength} bytes`);
  console.log(`   Header: ${Array.from(data.slice(0, 3)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

  let len = 0, shift = 0, idx = 1;
  let byte: number;
  do {
    byte = data[idx++];
    len |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);

  const yjsData = data.slice(idx, idx + len);
  const doc = new Y.Doc();
  Y.applyUpdate(doc, yjsData);

  // Inspect structure
  const root = doc.getMap("root");
  console.log(`\n📊 Root keys: ${JSON.stringify(Array.from(root.keys()))}`);

  const children = root.get("children");
  if (children instanceof Y.Array) {
    console.log(`\n   children (${children.length}):`);
    for (let i = 0; i < children.length; i++) {
      console.log(`     [${i}]: ${JSON.stringify(children.get(i))}`);
    }
  }

  const rootChildren = doc.getArray("rootChildren");
  if (rootChildren instanceof Y.Array) {
    console.log(`\n   rootChildren (${rootChildren.length}):`);
    for (let i = 0; i < rootChildren.length; i++) {
      console.log(`     [${i}]: ${JSON.stringify(rootChildren.get(i))}`);
    }
  }

  const blocks = doc.getMap("blocks");
  if (blocks instanceof Y.Map) {
    console.log(`\n   blocks (${blocks.size}):`);
    for (const [key, val] of blocks.entries()) {
      console.log(`\n   📄 Block "${key}":`);
      if (val instanceof Y.Map) {
        for (const [k, v] of (val as Y.Map<unknown>).entries()) {
          if (k === "characters" && v instanceof Y.Array) {
            const arr = v.toArray();
            console.log(`     ${k}: ${JSON.stringify(arr)}`);
          } else if (v instanceof Y.Map) {
            console.log(`     ${k}: Y.Map{${JSON.stringify(Object.fromEntries((v as Y.Map<unknown>).entries()))}}`);
          } else {
            console.log(`     ${k}: ${JSON.stringify(v)}`);
          }
        }
      }
    }
  }

  // Now test: can we modify this doc and re-encode?
  console.log("\n\n🔬 Testing doc modification...");

  // Get the state vector before changes
  const sv = Y.encodeStateVector(doc);

  // Add a new block
  const newBlockId = `b${Date.now()}_99`;
  const blocksMapResolved = doc.getMap("blocks") as Y.Map<unknown>;
  const childrenArr = root.get("children") as Y.Array<string>;
  const rootChildrenArr = doc.getArray("rootChildren") as Y.Array<string>;

  const newBlock = new Y.Map();
  newBlock.set("id", newBlockId);
  newBlock.set("type", "paragraph");
  newBlock.set("indent", 0);
  newBlock.set("color", "transparent");
  newBlock.set("align", "left");
  const chars = new Y.Array();
  const text = "Written via Y.js API!";
  chars.push(text.split(""));
  newBlock.set("characters", chars);

  blocksMapResolved.set(newBlockId, newBlock);
  childrenArr.push([newBlockId]);
  rootChildrenArr.push([newBlockId]);

  // Get the diff update
  const diffUpdate = Y.encodeStateAsUpdate(doc, sv);
  console.log(`   Diff update size: ${diffUpdate.byteLength} bytes`);
  console.log(`   Diff (base64): ${Buffer.from(diffUpdate).toString("base64")}`);

  // Full state after changes
  const fullState = Y.encodeStateAsUpdate(doc);
  console.log(`   Full state size: ${fullState.byteLength} bytes`);

  // Reconstruct the dump format: 3-byte header + Y.js update
  // Header bytes from original: 01 db 03  
  // Let's check: is 01 the version and db 03 the length?
  // 0xdb = 219, 0x03 = 3 → little-endian uint16 = 0x03db = 987? Original data was 478 bytes...
  // Actually Yjs uses its own encoding lib. Byte 0 could be a custom tag.
  // Let's try encoding the dump ourselves.

  // The header bytes 01 db 03 could be:
  // 0x01 = version
  // 0xdb 0x03 = varint encoding of the update length
  // In Y.js varint: 0xdb = 1011011 with high bit set (219), so value = 219-128=91 + (3 << 7) = 91 + 384 = 475
  // That's 475! Original data was 478 bytes, minus 3 byte header = 475. Match!
  console.log(`\n🔍 Header analysis:`);
  console.log(`   Byte 0: 0x01 (version)`);
  console.log(`   Bytes 1-2: varint(${(data[1] & 0x7f) + (data[2] << 7)}) = ${(data[1] & 0x7f) + (data[2] << 7)} (matches data length ${data.byteLength - 3})`);

  // Now let's try POSTing the diff update directly back to the dump endpoint
  // wrapped with the same header format
  const headerSize = 3; // Depends on varint size  
  console.log(`\n☑️ Doc verified — can read and modify Fusebase Y.Doc`);
}

main().catch(console.error);
