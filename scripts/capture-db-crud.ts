#!/usr/bin/env npx tsx

/**
 * Comprehensive Playwright capture for ALL database CRUD operations.
 * 
 * Lifecycle:
 * 1. Navigate to databases page
 * 2. Create a new database (captured from previous run)
 * 3. Navigate INTO the new database  
 * 4. Add a column (click "+" or column header)
 * 5. Edit a cell value
 * 6. Add a kanban view
 * 7. Switch between table/kanban representations
 * 8. Delete a row
 * 9. Rename the database
 * 10. Delete the database
 * 
 * All API calls (especially POST/PUT/PATCH/DELETE) are captured with full
 * request bodies, headers, and responses — then saved to data/db-crud-capture.json
 * 
 * Usage:
 *   npx tsx scripts/capture-db-crud.ts
 */

import { chromium, type Page, type BrowserContext } from "playwright";
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
const userDataDir = path.resolve(__dirname, "..", ".browser-data");

interface CapturedRequest {
    step: string;
    url: string;
    method: string;
    status: number;
    contentType: string;
    requestBody: string;
    requestHeaders: Record<string, string>;
    responseBody: string;
    responseSize: number;
    timestamp: number;
}

const captured: CapturedRequest[] = [];
let currentStep = "init";

function setupCapture(page: Page) {
    page.on("response", async (response) => {
        const url = response.url();
        const method = response.request().method();
        const isWriteOp = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
        const isApiCall =
            url.includes("/api/") ||
            url.includes("/proxy/") ||
            url.includes("/dashboard-service/") ||
            url.includes("/dashboards") ||
            url.includes("/views/") ||
            url.includes("/items") ||
            url.includes("/columns") ||
            url.includes("/databases") ||
            url.includes("/representations");

        if (isApiCall || isWriteOp) {
            let responseBody = "";
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
                responseBody = body.toString("utf-8").slice(0, 2000);
            } catch {
                responseBody = "[could not read body]";
            }

            const entry: CapturedRequest = {
                step: currentStep,
                url,
                method,
                status: response.status(),
                contentType: response.headers()["content-type"] || "",
                requestBody: requestBody.slice(0, 2000),
                requestHeaders,
                responseBody,
                responseSize,
                timestamp: Date.now(),
            };
            captured.push(entry);

            const baseUrl = `https://${HOST}`;
            const shortUrl = url.replace(baseUrl, "");
            const marker = isWriteOp ? " ⚡" : "";
            console.error(`  [${currentStep}] ${method} ${response.status()} ${shortUrl}${marker}`);
            if (isWriteOp && requestBody) {
                console.error(`    Body: ${requestBody.slice(0, 150)}`);
            }
        }
    });
}

async function waitForApi(page: Page, ms = 3000) {
    await page.waitForTimeout(ms);
}

async function listButtons(page: Page, label: string) {
    console.error(`\n  [${label}] Listing visible buttons...`);
    const buttons = await page.locator("button:visible").all();
    for (let i = 0; i < buttons.length && i < 30; i++) {
        try {
            const text = (await buttons[i].textContent())?.trim().slice(0, 50) || "";
            const cls = (await buttons[i].getAttribute("class"))?.slice(0, 60) || "";
            const testId = await buttons[i].getAttribute("data-testid") || "";
            if (text || testId) {
                console.error(`    [${i}] "${text}" cls="${cls}" tid="${testId}"`);
            }
        } catch { /* skip */ }
    }
}

async function listInputs(page: Page, label: string) {
    console.error(`\n  [${label}] Listing visible inputs...`);
    const inputs = await page.locator("input:visible, textarea:visible, select:visible").all();
    for (let i = 0; i < inputs.length && i < 15; i++) {
        try {
            const ph = await inputs[i].getAttribute("placeholder") || "";
            const name = await inputs[i].getAttribute("name") || "";
            const type = await inputs[i].getAttribute("type") || "text";
            const value = await inputs[i].inputValue().catch(() => "");
            console.error(`    [${i}] type="${type}" name="${name}" ph="${ph}" val="${value.slice(0, 30)}"`);
        } catch { /* skip */ }
    }
}

