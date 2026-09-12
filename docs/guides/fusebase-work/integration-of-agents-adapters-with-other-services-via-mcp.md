---
title: "Integration of agents/adapters with other services via MCP"
url: "https://thefusebase.com/guides/fusebase-work/integration-of-agents-adapters-with-other-services-via-mcp/"
section: "fusebase-work"
lastScraped: "2026-09-12T05:19:02.309Z"
---

# Integration of agents/adapters with other services via MCP

## **What is MCP?** [#](#0-toc-title)

MCP (Model Context Protocol) is a technology that lets our agents connect and work with your favorite apps and services.  
Think of it as a universal remote: instead of switching between different tools, you can manage everything right from your agent – quickly and easily.

MCP isn’t just about connecting to other services. It actually expands what your agent can do!  
With MCP, your agent can:

-   Generate diagrams for reports or presentations
-   Create videos and images automatically
-   Analyze data and build visual dashboards
-   etc

So, MCP turns your agent into a powerful assistant that not only connects your apps, but also brings new creative and productive features – helping you get more done, in less time.

## Adapters already work with MCP – why do I need additional configuration? [#](#1-toc-title)

Yes, our adapters such as Cursor, Codex, and Hermes already have built-in MCP functionality. However, our implementation offers several advantages:

-   A single management point for all integrations at the organizational level. If you use both Codex and Claude, you don’t need to configure integrations for each adapter individually—everything can be set up in one place for all adapters at once.
-   You can configure integration access permissions. For example, you can make certain integrations available to all agents in the organization, while others can be restricted to specific agents only.

## FuseBase MCP [#](#2-toc-title)

By default, we automatically set up MCP for Fusebase, which allows you to manage your organization through FuseBase Work. Specifically, you can:

-   create workspaces, folders, and pages;
-   edit pages;
-   create and edit portals;
-   create and edit databases;
-   etc.

MCP is enabled by default for the default CEO agent with full access to your organization. For new agents, you’ll need to activate FuseBase manually with the permissions you require.

## Adding an MCP/HTTP integration [#](#3-toc-title)

1) Go to the Integrations section.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20492'%3E%3C/svg%3E)

2) Click on Add Integration.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20510'%3E%3C/svg%3E)

3) You have several integration options:

-   Custom integrations with FuseBase. As mentioned above, the default agent already has the FuseBase integration enabled by default. However, you can add a custom integration—for example, grant an agent access only to portals or only to databases. You can read more about configuring the FuseBase Gate MCP [here](https://thefusebase.com/guides/fusebase-ai/connect-external-ai-agents-to-fusebase-with-mcp/), and about the setup for FuseBase Dashboards [here](https://thefusebase.com/guides/table-database/connect-ai-agents-to-fusebase-dashboards-with-mcp/).
-   You can also add custom MCPs or HTTP connections to other services (Airtable, Asana, Linear, etc.).

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20475'%3E%3C/svg%3E)

4) If you choose a custom MCP, please specify the authentication type. Different services may offer different options (most commonly a Bearer token or OAuth).

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20486'%3E%3C/svg%3E)

If you selected an HTTP integration, please also specify the URL and token. You can test the MCP connection immediately. To do this, click on Test connection.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20493'%3E%3C/svg%3E)

5) Next, specify the level at which the integration will operate: for all agents or for a specific agent.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20492'%3E%3C/svg%3E)

After making your selection, click Add to activate the integration.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20976'%3E%3C/svg%3E)

If the authentication type is OAuth, click Authorize to connect the MCP.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20913'%3E%3C/svg%3E)

Next, the integration will appear in the list. If needed, you can change its permissions – for example, make it Shared across the entire organization or restrict it.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20496'%3E%3C/svg%3E)

Unnecessary integrations can be removed by clicking Delete.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20482'%3E%3C/svg%3E)

## Using MCP Integrations in Agents [#](#4-toc-title)

Once you add an MCP integration, it is automatically activated in the adapters and you can use it when creating tasks in agents.

You can simply mention the service you integrated, and the agent will automatically identify the correct MCP. For example, if you connected the FuseBase MCP, you can specify: “Create a database in FuseBase” or “Create a page in FuseBase in the Test workspace with the research results,” and so on.
