import { loadEncryptedCookie } from "../src/crypto.js";
import { FusebaseClient } from "../src/client.js";
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
const ORG_ID = process.env.FUSEBASE_ORG_ID || "";
const COOKIE = process.env.FUSEBASE_COOKIE || loadEncryptedCookie()?.cookie!;

const client = new FusebaseClient({
    host: HOST,
    orgId: ORG_ID,
    cookie: COOKIE,
    autoRefresh: false,
});

// Create a small test image (1x1 red pixel PNG)
const PNG_1x1_RED = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
    "base64",
);

async function testUpload() {
    // Use the manual test page
    const pageId = "I1XIyTUrhQMTDaJE";

    console.log("Uploading test image (1x1 red pixel PNG)...");
    try {
        const result = await client.uploadFile(
            WS_ID,
            pageId,
            PNG_1x1_RED,
            "test-upload.png",
            "image/png",
            "attachment",
        );
        console.log("Upload successful!");
        console.log(JSON.stringify(result, null, 2));

        // Verify it shows up in page attachments
        const attachments = await client.getAttachments(WS_ID, pageId);
        const found = attachments.find((a: any) => a.globalId === result.attachmentId);
        console.log("\nVerification:", found ? "✅ Found in page attachments" : "❌ Not found");
        if (found) {
            console.log("  Name:", (found as any).displayName);
            console.log("  Size:", (found as any).size);
        }
    } catch (error) {
        console.error("Upload failed:", error);
    }
}

await testUpload();