async function main() {
    const baseUrl = `https://${HOST}`;

    console.error(`[capture-crud] Launching browser...`);
    console.error(`[capture-crud] Host: ${HOST}, OrgId: ${ORG_ID}`);

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: ["--disable-blink-features=AutomationControlled"],
        viewport: { width: 1400, height: 900 },
    });

    try {
        const page = context.pages()[0] || (await context.newPage());
        setupCapture(page);

        // ============================================================
        // STEP 1: Navigate to databases page
        // ============================================================
        currentStep = "1-navigate-databases";
        console.error(`\n=== Step 1: Navigate to databases ===`);
        await page.goto(`${baseUrl}/dashboard/${ORG_ID}/tables/databases`, {
            waitUntil: "domcontentloaded",
        });
        await waitForApi(page, 5000);

        // ============================================================
        // STEP 2: Create a test database using the API directly
        // ============================================================
        currentStep = "2-create-database";
        console.error(`\n=== Step 2: Create test database via API ===`);
        // We already know this endpoint works — use fetch directly
        const cookies = await context.cookies();
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");

        const dbId = crypto.randomUUID();
        const createRes = await page.evaluate(async ({ dbId, orgId }) => {
            const res = await fetch("/v4/api/proxy/dashboard-service/v1/databases", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    global_id: dbId,
                    title: "e2e-crud-test",
                    is_public: false,
                    metadata: { description: "CRUD capture test", icon: "default", favorite: false, color: "green" },
                    scopes: [{ scope_type: "org", scope_id: orgId }],
                }),
            });
            return { status: res.status, body: await res.text() };
        }, { dbId, orgId: ORG_ID });

        console.error(`  Create DB: ${createRes.status}`);
        console.error(`  Response: ${createRes.body.slice(0, 300)}`);

        // Parse response to get dashboard/view IDs
        let dbData: any;
        try { dbData = JSON.parse(createRes.body); } catch { dbData = {}; }
        const dashboardId = dbData?.data?.dashboards?.[0]?.global_id;
        const viewId = dbData?.data?.dashboards?.[0]?.views?.[0]?.global_id;
        console.error(`  DB ID: ${dbId}, Dashboard: ${dashboardId}, View: ${viewId}`);

        if (!dashboardId) {
            console.error("  ⚠ No dashboardId found — cannot continue with CRUD tests");
            // Still capture what we can
        }

        // ============================================================
        // STEP 3: Navigate INTO the test database
        // ============================================================
        currentStep = "3-navigate-into-db";
        console.error(`\n=== Step 3: Navigate into test database ===`);
        if (dashboardId) {
            await page.goto(
                `${baseUrl}/dashboard/${ORG_ID}/tables/databases/${dbId}/dashboard/${dashboardId}/entity/custom`,
                { waitUntil: "domcontentloaded" }
            );
            await waitForApi(page, 5000);
            await listButtons(page, "db-page");
        }

        // ============================================================
        // STEP 4: Try to get database detail via API
        // ============================================================
        currentStep = "4-get-database-detail";
        console.error(`\n=== Step 4: Get database detail ===`);
        const detailRes = await page.evaluate(async (dbId) => {
            const res = await fetch(`/v4/api/proxy/dashboard-service/v1/databases/${dbId}`);
            return { status: res.status, body: await res.text() };
        }, dbId);
        console.error(`  GET /databases/${dbId}: ${detailRes.status}`);
        console.error(`  Response: ${detailRes.body.slice(0, 500)}`);

        // ============================================================
        // STEP 5: Try to list views for the dashboard
        // ============================================================
        currentStep = "5-list-views";
        console.error(`\n=== Step 5: List views ===`);
        if (dashboardId) {
            const viewsRes = await page.evaluate(async (dashId) => {
                const res = await fetch(`/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views`);
                return { status: res.status, body: await res.text() };
            }, dashboardId);
            console.error(`  GET /dashboards/${dashboardId}/views: ${viewsRes.status}`);
            console.error(`  Response: ${viewsRes.body.slice(0, 500)}`);
        }

        // ============================================================
        // STEP 6: Try to get dashboard columns/schema
        // ============================================================
        currentStep = "6-get-columns";
        console.error(`\n=== Step 6: Get dashboard columns/schema ===`);
        if (dashboardId) {
            // Try various column endpoints
            for (const suffix of ["columns", "schema", "fields", "config"]) {
                const colRes = await page.evaluate(async ({ dashId, suffix }) => {
                    const res = await fetch(`/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/${suffix}`);
                    return { status: res.status, body: await res.text() };
                }, { dashId: dashboardId, suffix });
                console.error(`  GET /dashboards/${dashboardId}/${suffix}: ${colRes.status}`);
                if (colRes.status === 200) {
                    console.error(`  Response: ${colRes.body.slice(0, 300)}`);
                }
            }

            // Also try getting the dashboard itself
            const dashRes = await page.evaluate(async (dashId) => {
                const res = await fetch(`/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}`);
                return { status: res.status, body: await res.text() };
            }, dashboardId);
            console.error(`  GET /dashboards/${dashboardId}: ${dashRes.status}`);
            console.error(`  Response: ${dashRes.body.slice(0, 500)}`);
        }

        // ============================================================
        // STEP 7: Try to add a column via API
        // ============================================================
        currentStep = "7-add-column";
        console.error(`\n=== Step 7: Add column ===`);
        if (dashboardId) {
            // Try POST to columns endpoint
            const colPayloads = [
                { endpoint: `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/columns`, body: { name: "test-col", type: "text" } },
                { endpoint: `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/columns`, body: { name: "test-col", type: "text" } },
                { endpoint: `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/fields`, body: { name: "test-col", type: "text" } },
            ];
            for (const { endpoint, body } of colPayloads) {
                const res = await page.evaluate(async ({ endpoint, body }) => {
                    const r = await fetch(endpoint, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify(body),
                    });
                    return { status: r.status, body: await r.text() };
                }, { endpoint, body });
                console.error(`  POST ${endpoint.replace(`/v4/api/proxy/dashboard-service/v1`, "")}: ${res.status}`);
                if (res.status < 404) console.error(`  Response: ${res.body.slice(0, 300)}`);
            }
        }

        // ============================================================
        // STEP 8: Click "+" button on the UI to add a column (capture what the UI does)
        // ============================================================
        currentStep = "8-ui-add-column";
        console.error(`\n=== Step 8: UI — add column via button click ===`);
        if (dashboardId) {
            // Look for the "+" or "Add column" button
            const addColSelectors = [
                'button:has-text("+")',
                '[data-testid*="add-column"]',
                '[data-testid*="column"]',
                '[class*="add-column"]',
                '[class*="AddColumn"]',
                'th button',
                'th:last-child',
            ];
            let addColBtn = null;
            for (const sel of addColSelectors) {
                try {
                    const loc = page.locator(sel).first();
                    if (await loc.isVisible({ timeout: 1000 })) {
                        const text = (await loc.textContent())?.trim().slice(0, 30) || "";
                        console.error(`    Found: "${text}" (${sel})`);
                        addColBtn = loc;
                        break;
                    }
                } catch { /* continue */ }
            }

            if (addColBtn) {
                const beforeCount = captured.length;
                await addColBtn.click();
                await waitForApi(page, 3000);
                console.error(`    ${captured.length - beforeCount} new API calls after add-column click`);

                // Check for a modal/dialog
                await listInputs(page, "add-column-dialog");
                await listButtons(page, "add-column-dialog");
            } else {
                console.error("    No add-column button found");
            }
        }

        // ============================================================
        // STEP 9: Try to update a database (rename, change metadata)
        // ============================================================
        currentStep = "9-update-database";
        console.error(`\n=== Step 9: Update database ===`);
        // Try PATCH and PUT
        for (const method of ["PATCH", "PUT"]) {
            const res = await page.evaluate(async ({ dbId, method }) => {
                const r = await fetch(`/v4/api/proxy/dashboard-service/v1/databases/${dbId}`, {
                    method,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ title: "e2e-crud-renamed", metadata: { description: "renamed", color: "blue" } }),
                });
                return { status: r.status, body: await r.text() };
            }, { dbId, method });
            console.error(`  ${method} /databases/${dbId}: ${res.status}`);
            if (res.status < 500) console.error(`  Response: ${res.body.slice(0, 300)}`);
        }

        // ============================================================
        // STEP 10: Try to add a row via items API (probe various paths)
        // ============================================================
        currentStep = "10-add-row-api";
        console.error(`\n=== Step 10: Add row via API ===`);
        if (dashboardId && viewId) {
            const rowPayloads = [
                `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/items`,
                `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/items`,
                `/v4/api/proxy/dashboard-service/v1/views/${viewId}/items`,
            ];
            for (const endpoint of rowPayloads) {
                const res = await page.evaluate(async ({ endpoint }) => {
                    const r = await fetch(endpoint, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({}),
                    });
                    return { status: r.status, body: await r.text() };
                }, { endpoint });
                const short = endpoint.replace("/v4/api/proxy/dashboard-service/v1", "");
                console.error(`  POST ${short}: ${res.status}`);
                if (res.status < 500) console.error(`  Response: ${res.body.slice(0, 300)}`);
            }
        }

        // ============================================================
        // STEP 11: Try to update a row (if data exists)
        // ============================================================
        currentStep = "11-update-row";
        console.error(`\n=== Step 11: Update row ===`);
        if (dashboardId && viewId) {
            // First get existing data
            const dataRes = await page.evaluate(async ({ dashboardId, viewId }) => {
                const r = await fetch(`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/data?page=1&limit=5`);
                return { status: r.status, body: await r.text() };
            }, { dashboardId, viewId });
            console.error(`  GET data: ${dataRes.status}`);

            let rows: any[] = [];
            try { rows = JSON.parse(dataRes.body)?.data || []; } catch { }
            console.error(`  Rows: ${rows.length}`);

            if (rows.length > 0) {
                const rowId = rows[0].root_index_value;
                console.error(`  First row ID: ${rowId}`);

                // Try updating the row
                for (const method of ["PATCH", "PUT"]) {
                    for (const endpoint of [
                        `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/items/${rowId}`,
                        `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/items/${rowId}`,
                    ]) {
                        const res = await page.evaluate(async ({ endpoint, method }) => {
                            const r = await fetch(endpoint, {
                                method,
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ data: {} }),
                            });
                            return { status: r.status, body: await r.text() };
                        }, { endpoint, method });
                        const short = endpoint.replace("/v4/api/proxy/dashboard-service/v1", "");
                        console.error(`  ${method} ${short}: ${res.status}`);
                        if (res.status < 500) console.error(`  Response: ${res.body.slice(0, 200)}`);
                    }
                }

                // Try deleting the row
                currentStep = "12-delete-row";
                console.error(`\n=== Step 12: Delete row ===`);
                for (const endpoint of [
                    `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/items/${rowId}`,
                    `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/items/${rowId}`,
                ]) {
                    const res = await page.evaluate(async ({ endpoint }) => {
                        const r = await fetch(endpoint, { method: "DELETE" });
                        return { status: r.status, body: await r.text() };
                    }, { endpoint });
                    const short = endpoint.replace("/v4/api/proxy/dashboard-service/v1", "");
                    console.error(`  DELETE ${short}: ${res.status}`);
                    if (res.status < 500) console.error(`  Response: ${res.body.slice(0, 200)}`);
                }
            }
        }

        // ============================================================
        // STEP 13: Add a view (kanban)
        // ============================================================
        currentStep = "13-add-view";
        console.error(`\n=== Step 13: Add view (kanban) ===`);
        if (dashboardId) {
            // Try creating a view via API
            const viewPayloads = [
                { endpoint: `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views`, body: { name: "test-kanban", type: "kanban" } },
                { endpoint: `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views`, body: { global_id: crypto.randomUUID(), name: "test-kanban", type: "kanban" } },
            ];
            for (const { endpoint, body } of viewPayloads) {
                const res = await page.evaluate(async ({ endpoint, body }) => {
                    const r = await fetch(endpoint, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify(body),
                    });
                    return { status: r.status, body: await r.text() };
                }, { endpoint, body });
                const short = endpoint.replace("/v4/api/proxy/dashboard-service/v1", "");
                console.error(`  POST ${short}: ${res.status}`);
                console.error(`  Response: ${res.body.slice(0, 300)}`);
            }
        }

        // ============================================================
        // STEP 14: Set representation (switch to kanban)
        // ============================================================
        currentStep = "14-set-representation";
        console.error(`\n=== Step 14: Set representation ===`);
        if (dashboardId && viewId) {
            for (const repType of ["kanban", "table"]) {
                const res = await page.evaluate(async ({ dashboardId, viewId, repType }) => {
                    const r = await fetch(
                        `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/representations/${repType}`,
                        { method: "POST", headers: { "content-type": "application/json" } }
                    );
                    return { status: r.status, body: await r.text() };
                }, { dashboardId, viewId, repType });
                console.error(`  POST .../representations/${repType}: ${res.status}`);
                console.error(`  Response: ${res.body.slice(0, 200)}`);
            }
        }

        // ============================================================
        // STEP 15: Add a dashboard/table within the database
        // ============================================================
        currentStep = "15-add-dashboard";
        console.error(`\n=== Step 15: Add dashboard (table within database) ===`);
        const addDashPayloads = [
            { endpoint: `/v4/api/proxy/dashboard-service/v1/databases/${dbId}/dashboards`, body: { global_id: crypto.randomUUID(), title: "test-table-2" } },
            { endpoint: `/v4/api/proxy/dashboard-service/v1/databases/${dbId}/dashboards`, body: { title: "test-table-3" } },
        ];
        for (const { endpoint, body } of addDashPayloads) {
            const res = await page.evaluate(async ({ endpoint, body }) => {
                const r = await fetch(endpoint, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(body),
                });
                return { status: r.status, body: await r.text() };
            }, { endpoint, body });
            const short = endpoint.replace("/v4/api/proxy/dashboard-service/v1", "");
            console.error(`  POST ${short}: ${res.status}`);
            console.error(`  Response: ${res.body.slice(0, 300)}`);
        }

        // ============================================================
        // STEP 16: Delete the test database
        // ============================================================
        currentStep = "16-delete-database";
        console.error(`\n=== Step 16: Delete database ===`);
        const delRes = await page.evaluate(async (dbId) => {
            const r = await fetch(`/v4/api/proxy/dashboard-service/v1/databases/${dbId}`, {
                method: "DELETE",
            });
            return { status: r.status, body: await r.text() };
        }, dbId);
        console.error(`  DELETE /databases/${dbId}: ${delRes.status}`);
        console.error(`  Response: ${delRes.body.slice(0, 200)}`);

        // ============================================================
        // SAVE RESULTS
        // ============================================================
        const dataDir = path.resolve(__dirname, "..", "data");
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        const outputPath = path.resolve(dataDir, "db-crud-capture.json");
        fs.writeFileSync(outputPath, JSON.stringify(captured, null, 2));
        console.error(`\n[capture-crud] Saved ${captured.length} API calls to ${outputPath}`);

        // Print summary
        console.error("\n=== ENDPOINT SUMMARY ===");
        const summary: Record<string, { status: number; step: string }[]> = {};
        for (const c of captured) {
            const key = `${c.method} ${new URL(c.url).pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "{uuid}")}`;
            if (!summary[key]) summary[key] = [];
            summary[key].push({ status: c.status, step: c.step });
        }
        for (const [endpoint, hits] of Object.entries(summary).sort()) {
            const statuses = hits.map(h => `${h.status}`).join(",");
            const steps = [...new Set(hits.map(h => h.step))].join(",");
            const marker = endpoint.startsWith("POST") || endpoint.startsWith("PATCH") || endpoint.startsWith("PUT") || endpoint.startsWith("DELETE") ? " ⚡" : "";
            console.error(`  ${endpoint}: [${statuses}] (${steps})${marker}`);
        }

        console.error(`\nTotal: ${captured.length} requests`);

    } finally {
        await context.close();
    }
}

main().catch(console.error);
