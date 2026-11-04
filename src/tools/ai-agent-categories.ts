import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerAiAgentCategoriesTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === AI Agent Categories ===

  registerAnnotatedTool(server,
    "list_ai_agent_categories",
    "List all available AI agent categories defined in the organization (such as Sales, Support, Development, Content, etc.). Returns category names, descriptions, and global IDs.",
    {
      orgId: z.string().optional().describe("Optional organization ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ orgId, profile }) => {
      const client = getClient(profile);
      try {
        const categories = await client.listAiAgentCategories(orgId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(categories, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
