---
title: "How to connect Asana to FuseBase Work (example of a third-party MCP integration)"
url: "https://thefusebase.com/guides/fusebase-work/how-to-connect-asana-to-fusebase-work-example-of-a-third-party-mcp-integration/"
section: "fusebase-work"
lastScraped: "2026-09-12T05:18:59.156Z"
---

# How to connect Asana to FuseBase Work (example of a third-party MCP integration)

In this guide, we’ll show you how to connect a third-party service to FuseBase Work, using Asana as an example.

1) To get started, create an application for authorization in Asana. To do this, go to the My Apps page, typically located at: [https://app.asana.com/0/my-apps](https://app.asana.com/0/my-apps)

2) Create a new app –

![](https://thefusebase.com/wp-content/uploads/2026/08/image-1024x295.png)

3) Select the app type MCP and click Create App. You will be taken to the app settings. Do not close this tab.

![](https://thefusebase.com/wp-content/uploads/2026/08/image-1-1024x655.png)

4) Next, in another tab, go to the Integrations section in FuseBase Work and click Add Integration –

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20506'%3E%3C/svg%3E)

5) Select Custom MCP Server –

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20746'%3E%3C/svg%3E)

6) In the dialog that appears, specify the integration name and the MCP server URL — [https://mcp.asana.com/v2/mcp](https://mcp.asana.com/v2/mcp) This is the standard MCP URL for Asana. Set the authentication type to OAuth 2.1.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%201003'%3E%3C/svg%3E)

7) Click Copy next to the Redirect URL.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20966'%3E%3C/svg%3E)

8) Then return to the Asana app settings and open the OAuth section. Click Add Redirect URL and paste the link you copied in FuseBase Work. Please remember to save your changes.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20545'%3E%3C/svg%3E)

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20545'%3E%3C/svg%3E)

9) Next, copy the Client ID and Client Secret one by one and paste them into the corresponding fields in FuseBase Work.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20545'%3E%3C/svg%3E)

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20946'%3E%3C/svg%3E)

10) Next, click Authorize and grant access to Asana.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201002%20988'%3E%3C/svg%3E)

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20947%20849'%3E%3C/svg%3E)

11) After successful authorization, you will see the Asana MCP in the list of integrations, and you can start managing your projects from FuseBase Work.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20485'%3E%3C/svg%3E)

For testing, we can create a task in Asana –

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20858%20738'%3E%3C/svg%3E)

As we can see, the task was created successfully –

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20367'%3E%3C/svg%3E)
