# Fusebase API — Unimplemented Endpoints Reference

> Generated from API discovery (123 unique endpoints, 927 requests).
> Cross-referenced against the 45 implemented MCP tools.
> Use this as a backlog when adding new tools.

---

## Legend

| Status | Meaning |
|---|---|
| ✅ | Implemented as MCP tool |
| 🔲 | Discoverable, not implemented |
| ❌ | Returns error (404/500) — not viable |
| 🔒 | Auth/redirect — not useful as tool |

---

## 1. Content & Pages

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| ✅ | GET | `/v2/api/workspaces/{id}/notes` | → `list_pages` |
| ✅ | GET | `/api/workspaces/{id}/notes` | → `get_page` (single note) |
| ✅ | GET | `/dump/{wid}/{nid}` | → `get_page_content` |
| ✅ | GET | `/v2/api/web-editor/space/{id}/note/attachments/{id}` | → `get_page_attachments` |
| ✅ | POST | `/v4/api/workspaces/{id}/texts/{id}/tokens` | → `update_page_content` |
| ✅ | GET | `/v2/api/note-service-proxy/v1/orgs/{orgId}/recentlyUpdatedNotes` | → `get_recently_updated_notes` |
| 🔲 | GET | `/ai-assistant/rest/workspaces/{id}/main-page` | AI assistant state (threads, preferences, usage). 31 hits in discovery. |
| 🔲 | GET | `/gwapi2/ft:cta/workspaces/{id}/notes/{id}/cta` | Call-to-action data for a page. 10 hits. |
| 🔲 | GET | `/box/attachment/{wid}/{id}/{filename}` | Direct attachment download URL. Serves binary. |

## 2. Folders & Navigation

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| ✅ | GET | `/gwapi2/ft:notes/menu` | → `get_navigation_menu` |
| ✅ | GET | (via listFolders + cache) | → `list_folders` |

## 3. Tags & Labels

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| ✅ | GET | `/api/workspaces/{id}/tags` | → `get_tags` |
| ✅ | GET | `/v2/api/workspaces/{id}/tags` | → `get_tags` (v2) |
| ✅ | GET | `/v2/api/workspaces/{id}/notes/{id}/tags` | → `get_note_tags` |
| ✅ | GET | `/gwapi2/ft:workspaces/workspaces/{id}/labels` | → `get_labels` |

## 4. Members & Permissions

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| ✅ | GET | `/v2/api/workspaces/{id}/members` | → `get_members` |
| ✅ | GET | `/v2/api/orgs/{orgId}/membersWithOwner` | → `get_members` (org-level) |
| ✅ | GET | `/gwapi2/ft:permissions/orgs/{orgId}/members` | → `get_org_permissions` |
| ✅ | GET | `/v2/api/web-editor/mention-entities/{id}` | → `get_mention_entities` |
| ✅ | GET | `/gwapi2/ft:workspaces/workspaces/{id}/members` | → (via getWorkspaceMembers) |
| 🔲 | GET | `/gwapi2/ft:org/orgs/{orgId}/member-roles` | Distinct member role definitions. 12 hits. |
| 🔲 | GET | `/v1/workspaces/{id}/members` | v1 member list (includes firstname/lastname/email/avatar/granularRoles). |

## 5. Tasks

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| ✅ | POST | `/gwapi2/ft:tasks/tasks/search` | → `search_tasks` |
| ✅ | GET | `/gwapi2/ft:tasks/workspaces/{id}/taskLists` | → `list_task_lists` |
| ✅ | GET | `/gwapi2/ft:tasks/workspaces/{id}/usage` | → `get_task_usage` |
| ✅ | GET | `/v2/api/task-service-proxy/v1/workspaces/{id}/tasks/count` | → `get_task_count` |
| 🔲 | GET | `/gwapi2/ft:tasks/workspace-infos` | Task workspace summary list (orgId, workspaceId, color, title). 11 hits. |

## 6. Comments & Activity

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| ✅ | GET | `/gwapi2/svc:comment/workspaces/{id}/notes/{id}/threadsInfo` | → `get_comment_threads` |
| ✅ | GET | `/gwapi2/svc:notification/workspaces/{id}/activityStream` | → `get_activity_stream` |

