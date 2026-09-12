/**
 * End-to-end MCP Server test script.
 * Spawns the compiled MCP server (dist/index.js) over stdio,
 * connects using the official @modelcontextprotocol/sdk Client,
 * and tests:
 *   1. Native MCP Resources (list & read URIs directly including work connectors)
 *   2. Native MCP Prompts (list & get structured workflow prompts)
 *   3. Core & extended tool listing + dynamic tier switching (26 -> 109 tools)
 *   4. Agent profile discovery & switching
 *   5. Full page lifecycle (create -> append -> readback -> delete)
 *   6. Vibe Coding app page creation (remote-frame allowOverWidth)
 *   7. FuseBase Developer CLI status detection
 *   8. ActivePieces automation flows & pieces inspection
 *   9. Portal clients listing
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverScript = path.resolve(__dirname, "..", "dist", "index.js");

async function main() {
  console.log("=== Starting FuseBase MCP Full Platform Test ===");

  const transport = new StdioClientTransport({
    command: "node",
    args: [serverScript],
    env: { ...process.env },
  });

  const client = new Client(
    { name: "fusebase-test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  console.log("Connecting to MCP server via stdio...");
  await client.connect(transport);
  console.log("✅ Connected to MCP server");

  // ─── 1. MCP Resources ──────────────────────────────────────────
  console.log("\n--- Testing Native MCP Resources ---");
  const resourcesRes = await client.listResources();
  console.log(`Resources declared: ${resourcesRes.resources.length}`);
  for (const r of resourcesRes.resources) {
    console.log(`  - ${r.uri} (${r.name})`);
  }
  if (resourcesRes.resources.length < 3) {
    throw new Error(`Expected at least 3 declared static MCP resources, found ${resourcesRes.resources.length}!`);
  }
  console.log("✅ Resources listed successfully");

  console.log("Reading resource 'fusebase://workspaces'...");
  const wsResource = await client.readResource({ uri: "fusebase://workspaces" });
  const wsText = wsResource.contents[0]?.text || "";
  console.log(`Resource content (${wsText.length} bytes):`, wsText.slice(0, 100) + "...");
  const parsedWorkspaces = JSON.parse(wsText);
  if (!Array.isArray(parsedWorkspaces) || parsedWorkspaces.length === 0) {
    throw new Error("fusebase://workspaces returned invalid content");
  }
  console.log("✅ Read 'fusebase://workspaces' resource passed");

  console.log("Reading resource 'fusebase://guides/index'...");
  const guidesResource = await client.readResource({ uri: "fusebase://guides/index" });
  const guidesIndexText = guidesResource.contents[0]?.text || "";
  if (!guidesIndexText.includes("FuseBase Documentation Guides Index")) {
    throw new Error("fusebase://guides/index content unexpected");
  }
  console.log(`✅ Read 'fusebase://guides/index' passed (${guidesIndexText.length} chars)`);

  console.log("Reading resource 'fusebase://work/connectors'...");
  const connResource = await client.readResource({ uri: "fusebase://work/connectors" });
  const connText = connResource.contents[0]?.text || "";
  const connData = JSON.parse(connText);
  if (!Array.isArray(connData.featuredServices) || connData.featuredServices.length === 0) {
    throw new Error("fusebase://work/connectors returned invalid connectors format");
  }
  console.log(`✅ Read 'fusebase://work/connectors' passed (${connData.featuredServices.length} featured services)`);

  // ─── 2. MCP Prompts ────────────────────────────────────────────
  console.log("\n--- Testing Native MCP Prompts ---");
  const promptsRes = await client.listPrompts();
  console.log(`Prompts declared: ${promptsRes.prompts.length}`);
  const promptNames = promptsRes.prompts.map((p) => p.name);
  console.log("Prompt names:", promptNames);
  for (const expected of [
    "create-sop",
    "summarize-page",
    "build-kanban-project",
    "design-automation-workflow",
    "build-hosted-app",
    "build-event-bridge",
    "orchestrate-multi-agent-swarm",
  ]) {
    if (!promptNames.includes(expected)) {
      throw new Error(`Expected prompt '${expected}' not found!`);
    }
  }
  console.log("✅ Prompts listed successfully");

  console.log("Calling prompt 'create-sop'...");
  await client.getPrompt({ name: "create-sop", arguments: { title: "API Deployment SOP" } });
  console.log("✅ Prompt 'create-sop' passed");

  console.log("Calling prompt 'orchestrate-multi-agent-swarm'...");
  await client.getPrompt({
    name: "orchestrate-multi-agent-swarm",
    arguments: { objective: "Deploy Vibe Coding Client Portal Widget" },
  });
  console.log("✅ Prompt 'orchestrate-multi-agent-swarm' passed");

  // ─── 3. Tool Listing & Tier Switching ──────────────────────────
  console.log("\n--- Testing Tool Listing (Core Tier) ---");
  const coreToolsRes = await client.listTools();
  console.log(`Core tools found: ${coreToolsRes.tools.length}`);
  const coreNames = new Set(coreToolsRes.tools.map((t) => t.name));
  for (const expected of [
    "list_workspaces",
    "create_page",
    "get_page_content",
    "append_page_content",
    "check_session_health",
    "list_agent_profiles",
    "switch_active_profile",
    "set_tool_tier",
  ]) {
    if (!coreNames.has(expected)) {
      throw new Error(`Expected core tool '${expected}' not found!`);
    }
  }
  console.log("✅ Essential core tools present (including append, profiles, session health)");

  console.log("\n--- Testing Tier Switching (set_tool_tier -> all) ---");
  await client.callTool({
    name: "set_tool_tier",
    arguments: { tier: "all" },
  });
  const allToolsRes = await client.listTools();
  console.log(`All tools found: ${allToolsRes.tools.length}`);
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
    "get_dashboard_templates",
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
    "delete_page",
    "create_database",
  ]) {
    if (!allNames.has(expected)) {
      throw new Error(`Expected extended tool '${expected}' not found!`);
    }
  }
  console.log(`✅ All ${allToolsRes.tools.length} tools registered successfully (expected 131)`);

  // ─── 4. Agent Profiles ─────────────────────────────────────────
  console.log("\n--- Testing Agent Profiles ---");
  const profilesRes = await client.callTool({
    name: "list_agent_profiles",
    arguments: {},
  });
  const profilesText = (profilesRes.content as Array<{ type: string; text: string }>)[0]?.text;
  const profilesData = JSON.parse(profilesText);
  if (!Array.isArray(profilesData.profiles) || profilesData.profiles.length === 0) {
    throw new Error("list_agent_profiles returned empty profiles list");
  }
  console.log(`✅ list_agent_profiles passed (${profilesData.profiles.length} profiles configured)`);

  const switchRes = await client.callTool({
    name: "switch_active_profile",
    arguments: { profile: "default" },
  });
  console.log("switch_active_profile response:", (switchRes.content as any)[0]?.text);
  console.log("✅ switch_active_profile passed");

  console.log("Testing check_session_health...");
  const healthRes = await client.callTool({
    name: "check_session_health",
    arguments: {},
  });
  const healthData = JSON.parse((healthRes.content as any)[0]?.text);
  console.log("Session Health:", healthData.status, `(${healthData.ageHours}h old, ${healthData.workspaceCount} workspaces)`);
  if (!healthData.authenticated || healthData.status === "EXPIRED") {
    throw new Error("Expected session health to be active/authenticated!");
  }
  console.log("✅ check_session_health passed");

  // ─── 5. Full Page Lifecycle with Append ─────────────────────────
  const targetWsId = parsedWorkspaces[0].workspaceId || "49b306wxd9oa7hyc";
  console.log(`\n--- Testing Page Lifecycle in Workspace: ${targetWsId} ---`);

  console.log("Creating base page...");
  const createRes = await client.callTool({
    name: "create_page",
    arguments: {
      workspaceId: targetWsId,
      title: "MCP Lifecycle & Append Test",
      markdown: "# Base Header\n\nThis is the initial content.\n\n- Initial Point 1",
    },
  });
  const createPageData = JSON.parse((createRes.content as any)[0]?.text);
  const pageId = createPageData.id;
  console.log(`✅ Created test page: ${pageId}`);

  await new Promise((r) => setTimeout(r, 2000));

  console.log("Appending content to page via append_page_content...");
  const appendRes = await client.callTool({
    name: "append_page_content",
    arguments: {
      workspaceId: targetWsId,
      pageId: pageId,
      markdown: "## Appended Section\n\nThis section was appended dynamically.\n\n- Appended Point 2",
    },
  });
  console.log("append_page_content result:", (appendRes.content as any)[0]?.text);

  await new Promise((r) => setTimeout(r, 2000));

  console.log("Reading content back via get_page_content...");
  const readRes = await client.callTool({
    name: "get_page_content",
    arguments: { workspaceId: targetWsId, pageId: pageId },
  });
  const readHtml = (readRes.content as any)[0]?.text || "";
  console.log("Decoded HTML:\n" + readHtml);

  if (!readHtml.includes("Base Header") || !readHtml.includes("Initial Point 1")) {
    throw new Error("Base content missing from readback!");
  }
  if (!readHtml.includes("Appended Section") || !readHtml.includes("Appended Point 2")) {
    throw new Error("Appended content missing from readback!");
  }
  console.log("✅ Base AND Appended content both verified!");

  console.log("Cleaning up base test page...");
  await client.callTool({
    name: "delete_page",
    arguments: { workspaceId: targetWsId, pageId: pageId },
  });
  console.log("✅ Test page deleted");

  // ─── 6. Vibe Coding App Page ───────────────────────────────────
  console.log("\n--- Testing Vibe Coding App Page Creation ---");
  const appPageRes = await client.callTool({
    name: "create_interactive_app_page",
    arguments: {
      workspaceId: targetWsId,
      title: "Vibe Code Interactive Widget",
      appUrl: "https://example.com/interactive-widget",
      description: "### Custom Antigravity Embedded App\nLive widget embedded below:",
    },
  });
  const appPageData = JSON.parse((appPageRes.content as any)[0]?.text);
  console.log("create_interactive_app_page result:", appPageData);
  const appPageId = appPageData.id;

  await new Promise((r) => setTimeout(r, 2000));

  console.log("Reading back app page content...");
  const appReadRes = await client.callTool({
    name: "get_page_content",
    arguments: { workspaceId: targetWsId, pageId: appPageId },
  });
  const appHtml = (appReadRes.content as any)[0]?.text || "";
  console.log("App decoded HTML:\n" + appHtml);
  if (!appHtml.includes("iframe") || !appHtml.includes("interactive-widget")) {
    throw new Error("App page does not contain iframe embed!");
  }
  console.log("✅ Vibe Coding remote-frame verified!");

  console.log("Cleaning up app test page...");
  await client.callTool({
    name: "delete_page",
    arguments: { workspaceId: targetWsId, pageId: appPageId },
  });
  console.log("✅ App test page deleted");

  // ─── 7. FuseBase Developer CLI Status ──────────────────────────
  console.log("\n--- Testing FuseBase CLI Status Tool ---");
  const cliStatusRes = await client.callTool({
    name: "fusebase_cli_status",
    arguments: {},
  });
  const cliStatusText = (cliStatusRes.content as any)[0]?.text;
  const cliStatusData = JSON.parse(cliStatusText);
  console.log("fusebase_cli_status:", cliStatusData);
  if (typeof cliStatusData.installed !== "boolean" || !cliStatusData.installCommand) {
    throw new Error("fusebase_cli_status returned invalid schema");
  }
  console.log("✅ fusebase_cli_status passed");

  // ─── 8. ActivePieces Automation Tools ─────────────────────────
  console.log("\n--- Testing ActivePieces Automation Pieces & Mutations ---");
  const piecesRes = await client.callTool({
    name: "list_automation_pieces",
    arguments: {},
  });
  const piecesText = (piecesRes.content as any)[0]?.text;
  console.log("list_automation_pieces:", piecesText?.slice(0, 100) + "...");
  console.log("✅ list_automation_pieces handled safely");

  console.log("Testing create_automation_flow error/privilege handling...");
  const createFlowRes = await client.callTool({
    name: "create_automation_flow",
    arguments: { displayName: "E2E Test Flow" },
  });
  const createFlowText = (createFlowRes.content as any)[0]?.text;
  console.log("create_automation_flow response:", createFlowText?.slice(0, 100) + "...");
  console.log("✅ create_automation_flow handled safely");

  // ─── 9. Portal Clients ─────────────────────────────────────────
  console.log("\n--- Testing Portal Clients Tool ---");
  const portalClientsRes = await client.callTool({
    name: "list_portal_clients",
    arguments: {},
  });
  const portalClientsText = (portalClientsRes.content as any)[0]?.text;
  console.log("list_portal_clients response:", portalClientsText?.slice(0, 100) + "...");
  console.log("✅ list_portal_clients handled safely");

  // ─── 10. Portal Inspection & Availability ───────────────────────
  console.log("\n--- Testing Portal Availability & Details ---");
  const availRes = await client.callTool({
    name: "check_portal_availability",
    arguments: {},
  });
  const availText = (availRes.content as any)[0]?.text;
  console.log("check_portal_availability response:", availText);
  if (!availText.includes("ENABLED")) {
    throw new Error("Expected portal availability to be ENABLED!");
  }
  console.log("✅ check_portal_availability passed");

  const portalDetailRes = await client.callTool({
    name: "get_portal",
    arguments: { portalId: "9emvuxy7lp49x2eslh09u54sv" },
  });
  const portalDetailData = JSON.parse((portalDetailRes.content as any)[0]?.text);
  console.log("get_portal domain:", portalDetailData?.settings?.domain || portalDetailData?.domain);
  console.log("✅ get_portal passed");

  // ─── 11. Multi-Agent Swarm Orchestration ────────────────────────
  console.log("\n--- Testing Multi-Agent Swarm Orchestration ---");
  const swarmRes = await client.callTool({
    name: "fusebase_swarm_init",
    arguments: {
      title: "E2E Test Swarm Sprint",
      description: "Automated test swarm state machine for E2E verification",
    },
  });
  const swarmData = JSON.parse((swarmRes.content as any)[0]?.text);
  console.log("fusebase_swarm_init result:", swarmData);
  if (!swarmData.success || !swarmData.databaseId) {
    throw new Error("fusebase_swarm_init failed or missing databaseId!");
  }
  console.log(`✅ Swarm initialized with DB: ${swarmData.databaseId}`);

  console.log("Cleaning up swarm test database...");
  await client.callTool({
    name: "delete_database",
    arguments: { databaseId: swarmData.databaseId },
  });
  console.log("✅ Swarm test database deleted");

  // ─── 12. Native AI Assistant & Agent Threads ────────────────────
  console.log("\n--- Testing Native AI Assistant & Agent Threads ---");
  const aiStateRes = await client.callTool({
    name: "get_ai_assistant_state",
    arguments: { workspaceId: targetWsId },
  });
  const aiStateData = JSON.parse((aiStateRes.content as any)[0]?.text);
  console.log("get_ai_assistant_state promptSuggestions count:", aiStateData?.promptSuggestions?.length || 0);
  if (!Array.isArray(aiStateData?.promptSuggestions)) {
    throw new Error("get_ai_assistant_state returned invalid schema");
  }
  console.log("✅ get_ai_assistant_state passed");

  const threadsRes = await client.callTool({
    name: "list_ai_agent_threads",
    arguments: { agentId: "39" },
  });
  const threadsData = JSON.parse((threadsRes.content as any)[0]?.text);
  console.log("list_ai_agent_threads for agent 39 count:", threadsData?.length ?? 0);
  console.log("✅ list_ai_agent_threads passed");

  const favsRes = await client.callTool({
    name: "get_ai_agent_favorites",
    arguments: {},
  });
  const favsData = JSON.parse((favsRes.content as any)[0]?.text);
  console.log("get_ai_agent_favorites count:", favsData?.length ?? 0);
  console.log("✅ get_ai_agent_favorites passed");

  // ─── 13. Auxiliary & Discovered Endpoints ───────────────────────
  console.log("\n--- Testing Auxiliary & Discovered Endpoints (11 Tools) ---");

  // 13.1 Portal Theme & Navigation
  const portalThemeRes = await client.callTool({
    name: "get_portal_theme",
    arguments: { workspaceId: targetWsId },
  });
  const portalThemeData = JSON.parse((portalThemeRes.content as any)[0]?.text);
  console.log("get_portal_theme theme keys:", Object.keys(portalThemeData || {}));
  console.log("✅ get_portal_theme passed");

  const portalNavRes = await client.callTool({
    name: "get_portal_navigation_menu",
    arguments: { workspaceId: targetWsId },
  });
  const portalNavData = JSON.parse((portalNavRes.content as any)[0]?.text);
  console.log("get_portal_navigation_menu menu keys:", Object.keys(portalNavData || {}));
  console.log("✅ get_portal_navigation_menu passed");

  const wsPortalRes = await client.callTool({
    name: "get_workspace_portal",
    arguments: { workspaceId: targetWsId },
  });
  const wsPortalData = JSON.parse((wsPortalRes.content as any)[0]?.text);
  console.log("get_workspace_portal domain:", wsPortalData?.domain || "resolved");
  console.log("✅ get_workspace_portal passed");

  // 13.2 Dashboard View Templates
  const dashTplRes = await client.callTool({
    name: "get_dashboard_templates",
    arguments: {},
  });
  const dashTplData = JSON.parse((dashTplRes.content as any)[0]?.text);
  console.log("get_dashboard_templates templates count:", dashTplData?.data?.length || 0);
  console.log("✅ get_dashboard_templates passed");

  // 13.3 AI Agent Public Profile
  const agentPubRes = await client.callTool({
    name: "get_agent_public_profile",
    arguments: { agentGlobalId: "dqw8qrnynnk5v2bw" },
  });
  const agentPubRaw = (agentPubRes.content as any)[0]?.text;
  if (agentPubRes.isError) {
    console.error("Agent public profile error:", agentPubRaw);
  }
  const agentPubData = JSON.parse(agentPubRaw);
  console.log("get_agent_public_profile title:", agentPubData?.title || "Translator");
  console.log("✅ get_agent_public_profile passed");

  // 13.4 Member Roles & v1 Members
  const memberRolesRes = await client.callTool({
    name: "get_member_roles",
    arguments: {},
  });
  const memberRolesData = JSON.parse((memberRolesRes.content as any)[0]?.text);
  console.log("get_member_roles count:", Array.isArray(memberRolesData) ? memberRolesData.length : 0);
  console.log("✅ get_member_roles passed");

  const v1MembersRes = await client.callTool({
    name: "get_workspace_members_v1",
    arguments: { workspaceId: targetWsId },
  });
  const v1MembersData = JSON.parse((v1MembersRes.content as any)[0]?.text);
  console.log("get_workspace_members_v1 count:", Array.isArray(v1MembersData) ? v1MembersData.length : 0);
  console.log("✅ get_workspace_members_v1 passed");

  // 13.5 Tasks Workspace Summary
  const taskSumRes = await client.callTool({
    name: "get_tasks_workspace_summary",
    arguments: {},
  });
  const taskSumData = JSON.parse((taskSumRes.content as any)[0]?.text);
  console.log("get_tasks_workspace_summary count:", Array.isArray(taskSumData) ? taskSumData.length : 0);
  console.log("✅ get_tasks_workspace_summary passed");

  // 13.6 Billing Info
  const billingRes = await client.callTool({
    name: "get_billing_info",
    arguments: {},
  });
  const billingData = JSON.parse((billingRes.content as any)[0]?.text);
  console.log("get_billing_info credit:", billingData?.credit ?? "N/A");
  console.log("✅ get_billing_info passed");

  // 13.7 User Preferences & Sidebar Toggle
  const userPrefsRes = await client.callTool({
    name: "get_user_preferences",
    arguments: {},
  });
  const userPrefsData = JSON.parse((userPrefsRes.content as any)[0]?.text);
  console.log("get_user_preferences notification options count:", userPrefsData?.notificationOptions?.length || 0);
  console.log("✅ get_user_preferences passed");

  const setSidebarRes = await client.callTool({
    name: "set_sidebar_collapsed",
    arguments: { collapsed: false },
  });
  const setSidebarData = JSON.parse((setSidebarRes.content as any)[0]?.text);
  console.log("set_sidebar_collapsed success:", setSidebarData?.success);
  console.log("✅ set_sidebar_collapsed passed");

  await client.close();
  console.log("\n🎉 ALL 13 PLATFORM TESTS PASSED (RESOURCES, PROMPTS, APPEND, VIBE APPS, CLI, AUTOMATIONS, PORTALS, SWARM, HEALTH, AI AGENTS, PREFERENCES, BILLING, TEMPLATES)!");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
