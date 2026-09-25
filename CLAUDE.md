# Claude Code & Claude Desktop Guide for FuseBase MCP

This file provides project commands, architecture guidelines, and best practices when working with FuseBase MCP using Anthropic's Claude Code or Claude Desktop.

---

## Quick Reference Commands

- **Build Project**: `npm run build`
- **Watch / Dev Mode**: `npm run dev`
- **Run Server (Stdio)**: `node dist/index.js`
- **Run Server (HTTP)**: `node dist/index.js --transport http --port 3000` (loopback only; set `MCP_AUTH_TOKEN` to require a bearer token, mandatory with `--host 0.0.0.0`)
- **Run Tests**:
  - Offline unit tests: `npm test`
  - Typecheck / lint: `npm run typecheck` / `npm run lint`
  - All offline stages (what CI runs): `npm run test:all -- --offline`
  - Live suites (need credentials + `FUSEBASE_WORKSPACE_ID` sandbox): `npm run test:live`
  - Known bugs are pinned as `it.fails` / `knownGap()` with IDs from `docs/PLAN-review-remediation.md`; remove the marker when you fix one.

---

## Adding FuseBase MCP to Claude

### Claude Code CLI
```bash
# Add as a plugin (auto-detects .claude-plugin/plugin.json)
claude plugin add .

# Or add as an MCP stdio server
claude mcp add fusebase -- node dist/index.js
```

### Claude Desktop
In `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):
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

---

## Secrets
- Secrets (Gate/Dashboards tokens, `FUSEBASE_SECRET_KEY`) live in 1Password. `.env` (gitignored) holds only `op://` references and IDs, and the server is started with `op run --env-file=.env`. See [docs/1PASSWORD.md](docs/1PASSWORD.md).
- Never print, log or commit secret values, and never commit anyone's real `.env` or MCP client config (vault/item names, Environment IDs, accounts). The shared `.mcp.json` stays generic; personal `op run` launches go in a local-scope entry.
- New tokens go into 1Password; add only the reference to `.env`. Check with `scripts/check-1password.ts` (names only) under a single `op run`, not many separate `op` calls: each one needs its own approval.
- `data/*.enc` (cookies, agent credentials) stay on disk, encrypted with `FUSEBASE_SECRET_KEY`.

## Token Hygiene & Context Management
- FuseBase MCP boots with **Core Tier (34 tools)** to preserve your context window.
- If your task requires relational database, dashboard, portal, or automation capabilities, dynamically call `set_tool_tier({ "tier": "all" })` to register the remaining 141 extended tools.
- When retrieving documents, always request `format: "markdown"` via `get_page_content` to save ~50% in context token consumption.

*See [AGENTS.md](file:///c:/scripts/fusebase-mcp/AGENTS.md) for full architectural guidelines, database schemas, and zero-browser token auth specifications.*
