import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import type { ContentBlock } from "../src/content-schema.js";
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
const PAGE_ID = "NSREZPxM66UEa7KC"; // Your test page
const COOKIE = process.env.FUSEBASE_COOKIE!;

const testBlocks: ContentBlock[] = [
    {
        type: "heading", level: 1, children: [{ text: "Phase 3: Edge Blocks Test 🔥" }]
    },
    {
        type: "paragraph", children: [{ text: "Here are the newly discovered standalone Map Blocks:" }]
    },
    {
        type: "image",
        src: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        caption: [{ text: "An embedded Unsplash image" }],
        width: 600,
        ratio: 0.6
    },
    {
        type: "bookmark",
        url: "https://github.com/microsoft/vscode"
    },
    {
        type: "outline"
    },
    {
        type: "step-aggregator"
    },
    {
        type: "step",
        children: [
            { type: "paragraph", children: [{ text: "Step 1: Discover!" }] }
        ]
    },
    {
        type: "step",
        children: [
            { type: "paragraph", children: [{ text: "Step 2: Implement!" }] }
        ]
    },
    {
        type: "heading", level: 2, children: [{ text: "Inline Object Embeds" }]
    },
    {
        type: "paragraph",
        children: [
            { text: "This is a progress bar: " },
            { embed: { progress: 75 } },
            { text: " right in the middle of a sentence!" }
        ]
    },
    {
        type: "paragraph",
        children: [
            { text: "This is a date: " },
            { embed: { date: { value: Date.now() + 86400000, name: "Tomorrow" } } },
            { text: ". Awesome!" }
        ]
    },
    {
        type: "paragraph",
        children: [
            { text: "This is a dropdown: " },
            { embed: { "dropdown-list": { selected: 1, labels: [{ id: 1, name: "Option A", color: "blue" }, { id: 2, name: "Option B", color: "red" }] } } },
            { text: " !" }
        ]
    },
    {
        type: "paragraph",
        children: [
            { text: "Mentioning the workspace: " },
            { embed: { mention: { type: "workspace", object_id: WS_ID, name: "Test Space" } } }
        ]
    },
    { type: "divider" },
    { type: "paragraph", children: [{ text: "End of Phase 3 Verification 😊", bold: true }] }
];

async function main() {
    console.log(`Writing Phase 3 edge blocks to page ${PAGE_ID}...`);
    const res = await writeContentViaWebSocket(
        HOST,
        WS_ID,
        PAGE_ID,
        COOKIE,
        testBlocks,
        { replace: true, timeout: 15000 }
    );
    console.log("Result:", res);
}

main().catch(console.error);
