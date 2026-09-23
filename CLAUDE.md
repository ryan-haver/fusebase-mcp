# Claude Code & Claude Desktop Guide for FuseBase MCP

This file provides project commands, architecture guidelines, and best practices when working with FuseBase MCP using Anthropic's Claude Code or Claude Desktop.

---

## Quick Reference Commands

- **Build Project**: `npm run build`
- **Watch / Dev Mode**: `npm run dev`
- **Run Server (Stdio)**: `node dist/index.js`
- **Run Server (SSE)**: `node dist/index.js --transport sse --port 3000`
- **Run Tests**:
  - Direct Token Test: `npm run test:token`
  - Deep Data Validation: `npm run test:data-validation`
  - Full Regression Suite: `npm run test:regression`
  - All Tests: `npm run test:all`

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

## Token Hygiene & Context Management
- FuseBase MCP boots with **Core Tier (34 tools)** to preserve your context window.
- If your task requires relational database, dashboard, portal, or automation capabilities, dynamically call `set_tool_tier({ "tier": "all" })` to register the remaining 141 extended tools.
- When retrieving documents, always request `format: "markdown"` via `get_page_content` to save ~50% in context token consumption.

*See [AGENTS.md](file:///c:/scripts/fusebase-mcp/AGENTS.md) for full architectural guidelines, database schemas, and zero-browser token auth specifications.*
