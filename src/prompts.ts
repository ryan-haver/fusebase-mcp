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

  // ─── 6. Build Event Bridge ───
  server.prompt(
    "build-event-bridge",
    "Design a bi-directional event bridge connecting external services (Stripe, GitHub, Firecrawl, n8n) with FuseBase.",
    {
      sourceService: z.string().describe("Source service sending events (e.g. Stripe, GitHub, Firecrawl, Asana, Hubspot)"),
      targetEntity: z.string().describe("Target FuseBase entity to update (e.g. database, kanban board, workspace page, client portal)"),
      eventType: z.string().optional().describe("Type of event (e.g. payment_succeeded, pull_request_opened, scrape_completed)"),
    },
    async ({ sourceService, targetEntity, eventType }) => {
      const eventText = eventType ? `\n- **Event Type**: ${eventType}` : "";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please design an event-driven integration bridge between **${sourceService}** and FuseBase **${targetEntity}**.${eventText}

Provide:
1. **Webhook Ingestion**: Webhook payload structure from ${sourceService}, signature verification, and field mapping.
2. **FuseBase Mutation**: Exact MCP tool calls ('add_database_row', 'update_database_cell', 'append_page_content', or 'trigger_automation_flow') to persist incoming event state.
3. **Living Audit Log**: Format a timestamped event entry formatted for FuseBase rich text or database row updates.
4. **Resilience & Idempotency**: Deduplication keys, retry backoff, and failure alerts via ActivePieces or FuseBase Work connectors.`,
            },
          },
        ],
      };
    },
  );

  // ─── 7. Orchestrate Multi-Agent Swarm ───
  server.prompt(
    "orchestrate-multi-agent-swarm",
    "Decompose a complex project into a multi-agent swarm coordinated via a shared FuseBase Kanban state machine.",
    {
      objective: z.string().describe("High-level project objective or feature to build"),
      availableRoles: z.string().optional().describe("Comma-separated list of agent roles (default: agent-pm, agent-architect, agent-dev, agent-qa)"),
    },
    async ({ objective, availableRoles }) => {
      const rolesText = availableRoles
        ? `\n- **Participating Roles**: ${availableRoles}`
        : "\n- **Participating Roles**: agent-pm, agent-architect, agent-dev, agent-qa, agent-devops";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please decompose the following objective into a coordinated multi-agent swarm plan in FuseBase: "${objective}".${rolesText}

Provide:
1. **Task Decomposition Matrix**:
   - Title & Stage (Backlog, In Progress, Review, Done)
   - Owner Role & Next Role handoff
   - Input Prerequisites & Output Deliverables
   - Acceptance Criteria & Verification Commands
2. **Swarm State Machine Setup**:
   - How to initialize the board via 'fusebase_swarm_init'
   - How agents claim and advance tasks using 'fusebase_swarm_task_transition'
3. **Session Profile Ergonomics**:
   - Switching active profiles dynamically via 'switch_active_profile'
   - Documenting handoffs and audit entries in living FuseBase pages.`,
            },
          },
        ],
      };
    },
  );

  // ─── 8. Launch Client Portal ───
  server.prompt(
    "launch-client-portal",
    "Architect and deploy a branded external Client Portal in FuseBase with navigation, pages, and client invitations.",
    {
      portalName: z.string().describe("Name/title of the client portal"),
      clientCompany: z.string().describe("Client company name or account domain"),
      workspaceId: z.string().describe("Workspace ID containing source pages to publish"),
      customDomain: z.string().optional().describe("Optional custom domain (e.g. portal.client.com)"),
    },
    async ({ portalName, clientCompany, workspaceId, customDomain }) => {
      const client = getClient();
      let workspacePages: Array<{ id: string; title: string }> = [];
      try {
        const pages = await client.listPages(workspaceId, { limit: 15 });
        if (Array.isArray(pages)) {
          workspacePages = pages.map((p: any) => ({ id: p.id, title: p.title || "Untitled" }));
        }
      } catch {
        // non-blocking
      }

      const pagesContext = workspacePages.length > 0
        ? `\nAvailable workspace pages candidate for publication:\n${workspacePages.map((p) => `- "${p.title}" (ID: ${p.id})`).join("\n")}`
        : "";
      const domainText = customDomain ? `\n- **Custom Domain**: ${customDomain}` : "";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please plan and architect a complete external Client Portal in FuseBase for: "${portalName}" (Client: ${clientCompany}).
- **Source Workspace**: ${workspaceId}${domainText}${pagesContext}

Provide:
1. **Portal Branding & Structure**:
   - Subdomain naming recommendation and theme customization ('get_portal_theme')
   - Navigation menu taxonomy (sidebar tree, top navigation, footer links via 'get_portal_navigation_menu')
2. **Page Publication Matrix**:
   - Recommend which pages to publish using 'publish_page_to_portal' (e.g., Welcome Hub, Project Roadmap, Deliverables, Invoices/Contracts)
   - Layout recommendations for client-facing content (embedding full-width app widgets or view-only reports)
3. **Client Access & Magic Link Onboarding**:
   - Access control configuration and client invitations ('invite_portal_client')
   - How to generate 24h passwordless client access links via 'create_portal_magic_link'
4. **Step-by-Step Deployment Runbook**:
   - Sequence of exact MCP tool calls ('create_portal', 'publish_page_to_portal', 'invite_portal_client', 'create_portal_magic_link') to launch the portal.`,
            },
          },
        ],
      };
    },
  );

  // ─── 9. Workspace Activity Digest ───
  server.prompt(
    "workspace-activity-digest",
    "Generate a comprehensive executive activity digest of recent changes, completed tasks, and active discussions in a workspace.",
    {
      workspaceId: z.string().describe("Workspace ID to analyze"),
      timeWindow: z.string().optional().describe("Reporting timeframe (e.g. 'Last 7 days', 'Today', 'Sprint 3')"),
    },
    async ({ workspaceId, timeWindow }) => {
      const client = getClient();
      let activitySnippet = "";
      let taskSummarySnippet = "";
      let recentPagesSnippet = "";

      try {
        const [activity, taskSummary, recentPages] = await Promise.allSettled([
          client.getActivityStream(workspaceId),
          client.getTasksWorkspaceSummary(),
          client.getRecentPages(workspaceId, 10),
        ]);

        if (activity.status === "fulfilled" && activity.value) {
          activitySnippet = `\nRecent Activity Stream Entries:\n${JSON.stringify(activity.value, null, 2).slice(0, 1500)}`;
        }
        if (taskSummary.status === "fulfilled" && taskSummary.value) {
          taskSummarySnippet = `\nTask Summary:\n${JSON.stringify(taskSummary.value, null, 2).slice(0, 1000)}`;
        }
        if (recentPages.status === "fulfilled" && Array.isArray(recentPages.value)) {
          recentPagesSnippet = `\nRecently Updated Pages:\n${recentPages.value.map((p: any) => `- "${p.title}" (${p.id})`).join("\n")}`;
        }
      } catch {
        // non-blocking
      }

      const windowText = timeWindow ? ` (${timeWindow})` : "";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please generate an Executive Activity Digest for FuseBase Workspace '${workspaceId}'${windowText}.
${recentPagesSnippet}${taskSummarySnippet}${activitySnippet}

Please synthesize:
1. **Executive Pulse & Velocity**: High-level summary of what the team accomplished during this period.
2. **Key Content Updates**: Significant changes made to living pages and project notes.
3. **Task & Milestone Progress**: Completed deliverables, ongoing items, and time tracking breakdown.
4. **Discussion & Mention Highlights**: Active threads or blocker mentions requiring stakeholder attention.
5. **Priorities for Next Cycle**: 3-5 high-leverage focus areas based on recent momentum.`,
            },
          },
        ],
      };
    },
  );

  // ─── 10. Audit Page Governance ───
  server.prompt(
    "audit-page-governance",
    "Audit an existing FuseBase page for formatting quality, heading hierarchy, stale action items, broken links, and tag alignment.",
    {
      workspaceId: z.string().describe("Workspace ID containing the page"),
      pageId: z.string().describe("Page ID to audit"),
    },
    async ({ workspaceId, pageId }) => {
      const client = getClient();
      let pageContent = "";
      let workspaceTags: string[] = [];

      try {
        const [content, tags] = await Promise.allSettled([
          client.getPageContent(workspaceId, pageId),
          client.getTags(workspaceId),
        ]);

        if (content.status === "fulfilled") {
          pageContent = content.value;
        }
        if (tags.status === "fulfilled" && Array.isArray(tags.value)) {
          workspaceTags = tags.value.map((t: any) => t.title || t.name || String(t));
        }
      } catch (err) {
        pageContent = `(Failed to fetch page: ${err instanceof Error ? err.message : err})`;
      }

      const tagsContext = workspaceTags.length > 0
        ? `\nAvailable Workspace Tags:\n${workspaceTags.join(", ")}`
        : "";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please perform a thorough Page Governance & Quality Audit on FuseBase page '${pageId}' in workspace '${workspaceId}'.
${tagsContext}

Page Content:
---
${pageContent.slice(0, 6000)}
---

Evaluate and provide:
1. **Typography & Structure Score (1-10)**: Assess heading hierarchy (H1 -> H2 -> H3), paragraph density, and use of callouts/blockquotes.
2. **Action Item & Freshness Check**: Identify incomplete task checkboxes (\`- [ ]\`), unassigned deliverables, or stale date references.
3. **Tagging & Metadata Alignment**: Recommend relevant tags to attach using 'update_page_tags'.
4. **Broken Link & Attachment Diagnostics**: Flag any vague external links or missing references.
5. **Concrete Revision Plan**: Provide specific markdown edits or block additions to execute via 'append_page_content' or 'update_page_content' to elevate the document to publication grade.`,
            },
          },
        ],
      };
    },
  );

  // ─── 11. Build Relational Database ───
  server.prompt(
    "build-relational-database",
    "Architect a multi-table relational schema with bidirectional relations, lookup rollups, and specialized views in FuseBase.",
    {
      databaseTitle: z.string().describe("Title of the database/system (e.g. 'CRM & Client Pipeline', 'Game Mechanics Engine')"),
      primaryEntity: z.string().describe("Name of the primary entity/table (e.g. 'Accounts', 'Characters', 'Projects')"),
      relatedEntity: z.string().describe("Name of the linked entity/table (e.g. 'Contacts', 'Spells', 'Tasks')"),
      relationType: z.string().optional().describe("Relation cardinality: 'one-to-many' or 'many-to-many' (default: 'one-to-many')"),
    },
    async ({ databaseTitle, primaryEntity, relatedEntity, relationType }) => {
      const cardinality = relationType || "one-to-many";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please design a multi-table relational database architecture in FuseBase for: "${databaseTitle}".
- **Primary Entity**: ${primaryEntity}
- **Related Entity**: ${relatedEntity}
- **Cardinality**: ${cardinality}

Provide:
1. **Schema Design**:
   - Column types for **${primaryEntity}** (Title, Select, Member, Date, Number, etc.)
   - Column types for **${relatedEntity}**
2. **Relational Link & Lookups**:
   - Foreign relation definition connecting ${primaryEntity} to ${relatedEntity} ('add_relation_column')
   - Calculated / lookup rollup columns to expose across tables ('add_lookup_column')
3. **Multi-View Representation Architecture**:
   - Default Grid / Table view for raw data entry
   - Kanban board view grouped by status single-select column ('set_view_representation', 'set_view_grouping')
   - Calendar or Timeline view for deadline tracking
4. **Deployment Tool Call Sequence**:
   - Sequence of tool calls ('create_database', 'create_dashboard_table', 'add_database_column', 'add_relation_column', 'add_lookup_column', 'add_database_row') with concrete arguments to provision the entire relational system.`,
            },
          },
        ],
      };
    },
  );

  // ─── 12. Import Knowledge Base ───
  server.prompt(
    "import-knowledge-base",
    "Plan and execute a structured migration of docs, Notion workspaces, Confluence spaces, or CSV datasets into FuseBase.",
    {
      sourceType: z.string().describe("Source system (e.g. 'Notion Export', 'Confluence Space', 'Markdown Directory', 'CSV Datasets')"),
      targetWorkspaceId: z.string().describe("Target FuseBase workspace ID to receive imported content"),
      structureSummary: z.string().describe("Summary of documents, hierarchy, or dataset schema to import"),
    },
    async ({ sourceType, targetWorkspaceId, structureSummary }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please plan an automated migration into FuseBase Workspace '${targetWorkspaceId}' from source: "${sourceType}".

Source Overview:
${structureSummary}

Provide:
1. **Folder & Page Taxonomy**:
   - Map source hierarchy into FuseBase folders ('create_folder') and parent-child page trees ('create_page' with 'folderId'/'parentId').
2. **Block Format Translation**:
   - Translation rules for converting source-specific widgets (callouts, toggles, code blocks, quote blocks) into FuseBase-compatible Markdown.
3. **Tabular Data & CSV Ingestion**:
   - How to ingest spreadsheet/database exports into FuseBase databases via 'import_csv' or 'create_database'.
4. **Execution Runbook & Validation**:
   - Batching strategy to avoid rate limits (200ms throttle).
   - Post-migration validation checklist using 'get_page_content' and 'search_tasks' to ensure 100% data fidelity.`,
            },
          },
        ],
      };
    },
  );

  // ─── 13. Configure AI Persona ───
  server.prompt(
    "configure-ai-persona",
    "Design specialized AI assistant personas, system prompts, and interactive prompt suggestion chips for FuseBase.",
    {
      personaName: z.string().describe("Name of the persona (e.g., 'Staff Architect', 'Legal Compliance Reviewer', 'Product Manager')"),
      specialization: z.string().describe("Domain expertise, tone of voice, operational boundaries, and formatting preferences"),
      targetAudience: z.string().optional().describe("Primary audience (e.g., 'Engineering Team', 'External Clients', 'Executive Board')"),
      workspaceId: z.string().optional().describe("Optional workspace ID to inspect existing AI assistant state"),
    },
    async ({ personaName, specialization, targetAudience, workspaceId }) => {
      const client = getClient();
      let assistantStateSnippet = "";
      if (workspaceId) {
        try {
          const state = await client.getAiAssistantState(workspaceId);
          if (state) {
            assistantStateSnippet = `\nCurrent AI Assistant Configuration:\n${JSON.stringify(state, null, 2).slice(0, 1000)}`;
          }
        } catch {
          // non-blocking
        }
      }

      const audienceText = targetAudience ? `\n- **Target Audience**: ${targetAudience}` : "";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please design a specialized AI Agent Persona in FuseBase for: "${personaName}".
- **Specialization & Guardrails**: ${specialization}${audienceText}${assistantStateSnippet}

Provide:
1. **System Prompt / Persona Charter**:
   - Core identity, communication style, technical depth, and strict negative constraints.
2. **Interactive Prompt Suggestion Chips**:
   - 4-5 quick-action prompts tailored for this persona's daily workflow (formatted for FuseBase assistant suggestion state).
3. **Starter Seed Threads**:
   - 2-3 high-impact conversation starters to initialize via 'list_ai_agent_threads'.
4. **Autonomous Tool Matrix**:
   - Specific FuseBase MCP tools this persona is authorized to call autonomously (e.g. read-only auditing vs mutating pages/tasks).`,
            },
          },
        ],
      };
    },
  );

  // ─── 14. CRM Seed Demo Data (Flow Recipe) ───
  server.prompt(
    "crm-seed-demo-data",
    "Guide the AI assistant in seeding a complete demo CRM (Companies, Deals, Contacts) using canonical batchPutDashboardData and row relation linking.",
    {
      industry: z.string().optional().describe("Industry or business domain (e.g., 'B2B SaaS', 'Healthcare IT', 'Cybersecurity')"),
      companyCount: z.number().optional().describe("Number of demo companies to create (default 3)"),
      dealsPerCompany: z.number().optional().describe("Number of deals per company (default 2)"),
    },
    async ({ industry, companyCount = 3, dealsPerCompany = 2 }) => {
      const ind = industry || "B2B Technology";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please plan and execute seeding demo CRM data for a ${ind} business in FuseBase.

Follow the FuseBase Flow CRM seeding recipe:
1. **Alias Resolution**:
   - Call 'resolve_database_alias' for 'companies_db' and 'deals_db'.
   - Note the dashboard IDs and primary view IDs (e.g. 'deals_pipeline' for Kanban or 'deals_all' for table).
2. **Schema & Key Discovery**:
   - Call 'get_database_schema' for both tables to map friendly column names to opaque item_keys (e.g. 'Company Name', 'ARR', 'Deal Name', 'Deal Stage', 'Value').
   - Note the nanoid label IDs for the 'Deal Stage' single-select column.
3. **Batch Creation of Companies**:
   - Use 'batch_put_database_data' with 'create_new_row: true' to insert ${companyCount} realistic demo companies.
4. **Batch Creation of Deals**:
   - Use 'batch_put_database_data' with 'create_new_row: true' to insert ${companyCount * dealsPerCompany} deals with realistic stages and values.
5. **Bidirectional Relation Linking**:
   - Call 'list_database_relations' to find the relation linking Companies and Deals.
   - Call 'link_database_rows' to associate each deal to its parent company.
6. **Verification**:
   - Call 'get_database_rows' with 'resolveNames: true' to verify that companies show their linked deals and populated fields.`,
            },
          },
        ],
      };
    },
  );

  // ─── 15. Portal-Embedded App Architecture ───
  server.prompt(
    "portal-embedded-app",
    "Guide the AI assistant in architecting and developing an app embedded in a FuseBase Client Portal with {{CurrentPortal}} dynamic view filters.",
    {
      appName: z.string().describe("Name and purpose of the embedded portal app"),
      portalDomain: z.string().optional().describe("Target portal domain or slug (e.g. 'acme-portal')"),
      features: z.string().optional().describe("Key capabilities of the portal app (e.g., 'Ticket submission', 'Document requests', 'Approval status')"),
    },
    async ({ appName, portalDomain, features }) => {
      const featText = features ? `\n- **Features**: ${features}` : "";
      const domainText = portalDomain ? `\n- **Target Portal**: ${portalDomain}` : "";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please design and architect a portal-embedded application for: "${appName}".${domainText}${featText}

Follow FuseBase portal app runtime conventions:
1. **Dynamic Scoping via {{CurrentPortal}}**:
   - Do NOT require a hardcoded portal ID parameter.
   - Configure table views with a dynamic filter where 'Portal == {{CurrentPortal}}'. The FuseBase proxy automatically injects the active portal context.
2. **Runtime Context Detection**:
   - In frontend code, use '/auth/context' to check 'runtimeContext.portalId'.
   - If present, render the portal-customized view; if absent, render an administrative or preview mode.
3. **Data Mutation Isolation**:
   - When creating rows via 'batch_put_database_data' or 'add_database_row', populate the portal column with 'runtimeContext.portalId'.
4. **Embedding in Portal Pages**:
   - Use 'get_portal' and 'get_portal_pages' to identify target publication pages.
   - Use 'publish_page_to_portal' to make the container note visible to external portal guests.`,
            },
          },
        ],
      };
    },
  );

  // ─── 16. Fullstack Hosted App with Sidecars ───
  server.prompt(
    "fullstack-app-architecture",
    "Architect a fullstack FuseBase hosted application with Node.js backend, Docker sidecars (Chromium/Redis), App Secrets, and PostgreSQL Gate.",
    {
      appName: z.string().describe("Name of the fullstack application"),
      sidecars: z.string().optional().describe("Auxiliary services needed (e.g. 'headless-browser', 'redis-cache', 'image-processor')"),
      needsDatabase: z.boolean().optional().describe("Whether the app requires an isolated PostgreSQL database (default true)"),
    },
    async ({ appName, sidecars, needsDatabase = true }) => {
      const sidecarText = sidecars ? `\n- **Sidecars Requested**: ${sidecars}` : "";
      const dbText = needsDatabase ? "\n- **Database**: FuseBase Gate Isolated PostgreSQL Store" : "";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please architect a full-stack FuseBase Web Application for: "${appName}".${sidecarText}${dbText}

Include a complete production architecture covering:
1. **Project Scaffold & fusebase.json**:
   - Declarative manifest structure (frontend 'apps/web' + backend 'apps/backend').
   - Dev, build, and start commands.
2. **Sidecar Container Configuration**:
   - Use 'fusebase_cli_sidecar_add' to specify Docker images (e.g. 'browserless/chrome:latest' port 9222, 'redis:7-alpine' port 6379).
   - Configure resource tiers ('small', 'medium', 'large') and secret whitelists.
3. **Secret Management**:
   - Outline required keys and register them using 'fusebase_cli_secret_create' (e.g. 'DB_PASSWORD', 'EXTERNAL_API_KEY').
4. **Data Layer (PostgreSQL Gate)**:
   - Use 'create_isolated_store' to provision an isolated Postgres database.
   - Prepare versioned DDL migrations using 'apply_isolated_sql_migrations'.
5. **Permissions & Deploy Gate**:
   - Configure dashboard view permissions using 'fusebase_cli_app_update'.
   - Deploy using 'fusebase_cli_deploy' and verify with 'fusebase_cli_logs'.`,
            },
          },
        ],
      };
    },
  );

  // ─── 17. Token & Context Waste Audit (Flow Practice) ───
  server.prompt(
    "token-waste-audit",
    "Audit agent session tool calls, data payloads, and context management for token efficiency based on FuseBase Flow standards.",
    {
      focusArea: z.enum(["general", "databases", "pages", "automations"]).optional().describe("Primary domain to audit (default 'general')"),
    },
    async ({ focusArea = "general" }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please conduct a Token & Context Efficiency Audit for this session (Focus: ${focusArea}).

Audit against the FuseBase Flow token economy rules:
1. **Tool Output Sizing**:
   - Are we using 'get_database_rows' with pagination ('limit: 20') and 'resolveNames: true', instead of reading thousands of unindexed raw cells?
   - Are we using 'get_page_content' with 'format: "markdown"' instead of massive raw HTML DOM dumps?
2. **Mutation Efficiency**:
   - Are we batching row creation/updates with 'batch_put_database_data', instead of firing 50 serial individual cell updates?
   - Are we appending content non-destructively via 'append_page_content' (Y.js WebSockets) rather than overwriting full document trees?
3. **Discovery Caching**:
   - Are we caching column mappings from 'get_database_schema' rather than repeatedly requesting schemas in every turn?
   - Are we using 'resolve_database_alias' to quickly resolve CRM tables?
4. **Liveness & Polling**:
   - Are we avoiding tight polling loops and relying on event triggers or bounded checks?

Provide a concise report with:
- Identified token-waste anti-patterns.
- Concrete tool-level optimizations.
- Estimated context window savings.`,
            },
          },
        ],
      };
    },
  );
}
