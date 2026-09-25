/**
 * Offline checks for plugin manifests, prompt registration, CLI argument building,
 * CRM alias resolution and the Work/Firecrawl client helpers.
 * (Formerly scripts/test-cli-and-flow.ts.)
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { registerPrompts } from "../../src/prompts.js";
import { FusebaseCliManager } from "../../src/cli-manager.js";
import { FusebaseClient } from "../../src/client.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("plugin manifests", () => {
  it.each([".claude-plugin", ".codex-plugin"])("%s/plugin.json is a stdio 'fusebase' server", (dir) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, dir, "plugin.json"), "utf-8"));
    expect(manifest.name).toBe("fusebase");
    expect(manifest.server?.transport?.type).toBe("stdio");
  });
});

describe("prompts", () => {
  it("registers 17 prompts including the flow recipes", () => {
    const names: string[] = [];
    registerPrompts({ prompt: (name: string) => names.push(name) } as any, () => ({}) as any);
    expect(names).toHaveLength(17);
    expect(names).toEqual(expect.arrayContaining(["crm-seed-demo-data", "portal-embedded-app", "fullstack-app-architecture", "token-waste-audit"]));
  });
});

describe("FusebaseCliManager argument building", () => {
  afterEach(() => vi.restoreAllMocks());

  function capture() {
    return vi.spyOn(FusebaseCliManager, "executeCommand").mockResolvedValue({ success: true, stdout: "ok", stderr: "", exitCode: 0 });
  }

  it("addSidecar formats every option as flags", async () => {
    const exec = capture();
    await FusebaseCliManager.addSidecar("apps/my-app", "cache", "redis:alpine", {
      port: 6379, tier: "small", env: { FOO: "bar" }, secrets: ["DB_PASS:PASS"], cwd: "C:/project",
    });
    const [sub, args] = exec.mock.calls[0];
    expect(sub).toBe("sidecar");
    expect(args).toEqual(expect.arrayContaining(["add", "--app", "apps/my-app", "--name", "cache", "--image", "redis:alpine", "--port", "6379", "--env", "FOO=bar", "--secret", "DB_PASS:PASS"]));
  });

  it("createSecret passes the app and NAME:value pair", async () => {
    const exec = capture();
    await FusebaseCliManager.createSecret("apps/my-app", "STRIPE_KEY", "sk_test_123");
    const [sub, args] = exec.mock.calls[0];
    expect(sub).toBe("secret");
    expect(args).toEqual(expect.arrayContaining(["create", "--app", "apps/my-app", "--secret", "STRIPE_KEY:sk_test_123"]));
  });

  // The real CLI has no `logs` command: runtime logs are `remote-logs runtime <featureId> --tail N`.
  it("getLogs runs remote-logs runtime with the app ID and --tail", async () => {
    const exec = capture();
    await FusebaseCliManager.getLogs("apps/my-app", { lines: 50 });
    const [sub, args] = exec.mock.calls[0];
    expect(sub).toBe("remote-logs");
    expect(args).toEqual(["runtime", "apps/my-app", "--tail", "50"]);
  });

  // COR-14: the `type` option used to be accepted but never passed to the CLI.
  it("getLogs passes the log type (COR-14)", async () => {
    const exec = capture();
    await FusebaseCliManager.getLogs("apps/my-app", { type: "build" });
    expect(exec.mock.calls[0].slice(0, 2)).toEqual(["remote-logs", ["build", "apps/my-app"]]);
  });

  it("updateApp passes update and --permissions", async () => {
    const exec = capture();
    await FusebaseCliManager.updateApp("apps/my-app", { permissions: "admin" });
    const [sub, args] = exec.mock.calls[0];
    expect(sub).toBe("app");
    expect(args).toEqual(expect.arrayContaining(["update", "apps/my-app", "--permissions", "admin"]));
  });
});

describe("CRM alias resolution", () => {
  const client = new FusebaseClient({ host: "unit-test.invalid", orgId: "unit-org", cookie: "unit-cookie", autoRefresh: false });
  (client as any).listAllDatabases = async () => ({
    data: [{
      global_id: "db_crm_1",
      title: "CRM Master",
      dashboards: [
        { global_id: "dash_deals_1", name: "Deals", root_entity: "deal", views: [
          { global_id: "view_kanban_1", name: "Deals Pipeline", representation_type: "kanban" },
          { global_id: "view_table_1", name: "All Deals", representation_type: "table" },
        ] },
        { global_id: "dash_trackers_1", name: "Trackers", root_entity: "tracker", views: [{ global_id: "view_trackers_1", name: "Action Trackers", representation_type: "table" }] },
        { global_id: "dash_members_1", name: "Members", root_entity: "member", views: [{ global_id: "view_members_1", name: "Team Members", representation_type: "table" }] },
      ],
    }],
  });

  it("resolves deals_table to the Deals dashboard with views and child tables", async () => {
    const res = await client.resolveDatabaseAlias("deals_table");
    expect(res).toMatchObject({ found: true, dashboardId: "dash_deals_1" });
    expect(res.views).toHaveLength(2);
    expect(res.childTables).toHaveLength(2);
  });

  it.each([
    ["deals_pipeline", { viewId: "view_kanban_1" }],
    ["deals_all", { viewId: "view_table_1" }],
    ["trackers", { dashboardId: "dash_trackers_1" }],
  ])("resolves %s", async (alias, expected) => {
    expect(await client.resolveDatabaseAlias(alias)).toMatchObject({ found: true, ...expected });
  });
});

describe("Work / Firecrawl helpers", () => {
  it("runAiAgentTask and scrapeUrlViaFirecrawl post the prompt to the agent thread endpoint", async () => {
    const client = new FusebaseClient({ host: "unit-test.invalid", orgId: "unit-org", cookie: "unit-cookie", autoRefresh: false });
    const calls: Array<{ endpoint: string; body: any }> = [];
    (client as any).request = async (endpoint: string, options?: RequestInit) => {
      calls.push({ endpoint, body: options?.body ? JSON.parse(String(options.body)) : null });
      return { success: true, threadId: "mock_thread_123" };
    };

    const task = await client.runAiAgentTask("agent_test_1", "Analyze competitor Q3 metrics", { workspaceId: "ws1" });
    expect(task.success).toBe(true);
    expect(calls[0].endpoint).toContain("/agents/agent_test_1/threads?workspaceId=ws1");
    expect(calls[0].body?.prompt).toBe("Analyze competitor Q3 metrics");

    const scrape = await client.scrapeUrlViaFirecrawl("https://news.ycombinator.com", { workspaceId: "ws1", agentId: "agent_firecrawl_1", formats: ["markdown", "json"] });
    expect(scrape.success).toBe(true);
    expect(calls.at(-1)?.endpoint).toContain("/agents/agent_firecrawl_1/threads?workspaceId=ws1");
    expect(calls.at(-1)?.body?.prompt).toContain("https://news.ycombinator.com");
  });
});
