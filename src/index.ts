#!/usr/bin/env node

/**
 * Fusebase MCP Server
 *
 * Provides tools for interacting with Fusebase (formerly Nimbus Note)
 * via its internal web API. Runs over stdio transport.
 *
 * Required env vars:
 *   FUSEBASE_HOST    — e.g. "yourorg.nimbusweb.me"
 *   FUSEBASE_ORG_ID  — e.g. "uXXXXX"
 *   FUSEBASE_COOKIE  — session cookie string from browser
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FusebaseClient } from "./client.js";
import { loadEncryptedCookie, loadCredentialStore } from "./crypto.js";
import { startProxyRelay } from "./proxy-relay.js";
import { registerCoreTools } from "./tools/core-tools.js";
import { registerExtendedTools } from "./tools/extended-tools.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ─────────────────────────────────────────────────────

/** Load .env file from project root if present */
function loadDotEnv(): void {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    // Only set if not already in env (env vars take precedence)
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

// Load env vars at startup
loadDotEnv();

// ─── Server Setup ───────────────────────────────────────────────

let _proxyRelayUrl: string | undefined;

function getClient(profile?: string): FusebaseClient {
  const host = process.env.FUSEBASE_HOST;
  const orgId = process.env.FUSEBASE_ORG_ID;

  if (!host || !orgId) {
    console.error("Missing FUSEBASE_HOST or FUSEBASE_ORG_ID");
    process.exit(1);
  }

  let cookie = process.env.FUSEBASE_COOKIE || "";
  // If a profile is requested, or if no default cookie was provided in env, load from disk
  if (!cookie || profile) {
    const stored = loadEncryptedCookie(profile);
    if (stored?.cookie) {
      cookie = stored.cookie;
    } else if (profile) {
      console.error(`[fusebase] Warning: No cookie found for profile "${profile}". Will attempt to fall back or fail.`);
    }
  }

  if (!cookie) {
    console.error(`[fusebase] Warning: No cookie found. Run 'npx tsx scripts/auth.ts${profile ? ` --profile ${profile}` : ""}' to authenticate.`);
  }

  // Use proxy relay URL if started in main()
  return new FusebaseClient({ host, orgId, cookie, autoRefresh: true, profile, proxyRelayUrl: _proxyRelayUrl });
}

const server = new McpServer({
  name: "fusebase",
  version: "1.0.0",
});

// ─── Tool Tier Management & Registration ────────────────────────

let extendedToolsRegistered = false;

function enableExtendedTools() {
  if (extendedToolsRegistered) return;
  registerExtendedTools(server, getClient);
  extendedToolsRegistered = true;
  console.error(`[fusebase] Extended tools registered (91 total)`);
}

// Register core tools
registerCoreTools(server, getClient, {
  enableExtendedTools,
  isExtendedToolsEnabled: () => extendedToolsRegistered,
});

// Register extended tools at startup if FUSEBASE_TOOLS=all
if (process.env.FUSEBASE_TOOLS === "all") {
  enableExtendedTools();
} else {
  console.error("[fusebase] Running in core mode (23 tools). Set FUSEBASE_TOOLS=all or call set_tool_tier to enable all 91.");
}

// ─── Start ──────────────────────────────────────────────────────

async function main() {
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
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
