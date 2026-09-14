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
  autoRefresh: true,
});

interface ProbeResult {
  endpoint: string;
  category: string;
  method: string;
  status: number;
  statusText: string;
  allowHeader?: string;
  contentType?: string;
  sampleBody?: string;
  error?: string;
  viable: boolean;
  notes?: string;
}

const results: ProbeResult[] = [];

async function testEndpointMethod(
  category: string,
  pathTmpl: string,
  method: string,
  body?: any,
  extraHeaders?: Record<string, string>
): Promise<ProbeResult> {
  const url = `https://${HOST}${pathTmpl}`;
  const headers: Record<string, string> = {
    cookie: COOKIE,
    accept: "application/json, text/plain, */*",
    ...extraHeaders,
  };
  if (body) {
    headers["content-type"] = "application/json";
  }

  // ActivePieces automation auth if path starts with /automation
  if (pathTmpl.startsWith("/automation/") && !pathTmpl.includes("/authentication/fusebase-auth")) {
    const autoAuth = await client.ensureAutomationAuth();
    if (autoAuth.token) {
      headers["Authorization"] = `Bearer ${autoAuth.token}`;
    }
    const match = COOKIE.match(/eversessionid=([^;]+)/);
    if (match) {
      headers["FBS-Session-ID"] = match[1].trim();
    }
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(6000),
    });

    const allowHeader = res.headers.get("allow") || undefined;
    const contentType = res.headers.get("content-type") || undefined;
    const text = await res.text().catch(() => "");
    const sampleBody = text.slice(0, 300);

    // Determine viability
    // 200, 201, 204 are definitely viable
    // 400 Bad Request often means endpoint exists and validation fired (e.g. "name is required")
    // 405 Method Not Allowed means endpoint exists but this method isn't allowed (check allowHeader!)
    const viable = res.status >= 200 && res.status < 300;
    
    let notes = "";
    if (res.status === 400) {
      notes = `Validation triggered: ${sampleBody.slice(0, 100)}`;
    } else if (res.status === 405) {
      notes = `Method Not Allowed. Allowed: ${allowHeader || "none listed"}`;
    } else if (res.status === 403) {
      notes = `Forbidden / Plan-gated: ${sampleBody.slice(0, 100)}`;
    } else if (res.status === 404) {
      notes = "Not Found / Route not registered";
    } else if (res.status === 500) {
      notes = `Internal Server Error: ${sampleBody.slice(0, 100)}`;
    }

    return {
      endpoint: pathTmpl,
      category,
      method,
      status: res.status,
      statusText: res.statusText,
      allowHeader,
      contentType,
      sampleBody: sampleBody.length > 0 ? sampleBody : undefined,
      viable,
      notes,
    };
  } catch (err: any) {
    return {
      endpoint: pathTmpl,
      category,
      method,
      status: 0,
      statusText: "FetchError",
      error: err.message,
      viable: false,
      notes: `Network/Timeout error: ${err.message}`,
    };
  }
}

