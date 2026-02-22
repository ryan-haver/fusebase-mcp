/**
 * Test table creation with EXACT native FuseBase schema
 * Based on dump of page I1XIyTUrhQMTDaJE
 */
import * as Y from "yjs";
import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import { loadEncryptedCookie } from "../src/crypto.js";
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

async function makePage(title: string, buildContent: (doc: Y.Doc) => void) {
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

    // Use raw WebSocket approach to set content directly
    const WebSocket = (await import("ws")).default;
    const wsUrl = `wss://${HOST}/y-websocket?workspaceId=${WS_ID}&id=${pageId}&encv2=true`;
    return new Promise<string>((resolve, reject) => {
        const ws = new WebSocket(wsUrl, { headers: { cookie } });
        let sent = false;
        ws.on("message", (raw: Buffer) => {
            const bytes = new Uint8Array(raw);
            // Wait for sync step 1 (type 0 = sync, subtype 1 = step1)
            if (bytes[0] === 0 && bytes[1] === 1 && !sent) {
                sent = true;
                const ydoc = new Y.Doc();

                // Apply server state
                if (bytes.length > 2) {
                    try { Y.applyUpdate(ydoc, bytes.slice(2)); } catch { }
                }

                const beforeSv = Y.encodeStateVector(ydoc);

                ydoc.transact(() => {
                    buildContent(ydoc);
                });

                const diff = Y.encodeStateAsUpdate(ydoc, beforeSv);
                // Encode sync update message (type 0, subtype 2, then update)
                const msg = new Uint8Array(diff.length + 2);
                msg[0] = 0; // sync
                msg[1] = 2; // update
                msg.set(diff, 2);
                ws.send(Buffer.from(msg));

                setTimeout(() => {
                    ws.close();
                    console.log(`[${title}] ${pageId}`);
                    console.log(`  https://${HOST}/space/${WS_ID}/page/${pageId}\n`);
                    resolve(pageId);
                }, 2000);
            }
        });
        ws.on("error", reject);
    });
}

let blockCounter = 0;
function genId() { return `b${Date.now()}_${blockCounter++}`; }

async function main() {
    // Test 1: EXACT match of native table schema from dump
    await makePage("TableTest: Native Schema", (doc) => {
        const blocks = doc.getMap("blocks");
        const rootChildren = doc.getArray("rootChildren");

        // 1. Column block (minimal - just id + type, nothing else)
        const colId = genId();
        const colBlock = new Y.Map();
        colBlock.set("id", colId);
        colBlock.set("type", "column");
        blocks.set(colId, colBlock);

        // 2. Table text blocks (content of cells)
        const text1Id = genId();
        const text1 = new Y.Map();
        text1.set("id", text1Id);
        text1.set("type", "tableText");
        const chars1 = new Y.Text();
        chars1.insert(0, "Hello World\n");
        text1.set("characters", chars1);
        blocks.set(text1Id, text1);

        const text2Id = genId();
        const text2 = new Y.Map();
        text2.set("id", text2Id);
        text2.set("type", "tableText");
        const chars2 = new Y.Text();
        chars2.insert(0, "Second cell\n");
        text2.set("characters", chars2);
        blocks.set(text2Id, text2);

        // 3. Table cell blocks
        const cell1Id = genId();
        const cell1 = new Y.Map();
        cell1.set("id", cell1Id);
        cell1.set("cellType", "text");
        cell1.set("type", "tableCellText");
        const cell1Kids = new Y.Array<string>();
        cell1Kids.push([text1Id]);
        cell1.set("children", cell1Kids);
        blocks.set(cell1Id, cell1);

        const cell2Id = genId();
        const cell2 = new Y.Map();
        cell2.set("id", cell2Id);
        cell2.set("cellType", "text");
        cell2.set("type", "tableCellText");
        const cell2Kids = new Y.Array<string>();
        cell2Kids.push([text2Id]);
        cell2.set("children", cell2Kids);
        blocks.set(cell2Id, cell2);

        // 4. Row block
        const rowId = genId();
        const rowBlock = new Y.Map();
        rowBlock.set("id", rowId);
        rowBlock.set("type", "row");
        const rowKids = new Y.Array<string>();
        rowKids.push([cell1Id, cell2Id]);
        rowBlock.set("children", rowKids);
        blocks.set(rowId, rowBlock);

        // 5. Caption block
        const capId = genId();
        const capBlock = new Y.Map();
        capBlock.set("id", capId);
        capBlock.set("type", "caption");
        capBlock.set("align", "left");
        capBlock.set("indent", 0);
        const capChars = new Y.Text();
        capChars.insert(0, "\n");
        capBlock.set("characters", capChars);
        blocks.set(capId, capBlock);

        // 6. Table block (exact match of native schema)
        const tableId = genId();
        const tableBlock = new Y.Map();
        tableBlock.set("id", tableId);
        tableBlock.set("type", "table");
        tableBlock.set("version", 2);
        tableBlock.set("size", { cols: 3, rows: 1, visibleRows: 1 });
        const colArr = new Y.Array<string>();
        colArr.push([colId]);
        tableBlock.set("columns", colArr);
        const rowArr = new Y.Array<string>();
        rowArr.push([rowId]);
        tableBlock.set("rows", rowArr);
        tableBlock.set("indent", 0);
        tableBlock.set("caption", capId);
        blocks.set(tableId, tableBlock);

        // Add to rootChildren as plain string (matching native)
        rootChildren.push([tableId]);
    });
}

main().catch(console.error);
