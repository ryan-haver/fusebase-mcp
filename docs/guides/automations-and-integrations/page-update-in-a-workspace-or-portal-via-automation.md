---
title: "Page update in a workspace or portal via automation"
url: "https://thefusebase.com/guides/automations-and-integrations/page-update-in-a-workspace-or-portal-via-automation/"
section: "automations-and-integrations"
lastScraped: "2026-09-12T05:18:08.339Z"
---

# Page update in a workspace or portal via automation

In FuseBase, you can automate not only the [creation of new pages](https://thefusebase.com/guides/automations-and-integrations/automation-of-page-creation-in-the-portal/) but also the updating of existing ones.

For example, you can create a page with competitor news and have it automatically updated, or save emails that meet certain criteria to a specific page, and so on.

Today, we’ll look at a use case: tracking competitor news with automatic page updates.

1) First, create a page where competitor news will be stored.

2) Next, go to the Automation module and create a new flow.

3) For the trigger, we’ll use a Scheduler, since we want the automation to run at a specific interval. Let’s set it to run once a week.

![](https://thefusebase.com/wp-content/uploads/2025/05/image-50-1024x578.png)

4) Next, we need to set up the search for competitor news. We’ll do this using our [AI agents](https://thefusebase.com/guides/fusebase-ai/ai-agents-quick-guide/). In fact, we already provide a default agent called Competitor Releases, which is preconfigured for this exact purpose.

Select FuseBase AI Agents as the first action, and choose the agent named Competitor Releases.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20667'%3E%3C/svg%3E)

Enter the names of your competitors, separated by commas, and select HTML as the response format. Don’t forget to click Test Step to retrieve test data.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20700'%3E%3C/svg%3E)

5) Next, add the Page Update action. You can automate page updates in both the Internal Space and a Portal. In our case, the page is in the Internal Space, so select the corresponding action.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20669'%3E%3C/svg%3E)

Next, select the Workspace, the folder, and the specific page where competitor news will be added.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20684'%3E%3C/svg%3E)

In Content Format, select HTML, and in Content, choose the Response from the agent.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20684'%3E%3C/svg%3E)

In Context Position, specify where the new content should be added: at the top of the page or at the bottom.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20696'%3E%3C/svg%3E)

All set! Now, news about your competitors will be automatically gathered and added to the selected page.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20523'%3E%3C/svg%3E)