## 7. Organization

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| ✅ | GET | `/v2/api/orgs/{orgId}/usage` | → `get_org_usage` |
| ✅ | GET | `/v2/api/orgs/{orgId}/limits` | → `get_org_limits` |
| ✅ | GET | `/v2/api/orgs/{orgId}/usageSummary` | → `get_usage_summary` |
| ✅ | GET | `/v1/organizations/{orgId}/features` | → `get_org_features` |
| ✅ | GET | `/gwapi2/ft:ai/orgs/{orgId}/usage` | → `get_ai_usage` |
| 🔲 | GET | `/v1/organizations/{orgId}/limits` | v1 limits (same data, different path). Low value — duplicate of v2 limits. |
| 🔲 | GET | `/v1/organizations/{orgId}/permissions` | v1 permissions. Low value — duplicate of gwapi2 permissions. |
| 🔲 | GET | `/v2/api/orgs/{orgId}/coupons` | Coupon/credit info (`couponNumber`). Admin/billing niche. |
| 🔲 | GET | `/v1/organizations/{orgId}/coupons` | v1 coupons (token, members, redeemed, type). Admin/billing niche. |
| 🔲 | GET | `/v2/api/orgs/trials` | Trial status. 90 hits — polled frequently. |

## 8. Workspaces

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| ✅ | GET | `/v2/api/workspace-service-proxy/v1/workspaces/{id}` | → `get_workspace_detail` |
| ✅ | GET | `/api/workspaces/{id}/info` | → `get_workspace_info` |
| ✅ | GET | `/v1/workspaces/{id}/emails` | → `get_workspace_emails` |
| ✅ | GET | `/api/workspaces/{id}/usage` | → (workspace-level usage via usageSummary) |
| 🔲 | GET | `/v1/workspaces/{id}/premium` | Premium/subscription info (status, dateEnd). |
| 🔲 | GET | `/v1/workspaces/default/premium` | Default workspace premium status. |
| 🔲 | GET | `/v1/workspaces/{id}/import/activeImport` | Active import status. |

## 9. Files

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| ✅ | GET | `/v2/api/workspaces/{id}/files` | → `list_files` |
| ✅ | GET | `/v2/api/bucket-service-proxy/v1/files/count` | → `get_file_count` |

## 10. Portals

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| ✅ | GET | `/v1/portals/orgs/{orgId}/portals` | → `list_portals` |
| ✅ | GET | `/v2/api/portal-service-proxy/v1/orgs/{orgId}/portals` | → `list_portals` (alt) |
| ✅ | GET | `/v4/api/portal/pages` | → `get_portal_pages` |
| 🔲 | GET | `/v1/portals/orgs/{orgId}/available` | Portal availability check. |
| ❌ | GET | `/v2/api/portal-service-proxy/v1/contents` | Returns 404. Not viable. |
| ❌ | GET | `/v2/api/portal-service-proxy/v1/workspaces/{id}/portals` | Returns 404. Not viable. |
| ❌ | GET | `/v2/api/workspaces/{id}/portal` | Returns 404. Not viable. |

## 11. AI Agents

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| ✅ | GET | `/v4/api/proxy/ai-service/v1/orgs/{orgId}/agent-categories/agents` | → `list_agents` |

## 12. Databases & Tables

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| ✅ | GET | `/v4/api/proxy/dashboard-service/v1/dashboards/{id}/views/{id}/data` | → `get_database_data` |
| 🔲 | POST | `/dashboard/{orgId}/tables/entity/spaces` | List or create database entities (orgId, entity). |
| 🔲 | GET | `/dashboard/{orgId}/tables/entity/spaces` | Get database entity spaces. |
| 🔲 | GET | `/dashboard/{orgId}/tables/databases` | List all databases. Dashboard UI page. |

## 13. Automation (ActivePieces)

Fusebase uses ActivePieces as its automation engine. These endpoints are the automation management API.

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| 🔲 | GET | `/automation/api/v1/flows` | List automation flows (data, next, previous). Paginated. |
| 🔲 | GET | `/automation/api/v1/flows/count` | Count of automation flows. |
| 🔲 | GET | `/automation/api/v1/flow-runs` | List flow execution history (runs). |
| 🔲 | GET | `/automation/api/v1/folders` | Automation folder structure. |
| 🔲 | GET | `/automation/api/v1/app-connections` | External app connections (integrations). |
| 🔲 | GET | `/automation/api/v1/flags` | Automation platform flags/feature toggles. |
| 🔲 | GET | `/automation/api/v1/usage/get` | Automation usage (billing, role, subscriptionType). |
| 🔲 | GET | `/automation/api/v1/users/projects` | Automation projects list. |
| 🔲 | POST | `/automation/api/v1/{id}/fusebase-auth` | Automation auth token exchange. |
| 🔲 | GET | `/automation/api/v1/{id}/fusebase-admin-auth` | Admin auth check. |
| 🔲 | GET | `/automation/api/v1/pieces/@activepieces/piece-*` | Piece catalog (13 pieces discovered). Details on each automation piece. |

