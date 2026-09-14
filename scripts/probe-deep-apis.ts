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

async function runDeepProbe() {
  console.log("=== TARGETED DEEP PROBE OF DISCOVERED CANDIDATES ===\n");

  const workspaces = await client.listWorkspaces();
  const wid = workspaces[0]?.id || "45h7lom5ryjak34u";

  // 1. Portal Service Proxy endpoints (domains, custom-css, branding)
  // Let's test with workspaceId query parameter
  const portalRoutes = [
    `/v2/api/portal-service-proxy/v1/domains?workspaceId=${wid}`,
    `/v2/api/portal-service-proxy/v1/domains?orgId=${ORG_ID}`,
    `/v2/api/portal-service-proxy/v1/custom-css?workspaceId=${wid}`,
    `/v2/api/portal-service-proxy/v1/branding?workspaceId=${wid}`,
  ];

  for (const p of portalRoutes) {
    const res = await fetch(`https://${HOST}${p}`, {
      headers: { cookie: COOKIE, accept: "application/json" }
    });
    const text = await res.text();
    console.log(`[${res.status}] GET ${p}`);
    console.log(`   Response: ${text.slice(0, 250)}\n`);
  }

  // 2. AI Custom Agent creation: probe required fields
  console.log("--- Probing AI Agent Creation Schema ---");
  const agentPayloads = [
    { title: "Test Assistant", systemPrompt: "You are a helpful assistant" },
    { title: "Test Assistant", systemPrompt: "You are a helpful assistant", workspaceId: wid },
    { title: "Test Assistant", systemPrompt: "You are a helpful assistant", orgId: ORG_ID },
  ];

  for (const payload of agentPayloads) {
    const res = await fetch(`https://${HOST}/v4/api/proxy/ai-service/v1/orgs/${ORG_ID}/agents`, {
      method: "POST",
      headers: { cookie: COOKIE, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log(`[${res.status}] POST /v4/api/proxy/ai-service/v1/orgs/${ORG_ID}/agents`);
    console.log(`   Payload: ${JSON.stringify(payload)}`);
    console.log(`   Response: ${text.slice(0, 300)}\n`);
  }

  // 3. Move Note Schema Discovery
  console.log("--- Probing Move Note Schema ---");
  const notes = await client.listPages(wid, { limit: 1 });
  const nid = notes.items?.[0]?.globalId;
  if (nid) {
    const movePayloads = [
      { workspaceId: wid },
      { targetWorkspaceId: wid },
      { moveNodeToWorkspaceObject: { workspaceId: wid } },
      { destinationWorkspaceId: wid },
    ];
    for (const mp of movePayloads) {
      const res = await fetch(`https://${HOST}/v2/api/workspaces/${wid}/notes/${nid}/move`, {
        method: "POST",
        headers: { cookie: COOKIE, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(mp)
      });
      const text = await res.text();
      console.log(`[${res.status}] POST /v2/api/workspaces/${wid}/notes/${nid}/move`);
      console.log(`   Payload: ${JSON.stringify(mp)}`);
      console.log(`   Response: ${text.slice(0, 300)}\n`);
    }
  }

  // 4. Automation Current User & Folders Lifecycle
  console.log("--- Testing Automation Folders Lifecycle ---");
  const autoAuth = await client.ensureAutomationAuth();
  if (autoAuth.token) {
    const folderRes = await fetch(`https://${HOST}/automation/api/v1/folders`, {
      headers: {
        Authorization: `Bearer ${autoAuth.token}`,
        cookie: COOKIE,
        "FBS-Session-ID": COOKIE.match(/eversessionid=([^;]+)/)?.[1]?.trim() || "",
        accept: "application/json",
      }
    });
    const folderData = await folderRes.json();
    console.log(`Folders found: ${folderData.data?.length || 0}`);
    for (const f of (folderData.data || []).slice(0, 5)) {
      console.log(`  Folder: ${f.id} - ${f.displayName} (color: ${f.color})`);
      // Delete any test folders created during probing
      if (f.displayName === "Probe Test Folder") {
        const delRes = await fetch(`https://${HOST}/automation/api/v1/folders/${f.id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${autoAuth.token}`,
            cookie: COOKIE,
            "FBS-Session-ID": COOKIE.match(/eversessionid=([^;]+)/)?.[1]?.trim() || "",
          }
        });
        console.log(`  Cleaned up probe test folder ${f.id}: status ${delRes.status}`);
      }
    }
  }

  // 5. Dashboard Templates Retrieval
  console.log("\n--- Testing Dashboard Service Templates ---");
  const tplRes = await fetch(`https://${HOST}/v4/api/proxy/dashboard-service/v1/templates`, {
    headers: { cookie: COOKIE, accept: "application/json" }
  });
  const tplData = await tplRes.json();
  console.log(`Dashboard templates found: ${tplData.data?.length || 0}`);
  for (const t of (tplData.data || []).slice(0, 5)) {
    console.log(`  Template: ${t.global_id} - ${t.name} (root_entity: ${t.root_entity})`);
  }
}

runDeepProbe().catch(console.error);
