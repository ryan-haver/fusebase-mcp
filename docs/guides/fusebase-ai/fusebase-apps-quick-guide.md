---
title: "FuseBase Apps – Quick Guide"
url: "https://thefusebase.com/guides/fusebase-ai/fusebase-apps-quick-guide/"
section: "fusebase-ai"
lastScraped: "2026-02-28T21:27:13.956Z"
---

# FuseBase Apps – Quick Guide

Fusebase AI Apps removes all limitations on expanding functionality. Don’t like the current look of the tables? Create your own as you wish. Need a specific dashboard? Build it yourself. Looking for a ticketing system or onboarding process? No problem – just 10 minutes and it’s ready.

A couple of prompts, 10–15 minutes of waiting, and the functionality you need is ready for use.

Want to use AI apps outside of Fusebase? No problem—just make the app public and share the link with your clients and partners.

Now let’s take a closer look at the structure of apps and how to start implementing them.

## What are Apps (and why they matter) [#](#b52957337_10)

An **App** in Fusebase is a **complete solution** that runs on top of your Fusebase infrastructure (databases, permissions, etc).

Think of an App as a **packaged product** you can generate, configure, share, and reuse – without shipping one-off features inside the core product every time users ask for something new.

### Why Apps exist [#](#b52957337_432)

Apps let you:

-   **Ship faster**: generate a working solution in minutes, not weeks.
-   **Avoid product bloat**: instead of adding every requested feature to the core product, you generate purpose-built apps.
-   **Stay consistent & secure**: apps inherit the same backend primitives—access control, auditability, data model.
-   **Scale through distribution**: apps can be shared, cloned, sold, and installed by others (marketplace/resellers/agencies).

## What are Features (and why they matter) [#](#b52957337_1712)

A **Feature** is a **building block inside an App**.

If an App is the “product”, Features are the “modules” that make it useful: one Feature might be a file request flow, another might be approvals, another might be a kanban view.

### Why Features exist [#](#b52957337_2006)

Features let you:

-   **Compose apps instead of hardcoding**: apps become modular, not monolithic.
-   **Toggle and tailor**: turn features on/off depending on the customer’s workflow.
-   **Reuse across apps**: the same “Approvals” feature can power Requests, Ticket System, Legal Intake, Real Estate transactions, etc.
-   **Upgrade safely**: features can version independently and evolve without breaking the entire app.

### Common Feature types [#](#b52957337_2488)

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

Below is a brief diagram illustrating how apps and features work in conjunction with the database.

