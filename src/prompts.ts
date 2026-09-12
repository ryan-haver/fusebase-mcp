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

  // ─── 4. Design Automation Workflow ───
  server.prompt(
    "design-automation-workflow",
    "Design a trigger-and-action automation flow using FuseBase ActivePieces pieces and connectors.",
    {
      goal: z.string().describe("Goal of the automation (e.g., 'Notify team when high priority ticket created')"),
      triggerType: z.string().optional().describe("Trigger type: webhook, schedule, form_submission, or piece event"),
    },
    async ({ goal, triggerType }) => {
      const triggerText = triggerType ? `\n- **Preferred Trigger**: ${triggerType}` : "";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please design an ActivePieces automation workflow in FuseBase for the following goal: "${goal}".${triggerText}

Provide:
1. **Trigger Configuration**: The triggering event, required webhook/data schema, and validation rules.
2. **Action Steps**: Step-by-step execution path (e.g. piece-fusebase to update database/note, piece-smtp to send email notification, piece-text-helper to transform data).
3. **Error Handling & Fallbacks**: Edge cases, retry policies, and execution error reporting.
4. **Tool Deployment Plan**: Recommend the MCP tools ('create_automation_flow', 'update_automation_flow', 'list_automation_pieces') to execute and verify this automation.`,
            },
          },
        ],
      };
    },
  );

  // ─── 5. Build Hosted Web App ───
  server.prompt(
    "build-hosted-app",
    "Plan and architect a full-stack FuseBase Web App for local development and cloud hosting.",
    {
      appName: z.string().describe("Name of the web application"),
      appType: z.string().optional().describe("Type of app (e.g., dashboard, portal widget, CRM viewer, ticketing)"),
    },
    async ({ appName, appType }) => {
      const typeText = appType ? `\n- **Application Type**: ${appType}` : "";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I want to build a FuseBase Hosted Web App named "${appName}".${typeText}

Please outline the end-to-end architecture:
1. **Frontend UI Stack**: Vanilla CSS design system tokens, responsive layout, dark/light themes, and full-width embed compatibility.
2. **Backend & Data Storage**: FuseBase database API integration, state management, and cron jobs if applicable.
3. **CLI Lifecycle Commands**: Step-by-step CLI commands ('fusebase init', 'fusebase dev start', 'fusebase deploy') to build and host it.
4. **FuseBase Embedding**: How to embed the live deployed URL into a FuseBase page using 'create_interactive_app_page' with 'allowOverWidth: true'.`,
            },
          },
        ],
      };
    },
  );
}
