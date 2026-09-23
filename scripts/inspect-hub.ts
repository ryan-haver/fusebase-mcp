/**
 * scripts/inspect-hub.ts
 *
 * Developer inspection utility for the FuseBase Client Hub & Portals.
 * Inspects active client portals, custom domains, access permissions,
 * injected custom code/scripts, and invited clients.
 *
 * Usage:
 *   npx tsx scripts/inspect-hub.ts [--profile=<profile>]
 */

import { FusebaseClient } from "../src/client.js";
import { loadEncryptedCookie } from "../src/crypto.js";

async function main() {
  const profileArg = process.argv.find((a) => a.startsWith("--profile="));
  const profile = profileArg ? profileArg.split("=")[1] : "default";

  console.log(`=== FuseBase Client Hub & Portal Inspector [Profile: ${profile}] ===\n`);

  const loaded = loadEncryptedCookie(profile === "default" ? undefined : profile);
  if (!loaded?.cookie) {
    console.error(`❌ No valid encrypted cookie found for profile "${profile}".`);
    console.error("   Run: npx tsx scripts/auth.ts to authenticate.");
    process.exit(1);
  }

  const client = new FusebaseClient({
    host: "inkabeam.nimbusweb.me",
    orgId: "u268r1",
    cookie: loaded.cookie,
  });

  // 1. Check Portal Feature Availability & Quota
  console.log("--- Checking Portal Availability ---");
  try {
    const avail = await (client as any).request("/v1/portals/orgs/u268r1/available");
    console.log(`✅ Portal feature available: ${avail}`);
  } catch (err: any) {
    console.log(`⚠️  Could not verify portal quota: ${err.message}`);
  }

  // 2. Query Workspaces
  console.log("\n--- Discovering Workspaces ---");
  let workspaces: any[] = [];
  try {
    workspaces = await client.listWorkspaces();
    console.log(`✅ Found ${workspaces.length} workspace(s):`);
    for (const ws of workspaces) {
      console.log(`   - [${ws.workspaceId}] "${ws.title}" (Org: ${ws.orgId})`);
    }
  } catch (err: any) {
    console.error(`❌ Failed to list workspaces: ${err.message}`);
  }

  // 3. Query All Client Portals
  console.log("\n--- Querying Client Portals ---");
  let portals: any[] = [];
  try {
    portals = await client.listPortals();
    console.log(`✅ Found ${portals.length} active portal(s):\n`);

    for (const p of portals) {
      console.log(`================================================================`);
      console.log(`Portal ID:      ${p.id} (Global: ${p.globalId})`);
      console.log(`Workspace ID:   ${p.workspaceId}`);
      console.log(`Name:           ${p.settings?.name || "(Unnamed)"}`);
      console.log(`Domain:         https://${p.domain}`);
      console.log(`CNAME Value:    ${p.cnameValue || "None"}`);
      console.log(`CNAME Status:   ${p.cnameStatus || "N/A"}`);
      console.log(`Status:         ${p.status}`);
      console.log(`Created At:     ${new Date(p.createdAt * 1000).toLocaleString()}`);
      console.log(`Last Published: ${new Date(p.lastPublishedAt * 1000).toLocaleString()}`);
      console.log(`Language:       ${p.settings?.language || "en"}`);
      console.log(`Greeting:       "${p.settings?.greetingMessage || ""}"`);
      console.log(`Branding Off:   ${p.settings?.disableBranding ? "Yes (Whitelabeled)" : "No"}`);
      console.log(`AI Assistant:   ${p.settings?.aiAssistantSettings?.availability?.anyone ? "Public" : p.settings?.aiAssistantSettings?.availability?.loggedIn ? "Logged-in Only" : "Disabled"}`);
      
      // Access Matrix
      if (p.settings?.access?.portal) {
        const acc = p.settings.access.portal;
        console.log(`Access Rules:   Anyone: ${acc.anyone}, Clients: ${acc.clients}, Guests: ${acc.guests}, Members: ${acc.members}, Require Email: ${acc.requireClientEmail}`);
      }

      // Custom Injected Scripts
      if (p.settings?.customCode) {
        console.log(`\nCustom Script (${p.settings.customCode.length} chars):`);
        const snippet = p.settings.customCode.split("\n").slice(0, 5).join("\n");
        console.log(`   ${snippet}...`);
      }
      console.log(`================================================================\n`);
    }
  } catch (err: any) {
    console.error(`❌ Failed to list portals: ${err.message}`);
  }

  // 4. Query Portal Clients
  console.log("--- Querying Portal Clients ---");
  try {
    const clients: any = await client.listPortalClients();
    if (Array.isArray(clients)) {
      console.log(`✅ Found ${clients.length} portal client(s):`);
      for (const c of clients) {
        console.log(`   - ${c.name || c.email || c.id} (Role: ${c.role || c.userRole || "client"})`);
      }
    } else {
      console.log(`✅ Portal clients response:`, clients);
    }
  } catch (err: any) {
    console.log(`⚠️  Could not retrieve clients: ${err.message}`);
  }

  console.log("\n=== Inspection Complete ===");
}

main().catch(console.error);
