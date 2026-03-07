/**
 * Fusebase HTTP client — wraps all API calls to the Fusebase platform.
 * Auth is cookie-based (browser session cookies).
 * Supports automatic 401 retry via Playwright-based cookie refresh.
 * Logs all API calls to data/api_log.jsonl for debugging and learning.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as http from "http";
import * as https from "https";
import { ProxyAgent } from "undici";

export interface FusebaseConfig {
  host: string;
  orgId: string;
  cookie: string;
  autoRefresh?: boolean;
  profile?: string;
  proxyRelayUrl?: string; // e.g. "http://127.0.0.1:<port>" — local HTTP CONNECT relay
}

import type {
  FusebaseWorkspace,
  FusebaseNote,
  FusebaseFolder,
  FusebaseAttachment,
  FusebaseFile,
  FusebaseMember,
  FusebaseOrgMember,
  FusebaseLabel,
  FusebaseTag,
  FusebaseTaskSearchResult,
  FusebaseCommentThread,
  FusebaseTaskList,
  FusebaseCreateTaskPayload,
  FusebaseAgent,
  FusebaseMentionEntity,
  FusebaseNavMenuItem,
  FusebaseActivityItem,
  FusebaseTaskUsage,
  FusebaseWorkspaceDetail,
  FusebaseWorkspaceInfo,
  FusebaseWorkspaceEmail,
  FusebaseOrgPermissions,
  FusebaseOrgLimits,
  FusebaseUsageSummary,
  FusebaseOrgFeature,
  FusebasePortal,
  FusebasePortalPage,
  FusebaseDatabaseViewData,
  NotesListResponse,
  RecentNotesResponse,
  OrgUsageResponse,
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "data");
const LOG_PATH = path.join(DATA_DIR, "api_log.jsonl");
const CACHE_PATH = path.join(DATA_DIR, "workspace_cache.json");

/** Reusable keepalive agent — holds TCP connections open between requests */
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 4,
});

/** Default timeouts (ms) */
const TIMEOUT_GET = 10_000;
const TIMEOUT_WRITE = 20_000;

export class FusebaseClient {
  private baseUrl: string;
  private orgId: string;
  private cookie: string;
  private host: string;
  private autoRefresh: boolean;
  private profile?: string;
  private sessionId: string;
  private lastRequestTime: number = 0;
  private static readonly MIN_REQUEST_INTERVAL_MS = 200;
  private proxyDispatcher?: ProxyAgent;

  constructor(config: FusebaseConfig) {
    this.host = config.host;
    this.baseUrl = `https://${config.host}`;
    this.orgId = config.orgId;
    this.cookie = config.cookie;
    this.autoRefresh = config.autoRefresh ?? true;
    this.profile = config.profile;
    this.sessionId = crypto.randomUUID().replace(/-/g, "");
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (config.proxyRelayUrl) {
      this.proxyDispatcher = new ProxyAgent(config.proxyRelayUrl);
      console.error(`[client] Using proxy relay: ${config.proxyRelayUrl}`);
    }
  }

  private get headers(): Record<string, string> {
    return {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json",
      cookie: this.cookie,
    };
  }

