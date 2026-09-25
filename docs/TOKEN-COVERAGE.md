# Token-only tool coverage

Which tools work with only FuseBase's official Gate and Dashboards MCP tokens, with no browser session cookie. Measured on 2026-09-25 by running the live suites in coverage mode against the sandbox workspace (see [TESTING.md](TESTING.md#token-only-coverage)).

## Summary

- **175 tools:** 20 act on the local machine or the MCP session (CLI, profiles, guides) and 155 act on FuseBase. The suites exercised 129 of the 155.
- **14 of the 129 exercised tools work with tokens only**, each write proven by reading the data back: listing workspaces, pages and folders; reading pages and their content; creating pages and folders; appending content; listing databases and isolated stores; the Gate passthrough; and triggering automation flows (through the flow's public webhook).
- **Not exercised (26):** mostly Gate-only operations that work only with tokens by design (isolated SQL, API tokens, `fusebase_gate_whoami`), plus portal creation and invites, billing and AI agent runs.
- **115 need the session cookie today.** They call FuseBase web-app endpoints, which reject the tokens (401/403):

| Area | Tools | Official route |
| --- | --- | --- |
| Databases, views, rows, relations | 41 | Mostly available: the Dashboards MCP has operations for rows, cells, relations, row order, view data, tables from templates, copies and views. Routing these tools through it is work on our side. Column changes, CSV import/export and deleting databases or views may have no equivalent |
| Org, members, usage, AI agents | 15 | None found |
| Pages: rename, move, delete; tags; recent; attachments | 12 | None found (Gate can list, read, create and append) |
| Automations | 11 | None yet (FuseBase's guide says token access is coming) |
| Portals | 10 | Partly (Gate has portal discovery and invites) |
| Tasks | 10 | None found |
| Comments and activity | 6 | None found |
| Workspace details, files, editor writes, preferences | 10 | Replacing content and embeds need the editor; the rest none found |

Found and fixed by this measurement: `list_pages` ignored the folder in token mode, `resolve_database_alias` reported "not found" when it couldn't read the database list, and `get_user_preferences` / `get_billing_info` returned nulls instead of errors.

Known limits of the measurement: two suites stopped one check early (a moved page still listed at the top level after 15 s, read through the cookie; an intermittent FuseBase listing delay), so a few tools late in those suites weren't reached. In token mode `get_page_content` returns Gate's markdown, which leaves out embeds such as iframes.

## Per-tool results

| Tool | Status | Detail |
| --- | --- | --- |
| `add_database_column` | NEEDS COOKIE | Tool 'add_database_column' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id} Invalid or expired token |
| `add_database_row` | NEEDS COOKIE | Tool 'add_database_row' failed: Error: Could not load dashboard '{id}' to find its default view: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id} Invalid or expired t |
| `add_lookup_column` | NEEDS COOKIE | Tool 'add_lookup_column' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id} Invalid or expired token |
| `add_relation_column` | NEEDS COOKIE | Tool 'add_relation_column' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/relations Invalid or expired token |
| `batch_put_database_data` | NEEDS COOKIE | Tool 'batch_put_database_data' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id} Invalid or expired token |
| `check_portal_availability` | NEEDS COOKIE | Tool 'check_portal_availability' failed: Error: Fusebase API error: 404 Not Found — https://<org-host>/v1/portals/orgs/{org}/available {} |
| `create_automation_flow` | NEEDS COOKIE | Tool 'create_automation_flow' failed: Error: Fusebase API error: 500 Internal Server Error — https://<org-host>/automation/api/v1/flows {"statusCode":500,"error":"Internal Server Error","message":"Cannot read properties of undefined (reading 'projectId')"} |
| `create_automation_folder` | NEEDS COOKIE | Tool 'create_automation_folder' failed: Error: Fusebase API error: 500 Internal Server Error — https://<org-host>/automation/api/v1/folders {"statusCode":500,"error":"Internal Server Error","message":"Cannot read properties of undefined (reading 'projectId')"} |
| `create_database` | NEEDS COOKIE | Tool 'create_database' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/databases Invalid or expired token |
| `create_interactive_app_page` | NEEDS COOKIE | Tool 'create_interactive_app_page' failed: Error: Embedding an app needs a session cookie (the Y.js editor); only tokens are configured. Run `npx tsx scripts/auth.ts` to add a session. |
| `create_task` | NEEDS COOKIE | Tool 'create_task' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft%3Atasks/workspaces/{id}/tasks?addToOrder=false {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `create_view` | NEEDS COOKIE | Tool 'create_view' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id} Invalid or expired token |
| `delete_automation_flow` | NEEDS COOKIE | Tool 'delete_automation_flow' failed: Error: Fusebase API error: 500 Internal Server Error — https://<org-host>/automation/api/v1/flows/{id} {"statusCode":500,"error":"Internal Server Error","message":"Cannot read properties of undefined (reading 'projectId')"} |
| `delete_automation_folder` | NEEDS COOKIE | Tool 'delete_automation_folder' failed: Error: Fusebase API error: 500 Internal Server Error — https://<org-host>/automation/api/v1/folders/{id} {"statusCode":500,"error":"Internal Server Error","message":"Cannot read properties of undefined (reading 'projectId')"} |
| `delete_dashboard` | NEEDS COOKIE | Tool 'delete_dashboard' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id} Invalid or expired token |
| `delete_database` | NEEDS COOKIE | Tool 'delete_database' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/databases/{id} Invalid or expired token |
| `delete_database_column` | NEEDS COOKIE | Tool 'delete_database_column' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id} Invalid or expired token |
| `delete_database_row` | NEEDS COOKIE | Tool 'delete_database_row' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/rows/{id} Invalid or expired token |
| `delete_page` | NEEDS COOKIE | Tool 'delete_page' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/workspaces/{id}/notes/XwcEfACrFiTWKYTs {"error":"Unauthorized"} |
| `delete_relation` | NEEDS COOKIE | Tool 'delete_relation' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/relations/{id} Invalid or expired token |
| `delete_task` | NEEDS COOKIE | Tool 'delete_task' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft%3Atasks/workspaces/{id}/tasks/{id} {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `delete_view` | NEEDS COOKIE | Tool 'delete_view' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id} Invalid or expired token |
| `download_attachment` | NEEDS COOKIE | Tool 'download_attachment' failed: Error: Fusebase API error: 400 Bad Request — https://<org-host>/box/attachment/{id}/{id}/qa-val-fixture.txt  |
| `duplicate_database` | NEEDS COOKIE | Tool 'duplicate_database' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/databases/copy-from/database?copy_tables=true&copy_views=true&copy_relations=true&copy_data=true&create_default_rows=true Invalid or expired token |
| `duplicate_view` | NEEDS COOKIE | Tool 'duplicate_view' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id} Invalid or expired token |
| `export_csv` | NEEDS COOKIE | Tool 'export_csv' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/export/csv?view_id={id}&delimiter=%2C Invalid or expired token |
| `fusebase_poll_mentions` | NEEDS COOKIE | Tool 'fusebase_poll_mentions' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/svc%{id}/workspaces/{id}/activityStream {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `fusebase_post_comment` | NEEDS COOKIE | Tool 'fusebase_post_comment' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft:comments/threads?workspace={id} {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `fusebase_reply_comment` | NEEDS COOKIE | Tool 'fusebase_reply_comment' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft:comments/comments?workspace={id}&thread={id} {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `fusebase_resolve_thread` | NEEDS COOKIE | Tool 'fusebase_resolve_thread' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft:comments/threads/tsyxronbpgwe {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `fusebase_swarm_init` | NEEDS COOKIE | Tool 'fusebase_swarm_init' failed: { "success": false, "error": "Swarm init failed at step \"create database\": Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/databases\nInvalid or expired token", "created": {}, "note": "Nothing was created." } |
| `fusebase_swarm_task_transition` | NEEDS COOKIE | Tool 'fusebase_swarm_task_transition' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id} Invalid or expired token |
| `get_activity_stream` | NEEDS COOKIE | Tool 'get_activity_stream' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/svc%{id}/workspaces/{id}/activityStream {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `get_agent_public_profile` | NEEDS COOKIE | Tool 'get_agent_public_profile' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/v4/api/proxy/ai-service/v1/orgs/{org}/agents/{id}/public {"name":"AccessDenied","message":"access to org {org} with privilege canGetInfo is denied for user 1","reason":"Acce |
| `get_ai_agent_favorites` | NEEDS COOKIE | Tool 'get_ai_agent_favorites' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/ai-service/v1/orgs/{org}/agentFavorites Unauthorized |
| `get_ai_assistant_state` | NEEDS COOKIE | Tool 'get_ai_assistant_state' failed: Error: Fusebase API error: 401 — https://<org-host>/ai-assistant/rest/workspaces/{id}/main-page {"body":"{\"message\": \"Unauthorized (no session specified)\"}"}  |
| `get_ai_usage` | NEEDS COOKIE | Tool 'get_ai_usage' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft%3Aai/orgs/{org}/usage {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `get_automation_flow` | NEEDS COOKIE | Tool 'get_automation_flow' failed: Error: Fusebase API error: 500 Internal Server Error — https://<org-host>/automation/api/v1/flows/{id} {"statusCode":500,"error":"Internal Server Error","message":"Cannot read properties of undefined (reading 'projectId')"} |
| `get_automation_user` | NEEDS COOKIE | Tool 'get_automation_user' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/automation/api/v1/users/me {"error":"Unauthorized: Session not specified"} |
| `get_comment_threads` | NEEDS COOKIE | Tool 'get_comment_threads' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/svc:comment/workspaces/{id}/notes/{id}/threadsInfo {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `get_dashboard_detail` | NEEDS COOKIE | Tool 'get_dashboard_detail' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id} Invalid or expired token |
| `get_database_data` | NEEDS COOKIE | Tool 'get_database_data' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id}/data?exclude_async_items=true Invalid or expired token |
| `get_database_detail` | NEEDS COOKIE | Tool 'get_database_detail' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/databases/{id} Invalid or expired token |
| `get_database_entity` | NEEDS COOKIE | Tool 'get_database_entity' failed: Error: Entity 'companies_db' not found. Available entities: none found. Tip: Use list_databases first to see available dashboard/view IDs, then call get_database_data directly. |
| `get_database_entity_templates` | NEEDS COOKIE | Tool 'get_database_entity_templates' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/templates Invalid or expired token |
| `get_database_rows` | NEEDS COOKIE | Tool 'get_database_rows' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id}/data?limit=50&exclude_async_items=true Invalid or expired token |
| `get_database_schema` | NEEDS COOKIE | Tool 'get_database_schema' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id} Invalid or expired token |
| `get_file_count` | NEEDS COOKIE | Tool 'get_file_count' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/bucket-service-proxy/v1/files/count?workspaceId={id} {"error":"Unauthorized * (1)"} |
| `get_labels` | NEEDS COOKIE | Tool 'get_labels' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft%{id}/workspaces/{id}/labels {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `get_members` | NEEDS COOKIE | Tool 'get_members' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/workspaces/{id}/members {"error":"Unauthorized"} |
| `get_mention_entities` | NEEDS COOKIE | Tool 'get_mention_entities' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/web-editor/mention-entities/{id} {"error":"Unauthorized"} |
| `get_navigation_menu` | NEEDS COOKIE | Tool 'get_navigation_menu' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft%3Anotes/menu?workspace={id} {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `get_note_tags` | NEEDS COOKIE | Tool 'get_note_tags' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/workspaces/{id}/notes/{id}/tags {"error":"Unauthorized"} |
| `get_org_features` | NEEDS COOKIE | Tool 'get_org_features' failed: Error: Fusebase API error: 404 Not Found — https://<org-host>/v1/organizations/{org}/features {} |
| `get_org_limits` | NEEDS COOKIE | Tool 'get_org_limits' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/orgs/{org}/limits {"error":"Unauthorized"} |
| `get_org_permissions` | NEEDS COOKIE | Tool 'get_org_permissions' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft%{id}/orgs/{org}/members {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `get_org_trials` | NEEDS COOKIE | Tool 'get_org_trials' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/orgs/{org} {"error":"Unauthorized"} |
| `get_org_usage` | NEEDS COOKIE | Tool 'get_org_usage' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/orgs/{org}/usage {"error":"Unauthorized"} |
| `get_page_attachments` | NEEDS COOKIE | Tool 'get_page_attachments' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/web-editor/space/{id}/note/attachments/{id} {"error":"Unauthorized"} |
| `get_portal` | NEEDS COOKIE | Tool 'get_portal' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/portal-service-proxy/v1/orgs/{org}/portals {"error":"Unauthorized * (1)"} |
| `get_portal_navigation_menu` | NEEDS COOKIE | Tool 'get_portal_navigation_menu' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/workspaces/{id}/portal {"error":"Unauthorized"} |
| `get_portal_pages` | NEEDS COOKIE | Tool 'get_portal_pages' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/portal/pages?workspaceId={id}&noteId={id} {"error":"Unauthorized"} |
| `get_portal_theme` | NEEDS COOKIE | Tool 'get_portal_theme' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/portal-service-proxy/v1/contents?workspaceId={id} {"error":"Unauthorized * (1)"} |
| `get_recent_pages` | NEEDS COOKIE | Tool 'get_recent_pages' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/web-editor/notes/recent/{id}?count=1&type=note&limit=10&offset=0 {"error":"Unauthorized"} |
| `get_recently_updated_notes` | NEEDS COOKIE | Tool 'get_recently_updated_notes' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/note-service-proxy/v1/orgs/{org}/recentlyUpdatedNotes {"error":"Unauthorized * (1)"} |
| `get_relation_rows` | NEEDS COOKIE | Tool 'get_relation_rows' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/relations/{id}?include_rows=true Invalid or expired token |
| `get_tags` | NEEDS COOKIE | Tool 'get_tags' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/workspaces/{id}/tags {"error":"Unauthorized"} |
| `get_task_count` | NEEDS COOKIE | Tool 'get_task_count' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/task-service-proxy/v1/workspaces/{id}/tasks/count {"error":"Unauthorized * (1)"} |
| `get_task_description` | NEEDS COOKIE | Tool 'get_task_description' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft%3Atasks/workspaces/{id}/taskDescriptions/{id} {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `get_task_time_tracking` | NEEDS COOKIE | Tool 'get_task_time_tracking' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft:tasks/workspaces/{id}/time/{id} {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `get_task_usage` | NEEDS COOKIE | Tool 'get_task_usage' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft%3Atasks/workspaces/{id}/usage {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `get_tasks_workspace_summary` | NEEDS COOKIE | Tool 'get_tasks_workspace_summary' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft:tasks/workspace-infos {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `get_usage_summary` | NEEDS COOKIE | Tool 'get_usage_summary' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/orgs/{org}/usageSummary {"error":"Unauthorized"} |
| `get_workspace_detail` | NEEDS COOKIE | Tool 'get_workspace_detail' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/workspace-service-proxy/v1/workspaces/{id} {"error":"Unauthorized * (1)"} |
| `get_workspace_emails` | NEEDS COOKIE | Tool 'get_workspace_emails' failed: Error: Fusebase API error: 404 Not Found — https://<org-host>/v1/workspaces/{id}/emails {} |
| `get_workspace_info` | NEEDS COOKIE | Tool 'get_workspace_info' failed: Error: Fusebase API error: 404 Not Found — https://<org-host>/api/workspaces/{id}/info {} |
| `get_workspace_members_v1` | NEEDS COOKIE | Tool 'get_workspace_members_v1' failed: Error: Fusebase API error: 404 Not Found — https://<org-host>/v1/workspaces/{id}/members {} |
| `get_workspace_portal` | NEEDS COOKIE | Tool 'get_workspace_portal' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/portal-service-proxy/v1/workspaces/{id}/portals {"error":"Unauthorized * (1)"} |
| `import_csv` | NEEDS COOKIE | Tool 'import_csv' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/import/csv Invalid or expired token |
| `link_database_rows` | NEEDS COOKIE | Tool 'link_database_rows' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/relations/{id}/rows Invalid or expired token |
| `list_agents` | NEEDS COOKIE | Tool 'list_agents' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/ai-service/v1/orgs/{org}/agent-categories/agents?globalId=all Unauthorized |
| `list_ai_agent_categories` | NEEDS COOKIE | Tool 'list_ai_agent_categories' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/ai-service/v1/orgs/{org}/agent-categories Unauthorized |
| `list_ai_agent_threads` | NEEDS COOKIE | Tool 'list_ai_agent_threads' failed: Error: Fusebase API error: 401 — https://<org-host>/ai-assistant/rest/orgs/{org}/agents/39/threads {"body":"{\"message\": \"Unauthorized (no session specified)\"}"}  |
| `list_all_databases` | NEEDS COOKIE | Tool 'list_all_databases' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/databases?scope_type=org&scope_id={id} Invalid or expired token |
| `list_automation_flows` | NEEDS COOKIE | Tool 'list_automation_flows' failed: Error: Fusebase API error: 400 Bad Request — https://<org-host>/automation/api/v1/flows {"statusCode":400,"error":"Bad Request","message":"querystring must have required property 'projectId'"} |
| `list_automation_folders` | NEEDS COOKIE | Tool 'list_automation_folders' failed: Error: Fusebase API error: 500 Internal Server Error — https://<org-host>/automation/api/v1/folders {"statusCode":500,"error":"Internal Server Error","message":"Cannot read properties of undefined (reading 'projectId')"} |
| `list_automation_pieces` | NEEDS COOKIE | Tool 'list_automation_pieces' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/automation/api/v1/pieces {"error":"Unauthorized: Session not specified"} |
| `list_database_relations` | NEEDS COOKIE | Tool 'list_database_relations' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/allowed-items?source_view_ids={id}&include_possible_lookup_items=true I |
| `list_files` | NEEDS COOKIE | Tool 'list_files' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/workspaces/{id}/files?showPortalFiles=true&limitSize=25&limitFrom=0&resetCache=true {"status":401,"body":{"error":"Unauthorized"}} |
| `list_flow_runs` | NEEDS COOKIE | Tool 'list_flow_runs' failed: Error: Fusebase API error: 500 Internal Server Error — https://<org-host>/automation/api/v1/flow-runs?limit=5 {"statusCode":500,"error":"Internal Server Error","message":"Cannot read properties of undefined (reading 'projectId')"} |
| `list_portal_clients` | NEEDS COOKIE | Tool 'list_portal_clients' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/orgs/{org}/membersWithOwner {"error":"Unauthorized"} |
| `list_portals` | NEEDS COOKIE | Tool 'list_portals' failed: Error: Fusebase API error: 404 Not Found — https://<org-host>/v1/portals/orgs/{org}/portals?workspaceId={id} {} |
| `list_task_lists` | NEEDS COOKIE | Tool 'list_task_lists' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft%3Atasks/workspaces/{id}/taskLists {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `move_kanban_card` | NEEDS COOKIE | Tool 'move_kanban_card' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id} Invalid or expired token |
| `move_page` | NEEDS COOKIE | Tool 'move_page' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/workspaces/{id}/notes/{id}/move {"error":"Unauthorized"} |
| `publish_page_to_portal` | NEEDS COOKIE | Tool 'publish_page_to_portal' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/workspaces/{id}/notes/{id}/upsert {"error":"Unauthorized"} |
| `rename_database_column` | NEEDS COOKIE | Tool 'rename_database_column' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id} Invalid or expired token |
| `reorder_database_columns` | NEEDS COOKIE | Tool 'reorder_database_columns' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id} Invalid or expired token |
| `reorder_database_rows` | NEEDS COOKIE | Tool 'reorder_database_rows' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/rows/order?view_id={id}&section_type=view&section_key=view&section_value= |
| `resolve_database_alias` | NEEDS COOKIE | Tool 'resolve_database_alias' failed: Error: Couldn't read the database list to resolve 'companies_db': Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/databases?scope_type=org&scope_id={id} Invalid or expired token |
| `search_tasks` | NEEDS COOKIE | Tool 'search_tasks' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft%3Atasks/tasks/search {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `set_column_width` | NEEDS COOKIE | Tool 'set_column_width' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id} Invalid or expired token |
| `set_view_grouping` | NEEDS COOKIE | Tool 'set_view_grouping' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id}/representations/kanban Invalid or expired token |
| `set_view_representation` | NEEDS COOKIE | Tool 'set_view_representation' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id}/representations/kanban Invalid or expired token |
| `unlink_database_rows` | NEEDS COOKIE | Tool 'unlink_database_rows' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/relations/{id}/rows?source_index={id}&target_index={id} In |
| `update_automation_flow` | NEEDS COOKIE | Tool 'update_automation_flow' failed: Error: Fusebase API error: 500 Internal Server Error — https://<org-host>/automation/api/v1/flows/{id} {"statusCode":500,"error":"Internal Server Error","message":"Cannot read properties of undefined (reading 'projectId')"} |
| `update_database` | NEEDS COOKIE | Tool 'update_database' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/databases/{id} Invalid or expired token |
| `update_database_cell` | NEEDS COOKIE | Tool 'update_database_cell' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id} Invalid or expired token |
| `update_page` | NEEDS COOKIE | Tool 'update_page' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/workspaces/{id}/notes/{id}/upsert {"error":"Unauthorized"} |
| `update_page_content` | NEEDS COOKIE | Tool 'update_page_content' failed: Error: Replacing page content needs a session cookie (the Y.js editor); only tokens are configured. Use replace: false with markdown to append through Gate, or run `npx tsx scripts/auth.ts` to add a session. |
| `update_page_tags` | NEEDS COOKIE | Tool 'update_page_tags' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/workspaces/{id}/notes/{id}/tags {"error":"Unauthorized"} |
| `update_task` | NEEDS COOKIE | Tool 'update_task' failed: Error: Fusebase API error: 403 Forbidden — https://<org-host>/gwapi2/ft%3Atasks/workspaces/{id}/tasks/{id} {"name":"AuthorizationFailed","message":"Authorization failed"} |
| `update_view` | NEEDS COOKIE | Tool 'update_view' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id} Invalid or expired token |
| `upload_file` | NEEDS COOKIE | Tool 'upload_file' failed: Error: Fusebase API error: 401 Unauthorized — https://<org-host>/v2/api/web-editor/file/attachment {"error":"Unauthorized"} |
| `append_page_content` | WORKS | writes: read-back |
| `create_folder` | WORKS | writes: read-back |
| `create_page` | WORKS | writes: read-back |
| `fusebase_direct_tool_call` | WORKS |  |
| `fusebase_work_trigger_n8n` | WORKS | writes: exempt |
| `get_automation_flags` | WORKS |  |
| `get_page` | WORKS |  |
| `get_page_content` | WORKS |  |
| `get_user_preferences` | NEEDS COOKIE | Counted as working in this run because it hid its errors (returned all nulls); fixed since, it now reports them |
| `list_databases` | WORKS |  |
| `list_folders` | WORKS |  |
| `list_isolated_stores` | WORKS |  |
| `list_pages` | WORKS |  |
| `list_workspaces` | WORKS |  |
| `trigger_automation_flow` | WORKS | writes: exempt |
| `apply_isolated_sql_migrations` | NOT EXERCISED |  |
| `batch_insert_isolated_sql_rows` | NOT EXERCISED |  |
| `create_dashboard_table` | NOT EXERCISED | only calls that failed in both modes |
| `create_isolated_store` | NOT EXERCISED |  |
| `create_portal` | NOT EXERCISED |  |
| `create_portal_magic_link` | NOT EXERCISED |  |
| `execute_isolated_sql` | NOT EXERCISED |  |
| `fusebase_gate_whoami` | NOT EXERCISED |  |
| `fusebase_token_create` | NOT EXERCISED |  |
| `fusebase_token_get` | NOT EXERCISED |  |
| `fusebase_token_list` | NOT EXERCISED |  |
| `fusebase_token_permission_catalog` | NOT EXERCISED |  |
| `fusebase_token_revoke` | NOT EXERCISED |  |
| `fusebase_work_run_agent` | NOT EXERCISED |  |
| `fusebase_work_scrape_url` | NOT EXERCISED |  |
| `get_active_import_status` | NOT EXERCISED |  |
| `get_billing_info` | NOT EXERCISED |  |
| `get_dashboard_templates` | NOT EXERCISED |  |
| `get_member_roles` | NOT EXERCISED |  |
| `get_workspace_premium_status` | NOT EXERCISED |  |
| `insert_isolated_sql_row` | NOT EXERCISED |  |
| `invite_portal_client` | NOT EXERCISED |  |
| `list_isolated_sql_tables` | NOT EXERCISED |  |
| `query_isolated_sql` | NOT EXERCISED |  |
| `select_isolated_sql_rows` | NOT EXERCISED |  |
| `set_sidebar_collapsed` | NOT EXERCISED |  |
| `check_session_health` | LOCAL | acts on the local machine or session |
| `check_version` | LOCAL | acts on the local machine or session |
| `fusebase_cli_app_update` | LOCAL | acts on the local machine or session |
| `fusebase_cli_deploy` | LOCAL | acts on the local machine or session |
| `fusebase_cli_init` | LOCAL | acts on the local machine or session |
| `fusebase_cli_list_apps` | LOCAL | acts on the local machine or session |
| `fusebase_cli_logs` | LOCAL | acts on the local machine or session |
| `fusebase_cli_secret_create` | LOCAL | acts on the local machine or session |
| `fusebase_cli_secret_list` | LOCAL | acts on the local machine or session |
| `fusebase_cli_sidecar_add` | LOCAL | acts on the local machine or session |
| `fusebase_cli_sidecar_list` | LOCAL | acts on the local machine or session |
| `fusebase_cli_sidecar_remove` | LOCAL | acts on the local machine or session |
| `fusebase_cli_status` | LOCAL | acts on the local machine or session |
| `get_guide` | LOCAL | acts on the local machine or session |
| `list_agent_profiles` | LOCAL | acts on the local machine or session |
| `list_guide_sections` | LOCAL | acts on the local machine or session |
| `refresh_auth` | LOCAL | acts on the local machine or session |
| `search_guides` | LOCAL | acts on the local machine or session |
| `set_tool_tier` | LOCAL | acts on the local machine or session |
| `switch_active_profile` | LOCAL | acts on the local machine or session |
