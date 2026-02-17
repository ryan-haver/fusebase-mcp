/**
 * Capture WebSocket traffic from a real Fusebase browser session.
 * 
 * Uses Playwright + Chrome DevTools Protocol (CDP) to intercept
 * all WebSocket frames sent/received by the browser's Y.js client.
 * 
 * This gives us a byte-perfect reference of what a working write looks like,
 * which we can compare against our yjs-ws-writer.ts implementation.
 * 
 * Run: npx tsx scripts/capture-browser-ws.ts
 */

import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.resolve(__dirname, "..", ".browser-data");
const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const WS_ID = process.env.FUSEBASE_WS_ID || "45h7lom5ryjak34u";

// Load .env
function loadEnv() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

interface WsFrame {
  timestamp: number;
  direction: "sent" | "received";
  requestId: string;
  url: string;
  opcode: number;  // 1=text, 2=binary
  payloadHex: string;
  payloadLen: number;
  payloadPreview: string;
  firstBytes: number[];
}

async function main() {
  const outputPath = path.resolve(__dirname, "..", "data", "ws-capture.json");
  const frames: WsFrame[] = [];
  const wsUrls = new Map<string, string>();
  
  console.log("🚀 Launching browser with existing profile...");
  
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ["--auto-open-devtools-for-tabs"],
  });
  
  const page = context.pages()[0] || await context.newPage();
  
  // Attach CDP session for WebSocket interception
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  
  // Track WebSocket connections
  cdp.on("Network.webSocketCreated", (params: any) => {
    const url = params.url as string;
    const requestId = params.requestId as string;
    wsUrls.set(requestId, url);
    const isEditor = url.includes("socket.io.editor");
    console.log(`\n🔌 WS Created [${requestId}]: ${url.slice(0, 120)}...`);
    if (isEditor) {
      console.log("   ⭐ THIS IS THE Y.js EDITOR CONNECTION");
    }
  });
  
  cdp.on("Network.webSocketClosed", (params: any) => {
    console.log(`\n🔒 WS Closed [${params.requestId}]`);
  });
  
  cdp.on("Network.webSocketHandshakeResponseReceived", (params: any) => {
    console.log(`\n✅ WS Handshake Complete [${params.requestId}] status=${params.response?.status}`);
  });
  
  // Capture sent frames
  cdp.on("Network.webSocketFrameSent", (params: any) => {
    const url = wsUrls.get(params.requestId) || "unknown";
    const isEditor = url.includes("socket.io.editor");
    const payload = params.response?.payloadData as string || "";
    
    let payloadHex: string;
    let payloadLen: number;
    let firstBytes: number[] = [];
    
    if (params.response?.opcode === 2) {
      // Binary frame — payloadData is base64
      const buf = Buffer.from(payload, "base64");
      payloadHex = buf.toString("hex");
      payloadLen = buf.length;
      firstBytes = Array.from(buf.slice(0, 30));
    } else {
      // Text frame
      const buf = Buffer.from(payload, "utf-8");
      payloadHex = buf.toString("hex");
      payloadLen = buf.length;
      firstBytes = Array.from(buf.slice(0, 30));
    }
    
    const frame: WsFrame = {
      timestamp: Date.now(),
      direction: "sent",
      requestId: params.requestId,
      url,
      opcode: params.response?.opcode || 1,
      payloadHex,
      payloadLen,
      payloadPreview: payload.slice(0, 100),
      firstBytes,
    };
    frames.push(frame);
    
    if (isEditor) {
      const msgType = firstBytes[0];
      const msgTypeStr = msgType === 0 ? "SYNC" : msgType === 1 ? "AWARENESS" : msgType === 0x11 ? "PING" : msgType === 0x12 ? "PONG" : `0x${msgType?.toString(16)}`;
      let subInfo = "";
      if (msgType === 0 && firstBytes.length > 1) {
        const sub = firstBytes[1];
        subInfo = ` sub=${sub === 0 ? "Step1" : sub === 1 ? "Step2" : sub === 2 ? "Update" : `0x${sub.toString(16)}`}`;
      }
      console.log(`   📤 SENT [${payloadLen}b] type=${msgTypeStr}${subInfo} first=[${firstBytes.slice(0, 10).join(",")}]`);
    }
  });
  
  // Capture received frames
  cdp.on("Network.webSocketFrameReceived", (params: any) => {
    const url = wsUrls.get(params.requestId) || "unknown";
    const isEditor = url.includes("socket.io.editor");
    const payload = params.response?.payloadData as string || "";
    
    let payloadHex: string;
    let payloadLen: number;
    let firstBytes: number[] = [];
    
    if (params.response?.opcode === 2) {
      const buf = Buffer.from(payload, "base64");
      payloadHex = buf.toString("hex");
      payloadLen = buf.length;
      firstBytes = Array.from(buf.slice(0, 30));
    } else {
      const buf = Buffer.from(payload, "utf-8");
      payloadHex = buf.toString("hex");
      payloadLen = buf.length;
      firstBytes = Array.from(buf.slice(0, 30));
    }
    
    const frame: WsFrame = {
      timestamp: Date.now(),
      direction: "received",
      requestId: params.requestId,
      url,
      opcode: params.response?.opcode || 1,
      payloadHex,
      payloadLen,
      payloadPreview: payload.slice(0, 100),
      firstBytes,
    };
    frames.push(frame);
    
    if (isEditor) {
      const msgType = firstBytes[0];
      const msgTypeStr = msgType === 0 ? "SYNC" : msgType === 1 ? "AWARENESS" : msgType === 0x11 ? "PING" : msgType === 0x12 ? "PONG" : `0x${msgType?.toString(16)}`;
      let subInfo = "";
      if (msgType === 0 && firstBytes.length > 1) {
        const sub = firstBytes[1];
        subInfo = ` sub=${sub === 0 ? "Step1" : sub === 1 ? "Step2" : sub === 2 ? "Update" : `0x${sub.toString(16)}`}`;
      }
      console.log(`   📥 RECV [${payloadLen}b] type=${msgTypeStr}${subInfo} first=[${firstBytes.slice(0, 10).join(",")}]`);
    }
  });
  
  // Create a fresh test page via API
  const cookie = process.env.FUSEBASE_COOKIE || "";
  const orgId = process.env.FUSEBASE_ORG_ID || "u268r1";
  
  // Generate a 16-char alphanumeric ID
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const noteId = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const title = `WS Capture Test ${new Date().toISOString().slice(11, 19)}`;
  
  console.log("\n📄 Creating a fresh test page via API...");
  const createRes = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WS_ID,
      noteId,
      note: {
        textVersion: 2,
        title,
        parentId: "default",
        is_portal_share: false,
      },
    }),
  });
  
  if (!createRes.ok) {
    console.error(`❌ Failed to create page: ${createRes.status}`);
    await context.close();
    return;
  }
  
  const pageData = await createRes.json() as any;
  const pageId = pageData.globalId;
  console.log(`   Page created: ${pageId}`);
  
  // Navigate to the page
  const url = `https://${HOST}/ws/${WS_ID}/note/${pageId}`;
  console.log(`\n🌐 Navigating to: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  
  // Wait for editor
  console.log("⏳ Waiting for editor to load...");
  let editor = null;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000);
    editor = await page.$('[contenteditable="true"]');
    if (editor) break;
    console.log(`   Attempt ${i + 1}/15...`);
    if (page.url().includes("/auth")) {
      console.error("❌ Auth redirect — need to log in. Run: npx tsx scripts/auth.ts");
      await context.close();
      return;
    }
  }
  
  if (!editor) {
    console.error("❌ Editor not found");
    await context.close();
    return;
  }
  
  console.log("✏️ Editor found! Starting capture...");
  console.log("\n" + "═".repeat(60));
  console.log(" CAPTURING: Typing into editor...");
  console.log("═".repeat(60) + "\n");
  
  // Click the editor to focus
  await editor.click();
  await page.waitForTimeout(1000);
  
  // Type a simple test — just "Hello World" so we get minimal WS traffic
  console.log("📝 Typing 'Hello World'...");
  await page.keyboard.type("Hello World", { delay: 50 });
  
  // Wait for sync
  await page.waitForTimeout(3000);
  
  // Now add a heading to test block-level changes
  console.log("📝 Adding Enter + '# Heading Test'...");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await page.keyboard.type("# Heading Test", { delay: 50 });
  
  // Wait for sync
  await page.waitForTimeout(3000);
  
  // Add bold text
  console.log("📝 Adding Enter + bold text...");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await page.keyboard.press("Control+b");
  await page.keyboard.type("Bold text", { delay: 50 });
  await page.keyboard.press("Control+b");
  
  // Wait for final sync
  console.log("\n⏳ Waiting for final sync (5s)...");
  await page.waitForTimeout(5000);
  
  // Save frames
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  
  // Filter only editor WS frames
  const editorFrames = frames.filter(f => f.url.includes("socket.io.editor"));
  const allFramesSummary = {
    totalFrames: frames.length,
    editorFrames: editorFrames.length,
    otherFrames: frames.length - editorFrames.length,
    editorWsUrl: editorFrames[0]?.url || "none",
  };
  
  const output = {
    capturedAt: new Date().toISOString(),
    pageId,
    summary: allFramesSummary,
    editorFrames,
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Saved ${editorFrames.length} editor frames to: ${outputPath}`);
  
  // Print protocol summary
  console.log("\n" + "═".repeat(60));
  console.log(" PROTOCOL SUMMARY");
  console.log("═".repeat(60));
  
  for (const f of editorFrames) {
    const dir = f.direction === "sent" ? "📤 SENT" : "📥 RECV";
    const msgType = f.firstBytes[0];
    let desc = `type=0x${msgType?.toString(16).padStart(2, "0")}`;
    
    if (msgType === 0) {
      const sub = f.firstBytes[1];
      if (sub === 0) desc = "SYNC Step1";
      else if (sub === 1) desc = "SYNC Step2";
      else if (sub === 2) desc = "SYNC Update";
      else desc = `SYNC sub=0x${sub?.toString(16)}`;
    } else if (msgType === 1) {
      desc = "AWARENESS";
    } else if (msgType === 0x11) {
      desc = "PING";
    } else if (msgType === 0x12) {
      desc = "PONG";
    }
    
    console.log(`  ${dir} [${f.payloadLen}b] ${desc}  first=[${f.firstBytes.slice(0, 15).join(",")}]`);
  }
  
  await context.close();
  console.log("\n✅ Done!");
}

main().catch(console.error);
