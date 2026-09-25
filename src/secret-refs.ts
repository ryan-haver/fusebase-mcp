/**
 * 1Password integration. See docs/1PASSWORD.md for the set-up.
 *
 * The recommended launch is `op run --env-file=.env -- node dist/index.js`: op run resolves the
 * `op://` references before the server starts, and the steps below find nothing to resolve.
 * Without op run, startup (config.ts loadEnvironment) does it itself:
 *  1. FUSEBASE_OP_SERVICE_ACCOUNT_TOKEN is usually an `op://` reference to the service account
 *     token saved in 1Password. It is read with the 1Password CLI through the desktop app, as the
 *     account in FUSEBASE_OP_ACCOUNT (you approve the prompt), so the token is never on disk.
 *  2. The 1Password Environment FUSEBASE_OP_ENVIRONMENT_ID is loaded with the 1Password SDK and
 *     that service account (the stable CLI can't read Environments yet).
 *  3. Any other `op://` value is read with the CLI as the service account.
 *
 * OP_SERVICE_ACCOUNT_TOKEN from the surrounding environment is never passed to `op`: on a shared
 * machine it may belong to another tool's service account.
 *
 * A reference that can't be resolved is removed from the environment (never left as the literal
 * "op://..." string, which would be sent as a token) and reported by variable name only.
 */

import { execFileSync } from "child_process";

export type SecretReader = (ref: string) => string;

// Long enough for a person to approve the desktop app prompt.
const OP_TIMEOUT_MS = 120_000;

export function isSecretReference(value: string | undefined): value is string {
  return typeof value === "string" && value.startsWith("op://");
}

/**
 * Read one secret with `op read`: as the FuseBase service account once its token is resolved,
 * otherwise through the desktop app as FUSEBASE_OP_ACCOUNT.
 */
export function opRead(ref: string): string {
  const env = { ...process.env };
  delete env.OP_SERVICE_ACCOUNT_TOKEN; // may belong to another tool
  const args = ["read", "--no-newline", ref];
  const saToken = process.env.FUSEBASE_OP_SERVICE_ACCOUNT_TOKEN;
  if (saToken && !isSecretReference(saToken)) {
    env.OP_SERVICE_ACCOUNT_TOKEN = saToken;
  } else if (process.env.FUSEBASE_OP_ACCOUNT) {
    args.unshift("--account", process.env.FUSEBASE_OP_ACCOUNT);
  }
  return execFileSync("op", args, {
    encoding: "utf-8",
    env,
    timeout: OP_TIMEOUT_MS,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Replace every `op://` value in `env` with its secret. Returns the names of variables that
 * could not be resolved (they are deleted from `env`).
 */
export function resolveSecretReferences(
  env: NodeJS.ProcessEnv = process.env,
  read: SecretReader = opRead,
  only?: readonly string[],
): string[] {
  const failed: string[] = [];
  const cache = new Map<string, string>();
  for (const [name, value] of Object.entries(env)) {
    if (!isSecretReference(value)) continue;
    if (only && !only.includes(name)) continue;
    try {
      let secret = cache.get(value);
      if (secret === undefined) {
        secret = read(value).trim();
        if (!secret) throw new Error("empty value");
        cache.set(value, secret);
      }
      env[name] = secret;
    } catch (err) {
      delete env[name];
      failed.push(name);
      const detail = err instanceof Error ? firstLine(err.message) : "unknown error";
      console.error(`[fusebase] Could not read ${name} from 1Password (${detail}). Is \`op\` installed and signed in?`);
    }
  }
  return failed;
}

function firstLine(message: string): string {
  // execFileSync errors include the command and stderr; keep it short.
  const stderrLine = message.split("\n").map((l) => l.trim()).find((l) => /^\[ERROR\]/.test(l));
  return (stderrLine ?? message.split("\n")[0]).slice(0, 200);
}

// ─── 1Password Environments ─────────────────────────────────────

/** Fetch an Environment's variables (name → value). */
export type EnvironmentFetcher = (environmentId: string, serviceAccountToken: string) => Promise<Array<{ name: string; value: string }>>;

/** Read an Environment with the 1Password SDK (loaded only when an Environment is configured). */
export const sdkFetchEnvironment: EnvironmentFetcher = async (environmentId, serviceAccountToken) => {
  const { createClient } = await import("@1password/sdk");
  const client = await createClient({ auth: serviceAccountToken, integrationName: "fusebase-mcp", integrationVersion: "1.0.0" });
  const { variables } = await client.environments.getVariables(environmentId);
  return variables;
};

/**
 * Load the variables of the 1Password Environment named by FUSEBASE_OP_ENVIRONMENT_ID, read with
 * the service account in FUSEBASE_OP_SERVICE_ACCOUNT_TOKEN. Variables already set in the real
 * environment win; `overridable` names (values that came from .env files) are replaced.
 * Returns the names loaded. Failures are logged, never thrown: the server then runs with
 * whatever else is configured.
 */
export async function loadOnePasswordEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  options: { overridable?: ReadonlySet<string>; fetch?: EnvironmentFetcher } = {},
): Promise<string[]> {
  const environmentId = env.FUSEBASE_OP_ENVIRONMENT_ID?.trim();
  if (!environmentId) return [];
  // Already loaded by a parent process (its variables were inherited).
  if (env.FUSEBASE_OP_ENVIRONMENT_LOADED === environmentId) return [];
  // Only the FuseBase service account: OP_SERVICE_ACCOUNT_TOKEN may belong to another tool.
  const token = env.FUSEBASE_OP_SERVICE_ACCOUNT_TOKEN;
  if (!token) {
    console.error("[fusebase] FUSEBASE_OP_ENVIRONMENT_ID is set but FUSEBASE_OP_SERVICE_ACCOUNT_TOKEN is not; skipping the 1Password Environment.");
    return [];
  }
  try {
    const variables = await (options.fetch ?? sdkFetchEnvironment)(environmentId, token);
    const loaded: string[] = [];
    for (const { name, value } of variables) {
      if (!name || value === undefined) continue;
      if (env[name] && !options.overridable?.has(name)) continue; // the real environment wins
      env[name] = value;
      loaded.push(name);
    }
    env.FUSEBASE_OP_ENVIRONMENT_LOADED = environmentId;
    console.error(`[fusebase] Loaded ${loaded.length} variable(s) from 1Password Environment: ${loaded.join(", ") || "(none)"}`);
    return loaded;
  } catch (err) {
    const detail = err instanceof Error ? firstLine(err.message) : String(err).slice(0, 200);
    console.error(`[fusebase] Could not load 1Password Environment ${environmentId} (${detail}).`);
    return [];
  }
}
