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
    if (eq > 0 && !process.env[t.slice(0, eq).trim()]) {
      process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  }
}

import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";

const stored = loadEncryptedCookie();
const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const ORG_ID = process.env.FUSEBASE_ORG_ID || "u268r1";
const COOKIE = stored?.cookie || process.env.FUSEBASE_COOKIE || "";

const client = new FusebaseClient({
  host: HOST,
  orgId: ORG_ID,
  cookie: COOKIE,
});

async function testAllowedItems() {
  const dbs = await client.listAllDatabases();
  const db = dbs[0];
  console.log(`Testing with DB: ${db?.global_id}`);
  if (db?.dashboards?.[0]) {
    const dashId = db.dashboards[0].global_id;
    const res = await fetch(`https://${HOST}/v4/api/proxy/dashboard-service/v1/dashboards/${dashId}/allowed-items`, {
      headers: { cookie: COOKIE, accept: "application/json" }
    });
    console.log(`[${res.status}] GET allowed-items: ${await res.text()}`);
  }
}

testAllowedItems().catch(console.error);
