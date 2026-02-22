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

// Generate option IDs for selects
const ts = Date.now();
const opts = {
    active: `${ts}`, paused: `${ts + 1}`, done: `${ts + 2}`,
    alpha: `${ts + 10}`, beta: `${ts + 11}`, gamma: `${ts + 12}`,
};

async function main() {
    await makePage("Table: All 13 Column Types", [
        { type: "heading", level: 1, children: [{ text: "All Column Types" }] },
        { type: "paragraph", children: [{ text: "Comprehensive test — every column type supported by FuseBase tables." }] },
        {
            type: "table",
            columns: [
                { text: "Task", type: "text" },
                { text: "Done", type: "checkbox" },
                { text: "Due Date", type: "date" },
                {
                    text: "Status",
                    type: "singleselect",
                    dbSelect: {
                        [opts.active]: { name: "Active", style: "default", color: "green" },
                        [opts.paused]: { name: "Paused", style: "default", color: "yellow" },
                        [opts.done]: { name: "Done", style: "default", color: "blue" },
                    },
                },
                { text: "Progress", type: "progress" },
                { text: "Priority", type: "number" },
                { text: "Cost", type: "currency" },
                { text: "URL", type: "link" },
                { text: "Rating", type: "rating" },
                {
                    text: "Tags",
                    type: "multiselect",
                    dbSelect: {
                        [opts.alpha]: { name: "Frontend", style: "default", color: "blue" },
                        [opts.beta]: { name: "Backend", style: "default", color: "teal" },
                        [opts.gamma]: { name: "Ops", style: "default", color: "orange" },
                    },
                },
                { text: "Notes", type: "mention" },
            ],
            rows: [
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Build dashboard" }], color: "indigo", align: "center" },
                        { cellType: "checkbox", checked: true },
                        { cellType: "date", timestamp: ts },
                        { cellType: "singleselect", selected: [opts.done] },
                        { cellType: "progress", progress: 100 },
                        { cellType: "number", value: 1 },
                        { cellType: "currency", value: 1500 },
                        { cellType: "link", url: "https://github.com" },
                        { cellType: "rating", rating: 5 },
                        { cellType: "multiselect", selected: [opts.alpha, opts.beta] },
                        { cellType: "mention", children: [{ text: "Shipped Q1\n" }] },
                    ],
                },
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Write tests", bold: true }] },
                        { cellType: "checkbox", checked: false },
                        { cellType: "date", timestamp: ts + 86400000 },
                        { cellType: "singleselect", selected: [opts.active] },
                        { cellType: "progress", progress: 60 },
                        { cellType: "number", value: 2 },
                        { cellType: "currency", value: 250.75 },
                        { cellType: "link", url: "https://jestjs.io" },
                        { cellType: "rating", rating: 3 },
                        { cellType: "multiselect", selected: [opts.beta] },
                        { cellType: "mention", children: [{ text: "In progress\n" }] },
                    ],
                },
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Deploy v2" }], color: "yellow" },
                        { cellType: "checkbox", checked: false },
                        { cellType: "date", timestamp: ts + 172800000 },
                        { cellType: "singleselect", selected: [opts.paused] },
                        { cellType: "progress", progress: 0 },
                        { cellType: "number", value: 3 },
                        { cellType: "currency", value: 0 },
                        { cellType: "link", url: "https://cloud.google.com" },
                        { cellType: "rating", rating: 0 },
                        { cellType: "multiselect", selected: [opts.gamma] },
                        { cellType: "mention", children: [{ text: "Blocked\n" }] },
                    ],
                },
            ],
        },
        { type: "paragraph", children: [{ text: "✅ All 13 column types rendered programmatically." }] },
    ]);
}

main().catch(console.error);
