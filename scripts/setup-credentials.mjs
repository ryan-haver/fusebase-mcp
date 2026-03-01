#!/usr/bin/env node
/**
 * Setup encrypted credentials for all agent Fusebase profiles.
 * Reads fusebase_accounts.json, prompts for the shared password,
 * and encrypts all credentials to data/credentials.enc.
 *
 * Usage:
 *   node scripts/setup-credentials.mjs                     # interactive
 *   node scripts/setup-credentials.mjs --accounts /path    # custom accounts file
 *   node scripts/setup-credentials.mjs --help
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import * as readline from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Find accounts config ───────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--help")) {
    console.log(`
Usage: node scripts/setup-credentials.mjs [options]

Options:
  --accounts <path>   Path to fusebase_accounts.json
  --help              Show this help

Encrypts agent credentials (email + password) to data/credentials.enc
using the same AES-256-GCM encryption as cookie storage.
  `);
    process.exit(0);
}

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
    console.error("   Searched:", possiblePaths.join(", "));
    console.error("   Use --accounts <path> to specify location");
    process.exit(1);
}

// ─── Load profiles ──────────────────────────────────────────────

console.log(`📋 Loading profiles from: ${accountsPath}\n`);
const config = JSON.parse(readFileSync(accountsPath, "utf-8"));
const profiles = config.fusebase_profiles;
const entries = Object.entries(profiles);

console.log(`Found ${entries.length} profiles:\n`);
for (const [role, info] of entries) {
    console.log(`  ${info.display_name}  ${info.email || "(no email configured)"}`);
}

// ─── Prompt for password ────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

async function askPassword(promptText) {
    // On Windows, use PowerShell's Read-Host for reliable masked input.
    // This is the only approach that properly suppresses echo in Windows Terminal.
    if (process.platform === "win32") {
        process.stdout.write(promptText);
        try {
            const psCmd = `powershell -NoProfile -Command "$s = Read-Host -AsSecureString; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))"`;
            const result = execSync(psCmd, { stdio: ["inherit", "pipe", "pipe"] });
            return result.toString().trim();
        } catch {
            return "";
        }
    }

    // On Linux/Mac, raw mode works fine
    rl.pause();
    return new Promise((resolve) => {
        process.stdout.write(promptText);
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding("utf8");
        let password = "";
        const handler = (key) => {
            if (key === "\r" || key === "\n") {
                process.stdin.setRawMode(false);
                process.stdin.pause();
                process.stdin.removeListener("data", handler);
                process.stdout.write("\n");
                rl.resume();
                resolve(password);
            } else if (key === "\u0003") {
                process.exit(1);
            } else if (key === "\u007f" || key === "\b") {
                password = password.slice(0, -1);
            } else {
                password += key;
            }
        };
        process.stdin.on("data", handler);
    });
}

async function main() {
    // Check all profiles have emails
    const missingEmail = entries.filter(([, info]) => !info.email);
    if (missingEmail.length > 0) {
        console.error(`\n⚠️  ${missingEmail.length} profiles missing email:`);
        for (const [role] of missingEmail) {
            console.error(`   - ${role}`);
        }
        console.error("   Add emails to fusebase_accounts.json first.");
        rl.close();
        process.exit(1);
    }

    console.log("\n─── Credential Setup ───\n");
    console.log("All agent accounts use the same password.");
    console.log("This password will be encrypted and stored locally.\n");

    const password = await askPassword("🔑 Enter the shared password: ");

    if (!password || password.length < 4) {
        console.error("❌ Password too short (minimum 4 characters).");
        rl.close();
        process.exit(1);
    }

    const confirmPassword = await askPassword("🔑 Confirm password: ");

    if (password !== confirmPassword) {
        console.error("❌ Passwords do not match.");
        rl.close();
        process.exit(1);
    }

    // Build credential map
    const credentials = {};
    for (const [role, info] of entries) {
        credentials[info.profile] = {
            email: info.email,
            password: password,
        };
    }

    // ─── Proxy setup ────────────────────────────────────────────
    console.log("\n─── SOCKS5 Proxy Setup (PIA) ───\n");
    console.log("Proxy: socks5://proxy-nl.privateinternetaccess.com:1080");
    console.log("Generate SOCKS5 credentials at: https://www.privateinternetaccess.com/pages/client-control-panel\n");

    const proxyUser = await askPassword("🔑 PIA SOCKS5 username: ");
    let proxy = null;

    if (proxyUser && proxyUser.length > 0) {
        const proxyPass = await askPassword("🔑 PIA SOCKS5 password: ");
        if (!proxyPass) {
            console.error("❌ Proxy password required if username is provided.");
            rl.close();
            process.exit(1);
        }
        proxy = {
            server: "socks5://proxy-nl.privateinternetaccess.com:1080",
            username: proxyUser,
            password: proxyPass,
        };
        console.log("✅ Proxy credentials captured");
    } else {
        console.log("⏭️  No proxy username — skipping proxy setup");
    }

    // Import crypto — use URL href for ESM compatibility on Windows
    const cryptoUrl = new URL("../src/crypto.js", import.meta.url).href;
    const { saveCredentials } = await import(cryptoUrl);

    saveCredentials(credentials, proxy);

    console.log(`\n✅ ${Object.keys(credentials).length} credentials${proxy ? " + proxy" : ""} encrypted and saved`);
    console.log("   File: data/credentials.enc");
    console.log("   Encryption: AES-256-GCM (machine-scoped key)");
    console.log("\nNext step: Run 'npx tsx scripts/auth.ts --auto --profile=agent-pm' to test auto-login");
    console.log("Or run 'node scripts/auth-all.mjs' to authenticate all profiles at once.\n");

    rl.close();
}

main();
