/**
 * Column Schema Discovery Script
 *
 * Uses the FusebaseClient to:
 * 1. Create a fresh database
 * 2. Fetch dashboard detail to get root_schema (column definitions)
 * 3. Add a row
 * 4. Write values to each default column type
 * 5. Attempt column management API calls (add/delete column)
 * 6. Log all findings
 * 7. Cleanup
 *
 * Results saved to: artifacts/column-schema-discovery.json
 */
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

import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";

const storedCookie = loadEncryptedCookie();
const client = new FusebaseClient({
    host: process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me",
    orgId: process.env.FUSEBASE_ORG_ID || "",
    cookie: process.env.FUSEBASE_COOKIE || storedCookie?.cookie || "",
});

const BASE = `https://${(client as any).host}`;
const COOKIE = (client as any).cookie;
const ORG_ID = (client as any).orgId;

const results: Record<string, unknown> = {};

async function rawFetch(method: string, urlPath: string, body?: unknown) {
    const opts: RequestInit = {
        method,
        headers: {
            cookie: COOKIE,
            "content-type": "application/json",
        },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${urlPath}`, opts);
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text.substring(0, 500); }
    return { status: res.status, body: json };
}

// ── Step 1: Create test database ─────────────────────────────────
console.log("\n=== Step 1: Create database via client ===");
const createRes = await client.createDatabase("column-discovery-test");
const dbData = (createRes as any).data;
const DB_ID = dbData?.global_id;
const DASH_ID = dbData?.dashboards?.[0]?.global_id;
const VIEW_ID = dbData?.dashboards?.[0]?.views?.[0]?.global_id;

if (!DB_ID) {
    console.error("FATAL: Could not create database:", JSON.stringify(createRes).substring(0, 500));
    process.exit(1);
}
console.log(`  DB=${DB_ID}\n  Dashboard=${DASH_ID}\n  View=${VIEW_ID}`);
results["create-db"] = { DB_ID, DASH_ID, VIEW_ID, fullResponse: createRes };

// ── Step 2: Get dashboard detail to find root_schema ─────────────
console.log("\n=== Step 2: Dashboard detail (schema discovery) ===");
const dashDetail = await rawFetch("GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}`);
const dd = (dashDetail.body as any)?.data ?? {};
console.log("  Top-level keys:", JSON.stringify(Object.keys(dd)));
results["dashboard-detail-keys"] = Object.keys(dd);

// Check for known schema-containing fields
for (const sk of ["root_schema", "schema", "columns", "fields", "column_order", "column_definitions"]) {
    if (dd[sk] !== undefined) {
        console.log(`  ✅ Found "${sk}":`, JSON.stringify(dd[sk]).substring(0, 500));
        results[`schema-field-${sk}`] = dd[sk];
    }
}

// Print every field with its type and sample value
console.log("\n  --- All dashboard detail fields ---");
for (const [k, v] of Object.entries(dd)) {
    const valStr = JSON.stringify(v);
    const truncLen = 200;
    const display = valStr.length > truncLen ? valStr.substring(0, truncLen) + "..." : valStr;
    console.log(`  ${k} (${typeof v}${Array.isArray(v) ? ` len=${v.length}` : ""}): ${display}`);
}
results["dashboard-detail-full"] = dd;

// ── Step 3: Get view detail ──────────────────────────────────────
console.log("\n=== Step 3: View detail ===");
const viewKeys = dd.views;
if (viewKeys) {
    console.log("  Views from dashboard detail:", JSON.stringify(viewKeys).substring(0, 300));
    results["views"] = viewKeys;
}
// Also try GET view schema
const viewSchemaRes = await rawFetch("GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/views/${VIEW_ID}`);
console.log("  GET /views/{viewId} status:", viewSchemaRes.status);
const vd = viewSchemaRes.body as any;
if (vd?.data) {
    console.log("  View detail keys:", JSON.stringify(Object.keys(vd.data)));
    results["view-detail"] = vd.data;
}

// ── Step 4: Add a row via client ─────────────────────────────────
console.log("\n=== Step 4: Add row via client ===");
const rowRes = await client.addDatabaseRow(ORG_ID, DB_ID, DASH_ID);
console.log("  addDatabaseRow:", JSON.stringify(rowRes).substring(0, 200));
await new Promise(r => setTimeout(r, 2000));

// ── Step 5: Get row data ─────────────────────────────────────────
console.log("\n=== Step 5: Row data ===");
const rowData = await rawFetch("GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/views/${VIEW_ID}/data?limit=5`);
const rows = ((rowData.body as any)?.data ?? []) as any[];
const ROW_UUID = rows[0]?.root_index_value;
const ROW_KEYS = rows[0] ? Object.keys(rows[0]).filter(k => k !== "root_index_value") : [];
console.log(`  Row UUID: ${ROW_UUID}`);
console.log(`  Column keys: ${ROW_KEYS.join(", ")}`);
if (rows[0]) {
    console.log("  Full row[0]:", JSON.stringify(rows[0]).substring(0, 800));
}
results["row-data"] = { ROW_UUID, ROW_KEYS, row: rows[0] };

// ── Step 6: Get database detail (different from dashboard) ───────
console.log("\n=== Step 6: Database detail ===");
const dbDetail = await rawFetch("GET", `/v4/api/proxy/dashboard-service/v1/databases/${DB_ID}`);
const dbd = (dbDetail.body as any)?.data ?? {};
console.log("  Database detail keys:", JSON.stringify(Object.keys(dbd)));
for (const [k, v] of Object.entries(dbd)) {
    const valStr = JSON.stringify(v);
    console.log(`  ${k}: ${valStr.substring(0, 200)}`);
}
results["database-detail"] = dbd;

// ── Step 7: Try column management endpoints ──────────────────────
console.log("\n=== Step 7: Column management API probes ===");

const columnProbes = [
    // POST various paths
    { label: "POST /dashboards/{id}/columns", m: "POST", p: `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/columns`, b: { name: "TestNum", type: "number" } },
    { label: "POST /dashboards/{id}/columns (with title)", m: "POST", p: `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/columns`, b: { title: "TestNum", column_type: "number" } },
    { label: "POST /views/{id}/columns", m: "POST", p: `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/views/${VIEW_ID}/columns`, b: { name: "TestNum", type: "number" } },

    // PUT to add schema
    { label: "PUT /dashboards/{id}/root_schema", m: "PUT", p: `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/root_schema`, b: { columns: [{ name: "TestNum", type: "number" }] } },
    { label: "PATCH /dashboards/{id}", m: "PATCH", p: `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}`, b: { root_schema: { columns: [{ name: "TestNum", type: "number" }] } } },

    // GET
    { label: "GET /dashboards/{id}/columns", m: "GET", p: `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/columns` },
    { label: "GET /dashboards/{id}/schema", m: "GET", p: `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/schema` },
    { label: "GET /views/{id}/schema", m: "GET", p: `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/views/${VIEW_ID}/schema` },

    // Try proxy-less paths
    { label: "POST /api/dashboards/{id}/columns", m: "POST", p: `/api/dashboards/${DASH_ID}/columns`, b: { name: "TestNum", type: "number" } },

    // Try view-level schema management
    { label: "PUT /views/{id}/schema", m: "PUT", p: `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/views/${VIEW_ID}/schema`, b: { columns: [{ name: "TestNum", type: "number" }] } },

    // Try the data endpoint to add a column key via PUT
    {
        label: "PUT /views/{id}/data (new key)", m: "PUT", p: `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/views/${VIEW_ID}/data`,
        b: ROW_UUID ? { root_index_key: "rowUuid", root_index_value: ROW_UUID, item_key: "custom_number_1", data: { value: 42 } } : null
    },
];

for (const cp of columnProbes) {
    if (cp.b === null) continue;
    const r = await rawFetch(cp.m, cp.p, cp.b);
    const isSuccess = r.status >= 200 && r.status < 300;
    console.log(`  ${isSuccess ? "✅" : "❌"} ${cp.label}: status=${r.status}, body=${JSON.stringify(r.body).substring(0, 200)}`);
    results[`probe-${cp.label}`] = { status: r.status, body: r.body };
}

// ── Step 8: Try writing to known column types ────────────────────
console.log("\n=== Step 8: Write to known column types ===");
if (ROW_UUID && ROW_KEYS.length > 0) {
    const testValues: Record<string, unknown[]> = {
        "text": ["Hello World"],
        "number": [42, "42"],
        "boolean": [true, "true"],
        "date": [new Date().toISOString(), Date.now()],
        "object": [{ label: "Option 1", color: "#ff0000" }],
    };

    for (const key of ROW_KEYS.slice(0, 5)) {
        const currentVal = rows[0]?.[key];
        const valType = typeof currentVal;
        console.log(`\n  Column: ${key} (type=${valType}, val=${JSON.stringify(currentVal)?.substring(0, 100)})`);

        // Try the appropriate type
        const writeRes = await rawFetch("PUT",
            `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/views/${VIEW_ID}/data`,
            { root_index_key: "rowUuid", root_index_value: ROW_UUID, item_key: key, data: { value: "Test String Value" } }
        );
        console.log(`    Write string: status=${writeRes.status}`);
        results[`write-${key}`] = { status: writeRes.status, body: writeRes.body };
    }
}

// ── Step 9: Re-read dashboard detail to see if writes changed schema
console.log("\n=== Step 9: Re-read dashboard detail after writes ===");
await new Promise(r => setTimeout(r, 1000));
const dashDetail2 = await rawFetch("GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}`);
const dd2 = (dashDetail2.body as any)?.data ?? {};
if (dd2.root_schema) {
    console.log("  root_schema:", JSON.stringify(dd2.root_schema).substring(0, 1000));
    results["root_schema_after_writes"] = dd2.root_schema;
}

// ── Step 10: Cleanup ─────────────────────────────────────────────
console.log("\n=== Step 10: Cleanup ===");
const delRes = await rawFetch("DELETE", `/v4/api/proxy/dashboard-service/v1/databases/${DB_ID}`);
console.log(`  Delete DB: status=${delRes.status}`);

// ── Save results ─────────────────────────────────────────────────
const outFile = path.resolve(__dirname, "..", "artifacts", "column-schema-discovery.json");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
console.log(`\n✅ Results saved to ${outFile}`);
