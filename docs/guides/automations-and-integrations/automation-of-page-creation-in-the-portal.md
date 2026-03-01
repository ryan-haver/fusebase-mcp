---
title: "Automation of Page Creation in the Portal"
url: "https://thefusebase.com/guides/automations-and-integrations/automation-of-page-creation-in-the-portal/"
section: "automations-and-integrations"
lastScraped: "2026-02-28T21:27:38.910Z"
---

# Automation of Page Creation in the Portal

With the automation module, you can automate the creation of new pages in both the Internal Space and the portal.

In this guide, we will try to implement a simple flow: creating a new page in the portal based on new posts in an RSS feed.

1) First, create a new flow and select **RSS Feed** as the trigger. In the **Feed URL** field, enter the RSS feed you need. In our case, it’s the RSS feed of our blog – [https://thefusebase.com/blog/rss](https://thefusebase.com/blog/rss).

![](https://thefusebase.com/wp-content/uploads/2024/11/image-21-1024x552.png)

2) Click on **Load Data** to retrieve the data for the next actions.

![](https://thefusebase.com/wp-content/uploads/2024/11/image-22-1024x507.png)

3) Now, we need a page to be created in the portal when a new item appears in the feed. Click on **+** and select **Create page in Portal** in FuseBase.

![](https://thefusebase.com/wp-content/uploads/2024/11/image-23-1024x560.png)

4) Select the desired portal and folder from the list where the pages will be created.

![](https://thefusebase.com/wp-content/uploads/2024/11/image-24-1024x586.png)

5) In **Page Name**, we need to choose a name for the page. In our case, we want the page title to match the title in the blog. Therefore, locate the appropriate value from the trigger data.

![](https://thefusebase.com/wp-content/uploads/2024/11/image-25-1024x544.png)

6) In **Page Content**, we need to specify what will appear in the page content. Let’s add the post description here.

7) In **Add File**, you can specify a file to be added to the page. You can select it from the trigger or from an action.

8) In Page Visibility, you can choose whether the portal page will be visible after creation. If you want to review the page content first, we recommend setting the page to be invisible.

![](https://thefusebase.com/wp-content/uploads/2024/11/image-26-1024x523.png)

9) Next, click on **Publish** to launch the flow.
