#!/usr/bin/env node

/**
 * Fusebase MCP Server
 *
 * Provides tools for interacting with Fusebase (formerly Nimbus Note)
 * via its internal web API. Runs over stdio transport.
 *
 * Required env vars:
 *   FUSEBASE_HOST    — e.g. "yourorg.nimbusweb.me"
 *   FUSEBASE_ORG_ID  — e.g. "uXXXXX"
 *   FUSEBASE_COOKIE  — session cookie string from browser
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FusebaseClient } from "./client.js";
import type { FusebaseMember, FusebaseOrgMember, FusebaseFile, FusebaseLabel } from "./types.js";
import { loadEncryptedCookie, saveEncryptedCookie, loadCredentialStore } from "./crypto.js";
import { startProxyRelay, type RelayHandle } from "./proxy-relay.js";
import { markdownToSchema } from "./markdown-parser.js";
import { schemaToTokens } from "./token-builder.js";
import type { ContentBlock } from "./content-schema.js";
import { writeContentViaWebSocket } from "./yjs-ws-writer.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ─────────────────────────────────────────────────────

/** Load .env file from project root if present */
function loadDotEnv(): void {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    // Only set if not already in env (env vars take precedence)
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

// ─── Server Setup ───────────────────────────────────────────────

/** Guess MIME type from file extension */
function guessMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeMap: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf",
    txt: "text/plain", md: "text/markdown", html: "text/html", css: "text/css",
    js: "application/javascript", json: "application/json", csv: "text/csv",
    zip: "application/zip", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    mp4: "video/mp4", mp3: "audio/mpeg", wav: "audio/wav",
  };
  return mimeMap[ext] || "application/octet-stream";
}

let _proxyRelayUrl: string | undefined;

function getClient(profile?: string): FusebaseClient {
  const host = process.env.FUSEBASE_HOST;
  const orgId = process.env.FUSEBASE_ORG_ID;

  if (!host || !orgId) {
    console.error("Missing FUSEBASE_HOST or FUSEBASE_ORG_ID");
    process.exit(1);
  }

  let cookie = process.env.FUSEBASE_COOKIE || "";
  // If a profile is requested, or if no default cookie was provided in env, load from disk
  if (!cookie || profile) {
    const stored = loadEncryptedCookie(profile);
    if (stored?.cookie) {
      cookie = stored.cookie;
    } else if (profile) {
      console.error(`[fusebase] Warning: No cookie found for profile "${profile}". Will attempt to fall back or fail.`);
    }
  }

  if (!cookie) {
    console.error(`[fusebase] Warning: No cookie found. Run 'npx tsx scripts/auth.ts${profile ? ` --profile ${profile}` : ""}' to authenticate.`);
  }

  // Use proxy relay URL if started in main()
  return new FusebaseClient({ host, orgId, cookie, autoRefresh: true, profile, proxyRelayUrl: _proxyRelayUrl });
}

const server = new McpServer({
  name: "fusebase",
  version: "1.0.0",
});

