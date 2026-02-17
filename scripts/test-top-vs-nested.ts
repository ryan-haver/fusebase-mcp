/**
 * Test: are `blocks` and `rootChildren` top-level or nested?
 * 
 * When we do doc.getMap("root").set("blocks", new Y.Map()), 
 * does Y.js create a new top-level shared type named "blocks"?
 * No — it creates a sub-item inside the "root" shared type.
 *
 * Let's verify by testing both access patterns.
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

// Compare both pages
async function inspectPage(pageId: string, label: string) {
  const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, {
    headers: { cookie: COOKIE },
  });
  const buf = new Uint8Array(await res.arrayBuffer());
  
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
  
  console.log(`\n=== ${label} (${pageId}) - ${buf.length}b ===`);
  console.log("doc.share keys:", Array.from((doc as any).share.keys()));
  
  // Check if blocks/rootChildren are accessible as top-level or nested
  const topBlocksMap = doc.getMap("blocks");
  const topRootChildren = doc.getArray("rootChildren");
  
  const root = doc.getMap("root");
  const nestedBlocks = root.get("blocks") as Y.Map<unknown> | undefined;
  const nestedChildren = root.get("children") as Y.Array<string> | undefined;
  const nestedRootChildren = root.get("rootChildren") as Y.Array<string> | undefined;
  
  console.log("\nTop-level access:");
  console.log(`  doc.getMap("blocks"): ${topBlocksMap.size} entries`);
  console.log(`  doc.getArray("rootChildren"): length=${topRootChildren.length}`);
  
  console.log("\nNested access (root.get):");
  console.log(`  root.get("blocks"): ${nestedBlocks ? `${Array.from(nestedBlocks.keys()).length} entries` : "null"}`);
  console.log(`  root.get("children"): ${nestedChildren ? `length=${nestedChildren.length}` : "null"}`);
  console.log(`  root.get("rootChildren"): ${nestedRootChildren ? `length=${nestedRootChildren.length}` : "null"}`);
  
  // Are they the SAME objects?
  if (nestedBlocks) {
    console.log(`\n  topBlocksMap === nestedBlocks: ${topBlocksMap === nestedBlocks}`);
  }
  if (nestedRootChildren) {
    console.log(`  topRootChildren === nestedRootChildren: ${topRootChildren === nestedRootChildren}`);
  }
  
  // Dump top-level blocks entries
  if (topBlocksMap.size > 0) {
    console.log("\n  Top-level blocks entries:");
    for (const [k] of topBlocksMap.entries()) {
      console.log(`    "${k}"`);
    }
  }
  
  // Dump top-level rootChildren
  if (topRootChildren.length > 0) {
    console.log("\n  Top-level rootChildren:");
    console.log(`    ${JSON.stringify(topRootChildren.toJSON())}`);
  }
}

async function main() {
  // Our browser-exact test page
  await inspectPage("GQpaE49Ecnkx5LEF", "BROWSER-EXACT PAGE (typed in by user)");
  
  // Our latest E2E page
  await inspectPage("yao3yoKY5dZU41jn", "LATEST E2E PAGE (blocks with 10 fields)");
  
  // Also create a test showing what happens with BOTH approaches
  console.log("\n\n=== Local test: nested vs top-level ===");
  
  const doc1 = new Y.Doc();
  doc1.transact(() => {
    const root = doc1.getMap("root");
    root.set("blocks", new Y.Map());
    root.set("children", new Y.Array());
    root.set("rootChildren", new Y.Array());
    
    const blocks = root.get("blocks") as Y.Map<unknown>;
    const bm = new Y.Map();
    bm.set("id", "test1");
    bm.set("type", "paragraph");
    blocks.set("test1", bm);
    
    (root.get("children") as Y.Array<string>).push(["test1"]);
    (root.get("rootChildren") as Y.Array<string>).push(["test1"]);
  });
  
  console.log("\nNested approach (root.set('blocks', ..)):");
  console.log("  doc.share keys:", Array.from((doc1 as any).share.keys()));
  console.log("  doc.getMap('root').keys:", Array.from(doc1.getMap("root").keys()));
  console.log("  doc.getMap('blocks').size:", doc1.getMap("blocks").size);
  
  const doc2 = new Y.Doc();
  doc2.transact(() => {
    const blocks = doc2.getMap("blocks");
    const children = doc2.getArray("children");
    const rootChildren = doc2.getArray("rootChildren");
    
    const bm = new Y.Map();
    bm.set("id", "test2");
    bm.set("type", "paragraph");
    blocks.set("test2", bm);
    
    children.push(["test2"]);
    rootChildren.push(["test2"]);
  });
  
  console.log("\nTop-level approach (doc.getMap('blocks')):");
  console.log("  doc.share keys:", Array.from((doc2 as any).share.keys()));
  console.log("  doc.getMap('blocks').size:", doc2.getMap("blocks").size);
  console.log("  doc.getArray('children').length:", doc2.getArray("children").length);
  console.log("  doc.getArray('rootChildren').length:", doc2.getArray("rootChildren").length);
  
  // Compare update sizes
  const u1 = Y.encodeStateAsUpdate(doc1);
  const u2 = Y.encodeStateAsUpdate(doc2);
  console.log("\nUpdate size nested:", u1.length, "bytes");
  console.log("Update size top-level:", u2.length, "bytes");
  console.log("\nNested hex:", Buffer.from(u1).toString("hex"));
  console.log("Top-level hex:", Buffer.from(u2).toString("hex"));
}

main().catch(console.error);
