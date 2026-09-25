/**
 * Test runner for FuseBase MCP.
 *
 *   npm run test:all                 offline checks, then live suites
 *   npm run test:all -- --offline    offline checks only (same as CI)
 *   npm run test:live                live suites only
 *
 * Offline: typecheck, lint, build, unit tests, tool schema audit.
 * Live: every suite under scripts/test-*.ts that talks to FuseBase. Live suites need valid
 * credentials and FUSEBASE_WORKSPACE_ID (a sandbox workspace they may create/delete data in).
 *
 * Every stage runs even if an earlier one fails, so one run shows the full picture.
 * Exits 1 if any stage failed.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadEnvironment } from "../src/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

interface Stage {
  name: string;
  command: string;
  args: string[];
}

const OFFLINE: Stage[] = [
  { name: "Typecheck (src, scripts, tests)", command: "npx", args: ["tsc", "-p", "tsconfig.check.json"] },
  { name: "Lint", command: "npx", args: ["eslint", "."] },
  { name: "Build", command: "npx", args: ["tsc"] },
  { name: "Unit tests", command: "npx", args: ["vitest", "run"] },
  { name: "Tool schema & README audit", command: "npx", args: ["tsx", "scripts/audit-tools.ts"] },
];

const LIVE: Stage[] = [
  { name: "Direct token connection", command: "npx", args: ["tsx", "tests/live/token-direct-connection.ts"] },
  { name: "MCP protocol & page lifecycle", command: "npx", args: ["tsx", "tests/live/mcp-e2e.ts"] },
  { name: "Block model regression", command: "npx", args: ["tsx", "tests/live/block-regression.ts"] },
  { name: "Database engine", command: "npx", args: ["tsx", "tests/live/database-e2e.ts"] },
  { name: "Live data validation", command: "npx", args: ["tsx", "tests/live/data-validation.ts"] },
  { name: "Token vs cookie parity", command: "npx", args: ["tsx", "tests/live/token-parity.ts"] },
  // Last: everything the suites created must be gone.
  { name: "Leftover sweep", command: "npx", args: ["tsx", "tests/live/sweep-sandbox.ts"] },
];

/**
 * Only one live run at a time: two runs in the same sandbox see each other's content as
 * leftovers and can flip the same account settings. Returns a release function.
 */
function acquireLiveLock(): () => void {
  const lock = path.join(os.tmpdir(), "fusebase-mcp-live-tests.lock");
  try {
    fs.writeFileSync(lock, String(process.pid), { flag: "wx" });
  } catch {
    const holder = Number(fs.readFileSync(lock, "utf-8").trim());
    let alive = false;
    try {
      process.kill(holder, 0);
      alive = true;
    } catch {
      // stale lock from a run that ended without releasing it
    }
    if (alive) {
      console.error(`❌ Another live test run (pid ${holder}) is in progress. Wait for it to finish; two runs in one sandbox interfere.`);
      process.exit(1);
    }
    fs.writeFileSync(lock, String(process.pid));
  }
  const release = () => {
    try {
      if (fs.readFileSync(lock, "utf-8").trim() === String(process.pid)) fs.unlinkSync(lock);
    } catch {
      // already gone
    }
  };
  process.on("exit", release);
  return release;
}

function runStage(stage: Stage, index: number, total: number): Promise<{ passed: boolean; secs: string }> {
  console.log(`\n${"=".repeat(80)}\n[${index + 1}/${total}] ${stage.name}\n$ ${stage.command} ${stage.args.join(" ")}\n${"=".repeat(80)}`);
  const started = Date.now();
  return new Promise((resolve) => {
    // shell is needed on Windows to resolve npx.cmd; args are fixed strings above.
    const child = spawn(stage.command, stage.args, { cwd: rootDir, stdio: "inherit", shell: process.platform === "win32" });
    const finish = (passed: boolean) => resolve({ passed, secs: ((Date.now() - started) / 1000).toFixed(1) });
    child.on("close", (code) => finish(code === 0));
    child.on("error", (err) => {
      console.error(`failed to start: ${err.message}`);
      finish(false);
    });
  });
}

async function main() {
  const offlineOnly = process.argv.includes("--offline");
  const liveOnly = process.argv.includes("--live-only");
  const stages = [...(liveOnly ? [] : OFFLINE), ...(offlineOnly ? [] : LIVE)];

  if (!offlineOnly) {
    acquireLiveLock();
    await loadEnvironment();
    // The leftover sweep flags anything in the sandbox created after this moment.
    process.env.LIVE_RUN_STARTED_AT = String(Date.now());
    if (!process.env.FUSEBASE_WORKSPACE_ID) {
      console.error("❌ Live suites need FUSEBASE_WORKSPACE_ID (a sandbox workspace). Set it in .env, or run with --offline.");
      process.exit(1);
    }
  }

  const results: Array<{ name: string; passed: boolean; secs: string }> = [];
  for (let i = 0; i < stages.length; i++) {
    results.push({ name: stages[i].name, ...(await runStage(stages[i], i, stages.length)) });
  }

  console.log(`\n${"=".repeat(80)}\nSUMMARY\n${"=".repeat(80)}`);
  for (const r of results) console.log(` ${r.passed ? "✅" : "❌"}  ${r.name} (${r.secs}s)`);
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${results.length - failed}/${results.length} stages passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
