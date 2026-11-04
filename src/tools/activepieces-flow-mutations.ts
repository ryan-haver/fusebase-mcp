import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerActivepiecesFlowMutationsTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === ActivePieces Flow Mutations ===

  registerAnnotatedTool(server,
    "create_automation_flow",
    "Create a new ActivePieces workflow automation in FuseBase.",
    {
      displayName: z.string().describe("Display name for the automation flow"),
      folderId: z.string().optional().describe("Optional folder ID to organize the flow"),
      projectId: z.string().optional().describe("Optional project ID (if user has multiple projects)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ displayName, folderId, projectId, profile }) => {
      const client = getClient(profile);
      try {
        const flow = await client.createAutomationFlow(displayName, folderId, projectId);
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
    "update_automation_flow",
    "Update an ActivePieces workflow: rename, change status, configure its trigger/actions, or publish. Configuration uses the ActivePieces operation request object. Publishing can activate the flow's trigger.",
    {
      flowId: z.string().describe("ID of the flow to update"),
      type: z.enum(["CHANGE_STATUS", "CHANGE_NAME", "UPDATE_TRIGGER", "ADD_ACTION", "UPDATE_ACTION", "LOCK_AND_PUBLISH"]).describe("Update operation type"),
      status: z.enum(["ENABLED", "DISABLED"]).optional().describe("New status when type is CHANGE_STATUS"),
      displayName: z.string().optional().describe("New display name when type is CHANGE_NAME"),
      request: z.record(z.string(), z.unknown()).optional().describe("ActivePieces request object required for UPDATE_TRIGGER, ADD_ACTION, or UPDATE_ACTION; optional for LOCK_AND_PUBLISH"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ flowId, type, status, displayName, request, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.updateAutomationFlow(flowId, { type, status, displayName, request });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "delete_automation_flow",
    "[DESTRUCTIVE] Delete an ActivePieces workflow automation by flow ID.",
    {
      flowId: z.string().describe("ID of the flow to delete"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ flowId, profile }) => {
      const client = getClient(profile);
      try {
        await client.deleteAutomationFlow(flowId);
        // The API answers with an empty body; report the outcome explicitly.
        return {
          content: [
            { type: "text" as const, text: `Automation flow ${flowId} deleted successfully.` },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "trigger_automation_flow",
    "Submit a trigger request to an ActivePieces flow. Acceptance does not prove execution: check list_flow_runs and read the runId's status and outputs. Payload handling depends on the configured trigger; FuseBase Manual Run emits an empty event.",
    {
      flowId: z.string().describe("ID of the flow to trigger"),
      payload: z.record(z.string(), z.unknown()).optional().describe("Payload data to send to the flow trigger"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ flowId, payload = {}, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.triggerAutomationFlow(flowId, payload);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
