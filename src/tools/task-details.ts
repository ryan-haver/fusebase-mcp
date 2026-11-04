import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerTaskDetailsTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Task Details ===

  registerAnnotatedTool(server,
    "get_task_description",
    "Get the full rich-text description and detailed properties of a specific task. Use this when search_tasks provides insufficient detail. Returns the task's complete content including formatted description.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      taskId: z.string().describe("Task ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, taskId, profile }) => {
      const client = getClient(profile);
      try {
        const desc = await client.getTaskDescription(workspaceId, taskId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(desc, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
