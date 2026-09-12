/**
 * MCP Prompts for FuseBase
 *
 * Pre-engineered workflow prompt templates that guide AI assistants through common
 * workspace operations: SOP generation, document summaries, kanban project setup,
 * and workspace activity digests.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "./client.js";

export function registerPrompts(
  server: McpServer,
  getClient: (profile?: string) => FusebaseClient,
): void {
  // ─── 1. Create SOP (Standard Operating Procedure) ───
  server.prompt(
    "create-sop",
    "Generate a structured Standard Operating Procedure (SOP) tailored for FuseBase pages.",
    {
      title: z.string().describe("Title or topic of the SOP"),
      scope: z.string().optional().describe("Applicable department, team, or operational scope"),
      role: z.string().optional().describe("Primary role responsible for executing this procedure"),
    },
    async ({ title, scope, role }) => {
      const scopeText = scope ? `\n- **Scope**: ${scope}` : "";
      const roleText = role ? `\n- **Target Role**: ${role}` : "";

      const promptText = `Please write a comprehensive Standard Operating Procedure (SOP) in Markdown for: "${title}".
${scopeText}${roleText}

Include the following sections formatted nicely for FuseBase:
1. # ${title} (H1 Heading)
2. ## Purpose & Objectives (H2)
3. ## Scope & Responsibilities (H2)
4. ## Step-by-Step Procedure (H2 with numbered steps or step blocks)
5. ## Important Precautions & Edge Cases (H2 with > blockquotes or hint callouts)
6. ## Completion Checklist (H2 with - [ ] task checklist)

Once drafted, provide the structured content ready to be created using 'create_page'.`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: promptText,
            },
          },
        ],
      };
    },
  );

  // ─── 2. Summarize Page ───
  server.prompt(
    "summarize-page",
    "Fetch and generate an executive summary and action items for an existing FuseBase page.",
    {
      workspaceId: z.string().describe("Workspace ID containing the page"),
      pageId: z.string().describe("Note/Page ID to summarize"),
    },
    async ({ workspaceId, pageId }) => {
      const client = getClient();
      let pageText = "";
      try {
        pageText = await client.getPageContent(workspaceId, pageId);
      } catch (err) {
        pageText = `(Note content retrieval failed: ${err instanceof Error ? err.message : err})`;
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Here is the decoded content from FuseBase page '${pageId}' in workspace '${workspaceId}':

---
${pageText}
---

Please provide:
1. **Executive Summary** (2-3 concise paragraphs)
2. **Key Decisions & Takeaways** (bulleted list)
3. **Action Items & Next Steps** (with assignees or priority if mentioned in the text)
4. **Open Questions / Follow-ups**`,
            },
          },
        ],
      };
    },
  );

  // ─── 3. Build Kanban Project ───
  server.prompt(
    "build-kanban-project",
    "Design a kanban database workflow for a new project in FuseBase.",
    {
      projectName: z.string().describe("Project or workflow name"),
      stages: z
        .string()
        .optional()
        .describe("Comma-separated stages (default: Backlog, Todo, In Progress, In Review, Done)"),
    },
    async ({ projectName, stages }) => {
      const stageList = stages || "Backlog, Todo, In Progress, In Review, Done";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I want to set up a new Kanban project in FuseBase for: "${projectName}".

Desired stages/columns: ${stageList}.

Please plan the database architecture:
1. Recommend useful custom columns (e.g. Priority single-select, Assignee member, Due Date, Estimate hours).
2. Generate 4-5 realistic starter task cards with descriptions and initial column placements.
3. Outline the tool calls required ('create_database', 'set_view_representation', 'add_database_column', 'add_database_row') to deploy it.`,
            },
          },
        ],
      };
    },
  );
}
