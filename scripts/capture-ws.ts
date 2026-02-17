/**
 * Capture WebSocket messages to/from the Fusebase editor.
 * Uses Playwright CDP (Chrome DevTools Protocol) to intercept WS frames.
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
  console.log("🚀 Launching browser...");
  const browser = await chromium.launch({ headless: false });
  
  // Use a new context with cookies from our auth
  const { loadEncryptedCookie } = await import("../src/crypto.js");
  const stored = loadEncryptedCookie();
  if (!stored?.cookie) { console.error("No cookie"); process.exit(1); }
  
  // Parse cookie string into objects
  const cookieObjects = stored.cookie.split(";").map((c: string) => {
    const [name, ...vals] = c.trim().split("=");
    return {
      name: name.trim(),
      value: vals.join("=").trim(),
      domain: ".nimbusweb.me",
      path: "/",
    };
  }).filter((c: { name: string; value: string }) => c.name && c.value);
  
  const context = await browser.newContext();
  await context.addCookies(cookieObjects);
  
  const page = await context.newPage();
  
  // Set up CDP session to intercept WebSocket frames
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  
  const wsMessages: {dir: string; url: string; data: string; time: string}[] = [];
  
  cdp.on("Network.webSocketCreated", (params: Record<string, unknown>) => {
    console.log(`🔌 WS created: ${params.url}`);
  });
  
  cdp.on("Network.webSocketFrameSent", (params: Record<string, unknown>) => {
    const response = params.response as {payloadData: string};
    const data = response?.payloadData || "";
    console.log(`📤 WS SENT (${data.length} chars): ${data.slice(0, 200)}`);
    wsMessages.push({ dir: "sent", url: "", data, time: new Date().toISOString() });
  });
  
  cdp.on("Network.webSocketFrameReceived", (params: Record<string, unknown>) => {
    const response = params.response as {payloadData: string};
    const data = response?.payloadData || "";
    if (data.length > 5) {
      console.log(`📥 WS RECV (${data.length} chars): ${data.slice(0, 200)}`);
      wsMessages.push({ dir: "recv", url: "", data: data.slice(0, 2000), time: new Date().toISOString() });
    }
  });
  
  // Also intercept /tokens HTTP requests
  page.on("request", (req) => {
    if (req.url().includes("/tokens")) {
      console.log(`\n🔥 HTTP /tokens REQUEST:`);
      console.log(`   URL: ${req.url()}`);
      console.log(`   Method: ${req.method()}`);
      console.log(`   Body: ${req.postData()?.slice(0, 1000)}`);
    }
  });
  
  page.on("response", async (res) => {
    if (res.url().includes("/tokens")) {
      try {
        const body = await res.text();
        console.log(`   HTTP /tokens RESPONSE: ${res.status()} — ${body.slice(0, 500)}`);
      } catch { /* */ }
    }
  });
  
  // Navigate to page
  const url = `https://${HOST}/ws/${WS}/note/${PAGE_ID}`;
  console.log(`📄 Navigating to: ${url}`);
  
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  } catch {
    console.log("   Navigation timeout — checking if redirected to login...");
    console.log(`   Current URL: ${page.url()}`);
    if (page.url().includes("/auth")) {
      console.log("❌ Redirected to login. Cookies may be invalid.");
      // Try with persistent context instead
      await browser.close();
      
      console.log("\n🔄 Retrying with persistent browser context...");
      const pContext = await chromium.launchPersistentContext(PROFILE_DIR, {
        headless: false,
        viewport: { width: 1280, height: 800 },
      });
      const pPage = pContext.pages()[0] || await pContext.newPage();
      
      const pCdp = await pContext.newCDPSession(pPage);
      await pCdp.send("Network.enable");
      
      pCdp.on("Network.webSocketFrameSent", (params: Record<string, unknown>) => {
        const response = params.response as {payloadData: string};
        const data = response?.payloadData || "";
        console.log(`📤 WS SENT (${data.length} chars): ${data.slice(0, 300)}`);
        wsMessages.push({ dir: "sent", url: "", data, time: new Date().toISOString() });
      });
      
      pCdp.on("Network.webSocketFrameReceived", (params: Record<string, unknown>) => {
        const response = params.response as {payloadData: string};
        const data = response?.payloadData || "";
        if (data.length > 5) {
          console.log(`📥 WS RECV (${data.length} chars): ${data.slice(0, 300)}`);
          wsMessages.push({ dir: "recv", url: "", data: data.slice(0, 2000), time: new Date().toISOString() });
        }
      });
      
      pPage.on("request", (req) => {
        if (req.url().includes("/tokens")) {
          console.log(`\n🔥 HTTP /tokens REQUEST:`);
          console.log(`   URL: ${req.url()}`);
          console.log(`   Method: ${req.method()}`);
          console.log(`   Body: ${(req.postData() || "").slice(0, 2000)}`);
        }
      });
      
      pPage.on("response", async (res) => {
        if (res.url().includes("/tokens")) {
          try {
            const body = await res.text();
            console.log(`   HTTP /tokens RESPONSE: ${res.status()} — ${body.slice(0, 1000)}`);
          } catch { /* */ }
        }
      });
      
      console.log(`📄 Navigating (persistent): ${url}`);
      await pPage.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      
      // Wait for editor to load
      await pPage.waitForTimeout(5000);
      
      // Find editor and type
      const editor = await pPage.$('[contenteditable="true"]');
      if (editor) {
        console.log("\n✏️ Found editor. Typing test text...");
        await editor.click();
        await pPage.waitForTimeout(500);
        await pPage.keyboard.type("CAPTURE TEST", { delay: 100 });
        await pPage.waitForTimeout(3000);
        await pPage.keyboard.press("Enter");
        await pPage.keyboard.type("Second line", { delay: 100 });
        await pPage.waitForTimeout(5000);
      } else {
        console.log("⚠️ Could not find editor");
      }
      
      // Save results
      const outPath = path.resolve(__dirname, "..", "data", "ws-capture.json");
      fs.writeFileSync(outPath, JSON.stringify(wsMessages, null, 2));
      console.log(`\n💾 Saved ${wsMessages.length} WebSocket messages to: ${outPath}`);
      
      await pContext.close();
      return;
    }
  }
  
  // Wait for editor to load
  await page.waitForTimeout(5000);
  
  // Find and type in editor
  const editor = await page.$('[contenteditable="true"]');
  if (editor) {
    console.log("\n✏️ Found editor. Typing test text...");
    await editor.click();
    await page.waitForTimeout(500);
    await page.keyboard.type("CAPTURE TEST", { delay: 100 });
    await page.waitForTimeout(3000);
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second line", { delay: 100 });
    await page.waitForTimeout(5000);
  } else {
    console.log("⚠️ Could not find editor");
  }
  
  // Save captured messages
  const outPath = path.resolve(__dirname, "..", "data", "ws-capture.json");
  fs.writeFileSync(outPath, JSON.stringify(wsMessages, null, 2));
  console.log(`\n💾 Saved ${wsMessages.length} WebSocket messages to: ${outPath}`);
  
  await browser.close();
  console.log("✅ Done.");
}

main().catch(console.error);
