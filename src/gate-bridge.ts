/**
 * FuseBase Gate & Dashboards Direct MCP Bridge
 *
 * Implements direct HTTP Streamable MCP client connectivity to FuseBase's official
 * remote MCP gateways:
 *   - Gate MCP:       https://gate-mcp.thefusebase.com/mcp
 *   - Dashboards MCP: https://dashboards-mcp.thefusebase.com/mcp
 *
 * Supports token authentication (Authorization: Bearer <token>), automatic session
 * negotiation (mcp-session-id), tenant identity auto-discovery (whoami), and execution
 * of official platform operations.
 */

import type { FusebaseFolder, FusebaseNote, FusebaseWorkspace } from "./types.js";

export interface GateBridgeConfig {
  gateUrl?: string;
  dashboardsUrl?: string;
  gateToken?: string;
  dashboardsToken?: string;
  token?: string; // Unified token fallback
  /** Per-request timeout in ms (default 30 s, or GATE_MCP_TIMEOUT_MS). */
  timeoutMs?: number;
}

export interface GateIdentity {
  orgId: string;
  orgDomain?: string;
  userId?: string;
  defaultWorkspaceId?: string;
  permissions: string[];
  serverName: string;
  serverVersion: string;
}

export interface UpstreamToolSummary {
  name: string;
  title?: string;
  description?: string;
  outputSummary?: Record<string, unknown>;
  schemaVersion?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Error text meaning the MCP session is gone and a new one must be negotiated. The Gate
 * has been seen to answer "Missing session"; the rest are the MCP SDK's
 * StreamableHTTPServerTransport wordings ("Session not found", "Mcp-Session-Id header is
 * required", "No valid session ID provided").
 */
const SESSION_MISSING = /missing session|session not found|no valid session|invalid session|session (?:id )?(?:has )?expired|mcp-session-id header is required/i;

function describeRpc(payload: Record<string, unknown>): string {
  const params = payload.params as { name?: unknown; arguments?: { opId?: unknown } } | undefined;
  return [payload.method, params?.name, params?.arguments?.opId].filter((p) => typeof p === "string").join(" ");
}

function describeUpstreamError(err: unknown): string {
  if (typeof err === "string") return redactUpstreamDetail(err);
  if (err && typeof err === "object") {
    const { code, message } = err as { code?: unknown; message?: unknown };
    if (typeof message === "string") return redactUpstreamDetail(code !== undefined ? `${String(code)}: ${message}` : message);
  }
  return redactUpstreamDetail(JSON.stringify(err));
}

const SECRET_HEADER = /("?(?:x-secret|authorization|cookie|set-cookie|x-api-key|api[-_]?key|token|password)"?\s*[:=]\s*)("[^"]*"|[^\s,}]+)/gi;
const MAX_UPSTREAM_DETAIL = 500;

/**
 * Upstream error text as safe to show and log (SEC-11). FuseBase has returned whole internal
 * request objects in error messages (axios config with internal auth headers and a service
 * secret, stack traces). Keep an embedded JSON error's message/name/code/status, redact
 * secret-looking values, and cap the length.
 */
export function redactUpstreamDetail(text: string): string {
  let out = text;
  const start = out.indexOf("{");
  if (start >= 0) {
    try {
      const obj = JSON.parse(out.slice(start)) as Record<string, unknown>;
      const keep = ["message", "name", "code", "status"].filter((k) => obj[k] !== undefined && typeof obj[k] !== "object");
      if (keep.length > 0) out = out.slice(0, start) + JSON.stringify(Object.fromEntries(keep.map((k) => [k, obj[k]])));
    } catch {
      // not a single JSON object: fall through to redaction
    }
  }
  out = out.replace(SECRET_HEADER, "$1\"[redacted]\"");
  return out.length > MAX_UPSTREAM_DETAIL ? out.slice(0, MAX_UPSTREAM_DETAIL) + "…" : out;
}

/** Split an SSE stream into events and return each event's `data` payload parsed as JSON. */
export function parseSseMessages(text: string): unknown[] {
  const messages: unknown[] = [];
  for (const event of text.replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const data = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""));
    if (data.length === 0) continue;
    try {
      const parsed = JSON.parse(data.join("\n"));
      if (Array.isArray(parsed)) messages.push(...parsed);
      else messages.push(parsed);
    } catch {
      // Not JSON (e.g. a keep-alive); skip it.
    }
  }
  return messages;
}

function isRpcResponse(m: unknown): m is Record<string, unknown> {
  return Boolean(m) && typeof m === "object" && ("result" in (m as object) || "error" in (m as object));
}

