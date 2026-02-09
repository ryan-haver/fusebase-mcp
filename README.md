# Fusebase MCP Server

An [MCP](https://modelcontextprotocol.io/) server that lets AI assistants manage your [Fusebase](https://www.fusebase.com/) (formerly Nimbus Note) workspaces — pages, folders, tasks, tags, files, members, and more.

> **Note:** Fusebase has no public REST API. This server uses reverse-engineered internal endpoints with cookie-based authentication.

## ✨ Features

- **46 tools** across content, tasks, members, org admin, portals, databases, and more
- **Two-tier system** — 18 core tools load by default; 28 extended tools on demand
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

## 🔧 Tool Tiers

The server uses a **core/extended tier system** to optimize agent context usage:

| Tier | Tools | Description |
| --- | --- | --- |
| **Core** (default) | 18 | Day-to-day: pages, folders, tasks, tags, members |
| **Extended** | +28 | Admin, analytics, content mutations, portals, databases |

**Enable extended tools:**

- Mid-session: ask your AI to use `set_tool_tier` with `tier: "all"`
- Always-on: add `FUSEBASE_TOOLS=all` to your `.env`

### Core Tools (18)

| Category | Tool | Description |
| --- | --- | --- |
| Meta | `set_tool_tier` | Enable extended tools or check current tier |
| Meta | `check_version` | Check for server updates from GitHub |
| Auth | `refresh_auth` | Refresh session cookies via Playwright |
| Content | `list_workspaces` | List all workspaces |
| Content | `list_pages` | List pages (filter by folder, pagination) |
| Content | `get_page` | Get page metadata |
| Content | `get_page_content` | Get raw page content (HTML) |
| Content | `get_recent_pages` | Recently accessed pages |
| Content | `create_page` | Create a new blank page |
| Content | `list_folders` | Folder tree for a workspace |
| Tags | `get_tags` | Workspace or page tags |
| Tags | `update_page_tags` | Set tags on a page |
| Members | `get_members` | Workspace or org members |
| Tasks | `search_tasks` | Search tasks (by workspace/page) |
| Tasks | `list_task_lists` | Task boards and tasks |
| Tasks | `create_task` | Create a task in a task list |

### Extended Tools (28)

Enable with `set_tool_tier(tier: "all")`:

- **Content mutations**: `delete_page`, `update_page_content`
- **Files & attachments**: `get_page_attachments`, `list_files`, `get_file_count`
- **Labels & tags**: `get_labels`, `get_note_tags`
- **Activity & comments**: `get_activity_stream`, `get_comment_threads`
- **Tasks (advanced)**: `get_task_description`, `get_task_count`, `get_task_usage`
- **Organization**: `get_org_usage`, `get_org_limits`, `get_usage_summary`, `get_org_permissions`, `get_org_features`, `get_ai_usage`
- **Workspaces**: `get_workspace_detail`, `get_workspace_emails`, `get_workspace_info`
- **Navigation & AI**: `get_navigation_menu`, `get_mention_entities`, `list_agents`, `get_recently_updated_notes`
- **Databases & Portals**: `get_database_data`, `list_portals`, `get_portal_pages`

## 🔐 Security

- **No plaintext secrets on disk** — cookies are encrypted with AES-256-GCM using a machine-scoped key
- **Auto-refresh** — expired sessions are transparently refreshed via Playwright
- **`.env` is gitignored** — credentials never enter version control
- **Cookie via env var** — optionally pass `FUSEBASE_COOKIE` in your MCP config for environments where the encrypted store isn't available

## 🗂️ Project Structure

```text
src/
  index.ts    → MCP server (46 tools, stdio transport, tier system)
  client.ts   → HTTP client (cookie auth, 401 auto-retry, logging)
  crypto.ts   → AES-256-GCM encryption for secrets at rest
  types.ts    → TypeScript interfaces for API responses
scripts/
  auth.ts     → Capture session cookies via Playwright
  discover.ts → Crawl Fusebase UI to discover API endpoints
data/           → (gitignored) Cookie store, API logs, workspace cache
.browser-data/  → (gitignored) Playwright persistent browser profile
```

## 🗺️ Roadmap

See [UNIMPLEMENTED_ENDPOINTS.md](UNIMPLEMENTED_ENDPOINTS.md) for 36 discovered but unimplemented API endpoints, prioritized by value:

- **Automation** — ActivePieces flow/run management (11 endpoints)
- **Databases** — entity/table CRUD (3 endpoints)
- **AI assistant** — thread and preference management

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Run `npm run build` to verify TypeScript compiles
4. Submit a PR

## 📄 License

MIT
