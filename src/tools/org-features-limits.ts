import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerOrgFeaturesLimitsTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Org Features & Limits ===

  registerAnnotatedTool(server,
    "get_org_limits",
    "Get the organization's plan limits including maximum members, storage, traffic, AI credits, workspaces, and other quotas. Use alongside get_org_usage or get_usage_summary to compare current consumption against plan caps.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const limits = await client.getOrgLimits();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(limits, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_usage_summary",
    "Get a condensed snapshot of organization usage vs limits — lighter than get_org_usage. Returns current/max for overall usage, storage, and blots in a single response.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const summary = await client.getUsageSummary();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(summary, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
