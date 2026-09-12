---
title: "FuseBase Apps – Quick Guide"
url: "https://thefusebase.com/guides/fusebase-vibe-code/fusebase-apps-quick-guide/"
section: "fusebase-vibe-code"
lastScraped: "2026-09-12T05:17:54.708Z"
---

# FuseBase Apps – Quick Guide

FuseBase AI Apps removes all limitations on expanding functionality. Don’t like the current look of the tables? Create your own as you wish. Need a specific dashboard? Build it yourself. Looking for a ticketing system or onboarding process? No problem – just 10 minutes and it’s ready.

A couple of prompts, 10–15 minutes of waiting, and the functionality you need is ready for use.

Want to use AI apps outside of FuseBase? No problem – just make the app public and share the link with your clients and partners.

To start, here is a short video that provides an overview of how FuseBase AI apps work and how to create them –

[Embedded content](about:blank)

Now let’s take a closer look at the structure of apps and how to start implementing them.

## What are Product (and why they matter) [#](#b52957337_10)

An **Product** in FuseBase is a **complete solution** that runs on top of your FuseBase infrastructure (databases, permissions, etc).

Think of an Product as a **packaged product** you can generate, configure, share, and reuse – without shipping one-off features inside the core product every time users ask for something new.

### Why Products exist [#](#b52957337_432)

Products let you:

-   **Ship faster**: generate a working solution in minutes, not weeks.
-   **Avoid product bloat**: instead of adding every requested feature to the core product, you generate purpose-built apps.
-   **Stay consistent & secure**: apps inherit the same backend primitives—access control, auditability, data model.
-   **Scale through distribution**: apps can be shared, cloned, sold, and installed by others (marketplace/resellers/agencies).

## What are Apps (and why they matter) [#](#b52957337_1712)

A **App** is a **building block inside an Product**.

### Why Apps exist [#](#b52957337_2006)

Apps let you:

-   **Compose apps instead of hardcoding**: apps become modular, not monolithic.
-   **Toggle and tailor**: turn features on/off depending on the customer’s workflow.
-   **Reuse across apps**: the same “Approvals” feature can power Requests, Ticket System, Legal Intake, Real Estate transactions, etc.
-   **Upgrade safely**: features can version independently and evolve without breaking the entire app.

### Common Apps types [#](#b52957337_2488)

-   **Collection features**: forms, file requests, confirmations
-   **Workflow features**: approvals, SLAs, escalations
-   **Views**: kanban, dashboards, filtered lists, reports
-   **Automation/agent features**: parsing, enrichment, follow-up drafting, routing logic
-   **Portal features**: client-facing upload, status page, downloads, Q&A

## What can and cannot be done in the current version of Vibe Coding [#](#5-toc-title)

At the moment, our Vibe Coding module is designed for creating frontend apps with a simple backend based on our databases. For more details about our databases, please refer to: [https://thefusebase.com/guides/table-database/](https://thefusebase.com/guides/table-database/)

The apps you create can both save data to the databases and retrieve data from them (i.e., the database can serve as a data source).

Examples of apps you can create include: portals, landing pages, form generators and onboarding flows (with the ability to view results), dashboards and reports, additional views for tables, and more.

In upcoming CLI versions, more features will be added, including working with portals, Email API, automations, and more. Full backend capabilities will also be introduced, enabling more complex integrations and allowing you to build more advanced apps.

## Who can create and deploy apps? [#](#6-toc-title)

At the moment, users with the following roles can create and deploy apps:

-   Owner
-   Manager
-   Workspace admins

## Let’s create our first product and app [#](#7-toc-title)

To get started, you need to install the FuseBase CLI. You can do this via the plugin or download the FuseBase CLI directly.

The **plugin** is the easiest option. You work fully through a normal AI chat in **Claude Code** or **Codex**. You describe what you want to build, and the plugin handles the app creation flow for you.

The **CLI setup** is also simple. You only need to run a few basic commands at the beginning, such as initializing the FuseBase product. After that, most of the work still happens through AI chat. This option is best if you use another IDE or assistant, such as **Cursor**, **OpenCode**, or your own coding environment.

Both options create the same Fusebase Apps. The difference is only how you start and control the process.

## Set up with a Plugin [#](#8-toc-title)

The plugin is the easiest way to create Fusebase Apps. You can work directly through AI chat: describe what you want to build, ask for changes, and let the plugin guide the app creation process.

Start with the video for the tool you use:

### Claude Code setup [#](#9-toc-title)

Watch this video if you want to create Fusebase Apps using the plugin in Claude Code.

[Embedded content](about:blank)

### Codex setup [#](#10-toc-title)

Watch this video if you want to create Fusebase Apps using the plugin in Codex.

[Embedded content](about:blank)

You can also follow the step-by-step setup guide below. The guide is written using Claude Code as an example, but it applies similarly to Codex overall.

1) Open your Claude Code

