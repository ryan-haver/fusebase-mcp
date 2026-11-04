import * as fs from "node:fs";
import * as path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { getDataDir } from "./crypto.js";

export function cachePath(host: string, org: string, profile = "default"): string {
  const key = createHash("sha256").update(JSON.stringify([host, org, profile])).digest("hex").slice(0, 32);
  return path.join(getDataDir(), "cache", `${key}.json`);
}

export function atomicWrite(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, content, { mode: 0o600, flag: "wx" });
    fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

/** At most two bounded log files. Diagnostics must already have been redacted. */
export function appendApiLog(line: string, maxBytes = 5 * 1024 * 1024): void {
  const file = path.join(getDataDir(), "api_log.jsonl");
  fs.mkdirSync(getDataDir(), { recursive: true });
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 2) throw new Error("Log limit must be at least two bytes");
  const bounded = Buffer.from(line).subarray(0, Math.min(maxBytes - 1, 4096));
  const entry = Buffer.concat([bounded, Buffer.from("\n")]);
  if (fs.existsSync(file) && fs.statSync(file).size + Buffer.byteLength(entry) > maxBytes) {
    fs.renameSync(file, `${file}.1`);
  }
  fs.appendFileSync(file, entry, { mode: 0o600 });
}
