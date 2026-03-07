/**
 * Clean create-view test with output to file for clarity
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
const c = new FusebaseClient({ host: HOST, orgId: process.env.FUSEBASE_ORG_ID || "", cookie: COOKIE });

const log: string[] = [];
function L(...args: any[]) { const s = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '); log.push(s); }

async function probe(label: string, dashId: string, body: any): Promise<number> {
    const opts: RequestInit = { method: "POST", headers: { cookie: COOKIE, "content-type": "application/json" } };
    if (body !== undefined) opts.body = typeof body === "string" ? body : JSON.stringify(body);
    const res = await fetch(`https://${HOST}/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views`, opts);
    const text = await res.text();
    L(`[${res.status}] ${label}: ${text.substring(0, 300)}`);
    if (res.status === 201) {
        try {
            const d = JSON.parse(text);
            const vid = d?.data?.global_id;
            if (vid) { L(`  -> Created view ${vid}, cleaning up`);
                await fetch(`https://${HOST}/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views/${vid}`, { method: "DELETE", headers: { cookie: COOKIE } });
            }
        } catch {}
    }
    return res.status;
}

async function run() {
    const cr = await c.createDatabase("cv-clean-test");
    const d = (cr as any).data;
    const dashId = d.dashboards[0].global_id;
    const viewId = d.dashboards[0].views[0].global_id;
    L(`dash=${dashId} view=${viewId}\n`);

    await probe("1. global_id only", dashId, { global_id: crypto.randomUUID() });
    await probe("2. global_id+name", dashId, { global_id: crypto.randomUUID(), name: "Test" });
    await probe("3. global_id+name+dashboard_id", dashId, { global_id: crypto.randomUUID(), name: "TestV", dashboard_id: dashId });
    await probe("4. global_id+name+source_view_id (dup)", dashId, { global_id: crypto.randomUUID(), name: "Dup", source_view_id: viewId });
    await probe("5. global_id+name+source_view_id+dashboard_id", dashId, { global_id: crypto.randomUUID(), name: "Dup2", source_view_id: viewId, dashboard_id: dashId });
    
    // Try delete
    const createRes = await fetch(`https://${HOST}/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views`, {
        method: "POST", headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify({ global_id: crypto.randomUUID(), name: "ToDelete", dashboard_id: dashId })
    });
    if (createRes.status === 201) {
        const cd = await createRes.json();
        const vid = cd?.data?.global_id;
        L(`\nCreated view for delete test: ${vid}`);
        const delRes = await fetch(`https://${HOST}/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views/${vid}`, { method: "DELETE", headers: { cookie: COOKIE } });
        L(`DELETE view ${vid} -> ${delRes.status} ${await delRes.text()}`);
    }

    // Try duplicate DB
    L("\n--- DUPLICATE DATABASE ---");
    const dupRes = await fetch(`https://${HOST}/v4/api/proxy/dashboard-service/v1/databases/copy-from/database?copy_tables=true&copy_views=true&copy_relations=true&copy_data=true&create_default_rows=true`, {
        method: "POST", headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify({ source_database_id: d.global_id })
    });
    const dupText = await dupRes.text();
    L(`POST copy-from/database -> ${dupRes.status}: ${dupText.substring(0, 200)}`);
    if (dupRes.status === 201) {
        try { const dd = JSON.parse(dupText); await c.deleteDatabase(dd.data.global_id); L("  Cleaned up dup"); } catch {}
    }

    await c.deleteDatabase(d.global_id);
    L("\nDone!");
    
    // Write to file
    fs.writeFileSync(path.resolve(__dirname, "..", "artifacts", "probe-results.txt"), log.join("\n"), "utf-8");
    console.log("Results saved to artifacts/probe-results.txt");
}

run().catch(e => { L(`FATAL: ${e.message}`); fs.writeFileSync(path.resolve(__dirname, "..", "artifacts", "probe-results.txt"), log.join("\n"), "utf-8"); process.exit(1); });
