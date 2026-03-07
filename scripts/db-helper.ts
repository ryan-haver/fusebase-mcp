import * as path from "path"; import * as fs from "fs"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) { for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq > 0 && !process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim(); } }
import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";
const sc = loadEncryptedCookie();
const c = new FusebaseClient({ host: process.env.FUSEBASE_HOST||"inkabeam.nimbusweb.me", orgId: process.env.FUSEBASE_ORG_ID||"", cookie: process.env.FUSEBASE_COOKIE||sc?.cookie||"" });

const action = process.argv[2];

if (action === "create") {
    const cr1 = await c.createDatabase("schema-capture");
    const d1 = (cr1 as any).data;
    const cr2 = await c.createDatabase("link-target");
    const d2 = (cr2 as any).data;
    console.log(JSON.stringify({
        db1: { id: d1.global_id, dash: d1.dashboards[0].global_id, view: d1.dashboards[0].views[0].global_id },
        db2: { id: d2.global_id, dash: d2.dashboards[0].global_id, view: d2.dashboards[0].views[0].global_id },
    }));
} else if (action === "schema") {
    const dashId = process.argv[3];
    const viewId = process.argv[4];
    const s = await c.getViewSchema(dashId, viewId);
    console.log(JSON.stringify(s, null, 2));
} else if (action === "schema-raw") {
    const dashId = process.argv[3];
    const viewId = process.argv[4];
    const COOKIE = (c as any).cookie;
    const BASE = `https://${(c as any).host}`;
    const res = await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/views/${viewId}`, { headers: { cookie: COOKIE } });
    const data = await res.json() as any;
    // Dump only the schema items
    const items = data?.data?.schema?.items || [];
    for (const item of items) {
        console.log(`--- ${item.name} (key: ${item.key}) ---`);
        console.log(JSON.stringify(item, null, 2));
        console.log();
    }
} else if (action === "cleanup") {
    const ids = process.argv.slice(3);
    for (const id of ids) {
        await c.deleteDatabase(id);
        console.log(`Deleted ${id}`);
    }
} else {
    console.log("Usage: npx tsx scripts/db-helper.ts create|schema|schema-raw|cleanup [args...]");
}
