#!/usr/bin/env node
/**
 * Batch authenticate ALL agent Fusebase profiles.
 * Uses --auto mode with stored credentials for headless login.
 *
 * Usage:
 *   node scripts/auth-all.mjs              # authenticate all profiles
 *   node scripts/auth-all.mjs --dry-run    # list profiles without authenticating
 *   node scripts/auth-all.mjs --help
 *
 * Prerequisites:
 *   1. fusebase_accounts.json must be accessible
 *   2. Credentials must be stored via setup-credentials.mjs
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Args ───────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--help")) {
    console.log(`
Usage: node scripts/auth-all.mjs [options]

Options:
  --dry-run     List profiles without authenticating
  --accounts    Path to fusebase_accounts.json  
  --help        Show this help

Prerequisites:
  Run 'node scripts/setup-credentials.mjs' first to store credentials.
  `);
    process.exit(0);
}

const dryRun = args.includes("--dry-run");

// ─── Find accounts config ───────────────────────────────────────

const accountsIdx = args.indexOf("--accounts");
const customPath = accountsIdx !== -1 ? args[accountsIdx + 1] : null;

const possiblePaths = [
    customPath,
    resolve(__dirname, "..", "..", "agent-coordinator", "src", "fusebase_accounts.json"),
    resolve(process.env.USERPROFILE || process.env.HOME || "", ".antigravity-configs", "fusebase_accounts.json"),
].filter(Boolean);

let accountsPath;
for (const p of possiblePaths) {
    if (existsSync(p)) {
        accountsPath = p;
        break;
    }
}

if (!accountsPath) {
    console.error("❌ Could not find fusebase_accounts.json");
    process.exit(1);
}

// ─── Load credentials check ────────────────────────────────────

const cryptoUrl = new URL("../src/crypto.js", import.meta.url).href;
const { loadCredentials } = await import(cryptoUrl);
const creds = loadCredentials();

if (!creds && !dryRun) {
    console.error("❌ No credentials found. Run 'node scripts/setup-credentials.mjs' first.");
    process.exit(1);
}

// ─── Load profiles ──────────────────────────────────────────────

const config = JSON.parse(readFileSync(accountsPath, "utf-8"));
const profiles = config.fusebase_profiles;
const entries = Object.entries(profiles);

console.log(`\n📋 ${entries.length} profiles from: ${accountsPath}\n`);

if (dryRun) {
    console.log("DRY RUN — listing profiles:\n");
    for (const [role, info] of entries) {
        const hasCreds = creds && creds[info.profile] ? "✅" : "❌";
        console.log(`  ${hasCreds} ${info.display_name}  →  --profile=${info.profile}  (${info.email || "no email"})`);
    }
    console.log(`\nCredentials stored: ${creds ? "yes" : "no"}`);
    process.exit(0);
}

// ─── Authenticate each profile ──────────────────────────────────

const results = { success: [], failed: [] };

console.log("─── Starting batch authentication ───\n");

for (const [role, info] of entries) {
    const profileName = info.profile;

    // Validate profile name to prevent shell injection
    if (!/^[a-z0-9-]+$/i.test(profileName)) {
        console.log(`⏭️  ${info.display_name} — invalid profile name '${profileName}', skipping`);
        results.failed.push({ profile: profileName, reason: "invalid profile name" });
        continue;
    }

    if (!creds[profileName]) {
        console.log(`⏭️  ${info.display_name} — no credentials stored, skipping`);
        results.failed.push({ profile: profileName, reason: "no credentials" });
        continue;
    }

    process.stdout.write(`🔐 ${info.display_name} (${profileName})... `);

    try {
        execSync(
            `npx tsx scripts/auth.ts --auto --profile=${profileName}`,
            {
                cwd: resolve(__dirname, ".."),
                stdio: ["pipe", "pipe", "pipe"],
                timeout: 60_000,
            },
        );
        console.log("✅");
        results.success.push(profileName);
    } catch (err) {
        const stderr = err.stderr?.toString() || err.message;
        console.log("❌");
        console.error(`   Error: ${stderr.split("\n").slice(-2).join(" ").trim()}`);
        results.failed.push({ profile: profileName, reason: stderr.split("\n")[0] });
    }

    // Brief pause between auths to avoid rate limiting
    await new Promise((r) => setTimeout(r, 2000));
}

// ─── Summary ────────────────────────────────────────────────────

console.log("\n─── Results ───\n");
console.log(`✅ ${results.success.length}/${entries.length} authenticated successfully`);

if (results.failed.length > 0) {
    console.log(`❌ ${results.failed.length} failed:`);
    for (const f of results.failed) {
        console.log(`   - ${f.profile}: ${f.reason}`);
    }
}

console.log("\nCookies saved to: data/cookie_<profile>.enc");
process.exit(results.failed.length > 0 ? 1 : 0);
