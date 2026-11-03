/**
 * Creates one MCP server instance per client session (one for stdio, one per HTTP session).
 *
 * The active agent profile is per session (COR-13): switch_active_profile in one HTTP
 * session no longer changes the profile other sessions use.
 */

import { McpServer, type RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FusebaseClient } from "./client.js";
import { registerCoreTools } from "./tools/core-tools.js";
import { registerExtendedTools } from "./tools/extended-tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";
import { registeredTools } from "./tools/registry.js";

export const SERVER_VERSION = "2.1.0";

const INSTRUCTIONS = `FuseBase MCP Server provides programmatic access to the FuseBase collaborative workspace platform.

Entity Hierarchy:
- Organization (Tenant) -> Workspaces
- Workspaces -> Folders -> Pages (Notes)
- Workspaces -> Databases (Tables) -> Views & Records (Rows) / Relations

Tool Tiers:
- Starts in Core Tier (34 tools) covering full CRUD and organization for pages, folders, content, comments, tasks, attachments, and profile management.
- Call 'set_tool_tier' with tier="all" to unlock all 177 tools (databases, views, relations, permissions, automations, portals, webhooks, Gate PostgreSQL, tokens).
- Call 'set_tool_tier' with tier="core" to return to 34 tools without restarting; disabled tools cannot be invoked until re-enabled.

Content & Sync Guidelines:
- Pages are collaborative documents backed by Y.js CRDT state. Use 'append_page_content' or 'update_page_content' to edit. Real-time updates propagate via WebSocket.
- When retrieving page content, 'format: "markdown"' reduces token consumption by ~50% compared to raw HTML.
- For attachments, 'download_attachment' returns images natively or saves large files to disk via 'saveToDisk: true'.
- Destructive actions (deleting pages, databases, rows, relations, columns) are marked with [DESTRUCTIVE] and cannot be undone.`;

export interface ServerDeps {
  /** Build a client for a profile (undefined = default profile). */
  buildClient: (profile?: string) => FusebaseClient;
  /** Initial active profile for the session (default: FUSEBASE_PROFILE). */
  initialProfile?: string;
  /** Expose all 177 tools initially; otherwise extended tools start disabled. */
  allTools?: boolean;
}

/** Coalesce synchronous SDK enable/disable notifications into one per completed tier change. */
class TieredMcpServer extends McpServer {
  private batchDepth = 0;
  private toolsChanged = false;

  batchToolChanges(change: () => void): void {
    this.batchDepth++;
    try { change(); } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.toolsChanged) {
        this.toolsChanged = false;
        super.sendToolListChanged();
      }
    }
  }

  override sendToolListChanged(): void {
    if (this.batchDepth > 0) this.toolsChanged = true;
    else super.sendToolListChanged();
  }
}

export function createFusebaseServer(deps: ServerDeps) {
  const server = new TieredMcpServer({ name: "fusebase", version: SERVER_VERSION }, { instructions: INSTRUCTIONS });

  // Per-session state.
  let activeProfile = deps.initialProfile;
  const getClient = (profile?: string) => deps.buildClient(profile || activeProfile);

  let extendedToolsEnabled = true;
  const extendedTools: RegisteredTool[] = [];
  function setToolTier(tier: "core" | "all"): void {
    const enabled = tier === "all";
    if (extendedToolsEnabled === enabled) return;
    server.batchToolChanges(() => {
      for (const tool of extendedTools) {
        if (enabled) tool.enable();
        else tool.disable();
      }
      extendedToolsEnabled = enabled;
    });
  }
  const enableExtendedTools = () => setToolTier("all");

  server.batchToolChanges(() => {
    registerCoreTools(server, getClient, {
      setToolTier,
      isExtendedToolsEnabled: () => extendedToolsEnabled,
      setActiveProfile: (p) => { activeProfile = p; },
      getActiveProfile: () => activeProfile,
    });
    const coreNames = new Set(registeredTools(server).keys());
    registerExtendedTools(server, getClient);
    for (const [name, tool] of registeredTools(server)) {
      if (!coreNames.has(name)) extendedTools.push(tool);
    }
    if (!deps.allTools) setToolTier("core");
  });
  registerResources(server, getClient);
  registerPrompts(server, getClient);

  if (!deps.allTools) {
    console.error("[fusebase] Running in core mode (34 tools). Set FUSEBASE_TOOLS=all or call set_tool_tier to enable all 177.");
  }

  return { server, enableExtendedTools, setToolTier, getActiveProfile: () => activeProfile };
}
