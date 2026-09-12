---
title: "Trigger Form Submission – automate forms in the portal"
url: "https://thefusebase.com/guides/automations-and-integrations/trigger-form-submission-automate-forms-in-the-portal/"
section: "automations-and-integrations"
lastScraped: "2026-09-12T05:18:08.280Z"
---

# Trigger Form Submission – automate forms in the portal

With our automation, you can integrate [portal forms](https://thefusebase.com/guides/client-portal/forms-creation-and-completion-of-forms-on-the-portal/) with other FuseBase modules or even external services. For example, you can create new tasks in FuseBase based on form responses, send answers to AI agents, or save form submissions to tools like Airtable or Monday.

In this article, we’ll show how to create a Ticket form that will automatically create tasks in the selected task list.

1) First, let’s create a form with the appropriate fields in the portal and publish it.

![](https://thefusebase.com/wp-content/uploads/2025/06/image-43-1024x477.png)

2) Next, create an automation flow. Start by selecting the trigger Portal Form submission.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

3) Then, select the workspace, portal, and the form you created.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

Don’t forget to click Load Data to retrieve test results.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

4) Next, we need the form data to be sent to the task list as tasks. To do this, add the Create New Task action.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

5) Next, specify the location of your task list (workspace and task list name).

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

6) Then, we need to define the data source for the task. In our case, it will be the form, and the task will be created based on the form responses. Accordingly, use the fields from the form trigger in the task name and description (that’s why we used Load Data earlier).

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

We’ll also add the ability to assign a label based on the Request Type option.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

It’s important to note that, in addition to the form responses, the form trigger also sends a lot of other useful information—such as the email of the person who submitted the form, the portal name and link, and more. All of this data can also be included, for example, in the description of the task.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

7) Next, publish your flow.

8) Now you can test how the flow works. To do this, fill out the form and click Submit.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

All set! The task has been successfully added to the task list.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)
