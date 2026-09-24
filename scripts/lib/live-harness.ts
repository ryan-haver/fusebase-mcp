/**
 * Shared harness for live (network) test suites.
 *
 * Guarantees that every suite:
 *  - runs only against an explicitly configured sandbox workspace (never "the first workspace")
 *  - treats error-shaped tool results as failures, not passes
 *  - records skips explicitly instead of swallowing failures in catch blocks
 *  - exits non-zero on any failure (see runSuite)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadEnvironment } from "../../src/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, "..", "..");

await loadEnvironment();

// ─── Counters ───────────────────────────────────────────────────────

export const stats = {
  total: 0,
  passed: 0,
  skipped: [] as Array<{ what: string; reason: string }>,
  knownGaps: [] as string[],
  knownGapsFixed: [] as string[],
  executedTools: new Set<string>(),
};

export class AssertionError extends Error {}

export function assert(condition: unknown, message: string): asserts condition {
  stats.total++;
  if (!condition) throw new AssertionError(`❌ Assertion failed: ${message}`);
  stats.passed++;
}

/**
 * Record a check that could not run for a legitimate reason (feature not enabled for the
 * org, plan limit, etc). Skips are reported separately and never count as passes.
 */
export function skip(what: string, reason: string): void {
  stats.skipped.push({ what, reason });
  console.log(`⏭️  SKIP ${what}: ${reason}`);
}

/**
 * A check that is expected to fail until a tracked remediation finding is fixed
 * (IDs from docs/PLAN-review-remediation.md). Failing is reported but does not fail the
 * suite; passing is reported loudly so the marker gets removed.
 */
export function knownGap(findingId: string, what: string, condition: boolean): void {
  if (condition) {
    stats.knownGapsFixed.push(`${findingId}: ${what}`);
    console.log(`🎉 ${what} now passes — ${findingId} may be fixed; replace knownGap() with assert()`);
  } else {
    stats.knownGaps.push(`${findingId}: ${what}`);
    console.log(`🚧 KNOWN GAP ${findingId}: ${what}`);
  }
}

export function assertString(val: unknown, field: string, minLength = 1): asserts val is string {
  assert(typeof val === "string" && val.trim().length >= minLength, `Expected '${field}' to be a non-empty string, got: ${JSON.stringify(val)}`);
}

export function assertNumber(val: unknown, field: string): asserts val is number {
  assert(typeof val === "number" && !Number.isNaN(val), `Expected '${field}' to be a number, got: ${JSON.stringify(val)}`);
}

export function assertBoolean(val: unknown, field: string): asserts val is boolean {
  assert(typeof val === "boolean", `Expected '${field}' to be a boolean, got: ${JSON.stringify(val)}`);
}

export function assertArray(val: unknown, field: string, minLength = 0): asserts val is any[] {
  assert(Array.isArray(val) && val.length >= minLength, `Expected '${field}' to be an array with >= ${minLength} items, got: ${JSON.stringify(val)?.slice(0, 300)}`);
}

export function assertObject(val: unknown, field: string): asserts val is Record<string, any> {
  assert(val !== null && typeof val === "object" && !Array.isArray(val), `Expected '${field}' to be an object, got: ${JSON.stringify(val)?.slice(0, 300)}`);
}

