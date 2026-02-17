/**
 * Connect to a known browser-created page (1tZiv20EWydrHyaB)
 * as a listener, then ask the user to type something in the browser.
 * Capture the raw update bytes sent by the browser to see the exact format.
 */
import * as Y from "yjs";
import { loadEncryptedCookie } from "../src/crypto.js";
import WebSocket from "ws";

const WS_ID = "45h7lom5ryjak34u";
const HOST = "inkabeam.nimbusweb.me";

function writeVarU(n: number) { const b: number[] = []; while (n > 0x7f) { b.push(0x80 | (n & 0x7f)); n >>>= 7; } b.push(n & 0x7f); return new Uint8Array(b); }
function readVarU(d: Uint8Array, o: number): [number, number] { let n = 0, m = 1, p = o; while (p < d.length) { const b = d[p++]; n += (b & 0x7f) * m; if ((b & 0x80) === 0) return [n, p]; m *= 128; } return [n, p]; }

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored) throw new Error("No cookie");
  const cookie = stored.cookie;

  const pageId = "1tZiv20EWydrHyaB";  // existing browser page
  const tokenResp = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
    method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}",
  });
  const jwt = ((await tokenResp.json()) as any).token;

  const ydoc = new Y.Doc();
  const sv = Y.encodeStateVector(ydoc);
  const svLen = writeVarU(sv.length);
  const s1 = new Uint8Array(2 + svLen.length + sv.length);
  s1[0] = 0; s1[1] = 0; s1.set(svLen, 2); s1.set(sv, 2 + svLen.length);
  const s1B64 = Buffer.from(s1).toString("base64");
  const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);

  const wsUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}?token=${jwt}&cid=${ydoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=spy${Date.now()}&ratempt=0&widx=0&encv2=true&timezone=${tz}&syncStep1=${encodeURIComponent(s1B64)}`;

  console.log("Connecting as listener (encv2=true)...");
  console.log("Waiting for browser-sent updates for 60s...  Go type in the browser!");

  const ws = new WebSocket(wsUrl, { headers: { origin: `https://${HOST}`, cookie } });

  let didSync = false;
  let msgCount = 0;

  ws.on("error", (e: Error) => console.log(`ERROR: ${e.message}`));
  ws.on("close", () => console.log("CLOSED"));

  ws.on("message", (raw: Buffer, isBinary: boolean) => {
    msgCount++;
    if (!isBinary) { console.log(`  TEXT MSG#${msgCount}: ${raw.toString().substring(0, 100)}`); return; }
    const data = new Uint8Array(raw);

    // Handle pings
    if (data[0] === 17) { ws.send(Buffer.from(new Uint8Array([18]))); return; }

    // Parse message type
    const [msgType, off1] = readVarU(data, 0);
    
    if (msgType === 0) { // SYNC
      const [sub, off2] = readVarU(data, off1);
      
      if (sub === 0) { // SyncStep1
        console.log(`  SyncStep1 from server (${data.length} bytes)`);
        const upd = Y.encodeStateAsUpdateV2(ydoc);
        const vl = writeVarU(upd.length);
        const m = new Uint8Array(2 + vl.length + upd.length);
        m[0] = 0; m[1] = 1; m.set(vl, 2); m.set(upd, 2 + vl.length);
        ws.send(Buffer.from(m));
      }
      
      else if (sub === 1) { // SyncStep2
        const [uLen, uStart] = readVarU(data, off2);
        const ud = data.slice(uStart, uStart + uLen);
        console.log(`  SyncStep2: ${uLen} bytes payload`);
        try { Y.applyUpdateV2(ydoc, ud); didSync = true; console.log("  Applied V2 (synced!)"); }
        catch { console.log("  V2 failed, trying V1"); try { Y.applyUpdate(ydoc, ud); didSync = true; } catch (e2) { console.log(`  V1 also failed: ${(e2 as Error).message}`); }}
      }
      
      else if (sub === 2) { // Update
        const [uLen, uStart] = readVarU(data, off2);
        const ud = data.slice(uStart, uStart + uLen);
        console.log(`\n  *** UPDATE received! ${uLen} bytes ***`);
        console.log(`  Raw bytes[0..40]: [${Array.from(ud.slice(0, 40)).join(",")}]`);
        console.log(`  Hex: ${Array.from(ud.slice(0, 40)).map(b => b.toString(16).padStart(2, "0")).join(" ")}`);
        
        // The first few bytes of a V2 update should tell us the encoding
        console.log(`  Byte[0]: ${ud[0]} (version/flag?)`);
        console.log(`  Byte[1]: ${ud[1]}`);
        console.log(`  Byte[2]: ${ud[2]}`);
        
        try { Y.applyUpdateV2(ydoc, ud); console.log("  Applied as V2 — SUCCESS"); }
        catch { console.log("  V2 apply failed"); try { Y.applyUpdate(ydoc, ud); console.log("  Applied as V1 — SUCCESS"); } catch { console.log("  V1 also failed"); } }
      }
    }
    
    else if (msgType === 1) { // AWARENESS
      console.log(`  AWARENESS msg (${data.length} bytes)`);
    }
    
    else {
      console.log(`  UNKNOWN msgType=${msgType} (${data.length} bytes): [${Array.from(data.slice(0, 20)).join(",")}]`);
    }
  });

  // Auto-close after 60s
  setTimeout(() => { console.log("\n--- Timeout. Closing. ---"); try { ws.close(); } catch {} }, 60000);
}

main().catch(e => { console.error(e); process.exit(1); });
