/**
 * A/B Comparison: Browser WebSocket frames vs Our Writer
 * 
 * Phase 1: Analyze existing browser capture from data/ws-capture.json
 * Phase 2: Run our writer on a fresh page, capture its frames
 * Phase 3: Compare the two — find the exact protocol difference
 * 
 * Run: npx tsx scripts/ab-compare.ts
 */

import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import { WebSocket } from "ws";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { loadEncryptedCookie } from "../src/crypto.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Env ───
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
const WS_ID = process.env.FUSEBASE_WS_ID || "45h7lom5ryjak34u";
const stored = loadEncryptedCookie();
const COOKIE = stored?.cookie || process.env.FUSEBASE_COOKIE!;

// ─── Helpers ───
function readVarUint(data: Uint8Array, offset: number): [number, number] {
  let result = 0, shift = 0, byte: number;
  do { byte = data[offset++]; result |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
  return [result, offset];
}

function writeVarUint(buf: number[], num: number): void {
  while (num > 0x7f) { buf.push(0x80 | (num & 0x7f)); num >>>= 7; }
  buf.push(num & 0x7f);
}

function encodeSyncMsg(subType: number, data: Uint8Array): Uint8Array {
  const header: number[] = [0x00, subType];
  writeVarUint(header, data.length);
  const msg = new Uint8Array(header.length + data.length);
  msg.set(header);
  msg.set(data, header.length);
  return msg;
}

function encodeAwareness(clientId: number, clock: number, state: string = "{}"): Uint8Array {
  const buf: number[] = [0x01];
  writeVarUint(buf, 1);
  writeVarUint(buf, clientId);
  writeVarUint(buf, clock);
  const sb = new TextEncoder().encode(state);
  writeVarUint(buf, sb.length);
  const r = new Uint8Array(buf.length + sb.length);
  r.set(buf);
  r.set(sb, buf.length);
  return r;
}

function msgTypeName(firstBytes: number[]): string {
  const t = firstBytes[0];
  if (t === 0) {
    const sub = firstBytes[1];
    return `SYNC.${sub === 0 ? "Step1" : sub === 1 ? "Step2" : sub === 2 ? "Update" : "sub" + sub}`;
  }
  if (t === 1) return "AWARE";
  if (t === 0x11) return "PING";
  if (t === 0x12) return "PONG";
  return `0x${t.toString(16)}`;
}

function docStructure(doc: Y.Doc): string {
  const lines: string[] = [];
  
  // Check top-level shared types
  const topBlocks = doc.getMap("blocks");
  const topChildren = doc.getArray("children");
  const topRootChildren = doc.getArray("rootChildren");
  
  if (topBlocks.size > 0 || topChildren.length > 0 || topRootChildren.length > 0) {
    lines.push(`  TOP-LEVEL: blocks=${topBlocks.size} children=${topChildren.length} rootChildren=${topRootChildren.length}`);
    if (topChildren.length > 0) {
      lines.push(`    children: [${topChildren.toJSON().slice(0, 5).join(", ")}${topChildren.length > 5 ? "..." : ""}]`);
    }
    for (const [key, val] of topBlocks.entries()) {
      if (val instanceof Y.Map) {
        const type = val.get("type");
        const chars = val.get("characters");
        const charCount = chars instanceof Y.Array ? chars.length : "N/A";
        const fields = Array.from(val.keys()).sort().join(", ");
        lines.push(`    block "${key}" type="${type}" chars=${charCount} fields=[${fields}]`);
        if (chars instanceof Y.Array && chars.length > 0) {
          const text = chars.toJSON().filter((c: any) => typeof c === "string").join("");
          if (text) lines.push(`      text: "${text.slice(0, 80)}"`);
        }
      }
    }
  }
  
  // Check nested under root
  const root = doc.getMap("root");
  if (root.size > 0) {
    lines.push(`  ROOT MAP: keys=[${Array.from(root.keys()).sort().join(", ")}]`);
    const ch = root.get("children");
    if (ch instanceof Y.Array && ch.length > 0) {
      lines.push(`    root.children (${ch.length}): [${ch.toJSON().slice(0, 5).join(", ")}${ch.length > 5 ? "..." : ""}]`);
    }
    const rch = root.get("rootChildren");
    if (rch instanceof Y.Array && rch.length > 0) {
      lines.push(`    root.rootChildren (${rch.length}): [${rch.toJSON().slice(0, 5).join(", ")}${rch.length > 5 ? "..." : ""}]`);
    }
    const blk = root.get("blocks");
    if (blk instanceof Y.Map && blk.size > 0) {
      lines.push(`    root.blocks (${blk.size}):`);
      for (const [key, val] of blk.entries()) {
        if (val instanceof Y.Map) {
          const type = val.get("type");
          const chars = val.get("characters");
          const charCount = chars instanceof Y.Array ? chars.length : "N/A";
          lines.push(`      block "${key}" type="${type}" chars=${charCount}`);
          if (chars instanceof Y.Array && chars.length > 0) {
            const text = chars.toJSON().filter((c: any) => typeof c === "string").join("");
            if (text) lines.push(`        text: "${text.slice(0, 80)}"`);
          }
        }
      }
    }
  }
  
  // Check all top-level shared types
  const allTypes = new Set<string>();
  doc.share.forEach((_val, key) => allTypes.add(key));
  const unexpected = [...allTypes].filter(k => !["root", "blocks", "children", "rootChildren"].includes(k));
  if (unexpected.length > 0) {
    lines.push(`  OTHER SHARED TYPES: [${unexpected.join(", ")}]`);
  }
  
  return lines.join("\n");
}

// ─── Phase 1: Analyze browser capture ───
async function analyzeBrowserCapture(): Promise<void> {
  const capturePath = path.resolve(__dirname, "..", "data", "ws-capture.json");
  if (!fs.existsSync(capturePath)) {
    console.log("⚠️  No browser capture found. Run: npx tsx scripts/capture-browser-ws.ts");
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(capturePath, "utf-8"));
  const frames = data.editorFrames;
  
  console.log("═".repeat(70));
  console.log("  PHASE 1: BROWSER CAPTURE ANALYSIS");
  console.log("═".repeat(70));
  console.log(`  Captured: ${data.capturedAt}`);
  console.log(`  Page: ${data.pageId}`);
  console.log(`  Frames: ${frames.length}`);
  console.log("");
  
  // Show frame sequence
  console.log("  Browser Frame Sequence:");
  console.log("  ─────────────────────────────────────────────────────");
  
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const dir = f.direction === "sent" ? ">>" : "<<";
    const type = msgTypeName(f.firstBytes);
    console.log(`  ${String(i + 1).padStart(3)} ${dir} [${String(f.payloadLen).padStart(5)}b] ${type.padEnd(12)} first=[${f.firstBytes.slice(0, 12).join(",")}]`);
  }
  
  // Find the SYNC.Update frames (these are the content writes)
  const updateFrames = frames.filter((f: any) => f.direction === "sent" && f.firstBytes[0] === 0 && f.firstBytes[1] === 2);
  console.log(`\n  Browser sent ${updateFrames.length} SYNC.Update frames (content writes)`);
  
  // Find the first meaningful update (after sync)
  if (updateFrames.length > 0) {
    const firstUpdate = updateFrames[0];
    const updateBin = Buffer.from(firstUpdate.payloadHex, "hex");
    console.log(`\n  First SYNC.Update: ${updateBin.length} bytes`);
    console.log(`    Hex (first 60): ${firstUpdate.payloadHex.slice(0, 120)}`);
    
    // Try to decode the Y.js update inside
    const [subType, subOff] = readVarUint(updateBin, 1);
    const [uLen, uStart] = readVarUint(updateBin, subOff);
    const updateData = updateBin.slice(uStart, uStart + uLen);
    console.log(`    Inner update: ${updateData.length} bytes, starts at offset ${uStart}`);
    
    // Apply to a doc and inspect structure
    const testDoc = new Y.Doc();
    let applied = false;
    try { Y.applyUpdate(testDoc, updateData); applied = true; console.log(`    Applied as V1 ✓`); } catch {}
    if (!applied) {
      try { Y.applyUpdateV2(testDoc, updateData); applied = true; console.log(`    Applied as V2 ✓`); } catch {}
    }
    if (applied) {
      console.log("\n  Browser update decoded structure:");
      console.log(docStructure(testDoc));
    }
  }
  
  // Try to reconstruct full browser doc from all frames
  console.log("\n  ─── Reconstructing full browser doc ───");
  const brDoc = new Y.Doc();
  let brApplied = 0;
  for (const f of frames) {
    if (f.firstBytes[0] !== 0) continue; // only sync messages
    const bin = Buffer.from(f.payloadHex, "hex");
    const [sub, off] = readVarUint(bin, 1);
    if (sub !== 1 && sub !== 2) continue; // Step2 or Update
    const [len, start] = readVarUint(bin, off);
    const ud = bin.slice(start, start + len);
    
    // For received Step2/Updates (server state)
    if (f.direction === "received") {
      try { Y.applyUpdate(brDoc, ud); brApplied++; } catch {
        try { Y.applyUpdateV2(brDoc, ud); brApplied++; } catch {}
      }
    }
    // For sent Updates (our writes)
    if (f.direction === "sent" && sub === 2) {
      try { Y.applyUpdate(brDoc, ud); brApplied++; } catch {
        try { Y.applyUpdateV2(brDoc, ud); brApplied++; } catch {}
      }
    }
  }
  
  console.log(`  Applied ${brApplied} updates to reconstruct browser doc`);
  console.log("  Browser doc structure:");
  console.log(docStructure(brDoc));
  console.log("");
  
  // CRITICAL: Also check the browser's WS URL from the capture
  const wsUrl = data.summary?.editorWsUrl || data.editorFrames?.[0]?.url || "";
  if (wsUrl) {
    const urlParams = new URL(wsUrl).searchParams;
    console.log("  Browser WS URL Parameters:");
    console.log(`    encv2: ${urlParams.get("encv2")}`);
    console.log(`    cid: ${urlParams.get("cid")}`);
    console.log(`    web-editor: ${urlParams.get("web-editor")}`);
    console.log(`    syncStep1: ${urlParams.get("syncStep1") ? urlParams.get("syncStep1")!.slice(0, 40) + "..." : "null"}`);
    console.log("");
  }
}

