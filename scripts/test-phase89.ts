/**
 * Final E2E smoke test for Phase 8 file tools
 */
import * as fs from "fs";
import * as path from "path";
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

import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const ORG_ID = process.env.FUSEBASE_ORG_ID || "";
const WS_ID = process.env.FUSEBASE_WORKSPACE_ID || "45h7lom5ryjak34u";
const cookie = process.env.FUSEBASE_COOKIE || loadEncryptedCookie()?.cookie || "";

const client = new FusebaseClient({ host: HOST, orgId: ORG_ID, cookie });

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
    if (ok) { console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`); passed++; }
    else { console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); failed++; }
}

async function main() {
    console.log("=== Phase 8: File Upload & Download ===\n");

    // 1. Create temp page
    const noteId = "smokeF" + Date.now().toString(36).slice(-10);
    const createRes = await fetch(`https://${HOST}/v2/api/web-editor/notes/create`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
            workspaceId: WS_ID, noteId,
            note: { textVersion: 2, title: "Smoke Test Upload", parentId: "default", is_portal_share: false },
        }),
    });
    check("create test page", createRes.ok, `noteId=${noteId}`);

    // 2. Upload file via client.uploadFile (2-step)
    let attachmentId = "";
    try {
        const testData = Buffer.from("Hello from FuseBase MCP smoke test!\n" + new Date().toISOString());
        const result = await client.uploadFile(WS_ID, noteId, testData, "smoke-test.txt", "text/plain", "attachment");
        attachmentId = result.attachmentId;
        check("client.uploadFile", !!result.attachmentId, `id=${result.attachmentId}, src=${result.src}`);
    } catch (err) {
        const msg = (err as Error).message;
        check("client.uploadFile", false, msg.slice(0, 120));
    }

    // 3. List attachments on that page
    try {
        const atts = await client.getAttachments(WS_ID, noteId);
        check("client.getAttachments", Array.isArray(atts), `${atts.length} attachments`);
    } catch (err) {
        check("client.getAttachments", false, (err as Error).message.slice(0, 80));
    }

    // 4. Download attachment
    if (attachmentId) {
        try {
            const dl = await client.downloadAttachment(WS_ID, attachmentId, "smoke-test.txt");
            const content = Buffer.from(dl.base64, "base64").toString("utf-8");
            check("client.downloadAttachment", content.includes("Hello from FuseBase MCP"), `size=${dl.size}, mime=${dl.mime}`);
        } catch (err) {
            check("client.downloadAttachment", false, (err as Error).message.slice(0, 80));
        }
    } else {
        check("client.downloadAttachment", false, "Skipped — upload failed");
    }

    // 5. List files workspace-wide
    try {
        const files = await client.listFiles(WS_ID, 3);
        check("client.listFiles", Array.isArray(files), `${files.length} files`);
    } catch (err) {
        check("client.listFiles", false, (err as Error).message.slice(0, 80));
    }

    console.log(`\n=== Results: ${passed}/${passed + failed} passed ===`);

    // Cleanup
    try { await client.deletePage(WS_ID, noteId); console.log(`  Cleaned up: ${noteId}`); } catch { }
}

main().catch(console.error);
