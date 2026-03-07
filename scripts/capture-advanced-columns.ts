/**
 * Capture advanced column types by ADDING Subtable/Relation/Lookup through the UI
 * using Playwright with `channel: "chrome"` to use installed Chrome on Windows.
 * 
 * Strategy: Open the DB, add each column type by clicking through the dialog,
 * then capture the schema via Node.js fetch to see the exact column definitions.
 * 
 * Run: npx tsx scripts/capture-advanced-columns.ts
 */

import { chromium, type Page } from "playwright";
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

import { loadEncryptedCookie } from "../src/crypto.js";

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const ORG_ID = process.env.FUSEBASE_ORG_ID || "u268r1";
const cookieData = loadEncryptedCookie();
if (!cookieData?.cookie) throw new Error("No cookie");
const COOKIE = cookieData!.cookie;
const BASE = `https://${HOST}`;

// Database IDs from previous creation
const DB1_ID = "9ff3120f-277f-49c2-9c15-f643c5bbbeab";
const DB1_DASH = "b2d6b254-6474-47fc-b77f-c9ffb50f645a";
const DB1_VIEW = "14b17eca-14a0-4907-9ccc-6b9f87b9a393";
const DB2_ID = "f2b6c462-ef42-43da-96f4-3517f1f05e4f";

const ARTIFACTS = path.resolve(__dirname, "..", "artifacts");
fs.mkdirSync(ARTIFACTS, { recursive: true });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// All captured PUT/POST requests to dashboard-service
const captured: any[] = [];

