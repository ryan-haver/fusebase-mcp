#!/usr/bin/env node

/**
 * FuseBase MCP Server
 *
 * Provides tools for interacting with Fusebase (formerly Nimbus Note)
 * via its internal web API and official remote Gate & Dashboards MCP gateways.
 * Runs over stdio transport by default, or HTTP/SSE streaming transport.
 *
 * Supported Authentication Modes:
 *   1. Direct Token Mode (Recommended):
 *      FUSEBASE_TOKEN or FUSEBASE_GATE_TOKEN & FUSEBASE_DASHBOARDS_TOKEN
 *      (Auto-discovers host, orgId, and default workspace via whoami)
 *   2. Session Cookie Mode:
 *      FUSEBASE_HOST, FUSEBASE_ORG_ID, and FUSEBASE_COOKIE (or cached cookie)
 *   3. Hybrid Mode:
 *      Both token and cookie present (tokens for Gate/Dashboards, cookies for WebSocket CRDT)
 *
 * Supported Transports:
 *   - Stdio (default): node dist/index.js
 *   - HTTP: node dist/index.js --transport http [--host 127.0.0.1] [--port 3000] (or MCP_TRANSPORT=http)
 *     Serves Streamable HTTP at /mcp and legacy SSE at /sse. See src/http-server.ts for the
 *     access controls (MCP_AUTH_TOKEN, MCP_ALLOWED_HOSTS, MCP_ALLOWED_ORIGINS).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FusebaseClient } from "./client.js";
import { FusebaseGateBridge } from "./gate-bridge.js";
import { loadEncryptedCookie, loadCredentialStore } from "./crypto.js";
import { loadDotEnv, resolveTokens, hasAnyToken } from "./config.js";
import { startProxyRelay } from "./proxy-relay.js";
import { resolveHttpOptions, startHttpServer } from "./http-server.js";
import { registerCoreTools } from "./tools/core-tools.js";
import { registerExtendedTools } from "./tools/extended-tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

// ─── Config ─────────────────────────────────────────────────────

// Load env vars at startup
loadDotEnv();

// ─── Server Setup ───────────────────────────────────────────────

let _proxyRelayUrl: string | undefined;
let _activeProfile: string | undefined = process.env.FUSEBASE_PROFILE;
let _gateBridge: FusebaseGateBridge | undefined;

function getClient(profile?: string): FusebaseClient {
  const effectiveProfile = profile || _activeProfile;

  // 1. Resolve tokens
  const { gateToken, dashboardsToken, token } = resolveTokens(effectiveProfile);

  // 2. Resolve or reuse bridge
  if (hasAnyToken({ gateToken, dashboardsToken, token }) && !_gateBridge) {
    _gateBridge = new FusebaseGateBridge({
      gateToken,
      dashboardsToken,
      token,
    });
  }

  const host = process.env.FUSEBASE_HOST;
  const orgId = process.env.FUSEBASE_ORG_ID;

  let cookie = process.env.FUSEBASE_COOKIE || "";
  // If a profile is requested, or if no default cookie was provided in env, load from disk
  if (!cookie || effectiveProfile) {
    const stored = loadEncryptedCookie(effectiveProfile);
    if (stored?.cookie) {
      cookie = stored.cookie;
    }
  }

  if (!host || !orgId) {
    // Throw rather than exit: this runs inside tool calls, and the SDK turns a thrown
    // error into an isError result instead of killing the server (COR-10).
    throw new Error(
      "FuseBase is not configured: FUSEBASE_HOST and FUSEBASE_ORG_ID are missing. " +
      "Set them in .env, or provide valid FUSEBASE_GATE_TOKEN / FUSEBASE_DASHBOARDS_TOKEN so they can be discovered.",
    );
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

/**
 * Creates and configures a new McpServer instance with core tools,
 * resources, prompts, and tool tier management.
 */
function createFusebaseServer() {
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

  return { server, enableExtendedTools, isExtendedToolsRegistered: () => extendedToolsRegistered };
}

// ─── Start ──────────────────────────────────────────────────────

async function main() {
  // Check for tokens and auto-discover identity
  const { gateToken, dashboardsToken, token } = resolveTokens(_activeProfile);

  if (hasAnyToken({ gateToken, dashboardsToken, token })) {
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
      _proxyRelayUrl = relay.url;
      process.on("exit", () => relay.stop());
    } catch (err) {
      console.error(`[fusebase] Warning: Failed to start proxy relay: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Determine transport mode: "http" (Streamable HTTP + legacy SSE) or stdio.
  // "--sse" / "--transport sse" / MCP_TRANSPORT=sse are accepted as aliases for http.
  const transportArg = (process.argv.includes("--transport") ? process.argv[process.argv.indexOf("--transport") + 1] : undefined)
    || process.env.MCP_TRANSPORT
    || (process.argv.includes("--sse") ? "sse" : "stdio");
  const isHttpMode = ["http", "sse"].includes(transportArg.toLowerCase());

  if (isHttpMode) {
    const options = resolveHttpOptions(process.argv, process.env);
    const handle = await startHttpServer(options, () => createFusebaseServer().server, { version: "1.0.0" });
    const base = `http://${options.host.includes(":") ? `[${options.host}]` : options.host}:${handle.port}`;
    console.error(`[fusebase] MCP server listening on ${base}`);
    console.error(`[fusebase]   Streamable HTTP: ${base}/mcp   Legacy SSE: ${base}/sse   Health: ${base}/health`);
    console.error(`[fusebase]   Auth: ${options.authToken ? "bearer token required" : "none (loopback only)"}`);
    const shutdown = () => {
      handle.close().finally(() => process.exit(0));
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } else {
    // Default: Stdio Transport for local desktop & CLI clients
    const { server } = createFusebaseServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Fusebase MCP server running on stdio");
    console.error("📊 Live Platform Status: https://fusebase-mcp.thefusebase.app/");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
