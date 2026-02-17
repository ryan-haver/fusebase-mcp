/**
 * WebSocket MITM Proxy for Fusebase Y.js Traffic Capture
 * 
 * Creates a local WebSocket server that proxies to the real text.nimbusweb.me
 * server. All messages in both directions are logged with full hex dumps.
 * 
 * Usage:
 *   1. Start this proxy: npx tsx scripts/ws-proxy.ts
 *   2. The proxy intercepts the browser's WebSocket to text.nimbusweb.me
 *      by modifying the hosts file or using browser proxy
 *   
 * Actually, a simpler approach: we use Playwright to open a page, inject
 * JavaScript that patches WebSocket, type content, and capture all frames.
 * 
 * Run: npx tsx scripts/ws-proxy.ts > data/ws-proxy-output.txt 2>&1
 */

import { chromium } from "playwright";
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
const PROFILE_DIR = path.resolve(__dirname, "..", ".browser-data");

// Create a test page first
async function createPage(): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const noteId = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const res = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WS_ID, noteId,
      note: { textVersion: 2, title: `WS Proxy Capture ${Date.now()}`, parentId: "default", is_portal_share: false },
    }),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as any).globalId || noteId;
}

async function main() {
  console.log("=== PLAYWRIGHT CDP WebSocket CAPTURE ===\n");
  
  // Use existing page instead of creating new one to avoid API issues
  // Pick one of our existing test pages
  const pageId = await createPage();
  const pageUrl = `https://${HOST}/ws/${WS_ID}/note/${pageId}`;
  console.log(`Page URL: ${pageUrl}\n`);
  
  // Launch browser with persistent profile
  console.log("Launching browser...");
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: ["--no-sandbox"],
    viewport: { width: 1280, height: 720 },
  });
  
  const page = await context.newPage();
  
  // Set up CDP for WebSocket capture
  const cdp = await page.context().newCDPSession(page);
  
  let frameLog: string[] = [];
  let wsUrls: string[] = [];
  
  // Capture WebSocket creation
  await cdp.send("Network.enable");
  
  cdp.on("Network.webSocketCreated", (event: any) => {
    console.log(`\nWS CREATED: ${event.url?.slice(0, 150)}`);
    wsUrls.push(event.url);
    
    // Extract syncStep1 from URL
    const m = event.url?.match(/syncStep1=([^&]+)/);
    if (m) {
      const decoded = decodeURIComponent(m[1]);
      const bytes = Buffer.from(decoded, "base64");
      console.log(`  syncStep1 RAW: ${decoded}`);
      console.log(`  syncStep1 BYTES: [${Array.from(bytes).join(",")}]`);
      console.log(`  syncStep1 HEX: ${bytes.toString("hex")}`);
      console.log(`  syncStep1 LEN: ${bytes.length}`);
    }
    
    // Extract other params
    const encv2 = event.url?.includes("encv2=true");
    const cidMatch = event.url?.match(/cid=(\d+)/);
    console.log(`  encv2: ${encv2}`);
    console.log(`  cid: ${cidMatch?.[1]}`);
  });
  
  cdp.on("Network.webSocketClosed", (event: any) => {
    console.log(`\nWS CLOSED`);
  });
  
  // Capture frames
  cdp.on("Network.webSocketFrameSent", (event: any) => {
    const data = event.response?.payloadData;
    if (!data) return;
    
    // payloadData is base64 for binary frames
    let bytes: Buffer;
    try {
      // Check if it's binary (base64) or text
      if (event.response.opcode === 2) {
        bytes = Buffer.from(data, "base64");
      } else {
        bytes = Buffer.from(data);
      }
    } catch {
      bytes = Buffer.from(data);
    }
    
    const entry = `SENT: [${bytes.length}b] hex=${bytes.toString("hex").slice(0, 100)} first=[${Array.from(bytes.slice(0, 20)).join(",")}]`;
    frameLog.push(entry);
    console.log(`  ${entry}`);
    
    // Decode message type
    if (bytes.length > 0) {
      const msgType = bytes[0];
      if (msgType === 0x00) {
        const sub = bytes[1];
        console.log(`    → SYNC sub=${sub} (${sub === 0 ? "step1" : sub === 1 ? "step2" : "update"})`);
      } else if (msgType === 0x01) {
        console.log(`    → AWARENESS`);
      }
    }
  });
  
  cdp.on("Network.webSocketFrameReceived", (event: any) => {
    const data = event.response?.payloadData;
    if (!data) return;
    
    let bytes: Buffer;
    try {
      if (event.response.opcode === 2) {
        bytes = Buffer.from(data, "base64");
      } else {
        bytes = Buffer.from(data);
      }
    } catch {
      bytes = Buffer.from(data);
    }
    
    const entry = `RECV: [${bytes.length}b] hex=${bytes.toString("hex").slice(0, 100)} first=[${Array.from(bytes.slice(0, 20)).join(",")}]`;
    frameLog.push(entry);
    console.log(`  ${entry}`);
    
    if (bytes.length > 0) {
      const msgType = bytes[0];
      if (msgType === 0x00) {
        const sub = bytes[1];
        console.log(`    → SYNC sub=${sub} (${sub === 0 ? "step1" : sub === 1 ? "step2" : "update"})`);
      } else if (msgType === 0x01) {
        console.log(`    → AWARENESS`);
      } else if (msgType === 0x11) {
        console.log(`    → PING`);
      } else if (msgType === 0x12) {
        console.log(`    → PONG`);
      }
    }
  });
  
  // Navigate to the page
  console.log("\nNavigating to page...");
  await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 30000 });
  console.log("Page loaded!");
  
  // Wait for editor to be ready
  await page.waitForTimeout(3000);
  
  // Try to find and click the editor area
  console.log("\nLooking for editor...");
  const editor = page.locator('[contenteditable="true"]');
  const editorCount = await editor.count();
  console.log(`  contenteditable elements: ${editorCount}`);
  
  if (editorCount > 0) {
    await editor.first().click();
    await page.waitForTimeout(1000);
    
    // Type some content
    console.log("\nTyping content...");
    await page.keyboard.type("HELLO", { delay: 100 });
    console.log("Typed 'HELLO'");
    
    // Wait for WebSocket messages to be sent
    await page.waitForTimeout(3000);
    
    // Type more
    await page.keyboard.press("Enter");
    await page.keyboard.type("TEST CONTENT", { delay: 50 });
    console.log("Typed 'TEST CONTENT'");
    
    await page.waitForTimeout(5000);
  } else {
    console.log("  Editor not found! Waiting for manual interaction...");
    await page.waitForTimeout(15000);
  }
  
  // Save frame log
  console.log(`\n\n=== FRAME LOG (${frameLog.length} frames) ===`);
  for (const f of frameLog) {
    console.log(f);
  }
  
  // Also save the WebSocket URLs
  console.log(`\n=== WebSocket URLs ===`);
  for (const u of wsUrls) {
    console.log(u);
  }
  
  // Check dump
  console.log("\n=== DUMP CHECK ===");
  await page.waitForTimeout(2000);
  const dumpRes = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
  const dumpBin = new Uint8Array(await dumpRes.arrayBuffer());
  console.log(`Dump: ${dumpBin.length}b`);
  console.log(`Has 'HELLO': ${Buffer.from(dumpBin).toString("utf-8", 0, Math.min(2000, dumpBin.length)).includes("HELLO")}`);
  
  await context.close();
  console.log("\nDone!");
}

main().catch(console.error);
