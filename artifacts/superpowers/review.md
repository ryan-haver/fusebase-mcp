# FuseBase MCP — Roadmap Review & Prioritization

## Current State

| Metric | Value |
|--------|-------|
| Implemented tools | **49** (21 core + 28 extended) |
| Implemented endpoints | **50** |
| Unimplemented endpoints | **53** |
| Not viable (404/500) | 7 |
| Auth/UI pages (not useful) | 16+ |

Phases 1–6 are **complete** (inline formats, decoder, text blocks, media, tool docs, grid + showcase). Guide integration is **complete** (3 MCP tools + global skill + NLM notebook).

---

## Prioritized Phases

### Phase 7 — Auth & Session Reliability ⭐⭐⭐⭐⭐
*Impact: Every other phase depends on reliable auth*

| Item | Why | Effort |
|------|-----|--------|
| Fix PIA SOCKS5 proxy timeouts | Auto-login consistently fails with proxy | 2h |
| Session cookie refresh investigation | See if FuseBase has a token/refresh endpoint to avoid Playwright | 2h |
| Cache Playwright browser state | Persist login session across auto-login runs for faster re-auth | 1h |
| `refresh_auth` tool hardening | Better error messages, retry logic, profile support | 1h |

---

### Phase 8 — File Upload & Attachments ⭐⭐⭐
*Impact: Closes the write gap — currently can embed images by URL but can't upload files*

| Endpoint | Status | Value |
|----------|--------|-------|
| `POST /v2/api/web-editor/file/attachment` | 🔲 | ⭐⭐⭐ |
| `POST /v3/api/web-editor/file/v2-upload` | 🔲 | ⭐⭐⭐ |
| `GET /box/attachment/{wid}/{id}/{filename}` | 🔲 | ⭐⭐⭐ |

New tools: `upload_file`, `download_attachment`

---

### Phase 9 — Database CRUD ⭐⭐⭐⭐
*Impact: Unlocks full database management (currently read-only via `get_database_data`)*

| Endpoint | Status | Value |
|----------|--------|-------|
| `GET /dashboard/{orgId}/tables/databases` | 🔲 | ⭐⭐⭐ |
| `GET /dashboard/{orgId}/tables/entity/{entity}` | 🔲 | ⭐⭐⭐ |
| `POST /dashboard/{orgId}/tables/entity/{entity}` | 🔲 | ⭐⭐⭐⭐ |
| `GET /v4/api/dashboard/representation-templates` | 🔲 | ⭐⭐ |

New tools: `list_databases`, `get_database_entity`, `create_database_entity`

---

### Phase 10 — AI Agent Management ⭐⭐⭐⭐
*Impact: Manage AI agent threads, favorites, and MCP channels*

| Endpoint | Status | Value |
|----------|--------|-------|
| `GET /ai-assistant/rest/workspaces/{wid}/main-page` | 🔲 | ⭐⭐⭐⭐ |
| `GET /ai-assistant/rest/orgs/{orgId}/agents/{agentId}/threads` | 🔲 | ⭐⭐⭐ |
| `GET /v4/api/proxy/ai-service/v1/orgs/{orgId}/agentFavorites` | 🔲 | ⭐⭐ |
| `GET /v4/api/proxy/ai-service/v1/orgs/{orgId}/agents/{agentId}/public` | 🔲 | ⭐⭐ |
| `GET /v4/api/proxy/mcp-service/v1/auth/channel/{agentId}` | 🔲 | ⭐⭐ |

New tools: `get_ai_assistant`, `list_agent_threads`, `get_agent_favorites`

---

### Phase 11 — Automation (ActivePieces) ⭐⭐⭐⭐
*Impact: 17 endpoints — biggest category. Unlocks workflow management.*

| Endpoint | Status | Value |
|----------|--------|-------|
| `GET /automation/api/v1/flows` | 🔲 | ⭐⭐⭐⭐ |
| `POST /automation/api/v1/flows` | 🔲 | ⭐⭐⭐⭐ |
| `GET /automation/api/v1/flow-runs` | 🔲 | ⭐⭐⭐⭐ |
| `GET /automation/api/v1/flows/{flowId}` | 🔲 | ⭐⭐⭐ |
| `POST /automation/api/v1/flows/{flowId}` | 🔲 | ⭐⭐⭐ |
| `GET /automation/api/v1/app-connections` | 🔲 | ⭐⭐⭐ |
| `GET /automation/api/v1/folders` | 🔲 | ⭐⭐ |
| + 10 more (flags, usage, pieces, auth) | 🔲 | ⭐–⭐⭐ |