// ─── Tools ──────────────────────────────────────────────────────

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
          const { loadEncryptedCookie } = await import("./crypto.js");
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
      return {
        content: [{ type: "text" as const, text: `Auth refresh failed: ${msg}${hint}` }],
        isError: true,
      };
    }
  },
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
    limit: z
      .number()
      .optional()
      .describe("Max pages to return (default: 100)"),
    offset: z.number().optional().describe("Pagination offset (default: 0)"),
    profile: z.string().optional().describe("Agent profile to use for authentication"),
  }, async ({ workspaceId, folderId, limit, offset, profile }) => {
    const client = getClient(profile);
    try {
      const result = await client.listPages(workspaceId, {
        rootId: folderId,
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
  "Create a new blank page in a Fusebase workspace with the given title. Optionally specify a folderId to place it in a specific folder (defaults to root). Returns the created page's metadata including its new globalId.",
  {
    workspaceId: z.string().describe("Workspace ID"),
    title: z.string().describe("Page title"),
    folderId: z
      .string()
      .optional()
      .describe("Parent folder ID (default: root/default)"),
    profile: z.string().optional().describe("Agent profile to use for authentication"),
  }, async ({ workspaceId, title, folderId, profile }) => {
    const client = getClient(profile);
    try {
      const page = await client.createPage(workspaceId, title, folderId);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: page.globalId,
                title: page.title,
                parentId: page.parentId,
                workspaceId: page.workspaceId,
                createdAt: new Date(page.createdAt * 1000).toISOString(),
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
  "Download a file attachment from a FuseBase page. Returns the file content as base64-encoded data with MIME type and size. Use get_page_attachments to find attachment IDs first.",
  {
    workspaceId: z.string().describe("Workspace ID"),
    attachmentId: z.string().describe("Attachment ID (from get_page_attachments)"),
    filename: z.string().describe("Original filename of the attachment"),
    profile: z.string().optional().describe("Agent profile to use for authentication"),
  }, async ({ workspaceId, attachmentId, filename, profile }) => {
    const client = getClient(profile);
    try {
      const result = await client.downloadAttachment(workspaceId, attachmentId, filename);
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
  "Get the HTML content of a page decoded from its Y.js document via WebSocket sync. Returns semantic HTML with headings, paragraphs, inline formats (bold, italic, code, links, strikethrough, underline), lists, blockquotes, code blocks, toggles, hints, collapsible headings, images, bookmarks, outlines, buttons, steps, tables, and grids. Complements update_page_content for the full read/write cycle.",
  {
    workspaceId: z.string().describe("Workspace ID"),
    pageId: z.string().describe("Page (note) ID"),
    profile: z.string().optional().describe("Agent profile to use for authentication"),
  }, async ({ workspaceId, pageId, profile }) => {
    const client = getClient(profile);
    try {
      const html = await client.getPageContent(workspaceId, pageId);
      return {
        content: [
          { type: "text" as const, text: html },
        ],
      };
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
      const result = await client.createTask(workspaceId, {
        title,
        taskListId,
        description,
        priority,
      });
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

// === Version Check (core) ===

/** Read the local package.json version */
function getLocalVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Get the GitHub remote origin URL from git config */
function getGitRemoteUrl(): string | null {
  try {
    const gitConfigPath = path.resolve(__dirname, "..", ".git", "config");
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
  }, async ({ profile }) => {
    const client = getClient(profile);
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
                update_command: `cd ${path.resolve(__dirname, "..")} && git pull && npm run build`,
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
      const { searchGuides } = await import("./guide-loader.js");
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
      const { getGuideContent } = await import("./guide-loader.js");
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
  "List all 17 FuseBase guide sections with the number of guides in each. Use this to browse available documentation categories before searching for specific topics.",
  {}, async () => {
    try {
      const { listGuideSections, loadGuideIndex } = await import("./guide-loader.js");
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

let extendedToolsRegistered = false;

server.tool(
  "set_tool_tier",
  "Enable extended Fusebase tools for this session. By default only core tools (21) are loaded for performance. Call this with tier 'all' to dynamically register 33 additional tools for admin, analytics, content mutations, file upload, database CRUD, and niche operations.",
  {
    tier: z
      .enum(["all", "core"])
      .describe("'all' to enable extended tools, 'core' to check current status"),
    profile: z.string().optional().describe("Agent profile to use for authentication"),
  }, async ({ tier, profile }) => {
    const client = getClient(profile);
    if (tier === "all") {
      if (extendedToolsRegistered) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Extended tools are already enabled for this session (49 total tools active).",
            },
          ],
        };
      }
      registerExtendedTools();
      return {
        content: [
          {
            type: "text" as const,
            text: "Extended tools enabled! 34 additional tools are now available (55 total). New tools: get_page_attachments, list_files, upload_file, download_attachment, get_labels, get_org_usage, get_comment_threads, get_task_description, delete_page, update_page_content, list_agents, get_mention_entities, get_navigation_menu, get_activity_stream, get_task_usage, get_recently_updated_notes, get_task_count, get_workspace_detail, get_workspace_emails, get_file_count, get_ai_usage, get_org_permissions, get_workspace_info, get_note_tags, get_database_data, list_databases, get_database_entity, create_database, add_database_row, get_org_limits, get_usage_summary, list_portals, get_portal_pages, get_org_features.",
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: extendedToolsRegistered
            ? "Current tier: all (49 tools active). To revert to core-only, restart the MCP server."
            : "Current tier: core (21 tools active). Call set_tool_tier with tier='all' to enable 28 extended tools.",
        },
      ],
    };
  },
);

// ─── Extended Tools (registered on-demand) ──────────────────────

function registerExtendedTools() {
  if (extendedToolsRegistered) return;
  extendedToolsRegistered = true;

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
                files.map((f: FusebaseFile) => ({
                  id: f.globalId,
                  name: f.filename,
                  format: f.format,
                  size: f.size,
                  url: f.url,
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

  // === File Upload ===

  server.tool(
    "upload_file",
    "Upload a file to a FuseBase page. The file becomes an attachment on the page. Returns the attachment ID and src path that can be used in content blocks (e.g. image blocks, file blocks, table attachment cells). File content must be base64-encoded.",
    {
      workspaceId: z.string().describe("Workspace ID"),
      pageId: z.string().describe("Page (note) ID to attach the file to"),
      base64Content: z
        .string()
        .describe("Base64-encoded file content"),
      filename: z.string().describe("File name with extension (e.g. 'photo.png')"),
      mime: z
        .string()
        .describe("MIME type (e.g. 'image/png', 'application/pdf', 'text/plain')"),
      role: z
        .enum(["attachment", "inline"])
        .optional()
        .describe("Role of the file: 'attachment' (default) or 'inline' for embedded images"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ workspaceId, pageId, base64Content, filename, mime, role, profile }) => {
      const client = getClient(profile);
      try {
        const fileBuffer = Buffer.from(base64Content, "base64");
        const result = await client.uploadFile(
          workspaceId,
          pageId,
          fileBuffer,
          filename,
          mime,
          role || "attachment",
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

  // === Org Limits & Usage Summary ===

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

  console.error(`[fusebase] Extended tools registered (46 total)`);
}

// Register extended tools at startup if FUSEBASE_TOOLS=all
if (process.env.FUSEBASE_TOOLS === "all") {
  registerExtendedTools();
} else {
  console.error("[fusebase] Running in core mode (21 tools). Set FUSEBASE_TOOLS=all or call set_tool_tier to enable all 54.");
}

// ─── Helpers ────────────────────────────────────────────────────

function errorResult(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${msg}` }],
    isError: true,
  };
}

// ─── Start ──────────────────────────────────────────────────────

async function main() {
  // Start proxy relay before MCP server so API calls are proxied
  const credStore = loadCredentialStore();
  if (credStore?.proxy) {
    try {
      const relay = await startProxyRelay(credStore.proxy);
      _proxyRelayUrl = `http://127.0.0.1:${relay.port}`;
      process.on("exit", () => relay.stop());
    } catch (err) {
      console.error(`[fusebase] Warning: Failed to start proxy relay: ${err instanceof Error ? err.message : err}`);
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Fusebase MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
