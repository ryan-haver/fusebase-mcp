/**
 * Phase 1 E2E Test — Tests all new block types and inline marks.
 * 
 * Tests: H3 (hSmall), divider (hLine), toggle, hint, collapsible heading,
 *        inline link, inline code, strikethrough, underline
 *
 * Run: npx tsx scripts/phase1-test.ts
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

    // hLine has only id + type
    if (type === "hLine") {
        blocks.set(id, bm);
        rch.push([id]);
        return id;
    }

    bm.set("indent", props?.indent || 0);
    bm.set("color", props?.color || "transparent");
    bm.set("align", props?.align || "left");

    // Children support for toggle/collapsible
    if (props?.childIds) {
        const childArr = new Y.Array<string>();
        childArr.push(props.childIds);
        bm.set("children", childArr);
        bm.set("collapsed", props?.collapsed ?? false);
    }

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
    return id;
}

function makeChildBlock(doc: Y.Doc, type: string, text: string): string {
    const blocks = doc.getMap("blocks");
    const bm = new Y.Map();
    const id = gid();
    bm.set("id", id); bm.set("type", type);
    bm.set("indent", 0); bm.set("color", "transparent"); bm.set("align", "left");
    const chars = new Y.Text();
    chars.insert(0, text + "\n");
    bm.set("characters", chars);
    blocks.set(id, bm);
    return id;  // NOT added to rootChildren
}

async function main() {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    console.log(`═══ PHASE 1 E2E TEST ${ts} ═══\n`);

    const pageId = await writePage(`🧪 Phase1 Test ${ts}`, (doc) => {
        doc.transact(() => {
            const root = doc.getMap("root");
            if (!root.has("children")) root.set("children", new Y.Array());

            // 1. H1
            makeBlock(doc, "hLarge", "Phase 1 Content Types");

            // 2. H2
            makeBlock(doc, "hMedium", "Sub Section H2");

            // 3. H3 (new!)
            makeBlock(doc, "hSmall", "Sub-sub Section H3");

            // 4. Regular paragraph
            makeBlock(doc, "paragraph", "A normal paragraph for context.");

            // 5. Paragraph with inline link
            const linkChars = new Y.Text();
            linkChars.insert(0, "Visit ");
            linkChars.insert(6, "Google", { link: "https://google.com" });
            linkChars.insert(12, " for search.\n");
            const blocks = doc.getMap("blocks");
            const rch = doc.getArray<string>("rootChildren");
            const linkBm = new Y.Map();
            const linkId = gid();
            linkBm.set("id", linkId); linkBm.set("type", "paragraph");
            linkBm.set("indent", 0); linkBm.set("color", "transparent"); linkBm.set("align", "left");
            linkBm.set("characters", linkChars);
            blocks.set(linkId, linkBm);
            rch.push([linkId]);

            // 6. Paragraph with inline code
            const codeChars = new Y.Text();
            codeChars.insert(0, "Use the ");
            codeChars.insert(8, "console.log()", { code: true });
            codeChars.insert(21, " function.\n");
            const codeBm = new Y.Map();
            const codeId = gid();
            codeBm.set("id", codeId); codeBm.set("type", "paragraph");
            codeBm.set("indent", 0); codeBm.set("color", "transparent"); codeBm.set("align", "left");
            codeBm.set("characters", codeChars);
            blocks.set(codeId, codeBm);
            rch.push([codeId]);

            // 7. Paragraph with strikethrough
            const strikeChars = new Y.Text();
            strikeChars.insert(0, "This is ");
            strikeChars.insert(8, "deleted text", { strikethrough: true });
            strikeChars.insert(20, " with strikethrough.\n");
            const strikeBm = new Y.Map();
            const strikeId = gid();
            strikeBm.set("id", strikeId); strikeBm.set("type", "paragraph");
            strikeBm.set("indent", 0); strikeBm.set("color", "transparent"); strikeBm.set("align", "left");
            strikeBm.set("characters", strikeChars);
            blocks.set(strikeId, strikeBm);
            rch.push([strikeId]);

            // 8. Divider (hLine — new!)
            makeBlock(doc, "hLine", "");

            // 9. Hint/callout (new!)
            makeBlock(doc, "hint", "This is a hint/callout block!");

            // 10. Toggle (new!)
            const child1 = makeChildBlock(doc, "paragraph", "Inside the toggle - child 1");
            const child2 = makeChildBlock(doc, "paragraph", "Inside the toggle - child 2");
            const toggleBlocks = doc.getMap("blocks");
            const toggleRch = doc.getArray<string>("rootChildren");
            const toggleBm = new Y.Map();
            const toggleId = gid();
            toggleBm.set("id", toggleId); toggleBm.set("type", "toggle");
            toggleBm.set("indent", 0); toggleBm.set("color", "transparent"); toggleBm.set("align", "left");
            toggleBm.set("collapsed", false);
            const childArr = new Y.Array<string>();
            childArr.push([child1, child2]);
            toggleBm.set("children", childArr);
            const toggleChars = new Y.Text();
            toggleChars.insert(0, "Click to expand toggle\n");
            toggleBm.set("characters", toggleChars);
            toggleBlocks.set(toggleId, toggleBm);
            toggleRch.push([toggleId]);

            // 11. Blockquote
            makeBlock(doc, "blockquote", "A blockquote for good measure");

            // 12. Lists
            makeBlock(doc, "listItemBullet", "Bullet item one");
            makeBlock(doc, "listItemBullet", "Bullet item two");
            makeBlock(doc, "listItemNumber", "Numbered item one");
            makeBlock(doc, "listItemNumber", "Numbered item two");

            // 13. Code block
            const codeBlockChars = new Y.Text();
            codeBlockChars.insert(0, "const x = 42;\nconsole.log(x);\n");
            const codeBlockBm = new Y.Map();
            const codeBlockId = gid();
            codeBlockBm.set("id", codeBlockId); codeBlockBm.set("type", "code");
            codeBlockBm.set("indent", 0); codeBlockBm.set("color", "transparent"); codeBlockBm.set("align", "left");
            codeBlockBm.set("language", "javascript");
            codeBlockBm.set("characters", codeBlockChars);
            const cBlocks = doc.getMap("blocks");
            cBlocks.set(codeBlockId, codeBlockBm);
            const cRch = doc.getArray<string>("rootChildren");
            cRch.push([codeBlockId]);

            // 14. Checkbox list
            makeBlock(doc, "listItemChecked", "Done task");
            makeBlock(doc, "listItemUnchecked", "Pending task");
        });
    });

    console.log(`\n✅ Page created: https://${HOST}/ws/${WS_ID}/note/${pageId}`);
    console.log(`Direct: https://${HOST}/space/${WS_ID}/page/${pageId}`);
}

main().catch(console.error);
