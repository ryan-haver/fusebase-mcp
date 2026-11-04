import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerFusebaseWorkFirecrawlN8nIntegrationsTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === FuseBase Work, Firecrawl & n8n Integrations ===

  registerAnnotatedTool(server,
    "fusebase_work_run_agent",
    "Run a prompt with a FuseBase AI agent and wait for its completed streamed response. Creates a conversation or continues an existing thread. This uses the AI Assistant agent API, not the separate Paperclip execution API.",
    {
      workspaceId: z.string().describe("Workspace the agent conversation belongs to (required by the API)"),
      agentId: z.string().describe("FuseBase Work AI agent global ID"),
      prompt: z.string().describe("Task instructions or prompt for the agent"),
      threadId: z.string().optional().describe("Optional existing conversation thread ID to continue"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, agentId, prompt, threadId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.runAiAgentTask(agentId, prompt, { workspaceId, threadId });
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
    "fusebase_work_scrape_url",
    "Ask a configured FuseBase scraping/web-parser agent to extract a URL and wait for its completed response. Web fetching depends on the selected agent; this is not a direct Firecrawl API call. A completed response alone does not prove the URL was fetched.",
    {
      workspaceId: z.string().describe("Workspace the scraping agent's conversation belongs to (required by the API)"),
      url: z.string().url().describe("Target website URL to scrape"),
      agentId: z.string().optional().describe("Optional specific Firecrawl/scraper agent global ID"),
      formats: z.array(z.string()).optional().default(["markdown"]).describe("Desired output formats (default: ['markdown'])"),
      prompt: z.string().optional().describe("Optional extraction prompt or instructions (e.g. 'Extract pricing table and features')"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, url, agentId, formats, prompt, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.scrapeUrlViaFirecrawl(url, { workspaceId, agentId, formats, prompt });
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
    "fusebase_work_trigger_n8n",
    "Trigger a FuseBase Work flow through the ActivePieces automation bridge (legacy n8n tool name). Acceptance does not prove execution: check list_flow_runs and read the runId's status and outputs. Payload handling depends on the configured trigger.",
    {
      flowId: z.string().describe("Workflow flow ID or webhook ID"),
      payload: z.record(z.string(), z.unknown()).optional().default({}).describe("JSON payload to pass to the workflow"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ flowId, payload, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.triggerN8nFlow(flowId, payload);
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
