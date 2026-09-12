---
title: "Webhooks in FuseBase Apps: Quick Guide"
url: "https://thefusebase.com/guides/fusebase-vibe-code/webhooks-in-fusebase-apps-quick-guide/"
section: "fusebase-vibe-code"
lastScraped: "2026-09-12T05:17:45.381Z"
---

# Webhooks in FuseBase Apps: Quick Guide

A webhook lets your FuseBase app send or receive data in real time.

A webhook is triggered when something happens. For example:

-   a payment is completed
-   a form is submitted
-   a file is uploaded
-   a deal stage changes
-   an approval is finished

In simple words, webhooks let your app **react immediately**.

## Why use webhooks? [#](#0-toc-title)

Webhooks are useful when you want your FuseBase app to respond **right away**, instead of waiting for a schedule.

They help you:

-   connect with outside tools
-   receive live updates
-   trigger actions instantly
-   send data to other systems
-   power real-time workflows

## Common use cases [#](#1-toc-title)

### 1\. Payment events [#](#2-toc-title)

When Stripe sends a payment event, update the app and mark the order as paid.

### 2\. Form submissions [#](#3-toc-title)

When an external (Typeform for example) form is submitted, create a new record and start a workflow.

### 3\. File processing [#](#4-toc-title)

When a new file is uploaded, trigger a parser or AI extraction flow.

### 4\. CRM changes [#](#5-toc-title)

When a deal moves to a new stage in CRM, launch a follow-up process.

### 5\. Notifications to other tools [#](#6-toc-title)

When something is approved, send a webhook to another platform.

### 6\. AI agent endpoints [#](#7-toc-title)

Expose an endpoint so another system can send a request to your app and get a response.

### 7\. Integrations with other services [#](#8-toc-title)

For example, you can set up automations triggered by events in other services (such as when a task is created in Asana and a new row is added to the Fuseabase database).

## Two ways webhooks are useful [#](#9-toc-title)

### Incoming webhooks [#](#10-toc-title)

Your app **receives data** from another tool.

Example: Stripe, HubSpot, Shopify, or another service sends data into your app.

### Outgoing webhooks [#](#11-toc-title)

Your app **sends data** to another tool.

Example: Your app sends an event to Slack, Zapier, or a custom endpoint after something happens.

Working with webhooks is handled in the same way as adding any other functionality to your apps: you either describe the desired actions and the AI determines that a webhook needs to be added, or you specify it directly as part of the prompt.

## Example prompt ideas [#](#12-toc-title)

-   When someone submits a form, create a new record.
-   When a payment comes in from Stripe, mark the invoice as paid.
-   When a file is uploaded, start reading and processing it.
-   When an approval is completed, send a notification to another system.
-   When data comes in from another tool, save it to the database.
-   When a new customer signs up, create a client record, start onboarding, and send a welcome message.
-   When a request is marked as completed, send all the details to another system.
-   When a file is uploaded, get the file, extract the data with AI, and save the results back to the database.
-   etc
