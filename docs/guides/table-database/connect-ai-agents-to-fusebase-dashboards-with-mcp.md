---
title: "Connect AI Agents to Fusebase Dashboards with MCP"
url: "https://thefusebase.com/guides/table-database/connect-ai-agents-to-fusebase-dashboards-with-mcp/"
section: "table-database"
lastScraped: "2026-09-12T05:18:30.480Z"
---

# Connect AI Agents to Fusebase Dashboards with MCP

Fusebase Dashboards MCP connects AI agents directly to the structured data your business runs on.

Instead of only reading documents or answering questions, an agent can work with your live Fusebase databases: leads, clients, requests, tickets, projects, invoices, onboarding records, content plans, and more.

You create an MCP configuration, choose which databases the agent can access, define what it is allowed to do, and generate a secure MCP URL and token. Then you can connect it to Claude, Codex, or any other MCP-compatible agent.

Depending on the permissions you allow, an agent can inspect database structure, find and read records, create new records, update existing data, organize information, and keep workflows moving.

For example, an agent can:

-   add a new lead to your sales database after a form submission;
-   update a client’s onboarding status when required files are received;
-   find incomplete records and request the missing information;
-   review incoming requests and assign the correct owner or priority;
-   clean up inconsistent statuses, labels, or fields;
-   prepare reports using current data instead of outdated exports;
-   create and maintain records as part of a larger workflow.

# How to obtain the MCP configuration for connecting to FuseBase [#](#0-toc-title)

1) Open your organization settings and go to the Dashboards MCP section (available only to the owner and organization managers).

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20554'%3E%3C/svg%3E)

2) 2) Click on Create Dashboard MCP.

3) Specify the name of the MCP config.

4) Next, set the access level that the agent will have with this MCP:

-   Full: the agent can edit. Please be cautious when granting this level of access.
-   Custom: you decide which areas the agent can access. Off means no access, Read is view-only, and Edit grants full access.
-   Read: the agent can view but cannot make any changes in your organization.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20649'%3E%3C/svg%3E)

5) Next, click on Create Dashboard MCP, and you will see a page where you can copy your token as well as the configuration for adding to agents.

You can either copy the token and MCP URL, or download ready-made configurations for Claude, Codex, and others as well.

After creation, the new config will appear in the list.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20651'%3E%3C/svg%3E)

# Revoke MCP Config [#](#1-toc-title)

If desired, you can disable any MCP config. To do this, click on it and click Revoke.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20652'%3E%3C/svg%3E)
