/**
 * Compare: Create a page via browser (Playwright), type content,
 * then fetch the dump and decode it to see exact Y.Doc structure.
 * Also fetch dump of our programmatic page for side-by-side comparison.
 * 
 * Run: npx tsx scripts/compare-browser-vs-ours.ts > data/compare-browser.txt 2>&1
 */
import * as Y from "yjs";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

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
  // Format: version(1b) + varuint(length) + V1 update data
  const doc = new Y.Doc();
  const data = dump.slice(3); // skip version byte + 2-byte varuint for small dumps
  
  // Try at offset 3 first, then try header parsing
  try {
    Y.applyUpdate(doc, data);
    return doc;
  } catch {}
  
  // Parse varuint length properly
  let len = 0, shift = 0, idx = 1;
  let byte: number;
  do {
    byte = dump[idx++];
    len |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  
  const vdata = dump.slice(idx, idx + len);
  Y.applyUpdate(doc, vdata);
  return doc;
}

function dumpDocStructure(doc: Y.Doc, label: string): void {
  console.log(`\n========== ${label} ==========`);
  const root = doc.getMap("root");
  console.log(`Root keys: [${Array.from(root.keys()).sort().join(", ")}]`);
  
  const ch = root.get("children") as Y.Array<string> | undefined;
  console.log(`children type: ${ch?.constructor.name} length: ${ch?.length}`);
  if (ch) console.log(`  values: [${ch.toJSON().join(", ")}]`);
  
  const rch = root.get("rootChildren") as Y.Array<string> | undefined;
  console.log(`rootChildren type: ${rch?.constructor.name} length: ${rch?.length}`);
  if (rch) console.log(`  values: [${rch.toJSON().join(", ")}]`);
  
  const blk = root.get("blocks") as Y.Map<unknown> | undefined;
  if (blk) {
    const keys = Array.from(blk.keys());
    console.log(`blocks type: ${blk.constructor.name} count: ${keys.length}`);
    for (const [key, val] of (blk as any).entries()) {
      console.log(`\n  Block "${key}" (type: ${val?.constructor.name}):`);
      if (val instanceof Y.Map) {
        const mapKeys = Array.from(val.keys()).sort();
        console.log(`    Fields (${mapKeys.length}): ${mapKeys.join(", ")}`);
        for (const k of mapKeys) {
          const v = val.get(k);
          if (v instanceof Y.Array) {
            const arr = v.toJSON();
            const text = arr.map((c: any) => typeof c === "string" ? c : `[${JSON.stringify(c)}]`).join("");
            console.log(`    ${k} (Y.Array[${arr.length}]): "${text.slice(0, 100)}"`);
          } else {
            console.log(`    ${k} (${typeof v}): ${JSON.stringify(v)}`);
          }
        }
      }
    }
  }
  
  // Check for any other root keys
  for (const k of root.keys()) {
    if (k !== "children" && k !== "rootChildren" && k !== "blocks") {
      const v = root.get(k);
      console.log(`\n  Extra root key "${k}" type: ${v?.constructor.name}`);
    }
  }
}

async function main() {
  console.log("=== BROWSER vs PROGRAMMATIC COMPARISON ===\n");
  
  // 1. Create a page and type content with Playwright
  console.log("Step 1: Creating page via browser with Playwright...\n");
  
  const pageId = await createPage("BrowserType Test " + new Date().toISOString());
  console.log(`Created page: ${pageId}`);
  const pageUrl = `https://${HOST}/ws/${WS_ID}/note/${pageId}`;
  console.log(`URL: ${pageUrl}`);
  
  // Parse COOKIE string into array of cookie objects
  const cookieParts = COOKIE.split(";").map(c => c.trim()).filter(Boolean);
  const cookies = cookieParts.map(c => {
    const eq = c.indexOf("=");
    return {
      name: c.slice(0, eq),
      value: c.slice(eq + 1),
      domain: HOST,
      path: "/",
    };
  });
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  
  const page = await context.newPage();
  await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 30000 });
  
  // Wait for editor to load
  await page.waitForTimeout(5000);
  
  // Type some content
  console.log("Typing content in editor...");
  
  // Click on the editor area
  try {
    // Try clicking the editor content area
    await page.click('[data-testid="editor"]', { timeout: 3000 }).catch(() => {});
    await page.click('.editor-content', { timeout: 3000 }).catch(() => {});
    await page.click('[contenteditable="true"]', { timeout: 3000 }).catch(() => {});
    await page.click('text=Start writing', { timeout: 3000 }).catch(() => {});
  } catch {}
  
  // Type content
  await page.keyboard.type("Hello from Playwright!", { delay: 50 });
  await page.keyboard.press("Enter");
  await page.keyboard.type("This is a test paragraph.", { delay: 50 });
  
  // Wait for Y.js sync
  console.log("Waiting for Y.js sync...");
  await page.waitForTimeout(8000);
  
  await browser.close();
  console.log("Browser closed.\n");
  
  // 2. Fetch dumps
  console.log("Step 2: Fetching dumps...\n");
  
  const browserDump = await getDump(pageId);
  console.log(`Browser page dump: ${browserDump.length} bytes`);
  
  const ourPageId = "GQpaE49Ecnkx5LEF"; // our programmatic page
  const ourDump = await getDump(ourPageId);
  console.log(`Our page dump: ${ourDump.length} bytes`);
  
  // 3. Decode and compare
  console.log("\nStep 3: Decoding and comparing...\n");
  
  try {
    const browserDoc = decodeDump(browserDump);
    dumpDocStructure(browserDoc, "BROWSER PAGE");
  } catch (e) {
    console.log(`Browser page decode failed: ${(e as Error).message}`);
    console.log(`First 40 bytes: [${Array.from(browserDump.slice(0, 40))}]`);
  }
  
  try {
    const ourDoc = decodeDump(ourDump);
    dumpDocStructure(ourDoc, "OUR PROGRAMMATIC PAGE");
  } catch (e) {
    console.log(`Our page decode failed: ${(e as Error).message}`);
  }
}

async function createPage(title: string): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const noteId = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const res = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WS_ID, noteId,
      note: { textVersion: 2, title, parentId: "default", is_portal_share: false },
    }),
  });
  if (!res.ok) throw new Error(`Create: ${res.status} ${await res.text()}`);
  return ((await res.json()) as any).globalId || noteId;
}

main().catch(console.error);
