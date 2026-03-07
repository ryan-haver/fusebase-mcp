/**
 * E2E test for all newly discovered database features:
 * - Favorite/unfavorite (via updateDatabase)
 * - Duplicate database
 * - CSV export
 * - Create view
 * - Delete view
 * - All 8 view representations
 * 
 * Run: npx tsx scripts/test-new-features.ts
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

let passed = 0, failed = 0, total = 0;
function test(name: string, ok: boolean, detail?: string) {
    total++;
    if (ok) { passed++; console.log(`  ✅ ${name}${detail ? " — " + detail : ""}`); }
    else { failed++; console.log(`  ❌ ${name}${detail ? " — " + detail : ""}`); }
}

async function run() {
    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║   E2E TEST: NEWLY DISCOVERED DATABASE FEATURES      ║");
    console.log("╚══════════════════════════════════════════════════════╝\n");

    // Setup: create a test database with some rows
    console.log("▶ Setup...");
    const cr = await c.createDatabase("e2e-new-features");
    const d = (cr as any).data;
    const dbId = d.global_id;
    const dashId = d.dashboards[0].global_id;
    const viewId = d.dashboards[0].views[0].global_id;
    console.log(`  DB=${dbId} DASH=${dashId} VIEW=${viewId}\n`);

    // Add rows for CSV export test
    for (let i = 1; i <= 3; i++) {
        await c.addDatabaseRow(`Row ${i}`, { databaseId: dbId, dashboardId: dashId, orgId: process.env.FUSEBASE_ORG_ID || "" });
    }

    // ═════════════════════════════════════════
    // 1. FAVORITE / UNFAVORITE
    // ═════════════════════════════════════════
    console.log("─── Favorite / Unfavorite ───");
    const favRes = await c.updateDatabase(dbId, { favorite: true });
    test("Favorite database", favRes.success && (favRes.data as any)?.metadata?.favorite === true);

    const unfavRes = await c.updateDatabase(dbId, { favorite: false });
    test("Unfavorite database", unfavRes.success && (unfavRes.data as any)?.metadata?.favorite === false);

    // ═════════════════════════════════════════
    // 2. DUPLICATE DATABASE
    // ═════════════════════════════════════════
    console.log("\n─── Duplicate Database ───");
    let dupDbId: string | undefined;
    try {
        const dupRes = await c.duplicateDatabase(dbId);
        dupDbId = (dupRes.data as any)?.global_id;
        test("Duplicate database (with data)", dupRes.success && !!dupDbId, `new DB: ${dupDbId}`);
    } catch (e: any) {
        test("Duplicate database (with data)", false, e.message.substring(0, 80));
    }

    try {
        const dupRes2 = await c.duplicateDatabase(dbId, { copyData: false });
        const dupDbId2 = (dupRes2.data as any)?.global_id;
        test("Duplicate database (structure only)", dupRes2.success && !!dupDbId2, `new DB: ${dupDbId2}`);
        if (dupDbId2) await c.deleteDatabase(dupDbId2);
    } catch (e: any) {
        test("Duplicate database (structure only)", false, e.message.substring(0, 80));
    }

    // ═════════════════════════════════════════
    // 3. CSV EXPORT
    // ═════════════════════════════════════════
    console.log("\n─── CSV Export ───");
    try {
        const csvRes = await c.exportCSV(dashId, viewId);
        test("CSV export (comma)", csvRes.success && csvRes.csv.includes("Name"), `${csvRes.csv.length} chars`);
    } catch (e: any) {
        test("CSV export (comma)", false, e.message.substring(0, 80));
    }

    try {
        const csvRes2 = await c.exportCSV(dashId, viewId, ";");
        test("CSV export (semicolon)", csvRes2.success && csvRes2.csv.includes(";"), `${csvRes2.csv.length} chars`);
    } catch (e: any) {
        test("CSV export (semicolon)", false, e.message.substring(0, 80));
    }

    try {
        const csvRes3 = await c.exportCSV(dashId, viewId, "\t");
        test("CSV export (tab)", csvRes3.success && csvRes3.csv.includes("\t"), `${csvRes3.csv.length} chars`);
    } catch (e: any) {
        test("CSV export (tab)", false, e.message.substring(0, 80));
    }

    // ═════════════════════════════════════════
    // 4. CREATE VIEW
    // ═════════════════════════════════════════
    console.log("\n─── Create View ───");
    let newViewId: string | undefined;
    try {
        const cvRes = await c.createView(dashId, "My Custom View");
        newViewId = cvRes.data?.global_id;
        test("Create view with name", cvRes.success && !!newViewId, `view: ${newViewId}`);
    } catch (e: any) {
        test("Create view with name", false, e.message.substring(0, 80));
    }

    let newViewId2: string | undefined;
    try {
        const cvRes2 = await c.createView(dashId);
        newViewId2 = cvRes2.data?.global_id;
        test("Create view (auto name)", cvRes2.success && !!newViewId2, `view: ${newViewId2}`);
    } catch (e: any) {
        test("Create view (auto name)", false, e.message.substring(0, 80));
    }

    // ═════════════════════════════════════════
    // 5. DELETE VIEW
    // ═════════════════════════════════════════
    console.log("\n─── Delete View ───");
    if (newViewId2) {
        try {
            const delRes = await c.deleteView(dashId, newViewId2);
            test("Delete view", delRes.success);
        } catch (e: any) {
            test("Delete view", false, e.message.substring(0, 80));
        }
    }

    // ═════════════════════════════════════════
    // 6. ALL 8 VIEW REPRESENTATIONS
    // ═════════════════════════════════════════
    console.log("\n─── View Representations (all 8) ───");
    const testView = newViewId || viewId;
    const reps: Array<"table" | "kanban" | "board" | "calendar" | "timeline" | "gallery" | "list" | "grid"> = 
        ["kanban", "board", "calendar", "timeline", "gallery", "list", "grid", "table"];
    
    for (const rep of reps) {
        try {
            const repRes = await c.setViewRepresentation(dashId, testView, rep);
            test(`Set representation: ${rep}`, repRes.success);
        } catch (e: any) {
            test(`Set representation: ${rep}`, false, e.message.substring(0, 80));
        }
    }

    // ═════════════════════════════════════════
    // CLEANUP
    // ═════════════════════════════════════════
    console.log("\n▶ Cleanup...");
    await c.deleteDatabase(dbId);
    if (dupDbId) await c.deleteDatabase(dupDbId).catch(() => {});
    console.log("  Done!");

    // ═════════════════════════════════════════
    // SUMMARY
    // ═════════════════════════════════════════
    console.log(`\n════════════════════════════════════════`);
    console.log(`  RESULTS: ${passed}/${total} passed, ${failed} failed`);
    console.log(`════════════════════════════════════════\n`);

    if (failed > 0) process.exit(1);
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
