---
title: "How to connect Asana to FuseBase Work (example of a third-party MCP integration)"
url: "https://thefusebase.com/guides/fusebase-work/how-to-connect-asana-to-fusebase-work-example-of-a-third-party-mcp-integration"
section: "fusebase-work"
lastScraped: "2026-09-15T04:45:06.456Z"
---

# How to connect Asana to FuseBase Work (example of a third-party MCP integration)

[Back to FuseBase Work](/guides/fusebase-work)

FuseBase Work

# How to connect Asana to FuseBase Work (example of a third-party MCP integration)

In this guide, we’ll show you how to connect a third-party service to FuseBase Work, using Asana as an example. 1) To get started, create an application for authorization in...

Guide details

Published

August 11, 2026

Read time

2 min read

Category

FuseBase Work

In this guide

This guide is a short walkthrough.

In this guide, we’ll show you how to connect a third-party service to FuseBase Work, using Asana as an example.

1) To get started, create an application for authorization in Asana. To do this, go to the My Apps page, typically located at: [https://app.asana.com/0/my-apps](https://app.asana.com/0/my-apps)

2) Create a new app –

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/08/image-1024x295.png)

3) Select the app type MCP and click Create App. You will be taken to the app settings. Do not close this tab.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/08/image-1-1024x655.png)

4) Next, in another tab, go to the Integrations section in FuseBase Work and click Add Integration –

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/08/image-2-1024x506.png)

5) Select Custom MCP Server –

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/08/image-3-1024x746.png)

6) In the dialog that appears, specify the integration name and the MCP server URL — [https://mcp.asana.com/v2/mcp](https://mcp.asana.com/v2/mcp) This is the standard MCP URL for Asana. Set the authentication type to OAuth 2.1.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/08/image-14-1024x1003.png)

7) Click Copy next to the Redirect URL.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/08/image-6-1024x966.png)

8) Then return to the Asana app settings and open the OAuth section. Click Add Redirect URL and paste the link you copied in FuseBase Work. Please remember to save your changes.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/08/image-7-1024x545.png)

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/08/image-8-1024x545.png)

9) Next, copy the Client ID and Client Secret one by one and paste them into the corresponding fields in FuseBase Work.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/08/image-10-1024x545.png)

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/08/image-11-1024x946.png)

10) Next, click Authorize and grant access to Asana.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/08/image-12.png)

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/08/image-13.png)

11) After successful authorization, you will see the Asana MCP in the list of integrations, and you can start managing your projects from FuseBase Work.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/08/image-15-1024x485.png)

For testing, we can create a task in Asana –

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/08/image-16.png)

As we can see, the task was created successfully –

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/08/image-17-1024x367.png)
