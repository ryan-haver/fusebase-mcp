/**
 * Minimal Y.Text test: Write a SINGLE simple paragraph with NO formatting
 * to a fresh page. This isolates whether the version error is from
 * Y.Text itself or from the formatting attributes.
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
        const t = line.trim(); if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("="); if (eq < 0) continue;
        if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
}
loadEnv();

const HOST = process.env.FUSEBASE_HOST!;
const WS_ID = "45h7lom5ryjak34u";
const stored = loadEncryptedCookie();
const COOKIE = stored?.cookie || process.env.FUSEBASE_COOKIE!;

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
    const h: number[] = [0x00, subType]; writeVarUint(h, data.length);
    const m = new Uint8Array(h.length + data.length); m.set(h); m.set(data, h.length); return m;
}

function encodeAwareness(cid: number): Uint8Array {
    const s = new TextEncoder().encode("{}");
    const b: number[] = [0x01]; writeVarUint(b, 1); writeVarUint(b, cid); writeVarUint(b, 0); writeVarUint(b, s.length);
    const r = new Uint8Array(b.length + s.length); r.set(b); r.set(s, b.length); return r;
}

function genId(): string { return `b${Date.now()}_0`; }

async function writeMinimalPage() {
    console.log("═══ MINIMAL Y.TEXT TEST ═══\n");

    // Create page
    const noteId = Array.from({ length: 16 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 62)]).join("");
    const title = `YText Test ${new Date().toISOString().slice(11, 19)}`;
    const cr = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
        method: "POST", headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: WS_ID, noteId, note: { textVersion: 2, title, parentId: "default", is_portal_share: false } }),
    });
    const pageData = await cr.json() as any;
    const pageId = pageData.globalId || noteId;
    console.log(`Page: ${pageId}\nURL: https://${HOST}/ws/${WS_ID}/note/${pageId}\n`);

    // Connect
    const ydoc = new Y.Doc();
    const sv = Y.encodeStateVector(ydoc);
    const svBuf: number[] = [0x00, 0x00]; writeVarUint(svBuf, sv.length);
    const ss1 = new Uint8Array(svBuf.length + sv.length); ss1.set(svBuf); ss1.set(sv, svBuf.length);

    const tokenRes = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${pageId}/tokens`, {
        method: "POST", headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify({ tokens: [] }),
    });
    const jwt = ((await tokenRes.json()) as any).token;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const wsUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}?token=${jwt}&cid=${ydoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=abc1234&ratempt=0&widx=0&encv2=true&timezone=${encodeURIComponent(tz)}&syncStep1=${encodeURIComponent(Buffer.from(ss1).toString("base64"))}`;

    await new Promise<void>((resolve) => {
        const ws = new WebSocket(wsUrl, { headers: { origin: `https://${HOST}`, cookie: COOKIE } });
        let done = false;
        const finish = () => { if (!done) { done = true; try { ws.close(); } catch { } resolve(); } };
        setTimeout(() => { console.log("TIMEOUT"); finish(); }, 20000);

        ws.on("error", (e) => { console.log(`❌ ${e.message}`); finish(); });
        ws.on("open", () => ws.send(Buffer.from(encodeAwareness(ydoc.clientID))));

        ws.on("message", (raw: Buffer, isBinary: boolean) => {
            if (!isBinary) return;
            const data = new Uint8Array(raw);
            if (data[0] === 0x11) { ws.send(Buffer.from([0x12])); return; }
            if (data[0] !== 0x00) return;
            const [subType, subOff] = readVarUint(data, 1);

            if (subType === 0) {
                const [svLen, svStart] = readVarUint(data, subOff);
                const serverSv = data.slice(svStart, svStart + svLen);
                ws.send(Buffer.from(encodeSyncMsg(0x01, Y.encodeStateAsUpdate(ydoc, serverSv))));
            }

            if (subType === 1) {
                const [uLen, uStart] = readVarUint(data, subOff);
                try { Y.applyUpdateV2(ydoc, data.slice(uStart, uStart + uLen)); } catch {
                    try { Y.applyUpdate(ydoc, data.slice(uStart, uStart + uLen)); } catch { }
                }

                // Write ONE simple paragraph using Y.Text
                const beforeSv = Y.encodeStateVector(ydoc);

                ydoc.transact(() => {
                    const root = ydoc.getMap("root");
                    if (!root.has("children")) root.set("children", new Y.Array<string>());

                    const blocksMap = ydoc.getMap("blocks");
                    const rootChildren = ydoc.getArray<string>("rootChildren");

                    const blockId = genId();
                    const bm = new Y.Map();
                    bm.set("id", blockId);
                    bm.set("type", "paragraph");
                    bm.set("indent", 0);
                    bm.set("color", "transparent");
                    bm.set("align", "left");

                    // Use Y.Text - NO formatting, just plain text + \n
                    const chars = new Y.Text();
                    chars.insert(0, "Hello from Y.Text test!\n");
                    bm.set("characters", chars);

                    blocksMap.set(blockId, bm);
                    rootChildren.push([blockId]);
                });

                const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
                ws.send(Buffer.from(encodeSyncMsg(0x02, diff)));
                console.log(`Sent update: ${diff.length} bytes`);
                console.log(`Check: https://${HOST}/ws/${WS_ID}/note/${pageId}`);

                setTimeout(() => finish(), 5000);
            }
        });
    });
}

writeMinimalPage().catch(console.error);