async function runComprehensiveProbe() {
  console.log("==========================================================");
  console.log("   COMPREHENSIVE FUSEBASE API DISCOVERY & PROBE ENGINE   ");
  console.log("==========================================================");
  console.log(`Host: ${HOST}`);
  console.log(`Org ID: ${ORG_ID}`);

  // Fetch a valid workspace ID and note ID to use for parameter substitution
  console.log("\n[Setup] Resolving active workspace and note IDs...");
  const workspaces = await client.listWorkspaces();
  const wid = workspaces[0]?.id || "45h7lom5ryjak34u";
  console.log(`Using Workspace ID: ${wid}`);

  const notes = await client.listPages(wid, { limit: 1 });
  const nid = notes.items?.[0]?.globalId || "1tZiv20EWydrHyaB";
  console.log(`Using Page/Note ID: ${nid}`);

  const autoAuth = await client.ensureAutomationAuth();
  console.log(`ActivePieces Automation Project ID: ${autoAuth.projectId || "none"}`);

  // ─── CANDIDATE PATHS TO PROBE ──────────────────────────────────

  const candidateEndpoints: { category: string; path: string; methods: string[]; testBody?: any }[] = [
    // 1. Organization & Member Groups (from Guides & CLI references)
    { category: "Groups", path: `/v2/api/orgs/${ORG_ID}/groups`, methods: ["GET", "POST", "OPTIONS"], testBody: { title: "Test Group" } },
    { category: "Groups", path: `/v1/organizations/${ORG_ID}/groups`, methods: ["GET", "POST", "OPTIONS"], testBody: { name: "Test Group" } },
    { category: "Groups", path: `/gwapi2/ft:groups/orgs/${ORG_ID}/groups`, methods: ["GET", "POST", "OPTIONS"] },
    { category: "Groups", path: `/gwapi2/ft:org/orgs/${ORG_ID}/groups`, methods: ["GET", "POST", "OPTIONS"] },
    { category: "Groups", path: `/gwapi2/svc:group/orgs/${ORG_ID}/groups`, methods: ["GET", "POST", "OPTIONS"] },
    { category: "Groups", path: `/v2/api/group-service-proxy/v1/orgs/${ORG_ID}/groups`, methods: ["GET", "OPTIONS"] },
    { category: "Members", path: `/v2/api/orgs/${ORG_ID}/invites`, methods: ["GET", "POST", "OPTIONS"] },
    { category: "Members", path: `/v1/organizations/${ORG_ID}/invitations`, methods: ["GET", "POST", "OPTIONS"] },
    { category: "Members", path: `/v2/api/orgs/${ORG_ID}/guests`, methods: ["GET", "OPTIONS"] },
    { category: "Organization", path: `/v1/organizations/${ORG_ID}/settings`, methods: ["GET", "OPTIONS"] },
    { category: "Organization", path: `/v1/organizations/${ORG_ID}/branding`, methods: ["GET", "OPTIONS"] },
    { category: "Organization", path: `/v1/organizations/${ORG_ID}/domains`, methods: ["GET", "OPTIONS"] },
    { category: "Organization", path: `/v2/api/orgs/${ORG_ID}/stats`, methods: ["GET", "OPTIONS"] },
    { category: "Organization", path: `/v2/api/orgs/${ORG_ID}/activity`, methods: ["GET", "OPTIONS"] },
    { category: "Organization", path: `/v2/api/orgs/${ORG_ID}/audit-logs`, methods: ["GET", "OPTIONS"] },

    // 2. Gateway ft:* services permutations
    { category: "Gateway ft:search", path: `/gwapi2/ft:search/workspaces/${wid}/search`, methods: ["GET", "POST", "OPTIONS"], testBody: { query: "test" } },
    { category: "Gateway ft:search", path: `/gwapi2/ft:search/orgs/${ORG_ID}/search`, methods: ["GET", "POST", "OPTIONS"], testBody: { query: "test" } },
    { category: "Gateway ft:tasks", path: `/gwapi2/ft:tasks/workspaces/${wid}/tasks/count`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway ft:tasks", path: `/gwapi2/ft:tasks/workspaces/${wid}/task-lists`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway ft:tasks", path: `/gwapi2/ft:tasks/orgs/${ORG_ID}/time-tracking`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway ft:notes", path: `/gwapi2/ft:notes/workspaces/${wid}/tree`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway ft:notes", path: `/gwapi2/ft:notes/workspaces/${wid}/trash`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway ft:notes", path: `/gwapi2/ft:notes/workspaces/${wid}/templates`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway ft:favorites", path: `/gwapi2/ft:favorites/workspaces/${wid}/favorites`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway ft:favorites", path: `/gwapi2/ft:favorites/orgs/${ORG_ID}/favorites`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway ft:trash", path: `/gwapi2/ft:trash/workspaces/${wid}/items`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway ft:webhooks", path: `/gwapi2/ft:webhooks/orgs/${ORG_ID}/webhooks`, methods: ["GET", "POST", "OPTIONS"] },
    { category: "Gateway ft:integrations", path: `/gwapi2/ft:integrations/workspaces/${wid}/integrations`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway ft:clients", path: `/gwapi2/ft:clients/orgs/${ORG_ID}/clients`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway ft:forms", path: `/gwapi2/ft:forms/workspaces/${wid}/forms`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway ft:portals", path: `/gwapi2/ft:portals/orgs/${ORG_ID}/portals`, methods: ["GET", "OPTIONS"] },

    // 3. Gateway svc:* services permutations
    { category: "Gateway svc:search", path: `/gwapi2/svc:search/workspaces/${wid}`, methods: ["GET", "POST", "OPTIONS"] },
    { category: "Gateway svc:task", path: `/gwapi2/svc:task/workspaces/${wid}/tasks`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway svc:member", path: `/gwapi2/svc:member/orgs/${ORG_ID}/members`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway svc:workspace", path: `/gwapi2/svc:workspace/workspaces/${wid}`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway svc:portal", path: `/gwapi2/svc:portal/orgs/${ORG_ID}/portals`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway svc:notification", path: `/gwapi2/svc:notification/workspaces/${wid}/settings`, methods: ["GET", "OPTIONS"] },
    { category: "Gateway svc:notification", path: `/gwapi2/svc:notification/unread-count`, methods: ["GET", "OPTIONS"] },

    // 4. v4 Dashboard & Relations Microservice
    { category: "Databases", path: `/v4/api/proxy/dashboard-service/v1/databases`, methods: ["GET", "OPTIONS"] },
    { category: "Databases", path: `/v4/api/proxy/dashboard-service/v1/dashboards`, methods: ["GET", "OPTIONS"] },
    { category: "Databases", path: `/v4/api/proxy/dashboard-service/v1/relations`, methods: ["GET", "POST", "OPTIONS"] },
    { category: "Databases", path: `/v4/api/proxy/dashboard-service/v1/templates`, methods: ["GET", "OPTIONS"] },
    { category: "Databases", path: `/v4/api/proxy/dashboard-service/v1/orgs/${ORG_ID}/databases`, methods: ["GET", "OPTIONS"] },
    { category: "Databases", path: `/v4/api/proxy/dashboard-service/v1/workspaces/${wid}/databases`, methods: ["GET", "OPTIONS"] },

    // 5. v4 AI Microservice & Agent Capabilities
    { category: "AI & Agents", path: `/v4/api/proxy/ai-service/v1/orgs/${ORG_ID}/models`, methods: ["GET", "OPTIONS"] },
    { category: "AI & Agents", path: `/v4/api/proxy/ai-service/v1/orgs/${ORG_ID}/agents`, methods: ["GET", "POST", "OPTIONS"], testBody: { title: "Test AI Agent" } },
    { category: "AI & Agents", path: `/v4/api/proxy/ai-service/v1/orgs/${ORG_ID}/agent-categories`, methods: ["GET", "OPTIONS"] },
    { category: "AI & Agents", path: `/v4/api/proxy/ai-service/v1/orgs/${ORG_ID}/skills`, methods: ["GET", "OPTIONS"] },
    { category: "AI & Agents", path: `/v4/api/proxy/ai-service/v1/orgs/${ORG_ID}/prompts`, methods: ["GET", "OPTIONS"] },
    { category: "AI & Agents", path: `/ai-assistant/rest/orgs/${ORG_ID}/history`, methods: ["GET", "OPTIONS"] },
    { category: "AI & Agents", path: `/ai-assistant/rest/orgs/${ORG_ID}/agents`, methods: ["GET", "OPTIONS"] },

    // 6. ActivePieces Automation API permuted catalog
    { category: "Automation", path: `/automation/api/v1/app-connections`, methods: ["GET", "POST", "OPTIONS"] },
    { category: "Automation", path: `/automation/api/v1/folders`, methods: ["GET", "POST", "OPTIONS"], testBody: { displayName: "Probe Test Folder" } },
    { category: "Automation", path: `/automation/api/v1/git-repos`, methods: ["GET", "OPTIONS"] },
    { category: "Automation", path: `/automation/api/v1/store`, methods: ["GET", "POST", "OPTIONS"] },
    { category: "Automation", path: `/automation/api/v1/user-invitations`, methods: ["GET", "POST", "OPTIONS"] },
    { category: "Automation", path: `/automation/api/v1/project-members`, methods: ["GET", "OPTIONS"] },
    { category: "Automation", path: `/automation/api/v1/webhooks`, methods: ["GET", "POST", "OPTIONS"] },
    { category: "Automation", path: `/automation/api/v1/step-run`, methods: ["POST", "OPTIONS"], testBody: {} },
    { category: "Automation", path: `/automation/api/v1/tags`, methods: ["GET", "OPTIONS"] },
    { category: "Automation", path: `/automation/api/v1/users/me`, methods: ["GET", "OPTIONS"] },

    // 7. Workspace & Content Operations
    { category: "Workspaces", path: `/v2/api/workspaces/${wid}/trash`, methods: ["GET", "OPTIONS"] },
    { category: "Workspaces", path: `/v2/api/workspaces/${wid}/trash/notes`, methods: ["GET", "OPTIONS"] },
    { category: "Workspaces", path: `/v2/api/workspaces/${wid}/templates`, methods: ["GET", "OPTIONS"] },
    { category: "Workspaces", path: `/v2/api/workspaces/${wid}/export`, methods: ["GET", "POST", "OPTIONS"] },
    { category: "Workspaces", path: `/v2/api/workspaces/${wid}/stats`, methods: ["GET", "OPTIONS"] },
    { category: "Content", path: `/v2/api/workspaces/${wid}/notes/${nid}/history`, methods: ["GET", "OPTIONS"] },
    { category: "Content", path: `/v2/api/workspaces/${wid}/notes/${nid}/versions`, methods: ["GET", "OPTIONS"] },
    { category: "Content", path: `/v2/api/workspaces/${wid}/notes/${nid}/collaborators`, methods: ["GET", "OPTIONS"] },
    { category: "Content", path: `/v2/api/workspaces/${wid}/notes/${nid}/duplicate`, methods: ["POST", "OPTIONS"], testBody: {} },
    { category: "Content", path: `/v2/api/workspaces/${wid}/notes/${nid}/move`, methods: ["POST", "OPTIONS"], testBody: {} },
    { category: "Content", path: `/v2/api/web-editor/notes/${nid}/export/pdf`, methods: ["GET", "POST", "OPTIONS"] },
    { category: "Content", path: `/v2/api/web-editor/notes/${nid}/export/html`, methods: ["GET", "OPTIONS"] },
    { category: "Content", path: `/v2/api/web-editor/notes/${nid}/export/markdown`, methods: ["GET", "OPTIONS"] },

    // 8. Portals & Client Hubs
    { category: "Portals", path: `/v1/portals/orgs/${ORG_ID}/clients`, methods: ["GET", "POST", "OPTIONS"] },
    { category: "Portals", path: `/v1/portals/orgs/${ORG_ID}/stats`, methods: ["GET", "OPTIONS"] },
    { category: "Portals", path: `/v1/portals/orgs/${ORG_ID}/domains`, methods: ["GET", "OPTIONS"] },
    { category: "Portals", path: `/v2/api/portal-service-proxy/v1/domains`, methods: ["GET", "OPTIONS"] },
    { category: "Portals", path: `/v2/api/portal-service-proxy/v1/custom-css`, methods: ["GET", "PUT", "OPTIONS"] },
    { category: "Portals", path: `/v2/api/portal-service-proxy/v1/branding`, methods: ["GET", "OPTIONS"] },
  ];

  console.log(`\nLaunching probe across ${candidateEndpoints.length} route configurations with full HTTP method matrix...`);

  let completed = 0;
  for (const ep of candidateEndpoints) {
    for (const method of ep.methods) {
      const res = await testEndpointMethod(
        ep.category,
        ep.path,
        method,
        method === "POST" || method === "PUT" || method === "PATCH" ? ep.testBody : undefined
      );
      results.push(res);
      
      const badge = res.viable
        ? "✅ 20X"
        : res.status === 400
        ? "🔍 400 (SCHEMA PROOF)"
        : res.status === 405
        ? "🔄 405 (METHOD ALLOWED)"
        : res.status === 403
        ? "🔒 403"
        : res.status === 404
        ? "❌ 404"
        : `⚠️ ${res.status}`;

      console.log(`[${badge}] ${res.method.padEnd(7)} ${res.endpoint} -> ${res.notes || res.statusText}`);
      // Polite delay between requests
      await new Promise((r) => setTimeout(r, 120));
    }
    completed++;
    if (completed % 10 === 0) {
      console.log(`Progress: ${completed}/${candidateEndpoints.length} routes probed...`);
    }
  }

  // ─── SAVE STRUCTURED RESULTS ──────────────────────────────────
  const outDir = path.resolve(__dirname, "..", "artifacts");
  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, "comprehensive-probe-results.json");
  fs.writeFileSync(outJson, JSON.stringify(results, null, 2));

  // Print Summary
  const viable = results.filter((r) => r.viable || r.status === 400);
  console.log("\n==========================================================");
  console.log("               PROBE SUMMARY BREAKDOWN                    ");
  console.log("==========================================================");
  console.log(`Total method/route probes executed: ${results.length}`);
  console.log(`Viable / Schema-Confirmed Endpoints: ${viable.length}`);
  console.log(`405 Method Not Allowed (routes that exist): ${results.filter(r => r.status === 405).length}`);
  console.log(`403 Plan-Gated / Forbidden: ${results.filter(r => r.status === 403).length}`);
  console.log(`404 Route Not Registered: ${results.filter(r => r.status === 404).length}`);
  console.log(`500 Internal Server Errors: ${results.filter(r => r.status === 500).length}`);
  console.log(`Results saved to: ${outJson}`);
}

runComprehensiveProbe().catch(console.error);
