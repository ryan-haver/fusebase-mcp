import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerOrganizationTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Organization ===

  registerAnnotatedTool(server,
    "get_org_usage",
    "Get organization-wide usage statistics including storage, traffic, member counts, AI credits, and workspace quotas. Each metric shows current vs max values. Useful for monitoring plan limits and resource consumption.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const usage = await client.getOrgUsage();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(usage, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
