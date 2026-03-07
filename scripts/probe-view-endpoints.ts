/**
 * Quick probe to discover view duplicate, delete, and type-switch endpoints
 * Run: npx tsx scripts/probe-view-endpoints.ts
 */
import * as path from "path"; import * as fs from "fs"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) { for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq > 0 && !process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim(); } }
import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";

const sc = loadEncryptedCookie();
const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const BASE = `https://${HOST}`;
const COOKIE = process.env.FUSEBASE_COOKIE || sc?.cookie || "";
const c = new FusebaseClient({ host: HOST, orgId: process.env.FUSEBASE_ORG_ID || "", cookie: COOKIE });

async function probe(method: string, url: string, body?: any): Promise<{ status: number; data: any }> {
    const opts: RequestInit = { method, headers: { cookie: COOKIE, "content-type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${url}`, opts);
    let data: any;
    try { data = await res.json(); } catch { data = await res.text().catch(() => ""); }
    return { status: res.status, data };
}

async function run() {
    console.log("▶ Setup: creating test database...");
    const cr = await c.createDatabase("view-probe-test");
    const d = (cr as any).data;
    const dashId = d.dashboards[0].global_id;
    const viewId = d.dashboards[0].views[0].global_id;
    const dbId = d.global_id;
    console.log(`  dash=${dashId} view=${viewId}`);

    // ═════════════════════════════════════════
    // 1. CREATE VIEW (confirmed working from capture)
    // ═════════════════════════════════════════
    console.log("\n▶ Create view...");
    const createRes = await probe("POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views`, { name: "New View" });
    console.log(`  POST /views → ${createRes.status}`);
    const newViewId = createRes.data?.data?.global_id;
    console.log(`  New view ID: ${newViewId}`);
    if (createRes.data?.data) console.log(`  View name: ${createRes.data.data.name}`);

    // ═════════════════════════════════════════
    // 2. DUPLICATE VIEW — try various patterns
    // ═════════════════════════════════════════
    console.log("\n▶ Probe DUPLICATE VIEW...");
    const dupPatterns = [
        [`POST`, `/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views/${newViewId}/duplicate`],
        [`POST`, `/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views/${newViewId}/copy`],
        [`POST`, `/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views/copy-from/view`],
        [`POST`, `/v4/api/proxy/dashboard-service/v1/views/${newViewId}/duplicate`],
        [`POST`, `/v4/api/proxy/dashboard-service/v1/views/copy-from/view`],
    ];
    for (const [m, url] of dupPatterns) {
        const res = await probe(m, url, { source_view_id: newViewId, name: "Dup View" });
        console.log(`  ${m} ${url.substring(url.indexOf("/v1/") + 3)} → ${res.status} ${JSON.stringify(res.data).substring(0, 120)}`);
    }

    // ═════════════════════════════════════════
    // 3. DELETE VIEW
    // ═════════════════════════════════════════
    if (newViewId) {
        console.log("\n▶ Probe DELETE VIEW...");
        const delPatterns = [
            [`DELETE`, `/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views/${newViewId}`],
            [`DELETE`, `/v4/api/proxy/dashboard-service/v1/views/${newViewId}`],
        ];
        for (const [m, url] of delPatterns) {
            const res = await probe(m, url);
            console.log(`  ${m} ${url.substring(url.indexOf("/v1/") + 3)} → ${res.status} ${JSON.stringify(res.data).substring(0, 120)}`);
        }
    }

    // ═════════════════════════════════════════
    // 4. VIEW TYPE SWITCHING — check which representation names work
    // ═════════════════════════════════════════
    console.log("\n▶ Probe VIEW TYPE SWITCHING...");
    // First create a fresh view to test with (the other may have been deleted)
    const create2 = await probe("POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views`, { name: "Type Test View" });
    const testViewId = create2.data?.data?.global_id || viewId;
    
    const types = ["table", "kanban", "board", "calendar", "timeline", "gallery", "list", "grid", "form", "detail"];
    for (const t of types) {
        const res = await probe("POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views/${testViewId}/representations/${t}`);
        console.log(`  POST /representations/${t} → ${res.status} ${JSON.stringify(res.data).substring(0, 100)}`);
    }

    // Also try PUT with default_representation_template_id
    console.log("\n▶ Probe via PUT update with representation_template...");
    for (const t of ["board", "calendar", "timeline", "gallery", "list", "grid"]) {
        const res = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views/${testViewId}`, {
            default_representation_template_id: t
        });
        console.log(`  PUT /views/{id} rep=${t} → ${res.status} ${JSON.stringify(res.data).substring(0, 100)}`);
    }

    // ═════════════════════════════════════════
    // 5. DUPLICATE DATABASE (confirmed from capture)
    // ═════════════════════════════════════════
    console.log("\n▶ Probe DUPLICATE DATABASE...");
    const dupDbRes = await probe("POST", `/v4/api/proxy/dashboard-service/v1/databases/copy-from/database?copy_tables=true&copy_views=true&copy_relations=true&copy_data=true&create_default_rows=true`, {
        source_database_id: dbId
    });
    console.log(`  POST /databases/copy-from/database → ${dupDbRes.status}`);
    if (dupDbRes.data?.data?.global_id) {
        console.log(`  Duplicated to: ${dupDbRes.data.data.global_id} "${dupDbRes.data.data.title}"`);
        // Clean up duplicate
        await c.deleteDatabase(dupDbRes.data.data.global_id);
        console.log("  Cleaned up duplicate");
    } else {
        console.log(`  Response: ${JSON.stringify(dupDbRes.data).substring(0, 200)}`);
    }

    // ═════════════════════════════════════════
    // 6. CSV EXPORT (confirmed from capture)
    // ═════════════════════════════════════════
    console.log("\n▶ Probe CSV EXPORT...");
    const csvRes = await probe("GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/export/csv?view_id=${viewId}&delimiter=,`);
    console.log(`  GET /export/csv → ${csvRes.status}`);
    if (typeof csvRes.data === "string") console.log(`  Data (${csvRes.data.length} chars): ${csvRes.data.substring(0, 200)}`);
    else console.log(`  Data: ${JSON.stringify(csvRes.data).substring(0, 200)}`);

    // ═════════════════════════════════════════
    // 7. CSV IMPORT — probe the actual import endpoint
    // ═════════════════════════════════════════
    console.log("\n▶ Probe CSV IMPORT...");
    const importPatterns = [
        [`POST`, `/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/import/csv`],
        [`POST`, `/v4/api/proxy/dashboard-service/v1/dashboards/import/csv`],
        [`POST`, `/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views/${viewId}/import/csv`],
    ];
    for (const [m, url] of importPatterns) {
        const res = await probe(m, url, { data: "Name,Status\nRow1,Done\nRow2,Todo" });
        console.log(`  ${m} ${url.substring(url.indexOf("/v1/") + 3)} → ${res.status} ${JSON.stringify(res.data).substring(0, 120)}`);
    }

    // Cleanup
    console.log("\n▶ Cleanup...");
    await c.deleteDatabase(dbId);
    console.log("  Done!");
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
