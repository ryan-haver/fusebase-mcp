import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerCommentsTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Comments ===

  registerAnnotatedTool(server,
    "get_comment_threads",
    "Get all comment threads on a specific page: thread status (resolved/open), comment counts, and each thread's comments (commentList: id, text, replyTo, userId, createdAt). Useful for reviewing feedback, discussions, or collaborative annotations on a page.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      pageId: z.string().describe("Page (note) ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, profile }) => {
      const client = getClient(profile);
      try {
        const threads = await client.getCommentThreads(workspaceId, pageId);
        // threadsInfo only has counts; add each thread's comments (text as plain text).
        const withComments = await Promise.all(
          (Array.isArray(threads) ? threads : []).map(async (t: any) => {
            const threadId = t?.thread?.globalId;
            if (!threadId) return t;
            return { ...t, commentList: await client.getThreadComments(workspaceId, threadId) };
          }),
        );
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(withComments, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