## 14. Billing & Account

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| 🔲 | GET | `/v1/billing/credit` | Billing credit balance. |
| 🔲 | GET | `/v1/otp/setup` | OTP/2FA setup status. |

## 15. User Preferences

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| 🔲 | GET | `/v1/notification/options` | Notification preferences (name, value pairs). |
| 🔲 | POST | `/v1/users/vars/lastOpenedWorkspaces` | Set last-opened workspace list. |
| 🔲 | POST | `/v1/users/vars/loaded:checklist:*` | Track checklist load state. |
| 🔲 | POST | `/v2/api/users/vars/firstVisitWsNoPaywall` | Track first-visit state. |
| 🔲 | POST | `/v2/api/workspace-events` | Publish workspace events. |
| ❌ | GET | `/v1/users/vars/dateTimeLocale` | Returns 404. Not viable. |

## 16. Auth & Navigation (Not Useful as Tools)

| Status | Method | Endpoint | Notes |
|---|---|---|---|
| 🔒 | GET | `/auth/`, `/auth/postauth.php` | Login redirects |
| 🔒 | GET | `/client`, `/space`, `/dashboard` | UI navigation redirects (302/307) |
| 🔒 | GET | `/space/{id}/*` | UI page routes (agents, databases, files, settings, etc.) |
| 🔒 | GET | `/ws/{id}/settings/account` | Account settings page |
| 🔒 | GET | `/dashboard/{orgId}/settings`, `/dashboard/{orgId}/members` | Dashboard UI pages (404) |
| ❌ | GET | `/v2/api/identity/spaces` | Returns 404 |
| ❌ | GET | `/gwapi2/svc:comment/workspaces/{id}/notes//threadsInfo` | Returns 500 (empty noteId) |

---

## Summary

| Category | ✅ Implemented | 🔲 Backlog | ❌ Not Viable | 🔒 Not Useful |
|---|---|---|---|---|
| Content & Pages | 6 | 3 | 0 | 0 |
| Folders & Navigation | 2 | 0 | 0 | 0 |
| Tags & Labels | 4 | 0 | 0 | 0 |
| Members & Permissions | 5 | 2 | 0 | 0 |
| Tasks | 4 | 1 | 0 | 0 |
| Comments & Activity | 2 | 0 | 0 | 0 |
| Organization | 5 | 5 | 0 | 0 |
| Workspaces | 4 | 3 | 0 | 0 |
| Files | 2 | 0 | 0 | 0 |
| Portals | 3 | 1 | 3 | 0 |
| AI Agents | 1 | 0 | 0 | 0 |
| Databases & Tables | 1 | 3 | 0 | 0 |
| Automation | 0 | 11 | 0 | 0 |
| Billing & Account | 0 | 2 | 0 | 0 |
| User Preferences | 0 | 5 | 1 | 0 |
| Auth & Navigation | 0 | 0 | 2 | 10+ |
| **Total** | **39** | **36** | **6** | **10+** |

## Priority Backlog (Recommended Next)

If you need to implement more tools, these are the highest value targets:

### Tier A — High Value
1. **Automation flows/runs** — `GET /automation/api/v1/flows`, `GET /automation/api/v1/flow-runs` (core automation management)
2. **Database entities** — `POST /dashboard/{orgId}/tables/entity/spaces` (create/list databases)
3. **AI assistant page** — `GET /ai-assistant/rest/workspaces/{id}/main-page` (AI threads, preferences)

### Tier B — Medium Value
4. **Member roles** — `GET /gwapi2/ft:org/orgs/{orgId}/member-roles` (role definitions)
5. **Workspace premium** — `GET /v1/workspaces/{id}/premium` (subscription status)
6. **Task workspace-infos** — `GET /gwapi2/ft:tasks/workspace-infos` (multi-workspace task overview)
7. **Automation usage** — `GET /automation/api/v1/usage/get` (automation quota)

### Tier C — Low Value
8. Billing credit, coupons, OTP, user vars, notification options
