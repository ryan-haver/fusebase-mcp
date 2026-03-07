/**
 * Column API Discovery Probe
 *
 * 1. Creates a fresh database
 * 2. Probes all plausible add-column endpoints
 * 3. Tries writing to each built-in column type with different value formats
 * 4. Probes dashboard detail for schema
 * 5. Cleans up
 *
 * Results saved to: artifacts/column-discovery.json
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

const BASE = `https://${client.host}`;
const COOKIE = (client as any).cookie;
const ORG_ID = (client as any).orgId;

async function req(method: string, path: string, body?: unknown) {
    const url = `${BASE}${path}`;
    const opts: RequestInit = {
        method,
        headers: {
            cookie: COOKIE,
            "content-type": "application/json",
        },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text.substring(0, 300); }
    return { status: res.status, body: json };
}

const results: Record<string, unknown> = {};

async function probe(label: string, method: string, path: string, body?: unknown) {
    process.stdout.write(`\nPROBE [${label}]: ${method} ${path}\n`);
    const r = await req(method, path, body);
    process.stdout.write(`  STATUS: ${r.status}\n`);
    process.stdout.write(`  BODY: ${JSON.stringify(r.body).substring(0, 400)}\n`);
    results[label] = { method, path, status: r.status, body: r.body };
    return r;
}

// ── Step 1: Create test database ──
process.stdout.write("\n=== Step 1: Create database ===\n");
const createRes = await req("POST", "/v4/api/proxy/dashboard-service/v1/databases", {
    name: "col-probe",
    scope_type: "org",
    scope_id: ORG_ID,
});
process.stdout.write(`Create DB: status=${createRes.status}\n`);

const dbData = (createRes.body as any)?.data;
const DB_ID = dbData?.global_id;
const DASH_ID = dbData?.dashboards?.[0]?.global_id;
const VIEW_ID = dbData?.dashboards?.[0]?.views?.[0]?.global_id;

if (!DB_ID) {
    process.stdout.write("FATAL: Could not create database\n");
    process.exit(1);
}
process.stdout.write(`  DB=${DB_ID}\n  Dashboard=${DASH_ID}\n  View=${VIEW_ID}\n`);
results["create-db"] = { DB_ID, DASH_ID, VIEW_ID };

// ── Step 2: Add a row via server action ──
process.stdout.write("\n=== Step 2: Add row ===\n");
const rowUrl = `${BASE}/dashboard/${ORG_ID}/tables/databases/${DB_ID}/dashboard/${DASH_ID}/entity/custom`;
const rowRes = await fetch(rowUrl, {
    method: "POST",
    headers: {
        cookie: COOKIE,
        "content-type": "text/plain;charset=UTF-8",
        accept: "text/x-component",
        "next-action": "a6bff18e5522fbea54d7a97bf0a4f0979a1771ce",
    },
    body: JSON.stringify([{ orgId: ORG_ID, entity: "custom", databaseId: DB_ID, dashboardId: DASH_ID }]),
});
process.stdout.write(`  Row add status: ${rowRes.status}\n`);
await new Promise(r => setTimeout(r, 2000));

// ── Step 3: Get row data  ──
process.stdout.write("\n=== Step 3: Get row data ===\n");
const rowDataRes = await req("GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/views/${VIEW_ID}/data?limit=5`);
const rowData = (rowDataRes.body as any);
const rows = rowData?.data ?? [];
const ROW_UUID = rows[0]?.root_index_value;
const ROW_KEYS = rows[0] ? Object.keys(rows[0]).filter((k: string) => k !== "root_index_value") : [];
process.stdout.write(`  Row UUID: ${ROW_UUID}\n`);
process.stdout.write(`  Column keys: ${ROW_KEYS.join(", ")}\n`);
process.stdout.write(`  Full row[0]: ${JSON.stringify(rows[0]).substring(0, 600)}\n`);
results["row-data-initial"] = { ROW_UUID, ROW_KEYS, rowSample: rows[0] };

// ── Step 4: Get full dashboard detail — find schema ──
process.stdout.write("\n=== Step 4: Dashboard detail (schema probe) ===\n");
const dashRes = await req("GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}`);
const dashData = (dashRes.body as any)?.data ?? {};
process.stdout.write(`  Dashboard top-level keys: ${JSON.stringify(Object.keys(dashData))}\n`);
// Print ALL keys and their content type
for (const [k, v] of Object.entries(dashData)) {
    const valStr = JSON.stringify(v).substring(0, 200);
    process.stdout.write(`  ${k}: ${valStr}\n`);
}
results["dashboard-detail"] = dashData;

// ── Step 5: Probe add-column endpoints ──
process.stdout.write("\n=== Step 5: Add-column endpoint probes ===\n");

// Probe 1: POST /columns
await probe("add-col-1-POST-columns", "POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/columns`, {
    name: "TestNumber", type: "number",
});

// Probe 2: POST /views/columns
await probe("add-col-2-POST-views-columns", "POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/views/${VIEW_ID}/columns`, {
    name: "TestNumber", type: "number",
});

// Probe 3: POST /schema
await probe("add-col-3-POST-schema", "POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/schema`, {
    name: "TestNumber", type: "number",
});

// Probe 4: POST /views/schema
await probe("add-col-4-POST-views-schema", "POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/views/${VIEW_ID}/schema`, {
    name: "TestNumber", type: "number",
});

// Probe 5: PUT /columns
await probe("add-col-5-PUT-columns", "PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/columns`, {
    name: "TestNumber", type: "number",
});

// Probe 6: PATCH /columns
await probe("add-col-6-PATCH-columns", "PATCH", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/columns`, {
    name: "TestNumber", type: "number",
});

// Probe 7: POST /root_schema
await probe("add-col-7-POST-root-schema", "POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/root_schema`, {
    name: "TestNumber", type: "number",
});

// Probe 8: GET /columns
await probe("get-col-8-GET-columns", "GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/columns`);

// Probe 9: GET /schema
await probe("get-col-9-GET-schema", "GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/schema`);

// Probe 10: GET /views/schema
await probe("get-col-10-GET-views-schema", "GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/views/${VIEW_ID}/schema`);

// Probe 11: POST with different type names
await probe("add-col-11-type-single_line_text", "POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/columns`, {
    name: "TestText", type: "single_line_text",
});
await probe("add-col-12-type-text", "POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/columns`, {
    name: "TestText2", type: "text",
});
await probe("add-col-13-type-checkbox", "POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/columns`, {
    name: "TestCheck", type: "checkbox",
});

// ── Step 6: Write to each default column type ──
process.stdout.write("\n=== Step 6: Write to default columns ===\n");
if (ROW_UUID && ROW_KEYS.length > 0) {
    for (const key of ROW_KEYS.slice(0, 5)) {
        const sampleValue = rows[0]?.[key];
        process.stdout.write(`\n  Column key: ${key} (current value type: ${typeof sampleValue}, val: ${JSON.stringify(sampleValue)?.substring(0, 80)})\n`);

        // Try plain string
        const r1 = await probe(`write-${key}-string`, "PUT",
            `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/views/${VIEW_ID}/data`,
            { root_index_key: "rowUuid", root_index_value: ROW_UUID, item_key: key, data: { value: "Test String" } }
        );

        // Try null
        const r2 = await probe(`write-${key}-null`, "PUT",
            `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/views/${VIEW_ID}/data`,
            { root_index_key: "rowUuid", root_index_value: ROW_UUID, item_key: key, data: { value: null } }
        );
    }
}

// ── Step 7: Verify - get row data again ──
process.stdout.write("\n=== Step 7: Row data after writes ===\n");
await new Promise(r => setTimeout(r, 1500));
const rowDataRes2 = await req("GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${DASH_ID}/views/${VIEW_ID}/data?limit=5`);
const rows2 = (rowDataRes2.body as any)?.data ?? [];
process.stdout.write(`  Row[0] after writes: ${JSON.stringify(rows2[0]).substring(0, 800)}\n`);
results["row-data-after-write"] = rows2[0];

// ── Step 8: Save and cleanup ──
const outFile = path.resolve(__dirname, "..", "artifacts", "column-discovery.json");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
process.stdout.write(`\n✅ Results saved to ${outFile}\n`);

// Cleanup
process.stdout.write("\n=== Cleanup ===\n");
const delRes = await req("DELETE", `/v4/api/proxy/dashboard-service/v1/databases/${DB_ID}`);
process.stdout.write(`  Delete DB status: ${delRes.status}\n`);
