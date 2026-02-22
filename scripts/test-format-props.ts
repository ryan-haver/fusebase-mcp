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

async function main() {
    // Test: Write tables with different column format properties to see what FuseBase picks up
    await makePage("Format Properties Test", [
        { type: "heading", level: 1, children: [{ text: "Column Format Properties Test" }] },
        { type: "paragraph", children: [{ text: "Testing if FuseBase picks up format properties set via Y.js." }] },

        // Table with various format properties
        {
            type: "table",
            columns: [
                { text: "Description", type: "text" },
                { text: "Rating:Flag", type: "rating", format: { ratingIcon: "flag" } },
                { text: "Rating:Heart", type: "rating", format: { ratingIcon: "heart" } },
                { text: "Rating:10", type: "rating", format: { ratingAmount: 10 } },
                { text: "Date:yyyy", type: "date", format: { dateFormat: "yyyy/mm/dd" } },
                { text: "Date:showTime", type: "date", format: { showTime: true } },
            ],
            rows: [
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Row 1" }] },
                        { cellType: "rating", rating: 3 },
                        { cellType: "rating", rating: 4 },
                        { cellType: "rating", rating: 7 },
                        { cellType: "date", timestamp: Date.now() },
                        { cellType: "date", timestamp: Date.now() },
                    ],
                },
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Row 2" }] },
                        { cellType: "rating", rating: 5 },
                        { cellType: "rating", rating: 2 },
                        { cellType: "rating", rating: 10 },
                        { cellType: "date", timestamp: Date.now() + 86400000 },
                        { cellType: "date", timestamp: Date.now() + 86400000 },
                    ],
                },
            ],
        },

        { type: "paragraph", children: [{ text: "If formats work: flags in col B, hearts in col C, 10-scale in col D, yyyy/mm/dd in col E, time shown in col F." }] },
    ]);
}

main().catch(console.error);
