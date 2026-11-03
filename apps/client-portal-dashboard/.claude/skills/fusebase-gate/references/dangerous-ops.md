---
version: "1.0.0"
mcp_prompt: dangerousOps
last_synced: "2026-09-22"
title: "Fusebase Gate Irreversible Operations"
category: meta
---
# Fusebase Gate Irreversible Operations

> **MARKER**: `mcp-dangerous-ops-loaded` — When this marker is present in context, MCP prompts for this topic may skip conceptual sections and use API reference only.

> **VERSION CHECK**: If operations fail unexpectedly, load MCP prompt `dangerousOps` for latest content.

---
## Gate Operations That Need Confirmation

Some Gate operations are irreversible. `tools.list`, `tools.search` and `tools.describe` mark them `dangerous: true`, and `tool.call` refuses to run them unless the arguments carry `confirm: true`. Discovery is the only current list; nothing here repeats it.

## Protocol

1. Call the operation normally, without `confirm`. Gate executes nothing and answers with `ok: false`, code `CONFIRMATION_REQUIRED`, and a `preview` describing the operation, the validated arguments and the authorization chain.
2. Show that preview to the user in your own words and wait for an explicit yes.
3. Repeat the same call with `confirm: true` added to the arguments. Never set it on your own initiative, and never on a call the user has not seen.

`confirm` exists only on the MCP path. It is stripped before the operation runs, is not part of any request body, and the generated SDK does not have it — app backends calling Gate over HTTP are unaffected.
---

## Version

- **Version**: 1.0.0
- **Category**: meta
- **Last synced**: 2026-09-22
- **Priority rule**: If the MCP prompt has a higher version, follow the prompt's API Reference as source of truth.
