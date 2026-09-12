---
title: "FuseBase Automation – Quick Guide"
url: "https://thefusebase.com/guides/automations-and-integrations/fusebase-automation-quick-guide/"
section: "automations-and-integrations"
lastScraped: "2026-09-12T05:16:37.702Z"
---

# FuseBase Automation – Quick Guide

## Explaining FuseBase automation [#](#0-toc-title)

The FuseBase automation module allows you to automate internal processes within FuseBase and integrate them with other services. Here are a couple of automation and integration use cases as examples:

-   You sent an invite to a client in the portal, and a folder with the template you need was automatically created for them in the portal.
-   You added a client to the CRM (e.g., Monday or Leadconnector), and a portal was automatically created for them, and the client was invited to it.

**How to Access the Automation Module**

To access the automation module, click on the corresponding icon in the organization’s navbar:

![](https://thefusebase.com/wp-content/uploads/2024/09/image.png)

**Overview of the Automation Module**

Upon first opening, you will land on the main page of the module:

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201600%20756'%3E%3C/svg%3E)

Let’s walk through the main elements of the automation module:

**Flows**

Here, you will find a list of all automation flows. A flow is the actual automation process. Each flow consists of a trigger that starts the flow and at least one action. For example, if you want to automatically create a record in your CRM when a client is added to the portal, the trigger is the client being added, and the action is creating the CRM record.

**Runs**

Here, you will find a list of all triggered runs and their statuses. Each trigger activation initiates a run. For instance, in the flow “Adding a client to the portal → automatically create a record in your CRM,” if 10 clients are added, the flow will run 10 times, resulting in 10 runs.

**Connections**

Here, you will find a list of services you want to integrate with FuseBase:

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20473'%3E%3C/svg%3E)

To add a new service, click on “New Connections” and select the desired service from the list:

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201124%20563'%3E%3C/svg%3E)

Next, you need to connect your account. Don’t worry—you won’t need to enter your email/password; usually, a special Client ID or API Token, which is easy to find in the account settings, will suffice:

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20809%20568'%3E%3C/svg%3E)

**Usage**

Here, you will find statistics on automation usage, as well as the option to increase the limit on the number of runs you can initiate.

## **Creating the first flow** [#](#1-toc-title)

Let’s create our first flow. Assume it will look like this:

1.  We add a new client to the Monday table (the table in Monday must already be created).
2.  The client is automatically added to the selected portal.
3.  After adding the client, we send a notification to a Slack channel.

1) Go to the automation module.

2) Add Monday and Slack to Connections:

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201125%20568'%3E%3C/svg%3E)

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20691%20536'%3E%3C/svg%3E)

3) Go to Flows and select Build Flow:

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201535%20704'%3E%3C/svg%3E)

4) First, select the trigger that will initiate the entire flow. In our case, it’s adding a client in Monday. Select Monday as the trigger:

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201175%20594'%3E%3C/svg%3E)

Next, specify your account and the necessary table:

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201180%20726'%3E%3C/svg%3E)

5) Then, click on Test Trigger. This is necessary to obtain data for actions:

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201173%20722'%3E%3C/svg%3E)

6) Next, create an action. In our case, this is inviting the client to the Fusebase portal. Click on + and select Fusebase:

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201163%20639'%3E%3C/svg%3E)

To invite the client, we need an email. We take it from the trigger (this is why we did the Test Trigger):

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

In the Monday table, we created a special column for the email. This is what we will specify:

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20793%20592'%3E%3C/svg%3E)

Next, specify the client’s name (also taken from Monday) and the portal to which the client will be invited:

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201224%20623'%3E%3C/svg%3E)

8) Next, we want to send a message in Slack. Click on + and select Slack:

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201205%20705'%3E%3C/svg%3E)

9) Then, choose the appropriate channel and message (we chose “Client (client’s email) invited to portal (portal URL)”):

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201177%20745'%3E%3C/svg%3E)

10) Next, click on Publish to save our flow:

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201202%20737'%3E%3C/svg%3E)

11) After publication, our flow is displayed in the list:

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201202%20737'%3E%3C/svg%3E)

12) To run the flow, the trigger must be activated. In our case, this is adding a client to the Monday table. You can check the flow’s operation through Runs, where you will find a list of all triggered automation runs, both successful and unsuccessful.

## Current list of triggers and actions for FuseBase automation [#](#2-toc-title)

Here you will find a complete list of all automations supported by the service – [https://roadmap-fusebase.thefusebase.com/automation-service-list](https://roadmap-fusebase.thefusebase.com/automation-service-list). The list is constantly being updated.

## When attempting to connect to Google Drive, an error appears: “This app is blocked.” How can I resolve this issue? [#](#3-toc-title)

This issue typically occurs for Google Workspace users. To resolve it, you need to add our app to the list of allowed applications. Please follow these simple steps:

1) Go to [https://admin.google.com/ac/owl/list?tab=configuredApps](https://admin.google.com/ac/owl/list?tab=configuredApps) using your administrator account.

2) Click on “Configure new app.”

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20512'%3E%3C/svg%3E)

3) Enter the following Client ID into the input field: **904699785772-pkl5gottrorpshnisthjg13ssn9jvob4.apps.googleusercontent.com**

Click on Fusebase –

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20539'%3E%3C/svg%3E)

4) Next, select All users and choose Continue –

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20545'%3E%3C/svg%3E)

5) Next, click on Trusted and then press Continue.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20648'%3E%3C/svg%3E)

6) Next, click on Finish to complete the setup. After 5-10 minutes, try connecting to Google Drive again.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20602'%3E%3C/svg%3E)
