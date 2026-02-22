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
const opts = { done: `${ts}`, active: `${ts + 1}` };

async function main() {
    await makePage("Mention Test — All 3 Types", [
        { type: "heading", level: 1, children: [{ text: "Mention Cell Test" }] },
        { type: "paragraph", children: [{ text: "Testing date, person, and folder @mentions in table cells." }] },
        {
            type: "table",
            columns: [
                { text: "Description", type: "text" },
                { text: "Mention", type: "mention" },
            ],
            rows: [
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Date mention (@Today)" }] },
                        {
                            cellType: "mention",
                            mention: {
                                mentionType: "date",
                                name: "Today",
                                value: ts,
                            },
                        },
                    ],
                },
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Person mention (@Ryan)" }] },
                        {
                            cellType: "mention",
                            mention: {
                                mentionType: "user",
                                name: "Ryan Haver",
                                objectId: 3650509,  // From the native dump
                            },
                        },
                    ],
                },
                {
                    cells: [
                        { cellType: "text", children: [{ text: "Folder mention (@Unsorted)" }] },
                        {
                            cellType: "mention",
                            mention: {
                                mentionType: "folder",
                                name: "Unsorted",
                                objectId: "default",
                                workspaceId: WS_ID,
                            },
                        },
                    ],
                },
            ],
        },
        { type: "paragraph", children: [{ text: "✅ All 3 mention types rendered." }] },
    ]);
}

main().catch(console.error);
