import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerCollaborationCommunicationTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Collaboration & Communication ===
  registerAnnotatedTool(server,
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
        const result: any = { ...stream };

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

  registerAnnotatedTool(server,
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

  registerAnnotatedTool(server,
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

  registerAnnotatedTool(server,
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

  registerAnnotatedTool(server,
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

  registerAnnotatedTool(server,
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

  registerAnnotatedTool(server,
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

  registerAnnotatedTool(server,
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

  registerAnnotatedTool(server,
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

  registerAnnotatedTool(server,
    "get_file_count",
    "Get the total count of files stored across all workspaces in the organization, or in a specific workspace. Lightweight check for storage auditing — use list_files for detailed file listings.",
    {
      workspaceId: z.string().optional().describe("Optional workspace ID to filter file count"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.getFileCount({ workspaceId });
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

  registerAnnotatedTool(server,
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

  registerAnnotatedTool(server,
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

  registerAnnotatedTool(server,
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

  registerAnnotatedTool(server,
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


}
