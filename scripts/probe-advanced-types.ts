/**
 * Deep API probe for Subtable, Relation, and Lookup column types.
 * Tries many source.type / render.type / config combinations to find what the API accepts.
 * 
 * Run: npx tsx scripts/probe-advanced-types.ts
 */
import * as path from "path"; import * as fs from "fs"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) { for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq > 0 && !process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim(); } }
import { loadEncryptedCookie } from "../src/crypto.js";

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const cookieData = loadEncryptedCookie();
if (!cookieData?.cookie) throw new Error("No cookie");
const COOKIE = cookieData!.cookie;
const BASE = `https://${HOST}`;

const DB1_DASH = "b2d6b254-6474-47fc-b77f-c9ffb50f645a";
const DB1_VIEW = "14b17eca-14a0-4907-9ccc-6b9f87b9a393";
const DB2_DASH = "0cc2d349-4f57-4285-bcd5-70a15c63471c";
const DB2_VIEW = "51412086-e98c-473c-a099-388d78c96185";
const DB2_ID = "f2b6c462-ef42-43da-96f4-3517f1f05e4f";

function nanoid(len = 8): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < len; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
    return id;
}

async function getSchema(): Promise<any> {
    const res = await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${DB1_DASH}/views/${DB1_VIEW}`, { headers: { cookie: COOKIE } });
    return res.json();
}

async function tryAddColumn(label: string, columnDef: any): Promise<boolean> {
    const viewRes = await getSchema();
    const viewData = viewRes.data;
    const currentItems = viewData.schema?.items || [];
    
    const newItems = [...currentItems, columnDef];
    const payload = { schema: { ...viewData.schema, items: newItems } };
    
    const res = await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${DB1_DASH}/views/${DB1_VIEW}`, {
        method: "PUT",
        headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify(payload),
    });
    
    const body = await res.json().catch(() => null) as any;
    const ok = res.status >= 200 && res.status < 300 && body?.success;
    console.log(`  ${ok ? "✅" : "❌"} ${label}: status=${res.status} ${ok ? "SUCCESS" : (body?.message || JSON.stringify(body).substring(0, 150))}`);
    
    if (ok) {
        // Verify it was added by fetching schema
        const verify = await getSchema();
        const items = verify.data?.schema?.items || [];
        const newCol = items.find((i: any) => i.key === columnDef.key);
        if (newCol) {
            console.log(`     → Verified! source=${JSON.stringify(newCol.source)} render.type=${newCol.render?.type}`);
            // Remove it to keep the schema clean for next test
            const cleanItems = items.filter((i: any) => i.key !== columnDef.key);
            await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${DB1_DASH}/views/${DB1_VIEW}`, {
                method: "PUT",
                headers: { cookie: COOKIE, "content-type": "application/json" },
                body: JSON.stringify({ schema: { ...verify.data.schema, items: cleanItems } }),
            });
        }
    }
    return ok;
}

async function run() {
    console.log("▶ Deep API probe for Subtable, Relation, Lookup\n");
    
    const baseCol = (key: string, name: string) => ({
        key,
        name,
        description: `Test ${name}`,
        group_ids: [],
    });

    // ════════════════════════════════════════
    // SUBTABLE probes
    // ════════════════════════════════════════
    console.log("═══ SUBTABLE PROBES ═══");
    
    // Try source.type = "subtable"
    await tryAddColumn("subtable: source.type=subtable, render.type=subtable", {
        ...baseCol(nanoid(), "TestSub"),
        source: { type: "subtable" },
        render: { type: "subtable", is_lookup: false, edit_type: "subtable" },
        json_schema: { type: "array" },
    });

    await tryAddColumn("subtable: source.type=subtable, render=table", {
        ...baseCol(nanoid(), "TestSub2"),
        source: { type: "subtable" },
        render: { type: "table", is_lookup: false, edit_type: "table" },
        json_schema: { type: "array" },
    });

    // Try source.type = "custom" with custom_type = "subtable"  
    await tryAddColumn("subtable: source=custom+subtable, render.type=subtable", {
        ...baseCol(nanoid(), "TestSub3"),
        source: { _type_custom: true, type: "custom", custom_type: "subtable" },
        render: { type: "subtable", is_lookup: false, edit_type: "subtable", _type_subtable: true },
        json_schema: { type: "array" },
    });

    // Try source.type = "inline"  
    await tryAddColumn("subtable: source.type=inline, render.type=subtable", {
        ...baseCol(nanoid(), "TestSub4"),
        source: { type: "inline" },
        render: { type: "subtable", is_lookup: false, edit_type: "subtable" },
        json_schema: { type: "array" },
    });

    // Try source.type = "nested"
    await tryAddColumn("subtable: source.type=nested, render.type=subtable", {
        ...baseCol(nanoid(), "TestSub5"),
        source: { type: "nested" },
        render: { type: "subtable", is_lookup: false, edit_type: "subtable" },
        json_schema: { type: "array" },
    });

    // Try source.type = "embedded"
    await tryAddColumn("subtable: source.type=embedded, render.type=subtable", {
        ...baseCol(nanoid(), "TestSub6"),
        source: { type: "embedded" },
        render: { type: "subtable", is_lookup: false, edit_type: "subtable" },
        json_schema: { type: "array" },
    });

    // Try source.type = "child" 
    await tryAddColumn("subtable: source.type=child, render.type=subtable", {
        ...baseCol(nanoid(), "TestSub7"),
        source: { type: "child" },
        render: { type: "subtable", is_lookup: false },
        json_schema: { type: "array" },
    });

    // Try source.type = "sub_table" (underscore variant)
    await tryAddColumn("subtable: source.type=sub_table", {
        ...baseCol(nanoid(), "TestSub8"),
        source: { type: "sub_table" },
        render: { type: "subtable", is_lookup: false },
        json_schema: { type: "array" },
    });

    // Try source.type = "subTable" (camelCase)
    await tryAddColumn("subtable: source.type=subTable", {
        ...baseCol(nanoid(), "TestSub9"),
        source: { type: "subTable" },
        render: { type: "subtable", is_lookup: false },
        json_schema: { type: "array" },
    });

    // Try with a dashboard_id reference
    await tryAddColumn("subtable: source.type=subtable + dashboard_id", {
        ...baseCol(nanoid(), "TestSub10"),
        source: { type: "subtable", dashboard_id: DB1_DASH },
        render: { type: "subtable", is_lookup: false },
        json_schema: { type: "array" },
    });

    // ════════════════════════════════════════
    // RELATION probes
    // ════════════════════════════════════════
    console.log("\n═══ RELATION PROBES ═══");
    
    await tryAddColumn("relation: source.type=relation, basic", {
        ...baseCol(nanoid(), "TestRel"),
        source: { type: "relation" },
        render: { type: "relation", is_lookup: false, edit_type: "relation" },
        json_schema: { type: "array" },
    });

    await tryAddColumn("relation: source.type=relation + linked_dashboard_id", {
        ...baseCol(nanoid(), "TestRel2"),
        source: { type: "relation", linked_dashboard_id: DB2_DASH },
        render: { type: "relation", is_lookup: false, edit_type: "relation" },
        json_schema: { type: "array" },
    });

    await tryAddColumn("relation: source.type=relation + linked IDs", {
        ...baseCol(nanoid(), "TestRel3"),
        source: { type: "relation", linked_dashboard_id: DB2_DASH, linked_view_id: DB2_VIEW },
        render: { type: "relation", is_lookup: false, edit_type: "relation" },
        json_schema: { type: "array" },
    });

    await tryAddColumn("relation: source=custom+relation, render=relation", {
        ...baseCol(nanoid(), "TestRel4"),
        source: { _type_custom: true, type: "custom", custom_type: "relation" },
        render: { type: "relation", is_lookup: false, edit_type: "relation", _type_relation: true },
        json_schema: { type: "array" },
    });

    await tryAddColumn("relation: source.type=link, render=relation", {
        ...baseCol(nanoid(), "TestRel5"),
        source: { type: "link", linked_dashboard_id: DB2_DASH },
        render: { type: "relation", is_lookup: false },
        json_schema: { type: "array" },
    });

    await tryAddColumn("relation: source.type=reference", {
        ...baseCol(nanoid(), "TestRel6"),
        source: { type: "reference", dashboard_id: DB2_DASH, view_id: DB2_VIEW },
        render: { type: "relation", is_lookup: false },
        json_schema: { type: "array" },
    });

    await tryAddColumn("relation: source.type=foreign_key", {
        ...baseCol(nanoid(), "TestRel7"),
        source: { type: "foreign_key", dashboard_id: DB2_DASH },
        render: { type: "relation", is_lookup: false },
        json_schema: { type: "array" },
    });

    // ════════════════════════════════════════
    // LOOKUP probes (we know source.type=lookup is accepted but crashes)
    // ════════════════════════════════════════
    console.log("\n═══ LOOKUP PROBES ═══");
    
    // Try with a source column reference
    await tryAddColumn("lookup: source.type=lookup + source_key (status col)", {
        ...baseCol(nanoid(), "TestLook"),
        source: { type: "lookup", source_key: "oXwrABUd" }, // Status column key
        render: { type: "lookup", is_lookup: true },
        json_schema: { type: "string" },
    });

    await tryAddColumn("lookup: source.type=lookup + relation_key + field_key", {
        ...baseCol(nanoid(), "TestLook2"),
        source: { type: "lookup", relation_key: "testrel", field_key: "Name" },
        render: { type: "lookup", is_lookup: true },
        json_schema: { type: "string" },
    });

    await tryAddColumn("lookup: source=custom+lookup, render.is_lookup=true", {
        ...baseCol(nanoid(), "TestLook3"),
        source: { _type_custom: true, type: "custom", custom_type: "lookup" },
        render: { type: "string", is_lookup: true },
        json_schema: { type: "string" },
    });

    await tryAddColumn("lookup: source.type=lookup + items array", {
        ...baseCol(nanoid(), "TestLook4"),
        source: { type: "lookup", items: [] },
        render: { type: "lookup", is_lookup: true },
        json_schema: { type: "string" },
    });

    // ════════════════════════════════════════
    // Try looking at Next.js server actions - maybe columns are added differently
    // ════════════════════════════════════════
    console.log("\n═══ ALTERNATIVE ENDPOINTS ═══");
    
    // Try POST to the view with a column payload  
    const r1 = await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${DB1_DASH}/views/${DB1_VIEW}/columns`, {
        method: "POST",
        headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify({ name: "TestSub", type: "subtable" }),
    });
    console.log(`  POST /views/{id}/columns: ${r1.status} ${(await r1.text()).substring(0, 100)}`);

    // Try POST to dashboard level
    const r2 = await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${DB1_DASH}/columns`, {
        method: "POST",
        headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify({ name: "TestSub", type: "subtable" }),
    });
    console.log(`  POST /dashboards/{id}/columns: ${r2.status} ${(await r2.text()).substring(0, 100)}`);

    // Try PATCH on the view
    const r3 = await fetch(`${BASE}/v4/api/proxy/dashboard-service/v1/dashboards/${DB1_DASH}/views/${DB1_VIEW}`, {
        method: "PATCH",
        headers: { cookie: COOKIE, "content-type": "application/json" },
        body: JSON.stringify({ schema: { add_column: { name: "TestSub", type: "subtable" } } }),
    });
    console.log(`  PATCH /views/{id}: ${r3.status} ${(await r3.text()).substring(0, 100)}`);

    console.log("\n▶ Done!");
}

run().catch(e => { console.error("Failed:", e); process.exit(1); });
