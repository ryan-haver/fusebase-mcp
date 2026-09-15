#!/usr/bin/env node

/**
 * FuseBase MCP Server
 *
 * Provides tools for interacting with Fusebase (formerly Nimbus Note)
 * via its internal web API and official remote Gate & Dashboards MCP gateways.
 * Runs over stdio transport.
 *
 * Supported Authentication Modes:
 *   1. Direct Token Mode (Recommended):
 *      FUSEBASE_TOKEN or FUSEBASE_GATE_TOKEN & FUSEBASE_DASHBOARDS_TOKEN
 *      (Auto-discovers host, orgId, and default workspace via whoami)
 *   2. Session Cookie Mode:
 *      FUSEBASE_HOST, FUSEBASE_ORG_ID, and FUSEBASE_COOKIE (or cached cookie)
 *   3. Hybrid Mode:
 *      Both token and cookie present (tokens for Gate/Dashboards, cookies for WebSocket CRDT)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FusebaseClient } from "./client.js";
import { FusebaseGateBridge } from "./gate-bridge.js";
import { loadEncryptedCookie, loadCredentialStore, loadEncryptedToken } from "./crypto.js";
import { startProxyRelay } from "./proxy-relay.js";
import { registerCoreTools } from "./tools/core-tools.js";
import { registerExtendedTools } from "./tools/extended-tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ─────────────────────────────────────────────────────

/** Load .env files from project root and apps if present */
function loadDotEnv(): void {
  const envPaths = [
    path.resolve(__dirname, "..", ".env"),
    path.resolve(__dirname, "..", "apps", "client-portal-dashboard", ".env"),
  ];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// Load env vars at startup
loadDotEnv();

// ─── Server Setup ───────────────────────────────────────────────

let _proxyRelayUrl: string | undefined;
let _activeProfile: string | undefined = process.env.FUSEBASE_PROFILE;
let _gateBridge: FusebaseGateBridge | undefined;

function getClient(profile?: string): FusebaseClient {
  const effectiveProfile = profile || _activeProfile;

  // 1. Resolve tokens
  let gateToken = process.env.FUSEBASE_GATE_TOKEN || process.env.GATE_MCP_TOKEN;
  let dashboardsToken = process.env.FUSEBASE_DASHBOARDS_TOKEN || process.env.DASHBOARDS_MCP_TOKEN;
  let token = process.env.FUSEBASE_TOKEN;

  if (!gateToken && !dashboardsToken && !token) {
    const storedToken = loadEncryptedToken(effectiveProfile);
    if (storedToken) {
      gateToken = storedToken.gateToken;
      dashboardsToken = storedToken.dashboardsToken;
      token = storedToken.token;
    }
  }

  // 2. Resolve or reuse bridge
  if ((gateToken || dashboardsToken || token) && !_gateBridge) {
    _gateBridge = new FusebaseGateBridge({
      gateToken,
      dashboardsToken,
      token,
    });
  }

  let host = process.env.FUSEBASE_HOST;
  let orgId = process.env.FUSEBASE_ORG_ID;

  let cookie = process.env.FUSEBASE_COOKIE || "";
  // If a profile is requested, or if no default cookie was provided in env, load from disk
  if (!cookie || effectiveProfile) {
    const stored = loadEncryptedCookie(effectiveProfile);
    if (stored?.cookie) {
      cookie = stored.cookie;
    }
  }

  if (!host || !orgId) {
    console.error("Missing FUSEBASE_HOST or FUSEBASE_ORG_ID. Configure FUSEBASE_HOST & FUSEBASE_ORG_ID or provide FUSEBASE_TOKEN.");
    process.exit(1);
  }

  if (!cookie && !_gateBridge?.isConfigured) {
    console.error(`[fusebase] Warning: Neither cookie nor token found. Run 'npx tsx scripts/auth.ts${effectiveProfile ? ` --profile ${effectiveProfile}` : ""}' to authenticate.`);
  }

  // Use proxy relay URL if started in main()
  return new FusebaseClient({
    host,
    orgId,
    cookie: cookie || undefined,
    token,
    gateToken,
    dashboardsToken,
    gateBridge: _gateBridge,
    autoRefresh: Boolean(cookie),
    profile: effectiveProfile,
    proxyRelayUrl: _proxyRelayUrl,
  });
}

const server = new McpServer(
  {
    name: "fusebase",
    version: "1.0.0",
  },
  {
    instructions: `FuseBase MCP Server provides programmatic access to the FuseBase collaborative workspace platform.

Entity Hierarchy:
- Organization (Tenant) -> Workspaces
- Workspaces -> Folders -> Pages (Notes)
- Workspaces -> Databases (Tables) -> Views & Records (Rows) / Relations

Tool Tiers:
- Starts in Core Tier (34 tools) covering full CRUD and organization for pages, folders, content, comments, tasks, attachments, and profile management.
- Call 'set_tool_tier' with tier="all" to unlock all 175 tools (databases, views, relations, permissions, automations, portals, webhooks, Gate PostgreSQL, tokens).

Content & Sync Guidelines:
- Pages are collaborative documents backed by Y.js CRDT state. Use 'append_page_content' or 'update_page_content' to edit. Real-time updates propagate via WebSocket.
- When retrieving page content, 'format: "markdown"' reduces token consumption by ~50% compared to raw HTML.
- For attachments, 'download_attachment' returns images natively or saves large files to disk via 'saveToDisk: true'.
- Destructive actions (deleting pages, databases, rows, relations, columns) are marked with [DESTRUCTIVE] and cannot be undone.`,
  }
);

// ─── Tool Tier Management & Registration ────────────────────────

let extendedToolsRegistered = false;

function enableExtendedTools(): void {
  if (extendedToolsRegistered) return;
  registerExtendedTools(server, getClient);
  extendedToolsRegistered = true;
  console.error(`[fusebase] Extended tools registered`);
}

// Register core tools, resources, and prompts
registerCoreTools(server, getClient, {
  enableExtendedTools,
  isExtendedToolsEnabled: () => extendedToolsRegistered,
  setActiveProfile: (p) => { _activeProfile = p; },
  getActiveProfile: () => _activeProfile,
});
registerResources(server, getClient);
registerPrompts(server, getClient);

// Register extended tools at startup if FUSEBASE_TOOLS=all
if (process.env.FUSEBASE_TOOLS === "all") {
  enableExtendedTools();
} else {
  console.error("[fusebase] Running in core mode (34 tools). Set FUSEBASE_TOOLS=all or call set_tool_tier to enable all 175.");
}

// ─── Start ──────────────────────────────────────────────────────

async function main() {
  // Check for tokens and auto-discover identity
  let gateToken = process.env.FUSEBASE_GATE_TOKEN || process.env.GATE_MCP_TOKEN;
  let dashboardsToken = process.env.FUSEBASE_DASHBOARDS_TOKEN || process.env.DASHBOARDS_MCP_TOKEN;
  let token = process.env.FUSEBASE_TOKEN;

  if (!gateToken && !dashboardsToken && !token) {
    const storedToken = loadEncryptedToken(_activeProfile);
    if (storedToken) {
      gateToken = storedToken.gateToken;
      dashboardsToken = storedToken.dashboardsToken;
      token = storedToken.token;
    }
  }

  if (gateToken || dashboardsToken || token) {
    _gateBridge = new FusebaseGateBridge({
      gateToken,
      dashboardsToken,
      token,
    });

    try {
      const identity = await _gateBridge.init();
      if (!process.env.FUSEBASE_ORG_ID && identity.orgId) {
        process.env.FUSEBASE_ORG_ID = identity.orgId;
      }
      if (!process.env.FUSEBASE_HOST && identity.orgDomain) {
        process.env.FUSEBASE_HOST = identity.orgDomain;
      }
      console.error(
        `[fusebase] Connected via Direct Token Mode to FuseBase Gate (${_gateBridge.hasGate ? "✓ Gate" : ""}${_gateBridge.hasDashboards ? " ✓ Dashboards" : ""})\n` +
        `[fusebase] Tenant: ${identity.orgId} (${identity.orgDomain || "cloud"}) — Default Workspace: ${identity.defaultWorkspaceId || "none"}`
      );
    } catch (err: any) {
      console.error(`[fusebase] Warning: Direct token connection check failed: ${err.message}`);
    }
  }

  // Start proxy relay before MCP server so API calls are proxied
  const credStore = loadCredentialStore();
  if (credStore?.proxy) {
    try {
      const relay = await startProxyRelay(credStore.proxy);
      _proxyRelayUrl = `http://127.0.0.1:${relay.port}`;
      process.on("exit", () => relay.stop());
    } catch (err) {
      console.error(`[fusebase] Warning: Failed to start proxy relay: ${err instanceof Error ? err.message : err}`);
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Fusebase MCP server running on stdio");
  console.error("📊 Live Platform Status: https://fusebase-mcp.thefusebase.app/");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
