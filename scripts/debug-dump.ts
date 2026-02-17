/**
 * Debug the dump binary format to find the correct Y.js update offset
 */
import * as Y from "yjs";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}
loadEnv();

async function main() {
  const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
  const WS_ID = "45h7lom5ryjak34u";
  const COOKIE = process.env.FUSEBASE_COOKIE!;

  // Fetch dump for our programmatic page
  const pageId = "GQpaE49Ecnkx5LEF";
  const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, {
    headers: { cookie: COOKIE },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  
  console.log("Dump length:", buf.length);
  console.log("Content-Type:", res.headers.get("content-type"));
  console.log("First 60 bytes hex:", buf.toString("hex").slice(0, 120));
  console.log("First 30 bytes decimal:", Array.from(buf.slice(0, 30)));
  
  // Try every offset from 0 to 10
  for (let off = 0; off <= 10; off++) {
    const data = buf.slice(off);
    
    // Try V1  
    try {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, data);
      const root = doc.getMap("root");
      const keys = Array.from(root.keys());
      console.log(`\nV1 at offset ${off}: root keys=[${keys}]`);
      if (keys.length > 0) {
        // Found it! Dump the structure
        const blk = root.get("blocks") as Y.Map<unknown>;
        if (blk) {
          for (const [k] of (blk as any).entries()) {
            console.log(`  block: ${k}`);
          }
        }
        break;
      }
    } catch (e) {
      const msg = (e as Error).message.slice(0, 60);
      if (off <= 3) console.log(`V1 at offset ${off}: ${msg}`);
    }
    
    // Try V2
    try {
      const doc = new Y.Doc();
      Y.applyUpdateV2(doc, data);
      const root = doc.getMap("root");
      const keys = Array.from(root.keys());
      console.log(`\nV2 at offset ${off}: root keys=[${keys}]`);
      if (keys.length > 0) {
        const blk = root.get("blocks") as Y.Map<unknown>;
        if (blk) {
          for (const [k] of (blk as any).entries()) {
            console.log(`  block: ${k}`);
          }
        }
        break;
      }
    } catch (e) {
      const msg = (e as Error).message.slice(0, 60);
      if (off <= 3) console.log(`V2 at offset ${off}: ${msg}`);
    }
  }
  
  // Also check: maybe the dump is a VARUINT-prefixed format
  // Read the first byte as a version, then a varuint length
  console.log("\n--- Trying varuint prefixed format ---");
  const version = buf[0];
  let len = 0, shift = 0, idx = 1;
  let byte: number;
  do {
    byte = buf[idx++];
    len |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  console.log(`Version: ${version}, Varuint length: ${len}, Data starts at offset: ${idx}`);
  console.log(`Remaining bytes: ${buf.length - idx}`);
  
  if (len > 0 && len <= buf.length - idx) {
    const data = buf.slice(idx, idx + len);
    try {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, data);
      const root = doc.getMap("root");
      const keys = Array.from(root.keys());
      console.log(`V1 after varuint: root keys=[${keys}]`);
      if (keys.length > 0) {
        console.log("SUCCESS!");
      }
    } catch (e) {
      console.log(`V1 after varuint failed: ${(e as Error).message.slice(0, 80)}`);
    }
    try {
      const doc = new Y.Doc();
      Y.applyUpdateV2(doc, data);
      const root = doc.getMap("root");
      const keys = Array.from(root.keys());
      console.log(`V2 after varuint: root keys=[${keys}]`);
      if (keys.length > 0) {
        console.log("SUCCESS with V2!");
        const blk = root.get("blocks") as Y.Map<unknown>;
        if (blk) {
          for (const [k, v] of (blk as any).entries()) {
            console.log(`  block "${k}":`);
            if (v && (v as any).toJSON) {
              const j = (v as any).toJSON();
              console.log(`    fields: ${Object.keys(j).sort().join(", ")}`);
            }
          }
        }
      }
    } catch (e) {
      console.log(`V2 after varuint failed: ${(e as Error).message.slice(0, 80)}`);
    }
  }
}

main().catch(console.error);
