/**
 * Fusebase HTTP client — wraps all API calls to the Fusebase platform.
 * Auth is cookie-based (browser session cookies).
 * Supports automatic 401 retry via Playwright-based cookie refresh.
 * Logs all API calls to data/api_log.jsonl for debugging and learning.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { ProxyAgent } from "undici";
import { FusebaseGateBridge } from "./gate-bridge.js";
import { apiPath } from "./url-path.js";

export interface FusebaseConfig {
  host: string;
  orgId: string;
  cookie?: string;
  token?: string;
  gateToken?: string;
  dashboardsToken?: string;
  gateBridge?: FusebaseGateBridge;
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
  DashboardViewColumn,
  BatchPutDashboardRow,
  DatabaseAliasResolution,
  IsolatedStore,
  IsolatedStoreSqlResult,
  NotesListResponse,
  RecentNotesResponse,
  OrgUsageResponse,
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "data");
const LOG_PATH = path.join(DATA_DIR, "api_log.jsonl");
const CACHE_PATH = path.join(DATA_DIR, "workspace_cache.json");

/** Default timeouts (ms) */
const TIMEOUT_GET = 10_000;
const TIMEOUT_WRITE = 20_000;
/**
 * Attempt to repair JSON truncated by upstream proxy serialization limits.
 * Strips dangling unclosed keys or trailing commas and closes brackets.
 */
function tryRepairTruncatedJson(text: string): Record<string, unknown> | null {
  let sanitized = text.trim();
  sanitized = sanitized.replace(/,\s*"[^"]*"?\s*$/, "");
  sanitized = sanitized.replace(/,\s*$/, "");
  if (!sanitized.endsWith("}")) {
    sanitized += "}";
  }
  try {
    return JSON.parse(sanitized);
  } catch {
    return null;
  }
}

export class FusebaseClient {
  private baseUrl: string;
  private orgId: string;
  private cookie: string;
  private token?: string;
  private gateToken?: string;
  private dashboardsToken?: string;
  public gateBridge?: FusebaseGateBridge;
  private host: string;
  private autoRefresh: boolean;
  private profile?: string;
  private sessionId: string;
  private lastRequestTime: number = 0;
  private static readonly MIN_REQUEST_INTERVAL_MS = 200;
  private proxyDispatcher?: ProxyAgent;
  private automationToken?: string;
  private automationProjectId?: string;
  private viewSchemaCache = new Map<string, {
    columns: DashboardViewColumn[];
    keyByName: Map<string, string>;
    nameByKey: Map<string, string>;
  }>();

  public getCookie(): string {
    return this.cookie;
  }

  public getTokens(): { token?: string; gateToken?: string; dashboardsToken?: string } {
    return {
      token: this.token,
      gateToken: this.gateToken,
      dashboardsToken: this.dashboardsToken,
    };
  }

  constructor(config: FusebaseConfig) {
    this.host = config.host;
    this.baseUrl = `https://${config.host}`;
    this.orgId = config.orgId;
    this.cookie = config.cookie || "";
    this.token = config.token;
    this.gateToken = config.gateToken;
    this.dashboardsToken = config.dashboardsToken;
    this.gateBridge = config.gateBridge;
    this.autoRefresh = config.autoRefresh ?? true;
    this.profile = config.profile;
    this.sessionId = crypto.randomUUID().replace(/-/g, "");
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (config.proxyRelayUrl) {
      this.proxyDispatcher = new ProxyAgent(config.proxyRelayUrl);
      console.error("[client] Using local proxy relay");
    }
  }

