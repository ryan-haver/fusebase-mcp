/**
 * Capture the EXACT bytes the server sends in encv2=true mode
 * to understand the 3-byte framing the user observed
 */
import * as Y from "yjs";
import { loadEncryptedCookie } from "../src/crypto.js";
import WebSocket from "ws";

const WS_ID = "45h7lom5ryjak34u";
const HOST = "inkabeam.nimbusweb.me";

function writeVarUint(num: number): Uint8Array {
  const bytes: number[] = [];
  while (num > 0x7f) { bytes.push(0x80 | (num & 0x7f)); num >>>= 7; }
  bytes.push(num & 0x7f);
  return new Uint8Array(bytes);
}

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored) throw new Error("No cookie");
  const cookie = stored.cookie;

  // Create fresh page  
  const cs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let noteId = ""; for (let i = 0; i < 16; i++) noteId += cs.charAt(Math.floor(Math.random() * cs.length));
  const createResp = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ workspaceId: WS_ID, noteId, note: { textVersion: 2, title: "Frame Test " + Date.now(), parentId: "default", is_portal_share: false } }),
  });
  const cd = await createResp.json() as any;
  const pageId = cd.globalId || noteId;

  const tokenResp = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
    method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}",
  });
  const jwt = ((await tokenResp.json()) as any).token;

  // Connect WITHOUT encv2 first
  for (const mode of ["no-encv2", "encv2"]) {
    console.log(`\n=== ${mode} ===`);
    
    const ydoc = new Y.Doc();
    const sv = Y.encodeStateVector(ydoc);
    const svLen = writeVarUint(sv.length);
    const s1 = new Uint8Array(2 + svLen.length + sv.length);
    s1[0] = 0; s1[1] = 0; s1.set(svLen, 2); s1.set(sv, 2 + svLen.length);
    const s1B64 = Buffer.from(s1).toString("base64");

    const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const encv2Param = mode === "encv2" ? "&encv2=true" : "";
    const wsUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}?token=${jwt}&cid=${ydoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=f${Date.now()}&ratempt=0&widx=0${encv2Param}&timezone=${tz}&syncStep1=${encodeURIComponent(s1B64)}`;

    await new Promise<void>((resolve) => {
      const ws = new WebSocket(wsUrl, { headers: { origin: `https://${HOST}`, cookie } });
      let msgCount = 0;
      const to = setTimeout(() => { try { ws.close(); } catch {} resolve(); }, 8000);

      ws.on("error", () => { clearTimeout(to); resolve(); });

      ws.on("message", (raw: Buffer, isBinary: boolean) => {
        msgCount++;
        const data = new Uint8Array(raw);
        
        if (!isBinary) { console.log(`  MSG#${msgCount} TEXT: ${raw.toString().substring(0, 100)}`); return; }

        console.log(`  MSG#${msgCount} [${data.length} bytes]: [${Array.from(data).join(",")}]`);
        console.log(`    Hex: ${Array.from(data).map(b => b.toString(16).padStart(2, "0")).join(" ")}`);
        
        // Describe known message types
        if (data[0] === 17) { ws.send(Buffer.from(new Uint8Array([18]))); return; }
        if (data[0] === 0) {
          console.log(`    Type: SYNC`);
          if (data.length > 1) console.log(`    Byte[1]: ${data[1]} (0=step1, 1=step2, 2=update)`);
          if (data.length > 2) console.log(`    Byte[2]: ${data[2]}`);
          if (data.length > 3) console.log(`    Byte[3]: ${data[3]}`);
        }

        // After 3 messages or sync step 2, close
        if (msgCount >= 3 || (data[0] === 0 && data.length > 1 && data[1] === 1)) {
          clearTimeout(to);
          setTimeout(() => { try { ws.close(); } catch {} resolve(); }, 500);
        }
      });
    });
  }

  // Also check what an existing browser-created page sends
  console.log(`\n=== Browser-created page (1tZiv20EWydrHyaB) with encv2=true ===`);
  const tokenResp2 = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/1tZiv20EWydrHyaB/tokens`, {
    method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}",
  });
  const jwt2 = ((await tokenResp2.json()) as any).token;

  const ydoc2 = new Y.Doc();
  const sv2 = Y.encodeStateVector(ydoc2);
  const svLen2 = writeVarUint(sv2.length);
  const s12 = new Uint8Array(2 + svLen2.length + sv2.length);
  s12[0] = 0; s12[1] = 0; s12.set(svLen2, 2); s12.set(sv2, 2 + svLen2.length);
  const s1B642 = Buffer.from(s12).toString("base64");
  const tz2 = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const wsUrl2 = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/1tZiv20EWydrHyaB?token=${jwt2}&cid=${ydoc2.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=f${Date.now()}&ratempt=0&widx=0&encv2=true&timezone=${tz2}&syncStep1=${encodeURIComponent(s1B642)}`;

  await new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl2, { headers: { origin: `https://${HOST}`, cookie } });
    let msgCount = 0;
    const to = setTimeout(() => { try { ws.close(); } catch {} resolve(); }, 8000);

    ws.on("error", () => { clearTimeout(to); resolve(); });

    ws.on("message", (raw: Buffer, isBinary: boolean) => {
      msgCount++;
      const data = new Uint8Array(raw);
      if (!isBinary) { console.log(`  MSG#${msgCount} TEXT: ${raw.toString().substring(0, 100)}`); return; }
      if (data[0] === 17) { ws.send(Buffer.from(new Uint8Array([18]))); return; }

      // Only show first 50 bytes for large messages
      const show = Math.min(data.length, 50);
      console.log(`  MSG#${msgCount} [${data.length} bytes]: [${Array.from(data.slice(0, show)).join(",")}]${data.length > 50 ? "..." : ""}`);
      console.log(`    Hex: ${Array.from(data.slice(0, show)).map(b => b.toString(16).padStart(2, "0")).join(" ")}${data.length > 50 ? "..." : ""}`);

      if (data[0] === 0) {
        console.log(`    Byte[0]=0 (SYNC), Byte[1]=${data[1]}, Byte[2]=${data[2]}, Byte[3]=${data[3]}`);
      }

      if (msgCount >= 3 || (data[0] === 0 && data.length > 1 && data[1] === 1)) {
        clearTimeout(to);
        setTimeout(() => { try { ws.close(); } catch {} resolve(); }, 500);
      }
    });
  });
}

main().catch(e => { console.error(e); process.exit(1); });
