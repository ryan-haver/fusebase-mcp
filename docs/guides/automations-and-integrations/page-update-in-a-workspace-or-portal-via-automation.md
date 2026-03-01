---
title: "Page update in a workspace or portal via automation"
url: "https://thefusebase.com/guides/automations-and-integrations/page-update-in-a-workspace-or-portal-via-automation/"
section: "automations-and-integrations"
lastScraped: "2026-02-28T21:27:35.189Z"
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

![](https://thefusebase.com/wp-content/uploads/2025/05/image-51-1024x667.png)

Enter the names of your competitors, separated by commas, and select HTML as the response format. Don’t forget to click Test Step to retrieve test data.

![](https://thefusebase.com/wp-content/uploads/2025/05/image-52-1024x700.png)

5) Next, add the Page Update action. You can automate page updates in both the Internal Space and a Portal. In our case, the page is in the Internal Space, so select the corresponding action.

![](https://thefusebase.com/wp-content/uploads/2025/05/image-53-1024x669.png)

Next, select the Workspace, the folder, and the specific page where competitor news will be added.

![](https://thefusebase.com/wp-content/uploads/2025/05/image-54-1024x684.png)

In Content Format, select HTML, and in Content, choose the Response from the agent.

![](https://thefusebase.com/wp-content/uploads/2025/05/image-57-1024x684.png)

In Context Position, specify where the new content should be added: at the top of the page or at the bottom.

![](https://thefusebase.com/wp-content/uploads/2025/05/image-56-1024x696.png)

All set! Now, news about your competitors will be automatically gathered and added to the selected page.

![](https://thefusebase.com/wp-content/uploads/2025/05/image-58-1024x523.png)
