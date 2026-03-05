# Fusebase API — Complete Endpoint Reference

> **This is the official reference for all discovered Fusebase API endpoints.**
> Update this document when new endpoints are discovered or new tools are implemented.
>
> Source: API discovery crawl (141 unique endpoints, 927 requests).
> Cross-referenced against 46 implemented MCP tools.
> Last updated: 2026-02-08

---

## Legend

| Status | Meaning |
|---|---|
| ✅ | Implemented as MCP tool |
| 🔲 | Discovered, not yet implemented |
| ❌ | Returns error (404/500) — not viable |
| 🔒 | Auth/redirect/UI page — not useful as API tool |
| 🔗 | External service (not Fusebase core) |

### Daily Value Ratings

| Rating | Meaning | Use Pattern |
|---|---|---|
| ⭐⭐⭐⭐⭐ | Essential | Almost every session |
| ⭐⭐⭐⭐ | High | Multiple times per week |
| ⭐⭐⭐ | Moderate | Weekly |
| ⭐⭐ | Low | Occasional admin/audit |
| ⭐ | Rare | One-time setup or billing |

---

## 1. Content & Pages

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| ✅ | GET | `/v2/api/workspaces/{wid}/notes` | `list_pages` — List pages in a workspace, filterable by folder, with pagination | ⭐⭐⭐⭐⭐ |
| ✅ | GET | `/v2/api/web-editor/space/{wid}/note/{nid}` | `get_page` — Get detailed page metadata (title, dates, size, sharing) | ⭐⭐⭐⭐⭐ |
| ✅ | GET | `/dump/{wid}/{nid}` | `get_page_content` — Get raw HTML content of a page | ⭐⭐⭐⭐⭐ |
| ✅ | GET | `/v2/api/web-editor/notes/recent/{wid}` | `get_recent_pages` — Recently accessed pages sorted by last access time | ⭐⭐⭐⭐ |
| ✅ | POST | `/v2/api/web-editor/notes/create` | `create_page` — Create a new blank page in a workspace | ⭐⭐⭐⭐ |
| ✅ | POST | `/v4/api/workspaces/{wid}/texts/{nid}/tokens` | `update_page_content` — Update a page's content (replaces HTML body) | ⭐⭐⭐⭐⭐ |
| ✅ | DELETE | (via client method) | `delete_page` — Permanently deletes a page | ⭐⭐ |
| ✅ | GET | `/v2/api/note-service-proxy/v1/orgs/{orgId}/recentlyUpdatedNotes` | `get_recently_updated_notes` — Pages updated recently across workspace | ⭐⭐⭐ |
| 🔲 | GET | `/ai-assistant/rest/workspaces/{wid}/main-page` | AI assistant state page — threads, preferences, usage | ⭐⭐⭐⭐ |
| 🔲 | GET | `/gwapi2/ft:cta/workspaces/{wid}/notes/{nid}/cta` | Call-to-action data embedded in a page | ⭐⭐ |
| 🔲 | GET | `/box/attachment/{wid}/{id}/{filename}` | Direct binary download of an attachment file | ⭐⭐⭐ |

## 2. Folders & Navigation

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| ✅ | GET | `/gwapi2/ft:notes/menu` | `list_folders` — Folder tree for a workspace (nested, with icons) | ⭐⭐⭐⭐ |
| ✅ | GET | `/gwapi2/ft:notes/menu` | `get_navigation_menu` — Full sidebar navigation menu structure | ⭐⭐⭐ |

## 3. Tags & Labels

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| ✅ | GET | `/v2/api/workspaces/{wid}/tags` | `get_tags` — All tags for a workspace | ⭐⭐⭐ |
| ✅ | GET | `/v2/api/workspaces/{wid}/notes/{nid}/tags` | `get_note_tags` — Tags for a specific note | ⭐⭐⭐ |
| ✅ | PUT | `/v2/api/workspaces/{wid}/notes/{nid}/tags` | `update_page_tags` — Replace all tags on a page | ⭐⭐⭐ |
| ✅ | GET | `/v2/api/workspaces/{wid}/notes/tags` | `get_tags` (all notes variant) — Workspace tag vocabulary | ⭐⭐⭐ |
| ✅ | GET | `/gwapi2/ft:workspaces/workspaces/{wid}/labels` | `get_labels` — Workspace-level labels (distinct from user tags) | ⭐⭐ |

