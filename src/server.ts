/**
 * Creates one MCP server instance per client session (one for stdio, one per HTTP session).
 *
 * The active agent profile is per session (COR-13): switch_active_profile in one HTTP
 * session no longer changes the profile other sessions use.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FusebaseClient } from "./client.js";
import { registerCoreTools } from "./tools/core-tools.js";
import { registerExtendedTools } from "./tools/extended-tools.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

export const SERVER_VERSION = "2.0.0";

const INSTRUCTIONS = `FuseBase MCP Server provides programmatic access to the FuseBase collaborative workspace platform.

Entity Hierarchy:
- Organization (Tenant) -> Workspaces
- Workspaces -> Folders -> Pages (Notes)
- Workspaces -> Databases (Tables) -> Views & Records (Rows) / Relations

Tool Tiers:
- Starts in Core Tier (34 tools) covering full CRUD and organization for pages, folders, content, comments, tasks, attachments, and profile management.
- Call 'set_tool_tier' with tier="all" to unlock all 175 tools (databases, views, relations, permissions, automations, portals, webhooks, Gate PostgreSQL, tokens).

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
  /** Register all 175 tools immediately (default: FUSEBASE_TOOLS === "all"). */
  allTools?: boolean;
}

export function createFusebaseServer(deps: ServerDeps) {
  const server = new McpServer({ name: "fusebase", version: SERVER_VERSION }, { instructions: INSTRUCTIONS });

  // Per-session state.
  let activeProfile = deps.initialProfile;
  const getClient = (profile?: string) => deps.buildClient(profile || activeProfile);

  let extendedToolsRegistered = false;
  function enableExtendedTools(): void {
    if (extendedToolsRegistered) return;
    registerExtendedTools(server, getClient);
    extendedToolsRegistered = true;
    console.error(`[fusebase] Extended tools registered`);
  }

  registerCoreTools(server, getClient, {
    enableExtendedTools,
    isExtendedToolsEnabled: () => extendedToolsRegistered,
    setActiveProfile: (p) => { activeProfile = p; },
    getActiveProfile: () => activeProfile,
  });
  registerResources(server, getClient);
  registerPrompts(server, getClient);

  if (deps.allTools) {
    enableExtendedTools();
  } else {
    console.error("[fusebase] Running in core mode (34 tools). Set FUSEBASE_TOOLS=all or call set_tool_tier to enable all 175.");
  }

  return { server, enableExtendedTools, getActiveProfile: () => activeProfile };
}
