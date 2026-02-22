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
    console.log(`[${title}] ${pageId} -> ${JSON.stringify(res)}`);
    console.log(`  https://${HOST}/space/${WS_ID}/page/${pageId}\n`);
}

const ts = Date.now();

async function main() {
    await makePage("All Options Test — Column Configs + Mentions", [
        { type: "heading", level: 1, children: [{ text: "Column Config + Mention Test" }] },
        { type: "paragraph", children: [{ text: "Testing all column-level format options and mention subtypes." }] },

        // TABLE 1: Column format options
        {
            type: "table",
            columns: [
                { text: "Test", type: "text" },
                { text: "Euro Currency", type: "currency", format: { currency: "euro" } },
                { text: "Percent Nums", type: "number", format: { type: "percent" } },
                { text: "Commas Nums", type: "number", format: { type: "commas" } },
                { text: "Links w/ Text", type: "link" },
                { text: "All Mentions", type: "mention" },
            ],
            rows: [
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Row 1" }] },
                        { cellType: "currency", value: 1299.99 },
                        { cellType: "number", value: 85 },
                        { cellType: "number", value: 15000 },
                        { cellType: "link", url: "https://github.com", text: "GitHub" },
                        { cellType: "mention", mention: { mentionType: "date", name: "Today", value: ts } },
                    ],
                },
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Row 2" }] },
                        { cellType: "currency", value: 42.50 },
                        { cellType: "number", value: 100 },
                        { cellType: "number", value: 2500000 },
                        { cellType: "link", url: "https://fusebase.com", text: "FuseBase" },
                        { cellType: "mention", mention: { mentionType: "user", name: "Ryan Haver", objectId: 3650509 } },
                    ],
                },
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Row 3" }] },
                        { cellType: "currency", value: 0 },
                        { cellType: "number", value: 50, format: { type: "commas" } },
                        { cellType: "number", value: 999 },
                        { cellType: "link", url: "https://example.com" },
                        { cellType: "mention", mention: { mentionType: "folder", name: "Unsorted", objectId: "default", workspaceId: WS_ID } },
                    ],
                },
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Row 4 — WS" }] },
                        null,
                        null,
                        null,
                        null,
                        { cellType: "mention", mention: { mentionType: "workspace", name: "Inkabeam", objectId: "44ieqib7z0eltarr" } },
                    ],
                },
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Row 5 — Page" }] },
                        null,
                        null,
                        null,
                        null,
                        { cellType: "mention", mention: { mentionType: "page", name: "Minimal: 1 paragraph", objectId: "p9MWJykpyU804u80", workspaceId: WS_ID } },
                    ],
                },
            ],
        },

        { type: "paragraph", children: [{ text: "✅ All column configs and 5 mention types tested." }] },
    ]);
}

main().catch(console.error);
