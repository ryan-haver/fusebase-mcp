#!/usr/bin/env npx tsx

/**
 * Capture the POST endpoint for creating database records.
 * 
 * Opens the FuseBase Tables UI → clients entity → clicks Add/New button
 * → captures the resulting POST/PUT/PATCH API call.
 * 
 * Usage:
 *   npx tsx scripts/capture-db-create.ts
 *   npx tsx scripts/capture-db-create.ts --entity=spaces
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
const entity = process.argv.find(a => a.startsWith("--entity="))?.split("=")[1] || "clients";
const profile = process.argv.find(a => a.startsWith("--profile="))?.split("=")[1] || "";

const userDataDir = path.resolve(
    __dirname, "..", ".browser-data" + (profile ? `_${profile}` : "")
);

interface CapturedRequest {
    url: string;
    method: string;
    status: number;
    contentType: string;
    requestBody: string;
    requestHeaders: Record<string, string>;
    bodyPreview: string;
    responseSize: number;
}

async function main() {
    const baseUrl = `https://${HOST}`;
    const captured: CapturedRequest[] = [];

    console.error(`[capture-create] Launching browser (headless=false)...`);
    console.error(`[capture-create] Entity: ${entity}`);
    console.error(`[capture-create] Host: ${HOST}, OrgId: ${ORG_ID}`);

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: ["--disable-blink-features=AutomationControlled"],
        viewport: { width: 1400, height: 900 },
    });

    try {
        const page = context.pages()[0] || (await context.newPage());

        // Capture ALL requests (especially POST/PUT/PATCH)
        page.on("response", async (response) => {
            const url = response.url();
            const method = response.request().method();

            // Capture write operations and API calls
            const isWriteOp = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
            const isApiCall =
                url.includes("/api/") ||
                url.includes("/gwapi") ||
                url.includes("/proxy/") ||
                url.includes("/dashboard-service/") ||
                url.includes("/dashboards") ||
                url.includes("/views/") ||
                url.includes("/items") ||
                url.includes("/entities") ||
                url.includes("/tables/") ||
                url.includes("_rsc");

            if (isWriteOp || isApiCall) {
                const status = response.status();
                const contentType = response.headers()["content-type"] || "";
                let bodyPreview = "";
                let responseSize = 0;
                let requestBody = "";
                let requestHeaders: Record<string, string> = {};

                try {
                    requestBody = response.request().postData() || "";
                    requestHeaders = response.request().headers();
                } catch { /* ignore */ }

                try {
                    const body = await response.body();
                    responseSize = body.length;
                    const text = body.toString("utf-8");
                    bodyPreview = text.slice(0, 500);
                } catch {
                    bodyPreview = "[could not read body]";
                }

                const entry: CapturedRequest = {
                    url, method, status, contentType,
                    requestBody: requestBody.slice(0, 1000),
                    requestHeaders,
                    bodyPreview, responseSize
                };
                captured.push(entry);

                const shortUrl = url.replace(baseUrl, "");
                const isWrite = isWriteOp ? " ⚡ WRITE" : "";
                console.error(`  [${method}] ${status} ${shortUrl}${isWrite} (${responseSize} bytes)`);

                if (isWriteOp && requestBody) {
                    console.error(`    RequestBody: ${requestBody.slice(0, 200)}`);
                }
            }
        });

        // Step 1: Navigate to entity page to load it
        const entityUrl = `${baseUrl}/dashboard/${ORG_ID}/tables/entity/${entity}`;
        console.error(`\n[capture-create] Navigating to ${entityUrl}...`);
        await page.goto(entityUrl, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(5000);
        console.error(`[capture-create] Page loaded. URL: ${page.url()}`);

        // Step 2: Look for Add/New/Create button
        console.error("\n[capture-create] Searching for Add/New/Create button...");

        // Try multiple patterns for the button
        const buttonSelectors = [
            // Common patterns
            'button:has-text("Add")',
            'button:has-text("New")',
            'button:has-text("Create")',
            'button:has-text("+")',
            '[data-testid*="add"]',
            '[data-testid*="new"]',
            '[data-testid*="create"]',
            '[class*="add-button"]',
            '[class*="create"]',
            '[class*="new-record"]',
            '[class*="add-row"]',
            '[class*="AddRow"]',
            // FuseBase specific
            '.add-item-button',
            'button[class*="add"]',
            // The + icon in tables
            'svg[class*="plus"]',
            'button svg[class*="add"]',
        ];

        let addButton = null;
        for (const sel of buttonSelectors) {
            try {
                const loc = page.locator(sel).first();
                if (await loc.isVisible({ timeout: 1000 })) {
                    const text = await loc.textContent();
                    console.error(`  Found button: "${text}" (selector: ${sel})`);
                    addButton = loc;
                    break;
                }
            } catch { /* continue */ }
        }

        if (!addButton) {
            // Try a broader search — look for ALL buttons and list them
            console.error("\n[capture-create] No specific add button found. Listing all visible buttons...");
            const allButtons = await page.locator("button:visible").all();
            console.error(`  Found ${allButtons.length} buttons:`);
            for (let i = 0; i < allButtons.length && i < 20; i++) {
                try {
                    const text = (await allButtons[i].textContent())?.trim().slice(0, 60) || "";
                    const cls = await allButtons[i].getAttribute("class") || "";
                    const testId = await allButtons[i].getAttribute("data-testid") || "";
                    console.error(`    [${i}] text="${text}" class="${cls.slice(0, 50)}" data-testid="${testId}"`);
                } catch { /* skip */ }
            }

            // Also look for clickable elements near the table
            console.error("\n[capture-create] Looking for clickable add elements...");
            const addEls = await page.locator('[role="button"]:visible, a:visible').all();
            for (let i = 0; i < addEls.length && i < 15; i++) {
                try {
                    const text = (await addEls[i].textContent())?.trim().slice(0, 60) || "";
                    const tag = await addEls[i].evaluate(el => el.tagName);
                    if (text.match(/add|new|create|\+/i)) {
                        console.error(`    MATCH: <${tag}> "${text}"`);
                        addButton = addEls[i];
                    }
                } catch { /* skip */ }
            }
        }

        if (addButton) {
            console.error("\n[capture-create] Clicking Add button...");
            const requestsBefore = captured.length;
            await addButton.click();
            await page.waitForTimeout(5000);
            const newRequests = captured.slice(requestsBefore);
            console.error(`[capture-create] ${newRequests.length} new requests after click`);

            // Check for a modal/form that might need filling
            const inputs = await page.locator("input:visible, textarea:visible").all();
            if (inputs.length > 0) {
                console.error(`\n[capture-create] Found ${inputs.length} input fields (form detected)`);
                for (let i = 0; i < inputs.length && i < 10; i++) {
                    const ph = await inputs[i].getAttribute("placeholder") || "";
                    const name = await inputs[i].getAttribute("name") || "";
                    const type = await inputs[i].getAttribute("type") || "text";
                    console.error(`    [${i}] type="${type}" name="${name}" placeholder="${ph}"`);
                }

                // Try to submit the form by pressing Enter or clicking Submit/Save
                const submitBtn = page.locator('button:has-text("Save"), button:has-text("Submit"), button:has-text("Create"), button[type="submit"]').first();
                if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.error("\n[capture-create] Clicking submit/save...");
                    const beforeSubmit = captured.length;
                    await submitBtn.click();
                    await page.waitForTimeout(5000);
                    const postSubmit = captured.slice(beforeSubmit);
                    console.error(`[capture-create] ${postSubmit.length} new requests after submit`);
                }
            }
        } else {
            console.error("\n[capture-create] ⚠ No add button found. Try interacting manually.");
            console.error("[capture-create] Waiting 30s for manual interaction...");
            await page.waitForTimeout(30000);
        }

        // Save all captured data
        const dataDir = path.resolve(__dirname, "..", "data");
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        const outputPath = path.resolve(dataDir, "db-create-capture.json");
        fs.writeFileSync(outputPath, JSON.stringify(captured, null, 2));
        console.error(`\n[capture-create] Saved ${captured.length} API calls to ${outputPath}`);

        // Print write operation summary
        console.error("\n=== Write Operations Summary ===");
        const writeOps = captured.filter(c => ["POST", "PUT", "PATCH"].includes(c.method));
        if (writeOps.length === 0) {
            console.error("  No write operations captured!");
            console.error("  The Add button may not have triggered an API call,");
            console.error("  or the record creation uses a different mechanism (e.g. WebSocket/RSC).");
        }
        for (const w of writeOps) {
            const shortUrl = w.url.replace(baseUrl, "");
            console.log(`⚡ [${w.method}] ${w.status} ${shortUrl}`);
            if (w.requestBody) {
                console.log(`   Request: ${w.requestBody.slice(0, 200)}`);
            }
            console.log(`   Response: ${w.bodyPreview.slice(0, 200)}`);
        }

        // Also print all unique endpoints for reference
        console.error("\n=== All Unique Endpoints ===");
        const seen = new Set<string>();
        for (const c of captured) {
            const key = `${c.method} ${new URL(c.url).pathname}`;
            if (!seen.has(key)) {
                seen.add(key);
                console.error(`  ${c.status === 200 ? '✅' : '❌'} [${c.status}] ${key}`);
            }
        }
        console.error(`\nTotal: ${captured.length} requests, ${writeOps.length} write ops`);

    } finally {
        await context.close();
    }
}

main().catch(console.error);
