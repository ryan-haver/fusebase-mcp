/**
 * Fetch and compare dumps of browser-typed page vs our programmatic page.
 * Run: npx tsx scripts/compare-dumps.ts > data/compare-dumps.txt 2>&1
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

function decodeDump(dump: Uint8Array): Y.Doc {
  const doc = new Y.Doc();
  // Parse: version(1b) + varuint(length) + V1 update data
  let len = 0, shift = 0, idx = 1;
  let byte: number;
  do {
    byte = dump[idx++];
    len |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  
  const data = dump.slice(idx, idx + len);
  Y.applyUpdate(doc, data);
  return doc;
}

function dumpDocFull(doc: Y.Doc, label: string): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${"=".repeat(60)}`);
  
  const root = doc.getMap("root");
  const keys = Array.from(root.keys()).sort();
  console.log(`\nRoot keys: [${keys.join(", ")}]`);
  
  // For each root key, show type and value
  for (const k of keys) {
    const v = root.get(k);
    if (v instanceof Y.Array) {
      console.log(`\n"${k}" → Y.Array (len=${v.length})`);
      console.log(`  JSON: ${JSON.stringify(v.toJSON())}`);
    } else if (v instanceof Y.Map) {
      const mapKeys = Array.from(v.keys());
      console.log(`\n"${k}" → Y.Map (${mapKeys.length} entries)`);
      
      for (const [mk, mv] of (v as any).entries()) {
        if (mv instanceof Y.Map) {
          const blockKeys = Array.from(mv.keys()).sort();
          console.log(`\n  Entry "${mk}" → Y.Map (${blockKeys.length} fields)`);
          console.log(`    Fields: ${blockKeys.join(", ")}`);
          for (const bk of blockKeys) {
            const bv = mv.get(bk);
            if (bv instanceof Y.Array) {
              const arr = bv.toJSON();
              const text = arr.map((c: any) => {
                if (typeof c === "string") return c;
                if (typeof c === "object" && c !== null) return `{${Object.entries(c).map(([a,b]) => `${a}:${b}`).join(",")}}`;
                return String(c);
              }).join("");
              console.log(`    ${bk} → Y.Array[${arr.length}] = "${text.slice(0, 120)}"`);
            } else if (typeof bv === "string") {
              console.log(`    ${bk} → string = "${bv}"`);
            } else if (typeof bv === "number") {
              console.log(`    ${bk} → number = ${bv}`);
            } else if (typeof bv === "boolean") {
              console.log(`    ${bk} → boolean = ${bv}`);
            } else {
              console.log(`    ${bk} → ${typeof bv} = ${JSON.stringify(bv)}`);
            }
          }
        } else {
          console.log(`  Entry "${mk}" → ${typeof mv} = ${JSON.stringify(mv)}`);
        }
      }
    } else {
      console.log(`\n"${k}" → ${typeof v} = ${JSON.stringify(v)}`);
    }
  }
}

async function main() {
  // Page where user typed content
  const browserPageId = "GQpaE49Ecnkx5LEF";
  // Our last programmatic page (the one BEFORE user typed, from browser-exact test)
  // Actually this IS the same page — user typed into it! 
  // Let me use the earlier programmatic-only page
  const progPageId = "illgOpk0DimqTDxJ"; // E2E test with extra fields
  
  console.log("Fetching dumps...\n");
  
  const browserDump = await getDump(browserPageId);
  console.log(`Browser page (${browserPageId}): ${browserDump.length} bytes`);
  console.log(`  First 20 bytes: [${Array.from(browserDump.slice(0, 20))}]`);
  
  const progDump = await getDump(progPageId);
  console.log(`Programmatic page (${progPageId}): ${progDump.length} bytes`);
  console.log(`  First 20 bytes: [${Array.from(progDump.slice(0, 20))}]`);
  
  // Decode browser page (has BOTH our programmatic content AND user-typed content)
  const browserDoc = decodeDump(browserDump);
  dumpDocFull(browserDoc, "BROWSER PAGE (user typed into our programmatic page)");
  
  // Decode pure programmatic page
  const progDoc = decodeDump(progDump);
  dumpDocFull(progDoc, "PURE PROGRAMMATIC PAGE (no browser editing)");
}

main().catch(console.error);
