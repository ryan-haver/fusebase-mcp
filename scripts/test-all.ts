/**
 * Test runner for FuseBase MCP.
 *
 *   npm run test:all                 offline checks, then live suites
 *   npm run test:all -- --offline    offline checks only (same as CI)
 *   npm run test:live                live suites only
 *
 * Offline: typecheck, lint, build, unit tests, tool schema audit.
 * Live: seven standard stages; focused account, automation, agent and email stages are opt-in. Live suites need valid
 * credentials and FUSEBASE_WORKSPACE_ID (a sandbox workspace they may create/delete data in).
 *
 * Every stage runs even if an earlier one fails, so one run shows the full picture.
 * Exits 1 if any stage failed.
 *
 * Each stage's outcome (and, where the stage prints one, its assertion and tool counts) is
 * recorded in .cache/test-results.json; scripts/generate-status-data.ts publishes it.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "node:crypto";
import { sourceIdentity, type EvidenceRun } from "./lib/evidence.js";
import { atomicWrite } from "../src/runtime-data.js";
import { loadEnvironment } from "../src/config.js";
import { parseCounts, type StageCounts } from "./lib/stage-counts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

interface Stage {
  name: string;
  command: string;
  args: string[];
}

const OFFLINE: Stage[] = [
  { name: "Typecheck (src, scripts, tests)", command: "npx", args: ["tsc", "-p", "tsconfig.check.json"] },
  { name: "Lint", command: "npx", args: ["eslint", ".", "--max-warnings=390"] },
  { name: "Build", command: "node", args: ["scripts/build.mjs"] },
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

const FOCUSED: Stage[] = [
  { name: "Focused automation", command: "npx", args: ["tsx", "tests/live/automation-e2e.ts"] },
  { name: "Account preferences", command: "npx", args: ["tsx", "tests/live/account-e2e.ts", "--preferences"] },
  { name: "Authentication refresh", command: "npx", args: ["tsx", "tests/live/account-e2e.ts", "--refresh-auth"] },
  { name: "Agent execution", command: "npx", args: ["tsx", "tests/live/agent-e2e.ts", "--execute"] },
  { name: "Portal email lifecycle", command: "npx", args: ["tsx", "tests/live/portal-email-e2e.ts", "--send-email"] },
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

function runStage(stage: Stage, index: number, total: number): Promise<{ passed: boolean; secs: string; output: string }> {
  console.log(`\n${"=".repeat(80)}\n[${index + 1}/${total}] ${stage.name}\n$ ${stage.command} ${stage.args.join(" ")}\n${"=".repeat(80)}`);
  const started = Date.now();
  return new Promise((resolve) => {
    const bins: Record<string,string> = {tsc:"typescript/bin/tsc",eslint:"eslint/bin/eslint.js",vitest:"vitest/vitest.mjs",tsx:"tsx/dist/cli.mjs"};
    const args = stage.command === "npx" ? [path.join(rootDir,"node_modules",bins[stage.args[0]]),...stage.args.slice(1)] : stage.args;
    const child = spawn(process.execPath, args, { cwd: rootDir, stdio: ["inherit", "pipe", "pipe"], windowsHide:true });
    // Show the output as it arrives, and keep the tail to read the stage's counts from.
    let output = "";
    const keep = (chunk: Buffer, to: NodeJS.WriteStream) => {
      to.write(chunk);
      output = (output + chunk.toString()).slice(-20_000);
    };
    child.stdout?.on("data", (c: Buffer) => keep(c, process.stdout));
    child.stderr?.on("data", (c: Buffer) => keep(c, process.stderr));
    const finish = (passed: boolean) => resolve({ passed, secs: ((Date.now() - started) / 1000).toFixed(1), output });
    child.on("close", (code) => finish(code === 0));
    child.on("error", (err) => {
      console.error(`failed to start: ${err.message}`);
      finish(false);
    });
  });
}

const RESULTS_FILE = path.join(rootDir, ".cache", "test-results.json");

let run: EvidenceRun;
function persistRun(): void {
  atomicWrite(RESULTS_FILE, JSON.stringify(run, null, 2));
  atomicWrite(path.join(rootDir, ".cache", "test-runs", `${run.runId}.json`), JSON.stringify(run, null, 2));
}
function recordResult(stage: Stage, result: { passed: boolean; secs: string }, counts: StageCounts): void {
  run.stages[stage.name] = {
    kind: OFFLINE.includes(stage) ? "offline" : "live", order: [...OFFLINE, ...LIVE, ...FOCUSED].indexOf(stage),
    passed: result.passed, secs: Number(result.secs), runAt: new Date().toISOString(), commit: run.source.commit, ...counts,
  };
  persistRun();
}

async function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => !["--offline", "--offline-only", "--live-only"].includes(arg) && !arg.startsWith("--stage="));
  if (unknown.length) throw new Error(`Unknown test-runner option(s): ${unknown.join(", ")}. Use --offline for checks without account writes.`);
  const offlineOnly = args.includes("--offline") || args.includes("--offline-only");
  const liveOnly = args.includes("--live-only");
  if (offlineOnly && liveOnly) throw new Error("Choose either --offline or --live-only, not both.");
  const requestedStages = args.filter((arg) => arg.startsWith("--stage=")).map((arg) => arg.slice(8));
  const available = [...(liveOnly ? [] : OFFLINE), ...(offlineOnly ? [] : [...LIVE, ...FOCUSED])];
  for (const name of requestedStages) {
    if (!available.some((stage) => stage.name === name)) throw new Error(`Unknown stage '${name}'. Available: ${available.map((stage) => stage.name).join(", ")}`);
  }
  const selected = requestedStages.length ? available.filter((stage) => requestedStages.includes(stage.name)) : available.filter(stage => !FOCUSED.includes(stage));

  const stages = [...selected.filter(stage => stage.name !== "Leftover sweep"), ...selected.filter(stage => stage.name === "Leftover sweep")];

  run = { schemaVersion: 2, runId: randomUUID(), source: sourceIdentity(rootDir), selectedStages: stages.map(s => s.name), startedAt: new Date().toISOString(), complete: false, runtime: process.version, stages: {} };
  persistRun();
  if (stages.some(stage => !OFFLINE.includes(stage))) {
    acquireLiveLock();
    await loadEnvironment();
    // The leftover sweep flags anything in the sandbox created after this moment.
    process.env.LIVE_RUN_STARTED_AT = String(Date.now());
    process.env.LIVE_RUN_ID = run.runId;
    process.env.LIVE_FIXTURE_JOURNAL = path.join(rootDir, "scratch", "live-runs", run.runId, "fixtures.jsonl");
    if (!process.env.FUSEBASE_WORKSPACE_ID) {
      console.error("❌ Live suites need FUSEBASE_WORKSPACE_ID (a sandbox workspace). Set it in .env, or run with --offline.");
      process.exit(1);
    }
  }

  const results: Array<{ name: string; passed: boolean; secs: string }> = [];
  for (let i = 0; i < stages.length; i++) {
    const { output, ...result } = await runStage(stages[i], i, stages.length);
    results.push({ name: stages[i].name, ...result });
    recordResult(stages[i], result, parseCounts(output));
  }

  console.log(`\n${"=".repeat(80)}\nSUMMARY\n${"=".repeat(80)}`);
  for (const r of results) console.log(` ${r.passed ? "✅" : "❌"}  ${r.name} (${r.secs}s)`);
  run.finishedAt = new Date().toISOString();
  run.sourceChanged = sourceIdentity(rootDir).sourceHash !== run.source.sourceHash;
  run.complete = true; persistRun();
  const failed = results.filter((r) => !r.passed).length + (run.sourceChanged ? 1 : 0);
  console.log(`\n${results.length - failed}/${results.length} stages passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
