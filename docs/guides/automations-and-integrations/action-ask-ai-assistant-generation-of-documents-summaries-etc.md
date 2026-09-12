---
title: "Action Ask AI Assistant – generation of documents, summaries, etc."
url: "https://thefusebase.com/guides/automations-and-integrations/action-ask-ai-assistant-generation-of-documents-summaries-etc/"
section: "automations-and-integrations"
lastScraped: "2026-09-12T05:18:11.572Z"
---

# Action Ask AI Assistant – generation of documents, summaries, etc.

As you know, FuseBase has its own AI Assistant that knows everything about your workspace and allows you to answer questions about its content. You can read more about the assistant here: [https://thefusebase.com/guides/fusebase-ai/ai-assistant-quick-guide/](https://thefusebase.com/guides/fusebase-ai/ai-assistant-quick-guide/).

This is a very powerful tool, and now its capabilities can also be automated using our [automation module](https://thefusebase.com/guides/automations-and-integrations/fusebase-automation-quick-guide/). With the **ASK AI Assistant** action, you can: create summaries and reports based on workspace data, generate documents and training courses using data from the workspace, and much more.

In this guide, we will show you how to generate a weekly report on tasks in the workspace with automatic email delivery. The case is very simple: I am a project manager, and I want to stay informed about all tasks. Therefore, I want to receive a weekly summary of all tasks that are not yet completed and have deadlines within the current month.

First, you need to create a new flow and select the **Schedule** trigger as the first action. Since we need to send the email once a week, set the corresponding value for the schedule.

![](https://thefusebase.com/wp-content/uploads/2025/01/image-1024x664.png)

Next, in the list of actions, select **ASK AI Assistant**. It consists of several customizable parameters.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20559'%3E%3C/svg%3E)

First, select the workspace you need.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20649'%3E%3C/svg%3E)

In the **Prompt/Request**, we need to specify the query to be executed. Write it in plain language, as if you were asking a colleague. For example:

**List all tasks assigned to John Doe that are not yet closed. Provide your answer in a checklist format (use emojis instead of checkboxes + task name). Only include tasks with deadlines within the current month.**

**Above the tasks, add text indicating that these tasks have not yet been completed.**

**When you click on a task, it should open (link the tasks). Use emojis to show that the tasks are not completed.**

Instead of “John Doe,” specify the desired team member, or modify the request to generate a summary for all tasks in general.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20540'%3E%3C/svg%3E)

In the prompt, you can also use mentions, which allow you to narrow down the query. For example, if you want to include only tasks from specific folders or if you’ve already created a template for the email and want it to be used. Simply type **@** and select the desired folders or page from the list.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20548'%3E%3C/svg%3E)

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20679'%3E%3C/svg%3E)

In the **Response Format**, select **HTML** so the assistant provides the response with the correct formatting.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20635'%3E%3C/svg%3E)

Click **Test Step** to receive test data. This data will be needed for the next step.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20527'%3E%3C/svg%3E)

Next, we need to set up email sending. To do this, create the action **Send Email**.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20660'%3E%3C/svg%3E)

In the **Recipient** field, select the desired recipient. In our case, you can choose your email address.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20680'%3E%3C/svg%3E)

In the **Email Subject**, specify the desired email title. In the **Body**, you need to add the assistant’s response. To do this, select the **Response** from the assistant’s action.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20671'%3E%3C/svg%3E)

Next, click **Publish** to publish the flow.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20669'%3E%3C/svg%3E)
