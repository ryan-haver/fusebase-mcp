import { publicErrorMessage } from "../error-redaction.js";
import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerMultiAgentSwarmOrchestrationTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Multi-Agent Swarm Orchestration ===

  registerAnnotatedTool(server,
    "fusebase_swarm_init",
    "Initialize a multi-agent swarm state machine database in FuseBase. Supports 'standard' 4-stage Kanban or 'flow' for FuseBase Flow's official 8-phase lifecycle (Specify -> Clarify -> Plan -> Decisions -> Tasks -> Verify Gate -> Implement -> Review & Deploy) with product-owner and ai-developer roles.",
    {
      title: z.string().describe("Title of the swarm project / database (e.g. 'FuseBase MVP Sprint Swarm')"),
      description: z.string().optional().describe("Objective and scope of the multi-agent sprint"),
      template: z.enum(["standard", "flow"]).optional().describe("Workflow template: 'flow' for FuseBase Flow 8-phase lifecycle or 'standard' for 4-stage Kanban (default 'standard')"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ title, description, template, profile }) => {
      const client = getClient(profile);
      const isFlow = template === "flow";
      // COR-17: track every artifact so a failure part-way reports what exists.
      const created: {
        databaseId?: string;
        dashboardId?: string;
        viewId?: string;
        statusColumnKey?: string;
        roleColumnKey?: string;
        auditColumnKey?: string;
        kanbanGroupedByStatus?: boolean;
      } = {};
      let step = "create database";
      try {
        const db = await client.createDatabase(title, {
          description: description || (isFlow ? `FuseBase Flow 8-Phase Swarm State Machine for ${title}` : `Multi-Agent Swarm State Machine for ${title}`),
          icon: isFlow ? "cpu" : "robot",
          color: isFlow ? "10B981" : "6366F1",
        });

        const dashboard = db?.data?.dashboards?.[0];
        const dashboardId = dashboard?.global_id;
        const viewId = dashboard?.views?.[0]?.global_id;
        created.databaseId = db?.data?.global_id;
        created.dashboardId = dashboardId;
        created.viewId = viewId;
        if (!dashboardId || !viewId) {
          throw new Error("createDatabase response did not include a dashboard and view id");
        }

        const availableRoles = isFlow
          ? ["product-owner", "ai-developer", "agent-architect", "agent-qa"]
          : [
              "agent-pm",
              "agent-architect",
              "agent-dev",
              "agent-qa",
              "agent-review",
              "agent-devops",
            ];

        const workflowStages = isFlow
          ? [
              "Specify",
              "Clarify",
              "Plan",
              "Decisions",
              "Tasks",
              "Verify Gate",
              "Implement",
              "Review & Deploy",
            ]
          : ["Backlog", "In Progress", "Review", "Done"];

        const palette = ["gray", "blue", "purple", "yellow", "orange", "pink", "red", "green"];
        const toLabels = (names: string[]) => names.map((name, i) => ({ name, color: palette[i % palette.length] }));
        const keyOf = (res: any, what: string): string => {
          const key = res?.column?.key;
          if (!key) throw new Error(`addDatabaseColumn returned no key for the ${what} column`);
          return key;
        };

        step = "create Status column";
        created.statusColumnKey = keyOf(
          await client.addDatabaseColumn(dashboardId, viewId, "Status", "label", {
            labels: toLabels(workflowStages),
            multiSelect: false,
            description: "Swarm workflow stage",
          }),
          "Status",
        );

        step = "create Role column";
        created.roleColumnKey = keyOf(
          await client.addDatabaseColumn(dashboardId, viewId, "Role", "label", {
            labels: toLabels(availableRoles),
            multiSelect: false,
            description: "Agent role assigned to the task",
          }),
          "Role",
        );

        step = "create Audit Log column";
        created.auditColumnKey = keyOf(
          await client.addDatabaseColumn(dashboardId, viewId, "Audit Log", "multiline", {
            description: "Transitions recorded by fusebase_swarm_task_transition",
          }),
          "Audit Log",
        );

        step = "switch view to kanban grouped by Status";
        await client.setViewGrouping(dashboardId, viewId, created.statusColumnKey, "kanban");
        created.kanbanGroupedByStatus = true;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  message: `Swarm Kanban Database "${title}" (${isFlow ? "FuseBase Flow 8-Phase" : "Standard"}) initialized with Status, Role and Audit Log columns and a kanban view grouped by Status.`,
                  databaseId: created.databaseId,
                  dashboardId,
                  viewId,
                  statusColumnKey: created.statusColumnKey,
                  roleColumnKey: created.roleColumnKey,
                  auditColumnKey: created.auditColumnKey,
                  template: isFlow ? "flow" : "standard",
                  availableRoles,
                  workflowStages,
                  instructions: isFlow
                    ? "FuseBase Flow 8-Phase Lifecycle: Product Owner manages Specify -> Clarify -> Plan -> Decisions -> Tasks -> Verify Gate. AI Developer executes task slices in isolated sessions, stopping at the verification gate, and deploys only upon approval."
                    : "Use 'add_database_row' to create tasks with role and acceptance criteria. Use 'fusebase_swarm_task_transition' to transition tasks across stages with audit comments.",
                  transitionArgs: { dashboardId, viewId, groupByColumnKey: created.statusColumnKey },
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        const msg = publicErrorMessage(error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: false,
                  error: `Swarm init failed at step "${step}": ${msg}`,
                  created,
                  note: Object.keys(created).length > 0
                    ? "The artifacts listed under 'created' exist and were not rolled back."
                    : "Nothing was created.",
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  registerAnnotatedTool(server,
    "fusebase_swarm_task_transition",
    "Transition a swarm task across lifecycle stages (e.g. Backlog -> In Progress -> Review -> Done, or Flow 8-phase stages). With auditColumnKey the audit comment is appended to the task's Audit Log; with roleColumnKey and nextRole the task is handed over by setting its Role.",
    {
      dashboardId: z.string().describe("Dashboard/Table ID of the swarm board"),
      viewId: z.string().describe("View ID of the swarm board"),
      rowId: z.string().describe("Row UUID of the task card to transition"),
      groupByColumnKey: z.string().describe("Column key of the status column (from get_database_schema)"),
      newStatus: z.string().describe("New status stage for the task (e.g. 'Backlog', 'In Progress', 'Review', 'Done', or Flow stages: 'Specify', 'Clarify', 'Plan', 'Decisions', 'Tasks', 'Verify Gate', 'Implement', 'Review & Deploy')"),
      comment: z.string().describe("Audit log / review comment explaining the work done or reason for transition"),
      nextRole: z.string().optional().describe("Next agent profile assigned to take over the task (e.g. 'ai-developer', 'agent-dev', 'agent-qa')"),
      auditColumnKey: z.string().optional().describe("Column key of the Audit Log column (from fusebase_swarm_init). When set, the transition is appended to the task's audit log."),
      roleColumnKey: z.string().optional().describe("Column key of the Role column (from fusebase_swarm_init). When set with nextRole, the task's Role becomes nextRole."),
      profile: z.string().optional().describe("Acting agent profile"),
    },
    async ({ dashboardId, viewId, rowId, groupByColumnKey, newStatus, comment, nextRole, auditColumnKey, roleColumnKey, profile }) => {
      const client = getClient(profile);
      try {
        const moveRes = await client.moveKanbanCard(
          dashboardId,
          viewId,
          rowId,
          groupByColumnKey,
          newStatus,
        );

        const auditEntry = {
          timestamp: new Date().toISOString(),
          actingProfile: profile || "default",
          newStatus,
          comment,
          handedOverTo: nextRole || null,
        };

        // Store the audit entry and the handover on the task's row when the columns are given;
        // otherwise say plainly that they were not stored.
        let auditStored = false;
        if (auditColumnKey) {
          const { rows } = await client.getDatabaseRows(dashboardId, viewId, { limit: 500 });
          const row = rows.find((r) => r.rowUuid === rowId);
          if (!row) throw new Error(`Task ${rowId} was moved to "${newStatus}", but the row wasn't found to record the audit entry`);
          const previous = typeof row.cells?.[auditColumnKey] === "string" ? (row.cells[auditColumnKey] as string) : "";
          const line = `[${auditEntry.timestamp}] ${auditEntry.actingProfile} → ${newStatus}: ${comment}${nextRole ? ` (handed over to ${nextRole})` : ""}`;
          await client.updateDatabaseCell(dashboardId, viewId, rowId, auditColumnKey, previous ? `${previous}\n${line}` : line);
          auditStored = true;
        }
        let handoverStored = false;
        if (nextRole && roleColumnKey) {
          await client.updateDatabaseCell(dashboardId, viewId, rowId, roleColumnKey, nextRole);
          handoverStored = true;
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  message: `Task ${rowId} moved to "${newStatus}".`,
                  audit: auditEntry,
                  auditStored,
                  handoverStored,
                  ...(!auditStored ? { note: "The audit entry was not stored: pass auditColumnKey (from fusebase_swarm_init) to record it on the task." } : {}),
                  moveResult: moveRes,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_dashboard_templates",
    "Get managed dashboard and view representation templates (e.g. Kanban, Table) used for database representations.",
    {
      orgId: z.string().optional().describe("Optional organization ID (defaults to current org)"),
      workspaceId: z.string().optional().describe("Optional workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ orgId, workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const templates = await client.getDashboardTemplates(orgId, workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(templates, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_member_roles",
    "List user ID to role mappings across the organization (e.g. member, admin).",
    {
      orgId: z.string().optional().describe("Optional organization ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ orgId, profile }) => {
      const client = getClient(profile);
      try {
        const roles = await client.getMemberRoles(orgId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(roles, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_workspace_members_v1",
    "Get granular v1 workspace member entities including globalId, addedByUserId, and creation/update timestamps.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const members = await client.getWorkspaceMembersV1(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(members, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_tasks_workspace_summary",
    "Get cross-workspace task overview and summary statistics across all accessible workspaces in the organization.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ profile }) => {
      const client = getClient(profile);
      try {
        const summary = await client.getTasksWorkspaceSummary();
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

  registerAnnotatedTool(server,
    "get_billing_info",
    "Inspect billing credit balance, active coupon code redemptions (e.g. AppSumo), and redeemed coupon token history.",
    {
      orgId: z.string().optional().describe("Optional organization ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ orgId, profile }) => {
      const client = getClient(profile);
      try {
        const billing = await client.getBillingInfo(orgId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(billing, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_user_preferences",
    "Retrieve user notification options (email and push triggers), web editor state variables, and last-opened workspaces.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ profile }) => {
      const client = getClient(profile);
      try {
        const prefs = await client.getUserPreferences();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(prefs, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "set_sidebar_collapsed",
    "Toggle or set the FuseBase web editor sidebar collapsed state.",
    {
      collapsed: z.boolean().describe("Whether the editor sidebar should be collapsed (true) or expanded (false)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ collapsed, profile }) => {
      const client = getClient(profile);
      try {
        const res = await client.setUserSidebarCollapsed(collapsed);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, collapsed, response: res }, null, 2),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_task_time_tracking",
    "Get time tracking estimates and recorded time history for a specific task in a workspace.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      taskId: z.string().describe("Task ID or global ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, taskId, profile }) => {
      const client = getClient(profile);
      try {
        const timeData = await client.getTaskTimeTracking(workspaceId, taskId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(timeData, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_automation_flags",
    "Get ActivePieces automation platform system configuration, version, edition (ce/ee), webhook prefix, and feature flags.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ profile }) => {
      const client = getClient(profile);
      try {
        const flags = await client.getAutomationFlags();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(flags, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_workspace_premium_status",
    "Inspect workspace subscription tier, status, and plan expiration date.",
    {
      workspaceId: z.string().optional().describe("Optional workspace ID (defaults to 'default')"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const status = await client.getWorkspacePremiumStatus(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(status, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_active_import_status",
    "Check the status and progress of ongoing data migration or import operations into a workspace.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const raw = await client.getActiveImportStatus(workspaceId);
        // The API returns an empty body when nothing is importing; say so explicitly.
        const importStatus = raw === "" || raw === undefined ? null : raw;
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(importStatus, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_org_trials",
    "List active feature trial subscriptions and trial expiration records for the signed-in organization.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ profile }) => {
      const client = getClient(profile);
      try {
        const trials = await client.getOrgTrials();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(trials, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