// ─── Phase 2: Test our writer and capture its frames ───
async function testOurWriter(): Promise<void> {
  console.log("═".repeat(70));
  console.log("  PHASE 2: OUR WRITER TEST");
  console.log("═".repeat(70));
  
  // Create a fresh page
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const noteId = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const title = `AB-Test ${new Date().toISOString().slice(11, 19)}`;
  
  console.log(`  Creating page "${title}"...`);
  const createRes = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId: WS_ID, noteId,
      note: { textVersion: 2, title, parentId: "default", is_portal_share: false },
    }),
  });
  if (!createRes.ok) { console.log(`  ❌ Create failed: ${createRes.status}`); return; }
  const pageData = await createRes.json() as any;
  const pageId = pageData.globalId || noteId;
  console.log(`  Page: ${pageId}`);
  console.log(`  URL: https://${HOST}/ws/${WS_ID}/note/${pageId}`);
  
  // Get JWT
  const tokenRes = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
    method: "POST",
    headers: { cookie: COOKIE, "content-type": "application/json" },
    body: JSON.stringify({ tokens: [] }),
  });
  if (!tokenRes.ok) { console.log(`  ❌ JWT failed: ${tokenRes.status}`); return; }
  const jwt = ((await tokenRes.json()) as any).token;
  
  // Build initial Y.Doc (empty)
  const ydoc = new Y.Doc();
  console.log(`  Client ID: ${ydoc.clientID}`);
  
  // Build SyncStep1 for URL
  const sv = Y.encodeStateVector(ydoc);
  const svBuf: number[] = [0x00, 0x00];
  writeVarUint(svBuf, sv.length);
  const ss1 = new Uint8Array(svBuf.length + sv.length);
  ss1.set(svBuf); ss1.set(sv, svBuf.length);
  const syncStep1B64 = Buffer.from(ss1).toString("base64");
  
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const frameId = Math.random().toString(36).slice(2, 9);
  const wsUrl = [
    `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}`,
    `?token=${jwt}&cid=${ydoc.clientID}`,
    `&app=web&reason=editor&web-editor=1.1.10`,
    `&frame_id=${frameId}&ratempt=0&widx=0`,
    `&encv2=true`,
    `&timezone=${encodeURIComponent(tz)}`,
    `&syncStep1=${encodeURIComponent(syncStep1B64)}`,
  ].join("");
  
  console.log("\n  Our WS URL Parameters:");
  console.log(`    encv2: true`);
  console.log(`    cid: ${ydoc.clientID}`);
  console.log(`    web-editor: 1.1.10`);
  console.log(`    syncStep1: ${syncStep1B64.slice(0, 40)}...`);
  console.log("");
  
  // Connect and log everything
  const ourFrames: { dir: string; len: number; type: string; hex: string; data: Uint8Array }[] = [];
  
  await new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl, {
      headers: { origin: `https://${HOST}`, cookie: COOKIE },
    });
    
    let done = false;
    const finish = () => { if (!done) { done = true; try { ws.close(); } catch {} resolve(); } };
    setTimeout(() => { console.log("  TIMEOUT"); finish(); }, 30000);
    
    ws.on("error", (e) => { console.log(`  ❌ WS error: ${e.message}`); finish(); });
    ws.on("close", (code) => { console.log(`  WS closed: ${code}`); if (!done) finish(); });
    ws.on("unexpected-response", (_req: unknown, res: { statusCode: number }) => {
      console.log(`  ❌ WS upgrade failed: HTTP ${res.statusCode}`);
      finish();
    });
    
    // Step 1: Send awareness on open (like browser)
    ws.on("open", () => {
      const msg = encodeAwareness(ydoc.clientID, 0);
      ws.send(Buffer.from(msg));
      ourFrames.push({ dir: ">>", len: msg.length, type: "AWARE", hex: Buffer.from(msg).toString("hex"), data: msg });
      console.log(`  >> SENT AWARENESS [${msg.length}b]`);
    });
    
    let syncDone = false;
    
    ws.on("message", (raw: Buffer, isBinary: boolean) => {
      if (!isBinary) return;
      const data = new Uint8Array(raw);
      if (data.length === 0) return;
      
      const hex = Buffer.from(data).toString("hex");
      const type = msgTypeName(Array.from(data.slice(0, 10)));
      
      // Ping -> Pong
      if (data[0] === 0x11) {
        ws.send(Buffer.from([0x12]));
        return;
      }
      if (data[0] === 0x12 || data[0] === 0x01) return; // pong, awareness
      
      ourFrames.push({ dir: "<<", len: data.length, type, hex, data: Uint8Array.from(data) });
      console.log(`  << RECV [${String(data.length).padStart(5)}b] ${type.padEnd(12)} first=[${Array.from(data.slice(0, 12)).join(",")}]`);
      
      if (data[0] !== 0x00) return;
      const [subType, subOff] = readVarUint(data, 1);
      
      if (subType === 0) {
        // Server SyncStep1: respond with our empty state
        const [svLen, svStart] = readVarUint(data, subOff);
        const serverSv = data.slice(svStart, svStart + svLen);
        const update = Y.encodeStateAsUpdate(ydoc, serverSv);
        const step2 = encodeSyncMsg(0x01, update);
        ws.send(Buffer.from(step2));
        ourFrames.push({ dir: ">>", len: step2.length, type: "SYNC.Step2", hex: Buffer.from(step2).toString("hex"), data: step2 });
        console.log(`  >> SENT Step2 [${step2.length}b] update=[${Array.from(update).join(",")}]`);
      }
      
      else if (subType === 1 && !syncDone) {
        syncDone = true;
        // Server SyncStep2: apply server state
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);
        
        let applied = false;
        try { Y.applyUpdateV2(ydoc, updateData); applied = true; console.log(`    Applied as V2 ✓`); } catch {}
        if (!applied) {
          try { Y.applyUpdate(ydoc, updateData); applied = true; console.log(`    Applied as V1 ✓`); } catch {}
        }
        if (!applied) { console.log(`    ❌ Failed to apply server state`); finish(); return; }
        
        console.log("  Doc after sync:");
        console.log(docStructure(ydoc));
        
        // Now write "Hello World" — same as what browser typed in capture
        console.log("\n  Writing content (Hello World + heading)...");
        
        const beforeSv = Y.encodeStateVector(ydoc);
        let blockCounter = 0;
        const genBlockId = () => `b${Date.now()}_${blockCounter++}`;
        
        ydoc.transact(() => {
          // CRITICAL QUESTION: top-level or nested under root?
          // Let's test BOTH approaches and see the diff
          
          // Approach: Top-level shared types (what our production writer does)
          const blocksMap = ydoc.getMap("blocks");
          const children = ydoc.getArray<string>("children");
          const rootChildren = ydoc.getArray<string>("rootChildren");
          
          // Clear if needed
          if (children.length > 0) children.delete(0, children.length);
          if (rootChildren.length > 0) rootChildren.delete(0, rootChildren.length);
          for (const k of Array.from(blocksMap.keys())) blocksMap.delete(k);
          
          // Add a paragraph with "Hello World"
          const pId = genBlockId();
          const pm = new Y.Map();
          pm.set("id", pId);
          pm.set("type", "paragraph");
          pm.set("number", "0");
          pm.set("indent", 0);
          pm.set("selectorId", "0");
          pm.set("capsule", false);
          pm.set("contentId", "");
          pm.set("mode", "none");
          pm.set("parent", "");
          const pChars = new Y.Array();
          for (const c of "Hello World") pChars.push([c]);
          pm.set("characters", pChars);
          blocksMap.set(pId, pm);
          children.push([pId]);
          rootChildren.push([pId]);
        });
        
        // Encode as V1 diff
        const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
        const updateMsg = encodeSyncMsg(0x02, diff);
        ws.send(Buffer.from(updateMsg));
        ourFrames.push({ dir: ">>", len: updateMsg.length, type: "SYNC.Update", hex: Buffer.from(updateMsg).toString("hex"), data: updateMsg });
        
        console.log(`  >> SENT Update [${updateMsg.length}b] diff=${diff.length}b`);
        console.log(`     first 40 hex: ${Buffer.from(diff).toString("hex").slice(0, 80)}`);
        
        console.log("\n  Doc after write:");
        console.log(docStructure(ydoc));
        
        // Wait for server to process, then verify
        console.log("\n  Waiting 5s for server...");
        setTimeout(async () => {
          // Check dump
          const dumpRes = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
          const dumpBin = new Uint8Array(await dumpRes.arrayBuffer());
          console.log(`  Dump: ${dumpBin.length} bytes`);
          
          // Try to decode the dump
          const dumpDoc = new Y.Doc();
          let dumpApplied = false;
          // /dump returns the raw V1 update prefixed with some header bytes
          // Try several offsets
          for (const offset of [0, 1, 2, 3]) {
            try {
              const d = dumpBin.slice(offset);
              Y.applyUpdate(dumpDoc, d);
              dumpApplied = true;
              console.log(`  Dump decoded (V1, offset=${offset}):`);
              break;
            } catch {}
          }
          if (!dumpApplied) {
            for (const offset of [0, 1, 2, 3]) {
              try {
                const d = dumpBin.slice(offset);
                Y.applyUpdateV2(dumpDoc, d);
                dumpApplied = true;
                console.log(`  Dump decoded (V2, offset=${offset}):`);
                break;
              } catch {}
            }
          }
          if (dumpApplied) {
            console.log(docStructure(dumpDoc));
          } else {
            console.log("  ❌ Could not decode dump");
            // Show textual content in raw binary
            const text = Buffer.from(dumpBin).toString("utf-8");
            const hasHello = text.includes("Hello");
            const hasParagraph = text.includes("paragraph");
            console.log(`  Raw dump contains "Hello": ${hasHello}`);
            console.log(`  Raw dump contains "paragraph": ${hasParagraph}`);
          }
          
          // Now open this page in the browser and check if it renders
          console.log(`\n  🌐 Check this page: https://${HOST}/ws/${WS_ID}/note/${pageId}`);
          
          finish();
        }, 5000);
      }
      
      else if (subType === 2) {
        // Incremental update from server
        const [uLen, uStart] = readVarUint(data, subOff);
        const updateData = data.slice(uStart, uStart + uLen);
        try { Y.applyUpdateV2(ydoc, updateData); } catch {
          try { Y.applyUpdate(ydoc, updateData); } catch {}
        }
      }
    });
  });
  
  // Show our frame summary
  console.log("\n  Our Frame Sequence:");
  console.log("  ─────────────────────────────────────────────────────");
  for (let i = 0; i < ourFrames.length; i++) {
    const f = ourFrames[i];
    console.log(`  ${String(i + 1).padStart(3)} ${f.dir} [${String(f.len).padStart(5)}b] ${f.type.padEnd(12)} hex=${f.hex.slice(0, 40)}...`);
  }
}

// ─── Main ───
async function main() {
  console.log("\n" + "╔".padEnd(69, "═") + "╗");
  console.log("║  A/B COMPARISON: Browser vs Our Writer                            ║");
  console.log("╚".padEnd(69, "═") + "╝\n");
  
  await analyzeBrowserCapture();
  console.log("\n");
  await testOurWriter();
  
  console.log("\n" + "═".repeat(70));
  console.log("  DONE");
  console.log("═".repeat(70));
}

main().catch(console.error);
