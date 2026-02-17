/**
 * Download the Fusebase Y.js provider JS file and extract the relevant
 * WebSocket/SocketIO code around .send() and Y.js message handling.
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

  const url = `https://${HOST}/ws/${WS}/note/${PAGE_ID}`;
  console.log(`📄 Navigating...`);
  
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  } catch {}

  await page.waitForTimeout(5000);

  // Download the key Y.js bundle
  const targetFile = "a2b399f0.c5a4908a117d2f35.js";
  console.log(`📦 Downloading ${targetFile}...`);

  // Find the full URL of the target JS file
  const jsContent = await page.evaluate(async (filename) => {
    // Try fetching from common Next.js chunk paths
    const paths = [
      `/_next/static/chunks/${filename}`,
      `/_next/static/chunks/pages/${filename}`,
      `/_next/static/${filename}`,
    ];
    
    // Also check all script tags on the page
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    for (const s of scripts) {
      const src = (s as HTMLScriptElement).src;
      if (src.includes(filename.split('.')[0])) {
        try {
          const r = await fetch(src);
          return { url: src, content: await r.text() };
        } catch {}
      }
    }
    
    // Try common paths
    for (const p of paths) {
      try {
        const r = await fetch(p);
        if (r.ok) {
          return { url: p, content: await r.text() };
        }
      } catch {}
    }
    
    // Try searching performance entries for the actual URL
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    for (const e of entries) {
      if (e.name.includes(filename.split('.')[0])) {
        try {
          const r = await fetch(e.name);
          return { url: e.name, content: await r.text() };
        } catch {}
      }
    }
    
    return null;
  }, targetFile);

  if (jsContent) {
    console.log(`   URL: ${jsContent.url}`);
    console.log(`   Size: ${jsContent.content.length} chars`);

    // Save the full file
    const outPath = path.resolve(__dirname, "..", "data", "yjs-bundle.js");
    fs.writeFileSync(outPath, jsContent.content);
    console.log(`   Saved to: ${outPath}`);

    // Now extract all the relevant code sections
    const content = jsContent.content;
    
    // Search for key patterns with more context
    const extractContexts = [
      { pattern: ".send(", desc: "WebSocket send calls", contextBefore: 200, contextAfter: 200 },
      { pattern: "noteOpen", desc: "noteOpen events", contextBefore: 200, contextAfter: 200 },
      { pattern: "note:update", desc: "note update events", contextBefore: 200, contextAfter: 200 },
      { pattern: "note:join", desc: "note join events", contextBefore: 200, contextAfter: 200 },
      { pattern: "messageSync", desc: "Y.js messageSync", contextBefore: 200, contextAfter: 200 },
      { pattern: "messageAwareness", desc: "Y.js messageAwareness", contextBefore: 200, contextAfter: 200 },
      { pattern: "messageAuth", desc: "Y.js messageAuth", contextBefore: 200, contextAfter: 200 },
      { pattern: "WebsocketProvider", desc: "Y.js WebSocket provider", contextBefore: 200, contextAfter: 200 },
      { pattern: "y-websocket", desc: "y-websocket import", contextBefore: 100, contextAfter: 300 },
      { pattern: "connectWorkspace", desc: "workspace connect", contextBefore: 200, contextAfter: 200 },
      { pattern: "toBase64", desc: "base64 encoding", contextBefore: 200, contextAfter: 200 },
      { pattern: "fromBase64", desc: "base64 decoding", contextBefore: 200, contextAfter: 200 },
      { pattern: "btoa(", desc: "btoa encoding", contextBefore: 200, contextAfter: 200 },
      { pattern: "atob(", desc: "atob decoding", contextBefore: 200, contextAfter: 200 },
      { pattern: "readMessage", desc: "Y.js readMessage", contextBefore: 200, contextAfter: 200 },
      { pattern: "writeMessage", desc: "Y.js writeMessage", contextBefore: 200, contextAfter: 200 },
      { pattern: "encoding.toUint8Array", desc: "encoder finalize", contextBefore: 200, contextAfter: 200 },
      { pattern: "bc.postMessage", desc: "BroadcastChannel", contextBefore: 200, contextAfter: 200 },
      { pattern: "new WebSocket", desc: "WebSocket constructor", contextBefore: 100, contextAfter: 300 },
    ];

    const extractedSnippets: string[] = [];
    for (const { pattern, desc, contextBefore, contextAfter } of extractContexts) {
      let idx = 0;
      let found = 0;
      while ((idx = content.indexOf(pattern, idx)) >= 0 && found < 5) {
        const ctx = content.slice(
          Math.max(0, idx - contextBefore),
          Math.min(content.length, idx + pattern.length + contextAfter)
        );
        extractedSnippets.push(`\n=== ${desc} (offset ${idx}) ===\n${ctx}`);
        found++;
        idx += pattern.length;
      }
    }

    const snippetPath = path.resolve(__dirname, "..", "data", "yjs-bundle-snippets.txt");
    fs.writeFileSync(snippetPath, extractedSnippets.join("\n\n"));
    console.log(`   Extracted ${extractedSnippets.length} snippets to: ${snippetPath}`);
  } else {
    console.log("⚠️ Could not find the target JS file");
    
    // Fall back: search all performance entries for the exact URLs
    const allJsUrls = await page.evaluate(() => {
      const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      return entries
        .filter(e => e.name.endsWith('.js') || e.name.includes('.js?'))
        .map(e => e.name)
        .slice(0, 50);
    });
    console.log("All JS URLs:", allJsUrls.slice(0, 20));
  }

  await ctx.close();
}

main().catch(console.error);
