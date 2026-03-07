/**
 * E2E Test: Database Column Management Tools
 *
 * Tests: get_database_schema, add_database_column, delete_database_column
 *
 * Flow:
 * 1. Create a fresh database
 * 2. Get initial schema (should have 5 default columns)
 * 3. Add columns of each type: number, checkbox, email, label
 * 4. Verify schema now has 9 columns
 * 5. Add a row and write to the new columns
 * 6. Read back and verify values
 * 7. Delete one custom column
 * 8. Verify schema has 8 columns
 * 9. Cleanup: delete database
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

const ORG_ID = (client as any).orgId;

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.error(`  ❌ ${label}`);
        failed++;
    }
}

let DB_ID = "";

try {
    // ── 1. Create database ──
    console.log("\n=== 1. Create database ===");
    const createRes = await client.createDatabase("column-e2e-test");
    const dbData = (createRes as any).data;
    DB_ID = dbData.global_id;
    const DASH_ID = dbData.dashboards[0].global_id;
    const VIEW_ID = dbData.dashboards[0].views[0].global_id;
    assert(!!DB_ID, `Database created: ${DB_ID}`);
    assert(!!DASH_ID, `Dashboard: ${DASH_ID}`);
    assert(!!VIEW_ID, `View: ${VIEW_ID}`);
    console.log(`  DB=${DB_ID} | DASH=${DASH_ID} | VIEW=${VIEW_ID}`);

    // ── 2. Get initial schema ──
    console.log("\n=== 2. Get initial schema ===");
    const schema1 = await client.getViewSchema(DASH_ID, VIEW_ID);
    assert(schema1.columns.length === 5, `Initial schema has 5 columns (got ${schema1.columns.length})`);
    const colNames = schema1.columns.map(c => c.name);
    console.log(`  Columns: ${colNames.join(", ")}`);
    assert(colNames.includes("Name"), "Has 'Name' column");
    assert(colNames.includes("Status"), "Has 'Status' column");

    // ── 3. Add columns ──
    console.log("\n=== 3. Add columns ===");

    const addNum = await client.addDatabaseColumn(DASH_ID, VIEW_ID, "Price", "number");
    assert(addNum.success, `Added 'Price' (number): key=${addNum.column.key}`);

    const addCheck = await client.addDatabaseColumn(DASH_ID, VIEW_ID, "Active", "checkbox");
    assert(addCheck.success, `Added 'Active' (checkbox): key=${addCheck.column.key}`);

    const addEmail = await client.addDatabaseColumn(DASH_ID, VIEW_ID, "Contact", "email");
    assert(addEmail.success, `Added 'Contact' (email): key=${addEmail.column.key}`);

    const addLabel = await client.addDatabaseColumn(DASH_ID, VIEW_ID, "Priority", "label", {
        labels: [
            { name: "Low", color: "gray" },
            { name: "Medium", color: "yellow" },
            { name: "High", color: "red" },
            { name: "Critical", color: "purple" },
        ],
    });
    assert(addLabel.success, `Added 'Priority' (label): key=${addLabel.column.key}`);

    // ── 4. Verify schema has 9 columns ──
    console.log("\n=== 4. Verify schema ===");
    const schema2 = await client.getViewSchema(DASH_ID, VIEW_ID);
    assert(schema2.columns.length === 9, `Schema now has 9 columns (got ${schema2.columns.length})`);
    const newNames = schema2.columns.map(c => `${c.name} (${c.type})`);
    console.log(`  Columns: ${newNames.join(", ")}`);
    assert(schema2.columns.some(c => c.name === "Price" && c.type === "number"), "Price column exists with type 'number'");
    assert(schema2.columns.some(c => c.name === "Active" && c.type === "boolean"), "Active column exists with type 'boolean'");
    assert(schema2.columns.some(c => c.name === "Contact" && c.type === "email"), "Contact column exists with type 'email'");
    assert(schema2.columns.some(c => c.name === "Priority" && c.type === "label"), "Priority column exists with type 'label'");

    // ── 5. Add a row and write to new columns ──
    console.log("\n=== 5. Add row + write cells ===");
    await client.addDatabaseRow("custom", { databaseId: DB_ID, dashboardId: DASH_ID, orgId: ORG_ID });
    await new Promise(r => setTimeout(r, 2000));

    // Get row UUID
    const rowData = await client.getDatabaseRows(DASH_ID, VIEW_ID);
    assert(rowData.rows.length > 0, `Got ${rowData.rows.length} row(s)`);
    const rowUuid = rowData.rows[0].rowUuid;
    console.log(`  Row UUID: ${rowUuid}`);

    // Write to Name column
    const nameKey = schema2.columns.find(c => c.name === "Name")!.key;
    const writeNameRes = await client.updateDatabaseCell(DASH_ID, VIEW_ID, rowUuid, nameKey, "Test Item");
    assert((writeNameRes as any).success !== false, `Write Name: status OK`);

    // Write to Price column
    const writePrice = await client.updateDatabaseCell(DASH_ID, VIEW_ID, rowUuid, addNum.column.key, 99.95);
    assert((writePrice as any).success !== false, `Write Price: status OK`);

    // Write to Contact column
    const writeEmail = await client.updateDatabaseCell(DASH_ID, VIEW_ID, rowUuid, addEmail.column.key, "test@example.com");
    assert((writeEmail as any).success !== false, `Write Contact: status OK`);

    // ── 6. Read back ──
    console.log("\n=== 6. Read back row data ===");
    await new Promise(r => setTimeout(r, 1000));
    const rows2 = await client.getDatabaseRows(DASH_ID, VIEW_ID);
    const row = rows2.rows[0];
    console.log(`  Row cells: ${JSON.stringify(row.cells).substring(0, 500)}`);
    // Check that the name key has our value
    assert(row.cells[nameKey] === "Test Item", `Name cell = "Test Item"`);

    // ── 7. Delete a column ──
    console.log("\n=== 7. Delete column ===");
    const deleteRes = await client.deleteDatabaseColumn(DASH_ID, VIEW_ID, addCheck.column.key);
    assert(deleteRes.success, `Deleted 'Active' column: ${deleteRes.message}`);

    // ── 8. Verify schema has 8 columns ──
    console.log("\n=== 8. Verify schema after delete ===");
    const schema3 = await client.getViewSchema(DASH_ID, VIEW_ID);
    assert(schema3.columns.length === 8, `Schema now has 8 columns (got ${schema3.columns.length})`);
    assert(!schema3.columns.some(c => c.name === "Active"), "'Active' column is gone");

    console.log(`\n${"=".repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;

} finally {
    // ── 9. Cleanup ──
    if (DB_ID) {
        console.log("\n=== Cleanup ===");
        try {
            await client.deleteDatabase(DB_ID);
            console.log("  Database deleted");
        } catch (e) {
            console.error("  Cleanup failed:", e);
        }
    }
}
