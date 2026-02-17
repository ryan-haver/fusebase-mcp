/**
 * Capture exactly what the browser sends via WebSocket when a user types
 * something in an empty page. We connect via WebSocket, wait for SyncStep2,
 * then listen for any updates the browser may send for a page that HAS content.
 * 
 * Also: deep-inspect the Y.Doc structure at every level.
 * 
 * Run: npx tsx scripts/deep-inspect-doc.ts > data/deep-inspect.txt 2>&1
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

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const WS_ID = "45h7lom5ryjak34u";
const COOKIE = process.env.FUSEBASE_COOKIE!;

function inspectYType(val: unknown, indent: string = ""): void {
  if (val instanceof Y.Map) {
    const keys = Array.from(val.keys()).sort();
    console.log(`${indent}Y.Map (${keys.length} entries):`);
    for (const k of keys) {
      const v = val.get(k);
      if (v instanceof Y.Map || v instanceof Y.Array || v instanceof Y.Text || v instanceof Y.XmlElement || v instanceof Y.XmlFragment || v instanceof Y.XmlText) {
        console.log(`${indent}  "${k}" →`);
        inspectYType(v, indent + "    ");
      } else {
        console.log(`${indent}  "${k}" → (${typeof v}) ${JSON.stringify(v)}`);
      }
    }
  } else if (val instanceof Y.Array) {
    const items = val.toJSON();
    if (items.length <= 5) {
      console.log(`${indent}Y.Array[${items.length}]: ${JSON.stringify(items)}`);
    } else {
      console.log(`${indent}Y.Array[${items.length}]: ${JSON.stringify(items.slice(0, 3))}...`);
    }
    // Also check each item's type
    for (let i = 0; i < Math.min(val.length, 3); i++) {
      const item = val.get(i);
      if (item instanceof Y.Map || item instanceof Y.Array) {
        console.log(`${indent}  [${i}] →`);
        inspectYType(item, indent + "    ");
      }
    }
  } else if (val instanceof Y.Text) {
    console.log(`${indent}Y.Text: "${val.toString().slice(0, 100)}"`);
  } else {
    console.log(`${indent}${typeof val}: ${JSON.stringify(val)}`);
  }
}

async function main() {
  // Inspect our programmatic page dump
  const pageId = "GQpaE49Ecnkx5LEF"; // browser-exact page with content
  
  console.log(`=== Deep inspection of page ${pageId} ===\n`);
  
  const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, {
    headers: { cookie: COOKIE },
  });
  const buf = new Uint8Array(await res.arrayBuffer());
  console.log(`Dump size: ${buf.length} bytes`);
  
  // Parse dump header
  let len = 0, shift = 0, idx = 1;
  let byte: number;
  do {
    byte = buf[idx++];
    len |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  
  const data = buf.slice(idx, idx + len);
  const doc = new Y.Doc();
  Y.applyUpdate(doc, data);
  
  // Inspect ALL shared types in the doc
  console.log("\n--- All shared types in Y.Doc ---");
  console.log("doc.share keys:", Array.from((doc as any).share.keys()));
  
  for (const [name, type] of (doc as any).share.entries()) {
    console.log(`\nShared type "${name}" (${type.constructor.name}):`);
    inspectYType(type, "  ");
  }
  
  // Also check: what's the state vector?
  const sv = Y.encodeStateVector(doc);
  console.log("\n--- State vector ---");
  console.log("Length:", sv.length, "bytes");
  // Parse state vector: it's a map of clientID -> clock
  const decoder = new (await import("lib0/decoding")).Decoder(new Uint8Array(sv));
  const decMod = await import("lib0/decoding");
  const numClients = decMod.readVarUint(decoder);
  console.log("Number of clients in state vector:", numClients);
  for (let i = 0; i < numClients; i++) {
    const clientId = decMod.readVarUint(decoder);
    const clock = decMod.readVarUint(decoder);
    console.log(`  Client ${clientId}: clock=${clock}`);
  }
  
  // Also inspect the LATEST test page
  const latestPageId = "yao3yoKY5dZU41jn";
  console.log(`\n\n=== Deep inspection of LATEST page ${latestPageId} ===\n`);
  const res2 = await fetch(`https://${HOST}/dump/${WS_ID}/${latestPageId}`, {
    headers: { cookie: COOKIE },
  });
  const buf2 = new Uint8Array(await res2.arrayBuffer());
  console.log(`Dump size: ${buf2.length} bytes`);
  
  len = 0; shift = 0; idx = 1;
  do {
    byte = buf2[idx++];
    len |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  
  const data2 = buf2.slice(idx, idx + len);
  const doc2 = new Y.Doc();
  Y.applyUpdate(doc2, data2);
  
  console.log("\n--- All shared types in Y.Doc ---");
  console.log("doc.share keys:", Array.from((doc2 as any).share.keys()));
  
  for (const [name, type] of (doc2 as any).share.entries()) {
    console.log(`\nShared type "${name}" (${type.constructor.name}):`);
    inspectYType(type, "  ");
  }
  
  const sv2 = Y.encodeStateVector(doc2);
  const decoder2 = new (await import("lib0/decoding")).Decoder(new Uint8Array(sv2));
  const numClients2 = decMod.readVarUint(decoder2);
  console.log("\nNumber of clients in state vector:", numClients2);
  for (let i = 0; i < numClients2; i++) {
    const clientId = decMod.readVarUint(decoder2);
    const clock = decMod.readVarUint(decoder2);
    console.log(`  Client ${clientId}: clock=${clock}`);
  }
}

main().catch(console.error);
