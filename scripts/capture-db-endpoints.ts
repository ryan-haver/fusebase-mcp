#!/usr/bin/env npx tsx

/**
 * Capture database-related API endpoints by navigating the FuseBase Tables UI.
 * 
 * Usage:
 *   npx tsx scripts/capture-db-endpoints.ts --no-proxy
 *   npx tsx scripts/capture-db-endpoints.ts
 */

import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
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
const ORG_ID = process.env.FUSEBASE_ORG_ID || "";
const noProxy = process.argv.includes("--no-proxy");
const profile = process.argv.find(a => a.startsWith("--profile="))?.split("=")[1] || "";

const userDataDir = path.resolve(
    __dirname, "..", ".browser-data" + (profile ? `_${profile}` : "")
);

interface CapturedRequest {
    url: string;
    method: string;
    status: number;
    contentType: string;
    bodyPreview: string;
    responseSize: number;
}

async function main() {
    const baseUrl = `https://${HOST}`;
    const captured: CapturedRequest[] = [];

    console.error(`[capture] Launching browser (headless=false)...`);
    console.error(`[capture] Profile: ${userDataDir}`);
    console.error(`[capture] Host: ${HOST}, OrgId: ${ORG_ID}`);

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: ["--disable-blink-features=AutomationControlled"],
        viewport: { width: 1400, height: 900 },
    });

    try {
        const page = context.pages()[0] || (await context.newPage());

        // Capture all XHR/fetch requests
        page.on("response", async (response) => {
            const url = response.url();
            const method = response.request().method();

            // Filter: only capture API calls (not static assets)
            if (
                url.includes("/api/") ||
                url.includes("/gwapi") ||
                url.includes("/proxy/") ||
                url.includes("/dashboard-service/") ||
                url.includes("/tables/") ||
                url.includes("/dashboards") ||
                url.includes("/entities") ||
                url.includes("/views/")
            ) {
                const status = response.status();
                const contentType = response.headers()["content-type"] || "";
                let bodyPreview = "";
                let responseSize = 0;

                try {
                    const body = await response.body();
                    responseSize = body.length;
                    const text = body.toString("utf-8");
                    bodyPreview = text.slice(0, 500);
                } catch {
                    bodyPreview = "[could not read body]";
                }

                const entry: CapturedRequest = { url, method, status, contentType, bodyPreview, responseSize };
                captured.push(entry);

                // Log in real-time
                const shortUrl = url.replace(baseUrl, "");
                console.error(`  [${method}] ${status} ${shortUrl} (${responseSize} bytes)`);
            }
        });

        // Step 1: Navigate to main page to establish session
        console.error(`\n[capture] Navigating to ${baseUrl}...`);
        await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(3000);
        console.error(`[capture] Current URL: ${page.url()}`);

        // Step 2: Navigate to the Tables/Databases page
        const tablesUrl = `${baseUrl}/dashboard/${ORG_ID}/tables/databases`;
        console.error(`\n[capture] Navigating to Tables page: ${tablesUrl}`);
        await page.goto(tablesUrl, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(5000);
        console.error(`[capture] Current URL: ${page.url()}`);

        // Step 3: Try clicking on a database/table if available
        try {
            // Look for table entries or sidebar links
            const tableLinks = await page.locator("a[href*='table'], a[href*='database'], [class*='table-item'], [class*='database']").all();
            console.error(`[capture] Found ${tableLinks.length} table/database links`);

            if (tableLinks.length > 0) {
                console.error("[capture] Clicking first table link...");
                await tableLinks[0].click();
                await page.waitForTimeout(5000);
                console.error(`[capture] URL after click: ${page.url()}`);
            }
        } catch (err) {
            console.error(`[capture] Could not interact with table links: ${(err as Error).message}`);
        }

        // Step 4: Try navigating to entity pages
        for (const entity of ["clients", "spaces"]) {
            const entityUrl = `${baseUrl}/dashboard/${ORG_ID}/tables/entity/${entity}`;
            console.error(`\n[capture] Navigating to entity: ${entityUrl}`);
            await page.goto(entityUrl, { waitUntil: "domcontentloaded" });
            await page.waitForTimeout(3000);
            console.error(`[capture] Current URL: ${page.url()}`);
        }

        // Step 5: Wait a moment for any lazy-loaded API calls
        console.error("\n[capture] Waiting 5s for remaining API calls...");
        await page.waitForTimeout(5000);

        // Save captured data
        const dataDir = path.resolve(__dirname, "..", "data");
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        const outputPath = path.resolve(dataDir, "db-endpoints-capture.json");
        fs.writeFileSync(outputPath, JSON.stringify(captured, null, 2));
        console.error(`\n[capture] Saved ${captured.length} API calls to ${outputPath}`);

        // Print summary
        console.error("\n=== Capture Summary ===");
        const uniqueEndpoints = new Map<string, CapturedRequest>();
        for (const c of captured) {
            const key = `${c.method} ${new URL(c.url).pathname}`;
            if (!uniqueEndpoints.has(key)) uniqueEndpoints.set(key, c);
        }

        for (const [key, c] of uniqueEndpoints) {
            console.log(`${c.status === 200 ? '✅' : '❌'} [${c.status}] ${key}`);
            if (c.bodyPreview && c.bodyPreview !== "[could not read body]") {
                console.log(`   Preview: ${c.bodyPreview.slice(0, 120).replace(/\n/g, " ")}`);
            }
        }
        console.error(`\nTotal: ${captured.length} requests, ${uniqueEndpoints.size} unique endpoints`);

    } finally {
        await context.close();
    }
}

main().catch(console.error);