## 4. Members & Permissions

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| ✅ | GET | `/v2/api/workspaces/{wid}/members` | `get_members` — Workspace members with roles | ⭐⭐⭐ |
| ✅ | GET | `/v2/api/orgs/{orgId}/membersWithOwner` | `get_members` (org-level) — All org members with emails | ⭐⭐⭐ |
| ✅ | GET | `/gwapi2/ft:permissions/orgs/{orgId}/members` | `get_org_permissions` — Org-level permission settings | ⭐ |
| ✅ | GET | `/v2/api/web-editor/mention-entities/{wid}` | `get_mention_entities` — Mentionable entities for @mentions | ⭐⭐ |
| ✅ | GET | `/gwapi2/ft:workspaces/workspaces/{wid}/members` | (via workspace members) — Members with expanded groups | ⭐⭐⭐ |
| 🔲 | GET | `/gwapi2/ft:org/orgs/{orgId}/member-roles` | Member role definitions — what each role can do | ⭐⭐ |
| 🔲 | GET | `/v1/workspaces/{wid}/members` | v1 member list — includes firstname, lastname, email, avatar, granular roles | ⭐⭐ |

## 5. Tasks

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| ✅ | POST | `/gwapi2/ft:tasks/tasks/search` | `search_tasks` — Search tasks across a workspace, filterable by page | ⭐⭐⭐⭐ |
| ✅ | GET | `/gwapi2/ft:tasks/workspaces/{wid}/taskLists` | `list_task_lists` — Kanban boards and their tasks | ⭐⭐⭐⭐ |
| ✅ | POST | `/gwapi2/ft:tasks/workspaces/{wid}/tasks` | `create_task` — Create a task in a task list | ⭐⭐⭐⭐ |
| ✅ | GET | `/gwapi2/ft:tasks/workspaces/{wid}/taskDescriptions/{tid}` | `get_task_description` — Full task body/description | ⭐⭐⭐ |
| ✅ | GET | `/gwapi2/ft:tasks/workspaces/{wid}/usage` | `get_task_usage` — Task usage stats and quotas | ⭐ |
| ✅ | GET | `/v2/api/task-service-proxy/v1/workspaces/{wid}/tasks/count` | `get_task_count` — Total task count for a workspace | ⭐⭐ |
| ✅ | POST | `/gwapi2/ft:tasks/boards` | (via list_task_lists) — Board column data | ⭐⭐⭐ |
| ✅ | POST | `/gwapi2/ft:tasks/board-columns` | (via list_task_lists) — Board column structure | ⭐⭐⭐ |
| ✅ | POST | `/gwapi2/svc:note-task/workspaces/{wid}/taskLists` | (via list_task_lists) — Note-linked task lists | ⭐⭐⭐ |
| ✅ | POST | `/gwapi2/svc:note-task/workspaces/{wid}/taskLists/{tlid}` | (via list_task_lists) — Specific note-linked task list | ⭐⭐⭐ |
| 🔲 | GET | `/gwapi2/ft:tasks/workspace-infos` | Task summary across all workspaces (orgId, title, color) | ⭐⭐⭐ |
| 🔲 | GET | `/gwapi2/ft:tasks/workspaces/{wid}/time/{tid}` | Time tracking data for a specific task | ⭐⭐⭐ |

## 6. Comments & Activity

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| ✅ | GET | `/gwapi2/svc:comment/workspaces/{wid}/notes/{nid}/threadsInfo` | `get_comment_threads` — Comment threads on a page | ⭐⭐⭐ |
| ✅ | GET | `/gwapi2/svc:notification/workspaces/{wid}/activityStream` | `get_activity_stream` — Activity feed (edits, shares, comments) | ⭐⭐⭐ |
| ✅ | POST | `/gwapi2/ft:comments/threads?workspace={wid}` | `fusebase_post_comment` — Create a new comment thread on a page block | ⭐⭐⭐⭐ |
| ✅ | POST | `/gwapi2/ft:comments/comments?workspace={wid}&thread={tid}` | `fusebase_reply_comment` — Reply to an existing comment thread | ⭐⭐⭐⭐ |
| ✅ | PATCH | `/gwapi2/ft:comments/threads/{tid}` | `fusebase_resolve_thread` — Resolve/close a comment thread | ⭐⭐⭐ |
| ✅ | POST | `/gwapi2/ft:comments/comments/read?workspace={wid}&thread={tid}` | (internal) — Mark thread as read | ⭐⭐ |
| ✅ | GET | `/gwapi2/ft:buckets/buckets` | (via comment/task buckets) — Upload buckets for comments/tasks | ⭐⭐ |

