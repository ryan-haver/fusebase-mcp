/**
 * Write rich content to Fusebase via Playwright browser automation.
 * 
 * This approach works by:
 * 1. Opening the page in a real browser
 * 2. Focusing the contenteditable editor
 * 3. Using keyboard shortcuts (Ctrl+B, Ctrl+I) and typing to produce formatted content
 * 4. The browser handles Y.js CRDT sync automatically
 * 
 * This is the ONLY reliable way to write content since Fusebase uses Y.js
 * binary sync protocol over WebSocket (not REST).
 * 
 * Run: npx tsx scripts/test-playwright-write.ts
 */

import { chromium, type Page, type BrowserContext } from "playwright";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadEncryptedCookie } from "../src/crypto.js";
import type { ContentBlock, InlineSegment } from "../src/content-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.resolve(__dirname, "..", ".browser-data");
const HOST = "inkabeam.nimbusweb.me";
const WS_ID = "45h7lom5ryjak34u";
const PAGE = "0ylYPzWyJEE9GHQN";

/**
 * Type formatted inline segments using keyboard shortcuts.
 */
async function typeSegments(page: Page, segments: InlineSegment[]) {
  for (const seg of segments) {
    // Toggle formatting on
    if (seg.bold) await page.keyboard.press("Control+b");
    if (seg.italic) await page.keyboard.press("Control+i");
    
    // Type the text
    await page.keyboard.type(seg.text, { delay: 15 });
    
    // Toggle formatting off
    if (seg.italic) await page.keyboard.press("Control+i");
    if (seg.bold) await page.keyboard.press("Control+b");
  }
}

/**
 * Write content blocks to a Fusebase page using browser automation.
 */
async function writeBlocks(page: Page, blocks: ContentBlock[]) {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    
    switch (block.type) {
      case "heading": {
        // Use markdown shortcut: # + space
        if (block.level === 1) {
          await page.keyboard.type("# ", { delay: 20 });
        } else if (block.level === 2) {
          await page.keyboard.type("## ", { delay: 20 });
        } else {
          await page.keyboard.type("### ", { delay: 20 });
        }
        await typeSegments(page, block.children);
        await page.keyboard.press("Enter");
        break;
      }
      
      case "paragraph": {
        await typeSegments(page, block.children);
        await page.keyboard.press("Enter");
        break;
      }
      
      case "list": {
        for (const item of block.items) {
          if (block.style === "bullet") {
            await page.keyboard.type("- ", { delay: 20 });
          } else {
            await page.keyboard.type("1. ", { delay: 20 });
          }
          await typeSegments(page, item.children);
          await page.keyboard.press("Enter");
        }
        // Exit list mode with an extra Enter
        await page.keyboard.press("Enter");
        break;
      }
      
      case "checklist": {
        for (const item of block.items) {
          await page.keyboard.type("[] ", { delay: 20 });
          await typeSegments(page, item.children);
          await page.keyboard.press("Enter");
        }
        await page.keyboard.press("Enter");
        break;
      }
      
      case "divider": {
        await page.keyboard.type("---", { delay: 20 });
        await page.keyboard.press("Enter");
        break;
      }
      
      case "blockquote": {
        await page.keyboard.type("> ", { delay: 20 });
        await typeSegments(page, block.children);
        await page.keyboard.press("Enter");
        // Exit blockquote
        await page.keyboard.press("Enter");
        break;
      }
      
      case "code": {
        await page.keyboard.type("```", { delay: 20 });
        if (block.language) {
          await page.keyboard.type(block.language, { delay: 20 });
        }
        await page.keyboard.press("Enter");
        // Type code lines with basic Enter handling
        const lines = block.code.split("\n");
        for (const line of lines) {
          await page.keyboard.type(line, { delay: 10 });
          await page.keyboard.press("Enter");
        }
        // Exit code block
        await page.keyboard.type("```", { delay: 20 });
        await page.keyboard.press("Enter");
        break;
      }
    }
    
    // Small delay between blocks
    await page.waitForTimeout(100);
  }
}

async function main() {
  console.log("🚀 Opening browser...");
  
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
  });
  
  const page = context.pages()[0] || await context.newPage();
  
  const url = `https://${HOST}/ws/${WS_ID}/note/${PAGE}`;
  console.log(`📄 Navigating to: ${url}`);
  
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  
  // Wait for the editor to appear
  console.log("⏳ Waiting for editor...");
  let editor: import("playwright").ElementHandle<Element> | null = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(1000);
    editor = await page.$('[contenteditable="true"]');
    if (editor) break;
    console.log(`   Attempt ${attempt + 1}/20...`);
    // Check for auth redirect
    if (page.url().includes("/auth")) {
      console.error("❌ Redirected to auth — please log in manually in the browser window");
      await page.waitForTimeout(60000);
      await context.close();
      return;
    }
  }
  if (!editor) {
    console.error("❌ Could not find editor");
    await context.close();
    return;
  }
  
  console.log("✏️ Found editor. Clearing existing content...");
  
  // Select all and delete existing content
  await editor.click();
  await page.waitForTimeout(500);
  await page.keyboard.press("Control+a");
  await page.waitForTimeout(200);
  await page.keyboard.press("Delete");
  await page.waitForTimeout(500);
  
  // Write test content
  const testBlocks: ContentBlock[] = [
    {
      type: "heading",
      level: 1,
      children: [{ text: "Content Written via Automation" }],
    },
    {
      type: "paragraph",
      children: [
        { text: "This content was written using " },
        { text: "Playwright browser automation", bold: true },
        { text: ". It supports " },
        { text: "bold", bold: true },
        { text: " and " },
        { text: "italic", italic: true },
        { text: " formatting." },
      ],
    },
    {
      type: "heading",
      level: 2,
      children: [{ text: "Features" }],
    },
    {
      type: "list",
      style: "bullet",
      items: [
        { children: [{ text: "Headings (H1, H2, H3)" }] },
        { children: [{ text: "Bold and italic text" }] },
        { children: [{ text: "Bullet and numbered lists" }] },
        { children: [{ text: "Code blocks" }] },
      ],
    },
    {
      type: "paragraph",
      children: [
        { text: "Written at: " },
        { text: new Date().toISOString() },
      ],
    },
  ];
  
  console.log("📝 Writing content...");
  await writeBlocks(page, testBlocks);
  
  // Wait for sync
  console.log("⏳ Waiting for Y.js sync...");
  await page.waitForTimeout(5000);
  
  console.log("✅ Done! Content should be visible in the page.");
  
  // Take a screenshot for verification
  const screenshotPath = path.resolve(__dirname, "..", "data", "playwright-write-result.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);
  
  await context.close();
}

main().catch(console.error);
