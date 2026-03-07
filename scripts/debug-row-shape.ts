/**
 * Debug: check getDashboardDetail for column schema
 */
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
        const t = line.trim(); if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq > 0 && !process.env[t.slice(0, eq).trim()])
            process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
}

import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";
const c = loadEncryptedCookie();
const client = new FusebaseClient({ host: "inkabeam.nimbusweb.me", orgId: "u268r1", cookie: c?.cookie || "" });

const dashboardId = "e14f8a1b-21d3-4ec6-a175-58577f2dc1fe";
const viewId = "3b6813b6-543a-403b-b42e-2a148e501e10";

console.error("[debug] getDashboardDetail...");
const dd = await client.getDashboardDetail(dashboardId) as any;
process.stdout.write("DASHBOARD_KEYS: " + JSON.stringify(Object.keys(dd.data ?? dd)) + "\n");

const dash = dd.data ?? dd;
// Print full dashboard (columns might be here)
process.stdout.write("DASHBOARD_root_items: " + JSON.stringify(Object.entries(dash).filter(([k]) => k.startsWith('root') || k === 'columns' || k === 'schema' || k === 'fields').map(([k, v]) => `${k}=${JSON.stringify(v).substring(0, 100)}`)) + "\n");

const views = dash.views ?? [];
const view = views.find((v: any) => v.global_id === viewId) ?? views[0];
process.stdout.write("VIEW_KEYS: " + JSON.stringify(Object.keys(view ?? {})) + "\n");
const viewSchemaLike = Object.entries(view ?? {}).filter(([k]) => k === 'schema' || k === 'columns' || k === 'fields' || k === 'items');
process.stdout.write("VIEW_SCHEMA_ENTRIES: " + JSON.stringify(viewSchemaLike.map(([k, v]) => `${k}=${JSON.stringify(v).substring(0, 200)}`)) + "\n");
process.stdout.write("VIEW: " + JSON.stringify(view).substring(0, 800) + "\n");

// Now also get the raw data to see row structure
console.error("[debug] getDatabaseData...");
const rd = await client.getDatabaseData(dashboardId, viewId, { limit: 1 }) as any;
process.stdout.write("DATA_TOP_KEYS: " + JSON.stringify(Object.keys(rd)) + "\n");
const row0 = rd.data?.[0] ?? rd.rows?.[0];
if (row0) {
    process.stdout.write("ROW_KEYS: " + JSON.stringify(Object.keys(row0)) + "\n");
    // Find UUID-like field
    const uuidLike = Object.entries(row0).filter(([, v]) => typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v as string));
    process.stdout.write("UUID_FIELDS: " + JSON.stringify(uuidLike.map(([k, v]) => `${k}=${v}`)) + "\n");
}
