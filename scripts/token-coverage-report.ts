/**
 * Summarise a token-only coverage run (LIVE_TOKEN_COVERAGE=1, see tests/live/lib/harness.ts):
 * which tools work with only Gate/Dashboards tokens, which need a session cookie, and which
 * the live suites never exercised.
 *
 * Usage: npx tsx scripts/token-coverage-report.ts [coverage.jsonl] [--markdown out.md]
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const mdIndex = args.indexOf("--markdown");
const mdOut = mdIndex >= 0 ? args[mdIndex + 1] : undefined;
const input = args.find((a, i) => !a.startsWith("--") && i !== mdIndex + 1) ?? path.join(os.tmpdir(), "fusebase-token-coverage.jsonl");

/**
 * Tools that act on the local machine or the MCP session, not on FuseBase: not part of a hosted
 * product. Keep in step with isLocalTool() and SESSION_TOOLS in tests/live/lib/harness.ts.
 */
const LOCAL = new Set([
  "refresh_auth", "list_agent_profiles", "switch_active_profile", "check_session_health", "check_version",
  "search_guides", "get_guide", "list_guide_sections", "set_tool_tier",
]);

interface Call {
  suite: string;
  tool: string;
  ok: boolean;
  write: boolean;
  verified?: "read-back" | "exempt" | "cleanup" | "unproven";
  error?: string;
  bothFailed?: boolean;
  at: string;
}

type Status = "WORKS" | "WORKS (write not proven)" | "PARTIAL" | "NEEDS COOKIE" | "NOT EXERCISED" | "LOCAL";

async function listTools(): Promise<string[]> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fusebase-tools-"));
  const client = new Client({ name: "coverage-report", version: "1.0.0" }, { capabilities: {} });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [path.join(ROOT, "dist", "index.js")],
    env: { PATH: process.env.PATH ?? "", FUSEBASE_TOOLS: "all", FUSEBASE_DATA_DIR: dataDir, FUSEBASE_NO_DOTENV: "1" },
    stderr: "ignore",
  }));
  const { tools } = await client.listTools();
  await client.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
  return tools.map((t) => t.name).sort();
}

/** Remove the org host and ids from error text, so the report can be published. */
function scrub(text: string): string {
  return text
    .replace(/https?:\/\/[^/\s]+/g, "https://<org-host>")
    .replace(/(\/(?:orgs|organizations)(?:\/|%2F))[^/?\s]+/gi, "$1{org}")
    .replace(/\borg [A-Za-z0-9]{4,}\b/g, "org {org}")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "{id}")
    .replace(/\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{12,}\b/g, "{id}")
    .replace(/([?&](?:scope_id|workspace|workspaceId|thread)=)[^&\s]+/g, "$1{id}");
}

function classify(tool: string, allCalls: Call[]): { status: Status; detail: string } {
  if (tool.startsWith("fusebase_cli_") || LOCAL.has(tool)) return { status: "LOCAL", detail: "acts on the local machine or session" };
  // Calls that failed with the session cookie too (e.g. reading a deleted page) say nothing about tokens.
  const calls = allCalls.filter((c) => !c.bothFailed);
  if (calls.length === 0) return { status: "NOT EXERCISED", detail: allCalls.length ? "only calls that failed in both modes" : "" };
  const ok = calls.filter((c) => c.ok);
  const failed = calls.filter((c) => !c.ok);
  const firstError = scrub(failed[0]?.error ?? "");
  if (ok.length === 0) return { status: "NEEDS COOKIE", detail: firstError };
  if (failed.length > 0) return { status: "PARTIAL", detail: `${ok.length}/${calls.length} calls worked; ${firstError}` };
  const unproven = ok.filter((c) => c.write && c.verified === "unproven");
  if (unproven.length > 0) return { status: "WORKS (write not proven)", detail: `${unproven.length} write(s) not read back (suite stopped early?)` };
  const proofs = [...new Set(ok.filter((c) => c.write).map((c) => c.verified))].join(", ");
  return { status: "WORKS", detail: proofs ? `writes: ${proofs}` : "" };
}

const lines = fs.existsSync(input) ? fs.readFileSync(input, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
const calls: Call[] = lines.filter((l) => "tool" in l);
const suites = lines.filter((l) => "completed" in l) as Array<{ suite: string; completed: boolean }>;
const tools = await listTools();

const rows = tools.map((tool) => ({ tool, ...classify(tool, calls.filter((c) => c.tool === tool)) }));
const order: Status[] = ["NEEDS COOKIE", "PARTIAL", "WORKS (write not proven)", "WORKS", "NOT EXERCISED", "LOCAL"];
rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.tool.localeCompare(b.tool));

const counts = order.map((s) => `${s}: ${rows.filter((r) => r.status === s).length}`).join(" · ");
const hosted = rows.filter((r) => r.status !== "LOCAL");
const measured = hosted.filter((r) => r.status !== "NOT EXERCISED");
const working = measured.filter((r) => r.status === "WORKS").length;

const out: string[] = [];
out.push(`# Token-only tool coverage`, "");
out.push(`Measured ${new Date().toISOString().slice(0, 10)} against the sandbox workspace with only Gate and Dashboards tokens (no session cookie). Suites: ${suites.map((s) => `${s.suite}${s.completed ? "" : " (stopped early)"}`).join(", ") || "none"}.`, "");
out.push(`- ${tools.length} tools; ${hosted.length} act on FuseBase; ${measured.length} of those were exercised.`);
out.push(`- **${working} of ${measured.length} exercised tools work with tokens only.**`);
out.push(`- ${counts}`, "");
out.push("| Tool | Status | Detail |", "| --- | --- | --- |");
for (const r of rows) out.push(`| \`${r.tool}\` | ${r.status} | ${r.detail.replace(/\|/g, "\\|")} |`);
const text = out.join("\n") + "\n";
if (mdOut) fs.writeFileSync(mdOut, text);
console.log(text);
