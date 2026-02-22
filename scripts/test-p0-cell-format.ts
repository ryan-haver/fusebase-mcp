import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import type { ContentBlock } from "../src/content-schema.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq > 0 && !process.env[t.slice(0, eq).trim()])
            process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
}

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const WS_ID = process.env.FUSEBASE_WORKSPACE_ID || "45h7lom5ryjak34u";

async function makePage(title: string, blocks: ContentBlock[]) {
    const cookie = process.env.FUSEBASE_COOKIE || loadEncryptedCookie()?.cookie;
    if (!cookie) throw new Error("No cookie");
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let noteId = "";
    for (let i = 0; i < 16; i++) noteId += chars.charAt(Math.floor(Math.random() * chars.length));
    const createResp = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: WS_ID, noteId, note: { textVersion: 2, title, parentId: "default", is_portal_share: false } }),
    });
    const body = (await createResp.json()) as any;
    const pageId = body.globalId || noteId;
    const res = await writeContentViaWebSocket(HOST, WS_ID, pageId, cookie, blocks, { replace: true, timeout: 10000 });
    console.log(`[${title}] ${pageId}`);
    console.log(`  https://${HOST}/space/${WS_ID}/page/${pageId}`);
}

// P0 Test: Set format on CELLS (not just columns)
// We need to temporarily hack the writer to inject per-cell format
// For now, test by manually constructing blocks with the low-level writer

// BUT FIRST — let's just check if the native UI stores format on the CELL or the COLUMN
// when it changes rating icon. We already know it's on the column from our dumps.
// Let me check if there's also a per-cell format.

import * as Y from "yjs";

const COOKIE = process.env.FUSEBASE_COOKIE || loadEncryptedCookie()?.cookie!;

// Dump the Format Properties Test page where native UI changed some cells
async function dumpCellFormats(pageId: string) {
    const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, {
        headers: { cookie: COOKIE },
    });
    const buf = new Uint8Array(await res.arrayBuffer());
    let len = 0, shift = 0, idx = 1;
    let byte: number;
    do { byte = buf[idx++]; len |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
    const data = buf.slice(idx, idx + len);
    const doc = new Y.Doc();
    Y.applyUpdate(doc, data);

    const blocks = doc.getMap("blocks");
    for (const [key, val] of blocks.entries()) {
        if (val instanceof Y.Map) {
            const m = val as Y.Map<any>;
            const cellType = m.get("cellType");
            if (cellType === "rating" || cellType === "date") {
                console.log(`\nCell "${key}" (${cellType}):`);
                for (const [k, v] of m.entries()) {
                    if (v instanceof Y.Map) {
                        const obj: Record<string, any> = {};
                        for (const [mk, mv] of v.entries()) obj[mk] = mv;
                        console.log(`  ${k}: Y.Map(${JSON.stringify(obj)})`);
                    } else if (v instanceof Y.Array) {
                        console.log(`  ${k}: Y.Array(${JSON.stringify(v.toArray())})`);
                    } else {
                        console.log(`  ${k}: ${JSON.stringify(v)}`);
                    }
                }
            }
        }
    }
}

console.log("=== Format Properties Test (has native UI changes on Row 1) ===");
await dumpCellFormats("oYAn36ndBfNZlsf1");

console.log("\n\n=== Fresh Format Test (writer only, no native changes) ===");
await dumpCellFormats("wnLjMPSnIDFAxMUS");
