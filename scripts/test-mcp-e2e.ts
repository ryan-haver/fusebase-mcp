/**
 * End-to-end MCP Server test script.
 * Spawns the compiled MCP server (dist/index.js) over stdio,
 * connects using the official @modelcontextprotocol/sdk Client,
 * and tests protocol negotiation, tier switching, and live tool execution.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverScript = path.resolve(__dirname, "..", "dist", "index.js");

async function main() {
  console.log("=== Starting FuseBase MCP End-to-End Test ===");

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

  // 1. Verify Core Tier Tool Count
  console.log("\n--- Testing Tool Listing (Core Tier) ---");
  const coreToolsRes = await client.listTools();
  console.log(`Core tools found: ${coreToolsRes.tools.length}`);
  if (coreToolsRes.tools.length !== 23) {
    throw new Error(`Expected 23 core tools, but got ${coreToolsRes.tools.length}`);
  }
  console.log("✅ Core tier tool count is 23");

  const coreNames = new Set(coreToolsRes.tools.map((t) => t.name));
  console.log("Core tool names:", Array.from(coreNames));
  for (const expected of ["list_workspaces", "create_page", "get_page_content", "set_tool_tier"]) {
    if (!coreNames.has(expected)) {
      throw new Error(`Expected core tool '${expected}' not found!`);
    }
  }
  console.log("✅ Essential core tools present");

  // 2. Test Tier Switching to 'all'
  console.log("\n--- Testing Tier Switching (set_tool_tier -> all) ---");
  const tierRes = await client.callTool({
    name: "set_tool_tier",
    arguments: { tier: "all" },
  });
  console.log("set_tool_tier response:", JSON.stringify(tierRes.content));

  const allToolsRes = await client.listTools();
  console.log(`Extended tools found: ${allToolsRes.tools.length}`);
  if (allToolsRes.tools.length !== 91) {
    throw new Error(`Expected 91 tools after tier switch, but got ${allToolsRes.tools.length}`);
  }
  console.log("✅ All 91 tools registered successfully");

  // 3. Test Live MCP Tools: check_version & get_members
  console.log("\n--- Testing Live Tool: check_version ---");
  const versionRes = await client.callTool({
    name: "check_version",
    arguments: {},
  });
  const versionText = (versionRes.content as Array<{ type: string; text: string }>)[0]?.text;
  console.log("check_version:", versionText);
  const versionData = JSON.parse(versionText);
  if (!versionData.version) {
    throw new Error("check_version missing version field");
  }
  console.log("✅ check_version passed");

  console.log("\n--- Testing Live Tool: get_members ---");
  const membersRes = await client.callTool({
    name: "get_members",
    arguments: {},
  });
  const membersText = (membersRes.content as Array<{ type: string; text: string }>)[0]?.text;
  console.log("get_members:", membersText.slice(0, 150) + "...");
  const members = JSON.parse(membersText);
  if (!Array.isArray(members) || members.length === 0) {
    throw new Error("get_members returned empty or invalid list");
  }
  console.log(`✅ get_members passed (${members.length} members found)`);

  // 4. Test Live MCP Tool: list_workspaces
  console.log("\n--- Testing Live Tool: list_workspaces ---");
  const wsRes = await client.callTool({
    name: "list_workspaces",
    arguments: {},
  });
  const wsText = (wsRes.content as Array<{ type: string; text: string }>)[0]?.text;
  const workspaces = JSON.parse(wsText);
  if (!Array.isArray(workspaces) || workspaces.length === 0) {
    throw new Error("list_workspaces returned empty or invalid list");
  }
  const targetWs = workspaces[0];
  const targetWsId = targetWs.workspaceId || process.env.FUSEBASE_WORKSPACE_ID || "49b306wxd9oa7hyc";
  console.log(`✅ list_workspaces passed (Found ${workspaces.length} workspaces, using: ${targetWsId} / ${targetWs.title})`);

  // 5. Test Live MCP Tool: search_guides
  console.log("\n--- Testing Live Tool: search_guides ---");
  const guidesRes = await client.callTool({
    name: "search_guides",
    arguments: { query: "markdown" },
  });
  const guidesText = (guidesRes.content as Array<{ type: string; text: string }>)[0]?.text;
  console.log("search_guides result:", guidesText.slice(0, 150) + "...");
  if (!guidesText.toLowerCase().includes("markdown") && !guidesText.includes("[")) {
    throw new Error("search_guides unexpected result");
  }
  console.log("✅ search_guides passed");

  // 6. Test Live MCP Tool: get_guide
  console.log("\n--- Testing Live Tool: get_guide ---");
  const guideRes = await client.callTool({
    name: "get_guide",
    arguments: { guideId: "toggles" },
  });
  const guideContent = (guideRes.content as Array<{ type: string; text: string }>)[0]?.text;
  if (!guideContent || guideContent.length < 50) {
    throw new Error("get_guide returned empty content");
  }
  console.log(`✅ get_guide passed (${guideContent.length} chars retrieved)`);

  // 7. Test Page Lifecycle via MCP: create_page -> get_page_content -> delete_page
  console.log("\n--- Testing Page Lifecycle: create_page -> get_page_content -> delete_page ---");
  const createRes = await client.callTool({
    name: "create_page",
    arguments: {
      workspaceId: targetWsId,
      title: "Automated MCP E2E Test Note",
      markdown: "# E2E Test Header\n\nTesting page creation and Y.js content decoding through MCP.\n\n- Item Alpha\n- Item Beta\n\n> Testing quotes",
    },
  });
  const createText = (createRes.content as Array<{ type: string; text: string }>)[0]?.text;
  console.log("create_page result:", createText);
  const pageData = JSON.parse(createText);
  const pageId = pageData.id;
  if (!pageId) {
    throw new Error(`Failed to extract page ID from create_page: ${createText}`);
  }
  console.log(`✅ Page created with ID: ${pageId} (contentWritten: ${pageData.contentWritten})`);

  // Allow Y.js sync to settle
  await new Promise((r) => setTimeout(r, 2500));

  // Read page content back
  console.log("\nReading created page content back via get_page_content...");
  const readRes = await client.callTool({
    name: "get_page_content",
    arguments: {
      workspaceId: targetWsId,
      pageId: pageId,
    },
  });
  const htmlContent = (readRes.content as Array<{ type: string; text: string }>)[0]?.text || "";
  console.log("get_page_content decoded HTML:\n" + htmlContent);

  const checks = [
    ["H1 Header", htmlContent.includes("E2E Test Header")],
    ["Item Alpha", htmlContent.includes("Item Alpha")],
    ["Item Beta", htmlContent.includes("Item Beta")],
    ["Quote", htmlContent.includes("Testing quotes")],
  ];
  for (const [desc, ok] of checks) {
    if (!ok) throw new Error(`HTML verification check failed: ${desc}`);
    console.log(`  ✅ ${desc}`);
  }
  console.log("✅ get_page_content verified successfully");

  // Clean up: delete test page
  console.log("\nCleaning up test page via delete_page...");
  const deleteRes = await client.callTool({
    name: "delete_page",
    arguments: {
      workspaceId: targetWsId,
      pageId: pageId,
    },
  });
  const deleteText = (deleteRes.content as Array<{ type: string; text: string }>)[0]?.text;
  console.log("delete_page result:", deleteText);
  console.log("✅ Page cleaned up successfully");

  // Close MCP client
  await client.close();
  console.log("\n🎉 ALL MCP E2E TESTS PASSED SUCCESSFULLY!");
}

main().catch((err) => {
  console.error("❌ E2E Test failed:", err);
  process.exit(1);
});
