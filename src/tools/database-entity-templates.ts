import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerDatabaseEntityTemplatesTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Database Entity Templates ===

  registerAnnotatedTool(server,
    "get_database_entity_templates",
    "Get all master database and dashboard entity templates available in the organization (including All workspaces, All portals, All forms, Custom table, and All clients). Shows root_entity mappings and complete JSON schema definitions.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ profile }) => {
      const client = getClient(profile);
      try {
        const templates = await client.getDatabaseEntityTemplates();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(templates, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
