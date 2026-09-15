/**
 * Master Unified Test Runner for FuseBase MCP
 *
 * Runs the entire quality, validation, and end-to-end testing pipeline:
 *  1. TypeScript compilation & unused locals check (tsc --noUnusedLocals --noEmit)
 *  2. Schema & Documentation Audit (audit-tools.ts - validates 165 tools & README parity)
 *  3. Flow Automations & Hosted Vibe Apps (test-cli-and-flow.ts)
 *  4. Block Model & Quill Delta Regression (test-regression.ts)
 *  5. MCP Protocol & Prompts End-to-End Test (test-mcp-e2e.ts - 165 tools, 17 prompts, 8 resources)
 *  6. Database Engine & Relational E2E (test-database-e2e.ts - 44 live database assertions)
 *  7. Full-Spectrum Live Data Validation (test-data-validation.ts - 165/165 tools live data validation)
 */

import { spawn } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

interface TestStep {
  name: string;
  command: string;
  args: string[];
  description: string;
}

const STEPS: TestStep[] = [
  {
    name: "Static Type & Clean Code Audit",
    command: "npx",
    args: ["tsc", "--noUnusedLocals", "--noEmit"],
    description: "Validates TypeScript compiler rules and ensures zero orphaned locals or unused imports",
  },
  {
    name: "Tool Schema & Documentation Audit",
    command: "npx",
    args: ["tsx", "scripts/audit-tools.ts"],
    description: "Validates 100% parameter descriptions, schema conformance, and README documentation parity",
  },
  {
    name: "Flow Automations & Hosted Vibe Apps",
    command: "npx",
    args: ["tsx", "scripts/test-cli-and-flow.ts"],
    description: "Validates Vibe Coding CLI commands, secret managers, sidecars, and automated workflow triggers",
  },
  {
    name: "Block Model & Quill Delta Regression",
    command: "npx",
    args: ["tsx", "scripts/test-regression.ts"],
    description: "Validates all 22 block types, rich content formatting, and hierarchical content generation",
  },
  {
    name: "MCP Protocol & Prompts E2E",
    command: "npx",
    args: ["tsx", "scripts/test-mcp-e2e.ts"],
    description: "Validates MCP JSON-RPC protocol, 17 pre-engineered prompts, 8 resources, and tool registration",
  },
  {
    name: "Database Engine & Relational E2E",
    command: "npx",
    args: ["tsx", "scripts/test-database-e2e.ts"],
    description: "Validates live database CRUD, views, formulas, columns, relations, and Gate isolated SQL stores",
  },
  {
    name: "Full-Spectrum Live Data Validation",
    command: "npx",
    args: ["tsx", "scripts/test-data-validation.ts"],
    description: "Executes and deeply validates data structures across all 165 tools against live FuseBase infrastructure",
  },
];

async function runStep(step: TestStep, index: number, total: number): Promise<boolean> {
  console.log(`\n================================================================================`);
  console.log(`[Step ${index + 1}/${total}] ${step.name}`);
  console.log(`Command: ${step.command} ${step.args.join(" ")}`);
  console.log(`Description: ${step.description}`);
  console.log(`================================================================================\n`);

  const startTime = Date.now();

  return new Promise<boolean>((resolve) => {
    const child = spawn(step.command, step.args, {
      cwd: rootDir,
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
      },
    });

    child.on("close", (code) => {
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`\n✅ Step ${index + 1}/${total} (${step.name}) PASSED in ${elapsedSec}s\n`);
        resolve(true);
      } else {
        console.error(`\n❌ Step ${index + 1}/${total} (${step.name}) FAILED with exit code ${code} in ${elapsedSec}s\n`);
        resolve(false);
      }
    });

    child.on("error", (err) => {
      console.error(`\n❌ Step ${index + 1}/${total} (${step.name}) failed to start:`, err);
      resolve(false);
    });
  });
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║               FUSEBASE MCP MASTER UNIFIED VERIFICATION PIPELINE              ║");
  console.log("║         165 Tools  •  17 Prompts  •  8 Resources  •  Deep Data Validation     ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝");

  const overallStart = Date.now();
  const results: { name: string; passed: boolean }[] = [];

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const passed = await runStep(step, i, STEPS.length);
    results.push({ name: step.name, passed });
    if (!passed) {
      console.error(`\n🚨 Pipeline stopped due to failure at step: ${step.name}\n`);
      break;
    }
  }

  const overallElapsed = ((Date.now() - overallStart) / 1000).toFixed(1);
  const allPassed = results.length === STEPS.length && results.every((r) => r.passed);

  console.log("\n================================================================================");
  console.log("                        PIPELINE EXECUTION SUMMARY                              ");
  console.log("================================================================================");
  for (const r of results) {
    console.log(` ${r.passed ? "✅" : "❌"}  ${r.name}`);
  }
  console.log("--------------------------------------------------------------------------------");
  console.log(` Total Time: ${overallElapsed}s | Completed Steps: ${results.filter((r) => r.passed).length}/${STEPS.length}`);
  console.log("================================================================================\n");

  if (!allPassed) {
    process.exit(1);
  }

  console.log("🎉 ALL 7 VERIFICATION STAGES COMPLETED WITH 100% PASS RATE!\n");
}

main().catch((err) => {
  console.error("Master test runner failed with unhandled exception:", err);
  process.exit(1);
});
