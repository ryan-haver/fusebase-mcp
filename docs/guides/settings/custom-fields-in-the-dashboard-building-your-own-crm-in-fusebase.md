---
title: "Custom columns in the dashboard/table – building your own CRM in Fusebase"
url: "https://thefusebase.com/guides/settings/custom-fields-in-the-dashboard-building-your-own-crm-in-fusebase/"
section: "settings"
lastScraped: "2026-02-28T21:26:11.899Z"
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

![](https://thefusebase.com/wp-content/uploads/2025/08/image-1024x439.png)

In the window that appears, you will see 2 lists:

-   On the left – a list of all available fields
-   On the right – a list of fields that are active in the current dashboard

![](https://thefusebase.com/wp-content/uploads/2025/08/image-1-1024x431.png)

## Creating a new field [#](#2-toc-title)

Now let’s try creating a new custom field. To do this, click **Add new field** and select the type of field you want to create.

![](https://thefusebase.com/wp-content/uploads/2025/08/image-2-1024x570.png)

![](https://thefusebase.com/wp-content/uploads/2025/08/image-4-1024x478.png)

For example, let’s try adding a client’s date of birth. To do this, click on Date field and specify the field parameters. That is, specify the field name and the Date format.

![](https://thefusebase.com/wp-content/uploads/2025/08/image-5-1024x461.png)

After creation, a new column with the field appears in the dashboard.

![](https://thefusebase.com/wp-content/uploads/2025/08/image-6-1024x404.png)

Click on it and enter the required date.

![](https://thefusebase.com/wp-content/uploads/2025/08/image-7-1024x431.png)

Next, for example, you can add the company name. Let’s try to do this using a Custom label.

![](https://thefusebase.com/wp-content/uploads/2025/08/image-9-1024x492.png)

In Custom Label, you can provide the user with a choice of different options. Let’s try entering several company names.

![](https://thefusebase.com/wp-content/uploads/2025/08/image-11-1024x519.png)

After adding the column, click on the cell to select the desired company from the list.

![](https://thefusebase.com/wp-content/uploads/2025/08/image-12-1024x426.png)

![](https://thefusebase.com/wp-content/uploads/2025/08/image-13-1024x420.png)

## Editing field settings [#](#3-toc-title)

To edit a field’s settings (for example, change its name or the date format), click Edit columns and then click the arrow next to the desired field.

![](https://thefusebase.com/wp-content/uploads/2025/08/image-14-1024x437.png)

Next, adjust the settings as needed and click Apply.

![](https://thefusebase.com/wp-content/uploads/2025/08/image-15-1024x980.png)

## Hiding columns [#](#4-toc-title)

If a field is not needed at the moment, you can simply hide it by clicking X. To bring it back, just click on it in the list of all fields.

## How to reorder columns? [#](#5-toc-title)

If you want to change the order of columns, go to Edit columns, then click on the desired column and drag it to the needed position. After that, click Apply.

## Unique Parameter for a Column [#](#6-toc-title)

For example, if you need each member in the table to have a unique email and want to prevent creating a member with a duplicate email, the Unique parameter for a column will help you.

You can activate the Unique parameter for both new and existing columns.

![](https://thefusebase.com/wp-content/uploads/2025/08/image-27.png)

When this parameter is active, you won’t be able to add duplicate data in a new row if that value already exists in another row. This can apply to emails, dates, text, numbers, etc. If you attempt to enter duplicate data, you will see a corresponding message.

## Column groups – simplifying data display in detailed view [#](#7-toc-title)

If you have many columns, even the detailed view can be hard to work with because there’s a lot of data and it can be difficult to read. You can group related columns into groups/sections that you can fold or unfold. You only see what you need, when you need it – so you work faster and make fewer mistakes.

You can read more about this feature here – [https://thefusebase.com/guides/dashboard-crm/column-groups-simplifying-data-display-in-detailed-view/](https://thefusebase.com/guides/dashboard-crm/column-groups-simplifying-data-display-in-detailed-view/)
