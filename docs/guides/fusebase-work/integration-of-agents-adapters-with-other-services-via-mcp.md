---
title: "Integration of agents/adapters with other services via MCP"
url: "https://thefusebase.com/guides/fusebase-work/integration-of-agents-adapters-with-other-services-via-mcp"
section: "fusebase-work"
lastScraped: "2026-09-15T04:45:06.452Z"
---

# Integration of agents/adapters with other services via MCP

[Back to FuseBase Work](/guides/fusebase-work)

FuseBase Work

# Integration of agents/adapters with other services via MCP

What is MCP? MCP (Model Context Protocol) is a technology that lets our agents connect and work with your favorite apps and services.Think of it as a universal remote: instead of...

Guide details

Published

June 21, 2026

Read time

3 min read

Category

FuseBase Work

In this guide

1.  [What is MCP?](#0-toc-title)
2.  [Adapters already work with MCP – why do I need additional configuration?](#1-toc-title)
3.  [FuseBase MCP](#2-toc-title)
4.  [Adding an MCP/HTTP integration](#3-toc-title)
5.  [Using MCP Integrations in Agents](#4-toc-title)

## **What is MCP?**

MCP (Model Context Protocol) is a technology that lets our agents connect and work with your favorite apps and services.  
Think of it as a universal remote: instead of switching between different tools, you can manage everything right from your agent – quickly and easily.

MCP isn’t just about connecting to other services. It actually expands what your agent can do!  
With MCP, your agent can:

-   Generate diagrams for reports or presentations
-   Create videos and images automatically
-   Analyze data and build visual dashboards
-   etc

So, MCP turns your agent into a powerful assistant that not only connects your apps, but also brings new creative and productive features – helping you get more done, in less time.

## Adapters already work with MCP – why do I need additional configuration?

Yes, our adapters such as Cursor, Codex, and Hermes already have built-in MCP functionality. However, our implementation offers several advantages:

-   A single management point for all integrations at the organizational level. If you use both Codex and Claude, you don’t need to configure integrations for each adapter individually—everything can be set up in one place for all adapters at once.
-   You can configure integration access permissions. For example, you can make certain integrations available to all agents in the organization, while others can be restricted to specific agents only.

## FuseBase MCP

By default, we automatically set up MCP for Fusebase, which allows you to manage your organization through FuseBase Work. Specifically, you can:

-   create workspaces, folders, and pages;
-   edit pages;
-   create and edit portals;
-   create and edit databases;
-   etc.

MCP is enabled by default for the default CEO agent with full access to your organization. For new agents, you’ll need to activate FuseBase manually with the permissions you require.

## Adding an MCP/HTTP integration

1) Go to the Integrations section.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/06/image-28-1024x492.png)

2) Click on Add Integration.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/06/image-29-1024x510.png)

3) You have several integration options:

-   Custom integrations with FuseBase. As mentioned above, the default agent already has the FuseBase integration enabled by default. However, you can add a custom integration—for example, grant an agent access only to portals or only to databases. You can read more about configuring the FuseBase Gate MCP [here](/guides/fusebase-ai/connect-external-ai-agents-to-fusebase-with-mcp), and about the setup for FuseBase Dashboards [here](/guides/table-database/connect-ai-agents-to-fusebase-dashboards-with-mcp).
-   You can also add custom MCPs or HTTP connections to other services (Airtable, Asana, Linear, etc.).

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/06/image-30-1024x475.png)

4) If you choose a custom MCP, please specify the authentication type. Different services may offer different options (most commonly a Bearer token or OAuth).

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/06/image-31-1024x486.png)

If you selected an HTTP integration, please also specify the URL and token. You can test the MCP connection immediately. To do this, click on Test connection.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/06/image-32-1024x493.png)

5) Next, specify the level at which the integration will operate: for all agents or for a specific agent.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/06/image-35-1024x492.png)

After making your selection, click Add to activate the integration.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/06/image-34-1024x976.png)

If the authentication type is OAuth, click Authorize to connect the MCP.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/06/image-33-1024x913.png)

Next, the integration will appear in the list. If needed, you can change its permissions – for example, make it Shared across the entire organization or restrict it.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/06/image-36-1024x496.png)

Unnecessary integrations can be removed by clicking Delete.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/06/image-37-1024x482.png)

## Using MCP Integrations in Agents

Once you add an MCP integration, it is automatically activated in the adapters and you can use it when creating tasks in agents.

You can simply mention the service you integrated, and the agent will automatically identify the correct MCP. For example, if you connected the FuseBase MCP, you can specify: “Create a database in FuseBase” or “Create a page in FuseBase in the Test workspace with the research results,” and so on.
