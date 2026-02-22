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

// Generate option IDs for single select (using timestamps like native)
const optActive = `${Date.now()}`;
const optPaused = `${Date.now() + 1}`;
const optDone = `${Date.now() + 2}`;

async function main() {
    await makePage("Rich Table Test — All Column Types", [
        { type: "heading", level: 1, children: [{ text: "Feature-Rich Table" }] },
        { type: "paragraph", children: [{ text: "Testing all column types, colors, and alignment." }] },
        {
            type: "table",
            columns: [
                // Col A: Text (default, no columnType needed)
                { text: "Task", type: "text" },
                // Col B: Checkbox
                { text: "Done", type: "checkbox" },
                // Col C: Date
                { text: "Due Date", type: "date" },
                // Col D: Single Select with options
                {
                    text: "Status",
                    type: "singleselect",
                    dbSelect: {
                        [optActive]: { name: "Active", style: "default", color: "green" },
                        [optPaused]: { name: "Paused", style: "default", color: "yellow" },
                        [optDone]: { name: "Done", style: "default", color: "blue" },
                    },
                },
                // Col E: Progress
                { text: "Progress", type: "progress" },
                // Col F: Number
                { text: "Priority", type: "number" },
            ],
            rows: [
                {
                    cells: [
                        // Text cell with blue background and center alignment
                        { cellType: "text", children: [{ text: "Design mockups" }], color: "indigo", align: "center" },
                        { cellType: "checkbox", checked: true },
                        { cellType: "date", timestamp: Date.now() },
                        { cellType: "singleselect", selected: [optDone] },
                        { cellType: "progress", progress: 100 },
                        { cellType: "number", value: 1 },
                    ],
                },
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Write documentation", bold: true }] },
                        { cellType: "checkbox", checked: false },
                        { cellType: "date", timestamp: Date.now() + 86400000 },
                        { cellType: "singleselect", selected: [optActive] },
                        { cellType: "progress", progress: 45 },
                        { cellType: "number", value: 2 },
                    ],
                },
                {
                    cells: [
                        // Yellow background cell
                        { cellType: "text", children: [{ text: "Deploy to prod" }], color: "yellow" },
                        { cellType: "checkbox", checked: false },
                        { cellType: "date", timestamp: Date.now() + 172800000 },
                        { cellType: "singleselect", selected: [optPaused] },
                        { cellType: "progress", progress: 0 },
                        { cellType: "number", value: 3 },
                    ],
                },
            ],
        },
        { type: "paragraph", children: [{ text: "Content after table renders correctly ✅" }] },
    ]);
}

main().catch(console.error);
