---
title: "FuseBase Automation – Quick Guide"
url: "https://thefusebase.com/guides/automations-and-integrations/fusebase-automation-quick-guide/"
section: "automations-and-integrations"
lastScraped: "2026-02-28T21:26:11.985Z"
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

![](https://thefusebase.com/wp-content/uploads/2024/09/image-1.png)

Let’s walk through the main elements of the automation module:

**Flows**

Here, you will find a list of all automation flows. A flow is the actual automation process. Each flow consists of a trigger that starts the flow and at least one action. For example, if you want to automatically create a record in your CRM when a client is added to the portal, the trigger is the client being added, and the action is creating the CRM record.

**Runs**

Here, you will find a list of all triggered runs and their statuses. Each trigger activation initiates a run. For instance, in the flow “Adding a client to the portal → automatically create a record in your CRM,” if 10 clients are added, the flow will run 10 times, resulting in 10 runs.

**Connections**

Here, you will find a list of services you want to integrate with FuseBase:

![](https://thefusebase.com/wp-content/uploads/2024/09/image-2-1024x473.png)

To add a new service, click on “New Connections” and select the desired service from the list:

![](https://thefusebase.com/wp-content/uploads/2024/09/image-3.png)

Next, you need to connect your account. Don’t worry—you won’t need to enter your email/password; usually, a special Client ID or API Token, which is easy to find in the account settings, will suffice:

![](https://thefusebase.com/wp-content/uploads/2024/09/image-4.png)

**Usage**

Here, you will find statistics on automation usage, as well as the option to increase the limit on the number of runs you can initiate.

## **Creating the first flow** [#](#1-toc-title)

Let’s create our first flow. Assume it will look like this:

1.  We add a new client to the Monday table (the table in Monday must already be created).
2.  The client is automatically added to the selected portal.
3.  After adding the client, we send a notification to a Slack channel.

1) Go to the automation module.

2) Add Monday and Slack to Connections:

![](https://thefusebase.com/wp-content/uploads/2024/09/image-5.png)

![](https://thefusebase.com/wp-content/uploads/2024/09/image-6.png)

3) Go to Flows and select Build Flow:

![](https://thefusebase.com/wp-content/uploads/2024/09/image-7.png)

4) First, select the trigger that will initiate the entire flow. In our case, it’s adding a client in Monday. Select Monday as the trigger:

![](https://thefusebase.com/wp-content/uploads/2024/09/image-8.png)

Next, specify your account and the necessary table:

![](https://thefusebase.com/wp-content/uploads/2024/09/image-9.png)

5) Then, click on Test Trigger. This is necessary to obtain data for actions:

![](https://thefusebase.com/wp-content/uploads/2024/09/image-11.png)

6) Next, create an action. In our case, this is inviting the client to the Fusebase portal. Click on + and select Fusebase:

![](https://thefusebase.com/wp-content/uploads/2024/09/image-12.png)

To invite the client, we need an email. We take it from the trigger (this is why we did the Test Trigger):

![](https://contact-nimbusweb-co.nimbusweb.me/box/attachment/11023531/2omisotayc9pz7zbpvi6/cKhCt5pgQOuxNOkE/image.png)

In the Monday table, we created a special column for the email. This is what we will specify:

![](https://thefusebase.com/wp-content/uploads/2024/09/image-13.png)

Next, specify the client’s name (also taken from Monday) and the portal to which the client will be invited:

![](https://thefusebase.com/wp-content/uploads/2024/09/image-14.png)

8) Next, we want to send a message in Slack. Click on + and select Slack:

![](https://thefusebase.com/wp-content/uploads/2024/09/image-15.png)

9) Then, choose the appropriate channel and message (we chose “Client (client’s email) invited to portal (portal URL)”):

![](https://thefusebase.com/wp-content/uploads/2024/09/image-16.png)

10) Next, click on Publish to save our flow:

![](https://thefusebase.com/wp-content/uploads/2024/09/image-17.png)

11) After publication, our flow is displayed in the list:

![](https://thefusebase.com/wp-content/uploads/2024/09/image-18.png)

12) To run the flow, the trigger must be activated. In our case, this is adding a client to the Monday table. You can check the flow’s operation through Runs, where you will find a list of all triggered automation runs, both successful and unsuccessful.

## Current list of triggers and actions for FuseBase automation [#](#2-toc-title)

Here you will find a complete list of all automations supported by the service – [https://roadmap-fusebase.nimbusweb.me/automation-service-list](https://roadmap-fusebase.nimbusweb.me/automation-service-list). The list is constantly being updated.

## When attempting to connect to Google Drive, an error appears: “This app is blocked.” How can I resolve this issue? [#](#3-toc-title)

This issue typically occurs for Google Workspace users. To resolve it, you need to add our app to the list of allowed applications. Please follow these simple steps:

1) Go to [https://admin.google.com/ac/owl/list?tab=configuredApps](https://admin.google.com/ac/owl/list?tab=configuredApps) using your administrator account.

2) Click on “Configure new app.”

![](https://thefusebase.com/wp-content/uploads/2024/09/image-84-1024x512.png)

3) Enter the following Client ID into the input field: **904699785772-pkl5gottrorpshnisthjg13ssn9jvob4.apps.googleusercontent.com**

Click on Fusebase –

![](https://thefusebase.com/wp-content/uploads/2024/09/image-89-1024x539.png)

4) Next, select All users and choose Continue –

![](https://thefusebase.com/wp-content/uploads/2024/09/image-86-1024x545.png)

5) Next, click on Trusted and then press Continue.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-87-1024x648.png)

6) Next, click on Finish to complete the setup. After 5-10 minutes, try connecting to Google Drive again.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-88-1024x602.png)
