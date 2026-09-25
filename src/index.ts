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

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadCredentialStore } from "./crypto.js";
import { loadEnvironment, resolveTokens } from "./config.js";
import { startProxyRelay } from "./proxy-relay.js";
import { resolveHttpOptions, startHttpServer } from "./http-server.js";
import { bridgeFor, buildClient, setProxyRelayUrl } from "./client-factory.js";
import { createFusebaseServer, SERVER_VERSION } from "./server.js";

/** A new MCP server for one client session; each session keeps its own active profile. */
function newSessionServer() {
  return createFusebaseServer({
    buildClient,
    initialProfile: process.env.FUSEBASE_PROFILE,
    allTools: process.env.FUSEBASE_TOOLS === "all",
  });
}

async function main() {
  // .env, the 1Password Environment and op:// references (see config.ts)
  await loadEnvironment();

  // Check for tokens and auto-discover identity
  const bridge = bridgeFor(resolveTokens(process.env.FUSEBASE_PROFILE));
  if (bridge) {
    try {
      const identity = await bridge.init();
      if (!process.env.FUSEBASE_ORG_ID && identity.orgId) {
        process.env.FUSEBASE_ORG_ID = identity.orgId;
      }
      if (!process.env.FUSEBASE_HOST && identity.orgDomain) {
        process.env.FUSEBASE_HOST = identity.orgDomain;
      }
      console.error(
        `[fusebase] Connected via Direct Token Mode to FuseBase Gate (${bridge.hasGate ? "✓ Gate" : ""}${bridge.hasDashboards ? " ✓ Dashboards" : ""})\n` +
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
      setProxyRelayUrl(relay.url);
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
    const handle = await startHttpServer(options, () => newSessionServer().server, { version: SERVER_VERSION });
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
    const { server } = newSessionServer();
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