2) Go to the Code tab

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20416'%3E%3C/svg%3E)

3) Click the + icon

4) Click Add Plugins

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20907'%3E%3C/svg%3E)

5) Click +

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20566'%3E%3C/svg%3E)

6) Select Add from repository

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20610'%3E%3C/svg%3E)

7) Add **fusebase-dev/agent-plugins** to the input field and click Sync.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20582'%3E%3C/svg%3E)

8) Next, click the + to complete the plugin setup.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20559'%3E%3C/svg%3E)

The setup is complete, and you can start creating apps.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20398'%3E%3C/svg%3E)

Simply provide the app description in the chat, and it will be implemented. All work will take place directly in the chat. If the CLI isn’t installed, it will prompt you to authenticate.

**Set up with the CLI**

### For other IDEs, you can use our standard CLI. You can download the CLI using this link – [https://ai-dev.thefusebase.com/how-it-works](https://ai-dev.thefusebase.com/how-it-works) [#](#11-toc-title)

Once you have downloaded it, launch the installer and wait for the installation to complete.

Unlike the plugin, after setting up the CLI, some commands will need to be entered in the terminal (as a reminder, with the plugin all work can be done through the chat).

### Step 1. Log in to FuseBase [#](#8-toc-title)

1) Open your favorite IDE (for example, Cursor or Claude Code) and go to the terminal.

We recommend creating a separate folder or project for each app.

2) In the terminal, enter **fusebase init**. First, you will need to log in to FuseBase. A browser window will open automatically for authorization. You will only need to authorize once.

### Step 2. Creating an product in FuseBase [#](#9-toc-title)

Next, select organization where the app will be created.

Next, specify the name of the product. For example, if you are creating a ticketing system, enter “Tickets”. Depending on the product name, the app name and its subdomain will be created, and you can always change them later.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20704'%3E%3C/svg%3E)

That’s it – you can now start creating your own products in FuseBase.

### Step 3. Creating a App [#](#10-toc-title)

Next, you can create the app or apps you need. To do this, you can use any AI chat tool in your IDE, such as Claude Code, Copilot, and others. Simply describe what you need.

For example, simply write something like:

**I need a ticketing system that includes an admin side for managing tickets and a client side where clients can create tickets.** **Create a new database for the ticketing system. Only organization managers will have access to the admin section, while clients will have access to the client section.**

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20480'%3E%3C/svg%3E)

Next, the AI will begin creating the feature. If necessary, please answer any questions that may arise during the process.

## App Testing [#](#15-toc-title)

After the AI implements the feature, you can test it locally. This can be done easily by entering “Open dev server” or “Open local server”.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20475'%3E%3C/svg%3E)

Next, your browser will open, where you can test the functionality that has been implemented.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20367'%3E%3C/svg%3E)

If something isn’t working or you’re not satisfied with a certain aspect, you can immediately mention it in the chat. The AI will fix the issue or make improvements.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20476'%3E%3C/svg%3E)

## App Publishing [#](#16-toc-title)

If you are satisfied with the results, you can submit the feature and its changes to FuseBase. To do this, simply type deploy or publish in the chat.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20591'%3E%3C/svg%3E)

