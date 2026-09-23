/**
 * Shared configuration loading for the server and the test harness.
 *
 * Single source of truth for:
 *  - .env loading (project root, plus the legacy apps/client-portal-dashboard/.env)
 *  - token resolution, including the legacy GATE_MCP_TOKEN / DASHBOARDS_MCP_TOKEN aliases
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadEncryptedToken } from "./crypto.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

/**
 * Load .env files from project root and apps if present. Existing env vars win.
 * Set FUSEBASE_NO_DOTENV=1 to skip (used by hermetic tests).
 */
export function loadDotEnv(): void {
  if (process.env.FUSEBASE_NO_DOTENV === "1") return;
  const envPaths = [
    path.join(PROJECT_ROOT, ".env"),
    path.join(PROJECT_ROOT, "apps", "client-portal-dashboard", ".env"),
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

export interface TokenConfig {
  gateToken?: string;
  dashboardsToken?: string;
  token?: string;
}

/**
 * Resolve Gate / Dashboards / unified tokens from the environment, falling back to
 * the encrypted token store for the given profile when no env token is set.
 */
export function resolveTokens(profile?: string): TokenConfig {
  const fromEnv: TokenConfig = {
    gateToken: process.env.FUSEBASE_GATE_TOKEN || process.env.GATE_MCP_TOKEN || undefined,
    dashboardsToken: process.env.FUSEBASE_DASHBOARDS_TOKEN || process.env.DASHBOARDS_MCP_TOKEN || undefined,
    token: process.env.FUSEBASE_TOKEN || undefined,
  };
  if (fromEnv.gateToken || fromEnv.dashboardsToken || fromEnv.token) return fromEnv;

  const stored = loadEncryptedToken(profile);
  if (!stored) return {};
  return {
    gateToken: stored.gateToken,
    dashboardsToken: stored.dashboardsToken,
    token: stored.token,
  };
}

export function hasAnyToken(tokens: TokenConfig): boolean {
  return Boolean(tokens.gateToken || tokens.dashboardsToken || tokens.token);
}
