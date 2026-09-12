---
title: "Working with Portals in the CLI: Quick Guide"
url: "https://thefusebase.com/guides/fusebase-vibe-code/working-with-portals-in-the-cli-quick-guide/"
section: "fusebase-vibe-code"
lastScraped: "2026-09-12T05:17:41.530Z"
---

# Working with Portals in the CLI: Quick Guide

Fusebase CLI supports working with portals. This means you can create, manage, duplicate, and update client portals directly from the CLI — and your apps can also work with portals as part of their workflow.

Instead of setting everything up manually, you can now use simple prompts and CLI commands to:

-   view organization portals
-   create new portals
-   duplicate existing portals
-   invite clients to portals
-   invite portal managers
-   connect apps with client-facing portal workflows

## What apps can do with portals [#](#0-toc-title)

You can not only manage portals via the CLI, but also add this functionality to your apps. Apps can:

-   show existing portals in your organization
-   create new portals
-   duplicate existing portals
-   invite clients to portals
-   invite portal managers
-   connect portal setup with onboarding, sales, delivery, support, or payment workflows

# Common Cases [#](#1-toc-title)

## 1\. Client onboarding app [#](#2-toc-title)

Create an app that automatically sets up a portal for every new client.

The app can:

-   collect client details through an intake form
-   create a new portal
-   duplicate your onboarding portal template
-   invite the client
-   invite the account manager
-   add file requests, forms, or next steps

**Example:** A client submits an onboarding form, and the app creates a dedicated onboarding portal for them automatically.

## 2\. Agency client portal app [#](#3-toc-title)

Create an app for agencies that need to launch many client portals.

The app can:

-   ask for client name, email, and project type
-   duplicate the right portal template
-   rename the portal for the client
-   invite the client team
-   invite the internal project manager

**Example:** A marketing agency uses one app to create a new branded portal for every new client.

## 3\. Paid access portal app [#](#4-toc-title)

Create an app that gives portal access after payment.

The app can:

-   check payment status
-   create or select the right portal
-   invite the customer
-   add the customer to the correct service space
-   notify the internal team

**Example:** A customer pays for a service through Stripe, and the app automatically gives them access to the correct client portal.

## 4\. Project portal app [#](#5-toc-title)

Create an app that launches a portal for each new project.

The app can:

-   collect project details
-   create a project portal
-   invite client stakeholders
-   invite the project manager

**Example:** A consulting team starts a new project and instantly creates a shared client-facing workspace.

## 5\. Real estate transaction portal app [#](#6-toc-title)

Create an app that sets up a portal for each property transaction.

The app can:

-   collect buyer, seller, agent, and property details
-   create a transaction portal
-   invite the right people
-   add document request flows
-   connect approvals and closing checklists

**Example:** A new real estate deal is created, and the app launches a transaction room with all required participants.

## 6\. Support or service portal app [#](#7-toc-title)

Create an app that gives clients access to a support or service portal.

The app can:

-   create a portal for a new service client
-   invite the customer
-   invite the support manager
-   connect ticket forms, status dashboards, and service reports

**Example:** A managed service provider creates a portal where each client can submit requests, track progress, and access reports.

## 7\. Franchise or reseller portal app [#](#8-toc-title)

Create an app for partners, resellers, or franchise clients.

The app can:

-   create a portal for each partner
-   duplicate the correct partner portal template
-   invite partner users
-   invite internal partner managers
-   connect training materials, documents, dashboards, and support flows

**Example:** A reseller signs up, and the app automatically creates their partner portal with onboarding steps and resources.

## 8\. Multi-portal setup app [#](#9-toc-title)

Create an app that helps teams create many portals at once.

The app can:

-   show existing organization portals
-   let the user choose a template
-   create multiple portals from a list
-   invite clients and managers
-   track which portals were created successfully

**Example:** An agency uploads a list of 20 clients, and the app creates 20 portals based on the same template.

# How can portal functionality be added to apps ? [#](#10-toc-title)

This can also be done through prompts. You simply instruct your agent on what exactly you want to add to your applications, and it will be implemented accordingly.

# Prompt Examples [#](#11-toc-title)

-   **Create an app that creates a new client portal and invites the client.**
-   **Create an app that duplicates an existing portal template for a new customer.**
-   **Create an app that shows all portals in my organization and lets me select one.**
-   **Create an app that invites a client to a selected portal.**
-   **Create an app that invites an internal team member as a portal manager.**
-   **Create a client onboarding app that collects client details, creates a portal, invites the client, and assigns the account manager.**
-   **Create an app that duplicates the “Client Onboarding Template” portal for every new client.**
-   **Create an app that creates a portal after an onboarding form is submitted.**
-   **Create an app that duplicates our standard agency client portal and invites the project manager.**
-   **Create an app that creates a portal for each new agency client and connects it with request forms and approval flows.**
-   **Create an app that creates client portal after Stripe payment is completed.**
-   **Create an app that gives portal access only after the invoice is paid.**
-   **Create an app that creates a portal for every new consulting project.**
-   **Create an app that creates a partner portal for every new reseller.**
-   **Create an app that creates a franchise portal with training materials, support flows, and internal manager access.**
