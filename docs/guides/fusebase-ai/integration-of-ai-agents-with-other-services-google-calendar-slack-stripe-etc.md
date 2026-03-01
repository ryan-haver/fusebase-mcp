---
title: "Integration of AI agents with other services (Google Calendar, Slack, Stripe, etc.)"
url: "https://thefusebase.com/guides/fusebase-ai/integration-of-ai-agents-with-other-services-google-calendar-slack-stripe-etc/"
section: "fusebase-ai"
lastScraped: "2026-02-28T21:27:17.162Z"
---

# Integration of AI agents with other services (Google Calendar, Slack, Stripe, etc.)

Our agents not only allow you to search the Internet, your knowledge base, or generate new content, but also fully integrate with the services you use. This way, our agents become a true personal intelligent assistant, enabling you to easily automate your everyday tasks.

For example, you can send research results to Slack, book meetings in your calendar, create invoices in Stripe, and much more. And all of this without complex interfaces or configurations. You simply give a command, and our agent understands and executes it. Integrations are implemented through a new innovative protocol – MCP (Model Context Protocol).

## **What is MCP?** [#](#0-toc-title)

MCP is a special “language” that helps AI agents talk to other services like Google Calendar, Airtable, or Stripe.

**Why is it useful for you?**

-   You don’t need to open 10 different apps — your AI agent can do it for you.
-   Just tell the agent what you want: “Book a meeting,” “Send this to Slack,”, “Make an invoice” or “Create a task”.
-   The agent understands and takes action right away.

**In short:** MCP makes AI agent smarter — it can not only answer questions, but also *do things* for you.

## Connecting Integrations to Your Agent [#](#1-toc-title)

Once you’ve created an agent, you can connect it to the service integration you need. Let’s start with a bit of terminology:

**Integration** – these are the services you connect, such as Google Drive, Slack, or Airtable.

**Tool** – this is a part of the integration or a specific action the integration performs. For example, creating a calendar event, sending a message to a Slack channel, or creating a new table are all tools from different integrations. Tools are important for controlling your agents – for instance, you can allow an agent to create tables in Airtable but forbid it from modifying or deleting rows in databases.

In FuseBase, you can choose from existing integrations or add your own by entering the MCP server address (we’ll show you how to do that below). You can also contact our support team if you need a custom integration – [https://thefusebase.com/support/](https://thefusebase.com/support/)

Now let’s connect a ready-made integration to your agent. For example, let’s connect Google Calendar.

1) Go to edit your agent and click on the **Integrations** tab.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-1-1024x419.png)

![](https://thefusebase.com/wp-content/uploads/2025/06/image-2-1024x703.png)

2) Find Google Calendar in the list.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-3-1024x739.png)

3) Click **Authorize/Connect** and sign in to your Google account (don’t worry – it’s safe, and our service does not access your personal data).

That’s it! Your calendar is now connected to your agent. After connecting, you’ll see the service tools (what it can do) and the connected rules (explained below).

![](https://thefusebase.com/wp-content/uploads/2025/06/image-4-1024x997.png)

4) Now let’s try out our integration. It’s important to note that there’s no need to modify the prompt — everything will work as is.

Open your agent and try giving it a command, for example: **“Give me a list of upcoming meetings.”** Or: **“Create an event on Friday at 5 PM called ‘Test Meeting’ and add guest test@example.com.”**

Your agent will understand and carry out the task using the connected calendar.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-5-1024x753.png)

That’s the simplest use case, but there are many more possibilities. For example, you can:

-   Generate summaries of upcoming meetings
-   Connect an integration with Apollo to fetch key data about your guests
-   Create a task in Asana or Todoist
-   Add a new item to an Airtable table
-   Show key values from the latest deals in HubSpot

The potential use cases are vast – it all depends on how you want your agent to support your workflow.

## Rules for MCP Integrations [#](#2-toc-title)

**What Are Rules?**

-   Rules are smart instructions that guide how your agent interacts with third party services.
-   They help standardize responses, automate workflows, and ensure consistency—without the need to repeat yourself.

**How It Works**

-   You create a set of Rules for your integrations.
-   Each Rule tells the agent how to handle specific tasks or formats when working with a service.
-   Once set, these Rules are automatically applied whenever your agent uses that integration.

