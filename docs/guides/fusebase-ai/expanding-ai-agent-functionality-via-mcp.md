---
title: "Expanding AI Agent functionality via MCP"
url: "https://thefusebase.com/guides/fusebase-ai/expanding-ai-agent-functionality-via-mcp/"
section: "fusebase-ai"
lastScraped: "2026-02-28T21:27:14.118Z"
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

[Embedded content](https://www.youtube.com/embed/2EzxXSMfGcE?feature=oembed)

## Connecting a recommended MCP [#](#1-toc-title)

In our agents, you can connect both pre-installed MCPs and MCPs from external sources. By default, FuseBase already includes MCPs for many popular services: Airtable, Google Sheets, Notion, etc.

1) When setting up an agent, go to Integrations.

2) Select the required integration, for example Airtable.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-36-1024x575.png)

3) Next, you need to choose the type of authorization:

**User Auth** – use this if you want each user to connect to the service with their own account. A great option for public agents or when you connect services to the agent where personal accounts are important: calendars, emails, project management services, etc.

**Org Auth** – use this type if you want all users to connect through the account you specified. A great option, for example, for knowledge bases or CRMs – all team members will have unified access to the service.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-38.png)

4) If you selected **Org Auth**, you can either log in to your service account or choose from an existing connection.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-39.png)

If you selected **User Auth**, then when opening the agent, users will first need to connect to the service.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-40-1024x580.png)

5) Later, you can change the connection type through the integrations menu or, for example, connect a different account if you chose Org Auth.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-41-1024x581.png)

## Connecting MCP from an external source [#](#2-toc-title)

In this guide, we will show how to connect MCP with the well-known service Huggingface, and also how to generate images via MCP.

1) First, go to the Hugging Face website. Hugging Face is a popular online platform and community for AI and Machine Learning. It provides easy access to thousands of ready-to-use AI models (for text, images, audio, etc.), tools for building your own models, and a space to collaborate with other users.

2) Next, go to the page with MCP servers – [https://huggingface.co/spaces?filter=mcp-server](https://huggingface.co/spaces?filter=mcp-server). All these servers are created by Hugging Face users. You can also create your own MCP server on this platform.

3) Since we’re interested in image generation, click on the corresponding category. Choose one of the options, for example, SDXL.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-23-1024x538.png)

4) Scroll down and select Use API or MCP.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-24-1024x541.png)

5) In the pop-up window, choose MCP and copy the link.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-25-1024x537.png)

6) Next, create a new agent in FuseBase or go to edit an existing one. In the Integrations section, paste the copied MCP URL into the appropriate field, enter the server name, and click Connect.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-26-1024x500.png)

7) Next, you can go to the chat and test the MCP service in action. For example, ask it to generate an image of a summer garden.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-27-1024x563.png)
