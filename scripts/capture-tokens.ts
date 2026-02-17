/**
 * Capture the real token format by intercepting editor API calls.
 * Uses Playwright with the persistent browser profile (already logged in).
 * Run: npx tsx scripts/capture-tokens.ts
 */

import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.resolve(__dirname, "..", ".browser-data");
const HOST = "inkabeam.nimbusweb.me";
const WORKSPACE_ID = "45h7lom5ryjak34u";
const TEST_PAGE_ID = "0ylYPzWyJEE9GHQN";

async function main() {
  console.log("🚀 Launching browser with persistent profile...");
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
  });

  const page = context.pages()[0] || await context.newPage();

  // Intercept ALL requests to /tokens
  const tokenRequests: { url: string; body: string; response: string }[] = [];
  
  page.on("request", (req) => {
    if (req.url().includes("/tokens")) {
      const body = req.postData() || "";
      console.log("\n📡 TOKEN REQUEST INTERCEPTED:");
      console.log("   URL:", req.url());
      console.log("   Method:", req.method());
      console.log("   Body:", body.slice(0, 2000));
      tokenRequests.push({ url: req.url(), body, response: "" });
    }
  });

  page.on("response", async (res) => {
    if (res.url().includes("/tokens")) {
      try {
        const body = await res.text();
        console.log("   Response:", res.status(), body.slice(0, 500));
        if (tokenRequests.length > 0) {
          tokenRequests[tokenRequests.length - 1].response = body;
        }
      } catch { /* ignore */ }
    }
  });

  // Navigate to the test page
  const pageUrl = `https://${HOST}/ws/${WORKSPACE_ID}/note/${TEST_PAGE_ID}`;
  console.log(`📄 Navigating to: ${pageUrl}`);
  await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 30000 });

  // Wait for editor to load
  await page.waitForTimeout(3000);
  console.log("✏️ Page loaded. Looking for editor...");

  // Try to find the editor content area and type
  const editorSelectors = [
    '[contenteditable="true"]',
    '.ql-editor',
    '.note-editor',
    '.text-editor',
    '[data-contents]',
    '.ProseMirror',
    '[role="textbox"]',
  ];

  let editor = null;
  for (const sel of editorSelectors) {
    editor = await page.$(sel);
    if (editor) {
      console.log(`   Found editor with selector: ${sel}`);
      break;
    }
  }

  if (!editor) {
    console.log("⚠️ Could not find editor. Taking screenshot...");
    await page.screenshot({ path: path.resolve(__dirname, "..", "data", "capture-state.png") });
    
    // List all contenteditable elements
    const ceElements = await page.$$eval('[contenteditable]', (els) =>
      els.map((e) => ({
        tag: e.tagName,
        ce: e.getAttribute("contenteditable"),
        classes: e.className?.toString().slice(0, 100),
        text: e.textContent?.slice(0, 50),
      }))
    );
    console.log("   contenteditable elements found:", JSON.stringify(ceElements, null, 2));
    
    await context.close();
    return;
  }

  // Click into editor and type
  await editor.click();
  await page.waitForTimeout(500);
  
  console.log("⌨️ Typing test content...");
  await page.keyboard.type("Hello from token capture test", { delay: 50 });
  
  // Wait for API calls to fire
  await page.waitForTimeout(5000);
  
  // Press Enter and type more
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second line of text", { delay: 50 });
  
  await page.waitForTimeout(5000);

  // Save results
  const outputPath = path.resolve(__dirname, "..", "data", "captured-tokens.json");
  fs.writeFileSync(outputPath, JSON.stringify(tokenRequests, null, 2));
  console.log(`\n💾 Saved ${tokenRequests.length} intercepted requests to: ${outputPath}`);

  if (tokenRequests.length === 0) {
    console.log("⚠️ No /tokens requests captured! The editor may use WebSocket or a different endpoint.");
    
    // List ALL network requests made
    console.log("\n📋 Checking for other interesting endpoints...");
  }

  await page.screenshot({ path: path.resolve(__dirname, "..", "data", "capture-result.png") });
  console.log("📸 Screenshot saved.");

  await context.close();
  console.log("✅ Done.");
}

main().catch(console.error);
