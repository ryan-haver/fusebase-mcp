---
title: "Displaying data from other services (HubSpot, Asana, etc.) in the portal"
url: "https://thefusebase.com/guides/client-portal/displaying-data-from-other-services-hubspot-asana-etc-in-the-portal/"
section: "client-portal"
lastScraped: "2026-09-12T05:17:06.085Z"
---

# Displaying data from other services (HubSpot, Asana, etc.) in the portal

In FuseBase portals, you can add not only content created in our editor but also data from other services, such as HubSpot, Asana, etc.

This can be done using the Dynamic Table block. In the future, we will expand the capabilities of other blocks (cards, custom widgets, etc.) to display data from external services.

## **Connecting Third-Party Services to the Portal** [#](#0-toc-title)

1) Open the portal customizer and navigate to the page where you need to display external data.

2) Click Add a new block and select Dynamic Table.

![](https://thefusebase.com/wp-content/uploads/2025/02/image-3.png)

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201855%20969'%3E%3C/svg%3E)

3) Next, you need to select the service from which you want to display data in the table. To do this, click on Data source and select Add new data source.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201886%20924'%3E%3C/svg%3E)

4) Then, choose and authorize the required service. In our case, this will be HubSpot.

5) Next, you can choose the type of data to display in the table. Each service may have its own data types. For example, in HubSpot, you can display tickets, tasks, contacts, and more. Let’s select Company List as an example.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201895%20896'%3E%3C/svg%3E)

## Configuring Table Columns [#](#1-toc-title)

By default, we display the main column types in the table, such as Company Name, Tasks, URL, etc.

However, you can choose which columns to display and which to hide. To do this, expand the Table Fields section, where you can see the currently added columns.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201892%201004'%3E%3C/svg%3E)

It is important to note that when using external data sources, each column must be mapped to a corresponding parameter from the external service.

For example, the Company Name column should be linked to the Company parameter in HubSpot, while Phone Number should be mapped to the Phone parameter in HubSpot.

Let’s try creating a new column Date Created and mapping it to the Created Date parameter in HubSpot.

1) Click on **Add Field**.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%202360%201058'%3E%3C/svg%3E)

2) Enter the column name (Date Created).

3) In the Map to field, select the corresponding parameter in HubSpot. In this case, choose CreatedAt.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201915%201001'%3E%3C/svg%3E)

4) In the Field Type section, you can select the column type. Currently, several options are available, such as Text, Email, Numbers, and more. In our case, we only need a date, so we will select the Date type.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%202374%201028'%3E%3C/svg%3E)

If you don’t need a specific column, you can delete it through the column menu.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%202370%20914'%3E%3C/svg%3E)

## Filtering Data [#](#2-toc-title)

Filters allow you to fine-tune which data should be displayed to your clients. For example, you can show only tasks with a specific label or companies from a certain industry.

Let’s filter our table to display only companies that were added after 2023.

1) Click on Add Condition.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%202356%201023'%3E%3C/svg%3E)

2) Select the HubSpot parameter to filter by. In our case, choose Createddate.

3) Choose the operator: Greater than ( > ) (since we want to show companies created after a certain year).

4) In the Value field, enter 2023 (to display only companies added after 2023).

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%202357%201066'%3E%3C/svg%3E)

You can add multiple filters to refine your data further. If a filter is no longer needed, you can disable or delete it through the menu.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%202358%20982'%3E%3C/svg%3E)
