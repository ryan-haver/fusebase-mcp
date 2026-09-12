---
title: "Transferring Files from Google Drive to the Fusebase Database – Quick Guide"
url: "https://thefusebase.com/guides/automations-and-integrations/transferring-files-from-google-drive-to-the-fusebase-database-quick-guide/"
section: "automations-and-integrations"
lastScraped: "2026-09-12T05:18:07.565Z"
---

# Transferring Files from Google Drive to the Fusebase Database – Quick Guide

In this guide, we will show you how to transfer files from Google Drive to the database. You can use this example to transfer files from other services as well, and you can move files not only into tables, but also, for example, into pages.

1) First, let’s prepare the table where the files will be transferred. You can choose the list of columns yourself, but the main requirement is to include a column of the Files type.

![](https://thefusebase.com/wp-content/uploads/2026/01/image-42-1024x351.png)

2) Next, go to Automation and create a new flow. Select Manual run as the trigger.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20487'%3E%3C/svg%3E)

3) Next, we need to prepare a list of files from Google Drive for transfer. To do this, select the action Google Drive -> Search.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20516'%3E%3C/svg%3E)

4) Next, connect your Google Drive account.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20397'%3E%3C/svg%3E)

5) Then, select File Name in Query Name and Contains in Operator.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20380'%3E%3C/svg%3E)

6) In Value, you need to specify the file mask for the files you want to transfer. In our case, we want to transfer only videos in webm format, so we enter \*.webm. If you want to transfer all files from a folder, enter \*.\*

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20477'%3E%3C/svg%3E)

In Fill Type, select All.

7) Next, specify the folder from which the files will be transferred.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20413'%3E%3C/svg%3E)

8) Next, click on Generate Sample Data to load test data. This will be important for the following steps.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20565'%3E%3C/svg%3E)

9) We need to transfer not just one file to Fusebase, but all the files found, one by one. To do this, you will use the Loop action, which you need to add.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20450'%3E%3C/svg%3E)

10) In Items, select the entire Search array from the previous action.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20528'%3E%3C/svg%3E)

11) Click on Test Step to retrieve data for the next steps.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20564'%3E%3C/svg%3E)

12) Next, we need to get a direct link to the file in order to download it. To do this, within the Loop action, click on + and select Google Drive -> Read.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20559'%3E%3C/svg%3E)

13) In the File ID input, specify the file ID, which you can take from the Loop action –

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20561'%3E%3C/svg%3E)

For File Name, select the File Name from the Loop action –

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20570'%3E%3C/svg%3E)

Don’t forget to click on Test Step to retrieve the data (in our case, the file link).

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20563'%3E%3C/svg%3E)

14) Next, we need to add the action for uploading files to the database. To do this, within the Loop action, add Fusebase Database -> Create row.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20564'%3E%3C/svg%3E)

15) Select the database, table, and the required view.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20560'%3E%3C/svg%3E)

Next, you need to specify the file name and link in the corresponding columns. In the Name field, enter the file name from the Loop action, and in the File field, add the file link from the Read action.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20564'%3E%3C/svg%3E)

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20568'%3E%3C/svg%3E)

16) Next, click on Publish to save the flow.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20561'%3E%3C/svg%3E)

17) Click on Run to start the flow. After the flow has successfully completed, you can change the folder in Google Drive if, for example, you need to transfer files from different folders, and then run the flow again.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20520'%3E%3C/svg%3E)

## When attempting to connect to Google Drive, an error appears: “This app is blocked.” How can I resolve this issue? [#](#0-toc-title)

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