## 7. Files & Attachments

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| ✅ | GET | `/v2/api/workspaces/{wid}/files` | `list_files` — All uploaded files in a workspace | ⭐⭐⭐ |
| ✅ | GET | `/v2/api/bucket-service-proxy/v1/files/count` | `get_file_count` — Total file count | ⭐ |
| ✅ | GET | `/v2/api/web-editor/space/{wid}/note/attachments/{nid}` | `get_page_attachments` — Images/files/audio embedded in a page | ⭐⭐⭐ |
| 🔲 | POST | `/v2/api/web-editor/file/attachment` | Upload a file attachment to a page | ⭐⭐⭐ |
| 🔲 | POST | `/v3/api/web-editor/file/v2-upload` | Upload a file (v2 upload endpoint) | ⭐⭐⭐ |

## 8. Organization

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| ✅ | GET | `/v2/api/orgs/{orgId}/usage` | `get_org_usage` — Organization-wide usage metrics | ⭐⭐ |
| ✅ | GET | `/v2/api/orgs/{orgId}/limits` | `get_org_limits` — Plan limits (max workspaces, storage, members) | ⭐⭐ |
| ✅ | GET | `/v2/api/orgs/{orgId}/usageSummary` | `get_usage_summary` — Summarized usage across all workspaces | ⭐⭐ |
| ✅ | GET | `/v1/organizations/{orgId}/features` | `get_org_features` — Feature flags enabled for the org | ⭐ |
| ✅ | GET | `/gwapi2/ft:ai/orgs/{orgId}/usage` | `get_ai_usage` — AI feature usage (tokens, requests) | ⭐⭐ |
| 🔲 | GET | `/v1/organizations/{orgId}/limits` | v1 org limits (duplicate of v2) | ⭐ |
| 🔲 | GET | `/v1/organizations/{orgId}/permissions` | v1 permissions (duplicate of gwapi2) | ⭐ |
| 🔲 | GET | `/v2/api/orgs/{orgId}/coupons` | Coupon/credit info for billing | ⭐ |
| 🔲 | GET | `/v1/organizations/{orgId}/coupons` | v1 coupon tokens and redemption details | ⭐ |
| 🔲 | GET | `/v2/api/orgs/trials` | Trial subscription status | ⭐ |

## 9. Workspaces

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| ✅ | GET | `/v2/api/workspace-service-proxy/v1/workspaces/{wid}` | `get_workspace_detail` — Detailed workspace metadata | ⭐⭐ |
| ✅ | GET | `/api/workspaces/{wid}/info` | `get_workspace_info` — Workspace info (title, description) | ⭐⭐ |
| ✅ | GET | `/v1/workspaces/{wid}/emails` | `get_workspace_emails` — Email addresses for a workspace | ⭐⭐ |
| ✅ | GET | `/api/workspaces/{wid}/usage` | (via usage summary) — Workspace-level usage | ⭐⭐ |
| 🔲 | GET | `/v1/workspaces/{wid}/premium` | Premium subscription status and expiry | ⭐⭐ |
| 🔲 | GET | `/v1/workspaces/default/premium` | Default workspace subscription status | ⭐ |
| 🔲 | GET | `/v1/workspaces/{wid}/import/activeImport` | Active data import job status | ⭐ |

## 10. Portals

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| ✅ | GET | `/v1/portals/orgs/{orgId}/portals` | `list_portals` — All client portals in the org | ⭐⭐ |
| ✅ | GET | `/v2/api/portal-service-proxy/v1/orgs/{orgId}/portals` | `list_portals` (alt) — Portal list alternate path | ⭐⭐ |
| ✅ | GET | `/v4/api/portal/pages` | `get_portal_pages` — Pages within a specific portal | ⭐⭐ |
| 🔲 | GET | `/v1/portals/orgs/{orgId}/available` | Portal availability/quota check | ⭐ |
| ❌ | GET | `/v2/api/portal-service-proxy/v1/contents` | Returns 404 — not viable | — |
| ❌ | GET | `/v2/api/portal-service-proxy/v1/workspaces/{wid}/portals` | Returns 404 — not viable | — |
| ❌ | GET | `/v2/api/workspaces/{wid}/portal` | Returns 404 — not viable | — |

