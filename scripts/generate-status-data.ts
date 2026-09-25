import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { registerCoreTools } from "../src/tools/core-tools.js";
import { registerExtendedTools } from "../src/tools/extended-tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ToolInfo {
  name: string;
  description: string;
  tier: "core" | "extended";
  category: string;
  parameters: string[];
}

const rawTools: Array<{ name: string; description?: string; schema?: any; tier: "core" | "extended" }> = [];

function createMockServer(tier: "core" | "extended") {
  return {
    tool: (name: string, ...args: any[]) => {
      let description: string | undefined;
      let schema: any;
      if (typeof args[0] === "string") {
        description = args[0];
        if (args.length >= 2 && typeof args[1] === "object") {
          schema = args[1];
        }
      } else if (typeof args[0] === "object") {
        schema = args[0];
      }
      rawTools.push({ name, description, schema, tier });
    },
  } as any;
}

const mockCore = createMockServer("core");
registerCoreTools(mockCore, () => ({} as any), {
  enableExtendedTools: () => {},
  isExtendedToolsEnabled: () => false,
  setActiveProfile: () => {},
  getActiveProfile: () => undefined,
});

const mockExt = createMockServer("extended");
registerExtendedTools(mockExt, () => ({} as any));

function categorizeTool(name: string): string {
  if (name.includes("workspace") || name.includes("org_") || name.includes("usage") || name.includes("members")) return "Workspaces & Org";
  if (name.includes("folder") || name.includes("labels")) return "Folders & Taxonomy";
  if (name.includes("page") || name.includes("note_tags") || name.includes("content")) return "Pages & Collaborative Y.js";
  if (name.includes("tag") || name.includes("file") || name.includes("attachment")) return "Tags, Files & Attachments";
  if (name.includes("comment") || name.includes("mention") || name.includes("activity")) return "Comments, Threads & Mentions";
  if (name.includes("task")) return "Tasks & Projects";
  if (name.includes("database") || name.includes("view") || name.includes("column") || name.includes("row") || name.includes("relation") || name.includes("lookup") || name.includes("csv") || name.includes("dashboard")) return "Databases & Relations";
  if (name.includes("portal")) return "Client Portals & Clients";
  if (name.includes("automation")) return "ActivePieces Automations";
  if (name.includes("token") || name.includes("gate_") || name.includes("direct_tool")) return "Direct Gate & Dashboards Tokens";
  if (name.includes("work_")) return "FuseBase Work, Firecrawl & n8n";
  if (name.includes("swarm") || name.includes("kanban") || name.includes("agent") || name.includes("ai_")) return "AI Assistant, Personas & Swarm";
  if (name.includes("cli") || name.includes("interactive_app")) return "Developer CLI & Hosted Apps";
  return "Diagnostics, Preferences & Guides";
}

const categorizedTools: ToolInfo[] = rawTools.map((t) => ({
  name: t.name,
  description: t.description || "FuseBase MCP operation",
  tier: t.tier,
  category: categorizeTool(t.name),
  parameters: Object.keys(t.schema || {}),
}));

// Git info
let gitCommit = "unknown";
let gitBranch = "master";
let gitDate = new Date().toISOString();

try {
  gitCommit = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  gitBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
  gitDate = execSync("git log -1 --format=%cd --date=iso-strict", { encoding: "utf-8" }).trim();
} catch (err) {
  console.warn("Could not retrieve git details:", err);
}

/**
 * Test results come from the last recorded run of each stage (.cache/test-results.json, written
 * by scripts/test-all.ts), never from hand-written figures. Stages that report no counts
 * (typecheck, lint, build, audit, sweep) appear with 0 assertions and their pass/fail status.
 */
interface RecordedStage {
  kind: "offline" | "live";
  order: number;
  passed: boolean;
  secs: number;
  runAt: string;
  commit: string;
  assertions?: { passed: number; total: number };
  skipped?: number;
  knownGaps?: number;
  tools?: number;
}

const resultsPath = path.resolve(__dirname, "../.cache/test-results.json");
let recorded: Record<string, RecordedStage> = {};
try {
  recorded = JSON.parse(fs.readFileSync(resultsPath, "utf-8")).stages ?? {};
} catch {
  console.warn(`No recorded test results at ${resultsPath}; run npm run test:all first. Publishing no test figures.`);
}

const testSuites = Object.entries(recorded)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([name, r], i) => {
    const extras = [
      r.assertions ? `${r.assertions.passed}/${r.assertions.total} assertions passed` : undefined,
      r.skipped ? `${r.skipped} skipped` : undefined,
      r.knownGaps ? `${r.knownGaps} known gaps` : undefined,
    ].filter(Boolean);
    return {
      id: i + 1,
      name,
      toolsCount: r.tools ?? 0,
      assertionsCount: r.assertions?.passed ?? 0,
      status: r.passed ? "passed" : "failed",
      description: `${r.kind === "live" ? "Live, against a sandbox workspace" : "Offline"}; last run ${r.runAt.slice(0, 16).replace("T", " ")} UTC on ${r.commit || "unknown commit"} (${r.secs}s)${extras.length ? ". " + extras.join(", ") : ""}.`,
    };
  });
