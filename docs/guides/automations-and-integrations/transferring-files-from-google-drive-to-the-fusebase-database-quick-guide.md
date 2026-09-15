---
title: "Transferring Files from Google Drive to the Fusebase Database – Quick Guide"
url: "https://thefusebase.com/guides/automations-and-integrations/transferring-files-from-google-drive-to-the-fusebase-database-quick-guide"
section: "automations-and-integrations"
lastScraped: "2026-09-15T04:44:56.391Z"
---

# Transferring Files from Google Drive to the Fusebase Database – Quick Guide

[Back to Automations and Integrations](/guides/automations-and-integrations)

Automations and Integrations

# Transferring Files from Google Drive to the Fusebase Database – Quick Guide

In this guide, we will show you how to transfer files from Google Drive to the database. You can use this example to transfer files from other services as well, and you can move...

Guide details

Published

January 12, 2026

Read time

3 min read

Category

Automations and Integrations

In this guide

1.  [When attempting to connect to Google Drive, an error appears: “This app is blocked.” How can I resolve this issue?](#0-toc-title)

In this guide, we will show you how to transfer files from Google Drive to the database. You can use this example to transfer files from other services as well, and you can move files not only into tables, but also, for example, into pages.

1) First, let’s prepare the table where the files will be transferred. You can choose the list of columns yourself, but the main requirement is to include a column of the Files type.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-42-1024x351.png)

2) Next, go to Automation and create a new flow. Select Manual run as the trigger.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-43-1024x487.png)

3) Next, we need to prepare a list of files from Google Drive for transfer. To do this, select the action Google Drive -> Search.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-44-1024x516.png)

4) Next, connect your Google Drive account.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-45-1024x397.png)

5) Then, select File Name in Query Name and Contains in Operator.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-46-1024x380.png)

6) In Value, you need to specify the file mask for the files you want to transfer. In our case, we want to transfer only videos in webm format, so we enter \*.webm. If you want to transfer all files from a folder, enter \*.\*

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-47-1024x477.png)

In Fill Type, select All.

7) Next, specify the folder from which the files will be transferred.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-48-1024x413.png)

8) Next, click on Generate Sample Data to load test data. This will be important for the following steps.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-49-1024x565.png)

9) We need to transfer not just one file to Fusebase, but all the files found, one by one. To do this, you will use the Loop action, which you need to add.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-50-1024x450.png)

10) In Items, select the entire Search array from the previous action.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-53-1024x528.png)

11) Click on Test Step to retrieve data for the next steps.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-54-1024x564.png)

12) Next, we need to get a direct link to the file in order to download it. To do this, within the Loop action, click on + and select Google Drive -> Read.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-55-1024x559.png)

13) In the File ID input, specify the file ID, which you can take from the Loop action –

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-56-1024x561.png)

For File Name, select the File Name from the Loop action –

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-57-1024x570.png)

Don’t forget to click on Test Step to retrieve the data (in our case, the file link).

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-58-1024x563.png)

14) Next, we need to add the action for uploading files to the database. To do this, within the Loop action, add Fusebase Database -> Create row.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-59-1024x564.png)

15) Select the database, table, and the required view.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-60-1024x560.png)

Next, you need to specify the file name and link in the corresponding columns. In the Name field, enter the file name from the Loop action, and in the File field, add the file link from the Read action.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-61-1024x564.png)

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-62-1024x568.png)

16) Next, click on Publish to save the flow.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-63-1024x561.png)

17) Click on Run to start the flow. After the flow has successfully completed, you can change the folder in Google Drive if, for example, you need to transfer files from different folders, and then run the flow again.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/01/image-64-1024x520.png)

## When attempting to connect to Google Drive, an error appears: “This app is blocked.” How can I resolve this issue?

This issue typically occurs for Google Workspace users. To resolve it, you need to add our app to the list of allowed applications. Please follow these simple steps:

1) Go to [https://admin.google.com/ac/owl/list?tab=configuredApps](https://admin.google.com/ac/owl/list?tab=configuredApps) using your administrator account.

2) Click on “Configure new app.”

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2024/09/image-84-1024x512.png)

3) Enter the following Client ID into the input field: **904699785772-pkl5gottrorpshnisthjg13ssn9jvob4.apps.googleusercontent.com**

Click on Fusebase –

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2024/09/image-89-1024x539.png)

4) Next, select All users and choose Continue –

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2024/09/image-86-1024x545.png)

5) Next, click on Trusted and then press Continue.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2024/09/image-87-1024x648.png)

6) Next, click on Finish to complete the setup. After 5-10 minutes, try connecting to Google Drive again.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2024/09/image-88-1024x602.png)
