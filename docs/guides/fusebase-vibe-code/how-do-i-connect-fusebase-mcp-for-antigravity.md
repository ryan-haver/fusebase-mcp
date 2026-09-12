---
title: "How do I connect Fusebase MCP for Antigravity?"
url: "https://thefusebase.com/guides/fusebase-vibe-code/how-do-i-connect-fusebase-mcp-for-antigravity/"
section: "fusebase-vibe-code"
lastScraped: "2026-09-12T05:17:48.626Z"
---

# How do I connect Fusebase MCP for Antigravity?

The Antigravity IDE by Google has its own specific requirements for configuring MCP with Fusebase. While setup is automatic in other IDEs (such as VS Code, Cursor, etc.), in Antigravity you need to connect MCP manually.

Now, let’s walk through how to set up MCP in Antigravity:

1) Run `**fusebase init**` and select Other (Antigravity, WebStorm, Claude Desktop, etc.) — mcp\_example.json in the CLI.

![](https://thefusebase.com/wp-content/uploads/2026/03/image-29.png)

2) Open **.env** in your project — it contains **DASHBOARDS\_MCP\_URL** and **DASHBOARDS\_MCP\_TOKEN**.

![](https://thefusebase.com/wp-content/uploads/2026/03/image-30-1024x209.png)

3) In Antigravity chat, click the three dots (top-right) → MCP Servers.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20830%20608'%3E%3C/svg%3E)

4) Click Manage MCP Servers.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20311'%3E%3C/svg%3E)

5) Click View raw config, paste the server config (Antigravity uses `**serverUrl**` for remote MCP servers).

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20264'%3E%3C/svg%3E)

Paste the server config into the editor and replace the token with **DASHBOARDS\_MCP\_TOKEN** from Step 2 (keep serverUrl as the MCP URL). Then click Refresh in Manage MCP Servers, or restart Antigravity.

`{   "mcpServers": {   "fusebase-dashboards": {   "serverUrl": "https://dashboards-mcp.thefusebase.com/mcp",   "headers": {   "Authorization": "Bearer "   }   }   }   }`

6) Click Refresh in Manage MCP Servers, or restart Antigravity.

7) Return to Manage MCP Servers and click Refresh. When the server loads, you should see fusebase-dashboards and the list of available tools.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20302'%3E%3C/svg%3E)

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20359'%3E%3C/svg%3E)
