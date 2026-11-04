import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerMentionEntitiesTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Mention Entities ===

  registerAnnotatedTool(server,
    "get_mention_entities",
    "Get all mentionable entities (users, pages, folders) in a workspace for @-mention autocomplete. Includes member counts, workspace structure overview, and owner info. Useful for understanding workspace scope at a glance.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const entities = await client.getMentionEntities(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(entities, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
