# FuseBase MCP Server

[![Version](https://img.shields.io/badge/Version-v2.0.0-3b82f6?style=for-the-badge)](https://github.com/ryan-haver/fusebase-mcp)
[![Live Status Dashboard](https://img.shields.io/badge/Live%20Status-Operational-10b981?style=for-the-badge&logo=googlecloud&logoColor=white)](https://fusebase-mcp.thefusebase.app/)
[![Production Tools](https://img.shields.io/badge/Production%20Tools-175%20Verified-6366f1?style=for-the-badge)](https://fusebase-mcp.thefusebase.app/)
[![Automated Assertions](https://img.shields.io/badge/Automated%20Assertions-212%20Passing-10b981?style=for-the-badge)](https://fusebase-mcp.thefusebase.app/)
[![Docker Ready](https://img.shields.io/badge/Docker-Stdio%20%26%20SSE-2496ed?style=for-the-badge&logo=docker&logoColor=white)](https://github.com/ryan-haver/fusebase-mcp)
[![Token-only coverage](https://img.shields.io/badge/Token--only%20tools-14%20of%20129%20measured-8b5cf6?style=for-the-badge)](docs/TOKEN-COVERAGE.md)
[![Deep Data Validation](https://img.shields.io/badge/Deep%20Data%20Validation-100%25%20Verified-0ea5e9?style=for-the-badge)](https://fusebase-mcp.thefusebase.app/)

An enterprise-grade [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server enabling autonomous AI coding agents and developers to programmatically manage [FuseBase](https://www.fusebase.com/) (formerly Nimbus Note) workspaces - collaborative Y.js documents, relational tables, ActivePieces automations, client portals, hosted web apps, and multi-agent swarm boards with 100% deep data validation.

---

### Official Web Dashboard

> **Production Status & Interactive Architecture Dashboard**: **[fusebase-mcp.thefusebase.app](https://fusebase-mcp.thefusebase.app/)**  
> *Real-time engineering status, interactive searchable directory of all 175 MCP tools with schema parameters, 15 test suite validation metrics, system architecture, and milestone chronology.*

---

## Capabilities

- **175 tools** across content, tasks, members, files, databases, org admin, portals, guides, vibe coding, automations, CLI lifecycle, AI assistants & agent threads, FuseBase Work (Firecrawl & n8n), direct Gate & Dashboards MCP tokens, billing, user preferences, multi-agent profiles, and swarm orchestration
- **Direct Gate & Dashboards MCP Token Mode**: Connect zero-browser directly to FuseBase Gate (`https://gate-mcp.thefusebase.com/mcp`) and Dashboards (`https://dashboards-mcp.thefusebase.com/mcp`) with auto-discovered tenant identity, scopes, and default workspace. Token mode covers a subset of the tools (14 of 129 measured: workspaces, page/folder listing and creation, reading and appending content, database listing, isolated stores); the rest need a session cookie. See [docs/TOKEN-COVERAGE.md](docs/TOKEN-COVERAGE.md).
- **Advanced Markdown Ingestion**: Automatic parsing of GFM tables into interactive `TableBlock` objects, markdown images (`![alt](url)`), GitHub callouts (`> [!NOTE]`, `> [!WARNING]`, etc.), HTML underline/highlight, and `<details><summary>` toggles
- **FuseBase Work, Firecrawl & n8n**: Native tools to invoke any of 32 organization AI agents, crawl/parse web pages via hosted Firecrawl, and trigger n8n automation flows
- **Two-tier system** — 34 core tools load by default (complete CRUD suite); 141 extended tools on demand
- **Token Economics & Markdown Conversion** — retrieve page content as clean Markdown (`get_page_content(format: "markdown")`) for ~50% token reduction via built-in `htmlToMarkdown` converter
- **Binary Payload Safety & Native Images** — `download_attachment` renders images as native MCP `image` blocks and streams large files directly to local disk (`data/downloads/`)
- **Safety Annotations (`[DESTRUCTIVE]`)** — permanent deletion tools are explicitly tagged so AI clients and human supervisors can prompt for confirmation
- **Native MCP Resources (8)** — `fusebase://status`, `fusebase://workspaces`, `fusebase://guides/index`, `fusebase://work/connectors`, `fusebase://workspaces/{workspaceId}/pages/{pageId}`, `fusebase://databases/{databaseId}`, `fusebase://portals/{portalId}/clients`
- **Native MCP Prompts (17)** — pre-engineered workflow templates (`create-sop`, `summarize-page`, `build-kanban-project`, `design-automation-workflow`, `build-hosted-app`, `build-event-bridge`, `orchestrate-multi-agent-swarm`, `launch-client-portal`, `workspace-activity-digest`, `audit-page-governance`, `build-relational-database`, `import-knowledge-base`, `configure-ai-persona`, `crm-seed-demo-data`, `portal-embedded-app`, `fullstack-app-architecture`, `token-waste-audit`)
- **Official FuseBase CLI & Hosted Apps** — inspect CLI status (`fusebase_cli_status`), initialize products (`fusebase_cli_init`), list apps (`fusebase_cli_list_apps`), deploy Vite/React SPA apps to FuseBase Cloud (`fusebase_cli_deploy`), configure Docker sidecars (`fusebase_cli_sidecar_add`, `fusebase_cli_sidecar_list`, `fusebase_cli_sidecar_remove`), manage platform secrets (`fusebase_cli_secret_create`, `fusebase_cli_secret_list`), inspect remote logs (`fusebase_cli_logs`), and update app view permissions (`fusebase_cli_app_update`)
- **Granular block mutations** — non-destructive page block appending (`append_page_content`) via real-time Y.js WebSockets
- **Vibe Coding & Web Apps** — generate interactive web app pages (`create_interactive_app_page`) with responsive full-width embeds (`allowOverWidth`)
- **ActivePieces Workflow Automation** — flow inspection, creation, updating, deletion, trigger test runs (`trigger_automation_flow`), and connector piece catalog with auto-managed JWT authentication
- **Client Portal "Hub" Platform** — inspect availability (`check_portal_availability`), create portals (`create_portal`), retrieve full branding/settings (`get_portal`), inspect themes (`get_portal_theme`), portal sidebar navigation trees (`get_portal_navigation_menu`), resolve workspace portals (`get_workspace_portal`), publish workspace pages to client portals (`publish_page_to_portal`), manage client permissions (`list_portal_clients`, `invite_portal_client`), and generate 24h passwordless magic links (`create_portal_magic_link`)
- **Multi-Agent Swarm Orchestrator** — initialize shared state machine boards (`fusebase_swarm_init`) and transition tasks across roles with audit history (`fusebase_swarm_task_transition`)
- **Multi-Agent Profile Management** — list and switch between encrypted credentials seamlessly (`list_agent_profiles`, `switch_active_profile`)
- **Database CRUD & View Templates** — full kanban/table management: rows, columns, views, relations, managed templates (`get_dashboard_templates`), CSV import/export
- **Auto auth retry** — detects 401/403 and refreshes session automatically
- **Encrypted secrets** — cookies stored encrypted at rest (AES-256-GCM)
- **Version checking** — built-in update detection from GitHub
- **Live Cloud Status Dashboard** — real-time engineering and validation status dashboard hosted directly on FuseBase Cloud at [fusebase-mcp.thefusebase.app](https://fusebase-mcp.thefusebase.app/)
- **API logging** — all requests logged for debugging

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Fusebase](https://www.fusebase.com/) account

### 1. Install & Run

> 🤖 **AI Coding Agents:** See [AGENTS.md](file:///c:/scripts/fusebase-mcp/AGENTS.md) and [CLAUDE.md](file:///c:/scripts/fusebase-mcp/CLAUDE.md) for optimized instructions on zero-context-clutter tool tiering and zero-browser token authentication.

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
npm run build
```

**Option C — Docker (Zero-Install Container):**

Run locally via **Stdio** (for Cursor, Claude Desktop):
```bash
docker run -i --rm \
  -e FUSEBASE_GATE_TOKEN="your_token" \
  -e FUSEBASE_DASHBOARDS_TOKEN="your_token" \
  -e FUSEBASE_TOOLS="all" \
  fusebase-mcp:latest
```

Or run as a standing **HTTP Network Server** (for remote agents, swarms, and webhooks):
```bash
docker run -d --name fusebase-mcp -p 127.0.0.1:3000:3000 \
  -e FUSEBASE_GATE_TOKEN="your_token" \
  -e FUSEBASE_DASHBOARDS_TOKEN="your_token" \
  -e MCP_TRANSPORT="http" \
  -e MCP_HOST="0.0.0.0" \
  -e MCP_AUTH_TOKEN="$(openssl rand -hex 32)" \
  fusebase-mcp:latest
# Endpoint: http://localhost:3000/mcp (legacy SSE: /sse) | Health: /health
# Clients must send: Authorization: Bearer <MCP_AUTH_TOKEN>
```
*(Or set `MCP_AUTH_TOKEN` in `.env` and run `docker compose up -d`.)*

Every HTTP session acts with your FuseBase credentials, so the server:

- listens on `127.0.0.1` unless `--host` / `MCP_HOST` says otherwise, and refuses a non-loopback address without `MCP_AUTH_TOKEN`;
- requires `Authorization: Bearer <MCP_AUTH_TOKEN>` on every MCP request when a token is set;
- rejects unexpected `Host` headers (extra names via `MCP_ALLOWED_HOSTS`) and browser `Origin`s not listed in `MCP_ALLOWED_ORIGINS`.

### 2. Configure & Authenticate

FuseBase MCP provides three production authentication modes:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             Authentication Modes                                 │
├───────────────────────┬──────────────────────────┬───────────────────────────────┤
│ Mode 1: Pure Token    │ Mode 2: Session Cookie   │ Mode 3: Hybrid (Recommended)  │
│ (Zero-Browser / Gate) │ (Interactive / Headless) │ (Full-Spectrum Dual Engine)   │
├───────────────────────┼──────────────────────────┼───────────────────────────────┤
│ • Official Gate MCP   │ • Browser session cookie │ • Both token and cookie loaded│
│ • Official Dashboards │ • Interactive Chromium   │ • Tokens for Gate operations  │
│ • No browser needed   │ • Y.js collaborative WS  │ • Cookie for everything else  │
│ • Auto whoami config  │ • ActivePieces automations│• All 175 tools available     │
└───────────────────────┴──────────────────────────┴───────────────────────────────┘
```

#### Mode 1: Pure Token Mode (Direct Remote MCP Gateways — Zero-Browser)
Connect directly via official FuseBase Gate & Dashboards MCP gateways as specified in the official guides. Only part of the tool set works this way: tasks, comments, tags, members, page rename/move/delete, automations and most database and portal tools still need a session cookie (per-tool results: [docs/TOKEN-COVERAGE.md](docs/TOKEN-COVERAGE.md)).
- [Connect AI Agents to Fusebase Dashboards with MCP](https://thefusebase.com/guides/table-database/connect-ai-agents-to-fusebase-dashboards-with-mcp/)
- [Connect external AI Agents to Fusebase with MCP](https://thefusebase.com/guides/fusebase-ai/connect-external-ai-agents-to-fusebase-with-mcp/)

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

```env
# Direct Token Authentication (No cookies or browser needed)
FUSEBASE_GATE_TOKEN=your_gate_mcp_token
FUSEBASE_DASHBOARDS_TOKEN=your_dashboards_mcp_token
# or unified platform token:
# FUSEBASE_TOKEN=your_api_token
```

> **Zero Configuration:** When tokens are provided, the server automatically connects to upstream Gate (`https://gate-mcp.thefusebase.com/mcp`) and Dashboards (`https://dashboards-mcp.thefusebase.com/mcp`), auto-discovering your tenant organization ID (`orgId`), custom domain (`FUSEBASE_HOST`), and default workspace via upstream `whoami`.
>
> You can also save tokens securely encrypted at rest (AES-256-GCM):
> ```bash
> npx tsx scripts/auth.ts --token <your_token>
> # or for named multi-agent profiles:
> npx tsx scripts/auth.ts --profile agent-architect --token <token>
> ```

#### Mode 2: Browser Session Cookie Mode (Interactive / Headless)
For direct Y.js CRDT WebSocket live synchronization and internal ActivePieces engine integration:

```bash
npx tsx scripts/auth.ts
```

This opens a browser window → log into Fusebase → cookies are automatically captured and saved **encrypted** (AES-256-GCM) to `data/cookie.enc`.

> **Headless mode:** After initial login, you can re-authenticate without a browser window:
> ```bash
> npx tsx scripts/auth.ts --headless
> ```
>
> **Multi-Agent Profiles:** Authenticate a specific named profile:
> ```bash
> npx tsx scripts/auth.ts --profile agent-architect
> ```

#### Mode 3: Hybrid Mode (Recommended for Full-Spectrum Agents)
Supply both tokens (`FUSEBASE_GATE_TOKEN`, `FUSEBASE_DASHBOARDS_TOKEN`) and a session cookie (`FUSEBASE_COOKIE` or `data/cookie.enc`). The server intelligently routes:
- **Gate & Dashboards MCP:** Uses high-speed Bearer tokens for tenant discovery, isolated PostgreSQL stores, databases, and token management.
- **Notes Engine Fallback:** Automatically serves note/page/folder CRUD via Gate when session cookie is absent, and leverages real-time Y.js CRDT WebSocket sync when cookies are present.
- **Automation Engine:** Exchanges session cookie for ActivePieces project JWTs while allowing external webhook triggers via FuseBase Work.

---

### 3. Authentication Modes Feature Parity & Empirical Comparison

Most tools need a session cookie today: with only Gate and Dashboards tokens, **14 of the 129 tools measured work** (2026-09-25). The per-tool results, and which gaps have an official route, are in [docs/TOKEN-COVERAGE.md](docs/TOKEN-COVERAGE.md).

The table below compares the core capabilities in both modes, measured by `npm run test:parity` (`tests/live/token-parity.ts`) against live FuseBase:

| Domain | Feature | Pure Token Mode | Cookie / Session Mode | Parity Category | Technical Notes |
|---|---|:---:|:---:|:---:|---|
| **Identity** | Gate Tenant Identity (`whoami`) | ✅ PASS | ➖ N/A | **Token Superpower** | Gate resolves `orgId`, domain, user ID, default workspace, and granted permissions with zero browser login. |
| **Identity** | Session Org Usage & Quotas | ➖ N/A | ✅ PASS | **Full Parity** | Both modes provide full identity resolution; session cookies query `/gwapi2/ft:tasks/workspace-infos`. |
| **Workspaces** | List Workspaces (`list_workspaces`) | ✅ PASS | ✅ PASS | **Full Parity** | Pure Token maps Gate `listWorkspaces`; Cookie queries task workspace infos. Both yield real workspace IDs and roles. |
| **Pages & Notes** | List Pages (`list_pages`) | ✅ PASS | ✅ PASS | **Full Parity** | Pure Token uses Gate `listWorkspaceNotes`; Cookie uses `/v2/api/workspaces/{wid}/notes`. |
| **Pages & Notes** | Create Page (`create_page`) | ✅ PASS | ✅ PASS | **Full Parity** | Pure Token uses Gate `createWorkspaceNote`; Cookie uses `/v2/api/web-editor/notes/create`. |
| **Pages & Notes** | Read Page Content (`get_page_content`) | ✅ PASS | ✅ PASS | **Full Parity** | Pure Token reads Markdown via Gate `getWorkspaceNote`; Cookie syncs HTML via Y.js WebSocket decoder. |
| **Pages & Notes** | Append Page Content (`append_page_content`) | ✅ PASS | ✅ PASS | **Full Parity** | Pure Token uses Gate `appendWorkspaceNoteContent`; Cookie syncs delta blocks via Y.js WebSocket writer. |
| **Folders** | Folder List & Create (`list_folders`, `create_folder`) | ✅ PASS | ✅ PASS | **Full Parity** | Pure Token calls Gate `listWorkspaceNoteFolders` & `createWorkspaceNoteFolder`; Cookie calls `/gwapi2/ft:notes/menu`. |
| **Databases** | Database Discovery (`list_databases`) | ✅ PASS | ✅ PASS | **Full Parity** | Pure Token queries Dashboards MCP `getAllDatabases`; Cookie queries `/v1/dashboards/databases`. Schemas, rows, views and relations need the cookie today (see [TOKEN-COVERAGE.md](docs/TOKEN-COVERAGE.md)). |
| **Isolated Stores** | PostgreSQL Control & Migrations | ✅ PASS | ➖ N/A | **Token Superpower** | Exclusive to Gate MCP Bearer Token (`listIsolatedStores`, `queryIsolatedSql`, apply migrations). |
| **Token Lifecycle** | Programmatic Token Creation & Revocation | ✅ PASS | ➖ N/A | **Token Superpower** | Exclusive to Gate MCP: Programmatic API token generation, revocation, and catalog inspection (`listTokens`, `createToken`). |
| **CRDT Collaboration** | Live Y.js WebSocket Sync (`wss://text.nimbusweb.me`) | 🔒 RESTRICTED | ✅ PASS | **Cookie Exclusive** | Y.js collaborative gateway validates `eversessionid` during HTTP WebSocket upgrade. *(See Architectural Note 1)* |
| **Automations** | ActivePieces Internal Engine (`/automation/api/v1/...`) | 🔒 RESTRICTED | ✅ PASS | **Cookie Exclusive** | Internal ActivePieces auth exchanges `eversessionid` for project JWT. *(See Architectural Note 2)* |
| **Binary Files** | Web Editor Multipart Uploads (`/v3/api/web-editor/...`) | 🔒 RESTRICTED | ✅ PASS | **Cookie Exclusive** | Legacy web editor file upload multipart handler validates browser session state. *(See Architectural Note 3)* |
| **UI State** | Sidebar collapse & Web UI Preferences | 🔒 RESTRICTED | ✅ PASS | **Cookie Exclusive** | UI state toggles are stored in user session variables (`/v2/api/users/vars/...`). *(See Architectural Note 4)* |

#### Architectural Notes on Cookie-Dependent Services

1. **Real-time Y.js CRDT Collaborative WebSocket Sync (`wss://text.nimbusweb.me`):**  
   The real-time collaborative editing service uses Y.js binary sync protocols over WebSockets. The WebSocket handshake endpoint validates the `eversessionid` cookie header during HTTP upgrade and rejects unauthenticated or bearer-token-only connections with HTTP 401. In Pure Token Mode, the client automatically routes page content reads and appends through Gate MCP (`getWorkspaceNote` and `appendWorkspaceNoteContent`), so pages can be listed, read, created and appended to without a WebSocket connection. Replacing content, embeds, renaming, moving and deleting pages still need the cookie.

2. **Internal ActivePieces Workflow Engine (`/automation/api/v1/...`):**  
   FuseBase's embedded ActivePieces automation platform relies on an authentication bridge (`/automation/api/v1/authentication/fusebase-auth`) that requires an active `eversessionid` cookie to mint a temporary project JWT and resolve the tenant's automation `projectId`. In Pure Token Mode, external automations can be triggered via FuseBase Work connectors (`fusebase_work_trigger_n8n` or webhook endpoints) without invoking the internal ActivePieces session bridge.

3. **Legacy Web Editor Multi-Part File Uploads (`/v3/api/web-editor/file/v2-upload`):**  
   The legacy web editor attachment route specifically checks for browser session cookies in multi-part form submissions. File downloads, asset links, and URL-based attachments operate without restrictions across all modes, while raw binary uploads through the legacy editor form route require a session cookie.

4. **Web UI State & Session Preferences:**  
   Preferences like `set_sidebar_collapsed` and last-opened workspace lists exist only in the web client's session state variables (`/v2/api/users/vars/...`). Because headless AI agents interact programmatically via MCP tools rather than a visual UI layout, this restriction does not affect automation workflows.

#### Operational Recommendation: Which Mode Should You Use?

- **Use Pure Token Mode (`FUSEBASE_GATE_TOKEN` + `FUSEBASE_DASHBOARDS_TOKEN`):**  
  Best for CI/CD pipelines, autonomous Docker containers, headless cloud workers, and multi-tenant AI agents where browser login is impossible or undesirable. Covers workspaces, page and folder listing and creation, reading and appending page content, database listing and isolated SQL stores, with no browser. Most other tools need a session cookie today; see [docs/TOKEN-COVERAGE.md](docs/TOKEN-COVERAGE.md) before relying on it.
- **Use Hybrid Mode (Tokens + Cached Cookie):**  
  Best for local developer environments, rich interactive pair programming, and full-spectrum swarm orchestration where live Y.js WebSocket document collaboration and ActivePieces workflow creation are utilized alongside Gate MCP's PostgreSQL stores.

---

### 4. Connect to Your AI Assistant (Claude, Cursor, Antigravity, Codex, OpenCode)

#### Single-System Credential Architecture
FuseBase MCP is built for multi-agent environments sharing a single machine. Once you configure credentials on your machine (via `.env`, `npx tsx scripts/auth.ts --token <token>`, or browser login):
1. **Zero-Config Agent Discovery:** Any coding agent running `node dist/index.js` in the workspace root automatically reads the local encrypted credentials and connects immediately without needing tokens or cookies hardcoded in the agent's JSON config.
2. **Multi-Agent Profile Isolation:** When running multi-agent swarms (e.g. PM, Architect, Developer, QA), each agent can use its own distinct encrypted identity simply by setting `"FUSEBASE_PROFILE": "agent-architect"`.
3. **Docker Execution:** For containers or remote runners, you can pass `FUSEBASE_GATE_TOKEN` and `FUSEBASE_DASHBOARDS_TOKEN` directly in the container `env` block.

---

#### Client Configuration Templates

<details open>
<summary><strong>1. Claude (Claude Desktop & Claude Code)</strong></summary>

**Claude Desktop** (`%APPDATA%\Claude\claude_desktop_config.json` on Windows or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):
```json
{
  "mcpServers": {
    "fusebase": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "FUSEBASE_TOOLS": "all"
      }
    }
  }
}
```

Or via Docker (Zero-Install):
```json
{
  "mcpServers": {
    "fusebase": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "FUSEBASE_GATE_TOKEN",
        "-e", "FUSEBASE_DASHBOARDS_TOKEN",
        "-e", "FUSEBASE_TOOLS=all",
        "fusebase-mcp:latest"
      ]
    }
  }
}
```

**Claude Code CLI:**
```bash
# Add as a local plugin using native .claude-plugin/plugin.json
claude plugin add .
```
Or run directly via stdio:
```bash
claude mcp add fusebase -- node dist/index.js
```

</details>

<details open>
<summary><strong>2. Cursor IDE</strong> — <code>.cursor/mcp.json</code></summary>

In your workspace root, create or edit `.cursor/mcp.json` (or add via **Cursor Settings > Features > MCP**):
```json
{
  "mcpServers": {
    "fusebase": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "FUSEBASE_TOOLS": "all"
      }
    }
  }
}
```

Or via Docker:
```json
{
  "mcpServers": {
    "fusebase": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "FUSEBASE_GATE_TOKEN",
        "-e", "FUSEBASE_DASHBOARDS_TOKEN",
        "-e", "FUSEBASE_TOOLS=all",
        "fusebase-mcp:latest"
      ]
    }
  }
}
```

</details>

<details open>
<summary><strong>3. Google Antigravity IDE</strong> — <code>~/.gemini/antigravity-ide/mcp_config.json</code> or <code>.agent/mcp_config.json</code></summary>

Add to your global Antigravity MCP configuration or workspace `.agent/mcp_config.json`:
```json
{
  "mcpServers": {
    "fusebase": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "FUSEBASE_TOOLS": "all"
      }
    }
  }
}
```

</details>

<details open>
<summary><strong>4. OpenAI Codex</strong> — <code>.codex-plugin/plugin.json</code> or Codex CLI</summary>

This repository includes native `.codex-plugin/plugin.json` for OpenAI Codex agent ecosystems.

Add via Codex CLI:
```bash
codex mcp add fusebase --command node --args dist/index.js
```
Or in your Codex configuration:
```json
{
  "mcp": {
    "fusebase": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "FUSEBASE_TOOLS": "all"
      }
    }
  }
}
```

</details>

<details open>
<summary><strong>5. OpenCode</strong> — <code>opencode.json</code></summary>

OpenCode supports local stdio execution, Docker, and direct upstream HTTP Gate connection:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "fusebase": {
      "type": "stdio",
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "FUSEBASE_TOOLS": "all"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>6. VS Code Copilot, Cline & Roo Code</strong> — <code>settings.json</code></summary>

```json
{
  "mcp": {
    "servers": {
      "fusebase": {
        "command": "node",
        "args": ["dist/index.js"],
        "env": {
          "FUSEBASE_TOOLS": "all"
        }
      }
    }
  }
}
```

</details>

> **Note:** If running outside the repository root directory, you can specify the full path to `dist/index.js` or use `${workspaceFolder}/dist/index.js`. If credentials are saved in `.env` or `data/tokens.enc`, no auth environment variables are required in the client JSON!

### 5. Verify

Ask your AI assistant:

> *"List my Fusebase workspaces"*

If it works, you're all set! 🎉

You can also run automated verification directly from your terminal:

```bash
npm test                      # Offline unit tests (no credentials needed)
npm run test:all -- --offline # Typecheck, lint, build, unit tests, schema audit (what CI runs)
npm run test:live             # Live suites against your sandbox workspace (see below)
npm run deploy:status         # Build & deploy live status dashboard to fusebase-mcp.thefusebase.app
npm run deploy:page           # Embed the live status dashboard into a FuseBase workspace note
```

### Sandbox Workspace for Live Tests

Live test suites create and delete pages, folders, databases and flows, so they only run in a workspace you name explicitly. There is no fallback to "the first workspace":

- **Environment variable** (recommended): set `FUSEBASE_WORKSPACE_ID` in your `.env`
- **CLI flag**: `npm run test:data-validation -- --workspace=<workspace-id>`

Portal invite / magic-link checks send real email and are skipped unless `FUSEBASE_TEST_INVITE_EMAIL` is set to an address you control.

`npm run deploy:page` accepts the same `--workspace=<id|name>` flag and `FUSEBASE_WORKSPACE_ID`.

## 📚 Native MCP Resources & Prompts

FuseBase MCP supports first-class MCP protocol primitives for zero-overhead context injection:

### Resources (`fusebase://`)

Clients can attach FuseBase data directly into their context window:

| URI Pattern | Type | Description |
| --- | --- | --- |
| `fusebase://status` | Static | Live operational status, 168-tool catalog, 14 test suites, and web dashboard URL |
| `fusebase://workspaces` | Static | JSON array of all accessible workspaces |
| `fusebase://guides/index` | Static | Comprehensive index of all 278 FuseBase documentation guides |
| `fusebase://work/connectors` | Static | Catalog of integrated third-party services and automation connectors |
| `fusebase://guides/{section}/{slug}` | Template | Full markdown content of any specific guide |
| `fusebase://workspaces/{workspaceId}/pages/{pageId}` | Template | Decoded HTML representation of any page (also supports legacy `{wid}/{nid}`) |
| `fusebase://databases/{databaseId}` | Template | Complete JSON schema and views for a database (also supports legacy `{did}`) |
| `fusebase://portals/{portalId}/clients` | Template | List of invited external clients and permissions for a portal |

### Pre-Engineered Prompts (17)

Quick-start workflow prompts available to AI clients:

- **`create-sop`**: Guides the assistant in generating a rigorous Standard Operating Procedure document with scope, prerequisites, step-by-step procedures, and verification checklists.
- **`summarize-page`**: Fetches living page content via `getPageContent` and synthesizes an executive summary, key decisions, prioritized action items, and open questions.
- **`build-kanban-project`**: Guides the AI to design a structured project board with customized column flows, custom field recommendations, and starter cards.
- **`design-automation-workflow`**: Prompts the design of an ActivePieces automation workflow mapping triggers, action steps, retry policies, and error handling.
- **`build-hosted-app`**: Architects a full-stack FuseBase Web App covering frontend UI tokens, backend data, CLI commands, and responsive embedding.
- **`build-event-bridge`**: Designs bidirectional webhook bridges connecting external systems (Stripe, GitHub, n8n) into FuseBase and triggering workflows via `trigger_automation_flow`.
- **`orchestrate-multi-agent-swarm`**: Decomposes complex initiatives into coordinated multi-agent swarms tracked through FuseBase Kanban boards (`fusebase_swarm_init`, `fusebase_swarm_task_transition`).
- **`launch-client-portal`**: Plans and provisions an external branded Client Portal with custom theme, sidebar navigation hierarchy, page publication matrix, and passwordless magic link invitations (`invite_portal_client`, `create_portal_magic_link`).
- **`workspace-activity-digest`**: Ingests recent workspace activity, updated pages, and task completion metrics to produce an executive velocity pulse and blocker digest.
- **`audit-page-governance`**: Fetches page content and audits heading hierarchy (H1-H3), incomplete action items (`- [ ]`), stale dates, and tags, providing a concrete revision plan.
- **`build-relational-database`**: Architects a multi-table relational schema with bidirectional relations (`add_relation_column`), lookup rollups (`add_lookup_column`), and specialized Kanban/Grid views.
- **`import-knowledge-base`**: Plans structured migrations of Notion workspaces, Confluence spaces, or CSV datasets into FuseBase folders, markdown pages, and databases.
- **`configure-ai-persona`**: Designs specialized AI assistant personas with tailored charters, quick-action suggestion chips, and starter conversation threads.
- **`crm-seed-demo-data`**: Generates high-fidelity CRM demo records (Companies, Contacts, Deals table/pipeline, Trackers) with relational integrity across parent and child tables.
- **`portal-embedded-app`**: Guides scaffolding and deployment of FuseBase client portal embedded applications using dynamic `{{CurrentPortal}}` view filtering and runtime context authentication.
- **`fullstack-app-architecture`**: Architects enterprise full-stack FuseBase Web Applications with Docker sidecar microservices, secret whitelisting, and unified localhost routing.
- **`token-waste-audit`**: Audits active agent interactions and tool invocations to identify redundant schema fetching, enforce compact Markdown formats, and recover context bandwidth.

---

## 🔧 Tool Tiers

The server uses a **core/extended tier system** to optimize agent context usage:

| Tier | Tools | Description |
| --- | --- | --- |
| **Core** (default) | 34 | Day-to-day: full CRUD and organization for pages, folders, content, tasks, tags, attachments, members, guides, session health, profiles |
| **Extended** | +141 | Admin, CLI apps, automations, portal lifecycle, databases, relations, batch mutations, isolated SQL stores, Gate tokens, templates, swarm state machines, billing, preferences |

**Enable extended tools:**

- Mid-session: ask your AI to use `set_tool_tier` with `tier: "all"`
- Always-on: add `FUSEBASE_TOOLS=all` to your `.env`

### Core Tools (34)

Core tools load by default and provide complete CRUD and organization operations for day-to-day workspace workflows without requiring extended tier switching:

| Category | Tool | Description |
| --- | --- | --- |
| Meta | `set_tool_tier` | Enable extended tools (`tier: "all"`) or check active tier |
| Meta | `check_version` | Check for server updates from GitHub |
| Auth | `refresh_auth` | Refresh session cookies via Playwright |
| Auth | `check_session_health` | Inspect cookie age, profile metadata, and test API connectivity |
| Profiles | `list_agent_profiles` | List all configured encrypted agent credential profiles |
| Profiles | `switch_active_profile` | Switch active agent session profile dynamically |
| Content | `list_workspaces` | List all accessible workspaces |
| Content | `list_pages` | List pages (filter by folder/parentId, pagination) |
| Content | `get_page` | Get page metadata and properties |
| Content | `get_recent_pages` | Recently accessed pages in workspace |
| Content | `create_page` | Create a page with optional markdown or block content |
| Content | `update_page` | Update page title or move between folders |
| Content | `move_page` | Move a page between folders or migrate across workspaces |
| Content | `delete_page` | `[DESTRUCTIVE]` Delete a page permanently |
| Content | `get_page_content` | Retrieve page content as HTML or token-efficient Markdown (`format: "markdown"`) |
| Content | `append_page_content` | Non-destructive block append via real-time Y.js WebSocket |
| Content | `update_page_content` | Full document content overwrite via Y.js |
| Content | `list_folders` | Workspace folder hierarchy |
| Content | `create_folder` | Create a new folder |
| Tasks | `search_tasks` | Search tasks across workspace |
| Tasks | `list_task_lists` | List task boards/lists |
| Tasks | `create_task` | Create a new task |
| Tasks | `update_task` | Update task properties, title, or completion status |
| Tasks | `delete_task` | `[DESTRUCTIVE]` Delete a task permanently |
| Tags | `get_tags` | List workspace tags |
| Tags | `update_page_tags` | Set tags on a page |
| Files | `get_page_attachments` | List attachments on a page |
| Files | `upload_file` | Upload file attachment to a page |
| Files | `list_files` | List uploaded files |
| Files | `download_attachment` | Download attachment (native MCP `image` block or direct disk save to `data/downloads/`) |
| Members | `get_members` | List workspace members |
| Guides | `search_guides` | Search 278 FuseBase guides by keyword |
| Guides | `get_guide` | Get full markdown guide by section and slug |
| Guides | `list_guide_sections` | Browse all 19 documentation sections |

### Extended Tools (134)

Enable with `set_tool_tier(tier: "all")` or set `FUSEBASE_TOOLS=all` in `.env`:

- **FuseBase Work (Firecrawl & n8n)**: `fusebase_work_run_agent`, `fusebase_work_scrape_url`, `fusebase_work_trigger_n8n`
- **Client Portal Hub**: `check_portal_availability`, `create_portal`, `get_portal`, `get_portal_theme`, `get_portal_navigation_menu`, `get_workspace_portal`, `publish_page_to_portal`, `list_portal_clients`, `invite_portal_client`, `create_portal_magic_link`, `list_portals`, `get_portal_pages`
- **Multi-Agent Swarms**: `fusebase_swarm_init`, `fusebase_swarm_task_transition`
- **FuseBase CLI & Hosted Apps**: `fusebase_cli_status`, `fusebase_cli_init`, `fusebase_cli_list_apps`, `fusebase_cli_deploy`, `fusebase_cli_sidecar_add`, `fusebase_cli_sidecar_list`, `fusebase_cli_sidecar_remove`, `fusebase_cli_secret_create`, `fusebase_cli_secret_list`, `fusebase_cli_logs`, `fusebase_cli_app_update`, `create_interactive_app_page`
- **ActivePieces Workflow Automations**: `list_automation_flows`, `get_automation_flow`, `create_automation_flow`, `update_automation_flow`, `delete_automation_flow`, `trigger_automation_flow`, `list_flow_runs`, `list_automation_pieces`, `get_automation_flags`, `list_automation_folders`, `create_automation_folder`, `delete_automation_folder`, `get_automation_user`
- **Tasks (Metrics & Logs)**: `get_tasks_workspace_summary`, `get_task_time_tracking`, `get_task_description`, `get_task_count`, `get_task_usage`
- **Labels & Tags**: `get_labels`, `get_note_tags`
- **Comments & Activity Stream**: `get_activity_stream`, `get_comment_threads`, `fusebase_poll_mentions`, `fusebase_post_comment`, `fusebase_reply_comment`, `fusebase_resolve_thread`
- **Files & Storage**: `get_file_count`
- **Organization Administration**: `get_member_roles`, `get_workspace_members_v1`, `get_org_trials`, `get_org_usage`, `get_org_limits`, `get_usage_summary`, `get_org_permissions`, `get_org_features`, `get_ai_usage`
- **Workspaces & Subscription**: `get_workspace_premium_status`, `get_active_import_status`, `get_workspace_detail`, `get_workspace_emails`, `get_workspace_info`
- **Navigation & AI Assistant**: `get_agent_public_profile`, `get_ai_assistant_state`, `list_ai_agent_threads`, `get_ai_agent_favorites`, `get_navigation_menu`, `get_mention_entities`, `list_agents`, `list_ai_agent_categories`, `get_recently_updated_notes`
- **Databases & Tables**: `get_dashboard_templates`, `get_database_entity_templates`, `get_database_data`, `list_databases`, `get_database_entity`, `create_database`, `add_database_row`, `delete_database_row`, `move_kanban_card`, `list_database_relations`, `create_dashboard_table`, `delete_relation`, `list_all_databases`, `get_database_detail`, `update_database`, `delete_database`, `get_dashboard_detail`, `delete_dashboard`, `batch_put_database_data`, `resolve_database_alias`
- **Views**: `update_view`, `set_view_representation`, `create_view`, `delete_view`, `duplicate_view`, `set_view_grouping`
- **Columns**: `add_database_column`, `delete_database_column`, `rename_database_column`, `reorder_database_columns`, `set_column_width`, `add_relation_column`, `add_lookup_column`
- **Cells & Rows**: `update_database_cell`, `get_database_rows`, `get_database_schema`, `reorder_database_rows`
- **Direct Gate & Dashboards Tokens**: `fusebase_token_list`, `fusebase_token_create`, `fusebase_token_get`, `fusebase_token_revoke`, `fusebase_token_permission_catalog`, `fusebase_gate_whoami`, `fusebase_direct_tool_call`
- **Row-Level Relations**: `link_database_rows`, `unlink_database_rows`, `get_relation_rows`
- **Gate PostgreSQL Isolated SQL Stores**: `list_isolated_stores`, `create_isolated_store`, `query_isolated_sql`, `execute_isolated_sql`, `select_isolated_sql_rows`, `insert_isolated_sql_row`, `batch_insert_isolated_sql_rows`, `list_isolated_sql_tables`, `apply_isolated_sql_migrations`
- **Billing & User Preferences**: `get_billing_info`, `get_user_preferences`, `set_sidebar_collapsed`
- **Import/Export**: `duplicate_database`, `export_csv`, `import_csv`

## 🔐 Security

- **Encrypted at rest** — saved cookies, tokens and agent credentials are encrypted with AES-256-GCM using a random key in `data/.key` (owner-only) or `FUSEBASE_SECRET_KEY`
- **1Password** — keep tokens and `FUSEBASE_SECRET_KEY` in 1Password, put only `op://` references in `.env`, and start the server with `op run --env-file=.env -- node dist/index.js`. Vault items or a 1Password Environment both work. See [docs/1PASSWORD.md](docs/1PASSWORD.md)
- **Auto-refresh** — expired sessions are transparently refreshed via Playwright
- **`.env` is gitignored** — credentials never enter version control
- **Cookie via env var** — optionally pass `FUSEBASE_COOKIE` in your MCP config for environments where the encrypted store isn't available

## 🗂️ Project Structure

```text
src/
  index.ts              → Entry point: loads configuration, starts stdio or HTTP transport
  server.ts             → Builds one MCP server per session (tools, resources, prompts, tier switching)
  http-server.ts        → Streamable HTTP (+ legacy SSE) transport with bearer auth and Host/Origin checks
  config.ts             → .env, 1Password Environment and op:// reference loading; token resolution
  secret-refs.ts        → 1Password integration (op read, SDK Environment loading)
  client.ts             → FuseBase web API client (one request path: auth, timeouts, refresh, logging)
  client-factory.ts     → Builds clients per profile; caches Gate bridges per token set
  gate-bridge.ts        → Client for the official Gate & Dashboards MCP endpoints
  write-safety.ts       → When a failed write may be retried on another path
  crypto.ts             → Encrypted credential store (random key, legacy migration)
  yjs-ws-writer.ts      → Y.js WebSocket writer/reader for page content (confirmed writes)
  yjs-html-decoder.ts   → Y.js document → HTML / markdown
  markdown-parser.ts    → Markdown (mdast + GFM) → content blocks
  content-schema.ts     → Content block types
  resources.ts, prompts.ts → MCP resources and prompts
  guide-loader.ts       → Search over the downloaded FuseBase guides
  cli-manager.ts, proxy-relay.ts, ids.ts, types.ts
  tools/                → Tool definitions (core and extended tiers)
tests/
  unit/                 → Offline unit tests (vitest), run by CI and the pre-commit hook
  live/                 → Live suites against a sandbox workspace; every write proven by a read (docs/TESTING.md)
    lib/harness.ts      → Live-suite harness: strict tool calls, write verification, skips, exit codes
    sweep-sandbox.ts    → Leftover sweep run after the live suites
scripts/
  test-all.ts           → Runs the offline stages and/or the live suites (`npm run test:all`)
  audit-tools.ts        → Tool schema, duplicate and README coverage audit
  auth.ts               → Capture/refresh session cookies with a browser (`npm run setup:browser` first)
  check-1password.ts    → Shows where each secret comes from (names only)
  scrape-guides.ts      → Downloads the FuseBase guides (`npm run guides:fetch`)
  deploy-status-dashboard.ts → Builds and deploys the status dashboard app
docs/                   → Testing, 1Password, remediation plan and design notes
apps/                   → The status dashboard FuseBase app
.githooks/              → Commit and push validation gate (`npm run hooks:install`)
.cache/guides/          → (gitignored) Downloaded FuseBase guides
data/                   → (gitignored) Encrypted credentials, browser profiles, downloads, logs
```
## 🗺️ Roadmap & Implemented Milestones

See [ENDPOINT_REFERENCE.md](docs/ENDPOINT_REFERENCE.md) for all discovered and implemented API endpoints.

### Completed Milestones
- [x] **Core Tier CRUD Completeness** — 34 core tools providing full CRUD for pages, folders, content, tasks, and files.
- [x] **ActivePieces Workflow Automation** — Flow creation, updates, triggers, piece catalog, and JWT exchange.
- [x] **Client Portal Hub Lifecycle** — Portal creation, domain lookup, theme inspection, client permissions, and magic links.
- [x] **Multi-Agent Swarm Orchestration** — Collaborative Kanban state machines with role transitions.
- [x] **Native AI Assistant & Agent Threads** — AI suggestions, threads, and user preferences.
- [x] **Token Economics & Binary Safety** — HTML-to-Markdown conversion and native image / local disk file staging.
- [x] **RFC 6570 Resource Templates & Prompts** — Direct URI data mounting and pre-engineered workflows.
- [x] **Full-Spectrum 165-Tool Deep Data Validation** — 100% live verification with field, type, and lifecycle assertions.

### Future Opportunities
- **Bidirectional Webhook Listeners** — Local webhook listener bridge for real-time external event triggers into FuseBase.
- **Offline Working Memory** — Local SQLite caching adapter for instant retrieval of high-frequency pages and database schemas.

## 🧪 Testing & Validation

Tests are split into **offline** checks (fast, no credentials, run in CI) and **live** suites (talk to FuseBase, run locally against a sandbox workspace).

```bash
npm test                        # Offline unit tests (vitest), tests/unit/
npm run typecheck               # Typecheck src, scripts and tests
npm run lint                    # ESLint
npm run test:all -- --offline   # All offline stages (same as CI)
npm run test:live               # All live suites (needs credentials + FUSEBASE_WORKSPACE_ID)
npm run test:all                # Offline stages, then live suites
```

| Command | What it checks |
|---|---|
| `npm test` | Offline unit tests: markdown parser, Y.js writer → decoder round trips, tool registry and tiers, input validation, path handling, CLI argument building, server process behaviour |
| `npm run test:audit` | Every tool has a description and described parameters, no duplicate tools, every tool documented in README.md |
| `npm run test:token` | Gate/Dashboards token identity, permission catalog, token list, isolated stores |
| `npm run test:mcp-e2e` | MCP resources, prompts, tier switching and a full page lifecycle over stdio |
| `npm run test:regression` | Every block type and inline format written over the Y.js WebSocket and read back |
| `npm run test:database` | Database, column, row, view, relation, CSV and cloning lifecycle |
| `npm run test:data-validation` | Live calls across the tool catalog with data-shape and round-trip assertions |
| `npm run test:parity` | The same capabilities measured in token mode and cookie mode |

**How results are reported.** Suites exit non-zero on any failure. Capabilities an org may legitimately lack (CLI not installed, feature not on the plan) are reported as explicit *skips*, never as passes. Behaviour that is known to be broken is tracked as an expected failure (`it.fails` offline, `knownGap()` live) tagged with its finding ID from [docs/PLAN-review-remediation.md](docs/PLAN-review-remediation.md); when a fix lands, the marker turns red until it is removed.

### Before You Push

1. `npm run test:all -- --offline` (CI runs the same stages on Node 22 and 24)
2. `npm run test:live` for any change that touches API calls, content writing or auth
3. `npm run deploy:status` if you maintain the status dashboard

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Run `npm run build` to verify TypeScript compiles
4. Submit a PR

## 📄 License

MIT
