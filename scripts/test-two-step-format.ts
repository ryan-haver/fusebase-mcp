import * as Y from "yjs";
import { loadEncryptedCookie } from "../src/crypto.js";
import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
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

// Step 1: Create a blank page with a rating column (no format)
const cookie = process.env.FUSEBASE_COOKIE || loadEncryptedCookie()?.cookie!;
const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
let noteId = "";
for (let i = 0; i < 16; i++) noteId += chars.charAt(Math.floor(Math.random() * chars.length));

console.log("Step 1: Creating page with rating column (no format props)...");
await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ workspaceId: WS_ID, noteId, note: { textVersion: 2, title: "Two-Step Format Test", parentId: "default", is_portal_share: false } }),
});

// Write table without format properties first
await writeContentViaWebSocket(HOST, WS_ID, noteId, cookie, [
    { type: "heading", level: 1, children: [{ text: "Two-Step Format Test" }] },
    {
        type: "table",
        columns: [
            { text: "Desc", type: "text" },
            { text: "Rating", type: "rating" },
            { text: "Date", type: "date" },
        ],
        rows: [
            {
                cells: [
                    { cellType: "text", children: [{ text: "Row 1" }] },
                    { cellType: "rating", rating: 3 },
                    { cellType: "date", timestamp: Date.now() },
                ]
            },
        ],
    },
], { replace: true, timeout: 10000 });

console.log(`Page created: ${noteId}`);
console.log(`URL: https://${HOST}/space/${WS_ID}/page/${noteId}`);

// Step 2: Wait, then reconnect and add format properties to the column
console.log("\nStep 2: Waiting 3 seconds, then reconnecting to add format...");
await new Promise(r => setTimeout(r, 3000));

// Dump the page to find the column block IDs
const dumpRes = await fetch(`https://${HOST}/dump/${WS_ID}/${noteId}`, {
    headers: { cookie },
});
const buf = new Uint8Array(await dumpRes.arrayBuffer());
let len = 0, shift = 0, idx = 1;
let byte: number;
do { byte = buf[idx++]; len |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
const data = buf.slice(idx, idx + len);
const doc = new Y.Doc();
Y.applyUpdate(doc, data);

const blocks = doc.getMap("blocks");
const ratingColId: string[] = [];
const dateColId: string[] = [];
for (const [key, val] of blocks.entries()) {
    if (val instanceof Y.Map) {
        const m = val as Y.Map<any>;
        if (m.get("type") === "column") {
            if (m.get("columnType") === "rating") ratingColId.push(key);
            if (m.get("columnType") === "date") dateColId.push(key);
        }
    }
}
console.log(`Found rating column: ${ratingColId}, date column: ${dateColId}`);

// Now connect via WebSocket and modify just the format property
const WebSocket = (await import("ws")).default;
const tokenRes = await fetch(`https://${HOST}/v4/api/workspaces/${WS_ID}/texts/${noteId}/tokens`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: "{}",
});
const tokenBody: any = await tokenRes.json();
const token = tokenBody.token || tokenBody.data?.token;

const wsUrl = `wss://${HOST.replace('nimbusweb.me', 'nimbusweb.me')}/yjs-ws/${WS_ID}/${noteId}?token=${token}`;
console.log(`Connecting to: ${wsUrl}`);

const ws = new WebSocket(wsUrl);
await new Promise<void>((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
});

// Wait for initial sync
await new Promise(r => setTimeout(r, 2000));

// Listen for messages and do the sync handshake
const doc2 = new Y.Doc();
const encoder = new (await import("lib0/encoding")).createEncoder;

// Apply the dump data to our local doc
Y.applyUpdate(doc2, data);

// Now modify the rating column format
const blocks2 = doc2.getMap("blocks");
if (ratingColId.length > 0) {
    const ratingCol = blocks2.get(ratingColId[0]) as Y.Map<any>;
    ratingCol.set("format", { ratingIcon: "heart" });
    console.log("Set ratingIcon to heart on column", ratingColId[0]);
}
if (dateColId.length > 0) {
    const dateCol = blocks2.get(dateColId[0]) as Y.Map<any>;
    dateCol.set("format", { dateFormat: "yyyy/mm/dd" });
    console.log("Set dateFormat to yyyy/mm/dd on column", dateColId[0]);
}

// Encode the update and send it via WebSocket
const update = Y.encodeStateAsUpdate(doc2, Y.encodeStateVector(doc));
console.log(`Update size: ${update.length} bytes`);

// Send as sync update message
// Message format: [type=0 (sync), subtype=2 (update), data]
const { createEncoder: createEnc, writeVarUint, writeVarUint8Array, toUint8Array } = await import("lib0/encoding");
const enc = createEnc();
writeVarUint(enc, 0); // sync message
writeVarUint(enc, 2); // sync update  
writeVarUint8Array(enc, update);
ws.send(toUint8Array(enc));
console.log("Sent Y.js update via WebSocket");

await new Promise(r => setTimeout(r, 2000));
ws.close();
console.log("Done! Check the page.");
