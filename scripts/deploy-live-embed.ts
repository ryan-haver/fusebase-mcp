import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";
import type { ContentBlock } from "../src/content-schema.js";

async function main() {
  console.log("=== Creating Live Embedded App Page in FuseBase ===");
  const loaded = loadEncryptedCookie();
  if (!loaded?.cookie) {
    throw new Error("No default cookie found");
  }

  const workspaceId = "49b306wxd9oa7hyc";
  const client = new FusebaseClient({
    host: "inkabeam.nimbusweb.me",
    orgId: "u268r1",
    cookie: loaded.cookie,
  });

  const appUrl = "https://client-hub-dash.thefusebase.app/";
  const pageTitle = "Client Hub & Delivery Dashboard (Live App)";

  // 1. Create page in workspace
  console.log(`Creating page "${pageTitle}"...`);
  const page = await client.createPage(workspaceId, pageTitle);
  const pageId = page.globalId;
  console.log("✅ Created page:", pageId);

  // 2. Build structured blocks with full-width iframe embed
  const blocks: ContentBlock[] = [
    {
      type: "heading",
      level: 1,
      text: "FuseBase Client Hub & Delivery Dashboard",
    },
    {
      type: "hint",
      text: "This live application is hosted on FuseBase Cloud (ai-dev.thefusebase.com) and embedded directly into this document using full-width responsive iframe settings.",
    },
    {
      type: "remote-frame",
      url: appUrl,
      allowOverWidth: true,
    },
    {
      type: "divider",
    },
    {
      type: "heading",
      level: 2,
      text: "App Specifications & Deployment Record",
    },
    {
      type: "list",
      listType: "bullet",
      items: [
        `App Subdomain: client-hub-dash`,
        `Production Hosting URL: ${appUrl}`,
        `FuseBase Product ID: 3levnl9diecglj2a`,
        `App ID: ptx2az8amwwfrtvb`,
        `Design System: Custom Vanilla Dark Mode CSS with Glassmorphism and Inter typography`,
        `Capabilities: Interactive Milestones, Real-time Velocity KPI, Client Request Submission`,
      ],
    },
  ];

  // 3. Write blocks via updatePageContent
  console.log("Writing blocks via Y.js collaborative WebSocket sync...");
  await client.updatePageContent(workspaceId, pageId, blocks);
  console.log("✅ Y.js content written successfully");

  // 4. Publish to Client Portal
  console.log("Publishing page to Client Portal (is_portal_share: true)...");
  await client.setPagePortalShare(workspaceId, pageId, true);
  console.log("✅ Page published to Client Portal!");

  const livePageUrl = `https://inkabeam.nimbusweb.me/space/${workspaceId}/page/${pageId}`;
  const portalUrl = `https://test-portal-88229977.p.nimbusweb.me`;

  console.log("\n========================================================");
  console.log("🚀 LIVE VIBE CODING APP DEPLOYMENT COMPLETE!");
  console.log(`• Hosted App URL:   ${appUrl}`);
  console.log(`• Live Page URL:     ${livePageUrl}`);
  console.log(`• Client Portal URL: ${portalUrl}`);
  console.log("========================================================\n");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
