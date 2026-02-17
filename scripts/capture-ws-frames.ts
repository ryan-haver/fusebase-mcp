/**
 * Capture the EXACT Socket.IO events used for Y.js sync by intercepting
 * the Fusebase client's Socket.IO emit calls via Playwright CDP.
 */

import { chromium } from "playwright";
import * as path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.resolve(__dirname, "..", ".browser-data");
const HOST = "inkabeam.nimbusweb.me";
const WS = "45h7lom5ryjak34u";
const PAGE_ID = "0ylYPzWyJEE9GHQN";

async function main() {
  console.log("🚀 Launching...");
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // Inject Socket.IO interceptor BEFORE navigation
  await page.addInitScript(() => {
    // Override WebSocket to intercept all binary frames  
    const OrigWS = window.WebSocket;
    const wsInstances: WebSocket[] = [];
    
    (window as any).__ws_intercepted = [];
    (window as any).__ws_instances = wsInstances;
    
    class ProxyWS extends OrigWS {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        wsInstances.push(this);
        console.log(`[WS-INTERCEPT] Created: ${url}`);
        
        const origSend = this.send.bind(this);
        this.send = (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
          if (typeof data === 'string') {
            // Text frame
            if (data.length < 200) {
              console.log(`[WS-SEND-TEXT] ${data}`);
            } else {
              console.log(`[WS-SEND-TEXT] ${data.slice(0, 50)}... (${data.length}c)`);
            }
          } else if (data instanceof ArrayBuffer) {
            const arr = new Uint8Array(data);
            console.log(`[WS-SEND-BIN] ArrayBuffer(${arr.length}b) first=[${arr.slice(0,10).join(',')}]`);
          } else if (ArrayBuffer.isView(data)) {
            const arr = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            console.log(`[WS-SEND-BIN] TypedArray(${arr.length}b) first=[${arr.slice(0,10).join(',')}]`);
          }
          return origSend(data);
        };

        this.addEventListener('message', (ev) => {
          if (typeof ev.data === 'string') {
            if (ev.data.length < 200) {
              console.log(`[WS-RECV-TEXT] ${ev.data}`);
            } else {
              console.log(`[WS-RECV-TEXT] ${ev.data.slice(0, 50)}... (${ev.data.length}c)`);
            }
          } else if (ev.data instanceof ArrayBuffer) {
            const arr = new Uint8Array(ev.data);
            console.log(`[WS-RECV-BIN] ArrayBuffer(${arr.length}b) first=[${arr.slice(0,10).join(',')}]`);
          } else if (ev.data instanceof Blob) {
            console.log(`[WS-RECV-BIN] Blob(${ev.data.size}b)`);
          }
        });
      }
    }
    
    (window as any).WebSocket = ProxyWS;
  });

  // Listen for console messages
  const logs: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[WS-")) {
      console.log(text);
      logs.push(text);
    }
  });

  const url = `https://${HOST}/ws/${WS}/note/${PAGE_ID}`;
  console.log(`📄 Navigating to: ${url}`);
  
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch {
    console.log(`   Current URL: ${page.url()}`);
  }

  // Wait for editor to load
  await page.waitForTimeout(10000);

  // Type a character to trigger a Y.js update
  const editor = await page.$('[contenteditable="true"]');
  if (editor) {
    console.log("\n✏️ Typing to trigger Y.js update...");
    await editor.click();
    await page.waitForTimeout(500);
    await page.keyboard.type("X", { delay: 100 });
    await page.waitForTimeout(3000);
  } else {
    console.log("⚠️ No editor found");
  }

  // Save logs
  const outPath = path.resolve(__dirname, "..", "data", "ws-frame-types.txt");
  fs.writeFileSync(outPath, logs.join("\n"));
  console.log(`\n💾 Saved ${logs.length} WS logs to: ${outPath}`);

  await ctx.close();
}

main().catch(console.error);
