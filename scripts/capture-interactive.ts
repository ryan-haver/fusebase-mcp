/**
 * Interactive WebSocket Capture Tool
 * 
 * Opens a Playwright browser with your Fusebase session.
 * YOU type content manually in the editor.
 * This script captures and decodes ALL WebSocket frames in real-time.
 * 
 * Usage:
 *   npx tsx scripts/capture-interactive.ts [pageUrl]
 * 
 * If no URL given, creates a new page automatically.
 * Press Ctrl+C to stop and save the full frame log.
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
const LOG_FILE = path.resolve(__dirname, "..", "data", "interactive-capture.txt");

// Varuint decoder
function readVarUint(data: Buffer, offset: number): [number, number] {
  let result = 0, shift = 0, byte: number;
  do { byte = data[offset++]; result |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
  return [result, offset];
}

function decodeMsgType(data: Buffer): string {
  if (data.length === 0) return "EMPTY";
  const first = data[0];
  
  // Text frame check
  if (first >= 0x20 && first <= 0x7e) {
    const text = data.toString("utf-8");
    if (text === "2") return "ENGINE.IO-PING";
    if (text === "3") return "ENGINE.IO-PONG";
    if (text.startsWith("42[")) return `SOCKET.IO-EVENT: ${text.slice(0, 80)}`;
    if (text.startsWith("{")) {
      try {
        const j = JSON.parse(text);
        if (j.opr) return `JSON-OP: ${j.opr}`;
        if (j.data) return `JSON-DATA: ${JSON.stringify(j).slice(0,80)}`;
        return `JSON: ${text.slice(0, 80)}`;
      } catch { return `TEXT: ${text.slice(0, 80)}`; }
    }
    if (text.startsWith("[")) {
      try {
        const arr = JSON.parse(text);
        if (arr[0]?.d?._zldt) return `SERVER-STATE: _zldt=${arr[0].d._zldt.slice(0, 20)}`;
        if (arr[0]?.d?.seqno !== undefined) return `SERVER-SEQNO: ${arr[0].d.seqno}`;
        if (arr[0]?.d?.sseqno !== undefined) return `SERVER-SSEQNO: ${arr[0].d.sseqno}`;
        if (arr[0]?.d?.name) return `SERVER-USER: ${arr[0].d.name}`;
        return `SERVER-JSON: ${text.slice(0, 80)}`;
      } catch { return `TEXT: ${text.slice(0, 80)}`; }
    }
    return `TEXT: ${text.slice(0, 60)}`;
  }
  
  // Binary frame
  if (first === 0x00) {
    if (data.length < 2) return "SYNC(truncated)";
    const [sub, off] = readVarUint(data, 1);
    if (sub === 0) {
      const [svLen] = readVarUint(data, off);
      return `SYNC-Step1 svLen=${svLen}`;
    }
    if (sub === 1) {
      const [uLen] = readVarUint(data, off);
      return `SYNC-Step2 updateLen=${uLen}`;
    }
    if (sub === 2) {
      const [uLen] = readVarUint(data, off);
      return `Y.UPDATE updateLen=${uLen}`;
    }
    return `SYNC-sub${sub}`;
  }
  if (first === 0x01) {
    // Awareness
    const [payloadLen] = readVarUint(data, 1);
    return `AWARENESS payloadLen=${payloadLen}`;
  }
  if (first === 0x11) return "Y.PING";
  if (first === 0x12) return "Y.PONG";
  
  // Extended message types (varuint)
  const [msgType] = readVarUint(data, 0);
  if (msgType === 300) {
    const [jwtLen, jwtOff] = readVarUint(data, 2);
    return `JWT-REAUTH len=${jwtLen}`;
  }
  return `UNKNOWN type=0x${first.toString(16)} (${msgType})`;
}

async function createPage(): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const noteId = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const res = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WS_ID, noteId,
      note: { textVersion: 2, title: `Interactive Capture ${new Date().toLocaleTimeString()}`, parentId: "default", is_portal_share: false },
    }),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status}`);
  return ((await res.json()) as any).globalId || noteId;
}

async function main() {
  const argUrl = process.argv[2];
  let pageUrl: string;
  
  if (argUrl) {
    pageUrl = argUrl;
  } else {
    const pageId = await createPage();
    pageUrl = `https://${HOST}/ws/${WS_ID}/note/${pageId}`;
  }
  
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   INTERACTIVE WEBSOCKET CAPTURE TOOL        ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║ Page: ${pageUrl.slice(0, 40)}...`);
  console.log("║                                              ║");
  console.log("║ 1. Browser will open to your Fusebase page   ║");
  console.log("║ 2. Type content in the editor                ║");  
  console.log("║ 3. All WS frames are decoded in real-time    ║");
  console.log("║ 4. Press Ctrl+C or close browser to stop     ║");
  console.log("╚══════════════════════════════════════════════╝\n");
  
  const log: string[] = [];
  const logLine = (s: string) => { console.log(s); log.push(s); };
  
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: ["--no-sandbox"],
    viewport: { width: 1280, height: 800 },
  });
  
  const page = await context.newPage();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  
  let editorWsId: string | null = null;
  let frameCount = 0;
  const startTime = Date.now();
  
  const ts = () => `+${((Date.now() - startTime) / 1000).toFixed(1)}s`;
  
  cdp.on("Network.webSocketCreated", (event: any) => {
    const url = event.url || "";
    if (url.includes("text.nimbusweb.me/socket.io.editor")) {
      editorWsId = event.requestId;
      logLine(`\n${ts()} ═══ EDITOR WS CONNECTED ═══`);
      
      // Extract key URL params
      const encv2 = url.includes("encv2=true");
      const cidM = url.match(/cid=(\d+)/);
      const ss1M = url.match(/syncStep1=([^&]+)/);
      logLine(`  encv2: ${encv2}`);
      logLine(`  clientId: ${cidM?.[1]}`);
      if (ss1M) {
        const b = Buffer.from(decodeURIComponent(ss1M[1]), "base64");
        logLine(`  syncStep1: [${Array.from(b).join(",")}] (${b.length}b)`);
      }
    }
  });
  
  cdp.on("Network.webSocketClosed", (event: any) => {
    if (event.requestId === editorWsId) {
      logLine(`\n${ts()} ═══ EDITOR WS CLOSED ═══`);
    }
  });
  
  const handleFrame = (dir: string, event: any) => {
    if (event.requestId !== editorWsId) return;
    
    const payload = event.response?.payloadData;
    if (!payload) return;
    
    frameCount++;
    let data: Buffer;
    try {
      // CDP base64-encodes binary frames
      if (event.response.opcode === 2) {
        data = Buffer.from(payload, "base64");
      } else {
        data = Buffer.from(payload, "utf-8");
      }
    } catch {
      data = Buffer.from(payload, "utf-8");
    }
    
    const decoded = decodeMsgType(data);
    const hex = data.toString("hex").slice(0, 60);
    
    // Color-code by direction and importance
    const prefix = dir === "SENT" ? "  ▲" : "  ▼";
    const isUpdate = decoded.includes("Y.UPDATE");
    const marker = isUpdate ? " ★★★" : "";
    
    logLine(`${ts()} ${prefix} ${dir} [${data.length}b] ${decoded}${marker}`);
    
    // For Y.UPDATE messages, show extended details
    if (isUpdate) {
      logLine(`         hex: ${hex}...`);
      logLine(`         bytes: [${Array.from(data.slice(0, 30)).join(",")}]`);
    }
    
    // For SYNC messages, show hex
    if (decoded.startsWith("SYNC-")) {
      logLine(`         hex: ${hex}`);
    }
  };
  
  cdp.on("Network.webSocketFrameSent", (event: any) => handleFrame("SENT", event));
  cdp.on("Network.webSocketFrameReceived", (event: any) => handleFrame("RECV", event));
  
  // Navigate
  logLine(`${ts()} Navigating to page...`);
  try {
    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    logLine(`${ts()} Page loaded!`);
  } catch (e) {
    logLine(`${ts()} Navigation: ${(e as Error).message.slice(0, 100)}`);
  }
  
  logLine(`\n${ts()} ═══ READY — Type content in the browser! ═══\n`);
  
  // Keep running until browser closes or Ctrl+C
  const cleanup = async () => {
    logLine(`\n${ts()} ═══ STOPPING — ${frameCount} frames captured ═══`);
    
    // Save log
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.writeFileSync(LOG_FILE, log.join("\n"), "utf-8");
    logLine(`Log saved: ${LOG_FILE}`);
    
    try { await context.close(); } catch {}
    process.exit(0);
  };
  
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  
  // Wait for browser to close
  context.on("close", () => {
    console.log(`\n${ts()} Browser closed. Saving log...`);
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.writeFileSync(LOG_FILE, log.join("\n"), "utf-8");
    console.log(`Log saved: ${LOG_FILE}`);
    process.exit(0);
  });
  
  // Keep alive
  await new Promise(() => {}); 
}

main().catch(console.error);
