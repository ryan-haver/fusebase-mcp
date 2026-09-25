/**
 * Shared harness for live (network) test suites.
 *
 * Guarantees that every suite:
 *  - runs only against an explicitly configured sandbox workspace (never "the first workspace")
 *  - treats error-shaped tool results as failures, not passes
 *  - records skips explicitly instead of swallowing failures in catch blocks
 *  - exits non-zero on any failure (see runSuite)
 *  - proves every write with a fresh read (see "Write verification" below)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadEnvironment } from "../../../src/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");

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
  noteRead(name);
  const data = await parseToolResult(name, await client.callTool({ name, arguments: args }));
  // Only a successful response claims a write happened, so only then does it need proof.
  noteWrite(name, args);
  return data;
}

async function parseToolResult(name: string, res: Awaited<ReturnType<Client["callTool"]>>): Promise<any> {
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

// ─── Shared reads ───────────────────────────────────────────────────

export interface ViewRepresentation {
  global_id: string; // e.g. "table", "kanban"
  is_default?: boolean;
  settings?: { groupByField?: string; [key: string]: unknown };
}

/** A view's representations (kanban/table, grouping), read from the Dashboards service. */
export async function readViewRepresentations(client: Client, dashboardId: string, viewId: string): Promise<ViewRepresentation[]> {
  const res = await callTool(client, "fusebase_direct_tool_call", {
    opId: "getDashboardView",
    target: "dashboards",
    args: { dashboardId, viewId },
  });
  const view = res?.data?.data ?? res?.data ?? res;
  assertArray(view?.representations, `getDashboardView(${viewId}).representations`);
  return view.representations as ViewRepresentation[];
}

/**
 * Find a user variable by name anywhere in a preferences payload: either a `{ [name]: value }`
 * property or a `{ name|key: name, value }` entry. Returns undefined when it isn't present.
 */
export function findUserVar(payload: unknown, name: string): { value: unknown } | undefined {
  if (payload === null || typeof payload !== "object") return undefined;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const hit = findUserVar(item, name);
      if (hit) return hit;
    }
    return undefined;
  }
  const obj = payload as Record<string, unknown>;
  if (name in obj) return { value: obj[name] };
  if ((obj.name === name || obj.key === name) && "value" in obj) return { value: obj.value };
  for (const v of Object.values(obj)) {
    const hit = findUserVar(v, name);
    if (hit) return hit;
  }
  return undefined;
}

// ─── Write verification ─────────────────────────────────────────────
//
// A write's own response ("created", "updated") is not proof that FuseBase stored the data.
// Every successful call to a WRITE_TOOLS tool is recorded (an error response claims no write),
// and must then be proven by verifyWrite(): a
// check that makes at least one fresh read call and passes (retried while FuseBase catches up).
// Writes that can't be read back are exempted with noReadBack(reason); deletes made during
// cleanup are proven by the leftover sweep. At the end of a suite, unproven writes are listed
// and, unless LIVE_VERIFY_WRITES=report, fail the suite.

/** Tools that create, change or delete data. */
export const WRITE_TOOLS = new Set([
  // pages, folders, content, tasks, comments, files
  "create_page", "update_page", "delete_page", "move_page", "create_folder", "append_page_content",
  "update_page_content", "update_page_tags", "create_interactive_app_page", "create_task", "update_task",
  "delete_task", "fusebase_post_comment", "fusebase_reply_comment", "fusebase_resolve_thread", "upload_file",
  // databases, rows, columns, views, relations
  "create_database", "update_database", "delete_database", "duplicate_database", "delete_dashboard",
  "create_dashboard_table", "add_database_row", "delete_database_row", "update_database_cell",
  "batch_put_database_data", "reorder_database_rows", "add_database_column", "delete_database_column",
  "rename_database_column", "reorder_database_columns", "set_column_width", "add_relation_column",
  "add_lookup_column", "link_database_rows", "unlink_database_rows", "delete_relation", "create_view",
  "update_view", "delete_view", "duplicate_view", "set_view_representation", "set_view_grouping",
  "move_kanban_card", "import_csv",
  // isolated SQL stores
  "create_isolated_store", "execute_isolated_sql", "insert_isolated_sql_row", "batch_insert_isolated_sql_rows",
  "apply_isolated_sql_migrations",
  // automations, portals, tokens, agents, settings
  "create_automation_folder", "delete_automation_folder", "create_automation_flow", "update_automation_flow",
  "delete_automation_flow", "trigger_automation_flow", "publish_page_to_portal", "invite_portal_client",
  "create_portal_magic_link", "create_portal", "fusebase_token_create", "fusebase_token_revoke",
  "fusebase_swarm_init", "fusebase_swarm_task_transition", "fusebase_work_run_agent", "fusebase_work_trigger_n8n",
  "set_sidebar_collapsed", "fusebase_cli_init", "fusebase_cli_deploy", "fusebase_cli_app_update",
  "fusebase_cli_secret_create", "fusebase_cli_sidecar_add", "fusebase_cli_sidecar_remove",
]);

export interface WriteRecord {
  id: number;
  tool: string;
  args: string;
  at: string; // suite file:line that made the call
  proof?: string; // how it was proven (read tools used)
  exempt?: string; // why it can't be read back
  cleanup?: boolean; // made during cleanup: proven by the leftover sweep
}

