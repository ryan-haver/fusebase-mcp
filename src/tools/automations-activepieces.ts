import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerAutomationsActivepiecesTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Automations (ActivePieces) ===

  registerAnnotatedTool(server,
    "list_automation_flows",
    "List ActivePieces automation workflows configured in the FuseBase organization. Shows workflow IDs, names, status (enabled/disabled), and triggers.",
    {
      projectId: z.string().optional().describe("Optional automation project ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ projectId, profile }) => {
      const client = getClient(profile);
      try {
        const flows = await client.listAutomationFlows(projectId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(flows, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_automation_flow",
    "Get detailed configuration and step definitions of an ActivePieces automation workflow.",
    {
      flowId: z.string().describe("Automation Flow ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ flowId, profile }) => {
      const client = getClient(profile);
      try {
        const flow = await client.getAutomationFlow(flowId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(flow, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "list_flow_runs",
    "List ActivePieces execution history, or provide runId to read a specific run including step outputs. Trigger acceptance alone does not prove successful execution.",
    {
      projectId: z.string().optional().describe("Optional automation project ID"),
      limit: z.number().optional().describe("Max flow runs to return (default: 20)"),
      runId: z.string().optional().describe("Read this run's status and step outputs instead of listing runs"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ projectId, limit, runId, profile }) => {
      const client = getClient(profile);
      try {
        const runs = await client.listFlowRuns(projectId, limit ?? 20, runId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(runs, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "list_automation_pieces",
    "List available ActivePieces connectors, actions, and trigger pieces (e.g. piece-fusebase, piece-smtp, piece-webhook, piece-csv).",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ profile }) => {
      const client = getClient(profile);
      try {
        const pieces = await client.listAutomationPieces();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(pieces, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
