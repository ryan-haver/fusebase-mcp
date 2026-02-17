/**
 * Compare browser page content with our programmatic page content.
 * Reads the dump from both a browser-created page and our programmatic page,
 * then decodes and compares the Y.Doc structures.
 * 
 * Run: npx tsx scripts/compare-structures.ts > data/compare-output.txt 2>&1
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

async function getDump(pageId: string): Promise<Uint8Array> {
  const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, {
    headers: { cookie: COOKIE },
  });
  return new Uint8Array(await res.arrayBuffer());
}

function decodeDoc(dump: Uint8Array, label: string): void {
  console.log(`\n=== ${label} ===`);
  console.log(`Dump: ${dump.length}b`);
  
  // The dump format: first byte might be version, then Y.js update data
  // Try multiple offset starts
  for (const offset of [0, 1, 2]) {
    const data = dump.slice(offset);
    const doc = new Y.Doc();
    let applied = false;
    
    for (const [name, applyFn] of [
      ["V1", (d: Uint8Array) => Y.applyUpdate(doc, d)],
      ["V2", (d: Uint8Array) => Y.applyUpdateV2(doc, d)],
    ] as [string, (d: Uint8Array) => void][]) {
      try {
        applyFn(data);
        applied = true;
        console.log(`  offset=${offset} ${name}: SUCCESS`);
        
        const root = doc.getMap("root");
        console.log(`  Root keys: [${Array.from(root.keys()).join(", ")}]`);
        
        // Dump children array
        const ch = root.get("children") as Y.Array<string> | undefined;
        console.log(`  children: ${ch ? ch.toJSON() : "undefined"}`);
        
        const rch = root.get("rootChildren") as Y.Array<string> | undefined;
        console.log(`  rootChildren: ${rch ? rch.toJSON() : "undefined"}`);
        
        // Dump blocks
        const blk = root.get("blocks") as Y.Map<unknown> | undefined;
        if (blk) {
          console.log(`  blocks count: ${Array.from(blk.keys()).length}`);
          for (const [key, val] of (blk as any).entries()) {
            console.log(`\n  Block "${key}":`);
            if (val && (val as any).toJSON) {
              const j = (val as any).toJSON();
              const keys = Object.keys(j).sort();
              console.log(`    Fields (${keys.length}): ${keys.join(", ")}`);
              for (const k of keys) {
                const v = j[k];
                if (k === "characters" && Array.isArray(v)) {
                  const text = v.map((c: any) => typeof c === "string" ? c : `[${JSON.stringify(c)}]`).join("");
                  console.log(`    ${k}: "${text.slice(0, 100)}"`);
                } else {
                  console.log(`    ${k}: ${JSON.stringify(v)}`);
                }
              }
            }
          }
        }
        break;
      } catch (e) {
        // try next
      }
    }
    
    if (applied) break;
  }
}

async function main() {
  // Our programmatic page
  const ourPageId = "GQpaE49Ecnkx5LEF"; // Latest browser-exact test
  const ourDump = await getDump(ourPageId);
  decodeDoc(ourDump, "OUR PROGRAMMATIC PAGE");
  
  // Now let's also check: what does a FRESH empty page look like?
  // We'll check the existing test pages
  const emptyPageId = "x7V7BHf15CUqVAV5"; // Created earlier but never written to
  const emptyDump = await getDump(emptyPageId);
  decodeDoc(emptyDump, "EMPTY PAGE (never written)");
  
  // Let's try to find a page that was manually edited in the browser
  // We'll use the Fusebase API to list recent pages
  const listRes = await fetch(`https://${HOST}/api/page/workspace/${WS_ID}/list/root?limit=20`, {
    headers: { cookie: COOKIE },
  });
  if (listRes.ok) {
    const pages = (await listRes.json()) as any[];
    console.log(`\n\n=== WORKSPACE PAGES ===`);
    for (const p of pages.slice(0, 10)) {
      console.log(`  ${p.globalId || p.noteId || p.id} — "${p.title}" (${p.type || 'note'})`);
    }
    
    // Find a page with actual content (non-test page)
    const nonTestPage = pages.find((p: any) => 
      p.title && !p.title.includes("Test") && !p.title.includes("E2E") && !p.title.includes("BrowserExact")
    );
    
    if (nonTestPage) {
      const pid = nonTestPage.globalId || nonTestPage.noteId;
      console.log(`\nChecking non-test page: "${nonTestPage.title}" (${pid})`);
      const dump = await getDump(pid);
      decodeDoc(dump, `BROWSER PAGE: "${nonTestPage.title}"`);
    }
  }
}

main().catch(console.error);
