---
title: "Embed Fusebase databases and dashboards into portals"
url: "https://thefusebase.com/guides/dashboard-crm/embed-fusebase-databases-and-dashboards-into-portals/"
section: "dashboard-crm"
lastScraped: "2026-09-12T05:16:59.754Z"
---

# Embed Fusebase databases and dashboards into portals

You can use Fusebase dashboards and databases not only for internal work, but also give your clients access to them in the portal, with the ability not only to view but also to edit.

## Adding a database to the portal [#](#0-toc-title)

1) Go to the desired page in the portal or create a new one.

2) Click on Add Block and select Fusebase Database.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20484'%3E%3C/svg%3E)

3) Next, you need to choose what you want to display in the portal: a Dashboard from our CRM (for example, a list of clients or workspaces) or a database.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20484'%3E%3C/svg%3E)

4) Next, select the desired dashboard or database, as well as the view you want to display in the portal.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20507'%3E%3C/svg%3E)

Next, the selected database or dashboard will appear in the portal. Click Publish to display the changes in the portal.

## **Embed settings** [#](#1-toc-title)

You also have several settings available for the embed:

**Items per page** – you can specify how many rows to display by default in the table for the portal visitor. If there are more rows, they will be split into pages.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20489'%3E%3C/svg%3E)

**Restrict editing** – you can allow or forbid editing of table data for portal visitors. It’s important to note that this permission is the same for both the portal and the view itself. Therefore, we recommend creating separate views specifically for portals.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20457'%3E%3C/svg%3E)

## **Filtering for embeds** [#](#2-toc-title)

In addition to the filters of the view itself, you can enable separate filters when setting up the embed so that visitors see only the data you allow them to see.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20361'%3E%3C/svg%3E)

The ability to filter will also be available to clients. However, it’s important to note that clients will not see the filters you’ve added, and they will only be able to filter the data that you’ve permitted them to access.

You can read more about filtering at this link – [https://thefusebase.com/guides/dashboard-crm/filtering-and-sorting-quick-guide/](https://thefusebase.com/guides/dashboard-crm/filtering-and-sorting-quick-guide/)

## **Dynamic filters** [#](#3-toc-title)

In addition to standard ones, you also have access to dynamic filters that allow filtering rows depending on the portal visitor’s email — based on their belonging to a portal, workspace, or group.

They work very simply: in the filter value, click on the variable option and select the desired one.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20367'%3E%3C/svg%3E)

Then, if the row contains the corresponding data (for example, the email in the cell matches the visitor’s email), that row will be displayed to the user.

Currently, the following variables are available:

-   **UserEmail** – checks the email of the portal visitor
-   **MemberGroup** – checks whether the visitor belongs to a group
-   **Current Workspace / Current Portal** (available only for Workspaces and Portal columns) – shows only the rows that correspond to the portal or workspace where the database or dashboard is currently embedded. For example, if you’ve added a dashboard with a list of forms and want to display only the forms added to the current portal.

Let’s see how this works in practice. For example, we have a table with 5 rows, and we want only the user with the email test@thefusebase1.com to see rows 1–3, and no one else.

Here’s what we do:

1) Add an **Email** column to the view that will be added to the portal.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20467'%3E%3C/svg%3E)

2) Add test@thefusebase1.com to the required rows.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20456'%3E%3C/svg%3E)

3) Then, set up a filter for the **Email** column and specify the condition **IS**, and in **Value**, select the **UserEmail** variable.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20389'%3E%3C/svg%3E)

That’s it — all set! Now you can test it: log in as test@thefusebase1.com, and you’ll see the intended rows.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20519'%3E%3C/svg%3E)

Then log in with another email, and you won’t see the rows you shouldn’t have access to.

You can also extend the filter conditions so that if the email is empty, the rows are displayed to all portal visitors. To do this, add a new **Empty** condition with the **OR** operator.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20342'%3E%3C/svg%3E)

### Is it possible to filter rows by portal? [#](#4-toc-title)

Absolutely! This is very useful if you have multiple portals and want to maintain a single table where portal clients will only see the rows relevant to their portal.

To do this, follow these simple steps:

1) Add a Relations column.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20491'%3E%3C/svg%3E)

2) Add a relation to the portals dashboard.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20497'%3E%3C/svg%3E)

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20759%20962'%3E%3C/svg%3E)

Enable filtering by the portal relation column and select the condition IS. In the value field, specify the parameter CurrentPortal.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20309'%3E%3C/svg%3E)

Then, simply select in the relation column the portal or portals where you want these rows to be displayed.

As a result, if you add this table to a portal, clients will only see the rows that are relevant to that portal.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20385'%3E%3C/svg%3E)
