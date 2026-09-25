# FuseBase MCP — AI Agent Instructions & Playbook

> **Target Audience:** Autonomous AI coding agents (Claude Code, OpenAI Codex, Cursor Agent, Antigravity, Devin, Aider, OpenCode, Windsurf).
> **Purpose:** Connect to, interact with, and manipulate FuseBase workspaces efficiently with zero token waste and zero context clutter.

---

## 1. Context Protection & Tool Tiers (CRITICAL)

FuseBase MCP provides **175 production tools**. Registering all 175 tools at once can consume **15,000–20,000 tokens** of your context window just in schema definitions.

To protect your context window, this server implements a **Two-Tier System**:

1. **Core Tier (34 Tools — Active by Default):**
   - Covers complete everyday CRUD for Pages/Notes, Folders, Comments, Mentions, Tasks, Attachments, Members, Profiles, and Guides.
   - **Default behavior:** Keep the server in Core Tier for document editing, research, and note-taking.
2. **Extended Tier (141 Tools — Activated On Demand):**
   - Unlocks Relational Databases (views, rows, columns, lookups, relations), Client Portals, ActivePieces Automations, Gate PostgreSQL isolated stores, API token creation, and Swarm boards.
   - **How to activate:** When your task requires databases, portals, or automations, call:
     ```json
     {
       "tool": "set_tool_tier",
       "arguments": { "tier": "all" }
     }
     ```
   - **Or launch with env:** Set `FUSEBASE_TOOLS=all` in your agent MCP environment configuration if your entire session is dedicated to database/portal development.

---

## 2. Authentication Modes (Zero-Browser Recommended)

FuseBase MCP supports three authentication methods:

### Mode 1: Pure Token Mode (Recommended for Autonomous Agents)
Autonomous agents cannot solve interactive browser captchas. Token mode connects directly to official FuseBase Gate & Dashboards remote MCP endpoints with zero browser dependency. It covers only part of the tool set (pages and folders: list, read, create, append; database listing; isolated SQL stores; Gate tokens). Tasks, comments, tags, members, page rename/move/delete, automations and most database tools need Mode 2 or 3; see [docs/TOKEN-COVERAGE.md](docs/TOKEN-COVERAGE.md).
```bash
# In your agent config or .env:
FUSEBASE_GATE_TOKEN=your_gate_mcp_token
FUSEBASE_DASHBOARDS_TOKEN=your_dashboards_mcp_token
# or unified platform token:
# FUSEBASE_TOKEN=your_token
```
> **Zero Configuration:** Upstream `whoami` automatically discovers your tenant `orgId`, domain `host`, and default workspace ID. No cookies or local browser binaries needed.

### Mode 2: Cached Session Cookie (Local Machines Only)
If browser cookies were already authenticated on the machine, the server automatically reads encrypted cookies from `data/cookie.enc` or environment `FUSEBASE_COOKIE`. This enables real-time Y.js CRDT WebSocket collaboration.

### Mode 3: Hybrid Mode
If both tokens and cookies are present, the server routes Gate/Database/PostgreSQL operations via high-speed Bearer tokens and collaborative document editing via Y.js WebSockets.

---

## 3. Token-Saving Conventions

When working with page content:
1. **Always read Markdown, not raw HTML**:
   ```json
   {
     "tool": "get_page_content",
     "arguments": {
       "page_id": "YOUR_PAGE_ID",
       "format": "markdown"
     }
   }
   ```
   *Specifying `format: "markdown"` cuts response size by ~50% using the built-in HTML-to-Markdown converter.*
2. **Append content non-destructively**:
   Use `append_page_content` with GitHub-style markdown. GitHub callouts (`> [!NOTE]`, `> [!WARNING]`, `> [!TIP]`) are automatically rendered as native colored FuseBase hint blocks.
3. **Attachments**:
   `download_attachment` returns images as native MCP image objects and streams files to disk without bloating conversational context.

---

## 4. Choosing the Right Database Primitive

FuseBase provides two distinct database models:

| Primitive | What It Is | Best Used For | Toolset |
|---|---|---|---|
| **Inline Document Table** | A table block embedded inside a page alongside markdown text and headers. | Meeting notes, character sheets, portfolio summaries, visual progress bars. | Handled via `append_page_content` or `update_page_content` using TableBlock schema. |
| **Relational Database (Dashboards)** | Standalone workspace-level relational table with multiple views (Grid, Kanban, Calendar), custom columns, lookups, and formula fields. | Enterprise trackers, CRM pipelines, bug trackers, multi-user project management. | `create_database`, `add_database_column`, `add_database_row`, `link_database_rows`, `create_view`. *(Requires Extended Tier).* |

---

## 5. Safety & Guardrails

- **`[DESTRUCTIVE]` Tag**: Tools marked `[DESTRUCTIVE]` (e.g. `delete_page`, `delete_database`, `delete_database_row`, `delete_relation`, `delete_automation_flow`) permanently destroy data. Confirm IDs before executing.
- **Scratch Directory**: Store scratch scripts, temporary data scrapers, and JSON payloads in `scratch/`. Never commit temporary files or secrets.

---

## 6. How to Run / Connect to FuseBase MCP

### Option A: Local Node.js (Stdio)
```bash
# 1. Build if not already built
npm install && npm run build

# 2. Run over stdio
node dist/index.js
```

### Option B: Docker Container (Stdio — Zero Local Dependencies)
```bash
docker run -i --rm \
  -e FUSEBASE_GATE_TOKEN="your_token" \
  -e FUSEBASE_DASHBOARDS_TOKEN="your_token" \
  -e FUSEBASE_TOOLS="all" \
  fusebase-mcp:latest
```

### Option C: Docker Container (Remote SSE / HTTP Network Service)
```bash
docker run -d --name fusebase-mcp -p 127.0.0.1:3000:3000 \
  -e FUSEBASE_GATE_TOKEN="your_token" \
  -e FUSEBASE_DASHBOARDS_TOKEN="your_token" \
  -e MCP_TRANSPORT="http" \
  -e MCP_HOST="0.0.0.0" \
  -e MCP_AUTH_TOKEN="$(openssl rand -hex 32)" \
  fusebase-mcp:latest
```
Connect to `http://localhost:3000/mcp` (Streamable HTTP; legacy SSE at `/sse`) with header `Authorization: Bearer <MCP_AUTH_TOKEN>`. Health check: `/health`. The port is published on loopback only; see `docker-compose.yml` before exposing it.

---

## 7. Client Configuration Examples

### Cursor IDE (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "fusebase": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "FUSEBASE_GATE_TOKEN": "your_gate_token",
        "FUSEBASE_DASHBOARDS_TOKEN": "your_dashboards_token"
      }
    }
  }
}
```

### Claude Desktop / Claude Code (`claude_desktop_config.json` or `.mcp.json`)
```json
{
  "mcpServers": {
    "fusebase": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "FUSEBASE_GATE_TOKEN": "your_gate_token",
        "FUSEBASE_DASHBOARDS_TOKEN": "your_dashboards_token"
      }
    }
  }
}
```
Or with Claude Code CLI:
```bash
claude mcp add fusebase -- node dist/index.js
```
