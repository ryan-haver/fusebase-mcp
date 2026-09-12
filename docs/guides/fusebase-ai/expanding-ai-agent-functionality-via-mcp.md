---
title: "Expanding AI Agent functionality via MCP"
url: "https://thefusebase.com/guides/fusebase-ai/expanding-ai-agent-functionality-via-mcp/"
section: "fusebase-ai"
lastScraped: "2026-09-12T05:17:37.748Z"
---

# Expanding AI Agent functionality via MCP

## **What is MCP?** [#](#0-toc-title)

MCP (Model Context Protocol) is a technology that lets our [AI agents](https://thefusebase.com/guides/fusebase-ai/ai-agents-quick-guide/) connect and work with your favorite apps and services.  
Think of it as a universal remote: instead of switching between different tools, you can manage everything right from your agent—quickly and easily.

MCP isn’t just about connecting to other services. It actually expands what your agent can do!  
With MCP, your agent can:

-   Generate diagrams for reports or presentations
-   Create videos and images automatically
-   Analyze data and build visual dashboards
-   etc

So, MCP turns your agent into a powerful assistant that not only connects your apps, but also brings new creative and productive features—helping you get more done, in less time.

For those who prefer not to read, here is a short video where we explain how to connect MCP and how it can help expand the capabilities of your agents.

[Embedded content](about:blank)

## Connecting a recommended MCP [#](#1-toc-title)

In our agents, you can connect both pre-installed MCPs and MCPs from external sources. By default, FuseBase already includes MCPs for many popular services: Airtable, Google Sheets, Notion, etc.

1) When setting up an agent, go to Integrations.

2) Select the required integration, for example Airtable.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20575'%3E%3C/svg%3E)

3) Next, you need to choose the type of authorization:

**User Auth** – use this if you want each user to connect to the service with their own account. A great option for public agents or when you connect services to the agent where personal accounts are important: calendars, emails, project management services, etc.

**Org Auth** – use this type if you want all users to connect through the account you specified. A great option, for example, for knowledge bases or CRMs – all team members will have unified access to the service.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20941%20779'%3E%3C/svg%3E)

4) If you selected **Org Auth**, you can either log in to your service account or choose from an existing connection.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201019%20639'%3E%3C/svg%3E)

If you selected **User Auth**, then when opening the agent, users will first need to connect to the service.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20580'%3E%3C/svg%3E)

5) Later, you can change the connection type through the integrations menu or, for example, connect a different account if you chose Org Auth.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20581'%3E%3C/svg%3E)

## Connecting MCP from an external source [#](#2-toc-title)

In this guide, we will show how to connect MCP with the well-known service Huggingface, and also how to generate images via MCP.

1) First, go to the Hugging Face website. Hugging Face is a popular online platform and community for AI and Machine Learning. It provides easy access to thousands of ready-to-use AI models (for text, images, audio, etc.), tools for building your own models, and a space to collaborate with other users.

2) Next, go to the page with MCP servers – [https://huggingface.co/spaces?filter=mcp-server](https://huggingface.co/spaces?filter=mcp-server). All these servers are created by Hugging Face users. You can also create your own MCP server on this platform.

3) Since we’re interested in image generation, click on the corresponding category. Choose one of the options, for example, SDXL.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20538'%3E%3C/svg%3E)

4) Scroll down and select Use API or MCP.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20541'%3E%3C/svg%3E)

5) In the pop-up window, choose MCP and copy the link.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20537'%3E%3C/svg%3E)

6) Next, create a new agent in FuseBase or go to edit an existing one. In the Integrations section, paste the copied MCP URL into the appropriate field, enter the server name, and click Connect.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20500'%3E%3C/svg%3E)

7) Next, you can go to the chat and test the MCP service in action. For example, ask it to generate an image of a summer garden.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20563'%3E%3C/svg%3E)
