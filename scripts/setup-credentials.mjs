#!/usr/bin/env node
/**
 * Setup encrypted credentials for Fusebase agent profiles.
 * Prompts interactively for profiles (name + email), shared password,
 * optional proxy, and host. Saves to data/credentials.enc.
 *
 * Usage:
 *   node scripts/setup-credentials.mjs                     # interactive
 *   node scripts/setup-credentials.mjs --accounts /path    # import from JSON file
 *   node scripts/setup-credentials.mjs --help
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import * as readline from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── CLI args ───────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--help")) {
    console.log(`
Usage: node scripts/setup-credentials.mjs [options]

Options:
  --accounts <path>   Import profiles from a JSON file (optional)
  --help              Show this help

Interactive mode (default):
  Prompts you to add agent profiles (name + email) one at a time.

JSON import mode:
  Reads profiles from a JSON file with structure:
  { "fusebase_profiles": { "role": { "profile": "...", "email": "..." } } }

All credentials are encrypted to data/credentials.enc
using AES-256-GCM with a machine-scoped key.
    `);
    process.exit(0);
}

// ─── Helpers ────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

async function askPassword(promptText) {
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

// ─── Load or prompt for profiles ────────────────────────────────

async function getProfiles() {
    const accountsIdx = args.indexOf("--accounts");
    const customPath = accountsIdx !== -1 ? args[accountsIdx + 1] : null;

    // Try to find an accounts JSON file
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

    if (accountsPath) {
        // Import mode — read from JSON
        console.log(`📋 Found profiles file: ${accountsPath}`);
        const useFile = await ask("   Use this file? [Y/n]: ");
        if (!useFile || useFile.trim().toLowerCase() !== "n") {
            const config = JSON.parse(readFileSync(accountsPath, "utf-8"));
            const profiles = config.fusebase_profiles;
            const entries = Object.entries(profiles);
            console.log(`\nFound ${entries.length} profiles:\n`);
            for (const [, info] of entries) {
                console.log(`  ${info.display_name || info.profile}  ${info.email || "(no email)"}`);
            }
            return entries.map(([, info]) => ({
                profile: info.profile,
                email: info.email,
            }));
        }
    }

    // Interactive mode — prompt for profiles
    console.log("\n─── Add Agent Profiles ───\n");
    console.log("Add profiles one at a time. Leave profile name blank to finish.\n");

    const profiles = [];
    let index = 1;

    while (true) {
        const profile = (await ask(`Profile ${index} name (e.g. agent-pm): `)).trim();
        if (!profile) break;

        const email = (await ask(`  Email for ${profile}: `)).trim();
        if (!email) {
            console.log("  ⚠️  Email required — skipping this profile");
            continue;
        }

        profiles.push({ profile, email });
        console.log(`  ✅ Added: ${profile} (${email})`);
        index++;
    }

    if (profiles.length === 0) {
        console.error("\n❌ No profiles added. Exiting.");
        rl.close();
        process.exit(1);
    }

    console.log(`\n${profiles.length} profile(s) configured.`);
    return profiles;
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
    const profiles = await getProfiles();

    // ─── Password ───────────────────────────────────────────────
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
    for (const { profile, email } of profiles) {
        credentials[profile] = { email, password };
    }

    // ─── Proxy setup ────────────────────────────────────────────
    console.log("\n─── SOCKS5 Proxy Setup ───\n");
    console.log("If using PIA, generate SOCKS5 credentials at: https://www.privateinternetaccess.com/pages/client-control-panel\n");

    const proxyUser = await askPassword("🔑 SOCKS5 proxy username (leave blank to skip): ");
    let proxy = null;

    if (proxyUser && proxyUser.length > 0) {
        const proxyPass = await askPassword("🔑 SOCKS5 proxy password: ");
        if (!proxyPass) {
            console.error("❌ Proxy password required if username is provided.");
            rl.close();
            process.exit(1);
        }
        const proxyDefault = "socks5://proxy-nl.privateinternetaccess.com:1080";
        const proxyServer = await ask(`🌐 Proxy server URL [${proxyDefault}]: `);
        proxy = {
            server: proxyServer || proxyDefault,
            username: proxyUser,
            password: proxyPass,
        };
        console.log("✅ Proxy credentials captured");
    } else {
        console.log("⏭️  No proxy username — skipping proxy setup");
    }

    // ─── Fusebase host setup ────────────────────────────────────
    console.log("\n─── Fusebase Host ───\n");
    const hostDefault = "yourorg.nimbusweb.me";
    const hostInput = await ask(`🌐 Fusebase host [${hostDefault}]: `);
    const host = hostInput.trim() || hostDefault;
    console.log(`   Using host: ${host}`);

    // Import crypto — use URL href for ESM compatibility on Windows
    const cryptoUrl = new URL("../dist/crypto.js", import.meta.url).href;
    const { saveCredentials } = await import(cryptoUrl);

    saveCredentials(credentials, proxy, host);

    console.log(`\n✅ ${Object.keys(credentials).length} credentials${proxy ? " + proxy" : ""} + host encrypted and saved`);
    console.log("   File: data/credentials.enc");
    console.log("   Encryption: AES-256-GCM (machine-scoped key)");
    console.log("\nNext step: Run 'npx tsx scripts/auth.ts --auto --profile=<name>' to test auto-login");
    console.log("Or run 'node scripts/auth-all.mjs' to authenticate all profiles at once.\n");

    rl.close();
}

main();
