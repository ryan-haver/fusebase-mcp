/**
 * COMPREHENSIVE DATABASE FEATURE AUDIT
 * 
 * Tests every database-related API endpoint discovered from:
 * - FuseBase official guides (17 database guides)
 * - Previous API probing sessions
 * - HAR capture analysis
 * 
 * Creates a temp database, probes ALL endpoints, logs results, cleans up.
 * 
 * Run: npx tsx scripts/audit-db-features.ts
 */
import * as path from "path"; import * as fs from "fs"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) { for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq > 0 && !process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim(); } }
import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";

const sc = loadEncryptedCookie();
const c = new FusebaseClient({
    host: process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me",
    orgId: process.env.FUSEBASE_ORG_ID || "",
    cookie: process.env.FUSEBASE_COOKIE || sc?.cookie || "",
});
const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const BASE = `https://${HOST}`;
const COOKIE = process.env.FUSEBASE_COOKIE || sc?.cookie || "";

const ARTIFACTS = path.resolve(__dirname, "..", "artifacts");
fs.mkdirSync(ARTIFACTS, { recursive: true });

type AuditResult = { feature: string; category: string; endpoint: string; method: string; status: number | string; ok: boolean; notes: string };
const results: AuditResult[] = [];

function log(r: AuditResult) {
    results.push(r);
    const icon = r.ok ? "✅" : r.status === "SKIP" ? "⏭" : "❌";
    console.log(`  ${icon} [${r.category}] ${r.feature}: ${r.method} ${r.endpoint} → ${r.status} ${r.notes}`);
}

