---
title: "Filtering and Sorting – Quick Guide"
url: "https://thefusebase.com/guides/table-database/filtering-and-sorting-quick-guide"
section: "table-database"
lastScraped: "2026-09-15T04:44:53.516Z"
---

# Filtering and Sorting – Quick Guide

[Back to Table & Database](/guides/table-database)

Table & Database

# Filtering and Sorting – Quick Guide

Filtering If there is a lot of data in the database, it is often necessary to focus only on what is really important and needed right now. For these purposes, we have added the...

Guide details

Published

October 15, 2025

Read time

9 min read

Category

Table & Database

In this guide

1.  [How do I enable filtering?](#0-toc-title)
2.  [How do I enable multi-column filtering?](#1-toc-title)
3.  [OR/AND operators](#2-toc-title)
4.  [How do I remove the filter?](#3-toc-title)
5.  [Columns and filter types](#4-toc-title)
6.  [Text column](#5-toc-title)
7.  [Filter conditions](#6-toc-title)
8.  [Filter value](#7-toc-title)
9.  [Single / Multiple Select](#8-toc-title)
10.  [Filter conditions](#9-toc-title)
11.  [Filter values](#10-toc-title)
12.  [Number / Currency](#11-toc-title)
13.  [Conditions](#12-toc-title)
14.  [Values](#13-toc-title)
15.  [Files](#17-toc-title)
16.  [Conditions](#18-toc-title)
17.  [Values](#19-toc-title)
18.  [Checkbox](#26-toc-title)
19.  [Conditions](#27-toc-title)
20.  [Value](#28-toc-title)
21.  [Date](#29-toc-title)
22.  [Conditions](#30-toc-title)
23.  [Values](#31-toc-title)
24.  [Links](#32-toc-title)
25.  [Conditions](#33-toc-title)
26.  [Value](#34-toc-title)
27.  [Filter Choose from list](#27-toc-title)
28.  [Dynamic filters](#28-toc-title)
29.  [Can I manually sort rows in a table?](#30-toc-title)

# Filtering

If there is a lot of data in the database, it is often necessary to focus only on what is really important and needed right now. For these purposes, we have added the ability to filter data based on various conditions.

## How do I enable filtering?

To activate filtering, click on Filter –

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2025/10/image-32-1024x495.png)

Next, you will see the filtering bar. Here, you can:

-   choose a column to filter by (1);
-   choose the filter condition (2);
-   specify the filtering value (3).

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2025/10/image-33-1024x545.png)

## How do I enable multi-column filtering?

You can also utilize multiple filters. To do this, open the filter bar, and click Add condition. Then enter the filter values.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2025/10/image-34-1024x401.png)

## OR/AND operators

If you use multiple filtering, you can use OR / AND operators to make filtering more accurate.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2025/10/image-35-1024x414.png)

If the OR filter is selected, the table only shows rows that match ALL filters simultaneously.  
If the filter AND was chosen instead, only rows that have a match for all the selected filters should show up. In our case, one row.

## How do I remove the filter?

You can remove a filter by clicking on the trash can icon next to the filter.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2025/10/image-36-1024x414.png)

You can also remove all filters by clicking Clear all.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2025/10/image-37-1024x386.png)

## Columns and filter types

Below is a list of columns and filter types.

### Text column

#### Filter conditions

-   Contains (default) – shows the strings that contain part of the input. For example, if John, then we show the string, John Doe;
-   Is – shows rows with exact values in the cell column. For example, if the cell says John Doe. Then John Doe must be in the filter. Otherwise, it is not shown;
-   Is not – show rows in which there is no exact match in the text. For example, if the cell says John Doe. Then the filter should be exactly John Doe. Otherwise, the line will be shown. This filter is case-sensitive;
-   Contains not – shows rows in which there is no specified content. For example, if John is specified, the line with John Doe is not shown;
-   Start with/End with – shows rows that start or end with the specified value
-   Empty/Not empty – shows lines with any data or vice versa.

#### Filter value

A text input box where enter the desired text.

### Single / Multiple Select

#### Filter conditions

-   Has any of (default) – show all lines with selected labels (there can be multiple labels). If the value has more than one label, at least one label must meet the conditions;
-   Has none of – show all lines with none of the selected labels (there can be multiple labels);
-   Empty/Not empty – displays lines with any labels and vice versa.

#### Filter values

In the value, you can select the desired labels for which you want to enable filtering. You can select multiple labels at once.

### Number / Currency

#### Conditions

-   Equal – rows whose values are equal to the selected one are displayed;
-   Not equal – the rows whose values are not equal to the selected one are displayed;
-   More – the rows whose values are greater than the selected one are displayed;
-   Less – the rows whose values are less than the selected one are displayed;
-   More or equal – the rows whose values are more or equal to the selected one are displayed;
-   Less than or equal – the rows that are less than or equal to the selected one are displayed;
-   Empty/Not empty – rows with any numbers and vice versa are displayed.

#### Values

You can enter a numeric value in the format selected for the column. This includes negative digits.

### Files

#### Conditions

-   File type – here, you select the file type (the list in the conditions). For example, you can select multiple values to filter rows that have both documents and pictures.
-   Empty/Not empty – displays rows with any files and vice versa.

#### Values

You can select different file types:

-   Images: png, jpg, jpeg, gif files;
-   Documents: doc, pdf, xls, html, txt;
-   Media: mp4, mp3, mov, avi, webm;
-   Other: all other file types.

### Checkbox

#### Conditions

Is – checkboxes have only one condition: the checkbox is marked as done or not.

#### Value

Depending on the status change, the displayed lines are updated.

### Date

#### Conditions

There is only one condition for a date – it must match the selected time value. After filtering, the rows that match the selected values are displayed.

#### Values

Dropdown list with values. You can select multiple values (for example, Today and a Custom date).

-   Today – cells with dates where today is specified;
-   Yesterday – cells with yesterday’s date;
-   Tomorrow – cells with tomorrow’s date;
-   Custom – opens the calendar where you can select:
    -   specific day;
    -   period, for example 1st June – 7th June.

You can also choose to display rows where there are empty values (date not selected).

### Links

#### Conditions

-   Contains (default) – shows the strings that contain part of the input. For example, if Nimbus web, then we show the string, nimbusweb.me. You can search both by link name and by URL;
-   Is – shows the rows with the exact values in the cell column. For example, if the cell reads nimbusweb.me. Then the filter must contain nimbusweb.me. Otherwise, it is not shown;
-   Is not – shows rows in which there is no exact match. For example, if the cell says mail.com. Then the filter should be exactly mail.com. Otherwise, the string will be shown. This filter is not case-sensitive. Search by both the name of the link and the URL;
-   Contains not – shows rows in which there is no specified content. For example, if you specify nimbus web, the string with nimbusweb.me is not shown. You can search both by link name and URL. This filter is not case-sensitive;
-   Start with/End with – shows rows that start or end with the specified value
-   Empty/Not empty – shows rows with any data or vice versa.

#### Value

Text injection where necessary text can be entered.

## Filter **Choose from list**

Also, for a number of columns, the **Choose from list** filter is available. It allows you to select specific rows from the database and display only them. This is a great option for creating segments. For example, you can create separate Views and display only the rows you need in them.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2025/10/image-38-1024x430.png)

## **Dynamic filters**

In addition to standard ones, you also have access to dynamic filters that allow filtering rows depending on the portal visitor’s email — based on their belonging to a portal, workspace, or group.

They work very simply: in the filter value, click on the variable option and select the desired one.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2025/10/image-80-1024x367.png)

Then, if the row contains the corresponding data (for example, the email in the cell matches the visitor’s email), that row will be displayed to the user.

Currently, the following variables are available:

-   **UserEmail** – checks the email of the portal visitor
-   **MemberGroup** – checks whether the visitor belongs to a group
-   **Current Workspace / Current Portal** (available only for Workspaces and Portal columns) – shows only the rows that correspond to the portal or workspace where the database or dashboard is currently embedded. For example, if you’ve added a dashboard with a list of forms and want to display only the forms added to the current portal.

Let’s show how this works using a portal as an example (the logic is the same in the Internal Space). For example, we have a table with 5 rows, and we want only the user with the email test@thefusebase1.com to see rows 1–3, and no one else.

Here’s what we do:

1) Add an **Email** column to the view that will be added to the portal.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2025/10/image-81-1024x467.png)

2) Add test@thefusebase1.com to the required rows.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2025/10/image-82-1024x456.png)

3) Then, set up a filter for the **Email** column and specify the condition **IS**, and in **Value**, select the **UserEmail** variable.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2025/10/image-83-1024x389.png)

That’s it — all set! Now you can test it: log in as test@thefusebase1.com, and you’ll see the intended rows.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2025/10/image-84-1024x519.png)

Then log in with another email, and you won’t see the rows you shouldn’t have access to.

You can also extend the filter conditions so that if the email is empty, the rows are displayed to all portal visitors. To do this, add a new **Empty** condition with the **OR** operator.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2025/10/image-86-1024x342.png)

# Sorting

You can create databases with different information in columns and sort columns by different criteria.

Try to sort:

-   from smaller to larger numbers in digital columns;
-   all completed / non-completed tasks in columns with checkboxes;
-   percents of the work done in columns with progress.

Number columns can be sorted from smaller to larger numbers; in columns with checkboxes, you can show all uncompleted tasks first; and in columns with progress, you can sort tasks by percent of completion.

To change the sorting, simply click on the sorting icon next to the column name. Clicking the same icon again changes its type, for example A-z switches to z-A and vice versa.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2025/10/image-39-1024x440.png)

If you want to sort by another column, then click on the sorting icon in that column (the sorting icon will appear when you hover over the column).

In Fusebase sorting is dynamic, so if you change data in the cell of the column being sorted, the row automatically changes its place.

Below are examples of the principles by which data is sorted in columns of different types:

**Text** – sorted alphabetically.  
**Numbers and currency** – sorted from smaller to larger items and vice versa.  
**Checkboxes** – you can show marked checkboxes on top or vice versa.  
**Select and multiselect** – sorted alphabetically by the first selection on the list.  
**Date** – sorted from an earlier to a later date and vice versa.  
**Links** – sorted alphabetically by domain.

### Can I manually sort rows in a table?

Yes, absolutely! By default, manual sorting is enabled in new tables. However, if column sorting is active, you can disable it via the “Remove sort” option in the menu. If you’re satisfied with the current row order, don’t forget to enable the “Keep sorted” option (if left inactive, the previous row order used during manual sorting will be preserved).

After that, you can manually move a row to the desired position. Simply click on the move icon and, while holding down the mouse button, drag the row to where you want it.

# Refresh button – what it does and why it’s needed

In the top bar of the dashboard, you can see the data refresh button. The built-in CRM does not have real-time data updates (for example, if another member invites a client or creates a portal, it will not immediately appear in the list until you refresh). To avoid refreshing the entire page, you can simply click on the icon, and you will always have up-to-date data.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2025/10/image-40-1024x497.png)
