/**
 * Step 6 E2E Test: complete cell update lifecycle
 *
 * Split into two parts:
 * Part A — Test updateDatabaseCell and getDatabaseRows against playwright-demo
 *           (known data, stable row UUIDs and column keys from prior probing)
 * Part B — Test the full lifecycle: createDatabase/addDatabaseRow/deleteDatabase
 *           (verifies API call success, not cell read-back due to fresh-DB race conditions)
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
        console.log(`  ❌ ${name}: ${e.message?.slice(0, 250)}`);
    }
}

function assert(cond: unknown, msg: string) {
    if (!cond) throw new Error(msg);
}

async function main() {
    console.log("\n=== Cell Update E2E Test ===\n");

    // ── Part A: Test update + read-back on playwright-demo (stable known data) ──

    const playwrightDashboardId = "e14f8a1b-21d3-4ec6-a175-58577f2dc1fe";
    const playwrightViewId = "3b6813b6-543a-403b-b42e-2a148e501e10";

    let testRowUuid = "";
    let nameColumnKey = "";

    console.log("=== Part A: update_database_cell + get_database_rows (playwright-demo) ===");

    // A1: getDatabaseRows — discover row UUID and column keys
    await test("getDatabaseRows (discover row UUID + column keys)", async () => {
        const result = await client.getDatabaseRows(playwrightDashboardId, playwrightViewId, { limit: 10 });
        console.log(`    Total rows: ${result.rows.length}, ColumnKeys: [${result.columnKeys.join(", ")}]`);
        assert(result.rows.length >= 1, `Expected at least 1 row, got ${result.rows.length}`);

        testRowUuid = result.rows[0].rowUuid;
        assert(testRowUuid.length > 0, "Expected non-empty rowUuid");
        console.log(`    Using row UUID: ${testRowUuid}`);

        // Log per-column types
        const row0 = result.rows[0];
        for (const k of result.columnKeys) {
            const v = row0.cells[k];
            console.log(`    Column ${k}: type=${typeof v}, val=${JSON.stringify(v)?.substring(0, 50)}`);
        }

        // Pick first column that is NOT an object (string or null = Name field)
        const primitiveKey = result.columnKeys.find(k => {
            const v = row0.cells[k];
            return typeof v !== "object" || v === null;
        });
        nameColumnKey = primitiveKey ?? result.columnKeys[0];
        console.log(`    Using column key: ${nameColumnKey}`);
        assert(nameColumnKey.length > 0, "Expected at least 1 column key");
    });

    // A2: updateDatabaseCell — write a known value
    const ts = Date.now();
    const testValue = `E2E-${ts}`;
    await test(`updateDatabaseCell (write "${testValue}" to ${nameColumnKey})`, async () => {
        const result = await client.updateDatabaseCell(playwrightDashboardId, playwrightViewId, testRowUuid, nameColumnKey, testValue);
        assert(result.success === true, `Expected success, got: ${JSON.stringify(result).slice(0, 200)}`);
        console.log(`    ✓ success: true`);
    });

    // Wait for write to propagate
    await new Promise(r => setTimeout(r, 2000));

    // A3: getDatabaseRows — verify read-back
    await test(`verify cell value reads back as "${testValue}"`, async () => {
        const result = await client.getDatabaseRows(playwrightDashboardId, playwrightViewId, { limit: 10 });
        const row = result.rows.find(r => r.rowUuid === testRowUuid);
        assert(row, `Row ${testRowUuid} not found`);
        const cellValue = row!.cells[nameColumnKey];
        console.log(`    Cell[${nameColumnKey}] = ${JSON.stringify(cellValue)?.substring(0, 80)}`);
        assert(
            cellValue === testValue,
            `Expected "${testValue}", got "${JSON.stringify(cellValue)}"`,
        );
    });

    // ── Part B: Create → add row → delete lifecycle ──

    console.log("\n=== Part B: create/addRow/delete lifecycle ===");

    let dbId = "";
    let b_dashboardId = "";

    // B1: createDatabase
    await test("createDatabase (cell-test-e2e)", async () => {
        const result = await client.createDatabase("cell-test-e2e", {}) as any;
        assert(result.data?.global_id, "Expected global_id");
        dbId = result.data.global_id;
        b_dashboardId = result.data.dashboards[0].global_id;
        console.log(`    DB: ${dbId}, Dashboard: ${b_dashboardId}`);
    });

    // B2: addDatabaseRow
    await test("addDatabaseRow (creates empty row)", async () => {
        const result = await client.addDatabaseRow("custom", { databaseId: dbId, dashboardId: b_dashboardId }) as any;
        assert(result.success === true, `Expected success, got: ${JSON.stringify(result).slice(0, 100)}`);
        console.log(`    ✓ Row added`);
    });

    // B3: deleteDatabase (cleanup)
    await test("deleteDatabase (cleanup)", async () => {
        const result = await client.deleteDatabase(dbId);
        assert(result.success === true, "Expected success");
    });

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
    console.error("Fatal:", e);
    process.exit(1);
});
