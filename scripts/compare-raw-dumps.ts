/**
 * Compare binary dumps: browser-created vs our page  
 * Run: npx tsx scripts/compare-raw-dumps.ts
 */
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

async function getDump(pageId: string): Promise<Uint8Array> {
  const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
  return new Uint8Array(await res.arrayBuffer());
}

async function main() {
  // Browser-created page
  const browserDump = await getDump("1tZiv20EWydrHyaB");
  console.log("=== Browser page (1tZiv20EWydrHyaB) ===");
  console.log(`Size: ${browserDump.length}b`);
  console.log(`First 100 hex: ${Array.from(browserDump.slice(0, 100)).map(b => b.toString(16).padStart(2, "0")).join(" ")}`);
  
  // Extract readable strings  
  let readable = "";
  for (let i = 0; i < Math.min(browserDump.length, 500); i++) {
    const b = browserDump[i];
    if (b >= 0x20 && b < 0x7f) readable += String.fromCharCode(b);
    else readable += ".";
  }
  console.log(`Readable first 500: ${readable}`);

  console.log();

  // Our page
  const ourDump = await getDump("xKcskGPMdLI6WwT4");
  console.log("=== Our page (xKcskGPMdLI6WwT4) ===");
  console.log(`Size: ${ourDump.length}b`);
  console.log(`First 100 hex: ${Array.from(ourDump.slice(0, 100)).map(b => b.toString(16).padStart(2, "0")).join(" ")}`);
  
  readable = "";
  for (let i = 0; i < Math.min(ourDump.length, 500); i++) {
    const b = ourDump[i];
    if (b >= 0x20 && b < 0x7f) readable += String.fromCharCode(b);
    else readable += ".";
  }
  console.log(`Readable first 500: ${readable}`);

  // Look for specific structure names in both
  function findStrings(buf: Uint8Array): string[] {
    const strings: string[] = [];
    let current = "";
    for (let i = 0; i < buf.length; i++) {
      const b = buf[i];
      if (b >= 0x20 && b < 0x7f) { current += String.fromCharCode(b); }
      else {
        if (current.length >= 3) strings.push(current);
        current = "";
      }
    }
    if (current.length >= 3) strings.push(current);
    return strings;
  }

  console.log("\n=== Strings in browser dump (first 1000b) ===");
  const bStrings = findStrings(browserDump.slice(0, 1000));
  console.log(bStrings.join(", "));

  console.log("\n=== Strings in our dump ===");
  const oStrings = findStrings(ourDump);
  console.log(oStrings.join(", "));
}

main().catch(console.error);
