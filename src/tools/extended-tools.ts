import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import type { FusebaseMember, FusebaseOrgMember, FusebaseFile, FusebaseLabel } from "../types.js";
import { markdownToSchema } from "../markdown-parser.js";
import type { ContentBlock } from "../content-schema.js";
import { writeContentViaWebSocket } from "../yjs-ws-writer.js";
import { errorResult } from "./helpers.js";
import { FusebaseCliManager } from "../cli-manager.js";

export function registerExtendedTools(
  server: McpServer,
  getClient: (profile?: string) => FusebaseClient
): void {

  // === Labels ===

  server.tool(
    "get_labels",
    "Get all labels (colored categories) defined in a workspace. Labels have titles, colors, and styles, and can be applied to tasks for visual organization. Returns label IDs usable in task creation.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const labels = await client.getLabels(workspaceId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                labels.map((l: FusebaseLabel) => ({
                  id: l.globalId,
                  title: l.title,
                  color: l.color,
                  style: l.style,
                })),
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

  // === Organization ===

  server.tool(
    "get_org_usage",
    "Get organization-wide usage statistics including storage, traffic, member counts, AI credits, and workspace quotas. Each metric shows current vs max values. Useful for monitoring plan limits and resource consumption.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const usage = await client.getOrgUsage();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(usage, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // === Comments ===

  server.tool(
    "get_comment_threads",
    "Get all comment threads on a specific page, including thread status (resolved/open) and nested comments. Useful for reviewing feedback, discussions, or collaborative annotations on a page.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      pageId: z.string().describe("Page (note) ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, profile }) => {
      const client = getClient(profile);
      try {
        const threads = await client.getCommentThreads(workspaceId, pageId);
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

  // === Task Details ===

  server.tool(
    "get_task_description",
    "Get the full rich-text description and detailed properties of a specific task. Use this when search_tasks provides insufficient detail. Returns the task's complete content including formatted description.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      taskId: z.string().describe("Task ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, taskId, profile }) => {
      const client = getClient(profile);
      try {
        const desc = await client.getTaskDescription(workspaceId, taskId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(desc, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // === AI Agents ===

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  // === Mention Entities ===

  server.tool(
    "get_mention_entities",
    "Get all mentionable entities (users, pages, folders) in a workspace for @-mention autocomplete. Includes member counts, workspace structure overview, and owner info. Useful for understanding workspace scope at a glance.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const entities = await client.getMentionEntities(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(entities, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // === Discovered Endpoints ===

  server.tool(
    "get_navigation_menu",
    "Get the full sidebar navigation tree showing all pages, folders, and their hierarchy across workspaces. Includes parent-child relationships, icons, and timestamps. Best way to get a complete structural overview of all content.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const menu = await client.getNavigationMenu();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(menu, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_activity_stream",
    "Get the activity feed for a workspace showing recent comments, @mentions, and content changes. Includes user avatars and note references for each activity item. Useful for monitoring workspace activity and collaboration.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const activity = await client.getActivityStream(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(activity, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // === Collaboration & Communication ===
  server.tool(
    "fusebase_poll_mentions",
    "Poll the Fusebase activity stream for new @mentions or comments directed at this profile. Use filterText to narrow results to only items mentioning a specific display name.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      since: z.number().optional().describe("Unix timestamp (ms). Only return activities occurring strictly after this timestamp."),
      filterText: z.string().optional().describe("Case-insensitive text filter. Only return items whose content contains this string (e.g. agent display name like 'Agent PM')."),
      profile: z.string().optional().describe("Agent profile to use for polling (e.g. agent-pm). Determines which account's feed is read."),
    }, async ({ workspaceId, since, filterText, profile }) => {
      const client = getClient(profile);
      try {
        const stream = await client.getActivityStream(workspaceId);

        // Filter mentions/comments if a since timestamp is provided
        let result: any = { ...stream };

        if (since) {
          const filterRecent = (items: any[]) => items?.filter(item => (item.time || item.created || item.updated || 0) > since) || [];
          result.mentions = filterRecent(stream.mentions as any[]);
          result.comments = filterRecent(stream.comments as any[]);
          result.notes = filterRecent(stream.notes as any[]);
        }

        // Filter by display name / text if provided
        if (filterText) {
          const lowerFilter = filterText.toLowerCase();
          const containsText = (item: any) => JSON.stringify(item).toLowerCase().includes(lowerFilter);
          if (result.mentions) result.mentions = result.mentions.filter(containsText);
          if (result.comments) result.comments = result.comments.filter(containsText);
          if (result.notes) result.notes = result.notes.filter(containsText);
        }

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    "fusebase_post_comment",
    "Create a new comment thread on a Fusebase page. The comment is anchored to a specific block (targetId) or to the page itself. Use this to leave feedback, ask questions, or communicate with human collaborators.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      noteId: z.string().optional().describe("Page (note) ID to comment on"),
      pageId: z.string().optional().describe("Page (note) ID to comment on (alias for noteId)"),
      text: z.string().describe("Plain text of the comment"),
      targetId: z.string().optional().describe("Block ID to anchor the comment to (e.g. 'b164359351_1'). Omit to comment on the page itself."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, noteId, pageId, text, targetId, profile }) => {
      const client = getClient(profile);
      try {
        const effectiveNoteId = noteId || pageId;
        if (!effectiveNoteId) {
          return {
            content: [{ type: "text" as const, text: "Error: Either 'noteId' or 'pageId' must be provided." }],
            isError: true,
          };
        }
        const result = await client.postComment(workspaceId, effectiveNoteId, text, targetId);
        return {
          content: [
            { type: "text" as const, text: `Comment posted successfully.\n${JSON.stringify(result, null, 2)}` },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "fusebase_reply_comment",
    "Reply to an existing comment thread on a Fusebase page. Use get_comment_threads first to find the thread ID, then reply to continue the conversation.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      threadId: z.string().describe("Thread ID to reply to (from get_comment_threads)"),
      text: z.string().describe("Plain text of the reply"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, threadId, text, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.replyToThread(workspaceId, threadId, text);
        return {
          content: [
            { type: "text" as const, text: `Reply posted successfully.\n${JSON.stringify(result, null, 2)}` },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "fusebase_resolve_thread",
    "Resolve (close) a comment thread after it has been addressed. Use get_comment_threads to find thread IDs.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      threadId: z.string().describe("Thread ID to resolve"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, threadId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.resolveThread(workspaceId, threadId);
        return {
          content: [
            { type: "text" as const, text: `Thread resolved successfully.\n${JSON.stringify(result, null, 2)}` },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_task_usage",
    "Get task usage statistics for a workspace, including upcoming deadline dates and active reminders. Useful for understanding task workload and scheduling pressure in a workspace.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const usage = await client.getTaskUsage(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(usage, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_recently_updated_notes",
    "Get recently updated notes across the entire organization, not limited to a single workspace. Returns notes sorted by last modification time with pagination support. Useful for finding the latest activity org-wide.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const notes = await client.getRecentlyUpdatedNotes();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(notes, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_task_count",
    "Get the total number of tasks in a workspace as a single count. Lightweight alternative to search_tasks when you only need the quantity, not the task details.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.getTaskCount(workspaceId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Workspace ${workspaceId} has ${result.count} tasks.`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_workspace_detail",
    "Get full workspace metadata including internal IDs, organization binding, creator userId, and creation/update timestamps. Provides deeper detail than list_workspaces. Useful for debugging or workspace administration.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const detail = await client.getWorkspaceDetail(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(detail, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_workspace_emails",
    "Get the email-to-note addresses for a workspace. Sending emails to these addresses automatically creates pages in the workspace. Returns the dedicated email address and associated user.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const emails = await client.getWorkspaceEmails(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(emails, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_file_count",
    "Get the total count of files stored across all workspaces in the organization. Lightweight check for storage auditing — use list_files for detailed file listings.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.getFileCount();
        return {
          content: [
            {
              type: "text" as const,
              text: `Total files: ${result.count}`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_ai_usage",
    "Get AI feature usage for the organization showing current consumption vs maximum allowed. Tracks AI credits used across all workspaces. Useful for monitoring AI quota before heavy AI operations.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const usage = await client.getAiUsage();
        return {
          content: [
            {
              type: "text" as const,
              text: `AI Usage: ${usage.current}/${usage.max}`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_org_permissions",
    "Get comprehensive organization permissions including all workspace memberships, role assignments, user avatars, and per-member usage data. More detailed than get_members — includes cross-workspace permission mapping.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const perms = await client.getOrgPermissions();
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(perms, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_workspace_info",
    "Get workspace billing info including quota reset dates and plan details. Shows when usage counters reset and the organization's current billing cycle. Useful for understanding rate limits and renewal timing.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const info = await client.getWorkspaceInfo(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(info, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_note_tags",
    "Get tags applied to a specific page/note. Unlike get_tags which returns workspace-wide tag vocabulary, this returns only the tags on one particular page. Use for checking a page's categorization.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      pageId: z.string().describe("Page (note) ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, profile }) => {
      const client = getClient(profile);
      try {
        const tags = await client.getNoteTags(workspaceId, pageId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(tags, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // === Database Data ===

  server.tool(
    "get_database_data",
    "Get structured data from a Fusebase database/table view. Requires the dashboard UUID and view UUID, which can be found in the URL when viewing a database in the Fusebase UI. Supports pagination via page and limit parameters.",
    {
      dashboardId: z.string().describe("Dashboard UUID (from the database URL)"),
      viewId: z.string().describe("View UUID (from the database URL)"),
      page: z.number().optional().describe("Page number (default: 1)"),
      limit: z.number().optional().describe("Results per page (default: server default)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, page, limit, profile }) => {
      const client = getClient(profile);
      try {
        const data = await client.getDatabaseData(dashboardId, viewId, { page, limit });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(data, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "list_databases",
    "List all databases/dashboards in the organization. Returns dashboard and view UUIDs that can be used with get_database_data. Probes known entity types (spaces, clients) plus any custom entities you specify.",
    {
      orgId: z.string().optional().describe("Organization ID (defaults to env FUSEBASE_ORG_ID)"),
      customEntities: z.array(z.string()).optional().describe("Additional entity types to probe beyond defaults (spaces, clients)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ orgId, customEntities, profile }) => {
      const client = getClient(profile);
      try {
        const databases = await client.listDatabases(orgId, customEntities);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(databases, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_database_entity",
    "Get data from a specific database entity type (e.g. clients, spaces). Automatically discovers the correct dashboard/view UUIDs for the entity. Supports pagination.",
    {
      entity: z.string().describe("Entity type (e.g. 'clients', 'spaces', 'portals')"),
      page: z.number().optional().describe("Page number (default: 1)"),
      limit: z.number().optional().describe("Results per page"),
      orgId: z.string().optional().describe("Organization ID (defaults to env FUSEBASE_ORG_ID)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ entity, page, limit, orgId, profile }) => {
      const client = getClient(profile);
      try {
        const data = await client.getDatabaseEntity(entity, { page, limit }, orgId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(data, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "create_database",
    "Create a new database (table or kanban view) in the organization. Returns the new database, dashboard, and view UUIDs. The database is created with a default table representation. Use list_databases afterwards to see it.",
    {
      title: z.string().describe("Database title"),
      description: z.string().optional().describe("Database description (defaults to title)"),
      icon: z.string().optional().describe("Icon identifier (defaults to 'default')"),
      color: z.string().optional().describe("Color theme (e.g. 'fuchsia', 'blue', 'green')"),
      isPublic: z.boolean().optional().describe("Whether the database is public (defaults to false)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ title, description, icon, color, isPublic, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.createDatabase(title, { description, icon, color, isPublic });
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

  server.tool(
    "add_database_row",
    "Add a new row to a database entity table. For built-in entities (clients, spaces), only entity name is needed. For custom databases, also provide databaseId and dashboardId (from list_databases or create_database). Uses Next.js server action internally.",
    {
      entity: z.string().describe("Entity type (e.g. 'clients', 'spaces', 'custom')"),
      databaseId: z.string().optional().describe("Database UUID (required for custom databases, from create_database)"),
      dashboardId: z.string().optional().describe("Dashboard UUID (required for custom databases, from create_database)"),
      orgId: z.string().optional().describe("Organization ID (defaults to env FUSEBASE_ORG_ID)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ entity, databaseId, dashboardId, orgId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.addDatabaseRow(entity, { databaseId, dashboardId, orgId });
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

  server.tool(
    "delete_database_row",
    "[DESTRUCTIVE] Delete a row from a database. Requires the dashboard ID and the row ID. Use get_database_rows to find row IDs.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      rowId: z.string().describe("Row ID to delete (from get_database_rows)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, rowId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.deleteRow(dashboardId, rowId);
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

  server.tool(
    "move_kanban_card",
    "Move a kanban card to a different column by updating the grouped column's cell value. Equivalent to update_database_cell but semantically describes moving a card. Use get_database_schema to find the groupBy column key, and get_database_rows to find the row UUID.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      rowId: z.string().describe("Row UUID of the card to move"),
      groupByColumnKey: z.string().describe("Column key of the kanban grouping column"),
      newValue: z.string().describe("New value for the grouped column (moves card to that group)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, rowId, groupByColumnKey, newValue, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.moveKanbanCard(dashboardId, viewId, rowId, groupByColumnKey, newValue);
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

  server.tool(
    "list_database_relations",
    "List available relation targets and existing lookups for a dashboard. Returns linked tables/views that can be used for creating relation or lookup columns.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().optional().describe("View ID (helps narrow results)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.listRelations(dashboardId, viewId);
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

  server.tool(
    "create_dashboard_table",
    "Create a new table (dashboard) within an existing database. Returns the new dashboard UUID and its default view UUID. Use list_all_databases to find the parent database ID.",
    {
      dashboardId: z.string().describe("Parent database UUID (called dashboardId in the API)"),
      title: z.string().describe("Table title"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, title, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.createDashboardTable(dashboardId, title);
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

  server.tool(
    "delete_relation",
    "[DESTRUCTIVE] Delete a relation by its ID. This removes the link between two database tables. Use list_database_relations to find relation IDs.",
    {
      relationId: z.string().describe("Relation ID to delete"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ relationId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.deleteRelation(relationId);
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

  server.tool(
    "list_all_databases",
    "List all databases in the organization via the dashboard-service REST API. Returns database metadata, dashboard (table) UUIDs, and view UUIDs. More comprehensive than list_databases — returns full database objects with nested dashboards.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.listAllDatabases();
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

  server.tool(
    "get_database_detail",
    "Get detailed information about a specific database including all its dashboards (tables) and views. Use the database ID from list_all_databases or create_database.",
    {
      databaseId: z.string().optional().describe("Database UUID"),
      dashboardId: z.string().optional().describe("Database UUID (alias for databaseId)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ databaseId, dashboardId, profile }) => {
      const client = getClient(profile);
      try {
        const effectiveId = databaseId || dashboardId;
        if (!effectiveId) {
          return {
            content: [{ type: "text" as const, text: "Error: Either 'databaseId' or 'dashboardId' must be provided." }],
            isError: true,
          };
        }
        const result = await client.getDatabaseDetail(effectiveId);
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

  server.tool(
    "update_database",
    "Update a database's title, description, icon, color, favorite status, or public visibility. Uses PUT (PATCH is not supported by this API).",
    {
      databaseId: z.string().optional().describe("Database UUID to update"),
      dashboardId: z.string().optional().describe("Database UUID to update (alias for databaseId)"),
      title: z.string().optional().describe("New database title"),
      description: z.string().optional().describe("New description"),
      icon: z.string().optional().describe("Icon name (e.g. 'default')"),
      color: z.string().optional().describe("Color name (e.g. 'blue', 'fuchsia', 'green')"),
      isPublic: z.boolean().optional().describe("Whether the database is public"),
      favorite: z.boolean().optional().describe("Toggle favorite status"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ databaseId, dashboardId, title, description, icon, color, isPublic, favorite, profile }) => {
      const client = getClient(profile);
      try {
        const effectiveId = databaseId || dashboardId;
        if (!effectiveId) {
          return {
            content: [{ type: "text" as const, text: "Error: Either 'databaseId' or 'dashboardId' must be provided." }],
            isError: true,
          };
        }
        const result = await client.updateDatabase(effectiveId, { title, description, icon, color, isPublic, favorite });
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

  server.tool(
    "delete_database",
    "[DESTRUCTIVE] Delete a database and ALL its dashboards (tables), views, and data. This action is irreversible. Returns 204 on success.",
    {
      databaseId: z.string().optional().describe("Database UUID to delete"),
      dashboardId: z.string().optional().describe("Database UUID to delete (alias for databaseId)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ databaseId, dashboardId, profile }) => {
      const client = getClient(profile);
      try {
        const effectiveId = databaseId || dashboardId;
        if (!effectiveId) {
          return {
            content: [{ type: "text" as const, text: "Error: Either 'databaseId' or 'dashboardId' must be provided." }],
            isError: true,
          };
        }
        const result = await client.deleteDatabase(effectiveId);
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

  server.tool(
    "get_dashboard_detail",
    "Get detailed information about a dashboard (table within a database). Returns the dashboard's views array (including custom views), metadata, root entity, and scopes. Use the dashboard ID from list_all_databases or get_database_detail.",
    {
      dashboardId: z.string().describe("Dashboard UUID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.getDashboardDetail(dashboardId);
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

  server.tool(
    "delete_dashboard",
    "[DESTRUCTIVE] Delete a dashboard (table) within a database. Removes the table and its data. Use get_database_detail first to see available dashboards.",
    {
      dashboardId: z.string().describe("Dashboard UUID to delete"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.deleteDashboard(dashboardId);
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

  server.tool(
    "update_view",
    "Update a custom view's name, filters, sorts, or hidden columns. Use get_dashboard_detail to find available views. Uses PUT (PATCH is not supported).",
    {
      dashboardId: z.string().describe("Dashboard UUID containing the view"),
      viewId: z.string().describe("View UUID to update"),
      name: z.string().optional().describe("New view name"),
      filters: z.array(z.object({
        column: z.string().describe("Column name to filter on"),
        op: z.string().describe("Filter operator (e.g. 'contains', 'equals', 'gt', 'lt')"),
        value: z.unknown().describe("Filter value"),
      })).optional().describe("Array of filter conditions"),
      sorts: z.array(z.object({
        column: z.string().describe("Column name to sort by"),
        direction: z.enum(["asc", "desc"]).describe("Sort direction"),
      })).optional().describe("Array of sort specifications"),
      hidden_columns: z.array(z.string()).optional().describe("Array of column names to hide in this view"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, name, filters, sorts, hidden_columns, profile }) => {
      const client = getClient(profile);
      try {
        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (filters !== undefined) updates.filters = filters;
        if (sorts !== undefined) updates.sorts = sorts;
        if (hidden_columns !== undefined) updates.hidden_columns = hidden_columns;
        const result = await client.updateView(dashboardId, viewId, updates as any);
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

  server.tool(
    "set_view_representation",
    "Switch a view's display mode. Supports 8 types: table (default spreadsheet), kanban (card columns), board, calendar, timeline, gallery, list, grid. Table and kanban use the representations endpoint; the rest use PUT with default_representation_template_id. Use get_dashboard_detail to find dashboard and view UUIDs.",
    {
      dashboardId: z.string().describe("Dashboard UUID"),
      viewId: z.string().describe("View UUID"),
      representationType: z.enum(["table", "kanban", "board", "calendar", "timeline", "gallery", "list", "grid"]).describe("Display mode"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, representationType, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.setViewRepresentation(dashboardId, viewId, representationType);
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

  server.tool(
    "duplicate_database",
    "Duplicate (copy) an entire database, including tables, views, relations, and optionally data. Returns the new database with its UUIDs. Discovered via captured API: POST /databases/copy-from/database.",
    {
      sourceDbId: z.string().optional().describe("Global ID of the database to duplicate"),
      databaseId: z.string().optional().describe("Global ID of the database to duplicate (alias for sourceDbId)"),
      dashboardId: z.string().optional().describe("Global ID of the database to duplicate (alias for sourceDbId)"),
      copyData: z.boolean().optional().default(true).describe("Copy row data too (default true). Set false for structure-only copy."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ sourceDbId, databaseId, dashboardId, copyData, profile }) => {
      const client = getClient(profile);
      try {
        const effectiveId = sourceDbId || databaseId || dashboardId;
        if (!effectiveId) {
          return {
            content: [{ type: "text" as const, text: "Error: Either 'sourceDbId' or 'databaseId' must be provided." }],
            isError: true,
          };
        }
        const result = await client.duplicateDatabase(effectiveId, { copyData });
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

  server.tool(
    "create_view",
    "Create a new view within a dashboard (table). Each view can have its own filters, sorts, grouping, column visibility, and display mode. Use set_view_representation afterwards to change the view type.",
    {
      dashboardId: z.string().describe("Dashboard UUID"),
      name: z.string().optional().describe("View name (defaults to auto-generated name)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, name, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.createView(dashboardId, name);
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

  server.tool(
    "delete_view",
    "[DESTRUCTIVE] Delete a view from a dashboard. Cannot delete the default (first) view. Use get_dashboard_detail to find view UUIDs.",
    {
      dashboardId: z.string().describe("Dashboard UUID"),
      viewId: z.string().describe("View UUID to delete"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.deleteView(dashboardId, viewId);
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

  server.tool(
    "export_csv",
    "Export a database view as CSV text. Returns the raw CSV content. Supports 5 delimiter options: comma, semicolon, pipe, tab, or caret. Use get_dashboard_detail to find dashboard and view UUIDs.",
    {
      dashboardId: z.string().describe("Dashboard UUID"),
      viewId: z.string().describe("View UUID"),
      delimiter: z.enum([",", ";", "|", "\t", "^"]).optional().describe("CSV delimiter (default comma)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, delimiter, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.exportCSV(dashboardId, viewId, delimiter);
        return {
          content: [
            { type: "text" as const, text: result.csv },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "duplicate_view",
    "Duplicate an existing view within a dashboard. Creates a copy with the same schema, filters, and configuration. Use get_dashboard_detail to find dashboard and view UUIDs.",
    {
      dashboardId: z.string().describe("Dashboard UUID"),
      sourceViewId: z.string().describe("Source view UUID to duplicate"),
      name: z.string().optional().describe("Name for the new view (defaults to 'Copy of View')"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, sourceViewId, name, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.duplicateView(dashboardId, sourceViewId, name);
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

  server.tool(
    "import_csv",
    "Import CSV data into an existing database table/view. Provide the CSV content, the database ID, dashboard (table) ID, and the view ID. The server will import the rows into the database. Column mapping is auto-generated from CSV headers (all imported as 'Single line text').",
    {
      csvContent: z.string().describe("CSV content as a string"),
      databaseId: z.string().describe("Database ID"),
      dashboardId: z.string().describe("Dashboard (table) ID to import into"),
      viewId: z.string().describe("View ID to import into"),
      delimiter: z.enum([",", ";", "|", "\t", "^"]).optional().describe("CSV delimiter (default comma)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ csvContent, databaseId, dashboardId, viewId, delimiter, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.importCSV(csvContent, databaseId, dashboardId, viewId, { delimiter });
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

  server.tool(
    "set_view_grouping",
    "Set the grouping column for a kanban or board view. Groups cards/rows by the specified column. Requires the dashboard ID, view ID, and the column key to group by. Use get_database_schema first to find column keys.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      groupByColumnKey: z.string().describe("Column key to group by (use get_database_schema to find keys)"),
      representationType: z.enum(["kanban", "board"]).optional().describe("Representation type (default: kanban)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, groupByColumnKey, representationType, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.setViewGrouping(dashboardId, viewId, groupByColumnKey, representationType || "kanban");
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

  server.tool(
    "set_column_width",
    "Set the width of a column in a database view. Use get_database_schema first to find column keys. Width is in pixels.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      columnKey: z.string().describe("Column key to resize"),
      width: z.number().describe("Width in pixels (e.g. 200, 350, 500)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, columnKey, width, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.setColumnWidth(dashboardId, viewId, columnKey, width);
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

  server.tool(
    "rename_database_column",
    "Rename a column in a database view. Updates the column's name in the view schema. Use get_database_schema first to find the column key.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      columnKey: z.string().describe("The column key to rename (8-char opaque string)"),
      newName: z.string().describe("New name for the column"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, columnKey, newName, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.renameColumn(dashboardId, viewId, columnKey, newName);
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

  server.tool(
    "reorder_database_columns",
    "Reorder columns in a database view. Provide an array of column keys in the desired order. Columns not in the array are appended at the end. Use get_database_schema first to see current column keys and order.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      orderedKeys: z.array(z.string()).describe("Column keys in desired order"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, orderedKeys, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.reorderColumns(dashboardId, viewId, orderedKeys);
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

  server.tool(
    "update_database_cell",
    "Set the value of a specific cell in a database row. Use get_database_rows or get_database_data first to obtain the rowUuid and the column key (short opaque string like 'eoZSNDPy'). The get_database_rows tool returns a schema array mapping column names to keys for easy lookup. Note: rich-text (Description), file, and relation columns may not accept plain string values.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      rowUuid: z.string().describe("Row UUID (from get_database_rows or get_database_data response)"),
      columnKey: z.string().describe("Column key — the short opaque ID for the column (e.g. 'eoZSNDPy'), found in schema returned by get_database_rows"),
      value: z.string().describe("New cell value as a string"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, rowUuid, columnKey, value, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.updateDatabaseCell(dashboardId, viewId, rowUuid, columnKey, value);
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

  server.tool(
    "get_database_rows",
    "Get rows from a database view in a structured format optimised for agent use. Each row includes: rowUuid (needed for update_database_cell), cells (column name → value map), and rawCells (column key → value map). Also returns the schema (column name, key, type) so you can look up the correct column key before calling update_database_cell. Wraps get_database_data with friendly field names.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      page: z.number().optional().describe("Page number (default 1)"),
      limit: z.number().optional().describe("Rows per page (default 50)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, page, limit, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.getDatabaseRows(dashboardId, viewId, { page, limit });
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

  server.tool(
    "get_database_schema",
    "Get the column schema for a database view. Returns an array of column definitions with key (opaque 8-char ID, needed for update_database_cell), name (human-readable), type (string, number, date, label, checkbox, etc.), and edit settings. Use this to understand a database's structure before reading or writing cells.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.getViewSchema(dashboardId, viewId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result.columns, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "add_database_column",
    "Add a new column to a database view. Supported types: string (single-line text), multiline (multi-line text), number, date, label/status/select (with optional custom labels and colors), checkbox/boolean, email, phone, link/url, currency, files, user/assignee (assign org members), subtable/child-table-link (nested table). For relation columns use add_relation_column, for lookup columns use add_lookup_column. Returns the new column's key which is needed for update_database_cell. Use get_database_schema to verify the column was added.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      name: z.string().describe("Human-readable column name (e.g. 'Priority', 'Email Address')"),
      columnType: z.string().describe("Column type: string, multiline, number, date, label, status, select, checkbox, boolean, email, phone, link, url, currency, files, user, assignee, subtable"),
      labels: z.array(z.object({
        name: z.string().describe("Label text"),
        color: z.string().describe("Label color (gray, purple, green, blue, red, yellow, orange, pink)"),
      })).optional().describe("Custom label options (only for label/status/select type). Defaults to Option 1/2/3."),
      multiSelect: z.boolean().optional().describe("Allow multiple selections (for label/status/select and user/assignee types). Defaults to false."),
      description: z.string().optional().describe("Column description (defaults to 'A custom {type} field')"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, name, columnType, labels, multiSelect, description, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.addDatabaseColumn(dashboardId, viewId, name, columnType, { labels, multiSelect, description });
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

  server.tool(
    "delete_database_column",
    "[DESTRUCTIVE] Delete a column from a database view by its key. Use get_database_schema first to find the column key. This removes the column definition from the schema — existing cell data for that column key will no longer be visible. This action cannot be undone.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      columnKey: z.string().describe("Column key to delete (8-char opaque ID from get_database_schema)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, columnKey, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.deleteDatabaseColumn(dashboardId, viewId, columnKey);
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

  server.tool(
    "add_relation_column",
    "Add a Relation column that links this database to another database table. This creates a cross-database relation (via POST /relations) and adds a lookup-source column. The column shows linked records from the target table. Use get_database_schema on the target table first to get its dashboardId and viewId.",
    {
      dashboardId: z.string().describe("Source dashboard (table) ID"),
      viewId: z.string().describe("Source view ID"),
      name: z.string().describe("Column name (e.g. 'Related Tasks', 'Linked Projects')"),
      targetDashboardId: z.string().describe("Target dashboard (table) ID to link to"),
      targetViewId: z.string().describe("Target view ID to link to"),
      relationType: z.enum(["many_to_many", "one_to_many", "many_to_one"]).optional().describe("Relation type. Defaults to many_to_many."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, name, targetDashboardId, targetViewId, relationType, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.addRelationColumn(dashboardId, viewId, name, targetDashboardId, targetViewId, { relationType: relationType as any });
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

  server.tool(
    "add_lookup_column",
    "Add a Lookup column that displays data from a related table through an existing Relation column. The lookup column is read-only and automatically pulls data from the linked records. You must have an existing relation column first (created via add_relation_column). Use get_database_schema to find the relation column key.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      name: z.string().describe("Column name (e.g. 'Project Name', 'Task Status')"),
      relationColumnKey: z.string().describe("Key of the existing relation column to look through (8-char ID from get_database_schema)"),
      lookupFieldKey: z.string().optional().describe("Key of the field in the related table to display. If omitted, defaults to the first text column (usually Name)."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, name, relationColumnKey, lookupFieldKey, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.addLookupColumn(dashboardId, viewId, name, relationColumnKey, lookupFieldKey);
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

  // === Org Features & Limits ===

  server.tool(
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

  server.tool(
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

  // === Portals ===

  server.tool(
    "list_portals",
    "List client portals for the organization. Optionally filter by workspace. Client portals are shared, branded pages published externally for clients or stakeholders.",
    {
      workspaceId: z.string().optional().describe("Workspace ID to filter portals (optional)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const portals = await client.listPortals(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(portals, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_portal_pages",
    "Get pages published to a client portal. Returns the portal page tree for a given workspace, optionally filtered to a specific page. Use list_portals first to find active portals.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      noteId: z.string().optional().describe("Page/note ID to filter (optional)"),
      pageId: z.string().optional().describe("Page/note ID to filter (optional, alias for noteId)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, noteId, pageId, profile }) => {
      const client = getClient(profile);
      try {
        const effectiveNoteId = noteId || pageId;
        const pages = await client.getPortalPages(workspaceId, effectiveNoteId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(pages, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "create_portal",
    "Create a new client portal for a workspace. Client portals are external, branded spaces where external clients view published pages, widgets, and dashboards.",
    {
      workspaceId: z.string().describe("Workspace ID to associate the client portal with"),
      name: z.string().describe("Display name for the portal (e.g. 'Client Onboarding Hub')"),
      domain: z.string().optional().describe("Custom subdomain or domain (optional)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, name, domain, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.createPortal(workspaceId, name, domain);
        return {
          content: [
            { type: "text" as const, text: `Portal "${name}" created successfully:\n${JSON.stringify(result, null, 2)}` },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_portal",
    "Get detailed portal configuration, custom branding, access rules, greeting messages, and custom injected scripts for a portal.",
    {
      portalId: z.string().describe("Portal numeric ID, global ID (25-char alphanumeric), or workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ portalId, profile }) => {
      const client = getClient(profile);
      try {
        const portal = await client.getPortal(portalId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(portal, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "publish_page_to_portal",
    "Publish or unpublish an internal workspace page to the client portal by updating its is_portal_share flag.",
    {
      workspaceId: z.string().describe("Workspace ID containing the page"),
      pageId: z.string().describe("Page/note ID to publish or unpublish"),
      publish: z.boolean().describe("true to publish to the client portal, false to unpublish/hide"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, publish, profile }) => {
      const client = getClient(profile);
      try {
        await client.setPagePortalShare(workspaceId, pageId, publish);
        return {
          content: [
            {
              type: "text" as const,
              text: `Page ${pageId} has been ${publish ? "published to" : "unpublished from"} the client portal.`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "check_portal_availability",
    "Check whether the organization account has the client portal feature enabled and available.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const available = await client.checkPortalAvailability();
        return {
          content: [
            {
              type: "text" as const,
              text: `Client portal availability: ${available ? "ENABLED" : "DISABLED"}`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_portal_theme",
    "Get client portal UI visual theme, dark/light branding colors, hero greeting banner, search bar settings, and sidebar options.",
    {
      workspaceId: z.string().optional().describe("Workspace ID associated with the portal"),
      portalId: z.string().optional().describe("Portal ID or global ID"),
      portalDomain: z.string().optional().describe("Custom domain or subdomain of the portal"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, portalId, portalDomain, profile }) => {
      const client = getClient(profile);
      try {
        const theme = await client.getPortalTheme({ workspaceId, portalId, portalDomain });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(theme, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_portal_navigation_menu",
    "Get the complete hierarchical sidebar navigation tree and page entities published in a workspace's client portal.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const menu = await client.getPortalNavigationMenu(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(menu, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_workspace_portal",
    "Resolve the primary client portal object bound to a workspace (portal ID, global ID, domain, creation timestamp).",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const portal = await client.getWorkspacePortal(workspaceId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(portal, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // === Org Features ===

  server.tool(
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

  // === Vibe Coding & Apps ===

  server.tool(
    "create_interactive_app_page",
    "Create a new FuseBase page embedding a full-width interactive web application, widget, or dashboard (FuseBase Vibe Coding/Apps). Uses a remote-frame block with allowOverWidth=true.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      title: z.string().describe("Page title for the interactive app"),
      appUrl: z.string().describe("URL of the hosted web application or preview"),
      description: z.string().optional().describe("Optional introductory markdown text above the embedded app"),
      folderId: z.string().optional().describe("Parent folder ID (default: root/default)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, title, appUrl, description, folderId, profile }) => {
      const client = getClient(profile);
      try {
        const page = await client.createPage(workspaceId, title, folderId);
        const blocks: ContentBlock[] = [];
        if (description) {
          blocks.push(...markdownToSchema(description));
        }
        blocks.push({
          type: "remote-frame",
          src: appUrl,
          allowOverWidth: true,
        });

        const writeRes = await writeContentViaWebSocket(
          client["host"],
          workspaceId,
          page.globalId,
          client["cookie"],
          blocks,
          { replace: true },
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: page.globalId,
                  title: page.title,
                  appUrl,
                  contentWritten: writeRes.success,
                  error: writeRes.error,
                  pageUrl: `https://${client["host"]}/space/${workspaceId}/page/${page.globalId}`,
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

  // === Automations (ActivePieces) ===

  server.tool(
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

  server.tool(
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

  server.tool(
    "list_flow_runs",
    "List execution history of ActivePieces automation flow runs, including status, execution duration, and trigger timestamps.",
    {
      projectId: z.string().optional().describe("Optional automation project ID"),
      limit: z.number().optional().describe("Max flow runs to return (default: 20)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ projectId, limit, profile }) => {
      const client = getClient(profile);
      try {
        const runs = await client.listFlowRuns(projectId, limit ?? 20);
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

  server.tool(
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

  // === FuseBase CLI & Hosted Apps ===

  server.tool(
    "fusebase_cli_status",
    "Check if the official FuseBase developer CLI (`fusebase`) is installed, detect its version, binary path, and authentication state.",
    {},
    async () => {
      try {
        const status = await FusebaseCliManager.getStatus();
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

  server.tool(
    "fusebase_cli_init",
    "Initialize a new FuseBase hosted app product in the specified directory using the official FuseBase CLI.",
    {
      name: z.string().describe("Name of the product/app to create"),
      orgId: z.string().optional().describe("Organization ID to link the product to"),
      cwd: z.string().optional().describe("Target directory path (defaults to current working directory)"),
      forceDirty: z.boolean().optional().describe("Force initialization even if directory is not empty"),
    },
    async ({ name, orgId, cwd, forceDirty }) => {
      try {
        const args = ["init", "--name", `"${name}"`];
        if (orgId) args.push("--org", orgId);
        if (forceDirty) args.push("--force-dirty");
        const res = await FusebaseCliManager.executeCommand("init", args.slice(1), cwd);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(res, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "fusebase_cli_list_apps",
    "List configured FuseBase hosted web applications and their URLs.",
    {
      cwd: z.string().optional().describe("Project directory to inspect"),
    },
    async ({ cwd }) => {
      try {
        const res = await FusebaseCliManager.executeCommand("app", ["list"], cwd);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(res, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "fusebase_cli_deploy",
    "Deploy a FuseBase web application to production hosting via the FuseBase CLI.",
    {
      cwd: z.string().optional().describe("Project directory to deploy"),
    },
    async ({ cwd }) => {
      try {
        const res = await FusebaseCliManager.executeCommand("deploy", [], cwd, 60000);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(res, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // === ActivePieces Flow Mutations ===

  server.tool(
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

  server.tool(
    "update_automation_flow",
    "Update an existing ActivePieces workflow automation (rename or toggle status ENABLED/DISABLED).",
    {
      flowId: z.string().describe("ID of the flow to update"),
      type: z.enum(["CHANGE_STATUS", "CHANGE_NAME"]).describe("Update operation type"),
      status: z.enum(["ENABLED", "DISABLED"]).optional().describe("New status when type is CHANGE_STATUS"),
      displayName: z.string().optional().describe("New display name when type is CHANGE_NAME"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ flowId, type, status, displayName, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.updateAutomationFlow(flowId, { type, status, displayName });
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

  server.tool(
    "delete_automation_flow",
    "[DESTRUCTIVE] Delete an ActivePieces workflow automation by flow ID.",
    {
      flowId: z.string().describe("ID of the flow to delete"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ flowId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.deleteAutomationFlow(flowId);
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

  server.tool(
    "trigger_automation_flow",
    "Test-run or trigger an ActivePieces workflow automation with a custom JSON payload.",
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

  // === Portal Clients & Magic Links ===

  server.tool(
    "list_portal_clients",
    "List invited external clients and members with portal access across the organization or for a specific portal.",
    {
      portalId: z.string().optional().describe("Optional portal ID to filter clients"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ portalId, profile }) => {
      const client = getClient(profile);
      try {
        const clients = await client.listPortalClients(portalId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(clients, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "invite_portal_client",
    "Invite a customer or client into a FuseBase client portal with the Client Role.",
    {
      portalId: z.string().describe("Portal ID to invite the client to"),
      email: z.string().describe("Client's email address"),
      name: z.string().optional().describe("Client's full name"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ portalId, email, name, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.invitePortalClient(portalId, email, name);
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

  server.tool(
    "create_portal_magic_link",
    "Generate a 24-hour passwordless magic access link for a portal client.",
    {
      portalId: z.string().describe("Portal ID"),
      email: z.string().describe("Client's email address"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ portalId, email, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.getPortalMagicLink(portalId, email);
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

  // === Multi-Agent Swarm Orchestration ===

  server.tool(
    "fusebase_swarm_init",
    "Initialize a multi-agent swarm state machine database in FuseBase. Creates a Kanban board structured with roles (agent-pm, agent-architect, agent-dev, agent-qa), task statuses (Backlog, In Progress, Review, Done), and audit trails.",
    {
      title: z.string().describe("Title of the swarm project / database (e.g. 'FuseBase MVP Sprint Swarm')"),
      description: z.string().optional().describe("Objective and scope of the multi-agent sprint"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ title, description, profile }) => {
      const client = getClient(profile);
      try {
        const db = await client.createDatabase(title, {
          description: description || `Multi-Agent Swarm State Machine for ${title}`,
          icon: "robot",
          color: "6366F1",
        });

        const dashboard = db.data.dashboards?.[0];
        const dashboardId = dashboard?.global_id;
        const viewId = dashboard?.views?.[0]?.global_id;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  message: `Swarm Kanban Database "${title}" initialized successfully.`,
                  databaseId: db.data.global_id,
                  dashboardId,
                  viewId,
                  availableRoles: [
                    "agent-pm",
                    "agent-architect",
                    "agent-dev",
                    "agent-qa",
                    "agent-review",
                    "agent-devops",
                  ],
                  workflowStages: ["Backlog", "In Progress", "Review", "Done"],
                  instructions:
                    "Use 'add_database_row' to create tasks with role and acceptance criteria. Use 'fusebase_swarm_task_transition' to transition tasks across stages with audit comments.",
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

  server.tool(
    "fusebase_swarm_task_transition",
    "Transition a swarm task across lifecycle stages (Backlog -> In Progress -> Review -> Done), record agent audit comments, and trigger next-agent handover.",
    {
      dashboardId: z.string().describe("Dashboard/Table ID of the swarm board"),
      viewId: z.string().describe("View ID of the swarm board"),
      rowId: z.string().describe("Row UUID of the task card to transition"),
      groupByColumnKey: z.string().describe("Column key of the status column (from get_database_schema)"),
      newStatus: z.enum(["Backlog", "In Progress", "Review", "Done"]).describe("New status stage for the task"),
      comment: z.string().describe("Audit log / review comment explaining the work done or reason for transition"),
      nextRole: z.string().optional().describe("Next agent profile assigned to take over the task (e.g. 'agent-dev', 'agent-qa')"),
      profile: z.string().optional().describe("Acting agent profile"),
    },
    async ({ dashboardId, viewId, rowId, groupByColumnKey, newStatus, comment, nextRole, profile }) => {
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

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  message: `Task ${rowId} moved to "${newStatus}".`,
                  audit: auditEntry,
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
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

  server.tool(
    "get_active_import_status",
    "Check the status and progress of ongoing data migration or import operations into a workspace.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const importStatus = await client.getActiveImportStatus(workspaceId);
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

  server.tool(
    "get_org_trials",
    "List active feature trial subscriptions and trial expiration records for the organization.",
    {
      orgId: z.string().optional().describe("Optional organization ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ orgId, profile }) => {
      const client = getClient(profile);
      try {
        const trials = await client.getOrgTrials(orgId);
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
