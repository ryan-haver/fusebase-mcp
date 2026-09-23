import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import type { FusebaseMember, FusebaseOrgMember } from "../types.js";
import { assertValidProfile, loadEncryptedCookie, loadEncryptedToken, listConfiguredProfiles } from "../crypto.js";
import { markdownToSchema } from "../markdown-parser.js";
import type { ContentBlock } from "../content-schema.js";
import { writeContentViaWebSocket } from "../yjs-ws-writer.js";
import { errorResult, guessMime, htmlToMarkdown, resolveDownloadPath } from "./helpers.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface CoreToolsOptions {
  enableExtendedTools: () => void;
  isExtendedToolsEnabled: () => boolean;
  setActiveProfile?: (profile?: string) => void;
  getActiveProfile?: () => string | undefined;
}

export function registerCoreTools(
  server: McpServer,
  getClient: (profile?: string) => FusebaseClient,
  options: CoreToolsOptions
): void {

  // === Auth ===

  server.tool(
    "refresh_auth",
    "Refresh Fusebase authentication cookies by re-launching a Playwright browser session. Use this when other tools return 401/auth errors. Set interactive=true to open a visible browser window for manual login. Returns cookie age and expiry info.",
    {
      interactive: z
        .boolean()
        .optional()
        .describe(
          "If true, opens a visible browser for manual login. If false (default), tries headless session reuse.",
        ),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ interactive, profile }) => {
      const client = getClient(profile);
      try {
        const success = interactive
          ? await client.refreshAuthInteractive()
          : await client.refreshAuth(true); // forceFresh=true to always re-auth
        if (success) {
          // Report cookie age/expiry info
          let cookieInfo = "Authentication refreshed successfully. Cookies updated.";
          try {
            const { loadEncryptedCookie } = await import("../crypto.js");
            const stored = loadEncryptedCookie(profile);
            if (stored?.savedAt) {
              const ageMs = Date.now() - new Date(stored.savedAt).getTime();
              const ageMin = Math.round(ageMs / 60_000);
              cookieInfo += ` Cookie age: ${ageMin}min.`;
              if (stored.meta?.cookieCount) {
                cookieInfo += ` ${stored.meta.cookieCount} cookies stored.`;
              }
            }
          } catch { /* crypto unavailable */ }
          return {
            content: [{ type: "text" as const, text: cookieInfo }],
          };
        }
        return {
          content: [{
            type: "text" as const,
            text: "Authentication refresh failed. Try: (1) npx tsx scripts/auth.ts --no-proxy, or (2) set interactive=true on this tool.",
          }],
          isError: true,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        let hint = "";
        if (msg.includes("Timeout") || msg.includes("timeout")) {
          hint = " Hint: The proxy may be unreachable — try: npx tsx scripts/auth.ts --no-proxy";
        }
        return errorResult(`${msg}${hint}`);
      }
    },
  );

  server.tool(
    "list_agent_profiles",
    "List all configured agent authentication profiles found in the local data directory, showing profile names, cookie age in hours, and status.",
    {},
    async () => {
      try {
        const profiles = listConfiguredProfiles();
        const active = options.getActiveProfile ? options.getActiveProfile() : undefined;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ activeProfile: active || "default", profiles }, null, 2),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "switch_active_profile",
    "Switch the active default agent authentication profile for subsequent tool calls in this session.",
    {
      profile: z.string().describe("Agent profile name (e.g. 'agent-architect', 'agent-dev', or 'default')"),
    },
    async ({ profile }) => {
      try {
        const next = profile === "default" ? undefined : profile;
        assertValidProfile(next);
        if (options.setActiveProfile) {
          options.setActiveProfile(next);
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `Active profile switched to '${profile}'.`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "check_session_health",
    "Inspect the health, age, validity, and organization access of the current session or a specific agent profile without launching a browser. Returns status (HEALTHY/WARNING/EXPIRED), auth mode (DIRECT_TOKEN/HYBRID/SESSION_COOKIE), and active workspaces.",
    {
      profile: z.string().optional().describe("Optional agent profile name to check (e.g. 'default', 'agent-pm')"),
    },
    async ({ profile }) => {
      const activeProfile = profile || (options.getActiveProfile ? options.getActiveProfile() : undefined);
      const stored = loadEncryptedCookie(activeProfile);
      const storedToken = loadEncryptedToken(activeProfile);
      const client = getClient(activeProfile);

      const hasToken = Boolean(client.gateBridge?.isConfigured || storedToken);
      const hasCookie = Boolean(stored?.cookie);

      if (!hasCookie && !hasToken) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "MISSING",
                profile: activeProfile || "default",
                error: "No encrypted credentials or API tokens found for this profile.",
                recommendation: `Run: npx tsx scripts/auth.ts${activeProfile ? ` --profile=${activeProfile}` : ""} --token <YOUR_TOKEN>`,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      const authMode = hasToken && hasCookie ? "HYBRID" : hasToken ? "DIRECT_TOKEN" : "SESSION_COOKIE";
      const ageMs = stored?.savedAt ? Date.now() - new Date(stored.savedAt).getTime() : 0;
      const ageHours = Math.round(ageMs / 3600000);

      // Verify active connectivity
      let isValid = false;
      let workspaceCount = 0;
      let gateIdentity: any;
      let errorMsg: string | undefined;

      try {
        if (client.gateBridge?.isConfigured) {
          gateIdentity = await client.gateBridge.getIdentity();
          isValid = true;
        }
        const ws = await client.listWorkspaces();
        isValid = true;
        workspaceCount = ws.length;
      } catch (err: any) {
        if (!isValid) errorMsg = err.message;
      }

      const status = !isValid ? "EXPIRED" : (!hasCookie && hasToken) ? "HEALTHY" : ageHours > 100 ? "WARNING" : "HEALTHY";

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status,
                authMode,
                profile: activeProfile || "default",
                authenticated: isValid,
                ageHours: hasCookie ? ageHours : null,
                gateConnected: Boolean(client.gateBridge?.isConfigured),
                gateOrgId: gateIdentity?.orgId,
                gateDomain: gateIdentity?.orgDomain,
                permissionsCount: gateIdentity?.permissions?.length,
                host: client["host"] || stored?.meta?.host,
                cookiesStored: stored?.meta?.cookieCount || 0,
                workspaceCount,
                liveDashboard: "https://fusebase-mcp.thefusebase.app/",
                error: errorMsg,
                recommendation:
                  status === "HEALTHY"
                    ? `Session is active and healthy (${authMode} mode).`
                    : status === "WARNING"
                    ? `Cookie is ${ageHours}h old. Still valid, but consider refreshing soon: npx tsx scripts/auth.ts${activeProfile ? ` --profile=${activeProfile}` : ""}`
                    : `Session expired or invalid. Re-authenticate: npx tsx scripts/auth.ts${activeProfile ? ` --profile=${activeProfile}` : ""}`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // === Workspaces ===

  server.tool(
    "list_workspaces",
    "List all workspaces in your Fusebase organization with their IDs, titles, and colors. Use this first to discover workspace IDs needed by most other tools.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const workspaces = await client.listWorkspaces();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(workspaces, null, 2),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // === Pages ===

  server.tool(
    "list_pages",
    "List pages (notes) in a Fusebase workspace with titles, types, and metadata. Supports pagination and filtering by folder. Returns compact summaries — use get_page for full details on a specific page.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      folderId: z
        .string()
        .optional()
        .describe("Folder ID to filter by (default: root)"),
      parentId: z
        .string()
        .optional()
        .describe("Parent folder ID to filter by (alias for folderId)"),
      limit: z
        .number()
        .optional()
        .default(100)
        .describe("Max pages to return (default: 100)"),
      offset: z.number().optional().default(0).describe("Pagination offset (default: 0)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, folderId, parentId, limit, offset, profile }) => {
      const client = getClient(profile);
      try {
        const effectiveFolderId = folderId || parentId || "root";
        const result = await client.listPages(workspaceId, {
          rootId: effectiveFolderId,
          limit,
          offset,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  total: result.total,
                  pages: result.items.map((n) => ({
                    id: n.globalId,
                    title: n.title,
                    parentId: n.parentId,
                    createdAt: new Date(n.createdAt * 1000).toISOString(),
                    updatedAt: new Date(n.updatedAt * 1000).toISOString(),
                    size: n.size,
                    favorite: n.favorite,
                    shared: n.shared,
                    emoji: n.emoji,
                  })),
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
    "get_page",
    "Get detailed metadata for a specific page including title, dates, size, sharing status, and emoji. Returns all properties — use this when you need full page info beyond what list_pages provides.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      pageId: z.string().describe("Page (note) ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, profile }) => {
      const client = getClient(profile);
      try {
        const page = await client.getPage(workspaceId, pageId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(page, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "get_recent_pages",
    "Get recently accessed pages in a workspace, sorted by last access time. Useful for finding what the user was last working on. Returns up to the specified limit (default 10).",
    {
      workspaceId: z.string().describe("Workspace ID"),
      limit: z.number().optional().describe("Max pages to return (default: 10)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, limit, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.getRecentPages(workspaceId, limit);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  count: result.count,
                  pages: result.notes.map((n) => ({
                    id: n.globalId,
                    title: n.title,
                    updatedAt: new Date(n.updatedAt * 1000).toISOString(),
                    size: n.size,
                  })),
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
    "create_page",
    "Create a new page in a Fusebase workspace with the given title. Optionally provide initial content via 'markdown' (recommended) or structured 'blocks'. Optionally specify a folderId to place it in a specific folder (defaults to root). Returns the created page's metadata including its new globalId.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      title: z.string().describe("Page title"),
      folderId: z
        .string()
        .optional()
        .describe("Parent folder ID (default: root/default)"),
      parentId: z
        .string()
        .optional()
        .describe("Parent folder ID (alias for folderId)"),
      markdown: z
        .string()
        .optional()
        .describe("Markdown string for initial page content. Auto-converted to Fusebase format. Supports # headings, **bold**, *italic*, ~~strikethrough~~, `code`, [links](url), - lists, 1. numbered, ---, > blockquotes, ```code```. For advanced blocks use 'blocks' instead."),
      blocks: z
        .array(z.unknown())
        .optional()
        .describe("Structured ContentBlock[] array for initial page content. Supports all block types: paragraph, heading, list, code, blockquote, divider, toggle, hint, collapsible-heading, image, file, bookmark, remote-frame, outline, button, step, step-aggregator, table, and grid."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, title, folderId, parentId, markdown, blocks, profile }) => {
      const client = getClient(profile);
      try {
        const effectiveFolderId = folderId || parentId;
        const page = await client.createPage(workspaceId, title, effectiveFolderId);
        const result: Record<string, unknown> = {
          id: page.globalId,
          title: page.title,
          parentId: page.parentId,
          workspaceId: page.workspaceId,
          createdAt: new Date(page.createdAt * 1000).toISOString(),
        };

        // Write initial content if provided
        if (markdown || blocks) {
          let writeResult: { success: boolean; error?: string };
          if (client.getCookie()) {
            const contentBlocks: ContentBlock[] = markdown ? markdownToSchema(markdown) : (blocks as ContentBlock[]);
            writeResult = await writeContentViaWebSocket(
              client["host"],
              workspaceId,
              page.globalId,
              client.getCookie(),
              contentBlocks,
              { replace: true, timeout: 20000 },
            );
          } else if (markdown) {
            // Token-only mode (COR-12): the page is new and empty, so appending through Gate
            // produces the same result as writing it.
            writeResult = await client.appendPageContent(workspaceId, page.globalId, { markdown });
          } else {
            writeResult = { success: false, error: "structured 'blocks' need a session cookie; only markdown can be written in token-only mode" };
          }

          result.contentWritten = writeResult.success;
          if (!writeResult.success) {
            // The page exists but is empty: report an error so the caller doesn't assume success.
            result.contentError = writeResult.error;
            return {
              content: [{ type: "text" as const, text: `Page created but its content was not written. ${JSON.stringify(result, null, 2)}` }],
              isError: true,
            };
          }
        }

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
      folderId: z
        .string()
        .optional()
        .describe("New parent folder ID to move the page into (alias for parentId)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, title, parentId, folderId, profile }) => {
      const client = getClient(profile);
      try {
        const effectiveParentId = parentId || folderId;
        const updates: { title?: string; parentId?: string } = {};
        if (title) updates.title = title;
        if (effectiveParentId) updates.parentId = effectiveParentId;
        await client.upsertPage(workspaceId, pageId, updates);
        const actions = [];
        if (title) actions.push(`renamed to "${title}"`);
        if (effectiveParentId) actions.push(`moved to folder ${effectiveParentId}`);
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

  server.tool(
    "delete_page",
    "[DESTRUCTIVE] Delete a page permanently from a workspace. This action is irreversible — the page and its content will be lost. Use get_page first to verify you have the correct page before deleting.",
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
    "move_page",
    "Move a page to a different folder within the workspace, move it back to workspace root, or migrate it to an entirely different workspace. Specify targetWorkspaceId to migrate across workspaces, and/or folderId (or parentId) to move between folders.",
    {
      workspaceId: z.string().describe("Current workspace ID containing the page"),
      pageId: z.string().describe("Page (note) ID to move"),
      targetWorkspaceId: z
        .string()
        .optional()
        .describe("Destination workspace ID if moving across workspaces (defaults to current workspace)"),
      folderId: z
        .string()
        .optional()
        .describe("Destination folder ID, or 'root' to move to root level"),
      parentId: z
        .string()
        .optional()
        .describe("Destination folder ID (alias for folderId)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, targetWorkspaceId, folderId, parentId, profile }) => {
      const client = getClient(profile);
      try {
        const effectiveFolder = folderId || parentId;
        const res = await client.movePage(workspaceId, pageId, {
          targetWorkspaceId,
          folderId: effectiveFolder,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  message: `Page ${pageId} moved successfully.`,
                  pageId,
                  destinationWorkspaceId: targetWorkspaceId || workspaceId,
                  destinationFolderId: effectiveFolder || "root",
                  operationId: res.id,
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

  // === Folders ===

  server.tool(
    "list_folders",
    "List all folders in a Fusebase workspace as a nested tree structure. Each folder includes its children, icons, and sharing status. Use folder IDs to filter list_pages or as parentId when creating pages.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        const folders = await client.listFolders(workspaceId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                folders.map((f) => ({
                  id: f.id.replace("notesFolder#", ""),
                  name: f.name,
                  parentId: f.parentId,
                  hasChildren: f.hasChildren,
                  icon: f.icon,
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

  server.tool(
    "create_folder",
    "Create a new folder in a Fusebase workspace for organizing pages. Can be created at the root or nested inside an existing parent folder.",
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
          parentId,
        );
        const id = result.globalId || (result as any).id;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ id, ...result }, null, 2),
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // === Attachments & Files ===

  server.tool(
    "get_page_attachments",
    "Get all attachments (images, files, audio recordings) embedded in a specific page. Returns file names, MIME types, sizes, and UUIDs. Useful for auditing media content or finding downloadable assets.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      pageId: z.string().describe("Page (note) ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, profile }) => {
      const client = getClient(profile);
      try {
        const attachments = await client.getAttachments(workspaceId, pageId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                attachments.map((a) => ({
                  id: a.globalId,
                  name: a.displayName,
                  type: a.type,
                  mime: a.mime,
                  size: a.size,
                  role: a.role,
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

  server.tool(
    "list_files",
    "List all uploaded files across a workspace with names, sizes, formats, and URLs. Supports pagination with limit and offset. Different from get_page_attachments — this covers workspace-wide file storage.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      limit: z.number().optional().describe("Max files to return (default: 25)"),
      offset: z.number().optional().describe("Pagination offset (default: 0)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, limit, offset, profile }) => {
      const client = getClient(profile);
      try {
        const files = await client.listFiles(workspaceId, limit, offset);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                files.map((f) => ({
                  id: f.globalId,
                  filename: f.filename,
                  format: f.format,
                  size: f.size,
                  type: f.type,
                  url: f.url,
                  createdAt: new Date(f.createdAt * 1000).toISOString(),
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

  server.tool(
    "upload_file",
    "Upload a file to a FuseBase page. The file content must be provided as base64-encoded data. Returns the attachment ID and URL path. Use get_page_attachments to list existing attachments.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      pageId: z.string().describe("Page (note) ID to attach the file to"),
      content: z.string().describe("Base64-encoded file content"),
      filename: z.string().describe("File name with extension (e.g. 'report.pdf')"),
      mime: z.string().optional().describe("MIME type (auto-detected from extension if omitted)"),
      role: z.enum(["attachment", "inline"]).optional().describe("'attachment' (default) or 'inline' for embedded images"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, content, filename, mime, role, profile }) => {
      const client = getClient(profile);
      try {
        const buffer = Buffer.from(content, "base64");
        const detectedMime = mime || guessMime(filename);
        const result = await client.uploadFile(
          workspaceId,
          pageId,
          buffer,
          filename,
          detectedMime,
          role || "attachment",
        );
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              attachmentId: result.attachmentId,
              src: result.src,
              displayName: result.displayName,
              mime: result.mime,
              size: buffer.length,
            }, null, 2),
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "download_attachment",
    "Download a file attachment from a FuseBase page. Supports native MCP image rendering, local file downloading to disk (saving LLM context), or base64 data. Use get_page_attachments to find attachment IDs first.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      attachmentId: z.string().describe("Attachment ID (from get_page_attachments)"),
      filename: z.string().describe("Original filename of the attachment"),
      saveToDisk: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, writes the file to local disk and returns the local file path instead of large base64 text"),
      outputPath: z.string().optional().describe("Optional destination file name or relative path inside the download directory (data/downloads, or FUSEBASE_DOWNLOAD_DIR). Paths outside it are rejected."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, attachmentId, filename, saveToDisk, outputPath, profile }) => {
      const client = getClient(profile);
      try {
        // Validate the destination before downloading anything.
        const targetFile = saveToDisk || outputPath ? resolveDownloadPath(filename, outputPath) : undefined;
        const result = await client.downloadAttachment(workspaceId, attachmentId, filename);

        // Safe local disk saving to prevent context blowup
        if (targetFile) {
          fs.mkdirSync(path.dirname(targetFile), { recursive: true });
          fs.writeFileSync(targetFile, Buffer.from(result.base64, "base64"));
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                savedPath: targetFile,
                filename,
                mime: result.mime,
                size: result.size,
              }, null, 2),
            }],
          };
        }

        // Native MCP image block for image attachments
        const isImage = ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(result.mime);
        if (isImage) {
          return {
            content: [
              {
                type: "image" as const,
                data: result.base64,
                mimeType: result.mime,
              },
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: true,
                  filename,
                  mime: result.mime,
                  size: result.size,
                  note: "Image displayed natively via MCP image content block.",
                }, null, 2),
              },
            ],
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              base64: result.base64,
              mime: result.mime,
              size: result.size,
              filename,
            }, null, 2),
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // === Tags & Labels ===

  server.tool(
    "get_tags",
    "Get all tags in a workspace, or tags for a specific page if pageId is provided. Workspace tags return the full tag vocabulary; page tags return only tags applied to that page. Use update_page_tags to modify a page's tags.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      pageId: z
        .string()
        .optional()
        .describe("Page ID (if omitted, returns workspace tags)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, profile }) => {
      const client = getClient(profile);
      try {
        if (pageId) {
          const tags = await client.getPageTags(workspaceId, pageId);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify(tags, null, 2) },
            ],
          };
        }
        const tags = await client.getTags(workspaceId);
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

  server.tool(
    "update_page_tags",
    "Set tags on a specific page, replacing any existing tags entirely. Pass an array of tag strings to apply. To remove all tags, pass an empty array.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      pageId: z.string().describe("Page (note) ID"),
      tags: z.array(z.string()).describe("Array of tag strings to set"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, tags, profile }) => {
      const client = getClient(profile);
      try {
        await client.updatePageTags(workspaceId, pageId, tags);
        return {
          content: [
            {
              type: "text" as const,
              text: `Tags updated on page ${pageId}: ${tags.join(", ")}`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // === Members (core) ===

  server.tool(
    "get_members",
    "Get members of a workspace or the entire organization if workspaceId is omitted. Workspace members include roles and privileges; org members include user profiles with emails. Useful for finding collaborators or checking permissions.",
    {
      workspaceId: z
        .string()
        .optional()
        .describe("Workspace ID (if omitted, returns org members)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, profile }) => {
      const client = getClient(profile);
      try {
        if (workspaceId) {
          const members = await client.getWorkspaceMembers(workspaceId);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  members.map((m: FusebaseMember) => ({
                    id: m.globalId,
                    userId: m.userId,
                    role: m.role,
                    privileges: m.privileges,
                  })),
                  null,
                  2,
                ),
              },
            ],
          };
        } else {
          const members = await client.getOrgMembers();
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  members.map((m: FusebaseOrgMember) => ({
                    userId: m.userId,
                    role: m.role,
                    name: m.user?.displayName,
                    email: m.user?.email,
                  })),
                  null,
                  2,
                ),
              },
            ],
          };
        }
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // === Page Content (core) ===

  server.tool(
    "get_page_content",
    "Get the content of a page decoded from its Y.js document via WebSocket sync. By default returns semantic HTML. Set format='markdown' for clean, compact markdown that uses ~50% fewer tokens.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      pageId: z.string().describe("Page (note) ID"),
      format: z
        .enum(["html", "markdown"])
        .optional()
        .default("html")
        .describe("Output format: 'html' (default) or 'markdown' for token efficiency"),
      maxLength: z
        .number()
        .optional()
        .describe("Optional max character length to prevent LLM context blowup on large pages"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, format, maxLength, profile }) => {
      const client = getClient(profile);
      try {
        const rawContent = await client.getPageContent(workspaceId, pageId);
        let text = rawContent;
        const looksLikeHtml = /<[a-z][\s\S]*>/i.test(rawContent);

        if (format === "markdown") {
          text = looksLikeHtml ? htmlToMarkdown(rawContent) : rawContent;
        } else if (format === "html" && !looksLikeHtml) {
          text = `<div class="fusebase-markdown-content">\n${rawContent}\n</div>`;
        }
        if (maxLength && text.length > maxLength) {
          const omitted = text.length - maxLength;
          text = text.slice(0, maxLength) + `\n\n... [Content truncated: ${omitted} additional characters omitted. Use maxLength or read specific sections].`;
        }
        return {
          content: [
            { type: "text" as const, text },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "append_page_content",
    "Append new content (markdown or structured blocks) to an existing FuseBase page without overwriting existing content. Uses real-time Y.js WebSocket synchronization. Great for adding meeting notes, research updates, log entries, or checklists.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      pageId: z.string().describe("Page (note) ID to append to"),
      markdown: z
        .string()
        .optional()
        .describe("Markdown content to append (headings, lists, code, tables, bold, links, etc.)"),
      blocks: z
        .array(z.unknown())
        .optional()
        .describe("Structured ContentBlock[] array to append. Supports all block types including table (with text titles, progress bars, singleselect badges, date timestamps), toggle, hint, code, etc."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ workspaceId, pageId, markdown, blocks, profile }) => {
      const client = getClient(profile);
      try {
        if (!markdown && !blocks) {
          return {
            content: [{ type: "text" as const, text: "Error: Either 'markdown' or 'blocks' must be provided." }],
            isError: true,
          };
        }

        const result = await client.appendPageContent(workspaceId, pageId, {
          markdown,
          blocks,
        });

        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: `Append failed: ${result.error}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully appended content to page ${pageId}.`,
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
        .describe("Structured ContentBlock[] array for programmatic control. Supports all block types: paragraph, heading, list, code, blockquote, divider, toggle, hint, collapsible-heading, image, file, bookmark, remote-frame, outline, button, step, step-aggregator, table, and grid. For tables, support columns with text title, columnType ('text', 'progress', 'singleselect', 'multiselect', 'date', 'checkbox', 'rating', 'number', 'currency') and dbSelect options."),
      replace: z
        .boolean()
        .optional()
        .default(true)
        .describe("Replace existing content (default: true). Set to false to append. Replacing requires a session cookie; in token-only mode only markdown appends are possible."),
      allowEmpty: z
        .boolean()
        .optional()
        .describe("Set true to deliberately clear the page when replacing with empty content. Without it, an empty replace is refused."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, markdown, blocks, replace, allowEmpty, profile }) => {
      const client = getClient(profile);
      try {
        let contentBlocks: ContentBlock[];

        if (markdown !== undefined) {
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

        const replacing = replace !== false;

        // CON-9a: whitespace-only markdown parses to no blocks; replacing with that erases the page.
        if (contentBlocks.length === 0) {
          if (!replacing) return errorResult("Nothing to append: the content parsed to no blocks.");
          if (!allowEmpty) {
            return errorResult("Refusing to replace the page with empty content, which would erase it. Pass allowEmpty: true to clear the page deliberately.");
          }
        }

        // COR-12: without a session cookie the Y.js editor socket is unavailable.
        if (!client.getCookie()) {
          if (replacing) {
            return errorResult(
              "Replacing page content needs a session cookie (the Y.js editor); only tokens are configured. " +
              "Use replace: false with markdown to append through Gate, or run `npx tsx scripts/auth.ts` to add a session.",
            );
          }
          if (markdown === undefined) {
            return errorResult("In token-only mode only markdown can be appended (Gate accepts text). Pass 'markdown' instead of 'blocks'.");
          }
          const appended = await client.appendPageContent(workspaceId, pageId, { markdown });
          if (!appended.success) return errorResult(`Append via Gate failed: ${appended.error}`);
          return { content: [{ type: "text" as const, text: `Content appended via Gate (token mode).` }] };
        }

        const result = await writeContentViaWebSocket(
          client["host"],
          workspaceId,
          pageId,
          client.getCookie(),
          contentBlocks,
          { replace: replacing, timeout: 20000 },
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

  // === Tasks (core) ===

  server.tool(
    "search_tasks",
    "Search tasks in a workspace with full task details, assignees, labels, and board info. Optionally filter by page to see only tasks linked to a specific note. Supports pagination with offset and limit.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      pageId: z
        .string()
        .optional()
        .describe("Page ID to filter tasks by"),
      limit: z.number().optional().describe("Max results (default: 50)"),
      offset: z.number().optional().describe("Pagination offset (default: 0)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, limit, offset, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.searchTasks(workspaceId, {
          noteId: pageId,
          limit,
          offset,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { total: result.total, tasks: result.tasks },
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

  // === Task Lists & Creation (core) ===

  server.tool(
    "list_task_lists",
    "List task lists (kanban boards) in a workspace with their associated tasks, assignees, and reminders. Optionally filter to a specific task list by ID. Task list IDs are needed for create_task.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      taskListId: z
        .string()
        .optional()
        .describe("Filter to a specific task list ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, taskListId, profile }) => {
      const client = getClient(profile);
      try {
        const lists = await client.listTaskLists(workspaceId, { taskListId });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(lists, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "create_task",
    "Create a new task in a workspace within a specified task list. Supports title, description, priority, due date, assignees, and labels. Use list_task_lists first to get valid taskListId values.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      title: z.string().describe("Task title"),
      taskListId: z.string().describe("Task list ID to add the task to"),
      description: z.string().optional().describe("Task description"),
      priority: z
        .string()
        .optional()
        .describe("Task priority (e.g. 'high', 'medium', 'low')"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, title, taskListId, description, priority, profile }) => {
      const client = getClient(profile);
      try {
        const result: any = await client.createTask(workspaceId, {
          title,
          taskListId,
          description,
          priority,
        });
        const taskData = result?.task || result;
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(taskData, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

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
        if (completed !== undefined) updates.done = completed;
        const result: any = await client.updateTask(workspaceId, taskId, updates);
        const taskData = result?.task || result;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(taskData, null, 2),
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
    "[DESTRUCTIVE] Delete a task permanently from a workspace. This action is irreversible.",
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

  // === Version Check (core) ===

  /** Read the local package.json version */
  function getLocalVersion(): string {
    try {
      // Compiled file is at dist/tools/core-tools.js. We need to go up two directories to reach package.json
      const pkgPath = path.resolve(__dirname, "..", "..", "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      return pkg.version || "0.0.0";
    } catch {
      return "0.0.0";
    }
  }

  /** Get the GitHub remote origin URL from git config */
  function getGitRemoteUrl(): string | null {
    try {
      // Compiled file is at dist/tools/core-tools.js. We need to go up two directories to reach .git/config
      const gitConfigPath = path.resolve(__dirname, "..", "..", ".git", "config");
      if (!fs.existsSync(gitConfigPath)) return null;
      const config = fs.readFileSync(gitConfigPath, "utf-8");
      const match = config.match(/\[remote "origin"\]\s*\n\s*url\s*=\s*(.+)/);
      if (!match) return null;
      const url = match[1].trim();
      // Extract owner/repo from GitHub URL
      const ghMatch = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
      return ghMatch ? ghMatch[1] : null;
    } catch {
      return null;
    }
  }

  /** Compare two semver versions: 1 if a > b, -1 if a < b, 0 if equal */
  function compareSemver(a: string, b: string): number {
    const pa = a.replace(/^v/, "").split(".").map(Number);
    const pb = b.replace(/^v/, "").split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      const va = pa[i] || 0;
      const vb = pb[i] || 0;
      if (va > vb) return 1;
      if (va < vb) return -1;
    }
    return 0;
  }

  server.tool(
    "check_version",
    "Get server version and check for updates from GitHub. Returns the current installed version, latest available version, whether an update is available, and the command to update. If update_available is true, inform the user that a new version is available and suggest updating.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async () => {
      try {
        const version = getLocalVersion();
        const ownerRepo = getGitRemoteUrl();

        if (!ownerRepo) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    version,
                    latest_version: null,
                    update_available: false,
                    update_command: "git pull && npm run build",
                    note: "No GitHub remote configured. Run 'git remote add origin <url>' to enable update checking.",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Fetch latest release or tag from GitHub API
        let latestVersion: string | null = null;
        try {
          const res = await fetch(
            `https://api.github.com/repos/${ownerRepo}/releases/latest`,
            {
              headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "fusebase-mcp" },
              signal: AbortSignal.timeout(5000),
            },
          );
          if (res.ok) {
            const data = (await res.json()) as { tag_name?: string };
            latestVersion = data.tag_name?.replace(/^v/, "") || null;
          }
        } catch {
          // Releases endpoint failed, try tags
        }

        if (!latestVersion) {
          try {
            const res = await fetch(
              `https://api.github.com/repos/${ownerRepo}/tags?per_page=1`,
              {
                headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "fusebase-mcp" },
                signal: AbortSignal.timeout(5000),
              },
            );
            if (res.ok) {
              const tags = (await res.json()) as Array<{ name: string }>;
              if (tags.length > 0) {
                latestVersion = tags[0].name.replace(/^v/, "");
              }
            }
          } catch {
            // Both failed
          }
        }

        const updateAvailable = latestVersion
          ? compareSemver(latestVersion, version) > 0
          : false;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  version,
                  latest_version: latestVersion,
                  update_available: updateAvailable,
                  update_command: `cd ${path.resolve(__dirname, "..", "..")} && git pull && npm run build`,
                  live_status_dashboard: "https://fusebase-mcp.thefusebase.app/",
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

  // === FuseBase Guides (core) ===

  server.tool(
    "search_guides",
    "Search the local FuseBase guide documentation (231 guides across 17 sections). Returns matching guide titles, sections, and slugs. Use get_guide to read the full content of a specific result. Great for looking up how any FuseBase feature works.",
    {
      query: z.string().describe("Search query (e.g. 'toggle', 'table filtering', 'portal branding')"),
      limit: z.number().optional().describe("Max results to return (default: 10)"),
    }, async ({ query, limit }) => {
      try {
        const { searchGuides } = await import("../guide-loader.js");
        const results = searchGuides(query, limit);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  query,
                  count: results.length,
                  results: results.map(r => ({
                    title: r.title,
                    section: r.section,
                    slug: r.slug,
                    path: r.relativePath,
                  })),
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
    "get_guide",
    "Get the full markdown content of a specific FuseBase guide by section and slug. Use search_guides first to find the right section/slug values. Returns the complete guide including instructions, screenshots, and hotkeys.",
    {
      section: z.string().describe("Guide section (e.g. 'basics', 'page-editor', 'client-portal')"),
      slug: z.string().describe("Guide slug without .md extension (e.g. 'hint-object', 'toggles')"),
    }, async ({ section, slug }) => {
      try {
        const { getGuideContent } = await import("../guide-loader.js");
        const content = getGuideContent(section, slug);
        if (!content) {
          return {
            content: [
              { type: "text" as const, text: `Guide not found: ${section}/${slug}.md. Use search_guides to find valid section/slug values.` },
            ],
          };
        }
        return {
          content: [{ type: "text" as const, text: content }],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    "list_guide_sections",
    "List all 19 FuseBase guide sections with the number of guides in each. Use this to browse available documentation categories before searching for specific topics.",
    {}, async () => {
      try {
        const { listGuideSections, loadGuideIndex } = await import("../guide-loader.js");
        const sections = listGuideSections();
        const total = loadGuideIndex().length;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  total_guides: total,
                  sections,
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

  // ─── Tool Tier Management ───────────────────────────────────────

  server.tool(
    "set_tool_tier",
    "Enable extended Fusebase tools for this session. By default only core tools (33) are loaded for performance. Call this with tier 'all' to dynamically register 103 additional tools (136 total) for admin, analytics, database CRUD, portals, ActivePieces automations, and CLI operations.",
    {
      tier: z
        .enum(["all", "core"])
        .describe("'all' to enable extended tools, 'core' to check current status"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ tier }) => {
      if (tier === "all") {
        if (options.isExtendedToolsEnabled()) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Extended tools are already enabled for this session (175 total tools active).",
              },
            ],
          };
        }
        options.enableExtendedTools();
        return {
          content: [
            {
              type: "text" as const,
              text: "Extended tools enabled! 141 additional tools are now available (175 total). New tools: fusebase_token_list, fusebase_token_create, fusebase_token_get, fusebase_token_revoke, fusebase_token_permission_catalog, fusebase_gate_whoami, fusebase_direct_tool_call, fusebase_work_run_agent, fusebase_work_scrape_url, fusebase_work_trigger_n8n, fusebase_cli_sidecar_add, fusebase_cli_sidecar_list, fusebase_cli_sidecar_remove, fusebase_cli_secret_create, fusebase_cli_secret_list, fusebase_cli_logs, fusebase_cli_app_update, batch_put_database_data, resolve_database_alias, link_database_rows, unlink_database_rows, get_relation_rows, reorder_database_rows, list_isolated_stores, create_isolated_store, query_isolated_sql, execute_isolated_sql, select_isolated_sql_rows, insert_isolated_sql_row, batch_insert_isolated_sql_rows, list_isolated_sql_tables, apply_isolated_sql_migrations, get_task_time_tracking, get_automation_flags, get_workspace_premium_status, get_active_import_status, get_org_trials, get_portal_theme, get_portal_navigation_menu, get_workspace_portal, get_agent_public_profile, get_dashboard_templates, get_member_roles, get_workspace_members_v1, get_tasks_workspace_summary, get_billing_info, get_user_preferences, set_sidebar_collapsed, get_ai_assistant_state, list_ai_agent_threads, get_ai_agent_favorites, fusebase_swarm_init, fusebase_swarm_task_transition, trigger_automation_flow, create_portal, get_portal, publish_page_to_portal, check_portal_availability, fusebase_cli_status, fusebase_cli_init, fusebase_cli_list_apps, fusebase_cli_deploy, create_automation_flow, update_automation_flow, delete_automation_flow, list_portal_clients, invite_portal_client, create_portal_magic_link, create_interactive_app_page, list_automation_flows, get_automation_flow, list_flow_runs, list_automation_pieces, get_labels, get_org_usage, get_comment_threads, get_task_description, list_agents, get_mention_entities, get_navigation_menu, get_activity_stream, fusebase_poll_mentions, fusebase_post_comment, fusebase_reply_comment, fusebase_resolve_thread, get_task_usage, get_recently_updated_notes, get_task_count, get_workspace_detail, get_workspace_emails, get_file_count, get_ai_usage, get_org_permissions, get_workspace_info, get_note_tags, get_database_data, list_databases, get_database_entity, create_database, add_database_row, delete_database_row, move_kanban_card, list_database_relations, create_dashboard_table, delete_relation, list_all_databases, get_database_detail, update_database, delete_database, get_dashboard_detail, delete_dashboard, update_view, set_view_representation, duplicate_database, create_view, delete_view, export_csv, duplicate_view, import_csv, set_view_grouping, set_column_width, rename_database_column, reorder_database_columns, update_database_cell, get_database_rows, get_database_schema, add_database_column, delete_database_column, add_relation_column, add_lookup_column, get_org_limits, get_usage_summary, list_portals, get_portal_pages, get_org_features.",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: options.isExtendedToolsEnabled()
              ? "Current tier: all (175 tools active). To revert to core-only, restart the MCP server."
              : "Current tier: core (34 tools active). Call set_tool_tier with tier='all' to enable 141 extended tools.",
          },
        ],
      };
    },
  );
}