## 11. AI & Agents

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| ✅ | GET | `/v4/api/proxy/ai-service/v1/orgs/{orgId}/agent-categories/agents` | `list_agents` — Available AI agents in the org | ⭐⭐ |
| 🔲 | GET | `/ai-assistant/rest/orgs/{orgId}/agents/{agentId}/threads` | AI agent conversation threads | ⭐⭐⭐ |
| 🔲 | GET | `/v4/api/proxy/ai-service/v1/orgs/{orgId}/agentFavorites` | Favorited AI agents | ⭐⭐ |
| 🔲 | GET | `/v4/api/proxy/ai-service/v1/orgs/{orgId}/agents/{agentId}/public` | Public AI agent profile | ⭐⭐ |
| 🔲 | GET | `/v4/api/proxy/mcp-service/v1/auth/channel/{agentId}` | MCP service auth channel for an agent | ⭐⭐ |

## 12. Databases & Tables

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| ✅ | GET | `/v4/api/proxy/dashboard-service/v1/dashboards/{did}/views/{vid}/data` | `get_database_data` — Data from a database/dashboard view | ⭐⭐⭐ |
| ✅ | GET | `/dashboard/{orgId}/tables/databases` | `list_databases` — List all databases (probes entity pages for dashboard/view UUIDs) | ⭐⭐⭐ |
| ✅ | GET | `/dashboard/{orgId}/tables/entity/{entity}` | `get_database_entity` — Get entity data (resolves entity name → dashboard/view via list_databases) | ⭐⭐⭐ |
| ✅ | POST | `/v4/api/proxy/dashboard-service/v1/databases` | `create_database` — Create a new database (table/kanban). Client generates UUID. | ⭐⭐⭐⭐ |
| ✅ | POST | `/dashboard/{orgId}/tables/entity/{entity}` | `add_database_row` — Add a row via Next.js server action (requires `next-action` header) | ⭐⭐⭐⭐ |
| ✅ | GET | `/v4/api/proxy/dashboard-service/v1/databases?scope_type=org&scope_id={id}` | `list_all_databases` — List all databases via REST API with full metadata | ⭐⭐⭐ |
| ✅ | GET | `/v4/api/proxy/dashboard-service/v1/databases/{dbId}` | `get_database_detail` — Get database with nested dashboards/views | ⭐⭐⭐ |
| ✅ | PUT | `/v4/api/proxy/dashboard-service/v1/databases/{dbId}` | `update_database` — Update title, metadata, favorite (PUT only, PATCH=404) | ⭐⭐⭐⭐ |
| ✅ | DELETE | `/v4/api/proxy/dashboard-service/v1/databases/{dbId}` | `delete_database` — Delete database + all tables/views (returns 204) | ⭐⭐⭐⭐ |
| ✅ | GET | `/v4/api/proxy/dashboard-service/v1/dashboards/{dashId}` | `get_dashboard_detail` — Get dashboard detail with views array | ⭐⭐⭐ |
| ✅ | DELETE | `/v4/api/proxy/dashboard-service/v1/dashboards/{dashId}` | `delete_dashboard` — Delete a table within a database | ⭐⭐⭐⭐ |
| ✅ | PUT | `/v4/api/proxy/dashboard-service/v1/dashboards/{did}/views/{vid}` | `update_view` — Rename view, change filters/sorts (PUT only) | ⭐⭐⭐ |
| ✅ | POST | `/v4/api/proxy/dashboard-service/v1/dashboards/{did}/views/{vid}/representations/{type}` | `set_view_representation` — Switch between table and kanban | ⭐⭐⭐⭐ |
| 🔲 | GET | `/v4/api/dashboard/representation-templates` | Dashboard widget/representation templates (table, kanban) | ⭐⭐ |