After a successful deployment, you will see links to the apps. By following these links, you can view your apps.

You can also view your products and apps in the Products section. By clicking Launch, you can start them.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20310'%3E%3C/svg%3E)

## Sharing Products and Apps [#](#17-toc-title)

In FuseBase, you can create apps that are either internal or public. Internal features can be used within your organization and are accessible only to organization members.

Public apps are accessible to anyone who knows the feature URL, including anonymous visitors.

Within a single product, you can use both public and private apps simultaneously. For example, if you are generating forms, the builder and the results viewer can be internal app, while the forms themselves can be public apps available to all visitors.

You can make a app public or private during its implementation—just specify in the prompt, for example: “I want this functionality to be available to everyone.”

You can also change a app to public or private after implementation through the Products section.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20330'%3E%3C/svg%3E)

## Products Section (list of apps in the web client) [#](#18-toc-title)

In the Products section, you can view all the products and apps implemented by you and your team.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20317'%3E%3C/svg%3E)

Here you can:

1) Launch apps

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20311'%3E%3C/svg%3E)

2) View the databases/tables used by the apps

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20322'%3E%3C/svg%3E)

3) Make a feature private or public

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20323'%3E%3C/svg%3E)

4) Copy the link to a app

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20311'%3E%3C/svg%3E)

5) Rename or Delete an product with its apps or just a specific app –

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20316'%3E%3C/svg%3E)

## Best Practices & FAQ [#](#19-toc-title)

### Do I need to know programming to create products? [#](#20-toc-title)

No! You just need to install any popular IDE (for example, Cursor) and FuseBase CLI. It’s very simple and does not require technical skills. Then, you simply specify the type of product you need (for example, a ticketing system or file manager), and the AI agents will handle everything for you.

### Is it possible to grant access to a app to specific roles? [#](#21-toc-title)

Absolutely! For example, consider a ticketing system where there is a ticket management feature and a client-facing feature – creating and viewing tickets. Access to ticket management can be granted only to organization managers, while ticket creation can be available to any members and clients.

This is done using standard prompts. When creating a feature, simply instruct the agent: “Only organization managers can access this feature,” or, for example, “All members except clients can access this feature,” and so on.

You can read more about roles here: [https://thefusebase.com/guides/getting-started/key-role-differences/](https://thefusebase.com/guides/getting-started/key-role-differences/)

### Do I need to install anything else besides the CLI? [#](#22-toc-title)

No, there is nothing else you need to install besides the CLI. All essential components, including core packages like NodeJS, are already included. If your product requires any additional libraries, the AI agent will prompt you to install them, and you will just need to confirm.

### Detailed Functional Description [#](#23-toc-title)

For the AI, it is important to provide as detailed a description of the functionality you want as possible. Yes, you can simply write something like “I want a CRM” or “I want an onboarding flow” and the AI will create such functionality, but the result may not fully meet your expectations the first time.

To save you from having to write everything yourself, we have created a special agent called **AI agent for enhancing prompts in Vibe Coding** (you can find it in your list of agents).

With this agent, you simply describe what you need, answer a few follow-up questions, and as a result, you will receive a complete technical specification that will help you effectively implement exactly what you need.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20630'%3E%3C/svg%3E)

### Use Plan Mode [#](#24-toc-title)

If you are building a complex app, we highly recommend starting with Plan mode. Yes, it will take more time and use more tokens, but it will allow you to plan the feature more thoroughly and achieve better results. This way, you’ll spend less time on revisions – or possibly avoid them altogether.

### Which models should you use? [#](#25-toc-title)

During app development, you can use different models depending on the stage of development. For planning or complex features, you can use advanced models such as Claude Opus 5 or GPT 5.5. For simpler tasks, you can use models like Haiku or more cost-effective options like GLM/Kimi. FuseBase provides a CLI with ready-made components, so you don’t need to develop everything from scratch. This means you can build apps even with fairly standard models. However, we recommend starting with more powerful models and, over time, evaluating which model works best for your needs.
