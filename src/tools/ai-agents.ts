import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerAiAgentsTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === AI Agents ===

  registerAnnotatedTool(server,
    "list_agents",
    "List all AI agents configured in the organization with their titles, descriptions, and types. AI agents are custom assistants created in Fusebase's AI features. Returns agent IDs and metadata.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const agents = await client.listAgents();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(agents, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_ai_assistant_state",
    "Get the workspace AI assistant state, prompt suggestions, assistant preferences, and recent chat threads.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const state = await client.getAiAssistantState(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(state, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "list_ai_agent_threads",
    "List active conversation threads and history for a specific AI agent in the organization.",
    {
      agentId: z.string().describe("AI Agent ID (numeric string, e.g. '39')"),
      orgId: z.string().optional().describe("Optional organization ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ agentId, orgId, profile }) => {
      const client = getClient(profile);
      try {
        const threads = await client.listAiAgentThreads(agentId, orgId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(threads, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_ai_agent_favorites",
    "Get favorited or bookmarked AI agents configured in the organization.",
    {
      orgId: z.string().optional().describe("Optional organization ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ orgId, profile }) => {
      const client = getClient(profile);
      try {
        const favs = await client.getAiAgentFavorites(orgId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(favs, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_agent_public_profile",
    "Get the public profile (title, description, avatar URL, workspace binding) for a specific AI agent model by its global ID.",
    {
      agentGlobalId: z.string().describe("AI Agent global ID (e.g. 'dqw8qrnynnk5v2bw' from list_agents)"),
      orgId: z.string().optional().describe("Optional organization ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ agentGlobalId, orgId, profile }) => {
      const client = getClient(profile);
      try {
        const publicProfile = await client.getAgentPublicProfile(agentGlobalId, orgId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(publicProfile, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