async function getSchema(): Promise<any[]> {
    const res = await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${DB1_DASH}/views/${DB1_VIEW}`, { headers: { cookie: COOKIE } });
    const data = await res.json() as any;
    return data?.data?.schema?.items || [];
}

async function run() {
    console.log("▶ Getting initial schema...");
    const before = await getSchema();
    console.log(`  Initial columns (${before.length}): ${before.map((i: any) => i.name).join(", ")}`);

    console.log("\n▶ Launching browser...");
    const browser = await chromium.launch({ 
        channel: "chrome",
        headless: false, 
        slowMo: 200 
    });
    
    const context = await browser.newContext();
    
    // Inject cookies
    const cookiePairs = COOKIE.split(";").map(s => s.trim()).filter(Boolean);
    const cookies = cookiePairs.map(pair => {
        const eq = pair.indexOf("=");
        return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain: HOST, path: "/" };
    });
    await context.addCookies(cookies);

    const page = await context.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });

    // Intercept all dashboard-service PUT/POST requests
    page.on("request", async req => {
        const url = req.url();
        if (!url.includes("dashboard-service")) return;
        if (req.method() !== "PUT" && req.method() !== "POST") return;
        const body = req.postData();
        console.log(`  [REQ] ${req.method()} ${url.replace(BASE, "")}`);
        captured.push({
            time: Date.now(), method: req.method(),
            url: url.replace(BASE, ""),
            requestBody: body ? (() => { try { return JSON.parse(body); } catch { return body; } })() : null,
        });
    });

    page.on("response", async res => {
        const url = res.url();
        if (!url.includes("dashboard-service")) return;
        if (res.request().method() !== "PUT" && res.request().method() !== "POST") return;
        console.log(`  [RES] ${res.status()} ${url.replace(BASE, "")}`);
        const entry = captured.findLast((c: any) => c.url === url.replace(BASE, "") && !c.responseStatus);
        if (entry) {
            entry.responseStatus = res.status();
            try { entry.responseBody = await res.json(); } catch {}
        }
    });

    // Navigate to database
    console.log("\n▶ Opening database...");
    await page.goto(`${BASE}/dashboard/${ORG_ID}/tables/databases/${DB1_ID}/dashboard/${DB1_DASH}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await sleep(4000);
    await page.screenshot({ path: path.join(ARTIFACTS, "adv-01-loaded.png") });
    console.log("  Database loaded");

    // ─── ADD SUBTABLE COLUMN ───
    console.log("\n▶ Adding Subtable column...");
    
    // Find and click the "+" button in the header
    // The "+" is typically a small button at the end of the last column header
    const addBtn = page.locator('button').filter({ hasText: /^\+$/ });
    const addBtnCount = await addBtn.count();
    console.log(`  Found ${addBtnCount} "+" buttons`);
    
    if (addBtnCount > 0) {
        // Click the last "+" button (should be the column add button)
        await addBtn.last().click();
        await sleep(1500);
        await page.screenshot({ path: path.join(ARTIFACTS, "adv-02-add-dialog.png") });
        
        // Click "Subtable"
        const subtableOption = page.locator('text="Subtable"');
        if (await subtableOption.isVisible({ timeout: 3000 })) {
            await subtableOption.click();
            await sleep(500);
            
            // Click "Continue"
            const continueBtn = page.locator('button:has-text("Continue")');
            if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await continueBtn.click();
                await sleep(500);
            }
            
            await page.screenshot({ path: path.join(ARTIFACTS, "adv-03-subtable-config.png") });

            // Type name
            const nameInput = page.locator('input[type="text"]').first();
            if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await nameInput.fill("SubItems");
            }
            
            // Click Add
            const addButton = page.locator('button:has-text("Add")');
            if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await addButton.click();
                await sleep(3000);
            }
            
            await page.screenshot({ path: path.join(ARTIFACTS, "adv-04-subtable-done.png") });
            console.log("  Subtable column added");
        } else {
            console.log("  ❌ Could not find Subtable option");
        }
    }

    // Check schema after Subtable
    const afterSubtable = await getSchema();
    const newSubCols = afterSubtable.filter((i: any) => !before.find((b: any) => b.key === i.key));
    console.log(`  New columns: ${newSubCols.length}`);
    for (const col of newSubCols) {
        console.log(`    ${col.name}: source=${JSON.stringify(col.source)} render.type=${col.render?.type}`);
        fs.writeFileSync(path.join(ARTIFACTS, `schema-subtable.json`), JSON.stringify(col, null, 2));
    }

    // ─── ADD RELATION COLUMN ───
    console.log("\n▶ Adding Relation column...");
    await addBtn.last().click().catch(() => {});
    await sleep(1500);
    
    const relationOption = page.locator('text="Relation"');
    if (await relationOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await relationOption.click();
        await sleep(500);
        
        const continueBtn = page.locator('button:has-text("Continue")');
        if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await continueBtn.click();
            await sleep(1000);
        }
        
        await page.screenshot({ path: path.join(ARTIFACTS, "adv-05-relation-config.png") });
        
        // Need to select linked database - try clicking various dropdown-like elements
        // FuseBase uses custom React select components, not native <select>
        // Look for the select-trigger within the form
        const formControls = page.locator('[class*="select"], [role="combobox"], [class*="dropdown"]');
        const fcCount = await formControls.count();
        console.log(`  Found ${fcCount} form controls`);
        
        // Try clicking each one to find the database selector
        for (let i = 0; i < Math.min(fcCount, 5); i++) {
            if (await formControls.nth(i).isVisible().catch(() => false)) {
                await formControls.nth(i).click();
                await sleep(500);
                // Look for db-link-target or link-target option
                const opt = page.locator('[role="option"], [class*="option"]').filter({ hasText: /link-target/i }).first();
                if (await opt.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await opt.click();
                    await sleep(500);
                    console.log("  Selected link-target database");
                    break;
                }
                // Try first available option
                const anyOpt = page.locator('[role="option"], [class*="option"]').first();
                if (await anyOpt.isVisible({ timeout: 500 }).catch(() => false)) {
                    await anyOpt.click();
                    await sleep(500);
                }
            }
        }
        
        await page.screenshot({ path: path.join(ARTIFACTS, "adv-06-relation-linked.png") });
        
        // Set name
        const nameInput = page.locator('input[type="text"]').first();
        if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await nameInput.fill("Related");
        }
        
        // Click Add
        const addButton = page.locator('button:has-text("Add")');
        if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await addButton.click();
            await sleep(3000);
        }
        
        await page.screenshot({ path: path.join(ARTIFACTS, "adv-07-relation-done.png") });
        console.log("  Relation column flow complete");
    }
    
    // Check schema after Relation
    const afterRelation = await getSchema();
    const newRelCols = afterRelation.filter((i: any) => !afterSubtable.find((b: any) => b.key === i.key));
    console.log(`  New columns: ${newRelCols.length}`);
    for (const col of newRelCols) {
        console.log(`    ${col.name}: source=${JSON.stringify(col.source)} render.type=${col.render?.type}`);
        fs.writeFileSync(path.join(ARTIFACTS, `schema-relation.json`), JSON.stringify(col, null, 2));
    }

    // ─── FINAL SCHEMA DUMP ───
    console.log("\n▶ Final schema dump...");
    const finalSchema = await getSchema();
    console.log(`  Total columns: ${finalSchema.length}`);
    for (const item of finalSchema) {
        console.log(`    "${item.name}" (${item.key}): source.type=${item.source?.type} custom_type=${item.source?.custom_type || "N/A"} render.type=${item.render?.type}`);
    }
    fs.writeFileSync(path.join(ARTIFACTS, "schema-full.json"), JSON.stringify(finalSchema, null, 2));

    // Save captured requests
    fs.writeFileSync(path.join(ARTIFACTS, "captured-requests.json"), JSON.stringify(captured, null, 2));
    console.log(`\n✅ Saved ${captured.length} intercepted PUT/POST requests`);
    
    console.log("\n▶ Done! Browser staying open for manual inspection. Press Ctrl+C to close.");
    // Don't close browser - keep it open so user can see the result
    await sleep(10000);
    await browser.close();
}

run().catch(e => {
    console.error("Failed:", e);
    process.exit(1);
});
