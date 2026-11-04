import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
const READ_ONLY = new Set([
  "query_isolated_sql",
  "check_portal_availability",
  "check_session_health",
  "check_version",
  "get_active_import_status",
  "get_activity_stream",
  "get_agent_public_profile",
  "get_ai_agent_favorites",
  "get_ai_assistant_state",
  "get_ai_usage",
  "get_automation_flags",
  "get_automation_flow",
  "get_automation_user",
  "get_billing_info",
  "get_comment_threads",
  "get_dashboard_detail",
  "get_dashboard_templates",
  "get_database_data",
  "get_database_detail",
  "get_database_entity",
  "get_database_entity_templates",
  "get_database_rows",
  "get_database_schema",
  "get_file_count",
  "get_guide",
  "get_labels",
  "get_member_roles",
  "get_members",
  "get_mention_entities",
  "get_navigation_menu",
  "get_note_tags",
  "get_org_features",
  "get_org_limits",
  "get_org_permissions",
  "get_org_trials",
  "get_org_usage",
  "get_page",
  "get_page_attachments",
  "get_page_content",
  "get_portal",
  "get_portal_navigation_menu",
  "get_portal_pages",
  "get_portal_theme",
  "get_recent_pages",
  "get_recently_updated_notes",
  "get_relation_rows",
  "get_tags",
  "get_task_count",
  "get_task_description",
  "get_task_time_tracking",
  "get_task_usage",
  "get_tasks_workspace_summary",
  "get_usage_summary",
  "get_user_preferences",
  "get_workspace_detail",
  "get_workspace_emails",
  "get_workspace_info",
  "get_workspace_members_v1",
  "get_workspace_portal",
  "get_workspace_premium_status",
  "list_agent_profiles",
  "list_agents",
  "list_ai_agent_categories",
  "list_ai_agent_threads",
  "list_all_databases",
  "list_automation_flows",
  "list_automation_folders",
  "list_automation_pieces",
  "list_database_relations",
  "list_databases",
  "list_files",
  "list_flow_runs",
  "list_folders",
  "list_guide_sections",
  "list_isolated_sql_tables",
  "list_isolated_stores",
  "list_pages",
  "list_portal_clients",
  "list_portals",
  "list_task_lists",
  "list_workspaces",
  "search_guides",
  "search_tasks",

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
  const readOnlyHint = READ_ONLY.has(name);
  const sessionSetter = name === "set_tool_tier" || name === "switch_active_profile";
  return {
    readOnlyHint,
    destructiveHint: !readOnlyHint && !ADDITIVE.has(name) && !sessionSetter,
    idempotentHint: readOnlyHint || sessionSetter,
    openWorldHint: !CLOSED_WORLD.has(name),
  };
}


const DIRECT_READS = new Set(["getDashboardView", "listIsolatedStores", "getHealth", "listIsolatedStoreStages", "listIsolatedStoreMigrations", "getIsolatedStoreSqlMigrationStatus"]);
export function isReadOperation(name: string, args: Record<string, unknown> = {}): boolean {
  if (name === "download_attachment") return !args.saveToDisk && !args.outputPath;
  if (name === "fusebase_direct_tool_call") return DIRECT_READS.has(String(args.opId));
  return toolAnnotations(name).readOnlyHint === true;
}