  // ─── HTTP Layer ───────────────────────────────────────────────

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    // Rate limiting: enforce minimum interval between requests
    const sinceLastReq = Date.now() - this.lastRequestTime;
    if (sinceLastReq < FusebaseClient.MIN_REQUEST_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, FusebaseClient.MIN_REQUEST_INTERVAL_MS - sinceLastReq));
    }
    this.lastRequestTime = Date.now();

    const url = `${this.baseUrl}${path}`;
    const method = (options.method || "GET").toUpperCase();
    const startTime = Date.now();
    const timeout = method === "GET" ? TIMEOUT_GET : TIMEOUT_WRITE;

    const fetchOpts: RequestInit & { dispatcher?: unknown } = {
      ...options,
      headers: {
        ...this.headers,
        ...((options.headers as Record<string, string>) || {}),
      },
      signal: AbortSignal.timeout(timeout),
      ...(this.proxyDispatcher ? { dispatcher: this.proxyDispatcher } : {}),
    };

    let res = await fetch(url, fetchOpts);

    // Auto-retry on auth failure
    if ((res.status === 401 || res.status === 403) && this.autoRefresh) {
      // Log cookie age before attempting refresh
      try {
        const { loadEncryptedCookie } = await import("./crypto.js");
        const stored = loadEncryptedCookie(this.profile);
        if (stored?.savedAt) {
          const ageMs = Date.now() - new Date(stored.savedAt).getTime();
          const ageHours = (ageMs / 3_600_000).toFixed(1);
          console.error(`[client] Cookie age: ${ageHours}h old`);
          if (ageMs > 20 * 3_600_000) {
            console.error(`[client] ⚠ Cookie is >20h old — may need manual re-auth: npx tsx scripts/auth.ts`);
          }
        }
      } catch { /* crypto unavailable */ }

      console.error(
        `[client] Got ${res.status} — attempting cookie refresh...`,
      );
      const refreshed = await this.refreshAuth();
      if (refreshed) {
        res = await fetch(url, {
          ...fetchOpts,
          headers: {
            ...this.headers,
            ...((options.headers as Record<string, string>) || {}),
          },
          signal: AbortSignal.timeout(timeout),
        });
      }
    }

    const elapsed = Date.now() - startTime;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      this.logApiCall(method, path, res.status, elapsed, text.length, false);
      throw new Error(
        `Fusebase API error: ${res.status} ${res.statusText} — ${url}\n${text}`,
      );
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as T;
      const size = JSON.stringify(data).length;
      this.logApiCall(method, path, res.status, elapsed, size, true);
      return data;
    }

    const text = (await res.text()) as unknown as T;
    this.logApiCall(method, path, res.status, elapsed, String(text).length, true);
    return text;
  }

  // ─── Logging ──────────────────────────────────────────────────

  private logApiCall(
    method: string,
    apiPath: string,
    status: number,
    elapsedMs: number,
    responseSize: number,
    success: boolean,
  ): void {
    try {
      const entry = JSON.stringify({
        ts: new Date().toISOString(),
        method,
        path: apiPath.substring(0, 150),
        status,
        ms: elapsedMs,
        bytes: responseSize,
        ok: success,
      });
      fs.appendFileSync(LOG_PATH, entry + "\n");
    } catch {
      // Logging should never crash the server
    }
  }

  // ─── Cache ────────────────────────────────────────────────────

  /** Update the workspace cache file */
  private updateWorkspaceCache(
    workspaces: FusebaseWorkspace[],
  ): void {
    try {
      let cache: Record<string, unknown> = {};
      if (fs.existsSync(CACHE_PATH)) {
        cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
      }
      cache.lastUpdated = new Date().toISOString();
      cache.orgId = this.orgId;
      cache.host = this.host;
      const wsMap: Record<string, unknown> =
        (cache.workspaces as Record<string, unknown>) || {};
      for (const ws of workspaces) {
        const existing = (wsMap[ws.workspaceId] as Record<string, unknown>) || {};
        wsMap[ws.workspaceId] = {
          ...existing,
          title: ws.title,
          color: ws.color,
        };
      }
      cache.workspaces = wsMap;
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    } catch {
      // Cache update should never crash the server
    }
  }

  /** Update folder cache for a workspace */
  private updateFolderCache(
    workspaceId: string,
    folders: FusebaseFolder[],
  ): void {
    try {
      let cache: Record<string, unknown> = {};
      if (fs.existsSync(CACHE_PATH)) {
        cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
      }
      const wsMap = (cache.workspaces as Record<string, Record<string, unknown>>) || {};
      if (!wsMap[workspaceId]) wsMap[workspaceId] = {};
      wsMap[workspaceId].folders = folders.map((f) => ({
        id: f.id.replace("notesFolder#", ""),
        name: f.name,
        parentId: f.parentId,
      }));
      wsMap[workspaceId].foldersUpdated = new Date().toISOString();
      cache.workspaces = wsMap;
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    } catch {
      // Cache update should never crash the server
    }
  }

  // ─── Auth ─────────────────────────────────────────────────────

  /** Update the cookie string at runtime */
  updateCookie(cookie: string): void {
    this.cookie = cookie;
    console.error(
      `[client] Cookie updated (${cookie.length} chars)`,
    );
  }

  /**
   * Refresh authentication cookies via Playwright.
   * First checks if stored cookies are still fresh (skips Playwright if so).
   * Then attempts headless refresh, falls back to headed mode if that fails.
   */
  async refreshAuth(forceFresh = false): Promise<boolean> {
    // Check if stored cookies are still fresh before launching a browser
    if (!forceFresh) {
      try {
        const { isEncryptedCookieFresh, loadEncryptedCookie } = await import("./crypto.js");
        if (isEncryptedCookieFresh(this.profile)) {
          const stored = loadEncryptedCookie(this.profile);
          if (stored?.cookie) {
            console.error("[client] Stored cookies are still fresh — reloading from disk");
            this.updateCookie(stored.cookie);
            return true;
          }
        }
      } catch { /* crypto unavailable */ }
    }

    try {
      // Dynamic import — scripts/ is outside the TS rootDir (src/)
      // so we resolve the path at runtime
      const authPath = new URL("../scripts/auth.js", import.meta.url).pathname;
      const authModule = await import(/* webpackIgnore: true */ authPath);
      const newCookie = await authModule.refreshCookies({
        host: this.host,
        headless: true, // try headless first (reuse stored session)
        profile: this.profile,
      });
      if (newCookie && newCookie.length > 0) {
        this.updateCookie(newCookie);
        // Persist encrypted
        try {
          const { saveEncryptedCookie } = await import("./crypto.js");
          saveEncryptedCookie(newCookie, undefined, this.profile);
        } catch {
          // crypto module unavailable — skip persistence
        }
        return true;
      }
    } catch (error) {
      console.error(
        "[client] Headless auth refresh failed:",
        error instanceof Error ? error.message : error,
      );
    }
    return false;
  }

  /**
   * Manually trigger auth refresh (used by the refresh_auth MCP tool).
   * This runs in headed mode so the user can log in if needed.
   */
  async refreshAuthInteractive(): Promise<boolean> {
    try {
      const authPath = new URL("../scripts/auth.js", import.meta.url).pathname;
      const authModule = await import(/* webpackIgnore: true */ authPath);
      const newCookie = await authModule.refreshCookies({
        host: this.host,
        headless: false,
        profile: this.profile,
      });
      if (newCookie && newCookie.length > 0) {
        this.updateCookie(newCookie);
        return true;
      }
    } catch (error) {
      console.error(
        "[client] Interactive auth refresh failed:",
        error instanceof Error ? error.message : error,
      );
    }
    return false;
  }

  // ─── Workspaces ───────────────────────────────────────────────

  /** List all workspaces in the organization */
  async listWorkspaces(): Promise<FusebaseWorkspace[]> {
    const workspaces = await this.request<FusebaseWorkspace[]>(
      `/gwapi2/ft%3Atasks/workspace-infos?orgId=${this.orgId}`,
    );
    this.updateWorkspaceCache(workspaces);
    return workspaces;
  }

  // ─── Pages (Notes) ────────────────────────────────────────────

  /** List pages in a workspace, optionally filtered by folder */
  async listPages(
    workspaceId: string,
    options?: {
      rootId?: string;
      offset?: number;
      limit?: number;
      type?: "note" | "folder";
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
    },
  ): Promise<NotesListResponse> {
    const opts = {
      rootId: "root",
      offset: 0,
      limit: 100,
      type: "note",
      orderBy: "createdAt",
      orderDir: "ASC",
      ...options,
    };
    const filter = encodeURIComponent(
      JSON.stringify({ type: opts.type, is_portal_share: false }),
    );
    const range = encodeURIComponent(
      JSON.stringify({ offset: opts.offset, limit: opts.limit }),
    );
    const order = encodeURIComponent(
      JSON.stringify([opts.orderBy, opts.orderDir]),
    );
    return this.request<NotesListResponse>(
      `/v2/api/workspaces/${workspaceId}/notes?filter=${filter}&range=${range}&rootId=${opts.rootId}&order=${order}`,
    );
  }

  /** Get a specific page's metadata */
  async getPage(workspaceId: string, noteId: string): Promise<FusebaseNote> {
    return this.request<FusebaseNote>(
      `/v2/api/web-editor/space/${workspaceId}/note/${noteId}`,
    );
  }

  /** Get recent pages in a workspace */
  async getRecentPages(
    workspaceId: string,
    limit = 10,
  ): Promise<RecentNotesResponse> {
    return this.request<RecentNotesResponse>(
      `/v2/api/web-editor/notes/recent/${workspaceId}?count=1&type=note&limit=${limit}&offset=0`,
    );
  }

  /** Create a new page */
  async createPage(
    workspaceId: string,
    title: string,
    parentId = "default",
  ): Promise<FusebaseNote> {
    const noteId = this.generateId();
    return this.request<FusebaseNote>("/v2/api/web-editor/notes/create", {
      method: "POST",
      body: JSON.stringify({
        workspaceId,
        noteId,
        note: {
          textVersion: 2,
          title,
          parentId,
          is_portal_share: false,
        },
      }),
    });
  }

  /** Create a new folder */
  async createFolder(
    workspaceId: string,
    title: string,
    parentId = "default",
  ): Promise<FusebaseNote> {
    const noteId = this.generateId();
    return this.request<FusebaseNote>("/v2/api/web-editor/notes/create", {
      method: "POST",
      body: JSON.stringify({
        workspaceId,
        noteId,
        note: {
          textVersion: 2,
          title,
          parentId,
          type: "folder",
          is_portal_share: false,
        },
      }),
    });
  }

  /** Update page/folder properties (rename, move, etc.) */
  async upsertPage(
    workspaceId: string,
    noteId: string,
    updates: { title?: string; parentId?: string },
  ): Promise<unknown> {
    return this.request<unknown>(
      `/v2/api/workspaces/${workspaceId}/notes/${noteId}/upsert`,
      {
        method: "POST",
        body: JSON.stringify({ note: updates }),
      },
    );
  }

  // ─── Folders ──────────────────────────────────────────────────

  /** List folders in a workspace */
  async listFolders(workspaceId: string): Promise<FusebaseFolder[]> {
    const folders = await this.request<FusebaseFolder[]>(
      `/gwapi2/ft:notes/menu?workspace=${workspaceId}&depth=-1&type=folder&orderBy=title&orderDirection=ASC`,
    );
    this.updateFolderCache(workspaceId, folders);
    return folders;
  }

  // ─── Attachments & Files ──────────────────────────────────────

  /** Get attachments for a specific page */
  async getAttachments(
    workspaceId: string,
    noteId: string,
  ): Promise<FusebaseAttachment[]> {
    return this.request<FusebaseAttachment[]>(
      `/v2/api/web-editor/space/${workspaceId}/note/attachments/${noteId}`,
    );
  }

  /** List files in a workspace */
  async listFiles(
    workspaceId: string,
    limit = 25,
    offset = 0,
  ): Promise<FusebaseFile[]> {
    return this.request<FusebaseFile[]>(
      `/v2/api/workspaces/${workspaceId}/files?showPortalFiles=true&limitSize=${limit}&limitFrom=${offset}&resetCache=true`,
    );
  }

  /**
   * Upload a file to FuseBase and associate it with a page.
   * Two-step process:
   * 1. POST multipart to /v3/api/web-editor/file/v2-upload → returns temp path
   * 2. POST JSON to /v2/api/web-editor/file/attachment → creates attachment record
   *
   * @returns Attachment metadata including globalId and src path
   */
  async uploadFile(
    workspaceId: string,
    noteId: string,
    fileContent: Buffer | Uint8Array,
    filename: string,
    mime: string,
    role: "attachment" | "inline" = "attachment",
  ): Promise<{
    attachmentId: string;
    src: string;
    displayName: string;
    mime: string;
  }> {
    // Step 1: Upload file to temp storage
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileContent) as BlobPart], { type: mime });
    formData.append("file", blob, filename);

    const uploadRes = await fetch(
      `${this.baseUrl}/v3/api/web-editor/file/v2-upload`,
      {
        method: "POST",
        headers: { cookie: this.cookie },
        body: formData,
        signal: AbortSignal.timeout(TIMEOUT_WRITE),
      },
    );

    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => "");
      throw new Error(
        `File upload failed: ${uploadRes.status} ${uploadRes.statusText}\n${text}`,
      );
    }

    const uploadResult = (await uploadRes.json()) as {
      name: string;
      type: string;
      filename: string;
      size: number;
    };

    // Step 2: Associate the uploaded file with the page as an attachment
    const attachmentId = this.generateId();
    await this.request<unknown>("/v2/api/web-editor/file/attachment", {
      method: "POST",
      body: JSON.stringify({
        workspaceId,
        attachmentId,
        noteGlobalId: noteId,
        source: { tempStoredFileName: uploadResult.name },
        displayName: filename,
        mime,
        role,
      }),
    });

    return {
      attachmentId,
      src: `/box/attachment/${workspaceId}/${attachmentId}/${filename}`,
      displayName: filename,
      mime,
    };
  }

  /**
   * Download an attachment file from FuseBase.
   * GETs /box/attachment/{workspaceId}/{attachmentId}/{filename}
   *
   * @returns Object with base64 content, mime type, and size
   */
  async downloadAttachment(
    workspaceId: string,
    attachmentId: string,
    filename: string,
  ): Promise<{
    base64: string;
    mime: string;
    size: number;
  }> {
    const url = `${this.baseUrl}/box/attachment/${workspaceId}/${attachmentId}/${encodeURIComponent(filename)}`;
    const res = await fetch(url, {
      headers: { cookie: this.cookie },
      signal: AbortSignal.timeout(TIMEOUT_GET),
    });

    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "application/octet-stream";

    return {
      base64: buffer.toString("base64"),
      mime,
      size: buffer.length,
    };
  }

  // ─── Tags & Labels ────────────────────────────────────────────

  /** Get tags for a workspace */
  async getTags(workspaceId: string): Promise<FusebaseTag> {
    return this.request<FusebaseTag>(
      `/v2/api/workspaces/${workspaceId}/tags`,
    );
  }

  /** Get tags for a specific page */
  async getPageTags(workspaceId: string, noteId: string): Promise<string[]> {
    return this.request<string[]>(
      `/v2/api/workspaces/${workspaceId}/notes/${noteId}/tags`,
    );
  }

  /** Update tags for a specific page */
  async updatePageTags(
    workspaceId: string,
    noteId: string,
    tags: string[],
  ): Promise<void> {
    await this.request<void>(
      `/v2/api/workspaces/${workspaceId}/notes/${noteId}/tags`,
      { method: "PUT", body: JSON.stringify(tags) },
    );
  }

  /** Get labels for a workspace */
  async getLabels(workspaceId: string): Promise<FusebaseLabel[]> {
    return this.request<FusebaseLabel[]>(
      `/gwapi2/ft%3Aworkspaces/workspaces/${workspaceId}/labels`,
    );
  }

  // ─── Members ──────────────────────────────────────────────────

  /** Get workspace members */
  async getWorkspaceMembers(workspaceId: string): Promise<FusebaseMember[]> {
    return this.request<FusebaseMember[]>(
      `/v2/api/workspaces/${workspaceId}/members`,
    );
  }

  /** Get organization members */
  async getOrgMembers(): Promise<FusebaseOrgMember[]> {
    return this.request<FusebaseOrgMember[]>(
      `/v2/api/orgs/${this.orgId}/membersWithOwner`,
    );
  }

  // ─── Organization ─────────────────────────────────────────────

  /** Get organization usage stats */
  async getOrgUsage(): Promise<OrgUsageResponse> {
    return this.request<OrgUsageResponse>(
      `/v2/api/orgs/${this.orgId}/usage`,
    );
  }

  // ─── Tasks ────────────────────────────────────────────────────

  /** Search tasks in a workspace */
  async searchTasks(
    workspaceId: string,
    options?: { noteId?: string; offset?: number; limit?: number },
  ): Promise<FusebaseTaskSearchResult> {
    const opts = { offset: 0, limit: 50, ...options };
    const filters: Record<string, unknown> = {
      workspaceIds: [workspaceId],
    };
    if (opts.noteId) {
      filters.noteKeys = [`${workspaceId}#${opts.noteId}`];
    }
    return this.request<FusebaseTaskSearchResult>(
      `/gwapi2/ft%3Atasks/tasks/search`,
      {
        method: "POST",
        body: JSON.stringify({
          filters,
          offset: opts.offset,
          limit: opts.limit,
        }),
      },
    );
  }

  // ─── Comments ─────────────────────────────────────────────────

  /** Get comment threads for a page */
  async getCommentThreads(
    workspaceId: string,
    noteId: string,
  ): Promise<FusebaseCommentThread[]> {
    return this.request<FusebaseCommentThread[]>(
      `/gwapi2/svc:comment/workspaces/${workspaceId}/notes/${noteId}/threadsInfo`,
    );
  }

  /**
   * Create a new comment thread on a page block.
   * @param workspaceId - workspace containing the page
   * @param noteId - page (note) to comment on
   * @param text - plain text of the comment (auto-converted to Delta format)
   * @param targetId - optional block ID to anchor the comment to (e.g. "b164359351_1")
   */
  async postComment(
    workspaceId: string,
    noteId: string,
    text: string,
    targetId?: string,
  ): Promise<unknown> {
    const delta = JSON.stringify([{ insert: text + "\n" }]);
    const body: Record<string, unknown> = {
      target: "blot",
      targetId: targetId || "page",
      comment: { text: delta },
      attributes: { workspaceId, noteId },
    };
    return this.request<unknown>(
      `/gwapi2/ft:comments/threads?workspace=${workspaceId}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  /**
   * Reply to an existing comment thread.
   * @param workspaceId - workspace ID
   * @param threadId - the thread ID to reply to (from getCommentThreads)
   * @param text - plain text of the reply (auto-converted to Delta format)
   */
  async replyToThread(
    workspaceId: string,
    threadId: string,
    text: string,
  ): Promise<unknown> {
    const delta = JSON.stringify([{ insert: text + "\n" }]);
    return this.request<unknown>(
      `/gwapi2/ft:comments/comments?workspace=${workspaceId}&thread=${threadId}`,
      {
        method: "POST",
        body: JSON.stringify({ text: delta }),
      },
    );
  }

  /**
   * Resolve (close) a comment thread.
   * @param workspaceId - workspace ID
   * @param threadId - the thread ID to resolve
   */
  async resolveThread(
    workspaceId: string,
    threadId: string,
  ): Promise<unknown> {
    return this.request<unknown>(
      `/gwapi2/ft:comments/threads/${threadId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ workspaceId, resolved: true }),
      },
    );
  }

  // ─── Task Lists & Creation ────────────────────────────────────

  /** List task lists in a workspace, optionally filtered */
  async listTaskLists(
    workspaceId: string,
    options?: { taskListId?: string },
  ): Promise<FusebaseTaskList[]> {
    let path = `/gwapi2/ft%3Atasks/workspaces/${workspaceId}/taskLists`;
    if (options?.taskListId) {
      const filter = encodeURIComponent(
        JSON.stringify({ taskListId: [options.taskListId] }),
      );
      path += `?filter=${filter}&includeBoardColumns=true`;
    }
    return this.request<FusebaseTaskList[]>(path);
  }

  /** Create a task in a workspace */
  async createTask(
    workspaceId: string,
    task: FusebaseCreateTaskPayload,
  ): Promise<unknown> {
    return this.request<unknown>(
      `/gwapi2/ft%3Atasks/workspaces/${workspaceId}/tasks?addToOrder=false`,
      {
        method: "POST",
        body: JSON.stringify(task),
      },
    );
  }

  /** Update a task's properties */
  async updateTask(
    workspaceId: string,
    taskId: string,
    updates: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request<unknown>(
      `/gwapi2/ft%3Atasks/workspaces/${workspaceId}/tasks/${taskId}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
      },
    );
  }

  /** Delete a task */
  async deleteTask(workspaceId: string, taskId: string): Promise<void> {
    await this.request<void>(
      `/gwapi2/ft%3Atasks/workspaces/${workspaceId}/tasks/${taskId}`,
      { method: "DELETE" },
    );
  }

  /** Get task description/detail */
  async getTaskDescription(
    workspaceId: string,
    taskId: string,
  ): Promise<unknown> {
    return this.request<unknown>(
      `/gwapi2/ft%3Atasks/workspaces/${workspaceId}/taskDescriptions/${taskId}`,
    );
  }

  // ─── Page Mutations ───────────────────────────────────────────

  /** Delete a page */
  async deletePage(workspaceId: string, noteId: string): Promise<void> {
    await this.request<void>(
      `/v2/api/web-editor/space/${workspaceId}/note/${noteId}`,
      { method: "DELETE" },
    );
  }

  /** Update page content (write text tokens) */
  async updatePageContent(
    workspaceId: string,
    noteId: string,
    tokens: unknown[],
  ): Promise<unknown> {
    return this.request<unknown>(
      `/v4/api/workspaces/${workspaceId}/texts/${noteId}/tokens`,
      {
        method: "POST",
        body: JSON.stringify({ tokens }),
      },
    );
  }

  // ─── AI Agents ────────────────────────────────────────────────

  /** List AI agents for the org */
  async listAgents(): Promise<FusebaseAgent[]> {
    return this.request<FusebaseAgent[]>(
      `/v4/api/proxy/ai-service/v1/orgs/${this.orgId}/agent-categories/agents?globalId=all`,
    );
  }

  // ─── Mentions ─────────────────────────────────────────────────

  /** Get mentionable entities for a workspace */
  async getMentionEntities(
    workspaceId: string,
  ): Promise<FusebaseMentionEntity[]> {
    return this.request<FusebaseMentionEntity[]>(
      `/v2/api/web-editor/mention-entities/${workspaceId}`,
    );
  }

  // ─── Discovered Endpoints ─────────────────────────────────────

  /** Get the full sidebar/navigation menu tree */
  async getNavigationMenu(): Promise<FusebaseNavMenuItem[]> {
    return this.request<FusebaseNavMenuItem[]>(
      `/gwapi2/ft%3Anotes/menu`,
    );
  }

  /** Get the activity stream for a workspace (comments, mentions, etc.) */
  async getActivityStream(workspaceId: string): Promise<FusebaseActivityItem> {
    return this.request<FusebaseActivityItem>(
      `/gwapi2/svc%3Anotification/workspaces/${workspaceId}/activityStream`,
    );
  }

  /** Get task usage (deadlines, reminders) for a workspace */
  async getTaskUsage(workspaceId: string): Promise<FusebaseTaskUsage> {
    return this.request<FusebaseTaskUsage>(
      `/gwapi2/ft%3Atasks/workspaces/${workspaceId}/usage`,
    );
  }

  /** Get recently updated notes across the org */
  async getRecentlyUpdatedNotes(): Promise<unknown> {
    return this.request<unknown>(
      `/v2/api/note-service-proxy/v1/orgs/${this.orgId}/recentlyUpdatedNotes`,
    );
  }

  /** Get task count for a workspace */
  async getTaskCount(workspaceId: string): Promise<{ count: number }> {
    return this.request<{ count: number }>(
      `/v2/api/task-service-proxy/v1/workspaces/${workspaceId}/tasks/count`,
    );
  }

  /** Get full workspace detail */
  async getWorkspaceDetail(workspaceId: string): Promise<FusebaseWorkspaceDetail> {
    return this.request<FusebaseWorkspaceDetail>(
      `/v2/api/workspace-service-proxy/v1/workspaces/${workspaceId}`,
    );
  }

  /** Get workspace email addresses */
  async getWorkspaceEmails(workspaceId: string): Promise<FusebaseWorkspaceEmail[]> {
    return this.request<FusebaseWorkspaceEmail[]>(
      `/v1/workspaces/${workspaceId}/emails`,
    );
  }

  /** Get file count across workspace */
  async getFileCount(): Promise<{ count: number }> {
    return this.request<{ count: number }>(
      `/v2/api/bucket-service-proxy/v1/files/count`,
    );
  }

  /** Get AI feature usage for the org */
  async getAiUsage(): Promise<{ max: number; current: number }> {
    return this.request<{ max: number; current: number }>(
      `/gwapi2/ft%3Aai/orgs/${this.orgId}/usage`,
    );
  }

  /** Get org permissions with members, avatars, usage */
  async getOrgPermissions(): Promise<FusebaseOrgPermissions> {
    return this.request<FusebaseOrgPermissions>(
      `/gwapi2/ft%3Apermissions/orgs/${this.orgId}/members`,
    );
  }

  /** Get workspace info (quota reset dates, billing) */
  async getWorkspaceInfo(workspaceId: string): Promise<FusebaseWorkspaceInfo> {
    return this.request<FusebaseWorkspaceInfo>(
      `/api/workspaces/${workspaceId}/info`,
    );
  }

  /** Get tags for a specific note/page */
  async getNoteTags(workspaceId: string, noteId: string): Promise<string[]> {
    return this.request<string[]>(
      `/v2/api/workspaces/${workspaceId}/notes/${noteId}/tags`,
    );
  }

  // ─── High-Value Gap Endpoints ──────────────────────────────────

  /** Get page content as HTML via Y.js WebSocket sync + decoder */
  async getPageContent(workspaceId: string, noteId: string): Promise<string> {
    const { readContentViaWebSocket } = await import("./yjs-ws-writer.js");
    const result = await readContentViaWebSocket(this.host, workspaceId, noteId, this.cookie);
    if (!result.success) {
      throw new Error(`Page content read failed: ${result.error}`);
    }
    return result.html || "";
  }

  /** Get database/table view data */
  async getDatabaseData(
    dashboardId: string,
    viewId: string,
    options?: { page?: number; limit?: number },
  ): Promise<FusebaseDatabaseViewData> {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));
    params.set("exclude_async_items", "true");
    const qs = params.toString();
    return this.request<FusebaseDatabaseViewData>(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/data${qs ? `?${qs}` : ""}`,
    );
  }

  /**
   * List all databases/dashboards by probing known entity types in the Tables UI.
   *
   * FuseBase Tables is a Next.js SSR app — entity names are rendered client-side
   * and not available in the initial HTML. Instead, we probe a known set of entity
   * types (spaces, clients) plus any user-supplied custom entities.
   *
   * For each entity, the page HTML contains embedded dashboard/view UUIDs in the
   * React Server Component data. We extract these by:
   * 1. Fetching the databases listing page to collect the "layout" UUID (common to all pages)
   * 2. Fetching each entity page and finding UUIDs not in the layout set
   * 3. The first two unique UUIDs are the dashboardId and viewId
   *
   * @param orgId - Organization ID (defaults to env FUSEBASE_ORG_ID)
   * @param customEntities - Additional entity types to probe beyond the defaults
   * @returns Array of { dashboardId, viewId, entity } objects for use with getDatabaseData
   */
  async listDatabases(
    orgId?: string,
    customEntities?: string[],
  ): Promise<Array<{
    dashboardId: string;
    viewId: string;
    entity: string;
  }>> {
    const org = orgId || this.orgId;
    const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

    // Known FuseBase entity types (discovered via Playwright network capture)
    const KNOWN_ENTITIES = ["spaces", "clients"];
    const entities = [
      ...KNOWN_ENTITIES,
      ...(customEntities || []).filter((e) => !KNOWN_ENTITIES.includes(e)),
    ];

    // Step 1: Fetch databases listing page to collect the "layout" UUID
    const dbRes = await fetch(`${this.baseUrl}/dashboard/${org}/tables/databases`, {
      headers: { cookie: this.cookie },
      signal: AbortSignal.timeout(TIMEOUT_GET),
    });
    if (!dbRes.ok) {
      throw new Error(`Failed to fetch tables page: ${dbRes.status} ${dbRes.statusText}`);
    }
    const dbHtml = await dbRes.text();

    // Collect the "layout" UUID(s) that appear on ALL pages (not entity-specific)
    const layoutUuids = new Set(
      [...new Set(dbHtml.match(UUID_RE) || [])].map((u) => u.toLowerCase()),
    );

    // Step 2: Fetch each entity page and extract its unique UUIDs
    const results: Array<{ dashboardId: string; viewId: string; entity: string }> = [];

    for (const entity of entities) {
      try {
        const entRes = await fetch(
          `${this.baseUrl}/dashboard/${org}/tables/entity/${entity}`,
          {
            headers: { cookie: this.cookie },
            signal: AbortSignal.timeout(TIMEOUT_GET),
          },
        );
        if (!entRes.ok) continue;
        const entHtml = await entRes.text();

        // Get all UUIDs unique to this entity page (not in the layout set)
        const pageUuids = [...new Set(entHtml.match(UUID_RE) || [])]
          .map((u) => u.toLowerCase())
          .filter((u) => !layoutUuids.has(u));

        // The first two unique UUIDs are dashboardId and viewId
        if (pageUuids.length >= 2) {
          results.push({
            dashboardId: pageUuids[0],
            viewId: pageUuids[1],
            entity,
          });
        }
      } catch {
        // Skip entities that fail to load
      }
    }

    return results;
  }

  /**
   * Get a specific database entity's data.
   * Wraps getDatabaseData after discovering the dashboard/view UUIDs
   * for the given entity from the Tables page.
   */
  async getDatabaseEntity(
    entity: string,
    options?: { page?: number; limit?: number },
    orgId?: string,
  ): Promise<FusebaseDatabaseViewData> {
    // First, discover dashboard/view UUIDs
    const databases = await this.listDatabases(orgId);
    const db = databases.find(d => d.entity === entity);

    if (!db) {
      // If we can't match by entity name, try to fetch each and return the first non-empty
      throw new Error(
        `Entity '${entity}' not found. Available entities: ${databases.map(d => d.entity).join(", ") || "none found"}. ` +
        `Tip: Use list_databases first to see available dashboard/view IDs, then call get_database_data directly.`
      );
    }

    return this.getDatabaseData(db.dashboardId, db.viewId, options);
  }

  /**
   * Create a new database (table/kanban) in the organization.
   *
   * Discovered via Playwright capture: POST /v4/api/proxy/dashboard-service/v1/databases
   * Returns 201 with the new database, dashboard, and view UUIDs.
   *
   * @param title - Database title
   * @param options - Optional metadata (description, icon, color)
   * @returns The created database object with dashboard/view UUIDs
   */
  async createDatabase(
    title: string,
    options?: {
      description?: string;
      icon?: string;
      color?: string;
      isPublic?: boolean;
    },
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      global_id: string;
      title: string;
      is_public: boolean;
      metadata: Record<string, unknown>;
      dashboards: Array<{
        global_id: string;
        database_id: string;
        views?: Array<{
          global_id: string;
          [key: string]: unknown;
        }>;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    };
  }> {
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/databases`,
      {
        method: "POST",
        body: JSON.stringify({
          global_id: crypto.randomUUID(),
          title,
          is_public: options?.isPublic ?? false,
          metadata: {
            description: options?.description ?? title,
            icon: options?.icon ?? "default",
            favorite: false,
            color: options?.color ?? "fuchsia",
          },
          scopes: [{ scope_type: "org", scope_id: this.orgId }],
        }),
      },
    );
  }

  /**
   * Add a new row to a database entity table.
   *
   * Discovered via Playwright capture: this uses a Next.js server action,
   * not a standard REST API. The POST goes to the entity page URL with
   * a `next-action` header identifying the server-side function.
   *
   * @param entity - Entity type (e.g. 'clients', 'spaces', 'custom')
   * @param options - Optional databaseId/dashboardId for custom databases
   */
  async addDatabaseRow(
    entity: string,
    options?: {
      databaseId?: string;
      dashboardId?: string;
      orgId?: string;
    },
  ): Promise<unknown> {
    const org = options?.orgId || this.orgId;

    // Build the entity page URL (different for built-in vs custom entities)
    let entityUrl: string;
    const body: Record<string, string> = { orgId: org, entity };

    if (options?.databaseId && options?.dashboardId) {
      // Custom database entity
      entityUrl = `${this.baseUrl}/dashboard/${org}/tables/databases/${options.databaseId}/dashboard/${options.dashboardId}/entity/${entity}`;
      body.databaseId = options.databaseId;
      body.dashboardId = options.dashboardId;
    } else {
      // Built-in entity (clients, spaces)
      entityUrl = `${this.baseUrl}/dashboard/${org}/tables/entity/${entity}`;
    }

    // This is a Next.js server action — requires the next-action header
    // The action ID was discovered from the JS bundle hash
    const res = await fetch(entityUrl, {
      method: "POST",
      headers: {
        cookie: this.cookie,
        "content-type": "text/plain;charset=UTF-8",
        accept: "text/x-component",
        "next-action": "a6bff18e5522fbea54d7a97bf0a4f0979a1771ce",
      },
      body: JSON.stringify([body]),
      signal: AbortSignal.timeout(TIMEOUT_GET),
    });

    if (!res.ok) {
      throw new Error(`addDatabaseRow failed: ${res.status} ${res.statusText}`);
    }

    // Response is RSC flight data, not JSON
    return { success: true, status: res.status, entity };
  }

  /**
   * Delete a row from a database dashboard.
   *
   * Endpoint: DELETE /v4/api/proxy/dashboard-service/v1/dashboards/{dashboardId}/rows/{rowId}
   * Confirmed via browser intercept — standard REST DELETE, not server actions.
   */
  async deleteRow(
    dashboardId: string,
    rowId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/rows/${rowId}`,
      { method: "DELETE" },
    );
  }

  /**
   * Move a kanban card to a different column by updating the grouped column's cell value.
   * This is a convenience wrapper around updateDatabaseCell.
   *
   * @param dashboardId - Dashboard (table) ID
   * @param viewId - View ID
   * @param rowUuid - Row UUID of the card to move
   * @param groupByColumnKey - The column key used for kanban grouping
   * @param newValue - The new value for that column (moves card to that group)
   */
  async moveKanbanCard(
    dashboardId: string,
    viewId: string,
    rowUuid: string,
    groupByColumnKey: string,
    newValue: unknown,
  ): Promise<{ success: boolean; message: string; data?: unknown }> {
    return this.updateDatabaseCell(dashboardId, viewId, rowUuid, groupByColumnKey, newValue);
  }

  /**
   * List available relation targets and existing lookups for a dashboard.
   *
   * Browser-intercepted endpoint:
   * GET /v4/api/proxy/dashboard-service/v1/dashboards/{dashboardId}/allowed-items?source_view_ids={viewId}&include_possible_lookup_items=true
   */
  async listRelations(
    dashboardId: string,
    viewId?: string,
  ): Promise<{ success: boolean; data: unknown }> {
    const qs = viewId
      ? `?source_view_ids=${viewId}&include_possible_lookup_items=true`
      : `?include_possible_lookup_items=true`;
    const result = await this.request<unknown>(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/allowed-items${qs}`,
    );
    return { success: true, data: result };
  }

  /**
   * Create a new table (dashboard) within a database.
   *
   * Browser-intercepted: POST /v4/api/proxy/dashboard-service/v1/dashboards/{dashboardId}/views
   * Body: { "title": "TableName" }
   *
   * Note: In FuseBase, creating a "table" within a database is actually creating a new view
   * that acts as a separate table tab.
   */
  async createDashboardTable(
    dashboardId: string,
    title: string,
  ): Promise<unknown> {
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views`,
      {
        method: "POST",
        body: JSON.stringify({ title }),
      },
    );
  }

  /**
   * Delete a relation by its ID.
   *
   * Endpoint: DELETE /v4/api/proxy/dashboard-service/v1/relations/{relationId}
   */
  async deleteRelation(
    relationId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/relations/${relationId}`,
      { method: "DELETE" },
    );
  }

  // ────────────────────────────────────────────────────
  // Database & Dashboard CRUD (dashboard-service REST API)
  // Discovered via Playwright capture + API probing
  // ────────────────────────────────────────────────────

  /**
   * List all databases in the organization via the dashboard-service REST API.
   *
   * Endpoint: GET /v4/api/proxy/dashboard-service/v1/databases?scope_type=org&scope_id={orgId}
   * Returns 200 with array of database objects including dashboards and views.
   */
  async listAllDatabases(): Promise<{
    success: boolean;
    message: string;
    data: Array<{
      global_id: string;
      title: string;
      is_public: boolean;
      metadata: Record<string, unknown>;
      dashboards: Array<{
        global_id: string;
        database_id: string;
        name: string;
        root_entity: string;
        views?: Array<{ global_id: string; name: string;[key: string]: unknown }>;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    }>;
  }> {
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/databases?scope_type=org&scope_id=${this.orgId}`,
    );
  }

  /**
   * Get detailed information about a specific database.
   *
   * Endpoint: GET /v4/api/proxy/dashboard-service/v1/databases/{dbId}
   * Returns database metadata, scopes, and nested dashboards with their views.
   */
  async getDatabaseDetail(dbId: string): Promise<{
    success: boolean;
    message: string;
    data: {
      global_id: string;
      title: string;
      is_public: boolean;
      metadata: Record<string, unknown>;
      dashboards: Array<{
        global_id: string;
        database_id: string;
        name: string;
        root_entity: string;
        views?: Array<{ global_id: string; name: string;[key: string]: unknown }>;
        [key: string]: unknown;
      }>;
      scopes: Array<{ scope_type: string; scope_id: string }>;
      [key: string]: unknown;
    };
  }> {
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/databases/${dbId}`,
    );
  }

  /**
   * Update a database's title, metadata, or public status.
   *
   * Endpoint: PUT /v4/api/proxy/dashboard-service/v1/databases/{dbId}
   * Note: Uses PUT (PATCH returns 404).
   */
  async updateDatabase(
    dbId: string,
    updates: {
      title?: string;
      description?: string;
      icon?: string;
      color?: string;
      isPublic?: boolean;
      favorite?: boolean;
    },
  ): Promise<{
    success: boolean;
    message: string;
    data: Record<string, unknown>;
  }> {
    const body: Record<string, unknown> = {};
    if (updates.title !== undefined) body.title = updates.title;
    if (updates.isPublic !== undefined) body.is_public = updates.isPublic;

    // Metadata fields are nested
    const metadata: Record<string, unknown> = {};
    if (updates.description !== undefined) metadata.description = updates.description;
    if (updates.icon !== undefined) metadata.icon = updates.icon;
    if (updates.color !== undefined) metadata.color = updates.color;
    if (updates.favorite !== undefined) metadata.favorite = updates.favorite;
    if (Object.keys(metadata).length > 0) body.metadata = metadata;

    return this.request(
      `/v4/api/proxy/dashboard-service/v1/databases/${dbId}`,
      { method: "PUT", body: JSON.stringify(body) },
    );
  }

  /**
   * Delete a database and all its dashboards/tables/views.
   *
   * Endpoint: DELETE /v4/api/proxy/dashboard-service/v1/databases/{dbId}
   * Returns 204 No Content on success.
   */
  async deleteDatabase(dbId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(
      `${this.baseUrl}/v4/api/proxy/dashboard-service/v1/databases/${dbId}`,
      {
        method: "DELETE",
        headers: { cookie: this.cookie },
        signal: AbortSignal.timeout(TIMEOUT_GET),
      },
    );
    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => "");
      throw new Error(`deleteDatabase failed: ${res.status} ${text}`);
    }
    return { success: true, message: "Database deleted successfully" };
  }

  /**
   * Duplicate (copy) a database including tables, views, relations, and optionally data.
   *
   * Endpoint: POST /v4/api/proxy/dashboard-service/v1/databases/copy-from/database?copy_tables=true&copy_views=true&copy_relations=true&copy_data={copyData}&create_default_rows=true
   * Body: { source_database_id: string }
   * Returns 201 with the new database.
   */
  async duplicateDatabase(
    sourceDbId: string,
    options?: { copyData?: boolean },
  ): Promise<{
    success: boolean;
    message: string;
    data: Record<string, unknown>;
  }> {
    const copyData = options?.copyData !== false;
    const qs = `copy_tables=true&copy_views=true&copy_relations=true&copy_data=${copyData}&create_default_rows=true`;
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/databases/copy-from/database?${qs}`,
      {
        method: "POST",
        body: JSON.stringify({
          global_id: crypto.randomUUID(),
          source_database_id: sourceDbId,
          scopes: [{ scope_type: "org", scope_id: this.orgId }],
        }),
      },
    );
  }

  /**
   * Get detailed information about a dashboard (table within a database).
   * Includes the views array, which lists all custom views for this dashboard.
   *
   * Endpoint: GET /v4/api/proxy/dashboard-service/v1/dashboards/{dashboardId}
   * Returns dashboard metadata, root_entity, and nested views.
   */
  async getDashboardDetail(dashboardId: string): Promise<{
    success: boolean;
    message: string;
    data: {
      global_id: string;
      database_id: string;
      name: string;
      root_entity: string;
      is_public: boolean;
      views: Array<{
        global_id: string;
        dashboard_id: string;
        name: string;
        default_view: boolean;
        order: number;
        metadata: Record<string, unknown>;
        [key: string]: unknown;
      }>;
      scopes: Array<{ scope_type: string; scope_id: string }>;
      metadata: Record<string, unknown>;
      [key: string]: unknown;
    };
  }> {
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}`,
    );
  }

  /**
   * Delete a dashboard (table within a database).
   *
   * Endpoint: DELETE /v4/api/proxy/dashboard-service/v1/dashboards/{dashboardId}
   * Returns 200 with success message.
   */
  async deleteDashboard(dashboardId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}`,
      { method: "DELETE" },
    );
  }

  /**
   * Update a view within a dashboard (rename, change filters, sorts).
   *
   * Endpoint: PUT /v4/api/proxy/dashboard-service/v1/dashboards/{dashboardId}/views/{viewId}
   * Note: Uses PUT (PATCH returns 404).
   */
  async updateView(
    dashboardId: string,
    viewId: string,
    updates: {
      name?: string;
      filters?: Array<{ column: string; op: string; value: unknown }>;
      sorts?: Array<{ column: string; direction: "asc" | "desc" }>;
      hidden_columns?: string[];
    },
  ): Promise<{
    success: boolean;
    message: string;
    data: Record<string, unknown>;
  }> {
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      { method: "PUT", body: JSON.stringify(updates) },
    );
  }

  /**
   * Switch a view's representation / display mode.
   *
   * - "table" and "kanban" use: POST .../representations/{type} → 201
   * - "board", "calendar", "timeline", "gallery", "list", "grid" use:
   *   PUT .../views/{viewId} with { default_representation_template_id: type } → 200
   */
  async setViewRepresentation(
    dashboardId: string,
    viewId: string,
    representationType:
      | "table"
      | "kanban"
      | "board"
      | "calendar"
      | "timeline"
      | "gallery"
      | "list"
      | "grid",
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    if (representationType === "table" || representationType === "kanban") {
      return this.request(
        `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/representations/${representationType}`,
        { method: "POST" },
      );
    }
    // board, calendar, timeline, gallery, list, grid use PUT on the view
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          default_representation_template_id: representationType,
        }),
      },
    );
  }

  /**
   * Set the grouping column for a kanban/board view.
   *
   * Sends: POST /dashboards/{id}/views/{id}/representations/{type}
   * with body: { settings: { groupByField: columnKey, displayFields: [...] } }
   */
  async setViewGrouping(
    dashboardId: string,
    viewId: string,
    groupByColumnKey: string,
    representationType: "kanban" | "board" = "kanban",
    displayFields?: string[],
  ): Promise<{
    success: boolean;
    message: string;
    data: Record<string, unknown>;
  }> {
    // If displayFields not provided, fetch schema to get all column keys
    let fields = displayFields;
    if (!fields) {
      try {
        const schema = await this.getViewSchema(dashboardId, viewId);
        fields = schema.columns.map((col) => col.key).filter(Boolean) || [];
      } catch {
        fields = [groupByColumnKey];
      }
    }

    return this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/representations/${representationType}`,
      {
        method: "POST",
        body: JSON.stringify({
          settings: {
            groupByField: groupByColumnKey,
            displayFields: fields,
          },
        }),
      },
    );
  }

  /**
   * Set column width in a view.
   *
   * Sends: PUT /dashboards/{id}/views/{id}
   * with the schema items containing metadata.width for the target column.
   */
  async setColumnWidth(
    dashboardId: string,
    viewId: string,
    columnKey: string,
    width: number,
  ): Promise<{
    success: boolean;
    message: string;
    data: Record<string, unknown>;
  }> {
    // Fetch the current view schema
    const schema = await this.getViewSchema(dashboardId, viewId);
    const items = (schema.rawSchema as any)?.items;
    if (!items || !Array.isArray(items)) {
      throw new Error("Could not retrieve view schema items");
    }

    // Find the target column and set its width
    const targetItem = items.find((item: any) => item.key === columnKey);
    if (!targetItem) {
      throw new Error(`Column with key '${columnKey}' not found in schema`);
    }

    // Ensure metadata exists and set width
    if (!targetItem.metadata) {
      targetItem.metadata = {};
    }
    targetItem.metadata.width = width;

    // PUT the updated schema back
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      {
        method: "PUT",
        body: JSON.stringify({ schema: { items } }),
      },
    );
  }

  /**
   * Create a new view within a dashboard.
   *
   * Endpoint: POST /v4/api/proxy/dashboard-service/v1/dashboards/{dashboardId}/views
   * Returns 201 with the new view.
   */
  async createView(
    dashboardId: string,
    name?: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: { global_id: string; dashboard_id: string; name: string; [key: string]: unknown };
  }> {
    // The API requires global_id, name, AND the full column schema.
    // Fetch schema from the existing default view of this dashboard.
    const detail = await this.getDashboardDetail(dashboardId);
    const defaultViewId = detail.data.views?.[0]?.global_id;
    let schema: unknown = {};
    if (defaultViewId) {
      const viewDetail = await this.request<{ success: boolean; data: { schema: unknown } }>(
        `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${defaultViewId}`,
      );
      schema = viewDetail.data?.schema || {};
    }
    const body = {
      global_id: crypto.randomUUID(),
      name: name || "New View",
      schema,
      filters: { logic: "AND", conditions: [] },
    };
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views`,
      { method: "POST", body: JSON.stringify(body) },
    );
  }

  /**
   * Delete a view from a dashboard. Cannot delete the default view.
   *
   * Endpoint: DELETE /v4/api/proxy/dashboard-service/v1/dashboards/{dashboardId}/views/{viewId}
   */
  async deleteView(
    dashboardId: string,
    viewId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      { method: "DELETE" },
    );
  }

  /**
   * Duplicate an existing view within a dashboard.
   *
   * Creates a new view by copying the source view's schema, filters, and configuration.
   * Uses the createView endpoint with source_view_id to clone the view.
   *
   * @param dashboardId - Dashboard containing the view
   * @param sourceViewId - View to duplicate
   * @param name - Optional name for the new view (defaults to "Copy of {sourceViewId}")
   */
  async duplicateView(
    dashboardId: string,
    sourceViewId: string,
    name?: string,
  ): Promise<{ success: boolean; data: unknown }> {
    // First, get the source view's schema and filters
    const sourceView = await this.request<{ data: Record<string, unknown> }>(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${sourceViewId}`,
    );
    const viewData = (sourceView as any)?.data ?? sourceView;
    const schema = viewData.schema || {};
    const filters = viewData.filters || { logic: "AND", conditions: [] };

    return this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views`,
      {
        method: "POST",
        body: JSON.stringify({
          global_id: crypto.randomUUID(),
          name: name || `Copy of View`,
          schema,
          filters,
          source_view_id: sourceViewId,
        }),
      },
    );
  }

  /**
   * Import CSV data into a new database dashboard.
   *
   * Endpoint: POST /v4/api/proxy/dashboard-service/v1/dashboards/import/csv
   * Accepts multipart form data with the CSV file.
   *
   * @param csvContent - CSV content as a string
   * @param databaseId - Database ID
   * @param dashboardId - Dashboard (table) ID to import into
   * @param viewId - View ID to import into
   * @param options.delimiter - CSV delimiter (default: ",")
   * @param options.mapping - Column mapping array (auto-generated from CSV headers if omitted)
   */
  async importCSV(
    csvContent: string,
    databaseId: string,
    dashboardId: string,
    viewId: string,
    options?: {
      delimiter?: "," | ";" | "|" | "\t" | "^";
      mapping?: Array<{ index: number; type: string; edit_type: string }>;
    },
  ): Promise<{ success: boolean; data: unknown }> {
    const delimiter = options?.delimiter || ",";

    // Auto-generate mapping from CSV headers if not provided
    let mapping = options?.mapping;
    if (!mapping) {
      const firstLine = csvContent.split("\n")[0]?.trim();
      if (firstLine) {
        const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ""));
        mapping = headers.map((_, i) => ({
          index: i,
          type: "string",
          edit_type: "string-single-line",
        }));
      }
    }

    // The FuseBase import API uses a GET request with all params as query strings.
    // File content is sent as a Blob in a multipart POST first, but the actual
    // import trigger is via query params. Based on browser intercept, the flow is:
    // 1. Upload file via the dialog (client-side reads it)
    // 2. GET /dashboards/import/csv?database_id=...&dashboard_id=...&view_id=...&delimiter=...&mapping[columns][0][index]=0&...
    //
    // However, since we're sending CSV content programmatically, we use POST with
    // the file in form data and all other params as query strings.
    const params = new URLSearchParams();
    params.set("database_id", databaseId);
    params.set("dashboard_id", dashboardId);
    params.set("view_id", viewId);
    params.set("delimiter", delimiter);

    if (mapping) {
      for (let i = 0; i < mapping.length; i++) {
        const col = mapping[i];
        params.set(`mapping[columns][${i}][index]`, String(col.index));
        params.set(`mapping[columns][${i}][type]`, col.type);
        params.set(`mapping[columns][${i}][edit_type]`, col.edit_type);
      }
    }

    // Try GET first (as observed in browser), fall back to POST with form data
    const baseEndpoint = `/v4/api/proxy/dashboard-service/v1/dashboards/import/csv`;
    const queryString = params.toString();

    // First, try the GET approach (browser-observed method)
    const getUrl = `${this.baseUrl}${baseEndpoint}?${queryString}`;
    const getRes = await fetch(getUrl, {
      method: "GET",
      headers: { cookie: this.cookie },
      signal: AbortSignal.timeout(TIMEOUT_WRITE),
    });

    if (getRes.ok) {
      try {
        return { success: true, data: await getRes.json() };
      } catch {
        return { success: true, data: await getRes.text() };
      }
    }

    // Fallback: POST with CSV as form data + query params
    const blob = new Blob([csvContent], { type: "text/csv" });
    const formData = new FormData();
    formData.append("file", blob, "import.csv");

    const postUrl = `${this.baseUrl}${baseEndpoint}?${queryString}`;
    const postRes = await fetch(postUrl, {
      method: "POST",
      headers: { cookie: this.cookie },
      body: formData,
      signal: AbortSignal.timeout(TIMEOUT_WRITE),
    });

    if (!postRes.ok) {
      const text = await postRes.text().catch(() => "");
      throw new Error(`importCSV failed: ${postRes.status} ${text}`);
    }
    try {
      return { success: true, data: await postRes.json() };
    } catch {
      return { success: true, data: await postRes.text() };
    }
  }

  /**
   * Rename a column in a database view.
   *
   * Updates the column's name in the view schema via PUT.
   *
   * @param dashboardId - Dashboard containing the view
   * @param viewId - View containing the column
   * @param columnKey - The 8-char column key to rename
   * @param newName - New name for the column
   */
  async renameColumn(
    dashboardId: string,
    viewId: string,
    columnKey: string,
    newName: string,
  ): Promise<{ success: boolean; message: string }> {
    const viewRes = await this.request<{ data: Record<string, unknown> }>(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
    );
    const viewData = (viewRes as any)?.data ?? viewRes;
    const schema = { ...(viewData.schema ?? {}) };
    const items: Array<Record<string, unknown>> = [...((schema as any).items ?? [])];

    const col = items.find((i) => i.key === columnKey);
    if (!col) {
      throw new Error(`Column key "${columnKey}" not found in schema`);
    }
    col.name = newName;

    (schema as any).items = items;
    await this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      { method: "PUT", body: JSON.stringify({ schema }) },
    );

    return { success: true, message: `Column "${columnKey}" renamed to "${newName}"` };
  }

  /**
   * Reorder columns in a database view.
   *
   * Rearranges the schema items array according to the given ordered key list.
   * Keys not in the list are appended at the end in their original order.
   *
   * @param dashboardId - Dashboard containing the view
   * @param viewId - View to reorder columns in
   * @param orderedKeys - Array of column keys in the desired order
   */
  async reorderColumns(
    dashboardId: string,
    viewId: string,
    orderedKeys: string[],
  ): Promise<{ success: boolean; message: string }> {
    const viewRes = await this.request<{ data: Record<string, unknown> }>(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
    );
    const viewData = (viewRes as any)?.data ?? viewRes;
    const schema = { ...(viewData.schema ?? {}) };
    const items: Array<Record<string, unknown>> = [...((schema as any).items ?? [])];

    // Build a map of key → item
    const itemMap = new Map<string, Record<string, unknown>>();
    for (const item of items) {
      itemMap.set(String(item.key), item);
    }

    // Reorder: ordered keys first, then remaining in their original order
    const reordered: Array<Record<string, unknown>> = [];
    const placed = new Set<string>();
    for (const key of orderedKeys) {
      const item = itemMap.get(key);
      if (item) {
        reordered.push(item);
        placed.add(key);
      }
    }
    for (const item of items) {
      if (!placed.has(String(item.key))) {
        reordered.push(item);
      }
    }

    (schema as any).items = reordered;
    await this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      { method: "PUT", body: JSON.stringify({ schema }) },
    );

    return { success: true, message: `Columns reordered: ${orderedKeys.join(", ")}` };
  }

  /**
   * Export a dashboard view as CSV.
   *
   * Endpoint: GET /v4/api/proxy/dashboard-service/v1/dashboards/{dashboardId}/export/csv?view_id={viewId}&delimiter={delimiter}
   * Supported delimiters: comma (,), semicolon (;), pipe (|), tab (\t), caret (^)
   * Returns raw CSV text.
   */
  async exportCSV(
    dashboardId: string,
    viewId: string,
    delimiter: "," | ";" | "|" | "\t" | "^" = ",",
  ): Promise<{ success: boolean; csv: string }> {
    const url = `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/export/csv?view_id=${viewId}&delimiter=${encodeURIComponent(delimiter)}`;
    const res = await fetch(`${this.baseUrl}${url}`, {
      headers: { cookie: this.cookie },
      signal: AbortSignal.timeout(TIMEOUT_GET),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`exportCSV failed: ${res.status} ${text}`);
    }
    const csv = await res.text();
    return { success: true, csv };
  }

  /**
   * Get the column schema for a database view.
   *
   * Schema is returned by the view detail endpoint, nested under data.schema.items[].
   * Each item contains: key (opaque 8-char ID), name, source.custom_type, render config,
   * json_schema, and display/visibility settings.
   *
   * Endpoint: GET /v4/api/proxy/dashboard-service/v1/dashboards/{dashboardId}/views/{viewId}
   */
  async getViewSchema(
    dashboardId: string,
    viewId: string,
  ): Promise<{
    columns: Array<{
      key: string;
      name: string;
      type: string;         // source.custom_type (string, date, label, files, number, etc.)
      editType: string;     // render.edit_type
      hidden: boolean;
      readonly: boolean;
      required: boolean;
      description: string;
      metadata: Record<string, unknown>;
    }>;
    rawSchema: Record<string, unknown>;
  }> {
    const res = await this.request<{ data: Record<string, unknown> }>(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
    );
    const schema = (res as any)?.data?.schema ?? (res as any)?.schema ?? {};
    const items: Array<Record<string, unknown>> = (schema as any).items ?? [];

    const columns = items.map((item) => ({
      key: String(item.key ?? ""),
      name: String(item.name ?? ""),
      type: String((item.source as any)?.custom_type ?? (item.source as any)?.type ?? "unknown"),
      editType: String((item.render as any)?.edit_type ?? "unknown"),
      hidden: Boolean(item.hidden),
      readonly: Boolean(item.readonly),
      required: Boolean(item.required),
      description: String(item.description ?? ""),
      metadata: (item.metadata ?? {}) as Record<string, unknown>,
    }));

    return { columns, rawSchema: schema as Record<string, unknown> };
  }

  /**
   * Add a new column to a database view.
   *
   * Column management in FuseBase uses PUT /views/{viewId} — the same endpoint
   * used for renaming views. To add a column, we:
   * 1. Fetch the current view detail (which contains the full schema)
   * 2. Generate a new column definition matching the FuseBase schema format
   * 3. Append it to schema.items[]
   * 4. PUT the updated schema back to the view
   *
   * Supported column types: string, number, date, label, checkbox, currency,
   * email, phone, link, files
   */
  async addDatabaseColumn(
    dashboardId: string,
    viewId: string,
    name: string,
    columnType: string,
    options?: {
      labels?: Array<{ name: string; color: string }>;
      multiSelect?: boolean;
      description?: string;
    },
  ): Promise<{
    success: boolean;
    message: string;
    column: { key: string; name: string; type: string };
  }> {
    // 1. Fetch current view detail
    const viewRes = await this.request<{ data: Record<string, unknown> }>(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
    );
    const viewData = (viewRes as any)?.data ?? viewRes;
    const schema = { ...(viewData.schema ?? {}) };
    const items: Array<Record<string, unknown>> = [...((schema as any).items ?? [])];

    // 2. Generate a unique 8-char column key (nanoid-style)
    const KEY_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    let newKey = "";
    for (let i = 0; i < 8; i++) {
      newKey += KEY_CHARS.charAt(Math.floor(Math.random() * KEY_CHARS.length));
    }

    // 3. Build column definition based on type
    const colDef = this.buildColumnDefinition(newKey, name, columnType, options);
    items.push(colDef);

    // 4. PUT updated schema
    (schema as any).items = items;
    await this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      { method: "PUT", body: JSON.stringify({ schema }) },
    );

    return {
      success: true,
      message: `Column "${name}" (${columnType}) added with key "${newKey}"`,
      column: { key: newKey, name, type: columnType },
    };
  }

  /**
   * Delete a column from a database view by its key.
   *
   * Works by fetching the current schema, removing the column from items[],
   * and PUTting the updated schema back.
   */
  async deleteDatabaseColumn(
    dashboardId: string,
    viewId: string,
    columnKey: string,
  ): Promise<{ success: boolean; message: string }> {
    // 1. Fetch current view detail
    const viewRes = await this.request<{ data: Record<string, unknown> }>(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
    );
    const viewData = (viewRes as any)?.data ?? viewRes;
    const schema = { ...(viewData.schema ?? {}) };
    const items: Array<Record<string, unknown>> = [...((schema as any).items ?? [])];

    // 2. Find and remove the column
    const idx = items.findIndex((item) => item.key === columnKey);
    if (idx === -1) {
      const available = items.map((i) => `${i.key} (${i.name})`).join(", ");
      throw new Error(`Column key "${columnKey}" not found. Available: ${available}`);
    }
    const removed = items.splice(idx, 1)[0];

    // 3. PUT updated schema
    (schema as any).items = items;
    await this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      { method: "PUT", body: JSON.stringify({ schema }) },
    );

    return {
      success: true,
      message: `Column "${removed.name}" (key: ${columnKey}) deleted`,
    };
  }

  /**
   * Add a Relation column to a database view.
   *
   * Relations are more complex than simple columns — they require:
   * 1. POST /v4/api/proxy/dashboard-service/v1/relations to create the relation link
   * 2. PUT /views/{viewId} to add a lookup-source column referencing the relation
   *
   * The relation links this dashboard to a target dashboard (another table).
   */
  async addRelationColumn(
    dashboardId: string,
    viewId: string,
    name: string,
    targetDashboardId: string,
    targetViewId: string,
    options?: {
      relationType?: "many_to_many" | "one_to_many" | "many_to_one";
    },
  ): Promise<{
    success: boolean;
    message: string;
    column: { key: string; name: string; type: string };
    relationId: string;
  }> {
    const relationType = options?.relationType ?? "many_to_many";

    // 1. Create the relation via dedicated endpoint
    const relationRes = await this.request<{ data: { global_id: string } }>(
      `/v4/api/proxy/dashboard-service/v1/relations`,
      {
        method: "POST",
        body: JSON.stringify({
          source_dashboard_id: dashboardId,
          target_dashboard_id: targetDashboardId,
          relation_type: relationType,
        }),
      },
    );
    const relationId = (relationRes as any)?.data?.global_id ?? (relationRes as any)?.global_id;
    if (!relationId) {
      throw new Error(`Failed to create relation: ${JSON.stringify(relationRes)}`);
    }

    // 2. Get target view schema to find the Name column key
    const targetViewRes = await this.request<{ data: Record<string, unknown> }>(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${targetDashboardId}/views/${targetViewId}`,
    );
    const targetItems: Array<Record<string, unknown>> = ((targetViewRes as any)?.data?.schema?.items ?? []);
    // Use the first string column (usually "Name") as the lookup field
    const nameCol = targetItems.find((i: any) => i.source?.custom_type === "string") ?? targetItems[0];
    const targetItemKey = String(nameCol?.key ?? "");

    // 3. Fetch source view schema and add the relation column
    const viewRes = await this.request<{ data: Record<string, unknown> }>(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
    );
    const viewData = (viewRes as any)?.data ?? viewRes;
    const schema = { ...(viewData.schema ?? {}) };
    const items: Array<Record<string, unknown>> = [...((schema as any).items ?? [])];

    const KEY_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    let newKey = "";
    for (let i = 0; i < 8; i++) newKey += KEY_CHARS.charAt(Math.floor(Math.random() * KEY_CHARS.length));

    // Build the lookup-source column definition that references the relation
    const colDef = {
      key: newKey,
      name,
      description: "A custom short text field",
      group_ids: ["lookup"],
      source: {
        _type_lookup: true,
        type: "lookup",
        selectable: true,
        relations: [{
          relation_id: relationId,
          dashboard_id: targetDashboardId,
          view_id: targetViewId,
          item_key: targetItemKey,
          reverse: false,
          relation_type: relationType,
        }],
      },
      json_schema: {
        type: "array",
        items: {
          type: "object",
          required: ["value", "occurrences", "relation"],
          properties: {
            value: { type: "string" },
            relation: {
              type: "object",
              required: ["relationId", "dashboardId", "viewId", "itemKey", "reverse", "relationType"],
              properties: {
                viewId: { type: "string" },
                itemKey: { type: "string" },
                reverse: { type: "boolean" },
                relationId: { type: "string" },
                dashboardId: { type: "string" },
                relationType: { type: "string" },
              },
            },
            errorCode: { type: "string" },
            occurrences: { type: "number" },
          },
          additionalProperties: true,
        },
      },
      render: {
        is_lookup: true, edit_type: "string-single-line",
        type: "string", _type_string: true,
        text_wrap: "truncate", multi_line: false,
      },
      hidden: false,
      readonly: false,
      unique: false,
      required: false,
      async: false,
      index: {
        fields: [{ path: "$['{key}']", type: "TEXT", alias: "{key}", options: { sortable: true } }],
        enabled: true, conditions: "text",
      },
      show_mode: { detailed: true, dashboard: true },
      metadata: {},
    };

    items.push(colDef);
    (schema as any).items = items;
    await this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      { method: "PUT", body: JSON.stringify({ schema }) },
    );

    return {
      success: true,
      message: `Relation column "${name}" added with key "${newKey}", linked to dashboard ${targetDashboardId}`,
      column: { key: newKey, name, type: "relation" },
      relationId,
    };
  }

  /**
   * Add a Lookup column to a database view.
   *
   * Lookup columns display data from a related table through an existing
   * relation column. They use source.type = "lookup" with a relations[] array.
   *
   * @param relationColumnKey - The key of the existing relation column to look through
   * @param lookupFieldKey - The key of the field in the related table to display (optional, defaults to Name)
   */
  async addLookupColumn(
    dashboardId: string,
    viewId: string,
    name: string,
    relationColumnKey: string,
    lookupFieldKey?: string,
  ): Promise<{
    success: boolean;
    message: string;
    column: { key: string; name: string; type: string };
  }> {
    // 1. Fetch current schema and find the relation column
    const viewRes = await this.request<{ data: Record<string, unknown> }>(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
    );
    const viewData = (viewRes as any)?.data ?? viewRes;
    const schema = { ...(viewData.schema ?? {}) };
    const items: Array<Record<string, unknown>> = [...((schema as any).items ?? [])];

    const relationCol = items.find((i: any) => i.key === relationColumnKey);
    if (!relationCol) {
      const available = items.map((i: any) => `${i.key} (${i.name})`).join(", ");
      throw new Error(`Relation column key "${relationColumnKey}" not found. Available: ${available}`);
    }

    const relSource = (relationCol as any).source;
    if (!relSource?.relations?.length) {
      throw new Error(`Column "${(relationCol as any).name}" is not a relation column (no relations[] in source)`);
    }

    // 2. Build the lookup column using the relation's config
    const firstRelation = relSource.relations[0];
    const targetDashId = firstRelation.dashboard_id;
    const targetViewId = firstRelation.view_id;
    const relationType = firstRelation.relation_type;
    const relationId = firstRelation.relation_id;

    // If lookupFieldKey not provided, find the Name field in the target view
    let targetItemKey = lookupFieldKey;
    if (!targetItemKey) {
      const targetViewRes = await this.request<{ data: Record<string, unknown> }>(
        `/v4/api/proxy/dashboard-service/v1/dashboards/${targetDashId}/views/${targetViewId}`,
      );
      const targetItems: Array<Record<string, unknown>> = ((targetViewRes as any)?.data?.schema?.items ?? []);
      const nameCol = targetItems.find((i: any) => i.source?.custom_type === "string") ?? targetItems[0];
      targetItemKey = String(nameCol?.key ?? "");
    }

    const KEY_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    let newKey = "";
    for (let i = 0; i < 8; i++) newKey += KEY_CHARS.charAt(Math.floor(Math.random() * KEY_CHARS.length));

    const lookupDef = {
      key: newKey,
      name,
      description: "A lookup field",
      group_ids: ["lookup"],
      source: {
        _type_lookup: true,
        type: "lookup",
        selectable: false,
        relations: [{
          relation_id: relationId,
          dashboard_id: targetDashId,
          view_id: targetViewId,
          item_key: targetItemKey,
          reverse: false,
          relation_type: relationType,
        }],
      },
      json_schema: {
        type: "array",
        items: {
          type: "object",
          required: ["value", "occurrences", "relation"],
          properties: {
            value: { type: "string" },
            relation: {
              type: "object",
              required: ["relationId", "dashboardId", "viewId", "itemKey", "reverse", "relationType"],
              properties: {
                viewId: { type: "string" },
                itemKey: { type: "string" },
                reverse: { type: "boolean" },
                relationId: { type: "string" },
                dashboardId: { type: "string" },
                relationType: { type: "string" },
              },
            },
            errorCode: { type: "string" },
            occurrences: { type: "number" },
          },
          additionalProperties: true,
        },
      },
      render: {
        is_lookup: true, edit_type: "string-single-line",
        type: "string", _type_string: true,
        text_wrap: "truncate", multi_line: false,
      },
      hidden: false,
      readonly: true,
      unique: false,
      required: false,
      async: false,
      index: {
        fields: [{ path: "$['{key}']", type: "TEXT", alias: "{key}", options: { sortable: true } }],
        enabled: true, conditions: "text",
      },
      show_mode: { detailed: true, dashboard: true },
      metadata: {},
    };

    items.push(lookupDef);
    (schema as any).items = items;
    await this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      { method: "PUT", body: JSON.stringify({ schema }) },
    );

    return {
      success: true,
      message: `Lookup column "${name}" added with key "${newKey}", looking up field in related table`,
      column: { key: newKey, name, type: "lookup" },
    };
  }

  /**
   * Build a FuseBase-compatible column definition for a given type.
   * Based on the schema structure discovered from view detail responses.
   */
  private buildColumnDefinition(
    key: string,
    name: string,
    columnType: string,
    options?: {
      labels?: Array<{ name: string; color: string }>;
      multiSelect?: boolean;
      description?: string;
    },
  ): Record<string, unknown> {
    const base = {
      key,
      name,
      description: options?.description ?? `A custom ${columnType} field`,
      group_ids: ["custom"],
      hidden: false,
      readonly: false,
      unique: false,
      required: false,
      async: false,
      show_mode: { detailed: true, dashboard: true },
      metadata: {},
    };

    switch (columnType) {
      case "string":
      case "text":
        return {
          ...base,
          source: { _type_custom: true, type: "custom", custom_type: "string" },
          json_schema: { type: "string" },
          render: {
            is_lookup: false, edit_type: "string-single-line",
            type: "string", _type_string: true,
            text_wrap: "truncate", multi_line: false,
          },
          index: {
            fields: [{ path: `$['{key}']`, type: "TEXT", alias: "{key}", options: { sortable: true } }],
            enabled: true, conditions: "text",
          },
        };

      case "multiline":
      case "description":
        return {
          ...base,
          source: { _type_custom: true, type: "custom", custom_type: "string" },
          json_schema: { type: "string" },
          render: {
            is_lookup: false, edit_type: "string-multi-line",
            type: "string", _type_string: true,
            text_wrap: "wrap", multi_line: true,
          },
          index: {
            fields: [{ path: `$['{key}']`, type: "TEXT", alias: "{key}", options: { sortable: true } }],
            enabled: true, conditions: "text",
          },
        };

      case "number":
        return {
          ...base,
          source: { _type_custom: true, type: "custom", custom_type: "number" },
          json_schema: { type: "number" },
          render: {
            is_lookup: false, edit_type: "number",
            type: "number", _type_number: true,
          },
          index: {
            fields: [{ path: `$['{key}']`, type: "NUMERIC", alias: "{key}", options: { sortable: true } }],
            enabled: true, conditions: "number",
          },
        };

      case "date":
        return {
          ...base,
          source: { _type_custom: true, type: "custom", custom_type: "date" },
          json_schema: { type: "string", format: "date-time" },
          render: {
            is_lookup: false, edit_type: "date",
            type: "date", _type_date: true,
            date_render: "auto", date_format: "date",
            time_format: "24h", time_zone: "UTC",
          },
          index: {
            fields: [{
              path: `$['{key}_unix']`, type: "NUMERIC", alias: "{key}",
              source: { path: `$['{key}']`, transform_func: "ISOtoUnixTimestamp" },
              options: { sortable: true },
            }],
            enabled: true, conditions: "date",
          },
          transform: { func: "transformDate" },
        };

      case "multiselect":
      case "multi_select":
      case "multi-select":
        return this.buildColumnDefinition(key, name, "select", { ...options, multiSelect: true });

      case "label":
      case "status":
      case "select":
        return {
          ...base,
          source: { _type_custom: true, type: "custom", custom_type: "label" },
          json_schema: { type: "array", items: { type: "string" } },
          render: {
            is_lookup: false, edit_type: "label",
            type: "label", _type_label: true,
            multi_select: options?.multiSelect ?? false,
            labels: (options?.labels ?? [
              { nanoid: this.nanoid(), name: "Option 1", color: "gray" },
              { nanoid: this.nanoid(), name: "Option 2", color: "purple" },
              { nanoid: this.nanoid(), name: "Option 3", color: "green" },
            ]).map((l) => ({ nanoid: this.nanoid(), ...l })),
          },
          index: {
            fields: [{ path: `$['{key}'][*]`, type: "TAG", alias: "{key}", options: { sortable: true } }],
            enabled: true, conditions: "label",
          },
        };

      case "checkbox":
      case "boolean":
        return {
          ...base,
          source: { _type_custom: true, type: "custom", custom_type: "boolean" },
          json_schema: { type: "boolean" },
          render: {
            is_lookup: false, edit_type: "boolean",
            type: "boolean", _type_boolean: true,
          },
          index: {
            fields: [{ path: `$['{key}']`, type: "TAG", alias: "{key}", options: { sortable: true } }],
            enabled: true, conditions: "checkbox",
          },
        };

      case "email":
        return {
          ...base,
          source: { _type_custom: true, type: "custom", custom_type: "email" },
          json_schema: { type: "string", format: "email" },
          render: {
            is_lookup: false, edit_type: "email",
            type: "email", _type_email: true,
          },
          index: {
            fields: [{ path: `$['{key}']`, type: "TEXT", alias: "{key}", options: { sortable: true } }],
            enabled: true, conditions: "text",
          },
        };

      case "phone":
        return {
          ...base,
          source: { _type_custom: true, type: "custom", custom_type: "phone" },
          json_schema: { type: "string" },
          render: {
            is_lookup: false, edit_type: "phone",
            type: "phone", _type_phone: true,
          },
          index: {
            fields: [{ path: `$['{key}']`, type: "TEXT", alias: "{key}", options: { sortable: true } }],
            enabled: true, conditions: "text",
          },
        };

      case "link":
      case "url":
        return {
          ...base,
          source: { _type_custom: true, type: "custom", custom_type: "link" },
          json_schema: { type: "string" },
          render: {
            is_lookup: false, edit_type: "link",
            type: "link", _type_link: true,
          },
          index: {
            fields: [{ path: `$['{key}']`, type: "TEXT", alias: "{key}", options: { sortable: true } }],
            enabled: true, conditions: "text",
          },
        };

      case "currency":
        return {
          ...base,
          source: { _type_custom: true, type: "custom", custom_type: "currency" },
          json_schema: { type: "number" },
          render: {
            is_lookup: false, edit_type: "currency",
            type: "currency", _type_currency: true,
            currency_code: "USD", currency_symbol: "$",
          },
          index: {
            fields: [{ path: `$['{key}']`, type: "NUMERIC", alias: "{key}", options: { sortable: true } }],
            enabled: true, conditions: "number",
          },
        };

      case "percent":
      case "percentage":
        return {
          ...base,
          source: { _type_custom: true, type: "custom", custom_type: "number" },
          json_schema: { type: "number" },
          render: {
            is_lookup: false, edit_type: "number",
            type: "number", _type_number: true,
            format: "percent",
          },
          index: {
            fields: [{ path: `$['{key}']`, type: "NUMERIC", alias: "{key}", options: { sortable: true } }],
            enabled: true, conditions: "number",
          },
        };

      case "files":
        return {
          ...base,
          source: { _type_custom: true, type: "custom", custom_type: "files" },
          json_schema: {
            type: "object",
            required: ["context", "files"],
            properties: {
              files: { type: "array", items: { type: "object", required: ["name", "url"], properties: { url: { type: "string" }, name: { type: "string" }, size: { type: "number" }, type: { type: "string" } } } },
              context: { type: "object", required: ["workspaceId", "target"], properties: { workspaceId: { type: "string" }, target: { type: "string" } } },
            },
          },
          render: {
            is_lookup: false, edit_type: "files",
            type: "files", _type_files: true,
          },
          transform: { func: "enrichFileContext" },
        };

      case "user":
      case "assignee":
        return {
          ...base,
          source: { _type_custom: true, type: "custom", custom_type: "assignee" },
          json_schema: { type: "array", items: { type: "string" } },
          render: {
            is_lookup: false, edit_type: "assignee",
            type: "assignee", _type_assignee: true,
            multi_select: options?.multiSelect ?? false,
          },
          index: {
            fields: [{ path: `$['{key}'][*]`, type: "TAG", alias: "{key}", options: { sortable: true } }],
            enabled: true, conditions: "array",
          },
        };

      case "subtable":
      case "child-table-link":
        return {
          ...base,
          source: {
            _type_custom: true, type: "custom", custom_type: "child-table-link",
            template: { search_in_template_org: true },
            default_representation_template_id: "table",
          },
          json_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              childTableId: { type: ["string", "null"] },
              childTableViewId: { type: ["string", "null"] },
            },
          },
          render: {
            is_lookup: false, edit_type: "child-table-link",
            type: "child-table-link", _type_child_table_link: true,
            required: true,
          },
          index: {
            fields: [{ path: "$['{key}'].title", type: "TEXT", alias: "{key}", options: { sortable: true } }],
            enabled: true, conditions: "text",
          },
        };

      default:
        // Fallback: treat as string
        return {
          ...base,
          source: { _type_custom: true, type: "custom", custom_type: columnType },
          json_schema: { type: "string" },
          render: {
            is_lookup: false, edit_type: "string-single-line",
            type: "string", _type_string: true,
            text_wrap: "truncate", multi_line: false,
          },
        };
    }
  }

  /** Generate a short nanoid-style ID for label items */
  private nanoid(length = 8): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < length; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  /**
   * Update a single cell value in a database row.
   *
   * Endpoint: PUT /v4/api/proxy/dashboard-service/v1/dashboards/{dashboardId}/views/{viewId}/data
   *
   * The rowUuid and columnKey can be obtained via getDatabaseRows or getDatabaseData.
   * Column keys are short opaque strings (e.g. "eoZSNDPy") from the database schema.
   *
   * Note: Rich-text / relation / file columns may not accept plain string values.
   */
  async updateDatabaseCell(
    dashboardId: string,
    viewId: string,
    rowUuid: string,
    columnKey: string,
    value: unknown,
  ): Promise<{ success: boolean; message: string; data?: unknown }> {
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/data`,
      {
        method: "PUT",
        body: JSON.stringify({
          root_index_key: "rowUuid",
          root_index_value: rowUuid,
          item_key: columnKey,
          data: { value },
        }),
      },
    );
  }

  /**
   * Get rows from a database view, formatted for easy agent consumption.
   *
   * Each row includes:
   *   - rowUuid: the row's unique ID (the `root_index_value` field from the API, needed for updateDatabaseCell)
   *   - cells: flat map of { columnKey: value } — columnKey is an opaque short string like "eoZSNDPy"
   *
   * The columnKeys array lists all column keys found in the first row, so the caller
   * can identify which key to use when calling updateDatabaseCell.
   *
   * NOTE: The FuseBase API does not return human-readable column names in the data response.
   * To see column names alongside keys, use get_database_data which may include schema
   * in some database configurations.
   *
   * @param page - Page number (default 1)
   * @param limit - Rows per page (default 50)
   */
  async getDatabaseRows(
    dashboardId: string,
    viewId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{
    rows: Array<{
      rowUuid: string;
      cells: Record<string, unknown>;  // { columnKey: value }
    }>;
    columnKeys: string[];   // column key list from first row
    meta: { total: number; page: number; limit: number; total_pages: number };
  }> {
    const raw = await this.getDatabaseData(dashboardId, viewId, options) as any;

    const dataRows: Array<Record<string, unknown>> = raw.data ?? raw.rows ?? [];

    const rows = dataRows.map((row) => {
      // The row UUID is stored in the `root_index_value` field
      const rowUuid = String(row.root_index_value ?? "");
      const cells: Record<string, unknown> = {};

      for (const [k, v] of Object.entries(row)) {
        if (k === "root_index_value") continue; // skip the UUID field
        cells[k] = v;
      }

      return { rowUuid, cells };
    });

    // Derive column keys from the first row (if any)
    const firstRow = dataRows[0];
    const columnKeys = firstRow
      ? Object.keys(firstRow).filter(k => k !== "root_index_value")
      : [];

    const meta = raw.meta ?? {
      total: rows.length, page: 1, limit: rows.length, total_pages: 1,
    };

    return { rows, columnKeys, meta };
  }

  async getOrgLimits(): Promise<FusebaseOrgLimits> {
    return this.request<FusebaseOrgLimits>(
      `/v2/api/orgs/${this.orgId}/limits`,
    );
  }

  /** Get condensed usage summary */
  async getUsageSummary(): Promise<FusebaseUsageSummary> {
    return this.request<FusebaseUsageSummary>(
      `/v2/api/orgs/${this.orgId}/usageSummary`,
    );
  }

  /** List client portals */
  async listPortals(workspaceId?: string): Promise<FusebasePortal[]> {
    if (workspaceId) {
      return this.request<FusebasePortal[]>(
        `/v1/portals/orgs/${this.orgId}/portals?workspaceId=${workspaceId}`,
      );
    }
    return this.request<FusebasePortal[]>(
      `/v2/api/portal-service-proxy/v1/orgs/${this.orgId}/portals`,
    );
  }

  /** Get portal pages */
  async getPortalPages(
    workspaceId: string,
    noteId?: string,
  ): Promise<FusebasePortalPage[]> {
    const params = new URLSearchParams({ workspaceId });
    if (noteId) params.set("noteId", noteId);
    return this.request<FusebasePortalPage[]>(
      `/v4/api/portal/pages?${params.toString()}`,
    );
  }

  /** Get org feature flags */
  async getOrgFeatures(): Promise<FusebaseOrgFeature[]> {
    return this.request<FusebaseOrgFeature[]>(
      `/v1/organizations/${this.orgId}/features`,
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────

  /** Generate a random ID matching Fusebase's format (16-char alphanumeric) */
  private generateId(): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 16; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }
}