export const writes: WriteRecord[] = [];
let inCleanup = false;
let readCallsInVerification: string[] | undefined;

function callSite(): string {
  const frames = new Error().stack?.split("\n") ?? [];
  for (const f of frames) {
    const m = f.match(/tests[\\/]live[\\/]([^\\/:]+\.ts):(\d+)/);
    if (m) return m[1] + ":" + m[2];
  }
  return "unknown";
}

function summarizeArgs(args: Record<string, unknown>): string {
  const keep = ["workspaceId", "pageId", "noteId", "databaseId", "dashboardId", "viewId", "title", "name", "tier", "flowId", "folderId"];
  return keep.filter((k) => args[k] !== undefined).map((k) => k + "=" + String(args[k]).slice(0, 40)).join(" ");
}

/** A read attempt inside a verifyWrite check counts as a fresh read. */
function noteRead(name: string): void {
  if (!WRITE_TOOLS.has(name) && readCallsInVerification) readCallsInVerification.push(name);
}

function noteWrite(name: string, args: Record<string, unknown>): void {
  if (WRITE_TOOLS.has(name)) {
    writes.push({ id: writes.length + 1, tool: name, args: summarizeArgs(args), at: callSite(), cleanup: inCleanup || undefined });
  }
}

/** The most recent writes of `tool` not yet proven or exempted (newest first). */
function pendingWrites(tool: string, count: number): WriteRecord[] {
  const pending = writes.filter((w) => w.tool === tool && !w.proof && !w.exempt && !w.cleanup).reverse().slice(0, count);
  if (pending.length < count) throw new AssertionError("❌ verifyWrite: expected " + count + " unproven '" + tool + "' write(s), found " + pending.length);
  return pending;
}

/**
 * Prove the latest `count` writes of `tool` with a fresh read. `check` must call at least one
 * read tool through callTool and throw (e.g. via assert) if the data isn't as expected. It is
 * retried until it passes or `timeoutMs` elapses, since FuseBase can take a moment to reflect a write.
 */
export async function verifyWrite(
  tool: string,
  what: string,
  check: () => Promise<unknown>,
  opts: { count?: number; timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const targets = pendingWrites(tool, opts.count ?? 1);
  const deadline = Date.now() + (opts.timeoutMs ?? 15_000);
  let lastError: unknown;
  for (;;) {
    readCallsInVerification = [];
    const totalBefore = stats.total;
    const passedBefore = stats.passed;
    try {
      await check();
      const reads = readCallsInVerification;
      if (reads.length === 0) throw new AssertionError("❌ verifyWrite(" + tool + "): the check made no read call; a write's own response is not proof");
      for (const w of targets) w.proof = what + " (read: " + [...new Set(reads)].join(", ") + ")";
      console.log("🔎 verified " + tool + ": " + what);
      return;
    } catch (err) {
      lastError = err;
      // Failed attempts don't count towards the assertion totals.
      stats.total = totalBefore;
      stats.passed = passedBefore;
      if (Date.now() >= deadline || (err instanceof AssertionError && /made no read call/.test(err.message))) break;
      await new Promise((r) => setTimeout(r, opts.intervalMs ?? 1500));
    } finally {
      readCallsInVerification = undefined;
    }
  }
  stats.total++;
  throw lastError instanceof Error ? lastError : new AssertionError("❌ verifyWrite(" + tool + ") failed: " + String(lastError));
}

/** Exempt the latest `count` writes of `tool` that genuinely can't be read back. */
export function noReadBack(tool: string, reason: string, count = 1): void {
  for (const w of pendingWrites(tool, count)) w.exempt = reason;
}

/** Run cleanup deletes: they are proven by the leftover sweep rather than one by one. */
export async function duringCleanup<T>(fn: () => Promise<T>): Promise<T> {
  const was = inCleanup;
  inCleanup = true;
  try {
    return await fn();
  } finally {
    inCleanup = was;
  }
}

/** Print how each write was proven; return the unproven ones. */
function writeReport(): WriteRecord[] {
  const unproven = writes.filter((w) => !w.proof && !w.exempt && !w.cleanup);
  const proven = writes.filter((w) => w.proof).length;
  const exempt = writes.filter((w) => w.exempt);
  const cleanup = writes.filter((w) => w.cleanup).length;
  console.log("\n🧾 Writes: " + writes.length + " total — " + proven + " proven by a fresh read, " + exempt.length + " exempt, " + cleanup + " cleanup (swept), " + unproven.length + " UNPROVEN");
  for (const w of exempt) console.log("   ⚪ " + w.tool + " at " + w.at + ": no read-back — " + w.exempt);
  for (const w of unproven) console.log("   🔴 " + w.tool + " at " + w.at + " " + w.args);
  return unproven;
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
      const unproven = writeReport();
      if (unproven.length > 0 && process.env.LIVE_VERIFY_WRITES !== "report") {
        throw new AssertionError("❌ " + unproven.length + " write(s) were not proven by a fresh read (listed above). Add verifyWrite() after each, or noReadBack() with a reason.");
      }
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
