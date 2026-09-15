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

export interface GateBridgeConfig {
  gateUrl?: string;
  dashboardsUrl?: string;
  gateToken?: string;
  dashboardsToken?: string;
  token?: string; // Unified token fallback
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

export class FusebaseGateBridge {
  private gateUrl: string;
  private dashboardsUrl: string;
  private gateToken?: string;
  private dashboardsToken?: string;

  private gateSessionId?: string;
  private dashboardsSessionId?: string;

  private cachedIdentity?: GateIdentity;
  private reqId: number = 1;

  constructor(config: GateBridgeConfig) {
    this.gateUrl = config.gateUrl || process.env.GATE_MCP_URL || "https://gate-mcp.thefusebase.com/mcp";
    this.dashboardsUrl = config.dashboardsUrl || process.env.DASHBOARDS_MCP_URL || "https://dashboards-mcp.thefusebase.com/mcp";
    this.gateToken = config.gateToken || config.token || process.env.FUSEBASE_GATE_TOKEN || process.env.GATE_MCP_TOKEN || process.env.FUSEBASE_TOKEN;
    this.dashboardsToken = config.dashboardsToken || config.token || process.env.FUSEBASE_DASHBOARDS_TOKEN || process.env.DASHBOARDS_MCP_TOKEN || process.env.FUSEBASE_TOKEN;
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

    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const newSessionId = res.headers.get("mcp-session-id");
    if (newSessionId) {
      if (target === "gate") this.gateSessionId = newSessionId;
      else this.dashboardsSessionId = newSessionId;
      sessionId = newSessionId;
    }

    const text = await res.text();

    // Check for missing session and retry if applicable
    if (
      retryInitOnMissingSession &&
      (text.includes("Missing session") || res.status === 400 || res.status === 404) &&
      payload.method !== "initialize"
    ) {
      await this.initTarget(target);
      return this.postJsonRpc(target, payload, false);
    }

    // Parse response
    let json: any;
    const sseMatch = text.match(/data: (\{.*\})/);
    if (sseMatch) {
      try {
        json = JSON.parse(sseMatch[1]);
      } catch {
        // Fallback
      }
    }

    if (!json) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
    }

    if (!res.ok && !json.result && !json.error) {
      throw new Error(`HTTP ${res.status} from ${url}: ${text.slice(0, 300)}`);
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
          clientInfo: { name: "fusebase-mcp-bridge", version: "1.0.0" },
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

  /** Initialize bridge and auto-discover identity from upstream */
  async init(): Promise<GateIdentity> {
    if (!this.isConfigured) {
      throw new Error("FusebaseGateBridge is not configured with any tokens.");
    }

    let primaryTarget: "gate" | "dashboards" = this.hasGate ? "gate" : "dashboards";
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

    let hosts = whoamiData.hosts;
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

    if (res.data.result?.content?.[0]?.text) {
      try {
        return JSON.parse(res.data.result.content[0].text);
      } catch {
        return { text: res.data.result.content[0].text };
      }
    }
    return res.data.result || res.data;
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
        opId === "createToken" ||
        opId === "listOrgUsers"
      ) {
        if (!mergedArgs.scope_type) mergedArgs.scope_type = "org";
        if (!mergedArgs.scope_id) mergedArgs.scope_id = identity.orgId;
      } else if (opId === "listPermissionCatalog") {
        // No orgId or scope required
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
      throw new Error(`Upstream FuseBase [${opId}] error: ${errMsg}`);
    }

    if (contentText) {
      try {
        const parsed = JSON.parse(contentText);
        if (parsed && typeof parsed === "object" && parsed.ok === false && parsed.error) {
          throw new Error(`Upstream FuseBase [${opId}] failed: ${parsed.error.message || JSON.stringify(parsed.error)}`);
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
