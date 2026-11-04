import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerOrgFeaturesTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Org Features ===

  registerAnnotatedTool(server,
    "get_org_features",
    "Get feature flags enabled for the organization. Each feature has an ID, name, and enabled status. Useful for checking what capabilities are available on the current plan.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const features = await client.getOrgFeatures();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(features, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
