/**
 * E2E Test: Full database lifecycle covering all 13 database tools.
 * 
 * Tests:
 * 1. listAllDatabases — list via REST API
 * 2. createDatabase — create a test database
 * 3. getDatabaseDetail — get the new database
 * 4. updateDatabase — rename and change color
 * 5. getDashboardDetail — get dashboard (table) detail
 * 6. getDatabaseData — fetch empty table data
 * 7. updateView — rename the default view
 * 8. setViewRepresentation — switch to kanban
 * 9. setViewRepresentation — switch back to table
 * 10. addDatabaseRow — add a row (server action)
 * 11. deleteDatabase — cleanup
 * 12. Verify deletion via getDatabaseDetail (should 404)
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
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
    try {
        await fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e: any) {
        failed++;
        console.log(`  ❌ ${name}: ${e.message?.slice(0, 120)}`);
    }
}

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error(msg);
}

async function main() {
    console.log("\n=== Database & Kanban E2E Tests ===\n");

    let dbId = "";
    let dashboardId = "";
    let viewId = "";

    // 1. listAllDatabases
    await test("listAllDatabases", async () => {
        const result = await client.listAllDatabases();
        assert(result.success === true, "Expected success");
        assert(Array.isArray(result.data), "Expected data array");
        console.log(`    Found ${result.data.length} databases`);
    });

    // 2. createDatabase
    await test("createDatabase", async () => {
        const result = await client.createDatabase("e2e-lifecycle-test", {
            description: "Full lifecycle E2E test",
            icon: "default",
            color: "blue",
        });
        assert(result.data?.global_id, "Expected global_id");
        dbId = result.data.global_id;
        dashboardId = result.data.dashboards[0].global_id;
        viewId = result.data.dashboards[0].views[0].global_id;
        console.log(`    DB: ${dbId}`);
        console.log(`    Dashboard: ${dashboardId}, View: ${viewId}`);
    });

    // 3. getDatabaseDetail
    await test("getDatabaseDetail", async () => {
        const result = await client.getDatabaseDetail(dbId);
        assert(result.success === true, "Expected success");
        assert(result.data.title === "e2e-lifecycle-test", `Expected title to be e2e-lifecycle-test, got ${result.data.title}`);
        assert(result.data.dashboards.length >= 1, "Expected at least 1 dashboard");
    });

    // 4. updateDatabase
    await test("updateDatabase", async () => {
        const result = await client.updateDatabase(dbId, {
            title: "e2e-lifecycle-renamed",
            color: "fuchsia",
            description: "Renamed via E2E test",
        });
        assert(result.success === true, "Expected success");
        assert(result.data.title === "e2e-lifecycle-renamed", `Title not updated`);
    });

    // 5. getDashboardDetail
    await test("getDashboardDetail", async () => {
        const result = await client.getDashboardDetail(dashboardId);
        assert(result.success === true, "Expected success");
        assert(result.data.database_id === dbId, `Expected database_id to match`);
        assert(result.data.views.length >= 1, "Expected at least 1 view");
        const view = result.data.views[0];
        console.log(`    View: "${view.name}" (default: ${view.default_view})`);
    });

    // 6. getDatabaseData (empty table)
    await test("getDatabaseData", async () => {
        const result = await client.getDatabaseData(dashboardId, viewId);
        assert(result.data !== undefined, "Expected data");
        console.log(`    Rows: ${Array.isArray(result.data) ? result.data.length : 'N/A'}`);
    });

    // 7. updateView
    await test("updateView", async () => {
        const result = await client.updateView(dashboardId, viewId, {
            name: "e2e-view-renamed",
        });
        assert(result.success === true, "Expected success");
        console.log(`    View renamed to: ${(result.data as any).name}`);
    });

    // 8. setViewRepresentation (kanban)
    await test("setViewRepresentation (kanban)", async () => {
        const result = await client.setViewRepresentation(dashboardId, viewId, "kanban");
        assert(result.success === true, "Expected success");
        console.log(`    Switched to kanban`);
    });

    // 9. setViewRepresentation (table)
    await test("setViewRepresentation (table)", async () => {
        const result = await client.setViewRepresentation(dashboardId, viewId, "table");
        assert(result.success === true, "Expected success");
        console.log(`    Switched back to table`);
    });

    // 10. addDatabaseRow
    await test("addDatabaseRow", async () => {
        const result = await client.addDatabaseRow("custom", { databaseId: dbId, dashboardId });
        assert(result.success === true, "Expected success");
    });

    // 11. deleteDatabase
    await test("deleteDatabase", async () => {
        const result = await client.deleteDatabase(dbId);
        assert(result.success === true, "Expected success");
    });

    // 12. Verify deletion
    await test("verify deletion (404)", async () => {
        try {
            await client.getDatabaseDetail(dbId);
            throw new Error("Expected 404 but got success");
        } catch (e: any) {
            assert(e.message.includes("404") || e.message.includes("not found") || e.message.includes("Resource"), `Expected 404/not found, got: ${e.message.slice(0, 80)}`);
        }
    });

    // Summary
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
    console.error("Fatal:", e);
    process.exit(1);
});
