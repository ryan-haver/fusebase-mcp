import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { registerPrompts } from "../src/prompts.js";
import { FusebaseCliManager } from "../src/cli-manager.js";
import { FusebaseClient } from "../src/client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log("=================================================");
  console.log("   FuseBase CLI & Flow Enhancements Test Suite   ");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Marketplace Manifests Verification
  console.log("1. Marketplace Manifests Verification:");
  const claudeManifestPath = path.resolve(__dirname, "..", ".claude-plugin", "plugin.json");
  const codexManifestPath = path.resolve(__dirname, "..", ".codex-plugin", "plugin.json");

  assert(fs.existsSync(claudeManifestPath), "Claude plugin manifest (.claude-plugin/plugin.json) exists");
  if (fs.existsSync(claudeManifestPath)) {
    const claudeJson = JSON.parse(fs.readFileSync(claudeManifestPath, "utf-8"));
    assert(claudeJson.name === "fusebase", "Claude manifest name is 'fusebase'");
    assert(Array.isArray(claudeJson.keywords) && claudeJson.keywords.includes("swarm"), "Claude manifest includes 'swarm' keyword");
  }

  assert(fs.existsSync(codexManifestPath), "Codex plugin manifest (.codex-plugin/plugin.json) exists");
  if (fs.existsSync(codexManifestPath)) {
    const codexJson = JSON.parse(fs.readFileSync(codexManifestPath, "utf-8"));
    assert(codexJson.name === "fusebase", "Codex manifest name is 'fusebase'");
    assert(codexJson.server?.transport?.type === "stdio", "Codex transport is stdio");
  }

  // 2. Pre-Engineered Prompts Verification
  console.log("\n2. Pre-Engineered Prompts Verification:");
  const registeredPrompts: { name: string; description: string; args: any }[] = [];
  const mockServer = {
    prompt: (name: string, description: string, args: any) => {
      registeredPrompts.push({ name, description, args });
    },
  } as any;
  registerPrompts(mockServer, () => ({} as any));

  assert(registeredPrompts.length === 17, `Total prompts count is 17 (actual: ${registeredPrompts.length})`);

  const promptNames = new Set(registeredPrompts.map((p) => p.name));
  assert(promptNames.has("crm-seed-demo-data"), "Contains 'crm-seed-demo-data' prompt");
  assert(promptNames.has("portal-embedded-app"), "Contains 'portal-embedded-app' prompt");
  assert(promptNames.has("fullstack-app-architecture"), "Contains 'fullstack-app-architecture' prompt");
  assert(promptNames.has("token-waste-audit"), "Contains 'token-waste-audit' prompt");

  // 3. CLI Manager Operations Verification
  console.log("\n3. FusebaseCliManager Method Availability & Argument Parsing:");
  assert(typeof FusebaseCliManager.addSidecar === "function", "FusebaseCliManager.addSidecar exists");
  assert(typeof FusebaseCliManager.listSidecars === "function", "FusebaseCliManager.listSidecars exists");
  assert(typeof FusebaseCliManager.removeSidecar === "function", "FusebaseCliManager.removeSidecar exists");
  assert(typeof FusebaseCliManager.createSecret === "function", "FusebaseCliManager.createSecret exists");
  assert(typeof FusebaseCliManager.listSecrets === "function", "FusebaseCliManager.listSecrets exists");
  assert(typeof FusebaseCliManager.getLogs === "function", "FusebaseCliManager.getLogs exists");
  assert(typeof FusebaseCliManager.updateApp === "function", "FusebaseCliManager.updateApp exists");

  // Mock executeCommand to verify argument generation without requiring local CLI binary
  const capturedCommands: { subcommand: string; args: string[]; cwd?: string }[] = [];
  const originalExecute = FusebaseCliManager.executeCommand;
  FusebaseCliManager.executeCommand = async (subcommand: string, args: string[], cwd?: string) => {
    capturedCommands.push({ subcommand, args, cwd });
    return { success: true, stdout: "mock-ok", stderr: "", exitCode: 0 };
  };

  try {
    // Test addSidecar
    await FusebaseCliManager.addSidecar("apps/my-app", "cache", "redis:alpine", {
      port: 6379,
      tier: "small",
      env: { FOO: "bar" },
      secrets: ["DB_PASS:PASS"],
      cwd: "C:/project",
    });
    const addSidecarCall = capturedCommands[capturedCommands.length - 1];
    assert(addSidecarCall.subcommand === "sidecar", "addSidecar invokes 'sidecar' subcommand");
    assert(
      addSidecarCall.args.includes("add") &&
        addSidecarCall.args.includes("--app") &&
        addSidecarCall.args.includes("apps/my-app") &&
        addSidecarCall.args.includes("--name") &&
        addSidecarCall.args.includes("cache") &&
        addSidecarCall.args.includes("--image") &&
        addSidecarCall.args.includes("redis:alpine") &&
        addSidecarCall.args.includes("--port") &&
        addSidecarCall.args.includes("6379") &&
        addSidecarCall.args.includes("--env") &&
        addSidecarCall.args.includes("FOO=bar") &&
        addSidecarCall.args.includes("--secret") &&
        addSidecarCall.args.includes("DB_PASS:PASS"),
      "addSidecar correctly formats all parameters into CLI flags"
    );

    // Test createSecret
    await FusebaseCliManager.createSecret("apps/my-app", "STRIPE_KEY", "sk_test_123");
    const secretCall = capturedCommands[capturedCommands.length - 1];
    assert(secretCall.subcommand === "secret", "createSecret invokes 'secret' subcommand");
    assert(
      secretCall.args.includes("create") &&
        secretCall.args.includes("--app") &&
        secretCall.args.includes("apps/my-app") &&
        secretCall.args.includes("--secret") &&
        secretCall.args.includes("STRIPE_KEY:sk_test_123"),
      "createSecret correctly passes app and secret value"
    );

    // Test getLogs
    await FusebaseCliManager.getLogs("apps/my-app", { lines: 50 });
    const logsCall = capturedCommands[capturedCommands.length - 1];
    assert(logsCall.subcommand === "logs", "getLogs invokes 'logs' subcommand");
    assert(
      logsCall.args.includes("--app") &&
        logsCall.args.includes("apps/my-app") &&
        logsCall.args.includes("--lines") &&
        logsCall.args.includes("50"),
      "getLogs passes --app and --lines flags"
    );

    // Test updateApp
    await FusebaseCliManager.updateApp("apps/my-app", { permissions: "admin" });
    const updateCall = capturedCommands[capturedCommands.length - 1];
    assert(updateCall.subcommand === "app", "updateApp invokes 'app' subcommand");
    assert(
      updateCall.args.includes("update") &&
        updateCall.args.includes("apps/my-app") &&
        updateCall.args.includes("--permissions") &&
        updateCall.args.includes("admin"),
      "updateApp passes update and permissions flags"
    );
  } finally {
    FusebaseCliManager.executeCommand = originalExecute;
  }

  // 4. CRM Database Alias Resolution Logic
  console.log("\n4. CRM Database Alias Resolution Logic:");
  const client = new FusebaseClient({
    host: "inkabeam.nimbusweb.me",
    orgId: "u268r1",
    cookie: "test-cookie",
  });

  // Mock listAllDatabases to test alias resolution logic deterministically
  (client as any).listAllDatabases = async () => ({
    data: [
      {
        global_id: "db_crm_1",
        title: "CRM Master",
        dashboards: [
          {
            global_id: "dash_deals_1",
            name: "Deals",
            root_entity: "deal",
            views: [
              { global_id: "view_kanban_1", name: "Deals Pipeline", representation_type: "kanban" },
              { global_id: "view_table_1", name: "All Deals", representation_type: "table" },
            ],
          },
          {
            global_id: "dash_trackers_1",
            name: "Trackers",
            root_entity: "tracker",
            views: [
              { global_id: "view_trackers_1", name: "Action Trackers", representation_type: "table" },
            ],
          },
          {
            global_id: "dash_members_1",
            name: "Members",
            root_entity: "member",
            views: [
              { global_id: "view_members_1", name: "Team Members", representation_type: "table" },
            ],
          },
        ],
      },
    ],
  });

  const dealsTableRes = await client.resolveDatabaseAlias("deals_table");
  assert(dealsTableRes.found === true, "Resolves deals_table alias successfully");
  assert(dealsTableRes.dashboardId === "dash_deals_1", "Resolves to correct Deals dashboard");
  assert(dealsTableRes.views.length === 2, "Returns 2 views for Deals");
  assert(dealsTableRes.childTables?.length === 2, "Extracts 2 child tables (Trackers and Members)");

  const pipelineRes = await client.resolveDatabaseAlias("deals_pipeline");
  assert(pipelineRes.found === true, "Resolves deals_pipeline alias");
  assert(pipelineRes.viewId === "view_kanban_1", "Resolves deals_pipeline to kanban view ID");

  const allDealsRes = await client.resolveDatabaseAlias("deals_all");
  assert(allDealsRes.found === true, "Resolves deals_all alias");
  assert(allDealsRes.viewId === "view_table_1", "Resolves deals_all to table view ID");

  const trackersRes = await client.resolveDatabaseAlias("trackers");
  assert(trackersRes.found === true, "Resolves trackers alias");
  assert(trackersRes.dashboardId === "dash_trackers_1", "Resolves trackers to trackers dashboard ID");

  // 5. FuseBase Work, Firecrawl & n8n Service Integration Verification
  console.log("\n5. FuseBase Work, Firecrawl & n8n Verification:");
  assert(typeof client.runAiAgentTask === "function", "FusebaseClient exposes runAiAgentTask");
  assert(typeof client.scrapeUrlViaFirecrawl === "function", "FusebaseClient exposes scrapeUrlViaFirecrawl");
  assert(typeof client.triggerN8nFlow === "function", "FusebaseClient exposes triggerN8nFlow");

  // Verify mock execution of runAiAgentTask
  let requestedEndpoint = "";
  let requestedBody: any = null;
  client["request"] = async (endpoint: string, options?: any) => {
    requestedEndpoint = endpoint;
    requestedBody = options?.body ? JSON.parse(options.body) : null;
    return { success: true, threadId: "mock_thread_123" };
  };

  const agentTaskRes = await client.runAiAgentTask("agent_test_1", "Analyze competitor Q3 metrics");
  assert(agentTaskRes.success === true, "runAiAgentTask executes successfully");
  assert(requestedEndpoint.includes("/agents/agent_test_1/threads"), "runAiAgentTask targets agent threads endpoint");
  assert(requestedBody?.prompt === "Analyze competitor Q3 metrics", "runAiAgentTask passes user prompt");

  const firecrawlRes = await client.scrapeUrlViaFirecrawl("https://news.ycombinator.com", {
    agentId: "agent_firecrawl_1",
    formats: ["markdown", "json"],
  });
  assert(firecrawlRes.success === true, "scrapeUrlViaFirecrawl executes successfully");
  assert(requestedEndpoint.includes("/agents/agent_firecrawl_1/threads"), "scrapeUrlViaFirecrawl targets Firecrawl agent thread");
  assert(requestedBody?.prompt.includes("https://news.ycombinator.com"), "scrapeUrlViaFirecrawl formats target URL into prompt");

  // Summary
  console.log("\n=================================================");
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