## 13. Automation (ActivePieces)

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| 🔲 | GET | `/automation/api/v1/flows` | List automation workflows (paginated) | ⭐⭐⭐⭐ |
| 🔲 | POST | `/automation/api/v1/flows` | Create a new automation flow | ⭐⭐⭐⭐ |
| 🔲 | GET | `/automation/api/v1/flows/{flowId}` | Get a specific automation flow | ⭐⭐⭐ |
| 🔲 | POST | `/automation/api/v1/flows/{flowId}` | Update a specific automation flow | ⭐⭐⭐ |
| 🔲 | GET | `/automation/api/v1/flows/count` | Count of automation flows | ⭐⭐ |
| 🔲 | GET | `/automation/api/v1/flow-runs` | Execution history of automation runs | ⭐⭐⭐⭐ |
| 🔲 | GET | `/automation/api/v1/folders` | Automation folder structure | ⭐⭐ |
| 🔲 | GET | `/automation/api/v1/app-connections` | External app connections/integrations | ⭐⭐⭐ |
| 🔲 | GET | `/automation/api/v1/flags` | Automation platform feature flags | ⭐ |
| 🔲 | GET | `/automation/api/v1/usage/get` | Automation usage and billing quota | ⭐⭐ |
| 🔲 | GET | `/automation/api/v1/users/projects` | Automation projects list | ⭐⭐ |
| 🔲 | POST | `/automation/api/v1/authentication/fusebase-auth` | Automation auth token exchange | ⭐ |
| 🔲 | GET | `/automation/api/v1/authentication/fusebase-admin-auth` | Automation admin auth check | ⭐ |
| 🔲 | GET | `/automation/api/v1/pieces` | Full automation pieces catalog | ⭐⭐ |
| 🔲 | GET | `/automation/api/v1/pieces/@activepieces/piece-{name}` | Specific automation piece details (16 pieces discovered) | ⭐⭐ |
| 🔲 | GET | `/automation/api/v1/trigger-events` | Trigger events for a specific flow | ⭐⭐ |
| 🔗 | GET/POST | `/automation/socket.io/` | WebSocket transport for real-time automation events | ⭐ |

## 14. Billing & Account

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| 🔲 | GET | `/v1/billing/credit` | Billing credit balance | ⭐ |
| 🔲 | GET | `/v1/otp/setup` | 2FA/OTP setup status | ⭐ |

## 15. User Preferences & Variables

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| 🔲 | GET | `/v1/notification/options` | Notification preference settings | ⭐ |
| 🔲 | GET | `/v2/api/web-editor/user/vars` | User variables/preferences for the editor | ⭐⭐ |
| 🔲 | POST | `/v2/api/users/vars/sidebarCollapsed` | Toggle sidebar collapsed state | ⭐ |
| 🔲 | POST | `/v1/users/vars/lastOpenedWorkspaces` | Set last-opened workspace list | ⭐ |
| 🔲 | POST | `/v1/users/vars/loaded:checklist:*` | Track checklist load state | ⭐ |
| 🔲 | POST | `/v2/api/users/vars/firstVisitWsNoPaywall` | Track first-visit onboarding state | ⭐ |
| 🔲 | POST | `/v2/api/workspace-events` | Publish workspace events | ⭐⭐ |
| 🔲 | GET | `/v4/api/users/vars/agent_folder_{agentId}` | Agent-specific folder preference | ⭐ |
| ❌ | GET | `/v1/users/vars/dateTimeLocale` | Returns 404 — not viable | — |

## 16. Chat (External Service)

| Status | Method | Endpoint | Tool / Description | Value |
|---|---|---|---|---|
| 🔗 | GET | `chat-rest-api.nimbusweb.me/v1/me/unreads-tmp` | Unread chat message count (separate service) | ⭐⭐ |

## 17. Auth, Navigation & UI Pages (Not Useful as API Tools)

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| 🔒 | GET | `/auth/*`, `/auth/postauth.php` | Login redirects |
| 🔒 | GET | `/client`, `/space`, `/dashboard` | UI navigation redirects (302/307) |
| 🔒 | GET | `/space/{wid}/agents` | Agent browser UI page |
| 🔒 | GET | `/space/{wid}/agents/category/{cat}` | Agent category UI page |
| 🔒 | GET | `/space/{wid}/agents/{agentId}/chat` | Agent chat UI page |
| 🔒 | GET | `/space/{wid}/all` | All items UI page |
| 🔒 | GET | `/space/{wid}/files` | Files browser UI page |
| 🔒 | GET | `/space/{wid}/folder/{folderId}` | Folder view UI page |
| 🔒 | GET | `/space/{wid}/page/{nid}` | Page view UI page |
| 🔒 | GET | `/space/{wid}/tasks` | Tasks board UI page |
| 🔒 | GET | `/space/automation` | Automation dashboard UI page |
| 🔒 | GET | `/ws/{wid}/settings/account` | Account settings UI page |
| 🔒 | GET | `/dashboard/{orgId}/settings` | Dashboard settings UI page |
| 🔒 | GET | `/dashboard/{orgId}/members` | Dashboard members UI page |
| 🔗 | POST | `analytics.google.com/g/collect` | Google Analytics (third-party tracking) |
| ❌ | GET | `/v2/api/identity/spaces` | Returns 404 |
| ❌ | GET | `/gwapi2/svc:comment/.../notes//threadsInfo` | Returns 500 (empty noteId) |
| ❌ | GET | `/v2/api/workspaces/{wid}/notes//tags` | Returns 308 (empty noteId redirect) |

