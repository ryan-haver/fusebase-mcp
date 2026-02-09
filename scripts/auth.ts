#!/usr/bin/env npx tsx

/**
 * Fusebase Auth Script
 *
 * Uses Playwright with a persistent browser context to capture session cookies.
 * On first run, opens the login page for the user to authenticate.
 * On subsequent runs, reuses the stored session (no login needed).
 *
 * Usage:
 *   npx tsx scripts/auth.ts                      # interactive (opens browser)
 *   npx tsx scripts/auth.ts --headless            # headless (reuses stored session)
 *   npx tsx scripts/auth.ts --host myorg.nimbusweb.me
 *
 * Can also be imported as a module:
 *   import { refreshCookies } from "./scripts/auth.js";
 *   const cookieString = await refreshCookies({ host: "yourorg.nimbusweb.me" });
 */

import { chromium, type BrowserContext, type Cookie } from "playwright";
import * as fs from "fs";
import * as path from "path";

// ─── Config ─────────────────────────────────────────────────────

export interface AuthConfig {
  host: string;
  headless?: boolean;
  timeout?: number; // max wait for login in ms (default: 120_000)
  userDataDir?: string; // persistent browser profile path
  envFile?: string; // path to .env file to update
}

const DEFAULT_USER_DATA_DIR = path.resolve(
  import.meta.dirname ?? ".",
  "..",
  ".browser-data",
);

const DEFAULT_ENV_FILE = path.resolve(
  import.meta.dirname ?? ".",
  "..",
  ".env",
);

// ─── Core ───────────────────────────────────────────────────────

export async function refreshCookies(config: AuthConfig): Promise<string> {
  const {
    host,
    headless = false,
    timeout = 120_000,
    userDataDir = DEFAULT_USER_DATA_DIR,
    envFile = DEFAULT_ENV_FILE,
  } = config;

  const baseUrl = `https://${host}`;

  console.error(`[auth] Launching browser (headless=${headless})...`);
  console.error(`[auth] Profile: ${userDataDir}`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    args: ["--disable-blink-features=AutomationControlled"],
    viewport: { width: 1280, height: 800 },
  });

  try {
    const page = context.pages()[0] || (await context.newPage());

    // Navigate to Fusebase
    console.error(`[auth] Navigating to ${baseUrl}...`);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

    // Wait a moment for redirects
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.error(`[auth] Current URL: ${currentUrl}`);

    if (currentUrl.includes("/auth")) {
      // User needs to log in
      console.error("[auth] Login required — waiting for user to authenticate...");
      console.error("[auth] Please log in via the browser window.");

      // Wait for navigation away from /auth/ (login complete)
      await page.waitForURL((url) => !url.toString().includes("/auth"), {
        timeout,
      });

      console.error("[auth] Login detected! Capturing cookies...");
      // Give the app a moment to fully load and set all cookies
      await page.waitForTimeout(3000);
    } else {
      console.error("[auth] Already logged in! Capturing cookies...");
    }

    // Capture all cookies for this domain
    const cookies = await context.cookies(baseUrl);
    console.error(`[auth] Captured ${cookies.length} cookies`);

    if (cookies.length === 0) {
      throw new Error("No cookies captured — authentication may have failed");
    }

    // Build cookie string
    const cookieString = cookies
      .map((c: Cookie) => `${c.name}=${c.value}`)
      .join("; ");

    // Save encrypted cookie to data/cookie.enc
    const cookieMeta = cookies.map((c: Cookie) => ({
      name: c.name,
      domain: c.domain,
      expires: c.expires,
    }));

    // Dynamic import to avoid circular deps (scripts/ → src/)
    const cryptoPath = new URL("../src/crypto.js", import.meta.url).pathname;
    const { saveEncryptedCookie } = await import(cryptoPath);
    saveEncryptedCookie(cookieString, {
      host,
      cookieCount: cookies.length,
      cookies: cookieMeta,
    });
    console.error(`[auth] Cookie saved encrypted to data/cookie.enc`);

    return cookieString;
  } finally {
    await context.close();
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Check whether the stored cookie is likely still fresh.
 * Returns true if cookie.enc exists and no cookies have expired.
 */
export async function isCookieFresh(): Promise<boolean> {
  try {
    const cryptoPath = new URL("../src/crypto.js", import.meta.url).pathname;
    const { isEncryptedCookieFresh } = await import(cryptoPath);
    return isEncryptedCookieFresh();
  } catch {
    return false;
  }
}

// ─── CLI Entry Point ────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const headless = args.includes("--headless");
  const hostIdx = args.indexOf("--host");
  const host =
    hostIdx !== -1 && args[hostIdx + 1]
      ? args[hostIdx + 1]
      : process.env.FUSEBASE_HOST || "";

  try {
    const cookie = await refreshCookies({ host, headless });
    console.error(`[auth] Success! Cookie string length: ${cookie.length}`);
    // Output cookie to stdout for piping
    console.log(cookie);
  } catch (error) {
    console.error(
      "[auth] Failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

main();
