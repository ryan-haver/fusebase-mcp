/**
 * Encryption utilities for secrets at rest.
 * Uses AES-256-GCM with a machine-scoped key derived via PBKDF2.
 * Key material: hostname + username + project directory path.
 * Zero external dependencies — uses Node.js built-in crypto.
 */

import * as crypto from "crypto";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = "fusebase-mcp-v1"; // static salt, key uniqueness comes from machine seed
const ITERATIONS = 100_000;

/** Derive a machine-scoped encryption key via PBKDF2 */
function deriveKey(): Buffer {
  const seed = [
    os.hostname(),
    os.userInfo().username,
    path.resolve(__dirname, ".."),
  ].join("|");

  return crypto.pbkdf2Sync(seed, SALT, ITERATIONS, KEY_LENGTH, "sha256");
}

/**
 * Encrypt a string. Returns a base64 blob containing IV + authTag + ciphertext.
 */
export function encryptData(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Pack: IV (16) + AuthTag (16) + Ciphertext (variable)
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString("base64");
}

/**
 * Decrypt a base64 blob produced by encryptData().
 * Throws on tampered or wrong-machine data.
 */
export function decryptData(encoded: string): string {
  const key = deriveKey();
  const packed = Buffer.from(encoded, "base64");

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// ─── File helpers ───────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "..", "data");

/** Get the path to the encrypted cookie file. Uses profile if provided. */
export function getCookieEncPath(profile?: string): string {
  const filename = profile ? `cookie_${profile}.enc` : "cookie.enc";
  return path.join(DATA_DIR, filename);
}

/**
 * Save an encrypted cookie to data/cookie_{profile}.enc.
 * Also stores cookie metadata (count, expiry) for freshness checks.
 */
export function saveEncryptedCookie(
  cookieString: string,
  metadata?: {
    host: string;
    cookieCount: number;
    cookies: Array<{ name: string; domain: string; expires: number }>;
  },
  profile?: string
): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const payload = JSON.stringify({
    cookie: cookieString,
    meta: metadata ?? null,
    savedAt: new Date().toISOString(),
  });

  fs.writeFileSync(getCookieEncPath(profile), encryptData(payload), { mode: 0o600 });
  console.error(`[crypto] Cookie encrypted and saved to ${path.basename(getCookieEncPath(profile))}`);
}

/**
 * Load and decrypt cookie from data/cookie_{profile}.enc.
 * Returns null if file doesn't exist or decryption fails.
 * Warns to stderr if cookie is older than 20 hours (once per profile per process).
 */
const _cookieAgeWarned = new Set<string>();

export function loadEncryptedCookie(profile?: string): {
  cookie: string;
  meta: {
    host: string;
    cookieCount: number;
    cookies: Array<{ name: string; domain: string; expires: number }>;
  } | null;
  savedAt: string;
} | null {
  const cookiePath = getCookieEncPath(profile);
  if (!fs.existsSync(cookiePath)) return null;

  try {
    const encrypted = fs.readFileSync(cookiePath, "utf-8").trim();
    const decrypted = decryptData(encrypted);
    const data = JSON.parse(decrypted);

    // Warn if cookie is older than 20 hours (once per profile)
    const warnKey = profile || "__default__";
    if (data.savedAt && !_cookieAgeWarned.has(warnKey)) {
      const ageMs = Date.now() - new Date(data.savedAt).getTime();
      const ageHours = Math.round(ageMs / 3600000);
      if (ageHours >= 20) {
        const profileFlag = profile ? ` --profile=${profile}` : "";
        console.error(
          `[fusebase-mcp] ⚠️  Cookie${profile ? ` for profile '${profile}'` : ""} is ${ageHours}h old and may expire soon. Re-authenticate: npx tsx scripts/auth.ts${profileFlag}`
        );
        _cookieAgeWarned.add(warnKey);
      }
    }

    return data;
  } catch (err) {
    console.error(
      `[crypto] Failed to decrypt ${path.basename(cookiePath)}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Check whether the stored encrypted cookie is likely still fresh.
 * Returns true if the file exists and no cookies have expired.
 */
export function isEncryptedCookieFresh(profile?: string): boolean {
  const data = loadEncryptedCookie(profile);
  if (!data?.meta?.cookies) return false;

  const now = Date.now() / 1000;
  const hasExpired = data.meta.cookies.some(
    (c) => c.expires > 0 && c.expires < now,
  );
  return !hasExpired;
}

// ─── Credential Store ───────────────────────────────────────────

export interface AgentCredential {
  email: string;
  password: string;
}

export interface ProxyConfig {
  server: string;   // e.g. "socks5://host:port"
  username: string;
  password: string;
}

export interface CredentialStore {
  credentials: Record<string, AgentCredential>;
  proxy?: ProxyConfig;
  host?: string; // e.g. "inkabeam.nimbusweb.me"
}

const CREDENTIALS_FILE = path.join(DATA_DIR, "credentials.enc");

/**
 * Save agent credentials (email + password per profile) and optional proxy
 * config to an encrypted file. Overwrites any existing credentials file.
 */
export function saveCredentials(
  creds: Record<string, AgentCredential>,
  proxy?: ProxyConfig,
  host?: string,
): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const payload = JSON.stringify({
    credentials: creds,
    proxy: proxy ?? null,
    host: host ?? null,
    savedAt: new Date().toISOString(),
    profileCount: Object.keys(creds).length,
  });

  fs.writeFileSync(CREDENTIALS_FILE, encryptData(payload), { mode: 0o600 });
  console.error(
    `[crypto] ${Object.keys(creds).length} agent credentials${proxy ? " + proxy" : ""}${host ? " + host" : ""} encrypted and saved to credentials.enc`,
  );
}

/**
 * Load and decrypt the full credential store from data/credentials.enc.
 * Returns null if file doesn't exist or decryption fails.
 */
export function loadCredentialStore(): CredentialStore | null {
  if (!fs.existsSync(CREDENTIALS_FILE)) return null;

  try {
    const encrypted = fs.readFileSync(CREDENTIALS_FILE, "utf-8").trim();
    const decrypted = decryptData(encrypted);
    const data = JSON.parse(decrypted);
    return {
      credentials: data.credentials ?? {},
      proxy: data.proxy ?? undefined,
      host: data.host ?? undefined,
    };
  } catch (err) {
    console.error(
      `[crypto] Failed to decrypt credentials.enc:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Load and decrypt agent credentials from data/credentials.enc.
 * Returns null if file doesn't exist or decryption fails.
 * @deprecated Use loadCredentialStore() to also get proxy config.
 */
export function loadCredentials(): Record<string, AgentCredential> | null {
  const store = loadCredentialStore();
  return store?.credentials ?? null;
}
