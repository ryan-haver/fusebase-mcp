/**
 * E2E test for all 3 advanced column types: Subtable, Relation, Lookup.
 * Creates 2 fresh databases, adds columns, verifies schema, then cleans up.
 * 
 * Run: npx tsx scripts/test-advanced-columns.ts
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

let db1Id = "", db1Dash = "", db1View = "";
let db2Id = "", db2Dash = "", db2View = "";
let passed = 0, failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.log(`  ❌ ${label}${detail ? " — " + detail : ""}`);
        failed++;
    }
}

async function run() {
    console.log("▶ Creating test databases...");
    const cr1 = await c.createDatabase("adv-test-source");
    const d1 = (cr1 as any).data;
    db1Id = d1.global_id; db1Dash = d1.dashboards[0].global_id; db1View = d1.dashboards[0].views[0].global_id;

    const cr2 = await c.createDatabase("adv-test-target");
    const d2 = (cr2 as any).data;
    db2Id = d2.global_id; db2Dash = d2.dashboards[0].global_id; db2View = d2.dashboards[0].views[0].global_id;

    console.log(`  DB1 (source): ${db1Id}`);
    console.log(`  DB2 (target): ${db2Id}`);

    // ════════════════════
    // TEST 1: Subtable
    // ════════════════════
    console.log("\n═══ TEST 1: Subtable column ═══");
    try {
        const subResult = await c.addDatabaseColumn(db1Dash, db1View, "SubItems", "subtable");
        assert("Subtable column created", subResult.success);
        assert("Subtable key returned", !!subResult.column.key);

        const schema1 = await c.getViewSchema(db1Dash, db1View);
        const subCol = schema1.columns.find(c => c.name === "SubItems");
        assert("Subtable appears in schema", !!subCol);
        assert("Subtable type is child-table-link", subCol?.type === "child-table-link", `got: ${subCol?.type}`);
        assert("Subtable editType is child-table-link", subCol?.editType === "child-table-link", `got: ${subCol?.editType}`);
    } catch (e: any) {
        console.log(`  ❌ Subtable test failed: ${e.message}`);
        failed++;
    }

    // ════════════════════
    // TEST 2: Relation
    // ════════════════════
    console.log("\n═══ TEST 2: Relation column ═══");
    let relationKey = "";
    try {
        const relResult = await c.addRelationColumn(db1Dash, db1View, "Related Items", db2Dash, db2View);
        assert("Relation column created", relResult.success);
        assert("Relation key returned", !!relResult.column.key);
        assert("Relation ID returned", !!relResult.relationId);
        relationKey = relResult.column.key;

        const schema2 = await c.getViewSchema(db1Dash, db1View);
        const relCol = schema2.columns.find(c => c.name === "Related Items");
        assert("Relation appears in schema", !!relCol);
        assert("Relation type is lookup", relCol?.type === "lookup", `got: ${relCol?.type}`);
        
        // Check raw schema for the relations[] array
        const rawItems = (schema2.rawSchema as any)?.items || [];
        const rawRelCol = rawItems.find((i: any) => i.name === "Related Items");
        assert("Relation has source.relations[]", !!rawRelCol?.source?.relations?.length, `has ${rawRelCol?.source?.relations?.length || 0} relations`);
        assert("Relation selectable is true", rawRelCol?.source?.selectable === true);
    } catch (e: any) {
        console.log(`  ❌ Relation test failed: ${e.message}`);
        failed++;
    }

    // ════════════════════
    // TEST 3: Lookup
    // ════════════════════
    console.log("\n═══ TEST 3: Lookup column ═══");
    try {
        if (!relationKey) throw new Error("Skipping: Relation test failed, no relation key available");
        
        const lookResult = await c.addLookupColumn(db1Dash, db1View, "Target Name", relationKey);
        assert("Lookup column created", lookResult.success);
        assert("Lookup key returned", !!lookResult.column.key);

        const schema3 = await c.getViewSchema(db1Dash, db1View);
        const lookCol = schema3.columns.find(c => c.name === "Target Name");
        assert("Lookup appears in schema", !!lookCol);
        assert("Lookup type is lookup", lookCol?.type === "lookup", `got: ${lookCol?.type}`);
        assert("Lookup is readonly", lookCol?.readonly === true);
        
        // Check raw schema
        const rawItems = (schema3.rawSchema as any)?.items || [];
        const rawLookCol = rawItems.find((i: any) => i.name === "Target Name");
        assert("Lookup has source.relations[]", !!rawLookCol?.source?.relations?.length);
        assert("Lookup selectable is false", rawLookCol?.source?.selectable === false);
    } catch (e: any) {
        console.log(`  ❌ Lookup test failed: ${e.message}`);
        failed++;
    }

    // ════════════════════
    // Full schema dump
    // ════════════════════
    console.log("\n═══ FINAL SCHEMA ═══");
    const finalSchema = await c.getViewSchema(db1Dash, db1View);
    for (const col of finalSchema.columns) {
        console.log(`  "${col.name}" (${col.key}): type=${col.type} editType=${col.editType} hidden=${col.hidden} readonly=${col.readonly}`);
    }

    // ════════════════════
    // Cleanup
    // ════════════════════
    console.log("\n▶ Cleanup...");
    await c.deleteDatabase(db1Id);
    await c.deleteDatabase(db2Id);
    console.log("  Deleted both test databases");

    console.log(`\n════════════════════════════════`);
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log(`════════════════════════════════`);
    
    if (failed > 0) process.exit(1);
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
