import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";

async function main() {
  console.log("=== Testing Portal Lifecycle & Page Publishing ===");
  const loaded = loadEncryptedCookie();
  if (!loaded?.cookie) {
    throw new Error("No default cookie found");
  }

  const client = new FusebaseClient({
    host: "inkabeam.nimbusweb.me",
    orgId: "u268r1",
    cookie: loaded.cookie,
  });

  // 1. Check portal availability
  const isAvailable = await client.checkPortalAvailability();
  console.log("Portal Available:", isAvailable);
  if (!isAvailable) throw new Error("Portal feature should be available");

  // 2. Get portal by workspace ID
  const portal = await client.getPortal("49b306wxd9oa7hyc");
  console.log("Found Portal:", portal.id, portal.domain, portal.settings?.name);

  // 3. Test page publishing to portal
  console.log("Creating test page for portal publishing...");
  const page = await client.createPage("49b306wxd9oa7hyc", "Track 1 Portal Test Note");
  const pageId = page.globalId;
  console.log("Created page ID:", pageId);

  try {
    // Publish to portal
    console.log("Publishing page to portal (is_portal_share: true)...");
    await client.setPagePortalShare("49b306wxd9oa7hyc", pageId, true);
    console.log("✅ Page published to portal");

    // Unpublish from portal
    console.log("Unpublishing page from portal (is_portal_share: false)...");
    await client.setPagePortalShare("49b306wxd9oa7hyc", pageId, false);
    console.log("✅ Page unpublished from portal");
  } finally {
    // Clean up
    await client.deletePage("49b306wxd9oa7hyc", pageId);
    console.log("✅ Test page cleaned up");
  }

  console.log("\n🎉 TRACK 1 PORTAL VERIFICATION COMPLETE!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