**Examples of Rules:**

-   Use the UTC time zone for all Google Calendar events.
-   Format pages in Markdown when creating documents in Dropbox Paper.
-   Write emails in an official tone when sending via Gmail.

We also recommend using rules to more precisely specify the projects or databases you plan to work with. For example, you can create a separate rule for Asana and immediately specify the project ID, or if you’re working with Supabase, create a rule and specify the table ID. This will help speed up the agent’s performance and make it more accurate.

**Why Use Rules?**

-   Save time by automating preferences and workflows.
-   Ensure your team’s standards are always followed.
-   Make your agent more predictable and reliable for everyone.

**How to Add New Rules?**

FuseBase makes it easy to manage rules. First, you create a custom set of rules, then apply it to the specific integration you need. For example, you can create one set of rules for calendar integrations, another for your CRM, and so on.

1) To do this, go to the Integrations section and click on Connected rules next to the integration you want to manage.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-6-1024x849.png)

2) Next, click on Manage rules next to Organization rules. (Templates are predefined rule sets created by the FuseBase team, which you can also use).

![](https://thefusebase.com/wp-content/uploads/2025/06/image-7-1024x721.png)

3) Click on Create new rule. Next, enter a name for your rule set and define the actual rules.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-8-838x1024.png)

4) Then, save the rule set.

![](https://thefusebase.com/wp-content/uploads/2025/06/Без-названия.png)

4) After that, click on Connected rules next to the integration you want to configure, and select the rule set you created. You can apply the same rule set to multiple integrations.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-9-1024x979.png)

You can also edit existing rules. To do this, go to Manage rules and find the one you want to update. Then click Edit and modify the rule — for example, by adding new conditions.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-10-801x1024.png)

Important: Any changes you make will automatically apply to all agents where the integration using this rule is active.

## Connecting your own tool or integration [#](#3-toc-title)

In addition to the integrations we provide, you can also connect a third-party integration. Many services offer the ability to use their MCP servers. For example:  
[https://mcp.composio.dev](https://mcp.composio.dev)  
[https://mcp.pipedream.com/](https://mcp.pipedream.com/)  
[https://mcp.zapier.com/](https://mcp.zapier.com/)  
[https://www.activepieces.com/mcp/](https://www.activepieces.com/mcp/)  
and others.

It’s important to note that we cannot guarantee 100% stability of third-party MCP servers. However, this is the fastest and easiest way to connect thousands of integrations to your agents.

1) Now we’ll show you how to connect a third-party service integration using Composio.

2) Open the link [https://mcp.composio.dev/](https://mcp.composio.dev/)

3) Log in or create a new account –

![](https://thefusebase.com/wp-content/uploads/2025/05/image-21-1024x549.png)

4) Then go to [https://mcp.composio.dev/dashboard/apps](https://mcp.composio.dev/dashboard/apps)

5) Find the app you need. For example, I want to quickly create tasks in Todoist through an agent. To do this, I find Todoist in the list of apps and click on “Activate”.

![](https://thefusebase.com/wp-content/uploads/2025/05/image-22-1024x603.png)

6) Next, grant Composio permission to access your Todoist. Don’t worry, it’s absolutely safe.

7) Then, click on Create server and enter its name.

![](https://thefusebase.com/wp-content/uploads/2025/05/image-23-1024x593.png)

8) Next, specify which actions the agent is allowed to perform. For example, you can allow task creation but restrict task deletion. After making your selection, click on Create server.

![](https://thefusebase.com/wp-content/uploads/2025/05/image-24-1024x921.png)

9) Next, you will see a link to the MCP server that you need to copy.

![](https://thefusebase.com/wp-content/uploads/2025/05/image-25-1024x669.png)

10) Next, you need to add the server link to your agent. To do this, open the settings of the agent you want, and go to the Integrations section.

Paste the MCP link and click Add.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-11-1024x492.png)

That’s it — your agent just got better with an additional integration. Now you can create tasks in Todoist or, for example, update them directly from the chat window.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-12-1024x751.png)

Connecting integrations from other services works the same way. If you need any help with the integration, feel free to contact our support team at: [https://thefusebase.com/support/](https://thefusebase.com/support/)
