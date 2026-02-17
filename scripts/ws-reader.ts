/**
 * WebSocket "reader" — connects as a fresh client to see what state
 * the server sends back. This mimics what the browser does when opening
 * a page for the first time.
 */
import * as Y from "yjs";
import { loadEncryptedCookie } from "../src/crypto.js";
import WebSocket from "ws";

const WS_ID = "45h7lom5ryjak34u";
const HOST = "inkabeam.nimbusweb.me";

// Pages to test:
// BDXl3LBHNDS5QhtL - the demo page (created + written content)
// 1tZiv20EWydrHyaB - known browser-created page with content
// 7SGBAZlCo2B88dfg - page from V1 writer test

function writeVarUint(num: number): Uint8Array {
  const bytes: number[] = [];
  while (num > 0x7f) { bytes.push(0x80 | (num & 0x7f)); num >>>= 7; }
  bytes.push(num & 0x7f);
  return new Uint8Array(bytes);
}

function readVarUint(data: Uint8Array, offset: number): [number, number] {
  let num = 0, mult = 1, pos = offset;
  while (pos < data.length) {
    const b = data[pos++];
    num += (b & 0x7f) * mult;
    if ((b & 0x80) === 0) return [num, pos];
    mult *= 128;
  }
  return [num, pos];
}

async function readPage(pageId: string, cookie: string, label: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`Reading: ${label} (${pageId})`);
  console.log(`${"═".repeat(60)}`);

  // Get JWT
  const tokenResp = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!tokenResp.ok) {
    console.log(`  Token fetch failed: ${tokenResp.status}`);
    return;
  }
  const tokenData = await tokenResp.json() as any;
  const jwt = tokenData.token;

  // Build fresh doc
  const ydoc = new Y.Doc();
  const sv = Y.encodeStateVector(ydoc);
  const svLen = writeVarUint(sv.length);
  const syncStep1 = new Uint8Array(2 + svLen.length + sv.length);
  syncStep1[0] = 0; syncStep1[1] = 0;
  syncStep1.set(svLen, 2); syncStep1.set(sv, 2 + svLen.length);
  const syncStep1B64 = Buffer.from(syncStep1).toString("base64");

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Try both with and without encv2
  for (const useEncV2 of [false, true]) {
    console.log(`\n--- ${useEncV2 ? "WITH encv2=true" : "WITHOUT encv2"} ---`);

    const wsUrl = [
      `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}`,
      `?token=${jwt}`,
      `&cid=${ydoc.clientID}`,
      `&app=web&reason=editor&web-editor=1.1.10`,
      `&frame_id=reader${Date.now()}`,
      `&ratempt=0&widx=0`,
      useEncV2 ? `&encv2=true` : "",
      `&timezone=${encodeURIComponent(tz)}`,
      `&syncStep1=${encodeURIComponent(syncStep1B64)}`,
    ].join("");

    await new Promise<void>((resolve) => {
      const ws = new WebSocket(wsUrl, {
        headers: { origin: `https://${HOST}`, cookie },
      });

      let msgCount = 0;
      const timeout = setTimeout(() => {
        console.log("  TIMEOUT — no SyncStep2 received");
        try { ws.close(); } catch {}
        resolve();
      }, 8000);

      ws.on("error", (e: Error) => {
        console.log(`  WS ERROR: ${e.message}`);
        clearTimeout(timeout);
        resolve();
      });

      ws.on("close", () => {
        clearTimeout(timeout);
        resolve();
      });

      (ws as any).on("unexpected-response", (_req: unknown, res: { statusCode: number }) => {
        console.log(`  WS UPGRADE FAILED: HTTP ${res.statusCode}`);
        clearTimeout(timeout);
        resolve();
      });

      ws.on("message", (raw: Buffer, isBinary: boolean) => {
        msgCount++;
        const data = new Uint8Array(raw);

        if (!isBinary) {
          console.log(`  MSG#${msgCount} TEXT: ${raw.toString().substring(0, 100)}`);
          return;
        }

        const msgType = data[0];
        if (msgType === 17) { ws.send(Buffer.from(new Uint8Array([18]))); return; }
        if (msgType !== 0) return;

        const [subType, subOff] = readVarUint(data, 1);

        if (subType === 0) {
          console.log(`  MSG#${msgCount}: SyncStep1-request (server wants our state)`);
          // Send empty update back
          const emptyUpdate = Y.encodeStateAsUpdate(ydoc);
          const varLen = writeVarUint(emptyUpdate.length);
          const resp = new Uint8Array(2 + varLen.length + emptyUpdate.length);
          resp[0] = 0; resp[1] = 1; // sync, step2
          resp.set(varLen, 2);
          resp.set(emptyUpdate, 2 + varLen.length);
          ws.send(Buffer.from(resp));
        }

        else if (subType === 1) {
          // SyncStep2 — this is what the server sends as the document state!
          const [uLen, uStart] = readVarUint(data, subOff);
          const updateData = data.slice(uStart, uStart + uLen);
          console.log(`  MSG#${msgCount}: SyncStep2 (SERVER DOCUMENT STATE)`);
          console.log(`    Update size: ${uLen} bytes`);
          console.log(`    First 30 bytes: [${Array.from(updateData.slice(0, 30)).join(",")}]`);

          // Check readable content
          const text = new TextDecoder("utf-8", { fatal: false }).decode(updateData);
          const readable = text.replace(/[^\x20-\x7E]/g, "·");
          console.log(`    Readable (first 300): ${readable.substring(0, 300)}`);

          // Check for our content markers
          console.log(`    Contains "Hello": ${readable.includes("Hello")}`);
          console.log(`    Contains "Welcome": ${readable.includes("Welcome")}`);
          console.log(`    Contains "paragraph": ${readable.includes("paragraph")}`);
          console.log(`    Contains "root": ${readable.includes("root")}`);
          console.log(`    Contains "blocks": ${readable.includes("blocks")}`);

          // Try to apply
          try {
            const freshDoc = new Y.Doc();
            Y.applyUpdate(freshDoc, updateData);
            const root = freshDoc.getMap("root");
            console.log(`    V1 apply: SUCCESS — root keys: [${Array.from(root.keys())}]`);
            const children = root.get("children") as Y.Array<string> | undefined;
            console.log(`    children count: ${children?.length ?? "N/A"}`);
          } catch (e) {
            console.log(`    V1 apply: FAILED — ${(e as Error).message}`);
          }

          try {
            const freshDoc2 = new Y.Doc();
            Y.applyUpdateV2(freshDoc2, updateData);
            const root2 = freshDoc2.getMap("root");
            console.log(`    V2 apply: SUCCESS — root keys: [${Array.from(root2.keys())}]`);
          } catch (e) {
            console.log(`    V2 apply: FAILED — ${(e as Error).message}`);
          }

          // Done with this test
          clearTimeout(timeout);
          try { ws.close(); } catch {}
          resolve();
        }

        else if (subType === 2) {
          const [uLen, uStart] = readVarUint(data, subOff);
          console.log(`  MSG#${msgCount}: Update (${uLen} bytes)`);
        }
      });
    });
  }
}

async function main() {
  const stored = loadEncryptedCookie();
  if (!stored) throw new Error("No cookie");
  const cookie = stored.cookie;

  // Compare: our written page vs known browser-created page
  await readPage("BDXl3LBHNDS5QhtL", cookie, "MCP Demo Page (our writer)");
  await readPage("1tZiv20EWydrHyaB", cookie, "Browser-created page (known content)");
}

main().catch(e => { console.error(e); process.exit(1); });
