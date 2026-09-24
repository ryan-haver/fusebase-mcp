/**
 * Check the 1Password set-up (docs/1PASSWORD.md) without revealing any secret.
 *
 *   op run --account <your-account>.1password.com --env-file=.env -- npx tsx scripts/check-1password.ts
 *
 * Loads configuration exactly as the server does, then reports which FuseBase variables are
 * set and where they came from. Prints names and sources only, never values.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadEnvironment } from "../src/config.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED = ["FUSEBASE_SECRET_KEY", "FUSEBASE_GATE_TOKEN", "FUSEBASE_DASHBOARDS_TOKEN"];

// Names set in .env with a literal (non-reference) value: those are plaintext secrets on disk.
const plaintextInDotEnv = new Set(
  (fs.existsSync(path.join(ROOT, ".env")) ? fs.readFileSync(path.join(ROOT, ".env"), "utf-8") : "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[A-Z0-9_]+=/.test(l) && !/=\s*["']?op:\/\//.test(l) && !/=\s*$/.test(l))
    .map((l) => l.slice(0, l.indexOf("="))),
);
const before = new Set(Object.keys(process.env).filter((k) => process.env[k]));

let fromEnvironment: string[] = [];
const origError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args.map(String).join(" ");
  const m = msg.match(/Loaded \d+ variable\(s\) from 1Password Environment: (.*)$/);
  if (m && m[1] !== "(none)") fromEnvironment = m[1].split(", ");
  origError(...args);
};
await loadEnvironment();
console.error = origError;

console.log("\n1Password configuration");
console.log(`  FUSEBASE_OP_ACCOUNT:               ${process.env.FUSEBASE_OP_ACCOUNT || "(not set)"}`);
console.log(`  FUSEBASE_OP_ENVIRONMENT_ID:        ${process.env.FUSEBASE_OP_ENVIRONMENT_ID || "(not set)"}`);
console.log(`  FUSEBASE_OP_SERVICE_ACCOUNT_TOKEN: ${process.env.FUSEBASE_OP_SERVICE_ACCOUNT_TOKEN ? "resolved" : "NOT AVAILABLE"}`);
console.log("\nSecrets");
let ok = true;
for (const name of EXPECTED) {
  const legacy = name.replace("FUSEBASE_", "").replace("_TOKEN", "_MCP_TOKEN");
  const set = Boolean(process.env[name]) || (name !== "FUSEBASE_SECRET_KEY" && Boolean(process.env[legacy]));
  const source = fromEnvironment.includes(name) ? "1Password Environment"
    : before.has(name) ? "op run / process environment"
    : plaintextInDotEnv.has(name) || plaintextInDotEnv.has(legacy) ? "PLAINTEXT in .env"
    : set ? "other" : "missing";
  if (!set || source.startsWith("PLAINTEXT")) ok = false;
  console.log(`  ${name.padEnd(26)} ${set ? "set" : "MISSING"}  (${source})`);
}
const leftovers = [...plaintextInDotEnv].filter((n) => /TOKEN|SECRET|KEY|PASSWORD|COOKIE/.test(n));
if (leftovers.length > 0) {
  ok = false;
  console.log(`  PLAINTEXT secrets still in .env: ${leftovers.join(", ")} (move them to the Environment and delete the lines)`);
}
if (fs.existsSync(path.join(process.env.FUSEBASE_DATA_DIR || path.join(ROOT, "data"), ".key"))) {
  console.log("  note: data/.key exists; with FUSEBASE_SECRET_KEY from 1Password it is no longer needed");
}
console.log(ok ? "\n✅ All secrets come from 1Password." : "\n❌ Some secrets are missing or stored in plaintext (see above).");
process.exit(ok ? 0 : 1);
