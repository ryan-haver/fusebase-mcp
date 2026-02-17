/**
 * Extract Y.js-related code from Fusebase's client-side JavaScript.
 * Uses Playwright to navigate to a page and search all loaded scripts.
 */

import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.resolve(__dirname, "..", ".browser-data");
const HOST = "inkabeam.nimbusweb.me";
const WS = "45h7lom5ryjak34u";
const PAGE_ID = "0ylYPzWyJEE9GHQN";

async function main() {
  console.log("🚀 Launching...");
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    viewport: { width: 1280, height: 800 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  
  // Collect all JS URLs loaded
  const scriptUrls: string[] = [];
  page.on("response", (res) => {
    if (res.url().endsWith(".js") || res.url().includes(".js?")) {
      scriptUrls.push(res.url());
    }
  });

  const url = `https://${HOST}/ws/${WS}/note/${PAGE_ID}`;
  console.log(`📄 Navigating...`);
  
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  } catch {}

  await page.waitForTimeout(5000);

  console.log(`📦 Found ${scriptUrls.length} JS files`);

  // Search for Y.js-related patterns in each script
  const patterns = [
    "yjs", "y-websocket", "y-protocols", "syncStep1", "syncStep2",
    "awareness", "encoding.createEncoder", "encoding.writeVarUint",
    "applyUpdate", "encodeStateVector", "encodeStateAsUpdate",
    "socketConnect", "noteOpen", "note:join", "note:update",
    "connectWorkspace", "yjsProvider", "YjsProvider",
    "WebsocketProvider", "y_websocket", "y-websocket",
    "messageSync", "messageAwareness", "messageAuth",
    "readSyncStep1", "readSyncStep2", "readUpdate",
    "writeSyncStep1", "writeSyncStep2", "writeUpdate",
    ".send(", "emit(\"note", "emit('note", 
  ];

  const results: {url: string; pattern: string; context: string}[] = [];

  for (const scriptUrl of scriptUrls) {
    try {
      const res = await page.evaluate(async (u) => {
        const r = await fetch(u);
        return r.text();
      }, scriptUrl);

      const basename = scriptUrl.split("/").pop()?.split("?")[0] || scriptUrl;

      for (const pat of patterns) {
        const idx = res.indexOf(pat);
        if (idx >= 0) {
          const context = res.slice(Math.max(0, idx - 100), idx + pat.length + 100);
          results.push({
            url: basename,
            pattern: pat,
            context: context.replace(/\n/g, " ").trim(),
          });
          console.log(`✅ Found "${pat}" in ${basename}`);
        }
      }
    } catch (e) {
      // Skip failed fetches (CORS etc)
    }
  }

  // Also search for the Y.js WebSocket-related code in the main window
  const windowSearch = await page.evaluate(() => {
    const results: string[] = [];
    // Check if there's a Y.js doc or websocket provider on the window
    for (const key of Object.keys(window)) {
      if (key.toLowerCase().includes("yjs") || 
          key.toLowerCase().includes("ydoc") ||
          key.toLowerCase().includes("provider") ||
          key.toLowerCase().includes("socket")) {
        results.push(`window.${key} = ${typeof (window as any)[key]}`);
      }
    }
    return results;
  });
  console.log("\n🔍 Window objects:", windowSearch);

  // Save results
  const outPath = path.resolve(__dirname, "..", "data", "yjs-code-search.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Saved ${results.length} matches to: ${outPath}`);

  await ctx.close();
}

main().catch(console.error);
