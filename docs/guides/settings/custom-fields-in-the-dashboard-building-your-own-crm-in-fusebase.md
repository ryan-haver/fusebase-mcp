---
title: "Custom columns in the dashboard/table – building your own CRM in Fusebase"
url: "https://thefusebase.com/guides/settings/custom-fields-in-the-dashboard-building-your-own-crm-in-fusebase/"
section: "settings"
lastScraped: "2026-09-12T05:16:37.778Z"
---

# Custom columns in the dashboard/table – building your own CRM in Fusebase

In Fusebase dashboards, you can not only [manage your current workspaces, clients, and portals](https://thefusebase.com/guides/getting-started/dashboard-overview-managing-workspaces-portals-and-clients/), but also build a full-fledged CRM using custom columns or fields.

CRM (Customer Relationship Management) is a system that helps businesses keep all customer information, interactions, and deals in one place. It lets teams track leads, calls, emails, and follow-ups so nothing is missed. With CRM, you can automate routine tasks, personalize communication, and see which actions drive sales. Result: faster response, higher conversion, better retention, and clear analytics for smarter decisions.

For example, for a client, you can add various personal information such as date of birth, company name, personal traits, etc. For portals, you can add more deal-related details, such as deal stage, deal value, and so on.

This information can be added to dashboards through fields (in other CRMs they may also be referred to as attributes or properties).

## Types of fields in Fusebase [#](#0-toc-title)

Each dashboard (workspaces, portals, and clients) has its own set of fields. In Fusebase, there are 2 types of fields:

-   **System fields**: these are fields added by default and cannot be deleted (but can be hidden). For example, client name, portal link, analytics data, etc.
-   **Custom fields**: these are fields you can add yourself. Their content can be modified and also deleted if no longer needed.

## Field Management [#](#1-toc-title)

To manage dashboard fields, click **Edit columns**.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20439'%3E%3C/svg%3E)

In the window that appears, you will see 2 lists:

-   On the left – a list of all available fields
-   On the right – a list of fields that are active in the current dashboard

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20431'%3E%3C/svg%3E)

## Creating a new field [#](#2-toc-title)

Now let’s try creating a new custom field. To do this, click **Add new field** and select the type of field you want to create.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20570'%3E%3C/svg%3E)

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20478'%3E%3C/svg%3E)

For example, let’s try adding a client’s date of birth. To do this, click on Date field and specify the field parameters. That is, specify the field name and the Date format.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20461'%3E%3C/svg%3E)

After creation, a new column with the field appears in the dashboard.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20404'%3E%3C/svg%3E)

Click on it and enter the required date.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20431'%3E%3C/svg%3E)

Next, for example, you can add the company name. Let’s try to do this using a Custom label.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20492'%3E%3C/svg%3E)

In Custom Label, you can provide the user with a choice of different options. Let’s try entering several company names.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20519'%3E%3C/svg%3E)

After adding the column, click on the cell to select the desired company from the list.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20426'%3E%3C/svg%3E)

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20420'%3E%3C/svg%3E)

## Editing field settings [#](#3-toc-title)

To edit a field’s settings (for example, change its name or the date format), click Edit columns and then click the arrow next to the desired field.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20437'%3E%3C/svg%3E)

Next, adjust the settings as needed and click Apply.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20980'%3E%3C/svg%3E)

## Hiding columns [#](#4-toc-title)

If a field is not needed at the moment, you can simply hide it by clicking X. To bring it back, just click on it in the list of all fields.

## How to reorder columns? [#](#5-toc-title)

If you want to change the order of columns, go to Edit columns, then click on the desired column and drag it to the needed position. After that, click Apply.

## Unique Parameter for a Column [#](#6-toc-title)

For example, if you need each member in the table to have a unique email and want to prevent creating a member with a duplicate email, the Unique parameter for a column will help you.

You can activate the Unique parameter for both new and existing columns.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20961%20793'%3E%3C/svg%3E)

When this parameter is active, you won’t be able to add duplicate data in a new row if that value already exists in another row. This can apply to emails, dates, text, numbers, etc. If you attempt to enter duplicate data, you will see a corresponding message.

## Column groups – simplifying data display in detailed view [#](#7-toc-title)

If you have many columns, even the detailed view can be hard to work with because there’s a lot of data and it can be difficult to read. You can group related columns into groups/sections that you can fold or unfold. You only see what you need, when you need it – so you work faster and make fewer mistakes.

You can read more about this feature here – [https://thefusebase.com/guides/dashboard-crm/column-groups-simplifying-data-display-in-detailed-view/](https://thefusebase.com/guides/dashboard-crm/column-groups-simplifying-data-display-in-detailed-view/)
