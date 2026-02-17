/**
 * Capture the exact WebSocket URL used by Fusebase for Y.js sync.
 * Uses Playwright CDP to intercept WebSocket creation.
 */

import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.resolve(__dirname, "..", ".browser-data");
const HOST = "inkabeam.nimbusweb.me";
const WS_ID = "45h7lom5ryjak34u";
const PAGE_ID = "0ylYPzWyJEE9GHQN";

async function main() {
  console.log("🚀 Launching...");
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    viewport: { width: 1280, height: 800 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");

  // Capture WebSocket URLs
  const wsUrls: string[] = [];
  cdp.on("Network.webSocketCreated", (params: Record<string, unknown>) => {
    const url = params.url as string;
    console.log(`🔌 WS created: ${url}`);
    wsUrls.push(url);
  });

  // Also capture a few frames for each WS
  const wsFrames: {dir: string; requestId: string; data: string; opcode: number}[] = [];
  cdp.on("Network.webSocketFrameSent", (params: Record<string, unknown>) => {
    const response = params.response as { payloadData: string; opcode: number };
    const data = response?.payloadData?.slice(0, 500) || "";
    wsFrames.push({ dir: "sent", requestId: params.requestId as string, data, opcode: response?.opcode ?? 0 });
  });
  cdp.on("Network.webSocketFrameReceived", (params: Record<string, unknown>) => {
    const response = params.response as { payloadData: string; opcode: number };
    const data = response?.payloadData?.slice(0, 500) || "";
    wsFrames.push({ dir: "recv", requestId: params.requestId as string, data, opcode: response?.opcode ?? 0 });
  });

  const url = `https://${HOST}/ws/${WS_ID}/note/${PAGE_ID}`;
  console.log(`📄 Navigating to: ${url}`);

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  } catch {}

  await page.waitForTimeout(8000);

  // Output all WS URLs
  console.log(`\n📊 Found ${wsUrls.length} WebSocket connections:`);
  for (const u of wsUrls) {
    console.log(`   ${u.slice(0, 300)}`);
  }

  console.log(`\n📊 Captured ${wsFrames.length} frames`);
  // Group frames by requestId to see which WS gets which traffic
  const byReq: Record<string, typeof wsFrames> = {};
  for (const f of wsFrames) {
    if (!byReq[f.requestId]) byReq[f.requestId] = [];
    byReq[f.requestId].push(f);
  }
  for (const [reqId, frames] of Object.entries(byReq)) {
    console.log(`\n  WS ${reqId}: ${frames.length} frames`);
    for (const f of frames.slice(0, 10)) {
      console.log(`    ${f.dir}: ${f.data.slice(0, 200)}`);
    }
  }

  // Save
  const outPath = path.resolve(__dirname, "..", "data", "ws-urls.json");
  fs.writeFileSync(outPath, JSON.stringify({ urls: wsUrls, frames: wsFrames.slice(0, 100) }, null, 2));
  console.log(`\n💾 Saved to ${outPath}`);

  await ctx.close();
}

main().catch(console.error);
