import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { markdownToSchema } from "../markdown-parser.js";
import type { ContentBlock } from "../content-schema.js";
import { writeContentViaWebSocket } from "../yjs-ws-writer.js";
import { errorResult } from "./helpers.js";

export function registerVibeCodingAppsTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Vibe Coding & Apps ===

  registerAnnotatedTool(server,
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
        // The app frame is an editor block, which only the Y.js editor (session cookie) can
        // write. Refuse before creating an empty page (COR-12).
        if (!client.getCookie()) {
          return errorResult("Embedding an app needs a session cookie (the Y.js editor); only tokens are configured. Run `npx tsx scripts/auth.ts` to add a session.");
        }
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
          client.getCookie(),
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
          ...(writeRes.success ? {} : { isError: true }),
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
