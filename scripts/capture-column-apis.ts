/**
 * Step 1: Playwright Column API Capture
 *
 * Creates a fresh FuseBase database, then:
 * 1. Intercepts ALL dashboard-service PUT/POST/GET requests
 * 2. Adds each of the 13 column types via UI
 * 3. Writes a value to each writable column type
 * 4. Reads back the schema and row data
 * 5. Deletes a column
 *
 * All captured request/response pairs are saved to:
 *   artifacts/column-api-capture.json
 */

// Run with: npx playwright test scripts/capture-column-apis.ts
// OR: node -e "require('./scripts/capture-column-apis')"
// Best: npx tsx scripts/capture-column-apis.ts

// This is a standalone Playwright script (not a test file)
import { chromium, type BrowserContext, type Page } from "playwright";
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
if (!cookieData?.cookie) throw new Error("No cookie — run auth.ts first");

const CAPTURE_FILE = path.resolve(__dirname, "..", "artifacts", "column-api-capture.json");
fs.mkdirSync(path.dirname(CAPTURE_FILE), { recursive: true });

interface CapturedRequest {
    time: number;
    method: string;
    url: string;
    requestBody: unknown;
    responseStatus: number;
    responseBody: unknown;
    label?: string;
}

const captured: CapturedRequest[] = [];
let currentLabel = "init";

function setLabel(label: string) {
    currentLabel = label;
    console.log(`\n▶ ${label}`);
}

async function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

async function captureApiCall(page: Page, fn: () => Promise<void>, label?: string): Promise<void> {
    if (label) setLabel(label);
    await fn();
    await sleep(1500); // wait for API call to complete
}

