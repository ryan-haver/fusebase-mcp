import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerPortalClientsMagicLinksTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Portal Clients & Magic Links ===

  registerAnnotatedTool(server,
    "list_portal_clients",
    "List invited external clients and members with portal access across the organization or for a specific portal.",
    {
      portalId: z.string().optional().describe("Optional portal ID to filter clients"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ portalId, profile }) => {
      const client = getClient(profile);
      try {
        const clients = await client.listPortalClients(portalId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(clients, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "invite_portal_client",
    "Invite a client through Gate and return a portal magic link. Requires an explicit choice of full or shared-only access. Refuses to change an existing non-client organization role. Link creation does not confirm email delivery.",
    {
      portalId: z.string().describe("Portal ID to invite the client to"),
      email: z.string().describe("Client's email address"),
      name: z.string().optional().describe("Client's full name"),
      isFullAccess: z.boolean().describe("Explicit access choice: true for all portal pages, false for shared/public pages only"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ portalId, email, name, isFullAccess, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.invitePortalClient(portalId, email, name, { isFullAccess });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "create_portal_magic_link",
    "Generate a passwordless portal access link for an existing portal member. Requires Gate for membership verification and a session cookie for link creation. Does not confirm email delivery; use the returned expiry if present.",
    {
      portalId: z.string().describe("Portal ID"),
      email: z.string().describe("Client's email address"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ portalId, email, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.getPortalMagicLink(portalId, email);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
