import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import type { FusebaseLabel } from "../types.js";
import { errorResult } from "./helpers.js";

export function registerLabelsTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Labels ===

  registerAnnotatedTool(server,
    "get_labels",
    "Get all labels (colored categories) defined in a workspace. Labels have titles, colors, and styles, and can be applied to tasks for visual organization. Returns label IDs usable in task creation.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const labels = await client.getLabels(workspaceId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                labels.map((l: FusebaseLabel) => ({
                  id: l.globalId,
                  title: l.title,
                  color: l.color,
                  style: l.style,
                })),
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
