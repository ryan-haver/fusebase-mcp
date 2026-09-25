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
 *     -> page resource template readback -> create_folder -> move_page into the folder and back to
 *     root -> delete (the folder is deleted in cleanup).
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
 *     billing, user preferences, set_sidebar_collapsed (flipped, then restored), premium status, import status, org trials,
 *     database entity templates.
 * 13. get_task_time_tracking on a task created (and deleted) in the sandbox's first task list
 *     (skipped if the sandbox has no task list).
 * Every write is proven by a separate fresh read (verifyWrite) of the exact values written.
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
  duringCleanup,
  verifyWrite,
  readViewRepresentations,
  findUserVar,
} from "./lib/harness.js";

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

/** One fresh get_page_content read, as text. (verifyWrite retries while FuseBase catches up.) */
async function readPage(client: Client, args: Record<string, unknown>): Promise<string> {
  const res = await callTool(client, "get_page_content", args);
  return typeof res === "string" ? res : JSON.stringify(res);
}

/** Error text meaning "this entity doesn't exist" (web API 404/410, Gate "no note", ActivePieces ENTITY_NOT_FOUND). */
const NOT_FOUND = /\b(404|410)\b|not[ _-]?found|no note|does not exist/i;

/** Prove a deleted entity is gone: `read` must fail with a not-found error (any other error propagates). */
async function assertGone(what: string, read: () => Promise<unknown>): Promise<void> {
  try {
    await read();
  } catch (err) {
    if (!(err instanceof ToolError)) throw err;
    assert(NOT_FOUND.test(err.detail), `${what}: expected a not-found error, got: ${firstLine(err.detail)}`);
    return;
  }
  assert(false, `${what} should be gone, but it can still be read`);
}

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

/** Every page list_pages returns for a folder (default: the workspace root), following offset pagination to the end. */
async function allPages(client: Client, workspaceId: string, folderId = "root"): Promise<any[]> {
  const all: any[] = [];
  for (let n = 0; n < MAX_PAGES; n++) {
    const res = await callTool(client, "list_pages", { workspaceId, folderId, limit: PAGE_SIZE, offset: n * PAGE_SIZE });
    assertArray(res?.pages, "list_pages.pages");
    all.push(...res.pages);
    if (res.pages.length < PAGE_SIZE || (typeof res.total === "number" && all.length >= res.total)) return all;
  }
  throw new Error(`list_pages returned more than ${MAX_PAGES * PAGE_SIZE} pages; cannot scan them all`);
}

/** Every task search_tasks returns for the workspace, following offset pagination to the end. */
async function allTasks(client: Client, workspaceId: string): Promise<any[]> {
  const all: any[] = [];
  for (let n = 0; n < MAX_PAGES; n++) {
    const res = await callTool(client, "search_tasks", { workspaceId, limit: PAGE_SIZE, offset: n * PAGE_SIZE });
    assertArray(res?.tasks, "search_tasks.tasks");
    all.push(...res.tasks);
    if (res.tasks.length < PAGE_SIZE || (typeof res.total === "number" && all.length >= res.total)) return all;
  }
  throw new Error(`search_tasks returned more than ${MAX_PAGES * PAGE_SIZE} tasks; cannot scan them all`);
}

function isTask(t: any, taskId: string): boolean {
  return t?.globalId === taskId || t?.id === taskId || t?.taskId === taskId;
}

/** Find a folder by id anywhere in list_folders' nested tree (each node has `children`). */
function findFolder(nodes: unknown, folderId: string): any {
  if (!Array.isArray(nodes)) return undefined;
  for (const node of nodes) {
    if (node?.id === folderId) return node;
    const hit = findFolder(node?.children, folderId);
    if (hit) return hit;
  }
  return undefined;
}

/** Parse the sidebarCollapsed user var ("1"/"0", or a number/boolean); fail on anything else. */
function collapsedValue(value: unknown): boolean {
  if (value === "1" || value === 1 || value === true) return true;
  if (value === "0" || value === 0 || value === false) return false;
  assert(false, `sidebarCollapsed should be "1" or "0", got ${JSON.stringify(value)}`);
}