async function run() {
    const browser = await chromium.launch({ headless: false, slowMo: 100 });
    const context = await browser.newContext({
        storageState: undefined,
    });

    // Inject cookie
    const cookieStr = cookieData!.cookie;
    const cookiePairs = cookieStr.split(";").map(s => s.trim()).filter(Boolean);
    const cookies = cookiePairs.map(pair => {
        const eq = pair.indexOf("=");
        return {
            name: pair.slice(0, eq).trim(),
            value: pair.slice(eq + 1).trim(),
            domain: HOST,
            path: "/",
        };
    });
    await context.addCookies(cookies);

    const page = await context.newPage();

    // Install request interceptor
    page.on("request", async (req) => {
        const url = req.url();
        if (!url.includes("dashboard-service") && !url.includes("/databases") && !url.includes("/dashboards")) return;
        if (req.method() === "GET" && !url.includes("/data") && !url.includes("/schema")) return;
        const body = req.postData();
        const entry: CapturedRequest = {
            time: Date.now(),
            method: req.method(),
            url,
            requestBody: body ? (() => { try { return JSON.parse(body); } catch { return body; } })() : null,
            responseStatus: 0,
            responseBody: null,
            label: currentLabel,
        };
        captured.push(entry);
    });

    page.on("response", async (res) => {
        const url = res.url();
        if (!url.includes("dashboard-service") && !url.includes("/databases") && !url.includes("/dashboards")) return;
        const req = captured.findLast(c => c.url === url && c.method === res.request().method());
        if (req) {
            req.responseStatus = res.status();
            try {
                req.responseBody = await res.json();
            } catch {
                req.responseBody = await res.text().catch(() => null);
            }
        }
    });

    // ── Navigate to databases ──
    setLabel("navigate-to-databases");
    await page.goto(`https://${HOST}/dashboard/${ORG_ID}/tables/databases`);
    await sleep(3000);

    // ── Create a fresh test database ──
    setLabel("create-database");
    // Click "+ Add" or "Create Database" button
    const createBtn = page.locator('button:has-text("Add"), button:has-text("Create"), [data-testid="create-database"]').first();
    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await createBtn.click();
        await sleep(1000);
    } else {
        // Try clicking the + icon in the sidebar or top menu
        await page.locator('button:has-text("+")').first().click().catch(() => { });
        await sleep(1000);
    }

    // Screenshot to see current state
    await page.screenshot({ path: path.resolve(__dirname, "..", "artifacts", "step1-after-create-click.png") });
    console.log("  Screenshot saved: step1-after-create-click.png");

    // ── Read current URL and state ──
    console.log("  Current URL:", page.url());
    await sleep(2000);

    // ── Try REST API to create database instead (more reliable) ──
    // Let the browser navigate to the databases page and we'll use fetch from within
    setLabel("create-database-via-js");
    const createResult = await page.evaluate(async ({ host, orgId }: { host: string; orgId: string }) => {
        const res = await fetch(`/v4/api/proxy/dashboard-service/v1/databases`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                name: "column-type-test",
                scope_type: "org",
                scope_id: orgId,
            }),
        });
        return { status: res.status, body: await res.json().catch(() => null) };
    }, { host: HOST, orgId: ORG_ID });
    console.log("  Create DB response:", JSON.stringify(createResult).substring(0, 300));

    const dbId = createResult.body?.data?.global_id;
    const dashboardId = createResult.body?.data?.dashboards?.[0]?.global_id;
    const viewId = createResult.body?.data?.dashboards?.[0]?.views?.[0]?.global_id;

    if (!dbId) {
        console.error("  ❌ Failed to create database");
        await browser.close();
        return;
    }
    console.log(`  DB: ${dbId}, Dashboard: ${dashboardId}, View: ${viewId}`);

    // ── Navigate to the new database ──
    setLabel("navigate-to-new-database");
    await page.goto(`https://${HOST}/dashboard/${ORG_ID}/tables/databases/${dbId}/dashboard/${dashboardId}`);
    await sleep(3000);
    await page.screenshot({ path: path.resolve(__dirname, "..", "artifacts", "step1-database-view.png") });

    // ── Capture GET schema via dashboard-service ──
    setLabel("get-schema-initial");
    const schemaResult = await page.evaluate(async ({ dashboardId, viewId }: { dashboardId: string; viewId: string }) => {
        // Try fetching the dashboard detail to get schema
        const r1 = await fetch(`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}`);
        const d1 = await r1.json().catch(() => null);
        // Try fetching the view data
        const r2 = await fetch(`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/data?limit=1`);
        const d2 = await r2.json().catch(() => null);
        // Try fetching the view schema endpoint
        const r3 = await fetch(`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/schema`).catch(() => null);
        const d3 = r3 ? await r3.json().catch(() => null) : null;
        // Try the columns endpoint
        const r4 = await fetch(`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/columns`).catch(() => null);
        const d4 = r4 ? await r4.json().catch(() => null) : null;
        return { dashboard: d1, viewData: d2, viewSchema: d3, columns: d4 };
    }, { dashboardId, viewId });

    captured.push({
        time: Date.now(),
        method: "GET",
        url: `SCHEMA-PROBE:${dashboardId}`,
        requestBody: null,
        responseStatus: 200,
        responseBody: schemaResult,
        label: "get-schema-initial",
    });
    console.log("  Schema probe result keys:", Object.keys(schemaResult));
    console.log("  Dashboard detail keys:", JSON.stringify(Object.keys(schemaResult.dashboard?.data ?? {})).substring(0, 200));

    // ── Add a row via server action ──
    setLabel("add-row");
    const addRowResult = await page.evaluate(async ({ orgId, dbId, dashboardId, host }: any) => {
        const entityUrl = `/dashboard/${orgId}/tables/databases/${dbId}/dashboard/${dashboardId}/entity/custom`;
        const res = await fetch(entityUrl, {
            method: "POST",
            headers: {
                "content-type": "text/plain;charset=UTF-8",
                accept: "text/x-component",
                "next-action": "a6bff18e5522fbea54d7a97bf0a4f0979a1771ce",
            },
            body: JSON.stringify([{ orgId, entity: "custom", databaseId: dbId, dashboardId }]),
        });
        return { status: res.status };
    }, { orgId: ORG_ID, dbId, dashboardId, host: HOST });
    console.log("  Add row:", addRowResult);
    await sleep(1500);

    // ── Read row data to get rowUuid ──
    setLabel("get-row-uuid");
    const rowData = await page.evaluate(async ({ dashboardId, viewId }: any) => {
        const res = await fetch(`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/data?limit=5`);
        return res.json();
    }, { dashboardId, viewId });
    const rowUuid = rowData?.data?.[0]?.root_index_value;
    const existingColumnKeys = rowData?.data?.[0] ? Object.keys(rowData.data[0]).filter((k: string) => k !== "root_index_value") : [];
    console.log(`  Row UUID: ${rowUuid}`);
    console.log(`  Existing column keys: ${existingColumnKeys.join(", ")}`);
    captured.push({
        time: Date.now(),
        method: "GET",
        url: `ROW-DATA:${dashboardId}/${viewId}`,
        requestBody: null,
        responseStatus: 200,
        responseBody: rowData,
        label: "get-row-uuid",
    });

    // ── Write to default text column (Name) — key = first string-valued column key ──
    if (rowUuid && existingColumnKeys.length > 0) {
        setLabel("write-text-column");
        const nameKey = existingColumnKeys[0];
        const writeText = await page.evaluate(async ({ dashboardId, viewId, rowUuid, key }: any) => {
            const res = await fetch(`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/data`, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    root_index_key: "rowUuid",
                    root_index_value: rowUuid,
                    item_key: key,
                    data: { value: "Test Text Value" },
                }),
            });
            return { status: res.status, body: await res.json().catch(() => null) };
        }, { dashboardId, viewId, rowUuid, key: nameKey });
        console.log(`  Write text (${nameKey}):`, JSON.stringify(writeText).substring(0, 200));
        captured.push({
            time: Date.now(),
            method: "PUT",
            url: `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/data`,
            requestBody: { root_index_key: "rowUuid", root_index_value: rowUuid, item_key: nameKey, data: { value: "Test Text Value" } },
            responseStatus: writeText.status,
            responseBody: writeText.body,
            label: "write-text-column",
        });
    }

    // ── Try adding columns via UI and API ──
    setLabel("probe-add-column-api");
    // Try common add-column endpoints
    const addColProbes = await page.evaluate(async ({ dashboardId, viewId }: any) => {
        const results: any[] = [];
        // Probe: POST /columns
        const r1 = await fetch(`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/columns`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "Test Number", type: "number" }),
        });
        results.push({ probe: "POST /columns", status: r1.status, body: await r1.json().catch(() => null) });

        // Probe: POST /views/{viewId}/columns
        const r2 = await fetch(`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/columns`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "Test Number", type: "number" }),
        });
        results.push({ probe: "POST /views/columns", status: r2.status, body: await r2.json().catch(() => null) });

        // Probe: POST /views/{viewId}/schema
        const r3 = await fetch(`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/schema`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "Test Number", type: "number" }),
        });
        results.push({ probe: "POST /views/schema", status: r3.status, body: await r3.json().catch(() => null) });

        return results;
    }, { dashboardId, viewId });
    console.log("  Add column API probes:");
    for (const probe of addColProbes) {
        console.log(`    ${probe.probe}: status=${probe.status}, body=${JSON.stringify(probe.body).substring(0, 100)}`);
    }
    captured.push({ time: Date.now(), method: "PROBE", url: "add-column-api", requestBody: null, responseStatus: 0, responseBody: addColProbes, label: "probe-add-column-api" });

    // ── Navigate to database UI and capture Add Column click ──
    setLabel("ui-add-number-column");
    await page.reload();
    await sleep(3000);

    // Look for "+" column header button to add a column
    const addColBtn = page.locator(
        'button[title*="column"], button[aria-label*="column"], th button, [data-testid="add-column-btn"], button:has-text("+")'
    ).last();
    if (await addColBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addColBtn.click();
        await sleep(1000);
        await page.screenshot({ path: path.resolve(__dirname, "..", "artifacts", "step1-add-column-menu.png") });
    }

    // ── Screenshot final state ──
    await page.screenshot({ path: path.resolve(__dirname, "..", "artifacts", "step1-final-state.png") });

    // ── Probe: get dashboard detail more deeply ──
    setLabel("probe-dashboard-detail-deep");
    const deepDetail = await page.evaluate(async ({ dashboardId }: any) => {
        const r = await fetch(`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}`);
        const d = await r.json();
        return d;
    }, { dashboardId });
    console.log("  Dashboard detail top-level keys:", JSON.stringify(Object.keys(deepDetail?.data ?? deepDetail ?? {})));
    // Look for schema/columns/root_schema
    const rootSchema = deepDetail?.data?.root_schema ?? deepDetail?.data?.schema ?? deepDetail?.data?.columns ?? deepDetail?.data?.fields;
    console.log("  root_schema type:", typeof rootSchema, Array.isArray(rootSchema) ? `array len=${rootSchema.length}` : "");
    if (rootSchema && Array.isArray(rootSchema)) {
        console.log("  Schema sample:", JSON.stringify(rootSchema.slice(0, 2)));
    }
    captured.push({ time: Date.now(), method: "GET", url: `dashboard-deep:${dashboardId}`, requestBody: null, responseStatus: 200, responseBody: deepDetail, label: "probe-dashboard-detail-deep" });

    // ── Cleanup: delete the test database ──
    setLabel("delete-test-database");
    const deleteResult = await page.evaluate(async ({ dbId }: any) => {
        const res = await fetch(`/v4/api/proxy/dashboard-service/v1/databases/${dbId}`, { method: "DELETE" });
        return { status: res.status };
    }, { dbId });
    console.log("  Delete DB:", deleteResult);

    // ── Save captured data ──
    fs.writeFileSync(CAPTURE_FILE, JSON.stringify(captured, null, 2));
    console.log(`\n✅ Saved ${captured.length} captured requests to ${CAPTURE_FILE}`);

    await browser.close();
}

run().catch(e => {
    console.error("Script failed:", e);
    process.exit(1);
});
