/**
 * Live MCP platform end-to-end suite.
 *
 * Spawns dist/index.js over stdio (core tier) and, against the sandbox workspace from
 * FUSEBASE_WORKSPACE_ID, checks:
 *  1. Resources: >= 3 static resources; fusebase://workspaces lists the sandbox workspace;
 *     fusebase://guides/index and fusebase://work/connectors return expected content; >= 3 templates.
 *  2. Prompts: exactly 17 prompts with the expected names; six prompts return non-empty messages.
 *  3. Tools: exactly 34 core tools incl. CRUD primitives; set_tool_tier("all") yields exactly 175
 *     tools incl. the listed extended tools.
 *  4. Profiles & session: list_agent_profiles (>= 1), switch_active_profile, check_session_health
 *     reports an authenticated session.
 *  5. Page lifecycle in the sandbox: create (content written) -> append -> HTML and markdown readback
 *     -> page resource template readback -> move_page -> delete.
 *  6. create_interactive_app_page embeds an iframe; page deleted afterwards.
 *  7. fusebase_cli_status returns a well-formed status (installed or not).
 *  8. Automations: list_automation_pieces, create/delete flow, flags, user, folder create/delete.
 *     Each call is skipped only if ActivePieces rejects with 402/403 (not enabled for the org).
 *  9. Portals: check_portal_availability; if ENABLED, list_portal_clients and list_portals for the
 *     sandbox; if the sandbox has a portal, get_portal, theme, navigation and workspace portal.
 * 10. fusebase_swarm_init creates a swarm database (deleted afterwards).
 * 11. AI: assistant state, agent categories, favorites; for the first listed agent, public profile
 *     and threads (skipped if the org has no AI agents).
 * 12. Misc read endpoints: dashboard templates, member roles, workspace members, task summary,
 *     billing, user preferences, set_sidebar_collapsed, premium status, import status, org trials,
 *     database entity templates.
 * 13. get_task_time_tracking on a task created (and deleted) in the sandbox's first task list
 *     (skipped if the sandbox has no task list).
 * Everything created is deleted in a finally block; cleanup failures are reported with ⚠️.
 */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  assert,
  assertArray,
  assertBoolean,
  assertEqual,
  assertIncludes,
  assertObject,
  assertString,
  callTool,
  connectMcp,
  requireSandboxWorkspace,
  runSuite,
  skip,
  ToolError,
} from "./lib/live-harness.js";

const EXPECTED_CORE_TOOLS = 34;
const EXPECTED_ALL_TOOLS = 175;
const EXPECTED_PROMPTS = 17;

/** ActivePieces automation rejected the org (plan/feature not enabled). */
const AUTOMATION_UNAVAILABLE = /Fusebase API error: (402|403) [^\n]*\/automation\//;

type ReadResourceResult = Awaited<ReturnType<Client["readResource"]>>;

function resourceText(res: ReadResourceResult, uri: string): string {
  const first = res.contents[0];
  assert(first !== undefined, `${uri} should return at least one content item`);
  assert("text" in first && typeof first.text === "string", `${uri} should return text content, not a blob`);
  return first.text as string;
}

/** Accept a bare array or a { data: [...] } envelope; fail on anything else. */
function listOf(payload: any, field: string): any[] {
  const list = Array.isArray(payload) ? payload : payload?.data;
  assertArray(list, field);
  return list;
}

function firstLine(text: string): string {
  return text.split("\n")[0].slice(0, 160);
}

/**
 * Run an automation call; record a skip (and return undefined) only when ActivePieces is not
 * enabled for this org. Any other failure propagates.
 */
async function automation<T>(tool: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ToolError && AUTOMATION_UNAVAILABLE.test(err.detail)) {
      skip(tool, `ActivePieces automation not enabled for this org (${firstLine(err.detail)})`);
      return undefined;
    }
    throw err;
  }
}

async function readPageUntil(client: Client, args: Record<string, unknown>, needles: string[]): Promise<string> {
  let text = "";
  for (let attempt = 1; attempt <= 4; attempt++) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await callTool(client, "get_page_content", args);
    text = typeof res === "string" ? res : JSON.stringify(res);
    if (needles.every((n) => text.includes(n))) break;
  }
  return text;
}

