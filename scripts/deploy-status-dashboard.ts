/**
 * Automated Live Status Dashboard Build & Deployment Script
 *
 * Synchronizes live project metrics, builds the React/Vite dashboard SPA,
 * deploys the application to the FuseBase Cloud via the FuseBase CLI,
 * and verifies the exact live manifest and rendered application in Chromium.
 *
 * Usage:
 *   npm run deploy:status
 */

import { openVerificationBrowser, verifyDashboardBrowser } from "./lib/dashboard-browser.js";
import { randomUUID } from "node:crypto";
import { sourceIdentity, evidenceState, type EvidenceRun } from "./lib/evidence.js";
import { verifyRelease, type ReleaseManifest } from "./lib/deployment-verification.js";
import { execSync, execFileSync } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const appDir = path.join(rootDir, "apps/client-portal-dashboard");
const dashboardSpaDir = path.join(appDir, "apps/status-dashboard");

import * as fs from "fs";

async function main() {
  console.log("\n================================================================================");
  console.log("🚀 FUSEBASE MCP: LIVE STATUS DASHBOARD BUILD & DEPLOY PIPELINE");
  console.log("================================================================================\n");

  // Step 0: Pre-flight domain safety assertion
  console.log("[0/4] Verifying target application identity & subdomain isolation...");
  const configPath = path.join(appDir, "fusebase.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`fusebase.json not found in ${appDir}`);
  }
  const fuseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const targetSub = fuseConfig.apps?.[0]?.subdomain || fuseConfig.firstAppSub;
  const targetProdId = fuseConfig.productId;

  if (targetSub !== "fusebase-mcp" || targetProdId !== "3levnl9diecglj2a") {
    throw new Error(
      `ABORT: Domain collision guard triggered! Target is '${targetSub}' (productId: ${targetProdId}), ` +
      `expected strictly 'fusebase-mcp' (productId: '3levnl9diecglj2a'). Refusing to deploy.`
    );
  }
  console.log(`✅ Pre-flight verified: Isolated target domain is strictly 'https://${targetSub}.thefusebase.app/' (Product: ${targetProdId})\n`);
  console.log("[1/4] Syncing latest project status metrics and git commit hash...");
  execSync("npx tsx scripts/generate-status-data.ts", {
    cwd: rootDir,
    stdio: "inherit",
  });

  const source = sourceIdentity(rootDir);
  if (source.dirty) throw new Error("Deployment requires a clean committed source tree");
  const evidence = JSON.parse(fs.readFileSync(path.join(rootDir, ".cache/test-results.json"), "utf8")) as EvidenceRun;
  const required = ["Typecheck (src, scripts, tests)", "Lint", "Build", "Unit tests", "Tool schema & README audit"];
  if (evidenceState(evidence, source) !== "current" || required.some(name => !evidence.stages[name]?.passed)) throw new Error("Deployment requires current, complete, passing offline evidence for this exact source");
  const branch = execFileSync("git", ["branch", "--show-current"], { cwd: rootDir, encoding: "utf8" }).trim();
  const remote = execFileSync("git", ["ls-remote", "origin", `refs/heads/${branch}`], { cwd: rootDir, encoding: "utf8" }).trim().split(/\s+/)[0];
  if (!branch || remote !== source.commit) throw new Error("Push this exact commit before deploying");
  const release: ReleaseManifest = { commit: source.commit, sourceHash: source.sourceHash, buildId: randomUUID(), evidenceRunId: evidence.runId ?? null };
  fs.mkdirSync(path.join(dashboardSpaDir, "public"), { recursive: true });
  fs.writeFileSync(path.join(dashboardSpaDir, "public/release.json"), JSON.stringify(release));
  // Step 2: Build dashboard SPA
  console.log("\n[2/4] Building production React/Vite bundle in apps/status-dashboard...");
  execSync("npm run build", {
    cwd: dashboardSpaDir,
    stdio: "inherit",
  });

  execSync("npm run test:dashboard", { cwd: rootDir, stdio: "inherit" });
  const browser = await openVerificationBrowser();
  try {
    // Step 3: Deploy to FuseBase Cloud
    console.log("\n[3/4] Deploying to FuseBase Cloud (fusebase-mcp.thefusebase.app)...");
    execSync("fusebase deploy", {
      cwd: appDir,
      stdio: "inherit",
    });

    // Step 4: Healthcheck live URL
    console.log("\n[4/4] Verifying live cloud deployment health...");
    const targetUrl = "https://fusebase-mcp.thefusebase.app/";
    await verifyRelease(targetUrl, release);
    await verifyDashboardBrowser(browser, targetUrl, source.sourceHash);
    console.log(`Verified release ${release.buildId} and browser rendering at ${targetUrl}`);
  } finally { await browser.close(); }

  console.log("\n================================================================================");
  console.log("🎉 LIVE STATUS DASHBOARD SUCCESSFULLY UPDATED & DEPLOYED!");
  console.log(`   Live URL: https://fusebase-mcp.thefusebase.app/`);
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("\n❌ FAILED TO DEPLOY STATUS DASHBOARD:", err);
  process.exit(1);
});
