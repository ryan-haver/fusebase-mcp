# Fusebase MCP Server

An [MCP](https://modelcontextprotocol.io/) server that lets AI assistants manage your [Fusebase](https://www.fusebase.com/) (formerly Nimbus Note) workspaces — pages, folders, tasks, tags, files, members, databases, and more.

> **Note:** Fusebase has no public REST API. This server uses reverse-engineered internal endpoints with cookie-based authentication.

## ✨ Features

- **99 tools** across content, tasks, members, files, databases, org admin, portals, guides, vibe coding, automations, and multi-agent profiles
- **Two-tier system** — 26 core tools load by default; 73 extended tools on demand
- **Native MCP Resources** — `fusebase://workspaces`, `fusebase://guides/index`, `fusebase://workspaces/{wid}/pages/{nid}`, `fusebase://databases/{did}` for direct context attachment without function calling
- **Native MCP Prompts** — pre-engineered workflow templates (`create-sop`, `summarize-page`, `build-kanban-project`)
- **Granular block mutations** — non-destructive page block appending (`append_page_content`) via Y.js WebSockets
- **Vibe Coding & Web Apps** — generate interactive web app pages (`create_interactive_app_page`) with responsive full-width embeds (`allowOverWidth`)
- **ActivePieces Workflow Automation** — flow, run, and piece inspection tools
- **Multi-Agent Profile Management** — list and switch between encrypted credentials seamlessly
- **Database CRUD** — full kanban/table management: rows, columns, views, relations, CSV import/export
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
| `fusebase://guides/index` | Static | Comprehensive index of all FuseBase documentation guides |
| `fusebase://guides/{section}/{slug}` | Template | Full markdown content of any specific guide |
| `fusebase://workspaces/{wid}/pages/{nid}` | Template | Decoded HTML representation of any page |
| `fusebase://databases/{did}` | Template | Complete JSON schema and views for a database |

### Pre-Engineered Prompts

Quick-start workflow prompts available to AI clients:

- **`create-sop`**: Guides the assistant in generating a rigorous Standard Operating Procedure document with scope, prerequisites, step-by-step procedures, and verification checklists.
- **`summarize-page`**: Prompts the model to synthesize a specific page into an executive summary, key decisions, and prioritized action items.
- **`build-kanban-project`**: Guides the AI to design a structured project board with customized column flows and starter cards.

---

## 🔧 Tool Tiers

The server uses a **core/extended tier system** to optimize agent context usage:

| Tier | Tools | Description |
| --- | --- | --- |
| **Core** (default) | 26 | Day-to-day: pages, folders, tasks, tags, members, files, guides, profiles |
| **Extended** | +73 | Admin, analytics, block mutations, databases, vibe coding, automations, portals |

**Enable extended tools:**

- Mid-session: ask your AI to use `set_tool_tier` with `tier: "all"`
- Always-on: add `FUSEBASE_TOOLS=all` to your `.env`

### Core Tools (26)

| Category | Tool | Description |
| --- | --- | --- |
| Meta | `set_tool_tier` | Enable extended tools or check current tier |
| Meta | `check_version` | Check for server updates from GitHub |
| Auth | `refresh_auth` | Refresh session cookies via Playwright |
| Content | `list_workspaces` | List all workspaces |
| Content | `list_pages` | List pages (filter by folder, pagination) |
| Content | `get_page` | Get page metadata |
| Content | `get_page_content` | Get page content as HTML (Y.js decoded) |
| Content | `get_recent_pages` | Recently accessed pages |
| Content | `create_page` | Create a page with optional markdown/blocks content |
| Content | `append_page_content` | Append markdown or structured blocks to an existing page without overwrite |
| Content | `list_folders` | Folder tree for a workspace |
| Files | `get_page_attachments` | List attachments on a page |
| Files | `list_files` | List workspace-wide uploaded files |
| Files | `upload_file` | Upload a file to a page (base64 content) |
| Files | `download_attachment` | Download an attachment as base64 |
| Tags | `get_tags` | Workspace or page tags |
| Tags | `update_page_tags` | Set tags on a page |
| Members | `get_members` | Workspace or org members |
| Tasks | `search_tasks` | Search tasks (by workspace/page) |
| Tasks | `list_task_lists` | Task boards and tasks |
| Tasks | `create_task` | Create a task in a task list |
| Guides | `search_guides` | Search FuseBase guides by keyword |
| Guides | `get_guide` | Get full guide content by section/slug |
| Guides | `list_guide_sections` | Browse all guide sections |
| Profiles | `list_agent_profiles` | List all configured encrypted agent credential profiles |
| Profiles | `switch_active_profile` | Switch active agent session profile dynamically |

### Extended Tools (73)

Enable with `set_tool_tier(tier: "all")`:

- **Content mutations**: `create_folder`, `update_page`, `delete_page`, `update_page_content`
- **Vibe Coding & Apps**: `create_interactive_app_page` (interactive web app embed with full-width responsive framing)
- **Automations (ActivePieces)**: `list_automation_flows`, `get_automation_flow`, `list_flow_runs`, `list_automation_pieces`
- **Tasks (advanced)**: `update_task`, `delete_task`, `get_task_description`, `get_task_count`, `get_task_usage`
- **Labels & tags**: `get_labels`, `get_note_tags`
- **Activity & comments**: `get_activity_stream`, `get_comment_threads`, `fusebase_poll_mentions`, `fusebase_post_comment`, `fusebase_reply_comment`, `fusebase_resolve_thread`
- **Files**: `get_file_count`
- **Organization**: `get_org_usage`, `get_org_limits`, `get_usage_summary`, `get_org_permissions`, `get_org_features`, `get_ai_usage`
- **Workspaces**: `get_workspace_detail`, `get_workspace_emails`, `get_workspace_info`
- **Navigation & AI**: `get_navigation_menu`, `get_mention_entities`, `list_agents`, `get_recently_updated_notes`
- **Databases**: `get_database_data`, `list_databases`, `get_database_entity`, `create_database`, `add_database_row`, `delete_database_row`, `move_kanban_card`, `list_database_relations`, `create_dashboard_table`, `delete_relation`, `list_all_databases`, `get_database_detail`, `update_database`, `delete_database`, `get_dashboard_detail`, `delete_dashboard`
- **Views**: `update_view`, `set_view_representation`, `create_view`, `delete_view`, `duplicate_view`, `set_view_grouping`
- **Columns**: `add_database_column`, `delete_database_column`, `rename_database_column`, `reorder_database_columns`, `set_column_width`, `add_relation_column`, `add_lookup_column`
- **Cells & rows**: `update_database_cell`, `get_database_rows`, `get_database_schema`
- **Import/Export**: `duplicate_database`, `export_csv`, `import_csv`
- **Portals**: `list_portals`, `get_portal_pages`

## 🔐 Security

- **No plaintext secrets on disk** — cookies are encrypted with AES-256-GCM using a machine-scoped key
- **Auto-refresh** — expired sessions are transparently refreshed via Playwright
- **`.env` is gitignored** — credentials never enter version control
- **Cookie via env var** — optionally pass `FUSEBASE_COOKIE` in your MCP config for environments where the encrypted store isn't available

## 🗂️ Project Structure

```text
src/
  index.ts              → MCP server (91 tools, stdio transport, tier system)
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
