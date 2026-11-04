import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerDiscoveredEndpointsTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Discovered Endpoints ===

  registerAnnotatedTool(server,
    "get_navigation_menu",
    "Get the full sidebar navigation tree showing all pages, folders, and their hierarchy across workspaces. Includes parent-child relationships, icons, and timestamps. Best way to get a complete structural overview of all content.",
    {
      workspaceId: z.string().optional().describe("Workspace ID (defaults to primary workspace)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const menu = await client.getNavigationMenu(workspaceId);
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
    "get_activity_stream",
    "Get the activity feed for a workspace showing recent comments, @mentions, and content changes. Includes user avatars and note references for each activity item. Useful for monitoring workspace activity and collaboration.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const activity = await client.getActivityStream(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(activity, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
