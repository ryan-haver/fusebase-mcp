import type { IsolatedStoreSqlMigrationBundleContract } from "../types";

export interface BuildSqlMigrationBundleEntryInput {
  version: number;
  name: string;
  sql: string;
  expectedChecksum?: string | null;
}

export interface BuildSqlMigrationBundleInput {
  bundleVersion?: string | null;
  migrations: BuildSqlMigrationBundleEntryInput[];
}

function normalizePositiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}

function normalizeNonEmptyString(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return normalized;
}

function toSha256Hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function canonicalizeSqlMigrationContent(sql: string): string {
  return sql.replace(/\r\n/g, "\n").trimEnd();
}

export async function calculateSqlMigrationChecksum(
  sql: string,
): Promise<string> {
  if (
    typeof globalThis.crypto === "undefined" ||
    typeof globalThis.crypto.subtle === "undefined"
  ) {
    throw new Error(
      "SQL migration checksum requires globalThis.crypto.subtle (available in modern browsers and Node.js 20+)",
    );
  }

  const canonicalSql = canonicalizeSqlMigrationContent(sql);
  const bytes = new TextEncoder().encode(canonicalSql);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return toSha256Hex(digest);
}

export async function buildSqlMigrationBundle(
  input: BuildSqlMigrationBundleInput,
): Promise<IsolatedStoreSqlMigrationBundleContract> {
  const bundleVersion =
    input.bundleVersion == null ? undefined : input.bundleVersion.trim();
  const entries = [...input.migrations].sort((left, right) => {
    return left.version - right.version;
  });

  if (entries.length === 0) {
    throw new Error("migrations must contain at least one entry");
  }

  let previousVersion = 0;
  const migrations: IsolatedStoreSqlMigrationBundleContract["migrations"] = [];

  for (const [index, entry] of entries.entries()) {
    const version = normalizePositiveInteger(
      entry.version,
      `migrations[${index}].version`,
    );
    if (version === previousVersion) {
      throw new Error(`Duplicate migration version ${String(version)}`);
    }
    if (version < previousVersion) {
      throw new Error(
        `Migrations must be strictly increasing by version; got ${String(version)} after ${String(previousVersion)}`,
      );
    }

    const name = normalizeNonEmptyString(
      entry.name,
      `migrations[${index}].name`,
    );
    const sql = canonicalizeSqlMigrationContent(entry.sql);
    const checksum = await calculateSqlMigrationChecksum(sql);
    const expectedChecksum =
      entry.expectedChecksum == null ? null : entry.expectedChecksum.trim();

    if (expectedChecksum !== null && expectedChecksum !== checksum) {
      throw new Error(
        `Checksum mismatch for migration v${String(version)} ${name}: expected ${expectedChecksum}, got ${checksum}`,
      );
    }

    migrations.push({
      version,
      name,
      checksum,
      sql,
    });
    previousVersion = version;
  }

  return {
    ...(bundleVersion && bundleVersion.length > 0 ? { bundleVersion } : {}),
    migrations,
  };
}
