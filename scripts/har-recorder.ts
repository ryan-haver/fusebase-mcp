/**
 * HAR Recorder: Opens Chrome with network recording.
 * User manually adds Subtable/Relation/Lookup columns, script captures all API traffic.
 * 
 * Usage: npx tsx scripts/har-recorder.ts
 * 
 * After adding columns, press Ctrl+C to stop. HAR saved to artifacts/manual-capture.har
 */
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) { for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq > 0 && !process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim(); } }
import { loadEncryptedCookie } from "../src/crypto.js";

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const ORG_ID = process.env.FUSEBASE_ORG_ID || "u268r1";
const cookieData = loadEncryptedCookie();
if (!cookieData?.cookie) throw new Error("No cookie");
const COOKIE = cookieData!.cookie;

const DB1_ID = "9ff3120f-277f-49c2-9c15-f643c5bbbeab";
const DB1_DASH = "b2d6b254-6474-47fc-b77f-c9ffb50f645a";

const ARTIFACTS = path.resolve(__dirname, "..", "artifacts");
const HAR_FILE = path.join(ARTIFACTS, "manual-capture.har");
const REQUESTS_FILE = path.join(ARTIFACTS, "manual-requests.json");
fs.mkdirSync(ARTIFACTS, { recursive: true });

const captured: any[] = [];

async function run() {
    const browser = await chromium.launch({ channel: "chrome", headless: false });
    const context = await browser.newContext({ recordHar: { path: HAR_FILE, urlFilter: /dashboard-service|dashboards|next-action/ } });
    
    const cookiePairs = COOKIE.split(";").map(s => s.trim()).filter(Boolean);
    await context.addCookies(cookiePairs.map(pair => {
        const eq = pair.indexOf("=");
        return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain: HOST, path: "/" };
    }));

    const page = await context.newPage();

    // Log all PUT/POST requests to console
    page.on("request", async req => {
        const url = req.url();
        if (!url.includes("dashboard-service") && !req.headers()["next-action"]) return;
        if (req.method() !== "PUT" && req.method() !== "POST" && req.method() !== "PATCH") return;
        const body = req.postData();
        console.log(`\n📤 ${req.method()} ${url.replace(`https://${HOST}`, "")}`);
        if (body) {
            try {
                const parsed = JSON.parse(body);
                console.log("   Body:", JSON.stringify(parsed, null, 2).substring(0, 500));
                captured.push({ time: Date.now(), method: req.method(), url: url.replace(`https://${HOST}`, ""), body: parsed });
            } catch {
                console.log("   Body:", body.substring(0, 200));
                captured.push({ time: Date.now(), method: req.method(), url: url.replace(`https://${HOST}`, ""), body });
            }
        }
    });

    page.on("response", async res => {
        const url = res.url();
        if (!url.includes("dashboard-service") && !res.request().headers()["next-action"]) return;
        if (res.request().method() !== "PUT" && res.request().method() !== "POST" && res.request().method() !== "PATCH") return;
        console.log(`📥 ${res.status()} ${url.replace(`https://${HOST}`, "")}`);
    });

    const targetUrl = `https://${HOST}/dashboard/${ORG_ID}/tables/databases/${DB1_ID}/dashboard/${DB1_DASH}`;
    console.log(`\n🌐 Opening: ${targetUrl}`);
    console.log(`\n📋 INSTRUCTIONS:`);
    console.log(`   1. Add a SUBTABLE column named "SubItems"`);
    console.log(`   2. Add a RELATION column named "Related" (link to "link-target" database)`);
    console.log(`   3. Add a LOOKUP column named "LookupField" (source: the Related column)`);
    console.log(`   4. Press Ctrl+C when done\n`);

    await page.goto(targetUrl);

    // Keep alive until user presses Ctrl+C
    process.on("SIGINT", async () => {
        console.log("\n\n⏹ Stopping...");
        fs.writeFileSync(REQUESTS_FILE, JSON.stringify(captured, null, 2));
        console.log(`💾 Saved ${captured.length} requests to ${REQUESTS_FILE}`);
        await context.close(); // This saves the HAR
        console.log(`💾 HAR saved to ${HAR_FILE}`);
        await browser.close();
        process.exit(0);
    });

    // Wait indefinitely
    await new Promise(() => {});
}

run().catch(e => { console.error("Failed:", e); process.exit(1); });
