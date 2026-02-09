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
import type {
  FusebaseConfig,
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

  constructor(config: FusebaseConfig) {
    this.host = config.host;
    this.baseUrl = `https://${config.host}`;
    this.orgId = config.orgId;
    this.cookie = config.cookie;
    this.autoRefresh = config.autoRefresh ?? true;
    fs.mkdirSync(DATA_DIR, { recursive: true });
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
    };

    let res = await fetch(url, fetchOpts);

    // Auto-retry on auth failure
    if ((res.status === 401 || res.status === 403) && this.autoRefresh) {
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
   * Attempts headless first (reusing persistent session),
   * falls back to headed mode if that fails.
   */
  async refreshAuth(): Promise<boolean> {
    try {
      // Dynamic import — scripts/ is outside the TS rootDir (src/)
      // so we resolve the path at runtime
      const authPath = new URL("../scripts/auth.js", import.meta.url).pathname;
      const authModule = await import(/* webpackIgnore: true */ authPath);
      const newCookie = await authModule.refreshCookies({
        host: this.host,
        headless: true, // try headless first (reuse stored session)
      });
      if (newCookie && newCookie.length > 0) {
        this.updateCookie(newCookie);
        // Persist encrypted
        try {
          const { saveEncryptedCookie } = await import("./crypto.js");
          saveEncryptedCookie(newCookie);
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

  /** Get raw page content (HTML dump) */
  async getPageContent(workspaceId: string, noteId: string): Promise<string> {
    return this.request<string>(`/dump/${workspaceId}/${noteId}`);
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

  /** Get org plan limits */
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