New tools: `list_flows`, `create_flow`, `get_flow`, `update_flow`, `list_flow_runs`, `list_automation_connections`

---

### Phase 12 — Tasks Extended ⭐⭐⭐
*Impact: Cross-workspace task overview + time tracking*

| Endpoint | Status | Value |
|----------|--------|-------|
| `GET /gwapi2/ft:tasks/workspace-infos` | 🔲 | ⭐⭐⭐ |
| `GET /gwapi2/ft:tasks/workspaces/{wid}/time/{tid}` | 🔲 | ⭐⭐⭐ |

New tools: `get_task_summary_all_workspaces`, `get_task_time_tracking`

---

### Phase 13 — Content & Parser Expansion ⭐⭐⭐
*Impact: Richer markdown input support + missing member endpoints*

| Item | Why | Effort |
|------|-----|--------|
| Markdown parser: toggle syntax (`> [!toggle]`) | Users expect markdown to handle advanced blocks | 2h |
| Markdown parser: hint/callout syntax | Aligns with GitHub alert syntax | 1h |
| Markdown parser: image syntax (`![](url)`) | Standard markdown | 1h |
| Markdown parser: table syntax | Standard markdown | 2h |
| `GET /gwapi2/ft:org/orgs/{orgId}/member-roles` | Member role definitions | 30min |
| `GET /v1/workspaces/{wid}/members` (v1) | Members with first/last name | 30min |

---

### Phase 14 — MCP Enhancements ⭐⭐
*Impact: Better agent experience*

| Item | Why | Effort |
|------|-----|--------|
| MCP Resources (guides as resources) | Clients with resource support get guide subscriptions | 2h |
| Streaming for large page reads | Better UX for large documents | 2h |
| Agent profile switching mid-session | Multi-profile MCP tool | 1h |
| MCP tool usage analytics | Track which tools agents use most | 2h |

---

### Phase 15 — DevOps & Publishing ⭐⭐
*Impact: Easier installation and maintenance*

| Item | Why | Effort |
|------|-----|--------|
| npm publish | `npm install fusebase-mcp` instead of GitHub clone | 1h |
| GitHub Actions CI/CD | Auto build + test on push | 1h |
| Semantic versioning automation | Automated release notes | 1h |
| CHANGELOG.md | Track releases | 30min |

---

### Phase 16 — Low-Priority Endpoints ⭐
*Impact: Completeness, but low daily value*

| Endpoint | Value |
|----------|-------|
| Portal availability check | ⭐ |
| Workspace premium status | ⭐⭐ |
| Import job status | ⭐ |
| Billing credit | ⭐ |
| 2FA/OTP setup | ⭐ |
| Notification preferences | ⭐ |
| User editor variables | ⭐⭐ |
| Organization coupons/trials | ⭐ |

---

## Summary

| Phase | Name | Endpoints | Priority | Est. Effort |
|-------|------|-----------|----------|-------------|
| 7 | Auth & Session Reliability | — | ⭐⭐⭐⭐⭐ | 6h |
| 8 | File Upload & Attachments | 3 | ⭐⭐⭐ | 4h |
| 9 | Database CRUD | 4 | ⭐⭐⭐⭐ | 4h |
| 10 | AI Agent Management | 5 | ⭐⭐⭐⭐ | 4h |
| 11 | Automation (ActivePieces) | 17 | ⭐⭐⭐⭐ | 8h |
| 12 | Tasks Extended | 2 | ⭐⭐⭐ | 2h |
| 13 | Content & Parser Expansion | 6 | ⭐⭐⭐ | 7h |
| 14 | MCP Enhancements | — | ⭐⭐ | 7h |
| 15 | DevOps & Publishing | — | ⭐⭐ | 3.5h |
| 16 | Low-Priority Endpoints | 8+ | ⭐ | 4h |
| | **TOTAL** | **53+** | | **~50h** |

> [!NOTE]
> Phases 7-10 deliver the highest value per hour. Phase 11 (Automation) is the largest single phase but could be split into sub-phases. Phase 16 items can be cherry-picked as needed.
