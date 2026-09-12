---
title: "Create Apps with the Fusebase CLI: Setup Guide"
url: "https://thefusebase.com/guides/fusebase-vibe-code/create-apps-with-the-fusebase-cli-setup-guide/"
section: "fusebase-vibe-code"
lastScraped: "2026-09-12T05:17:41.459Z"
---

# Create Apps with the Fusebase CLI: Setup Guide

## What is the difference between the plugin and the CLI? [#](#b1058932340_141)

To create Fusebase Apps, you use the **Fusebase CLI**. You can use it in two ways:

1.  **With a plugin**
2.  **With the CLI setup**

The **plugin** is the easiest option. You work fully through a normal AI chat in **Claude Code** or **Codex**. You describe what you want to build, and the plugin handles the app creation flow for you.

The **CLI setup** is also simple. You only need to run a few basic commands at the beginning, such as initializing the FuseBase product. After that, most of the work still happens through AI chat. This option is best if you use another IDE or assistant, such as **Cursor**, **OpenCode**, or your own coding environment.

Both options create the same Fusebase Apps. The difference is only how you start and control the process.

## Set up with a Plugin [#](#1-toc-title)

The plugin is the easiest way to create Fusebase Apps. You can work directly through AI chat: describe what you want to build, ask for changes, and let the plugin guide the app creation process.

Start with the video for the tool you use:

### Claude Code setup [#](#2-toc-title)

Watch this video if you want to create Fusebase Apps using the plugin in Claude Code.

[Embedded content](about:blank)

### Codex setup [#](#3-toc-title)

Watch this video if you want to create Fusebase Apps using the plugin in Codex.

[Embedded content](about:blank)

### Prefer written instructions? [#](#4-toc-title)

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

Simply provide the app description in the chat, and it will be implemented. All work will take place directly in the chat. If the CLI isn’t installed, the plugin will prompt you to install it, and if you’re not signed in to FuseBase, it will prompt you to authenticate.

## **Set up with the CLI** [#](#5-toc-title)

For other IDEs, you can use our standard CLI. You can download the CLI using this link – [https://ai-dev.thefusebase.com/how-it-works](https://ai-dev.thefusebase.com/how-it-works)

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

You can find the full guide to creating apps here — [https://thefusebase.com/guides/fusebase-vibe-code/fusebase-apps-quick-guide/](https://thefusebase.com/guides/fusebase-vibe-code/fusebase-apps-quick-guide/)
