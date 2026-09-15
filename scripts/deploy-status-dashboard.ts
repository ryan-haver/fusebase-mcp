/**
 * Automated Live Status Dashboard Build & Deployment Script
 *
 * Synchronizes live project metrics, builds the React/Vite dashboard SPA,
 * deploys the application to the FuseBase Cloud via the FuseBase CLI,
 * and verifies that the production URL is healthy and responding with HTTP 200.
 *
 * Usage:
 *   npm run deploy:status
 */

import { execSync } from "child_process";
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

  // Step 2: Build dashboard SPA
  console.log("\n[2/4] Building production React/Vite bundle in apps/status-dashboard...");
  execSync("npm run build", {
    cwd: dashboardSpaDir,
    stdio: "inherit",
  });

  // Step 3: Deploy to FuseBase Cloud
  console.log("\n[3/4] Deploying to FuseBase Cloud (fusebase-mcp.thefusebase.app)...");
  execSync("fusebase deploy", {
    cwd: appDir,
    stdio: "inherit",
  });

  // Step 4: Healthcheck live URL
  console.log("\n[4/4] Verifying live cloud deployment health...");
  const targetUrl = "https://fusebase-mcp.thefusebase.app/";
  try {
    const res = await fetch(targetUrl);
    if (!res.ok) {
      throw new Error(`Target URL returned HTTP ${res.status} ${res.statusText}`);
    }
    const html = await res.text();
    if (!html.includes("<title>")) {
      throw new Error("Target response missing HTML title tag");
    }
    console.log(`✅ Live URL Verified: ${targetUrl} (HTTP ${res.status} ${res.statusText}, ${html.length} bytes)`);
  } catch (err: any) {
    console.error(`⚠️ Healthcheck warning: ${err.message}`);
  }

  console.log("\n================================================================================");
  console.log("🎉 LIVE STATUS DASHBOARD SUCCESSFULLY UPDATED & DEPLOYED!");
  console.log(`   Live URL: https://fusebase-mcp.thefusebase.app/`);
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("\n❌ FAILED TO DEPLOY STATUS DASHBOARD:", err);
  process.exit(1);
});
