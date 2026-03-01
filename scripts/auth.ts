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
  profile?: string; // name of the agent profile, e.g. "agent-pm"
  autoCredentials?: { email: string; password: string }; // for headless auto-login
  proxy?: { server: string; username: string; password: string }; // SOCKS5 proxy
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
    envFile = DEFAULT_ENV_FILE,
    profile,
  } = config;

  const userDataDir =
    config.userDataDir ??
    path.resolve(
      import.meta.dirname ?? ".",
      "..",
      ".browser-data" + (profile ? `_${profile}` : "")
    );

  const baseUrl = `https://${host}`;

  console.error(`[auth] Launching browser (headless=${headless})...`);
  console.error(`[auth] Profile: ${userDataDir}`);
  if (config.proxy) {
    console.error(`[auth] Proxy: ${config.proxy.server}`);
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    args: ["--disable-blink-features=AutomationControlled"],
    viewport: { width: 1280, height: 800 },
    ...(config.proxy ? {
      proxy: {
        server: config.proxy.server,
        username: config.proxy.username,
        password: config.proxy.password,
      },
    } : {}),
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
      if (config.autoCredentials) {
        // Auto-fill login form
        console.error("[auth] Auto-login: filling credentials...");

        // Look for email input — try common selectors
        const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail" i]').first();
        await emailInput.waitFor({ state: "visible", timeout: 10_000 });
        await emailInput.fill(config.autoCredentials.email);

        // Look for password input
        const passwordInput = page.locator('input[type="password"]').first();
        await passwordInput.waitFor({ state: "visible", timeout: 10_000 });
        await passwordInput.fill(config.autoCredentials.password);

        // Submit — try common button patterns
        const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Continue")').first();
        await submitBtn.click();

        console.error("[auth] Credentials submitted — waiting for redirect...");
      } else {
        // Manual login
        console.error("[auth] Login required — waiting for user to authenticate...");
        console.error("[auth] Please log in via the browser window.");
      }

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
    saveEncryptedCookie(
      cookieString,
      {
        host,
        cookieCount: cookies.length,
        cookies: cookieMeta,
      },
      profile
    );
    console.error(`[auth] Cookie saved encrypted (profile: ${profile || "default"})`);

    return cookieString;
  } finally {
    await context.close();
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Check whether the stored cookie is likely still fresh.
 * Returns true if the file exists and no cookies have expired.
 */
export async function isCookieFresh(profile?: string): Promise<boolean> {
  try {
    const cryptoPath = new URL("../src/crypto.js", import.meta.url).pathname;
    const { isEncryptedCookieFresh } = await import(cryptoPath);
    return isEncryptedCookieFresh(profile);
  } catch {
    return false;
  }
}

// ─── CLI Entry Point ────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Parse --key=value or --key value
  function getArg(name: string): string | undefined {
    const eqArg = args.find((a: string) => a.startsWith(`${name}=`));
    if (eqArg) return eqArg.split("=")[1];
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  }

  const autoMode = args.includes("--auto");
  const noProxy = args.includes("--no-proxy");
  const headless = autoMode || args.includes("--headless");

  // Host resolution: CLI flag > env var > credential store > hardcoded default
  let host = getArg("--host") || process.env.FUSEBASE_HOST || "";
  const profile = getArg("--profile");

  // Load credential store — use URL href for ESM compatibility on Windows
  const cryptoUrl = new URL("../src/crypto.js", import.meta.url).href;

  let autoCredentials: { email: string; password: string } | undefined;
  let proxyForBrowser: { server: string; username: string; password: string } | undefined;
  let relayStop: (() => void) | undefined;

  if (autoMode || !noProxy) {
    const { loadCredentialStore } = await import(cryptoUrl);
    const store = loadCredentialStore();

    if (autoMode) {
      if (!profile) {
        console.error("[auth] --auto requires --profile. Example: --auto --profile=agent-pm");
        process.exit(1);
      }
      if (!store?.credentials?.[profile!]) {
        console.error(`[auth] No credentials found for profile '${profile}'.`);
        console.error("[auth] Run 'node scripts/setup-credentials.mjs' first.");
        process.exit(1);
      }
      autoCredentials = store.credentials[profile!]!;
      console.error(`[auth] Auto-login mode for ${profile} (${autoCredentials!.email})`);
    }

    // Start local proxy relay if proxy config exists
    if (!noProxy && store?.proxy) {
      const relayUrl = new URL("../src/proxy-relay.js", import.meta.url).href;
      const { startProxyRelay } = await import(relayUrl);
      const relay = await startProxyRelay(store.proxy);
      relayStop = relay.stop;
      // Give Chromium the local relay (no auth needed)
      proxyForBrowser = {
        server: `socks5://127.0.0.1:${relay.port}`,
        username: "",
        password: "",
      };
    }
  }

  try {
    const cookie = await refreshCookies({ host, headless, profile, autoCredentials, proxy: proxyForBrowser });
    console.error(`[auth] Success! Cookie string length: ${cookie.length}`);
    // Output cookie to stdout for piping
    console.log(cookie);
  } catch (error) {
    console.error(
      "[auth] Failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  } finally {
    // Always stop the relay
    if (relayStop) relayStop();
  }
}

main();
