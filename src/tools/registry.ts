import type { McpServer, RegisteredTool, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";

const registrations = new WeakMap<McpServer, Map<string, RegisteredTool>>();

const READ_ONLY = new Set([
  "export_csv", "resolve_database_alias", "select_isolated_sql_rows", "fusebase_poll_mentions",
  "fusebase_gate_whoami", "fusebase_discover_operations", "fusebase_token_list", "fusebase_token_get",
  "fusebase_token_permission_catalog", "fusebase_cli_status", "fusebase_cli_list_apps",
  "fusebase_cli_logs", "fusebase_cli_secret_list", "fusebase_cli_sidecar_list",
]);
const ADDITIVE = new Set([
  "create_page", "create_folder", "append_page_content", "upload_file", "create_task",
  "create_task_list", "create_database", "create_dashboard_table", "create_view", "duplicate_view",
  "duplicate_database", "add_database_column", "add_database_row", "add_relation_column",
  "add_lookup_column", "link_database_rows", "create_automation_flow", "create_automation_folder",
  "create_isolated_store", "insert_isolated_sql_row", "batch_insert_isolated_sql_rows",
  "create_portal", "invite_portal_client", "create_portal_magic_link", "create_interactive_app_page",
  "fusebase_post_comment", "fusebase_reply_comment", "fusebase_token_create", "fusebase_swarm_init",
]);
const CLOSED_WORLD = new Set([
  "set_tool_tier", "switch_active_profile", "list_agent_profiles", "search_guides", "get_guide", "list_guide_sections",
]);

/** Conservative for mixed/dynamic tools: SQL, direct calls, downloads and CLI updates may mutate. */
export function toolAnnotations(name: string): ToolAnnotations {
  const readOnlyHint = /^(get_|list_|search_|check_)/.test(name) || READ_ONLY.has(name);
  const sessionSetter = name === "set_tool_tier" || name === "switch_active_profile";
  return {
    readOnlyHint,
    destructiveHint: !readOnlyHint && !ADDITIVE.has(name) && !sessionSetter,
    idempotentHint: readOnlyHint || sessionSetter,
    openWorldHint: !CLOSED_WORLD.has(name),
  };
}

/** Keep public SDK handles so tier changes can disable tools as well as hide their schemas. */
export function registeredTools(server: McpServer): ReadonlyMap<string, RegisteredTool> {
  return registrations.get(server) ?? new Map();
}

export function registerAnnotatedTool<Args extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: Args,
  handler: ToolCallback<Args>,
): RegisteredTool {
  const tool = server.registerTool(name, { description, inputSchema, annotations: toolAnnotations(name) }, handler);
  let tools = registrations.get(server);
  if (!tools) { tools = new Map(); registrations.set(server, tools); }
  tools.set(name, tool);
  return tool;
}
