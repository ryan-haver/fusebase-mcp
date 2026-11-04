import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerPortalsTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Portals ===

  registerAnnotatedTool(server,
    "list_portals",
    "List client portals for the organization. Optionally filter by workspace. Client portals are shared, branded pages published externally for clients or stakeholders.",
    {
      workspaceId: z.string().optional().describe("Workspace ID to filter portals (optional)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const portals = await client.listPortals(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(portals, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_portal_pages",
    "Get pages published to a client portal. Returns the portal page tree for a given workspace, optionally filtered to a specific page. Use list_portals first to find active portals.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      noteId: z.string().optional().describe("Page/note ID to filter (optional)"),
      pageId: z.string().optional().describe("Page/note ID to filter (optional, alias for noteId)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, noteId, pageId, profile }) => {
      const client = getClient(profile);
      try {
        const effectiveNoteId = noteId || pageId;
        const pages = await client.getPortalPages(workspaceId, effectiveNoteId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(pages, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "create_portal",
    "Create a v2 client portal through Gate. Requires a Gate token, full domain, and a workspace with no existing portal. Client portals are external, branded spaces for published pages, widgets, and dashboards.",
    {
      workspaceId: z.string().describe("Workspace ID to associate the client portal with"),
      name: z.string().describe("Display name for the portal (e.g. 'Client Onboarding Hub')"),
      domain: z.string().min(1).describe("Full portal domain, e.g. client-name.p.nimbusweb.me"),
      theme: z.enum(["light_purple", "soft_light", "quite_green", "space_gray", "carbon", "oxford", "ultramarine", "milky_blue", "shades_of_green", "savvy_red", "light_orange", "light_blue", "lemon_drop"]).optional().describe("Portal color theme"),
      accessMode: z.enum(["open", "email", "invite-only", "email-verified"]).optional().describe("Initial portal access mode; omitted preserves the platform template default"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, name, domain, theme, accessMode, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.createPortal(workspaceId, name, domain, {
          ...(theme ? { theme } : {}), ...(accessMode ? { accessMode } : {}),
        });
        return {
          content: [
            { type: "text" as const, text: `Portal "${name}" created successfully:\n${JSON.stringify(result, null, 2)}` },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_portal",
    "Get detailed portal configuration, custom branding, access rules, greeting messages, and custom injected scripts for a portal.",
    {
      portalId: z.string().describe("Portal numeric ID, global ID (25-char alphanumeric), or workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ portalId, profile }) => {
      const client = getClient(profile);
      try {
        const portal = await client.getPortal(portalId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(portal, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "publish_page_to_portal",
    "Publish or unpublish an internal workspace page to the client portal by updating its is_portal_share flag.",
    {
      workspaceId: z.string().describe("Workspace ID containing the page"),
      pageId: z.string().describe("Page/note ID to publish or unpublish"),
      publish: z.boolean().describe("true to publish to the client portal, false to unpublish/hide"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, publish, profile }) => {
      const client = getClient(profile);
      try {
        await client.setPagePortalShare(workspaceId, pageId, publish);
        return {
          content: [
            {
              type: "text" as const,
              text: `Page ${pageId} has been ${publish ? "published to" : "unpublished from"} the client portal.`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "check_portal_availability",
    "Check whether the organization account has the client portal feature enabled and available.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const available = await client.checkPortalAvailability();
        return {
          content: [
            {
              type: "text" as const,
              text: `Client portal availability: ${available ? "ENABLED" : "DISABLED"}`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_portal_theme",
    "Get client portal UI visual theme, dark/light branding colors, hero greeting banner, search bar settings, and sidebar options.",
    {
      workspaceId: z.string().optional().describe("Workspace ID associated with the portal"),
      portalId: z.string().optional().describe("Portal ID or global ID"),
      portalDomain: z.string().optional().describe("Custom domain or subdomain of the portal"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, portalId, portalDomain, profile }) => {
      const client = getClient(profile);
      try {
        const theme = await client.getPortalTheme({ workspaceId, portalId, portalDomain });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(theme, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_portal_navigation_menu",
    "Get the complete hierarchical sidebar navigation tree and page entities published in a workspace's client portal.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const menu = await client.getPortalNavigationMenu(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(menu, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_workspace_portal",
    "Resolve the primary client portal object bound to a workspace (portal ID, global ID, domain, creation timestamp).",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const portal = await client.getWorkspacePortal(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(portal, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
