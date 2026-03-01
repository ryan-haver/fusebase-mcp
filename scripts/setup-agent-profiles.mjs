#!/usr/bin/env node
/**
 * Setup and authenticate all agent Fusebase profiles.
 *
 * Behavior:
 * - If credentials are stored (credentials.enc exists) → uses --auto mode (headless)
 * - Otherwise → opens browser for manual login per profile (interactive)
 *
 * Usage:
 *   node scripts/setup-agent-profiles.mjs                     # auto-detect mode
 *   node scripts/setup-agent-profiles.mjs --manual            # force manual mode
 *   node scripts/setup-agent-profiles.mjs --accounts /path    # custom accounts file
 *   node scripts/setup-agent-profiles.mjs --help
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import * as readline from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

if (args.includes("--help")) {
    console.log(`
Usage: node scripts/setup-agent-profiles.mjs [options]

Options:
  --manual          Force manual browser login (skip auto-detection)
  --accounts <path> Path to fusebase_accounts.json
  --help            Show this help

Auto-detection:
  If data/credentials.enc exists → headless auto-login
  Otherwise → interactive browser login per profile
  `);
    process.exit(0);
}

const forceManual = args.includes("--manual");

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

// ─── Check for stored credentials ──────────────────────────────

let hasCredentials = false;
if (!forceManual) {
    const cryptoUrl = new URL("../dist/crypto.js", import.meta.url).href;
    try {
        const { loadCredentials } = await import(cryptoUrl);
        const creds = loadCredentials();
        hasCredentials = creds !== null && Object.keys(creds).length > 0;
    } catch {
        hasCredentials = false;
    }
}

// ─── Load profiles ──────────────────────────────────────────────

console.log(`📋 Loading profiles from: ${accountsPath}\n`);
const config = JSON.parse(readFileSync(accountsPath, "utf-8"));
const profiles = config.fusebase_profiles;
const entries = Object.entries(profiles);

console.log(`Found ${entries.length} profiles to authenticate:\n`);
for (const [role, info] of entries) {
    console.log(`  ${info.display_name}  →  --profile=${info.profile}  (${role})`);
}

// ─── Auto mode (credentials found) ─────────────────────────────

if (hasCredentials) {
    console.log("\n🤖 Credentials found! Using auto-login mode (headless).\n");
    console.log("─── Starting batch authentication ───\n");

    const results = { success: [], failed: [] };

    for (const [role, info] of entries) {
        // Validate profile name to prevent shell injection
        if (!/^[a-z0-9-]+$/i.test(info.profile)) {
            console.log(`⏭️  ${info.display_name} — invalid profile name, skipping`);
            results.failed.push(info.profile);
            continue;
        }
        process.stdout.write(`🔐 ${info.display_name} (${info.profile})... `);
        try {
            execSync(
                `npx tsx scripts/auth.ts --auto --profile=${info.profile}`,
                { cwd: resolve(__dirname, ".."), stdio: ["pipe", "pipe", "pipe"], timeout: 60_000 },
            );
            console.log("✅");
            results.success.push(info.profile);
        } catch (err) {
            console.log("❌");
            results.failed.push(info.profile);
        }
        await new Promise((r) => setTimeout(r, 2000));
    }

    console.log(`\n✅ ${results.success.length}/${entries.length} authenticated`);
    if (results.failed.length > 0) {
        console.log(`❌ ${results.failed.length} failed: ${results.failed.join(", ")}`);
    }
    process.exit(results.failed.length > 0 ? 1 : 0);
}

// ─── Manual mode (no credentials) ──────────────────────────────

console.log("\n🔓 No stored credentials. Using manual browser login.\n");
console.log("Tip: Run 'node scripts/setup-credentials.mjs' first for auto-login.\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

console.log("─── Starting authentication ───\n");

for (const [role, info] of entries) {
    console.log(`\n🔐 Authenticating: ${info.display_name} (${info.profile})`);
    console.log(`   Role: ${role}`);

    await ask("   Press ENTER to open the auth flow (or Ctrl+C to skip)...");

    // Validate profile name to prevent shell injection
    if (!/^[a-z0-9-]+$/i.test(info.profile)) {
        console.log(`   ⏭️  Invalid profile name '${info.profile}', skipping`);
        continue;
    }

    try {
        console.log(`   Running: npx tsx scripts/auth.ts --profile=${info.profile}`);
        execSync(`npx tsx scripts/auth.ts --profile=${info.profile}`, {
            cwd: resolve(__dirname, ".."),
            stdio: "inherit",
        });
        console.log(`   ✅ ${info.display_name} authenticated successfully`);
    } catch (err) {
        console.error(`   ❌ Failed to authenticate ${info.display_name}: ${err.message}`);
        const cont = await ask("   Continue with remaining profiles? (y/n) ");
        if (cont.toLowerCase() !== "y") break;
    }
}

console.log("\n─── Done ───\n");
rl.close();