/** ActivePieces keeps a flow's name on its current version; accept it top-level too. */
function flowDisplayName(flow: any): unknown {
  return flow?.version?.displayName ?? flow?.displayName;
}


async function main() {
  const workspaceId = requireSandboxWorkspace();
  console.log(`Sandbox workspace: ${workspaceId}`);

  const client = await connectMcp("fusebase-test-client", { tier: "core" });

  const pagesToCleanup = new Set<string>();
  const foldersToCleanup: string[] = [];
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
    const pageTitle = "MCP Lifecycle & Append Test";
    const createPageData = await callTool(client, "create_page", {
      workspaceId,
      title: pageTitle,
      markdown: "# Base Header\n\nThis is the initial content.\n\n- Initial Point 1",
    });
    assertString(createPageData?.id, "create_page.id");
    let pageId: string = createPageData.id;
    /** move_page may give the page a new id (COR-26): follow it and keep cleanup on the live page. */
    const followMove = (res: any, oldId: string): string => {
      assertString(res?.pageId, "move_page.pageId");
      if (res.pageId !== oldId) {
        pagesToCleanup.delete(oldId);
        pagesToCleanup.add(res.pageId);
        console.log(`   move_page gave the page a new id: ${oldId} → ${res.pageId}`);
      }
      return res.pageId;
    };
    pagesToCleanup.add(pageId);
    assertEqual(createPageData.contentWritten, true, `create_page.contentWritten (contentError: ${createPageData.contentError ?? "none"})`);
    await verifyWrite("create_page", `page ${pageId} has title '${pageTitle}' and the initial markdown content`, async () => {
      const page = await callTool(client, "get_page", { workspaceId, pageId });
      assertObject(page, "get_page");
      assertEqual(page.globalId, pageId, "get_page.globalId");
      assertEqual(page.title, pageTitle, "get_page.title");
      const md = await readPage(client, { workspaceId, pageId, format: "markdown" });
      for (const needle of ["Base Header", "This is the initial content.", "Initial Point 1"]) {
        assertIncludes(md, needle, "get_page_content (markdown) after create_page");
      }
    });

    await new Promise((r) => setTimeout(r, 2000));
    await callTool(client, "append_page_content", {
      workspaceId,
      pageId,
      markdown: "## Appended Section\n\nThis section was appended dynamically.\n\n- Appended Point 2",
    });
    await verifyWrite("append_page_content", `page ${pageId} has the appended section after the original content`, async () => {
      const readHtml = await readPage(client, { workspaceId, pageId });
      for (const needle of ["Base Header", "Initial Point 1", "Appended Section", "Appended Point 2"]) {
        assertIncludes(readHtml, needle, "get_page_content (html)");
      }

      const readMd = await readPage(client, { workspaceId, pageId, format: "markdown" });
      assertIncludes(readMd, "Base Header", "get_page_content (markdown)");
      assertIncludes(readMd, "Appended Section", "get_page_content (markdown)");
      assertIncludes(readMd, "This section was appended dynamically.", "get_page_content (markdown)");
      assertIncludes(readMd, "Appended Point 2", "get_page_content (markdown)");
      assert(
        readMd.indexOf("Base Header") < readMd.indexOf("Appended Section"),
        "append_page_content should add the new section after the existing content, not before it",
      );
    });

    const pageUri = `fusebase://workspaces/${workspaceId}/pages/${pageId}`;
    const pageResourceHtml = resourceText(await client.readResource({ uri: pageUri }), pageUri);
    assertIncludes(pageResourceHtml, "Base Header", "page resource template readback");

    // A folder to move the page into, so each move is a real change of parent.
    const moveFolderTitle = `E2E Move Target ${Date.now()}`;
    const moveFolderData = await callTool(client, "create_folder", { workspaceId, title: moveFolderTitle });
    assertString(moveFolderData?.id, "create_folder.id");
    const moveFolderId: string = moveFolderData.id;
    foldersToCleanup.push(moveFolderId);
    await verifyWrite("create_folder", `folder ${moveFolderId} is listed with name '${moveFolderTitle}'`, async () => {
      const tree = await callTool(client, "list_folders", { workspaceId });
      assertArray(tree, "list_folders");
      const stored = findFolder(tree, moveFolderId);
      assert(stored !== undefined, `list_folders should include created folder ${moveFolderId}`);
      assertEqual(stored.name, moveFolderTitle, "list_folders[].name");
    });

    const idBeforeMoveIn = pageId;
    const moveInRes = await callTool(client, "move_page", { workspaceId, pageId, folderId: moveFolderId });
    assertEqual(moveInRes?.success, true, "move_page.success (into folder)");
    pageId = followMove(moveInRes, pageId);
    await verifyWrite("move_page", `page ${pageId} is inside folder ${moveFolderId}, not at the root`, async () => {
      if (pageId !== idBeforeMoveIn) await assertGone(`page ${idBeforeMoveIn} under its old id`, () => callTool(client, "get_page", { workspaceId, pageId: idBeforeMoveIn }));
      const page = await callTool(client, "get_page", { workspaceId, pageId });
      assertObject(page, "get_page");
      assertEqual(page.parentId, moveFolderId, "get_page.parentId after move_page into the folder");
      const folderPages = await allPages(client, workspaceId, moveFolderId);
      assert(folderPages.some((p: any) => p.id === pageId), `list_pages (folder ${moveFolderId}) should include moved page ${pageId}`);
      // The "root" listing covers the whole workspace; top-level pages are in the default (Unsorted) folder.
      const topLevel = await allPages(client, workspaceId, "default");
      assert(!topLevel.some((p: any) => p.id === pageId), `list_pages (top level, "default") should no longer include page ${pageId} moved into a folder`);
    });

    const idBeforeMoveOut = pageId;
    const moveRes = await callTool(client, "move_page", { workspaceId, pageId, folderId: "root" });
    assertEqual(moveRes?.success, true, "move_page.success");
    pageId = followMove(moveRes, pageId);
    await verifyWrite("move_page", `page ${pageId} is back at the workspace root, out of folder ${moveFolderId}`, async () => {
      if (pageId !== idBeforeMoveOut) await assertGone(`page ${idBeforeMoveOut} under its old id`, () => callTool(client, "get_page", { workspaceId, pageId: idBeforeMoveOut }));
      const page = await callTool(client, "get_page", { workspaceId, pageId });
      assertObject(page, "get_page");
      assertEqual(page.parentId, "default", "get_page.parentId after move_page to the top level (the default folder)");
      const topLevel = await allPages(client, workspaceId, "default");
      assert(topLevel.some((p: any) => p.id === pageId), `list_pages (top level, "default") should include moved page ${pageId}`);
      const folderPages = await allPages(client, workspaceId, moveFolderId);
      assert(!folderPages.some((p: any) => p.id === pageId), `list_pages (folder ${moveFolderId}) should no longer include page ${pageId}`);
    });

    const deletePageRes = await callTool(client, "delete_page", { workspaceId, pageId });
    assertIncludes(deletePageRes, "deleted successfully", "delete_page response");
    await verifyWrite("delete_page", `page ${pageId} is gone (get_page not found, absent from list_pages)`, async () => {
      await assertGone(`page ${pageId}`, () => callTool(client, "get_page", { workspaceId, pageId }));
      const rootPages = await allPages(client, workspaceId);
      assert(!rootPages.some((p: any) => p.id === pageId), `list_pages (root) should no longer include deleted page ${pageId}`);
    });
    pagesToCleanup.delete(pageId);
    console.log("✅ Create/append/readback (html, markdown, resource)/move/delete verified");

    // ─── 6. Interactive app page ──────────────────────────────────
    console.log("\n── 6. Interactive app page ──");
    const appPageTitle = "Vibe Code Interactive Widget";
    const appPageData = await callTool(client, "create_interactive_app_page", {
      workspaceId,
      title: appPageTitle,
      appUrl: "https://example.com/interactive-widget",
      description: "### Custom Antigravity Embedded App\nLive widget embedded below:",
    });
    assertString(appPageData?.id, "create_interactive_app_page.id");
    const appPageId: string = appPageData.id;
    pagesToCleanup.add(appPageId);
    await verifyWrite("create_interactive_app_page", `page ${appPageId} has title '${appPageTitle}', the intro text and an iframe of the app URL`, async () => {
      const page = await callTool(client, "get_page", { workspaceId, pageId: appPageId });
      assertObject(page, "get_page");
      assertEqual(page.title, appPageTitle, "get_page.title (app page)");
      const appHtml = await readPage(client, { workspaceId, pageId: appPageId });
      assertIncludes(appHtml, "iframe", "app page content");
      assertIncludes(appHtml, "interactive-widget", "app page content");
      assertIncludes(appHtml, "example.com/interactive-widget", "app page content (iframe src)");
      assertIncludes(appHtml, "Custom Antigravity Embedded App", "app page content (intro heading)");
      assertIncludes(appHtml, "Live widget embedded below:", "app page content (intro text)");
    });

    await callTool(client, "delete_page", { workspaceId, pageId: appPageId });
    await verifyWrite("delete_page", `app page ${appPageId} is gone (get_page not found, absent from list_pages)`, async () => {
      await assertGone(`app page ${appPageId}`, () => callTool(client, "get_page", { workspaceId, pageId: appPageId }));
      const rootPages = await allPages(client, workspaceId);
      assert(!rootPages.some((p: any) => p.id === appPageId), `list_pages (root) should no longer include deleted app page ${appPageId}`);
    });
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

    const flowName = `E2E Test Flow ${Date.now()}`;
    const flow = await automation("create_automation_flow", () =>
      callTool(client, "create_automation_flow", { displayName: flowName }),
    );
    if (flow !== undefined) {
      assertString(flow?.id, "create_automation_flow.id");
      const flowId: string = flow.id;
      flowsToCleanup.push(flowId);
      await verifyWrite("create_automation_flow", `flow ${flowId} exists with name '${flowName}'`, async () => {
        const stored = await callTool(client, "get_automation_flow", { flowId });
        assertObject(stored, "get_automation_flow");
        assertEqual(stored.id, flowId, "get_automation_flow.id");
        assertEqual(flowDisplayName(stored), flowName, "get_automation_flow version.displayName");
      });
      await callTool(client, "delete_automation_flow", { flowId });
      await verifyWrite("delete_automation_flow", `flow ${flowId} is gone (get_automation_flow not found)`, async () => {
        await assertGone(`automation flow ${flowId}`, () => callTool(client, "get_automation_flow", { flowId }));
      });
      flowsToCleanup.splice(flowsToCleanup.indexOf(flowId), 1);
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
      const folderName = `E2E Test Automation Folder ${Date.now()}`;
      const folder = await automation("create_automation_folder", () =>
        callTool(client, "create_automation_folder", { displayName: folderName }),
      );
      if (folder !== undefined) {
        assertString(folder?.id, "create_automation_folder.id");
        const folderId: string = folder.id;
        automationFoldersToCleanup.push(folderId);
        // There is no get_automation_folder; list_automation_folders is the read.
        await verifyWrite("create_automation_folder", `automation folder ${folderId} is listed with name '${folderName}'`, async () => {
          const listed = listOf(await callTool(client, "list_automation_folders"), "list_automation_folders");
          const stored = listed.find((f: any) => f?.id === folderId);
          assert(stored !== undefined, `list_automation_folders should include created folder ${folderId}`);
          assertEqual(stored.displayName, folderName, "list_automation_folders[].displayName");
        });
        await callTool(client, "delete_automation_folder", { folderId });
        await verifyWrite("delete_automation_folder", `automation folder ${folderId} is no longer listed`, async () => {
          const listed = listOf(await callTool(client, "list_automation_folders"), "list_automation_folders");
          assert(!listed.some((f: any) => f?.id === folderId), `list_automation_folders should no longer include deleted folder ${folderId}`);
        });
        automationFoldersToCleanup.splice(automationFoldersToCleanup.indexOf(folderId), 1);
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
    const swarmTitle = `E2E Test Swarm Sprint ${Date.now()}`;
    const swarmDescription = "Automated test swarm state machine for E2E verification";
    const swarmData = await callTool(client, "fusebase_swarm_init", {
      title: swarmTitle,
      description: swarmDescription,
    });
    assertEqual(swarmData?.success, true, "fusebase_swarm_init.success");
    assertString(swarmData?.databaseId, "fusebase_swarm_init.databaseId");
    databasesToCleanup.push(swarmData.databaseId);
    assertString(swarmData?.dashboardId, "fusebase_swarm_init.dashboardId");
    assertString(swarmData?.viewId, "fusebase_swarm_init.viewId");
    assertString(swarmData?.statusColumnKey, "fusebase_swarm_init.statusColumnKey");
    assertString(swarmData?.roleColumnKey, "fusebase_swarm_init.roleColumnKey");
    assertString(swarmData?.auditColumnKey, "fusebase_swarm_init.auditColumnKey");
    const swarm: {
      databaseId: string;
      dashboardId: string;
      viewId: string;
      statusColumnKey: string;
      roleColumnKey: string;
      auditColumnKey: string;
    } = swarmData;
    await verifyWrite(
      "fusebase_swarm_init",
      `swarm database ${swarm.databaseId} has its title, description, Status/Role label columns, an Audit Log column and a kanban grouped by Status`,
      async () => {
        const detail = await callTool(client, "get_database_detail", { databaseId: swarm.databaseId });
        assertObject(detail?.data, "get_database_detail.data");
        assertEqual(detail.data.global_id, swarm.databaseId, "get_database_detail.data.global_id");
        assertEqual(detail.data.title, swarmTitle, "get_database_detail.data.title");
        assertEqual(detail.data.metadata?.description, swarmDescription, "get_database_detail.data.metadata.description");
        assertArray(detail.data.dashboards, "get_database_detail.data.dashboards", 1);
        const dashboard = detail.data.dashboards.find((d: any) => d?.global_id === swarm.dashboardId);
        assert(dashboard !== undefined, `get_database_detail should list swarm dashboard ${swarm.dashboardId}`);

        const schema = await callTool(client, "get_database_schema", { dashboardId: swarm.dashboardId, viewId: swarm.viewId });
        assertArray(schema, "get_database_schema", 3);
        const expectLabelColumn = (key: string, name: string, labels: string[]) => {
          const col = schema.find((c: any) => c?.key === key);
          assert(col !== undefined, `get_database_schema should contain the ${name} column (${key})`);
          assertEqual(col.name, name, `${name} column name`);
          assertEqual(col.type, "label", `${name} column type`);
          assertArray(col.labels, `${name} column labels`);
          assertEqual(JSON.stringify(col.labels.map((l: any) => l.name)), JSON.stringify(labels), `${name} column label names`);
        };
        expectLabelColumn(swarm.statusColumnKey, "Status", ["Backlog", "In Progress", "Review", "Done"]);
        expectLabelColumn(swarm.roleColumnKey, "Role", ["agent-pm", "agent-architect", "agent-dev", "agent-qa", "agent-review", "agent-devops"]);
        const auditCol = schema.find((c: any) => c?.key === swarm.auditColumnKey);
        assert(auditCol !== undefined, `get_database_schema should contain the Audit Log column (${swarm.auditColumnKey})`);
        assertEqual(auditCol.name, "Audit Log", "Audit Log column name");

        const reps = await readViewRepresentations(client, swarm.dashboardId, swarm.viewId);
        const kanban = reps.find((r) => r.global_id === "kanban");
        assert(kanban !== undefined, `swarm view should have a kanban representation, got: ${JSON.stringify(reps).slice(0, 300)}`);
        assertEqual(kanban.is_default, true, "swarm view kanban representation is the default");
        assertEqual(kanban.settings?.groupByField, swarm.statusColumnKey, "swarm kanban groupByField (Status column)");
      },
    );
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
    // Sidebar state: flip it, prove the flip, then restore the original and prove that too, so
    // each write is a real change rather than re-writing the value already stored.
    const readSidebarCollapsed = async (): Promise<boolean> => {
      const prefs = await callTool(client, "get_user_preferences");
      assertObject(prefs, "get_user_preferences");
      const sidebar = findUserVar(prefs, "sidebarCollapsed");
      assert(sidebar !== undefined, `get_user_preferences should expose the sidebarCollapsed user var, got: ${JSON.stringify(prefs).slice(0, 300)}`);
      return collapsedValue(sidebar.value);
    };
    const sidebarWasCollapsed = await readSidebarCollapsed();
    let sidebarRestored = false;
    try {
      for (const collapsed of [!sidebarWasCollapsed, sidebarWasCollapsed]) {
        assertObject(await callTool(client, "set_sidebar_collapsed", { collapsed }), "set_sidebar_collapsed");
        const what = collapsed === sidebarWasCollapsed ? "restored to its original value" : "changed";
        await verifyWrite("set_sidebar_collapsed", `user var sidebarCollapsed ${what}: reads back as ${collapsed ? "collapsed ('1')" : "expanded ('0')"}`, async () => {
          assertEqual(await readSidebarCollapsed(), collapsed, "sidebarCollapsed read back after set_sidebar_collapsed");
        });
      }
      sidebarRestored = true;
    } finally {
      // This is the account owner's real UI setting: put it back even if a check above failed.
      if (!sidebarRestored) {
        await duringCleanup(() => callTool(client, "set_sidebar_collapsed", { collapsed: sidebarWasCollapsed })).catch((err) =>
          console.error(`⚠️ Could not restore sidebarCollapsed: ${err instanceof Error ? err.message : err}`));
      }
    }
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
      const taskTitle = `E2E Time Tracking Task ${Date.now()}`;
      const task = await callTool(client, "create_task", {
        workspaceId,
        taskListId,
        title: taskTitle,
      });
      assertObject(task, "create_task");
      const taskId = task.globalId ?? task.id ?? task.taskId;
      assertString(taskId, "create_task id");
      taskToCleanup = taskId;
      await verifyWrite(
        "create_task",
        `task ${taskId} exists in task list ${taskListId} with title '${taskTitle}'`,
        async () => {
          const stored = (await allTasks(client, workspaceId)).find((t: any) => isTask(t, taskId));
          assert(stored !== undefined, `search_tasks should find created task ${taskId}`);
          assertEqual(stored.title, taskTitle, "search_tasks[].title");
          assertEqual(stored.taskListId, taskListId, "search_tasks[].taskListId");
        },
        { timeoutMs: 30_000 },
      );

      const timeData = await callTool(client, "get_task_time_tracking", { workspaceId, taskId });
      assertObject(timeData, "get_task_time_tracking");

      await callTool(client, "delete_task", { workspaceId, taskId });
      await verifyWrite(
        "delete_task",
        `task ${taskId} no longer appears in search_tasks`,
        async () => {
          const tasks = await allTasks(client, workspaceId);
          assert(!tasks.some((t: any) => isTask(t, taskId)), `search_tasks should no longer find deleted task ${taskId}`);
        },
        { timeoutMs: 30_000 },
      );
      taskToCleanup = undefined;
      console.log("✅ get_task_time_tracking verified on a freshly created task");
    }
  } finally {
    console.log("\n── Cleanup ──");
    const cleanup = async (what: string, tool: string, args: Record<string, unknown>) => {
      try {
        await duringCleanup(() => callTool(client, tool, args));
        console.log(`Cleaned up ${what}`);
      } catch (err) {
        console.error(`⚠️ Failed to clean up ${what}:`, err instanceof Error ? err.message : err);
      }
    };
    for (const id of pagesToCleanup) await cleanup(`page ${id}`, "delete_page", { workspaceId, pageId: id });
    // There is no delete_folder tool; delete_page removes a folder by its id (after the pages above).
    for (const id of foldersToCleanup) await cleanup(`folder ${id}`, "delete_page", { workspaceId, pageId: id });
    if (taskToCleanup) await cleanup(`task ${taskToCleanup}`, "delete_task", { workspaceId, taskId: taskToCleanup });
    for (const id of flowsToCleanup) await cleanup(`automation flow ${id}`, "delete_automation_flow", { flowId: id });
    for (const id of automationFoldersToCleanup) await cleanup(`automation folder ${id}`, "delete_automation_folder", { folderId: id });
    for (const id of databasesToCleanup) await cleanup(`database ${id}`, "delete_database", { databaseId: id });
    await client.close();
  }
}

runSuite("MCP platform live suite", main);
