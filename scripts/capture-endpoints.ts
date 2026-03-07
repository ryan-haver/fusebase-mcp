/**
 * Network Capture Script for FuseBase Database Features
 * 
 * Launches a browser with authenticated session and captures ALL network
 * requests while the user manually performs actions.
 * 
 * Pre-creates a test database with sample rows, then opens the browser
 * to the database page. The user should:
 * 1. Click the star icon to FAVORITE the database
 * 2. Click 3-dot menu → Duplicate 
 * 3. Click table menu → Export to CSV
 * 4. Click table menu → Import from CSV (with a test file)
 * 5. Click "Add View" to create a new view
 * 6. Click view 3-dot menu → Duplicate
 * 7. Click view 3-dot menu → Delete
 * 8. Switch to each view type (board, calendar, timeline, gallery, list, grid)
 * 
 * The script logs all requests and saves them to artifacts.
 * 
 * Run: npx tsx scripts/capture-endpoints.ts
 */
import * as path from "path"; import * as fs from "fs"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) { for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq > 0 && !process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim(); } }
import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import { chromium } from "playwright";

const sc = loadEncryptedCookie();
const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const ORG = process.env.FUSEBASE_ORG_ID || "";
const COOKIE = process.env.FUSEBASE_COOKIE || sc?.cookie || "";
const ARTIFACTS = path.resolve(__dirname, "..", "artifacts");
fs.mkdirSync(ARTIFACTS, { recursive: true });

const c = new FusebaseClient({ host: HOST, orgId: ORG, cookie: COOKIE });

interface CapturedRequest {
    timestamp: string;
    method: string;
    url: string;
    status?: number;
    requestBody?: string;
    responseBody?: string;
    contentType?: string;
}

const captured: CapturedRequest[] = [];

async function run() {
    console.log("▶ Creating test database with sample data...");
    const cr = await c.createDatabase("capture-test-db");
    const d = (cr as any).data;
    const dbId = d.global_id;
    const dashId = d.dashboards[0].global_id;
    const viewId = d.dashboards[0].views[0].global_id;
    console.log(`  DB: ${dbId}`);
    console.log(`  Dashboard: ${dashId}`);
    console.log(`  View: ${viewId}`);

    // Add some rows so we have data for CSV export
    for (let i = 1; i <= 3; i++) {
        await c.addDatabaseRow(`Row ${i}`, { databaseId: dbId, dashboardId: dashId, orgId: ORG });
    }
    console.log("  Added 3 rows");

    // Build the URL to the database
    const dbUrl = `https://${HOST}/dashboard/${ORG}/tables/databases/${dbId}/dashboard/${dashId}`;
    console.log(`\n▶ Opening browser to: ${dbUrl}`);

    // Parse cookies for Playwright
    const cookiePairs = COOKIE.split(";").map(s => s.trim()).filter(Boolean);
    const pwCookies = cookiePairs.map(pair => {
        const eq = pair.indexOf("=");
        return {
            name: pair.substring(0, eq),
            value: pair.substring(eq + 1),
            domain: HOST.includes(".") ? "." + HOST.split(".").slice(-2).join(".") : HOST,
            path: "/",
        };
    });

    const browser = await chromium.launch({ 
        headless: false,
        channel: "chrome",
    });
    const context = await browser.newContext({
        viewport: { width: 1400, height: 900 },
    });
    await context.addCookies(pwCookies);

    const page = await context.newPage();

    // Intercept ALL network requests
    page.on("request", (req) => {
        const url = req.url();
        if (url.includes("/api/") || url.includes("/dashboard-service/") || url.includes("next-action") || url.includes("/v4/")) {
            const entry: CapturedRequest = {
                timestamp: new Date().toISOString(),
                method: req.method(),
                url: url,
                requestBody: req.postData() || undefined,
            };
            captured.push(entry);
            console.log(`  📡 ${req.method()} ${url.substring(0, 120)}`);
            if (req.postData()) {
                const body = req.postData()!;
                if (body.length < 500) console.log(`     BODY: ${body}`);
                else console.log(`     BODY: ${body.substring(0, 200)}...`);
            }
        }
    });

    page.on("response", async (res) => {
        const url = res.url();
        if (url.includes("/api/") || url.includes("/dashboard-service/") || url.includes("next-action") || url.includes("/v4/")) {
            const entry = captured.find(e => e.url === url && !e.status);
            if (entry) {
                entry.status = res.status();
                entry.contentType = res.headers()["content-type"] || "";
                try {
                    const body = await res.text();
                    entry.responseBody = body.substring(0, 2000);
                    if (res.status() >= 200 && res.status() < 300 && body.length < 500) {
                        console.log(`  ✅ ${res.status()} ${url.substring(0, 80)}`);
                        console.log(`     RESP: ${body.substring(0, 300)}`);
                    } else {
                        console.log(`  ${res.status() >= 400 ? "❌" : "✅"} ${res.status()} ${url.substring(0, 80)}`);
                    }
                } catch {}
            }
        }
    });

    await page.goto(dbUrl, { timeout: 30000, waitUntil: "domcontentloaded" });
    console.log("\n════════════════════════════════════════════════════════");
    console.log("  BROWSER IS OPEN — perform these actions:");
    console.log("════════════════════════════════════════════════════════");
    console.log("  1. ⭐ FAVORITE the database (star icon at top)");
    console.log("  2. 📋 DUPLICATE the database (3-dot menu)");
    console.log("  3. 📤 EXPORT TO CSV (table/view menu)");
    console.log("  4. 📥 IMPORT FROM CSV (table/view menu)");
    console.log("  5. ➕ CREATE A NEW VIEW (Add View button)");
    console.log("  6. 📋 DUPLICATE the new view (view 3-dot menu)");
    console.log("  7. 🗑  DELETE the duplicated view (view 3-dot menu)");
    console.log("  8. 🔄 SWITCH to each view type: board, calendar,");
    console.log("         timeline, gallery, list, grid");
    console.log("════════════════════════════════════════════════════════");
    console.log("  Press Ctrl+C when done. Data saves automatically.\n");

    // Wait for the user to perform actions, save periodically
    const saveResults = () => {
        const outPath = path.join(ARTIFACTS, "captured-endpoints.json");
        fs.writeFileSync(outPath, JSON.stringify(captured, null, 2));
        console.log(`\n  💾 Saved ${captured.length} captured requests to ${outPath}`);
    };

    const interval = setInterval(saveResults, 10000);

    // Keep alive until user closes or Ctrl+C
    process.on("SIGINT", () => {
        saveResults();
        clearInterval(interval);
        browser.close().catch(() => {});
        process.exit(0);
    });

    process.on("SIGTERM", () => {
        saveResults();
        clearInterval(interval);
        browser.close().catch(() => {});
        process.exit(0);
    });

    // Wait for browser to close
    try {
        await page.waitForEvent("close", { timeout: 600000 }); // 10 min timeout
    } catch {
        // timeout — save and exit
    }
    
    saveResults();
    clearInterval(interval);
    await browser.close().catch(() => {});
    
    console.log("\n▶ Cleanup: deleting test database...");
    try { await c.deleteDatabase(dbId); } catch {}
    console.log("  Done!");
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
