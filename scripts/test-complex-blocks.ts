import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import type { ContentBlock } from "../src/content-schema.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadEnv() {
    const envPath = path.resolve(__dirname, "..", ".env");
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq < 0) continue;
        if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
}
loadEnv();

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const WS_ID = process.env.FUSEBASE_WORKSPACE_ID || "45h7lom5ryjak34u";
const PAGE_ID = process.argv[2] || "0ylYPzWyJEE9GHQN"; // default generic test page

async function main() {
    const stored = loadEncryptedCookie();
    if (!stored || !stored.cookie) {
        console.error("No valid cookie found. Please log in first.");
        process.exit(1);
    }

    const blocks: ContentBlock[] = [
        {
            type: "heading",
            level: 1,
            children: [{ text: "Phase 2 Complex Block Tests", bold: true }],
        },
        { type: "divider" },
        {
            type: "paragraph",
            children: [{ text: "This page is generated entirely by the MCP Content Writer using the native Y.js API. It contains complex structures like Tables, Boards, embedded Apps, Grids, and Media files." }],
        },
        {
            type: "heading",
            level: 2,
            children: [{ text: "1. Tables Component" }],
        },
        {
            type: "table",
            columns: [
                { text: "Feature", type: "text" },
                {
                    text: "Status",
                    type: "singleselect",
                    dbSelect: {
                        "1": { name: "Pending", style: "default", color: "pink" },
                        "2": { name: "In Progress", style: "default", color: "amber" },
                        "3": { name: "Done", style: "default", color: "lime" }
                    }
                },
                { text: "Completion", type: "progress" },
                { text: "Verified", type: "checkbox" },
                { text: "Date", type: "date" }
            ],
            rows: [
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Tables Support" }] },
                        { cellType: "singleselect", selected: ["3"] },
                        { cellType: "progress", progress: 100 },
                        { cellType: "checkbox", checked: true },
                        { cellType: "date", timestamp: Date.now() - 86400000 }
                    ]
                },
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Databases Embeds" }] },
                        { cellType: "singleselect", selected: ["2"] },
                        { cellType: "progress", progress: 50 },
                        { cellType: "checkbox", checked: false },
                        { cellType: "date", timestamp: Date.now() }
                    ]
                }
            ]
        },
        {
            type: "heading",
            level: 2,
            children: [{ text: "2. Grid Component" }],
        },
        {
            type: "grid",
            columns: [
                {
                    type: "gridCol",
                    width: "auto",
                    children: [
                        { type: "heading", level: 3, children: [{ text: "Column A" }] },
                        { type: "paragraph", children: [{ text: "This is the left side of the grid layout.", italic: true }] }
                    ]
                },
                {
                    type: "gridCol",
                    width: "auto",
                    children: [
                        { type: "heading", level: 3, children: [{ text: "Column B" }] },
                        { type: "paragraph", children: [{ text: "This is the right side of the grid layout. Content stays isolated." }] }
                    ]
                }
            ]
        },
        {
            type: "heading",
            level: 2,
            children: [{ text: "3. Embeds & Media" }],
        },
        {
            type: "remote-frame",
            src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            caption: [{ text: "An important video resource" }]
        },
        {
            type: "heading",
            level: 2,
            children: [{ text: "4. Widgets & Buttons" }],
        },
        {
            type: "button-single",
            title: "View Source Code",
            url: "https://github.com/ryan-haver/fusebase-mcp"
        },
        { type: "divider" },
        {
            type: "paragraph",
            children: [{ text: "End of automated generation sequence.", code: true }],
        }
    ];

    console.log(`Writing complex test blocks to page ${PAGE_ID}...`);
    const res = await writeContentViaWebSocket(HOST, WS_ID, PAGE_ID, stored.cookie, blocks, { replace: true });

    if (res.success) {
        console.log("✅ Successfully wrote complex content structures to FuseBase!");
        console.log(`View it at: https://${HOST}/space/${WS_ID}/page/${PAGE_ID}`);
    } else {
        console.error("❌ Failed to write content:", res.error);
        process.exit(1);
    }
}

main().catch(console.error);
