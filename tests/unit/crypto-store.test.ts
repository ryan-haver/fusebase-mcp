/**
 * Credential store keys (SEC-10): random v2 key (key file or FUSEBASE_SECRET_KEY), legacy v1
 * files still readable (including drive-letter case variants) and migrated on first read.
 *
 * Every test points FUSEBASE_DATA_DIR at a temp directory; the real data/ is never touched.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptData,
  encryptData,
  getEncryptionKey,
  loadCredentialStore,
  loadEncryptedCookie,
  loadEncryptedToken,
  resetKeyCache,
  saveEncryptedCookie,
  saveEncryptedToken,
} from "../../src/crypto.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Encrypt the way the pre-SEC-10 code did (PBKDF2 of hostname|username|project path). */
function legacyEncrypt(plaintext: string, projectPath = PROJECT_ROOT): string {
  const key = crypto.pbkdf2Sync(
    [os.hostname(), os.userInfo().username, projectPath].join("|"),
    "fusebase-mcp-v1", 100_000, 32, "sha256",
  );
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

let dir: string;
const saved = { dataDir: process.env.FUSEBASE_DATA_DIR, secret: process.env.FUSEBASE_SECRET_KEY };

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "fusebase-crypto-"));
  process.env.FUSEBASE_DATA_DIR = dir;
  delete process.env.FUSEBASE_SECRET_KEY;
  resetKeyCache();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  if (saved.dataDir === undefined) delete process.env.FUSEBASE_DATA_DIR;
  else process.env.FUSEBASE_DATA_DIR = saved.dataDir;
  if (saved.secret === undefined) delete process.env.FUSEBASE_SECRET_KEY;
  else process.env.FUSEBASE_SECRET_KEY = saved.secret;
  resetKeyCache();
});

describe("v2 key (SEC-10)", () => {
  it("creates a random key file once and reuses it", () => {
    const key = getEncryptionKey();
    expect(key).toHaveLength(32);
    const keyFile = path.join(dir, ".key");
    expect(Buffer.from(fs.readFileSync(keyFile, "utf-8"), "base64").equals(key)).toBe(true);

    resetKeyCache(); // a new process reads the same file
    expect(getEncryptionKey().equals(key)).toBe(true);
  });

  it("writes v2 blobs that round-trip and fail under a different key", () => {
    const blob = encryptData("secret value");
    expect(blob.startsWith("v2:")).toBe(true);
    expect(decryptData(blob)).toBe("secret value");

    process.env.FUSEBASE_SECRET_KEY = "a".repeat(64);
    resetKeyCache();
    expect(() => decryptData(blob)).toThrow();
  });

  it("uses FUSEBASE_SECRET_KEY without creating a key file", () => {
    process.env.FUSEBASE_SECRET_KEY = crypto.randomBytes(32).toString("base64");
    resetKeyCache();
    expect(decryptData(encryptData("x"))).toBe("x");
    expect(fs.existsSync(path.join(dir, ".key"))).toBe(false);
  });

  it("refuses to create a new key when files encrypted with the old one exist", () => {
    saveEncryptedCookie("sid=1");
    fs.rmSync(path.join(dir, ".key")); // e.g. the key moved to 1Password but didn't resolve
    resetKeyCache();
    expect(() => getEncryptionKey()).toThrow(/No encryption key.*cookie\.enc/);
    expect(fs.existsSync(path.join(dir, ".key"))).toBe(false);
    expect(loadEncryptedCookie()).toBeNull();
    expect(() => saveEncryptedCookie("sid=2")).toThrow(/No encryption key/);
  });

  it("detects tampering", () => {
    const blob = Buffer.from(encryptData("secret value").slice(3), "base64");
    blob[blob.length - 1] ^= 0xff;
    expect(() => decryptData("v2:" + blob.toString("base64"))).toThrow();
  });

  it("stores cookies, tokens and credentials as v2 files", () => {
    saveEncryptedCookie("sid=1", undefined, "agent1");
    saveEncryptedToken({ gateToken: "g" }, "agent1");
    expect(loadEncryptedCookie("agent1")?.cookie).toBe("sid=1");
    expect(loadEncryptedToken("agent1")?.gateToken).toBe("g");
    for (const f of ["cookie_agent1.enc", "token_agent1.enc"]) {
      expect(fs.readFileSync(path.join(dir, f), "utf-8").startsWith("v2:")).toBe(true);
    }
    // No temp files left behind by the atomic write.
    expect(fs.readdirSync(dir).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });
});

describe("legacy v1 files (SEC-10)", () => {
  it("reads a legacy cookie, backs it up once and re-encrypts it with the v2 key", () => {
    const file = path.join(dir, "cookie.enc");
    const legacy = legacyEncrypt(JSON.stringify({ cookie: "sid=old", meta: null, savedAt: new Date().toISOString() }));
    fs.writeFileSync(file, legacy);

    expect(loadEncryptedCookie()?.cookie).toBe("sid=old");
    expect(fs.readFileSync(`${file}.legacy-bak`, "utf-8")).toBe(legacy);
    expect(fs.readFileSync(file, "utf-8").startsWith("v2:")).toBe(true);

    // Second read uses the v2 file; the backup is kept as-is.
    expect(loadEncryptedCookie()?.cookie).toBe("sid=old");
    expect(fs.readFileSync(`${file}.legacy-bak`, "utf-8")).toBe(legacy);
  });

  it.runIf(/^[a-z]:/i.test(PROJECT_ROOT))("reads files encrypted under the other drive-letter case", () => {
    const flipped = (PROJECT_ROOT[0] === PROJECT_ROOT[0].toUpperCase()
      ? PROJECT_ROOT[0].toLowerCase()
      : PROJECT_ROOT[0].toUpperCase()) + PROJECT_ROOT.slice(1);
    fs.writeFileSync(path.join(dir, "token.enc"), legacyEncrypt(JSON.stringify({ gateToken: "g1" }), flipped));
    expect(loadEncryptedToken()?.gateToken).toBe("g1");
  });

  it("migrates the credential store", () => {
    fs.writeFileSync(path.join(dir, "credentials.enc"), legacyEncrypt(JSON.stringify({ credentials: { a: { email: "e" } } })));
    expect(loadCredentialStore()?.credentials).toEqual({ a: { email: "e" } });
    expect(fs.readFileSync(path.join(dir, "credentials.enc"), "utf-8").startsWith("v2:")).toBe(true);
  });

  it("returns null for a file no key can decrypt", () => {
    fs.writeFileSync(path.join(dir, "cookie.enc"), legacyEncrypt("{}", "/somewhere/else"));
    expect(loadEncryptedCookie()).toBeNull();
    expect(fs.existsSync(path.join(dir, "cookie.enc.legacy-bak"))).toBe(false);
  });
});