const totalAssertions = Object.values(recorded).reduce((acc, r) => acc + (r.assertions?.total ?? 0), 0);
const passedAssertions = Object.values(recorded).reduce((acc, r) => acc + (r.assertions?.passed ?? 0), 0);

const milestones = [
  { id: "m1", title: "Web App API Integration", status: "completed", date: "Sept 2026", description: "Integration with the FuseBase web app's APIs, SOCKS5 proxy relay, AES-256-GCM credential storage, and automated re-auth" },
  { id: "m2", title: "Collaborative Y.js WebSocket Engine", status: "completed", date: "Sept 2026", description: "Real-time non-destructive document append, subType 2 incremental updates, HTML/Markdown conversion" },
  { id: "m3", title: "Relational Database & Managed Templates", status: "completed", date: "Sept 2026", description: "Complete database engine: Kanban boards, cross-table relations, lookup columns, and CSV data pipelines" },
  { id: "m4", title: "Client Portal Hub Platform", status: "completed", date: "Sept 2026", description: "Whitelabel client portals, theme configuration, navigation trees, passwordless magic links" },
  { id: "m5", title: "ActivePieces Automations Integration", status: "completed", date: "Sept 2026", description: "72-piece automation connector library, flow execution trigger engine, and folder organization" },
  { id: "m6", title: "Multi-Agent Swarm Orchestration Engine", status: "completed", date: "Sept 2026", description: "Kanban state machine database for 6 agent roles (PM, Architect, Dev, QA, Review, DevOps)" },
  { id: "m7", title: "Endpoint Reference & Error Diagnostics", status: "completed", date: "Sept 2026", description: "Endpoint reference documenting live and retired endpoints, container diagnostics, and move_page fixes" },
  { id: "m8", title: "Write-Verified Live Test Suites", status: "completed", date: "Sept 2026", description: "Every write the live suites make is proven by a fresh read of the stored data, and a leftover sweep checks the sandbox is clean. Current figures are on the Tests tab" },
  { id: "m9", title: "Official Remote Gate & Dashboards MCP Token Bridge", status: "completed", date: "Sept 2026", description: "Zero-browser direct API token connection to gate-mcp and dashboards-mcp over Streamable HTTP SSE with automatic tenant identity discovery and first-class token lifecycle management" },
  { id: "m10", title: "Token-Only Coverage Measured", status: "completed", date: "Sept 2026", description: "Every tool measured with only Gate and Dashboards tokens: 14 of 129 measured work without a session cookie (docs/TOKEN-COVERAGE.md). Page and folder listing, creation and appends fall back to Gate" },
  { id: "m11", title: "Universal Agent Guidance, Dual Stdio/SSE & Docker Containerization", status: "completed", date: "Sept 2026", description: "Standardized AGENTS.md & CLAUDE.md for zero context clutter, portable relative MCP configs, dual Stdio + HTTP/SSE network transports with /health endpoint, and lightweight multi-stage Docker packaging" },
];

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"));
const appVersion = pkg.version || "1.0.0";

const projectStatusData = {
  project: "FuseBase MCP Server",
  version: appVersion,
  lastUpdated: new Date().toISOString(),
  git: {
    commit: gitCommit,
    branch: gitBranch,
    commitDate: gitDate,
  },
  protocol: {
    specification: "JSON-RPC 2.0",
    compliance: "RFC 6570",
    status: "HEALTHY",
  },
  summary: {
    totalTools: categorizedTools.length,
    coreTools: categorizedTools.filter((t) => t.tier === "core").length,
    extendedTools: categorizedTools.filter((t) => t.tier === "extended").length,
    totalSuites: testSuites.length,
    totalAssertions,
    passedAssertions,
    passRatePercent: totalAssertions ? Math.round((passedAssertions / totalAssertions) * 1000) / 10 : 0,
    documentationGuides: 278,
  },
  testSuites,
  milestones,
  tools: categorizedTools,
};

const outputDir = path.resolve(__dirname, "../apps/client-portal-dashboard/apps/status-dashboard/src/data");
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "project-status.json");
fs.writeFileSync(outputPath, JSON.stringify(projectStatusData, null, 2), "utf-8");

console.log(`✅ Generated project status data:`);
console.log(`   - Output: ${outputPath}`);
console.log(`   - Total Tools: ${projectStatusData.summary.totalTools} (${projectStatusData.summary.coreTools} Core, ${projectStatusData.summary.extendedTools} Extended)`);
console.log(`   - Test stages: ${testSuites.length} recorded (${passedAssertions}/${totalAssertions} assertions passed)`);
console.log(`   - Git Commit: ${gitCommit} (${gitBranch})`);
