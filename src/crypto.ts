/**
 * Encryption utilities for secrets at rest.
 * Uses AES-256-GCM with a random key (data/.key or FUSEBASE_SECRET_KEY); legacy files
 * encrypted with the old path-derived PBKDF2 key are read and migrated (see Keys below).
 * Zero external dependencies — uses Node.js built-in crypto.
 */

import * as crypto from "crypto";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = "fusebase-mcp-v1"; // static salt, key uniqueness comes from machine seed
const ITERATIONS = 100_000;

// ─── Keys ───────────────────────────────────────────────────────
//
// v2 (current): a random 256-bit key, from FUSEBASE_SECRET_KEY (Docker / CI) or a key file
// at data/.key created on first use with owner-only permissions. Encrypted blobs are
// written as "v2:<base64>".
//
// v1 (legacy, read-only): PBKDF2 of hostname + username + project path. Anyone running as
// the same user could re-derive it, and moving the folder, changing the drive-letter case
// or running in Docker made files unreadable (SEC-10). v1 files are still read, trying
// drive-letter case variants of the path, and are re-encrypted as v2 on first read.

const V2_PREFIX = "v2:";

/**
 * Directory holding encrypted secrets and the key file. FUSEBASE_DATA_DIR overrides the
 * default <project>/data (e.g. a Docker volume); read at call time so .env can set it.
 */
export function getDataDir(): string {
  return path.resolve(process.env.FUSEBASE_DATA_DIR || path.join(__dirname, "..", "data"));
}

const keyFile = () => path.join(getDataDir(), ".key");

let cachedKey: Buffer | undefined;
let cachedLegacyKeys: Buffer[] | undefined;

/** Parse FUSEBASE_SECRET_KEY: 64 hex chars or base64 of 32 bytes; anything else is hashed. */
function keyFromSecret(secret: string): Buffer {
  const trimmed = secret.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return Buffer.from(trimmed, "hex");
  const b64 = Buffer.from(trimmed, "base64");
  if (b64.length === KEY_LENGTH) return b64;
  return crypto.createHash("sha256").update(trimmed, "utf8").digest();
}

/** Restrict a file to the current user (best-effort; POSIX mode bits don't apply on Windows). */
function restrictToOwner(file: string): void {
  if (process.platform !== "win32") {
    fs.chmodSync(file, 0o600);
    return;
  }
  try {
    const user = `${process.env.USERDOMAIN ? `${process.env.USERDOMAIN}\\` : ""}${os.userInfo().username}`;
    execFileSync("icacls", [file, "/inheritance:r", "/grant:r", `${user}:F`], { stdio: "ignore", windowsHide: true });
  } catch {
    console.error(`[crypto] Warning: could not restrict permissions on ${path.basename(file)}`);
  }
}

/** The current (v2) encryption key. */
export function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  if (process.env.FUSEBASE_SECRET_KEY) {
    cachedKey = keyFromSecret(process.env.FUSEBASE_SECRET_KEY);
    return cachedKey;
  }
  const file = keyFile();
  if (fs.existsSync(file)) {
    const key = Buffer.from(fs.readFileSync(file, "utf-8").trim(), "base64");
    if (key.length !== KEY_LENGTH) throw new Error(`Invalid key file ${file}: expected ${KEY_LENGTH} bytes`);
    cachedKey = key;
    return key;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const key = crypto.randomBytes(KEY_LENGTH);
  // "wx" fails if another process created the file first; then use theirs.
  try {
    fs.writeFileSync(file, key.toString("base64"), { mode: 0o600, flag: "wx" });
    restrictToOwner(file);
    cachedKey = key;
  } catch {
    cachedKey = Buffer.from(fs.readFileSync(file, "utf-8").trim(), "base64");
  }
  return cachedKey;
}

/** Forget cached keys (tests, or after FUSEBASE_SECRET_KEY / FUSEBASE_DATA_DIR changes). */
export function resetKeyCache(): void {
  cachedKey = undefined;
}

