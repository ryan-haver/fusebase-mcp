/**
 * scripts/deploy-workspace-page.ts
 *
 * Deploys/embeds the live FuseBase MCP Status Dashboard into any FuseBase workspace
 * chosen by the user as an edge-to-edge interactive note.
 *
 * Workspace Selection Precedence:
 * 1. CLI flag: --workspace=<id|name>
 * 2. Environment variable: FUSEBASE_WORKSPACE_ID
 * 3. Auto-discovery: Workspace named "FuseBase MCP" or "Agent Projects"
 * 4. Fallback: First available workspace
 *
 * Usage:
 *   npx tsx scripts/deploy-workspace-page.ts [--workspace=<id|name>]
 *   npm run deploy:page
 */

import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import { writeContentViaWebSocket } from "../src/yjs-ws-writer.js";
import type { ContentBlock } from "../src/content-schema.js";

async function main() {
  console.log("\n================================================================================");
  console.log("📌 FUSEBASE MCP: EMBED STATUS DASHBOARD INTO WORKSPACE");
  console.log("================================================================================\n");

  const loaded = loadEncryptedCookie();
  if (!loaded?.cookie) {
    console.error("❌ Authentication required. Run: npx tsx scripts/auth.ts");
    process.exit(1);
  }

  const client = new FusebaseClient({
    host: "inkabeam.nimbusweb.me",
    orgId: "u268r1",
    cookie: loaded.cookie,
  });

  // 1. Discover workspaces
  console.log("[1/3] Querying accessible workspaces in organization...");
  const workspaces = await client.listWorkspaces();
  console.log(`Found ${workspaces.length} workspace(s):`);
  workspaces.forEach((w: any) => {
    console.log(`  • [${w.workspaceId}] "${w.title}"`);
  });

  // 2. Resolve target workspace
  const wsArg = process.argv.find((a) => a.startsWith("--workspace="))?.split("=")[1];
  const envWs = process.env.FUSEBASE_WORKSPACE_ID;
  const targetSpec = wsArg || envWs;

  let targetWs = workspaces[0];

  if (targetSpec) {
    const found = workspaces.find(
      (w: any) =>
        w.workspaceId.toLowerCase() === targetSpec.toLowerCase() ||
        w.title.toLowerCase() === targetSpec.toLowerCase() ||
        w.title.toLowerCase().includes(targetSpec.toLowerCase())
    );
    if (found) {
      targetWs = found;
      console.log(`\n🎯 Matched target workspace from '${targetSpec}': "${targetWs.title}" (${targetWs.workspaceId})`);
    } else {
      console.warn(`\n⚠️ Workspace '${targetSpec}' not found. Falling back to default.`);
    }
  } else {
    // Prefer dedicated workspace if available
    const dedicated = workspaces.find(
      (w: any) =>
        w.title.toLowerCase().includes("mcp") ||
        w.title.toLowerCase().includes("agent")
    );
    if (dedicated) {
      targetWs = dedicated;
      console.log(`\n🎯 Auto-selected dedicated project workspace: "${targetWs.title}" (${targetWs.workspaceId})`);
    } else {
      console.log(`\n🎯 Using workspace: "${targetWs.title}" (${targetWs.workspaceId})`);
    }
  }

  // 3. Create interactive app note in target workspace
  console.log(`\n[2/3] Creating live interactive dashboard note in workspace "${targetWs.title}"...`);
  const appUrl = "https://fusebase-mcp.thefusebase.app/";
  const pageTitle = "FuseBase MCP — Live Platform Status";

  const page = await client.createPage(targetWs.workspaceId, pageTitle);
  console.log(`   Page created: ID ${page.globalId}`);

  console.log(`\n[3/3] Embedding full-width remote frame via collaborative Y.js WebSocket...`);
  const blocks: ContentBlock[] = [
    {
      type: "paragraph",
      children: [
        {
          type: "text",
          text: "Live platform operations, real-time engineering metrics, test suite assertion results, and MCP tool catalog for the FuseBase Model Context Protocol server.",
        },
      ],
    },
    {
      type: "remote-frame",
      src: appUrl,
      allowOverWidth: true,
    },
  ];

  const writeRes = await writeContentViaWebSocket(
    client["host"],
    targetWs.workspaceId,
    page.globalId,
    client["cookie"],
    blocks,
    { replace: true }
  );

  if (!writeRes.success) {
    console.error(`❌ Failed to write embedded remote-frame: ${writeRes.error}`);
    process.exit(1);
  }

  const livePageUrl = `https://${client["host"]}/space/${targetWs.workspaceId}/page/${page.globalId}`;

  console.log("\n================================================================================");
  console.log("🎉 STATUS DASHBOARD SUCCESSFULLY EMBEDDED IN WORKSPACE!");
  console.log(`   Workspace: "${targetWs.title}" (${targetWs.workspaceId})`);
  console.log(`   Page Title: "${pageTitle}"`);
  console.log(`   Direct FuseBase URL: ${livePageUrl}`);
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
