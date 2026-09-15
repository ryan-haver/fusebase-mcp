---
title: "How do I connect Fusebase MCP for Antigravity?"
url: "https://thefusebase.com/guides/fusebase-vibe-code/how-do-i-connect-fusebase-mcp-for-antigravity"
section: "fusebase-vibe-code"
lastScraped: "2026-09-15T04:45:04.198Z"
---

# How do I connect Fusebase MCP for Antigravity?

[Back to Fusebase Vibe Code](/guides/fusebase-vibe-code)

Fusebase Vibe Code

# How do I connect Fusebase MCP for Antigravity?

The Antigravity IDE by Google has its own specific requirements for configuring MCP with Fusebase. While setup is automatic in other IDEs (such as VS Code, Cursor, etc.), in...

Guide details

Published

March 17, 2026

Read time

1 min read

Category

Fusebase Vibe Code

In this guide

This guide is a short walkthrough.

The Antigravity IDE by Google has its own specific requirements for configuring MCP with Fusebase. While setup is automatic in other IDEs (such as VS Code, Cursor, etc.), in Antigravity you need to connect MCP manually.

Now, let’s walk through how to set up MCP in Antigravity:

1) Run `**fusebase init**` and select Other (Antigravity, WebStorm, Claude Desktop, etc.) — mcp\_example.json in the CLI.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/03/image-29.png)

2) Open **.env** in your project — it contains **DASHBOARDS\_MCP\_URL** and **DASHBOARDS\_MCP\_TOKEN**.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/03/image-30-1024x209.png)

3) In Antigravity chat, click the three dots (top-right) → MCP Servers.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/03/image-31.png)

4) Click Manage MCP Servers.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/03/image-32-1024x311.png)

5) Click View raw config, paste the server config (Antigravity uses `**serverUrl**` for remote MCP servers).

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/03/image-33-1024x264.png)

Paste the server config into the editor and replace the token with **DASHBOARDS\_MCP\_TOKEN** from Step 2 (keep serverUrl as the MCP URL). Then click Refresh in Manage MCP Servers, or restart Antigravity.

`{   "mcpServers": {   "fusebase-dashboards": {   "serverUrl": "https://dashboards-mcp.thefusebase.com/mcp",   "headers": {   "Authorization": "Bearer "   }   }   }   }`

6) Click Refresh in Manage MCP Servers, or restart Antigravity.

7) Return to Manage MCP Servers and click Refresh. When the server loads, you should see fusebase-dashboards and the list of available tools.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/03/image-34-1024x302.png)

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/03/image-35-1024x359.png)
