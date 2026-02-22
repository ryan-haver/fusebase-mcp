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
    await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: WS_ID, noteId, note: { textVersion: 2, title, parentId: "default", is_portal_share: false } }),
    });
    const res = await writeContentViaWebSocket(HOST, WS_ID, noteId, cookie, blocks, { replace: true, timeout: 10000 });
    console.log(`[${title}] ${noteId}`);
    console.log(`  https://${HOST}/space/${WS_ID}/page/${noteId}`);
}

await makePage("P1 Test: Row Color + VAlign", [
    { type: "heading", level: 1, children: [{ text: "P1 Test: Row Color + Vertical Alignment" }] },
    {
        type: "table",
        columns: [
            { text: "Description", type: "text" },
            { text: "Values", type: "text" },
            { text: "Rating", type: "rating", format: { ratingIcon: "heart" } },
        ],
        rows: [
            {
                color: "yellow",
                cells: [
                    { cellType: "text", children: [{ text: "Yellow row, bottom-align" }], valign: "bottom" },
                    { cellType: "text", children: [{ text: "Also bottom" }], valign: "bottom" },
                    { cellType: "rating", rating: 4 },
                ],
            },
            {
                color: "indigo",
                cells: [
                    { cellType: "text", children: [{ text: "Indigo row, middle-align" }], valign: "middle" },
                    { cellType: "text", children: [{ text: "Also middle" }], valign: "middle" },
                    { cellType: "rating", rating: 2 },
                ],
            },
            {
                cells: [
                    { cellType: "text", children: [{ text: "Default row, no valign" }] },
                    { cellType: "text", children: [{ text: "Default" }] },
                    { cellType: "rating", rating: 5 },
                ],
            },
        ],
    },
]);
