/**
 * Shared configuration loading for the server and the test harness.
 *
 * Single source of truth for:
 *  - .env loading (project root only)
 *  - token resolution, including the legacy GATE_MCP_TOKEN / DASHBOARDS_MCP_TOKEN aliases
 */

import * as fs from "fs";
import { parseEnv } from "node:util";
import * as path from "path";
import { fileURLToPath } from "url";
import { assertValidProfile, loadEncryptedToken, type TokenCredentials } from "./crypto.js";
import { loadOnePasswordEnvironment, opRead, resolveSecretReferences } from "./secret-refs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

/**
 * Load configuration into process.env, in order of precedence:
 *   1. the real environment (never overridden),
 *   2. the 1Password Environment named by FUSEBASE_OP_ENVIRONMENT_ID,
 *   3. .env at the project root.
 * `op://` references are resolved along the way (see secret-refs.ts and docs/1PASSWORD.md).
 * Set FUSEBASE_NO_DOTENV=1 to skip the .env files (used by hermetic tests).
 */
export async function loadEnvironment(): Promise<void> {
  // .env first: it may hold FUSEBASE_OP_ENVIRONMENT_ID. Its values may be replaced by the Environment.
  const fromFiles = process.env.FUSEBASE_NO_DOTENV !== "1" ? loadDotEnvFiles() : new Set<string>();
  // The service account token first (desktop app prompt), then the Environment it can read.
  resolveSecretReferences(process.env, opRead, ["FUSEBASE_OP_SERVICE_ACCOUNT_TOKEN"]);
  await loadOnePasswordEnvironment(process.env, { overridable: fromFiles });
  resolveSecretReferences();
}

/** Synchronous variant without the 1Password Environment (.env files and op:// references only). */
export function loadDotEnv(): void {
  if (process.env.FUSEBASE_NO_DOTENV !== "1") loadDotEnvFiles();
  resolveSecretReferences();
}

/** Load .env files; existing env vars win. Returns the names this call set. */
function loadDotEnvFiles(): Set<string> {
  const set = new Set<string>();
  const envPath = path.join(PROJECT_ROOT, ".env");
  if (fs.existsSync(envPath)) {
    for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(envPath, "utf-8")))) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
        set.add(key);
      }
    }
  }
  return set;
}

export type TokenConfig = TokenCredentials;

/** The public "default" alias always means the unqualified credential store. */
export function normalizeProfile(profile?: string): string | undefined {
  const selected = !profile || profile === "default" ? undefined : profile;
  assertValidProfile(selected);
  return selected;
}

/**
 * Named profiles use only their own encrypted tokens. For the default profile, environment
 * tokens take precedence over the default store; never merge credentials from both sources.
 */
export function resolveTokens(profile?: string): TokenConfig {
  profile = normalizeProfile(profile);
  if (profile) return loadEncryptedToken(profile) ?? {};
  const fromEnv: TokenConfig = {
    gateToken: process.env.FUSEBASE_GATE_TOKEN || process.env.GATE_MCP_TOKEN || undefined,
    dashboardsToken: process.env.FUSEBASE_DASHBOARDS_TOKEN || process.env.DASHBOARDS_MCP_TOKEN || undefined,
    token: process.env.FUSEBASE_TOKEN || undefined,
  };
  if (fromEnv.gateToken || fromEnv.dashboardsToken || fromEnv.token) return fromEnv;

  const stored = loadEncryptedToken(profile);
  if (!stored) return {};
  return stored;
}

export function hasAnyToken(tokens: TokenConfig): boolean {
  return Boolean(tokens.gateToken || tokens.dashboardsToken || tokens.token);
}
