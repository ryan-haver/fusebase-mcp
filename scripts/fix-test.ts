/**
 * Test ONLY the suspected issues:
 * 1. blockQuote → blockquote (lowercase q)
 * 2. divider → skip or paragraph
 * Also test listItemBullet + listItemNumber + hMedium
 * 
 * Run: npx tsx scripts/fix-test.ts
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
let bc = 0; function gid(): string { return `b${Date.now()}_${bc++}`; }

async function writePage(title: string, buildContent: (doc: Y.Doc) => void): Promise<string> {
    const noteId = randId();
    const cr = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
        method: "POST", headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: WS_ID, noteId, note: { textVersion: 2, title, parentId: "default", is_portal_share: false } }),
    });
    const pd = await cr.json() as any;
    const pageId = pd.globalId || noteId;
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
    return pageId;
}

function makeBlock(doc: Y.Doc, type: string, textContent: string, props?: Record<string, any>) {
    const blocks = doc.getMap("blocks");
    const rch = doc.getArray<string>("rootChildren");
    const bm = new Y.Map();
    const id = gid();
    bm.set("id", id); bm.set("type", type);
    bm.set("indent", props?.indent || 0);
    bm.set("color", props?.color || "transparent");
    bm.set("align", props?.align || "left");
    const chars = new Y.Text();
    if (props?.attrs) {
        chars.insert(0, textContent, props.attrs);
        chars.insert(textContent.length, "\n");
    } else {
        chars.insert(0, textContent + "\n");
    }
    bm.set("characters", chars);
    blocks.set(id, bm);
    rch.push([id]);
}

async function main() {
    console.log("═══ FIX VERIFICATION ═══\n");

    // Test 1: blockquote (lowercase q) — testing the claim
    const t1Id = await writePage("Fix1: blockquote lowercase", (doc) => {
        doc.transact(() => {
            const root = doc.getMap("root");
            if (!root.has("children")) root.set("children", new Y.Array());
            makeBlock(doc, "paragraph", "Before quote");
            makeBlock(doc, "blockquote", "This is a quote with lowercase q");
            makeBlock(doc, "paragraph", "After quote");
        });
    });
    console.log(`Fix1 (blockquote): https://${HOST}/ws/${WS_ID}/note/${t1Id}\n`);

    // Test 2: Full combo WITHOUT divider — heading, paragraph, bold, italic, lists, blockquote, numbered
    const t2Id = await writePage("Fix2: Full combo no divider", (doc) => {
        doc.transact(() => {
            const root = doc.getMap("root");
            if (!root.has("children")) root.set("children", new Y.Array());
            makeBlock(doc, "hLarge", "Test Heading");
            makeBlock(doc, "paragraph", "A normal paragraph");
            makeBlock(doc, "paragraph", "bold text", { attrs: { bold: true } });
            makeBlock(doc, "paragraph", "italic text", { attrs: { italic: true } });
            makeBlock(doc, "listItemBullet", "Bullet one");
            makeBlock(doc, "listItemBullet", "Bullet two");
            makeBlock(doc, "blockquote", "Quoted text");
            makeBlock(doc, "hMedium", "Sub Heading");
            makeBlock(doc, "listItemNumber", "First numbered");
            makeBlock(doc, "listItemNumber", "Second numbered");
        });
    });
    console.log(`Fix2 (full combo): https://${HOST}/ws/${WS_ID}/note/${t2Id}\n`);

    // Test 3: blockQuote (capital Q) for comparison — does it fail?
    const t3Id = await writePage("Fix3: blockQuote capitalQ", (doc) => {
        doc.transact(() => {
            const root = doc.getMap("root");
            if (!root.has("children")) root.set("children", new Y.Array());
            makeBlock(doc, "paragraph", "Before quote");
            makeBlock(doc, "blockQuote", "This is a quote with capital Q");
            makeBlock(doc, "paragraph", "After quote");
        });
    });
    console.log(`Fix3 (blockQuote): https://${HOST}/ws/${WS_ID}/note/${t3Id}\n`);

    console.log("Check each URL to see what works!");
}

main().catch(console.error);
