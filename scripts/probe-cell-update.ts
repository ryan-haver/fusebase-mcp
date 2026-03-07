/**
 * Step 1 probe: examine getDatabaseData response shape.
 * Prints the first row and the schema/column definitions.
 */
import * as path from "path";
import * as fs from "fs";
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

const storedCookie = loadEncryptedCookie();
const client = new FusebaseClient({
    host: process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me",
    orgId: process.env.FUSEBASE_ORG_ID || "",
    cookie: process.env.FUSEBASE_COOKIE || storedCookie?.cookie || "",
});

// playwright-demo dashboard + view from Playwright capture
const dashboardId = "e14f8a1b-21d3-4ec6-a175-58577f2dc1fe";
const viewId = "3b6813b6-543a-403b-b42e-2a148e501e10";

process.stderr.write('[debug] calling getDatabaseData\n');
const result = await client.getDatabaseData(dashboardId, viewId, { page: 1, limit: 3 });

const raw = result as any;

process.stdout.write("TOP_LEVEL_KEYS: " + JSON.stringify(Object.keys(raw)) + "\n");

const rows = raw.data ?? raw.rows ?? [];
process.stdout.write("ROW_COUNT: " + rows.length + "\n");
if (rows[0]) {
    process.stdout.write("ROW_0_KEYS: " + JSON.stringify(Object.keys(rows[0])) + "\n");
    process.stdout.write("ROW_0: " + JSON.stringify(rows[0]).substring(0, 800) + "\n");
}
process.stdout.write("META: " + JSON.stringify(raw.meta) + "\n");
