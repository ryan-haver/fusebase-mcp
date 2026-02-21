/**
 * Incremental tests to isolate exactly what breaks rendering.
 * Test A: Multiple plain paragraphs + heading (no formatting)
 * Test B: Same + bold formatting
 * Test C: Same + divider/list types
 */
import * as Y from "yjs";
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
function randId(): string { return Array.from({ length: 16 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 62)]).join(""); }

let blockCounter = 0;
function genBlockId(): string { return `b${Date.now()}_${blockCounter++}`; }

async function writePage(title: string, buildContent: (doc: Y.Doc) => void): Promise<string> {
    const noteId = randId();
    const cr = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
        method: "POST", headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: WS_ID, noteId, note: { textVersion: 2, title, parentId: "default", is_portal_share: false } }),
    });
    const pageData = await cr.json() as any;
    const pageId = pageData.globalId || noteId;

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
    const wsUrl = `wss://text.nimbusweb.me/socket.io.editor/${WS_ID}/${pageId}?token=${jwt}&cid=${ydoc.clientID}&app=web&reason=editor&web-editor=1.1.10&frame_id=${randId().slice(0, 7)}&ratempt=0&widx=0&encv2=true&timezone=${encodeURIComponent(tz)}&syncStep1=${encodeURIComponent(Buffer.from(ss1).toString("base64"))}`;

    await new Promise<void>((resolve) => {
        const ws = new WebSocket(wsUrl, { headers: { origin: `https://${HOST}`, cookie: COOKIE } });
        let done = false;
        const finish = () => { if (!done) { done = true; try { ws.close(); } catch { } resolve(); } };
        setTimeout(() => { console.log("  TIMEOUT"); finish(); }, 15000);

        ws.on("error", (e) => { console.log(`  ❌ ${e.message}`); finish(); });
        ws.on("open", () => ws.send(Buffer.from(encodeAwareness(ydoc.clientID))));

        ws.on("message", (raw: Buffer, isBinary: boolean) => {
            if (!isBinary) return;
            const data = new Uint8Array(raw);
            if (data[0] === 0x11) { ws.send(Buffer.from([0x12])); return; }
            if (data[0] !== 0x00) return;
            const [subType, subOff] = readVarUint(data, 1);

            if (subType === 0) {
                const [svLen, svStart] = readVarUint(data, subOff);
                ws.send(Buffer.from(encodeSyncMsg(0x01, Y.encodeStateAsUpdate(ydoc, data.slice(svStart, svStart + svLen)))));
            }

            if (subType === 1) {
                const [uLen, uStart] = readVarUint(data, subOff);
                try { Y.applyUpdateV2(ydoc, data.slice(uStart, uStart + uLen)); } catch {
                    try { Y.applyUpdate(ydoc, data.slice(uStart, uStart + uLen)); } catch { }
                }

                const beforeSv = Y.encodeStateVector(ydoc);
                buildContent(ydoc);
                const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
                ws.send(Buffer.from(encodeSyncMsg(0x02, diff)));
                console.log(`  Sent: ${diff.length}b`);
                setTimeout(() => finish(), 3000);
            }
        });
    });

    return `https://${HOST}/ws/${WS_ID}/note/${pageId}`;
}

async function main() {
    console.log("═══ INCREMENTAL TEST ═══\n");

    // Test A: Multiple plain paragraphs + heading (NO formatting)
    const urlA = await writePage("TestA: Plain blocks", (doc) => {
        doc.transact(() => {
            const root = doc.getMap("root");
            if (!root.has("children")) root.set("children", new Y.Array());
            const blocks = doc.getMap("blocks");
            const rch = doc.getArray<string>("rootChildren");

            // Heading
            const h = new Y.Map();
            const hId = genBlockId(); h.set("id", hId); h.set("type", "hLarge");
            h.set("indent", 0); h.set("color", "transparent"); h.set("align", "left");
            const hChars = new Y.Text(); hChars.insert(0, "Test Heading\n"); h.set("characters", hChars);
            blocks.set(hId, h); rch.push([hId]);

            // Paragraph 1
            const p1 = new Y.Map();
            const p1Id = genBlockId(); p1.set("id", p1Id); p1.set("type", "paragraph");
            p1.set("indent", 0); p1.set("color", "transparent"); p1.set("align", "left");
            const p1Chars = new Y.Text(); p1Chars.insert(0, "First paragraph.\n"); p1.set("characters", p1Chars);
            blocks.set(p1Id, p1); rch.push([p1Id]);

            // Paragraph 2
            const p2 = new Y.Map();
            const p2Id = genBlockId(); p2.set("id", p2Id); p2.set("type", "paragraph");
            p2.set("indent", 0); p2.set("color", "transparent"); p2.set("align", "left");
            const p2Chars = new Y.Text(); p2Chars.insert(0, "Second paragraph.\n"); p2.set("characters", p2Chars);
            blocks.set(p2Id, p2); rch.push([p2Id]);
        });
    });
    console.log(`TestA (plain): ${urlA}\n`);

    // Test B: Same + bold text
    const urlB = await writePage("TestB: With bold", (doc) => {
        doc.transact(() => {
            const root = doc.getMap("root");
            if (!root.has("children")) root.set("children", new Y.Array());
            const blocks = doc.getMap("blocks");
            const rch = doc.getArray<string>("rootChildren");

            // Paragraph with bold
            const p = new Y.Map();
            const pId = genBlockId(); p.set("id", pId); p.set("type", "paragraph");
            p.set("indent", 0); p.set("color", "transparent"); p.set("align", "left");
            const chars = new Y.Text();
            chars.insert(0, "Normal ");
            chars.insert(7, "bold text", { bold: true });
            chars.insert(16, " normal\n");
            p.set("characters", chars);
            blocks.set(pId, p); rch.push([pId]);
        });
    });
    console.log(`TestB (bold): ${urlB}\n`);

    // Test C: Bullet list
    const urlC = await writePage("TestC: List items", (doc) => {
        doc.transact(() => {
            const root = doc.getMap("root");
            if (!root.has("children")) root.set("children", new Y.Array());
            const blocks = doc.getMap("blocks");
            const rch = doc.getArray<string>("rootChildren");

            for (let i = 1; i <= 3; i++) {
                const li = new Y.Map();
                const liId = genBlockId(); li.set("id", liId); li.set("type", "listItemBullet");
                li.set("indent", 0); li.set("color", "transparent"); li.set("align", "left");
                const chars = new Y.Text(); chars.insert(0, `Item ${i}\n`); li.set("characters", chars);
                blocks.set(liId, li); rch.push([liId]);
            }
        });
    });
    console.log(`TestC (list): ${urlC}\n`);

    console.log("Check each URL to see which renders!");
}

main().catch(console.error);