export function assertEqual(actual: unknown, expected: unknown, field: string): void {
  assert(actual === expected, `Field '${field}' mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

export function assertIncludes(actual: unknown, substring: string, field: string): void {
  assert(typeof actual === "string" && actual.includes(substring), `Field '${field}' expected to include '${substring}', got:\n${String(actual).slice(0, 500)}`);
}

// ─── Sandbox workspace ──────────────────────────────────────────────

/**
 * The workspace every live suite must run in. Set FUSEBASE_WORKSPACE_ID (or pass
 * --workspace=<id>). There is deliberately no fallback: tests create and delete data.
 */
export function requireSandboxWorkspace(): string {
  const fromArg = process.argv.find((a) => a.startsWith("--workspace="))?.split("=")[1];
  const ws = fromArg || process.env.FUSEBASE_WORKSPACE_ID;
  if (!ws) {
    throw new Error(
      "No sandbox workspace configured. Set FUSEBASE_WORKSPACE_ID in .env (or pass --workspace=<id>). " +
      "Live suites create and delete data and will not guess a workspace.",
    );
  }
  return ws;
}

// ─── MCP client ─────────────────────────────────────────────────────

/**
 * Connect to the server under test. By default this starts dist/index.js over stdio. With
 * FUSEBASE_MCP_URL set (e.g. http://127.0.0.1:3000/mcp for the Docker container), it connects to
 * that running server over Streamable HTTP, with MCP_AUTH_TOKEN as the bearer token; the tier is
 * then switched per session with set_tool_tier, and `opts.env` does not apply.
 */
export async function connectMcp(name: string, opts: { tier?: "core" | "all"; env?: Record<string, string> } = {}): Promise<Client> {
  const url = process.env.FUSEBASE_MCP_URL;
  if (url) {
    const token = process.env.MCP_AUTH_TOKEN;
    const http = new StreamableHTTPClientTransport(new URL(url), token ? { requestInit: { headers: { Authorization: `Bearer ${token}` } } } : undefined);
    const remote = new Client({ name, version: "1.0.0" }, { capabilities: {} });
    await remote.connect(http);
    if ((opts.tier ?? "all") === "all") await remote.callTool({ name: "set_tool_tier", arguments: { tier: "all" } });
    return remote;
  }
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(ROOT_DIR, "dist", "index.js")],
    env: { ...(process.env as Record<string, string>), FUSEBASE_TOOLS: opts.tier ?? "all", ...opts.env },
    stderr: process.env.LIVE_TEST_VERBOSE ? "inherit" : "ignore",
  });
  const client = new Client({ name, version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

export class ToolError extends Error {
  constructor(public tool: string, public detail: string) {
    super(`Tool '${tool}' failed: ${detail}`);
  }
}

/** Returns true when a parsed tool payload is an error envelope rather than data. */
export function isErrorPayload(data: unknown): boolean {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  if (obj.success === false) return true;
  if ("error" in obj && obj.error) {
    // Error-only envelopes: { error }, { error, success }, { error, code }, ...
    const dataKeys = Object.keys(obj).filter((k) => !["error", "success", "code", "message", "status"].includes(k));
    return dataKeys.length === 0;
  }
  return false;
}

/**
 * Call a tool and return its parsed payload. Throws ToolError when the result is
 * flagged isError, when the text starts with "Error", or when the JSON payload is an
 * error envelope ({ error: ... } / { success: false }).
 */
export async function callTool(client: Client, name: string, args: Record<string, unknown> = {}): Promise<any> {
  stats.executedTools.add(name);
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as any)?.[0]?.text;
  if (res.isError) throw new ToolError(name, String(text ?? "unknown error"));
  if (typeof text !== "string") return (res.content as any)?.[0];
  if (/^\s*Error\b/.test(text)) throw new ToolError(name, text);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return text;
  }
  if (isErrorPayload(data)) throw new ToolError(name, JSON.stringify(data).slice(0, 500));
  return data;
}

// ─── Runner ─────────────────────────────────────────────────────────

/**
 * Run a suite's main function with honest reporting: prints totals and skips, and exits
 * 1 on any thrown error. Success banners are printed only when the suite completed.
 */
export function runSuite(title: string, main: () => Promise<void>): void {
  const started = Date.now();
  main()
    .then(() => {
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`\n✅ ${title}: ${stats.passed}/${stats.total} assertions passed, ${stats.skipped.length} skipped, ${stats.knownGaps.length} known gaps, ${stats.executedTools.size} tools exercised (${secs}s)`);
      for (const s of stats.skipped) console.log(`   ⏭️  ${s.what}: ${s.reason}`);
      for (const g of stats.knownGaps) console.log(`   🚧 ${g}`);
      for (const g of stats.knownGapsFixed) console.log(`   🎉 now passing, remove marker: ${g}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`\n❌ ${title} FAILED after ${stats.passed}/${stats.total} assertions:\n`, err instanceof Error ? err.message : err);
      if (err instanceof Error && !(err instanceof AssertionError) && !(err instanceof ToolError)) console.error(err.stack);
      process.exit(1);
    });
}