/** Legacy v1 keys, one per drive-letter spelling of the project path (computed once). */
function legacyKeys(): Buffer[] {
  if (cachedLegacyKeys) return cachedLegacyKeys;
  const projectPath = path.resolve(__dirname, "..");
  const variants = new Set([projectPath]);
  if (/^[a-z]:/i.test(projectPath)) {
    variants.add(projectPath[0].toUpperCase() + projectPath.slice(1));
    variants.add(projectPath[0].toLowerCase() + projectPath.slice(1));
  }
  cachedLegacyKeys = [...variants].map((p) =>
    crypto.pbkdf2Sync([os.hostname(), os.userInfo().username, p].join("|"), SALT, ITERATIONS, KEY_LENGTH, "sha256"),
  );
  return cachedLegacyKeys;
}

function decryptWithKey(packed: Buffer, key: Buffer): string {
  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Encrypt a string with the current key. Returns "v2:" + base64(IV + authTag + ciphertext).
 */
export function encryptData(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return V2_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

/**
 * Decrypt a blob produced by encryptData() (v2) or by the legacy scheme (v1).
 * `legacy` tells the caller to re-save the data with the current key.
 * Throws on tampered data or when no key fits.
 */
export function decryptDataDetailed(encoded: string): { plaintext: string; legacy: boolean } {
  if (encoded.startsWith(V2_PREFIX)) {
    return { plaintext: decryptWithKey(Buffer.from(encoded.slice(V2_PREFIX.length), "base64"), getEncryptionKey()), legacy: false };
  }
  const packed = Buffer.from(encoded, "base64");
  let lastError: unknown;
  for (const key of legacyKeys()) {
    try {
      return { plaintext: decryptWithKey(packed, key), legacy: true };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unable to decrypt legacy data");
}

/** Decrypt a blob produced by encryptData() (or a legacy v1 blob). */
export function decryptData(encoded: string): string {
  return decryptDataDetailed(encoded).plaintext;
}

/**
 * Read and decrypt an encrypted file. A legacy (v1) file is re-encrypted with the current
 * key after a one-time backup to "<file>.legacy-bak", so it keeps working if the folder
 * moves or the key derivation inputs change.
 */
function readEncryptedFile(file: string): string {
  const encoded = fs.readFileSync(file, "utf-8").trim();
  const { plaintext, legacy } = decryptDataDetailed(encoded);
  if (legacy) {
    try {
      const backup = `${file}.legacy-bak`;
      if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
      writeEncryptedFile(file, plaintext);
      console.error(`[crypto] Migrated ${path.basename(file)} to the v2 key (backup: ${path.basename(backup)})`);
    } catch (err) {
      console.error(`[crypto] Warning: could not migrate ${path.basename(file)}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return plaintext;
}

/** Encrypt and write a file atomically (temp file + rename) with owner-only permissions. */
function writeEncryptedFile(file: string, plaintext: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, encryptData(plaintext), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

// ─── File helpers ───────────────────────────────────────────────


const PROFILE_NAME = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Validate an agent profile name before it is used in a file name.
 * Profile names come from tool arguments, so anything that could escape data/ is rejected.
 * An empty or missing profile means the default profile.
 */
export function assertValidProfile(profile?: string): void {
  if (profile === undefined || profile === "") return;
  if (!PROFILE_NAME.test(profile)) {
    throw new Error(`Invalid profile name ${JSON.stringify(profile)}: use 1-64 letters, digits, '-' or '_'.`);
  }
}

/** Get the path to the encrypted cookie file. Uses profile if provided. */
export function getCookieEncPath(profile?: string): string {
  assertValidProfile(profile);
  const filename = profile ? `cookie_${profile}.enc` : "cookie.enc";
  return path.join(getDataDir(), filename);
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
  fs.mkdirSync(getDataDir(), { recursive: true });

  const payload = JSON.stringify({
    cookie: cookieString,
    meta: metadata ?? null,
    savedAt: new Date().toISOString(),
  });

  writeEncryptedFile(getCookieEncPath(profile), payload);
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
    const decrypted = readEncryptedFile(cookiePath);
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
 * Scan data directory and list all configured agent authentication profiles.
 */
export function listConfiguredProfiles(): Array<{
  profile: string;
  filename: string;
  savedAt?: string;
  ageHours?: number;
  cookieCount?: number;
}> {
  if (!fs.existsSync(getDataDir())) return [];
  const files = fs.readdirSync(getDataDir());
  const profiles: Array<{
    profile: string;
    filename: string;
    savedAt?: string;
    ageHours?: number;
    cookieCount?: number;
  }> = [];

  for (const file of files) {
    if (file === "cookie.enc") {
      const data = loadEncryptedCookie();
      const ageHours = data?.savedAt ? Math.round((Date.now() - new Date(data.savedAt).getTime()) / 3600000) : undefined;
      profiles.push({
        profile: "default",
        filename: file,
        savedAt: data?.savedAt,
        ageHours,
        cookieCount: data?.meta?.cookieCount,
      });
    } else if (file.startsWith("cookie_") && file.endsWith(".enc")) {
      const profileName = file.slice(7, -4);
      if (!PROFILE_NAME.test(profileName)) continue;
      const data = loadEncryptedCookie(profileName);
      const ageHours = data?.savedAt ? Math.round((Date.now() - new Date(data.savedAt).getTime()) / 3600000) : undefined;
      profiles.push({
        profile: profileName,
        filename: file,
        savedAt: data?.savedAt,
        ageHours,
        cookieCount: data?.meta?.cookieCount,
      });
    }
  }

  return profiles;
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
  host?: string; // e.g. "yourorg.nimbusweb.me"
}

const credentialsFile = () => path.join(getDataDir(), "credentials.enc");

/**
 * Save agent credentials (email + password per profile) and optional proxy
 * config to an encrypted file. Overwrites any existing credentials file.
 */
export function saveCredentials(
  creds: Record<string, AgentCredential>,
  proxy?: ProxyConfig,
  host?: string,
): void {
  fs.mkdirSync(getDataDir(), { recursive: true });

  const payload = JSON.stringify({
    credentials: creds,
    proxy: proxy ?? null,
    host: host ?? null,
    savedAt: new Date().toISOString(),
    profileCount: Object.keys(creds).length,
  });

  writeEncryptedFile(credentialsFile(), payload);
  console.error(
    `[crypto] ${Object.keys(creds).length} agent credentials${proxy ? " + proxy" : ""}${host ? " + host" : ""} encrypted and saved to credentials.enc`,
  );
}

/**
 * Load and decrypt the full credential store from data/credentials.enc.
 * Returns null if file doesn't exist or decryption fails.
 */
export function loadCredentialStore(): CredentialStore | null {
  if (!fs.existsSync(credentialsFile())) return null;

  try {
    const decrypted = readEncryptedFile(credentialsFile());
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

// ─── Token Store ────────────────────────────────────────────────

export interface TokenCredentials {
  gateToken?: string;
  dashboardsToken?: string;
  token?: string;
  orgId?: string;
  host?: string;
}

/** Get the path to the encrypted token file. Uses profile if provided. */
export function getTokenEncPath(profile?: string): string {
  assertValidProfile(profile);
  const filename = profile ? `token_${profile}.enc` : "token.enc";
  return path.join(getDataDir(), filename);
}

/**
 * Save encrypted FuseBase API tokens to data/token_{profile}.enc.
 */
export function saveEncryptedToken(
  tokenData: TokenCredentials,
  profile?: string
): void {
  fs.mkdirSync(getDataDir(), { recursive: true });
  const filepath = getTokenEncPath(profile);
  const payload = JSON.stringify({
    ...tokenData,
    savedAt: new Date().toISOString(),
  });
  writeEncryptedFile(filepath, payload);
  console.error(
    `[crypto] FuseBase API tokens encrypted and saved to ${path.basename(filepath)}`
  );
}

/**
 * Load and decrypt tokens from data/token_{profile}.enc.
 */
export function loadEncryptedToken(profile?: string): TokenCredentials | null {
  const filepath = getTokenEncPath(profile);
  if (!fs.existsSync(filepath)) return null;

  try {
    const decrypted = readEncryptedFile(filepath);
    const data = JSON.parse(decrypted);
    return {
      gateToken: data.gateToken || undefined,
      dashboardsToken: data.dashboardsToken || undefined,
      token: data.token || undefined,
      orgId: data.orgId || undefined,
      host: data.host || undefined,
    };
  } catch (err) {
    console.error(
      `[crypto] Failed to decrypt ${path.basename(filepath)}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

