---
title: "Data filtering in the Tables (FuseBase Documents)"
url: "https://thefusebase.com/guides/page-editor/data-filtering-in-the-tables"
section: "page-editor"
lastScraped: "2026-09-15T04:44:54.983Z"
---

# Data filtering in the Tables (FuseBase Documents)

[Back to Page Editor](/guides/page-editor)

Page Editor

# Data filtering in the Tables (FuseBase Documents)

Click on the menu of the column you want to filter by and select Filter by this field. You can also use multiple filters.

Guide details

Published

February 6, 2023

Read time

7 min read

Category

Page Editor

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
15.  [Collaborator](#14-toc-title)
16.  [Conditions](#15-toc-title)
17.  [Values](#16-toc-title)
18.  [Files](#17-toc-title)
19.  [Conditions](#18-toc-title)
20.  [Values](#19-toc-title)
21.  [Rating](#20-toc-title)
22.  [Conditions](#21-toc-title)
23.  [Values](#22-toc-title)
24.  [Progress](#23-toc-title)
25.  [Conditions](#24-toc-title)
26.  [Values](#25-toc-title)
27.  [Checkbox](#26-toc-title)
28.  [Conditions](#27-toc-title)
29.  [Value](#28-toc-title)
30.  [Date](#29-toc-title)
31.  [Conditions](#30-toc-title)
32.  [Values](#31-toc-title)
33.  [Links](#32-toc-title)
34.  [Conditions](#33-toc-title)
35.  [Value](#34-toc-title)
36.  [Mentions](#35-toc-title)
37.  [Conditions](#36-toc-title)
38.  [Value](#37-toc-title)

## How do I enable filtering?

There are two ways to enable filtering.

1) Activation through the table menu – Filter:

![Activation through the table menu - Filter](/hosting-assets/legacy/thefusebase/wp-content/uploads/2023/02/Data_filtering_1.png)

2) Or click on the menu of the column you want to filter and select Filter by this field:

![Click on the menu of the column you want to filter by and select Filter by this field:](/hosting-assets/legacy/thefusebase/wp-content/uploads/2023/02/Data_filtering_2.png)

Next, you will see the filtering bar. Here, you can:

-   choose a column to filter by (1);
-   choose the filter condition (2);
-   specify the filtering value (3).

![Next, you will see the filtering bar, where you can:](/hosting-assets/legacy/thefusebase/wp-content/uploads/2023/02/Data_filtering_3.png)

After filtering is activated, you will see a filtering icon next to the column name. Clicking on it will open the filtering bar.

![After filtering is activated, you will see a filtering icon next to the column name, and clicking on it will open the filtering bar.](/hosting-assets/legacy/thefusebase/wp-content/uploads/2023/02/Data_filtering_4.png)

## How do I enable multi-column filtering?

You can also utilize multiple filters. To do this, open the filter bar, and click Add condition. Then enter the filter values.

![You can also use multiple filters. To do this, open the filter bar and click Add condition, then enter the filter values.](/hosting-assets/legacy/thefusebase/wp-content/uploads/2023/02/Data_filtering_5.png)

## OR/AND operators

If you use multiple filtering, you can use OR / AND operators to make filtering more accurate.

![If you use multiple filtering, you can use OR and AND operators to make filtering work more accurately.](/hosting-assets/legacy/thefusebase/wp-content/uploads/2023/02/Data_filtering_6.png)

If the OR filter is selected, the table only shows rows that match ALL filters simultaneously. For example, here is a table:

![If the OR filter is selected, the table shows only those rows that match ALL filters simultaneously. For example, there is a table:](/hosting-assets/legacy/thefusebase/wp-content/uploads/2023/02/Data_filtering_7.png)

Filters are used to display lines with the Name and the label Done. It ended up displaying all 3 lines:

![I created filters to display lines that have the Name and the label Done. It ended up displaying all 3 lines:](/hosting-assets/legacy/thefusebase/wp-content/uploads/2023/02/Data_filtering_8.png)

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2023/02/Data_filtering_9-1.png)

  
If the filter AND was chosen instead, only rows that have a match for all the selected filters should show up. In our case, one row:

![If I choose the filter AND, only rows that have a match for all the selected filters should show up. In our case, one row is:](/hosting-assets/legacy/thefusebase/wp-content/uploads/2023/02/Data_filtering_10.png)

![If I choose the filter AND, only rows that have a match for all the selected filters should show up. In our case, one row is:](/hosting-assets/legacy/thefusebase/wp-content/uploads/2023/02/Data_filtering_11.png)

## How do I remove the filter?

You can remove a filter by clicking on the trash can icon next to the filter.

![You can remove a particular filter by clicking on the trash can icon next to the filter.](/hosting-assets/legacy/thefusebase/wp-content/uploads/2023/02/Data_filtering_12.png)

You can also remove all filters by clicking Clear all.

![Also, you can remove all filters by clicking Clear all.](/hosting-assets/legacy/thefusebase/wp-content/uploads/2023/02/Data_filtering_13.png)

## Columns and filter types

Below is a list of columns and filter types.

### Text column

#### Filter conditions

-   Contains (default) – shows the strings that contain part of the input. For example, if John, then we show the string, John Doe;
-   Is – shows rows with exact values in the cell column. For example, if the cell says John Doe. Then John Doe must be in the filter. Otherwise, it is not shown;
-   Is not – show rows in which there is no exact match in the text. For example, if the cell says John Doe. Then the filter should be exactly John Doe. Otherwise, the line will be shown. This filter is case-sensitive;
-   Contains not – shows rows in which there is no specified content. For example, if John is specified, the line with John Doe is not shown;
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

### Collaborator

#### Conditions

-   Has any of (default) – show all rows with selected members (there can be several). If there is more than one member, then at least one label must match the condition. For example, if the condition has participants John and Jessica, then after filtering, we show rows where one of these participants (or both) is present;
-   Has none of – rows with none of the selected members are displayed (there can be several members);
-   Empty/Not empty – displays rows with any members and vice versa.

#### Values

You can select one or more participants in the workspace.

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

### Rating

#### Conditions

-   Equal – rows whose values are equal to the selected one are displayed;
-   Not equal – the rows whose values are not equal to the selected one are displayed;
-   More – the rows whose values are greater than the selected one are displayed;
-   Less – the rows whose values are less than the selected one are displayed;
-   More or equal – the rows whose values are more or equal to the selected one are displayed;
-   Less than or equal – the rows that are less than or equal to the selected one are displayed;
-   Empty/Not empty – rows with any numbers and vice versa are displayed.

#### Values

You can enter a numeric value into the input. This will correspond to the number of stars.

### Progress

#### Conditions

-   Equal – rows whose values are equal to the selected one are displayed;
-   Not equal – the rows whose values are not equal to the selected one are displayed;
-   More – the rows whose values are greater than the selected one are displayed;
-   Less – the rows whose values are less than the selected one are displayed;
-   More or equal – the rows whose values are more or equal to the selected one are displayed;
-   Less than or equal – the rows that are less than or equal to the selected one are displayed;
-   Empty/Not empty – rows with any numbers and vice versa are displayed.

#### Values

In the instance displayed, a progress bar, the value of which can be changed, causing the displayed rows to change depending on it.

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

### Links

#### Conditions

-   Contains (default) – shows the strings that contain part of the input. For example, if Nimbus web, then we show the string, nimbusweb.me. You can search both by link name and by URL;
-   Is – shows the rows with the exact values in the cell column. For example, if the cell reads nimbusweb.me. Then the filter must contain nimbusweb.me. Otherwise, it is not shown;
-   Is not – shows rows in which there is no exact match. For example, if the cell says mail.com. Then the filter should be exactly mail.com. Otherwise, the string will be shown. This filter is not case-sensitive. Search by both the name of the link and the URL;
-   Contains not – shows rows in which there is no specified content. For example, if you specify nimbus web, the string with nimbusweb.me is not shown. You can search both by link name and URL. This filter is not case-sensitive;
-   Empty/Not empty – shows rows with any data or vice versa.

#### Value

Text injection where necessary text can be entered.

### Mentions

#### Conditions

-   Contains (default) – shows the rows that contain part of the input. For example, if Page, then displays the string My Page;
-   Is – shows rows with exact values in the column cell. For example, if the cell says My Page. Then My Page must be in the filter. Otherwise, it is not shown;
-   Is not – shows rows in which there is no exact match in the text. For example, if the cell says My Page. Then the filter should be My Page. Otherwise, the string will be shown;
-   Contains not – shows rows in which there is no specified content. For example, if a note is specified, the string with My Note will not be shown;
-   Empty/Not empty – shows rows with any data or vice versa.

#### Value

The text part where the necessary text can be entered.
