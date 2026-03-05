/**
 * Probe v3: Focus on view creation and list-all-databases
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

import { loadEncryptedCookie } from "../src/crypto.js";

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const ORG_ID = process.env.FUSEBASE_ORG_ID || "";
const cookie = process.env.FUSEBASE_COOKIE || loadEncryptedCookie()?.cookie || "";
const base = `https://${HOST}/v4/api/proxy/dashboard-service/v1`;
const out: string[] = [];
const log = (s: string) => { out.push(s); console.log(s); };

async function api(method: string, path: string, body?: unknown) {
    const res = await fetch(`${base}${path}`, {
        method,
        headers: { cookie, "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.text() };
}

async function main() {
    // 1. Create test DB
    const dbId = crypto.randomUUID();
    const cr = await api("POST", "/databases", {
        global_id: dbId, title: "probe-v3", is_public: false,
        metadata: { description: "v3", icon: "default", favorite: false, color: "gray" },
        scopes: [{ scope_type: "org", scope_id: ORG_ID }],
    });
    const dbData = JSON.parse(cr.body);
    const dashId = dbData?.data?.dashboards?.[0]?.global_id;
    log(`Created DB: ${dbId}, Dashboard: ${dashId}`);

    // 2. Get dashboard detail (contains view + schema)
    const dashRes = await api("GET", `/dashboards/${dashId}`);
    log(`\n--- Dashboard Detail (GET /dashboards/${dashId}) ---`);
    log(dashRes.body);

    // Parse existing view schema
    const dd = JSON.parse(dashRes.body);
    const existingView = dd?.data?.views?.[0];
    const schema = existingView?.schema || [];
    const viewId = existingView?.global_id;
    log(`\nExisting View: ${viewId}`);
    log(`Schema: ${JSON.stringify(schema)}`);

    // 3. Try list databases with scope query params
    log(`\n--- List All Databases ---`);
    const listRes = await api("GET", `/databases?scope_type=org&scope_id=${ORG_ID}`);
    log(`GET /databases?scope_type=org&scope_id=${ORG_ID}: ${listRes.status}`);
    if (listRes.status < 400) {
        const listData = JSON.parse(listRes.body);
        const dbs = listData?.data || [];
        log(`Found ${Array.isArray(dbs) ? dbs.length : 'N/A'} databases`);
        if (Array.isArray(dbs)) {
            for (const d of dbs.slice(0, 5)) {
                log(`  - ${d.global_id}: "${d.title}" (dashboards: ${d.dashboards?.length || 0})`);
            }
        }
    } else {
        log(`Err: ${listRes.body.slice(0, 200)}`);
    }

    // 4. Create a view with schema + filters
    log(`\n--- Add View (POST /dashboards/${dashId}/views) ---`);
    const attempts = [
        // Attempt 1: filters=[], schema=existing, sorts=[]
        { global_id: crypto.randomUUID(), name: "view-A", schema, filters: [], sorts: [] },
        // Attempt 2: add hidden_columns=[]
        { global_id: crypto.randomUUID(), name: "view-B", schema, filters: [], sorts: [], hidden_columns: [] },
        // Attempt 3: add representation
        { global_id: crypto.randomUUID(), name: "kanban-C", schema, filters: [], sorts: [], hidden_columns: [], representation: "kanban" },
    ];
    for (const body of attempts) {
        const r = await api("POST", `/dashboards/${dashId}/views`, body);
        log(`\nPOST /views (${body.name}): ${r.status}`);
        log(`  Body sent: ${JSON.stringify(body).slice(0, 200)}`);
        log(`  Response: ${r.body.slice(0, 400)}`);
    }

    // 5. Check dashboard detail again to see created views
    const dashRes2 = await api("GET", `/dashboards/${dashId}`);
    const dd2 = JSON.parse(dashRes2.body);
    const views = dd2?.data?.views || [];
    log(`\n--- Views after creation ---`);
    for (const v of views) {
        log(`  View: ${v.global_id} name="${v.name}" hidden=${v.hidden_columns?.length || 0}`);
    }

    // 6. Delete a created view
    if (views.length > 1) {
        const delView = views[views.length - 1];
        const dr = await api("DELETE", `/dashboards/${dashId}/views/${delView.global_id}`);
        log(`\nDELETE /views/${delView.global_id}: ${dr.status}`);
        log(`  Response: ${dr.body.slice(0, 200)}`);
    }

    // 7. Update view (PATCH/PUT)
    if (viewId) {
        for (const method of ["PATCH", "PUT"] as const) {
            const r = await api(method, `/dashboards/${dashId}/views/${viewId}`, {
                name: "renamed-view",
                filters: [{ column: "title", op: "contains", value: "test" }],
            });
            log(`\n${method} /views/${viewId}: ${r.status}`);
            log(`  Response: ${r.body.slice(0, 200)}`);
        }
    }

    // Cleanup
    await api("DELETE", `/databases/${dbId}`);
    log(`\nCleanup: deleted DB ${dbId}`);

    // Save
    fs.writeFileSync(path.resolve(__dirname, "..", "data", "probe-v3-output.txt"), out.join("\n"));
}

main().catch(e => { log(`ERROR: ${e}`); fs.writeFileSync(path.resolve(__dirname, "..", "data", "probe-v3-output.txt"), out.join("\n")); });
