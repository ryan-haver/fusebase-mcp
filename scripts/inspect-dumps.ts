/**
 * Inspect dumps of different pages to understand the format.
 * Run: npx tsx scripts/inspect-dumps.ts > data/inspect-dumps.txt 2>&1
 */
import * as Y from "yjs";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { loadEncryptedCookie } from "../src/crypto.js";

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
const stored = loadEncryptedCookie();
const COOKIE = stored?.cookie || process.env.FUSEBASE_COOKIE!;

async function inspectDump(pageId: string, label: string) {
  console.log(`\n=== ${label}: ${pageId} ===`);
  const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
  const buf = new Uint8Array(await res.arrayBuffer());
  console.log(`Size: ${buf.length}b`);
  console.log(`First 60 bytes: ${Array.from(buf.slice(0, 60)).map(b => b.toString(16).padStart(2, "0")).join(" ")}`);
  
  // Check if it's a Y.js V1 update
  const d1 = new Y.Doc();
  try { 
    Y.applyUpdate(d1, buf); 
    console.log(`V1 parse: OK`);
    console.log(`  Share keys: ${JSON.stringify(Array.from(d1.share.keys()))}`);
    const blocks = d1.getMap("blocks");
    console.log(`  blocks: ${blocks.size}`);
    if (blocks.size > 0) {
      const firstKey = Array.from(blocks.keys())[0];
      const firstBlock = blocks.get(firstKey) as Y.Map<any>;
      if (firstBlock instanceof Y.Map) {
        console.log(`  First block keys: ${JSON.stringify(Array.from(firstBlock.keys()))}`);
        console.log(`  First block type: ${firstBlock.get("type")}`);
      }
    }
    const rootChildren = d1.getArray("rootChildren");
    console.log(`  rootChildren: ${rootChildren.length}`);
    return;
  } catch (e) { 
    console.log(`V1 parse: FAIL — ${(e as Error).message.substring(0, 80)}`);
  }
  
  // Check if it's V2
  const d2 = new Y.Doc();
  try { 
    Y.applyUpdateV2(d2, buf); 
    console.log(`V2 parse: OK`);
    console.log(`  Share keys: ${JSON.stringify(Array.from(d2.share.keys()))}`);
    return;
  } catch (e) { 
    console.log(`V2 parse: FAIL — ${(e as Error).message.substring(0, 80)}`);
  }

  // Maybe it's a log of multiple updates? Each one prefixed with length?
  console.log("\nTrying to parse as concatenated length-prefixed updates...");
  let offset = 0;
  let count = 0;
  const doc = new Y.Doc();
  while (offset < buf.length && count < 200) {
    // Read varuint length
    let len = 0, shift = 0, pos = offset;
    while (pos < buf.length) {
      const byte = buf[pos++];
      len |= (byte & 0x7f) << shift;
      shift += 7;
      if ((byte & 0x80) === 0) break;
    }
    if (len === 0 || pos + len > buf.length) {
      console.log(`  offset=${offset}: varuint len=${len}, remaining=${buf.length - pos}, STOP`);
      break;
    }
    const update = buf.slice(pos, pos + len);
    try {
      Y.applyUpdate(doc, update);
      count++;
      if (count <= 5) console.log(`  Update #${count}: offset=${offset}, len=${len} → V1 OK`);
    } catch {
      try {
        Y.applyUpdateV2(doc, update);
        count++;
        if (count <= 5) console.log(`  Update #${count}: offset=${offset}, len=${len} → V2 OK`);
      } catch {
        if (count <= 5) console.log(`  Update #${count}: offset=${offset}, len=${len} → BOTH FAIL`);
        break;
      }
    }
    offset = pos + len;
  }
  if (count > 0) {
    console.log(`  Total updates parsed: ${count}`);
    console.log(`  Share keys: ${JSON.stringify(Array.from(doc.share.keys()))}`);
    console.log(`  blocks: ${doc.getMap("blocks").size}`);
    console.log(`  rootChildren: ${doc.getArray("rootChildren").length}`);
  }
}

async function main() {
  // Browser-created page
  await inspectDump("1tZiv20EWydrHyaB", "Browser-created page");
  
  // Our fixed protocol page  
  await inspectDump("xKcskGPMdLI6WwT4", "Our fixed-protocol page");

  // Our no-encv2 page
  await inspectDump("8CGOruc9rDiBQf32", "Our no-encv2 page");

  console.log("\nDone.");
}

main().catch(console.error);
