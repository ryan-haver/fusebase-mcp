/**
 * Diagnostic: capture full error bodies from createView and duplicateDatabase
 */
import * as path from "path"; import * as fs from "fs"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) { for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq > 0 && !process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim(); } }
import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";

const sc = loadEncryptedCookie();
const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const COOKIE = process.env.FUSEBASE_COOKIE || sc?.cookie || "";
const ORG_ID = process.env.FUSEBASE_ORG_ID || "";
const c = new FusebaseClient({ host: HOST, orgId: ORG_ID, cookie: COOKIE });
const log: string[] = [];
function L(...a: any[]) { log.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x, null, 2)).join(' ')); }

async function run() {
    // Setup
    const cr = await c.createDatabase("diag-test");
    const d = (cr as any).data;
    const dbId = d.global_id;
    const dashId = d.dashboards[0].global_id;
    const viewId = d.dashboards[0].views[0].global_id;
    L(`Setup: db=${dbId} dash=${dashId} view=${viewId} orgId=${ORG_ID}`);

    // 1. Test createView via client method (which fetches schema)
    L("\n=== CREATE VIEW (via client) ===");
    try {
        const result = await c.createView(dashId, "DiagView");
        L("SUCCESS:", result);
    } catch (e: any) {
        L("ERROR:", e.message);
    }

    // 2. Test createView with raw fetch + manually fetched schema
    L("\n=== CREATE VIEW (raw fetch with schema) ===");
    try {
        // Get the view detail with schema
        const vDetailRes = await fetch(`https://${HOST}/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views/${viewId}`, {
            headers: { cookie: COOKIE }
        });
        const vDetail = await vDetailRes.json();
        L("View detail status:", vDetailRes.status);
        L("Schema keys:", Object.keys(vDetail?.data?.schema || {}));

        const body = {
            global_id: crypto.randomUUID(),
            name: "RawDiagView",
            schema: vDetail?.data?.schema
        };
        L("Request body keys:", Object.keys(body));
        L("Schema has root_entity:", body.schema?.root_entity);
        L("Schema items count:", body.schema?.items?.length);

        const res = await fetch(`https://${HOST}/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views`, {
            method: "POST",
            headers: { cookie: COOKIE, "content-type": "application/json" },
            body: JSON.stringify(body)
        });
        const text = await res.text();
        L(`Response: ${res.status} ${text.substring(0, 500)}`);
    } catch (e: any) {
        L("ERROR:", e.message);
    }

    // 3. Test duplicateDatabase via client method
    L("\n=== DUPLICATE DATABASE (via client) ===");
    try {
        const result = await c.duplicateDatabase(dbId);
        L("SUCCESS:", JSON.stringify(result).substring(0, 300));
        if ((result.data as any)?.global_id) {
            await c.deleteDatabase((result.data as any).global_id);
            L("Cleaned up duplicate");
        }
    } catch (e: any) {
        L("ERROR:", e.message);
    }

    // 4. Test duplicateDatabase with raw fetch
    L("\n=== DUPLICATE DATABASE (raw fetch with scopes) ===");
    const body = {
        source_database_id: dbId,
        scopes: [{ scope_type: "org", scope_id: ORG_ID }]
    };
    L("Request body:", body);
    const res = await fetch(`https://${HOST}/v4/api/proxy/dashboard-service/v1/databases/copy-from/database?copy_tables=true&copy_views=true&copy_relations=true&copy_data=true&create_default_rows=true`, {
        method: "POST",
        headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify(body)
    });
    const text = await res.text();
    L(`Response: ${res.status} ${text.substring(0, 500)}`);
    if (res.status === 201) {
        try { const dd = JSON.parse(text); await c.deleteDatabase(dd.data.global_id); L("Cleaned up dup"); } catch {}
    }

    // Cleanup
    await c.deleteDatabase(dbId);
    L("\nDone!");

    fs.writeFileSync(path.resolve(__dirname, "..", "artifacts", "diag-results.txt"), log.join("\n"), "utf-8");
    console.log("Results saved to artifacts/diag-results.txt");
}

run().catch(e => { L(`FATAL: ${e.message}`); fs.writeFileSync(path.resolve(__dirname, "..", "artifacts", "diag-results.txt"), log.join("\n"), "utf-8"); process.exit(1); });
