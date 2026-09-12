# Fusebase MCP Server

An [MCP](https://modelcontextprotocol.io/) server that lets AI assistants manage your [Fusebase](https://www.fusebase.com/) (formerly Nimbus Note) workspaces — pages, folders, tasks, tags, files, members, databases, and more.

> **Note:** Fusebase has no public REST API. This server uses reverse-engineered internal endpoints with cookie-based authentication.

## ✨ Features

- **136 tools** across content, tasks, members, files, databases, org admin, portals, guides, vibe coding, automations, CLI lifecycle, AI assistants & agent threads, billing, user preferences, multi-agent profiles, and swarm orchestration
- **Two-tier system** — 27 core tools load by default; 109 extended tools on demand
- **Native MCP Resources (7)** — `fusebase://workspaces`, `fusebase://guides/index`, `fusebase://work/connectors`, `fusebase://workspaces/{wid}/pages/{nid}`, `fusebase://databases/{did}`, `fusebase://portals/{portalId}/clients`
- **Native MCP Prompts (7)** — pre-engineered workflow templates (`create-sop`, `summarize-page`, `build-kanban-project`, `design-automation-workflow`, `build-hosted-app`, `build-event-bridge`, `orchestrate-multi-agent-swarm`)
- **Official FuseBase CLI & Hosted Apps** — inspect CLI status (`fusebase_cli_status`), initialize products (`fusebase_cli_init`), list apps (`fusebase_cli_list_apps`), and deploy Vite/React SPA apps to the FuseBase Cloud (`fusebase_cli_deploy`)
- **Granular block mutations** — non-destructive page block appending (`append_page_content`) via real-time Y.js WebSockets
- **Vibe Coding & Web Apps** — generate interactive web app pages (`create_interactive_app_page`) with responsive full-width embeds (`allowOverWidth`)
- **ActivePieces Workflow Automation** — flow inspection, creation, updating, deletion, trigger test runs (`trigger_automation_flow`), and connector piece catalog
- **Client Portal "Hub" Platform** — inspect availability (`check_portal_availability`), create portals (`create_portal`), retrieve full branding/settings (`get_portal`), inspect themes (`get_portal_theme`), portal sidebar navigation trees (`get_portal_navigation_menu`), resolve workspace portals (`get_workspace_portal`), publish workspace pages to client portals (`publish_page_to_portal`), manage client permissions (`list_portal_clients`, `invite_portal_client`), and generate 24h passwordless magic links (`create_portal_magic_link`)
- **Multi-Agent Swarm Orchestrator** — initialize shared state machine boards (`fusebase_swarm_init`) and transition tasks across roles with audit history (`fusebase_swarm_task_transition`)
- **Multi-Agent Profile Management** — list and switch between encrypted credentials seamlessly
- **Database CRUD & View Templates** — full kanban/table management: rows, columns, views, relations, managed templates (`get_dashboard_templates`), CSV import/export
- **Auto auth retry** — detects 401/403 and refreshes session automatically
- **Encrypted secrets** — cookies stored encrypted at rest (AES-256-GCM)
- **Version checking** — built-in update detection from GitHub
- **API logging** — all requests logged for debugging

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Fusebase](https://www.fusebase.com/) account

### 1. Install

**Option A — Install from GitHub (recommended):**

```bash
npm install -g github:ryan-haver/fusebase-mcp
```

This automatically installs dependencies, compiles TypeScript, and downloads Chromium for auth.

**Option B — Clone and build manually:**

```bash
git clone https://github.com/ryan-haver/fusebase-mcp.git
cd fusebase-mcp
npm install
```

> `npm install` automatically builds the project and installs Playwright's Chromium via the `prepare` and `postinstall` scripts.

### 2. Configure

Copy `.env.example` to `.env` and set your Fusebase details:

```bash
cp .env.example .env
```

```env
FUSEBASE_HOST=yourorg.nimbusweb.me     # Your org's Fusebase hostname
FUSEBASE_ORG_ID=your_org_id            # Found in Fusebase URL or API responses
```

> **Where to find these:** Log into Fusebase → look at the URL bar. Your hostname is `<something>.nimbusweb.me`. The org ID appears in API requests (open browser DevTools → Network tab → look for `/v2/api/` requests).

### 3. Authenticate

Run the auth script to capture your session cookies securely:

```bash
npx tsx scripts/auth.ts
```

This opens a browser window → log into Fusebase → cookies are automatically captured and saved **encrypted** to `data/cookie.enc`.

> **Headless mode:** After the first login, you can re-authenticate without a browser window:
>
> ```bash
> npx tsx scripts/auth.ts --headless
> ```

### 4. Connect to Your AI Assistant

Add to your MCP client config. Examples:

<details>
<summary><strong>Gemini CLI</strong> — <code>mcp_config.json</code></summary>

```json
{
  "fusebase": {
    "command": "node",
    "args": ["/path/to/fusebase-mcp/dist/index.js"],
    "env": {
      "FUSEBASE_HOST": "yourorg.nimbusweb.me",
      "FUSEBASE_ORG_ID": "your_org_id"
    }
  }
}
```

</details>

<details>
<summary><strong>Claude Desktop</strong> — <code>claude_desktop_config.json</code></summary>

```json
{
  "mcpServers": {
    "fusebase": {
      "command": "node",
      "args": ["/path/to/fusebase-mcp/dist/index.js"],
      "env": {
        "FUSEBASE_HOST": "yourorg.nimbusweb.me",
        "FUSEBASE_ORG_ID": "your_org_id"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>VS Code Copilot</strong> — <code>settings.json</code></summary>

```json
{
  "mcp": {
    "servers": {
      "fusebase": {
        "command": "node",
        "args": ["/path/to/fusebase-mcp/dist/index.js"],
        "env": {
          "FUSEBASE_HOST": "yourorg.nimbusweb.me",
          "FUSEBASE_ORG_ID": "your_org_id"
        }
      }
    }
  }
}
```

</details>

> **Note:** Replace `/path/to/fusebase-mcp` with the actual path where you cloned the repo. On Windows, use double backslashes: `"C:\\path\\to\\fusebase-mcp\\dist\\index.js"`.

### 5. Verify

Ask your AI assistant:

> *"List my Fusebase workspaces"*

If it works, you're all set! 🎉

## 📚 Native MCP Resources & Prompts

FuseBase MCP supports first-class MCP protocol primitives for zero-overhead context injection:

### Resources (`fusebase://`)

Clients can attach FuseBase data directly into their context window:

| URI Pattern | Type | Description |
| --- | --- | --- |
| `fusebase://workspaces` | Static | JSON array of all accessible workspaces |
| `fusebase://guides/index` | Static | Comprehensive index of all 277 FuseBase documentation guides |
| `fusebase://work/connectors` | Static | Catalog of integrated third-party services and automation connectors |
| `fusebase://guides/{section}/{slug}` | Template | Full markdown content of any specific guide |
| `fusebase://workspaces/{wid}/pages/{nid}` | Template | Decoded HTML representation of any page |
| `fusebase://databases/{did}` | Template | Complete JSON schema and views for a database |
| `fusebase://portals/{portalId}/clients` | Template | List of invited external clients and permissions for a portal |

### Pre-Engineered Prompts

Quick-start workflow prompts available to AI clients:

- **`create-sop`**: Guides the assistant in generating a rigorous Standard Operating Procedure document with scope, prerequisites, step-by-step procedures, and verification checklists.
- **`summarize-page`**: Prompts the model to synthesize a specific page into an executive summary, key decisions, and prioritized action items.
- **`build-kanban-project`**: Guides the AI to design a structured project board with customized column flows and starter cards.
- **`design-automation-workflow`**: Prompts the design of an ActivePieces automation workflow mapping triggers, action steps, and error handling.
- **`build-hosted-app`**: Architects a full-stack FuseBase Web App covering frontend UI tokens, backend data, CLI commands, and responsive embedding.
- **`build-event-bridge`**: Designs bidirectional webhook bridges connecting external systems into FuseBase and triggering workflows via `trigger_automation_flow`.
- **`orchestrate-multi-agent-swarm`**: Decomposes complex initiatives into coordinated multi-agent swarms tracked through FuseBase Kanban boards (`fusebase_swarm_init`, `fusebase_swarm_task_transition`).

---

## 🔧 Tool Tiers

The server uses a **core/extended tier system** to optimize agent context usage:

| Tier | Tools | Description |
| --- | --- | --- |
| **Core** (default) | 27 | Day-to-day: pages, folders, tasks, tags, members, files, guides, session health, profiles |
| **Extended** | +109 | Admin, CLI apps, automations, portal lifecycle, databases, swarm state machines, billing, preferences |

**Enable extended tools:**

- Mid-session: ask your AI to use `set_tool_tier` with `tier: "all"`
- Always-on: add `FUSEBASE_TOOLS=all` to your `.env`

### Core Tools (27)

| Category | Tool | Description |
| --- | --- | --- |
| Meta | `set_tool_tier` | Enable extended tools or check current tier |
| Meta | `check_version` | Check for server updates from GitHub |
| Auth | `refresh_auth` | Refresh session cookies via Playwright |
| Auth | `check_session_health` | Inspect cookie age, profile metadata, and test API connectivity without launching browser |
| Content | `list_workspaces` | List all workspaces |
| Content | `list_pages` | List pages (filter by folder, pagination) |
| Content | `get_page` | Get page metadata |
| Content | `get_page_content` | Get page content as HTML (Y.js decoded) |
| Content | `get_recent_pages` | Recently accessed pages |
| Content | `create_page` | Create a page with optional markdown/blocks content |
| Content | `append_page_content` | Append markdown or structured blocks to an existing page without overwrite |
| Content | `list_folders` | Folder tree for a workspace |
| Files | `get_page_attachments` | List attachments on a page |
| Files | `upload_file` | Upload file attachment to a page |
| Files | `list_files` | List uploaded files |
| Files | `download_file` | Download file content as base64 |
| Tags | `get_tags` | List workspace tags |
| Tags | `update_page_tags` | Set tags on a page |
| Members | `get_members` | List workspace members |
| Tasks | `search_tasks` | Search tasks across workspace |
| Tasks | `list_task_lists` | List kanban boards |
| Tasks | `create_task` | Create a task |
| Guides | `search_guides` | Search FuseBase guides by keyword |
| Guides | `get_guide` | Get full guide content by section/slug |
| Guides | `list_guide_sections` | Browse all guide sections |
| Profiles | `list_agent_profiles` | List all configured encrypted agent credential profiles |
| Profiles | `switch_active_profile` | Switch active agent session profile dynamically |

### Extended Tools (109)

Enable with `set_tool_tier(tier: "all")`:

- **Client Portal Hub Lifecycle**: `create_portal`, `get_portal`, `get_portal_theme`, `get_portal_navigation_menu`, `get_workspace_portal`, `publish_page_to_portal`, `check_portal_availability`, `list_portal_clients`, `invite_portal_client`, `create_portal_magic_link`, `list_portals`, `get_portal_pages`
- **Multi-Agent Swarm Orchestration**: `fusebase_swarm_init`, `fusebase_swarm_task_transition`
- **CLI & Hosted Apps**: `fusebase_cli_status`, `fusebase_cli_init`, `fusebase_cli_list_apps`, `fusebase_cli_deploy`, `create_interactive_app_page`
- **Automations (ActivePieces)**: `trigger_automation_flow`, `get_automation_flags`, `list_automation_flows`, `get_automation_flow`, `create_automation_flow`, `update_automation_flow`, `delete_automation_flow`, `list_flow_runs`, `list_automation_pieces`
- **Content mutations**: `create_folder`, `update_page`, `delete_page`, `update_page_content`
- **Tasks (advanced)**: `get_tasks_workspace_summary`, `get_task_time_tracking`, `update_task`, `delete_task`, `get_task_description`, `get_task_count`, `get_task_usage`
- **Labels & tags**: `get_labels`, `get_note_tags`
- **Activity & comments**: `get_activity_stream`, `get_comment_threads`, `fusebase_poll_mentions`, `fusebase_post_comment`, `fusebase_reply_comment`, `fusebase_resolve_thread`
- **Files**: `get_file_count`
- **Organization & Members**: `get_member_roles`, `get_workspace_members_v1`, `get_org_trials`, `get_org_usage`, `get_org_limits`, `get_usage_summary`, `get_org_permissions`, `get_org_features`, `get_ai_usage`
- **Workspaces & Subscription**: `get_workspace_premium_status`, `get_active_import_status`, `get_workspace_detail`, `get_workspace_emails`, `get_workspace_info`
- **Navigation & AI**: `get_agent_public_profile`, `get_ai_assistant_state`, `list_ai_agent_threads`, `get_ai_agent_favorites`, `get_navigation_menu`, `get_mention_entities`, `list_agents`, `get_recently_updated_notes`
- **Databases & Templates**: `get_dashboard_templates`, `get_database_data`, `list_databases`, `get_database_entity`, `create_database`, `add_database_row`, `delete_database_row`, `move_kanban_card`, `list_database_relations`, `create_dashboard_table`, `delete_relation`, `list_all_databases`, `get_database_detail`, `update_database`, `delete_database`, `get_dashboard_detail`, `delete_dashboard`
- **Views**: `update_view`, `set_view_representation`, `create_view`, `delete_view`, `duplicate_view`, `set_view_grouping`
- **Columns**: `add_database_column`, `delete_database_column`, `rename_database_column`, `reorder_database_columns`, `set_column_width`, `add_relation_column`, `add_lookup_column`
- **Cells & rows**: `update_database_cell`, `get_database_rows`, `get_database_schema`
- **Billing & User Preferences**: `get_billing_info`, `get_user_preferences`, `set_sidebar_collapsed`
- **Import/Export**: `duplicate_database`, `export_csv`, `import_csv`

## 🔐 Security

- **No plaintext secrets on disk** — cookies are encrypted with AES-256-GCM using a machine-scoped key
- **Auto-refresh** — expired sessions are transparently refreshed via Playwright
- **`.env` is gitignored** — credentials never enter version control
- **Cookie via env var** — optionally pass `FUSEBASE_COOKIE` in your MCP config for environments where the encrypted store isn't available

## 🗂️ Project Structure

```text
src/
  index.ts              → MCP server (136 tools, stdio transport, tier system)
  client.ts             → HTTP client (cookie auth, 401 auto-retry, logging)
  crypto.ts             → AES-256-GCM encryption for secrets at rest
  types.ts              → TypeScript interfaces for API responses
  content-schema.ts     → Content block IR (25+ block types)
  markdown-parser.ts    → Markdown → ContentBlock[] converter
  token-builder.ts      → ContentBlock → Y.js token builder
  yjs-ws-writer.ts      → Y.js WebSocket writer (write + read via WS sync)
  yjs-html-decoder.ts   → Y.js document → HTML decoder (20+ block types)
  guide-loader.ts       → Guide search index (231 guides, 17 sections)
scripts/
  auth.ts               → Capture session cookies via Playwright
  scrape-guides.ts      → Scrape FuseBase help guides into markdown + NLM sync
  full-db-audit.ts      → Comprehensive database & kanban feature audit
  test-regression.ts    → Comprehensive write→read regression test (20 checks)
  test-guide-tools.ts   → Guide loader integration test (13 checks)
  discover.ts           → Crawl Fusebase UI to discover API endpoints
docs/
  guides/               → 231 FuseBase guides across 17 sections (auto-scraped)
data/                   → (gitignored) Cookie store, API logs, workspace cache
```

## 🗺️ Roadmap

See [ENDPOINT_REFERENCE.md](ENDPOINT_REFERENCE.md) for all discovered and implemented API endpoints.

Areas of interest for future development:

- **Automation** — ActivePieces flow/run management
- **Sharing** — Portal invitation and access control APIs
- **AI assistant** — thread and preference management

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Run `npm run build` to verify TypeScript compiles
4. Submit a PR

## 📄 License

MIT
