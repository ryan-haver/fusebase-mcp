/**
 * E2E test for Phase 9 database tools (updated for createDatabase + addDatabaseRow)
 */
import * as fs from "fs";
import * as path from "path";
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

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const ORG_ID = process.env.FUSEBASE_ORG_ID || "";
const cookie = process.env.FUSEBASE_COOKIE || loadEncryptedCookie()?.cookie || "";

const client = new FusebaseClient({ host: HOST, orgId: ORG_ID, cookie });

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
    if (ok) { console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`); passed++; }
    else { console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); failed++; }
}

async function main() {
    console.log("=== Phase 9: Database CRUD ===\n");

    // Test 1: List databases
    let databases: Array<{ dashboardId: string; viewId: string; entity: string }> = [];
    try {
        databases = await client.listDatabases();
        check("listDatabases", databases.length > 0, `${databases.length} databases found`);
        for (const db of databases) {
            console.log(`    → ${db.entity}: dashboard=${db.dashboardId}, view=${db.viewId}`);
        }
    } catch (err) {
        check("listDatabases", false, (err as Error).message.slice(0, 100));
    }

    // Test 2: Get database data for each discovered database
    if (databases.length > 0) {
        for (const db of databases) {
            try {
                const data = await client.getDatabaseData(db.dashboardId, db.viewId, { limit: 3 });
                const count = Array.isArray(data.data) ? data.data.length : 0;
                check(`getDatabaseData(${db.entity})`, true, `${count} rows, total=${data.meta?.total}`);
            } catch (err) {
                check(`getDatabaseData(${db.entity})`, false, (err as Error).message.slice(0, 100));
            }
        }
    }

    // Test 3: Get database entity by name
    if (databases.length > 0) {
        const firstEntity = databases[0].entity;
        try {
            const data = await client.getDatabaseEntity(firstEntity, { limit: 3 });
            check(`getDatabaseEntity("${firstEntity}")`, true, `${data.data?.length || 0} rows`);
        } catch (err) {
            check(`getDatabaseEntity("${firstEntity}")`, false, (err as Error).message.slice(0, 100));
        }
    }

    // Test 4: Create a new database
    let createdDb: { global_id: string; dashboards: Array<{ global_id: string }> } | null = null;
    try {
        const result = await client.createDatabase("e2e-test-db", {
            description: "Automated E2E test database",
            color: "blue",
        });
        check("createDatabase", result.success === true, `id=${result.data?.global_id}, dashboards=${result.data?.dashboards?.length}`);
        createdDb = result.data as any;
        console.log(`    → database_id=${createdDb!.global_id}`);
        if (createdDb!.dashboards?.[0]) {
            console.log(`    → dashboard_id=${createdDb!.dashboards[0].global_id}`);
        }
    } catch (err) {
        check("createDatabase", false, (err as Error).message.slice(0, 100));
    }

    // Test 5: Add a row to the created database
    if (createdDb && createdDb.dashboards?.[0]) {
        try {
            const result = await client.addDatabaseRow("custom", {
                databaseId: createdDb.global_id,
                dashboardId: createdDb.dashboards[0].global_id,
            });
            check("addDatabaseRow (custom)", (result as any).success === true, `status=${(result as any).status}`);
        } catch (err) {
            check("addDatabaseRow (custom)", false, (err as Error).message.slice(0, 100));
        }
    }

    console.log(`\n=== Results: ${passed}/${passed + failed} passed ===`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
