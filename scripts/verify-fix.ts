/**
 * Quick verification: Write content using the FIXED writer and check if it renders.
 * 
 * Run: npx tsx scripts/verify-fix.ts
 */
import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import { markdownToSchema } from "../src/markdown-parser.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = fs.readFileSync(path.resolve(__dirname, "..", ".env"), "utf-8");
for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
}

const host = process.env.FUSEBASE_HOST!;
const wsId = process.env.FUSEBASE_WS_ID || "45h7lom5ryjak34u";
const stored = loadEncryptedCookie();
const cookie = stored?.cookie || process.env.FUSEBASE_COOKIE!;

async function main() {
    // Create a fresh page
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const noteId = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const title = `✅ Fix Verify ${new Date().toISOString().slice(11, 19)}`;

    console.log(`Creating page "${title}"...`);
    const createRes = await fetch(`https://${host}/v2/api/web-editor/notes/create`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
            workspaceId: wsId, noteId,
            note: { textVersion: 2, title, parentId: "default", is_portal_share: false },
        }),
    });
    if (!createRes.ok) { console.log(`❌ Create failed: ${createRes.status}`); return; }
    const pageData = await createRes.json() as any;
    const pageId = pageData.globalId || noteId;

    console.log(`Page: ${pageId}`);
    console.log(`URL: https://${host}/ws/${wsId}/note/${pageId}\n`);

    // Write content using markdown
    const markdown = `# Hello from the Fixed Writer!

This paragraph was written by the **fixed** Y.js WebSocket writer.

It now matches the *exact* browser structure:
- Blocks at top-level doc.getMap("blocks")
- Order at top-level doc.getArray("rootChildren")
- Only 5-6 fields per block (no extras)

---

## Test Block Types

> This is a blockquote to verify that type works too.

1. First numbered item
1. Second numbered item
1. Third numbered item
`;

    console.log("Converting markdown to schema...");
    const blocks = markdownToSchema(markdown);
    console.log(`  ${blocks.length} blocks\n`);

    console.log("Writing via Y.js WebSocket...");
    const result = await writeContentViaWebSocket(host, wsId, pageId, cookie, blocks, { replace: true });

    if (result.success) {
        console.log("✅ SUCCESS! Content written.");
        console.log(`\n🌐 Open this page to verify: https://${host}/ws/${wsId}/note/${pageId}`);

        // Also check the dump
        await new Promise(r => setTimeout(r, 2000));
        const dumpRes = await fetch(`https://${host}/dump/${wsId}/${pageId}`, { headers: { cookie } });
        const dumpBin = new Uint8Array(await dumpRes.arrayBuffer());
        const dumpText = Buffer.from(dumpBin).toString("utf-8");

        console.log(`\nDump: ${dumpBin.length} bytes`);
        console.log(`Contains "Hello": ${dumpText.includes("Hello")}`);
        console.log(`Contains "paragraph": ${dumpText.includes("paragraph")}`);
        console.log(`Contains "hLarge": ${dumpText.includes("hLarge")}`);
        console.log(`Contains "rootChildren": ${dumpText.includes("rootChildren")}`);
        console.log(`Contains "blocks": ${dumpText.includes("blocks")}`);
        // Check for the OLD structure markers that should NOT be there
        console.log(`Contains "children" (nested): ${dumpText.includes("children")}`);
        console.log(`Contains "selectorId" (old field): ${dumpText.includes("selectorId")}`);
        console.log(`Contains "capsule" (old field): ${dumpText.includes("capsule")}`);
    } else {
        console.log(`❌ FAILED: ${result.error}`);
    }
}

main().catch(console.error);