async function main() {
  const workspaceId = requireSandboxWorkspace();
  console.log(`Sandbox workspace: ${workspaceId}`);

  const client = await connectMcp("fusebase-test-client", { tier: "core" });

  const pagesToCleanup = new Set<string>();
  const databasesToCleanup: string[] = [];
  const flowsToCleanup: string[] = [];
  const automationFoldersToCleanup: string[] = [];
  let taskToCleanup: string | undefined;

  try {
    // ─── 1. Resources ─────────────────────────────────────────────
    console.log("\n── 1. MCP resources ──");
    const resourcesRes = await client.listResources();
    assertArray(resourcesRes.resources, "listResources", 3);

    const wsText = resourceText(await client.readResource({ uri: "fusebase://workspaces" }), "fusebase://workspaces");
    const parsedWorkspaces = JSON.parse(wsText);
    assertArray(parsedWorkspaces, "fusebase://workspaces", 1);
    assert(
      parsedWorkspaces.some((w: any) => w.workspaceId === workspaceId),
      `Sandbox workspace ${workspaceId} should be listed by fusebase://workspaces`,
    );

    const guidesIndexText = resourceText(await client.readResource({ uri: "fusebase://guides/index" }), "fusebase://guides/index");
    assertIncludes(guidesIndexText, "FuseBase Documentation Guides Index", "fusebase://guides/index");

    const connText = resourceText(await client.readResource({ uri: "fusebase://work/connectors" }), "fusebase://work/connectors");
    const connData = JSON.parse(connText);
    assertArray(connData.featuredServices, "fusebase://work/connectors featuredServices", 1);

    const templatesRes = await client.listResourceTemplates();
    assertArray(templatesRes.resourceTemplates, "listResourceTemplates", 3);
    console.log(`✅ ${resourcesRes.resources.length} resources, ${templatesRes.resourceTemplates.length} templates`);

    // ─── 2. Prompts ───────────────────────────────────────────────
    console.log("\n── 2. MCP prompts ──");
    const promptsRes = await client.listPrompts();
    const promptNames = promptsRes.prompts.map((p) => p.name);
    for (const expected of [
      "create-sop",
      "summarize-page",
      "build-kanban-project",
      "design-automation-workflow",
      "build-hosted-app",
      "build-event-bridge",
      "orchestrate-multi-agent-swarm",
      "launch-client-portal",
      "workspace-activity-digest",
      "audit-page-governance",
      "build-relational-database",
      "import-knowledge-base",
      "configure-ai-persona",
      "crm-seed-demo-data",
      "portal-embedded-app",
      "fullstack-app-architecture",
      "token-waste-audit",
    ]) {
      assert(promptNames.includes(expected), `Expected prompt '${expected}' to be listed`);
    }
    assertEqual(promptsRes.prompts.length, EXPECTED_PROMPTS, "prompt count");

    const promptCalls: Array<[string, Record<string, string>]> = [
      ["create-sop", { title: "API Deployment SOP" }],
      ["orchestrate-multi-agent-swarm", { objective: "Deploy Vibe Coding Client Portal Widget" }],
      ["crm-seed-demo-data", { industry: "CyberSecurity", recordCount: "10" }],
      ["portal-embedded-app", { appName: "Customer Invoicing Portal" }],
      ["fullstack-app-architecture", { appName: "Realtime Analytics Dashboard" }],
      ["token-waste-audit", { contextScope: "all" }],
    ];
    for (const [name, args] of promptCalls) {
      const prompt = await client.getPrompt({ name, arguments: args });
      assertArray(prompt.messages, `prompt '${name}' messages`, 1);
    }
    console.log(`✅ ${promptsRes.prompts.length} prompts; ${promptCalls.length} rendered`);

    // ─── 3. Tool tiers ────────────────────────────────────────────
    console.log("\n── 3. Tool listing & tier switching ──");
    const coreToolsRes = await client.listTools();
    assertEqual(coreToolsRes.tools.length, EXPECTED_CORE_TOOLS, "core tool count");
    const coreNames = new Set(coreToolsRes.tools.map((t) => t.name));
    for (const expected of [
      "list_workspaces",
      "create_page",
      "update_page",
      "move_page",
      "delete_page",
      "get_page_content",
      "append_page_content",
      "update_page_content",
      "list_folders",
      "create_folder",
      "create_task",
      "update_task",
      "delete_task",
      "check_session_health",
      "list_agent_profiles",
      "switch_active_profile",
      "set_tool_tier",
    ]) {
      assert(coreNames.has(expected), `Expected core tool '${expected}' to be registered`);
    }

    const tierRes = await callTool(client, "set_tool_tier", { tier: "all" });
    assertIncludes(tierRes, "Extended tools", "set_tool_tier response");
    const allToolsRes = await client.listTools();
    const allNames = new Set(allToolsRes.tools.map((t) => t.name));
    for (const expected of [
      "create_interactive_app_page",
      "fusebase_cli_status",
      "fusebase_cli_init",
      "fusebase_cli_list_apps",
      "fusebase_cli_deploy",
      "create_automation_flow",
      "update_automation_flow",
      "delete_automation_flow",
      "trigger_automation_flow",
      "create_portal",
      "get_portal",
      "get_portal_theme",
      "get_portal_navigation_menu",
      "get_workspace_portal",
      "publish_page_to_portal",
      "check_portal_availability",
      "fusebase_swarm_init",
      "fusebase_swarm_task_transition",
      "get_ai_assistant_state",
      "list_ai_agent_threads",
      "get_ai_agent_favorites",
      "get_agent_public_profile",
      "list_ai_agent_categories",
      "get_dashboard_templates",
      "get_database_entity_templates",
      "get_member_roles",
      "get_workspace_members_v1",
      "get_tasks_workspace_summary",
      "get_billing_info",
      "get_user_preferences",
      "set_sidebar_collapsed",
      "list_portal_clients",
      "invite_portal_client",
      "create_portal_magic_link",
      "list_automation_flows",
      "list_automation_pieces",
      "list_automation_folders",
      "create_automation_folder",
      "delete_automation_folder",
      "get_automation_user",
      "delete_page",
      "create_database",
      "get_task_time_tracking",
      "get_automation_flags",
      "get_workspace_premium_status",
      "get_active_import_status",
      "get_org_trials",
      "fusebase_cli_sidecar_add",
      "fusebase_cli_sidecar_list",
      "fusebase_cli_sidecar_remove",
      "fusebase_cli_secret_create",
      "fusebase_cli_secret_list",
      "fusebase_cli_logs",
      "fusebase_cli_app_update",
      "resolve_database_alias",
      "batch_put_database_data",
      "link_database_rows",
      "list_isolated_stores",
      "fusebase_work_run_agent",
      "fusebase_work_scrape_url",
      "fusebase_work_trigger_n8n",
      "fusebase_token_list",
      "fusebase_token_create",
      "fusebase_token_get",
      "fusebase_token_revoke",
      "fusebase_token_permission_catalog",
      "fusebase_gate_whoami",
      "fusebase_direct_tool_call",
    ]) {
      assert(allNames.has(expected), `Expected extended tool '${expected}' to be registered`);
    }
    assertEqual(allToolsRes.tools.length, EXPECTED_ALL_TOOLS, "total tool count after set_tool_tier");
    console.log(`✅ ${coreToolsRes.tools.length} core tools -> ${allToolsRes.tools.length} after tier switch`);

    // ─── 4. Profiles & session ────────────────────────────────────
    console.log("\n── 4. Agent profiles & session health ──");
    const profilesData = await callTool(client, "list_agent_profiles");
    assertArray(profilesData?.profiles, "list_agent_profiles.profiles", 1);

    const switchRes = await callTool(client, "switch_active_profile", { profile: "default" });
    assertIncludes(switchRes, "Active profile switched to 'default'", "switch_active_profile response");

    const healthData = await callTool(client, "check_session_health");
    assertObject(healthData, "check_session_health");
    assertEqual(healthData.authenticated, true, "check_session_health.authenticated");
    assert(healthData.status !== "EXPIRED", `Session status should not be EXPIRED (got ${healthData.status})`);
    console.log(`✅ Session ${healthData.status} (${healthData.authMode})`);

    // ─── 5. Page lifecycle ────────────────────────────────────────
    console.log("\n── 5. Page lifecycle ──");
    const createPageData = await callTool(client, "create_page", {
      workspaceId,
      title: "MCP Lifecycle & Append Test",
      markdown: "# Base Header\n\nThis is the initial content.\n\n- Initial Point 1",
    });
    assertString(createPageData?.id, "create_page.id");
    const pageId: string = createPageData.id;
    pagesToCleanup.add(pageId);
    assertEqual(createPageData.contentWritten, true, `create_page.contentWritten (contentError: ${createPageData.contentError ?? "none"})`);

    await new Promise((r) => setTimeout(r, 2000));
    await callTool(client, "append_page_content", {
      workspaceId,
      pageId,
      markdown: "## Appended Section\n\nThis section was appended dynamically.\n\n- Appended Point 2",
    });

    const readHtml = await readPageUntil(client, { workspaceId, pageId }, ["Base Header", "Appended Section"]);
    for (const needle of ["Base Header", "Initial Point 1", "Appended Section", "Appended Point 2"]) {
      assertIncludes(readHtml, needle, "get_page_content (html)");
    }

    const readMd = await readPageUntil(client, { workspaceId, pageId, format: "markdown" }, ["Base Header", "Appended Section"]);
    assertIncludes(readMd, "Base Header", "get_page_content (markdown)");
    assertIncludes(readMd, "Appended Section", "get_page_content (markdown)");

    const pageUri = `fusebase://workspaces/${workspaceId}/pages/${pageId}`;
    const pageResourceHtml = resourceText(await client.readResource({ uri: pageUri }), pageUri);
    assertIncludes(pageResourceHtml, "Base Header", "page resource template readback");

    const moveRes = await callTool(client, "move_page", { workspaceId, pageId, folderId: "root" });
    assertEqual(moveRes?.success, true, "move_page.success");

    const deletePageRes = await callTool(client, "delete_page", { workspaceId, pageId });
    assertIncludes(deletePageRes, "deleted successfully", "delete_page response");
    pagesToCleanup.delete(pageId);
    console.log("✅ Create/append/readback (html, markdown, resource)/move/delete verified");

    // ─── 6. Interactive app page ──────────────────────────────────
    console.log("\n── 6. Interactive app page ──");
    const appPageData = await callTool(client, "create_interactive_app_page", {
      workspaceId,
      title: "Vibe Code Interactive Widget",
      appUrl: "https://example.com/interactive-widget",
      description: "### Custom Antigravity Embedded App\nLive widget embedded below:",
    });
    assertString(appPageData?.id, "create_interactive_app_page.id");
    const appPageId: string = appPageData.id;
    pagesToCleanup.add(appPageId);

    const appHtml = await readPageUntil(client, { workspaceId, pageId: appPageId }, ["iframe", "interactive-widget"]);
    assertIncludes(appHtml, "iframe", "app page content");
    assertIncludes(appHtml, "interactive-widget", "app page content");

    await callTool(client, "delete_page", { workspaceId, pageId: appPageId });
    pagesToCleanup.delete(appPageId);
    console.log("✅ App page iframe embed verified");

    // ─── 7. FuseBase CLI status ───────────────────────────────────
    console.log("\n── 7. FuseBase CLI status ──");
    const cliStatusData = await callTool(client, "fusebase_cli_status");
    assertObject(cliStatusData, "fusebase_cli_status");
    assertBoolean(cliStatusData.installed, "fusebase_cli_status.installed");
    assertString(cliStatusData.installCommand, "fusebase_cli_status.installCommand");
    console.log(`✅ fusebase_cli_status (installed: ${cliStatusData.installed})`);

    // ─── 8. Automations ───────────────────────────────────────────
    console.log("\n── 8. ActivePieces automations ──");
    const pieces = await automation("list_automation_pieces", () => callTool(client, "list_automation_pieces"));
    if (pieces !== undefined) listOf(pieces, "list_automation_pieces");

    const flow = await automation("create_automation_flow", () =>
      callTool(client, "create_automation_flow", { displayName: `E2E Test Flow ${Date.now()}` }),
    );
    if (flow !== undefined) {
      assertString(flow?.id, "create_automation_flow.id");
      flowsToCleanup.push(flow.id);
      await callTool(client, "delete_automation_flow", { flowId: flow.id });
      flowsToCleanup.splice(flowsToCleanup.indexOf(flow.id), 1);
    }

    const flags = await automation("get_automation_flags", () => callTool(client, "get_automation_flags"));
    if (flags !== undefined) assertObject(flags, "get_automation_flags");

    const autoUser = await automation("get_automation_user", () => callTool(client, "get_automation_user"));
    if (autoUser !== undefined) {
      assertObject(autoUser, "get_automation_user");
      assertString(autoUser.id, "get_automation_user.id");
    }

    const folders = await automation("list_automation_folders", () => callTool(client, "list_automation_folders"));
    if (folders !== undefined) {
      listOf(folders, "list_automation_folders");
      const folder = await automation("create_automation_folder", () =>
        callTool(client, "create_automation_folder", { displayName: `E2E Test Automation Folder ${Date.now()}` }),
      );
      if (folder !== undefined) {
        assertString(folder?.id, "create_automation_folder.id");
        automationFoldersToCleanup.push(folder.id);
        await callTool(client, "delete_automation_folder", { folderId: folder.id });
        automationFoldersToCleanup.splice(automationFoldersToCleanup.indexOf(folder.id), 1);
      }
    }

    // ─── 9. Portals ───────────────────────────────────────────────
    console.log("\n── 9. Portals ──");
    const availText = await callTool(client, "check_portal_availability");
    assertString(availText, "check_portal_availability");
    const availMatch = /Client portal availability: (ENABLED|DISABLED)/.exec(availText);
    assert(availMatch !== null, `check_portal_availability should report ENABLED/DISABLED, got: ${availText.slice(0, 200)}`);
    if (availMatch[1] === "DISABLED") {
      skip("portal tools", "client portal feature is DISABLED for this org");
    } else {
      const portalClients = await callTool(client, "list_portal_clients");
      assert(portalClients !== null && typeof portalClients === "object", "list_portal_clients should return an object or array");

      const portals = await callTool(client, "list_portals", { workspaceId });
      assertArray(portals, "list_portals");
      if (portals.length === 0) {
        skip("get_portal / get_portal_theme / get_portal_navigation_menu / get_workspace_portal", `sandbox workspace ${workspaceId} has no client portal`);
      } else {
        const portal = portals[0];
        const portalRef = String(portal.globalId ?? portal.id);
        assertString(portalRef, "portal id");
        const portalDetail = await callTool(client, "get_portal", { portalId: portalRef });
        assertObject(portalDetail, "get_portal");

        const theme = await callTool(client, "get_portal_theme", { workspaceId });
        assertObject(theme, "get_portal_theme");
        const nav = await callTool(client, "get_portal_navigation_menu", { workspaceId });
        assertObject(nav, "get_portal_navigation_menu");
        const wsPortal = await callTool(client, "get_workspace_portal", { workspaceId });
        assert(wsPortal !== null && typeof wsPortal === "object", "get_workspace_portal should return an object or array");
        console.log(`✅ Portal ${portalRef} detail, theme, navigation and workspace mapping verified`);
      }
    }

    // ─── 10. Multi-agent swarm ────────────────────────────────────
    console.log("\n── 10. Multi-agent swarm ──");
    const swarmData = await callTool(client, "fusebase_swarm_init", {
      title: `E2E Test Swarm Sprint ${Date.now()}`,
      description: "Automated test swarm state machine for E2E verification",
    });
    assertEqual(swarmData?.success, true, "fusebase_swarm_init.success");
    assertString(swarmData?.databaseId, "fusebase_swarm_init.databaseId");
    databasesToCleanup.push(swarmData.databaseId);
    console.log(`✅ Swarm initialized (DB ${swarmData.databaseId})`);

    // ─── 11. AI assistant & agents ────────────────────────────────
    console.log("\n── 11. AI assistant & agents ──");
    const aiStateData = await callTool(client, "get_ai_assistant_state", { workspaceId });
    assertArray(aiStateData?.promptSuggestions, "get_ai_assistant_state.promptSuggestions");

    const aiCats = await callTool(client, "list_ai_agent_categories");
    assertArray(aiCats, "list_ai_agent_categories");

    listOf(await callTool(client, "get_ai_agent_favorites"), "get_ai_agent_favorites");

    const agents = await callTool(client, "list_agents");
    assertArray(agents, "list_agents");
    const agent = agents.find((a: any) => typeof a?.globalId === "string" && a.globalId.length > 0);
    if (!agent) {
      skip("get_agent_public_profile / list_ai_agent_threads", "org has no AI agents configured");
    } else {
      const agentPub = await callTool(client, "get_agent_public_profile", { agentGlobalId: agent.globalId });
      assertObject(agentPub, "get_agent_public_profile");
      assertString(agentPub.title ?? agentPub.name, "get_agent_public_profile title");

      if (agent.id === undefined || agent.id === null) {
        skip("list_ai_agent_threads", "list_agents did not return a numeric agent id");
      } else {
        listOf(await callTool(client, "list_ai_agent_threads", { agentId: String(agent.id) }), "list_ai_agent_threads");
      }
    }
    console.log("✅ AI assistant state, categories, favorites and agent lookups verified");

    // ─── 12. Misc read endpoints ──────────────────────────────────
    console.log("\n── 12. Misc read endpoints ──");
    listOf(await callTool(client, "get_dashboard_templates"), "get_dashboard_templates");
    listOf(await callTool(client, "get_member_roles"), "get_member_roles");
    listOf(await callTool(client, "get_workspace_members_v1", { workspaceId }), "get_workspace_members_v1");
    listOf(await callTool(client, "get_tasks_workspace_summary"), "get_tasks_workspace_summary");
    assertObject(await callTool(client, "get_billing_info"), "get_billing_info");
    assertObject(await callTool(client, "get_user_preferences"), "get_user_preferences");
    assertObject(await callTool(client, "set_sidebar_collapsed", { collapsed: false }), "set_sidebar_collapsed");
    assertObject(await callTool(client, "get_workspace_premium_status", { workspaceId }), "get_workspace_premium_status");
    const importStatus = await callTool(client, "get_active_import_status", { workspaceId });
    assert(importStatus !== undefined, "get_active_import_status should return a payload");
    listOf(await callTool(client, "get_org_trials"), "get_org_trials");
    const entityTpls = await callTool(client, "get_database_entity_templates");
    assertArray(entityTpls?.data, "get_database_entity_templates.data");
    console.log("✅ Misc read endpoints verified");

    // ─── 13. Task time tracking ───────────────────────────────────
    console.log("\n── 13. Task time tracking ──");
    const taskListsRes = await callTool(client, "list_task_lists", { workspaceId });
    // Live shape: { taskLists: [...], tasks, notes, labels, ... }
    const taskLists = listOf(taskListsRes?.taskLists ?? taskListsRes, "list_task_lists");
    if (taskLists.length === 0) {
      skip("get_task_time_tracking", `sandbox workspace ${workspaceId} has no task list to create a test task in`);
    } else {
      const taskListId = taskLists[0].globalId ?? taskLists[0].id;
      assertString(taskListId, "task list id");
      const task = await callTool(client, "create_task", {
        workspaceId,
        taskListId,
        title: `E2E Time Tracking Task ${Date.now()}`,
      });
      assertObject(task, "create_task");
      const taskId = task.globalId ?? task.id ?? task.taskId;
      assertString(taskId, "create_task id");
      taskToCleanup = taskId;

      const timeData = await callTool(client, "get_task_time_tracking", { workspaceId, taskId });
      assertObject(timeData, "get_task_time_tracking");

      await callTool(client, "delete_task", { workspaceId, taskId });
      taskToCleanup = undefined;
      console.log("✅ get_task_time_tracking verified on a freshly created task");
    }
  } finally {
    console.log("\n── Cleanup ──");
    const cleanup = async (what: string, tool: string, args: Record<string, unknown>) => {
      try {
        await callTool(client, tool, args);
        console.log(`Cleaned up ${what}`);
      } catch (err) {
        console.error(`⚠️ Failed to clean up ${what}:`, err instanceof Error ? err.message : err);
      }
    };
    for (const id of pagesToCleanup) await cleanup(`page ${id}`, "delete_page", { workspaceId, pageId: id });
    if (taskToCleanup) await cleanup(`task ${taskToCleanup}`, "delete_task", { workspaceId, taskId: taskToCleanup });
    for (const id of flowsToCleanup) await cleanup(`automation flow ${id}`, "delete_automation_flow", { flowId: id });
    for (const id of automationFoldersToCleanup) await cleanup(`automation folder ${id}`, "delete_automation_folder", { folderId: id });
    for (const id of databasesToCleanup) await cleanup(`database ${id}`, "delete_database", { databaseId: id });
    await client.close();
  }
}

runSuite("MCP platform live suite", main);