async function probe(method: string, url: string, body?: any): Promise<{ status: number; data: any }> {
    const opts: RequestInit = {
        method,
        headers: { cookie: COOKIE, "content-type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${url}`, opts);
    let data: any;
    try { data = await res.json(); } catch { data = await res.text().catch(() => ""); }
    return { status: res.status, data };
}

async function run() {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║       COMPREHENSIVE FUSEBASE DATABASE FEATURE AUDIT         ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    // ══════════════════════════════════════════════════════════════
    // SETUP: Create test databases
    // ══════════════════════════════════════════════════════════════
    console.log("▶ SETUP: Creating test databases...");
    const cr1 = await c.createDatabase("audit-source");
    const d1 = (cr1 as any).data;
    const db1 = { id: d1.global_id, dash: d1.dashboards[0].global_id, view: d1.dashboards[0].views[0].global_id };
    
    const cr2 = await c.createDatabase("audit-target");
    const d2 = (cr2 as any).data;
    const db2 = { id: d2.global_id, dash: d2.dashboards[0].global_id, view: d2.dashboards[0].views[0].global_id };
    
    console.log(`  DB1: ${db1.id} (dash=${db1.dash} view=${db1.view})`);
    console.log(`  DB2: ${db2.id} (dash=${db2.dash} view=${db2.view})`);

    // Get initial schema to find column keys
    const schema0 = await c.getViewSchema(db1.dash, db1.view);
    const nameKey = schema0.columns.find(c => c.name === "Name")?.key || "";
    const statusKey = schema0.columns.find(c => c.name === "Status")?.key || "";
    const dateKey = schema0.columns.find(c => c.name === "Date")?.key || "";

    // ══════════════════════════════════════════════════════════════
    // CATEGORY 1: DATABASE CRUD
    // ══════════════════════════════════════════════════════════════
    console.log("\n══════════════════════════════════════════");
    console.log("  CATEGORY 1: DATABASE CRUD");
    console.log("══════════════════════════════════════════");

    // List all databases
    const listRes = await probe("GET", `/v4/api/proxy/dashboard-service/v1/databases`);
    log({ feature: "List databases", category: "DB CRUD", endpoint: "/databases", method: "GET", status: listRes.status, ok: listRes.status === 200, notes: `found ${listRes.data?.data?.length || "?"} databases` });

    // Get database detail
    const detRes = await probe("GET", `/v4/api/proxy/dashboard-service/v1/databases/${db1.id}`);
    log({ feature: "Get database detail", category: "DB CRUD", endpoint: `/databases/{id}`, method: "GET", status: detRes.status, ok: detRes.status === 200, notes: detRes.data?.data?.name || "" });

    // Rename database
    const renRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/databases/${db1.id}`, { name: "audit-source-renamed" });
    log({ feature: "Rename database", category: "DB CRUD", endpoint: `/databases/{id}`, method: "PUT", status: renRes.status, ok: renRes.status === 200, notes: renRes.data?.data?.name || renRes.data?.message || "" });

    // Rename back
    await probe("PUT", `/v4/api/proxy/dashboard-service/v1/databases/${db1.id}`, { name: "audit-source" });

    // Duplicate database
    const dupRes = await probe("POST", `/v4/api/proxy/dashboard-service/v1/databases/${db1.id}/duplicate`);
    log({ feature: "Duplicate database", category: "DB CRUD", endpoint: `/databases/{id}/duplicate`, method: "POST", status: dupRes.status, ok: dupRes.status >= 200 && dupRes.status < 300, notes: dupRes.data?.data?.global_id || JSON.stringify(dupRes.data).substring(0, 80) });
    if (dupRes.data?.data?.global_id) {
        await probe("DELETE", `/v4/api/proxy/dashboard-service/v1/databases/${dupRes.data.data.global_id}`);
    }

    // Favorite database
    const favRes = await probe("POST", `/v4/api/proxy/dashboard-service/v1/databases/${db1.id}/favorite`);
    log({ feature: "Favorite database", category: "DB CRUD", endpoint: `/databases/{id}/favorite`, method: "POST", status: favRes.status, ok: favRes.status >= 200 && favRes.status < 400, notes: JSON.stringify(favRes.data).substring(0, 80) });

    const unfavRes = await probe("DELETE", `/v4/api/proxy/dashboard-service/v1/databases/${db1.id}/favorite`);
    log({ feature: "Unfavorite database", category: "DB CRUD", endpoint: `/databases/{id}/favorite`, method: "DELETE", status: unfavRes.status, ok: unfavRes.status >= 200 && unfavRes.status < 400, notes: JSON.stringify(unfavRes.data).substring(0, 80) });

    // ══════════════════════════════════════════════════════════════
    // CATEGORY 2: TABLE (DASHBOARD) MANAGEMENT  
    // ══════════════════════════════════════════════════════════════
    console.log("\n══════════════════════════════════════════");
    console.log("  CATEGORY 2: TABLE (DASHBOARD) MANAGEMENT");
    console.log("══════════════════════════════════════════");

    // Add a new table (dashboard) to database
    const addTableRes = await probe("POST", `/v4/api/proxy/dashboard-service/v1/databases/${db1.id}/dashboards`, { name: "Second Table" });
    log({ feature: "Add table to database", category: "TABLE", endpoint: `/databases/{id}/dashboards`, method: "POST", status: addTableRes.status, ok: addTableRes.status >= 200 && addTableRes.status < 300, notes: addTableRes.data?.data?.global_id || JSON.stringify(addTableRes.data).substring(0, 100) });

    const table2Id = addTableRes.data?.data?.global_id;

    // Rename table
    if (table2Id) {
        const renTabRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${table2Id}`, { name: "Second Table Renamed" });
        log({ feature: "Rename table", category: "TABLE", endpoint: `/dashboards/{id}`, method: "PUT", status: renTabRes.status, ok: renTabRes.status >= 200 && renTabRes.status < 300, notes: renTabRes.data?.message || "" });

        // Delete table
        const delTabRes = await probe("DELETE", `/v4/api/proxy/dashboard-service/v1/dashboards/${table2Id}`);
        log({ feature: "Delete table", category: "TABLE", endpoint: `/dashboards/{id}`, method: "DELETE", status: delTabRes.status, ok: delTabRes.status >= 200 && delTabRes.status < 300, notes: "" });
    }

    // Get dashboard detail
    const dashDetRes = await probe("GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}`);
    log({ feature: "Get dashboard detail", category: "TABLE", endpoint: `/dashboards/{id}`, method: "GET", status: dashDetRes.status, ok: dashDetRes.status === 200, notes: dashDetRes.data?.data?.name || "" });

    // ══════════════════════════════════════════════════════════════
    // CATEGORY 3: VIEW MANAGEMENT
    // ══════════════════════════════════════════════════════════════
    console.log("\n══════════════════════════════════════════");
    console.log("  CATEGORY 3: VIEW MANAGEMENT");
    console.log("══════════════════════════════════════════");

    // Get view detail
    const viewDetRes = await probe("GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`);
    log({ feature: "Get view detail", category: "VIEW", endpoint: `/views/{id}`, method: "GET", status: viewDetRes.status, ok: viewDetRes.status === 200, notes: viewDetRes.data?.data?.name || "" });

    // Create new view
    const createViewRes = await probe("POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views`, { name: "Filtered View", description: "Test view" });
    log({ feature: "Create view", category: "VIEW", endpoint: `/dashboards/{id}/views`, method: "POST", status: createViewRes.status, ok: createViewRes.status >= 200 && createViewRes.status < 300, notes: createViewRes.data?.data?.global_id || JSON.stringify(createViewRes.data).substring(0, 100) });

    const view2Id = createViewRes.data?.data?.global_id;

    // Rename view
    if (view2Id) {
        const renVRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${view2Id}`, { name: "Renamed View" });
        log({ feature: "Rename view", category: "VIEW", endpoint: `/views/{id}`, method: "PUT", status: renVRes.status, ok: renVRes.status === 200, notes: renVRes.data?.data?.name || "" });
    }

    // Duplicate view
    if (view2Id) {
        const dupVRes = await probe("POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${view2Id}/duplicate`);
        log({ feature: "Duplicate view", category: "VIEW", endpoint: `/views/{id}/duplicate`, method: "POST", status: dupVRes.status, ok: dupVRes.status >= 200 && dupVRes.status < 300, notes: dupVRes.data?.data?.global_id || JSON.stringify(dupVRes.data).substring(0, 100) });
        if (dupVRes.data?.data?.global_id) {
            await probe("DELETE", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${dupVRes.data.data.global_id}`);
        }
    }

    // Delete view
    if (view2Id) {
        const delVRes = await probe("DELETE", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${view2Id}`);
        log({ feature: "Delete view", category: "VIEW", endpoint: `/views/{id}`, method: "DELETE", status: delVRes.status, ok: delVRes.status >= 200 && delVRes.status < 300, notes: "" });
    }

    // 8 View representations
    console.log("\n  --- View Representations ---");
    for (const rep of ["table", "board", "calendar", "timeline", "gallery", "kanban", "list", "grid"]) {
        const repRes = await probe("POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}/representations/${rep}`);
        log({ feature: `Switch to ${rep} view`, category: "VIEW REP", endpoint: `/views/{id}/representations/${rep}`, method: "POST", status: repRes.status, ok: repRes.status === 200, notes: "" });
    }
    // Switch back to table
    await probe("POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}/representations/table`);

    // ══════════════════════════════════════════════════════════════
    // CATEGORY 4: SORTING
    // ══════════════════════════════════════════════════════════════
    console.log("\n══════════════════════════════════════════");
    console.log("  CATEGORY 4: SORTING");
    console.log("══════════════════════════════════════════");

    // Single sort (asc)
    const sortAscRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        sort: { items: [{ key: nameKey, direction: "asc" }] }
    });
    log({ feature: "Sort by Name ASC", category: "SORT", endpoint: `/views/{id}`, method: "PUT", status: sortAscRes.status, ok: sortAscRes.status === 200, notes: "" });

    // Single sort (desc)
    const sortDescRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        sort: { items: [{ key: nameKey, direction: "desc" }] }
    });
    log({ feature: "Sort by Name DESC", category: "SORT", endpoint: `/views/{id}`, method: "PUT", status: sortDescRes.status, ok: sortDescRes.status === 200, notes: "" });

    // Multi-column sort
    const multiSortRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        sort: { items: [{ key: statusKey, direction: "asc" }, { key: nameKey, direction: "desc" }] }
    });
    log({ feature: "Multi-column sort (Status+Name)", category: "SORT", endpoint: `/views/{id}`, method: "PUT", status: multiSortRes.status, ok: multiSortRes.status === 200, notes: "" });

    // Clear sort
    const clearSortRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        sort: { items: [] }
    });
    log({ feature: "Clear sort", category: "SORT", endpoint: `/views/{id}`, method: "PUT", status: clearSortRes.status, ok: clearSortRes.status === 200, notes: "" });

    // ══════════════════════════════════════════════════════════════
    // CATEGORY 5: FILTERING
    // ══════════════════════════════════════════════════════════════
    console.log("\n══════════════════════════════════════════");
    console.log("  CATEGORY 5: FILTERING");
    console.log("══════════════════════════════════════════");

    // Text filter: contains
    const filterContainsRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        filter: { operator: "and", items: [{ key: nameKey, condition: "contains", value: "test" }] }
    });
    log({ feature: "Filter text: contains", category: "FILTER", endpoint: `/views/{id}`, method: "PUT", status: filterContainsRes.status, ok: filterContainsRes.status === 200, notes: "" });

    // Text filter: is
    const filterIsRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        filter: { operator: "and", items: [{ key: nameKey, condition: "is", value: "exact" }] }
    });
    log({ feature: "Filter text: is (exact)", category: "FILTER", endpoint: `/views/{id}`, method: "PUT", status: filterIsRes.status, ok: filterIsRes.status === 200, notes: "" });

    // Text filter: is_not
    const filterIsNotRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        filter: { operator: "and", items: [{ key: nameKey, condition: "is_not", value: "excluded" }] }
    });
    log({ feature: "Filter text: is_not", category: "FILTER", endpoint: `/views/{id}`, method: "PUT", status: filterIsNotRes.status, ok: filterIsNotRes.status === 200, notes: "" });

    // Text filter: is_empty / is_not_empty
    const filterEmptyRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        filter: { operator: "and", items: [{ key: nameKey, condition: "is_empty" }] }
    });
    log({ feature: "Filter text: is_empty", category: "FILTER", endpoint: `/views/{id}`, method: "PUT", status: filterEmptyRes.status, ok: filterEmptyRes.status === 200, notes: "" });

    const filterNotEmptyRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        filter: { operator: "and", items: [{ key: nameKey, condition: "is_not_empty" }] }
    });
    log({ feature: "Filter text: is_not_empty", category: "FILTER", endpoint: `/views/{id}`, method: "PUT", status: filterNotEmptyRes.status, ok: filterNotEmptyRes.status === 200, notes: "" });

    // Multi-filter with AND
    const filterAndRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        filter: { operator: "and", items: [
            { key: nameKey, condition: "is_not_empty" },
            { key: statusKey, condition: "is_not_empty" },
        ]}
    });
    log({ feature: "Multi-filter AND", category: "FILTER", endpoint: `/views/{id}`, method: "PUT", status: filterAndRes.status, ok: filterAndRes.status === 200, notes: "" });

    // Multi-filter with OR
    const filterOrRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        filter: { operator: "or", items: [
            { key: nameKey, condition: "is_not_empty" },
            { key: statusKey, condition: "is_not_empty" },
        ]}
    });
    log({ feature: "Multi-filter OR", category: "FILTER", endpoint: `/views/{id}`, method: "PUT", status: filterOrRes.status, ok: filterOrRes.status === 200, notes: "" });

    // Clear filter
    const clearFilterRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        filter: { operator: "and", items: [] }
    });
    log({ feature: "Clear filter", category: "FILTER", endpoint: `/views/{id}`, method: "PUT", status: clearFilterRes.status, ok: clearFilterRes.status === 200, notes: "" });

    // ══════════════════════════════════════════════════════════════
    // CATEGORY 6: GROUPING
    // ══════════════════════════════════════════════════════════════
    console.log("\n══════════════════════════════════════════");
    console.log("  CATEGORY 6: GROUPING");
    console.log("══════════════════════════════════════════");

    // Group by Status
    const groupRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        group: { items: [{ key: statusKey }] }
    });
    log({ feature: "Group by Status", category: "GROUP", endpoint: `/views/{id}`, method: "PUT", status: groupRes.status, ok: groupRes.status === 200, notes: "" });

    // Group by Date
    const groupDateRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        group: { items: [{ key: dateKey }] }
    });
    log({ feature: "Group by Date", category: "GROUP", endpoint: `/views/{id}`, method: "PUT", status: groupDateRes.status, ok: groupDateRes.status === 200, notes: "" });

    // Clear group
    const clearGroupRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        group: { items: [] }
    });
    log({ feature: "Clear group", category: "GROUP", endpoint: `/views/{id}`, method: "PUT", status: clearGroupRes.status, ok: clearGroupRes.status === 200, notes: "" });

    // ══════════════════════════════════════════════════════════════
    // CATEGORY 7: COLUMN VISIBILITY
    // ══════════════════════════════════════════════════════════════
    console.log("\n══════════════════════════════════════════");
    console.log("  CATEGORY 7: COLUMN VISIBILITY");
    console.log("══════════════════════════════════════════");

    // Hide a column
    const viewData = (await probe("GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`)).data;
    const schemaItems = viewData?.data?.schema?.items || [];
    const descCol = schemaItems.find((i: any) => i.name === "Description");
    if (descCol) {
        const hiddenItems = schemaItems.map((i: any) => i.key === descCol.key ? { ...i, hidden: true } : i);
        const hideRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
            schema: { ...viewData.data.schema, items: hiddenItems }
        });
        log({ feature: "Hide column", category: "VISIBILITY", endpoint: `/views/{id}`, method: "PUT", status: hideRes.status, ok: hideRes.status === 200, notes: `hid "${descCol.name}"` });

        // Show column
        const shownItems = schemaItems.map((i: any) => i.key === descCol.key ? { ...i, hidden: false } : i);
        const showRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
            schema: { ...viewData.data.schema, items: shownItems }
        });
        log({ feature: "Show column", category: "VISIBILITY", endpoint: `/views/{id}`, method: "PUT", status: showRes.status, ok: showRes.status === 200, notes: `showed "${descCol.name}"` });
    }

    // ══════════════════════════════════════════════════════════════
    // CATEGORY 8: ALL 15 COLUMN TYPES
    // ══════════════════════════════════════════════════════════════
    console.log("\n══════════════════════════════════════════");
    console.log("  CATEGORY 8: ALL 15 COLUMN TYPES");
    console.log("══════════════════════════════════════════");

    const colTypes = [
        ["string", "string"], ["multiline", "string"], ["number", "number"], ["date", "date"],
        ["label", "label"], ["checkbox", "boolean"], ["email", "email"], ["phone", "phone"],
        ["link", "link"], ["currency", "currency"], ["files", "files"], ["user", "assignee"],
        ["subtable", "child-table-link"],
    ];
    for (const [typeName, expectedType] of colTypes) {
        try {
            const res = await c.addDatabaseColumn(db1.dash, db1.view, `Test_${typeName}`, typeName);
            log({ feature: `Add ${typeName} column`, category: "COLUMN", endpoint: `PUT /views/{id}`, method: "PUT", status: res.success ? 200 : 500, ok: res.success, notes: `key=${res.column.key}` });
        } catch (e: any) {
            log({ feature: `Add ${typeName} column`, category: "COLUMN", endpoint: `PUT /views/{id}`, method: "PUT", status: "ERR", ok: false, notes: e.message.substring(0, 80) });
        }
    }

    // Relation 
    try {
        const relRes = await c.addRelationColumn(db1.dash, db1.view, "Test_relation", db2.dash, db2.view);
        log({ feature: "Add relation column", category: "COLUMN", endpoint: `POST /relations + PUT /views/{id}`, method: "POST+PUT", status: relRes.success ? 200 : 500, ok: relRes.success, notes: `key=${relRes.column.key} relId=${relRes.relationId}` });

        // Lookup (depends on relation)
        const lookRes = await c.addLookupColumn(db1.dash, db1.view, "Test_lookup", relRes.column.key);
        log({ feature: "Add lookup column", category: "COLUMN", endpoint: `PUT /views/{id}`, method: "PUT", status: lookRes.success ? 200 : 500, ok: lookRes.success, notes: `key=${lookRes.column.key}` });
    } catch (e: any) {
        log({ feature: "Add relation/lookup column", category: "COLUMN", endpoint: "", method: "", status: "ERR", ok: false, notes: e.message.substring(0, 80) });
    }

    // Delete column
    const schema1 = await c.getViewSchema(db1.dash, db1.view);
    const testCol = schema1.columns.find(c => c.name === "Test_phone");
    if (testCol) {
        try {
            const delRes = await c.deleteDatabaseColumn(db1.dash, db1.view, testCol.key);
            log({ feature: "Delete column", category: "COLUMN", endpoint: `PUT /views/{id}`, method: "PUT", status: delRes.success ? 200 : 500, ok: delRes.success, notes: `deleted "${testCol.name}"` });
        } catch (e: any) {
            log({ feature: "Delete column", category: "COLUMN", endpoint: "", method: "", status: "ERR", ok: false, notes: e.message });
        }
    }

    // ══════════════════════════════════════════════════════════════
    // CATEGORY 9: ROW OPERATIONS
    // ══════════════════════════════════════════════════════════════
    console.log("\n══════════════════════════════════════════");
    console.log("  CATEGORY 9: ROW OPERATIONS");
    console.log("══════════════════════════════════════════");

    // Add row
    const addRowRes = await probe("POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}/entities`, {});
    log({ feature: "Add row (empty)", category: "ROW", endpoint: `/views/{id}/entities`, method: "POST", status: addRowRes.status, ok: addRowRes.status >= 200 && addRowRes.status < 300, notes: addRowRes.data?.data?.global_id || JSON.stringify(addRowRes.data).substring(0, 80) });

    const rowId = addRowRes.data?.data?.global_id;

    // Get rows
    const getRowsRes = await probe("POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}/entities/search`, {});
    log({ feature: "Get rows (search)", category: "ROW", endpoint: `/views/{id}/entities/search`, method: "POST", status: getRowsRes.status, ok: getRowsRes.status >= 200 && getRowsRes.status < 300, notes: `${getRowsRes.data?.data?.length || 0} rows` });

    // Update cell
    if (rowId) {
        const updateRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}/entities/${rowId}`, {
            [nameKey]: "Test Row 1"
        });
        log({ feature: "Update cell value", category: "ROW", endpoint: `/views/{id}/entities/{rowId}`, method: "PUT", status: updateRes.status, ok: updateRes.status >= 200 && updateRes.status < 300, notes: "" });

        // Get single entity
        const getEntRes = await probe("GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}/entities/${rowId}`);
        log({ feature: "Get single entity", category: "ROW", endpoint: `/views/{id}/entities/{rowId}`, method: "GET", status: getEntRes.status, ok: getEntRes.status >= 200 && getEntRes.status < 300, notes: "" });

        // Delete row
        const delRowRes = await probe("DELETE", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}/entities/${rowId}`);
        log({ feature: "Delete row", category: "ROW", endpoint: `/views/{id}/entities/{rowId}`, method: "DELETE", status: delRowRes.status, ok: delRowRes.status >= 200 && delRowRes.status < 300, notes: "" });
    }

    // Bulk operations
    const bulkAddRes = await probe("POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}/entities/bulk`, [
        { [nameKey]: "Bulk Row 1" }, { [nameKey]: "Bulk Row 2" },
    ]);
    log({ feature: "Bulk add rows", category: "ROW", endpoint: `/views/{id}/entities/bulk`, method: "POST", status: bulkAddRes.status, ok: bulkAddRes.status >= 200 && bulkAddRes.status < 300, notes: JSON.stringify(bulkAddRes.data).substring(0, 80) });

    // ══════════════════════════════════════════════════════════════
    // CATEGORY 10: RELATIONS (dedicated endpoint)
    // ══════════════════════════════════════════════════════════════
    console.log("\n══════════════════════════════════════════");
    console.log("  CATEGORY 10: RELATIONS API");
    console.log("══════════════════════════════════════════");

    // List relations
    const listRelRes = await probe("GET", `/v4/api/proxy/dashboard-service/v1/relations`);
    log({ feature: "List all relations", category: "RELATION", endpoint: `/relations`, method: "GET", status: listRelRes.status, ok: listRelRes.status === 200, notes: `${listRelRes.data?.data?.length || "?"} relations` });

    // Create relation
    const createRelRes = await probe("POST", `/v4/api/proxy/dashboard-service/v1/relations`, {
        source_dashboard_id: db1.dash, target_dashboard_id: db2.dash, relation_type: "many_to_many"
    });
    log({ feature: "Create relation", category: "RELATION", endpoint: `/relations`, method: "POST", status: createRelRes.status, ok: createRelRes.status >= 200 && createRelRes.status < 300, notes: createRelRes.data?.data?.global_id || "" });
    
    const testRelId = createRelRes.data?.data?.global_id;
    if (testRelId) {
        // Get relation detail
        const getRelRes = await probe("GET", `/v4/api/proxy/dashboard-service/v1/relations/${testRelId}`);
        log({ feature: "Get relation detail", category: "RELATION", endpoint: `/relations/{id}`, method: "GET", status: getRelRes.status, ok: getRelRes.status >= 200 && getRelRes.status < 300, notes: "" });

        // Delete relation
        const delRelRes = await probe("DELETE", `/v4/api/proxy/dashboard-service/v1/relations/${testRelId}`);
        log({ feature: "Delete relation", category: "RELATION", endpoint: `/relations/{id}`, method: "DELETE", status: delRelRes.status, ok: delRelRes.status >= 200 && delRelRes.status < 300, notes: "" });
    }

    // ══════════════════════════════════════════════════════════════
    // CATEGORY 11: CSV IMPORT/EXPORT
    // ══════════════════════════════════════════════════════════════
    console.log("\n══════════════════════════════════════════");
    console.log("  CATEGORY 11: CSV IMPORT/EXPORT");
    console.log("══════════════════════════════════════════");

    const exportRes = await probe("GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}/export/csv`);
    log({ feature: "Export CSV", category: "CSV", endpoint: `/views/{id}/export/csv`, method: "GET", status: exportRes.status, ok: exportRes.status >= 200 && exportRes.status < 400, notes: typeof exportRes.data === "string" ? `${exportRes.data.length} chars` : JSON.stringify(exportRes.data).substring(0, 80) });

    const importRes = await probe("POST", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}/import/csv`);
    log({ feature: "Import CSV (probe)", category: "CSV", endpoint: `/views/{id}/import/csv`, method: "POST", status: importRes.status, ok: importRes.status >= 200 && importRes.status < 500, notes: JSON.stringify(importRes.data).substring(0, 80) });

    // ══════════════════════════════════════════════════════════════
    // CATEGORY 12: COLUMN GROUPS
    // ══════════════════════════════════════════════════════════════
    console.log("\n══════════════════════════════════════════");
    console.log("  CATEGORY 12: COLUMN GROUPS");
    console.log("══════════════════════════════════════════");

    const colGroupRes = await probe("PUT", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}`, {
        schema: {
            ...viewData.data.schema,
            groups: [{ name: "Basic Info", keys: [nameKey, statusKey] }],
        }
    });
    log({ feature: "Create column group", category: "COL GROUP", endpoint: `/views/{id}`, method: "PUT", status: colGroupRes.status, ok: colGroupRes.status === 200, notes: "" });

    // ══════════════════════════════════════════════════════════════
    // CATEGORY 13: MISC ENDPOINTS
    // ══════════════════════════════════════════════════════════════
    console.log("\n══════════════════════════════════════════");
    console.log("  CATEGORY 13: MISC ENDPOINTS");
    console.log("══════════════════════════════════════════");

    // Search databases
    const searchRes = await probe("GET", `/v4/api/proxy/dashboard-service/v1/databases?search=audit`);
    log({ feature: "Search databases", category: "MISC", endpoint: `/databases?search=...`, method: "GET", status: searchRes.status, ok: searchRes.status === 200, notes: `${searchRes.data?.data?.length || 0} results` });

    // Database statistics/counts
    const statsRes = await probe("GET", `/v4/api/proxy/dashboard-service/v1/databases/${db1.id}/stats`);
    log({ feature: "Database stats", category: "MISC", endpoint: `/databases/{id}/stats`, method: "GET", status: statsRes.status, ok: statsRes.status >= 200 && statsRes.status < 400, notes: JSON.stringify(statsRes.data).substring(0, 80) });

    // View count/summary
    const viewListRes = await probe("GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views`);
    log({ feature: "List views for dashboard", category: "MISC", endpoint: `/dashboards/{id}/views`, method: "GET", status: viewListRes.status, ok: viewListRes.status >= 200 && viewListRes.status < 300, notes: `${viewListRes.data?.data?.length || "?"} views` });

    // Entity count
    const countRes = await probe("GET", `/v4/api/proxy/dashboard-service/v1/dashboards/${db1.dash}/views/${db1.view}/entities/count`);
    log({ feature: "Entity count", category: "MISC", endpoint: `/views/{id}/entities/count`, method: "GET", status: countRes.status, ok: countRes.status >= 200 && countRes.status < 400, notes: JSON.stringify(countRes.data).substring(0, 80) });

    // ══════════════════════════════════════════════════════════════
    // CLEANUP
    // ══════════════════════════════════════════════════════════════
    console.log("\n▶ CLEANUP...");
    await c.deleteDatabase(db1.id);
    await c.deleteDatabase(db2.id);
    console.log("  Deleted both test databases");

    // ══════════════════════════════════════════════════════════════
    // RESULTS SUMMARY
    // ══════════════════════════════════════════════════════════════
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    const categories = [...new Set(results.map(r => r.category))];

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║                    AUDIT RESULTS SUMMARY                     ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    
    for (const cat of categories) {
        const catResults = results.filter(r => r.category === cat);
        const catPassed = catResults.filter(r => r.ok).length;
        console.log(`\n  [${cat}] ${catPassed}/${catResults.length} passed`);
        for (const r of catResults) {
            console.log(`    ${r.ok ? "✅" : "❌"} ${r.feature}`);
        }
    }

    console.log(`\n  ════════════════════════════════════`);
    console.log(`  TOTAL: ${passed}/${results.length} passed, ${failed} failed`);  
    console.log(`  ════════════════════════════════════\n`);

    // Save full results
    fs.writeFileSync(path.join(ARTIFACTS, "audit-results.json"), JSON.stringify(results, null, 2));
    console.log(`  Saved detailed results to artifacts/audit-results.json`);

    if (failed > 0) process.exit(1);
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
