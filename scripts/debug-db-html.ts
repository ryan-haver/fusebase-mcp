/**
 * Probe: check each entity page HTML for embedded UUIDs
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

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const DASHBOARD_VIEW_RE = /dashboards\/([0-9a-f-]{36})\/views\/([0-9a-f-]{36})/g;

async function probe(entity: string) {
    const url = `https://${HOST}/dashboard/${ORG_ID}/tables/entity/${entity}`;
    const res = await fetch(url, { headers: { cookie } });
    const html = await res.text();

    const allUuids = [...new Set(html.match(UUID_RE) || [])];
    const dvPairs: Array<{ dashboardId: string; viewId: string }> = [];
    let m;
    while ((m = DASHBOARD_VIEW_RE.exec(html)) !== null) {
        dvPairs.push({ dashboardId: m[1], viewId: m[2] });
    }

    console.log(`\n${entity}: ${res.status}, ${html.length} bytes`);
    console.log(`  All UUIDs: ${allUuids.length}`);
    for (const u of allUuids) console.log(`    ${u}`);
    console.log(`  Dashboard/View pairs: ${dvPairs.length}`);
    for (const p of dvPairs) console.log(`    dashboard=${p.dashboardId} view=${p.viewId}`);

    // Also look for patterns like "dashboardId":"uuid" or dashboards/ in embedded JSON/script
    const jsonPattern = /"(?:dashboardId|dashboard_id|id)":\s*"([0-9a-f-]{36})"/gi;
    const jsonMatches = [...html.matchAll(jsonPattern)];
    if (jsonMatches.length > 0) {
        console.log(`  JSON dashboard ID references: ${jsonMatches.length}`);
        for (const jm of jsonMatches) console.log(`    ${jm[0]}`);
    }

    // Check for __NEXT_DATA__
    if (html.includes("__NEXT_DATA__")) {
        const ndMatch = html.match(/__NEXT_DATA__\s*=\s*({[\s\S]*?})\s*<\/script>/);
        if (ndMatch) {
            console.log(`  __NEXT_DATA__: ${ndMatch[1].length} chars`);
            console.log(`  Preview: ${ndMatch[1].slice(0, 300)}`);
        }
    }

    // Check for self.__next_f (RSC flight data)
    const rscChunks = html.match(/self\.__next_f\.push\(\[1,"([^"]*)"\]\)/g);
    if (rscChunks) {
        console.log(`  RSC flight chunks: ${rscChunks.length}`);
        // Check if any contain UUIDs
        for (const chunk of rscChunks) {
            const chunkUuids = chunk.match(UUID_RE);
            if (chunkUuids) {
                console.log(`    Chunk with UUIDs: ${chunkUuids.join(", ")}`);
            }
        }
    }
}

async function main() {
    console.log("=== Entity Page UUID Probe ===");

    // Also check the databases listing page
    {
        const url = `https://${HOST}/dashboard/${ORG_ID}/tables/databases`;
        const res = await fetch(url, { headers: { cookie } });
        const html = await res.text();
        const allUuids = [...new Set(html.match(UUID_RE) || [])];
        let m;
        const dvPairs: Array<{ dashboardId: string; viewId: string }> = [];
        while ((m = DASHBOARD_VIEW_RE.exec(html)) !== null) {
            dvPairs.push({ dashboardId: m[1], viewId: m[2] });
        }
        console.log(`\ndatabases: ${res.status}, ${html.length} bytes`);
        console.log(`  All UUIDs: ${allUuids.length}`);
        for (const u of allUuids) console.log(`    ${u}`);
        console.log(`  Dashboard/View pairs: ${dvPairs.length}`);

        // RSC chunks
        const rscChunks = html.match(/self\.__next_f\.push\(\[1,"([^"]*)"\]\)/g);
        if (rscChunks) {
            console.log(`  RSC flight chunks: ${rscChunks.length}`);
            for (const chunk of rscChunks) {
                const chunkUuids = chunk.match(UUID_RE);
                if (chunkUuids) console.log(`    Chunk with UUIDs: ${chunkUuids.join(", ")}`);
            }
        }
    }

    // Check entity pages
    for (const entity of ["spaces", "clients"]) {
        await probe(entity);
    }
}

main().catch(console.error);
