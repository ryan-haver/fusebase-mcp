---
title: "Creating a recurring task using automation"
url: "https://thefusebase.com/guides/automations-and-integrations/creating-a-recurring-task-using-automation/"
section: "automations-and-integrations"
lastScraped: "2026-02-28T21:27:38.457Z"
---

# Creating a recurring task using automation

In this guide, we will explain how to create a recurring task using built-in automation.

**Use Case:** Our team has daily stand-up meetings, and it’s important not to forget to create a Meeting Note beforehand. To ensure this, a task will be automatically created to remind us about it.

1) To begin, create a new flow.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-50-1024x452.png)

2) To start creating an automation, you need to select a trigger. Click on the “Core” category in the “Select Trigger” window to view available triggers. Choose the “Schedule” trigger by clicking on it. This trigger will allow you to schedule the automation to run at specific times.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-51-1024x664.png)

3) From the “Select a Trigger” dropdown menu, select “Every Day”. This option will make the automation run daily. Click on the “Hour of the day” dropdown menu and select “5 pm”. This sets the automation to run every day at 5 pm.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-52-1024x594.png)

4) After setting up the trigger, click on the plus icon below the “Every Day” step to add a new action to your automation.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-53-1024x621.png)

5) From the available “Fusebase” actions, select “Create New Task”. This action will create a new task in your Fusebase workspace based on the trigger’s schedule.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-54-1024x589.png)

6) Specify the workspace where the new task will be created.

7) Choose the specific task list within the workspace where you want to add the new task.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-55-1024x625.png)

8) In the “Task name” field, type in “Create a Meeting Note for the team daily stand-up” to give the task a clear and descriptive name. Provide additional context or instructions for the task in the “Task description” field. Type in “Meeting notes” to remind the team about the purpose of the task.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-56-1024x621.png)

9) Assign a label to the task for better organization and filtering.

10) We will also add a deadline right away so that a notification is sent to remind us about the task. Select Dynamic date and set it to 1 minute. This means the deadline will be set to 1 minute after the task is created, and a notification will be sent immediately.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-57-1024x652.png)

11) After configuring all the settings for the automation, click the “Publish” button in the top right corner to activate it. This will schedule the automation to run daily at 5 pm and create a new task with the specified details in your chosen Fusebase workspace and task list.