![](https://thefusebase.com/wp-content/uploads/2026/02/Untitled-Diagram-1024x342.png)

## Let’s create our first app and feature [#](#6-toc-title)

### Step 1. Download and install the CLI, which will help us work magic [#](#7-toc-title)

To create apps in Fusebase, you need to download our CLI (command line interface). CLI is a plugin that can be installed as part of your favorite IDE (Integrated Development Environment). You can use our CLI in the most popular IDEs currently available:

-   [VS Code](https://code.visualstudio.com/)
-   [Cursor](https://cursor.com/)
-   [Claude Code](https://claude.com/product/claude-code)
-   [OpenCode](https://opencode.ai/)
-   [Codex](https://chatgpt.com/codex)
-   [Antigravity](https://antigravity.google/) and others

Of course, we are not planning to limit ourselves to just the CLI. We will soon be launching a web version and a standalone desktop application.

You can download the CLI using this link – https://thefusebase.com/

Once you have downloaded it, launch the installer and wait for the installation to complete.

### Step 2. Log in to Fusebase [#](#8-toc-title)

1) Next, open your favorite IDE (for example, Cursor or Claude Code) and go to the terminal.

We recommend creating a separate folder or project for each app.

2) In the terminal, enter **fusebase init**. First, you will need to log in to Fusebase. A browser window will open automatically for authorization. You will only need to authorize once.

### Step 3. Creating an app in Fusebase [#](#9-toc-title)

Next, select your IDE (for example, Claude Code) and the organization where the app will be created.

![](https://thefusebase.com/wp-content/uploads/2026/02/image-7-1024x385.png)

Next, specify the name of the app and its subdomain. For example, if you are creating a ticketing system, enter “Tickets” as the name and “tickets” as the subdomain. Accordingly, the app URL will be tickets.nimbusweb.me.

![](https://thefusebase.com/wp-content/uploads/2026/02/image-8-1024x416.png)

That’s it – you can now start creating your own apps in Fusebase.

### Step 4. Creating a Feature [#](#10-toc-title)

Next, you can create the feature or features you need. To do this, you can use any AI chat tool in your IDE, such as Claude Code, Copilot, and others. Simply describe what you need.

For example, simply write something like:

**I need a ticketing system that includes an admin side for managing tickets and a client side where clients can create tickets.** **Create a new database for the ticketing system. Only organization managers will have access to the admin section, while clients will have access to the client section.**

![](https://thefusebase.com/wp-content/uploads/2026/02/image-10-1024x480.png)

Next, the AI will begin creating the feature. If necessary, please answer any questions that may arise during the process.

### Step 5. Feature Testing [#](#11-toc-title)

After the AI implements the feature, you can test it locally. This can be done easily by entering “Open dev server” or “Open local server”.

![](https://thefusebase.com/wp-content/uploads/2026/02/image-11-1024x475.png)

Next, your browser will open, where you can test the functionality that has been implemented.

![](https://thefusebase.com/wp-content/uploads/2026/02/image-12-1024x367.png)

If something isn’t working or you’re not satisfied with a certain aspect, you can immediately mention it in the chat. The AI will fix the issue or make improvements.

![](https://thefusebase.com/wp-content/uploads/2026/02/image-13-1024x476.png)

### Step 6. Feature Publishing [#](#12-toc-title)

If you are satisfied with the results, you can submit the feature and its changes to Fusebase. To do this, simply type deploy or publish in the chat.

![](https://thefusebase.com/wp-content/uploads/2026/02/image-14-1024x591.png)

After a successful deployment, you will see links to the features. By following these links, you can view your features.

You can also view your apps and features in the Apps section. By clicking Launch, you can start them.

![](https://thefusebase.com/wp-content/uploads/2026/02/image-15-1024x310.png)

### Step 7. Sharing Apps and Features [#](#13-toc-title)

In Fusebase, you can create features that are either internal or public. Internal features can be used within your organization and are accessible only to organization members.

Public features are accessible to anyone who knows the feature URL, including anonymous visitors.

Within a single app, you can use both public and private features simultaneously. For example, if you are generating forms, the builder and the results viewer can be internal features, while the forms themselves can be public features available to all visitors.

You can make a feature public or private during its implementation—just specify in the prompt, for example: “I want this functionality to be available to everyone.”

You can also change a feature to public or private after implementation through the Apps section.

![](https://thefusebase.com/wp-content/uploads/2026/02/image-16-1024x330.png)

## Apps Section [#](#14-toc-title)

In the Apps section, you can view all the apps and features implemented by you and your team.

![](https://thefusebase.com/wp-content/uploads/2026/02/image-17-1024x317.png)

Here you can:

1) Launch features

![](https://thefusebase.com/wp-content/uploads/2026/02/image-18-1024x311.png)

2) View the databases/tables used by the features

![](https://thefusebase.com/wp-content/uploads/2026/02/image-19-1024x322.png)

3) Make a feature private or public

![](https://thefusebase.com/wp-content/uploads/2026/02/image-20-1024x323.png)

4) Copy the link to a feature

![](https://thefusebase.com/wp-content/uploads/2026/02/image-21-1024x311.png)

5) Rename or Delete an app with its features or just a specific feature

![](https://thefusebase.com/wp-content/uploads/2026/02/image-22-1024x316.png)

## Best Practices and Tips [#](#15-toc-title)

### Detailed Functional Description [#](#16-toc-title)

For the AI, it is important to provide as detailed a description of the functionality you want as possible. Yes, you can simply write something like “I want a CRM” or “I want an onboarding flow” and the AI will create such functionality, but the result may not fully meet your expectations the first time.

To save you from having to write everything yourself, we have created a special agent called **AI agent for enhancing prompts in Vibe Coding** (you can find it in your list of agents).

With this agent, you simply describe what you need, answer a few follow-up questions, and as a result, you will receive a complete technical specification that will help you effectively implement exactly what you need.

![](https://thefusebase.com/wp-content/uploads/2026/02/image-23-1024x630.png)

### Use Plan Mode [#](#17-toc-title)

If you are building a complex feature, we highly recommend starting with Plan mode. Yes, it will take more time and use more tokens, but it will allow you to plan the feature more thoroughly and achieve better results. This way, you’ll spend less time on revisions—or possibly avoid them altogether.

### Which models should you use? [#](#18-toc-title)

During feature development, you can use different models depending on the stage of development. For planning or complex features, you can use advanced models such as Claude Opus 4.6 or GPT 5.3. For simpler tasks, you can use models like Haiku or more cost-effective options like GLM/Kimi. Fusebase provides a CLI with ready-made components, so you don’t need to develop everything from scratch. This means you can build apps even with fairly standard models. However, we recommend starting with more powerful models and, over time, evaluating which model works best for your needs.