/** Parse a Streamable HTTP response body (JSON or SSE) into the JSON-RPC response for `id`. */
function parseRpcBody(text: string, contentType: string | null, id: unknown): any {
  const isSse = contentType?.includes("text/event-stream") ?? false;
  if (!isSse) {
    try {
      return JSON.parse(text);
    } catch {
      if (!/^(?:data|event|id|retry):/m.test(text)) return { raw: text };
    }
  }
  const responses = parseSseMessages(text).filter(isRpcResponse);
  const match = id === undefined ? responses[0] : responses.find((m) => m.id === id);
  if (match) return match;
  if (text.trim() === "") return {};
  if (id !== undefined && responses.length > 0) {
    throw new Error(`No JSON-RPC response with id ${String(id)} in event stream: ${text.slice(0, 300)}`);
  }
  return { raw: text };
}

/** True when the response says the MCP session is missing or expired. */
function isSessionMissing(status: number, json: any, text: string): boolean {
  if (json?.error) {
    return SESSION_MISSING.test(String(json.error.message ?? "")) || SESSION_MISSING.test(JSON.stringify(json.error));
  }
  // Only a transport-level rejection, never a successful result whose content happens
  // to contain these words (e.g. a note's text).
  return status >= 400 && !json?.result && SESSION_MISSING.test(text);
}

export class FusebaseGateBridge {
  private gateUrl: string;
  private dashboardsUrl: string;
  private gateToken?: string;
  private dashboardsToken?: string;

  private gateSessionId?: string;
  private dashboardsSessionId?: string;

  private cachedIdentity?: GateIdentity;
  private initPromise?: Promise<GateIdentity>;
  private reqId: number = 1;
  private timeoutMs: number;

  constructor(config: GateBridgeConfig) {
    this.gateUrl = config.gateUrl || process.env.GATE_MCP_URL || "https://gate-mcp.thefusebase.com/mcp";
    this.dashboardsUrl = config.dashboardsUrl || process.env.DASHBOARDS_MCP_URL || "https://dashboards-mcp.thefusebase.com/mcp";
    this.gateToken = config.gateToken || config.token || process.env.FUSEBASE_GATE_TOKEN || process.env.GATE_MCP_TOKEN || process.env.FUSEBASE_TOKEN;
    this.dashboardsToken = config.dashboardsToken || config.token || process.env.FUSEBASE_DASHBOARDS_TOKEN || process.env.DASHBOARDS_MCP_TOKEN || process.env.FUSEBASE_TOKEN;
    const envTimeout = Number(process.env.GATE_MCP_TIMEOUT_MS);
    this.timeoutMs = config.timeoutMs ?? (envTimeout > 0 ? envTimeout : DEFAULT_TIMEOUT_MS);
  }

  get isConfigured(): boolean {
    return Boolean(this.gateToken || this.dashboardsToken);
  }

  get hasGate(): boolean {
    return Boolean(this.gateToken);
  }

  get hasDashboards(): boolean {
    return Boolean(this.dashboardsToken);
  }

