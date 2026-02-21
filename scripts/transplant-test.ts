/**
 * Transplant test: Take the Y.js state from a BROWSER-CREATED page (known working)
 * and write it to a FRESH page via WebSocket using our writer protocol.
 * 
 * If the transplanted content renders → the issue is in our Y.Doc content structure.
 * If it doesn't render → the issue is in our WebSocket write protocol.
 * 
 * Run: npx tsx scripts/transplant-test.ts
 */
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import { WebSocket } from "ws";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { loadEncryptedCookie } from "../src/crypto.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadEnv() {
    const envPath = path.resolve(__dirname, "..", ".env");
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq < 0) continue;
        if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
}
loadEnv();

const HOST = process.env.FUSEBASE_HOST!;
const WS_ID = "45h7lom5ryjak34u";
const stored = loadEncryptedCookie();
const COOKIE = stored?.cookie || process.env.FUSEBASE_COOKIE!;

// The browser-created page from our ws-capture
const SOURCE_PAGE = "1s4J9xaqLjAehLJy";

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

function encodeAwareness(clientId: number, clock: number): Uint8Array {
    const state = "{}";
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

function randomAlphaNum(len: number): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function main() {
    console.log("═══ TRANSPLANT TEST ═══\n");

    // Step 1: Get the working page's Y.js state via dump
    console.log(`Step 1: Reading source page ${SOURCE_PAGE} dump...`);
    const dumpRes = await fetch(`https://${HOST}/dump/${WS_ID}/${SOURCE_PAGE}`, { headers: { cookie: COOKIE } });
    const dumpBin = new Uint8Array(await dumpRes.arrayBuffer());
    console.log(`  Dump: ${dumpBin.length} bytes`);

    // Parse dump: version(1b) + varuint(len) + V1 update
    const [dumpLen, dumpStart] = readVarUint(dumpBin, 1);
    const sourceUpdate = dumpBin.slice(dumpStart, dumpStart + dumpLen);
    console.log(`  Update: ${sourceUpdate.length} bytes from offset ${dumpStart}`);

    // Load into a doc to verify
    const sourceDoc = new Y.Doc();
    Y.applyUpdate(sourceDoc, sourceUpdate);
    const srcBlocks = sourceDoc.getMap("blocks");
    const srcRch = sourceDoc.getArray("rootChildren");
    console.log(`  Source doc: blocks=${srcBlocks.size} rootChildren=${srcRch.length}`);
    for (const [k, v] of srcBlocks.entries()) {
        if (v instanceof Y.Map) {
            const type = v.get("type");
            const chars = v.get("characters");
            const charCount = chars instanceof Y.Array ? chars.length : "?";
            console.log(`    block "${k}" type="${type}" chars=${charCount}`);
        }
    }

    // Step 2: Create a fresh target page
    console.log("\nStep 2: Creating fresh target page...");
    const noteId = randomAlphaNum(16);
    const title = `Transplant ${new Date().toISOString().slice(11, 19)}`;
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

    // Step 3: Connect via WebSocket and transplant the source state
    console.log("\nStep 3: Connecting WebSocket to write transplanted content...");

    const ydoc = new Y.Doc();
    const sv = Y.encodeStateVector(ydoc);
    const svBuf: number[] = [0x00, 0x00];
    writeVarUint(svBuf, sv.length);
    const ss1 = new Uint8Array(svBuf.length + sv.length);
    ss1.set(svBuf); ss1.set(sv, svBuf.length);
    const syncStep1B64 = Buffer.from(ss1).toString("base64");

    const tokenRes = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
        method: "POST",
        headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify({ tokens: [] }),
    });
    if (!tokenRes.ok) { console.log(`  ❌ JWT failed: ${tokenRes.status}`); return; }
    const jwt = ((await tokenRes.json()) as any).token;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const wsUrl = [
        `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}`,
        `?token=${jwt}&cid=${ydoc.clientID}`,
        `&app=web&reason=editor&web-editor=1.1.10`,
        `&frame_id=${randomAlphaNum(7)}&ratempt=0&widx=0`,
        `&encv2=true`,
        `&timezone=${encodeURIComponent(tz)}`,
        `&syncStep1=${encodeURIComponent(syncStep1B64)}`,
    ].join("");

    await new Promise<void>((resolve) => {
        const ws = new WebSocket(wsUrl, {
            headers: { origin: `https://${HOST}`, cookie: COOKIE },
        });

        let done = false;
        const finish = () => { if (!done) { done = true; try { ws.close(); } catch { } resolve(); } };
        setTimeout(() => { console.log("  TIMEOUT"); finish(); }, 25000);

        ws.on("error", (e) => { console.log(`  ❌ WS error: ${e.message}`); finish(); });
        ws.on("close", () => { if (!done) { console.log("  WS closed"); finish(); } });

        ws.on("open", () => {
            console.log("  Connected — sending awareness");
            ws.send(Buffer.from(encodeAwareness(ydoc.clientID, 0)));
        });

        let syncDone = false;

        ws.on("message", (raw: Buffer, isBinary: boolean) => {
            if (!isBinary) return;
            const data = new Uint8Array(raw);
            if (data.length === 0) return;
            if (data[0] === 0x11) { ws.send(Buffer.from([0x12])); return; }
            if (data[0] === 0x12 || data[0] === 0x01) return;
            if (data[0] !== 0x00) return;

            const [subType, subOff] = readVarUint(data, 1);

            if (subType === 0) {
                // Server SyncStep1
                const [svLen, svStart] = readVarUint(data, subOff);
                const serverSv = data.slice(svStart, svStart + svLen);
                const update = Y.encodeStateAsUpdate(ydoc, serverSv);
                ws.send(Buffer.from(encodeSyncMsg(0x01, update)));
                console.log(`  >> SyncStep2 [${update.length}b]`);
            }

            else if (subType === 1 && !syncDone) {
                syncDone = true;
                const [uLen, uStart] = readVarUint(data, subOff);
                const updateData = data.slice(uStart, uStart + uLen);

                try { Y.applyUpdateV2(ydoc, updateData); } catch {
                    try { Y.applyUpdate(ydoc, updateData); } catch { }
                }
                console.log(`  << SyncStep2 [${uLen}b] applied`);

                // Now transplant: apply the source page's state to our doc
                console.log("\n  Transplanting source state...");
                const beforeSv = Y.encodeStateVector(ydoc);

                // Apply the SOURCE update to our connected doc
                try {
                    Y.applyUpdate(ydoc, sourceUpdate);
                    console.log("  Applied source update ✓");
                } catch (e) {
                    console.log(`  ❌ Failed to apply source update: ${(e as Error).message}`);
                    finish();
                    return;
                }

                // Send the diff as an update
                const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
                ws.send(Buffer.from(encodeSyncMsg(0x02, diff)));
                console.log(`  >> Sent update [${diff.length}b]`);

                // Verify local doc
                const blk = ydoc.getMap("blocks");
                const rch = ydoc.getArray("rootChildren");
                console.log(`  Doc: blocks=${blk.size} rootChildren=${rch.length}`);

                // Wait for server to process
                console.log("\n  Waiting 5s for server...");
                setTimeout(async () => {
                    // Check dump
                    const newDump = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
                    const newBin = new Uint8Array(await newDump.arrayBuffer());
                    console.log(`\n  Target dump: ${newBin.length} bytes (source was ${dumpBin.length} bytes)`);

                    console.log(`\n  🌐 Check: https://${HOST}/ws/${WS_ID}/note/${pageId}`);
                    console.log(`  📊 Compare with source: https://${HOST}/ws/${WS_ID}/note/${SOURCE_PAGE}`);

                    finish();
                }, 5000);
            }

            else if (subType === 2) {
                const [uLen, uStart] = readVarUint(data, subOff);
                const updateData = data.slice(uStart, uStart + uLen);
                try { Y.applyUpdateV2(ydoc, updateData); } catch {
                    try { Y.applyUpdate(ydoc, updateData); } catch { }
                }
            }
        });
    });
}

main().catch(console.error);