---

## Summary Dashboard

| Category | ✅ Implemented | 🔲 Backlog | ❌ Not Viable | 🔒/🔗 Not Useful |
|---|---|---|---|---|
| **Content & Pages** | 8 | 3 | 0 | 0 |
| **Folders & Navigation** | 2 | 0 | 0 | 0 |
| **Tags & Labels** | 5 | 0 | 0 | 0 |
| **Members & Permissions** | 5 | 2 | 0 | 0 |
| **Tasks** | 10 | 2 | 0 | 0 |
| **Comments & Activity** | 3 | 0 | 0 | 0 |
| **Files & Attachments** | 3 | 2 | 0 | 0 |
| **Organization** | 5 | 5 | 0 | 0 |
| **Workspaces** | 4 | 3 | 0 | 0 |
| **Portals** | 3 | 1 | 3 | 0 |
| **AI & Agents** | 1 | 4 | 0 | 0 |
| **Databases & Tables** | 13 | 1 | 0 | 0 |
| **Automation** | 0 | 17 | 0 | 1 |
| **Billing & Account** | 0 | 2 | 0 | 0 |
| **User Preferences** | 0 | 8 | 1 | 0 |
| **Chat** | 0 | 0 | 0 | 1 |
| **Auth & Navigation** | 0 | 0 | 3 | 14+ |
| **TOTAL** | **50** | **53** | **7** | **16+** |

### Value Distribution (Implemented tools by daily value)

| Rating | Count | % | Examples |
|---|---|---|---|
| ⭐⭐⭐⭐⭐ Essential | 5 | 10% | `list_pages`, `get_page`, `get_page_content`, `update_page_content`, `list_workspaces` |
| ⭐⭐⭐⭐ High | 8 | 16% | `create_page`, `search_tasks`, `list_task_lists`, `create_task`, `refresh_auth` |
| ⭐⭐⭐ Moderate | 18 | 36% | `get_tags`, `get_members`, `get_comment_threads`, `get_database_data` |
| ⭐⭐ Low | 13 | 26% | `get_workspace_detail`, `get_labels`, `delete_page`, `get_mention_entities` |
| ⭐ Rare | 6 | 12% | `check_version`, `get_file_count`, `get_task_usage`, `get_org_features` |

### Top Priority Gaps (highest value unimplemented)

| Priority | Category | Endpoints | Value | Impact |
|---|---|---|---|---|
| 🥇 | Automation | `flows`, `flow-runs`, `flows` (POST) | ⭐⭐⭐⭐ | Unlocks workflow automation management |
| 🥈 | AI & Agents | `threads`, `main-page` | ⭐⭐⭐–⭐⭐⭐⭐ | AI conversation management |
| 4 | Tasks | `workspace-infos`, `time/{tid}` | ⭐⭐⭐ | Cross-workspace tasks + time tracking |

---

## Discovered Automation Pieces (ActivePieces Catalog)

These are the automation building blocks available in Fusebase:

| Piece | Description |
|---|---|
| `piece-fusebase` | Core Fusebase triggers and actions |
| `piece-fusebase-ai-agents` | AI agent automation |
| `piece-fusebase-databases` | Database automation |
| `piece-http` | HTTP request actions |
| `piece-smtp` | Email sending |
| `piece-csv` | CSV parsing/generation |
| `piece-pdf` | PDF processing |
| `piece-crypto` | Encryption/hashing |
| `piece-data-mapper` | Data transformation |
| `piece-data-summarizer` | Data summarization |
| `piece-date-helper` | Date/time utilities |
| `piece-delay` | Workflow delays |
| `piece-file-helper` | File manipulation |
| `piece-math-helper` | Math operations |
| `piece-text-helper` | Text manipulation |
