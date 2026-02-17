/**
 * Decode the browser's initial Y.UPDATE to see exact block structure.
 * Run: npx tsx scripts/decode-browser-update.ts
 */
import * as Y from "yjs";

// Full hex from interactive capture line 18-20 (the initial 499-byte frame)
// This is the FULL websocket frame: [0x00=sync, 0x02=update, varuint(495), ...495 bytes of V1 update]
const fullHex = "0002ef030114c0aee5ce0d0a270106626c6f636b730e623336353438393930303338303961353735305f696e69745f300527010869640001770e623336353438393930303338303961353735305f696e69745f30002701047479706500017709706172616772617068002701066e756d626572000177013000270107696e64656e7400017a0027010a73656c6563746f72496400017702300027010763617073756c6500017a00270108636f6e74656e74496400017700002701046d6f6465000177046e6f6e6500270106706172656e7400017700002701";
const fullBuf = Buffer.from(fullHex, "hex");

// The sync header is [0x00, 0x02, varuint(495)]
// varuint(495) = 0xEF, 0x03 (2 bytes)  
// So update data starts at offset 4
const updateData = fullBuf.slice(4);
console.log("Update data length:", updateData.length, "bytes");
console.log("First 30 bytes:", Array.from(updateData.slice(0, 30)));

// Apply to Y.Doc as V1
const doc = new Y.Doc();
try {
  Y.applyUpdate(doc, updateData);
  console.log("\nV1 decode SUCCESS");
  
  const root = doc.getMap("root");
  console.log("Root keys:", Array.from(root.keys()));
  
  const blocks = root.get("blocks") as Y.Map<unknown> | undefined;
  if (blocks) {
    for (const [key, val] of (blocks as any).entries()) {
      console.log("\nBlock:", key);
      if (val && (val as any).toJSON) {
        const j = (val as any).toJSON();
        console.log("  ALL FIELDS:", Object.keys(j).sort());
        for (const [k, v] of Object.entries(j).sort(([a], [b]) => a.localeCompare(b))) {
          console.log(`    ${k} = ${JSON.stringify(v)}`);
        }
      }
    }
  }
} catch (e) {
  console.log("V1 decode FAILED:", (e as Error).message);
  // Try V2
  try {
    Y.applyUpdateV2(doc, updateData);
    console.log("V2 decode SUCCESS");
  } catch (e2) {
    console.log("V2 also FAILED:", (e2 as Error).message);
  }
}
