/**
 * End-to-end MCP Server test script.
 * Spawns the compiled MCP server (dist/index.js) over stdio,
 * connects using the official @modelcontextprotocol/sdk Client,
 * and tests:
 *   1. Core & extended tool listing + dynamic tier switching
 *   2. Native MCP Resources (list & read URI directly)
 *   3. Native MCP Prompts (list & get structured prompts)
 *   4. Agent profile discovery & switching
 *   5. Full page lifecycle (create -> append -> readback -> delete)
 *   6. Vibe Coding app page creation (remote-frame)
 *   7. ActivePieces automation pieces inspection
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
  if (resourcesRes.resources.length === 0) {
    throw new Error("Expected declared MCP resources, but none found!");
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

  // ─── 2. MCP Prompts ────────────────────────────────────────────
  console.log("\n--- Testing Native MCP Prompts ---");
  const promptsRes = await client.listPrompts();
  console.log(`Prompts declared: ${promptsRes.prompts.length}`);
  const promptNames = promptsRes.prompts.map((p) => p.name);
  console.log("Prompt names:", promptNames);
  for (const expected of ["create-sop", "summarize-page", "build-kanban-project"]) {
    if (!promptNames.includes(expected)) {
      throw new Error(`Expected prompt '${expected}' not found!`);
    }
  }
  console.log("✅ Prompts listed successfully");

  console.log("Calling prompt 'create-sop'...");
  const sopPrompt = await client.getPrompt({
    name: "create-sop",
    arguments: { title: "API Deployment Protocol", scope: "DevOps", role: "Release Engineer" },
  });
  const sopText = (sopPrompt.messages[0]?.content as { type: string; text: string })?.text || "";
  if (!sopText.includes("API Deployment Protocol") || !sopText.includes("Release Engineer")) {
    throw new Error("Prompt create-sop returned unexpected text");
  }
  console.log("✅ Prompt 'create-sop' passed");

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
    "list_agent_profiles",
    "switch_active_profile",
    "set_tool_tier",
  ]) {
    if (!coreNames.has(expected)) {
      throw new Error(`Expected core tool '${expected}' not found!`);
    }
  }
  console.log("✅ Essential core tools present (including append & profiles)");

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
    "list_automation_flows",
    "list_automation_pieces",
    "delete_page",
    "create_database",
  ]) {
    if (!allNames.has(expected)) {
      throw new Error(`Expected extended tool '${expected}' not found!`);
    }
  }
  console.log(`✅ All ${allToolsRes.tools.length} tools registered successfully`);

  // ─── 4. Agent Profiles ─────────────────────────────────────────
  console.log("\n--- Testing Agent Profiles ---");
  const profilesRes = await client.callTool({
    name: "list_agent_profiles",
    arguments: {},
  });
  const profilesText = (profilesRes.content as Array<{ type: string; text: string }>)[0]?.text;
  console.log("list_agent_profiles:", profilesText);
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

  // ─── 7. ActivePieces Automation Pieces ─────────────────────────
  console.log("\n--- Testing ActivePieces Automation Pieces ---");
  const piecesRes = await client.callTool({
    name: "list_automation_pieces",
    arguments: {},
  });
  const piecesText = (piecesRes.content as any)[0]?.text;
  console.log("list_automation_pieces:", piecesText?.slice(0, 150) + "...");
  console.log("✅ list_automation_pieces handled safely");

  await client.close();
  console.log("\n🎉 ALL PLATFORM TESTS PASSED (RESOURCES, PROMPTS, APPEND, VIBE APPS, PROFILES)!");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