  /** Ensure ActivePieces automation auth token and projectId are resolved */
  async ensureAutomationAuth(): Promise<{ token: string; projectId: string }> {
    if (this.automationToken && this.automationProjectId) {
      return { token: this.automationToken, projectId: this.automationProjectId };
    }
    if (!this.cookie) {
      return { token: "", projectId: "" };
    }
    const match = this.cookie.match(/eversessionid=([^;]+)/);
    const sessionId = match ? match[1].trim() : this.sessionId;
    try {
      const res = await fetch(`${this.baseUrl}/automation/api/v1/authentication/fusebase-auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: this.cookie,
        },
        body: JSON.stringify({ sessionId }),
        ...(this.proxyDispatcher ? { dispatcher: this.proxyDispatcher } : {}),
      } as RequestInit);
      if (res.ok) {
        const data = (await res.json()) as { token?: string; projectId?: string };
        if (data.token) this.automationToken = data.token;
        if (data.projectId) this.automationProjectId = data.projectId;
      }
    } catch {
      // ignore
    }
    return {
      token: this.automationToken || "",
      projectId: this.automationProjectId || "",
    };
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json",
    };
    if (this.cookie) {
      h["cookie"] = this.cookie;
    }
    const token = this.token || this.gateToken;
    if (token) {
      h["authorization"] = `Bearer ${token}`;
    }
    return h;
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

    // For automation endpoints, resolve bearer token and projectId
    if (path.startsWith("/automation/") && !path.includes("/authentication/fusebase-auth")) {
      if (!this.automationToken) {
        await this.ensureAutomationAuth();
      }
    }

    const reqHeaders: Record<string, string> = {
      ...this.headers,
      ...((options.headers as Record<string, string>) || {}),
    };

    if (method === "DELETE" && !options.body) {
      delete reqHeaders["content-type"];
    }

    if (path.startsWith("/automation/") && !path.includes("/authentication/fusebase-auth")) {
      const match = this.cookie ? this.cookie.match(/eversessionid=([^;]+)/) : null;
      if (match && match[1]) {
        reqHeaders["FBS-Session-ID"] = match[1].trim();
      }
      if (this.automationToken) {
        reqHeaders["Authorization"] = `Bearer ${this.automationToken}`;
      }
    }

    const fetchOpts: RequestInit & { dispatcher?: unknown } = {
      ...options,
      headers: reqHeaders,
      signal: AbortSignal.timeout(timeout),
      ...(this.proxyDispatcher ? { dispatcher: this.proxyDispatcher } : {}),
    };

    let res = await fetch(url, fetchOpts);

    // Auto-retry on auth failure (skip on automation endpoints since automation uses JWT tokens, not main browser session)
    const isAutomation = path.includes("/automation/");
    if (res.status === 401 || (res.status === 403 && !isAutomation)) {
      // If automation token failed with 401, re-fetch automation auth first
      if (res.status === 401 && isAutomation && !path.includes("/authentication/fusebase-auth")) {
        this.automationToken = undefined;
        this.automationProjectId = undefined;
        await this.ensureAutomationAuth();
        if (this.automationToken) {
          reqHeaders["Authorization"] = `Bearer ${this.automationToken}`;
          res = await fetch(url, {
            ...fetchOpts,
            headers: reqHeaders,
            signal: AbortSignal.timeout(timeout),
          });
        }
      }

      if (!isAutomation && !res.ok && (res.status === 401 || res.status === 403) && this.autoRefresh && Boolean(this.cookie)) {
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
          this.automationToken = undefined;
          this.automationProjectId = undefined;
          const retryHeaders: Record<string, string> = {
            ...this.headers,
            ...((options.headers as Record<string, string>) || {}),
          };
          if (path.startsWith("/automation/") && !path.includes("/authentication/fusebase-auth")) {
            await this.ensureAutomationAuth();
            const match = this.cookie ? this.cookie.match(/eversessionid=([^;]+)/) : null;
            if (match && match[1]) {
              retryHeaders["FBS-Session-ID"] = match[1].trim();
            }
            if (this.automationToken) {
              retryHeaders["Authorization"] = `Bearer ${this.automationToken}`;
            }
          }
          res = await fetch(url, {
            ...fetchOpts,
            headers: retryHeaders,
            signal: AbortSignal.timeout(timeout),
          });
        }
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

    const rawText = await res.text();
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        const data = JSON.parse(rawText) as T;
        this.logApiCall(method, path, res.status, elapsed, rawText.length, true);
        return data;
      } catch (jsonErr) {
        const repaired = tryRepairTruncatedJson(rawText);
        if (repaired) {
          this.logApiCall(method, path, res.status, elapsed, rawText.length, true);
          return repaired as T;
        }
        throw jsonErr;
      }
    }

    this.logApiCall(method, path, res.status, elapsed, rawText.length, true);
    return rawText as unknown as T;
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
      // so we resolve the path at runtime (supporting both compiled JS and tsx TS)
      let authModule: any;
      try {
        authModule = await import(/* webpackIgnore: true */ new URL("../scripts/auth.js", import.meta.url).href);
      } catch {
        authModule = await import(/* webpackIgnore: true */ new URL("../scripts/auth.ts", import.meta.url).href);
      }
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
      let authModule: any;
      try {
        authModule = await import(/* webpackIgnore: true */ new URL("../scripts/auth.js", import.meta.url).href);
      } catch {
        authModule = await import(/* webpackIgnore: true */ new URL("../scripts/auth.ts", import.meta.url).href);
      }
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
    if (this.cookie) {
      try {
        const workspaces = await this.request<FusebaseWorkspace[]>(
          `/gwapi2/ft%3Atasks/workspace-infos?orgId=${encodeURIComponent(this.orgId)}`,
        );
        this.updateWorkspaceCache(workspaces);
        return workspaces;
      } catch (err: any) {
        if (!this.gateBridge?.hasGate) throw err;
        console.warn(`[client] Web API listWorkspaces failed (${err.message}), falling back to Gate bridge...`);
      }
    }
    if (this.gateBridge?.hasGate) {
      try {
        const res = await this.gateBridge.toolCall("listWorkspaces", {});
        const workspaces = (res.data?.workspaces || []).map((ws: any) => ({
          id: ws.id,
          title: ws.title || ws.id,
          is_default: Boolean(ws.isDefault),
          color: ws.color,
          role: ws.role,
        }));
        this.updateWorkspaceCache(workspaces as FusebaseWorkspace[]);
        return workspaces as FusebaseWorkspace[];
      } catch (err: any) {
        console.error(`[client] Gate fallback listWorkspaces failed: ${err.message}`);
        throw err;
      }
    }
    throw new Error("No authentication configured (neither session cookie nor Gate token).");
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
    if (this.cookie) {
      try {
        const opts = {
          offset: 0,
          limit: 100,
          type: "note",
          orderBy: "createdAt",
          orderDir: "ASC",
          ...options,
          rootId: options?.rootId || "root",
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
        return await this.request<NotesListResponse>(
          apiPath`/v2/api/workspaces/${workspaceId}/notes` +
            `?filter=${filter}&range=${range}&rootId=${encodeURIComponent(opts.rootId)}&order=${order}`,
        );
      } catch (err: any) {
        if (!this.gateBridge?.hasGate) throw err;
        console.warn(`[client] Web API listPages failed (${err.message}), falling back to Gate bridge...`);
      }
    }
    if (this.gateBridge?.hasGate) {
      try {
        const res = await this.gateBridge.toolCall("listWorkspaceNotes", { workspaceId });
        const rawNotes = res.data?.notes || [];
        const notes = rawNotes.map((n: any) => ({
          globalId: n.globalId,
          title: n.title,
          parentId: n.parentId,
          createdAt: 0,
          updatedAt: 0,
        }));
        return { items: notes as unknown as FusebaseNote[], total: notes.length };
      } catch (err: any) {
        console.error(`[client] Gate fallback listPages failed: ${err.message}`);
        throw err;
      }
    }
    throw new Error("No authentication configured (neither session cookie nor Gate token).");
  }

  /** Get a specific page's metadata */
  async getPage(workspaceId: string, noteId: string): Promise<FusebaseNote> {
    if (this.cookie) {
      try {
        return await this.request<FusebaseNote>(
          apiPath`/v2/api/web-editor/space/${workspaceId}/note/${noteId}`,
        );
      } catch (err: any) {
        if (!this.gateBridge?.hasGate) throw err;
        console.warn(`[client] Web API getPage failed (${err.message}), falling back to Gate bridge...`);
      }
    }
    if (this.gateBridge?.hasGate) {
      try {
        const res = await this.gateBridge.toolCall("getWorkspaceNote", { workspaceId, noteId });
        const note = res.data?.note || res.data;
        if (note) {
          return {
            globalId: note.globalId || noteId,
            title: note.title || "",
            parentId: note.parentId || "default",
            createdAt: 0,
            updatedAt: 0,
            isPortalShare: false,
          } as unknown as FusebaseNote;
        }
      } catch (err: any) {
        console.error(`[client] Gate fallback getPage failed: ${err.message}`);
        throw err;
      }
    }
    throw new Error("No authentication configured (neither session cookie nor Gate token).");
  }

  /** Get recent pages in a workspace */
  async getRecentPages(
    workspaceId: string,
    limit = 10,
  ): Promise<RecentNotesResponse> {
    return this.request<RecentNotesResponse>(
      apiPath`/v2/api/web-editor/notes/recent/${workspaceId}` +
        `?count=1&type=note&limit=${encodeURIComponent(limit)}&offset=0`,
    );
  }

  /** Create a new page */
  async createPage(
    workspaceId: string,
    title: string,
    parentId = "default",
  ): Promise<FusebaseNote> {
    if (this.cookie) {
      try {
        const noteId = this.generateId();
        return await this.request<FusebaseNote>("/v2/api/web-editor/notes/create", {
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
      } catch (err: any) {
        if (!this.gateBridge?.hasGate) throw err;
        console.warn(`[client] Web API createPage failed (${err.message}), falling back to Gate bridge...`);
      }
    }
    if (this.gateBridge?.hasGate) {
      try {
        const res = await this.gateBridge.toolCall("createWorkspaceNote", {
          workspaceId,
          body: {
            title,
            parentId: parentId || "default",
          },
        });
        const note = res.data?.note || res.data;
        if (note?.globalId) {
          return {
            globalId: note.globalId,
            title: note.title,
            parentId: note.parentId,
            createdAt: 0,
            updatedAt: 0,
            isPortalShare: false,
          } as unknown as FusebaseNote;
        }
      } catch (err: any) {
        console.error(`[client] Gate fallback createPage failed: ${err.message}`);
        throw err;
      }
    }
    throw new Error("No authentication configured (neither session cookie nor Gate token).");
  }

  /** Create a new folder */
  async createFolder(
    workspaceId: string,
    title: string,
    parentId?: string,
  ): Promise<FusebaseNote> {
    if (this.cookie) {
      try {
        const noteId = this.generateId();
        const effectiveParentId = !parentId || parentId === "default" || parentId === "root" ? "" : parentId;
        return await this.request<FusebaseNote>("/v2/api/web-editor/notes/create", {
          method: "POST",
          body: JSON.stringify({
            workspaceId,
            noteId,
            note: {
              textVersion: 2,
              title,
              parentId: effectiveParentId,
              type: "folder",
              is_portal_share: false,
            },
          }),
        });
      } catch (err: any) {
        if (!this.gateBridge?.hasGate) throw err;
        console.warn(`[client] Web API createFolder failed (${err.message}), falling back to Gate bridge...`);
      }
    }
    if (this.gateBridge?.hasGate) {
      try {
        const res = await this.gateBridge.toolCall("createWorkspaceNoteFolder", {
          workspaceId,
          body: {
            title,
            parentId: parentId || "default",
          },
        });
        const folder = res.data?.folder || res.data;
        if (folder?.globalId) {
          return {
            globalId: folder.globalId,
            title: folder.title,
            parentId: folder.parentId,
            createdAt: 0,
            updatedAt: 0,
            type: "folder",
            isPortalShare: false,
          } as unknown as FusebaseNote;
        }
      } catch (err: any) {
        console.error(`[client] Gate fallback createFolder failed: ${err.message}`);
        throw err;
      }
    }
    throw new Error("No authentication configured (neither session cookie nor Gate token).");
  }

  /** Update page/folder properties (rename, move, etc.) */
  async upsertPage(
    workspaceId: string,
    noteId: string,
    updates: { title?: string; parentId?: string },
  ): Promise<unknown> {
    return this.request<unknown>(
      apiPath`/v2/api/workspaces/${workspaceId}/notes/${noteId}/upsert`,
      {
        method: "POST",
        body: JSON.stringify({ note: updates }),
      },
    );
  }

  /**
   * Move a page to a different folder or workspace.
   * Endpoint: POST /v2/api/workspaces/{workspaceId}/notes/{noteId}/move
   * Body: { workspaceId: targetWorkspaceId, parentId: folderId || "root" }
   */
  async movePage(
    workspaceId: string,
    noteId: string,
    options: {
      targetWorkspaceId?: string;
      folderId?: string;
      parentId?: string;
    } = {},
  ): Promise<{ id: string }> {
    const targetWorkspace = options.targetWorkspaceId || workspaceId;
    const parent = options.folderId || options.parentId || "root";
    return this.request<{ id: string }>(
      apiPath`/v2/api/workspaces/${workspaceId}/notes/${noteId}/move`,
      {
        method: "POST",
        body: JSON.stringify({
          workspaceId: targetWorkspace,
          parentId: parent,
        }),
      },
    );
  }

  // ─── Folders ──────────────────────────────────────────────────

  /** List folders in a workspace */
  async listFolders(workspaceId: string): Promise<FusebaseFolder[]> {
    if (this.cookie) {
      try {
        const folders = await this.request<FusebaseFolder[]>(
          `/gwapi2/ft:notes/menu?workspace=${encodeURIComponent(workspaceId)}&depth=-1&type=folder&orderBy=title&orderDirection=ASC`,
        );
        this.updateFolderCache(workspaceId, folders);
        return folders;
      } catch (err: any) {
        if (!this.gateBridge?.hasGate) throw err;
        console.warn(`[client] Web API listFolders failed (${err.message}), falling back to Gate bridge...`);
      }
    }
    if (this.gateBridge?.hasGate) {
      try {
        const res = await this.gateBridge.toolCall("listWorkspaceNoteFolders", { workspaceId });
        const folders = (res.data?.folders || []).map((f: any) => ({
          global_id: f.globalId,
          title: f.title,
          parent_id: f.parentId,
          type: "folder" as const,
        }));
        this.updateFolderCache(workspaceId, folders as FusebaseFolder[]);
        return folders as FusebaseFolder[];
      } catch (err: any) {
        console.error(`[client] Gate fallback listFolders failed: ${err.message}`);
        throw err;
      }
    }
    throw new Error("No authentication configured (neither session cookie nor Gate token).");
  }

  // ─── Attachments & Files ──────────────────────────────────────

  /** Get attachments for a specific page */
  async getAttachments(
    workspaceId: string,
    noteId: string,
  ): Promise<FusebaseAttachment[]> {
    return this.request<FusebaseAttachment[]>(
      apiPath`/v2/api/web-editor/space/${workspaceId}/note/attachments/${noteId}`,
    );
  }

  /** List files in a workspace */
  async listFiles(
    workspaceId: string,
    limit = 25,
    offset = 0,
  ): Promise<FusebaseFile[]> {
    return this.request<FusebaseFile[]>(
      apiPath`/v2/api/workspaces/${workspaceId}/files` +
        `?showPortalFiles=true&limitSize=${encodeURIComponent(limit)}&limitFrom=${encodeURIComponent(offset)}&resetCache=true`,
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
    const url = `${this.baseUrl}` + apiPath`/box/attachment/${workspaceId}/${attachmentId}/${filename}`;
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
      apiPath`/v2/api/workspaces/${workspaceId}/tags`,
    );
  }

  /** Get tags for a specific page */
  async getPageTags(workspaceId: string, noteId: string): Promise<string[]> {
    return this.request<string[]>(
      apiPath`/v2/api/workspaces/${workspaceId}/notes/${noteId}/tags`,
    );
  }

  /** Update tags for a specific page */
  async updatePageTags(
    workspaceId: string,
    noteId: string,
    tags: string[],
  ): Promise<void> {
    await this.request<void>(
      apiPath`/v2/api/workspaces/${workspaceId}/notes/${noteId}/tags`,
      { method: "PUT", body: JSON.stringify(tags) },
    );
  }

  /** Get labels for a workspace */
  async getLabels(workspaceId: string): Promise<FusebaseLabel[]> {
    return this.request<FusebaseLabel[]>(
      apiPath`/gwapi2/ft%3Aworkspaces/workspaces/${workspaceId}/labels`,
    );
  }

  // ─── Members ──────────────────────────────────────────────────

  /** Get workspace members */
  async getWorkspaceMembers(workspaceId: string): Promise<FusebaseMember[]> {
    return this.request<FusebaseMember[]>(
      apiPath`/v2/api/workspaces/${workspaceId}/members`,
    );
  }

  /** Get organization members */
  async getOrgMembers(): Promise<FusebaseOrgMember[]> {
    return this.request<FusebaseOrgMember[]>(
      apiPath`/v2/api/orgs/${this.orgId}/membersWithOwner`,
    );
  }

  /** Get user ID to role mappings across the organization */
  async getMemberRoles(orgId?: string): Promise<Array<{ userId: number; role: string }>> {
    const org = orgId || this.orgId;
    return this.request<Array<{ userId: number; role: string }>>(
      apiPath`/gwapi2/ft:org/orgs/${org}/member-roles`,
    );
  }

  /** Get granular v1 workspace member entities */
  async getWorkspaceMembersV1(workspaceId: string): Promise<unknown[]> {
    return this.request<unknown[]>(
      apiPath`/v1/workspaces/${workspaceId}/members`,
    );
  }

  // ─── Organization ─────────────────────────────────────────────

  /** Get organization usage stats */
  async getOrgUsage(): Promise<OrgUsageResponse> {
    return this.request<OrgUsageResponse>(
      apiPath`/v2/api/orgs/${this.orgId}/usage`,
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
      apiPath`/gwapi2/svc:comment/workspaces/${workspaceId}/notes/${noteId}/threadsInfo`,
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
      `/gwapi2/ft:comments/threads?workspace=${encodeURIComponent(workspaceId)}`,
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
      `/gwapi2/ft:comments/comments?workspace=${encodeURIComponent(workspaceId)}&thread=${encodeURIComponent(threadId)}`,
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
      apiPath`/gwapi2/ft:comments/threads/${threadId}`,
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
    let path = apiPath`/gwapi2/ft%3Atasks/workspaces/${workspaceId}/taskLists`;
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
    task: FusebaseCreateTaskPayload & { globalId?: string },
  ): Promise<unknown> {
    const globalId =
      task.globalId ||
      Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
    const body = {
      task: {
        globalId,
        ...task,
      },
    };
    return this.request<unknown>(
      apiPath`/gwapi2/ft%3Atasks/workspaces/${workspaceId}/tasks` + "?addToOrder=false",
      {
        method: "POST",
        body: JSON.stringify(body),
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
      apiPath`/gwapi2/ft%3Atasks/workspaces/${workspaceId}/tasks/${taskId}`,
      {
        method: "POST",
        body: JSON.stringify({ task: updates }),
      },
    );
  }

  /** Delete a task */
  async deleteTask(workspaceId: string, taskId: string): Promise<void> {
    await this.request<void>(
      apiPath`/gwapi2/ft%3Atasks/workspaces/${workspaceId}/tasks/${taskId}`,
      { method: "DELETE" },
    );
  }

  /** Get task description/detail */
  async getTaskDescription(
    workspaceId: string,
    taskId: string,
  ): Promise<unknown> {
    return this.request<unknown>(
      apiPath`/gwapi2/ft%3Atasks/workspaces/${workspaceId}/taskDescriptions/${taskId}`,
    );
  }

  /** Get task summary and statistics across all accessible workspaces */
  async getTasksWorkspaceSummary(): Promise<unknown[]> {
    return this.request<unknown[]>(`/gwapi2/ft:tasks/workspace-infos`);
  }

  /** Get task time tracking estimates and tracked time records */
  async getTaskTimeTracking(
    workspaceId: string,
    taskId: string,
  ): Promise<unknown> {
    return this.request<unknown>(
      apiPath`/gwapi2/ft:tasks/workspaces/${workspaceId}/time/${taskId}`,
    );
  }

  // ─── Page Mutations ───────────────────────────────────────────

  /** Delete a page */
  async deletePage(workspaceId: string, noteId: string): Promise<void> {
    await this.request<void>(
      apiPath`/v2/api/workspaces/${workspaceId}/notes/${noteId}`,
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
      apiPath`/v4/api/workspaces/${workspaceId}/texts/${noteId}/tokens`,
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
      apiPath`/v4/api/proxy/ai-service/v1/orgs/${this.orgId}/agent-categories/agents` + "?globalId=all",
    );
  }

  /** List all AI agent categories (Sales, Support, Development, etc.) */
  async listAiAgentCategories(orgId?: string): Promise<Array<{
    id: number;
    globalId: string;
    name: string;
    description: string;
    type: string;
    [key: string]: unknown;
  }>> {
    const org = orgId || this.orgId;
    return this.request<Array<{
      id: number;
      globalId: string;
      name: string;
      description: string;
      type: string;
      [key: string]: unknown;
    }>>(
      apiPath`/v4/api/proxy/ai-service/v1/orgs/${org}/agent-categories`,
    );
  }

  /** Get AI assistant state, prompt suggestions, and preferences for a workspace */
  async getAiAssistantState(workspaceId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      apiPath`/ai-assistant/rest/workspaces/${workspaceId}/main-page`,
    );
  }

  /** List conversation threads for a specific AI agent */
  async listAiAgentThreads(agentId: string, orgId?: string): Promise<unknown[]> {
    const org = orgId || this.orgId;
    return this.request<unknown[]>(
      apiPath`/ai-assistant/rest/orgs/${org}/agents/${agentId}/threads`,
    );
  }

  /** Get favorited AI agents in the organization */
  async getAiAgentFavorites(orgId?: string): Promise<unknown[]> {
    const org = orgId || this.orgId;
    return this.request<unknown[]>(
      apiPath`/v4/api/proxy/ai-service/v1/orgs/${org}/agentFavorites`,
    );
  }

  /** Get public agent profile by global ID */
  async getAgentPublicProfile(agentGlobalId: string, orgId?: string): Promise<Record<string, unknown>> {
    const org = orgId || this.orgId;
    return this.request<Record<string, unknown>>(
      apiPath`/v4/api/proxy/ai-service/v1/orgs/${org}/agents/${agentGlobalId}/public`,
    );
  }

  /**
   * Run a prompt or task with an AI agent in FuseBase Work.
   * Creates a new conversation thread or posts a message to an existing thread.
   */
  async runAiAgentTask(
    agentId: string,
    prompt: string,
    options?: { threadId?: string; orgId?: string },
  ): Promise<Record<string, unknown>> {
    const org = options?.orgId || this.orgId;
    if (options?.threadId) {
      return this.request<Record<string, unknown>>(
        apiPath`/ai-assistant/rest/orgs/${org}/agents/${agentId}/threads/${options.threadId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ message: prompt, text: prompt, content: prompt }),
        },
      ).catch(async () => {
        return this.request<Record<string, unknown>>(
          apiPath`/v4/api/proxy/ai-service/v1/orgs/${org}/agents/${agentId}/run`,
          {
            method: "POST",
            body: JSON.stringify({ prompt, threadId: options?.threadId }),
          },
        );
      });
    }

    return this.request<Record<string, unknown>>(
      apiPath`/ai-assistant/rest/orgs/${org}/agents/${agentId}/threads`,
      {
        method: "POST",
        body: JSON.stringify({ message: prompt, text: prompt, prompt }),
      },
    ).catch(async () => {
      return this.request<Record<string, unknown>>(
        apiPath`/v4/api/proxy/ai-service/v1/orgs/${org}/agents/${agentId}/run`,
        {
          method: "POST",
          body: JSON.stringify({ prompt }),
        },
      );
    });
  }

  /**
   * Scrape and extract web content via the FuseBase Work Firecrawl service or web parser agent.
   */
  async scrapeUrlViaFirecrawl(
    url: string,
    options?: { agentId?: string; formats?: string[]; prompt?: string },
  ): Promise<Record<string, unknown>> {
    let targetAgentId = options?.agentId;
    if (!targetAgentId) {
      const agents = await this.listAgents().catch(() => []);
      const scraperAgent = agents.find(
        (a) =>
          /firecrawl|scraper|web\s*parser/i.test(a.title || "") ||
          /firecrawl|scraper|web\s*parser/i.test(typeof a.description === "string" ? a.description : ""),
      );
      targetAgentId = scraperAgent?.globalId || "qMjAPHPS1e6UdoYf";
    }

    const extractionPrompt = options?.prompt
      ? `${options.prompt}\nTarget URL: ${url}`
      : `Please scrape and extract the content from the following URL into clean markdown: ${url}\nRequested formats: ${(options?.formats || ["markdown"]).join(", ")}`;

    return this.runAiAgentTask(targetAgentId, extractionPrompt);
  }

  /**
   * Trigger an n8n automation flow or webhook in FuseBase Work.
   */
  async triggerN8nFlow(
    flowId: string,
    payload: Record<string, unknown> = {},
  ): Promise<unknown> {
    return this.triggerAutomationFlow(flowId, payload);
  }

  // ─── Mentions ─────────────────────────────────────────────────

  /** Get mentionable entities for a workspace */
  async getMentionEntities(
    workspaceId: string,
  ): Promise<FusebaseMentionEntity[]> {
    return this.request<FusebaseMentionEntity[]>(
      apiPath`/v2/api/web-editor/mention-entities/${workspaceId}`,
    );
  }

  // ─── Discovered Endpoints ─────────────────────────────────────

  /** Get the full sidebar/navigation menu tree */
  async getNavigationMenu(workspaceId?: string): Promise<FusebaseNavMenuItem[]> {
    let ws = workspaceId;
    if (!ws) {
      const workspaces = await this.listWorkspaces().catch(() => []);
      ws = workspaces[0]?.workspaceId || "45h7lom5ryjak34u";
    }
    return this.request<FusebaseNavMenuItem[]>(
      `/gwapi2/ft%3Anotes/menu?workspace=${encodeURIComponent(ws)}`,
    );
  }

  /** Get the activity stream for a workspace (comments, mentions, etc.) */
  async getActivityStream(workspaceId: string): Promise<FusebaseActivityItem> {
    return this.request<FusebaseActivityItem>(
      apiPath`/gwapi2/svc%3Anotification/workspaces/${workspaceId}/activityStream`,
    );
  }

  /** Get task usage (deadlines, reminders) for a workspace */
  async getTaskUsage(workspaceId: string): Promise<FusebaseTaskUsage> {
    return this.request<FusebaseTaskUsage>(
      apiPath`/gwapi2/ft%3Atasks/workspaces/${workspaceId}/usage`,
    );
  }

  /** Get recently updated notes across the org */
  async getRecentlyUpdatedNotes(): Promise<unknown> {
    return this.request<unknown>(
      apiPath`/v2/api/note-service-proxy/v1/orgs/${this.orgId}/recentlyUpdatedNotes`,
    );
  }

  /** Get task count for a workspace */
  async getTaskCount(workspaceId: string): Promise<{ count: number }> {
    return this.request<{ count: number }>(
      apiPath`/v2/api/task-service-proxy/v1/workspaces/${workspaceId}/tasks/count`,
    );
  }

  /** Get full workspace detail */
  async getWorkspaceDetail(workspaceId: string): Promise<FusebaseWorkspaceDetail> {
    return this.request<FusebaseWorkspaceDetail>(
      apiPath`/v2/api/workspace-service-proxy/v1/workspaces/${workspaceId}`,
    );
  }

  /** Get workspace email addresses */
  async getWorkspaceEmails(workspaceId: string): Promise<FusebaseWorkspaceEmail[]> {
    return this.request<FusebaseWorkspaceEmail[]>(
      apiPath`/v1/workspaces/${workspaceId}/emails`,
    );
  }

  /** Get file count across workspace or org */
  async getFileCount(params?: { workspaceId?: string; orgId?: string }): Promise<{ count: number }> {
    const qs = params?.workspaceId
      ? `?workspaceId=${encodeURIComponent(params.workspaceId)}`
      : `?orgId=${encodeURIComponent(params?.orgId || this.orgId)}`;
    return this.request<{ count: number }>(
      `/v2/api/bucket-service-proxy/v1/files/count${qs}`,
    );
  }

  /** Get AI feature usage for the org */
  async getAiUsage(): Promise<{ max: number; current: number }> {
    return this.request<{ max: number; current: number }>(
      apiPath`/gwapi2/ft%3Aai/orgs/${this.orgId}/usage`,
    );
  }

  /** Get org permissions with members, avatars, usage */
  async getOrgPermissions(): Promise<FusebaseOrgPermissions> {
    return this.request<FusebaseOrgPermissions>(
      apiPath`/gwapi2/ft%3Apermissions/orgs/${this.orgId}/members`,
    );
  }

  /** Get workspace info (quota reset dates, billing) */
  async getWorkspaceInfo(workspaceId: string): Promise<FusebaseWorkspaceInfo> {
    return this.request<FusebaseWorkspaceInfo>(
      apiPath`/api/workspaces/${workspaceId}/info`,
    );
  }

  /** Get tags for a specific note/page */
  async getNoteTags(workspaceId: string, noteId: string): Promise<string[]> {
    return this.request<string[]>(
      apiPath`/v2/api/workspaces/${workspaceId}/notes/${noteId}/tags`,
    );
  }

  // ─── High-Value Gap Endpoints ──────────────────────────────────

  /** Get page content as HTML/MD via Gate MCP or Y.js WebSocket sync + decoder */
  async getPageContent(workspaceId: string, noteId: string): Promise<string> {
    if (this.cookie) {
      try {
        const { readContentViaWebSocket } = await import("./yjs-ws-writer.js");
        const result = await readContentViaWebSocket(this.host, workspaceId, noteId, this.cookie);
        if (result.success && result.html) {
          return result.html;
        }
      } catch (err: any) {
        if (!this.gateBridge?.hasGate) throw err;
        console.warn(`[client] WebSocket getPageContent failed (${err.message}), falling back to Gate bridge...`);
      }
    }
    if (this.gateBridge?.hasGate) {
      try {
        const res = await this.gateBridge.toolCall("getWorkspaceNote", { workspaceId, noteId });
        const md = res.data?.note?.md ?? res.data?.md;
        if (typeof md === "string") {
          return md;
        }
      } catch (err: any) {
        console.error(`[client] Gate fallback getPageContent failed: ${err.message}`);
        throw err;
      }
    }
    throw new Error("Page content read failed: neither WebSocket nor Gate bridge available.");
  }

  /** Append markdown or blocks to an existing page without overwriting previous content */
  async appendPageContent(
    workspaceId: string,
    noteId: string,
    content: { markdown?: string; blocks?: unknown[] },
  ): Promise<{ success: boolean; error?: string }> {
    if (this.cookie && content.markdown) {
      try {
        const { appendContentViaWebSocket } = await import("./yjs-ws-writer.js");
        const { markdownToSchema } = await import("./markdown-parser.js");
        const blocks = markdownToSchema(content.markdown);
        const result = await appendContentViaWebSocket(this.host, workspaceId, noteId, this.cookie, blocks);
        if (result.success) return result;
      } catch (err: any) {
        if (!this.gateBridge?.hasGate) throw err;
        console.warn(`[client] WebSocket appendPageContent failed (${err.message}), falling back to Gate bridge...`);
      }
    } else if (this.cookie && content.blocks) {
      try {
        const { appendContentViaWebSocket } = await import("./yjs-ws-writer.js");
        const result = await appendContentViaWebSocket(this.host, workspaceId, noteId, this.cookie, content.blocks as any);
        if (result.success) return result;
      } catch (err: any) {
        if (!this.gateBridge?.hasGate) throw err;
        console.warn(`[client] WebSocket appendPageContent failed (${err.message}), falling back to Gate bridge...`);
      }
    }

    if (this.gateBridge?.hasGate && content.markdown) {
      try {
        await this.gateBridge.toolCall("appendWorkspaceNoteContent", {
          workspaceId,
          noteId,
          body: {
            content: content.markdown,
            format: "text",
          },
        });
        return { success: true };
      } catch (err: any) {
        console.error(`[client] Gate fallback appendPageContent failed: ${err.message}`);
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: "Neither active cookie session nor Gate bridge available for content append." };
  }

  /** Get database/table view data */
  async getDatabaseData(
    dashboardId: string,
    viewId: string,
    options?: { page?: number; limit?: number; cacheStrategy?: "use" | "reset" | "bypass" },
  ): Promise<FusebaseDatabaseViewData> {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));
    params.set("exclude_async_items", "true");
    if (options?.cacheStrategy) params.set("cacheStrategy", options.cacheStrategy);
    const qs = params.toString();
    return this.request<FusebaseDatabaseViewData>(
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/data` + (qs ? `?${qs}` : ""),
    );
  }

  /**
   * Resolve and cache column keys for a dashboard view.
   * Maps opaque column item_key (e.g. "B9pYbJFk") to human-readable names and vice-versa.
   */
  async resolveColumnKeys(dashboardId: string, viewId: string): Promise<{
    columns: DashboardViewColumn[];
    keyByName: Map<string, string>;
    nameByKey: Map<string, string>;
  }> {
    const cacheKey = `${dashboardId}:${viewId}`;
    const cached = this.viewSchemaCache.get(cacheKey);
    if (cached) return cached;

    const { columns } = await this.getViewSchema(dashboardId, viewId);
    const keyByName = new Map<string, string>();
    const nameByKey = new Map<string, string>();

    for (const col of columns) {
      keyByName.set(col.name.toLowerCase(), col.key);
      keyByName.set(col.name, col.key);
      nameByKey.set(col.key, col.name);
    }

    const mapping = { columns, keyByName, nameByKey };
    this.viewSchemaCache.set(cacheKey, mapping);
    return mapping;
  }

  /**
   * Invalidate cached column schema resolution for a view, dashboard, or globally.
   */
  invalidateViewSchemaCache(dashboardId?: string, viewId?: string): void {
    if (dashboardId && viewId) {
      this.viewSchemaCache.delete(`${dashboardId}:${viewId}`);
    } else if (dashboardId) {
      for (const key of this.viewSchemaCache.keys()) {
        if (key.startsWith(`${dashboardId}:`)) {
          this.viewSchemaCache.delete(key);
        }
      }
    } else {
      this.viewSchemaCache.clear();
    }
  }

  /**
   * Batch create, update, or patch dashboard rows and cell values.
   *
   * Endpoint: PUT /v4/api/proxy/dashboard-service/v1/dashboards/{dashboardId}/views/{viewId}/data/batch
   * Canonical read/write API for FuseBase Dashboards & Tables.
   */
  async batchPutDashboardData(
    dashboardId: string,
    viewId: string,
    rows: Array<BatchPutDashboardRow>,
  ): Promise<any> {
    return this.request(
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/data/batch`,
      {
        method: "PUT",
        body: JSON.stringify({ rows }),
      },
    );
  }

  /**
   * Resolve a system managed database alias (e.g. "companies_db", "deals_db", "meetings", "clients", "spaces").
   * Supports Flow canonical aliases including "deals_table", "deals_pipeline", "deals_all", and "trackers".
   */
  async resolveDatabaseAlias(alias: string): Promise<DatabaseAliasResolution> {
    const normalized = alias.toLowerCase().trim();
    try {
      const all = await this.listAllDatabases();
      const dbs = all?.data ?? [];

      for (const db of dbs) {
        const dashboards = db.dashboards ?? [];
        for (const dash of dashboards) {
          const rootEntity = (dash.root_entity ?? "").toLowerCase();
          const dashName = (dash.name ?? "").toLowerCase();
          const dbTitle = (db.title ?? "").toLowerCase();

          // Check for exact view names / aliases too (e.g. deals_pipeline, deals_all)
          const matchedView = (dash.views ?? []).find((v: any) => {
            const vName = (v.name ?? "").toLowerCase();
            return vName === normalized || (v.global_id && v.global_id === normalized);
          });

          const match =
            ((normalized === "companies" || normalized === "companies_db") && (dashName.includes("compan") || rootEntity.includes("compan"))) ||
            ((normalized === "deals" || normalized === "deals_db" || normalized === "deals_table") && (dashName.includes("deal") || rootEntity.includes("deal"))) ||
            ((normalized === "deals_pipeline" || normalized === "deals_all") && (dashName.includes("deal") || rootEntity.includes("deal"))) ||
            ((normalized === "meetings" || normalized === "meetings_db") && (dashName.includes("meet") || rootEntity.includes("meet"))) ||
            ((normalized === "trackers" || normalized === "meeting_trackers") && (dashName.includes("track") || rootEntity.includes("track"))) ||
            ((normalized === "members" || normalized === "members_db") && (dashName.includes("member") || rootEntity.includes("member"))) ||
            ((normalized === "clients" || normalized === "clients_db") && (rootEntity === "client" || dashName.includes("client"))) ||
            ((normalized === "spaces" || normalized === "spaces_db") && (rootEntity === "space" || dashName.includes("space"))) ||
            Boolean(matchedView) ||
            dashName === normalized ||
            dbTitle === normalized;

          if (match) {
            // Build views list
            const views = (dash.views ?? []).map((v: any, idx: number) => ({
              id: v.global_id || v.id,
              name: v.name || `View ${idx + 1}`,
              type: v.representation_type || v.type,
              isDefault: idx === 0,
            }));

            // Determine primary view ID: if specific view was requested, prioritize it
            let selectedViewId = dash.views?.[0]?.global_id;
            if (normalized === "deals_pipeline") {
              const pipelineView = views.find((v: any) => v.name.toLowerCase().includes("pipeline") || v.type === "kanban");
              if (pipelineView) selectedViewId = pipelineView.id;
            } else if (normalized === "deals_all") {
              const allView = views.find((v: any) => v.name.toLowerCase().includes("all") || v.type === "table" || v.type === "grid");
              if (allView) selectedViewId = allView.id;
            } else if (matchedView) {
              selectedViewId = (matchedView as any).global_id || (matchedView as any).id;
            }

            // Identify child tables in the same database (e.g. trackers for meetings)
            const childTables = dashboards
              .filter((d: any) => d.global_id !== dash.global_id)
              .map((d: any) => ({
                dashboardId: d.global_id,
                name: d.name || "Child Table",
                alias: (d.name || "").toLowerCase().replace(/\s+/g, "_"),
              }));

            return {
              alias,
              found: true,
              databaseId: db.global_id,
              dashboardId: dash.global_id,
              dashboardName: dash.name,
              viewId: selectedViewId,
              title: dash.name || db.title,
              views,
              childTables: childTables.length > 0 ? childTables : undefined,
            };
          }
        }
      }
    } catch {
      // Non-blocking fallback
    }

    return { alias, found: false };
  }

  /**
   * List all databases and dashboards in the organization.
   * Uses direct dashboard-service REST API with legacy probe fallback.
   */
  async listDatabases(
    orgId?: string,
    customEntities?: string[],
  ): Promise<Array<{
    dashboardId: string;
    viewId: string;
    entity: string;
    databaseId?: string;
    title?: string;
  }>> {
    try {
      const allDbs = await this.listAllDatabases();
      const results: Array<{
        dashboardId: string;
        viewId: string;
        entity: string;
        databaseId?: string;
        title?: string;
      }> = [];

      for (const db of allDbs?.data ?? []) {
        for (const dash of db.dashboards ?? []) {
          const viewId = dash.views?.[0]?.global_id || "";
          if (dash.global_id && viewId) {
            results.push({
              databaseId: db.global_id,
              dashboardId: dash.global_id,
              viewId,
              entity: dash.root_entity || dash.name || db.title,
              title: db.title,
            });
          }
        }
      }

      if (results.length > 0) {
        return results;
      }
    } catch {
      // Fallback to legacy probe below
    }

    // Fallback: probe known entities
    const org = orgId || this.orgId;
    const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const KNOWN_ENTITIES = ["spaces", "clients"];
    const entities = [
      ...KNOWN_ENTITIES,
      ...(customEntities || []).filter((e) => !KNOWN_ENTITIES.includes(e)),
    ];

    try {
      const dbRes = await fetch(`${this.baseUrl}` + apiPath`/dashboard/${org}/tables/databases`, {
        headers: { cookie: this.cookie },
        signal: AbortSignal.timeout(TIMEOUT_GET),
      });
      if (!dbRes.ok) return [];
      const dbHtml = await dbRes.text();
      const layoutUuids = new Set(
        [...new Set(dbHtml.match(UUID_RE) || [])].map((u) => u.toLowerCase()),
      );

      const fallbackResults: Array<{ dashboardId: string; viewId: string; entity: string }> = [];
      for (const entity of entities) {
        try {
          const entRes = await fetch(
            `${this.baseUrl}` + apiPath`/dashboard/${org}/tables/entity/${entity}`,
            {
              headers: { cookie: this.cookie },
              signal: AbortSignal.timeout(TIMEOUT_GET),
            },
          );
          if (!entRes.ok) continue;
          const entHtml = await entRes.text();
          const pageUuids = [...new Set(entHtml.match(UUID_RE) || [])]
            .map((u) => u.toLowerCase())
            .filter((u) => !layoutUuids.has(u));
          if (pageUuids.length >= 2) {
            fallbackResults.push({
              dashboardId: pageUuids[0],
              viewId: pageUuids[1],
              entity,
            });
          }
        } catch {
          // TODO(COR-16): per-entity lookup failures are skipped silently
        }
      }
      return fallbackResults;
    } catch {
      return [];
    }
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
    // First, check alias resolution
    const resolved = await this.resolveDatabaseAlias(entity);
    if (resolved?.dashboardId && resolved?.viewId) {
      return this.getDatabaseData(resolved.dashboardId, resolved.viewId, options);
    }

    const databases = await this.listDatabases(orgId);
    const db = databases.find(d => d.entity.toLowerCase() === entity.toLowerCase());

    if (!db) {
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
   * Uses canonical batchPutDashboardData with create_new_row: true.
   * Automatically resolves column names to opaque item_key IDs.
   *
   * @param entity - Entity type or table name
   * @param options - Optional databaseId/dashboardId/viewId and initial row values
   */
  async addDatabaseRow(
    entity: string,
    options?: {
      databaseId?: string;
      dashboardId?: string;
      viewId?: string;
      orgId?: string;
      values?: Record<string, unknown>;
    },
  ): Promise<{
    success: boolean;
    rowUuid?: string;
    data?: unknown;
    dashboardId: string;
    viewId: string;
    entity: string;
  }> {
    let dashboardId = options?.dashboardId;
    let viewId = options?.viewId;

    if (dashboardId && !viewId) {
      try {
        const detail = await this.getDashboardDetail(dashboardId);
        const views = (detail as any)?.data?.views ?? (detail as any)?.views;
        if (Array.isArray(views) && views.length > 0) {
          viewId = views[0].global_id || views[0].id;
        }
      } catch {
        // Fallback to searching database list
      }
    }

    if (!dashboardId || !viewId) {
      const resolved = await this.resolveDatabaseAlias(entity);
      if (resolved?.dashboardId && resolved?.viewId) {
        dashboardId = dashboardId || resolved.dashboardId;
        viewId = viewId || resolved.viewId;
      } else {
        const databases = await this.listDatabases(options?.orgId);
        let match = dashboardId ? databases.find((d) => d.dashboardId === dashboardId) : undefined;
        if (!match) {
          match = databases.find(
            (d) =>
              d.entity.toLowerCase() === entity.toLowerCase() ||
              d.title?.toLowerCase() === entity.toLowerCase() ||
              (options?.databaseId && d.databaseId === options.databaseId),
          );
        }
        if (match) {
          dashboardId = dashboardId || match.dashboardId;
          viewId = viewId || match.viewId;
        }
      }
    }

    if (!dashboardId || !viewId) {
      throw new Error(
        `Could not resolve dashboardId and viewId for entity '${entity}'. Please provide dashboardId and viewId explicitly.`,
      );
    }

    // Resolve column keys if values were provided
    const rowValues: Array<{ item_key: string; value: unknown }> = [];
    if (options?.values && Object.keys(options.values).length > 0) {
      const mapping = await this.resolveColumnKeys(dashboardId, viewId);
      for (const [keyOrName, val] of Object.entries(options.values)) {
        if (mapping.nameByKey.has(keyOrName)) {
          rowValues.push({ item_key: keyOrName, value: val });
        } else {
          const resolvedKey =
            mapping.keyByName.get(keyOrName) ||
            mapping.keyByName.get(keyOrName.toLowerCase());
          if (resolvedKey) {
            rowValues.push({ item_key: resolvedKey, value: val });
          } else {
            rowValues.push({ item_key: keyOrName, value: val });
          }
        }
      }
    }

    // Canonical row creation via batchPutDashboardData with create_new_row: true
    const res = await this.batchPutDashboardData(dashboardId, viewId, [
      {
        create_new_row: true,
        values: rowValues,
      },
    ]);

    const items = Array.isArray(res) ? res : (res?.data ?? res?.rows ?? []);
    const createdItem = items[0];
    const rowUuid =
      createdItem?.root_index_value ?? createdItem?.id ?? createdItem?.global_id;

    return {
      success: true,
      rowUuid,
      data: res,
      dashboardId,
      viewId,
      entity,
    };
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/rows/${rowId}`,
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
      ? `?source_view_ids=${encodeURIComponent(viewId)}&include_possible_lookup_items=true`
      : `?include_possible_lookup_items=true`;
    const result = await this.request<unknown>(
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/allowed-items` + qs,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/relations/${relationId}`,
      { method: "DELETE" },
    );
  }

  /**
   * Add row mappings to a relation (linking a row in source table to a row in target table).
   *
   * Endpoint: POST /v4/api/proxy/dashboard-service/v1/relations/{relationId}/rows
   */
  async addRelationRows(
    relationId: string,
    rows: Array<{ source_index: string; target_index: string }>,
  ): Promise<{ success: boolean; data: unknown }> {
    const result = await this.request<unknown>(
      apiPath`/v4/api/proxy/dashboard-service/v1/relations/${relationId}/rows`,
      {
        method: "POST",
        body: JSON.stringify({ rows }),
      },
    );
    return { success: true, data: result };
  }

  /**
   * Remove row mappings from a relation.
   *
   * Endpoint: DELETE /v4/api/proxy/dashboard-service/v1/relations/{relationId}/rows
   */
  async deleteRelationRows(
    relationId: string,
    options?: { source_index?: string; target_index?: string },
  ): Promise<{ success: boolean; message?: string }> {
    const params = new URLSearchParams();
    if (options?.source_index) params.set("source_index", options.source_index);
    if (options?.target_index) params.set("target_index", options.target_index);
    const qs = params.toString() ? `?${params.toString()}` : "";

    await this.request(
      apiPath`/v4/api/proxy/dashboard-service/v1/relations/${relationId}/rows` + qs,
      { method: "DELETE" },
    );
    return { success: true, message: "Relation row(s) removed successfully" };
  }

  /**
   * Get relation metadata and optionally active row mappings.
   *
   * Endpoint: GET /v4/api/proxy/dashboard-service/v1/relations/{relationId}?include_rows={includeRows}
   */
  async getRelationDetails(
    relationId: string,
    includeRows: boolean = true,
  ): Promise<{ success: boolean; data: unknown }> {
    const result = await this.request<unknown>(
      apiPath`/v4/api/proxy/dashboard-service/v1/relations/${relationId}` + `?include_rows=${encodeURIComponent(includeRows)}`,
    );
    return { success: true, data: result };
  }

  /**
   * Update row ordering for a dashboard view/section.
   *
   * Endpoint: PUT /v4/api/proxy/dashboard-service/v1/dashboards/{dashboardId}/row-orders
   */
  async updateDashboardRowOrder(
    dashboardId: string,
    viewId: string,
    rowOrders: Array<{ row_uuid: string; order: number }>,
    options?: { section_type?: string; section_key?: string; section_value?: string },
  ): Promise<{ success: boolean; message?: string }> {
    const sectionType = options?.section_type ?? "view";
    const sectionKey = options?.section_key ?? "view";
    const sectionValue = options?.section_value ?? viewId;
    await this.request(
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/rows/order` +
        `?view_id=${encodeURIComponent(viewId)}&section_type=${encodeURIComponent(sectionType)}` +
        `&section_key=${encodeURIComponent(sectionKey)}&section_value=${encodeURIComponent(sectionValue)}`,
      {
        method: "PUT",
        body: JSON.stringify({ row_orders: rowOrders }),
      },
    );
    return { success: true, message: "Row orders updated successfully" };
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
      `/v4/api/proxy/dashboard-service/v1/databases?scope_type=org&scope_id=${encodeURIComponent(this.orgId)}`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/databases/${dbId}`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/databases/${dbId}`,
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
      `${this.baseUrl}` + apiPath`/v4/api/proxy/dashboard-service/v1/databases/${dbId}`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
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
        apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/representations/${representationType}`,
        { method: "POST" },
      );
    }
    // board, calendar, timeline, gallery, list, grid use PUT on the view
    return this.request(
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          default_representation_template_id: representationType,
        }),
      },
    );
  }

  /** Get managed dashboard and view representation templates (e.g. Table, Kanban) */
  async getDashboardTemplates(orgId?: string, workspaceId?: string): Promise<unknown> {
    const org = orgId || this.orgId;
    let url = `/v4/api/dashboard/representation-templates?orgId=${encodeURIComponent(org)}`;
    if (workspaceId) url += `&workspaceId=${encodeURIComponent(workspaceId)}`;
    return this.request<unknown>(url);
  }

  /** Get master database and dashboard entity templates (All workspaces, All portals, All forms, Custom table, All clients) */
  async getDatabaseEntityTemplates(): Promise<{
    success: boolean;
    message: string;
    data: Array<{
      global_id: string;
      name: string;
      root_entity: string;
      schema: Record<string, unknown>;
    }>;
  }> {
    return this.request(
      `/v4/api/proxy/dashboard-service/v1/templates`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}/representations/${representationType}`,
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
    const res = await this.request(
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      {
        method: "PUT",
        body: JSON.stringify({ schema: { items } }),
      },
    );
    this.invalidateViewSchemaCache(dashboardId, viewId);
    return res as any;
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
        apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${defaultViewId}`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${sourceViewId}`,
    );
    const viewData = (sourceView as any)?.data ?? sourceView;
    const schema = viewData.schema || {};
    const filters = viewData.filters || { logic: "AND", conditions: [] };

    return this.request(
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views`,
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
    formData.append("database_id", databaseId);
    formData.append("dashboard_id", dashboardId);
    formData.append("view_id", viewId);
    formData.append("delimiter", delimiter);

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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      { method: "PUT", body: JSON.stringify({ schema }) },
    );
    this.invalidateViewSchemaCache(dashboardId, viewId);

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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      { method: "PUT", body: JSON.stringify({ schema }) },
    );
    this.invalidateViewSchemaCache(dashboardId, viewId);

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
    const url = apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/export/csv` +
      `?view_id=${encodeURIComponent(viewId)}&delimiter=${encodeURIComponent(delimiter)}`;
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      { method: "PUT", body: JSON.stringify({ schema }) },
    );
    this.invalidateViewSchemaCache(dashboardId, viewId);

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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      { method: "PUT", body: JSON.stringify({ schema }) },
    );
    this.invalidateViewSchemaCache(dashboardId, viewId);

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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${targetDashboardId}/views/${targetViewId}`,
    );
    const targetItems: Array<Record<string, unknown>> = ((targetViewRes as any)?.data?.schema?.items ?? []);
    // Use the first string column (usually "Name") as the lookup field
    const nameCol = targetItems.find((i: any) => i.source?.custom_type === "string") ?? targetItems[0];
    const targetItemKey = String(nameCol?.key ?? "");

    // 3. Fetch source view schema and add the relation column
    const viewRes = await this.request<{ data: Record<string, unknown> }>(
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      { method: "PUT", body: JSON.stringify({ schema }) },
    );
    this.invalidateViewSchemaCache(dashboardId, viewId);

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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
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
        apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${targetDashId}/views/${targetViewId}`,
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
      apiPath`/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
      { method: "PUT", body: JSON.stringify({ schema }) },
    );
    this.invalidateViewSchemaCache(dashboardId, viewId);

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
   * Automatically resolves friendly column name to opaque item_key and uses
   * canonical batchPutDashboardData with create_new_row: false.
   */
  async updateDatabaseCell(
    dashboardId: string,
    viewId: string,
    rowUuid: string,
    columnKeyOrName: string,
    value: unknown,
  ): Promise<{ success: boolean; message: string; data?: unknown }> {
    const mapping = await this.resolveColumnKeys(dashboardId, viewId);
    let effectiveKey = columnKeyOrName;
    if (!mapping.nameByKey.has(columnKeyOrName)) {
      const resolved =
        mapping.keyByName.get(columnKeyOrName) ||
        mapping.keyByName.get(columnKeyOrName.toLowerCase());
      if (resolved) {
        effectiveKey = resolved;
      }
    }

    const colDef = mapping.columns.find((c) => c.key === effectiveKey);
    let effectiveValue = value;
    if (colDef) {
      if (colDef.type === "number" && typeof value === "string") {
        const trimmed = value.trim();
        const parsed = Number(trimmed);
        if (!isNaN(parsed) && trimmed !== "") {
          effectiveValue = parsed;
        }
      } else if (colDef.type === "boolean" && typeof value === "string") {
        const lower = value.trim().toLowerCase();
        if (lower === "true") effectiveValue = true;
        else if (lower === "false") effectiveValue = false;
      }
    }

    const res = await this.batchPutDashboardData(dashboardId, viewId, [
      {
        create_new_row: false,
        root_index_value: rowUuid,
        values: [{ item_key: effectiveKey, value: effectiveValue }],
      },
    ]);

    return {
      success: true,
      message: `Cell updated for row ${rowUuid}, column ${effectiveKey}`,
      data: res,
    };
  }

  /**
   * Get rows from a database view, formatted for easy agent consumption.
   *
   * Optionally resolves opaque column keys to human-readable names via schema.
   *
   * Each row includes:
   *   - rowUuid: the row's unique ID (the `root_index_value` field)
   *   - cells: flat map of { columnKey: value }
   *   - namedCells: flat map of { "Column Name": value } (when resolveNames is true)
   */
  async getDatabaseRows(
    dashboardId: string,
    viewId: string,
    options: { page?: number; limit?: number; resolveNames?: boolean } = {},
  ): Promise<{
    rows: Array<{
      rowUuid: string;
      cells: Record<string, unknown>;
      namedCells?: Record<string, unknown>;
    }>;
    columnKeys: string[];
    columns?: Array<{ key: string; name: string; type: string }>;
    meta: { total: number; page: number; limit: number; total_pages: number };
  }> {
    const raw = (await this.getDatabaseData(dashboardId, viewId, options)) as any;
    const dataRows: Array<Record<string, unknown>> = raw.data ?? raw.rows ?? [];

    let nameByKey: Map<string, string> | null = null;
    let schemaColumns: DashboardViewColumn[] = [];
    if (options.resolveNames !== false) {
      try {
        const mapping = await this.resolveColumnKeys(dashboardId, viewId);
        nameByKey = mapping.nameByKey;
        schemaColumns = mapping.columns;
      } catch {
        // Schema resolution is non-blocking
      }
    }

    const rows = dataRows.map((row) => {
      const rowUuid = String(row.root_index_value ?? "");
      const cells: Record<string, unknown> = {};
      const namedCells: Record<string, unknown> = {};

      for (const [k, v] of Object.entries(row)) {
        if (k === "root_index_value") continue;
        cells[k] = v;
        if (nameByKey && nameByKey.has(k)) {
          namedCells[nameByKey.get(k)!] = v;
        } else {
          namedCells[k] = v;
        }
      }

      return {
        rowUuid,
        cells,
        ...(options.resolveNames !== false ? { namedCells } : {}),
      };
    });

    const firstRow = dataRows[0];
    const columnKeys = firstRow
      ? Object.keys(firstRow).filter((k) => k !== "root_index_value")
      : [];

    const meta = raw.meta ?? {
      total: rows.length,
      page: options.page ?? 1,
      limit: options.limit ?? rows.length,
      total_pages: 1,
    };

    return {
      rows,
      columnKeys,
      ...(schemaColumns.length > 0
        ? { columns: schemaColumns.map((c) => ({ key: c.key, name: c.name, type: c.type })) }
        : {}),
      meta,
    };
  }

  // === Gate Isolated SQL Store Methods ===

  /** List all isolated SQL stores in the organization */
  async listIsolatedStores(orgId?: string): Promise<IsolatedStore[]> {
    const org = orgId || this.orgId;
    if (this.gateBridge) {
      try {
        const res = await this.gateBridge.toolCall("listIsolatedStores", { orgId: org });
        return (res?.data?.stores || res?.stores || []) as IsolatedStore[];
      } catch (err: any) {
        console.error(`[client] gateBridge.listIsolatedStores fallback: ${err.message}`);
      }
    }
    return this.request<IsolatedStore[]>(
      apiPath`/v4/api/proxy/gate-service/v1/orgs/${org}/isolated-stores`,
    );
  }

  /** Create an isolated PostgreSQL database */
  async createIsolatedStore(
    alias: string,
    options?: {
      engine?: string;
      storeType?: string;
      orgId?: string;
      sourceType?: string;
      sourceId?: string;
    },
  ): Promise<IsolatedStore> {
    const org = options?.orgId || this.orgId;
    if (this.gateBridge) {
      try {
        const res = await this.gateBridge.toolCall("createIsolatedStore", {
          alias,
          engine: options?.engine ?? "postgres",
          storeType: options?.storeType ?? "sql",
          orgId: org,
          source: {
            sourceType: options?.sourceType ?? "org",
            sourceId: options?.sourceId ?? org,
          },
        });
        return (res?.data?.store || res?.store || res) as IsolatedStore;
      } catch (err: any) {
        console.error(`[client] gateBridge.createIsolatedStore fallback: ${err.message}`);
      }
    }
    return this.request<IsolatedStore>(
      apiPath`/v4/api/proxy/gate-service/v1/orgs/${org}/isolated-stores`,
      {
        method: "POST",
        body: JSON.stringify({
          alias,
          engine: options?.engine ?? "postgres",
          storeType: options?.storeType ?? "sql",
          source: {
            sourceType: options?.sourceType ?? "org",
            sourceId: options?.sourceId ?? org,
          },
        }),
      },
    );
  }

  /** Query an isolated SQL store (read-only SELECT) */
  async queryIsolatedStoreSql(
    storeId: string,
    sql: string,
    params: unknown[] = [],
    stage: "dev" | "prod" = "prod",
  ): Promise<IsolatedStoreSqlResult> {
    if (this.gateBridge) {
      try {
        const identity = await this.gateBridge.getIdentity();
        const res = await this.gateBridge.toolCall("queryIsolatedStoreSql", {
          orgId: identity.orgId || this.orgId,
          storeId,
          stage,
          body: {
            sql,
            params: params && params.length > 0 ? params : null,
          },
        });
        return (res?.data || res) as IsolatedStoreSqlResult;
      } catch (err: any) {
        console.error(`[client] gateBridge.queryIsolatedStoreSql fallback: ${err.message}`);
      }
    }
    return this.request<IsolatedStoreSqlResult>(
      apiPath`/v4/api/proxy/gate-service/v1/isolated-stores/${storeId}/sql/query`,
      {
        method: "POST",
        body: JSON.stringify({ sql, params, stage }),
      },
    );
  }

  /** Execute a DML statement in an isolated SQL store (INSERT/UPDATE/DELETE) */
  async executeIsolatedStoreSql(
    storeId: string,
    sql: string,
    params: unknown[] = [],
    stage: "dev" | "prod" = "prod",
  ): Promise<{ rowCount: number; message?: string }> {
    if (this.gateBridge) {
      try {
        const identity = await this.gateBridge.getIdentity();
        const res = await this.gateBridge.toolCall("executeIsolatedStoreSql", {
          orgId: identity.orgId || this.orgId,
          storeId,
          stage,
          body: {
            sql,
            params: params && params.length > 0 ? params : null,
          },
        });
        return (res?.data || res) as { rowCount: number; message?: string };
      } catch (err: any) {
        console.error(`[client] gateBridge.executeIsolatedStoreSql fallback: ${err.message}`);
      }
    }
    return this.request<{ rowCount: number; message?: string }>(
      apiPath`/v4/api/proxy/gate-service/v1/isolated-stores/${storeId}/sql/execute`,
      {
        method: "POST",
        body: JSON.stringify({ sql, params, stage }),
      },
    );
  }

  /** List tables in an isolated SQL store */
  async listIsolatedStoreSqlTables(
    storeId: string,
    stage: "dev" | "prod" = "prod",
  ): Promise<Array<{ tableName: string; schema?: string }>> {
    if (this.gateBridge) {
      try {
        const identity = await this.gateBridge.getIdentity();
        const res = await this.gateBridge.toolCall("listIsolatedStoreSqlTables", {
          orgId: identity.orgId || this.orgId,
          storeId,
          stage,
        });
        return (res?.data?.tables || res?.tables || []) as Array<{ tableName: string; schema?: string }>;
      } catch (err: any) {
        console.error(`[client] gateBridge.listIsolatedStoreSqlTables fallback: ${err.message}`);
      }
    }
    return this.request<Array<{ tableName: string; schema?: string }>>(
      apiPath`/v4/api/proxy/gate-service/v1/isolated-stores/${storeId}/sql/tables` + `?stage=${encodeURIComponent(stage)}`,
    );
  }

  /** Select rows using structured parameters */
  async selectIsolatedStoreSqlRows(
    storeId: string,
    table: string,
    options?: {
      where?: Record<string, unknown>;
      limit?: number;
      offset?: number;
      order?: string[];
      stage?: "dev" | "prod";
    },
  ): Promise<{ rows: Array<Record<string, unknown>>; total?: number }> {
    if (this.gateBridge) {
      try {
        const identity = await this.gateBridge.getIdentity();
        const filters = options?.where
          ? Object.entries(options.where).map(([column, value]) => ({
              column,
              operator: "eq",
              value,
            }))
          : null;
        const sort = options?.order?.map((o) => {
          const parts = o.trim().split(/\s+/);
          return {
            column: parts[0],
            direction: (parts[1]?.toLowerCase() === "desc" ? "desc" : "asc") as "asc" | "desc",
          };
        }) || null;

        const res = await this.gateBridge.toolCall("selectIsolatedStoreSqlRows", {
          orgId: identity.orgId || this.orgId,
          storeId,
          stage: options?.stage ?? "prod",
          body: {
            tableName: table,
            limit: options?.limit ?? 100,
            offset: options?.offset ?? 0,
            filters,
            sort,
          },
        });
        return (res?.data || res) as { rows: Array<Record<string, unknown>>; total?: number };
      } catch (err: any) {
        console.error(`[client] gateBridge.selectIsolatedStoreSqlRows fallback: ${err.message}`);
      }
    }
    return this.request<{ rows: Array<Record<string, unknown>>; total?: number }>(
      apiPath`/v4/api/proxy/gate-service/v1/isolated-stores/${storeId}/sql/select`,
      {
        method: "POST",
        body: JSON.stringify({
          table,
          where: options?.where,
          limit: options?.limit ?? 100,
          offset: options?.offset ?? 0,
          order: options?.order,
          stage: options?.stage ?? "prod",
        }),
      },
    );
  }

  /** Insert a single row into an isolated SQL store */
  async insertIsolatedStoreSqlRow(
    storeId: string,
    table: string,
    row: Record<string, unknown>,
    stage: "dev" | "prod" = "prod",
  ): Promise<{ success: boolean; row?: Record<string, unknown> }> {
    if (this.gateBridge) {
      try {
        const identity = await this.gateBridge.getIdentity();
        const res = await this.gateBridge.toolCall("insertIsolatedStoreSqlRow", {
          orgId: identity.orgId || this.orgId,
          storeId,
          stage,
          body: {
            tableName: table,
            values: row,
            returning: ["*"],
          },
        });
        return (res?.data || res) as { success: boolean; row?: Record<string, unknown> };
      } catch (err: any) {
        console.error(`[client] gateBridge.insertIsolatedStoreSqlRow fallback: ${err.message}`);
      }
    }
    return this.request<{ success: boolean; row?: Record<string, unknown> }>(
      apiPath`/v4/api/proxy/gate-service/v1/isolated-stores/${storeId}/sql/insert`,
      {
        method: "POST",
        body: JSON.stringify({ table, row, stage }),
      },
    );
  }

  /** Batch insert rows into an isolated SQL store */
  async batchInsertIsolatedStoreSqlRows(
    storeId: string,
    table: string,
    rows: Array<Record<string, unknown>>,
    stage: "dev" | "prod" = "prod",
  ): Promise<{ success: boolean; insertedCount: number }> {
    if (this.gateBridge) {
      try {
        const identity = await this.gateBridge.getIdentity();
        const res = await this.gateBridge.toolCall("batchInsertIsolatedStoreSqlRows", {
          orgId: identity.orgId || this.orgId,
          storeId,
          stage,
          body: {
            tableName: table,
            rows,
            returning: ["*"],
          },
        });
        return (res?.data || res) as { success: boolean; insertedCount: number };
      } catch (err: any) {
        console.error(`[client] gateBridge.batchInsertIsolatedStoreSqlRows fallback: ${err.message}`);
      }
    }
    return this.request<{ success: boolean; insertedCount: number }>(
      apiPath`/v4/api/proxy/gate-service/v1/isolated-stores/${storeId}/sql/batch-insert`,
      {
        method: "POST",
        body: JSON.stringify({ table, rows, stage }),
      },
    );
  }

  /** Apply SQL schema migrations bundle to an isolated store */
  async applyIsolatedStoreSqlMigrations(
    storeId: string,
    bundle: Record<string, unknown>,
    stage: "dev" | "prod" = "prod",
    dryRun: boolean = false,
  ): Promise<{ success: boolean; appliedVersions?: string[]; message?: string }> {
    if (this.gateBridge) {
      try {
        const res = await this.gateBridge.toolCall("applyIsolatedStoreSqlMigrations", {
          storeId,
          bundle,
          stage,
          dryRun,
        });
        return (res?.data || res) as { success: boolean; appliedVersions?: string[]; message?: string };
      } catch (err: any) {
        console.error(`[client] gateBridge.applyIsolatedStoreSqlMigrations fallback: ${err.message}`);
      }
    }
    return this.request<{ success: boolean; appliedVersions?: string[]; message?: string }>(
      apiPath`/v4/api/proxy/gate-service/v1/isolated-stores/${storeId}/sql/migrations/apply`,
      {
        method: "POST",
        body: JSON.stringify({ bundle, stage, dryRun }),
      },
    );
  }

  // === Gate Token Management Methods ===

  /** List API tokens belonging to the organization / user */
  async listTokens(query?: {
    scope_type?: string;
    scope_id?: string;
    token_source?: string;
    include_expired?: boolean;
    page?: number;
    limit?: number;
  }): Promise<any> {
    if (this.gateBridge) {
      return this.gateBridge.toolCall("listTokens", query || {});
    }
    throw new Error("Token management requires Gate MCP bridge. Configure FUSEBASE_GATE_TOKEN or FUSEBASE_TOKEN.");
  }

  /** Create a new API token with specified scopes and permissions */
  async createToken(params: {
    name: string;
    scopes?: Array<{ scope_type: string; scope_id: string }>;
    permissions: string[];
    resource_scope?: {
      allow?: Array<{ resource_type: string; ids: string[] }>;
      deny?: Array<{ resource_type: string; ids: string[] }>;
    };
    expires_at?: string | null;
  }): Promise<any> {
    if (this.gateBridge) {
      const identity = await this.gateBridge.getIdentity();
      const orgId = identity.orgId || this.orgId;
      const effectiveScopes = params.scopes && params.scopes.length > 0
        ? params.scopes
        : (orgId ? [{ scope_type: "org", scope_id: orgId }] : []);
      const effectiveResourceScope = params.resource_scope || {
        allow: [{ resource_type: "org", ids: orgId ? [orgId] : ["*"] }],
      };

      const payload = {
        body: {
          name: params.name,
          scopes: effectiveScopes,
          permissions: params.permissions,
          resource_scope: effectiveResourceScope,
          expires_at: params.expires_at || null,
        },
      };
      return this.gateBridge.toolCall("createToken", payload);
    }
    throw new Error("Token creation requires Gate MCP bridge. Configure FUSEBASE_GATE_TOKEN or FUSEBASE_TOKEN.");
  }

  /** Look up details of a specific token by its ID */
  async getToken(tokenId: string): Promise<any> {
    if (this.gateBridge) {
      return this.gateBridge.toolCall("getToken", { tokenId });
    }
    throw new Error("Token lookup requires Gate MCP bridge. Configure FUSEBASE_GATE_TOKEN or FUSEBASE_TOKEN.");
  }

  /** Permanently revoke an API token */
  async revokeToken(tokenId: string): Promise<any> {
    if (this.gateBridge) {
      return this.gateBridge.toolCall("revokeToken", { tokenId });
    }
    throw new Error("Token revocation requires Gate MCP bridge. Configure FUSEBASE_GATE_TOKEN or FUSEBASE_TOKEN.");
  }

  /** List all permissions registered on the Gate platform */
  async listPermissionCatalog(): Promise<any> {
    if (this.gateBridge) {
      return this.gateBridge.toolCall("listPermissionCatalog", {});
    }
    throw new Error("Permission catalog lookup requires Gate MCP bridge. Configure FUSEBASE_GATE_TOKEN or FUSEBASE_TOKEN.");
  }

  /** Resolve required permissions for specific operations */
  async resolveOperationPermissions(operations: string[]): Promise<any> {
    if (this.gateBridge) {
      return this.gateBridge.toolCall("resolveOperationPermissions", { operations });
    }
    throw new Error("Operation permission resolution requires Gate MCP bridge. Configure FUSEBASE_GATE_TOKEN or FUSEBASE_TOKEN.");
  }

  /** Query whoami on Gate or Dashboards gateway */
  async gateWhoami(target?: "gate" | "dashboards"): Promise<any> {
    if (this.gateBridge) {
      return this.gateBridge.whoami(target);
    }
    throw new Error("whoami requires Gate MCP bridge. Configure FUSEBASE_GATE_TOKEN or FUSEBASE_TOKEN.");
  }

  async getOrgLimits(): Promise<FusebaseOrgLimits> {
    return this.request<FusebaseOrgLimits>(
      apiPath`/v2/api/orgs/${this.orgId}/limits`,
    );
  }

  /** Get condensed usage summary */
  async getUsageSummary(): Promise<FusebaseUsageSummary> {
    return this.request<FusebaseUsageSummary>(
      apiPath`/v2/api/orgs/${this.orgId}/usageSummary`,
    );
  }

  /** List client portals */
  async listPortals(workspaceId?: string): Promise<FusebasePortal[]> {
    if (workspaceId) {
      return this.request<FusebasePortal[]>(
        apiPath`/v1/portals/orgs/${this.orgId}/portals` + `?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
    }
    return this.request<FusebasePortal[]>(
      apiPath`/v2/api/portal-service-proxy/v1/orgs/${this.orgId}/portals`,
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

  /** Create a new client portal for a workspace */
  async createPortal(
    workspaceId: string,
    name: string,
    domain?: string,
  ): Promise<unknown> {
    return this.request<unknown>(
      apiPath`/v1/portals/orgs/${this.orgId}/portals` + `?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        method: "POST",
        body: JSON.stringify({
          setup: false,
          settings: {
            name,
            ...(domain ? { domain } : {}),
          },
        }),
      },
    );
  }

  /** Get detailed portal record by portal ID, global ID, or workspace ID */
  async getPortal(idOrWorkspaceId: string): Promise<FusebasePortal> {
    const portals = await this.listPortals();
    const portal = portals.find(
      (p) =>
        String(p.id) === idOrWorkspaceId ||
        p.globalId === idOrWorkspaceId ||
        p.workspaceId === idOrWorkspaceId,
    );
    if (!portal) {
      throw new Error(`Portal "${idOrWorkspaceId}" not found in organization.`);
    }
    return portal;
  }

  /** Check if portal feature is available for organization */
  async checkPortalAvailability(): Promise<boolean> {
    const res = await this.request<any>(apiPath`/v1/portals/orgs/${this.orgId}/available`);
    return res === true || res === "true" || res?.available === true;
  }

  /** Get portal UI theme, colors, hero greeting banner, and sidebar options */
  async getPortalTheme(options: {
    workspaceId?: string;
    portalId?: string;
    portalDomain?: string;
  }): Promise<unknown> {
    const params = new URLSearchParams();
    if (options.workspaceId) params.append("workspaceId", options.workspaceId);
    if (options.portalId) params.append("portalId", options.portalId);
    if (options.portalDomain) params.append("portalDomain", options.portalDomain);
    return this.request<unknown>(
      `/v2/api/portal-service-proxy/v1/contents?${params.toString()}`,
    );
  }

  /** Get workspace client portal navigation tree and entities */
  async getPortalNavigationMenu(workspaceId: string): Promise<unknown> {
    return this.request<unknown>(apiPath`/v2/api/workspaces/${workspaceId}/portal`);
  }

  /** Get workspace client portal resolution object (portal ID, global ID, domain) */
  async getWorkspacePortal(workspaceId: string): Promise<unknown> {
    return this.request<unknown>(
      apiPath`/v2/api/portal-service-proxy/v1/workspaces/${workspaceId}/portals`,
    );
  }

  /** Publish or unpublish a page to the client portal */
  async setPagePortalShare(
    workspaceId: string,
    pageId: string,
    isPortalShare: boolean,
  ): Promise<unknown> {
    return this.request<unknown>(
      apiPath`/v2/api/workspaces/${workspaceId}/notes/${pageId}/upsert`,
      {
        method: "POST",
        body: JSON.stringify({
          note: {
            is_portal_share: isPortalShare,
          },
        }),
      },
    );
  }

  /** Get org feature flags */
  async getOrgFeatures(): Promise<FusebaseOrgFeature[]> {
    return this.request<FusebaseOrgFeature[]>(
      apiPath`/v1/organizations/${this.orgId}/features`,
    );
  }

  // ─── Automations (ActivePieces) ────────────────────────────────

  /** List automation flows for a project (auto-resolves projectId) */
  async listAutomationFlows(projectId?: string): Promise<unknown> {
    const auth = await this.ensureAutomationAuth();
    const effectiveProjectId = projectId || auth.projectId;
    const qs = effectiveProjectId ? `?projectId=${encodeURIComponent(effectiveProjectId)}` : "";
    return this.request<unknown>(`/automation/api/v1/flows${qs}`);
  }

  /** Get details of a specific automation flow */
  async getAutomationFlow(flowId: string): Promise<unknown> {
    return this.request<unknown>(apiPath`/automation/api/v1/flows/${flowId}`);
  }

  /** List recent automation flow runs */
  async listFlowRuns(projectId?: string, limit = 20): Promise<unknown> {
    const auth = await this.ensureAutomationAuth();
    const effectiveProjectId = projectId || auth.projectId;
    const params = new URLSearchParams({ limit: String(limit) });
    if (effectiveProjectId) params.set("projectId", effectiveProjectId);
    return this.request<unknown>(`/automation/api/v1/flow-runs?${params.toString()}`);
  }

  /** List available automation pieces/connectors */
  async listAutomationPieces(): Promise<unknown> {
    return this.request<unknown>("/automation/api/v1/pieces");
  }

  /** Create a new automation flow (auto-resolves projectId) */
  async createAutomationFlow(
    displayName: string,
    folderId?: string,
    projectId?: string,
  ): Promise<unknown> {
    const auth = await this.ensureAutomationAuth();
    const effectiveProjectId = projectId || auth.projectId;
    const body: Record<string, unknown> = { displayName, projectId: effectiveProjectId };
    if (folderId) body.folderId = folderId;
    return this.request<unknown>("/automation/api/v1/flows", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /** Update an existing automation flow (ActivePieces request wrapper) */
  async updateAutomationFlow(
    flowId: string,
    operation: {
      type: "CHANGE_STATUS" | "CHANGE_NAME";
      status?: "ENABLED" | "DISABLED";
      displayName?: string;
    },
  ): Promise<unknown> {
    const requestPayload = operation.type === "CHANGE_NAME"
      ? { displayName: operation.displayName }
      : { status: operation.status };
    return this.request<unknown>(apiPath`/automation/api/v1/flows/${flowId}`, {
      method: "POST",
      body: JSON.stringify({
        type: operation.type,
        request: requestPayload,
      }),
    });
  }

  /** Delete an automation flow */
  async deleteAutomationFlow(flowId: string): Promise<unknown> {
    return this.request<unknown>(apiPath`/automation/api/v1/flows/${flowId}`, {
      method: "DELETE",
    });
  }

  /** Test-run or trigger an automation flow with a test payload */
  async triggerAutomationFlow(
    flowId: string,
    payload: Record<string, unknown> = {},
  ): Promise<unknown> {
    return this.request<unknown>(apiPath`/automation/api/v1/flows/${flowId}/runs`, {
      method: "POST",
      body: JSON.stringify({ payload }),
    }).catch(async () => {
      // Fallback to webhook trigger endpoint
      return this.request<unknown>(apiPath`/automation/api/v1/webhooks/${flowId}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    });
  }

  /** Get ActivePieces automation platform configuration and feature flags */
  async getAutomationFlags(): Promise<unknown> {
    return this.request<unknown>("/automation/api/v1/flags");
  }

  /** List automation workflow folders */
  async listAutomationFolders(): Promise<{
    data: Array<{
      id: string;
      projectId: string;
      displayName: string;
      color?: string;
      created: string;
      updated: string;
    }>;
  }> {
    await this.ensureAutomationAuth();
    return this.request("/automation/api/v1/folders");
  }

  /**
   * Create an automation workflow folder in ActivePieces.
   * Endpoint: POST /automation/api/v1/folders
   */
  async createAutomationFolder(
    displayName: string,
    color: string = "teal",
  ): Promise<{
    id: string;
    projectId: string;
    displayName: string;
    color: string;
    created: string;
    updated: string;
  }> {
    await this.ensureAutomationAuth();
    return this.request("/automation/api/v1/folders", {
      method: "POST",
      body: JSON.stringify({ displayName, color }),
    });
  }

  /**
   * Delete an automation workflow folder in ActivePieces.
   * Endpoint: DELETE /automation/api/v1/folders/{folderId}
   */
  async deleteAutomationFolder(folderId: string): Promise<void> {
    await this.ensureAutomationAuth();
    await this.request(apiPath`/automation/api/v1/folders/${folderId}`, {
      method: "DELETE",
    });
  }

  /** Get current ActivePieces automation user profile */
  async getAutomationUser(): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    [key: string]: unknown;
  }> {
    await this.ensureAutomationAuth();
    return this.request("/automation/api/v1/users/me");
  }

  // ─── Portal Clients & Magic Links ────────────────────────────

  /** List invited portal clients and members */
  async listPortalClients(portalId?: string): Promise<unknown> {
    const qs = portalId ? `?portalId=${encodeURIComponent(portalId)}` : "";
    return this.request<unknown>(
      apiPath`/v2/api/orgs/${this.orgId}/portalClients` + qs,
    ).catch(async () => {
      // Fallback: query org members filtered by role client
      const members = await this.getOrgMembers();
      return members.filter((m: any) => m.role === "client" || m.userRole === "client");
    });
  }

  /** Invite a customer with client role to a portal */
  async invitePortalClient(
    portalId: string,
    email: string,
    name?: string,
  ): Promise<unknown> {
    return this.request<unknown>(apiPath`/v1/portals/orgs/${this.orgId}/invites`, {
      method: "POST",
      body: JSON.stringify({
        portalId,
        email,
        name: name || email.split("@")[0],
        role: "client",
      }),
    });
  }

  /** Generate or retrieve a 24-hour magic login link for a portal client */
  async getPortalMagicLink(portalId: string, email: string): Promise<unknown> {
    return this.request<unknown>(apiPath`/v1/portals/orgs/${this.orgId}/magic-link`, {
      method: "POST",
      body: JSON.stringify({
        portalId,
        email,
      }),
    });
  }

  // ─── Billing & User Preferences ───────────────────────────────

  /** Get billing credits balance, coupon redemptions, and tokens */
  async getBillingInfo(orgId?: string): Promise<{
    credit: unknown;
    activeCoupons: unknown;
    couponTokens: unknown;
  }> {
    const org = orgId || this.orgId;
    const [credit, activeCoupons, couponTokens] = await Promise.all([
      this.request<unknown>("/v1/billing/credit").catch(() => null),
      this.request<unknown>(apiPath`/v2/api/orgs/${org}/coupons`).catch(() => null),
      this.request<unknown>(apiPath`/v1/organizations/${org}/coupons`).catch(() => null),
    ]);
    return { credit, activeCoupons, couponTokens };
  }

  /** Get user notification preferences and web editor variables */
  async getUserPreferences(): Promise<{
    notificationOptions: unknown;
    webEditorVars: unknown;
    lastOpenedWorkspaces: unknown;
  }> {
    const [notificationOptions, webEditorVars, lastOpenedWorkspaces] = await Promise.all([
      this.request<unknown>("/v1/notification/options").catch(() => null),
      this.request<unknown>("/v2/api/web-editor/user/vars").catch(() => null),
      this.request<unknown>("/v1/users/vars/lastOpenedWorkspaces").catch(() => null),
    ]);
    return { notificationOptions, webEditorVars, lastOpenedWorkspaces };
  }

  /** Toggle web editor sidebar collapse state */
  async setUserSidebarCollapsed(collapsed: boolean): Promise<unknown> {
    return this.request<unknown>("/v2/api/users/vars/sidebarCollapsed", {
      method: "POST",
      body: JSON.stringify({ value: collapsed ? "1" : "0" }),
    });
  }

  /** Get workspace premium subscription tier and expiration */
  async getWorkspacePremiumStatus(workspaceId?: string): Promise<unknown> {
    const ws = workspaceId || "default";
    return this.request<unknown>(apiPath`/v1/workspaces/${ws}/premium`);
  }

  /** Get active data import job status in a workspace */
  async getActiveImportStatus(workspaceId: string): Promise<unknown> {
    return this.request<unknown>(apiPath`/v1/workspaces/${workspaceId}/import/activeImport`);
  }

  /** Get active feature trial subscriptions for an organization */
  // TODO(COR-16): orgId is accepted but not sent; the endpoint is scoped by host.
  async getOrgTrials(_orgId?: string): Promise<unknown[]> {
    return this.request<unknown[]>("/v2/api/orgs/trials");
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
