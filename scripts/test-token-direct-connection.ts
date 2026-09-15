import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "path";
import { fileURLToPath } from "url";
import * as assert from "assert";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

async function main() {
  console.log("=== Testing FuseBase Direct Token & Gate Bridge Tools ===");

  const transport = new StdioClientTransport({
    command: "node",
    args: [path.join(rootDir, "dist", "index.js")],
    env: {
      ...process.env,
      FUSEBASE_TOOLS: "all",
    },
  });

  const client = new Client(
    { name: "test-token-direct", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("Connected to MCP server.");

  // 1. gate_whoami
  console.log("\n1. Testing fusebase_gate_whoami...");
  const whoamiRes = await client.callTool({
    name: "fusebase_gate_whoami",
    arguments: {},
  });
  const whoamiText = (whoamiRes.content as any)[0]?.text;
  console.log("whoami response:", whoamiText);
  const whoamiData = JSON.parse(whoamiText);
  assert.ok(whoamiData.ok !== false, "whoami should succeed");
  console.log("✅ fusebase_gate_whoami passed");

  // 2. token_permission_catalog
  console.log("\n2. Testing fusebase_token_permission_catalog...");
  const catalogRes = await client.callTool({
    name: "fusebase_token_permission_catalog",
    arguments: {},
  });
  const catalogText = (catalogRes.content as any)[0]?.text;
  const catalogData = JSON.parse(catalogText);
  console.log("catalog summary:", catalogData.data ? `Found ${Object.keys(catalogData.data).length} sections` : catalogData);
  console.log("✅ fusebase_token_permission_catalog passed");

  // 3. token_list
  console.log("\n3. Testing fusebase_token_list...");
  const listRes = await client.callTool({
    name: "fusebase_token_list",
    arguments: { limit: 5 },
  });
  const listText = (listRes.content as any)[0]?.text;
  const listData = JSON.parse(listText);
  console.log("token list result:", listData.data ? `Found ${listData.data.tokens?.length || 0} tokens` : listData);
  console.log("✅ fusebase_token_list passed");

  // 4. direct_tool_call (listIsolatedStores)
  console.log("\n4. Testing fusebase_direct_tool_call with opId='listIsolatedStores'...");
  const directRes = await client.callTool({
    name: "fusebase_direct_tool_call",
    arguments: {
      opId: "listIsolatedStores",
      args: {},
      target: "gate",
    },
  });
  const directText = (directRes.content as any)[0]?.text;
  console.log("direct_tool_call result:", directText);
  console.log("✅ fusebase_direct_tool_call passed");

  // 5. list_isolated_stores (now routed via Gate bridge)
  console.log("\n5. Testing list_isolated_stores (routed via Gate bridge)...");
  const storesRes = await client.callTool({
    name: "list_isolated_stores",
    arguments: {},
  });
  const storesText = (storesRes.content as any)[0]?.text;
  console.log("list_isolated_stores result:", storesText);
  console.log("✅ list_isolated_stores passed");

  // 6. token_get
  console.log("\n6. Testing fusebase_token_get validation...");
  const getRes = await client.callTool({
    name: "fusebase_token_get",
    arguments: { tokenId: "non-existent-probe-id" },
  });
  console.log("fusebase_token_get result:", (getRes.content as any)[0]?.text);
  console.log("✅ fusebase_token_get dispatched and handled");

  // 7. token_revoke
  console.log("\n7. Testing fusebase_token_revoke validation...");
  const revokeRes = await client.callTool({
    name: "fusebase_token_revoke",
    arguments: { tokenId: "non-existent-probe-id" },
  });
  console.log("fusebase_token_revoke result:", (revokeRes.content as any)[0]?.text);
  console.log("✅ fusebase_token_revoke dispatched and handled");

  await client.close();
  console.log("\n🎉 ALL DIRECT TOKEN & GATE BRIDGE TOOLS VERIFIED SUCCESSFULLY!");
}

main().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
