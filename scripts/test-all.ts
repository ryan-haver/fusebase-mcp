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
  { name: "Direct token connection", command: "npx", args: ["tsx", "scripts/test-token-direct-connection.ts"] },
  { name: "MCP protocol & page lifecycle", command: "npx", args: ["tsx", "scripts/test-mcp-e2e.ts"] },
  { name: "Block model regression", command: "npx", args: ["tsx", "scripts/test-regression.ts"] },
  { name: "Database engine", command: "npx", args: ["tsx", "scripts/test-database-e2e.ts"] },
  { name: "Live data validation", command: "npx", args: ["tsx", "scripts/test-data-validation.ts"] },
  { name: "Token vs cookie parity", command: "npx", args: ["tsx", "scripts/test-token-parity.ts"] },
];

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
    await loadEnvironment();
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
