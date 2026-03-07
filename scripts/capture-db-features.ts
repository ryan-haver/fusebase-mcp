/**
 * Comprehensive Database Feature Capture
 * 
 * Uses FusebaseClient (Node.js) to create DBs + Playwright for UI interactions.
 * Intercepts ALL network requests while adding Subtable/Relation/Lookup via UI.
 * Also probes view management APIs (sort, filter, group, view types).
 * 
 * Run: npx tsx scripts/capture-db-features.ts
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

import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const ORG_ID = process.env.FUSEBASE_ORG_ID || "u268r1";
const cookieData = loadEncryptedCookie();
if (!cookieData?.cookie) throw new Error("No cookie — run auth.ts first");
const COOKIE = cookieData!.cookie;

const client = new FusebaseClient({ 
    host: HOST, orgId: ORG_ID, cookie: COOKIE 
});

const ARTIFACTS = path.resolve(__dirname, "..", "artifacts");
fs.mkdirSync(ARTIFACTS, { recursive: true });
const CAPTURE_FILE = path.join(ARTIFACTS, "db-features-capture.json");

interface CapturedReq {
    time: number;
    label: string;
    method: string;
    url: string;
    requestBody: unknown;
    responseStatus: number;
    responseBody: unknown;
}

const captured: CapturedReq[] = [];
let currentLabel = "init";
function setLabel(l: string) { currentLabel = l; console.log(`\n▶ ${l}`); }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function run() {
    // ── STEP 0: Create databases via Node.js client ──
    setLabel("create-databases");
    const cr1 = await client.createDatabase("db-feature-test");
    const dd1 = (cr1 as any).data;
    const dbId = dd1.global_id;
    const dashboardId = dd1.dashboards[0].global_id;
    const viewId = dd1.dashboards[0].views[0].global_id;
    console.log(`  DB1: id=${dbId} dash=${dashboardId} view=${viewId}`);

    const cr2 = await client.createDatabase("db-link-target");
    const dd2 = (cr2 as any).data;
    const db2Id = dd2.global_id;
    const dash2Id = dd2.dashboards[0].global_id;
    const view2Id = dd2.dashboards[0].views[0].global_id;
    console.log(`  DB2: id=${db2Id} dash=${dash2Id} view=${view2Id}`);

    // ── Launch browser ──
    const browser = await chromium.launch({ headless: false, slowMo: 150 });
    const context = await browser.newContext();

    // Inject auth cookies
    const cookiePairs = COOKIE.split(";").map(s => s.trim()).filter(Boolean);
    const cookies = cookiePairs.map(pair => {
        const eq = pair.indexOf("=");
        return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain: HOST, path: "/" };
    });
    await context.addCookies(cookies);
    
    const page = await context.newPage();

    // ── GLOBAL INTERCEPTOR ──
    page.on("request", async req => {
        const url = req.url();
        if (req.resourceType() !== "fetch" && req.resourceType() !== "xhr") return;
        if (!url.includes("dashboard-service") && !url.includes("/databases") && !url.includes("/dashboards") && !req.headers()["next-action"]) return;
        const body = req.postData();
        captured.push({
            time: Date.now(), label: currentLabel, method: req.method(),
            url: url.replace(`https://${HOST}`, ""),
            requestBody: body ? (() => { try { return JSON.parse(body); } catch { return body; } })() : null,
            responseStatus: 0, responseBody: null,
        });
    });

    page.on("response", async res => {
        const url = res.url();
        if (!url.includes("dashboard-service") && !url.includes("/databases") && !url.includes("/dashboards") && !res.request().headers()["next-action"]) return;
        const entry = captured.findLast(c => c.url === url.replace(`https://${HOST}`, "") && c.method === res.request().method() && c.responseStatus === 0);
        if (entry) {
            entry.responseStatus = res.status();
            try { entry.responseBody = await res.json(); } catch { entry.responseBody = await res.text().catch(() => null); }
        }
    });

    // ── Navigate to the test database ──
    setLabel("navigate-to-database");
    await page.goto(`https://${HOST}/dashboard/${ORG_ID}/tables/databases/${dbId}/dashboard/${dashboardId}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await sleep(3000);
    await page.screenshot({ path: path.join(ARTIFACTS, "feat-01-initial.png") });
    console.log("  Page loaded:", page.url());

    // ─────────────────────────────────────────────────
    // STEP 1: Add SUBTABLE column via UI
    // ─────────────────────────────────────────────────
    setLabel("add-subtable-column");
    // Click the "+" button at the end of the table header row
    // Try clicking visible "+" text or button  
    let addColClicked = false;
    // Method 1: Find exact "+" text button 
    const allButtons = await page.locator('button').all();
    for (const btn of allButtons) {
        const text = (await btn.textContent().catch(() => ""))?.trim();
        if (text === "+" && await btn.isVisible().catch(() => false)) {
            await btn.click();
            addColClicked = true;
            break;
        }
    }
    if (!addColClicked) {
        // Method 2: Click last visible "+" looking element
        await page.locator('[class*="add-column"], [data-testid*="add-column"]').first().click().catch(() => {});
    }
    await sleep(1500);
    await page.screenshot({ path: path.join(ARTIFACTS, "feat-02a-add-dialog.png") });

    // Select "Subtable" type — look for the text in the dialog
    const subtableBtn = page.locator('text="Subtable"').first();
    if (await subtableBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await subtableBtn.click();
        await sleep(500);
    }
    // Click Continue
    const contBtn = page.locator('button:has-text("Continue")');
    if (await contBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await contBtn.click();
        await sleep(500);
    }
    await page.screenshot({ path: path.join(ARTIFACTS, "feat-02b-subtable-config.png") });

    // Set name
    const nameInputs = page.locator('input[type="text"]');
    const nameInput = nameInputs.first();
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.click();
        await nameInput.fill("SubItems");
    }
    await sleep(300);

    // Click "Add" to create
    const addBtn = page.locator('button:has-text("Add")').last();
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addBtn.click();
        await sleep(2000);
    }
    await page.screenshot({ path: path.join(ARTIFACTS, "feat-02c-subtable-added.png") });

    // ─────────────────────────────────────────────────
    // STEP 2: Add RELATION column via UI
    // ─────────────────────────────────────────────────
    setLabel("add-relation-column");
    // Re-click "+" to add another column
    addColClicked = false;
    const allButtons2 = await page.locator('button').all();
    for (const btn of allButtons2) {
        const text = (await btn.textContent().catch(() => ""))?.trim();
        if (text === "+" && await btn.isVisible().catch(() => false)) {
            await btn.click();
            addColClicked = true;
            break;
        }
    }
    await sleep(1500);

    // Select "Relation"
    const relationBtn = page.locator('text="Relation"').first();
    if (await relationBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await relationBtn.click();
        await sleep(500);
    }
    // Continue
    if (await contBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await contBtn.click();
        await sleep(1000);
    }
    await page.screenshot({ path: path.join(ARTIFACTS, "feat-03a-relation-config.png") });

    // Select linked database — click on "Linked database" dropdown
    // Look for dropdown/select elements
    const dropdowns = page.locator('[class*="select"], [class*="dropdown"], [role="listbox"], [role="combobox"]');
    const dropdownCount = await dropdowns.count();
    console.log(`  Found ${dropdownCount} dropdowns in relation config`);
    
    // Try clicking the first dropdown to select the linked DB  
    for (let i = 0; i < dropdownCount; i++) {
        if (await dropdowns.nth(i).isVisible().catch(() => false)) {
            await dropdowns.nth(i).click();
            await sleep(500);
            // Select the db-link-target option
            const opt = page.locator(`text="db-link-target"`).first();
            if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
                await opt.click();
                await sleep(500);
                break;
            }
            // Or select first available option
            const anyOpt = page.locator('[role="option"], [class*="option"]').first();
            if (await anyOpt.isVisible({ timeout: 1000 }).catch(() => false)) {
                await anyOpt.click();
                await sleep(500);
            }
        }
    }
    await page.screenshot({ path: path.join(ARTIFACTS, "feat-03b-relation-linked.png") });

    // Set name
    const relNameInput = page.locator('input[type="text"]').first();
    if (await relNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await relNameInput.click();
        await relNameInput.fill("Related");
    }
    
    // Click Add
    const relAddBtn = page.locator('button:has-text("Add")').last();
    if (await relAddBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await relAddBtn.click();
        await sleep(2000);
    }
    await page.screenshot({ path: path.join(ARTIFACTS, "feat-03c-relation-added.png") });

    // ─────────────────────────────────────────────────
    // STEP 3: Add LOOKUP column via UI  
    // ─────────────────────────────────────────────────
    setLabel("add-lookup-column");
    addColClicked = false;
    const allButtons3 = await page.locator('button').all();
    for (const btn of allButtons3) {
        const text = (await btn.textContent().catch(() => ""))?.trim();
        if (text === "+" && await btn.isVisible().catch(() => false)) {
            await btn.click();
            addColClicked = true;
            break;
        }
    }
    await sleep(1500);

    const lookupBtn = page.locator('text="Lookup"').first();
    if (await lookupBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await lookupBtn.click();
        await sleep(500);
    }
    if (await contBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await contBtn.click();
        await sleep(1000);
    }
    await page.screenshot({ path: path.join(ARTIFACTS, "feat-04a-lookup-config.png") });
    // Try to select the Relation source and a field
    const lookupDropdowns = page.locator('[class*="select"], [class*="dropdown"]');
    for (let i = 0; i < await lookupDropdowns.count(); i++) {
        if (await lookupDropdowns.nth(i).isVisible().catch(() => false)) {
            await lookupDropdowns.nth(i).click();
            await sleep(300);
            const firstOpt = page.locator('[role="option"], [class*="option"]').first();
            if (await firstOpt.isVisible({ timeout: 1000 }).catch(() => false)) {
                await firstOpt.click();
                await sleep(300);
            }
        }
    }
    await page.screenshot({ path: path.join(ARTIFACTS, "feat-04b-lookup-source.png") });
    
    const lookNameInput = page.locator('input[type="text"]').first();
    if (await lookNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await lookNameInput.click();
        await lookNameInput.fill("LookupField");
    }
    const lookAddBtn = page.locator('button:has-text("Add")').last();
    if (await lookAddBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await lookAddBtn.click();
        await sleep(2000);
    }
    await page.screenshot({ path: path.join(ARTIFACTS, "feat-04c-lookup-added.png") });

    // ─────────────────────────────────────────────────
    // STEP 4: Capture schema snapshot  
    // ─────────────────────────────────────────────────
    setLabel("get-schema-after-columns");
    const BASE = `https://${HOST}`;
    const schemaRes = await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`, { headers: { cookie: COOKIE } });
    const schemaData = await schemaRes.json() as any;
    
    captured.push({
        time: Date.now(), label: "schema-snapshot", method: "GET",
        url: `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
        requestBody: null, responseStatus: 200, responseBody: schemaData,
    });

    const items = schemaData?.data?.schema?.items || [];
    console.log(`\n  Schema has ${items.length} columns:`);
    for (const item of items) {
        console.log(`    "${item.name}": source=${JSON.stringify(item.source)} render.type=${item.render?.type}`);
    }

    // ─────────────────────────────────────────────────
    // STEP 5: Probe view management APIs (sort, filter, group, view types)
    // ─────────────────────────────────────────────────
    
    // 5a: View representations
    setLabel("probe-view-representations");
    for (const rep of ["table", "board", "calendar", "timeline", "gallery", "kanban", "list", "grid"]) {
        const r = await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`, {
            method: "PUT",
            headers: { cookie: COOKIE, "content-type": "application/json" },
            body: JSON.stringify({ representation: rep }),
        });
        const body = await r.json().catch(() => null);
        const ok = r.status >= 200 && r.status < 300;
        console.log(`  representation="${rep}": ${ok ? "OK" : "NO"} ${r.status} ${ok ? "" : JSON.stringify(body).substring(0, 100)}`);
        captured.push({ time: Date.now(), label: `view-rep-${rep}`, method: "PUT", url: "view", requestBody: { representation: rep }, responseStatus: r.status, responseBody: body });
    }
    // Reset to table
    await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`, {
        method: "PUT", headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify({ representation: "table" }),
    });

    // 5b: Create a new view
    setLabel("probe-create-view");
    const newViewRes = await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views`, {
        method: "POST",
        headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify({ name: "Board View", representation: "board" }),
    });
    const newViewData = await newViewRes.json().catch(() => null);
    console.log(`  Create view: ${newViewRes.status} ${JSON.stringify(newViewData).substring(0, 200)}`);
    captured.push({ time: Date.now(), label: "create-view", method: "POST", url: `/dashboards/${dashboardId}/views`, requestBody: { name: "Board View", representation: "board" }, responseStatus: newViewRes.status, responseBody: newViewData });

    // 5c: Sort
    setLabel("probe-sort");
    // Get a column key to sort by
    const nameColKey = items.find((i: any) => i.name === "Name")?.key;
    if (nameColKey) {
        const sortPayload = { sort: { items: [{ key: nameColKey, direction: "asc" }] } };
        const sortRes = await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`, {
            method: "PUT", headers: { cookie: COOKIE, "content-type": "application/json" },
            body: JSON.stringify(sortPayload),
        });
        const sortBody = await sortRes.json().catch(() => null);
        console.log(`  Sort by Name (${nameColKey}): ${sortRes.status} ${JSON.stringify(sortBody).substring(0, 200)}`);
        captured.push({ time: Date.now(), label: "sort", method: "PUT", url: "view", requestBody: sortPayload, responseStatus: sortRes.status, responseBody: sortBody });
    }

    // 5d: Filter
    setLabel("probe-filter");
    if (nameColKey) {
        const filterPayload = { filter: { operator: "and", items: [{ key: nameColKey, condition: "is_not_empty" }] } };
        const filterRes = await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`, {
            method: "PUT", headers: { cookie: COOKIE, "content-type": "application/json" },
            body: JSON.stringify(filterPayload),
        });
        const filterBody = await filterRes.json().catch(() => null);
        console.log(`  Filter (is_not_empty): ${filterRes.status} ${JSON.stringify(filterBody).substring(0, 200)}`);
        captured.push({ time: Date.now(), label: "filter", method: "PUT", url: "view", requestBody: filterPayload, responseStatus: filterRes.status, responseBody: filterBody });
    }

    // 5e: Group  
    setLabel("probe-group");
    const statusColKey = items.find((i: any) => i.name === "Status")?.key;
    if (statusColKey) {
        const groupPayload = { group: { items: [{ key: statusColKey }] } };
        const groupRes = await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`, {
            method: "PUT", headers: { cookie: COOKIE, "content-type": "application/json" },
            body: JSON.stringify(groupPayload),
        });
        const groupBody = await groupRes.json().catch(() => null);
        console.log(`  Group by Status (${statusColKey}): ${groupRes.status} ${JSON.stringify(groupBody).substring(0, 200)}`);
        captured.push({ time: Date.now(), label: "group", method: "PUT", url: "view", requestBody: groupPayload, responseStatus: groupRes.status, responseBody: groupBody });
    }

    // Clear all config
    await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`, {
        method: "PUT", headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify({ filter: null, sort: null, group: null }),
    });

    // 5f: Column visibility (hide/show)
    setLabel("probe-column-visibility");
    if (items.length > 1) {
        const hideItem = items[1];
        const modified = items.map((item: any, i: number) => i === 1 ? { ...item, hidden: true } : item);
        const hideRes = await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`, {
            method: "PUT", headers: { cookie: COOKIE, "content-type": "application/json" },
            body: JSON.stringify({ schema: { ...schemaData.data.schema, items: modified } }),
        });
        console.log(`  Hide "${hideItem.name}": ${hideRes.status}`);
        captured.push({ time: Date.now(), label: "hide-column", method: "PUT", url: "view-schema", requestBody: { action: "hide", column: hideItem.name }, responseStatus: hideRes.status, responseBody: await hideRes.json().catch(() => null) });
        // Unhide
        await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`, {
            method: "PUT", headers: { cookie: COOKIE, "content-type": "application/json" },
            body: JSON.stringify({ schema: schemaData.data.schema }),
        });
    }

    // ─────────────────────────────────────────────────
    // STEP 6: Take final screenshot
    // ─────────────────────────────────────────────────
    setLabel("final-screenshot");
    await page.reload();
    await sleep(2000);
    await page.screenshot({ path: path.join(ARTIFACTS, "feat-99-final.png"), fullPage: true });

    // ─────────────────────────────────────────────────
    // STEP 7: Cleanup
    // ─────────────────────────────────────────────────
    setLabel("cleanup");
    for (const id of [dbId, db2Id]) {
        await client.deleteDatabase(id);
        console.log(`  Deleted ${id}`);
    }

    // ── Save captured data ──
    fs.writeFileSync(CAPTURE_FILE, JSON.stringify(captured, null, 2));
    console.log(`\n✅ Saved ${captured.length} captured requests to ${CAPTURE_FILE}`);

    await browser.close();
}

run().catch(e => {
    console.error("Script failed:", e);
    process.exit(1);
});