  /** Send low-level JSON-RPC message over Streamable HTTP */
  private async postJsonRpc(
    target: "gate" | "dashboards",
    payload: Record<string, unknown>,
    retryInitOnMissingSession = true
  ): Promise<{ data: any; sessionId?: string }> {
    const url = target === "gate" ? this.gateUrl : this.dashboardsUrl;
    const token = target === "gate" ? this.gateToken : this.dashboardsToken;
    let sessionId = target === "gate" ? this.gateSessionId : this.dashboardsSessionId;

    if (!token) {
      throw new Error(`No token configured for target '${target}'`);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "Authorization": `Bearer ${token}`,
    };

    // A new session must not carry the (possibly expired) id of the old one.
    if (sessionId && payload.method !== "initialize") {
      headers["mcp-session-id"] = sessionId;
    }

    let res: Response;
    let text: string;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      text = await res.text();
    } catch (err: any) {
      if (err?.name === "TimeoutError" || err?.name === "AbortError") {
        throw new Error(`${target} MCP request '${describeRpc(payload)}' to ${url} timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    }

    const newSessionId = res.headers.get("mcp-session-id");
    if (newSessionId) {
      if (target === "gate") this.gateSessionId = newSessionId;
      else this.dashboardsSessionId = newSessionId;
      sessionId = newSessionId;
    }

    const json = parseRpcBody(text, res.headers.get("content-type"), payload.id);

    // Re-initialise and resend only when the server says the session is gone. Any other
    // error (a 400 validation failure, a 404) is returned as-is: the request may be a
    // tools/call write, and resending it could apply it twice.
    if (
      retryInitOnMissingSession &&
      payload.method !== "initialize" &&
      isSessionMissing(res.status, json, text)
    ) {
      await this.initTarget(target);
      return this.postJsonRpc(target, payload, false);
    }

    if (!res.ok && !json.result && !json.error) {
      throw new Error(`HTTP ${res.status} from ${url}: ${redactUpstreamDetail(text.slice(0, 2000))}`);
    }

    return { data: json, sessionId: sessionId || undefined };
  }

  /** Initialize a specific upstream target session */
  private async initTarget(target: "gate" | "dashboards"): Promise<string> {
    const res = await this.postJsonRpc(
      target,
      {
        jsonrpc: "2.0",
        id: this.reqId++,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          clientInfo: { name: "fusebase-mcp-bridge", version: "2.0.0" },
          capabilities: {},
        },
      },
      false
    );

    const sessionId = res.sessionId;
    if (!sessionId) {
      throw new Error(`Failed to obtain mcp-session-id from ${target} endpoint`);
    }

    // Send initialized notification
    await this.postJsonRpc(
      target,
      {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      },
      false
    );

    return sessionId;
  }

  /**
   * Initialize bridge and auto-discover identity from upstream. Concurrent callers share
   * one in-flight initialisation; a failed one is forgotten so a later call can retry.
   */
  init(): Promise<GateIdentity> {
    if (!this.initPromise) {
      this.initPromise = this.initOnce().catch((err) => {
        this.initPromise = undefined;
        throw err;
      });
    }
    return this.initPromise;
  }

  private async initOnce(): Promise<GateIdentity> {
    if (!this.isConfigured) {
      throw new Error("FusebaseGateBridge is not configured with any tokens.");
    }

    const primaryTarget: "gate" | "dashboards" = this.hasGate ? "gate" : "dashboards";
    await this.initTarget(primaryTarget);

    if (this.hasDashboards && primaryTarget !== "dashboards") {
      try {
        await this.initTarget("dashboards");
      } catch (err: any) {
        console.error(`[gate-bridge] Dashboards MCP init warning: ${err.message}`);
      }
    }

    // Query whoami to establish identity
    const whoamiData = await this.whoami(primaryTarget);
    let orgId = whoamiData.auth?.org?.id || whoamiData.org?.id || whoamiData.defaults?.toolArgs?.scope_id || "";
    let orgDomain = whoamiData.org?.orgDomain || whoamiData.auth?.org?.orgDomain;

    // If orgDomain not in primary whoami, check dashboards if available
    if (!orgDomain && this.hasDashboards) {
      try {
        const dashWhoami = await this.whoami("dashboards");
        if (!orgId) orgId = dashWhoami.auth?.org?.id || dashWhoami.org?.id || "";
        if (dashWhoami.auth?.org?.orgDomain || dashWhoami.org?.orgDomain) {
          orgDomain = dashWhoami.auth?.org?.orgDomain || dashWhoami.org?.orgDomain;
        }
      } catch {
        // ignore
      }
    }

    const hosts = whoamiData.hosts;
    if (!orgDomain && hosts?.fusebaseWebClientHost && orgId) {
      orgDomain = `${orgId}.${hosts.fusebaseWebClientHost}`;
    }

    this.cachedIdentity = {
      orgId,
      orgDomain,
      userId: whoamiData.auth?.subject?.userId,
      defaultWorkspaceId: whoamiData.defaults?.defaultWorkspaceId,
      permissions: whoamiData.auth?.permissions || [],
      serverName: whoamiData.server?.name || "fusebase-gateway",
      serverVersion: whoamiData.server?.version || "unknown",
    };

    return this.cachedIdentity;
  }

  /** Get cached identity or initialize if not cached */
  async getIdentity(): Promise<GateIdentity> {
    if (this.cachedIdentity) return this.cachedIdentity;
    return this.init();
  }

  /** Call whoami on upstream gateway */
  async whoami(target?: "gate" | "dashboards"): Promise<Record<string, any>> {
    const effectiveTarget = target || (this.hasGate ? "gate" : "dashboards");
    const res = await this.postJsonRpc(effectiveTarget, {
      jsonrpc: "2.0",
      id: this.reqId++,
      method: "tools/call",
      params: {
        name: "whoami",
        arguments: {},
      },
    });

    // MCP-12: an auth failure comes back as a tool result; surface it as an error.
    if (res.data.error) {
      throw new Error(`Upstream FuseBase [whoami] error: ${describeUpstreamError(res.data.error)}`);
    }
    const text = res.data.result?.content?.[0]?.text;
    let parsed: any;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { text };
      }
    }
    if (res.data.result?.isError || (parsed && typeof parsed === "object" && parsed.ok === false)) {
      throw new Error(`Upstream FuseBase [whoami] error: ${describeUpstreamError(parsed?.error ?? parsed?.text ?? parsed ?? res.data)}`);
    }
    return parsed ?? (res.data.result || res.data);
  }

  /** List available operations via upstream tools_list */
  async toolsList(target?: "gate" | "dashboards"): Promise<UpstreamToolSummary[]> {
    const effectiveTarget = target || (this.hasGate ? "gate" : "dashboards");
    const res = await this.postJsonRpc(effectiveTarget, {
      jsonrpc: "2.0",
      id: this.reqId++,
      method: "tools/call",
      params: {
        name: "tools_list",
        arguments: {},
      },
    });

    if (res.data.result?.content?.[0]?.text) {
      try {
        const parsed = JSON.parse(res.data.result.content[0].text);
        return parsed.tools || [];
      } catch {
        return [];
      }
    }
    return [];
  }

  /** Describe a specific operation schema */
  async toolsDescribe(name: string, target?: "gate" | "dashboards"): Promise<Record<string, any>> {
    const effectiveTarget = target || (this.hasGate ? "gate" : "dashboards");
    const res = await this.postJsonRpc(effectiveTarget, {
      jsonrpc: "2.0",
      id: this.reqId++,
      method: "tools/call",
      params: {
        name: "tools_describe",
        arguments: { name },
      },
    });

    if (res.data.result?.content?.[0]?.text) {
      try {
        return JSON.parse(res.data.result.content[0].text);
      } catch {
        return { raw: res.data.result.content[0].text };
      }
    }
    return res.data.result || res.data;
  }

  /**
   * Execute an operation via upstream tool_call
   * Automatically provides default scope_type/scope_id/orgId if the tool requires them
   */
  async toolCall(
    opId: string,
    args: Record<string, unknown> = {},
    target?: "gate" | "dashboards"
  ): Promise<any> {
    const effectiveTarget = target || (this.hasGate ? "gate" : "dashboards");
    const identity = await this.getIdentity();

    const mergedArgs: Record<string, unknown> = { ...args };

    // Auto-inject org scope if opId is a scoped operation and caller omitted it
    if (identity.orgId) {
      if (
        opId === "getAllDatabases" ||
        opId === "getDashboards" ||
        opId === "listTokens" ||
        opId === "listOrgUsers"
      ) {
        if (!mergedArgs.scope_type) mergedArgs.scope_type = "org";
        if (!mergedArgs.scope_id) mergedArgs.scope_id = identity.orgId;
      } else if (
        opId === "listPermissionCatalog" ||
        opId === "createToken" ||
        opId === "getToken" ||
        opId === "revokeToken"
      ) {
        // Strict Gate schemas: reject root orgId or scope parameters
      } else {
        if (effectiveTarget === "gate" && !mergedArgs.orgId) {
          mergedArgs.orgId = identity.orgId;
        }
        if (!mergedArgs.orgId && (opId === "listIsolatedStores" || opId === "createIsolatedStore" || opId.startsWith("isolatedStore") || opId.startsWith("listIsolated"))) {
          mergedArgs.orgId = identity.orgId;
        }
      }

      // If workspaceId is omitted for workspace-scoped Gate operations, provide default
      if (
        effectiveTarget === "gate" &&
        !mergedArgs.workspaceId &&
        (opId.includes("Workspace") || opId.includes("Note") || opId.includes("Folder")) &&
        opId !== "listWorkspaces" &&
        opId !== "createWorkspace"
      ) {
        mergedArgs.workspaceId = identity.defaultWorkspaceId || "default";
      }
    }

    const res = await this.postJsonRpc(effectiveTarget, {
      jsonrpc: "2.0",
      id: this.reqId++,
      method: "tools/call",
      params: {
        name: "tool_call",
        arguments: {
          opId,
          args: mergedArgs,
        },
      },
    });

    const isError = res.data.result?.isError || Boolean(res.data.error);
    const contentText = res.data.result?.content?.[0]?.text;

    if (isError) {
      const errMsg = contentText || res.data.error?.message || JSON.stringify(res.data);
      throw new Error(`Upstream FuseBase [${opId}] error: ${redactUpstreamDetail(String(errMsg))}`);
    }

    if (contentText) {
      try {
        const parsed = JSON.parse(contentText);
        if (parsed && typeof parsed === "object" && parsed.ok === false && parsed.error) {
          throw new Error(`Upstream FuseBase [${opId}] failed: ${redactUpstreamDetail(String(parsed.error.message || JSON.stringify(parsed.error)))}`);
        }
        return parsed;
      } catch (err: any) {
        if (err.message.startsWith("Upstream FuseBase")) throw err;
        return contentText;
      }
    }

    return res.data.result || res.data;
  }
}

// ─── Gate → web-shape normalisers (COR-6) ─────────────────────────────
// In token-only mode the client answers from Gate; these map the Gate SDK contracts
// (vendor/fusebase-gate-sdk types) onto the shapes the web API returns, so callers and
// tools see the same objects either way. Fields Gate doesn't provide get neutral values.

/** Gate `OrgWorkspaceContract`. */
export interface GateWorkspace {
  id: string;
  orgId?: string;
  title?: string | null;
  isDefault?: boolean;
  color?: string | null;
  role?: string | null;
}

/** Gate `WorkspaceNoteSummaryContract` (notes and folders), optionally with content. */
export interface GateNoteSummary {
  globalId: string;
  title?: string | null;
  parentId?: string | null;
  md?: string;
}

/** Gate's default folder id; used where Gate omits a parent. */
const GATE_DEFAULT_FOLDER = "default";

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/** The payload of a Gate tool_call result (`{ ok, data }` envelope, or the bare payload). */
function gatePayload(res: unknown): Record<string, unknown> {
  if (isRecord(res) && isRecord(res.data)) return res.data;
  return isRecord(res) ? res : {};
}

/** Read `key` from a Gate result as an array, or throw naming the operation. */
export function gateList(res: unknown, key: string, opId: string): unknown[] {
  const list = gatePayload(res)[key];
  if (!Array.isArray(list)) {
    throw new Error(`Gate ${opId} returned no ${key} array: ${JSON.stringify(res)?.slice(0, 200)}`);
  }
  return list;
}

/** Read the object at `key` from a Gate result, or undefined. */
export function gateItem(res: unknown, key: string): Record<string, unknown> | undefined {
  const item = gatePayload(res)[key];
  return isRecord(item) ? item : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

export function toGateWorkspace(v: unknown): GateWorkspace | undefined {
  if (!isRecord(v) || !str(v.id)) return undefined;
  return {
    id: String(v.id),
    orgId: str(v.orgId),
    title: str(v.title) ?? null,
    isDefault: v.isDefault === true,
    color: str(v.color) ?? null,
    role: str(v.role) ?? null,
  };
}

export function toGateNote(v: unknown): GateNoteSummary | undefined {
  if (!isRecord(v) || !str(v.globalId)) return undefined;
  return {
    globalId: String(v.globalId),
    title: str(v.title) ?? null,
    parentId: str(v.parentId) ?? null,
    md: typeof v.md === "string" ? v.md : undefined,
  };
}

export function gateWorkspaceToFusebase(ws: GateWorkspace, orgId: string): FusebaseWorkspace {
  return {
    orgId: ws.orgId || orgId,
    workspaceId: ws.id,
    title: ws.title || ws.id,
    color: ws.color || "",
  };
}

export function gateNoteToFusebase(
  note: GateNoteSummary,
  workspaceId: string,
  type: "note" | "folder" = "note",
): FusebaseNote {
  return {
    globalId: note.globalId,
    parentId: note.parentId || GATE_DEFAULT_FOLDER,
    createdAt: 0,
    dateAdded: 0,
    dateUpdated: 0,
    updatedAt: 0,
    type,
    role: "",
    title: note.title || "",
    url: "",
    shared: false,
    isSharedForPortal: false,
    favorite: false,
    lastChangeBy: 0,
    cntNotes: 0,
    size: 0,
    editnote: false,
    isEncrypted: false,
    isCompleted: false,
    workspaceId,
    isImported: false,
    isFullwidth: false,
    userId: 0,
    isReady: true,
    outliner: false,
    emoji: "",
    isPortalShare: false,
  };
}

/**
 * Gate folder list → the web menu shape (`/gwapi2/ft:notes/menu?type=folder`), whose ids
 * carry a `notesFolder#` prefix that list_folders and the folder cache strip.
 */
export function gateFoldersToFusebase(folders: GateNoteSummary[]): FusebaseFolder[] {
  const parents = new Set(folders.map((f) => f.parentId).filter((p): p is string => Boolean(p)));
  return folders.map((f, index) => ({
    type: "folder",
    id: `notesFolder#${f.globalId}`,
    parentId: f.parentId || GATE_DEFAULT_FOLDER,
    hasChildren: parents.has(f.globalId),
    name: f.title || "",
    icon: "",
    createdAt: 0,
    updatedAt: 0,
    isShared: false,
    children: [],
    index,
  }));
}
