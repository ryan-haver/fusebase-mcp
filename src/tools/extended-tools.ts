import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import type { FusebaseMember, FusebaseOrgMember, FusebaseFile, FusebaseLabel } from "../types.js";
import { markdownToSchema } from "../markdown-parser.js";
import type { ContentBlock } from "../content-schema.js";
import { writeContentViaWebSocket } from "../yjs-ws-writer.js";
import { errorResult } from "./helpers.js";

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

  // === Folder Creation ===

  server.tool(
    "create_folder",
    "Create a new folder in a FuseBase workspace. Optionally specify a parentId to create a subfolder. Returns the created folder's metadata including its globalId.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      title: z.string().describe("Folder name"),
      parentId: z
        .string()
        .optional()
        .describe("Parent folder ID for nesting (default: workspace root)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, title, parentId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.createFolder(
          workspaceId,
          title,
          parentId || "default",
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // === Page/Folder Updates ===

  server.tool(
    "update_page",
    "Update a page or folder's properties — rename it, move it to a different folder, or both. Uses the upsert endpoint so partial updates are safe.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      pageId: z.string().describe("Page or folder ID to update"),
      title: z
        .string()
        .optional()
        .describe("New title/name for the page or folder"),
      parentId: z
        .string()
        .optional()
        .describe("New parent folder ID to move the page into"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, title, parentId, profile }) => {
      const client = getClient(profile);
      try {
        const updates: { title?: string; parentId?: string } = {};
        if (title) updates.title = title;
        if (parentId) updates.parentId = parentId;
        await client.upsertPage(workspaceId, pageId, updates);
        const actions = [];
        if (title) actions.push(`renamed to "${title}"`);
        if (parentId) actions.push(`moved to folder ${parentId}`);
        return {
          content: [
            {
              type: "text" as const,
              text: `Page ${pageId} updated: ${actions.join(", ")}.`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // === Task Mutations ===

  server.tool(
    "update_task",
    "Update a task's properties — change status, priority, title, description, assignees, or due date. Uses PATCH semantics so only specified fields are changed.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      taskId: z.string().describe("Task ID to update"),
      title: z.string().optional().describe("New task title"),
      description: z.string().optional().describe("New task description"),
      priority: z
        .string()
        .optional()
        .describe("New priority (e.g. 'high', 'medium', 'low')"),
      completed: z
        .boolean()
        .optional()
        .describe("Set to true to mark task as complete"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, taskId, title, description, priority, completed, profile }) => {
      const client = getClient(profile);
      try {
        const updates: Record<string, unknown> = {};
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (priority !== undefined) updates.priority = priority;
        if (completed !== undefined) updates.completed = completed;
        const result = await client.updateTask(workspaceId, taskId, updates);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "delete_task",
    "Delete a task permanently from a workspace. This action is irreversible.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      taskId: z.string().describe("Task ID to delete"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, taskId, profile }) => {
      const client = getClient(profile);
      try {
        await client.deleteTask(workspaceId, taskId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Task ${taskId} deleted successfully.`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // === Page Mutations ===

  server.tool(
    "delete_page",
    "Delete a page permanently from a workspace. This action is irreversible — the page and its content will be lost. Use get_page first to verify you have the correct page before deleting.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      pageId: z.string().describe("Page (note) ID to delete"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, profile }) => {
      const client = getClient(profile);
      try {
        await client.deletePage(workspaceId, pageId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Page ${pageId} deleted successfully.`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "update_page_content",
    "Write or replace content on a page using the native Y.js WebSocket protocol. Accepts markdown (recommended) or structured content blocks. Supports: headings (H1/H2/H3), paragraphs, bold, italic, strikethrough, underline, inline code, links, highlight, bullet/numbered/checkbox lists, dividers, blockquotes, code blocks (with language), toggles, hints/callouts, collapsible headings, images, files, bookmarks, remote frames, outlines, buttons, steps, tables, and grid layouts.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      pageId: z.string().describe("Page (note) ID"),
      markdown: z
        .string()
        .optional()
        .describe("Markdown string to write. Auto-converted to Fusebase format. Supports # headings, **bold**, *italic*, ~~strikethrough~~, `code`, [links](url), - lists, 1. numbered, ---, > blockquotes, ```code```. For advanced blocks (toggle, hint, image, table), use the 'blocks' parameter instead."),
      blocks: z
        .array(z.unknown())
        .optional()
        .describe("Structured ContentBlock[] array for programmatic control. Supports all block types: paragraph, heading, list, code, blockquote, divider, toggle, hint, collapsible-heading, image, file, bookmark, remote-frame, outline, button, step, step-aggregator, table, and grid."),
      replace: z
        .boolean()
        .optional()
        .describe("Replace existing content (default: true). Set to false to append."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, markdown, blocks, replace, profile }) => {
      const client = getClient(profile);
      try {
        let contentBlocks: ContentBlock[];

        if (markdown) {
          // Markdown → ContentBlock schema
          contentBlocks = markdownToSchema(markdown);
        } else if (blocks) {
          contentBlocks = blocks as ContentBlock[];
        } else {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: Provide either 'markdown' or 'blocks'",
              },
            ],
            isError: true,
          };
        }

        // Write via native Y.js WebSocket protocol
        const result = await writeContentViaWebSocket(
          client["host"],
          workspaceId,
          pageId,
          client["cookie"],
          contentBlocks,
          { replace: replace !== false, timeout: 20000 },
        );

        if (result.success) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Content written successfully via Y.js WebSocket (${contentBlocks.length} blocks).`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text" as const,
                text: `Write failed: ${result.error}`,
              },
            ],
            isError: true,
          };
        }
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
      noteId: z.string().describe("Page (note) ID to comment on"),
      text: z.string().describe("Plain text of the comment"),
      targetId: z.string().optional().describe("Block ID to anchor the comment to (e.g. 'b164359351_1'). Omit to comment on the page itself."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, noteId, text, targetId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.postComment(workspaceId, noteId, text, targetId);
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
    "Delete a row from a database. Requires the dashboard ID and the row ID. Use get_database_rows to find row IDs.",
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
    "Create a new table (tab) within an existing database dashboard. This adds an additional table view alongside the existing one.",
    {
      dashboardId: z.string().describe("Dashboard ID of the existing table"),
      title: z.string().describe("Name for the new table"),
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
    "Delete a relation by its ID. This removes the link between two database tables. Use list_database_relations to find relation IDs.",
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
      databaseId: z.string().describe("Database UUID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ databaseId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.getDatabaseDetail(databaseId);
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
      databaseId: z.string().describe("Database UUID to update"),
      title: z.string().optional().describe("New database title"),
      description: z.string().optional().describe("New description"),
      icon: z.string().optional().describe("Icon name (e.g. 'default')"),
      color: z.string().optional().describe("Color name (e.g. 'blue', 'fuchsia', 'green')"),
      isPublic: z.boolean().optional().describe("Whether the database is public"),
      favorite: z.boolean().optional().describe("Toggle favorite status"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ databaseId, title, description, icon, color, isPublic, favorite, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.updateDatabase(databaseId, { title, description, icon, color, isPublic, favorite });
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
    "Delete a database and ALL its dashboards (tables), views, and data. This action is irreversible. Returns 204 on success.",
    {
      databaseId: z.string().describe("Database UUID to delete"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ databaseId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.deleteDatabase(databaseId);
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
    "Delete a dashboard (table) within a database. Removes the table and its data. Use get_database_detail first to see available dashboards.",
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
      sourceDbId: z.string().describe("Global ID of the database to duplicate"),
      copyData: z.boolean().optional().describe("Copy row data too (default true). Set false for structure-only copy."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ sourceDbId, copyData, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.duplicateDatabase(sourceDbId, { copyData });
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
    "Delete a view from a dashboard. Cannot delete the default (first) view. Use get_dashboard_detail to find view UUIDs.",
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
    "Delete a column from a database view by its key. Use get_database_schema first to find the column key. This removes the column definition from the schema — existing cell data for that column key will no longer be visible. This action cannot be undone.",
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
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, noteId, profile }) => {
      const client = getClient(profile);
      try {
        const pages = await client.getPortalPages(workspaceId, noteId);
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
}
