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
const COOKIE_ENC_PATH = path.join(DATA_DIR, "cookie.enc");

/**
 * Save an encrypted cookie to data/cookie.enc.
 * Also stores cookie metadata (count, expiry) for freshness checks.
 */
export function saveEncryptedCookie(
  cookieString: string,
  metadata?: {
    host: string;
    cookieCount: number;
    cookies: Array<{ name: string; domain: string; expires: number }>;
  },
): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const payload = JSON.stringify({
    cookie: cookieString,
    meta: metadata ?? null,
    savedAt: new Date().toISOString(),
  });

  fs.writeFileSync(COOKIE_ENC_PATH, encryptData(payload));
  console.error(`[crypto] Cookie encrypted and saved to data/cookie.enc`);
}

/**
 * Load and decrypt cookie from data/cookie.enc.
 * Returns null if file doesn't exist or decryption fails.
 */
export function loadEncryptedCookie(): {
  cookie: string;
  meta: {
    host: string;
    cookieCount: number;
    cookies: Array<{ name: string; domain: string; expires: number }>;
  } | null;
  savedAt: string;
} | null {
  if (!fs.existsSync(COOKIE_ENC_PATH)) return null;

  try {
    const encrypted = fs.readFileSync(COOKIE_ENC_PATH, "utf-8").trim();
    const decrypted = decryptData(encrypted);
    return JSON.parse(decrypted);
  } catch (err) {
    console.error(
      "[crypto] Failed to decrypt cookie.enc:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Check whether the stored encrypted cookie is likely still fresh.
 * Returns true if cookie.enc exists and no cookies have expired.
 */
export function isEncryptedCookieFresh(): boolean {
  const data = loadEncryptedCookie();
  if (!data?.meta?.cookies) return false;

  const now = Date.now() / 1000;
  const hasExpired = data.meta.cookies.some(
    (c) => c.expires > 0 && c.expires < now,
  );
  return !hasExpired;
}
