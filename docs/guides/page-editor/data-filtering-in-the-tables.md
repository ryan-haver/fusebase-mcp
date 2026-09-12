---
title: "Data filtering in the Tables (FuseBase Documents)"
url: "https://thefusebase.com/guides/page-editor/data-filtering-in-the-tables/"
section: "page-editor"
lastScraped: "2026-09-12T05:18:52.989Z"
---

# Data filtering in the Tables (FuseBase Documents)

## How do I enable filtering? [#](#0-toc-title)

There are two ways to enable filtering.

1) Activation through the table menu – Filter:

![Activation through the table menu - Filter](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20868%20508'%3E%3C/svg%3E)

2) Or click on the menu of the column you want to filter and select Filter by this field:

![Click on the menu of the column you want to filter by and select Filter by this field:](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20719%20428'%3E%3C/svg%3E)

Next, you will see the filtering bar. Here, you can:

-   choose a column to filter by (1);
-   choose the filter condition (2);
-   specify the filtering value (3).

![Next, you will see the filtering bar, where you can:](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20745%20207'%3E%3C/svg%3E)

After filtering is activated, you will see a filtering icon next to the column name. Clicking on it will open the filtering bar.

![After filtering is activated, you will see a filtering icon next to the column name, and clicking on it will open the filtering bar.](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20639%20224'%3E%3C/svg%3E)

## How do I enable multi-column filtering? [#](#1-toc-title)

You can also utilize multiple filters. To do this, open the filter bar, and click Add condition. Then enter the filter values.

![You can also use multiple filters. To do this, open the filter bar and click Add condition, then enter the filter values.](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20740%20248'%3E%3C/svg%3E)

## OR/AND operators [#](#2-toc-title)

If you use multiple filtering, you can use OR / AND operators to make filtering more accurate.

![If you use multiple filtering, you can use OR and AND operators to make filtering work more accurately.](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20734%20245'%3E%3C/svg%3E)

If the OR filter is selected, the table only shows rows that match ALL filters simultaneously. For example, here is a table:

![If the OR filter is selected, the table shows only those rows that match ALL filters simultaneously. For example, there is a table:](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20639%20206'%3E%3C/svg%3E)

Filters are used to display lines with the Name and the label Done. It ended up displaying all 3 lines:

![I created filters to display lines that have the Name and the label Done. It ended up displaying all 3 lines:](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20742%20236'%3E%3C/svg%3E)

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20618%20200'%3E%3C/svg%3E)

  
If the filter AND was chosen instead, only rows that have a match for all the selected filters should show up. In our case, one row:

![If I choose the filter AND, only rows that have a match for all the selected filters should show up. In our case, one row is:](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20724%20233'%3E%3C/svg%3E)

![If I choose the filter AND, only rows that have a match for all the selected filters should show up. In our case, one row is:](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20637%20129'%3E%3C/svg%3E)

## How do I remove the filter? [#](#3-toc-title)

You can remove a filter by clicking on the trash can icon next to the filter.

![You can remove a particular filter by clicking on the trash can icon next to the filter.](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20814%20243'%3E%3C/svg%3E)

You can also remove all filters by clicking Clear all.

![Also, you can remove all filters by clicking Clear all.](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20722%20232'%3E%3C/svg%3E)

## Columns and filter types [#](#4-toc-title)

Below is a list of columns and filter types.

### Text column [#](#5-toc-title)

#### Filter conditions [#](#6-toc-title)

-   Contains (default) – shows the strings that contain part of the input. For example, if John, then we show the string, John Doe;
-   Is – shows rows with exact values in the cell column. For example, if the cell says John Doe. Then John Doe must be in the filter. Otherwise, it is not shown;
-   Is not – show rows in which there is no exact match in the text. For example, if the cell says John Doe. Then the filter should be exactly John Doe. Otherwise, the line will be shown. This filter is case-sensitive;
-   Contains not – shows rows in which there is no specified content. For example, if John is specified, the line with John Doe is not shown;
-   Empty/Not empty – shows lines with any data or vice versa.

#### Filter value [#](#7-toc-title)

A text input box where enter the desired text.

### Single / Multiple Select [#](#8-toc-title)

#### Filter conditions [#](#9-toc-title)

-   Has any of (default) – show all lines with selected labels (there can be multiple labels). If the value has more than one label, at least one label must meet the conditions;
-   Has none of – show all lines with none of the selected labels (there can be multiple labels);
-   Empty/Not empty – displays lines with any labels and vice versa.

#### Filter values [#](#10-toc-title)

In the value, you can select the desired labels for which you want to enable filtering. You can select multiple labels at once.

### Number / Currency [#](#11-toc-title)

#### Conditions [#](#12-toc-title)

-   Equal – rows whose values are equal to the selected one are displayed;
-   Not equal – the rows whose values are not equal to the selected one are displayed;
-   More – the rows whose values are greater than the selected one are displayed;
-   Less – the rows whose values are less than the selected one are displayed;
-   More or equal – the rows whose values are more or equal to the selected one are displayed;
-   Less than or equal – the rows that are less than or equal to the selected one are displayed;
-   Empty/Not empty – rows with any numbers and vice versa are displayed.

#### Values [#](#13-toc-title)

You can enter a numeric value in the format selected for the column. This includes negative digits.

### Collaborator [#](#14-toc-title)

#### Conditions [#](#15-toc-title)

-   Has any of (default) – show all rows with selected members (there can be several). If there is more than one member, then at least one label must match the condition. For example, if the condition has participants John and Jessica, then after filtering, we show rows where one of these participants (or both) is present;
-   Has none of – rows with none of the selected members are displayed (there can be several members);
-   Empty/Not empty – displays rows with any members and vice versa.

#### Values [#](#16-toc-title)

You can select one or more participants in the workspace.

### Files [#](#17-toc-title)

#### Conditions [#](#18-toc-title)

-   File type – here, you select the file type (the list in the conditions). For example, you can select multiple values to filter rows that have both documents and pictures.
-   Empty/Not empty – displays rows with any files and vice versa.

#### Values [#](#19-toc-title)

You can select different file types:

-   Images: png, jpg, jpeg, gif files;
-   Documents: doc, pdf, xls, html, txt;
-   Media: mp4, mp3, mov, avi, webm;
-   Other: all other file types.

### Rating [#](#20-toc-title)

#### Conditions [#](#21-toc-title)

-   Equal – rows whose values are equal to the selected one are displayed;
-   Not equal – the rows whose values are not equal to the selected one are displayed;
-   More – the rows whose values are greater than the selected one are displayed;
-   Less – the rows whose values are less than the selected one are displayed;
-   More or equal – the rows whose values are more or equal to the selected one are displayed;
-   Less than or equal – the rows that are less than or equal to the selected one are displayed;
-   Empty/Not empty – rows with any numbers and vice versa are displayed.

#### Values [#](#22-toc-title)

You can enter a numeric value into the input. This will correspond to the number of stars.

### Progress [#](#23-toc-title)

#### Conditions [#](#24-toc-title)

-   Equal – rows whose values are equal to the selected one are displayed;
-   Not equal – the rows whose values are not equal to the selected one are displayed;
-   More – the rows whose values are greater than the selected one are displayed;
-   Less – the rows whose values are less than the selected one are displayed;
-   More or equal – the rows whose values are more or equal to the selected one are displayed;
-   Less than or equal – the rows that are less than or equal to the selected one are displayed;
-   Empty/Not empty – rows with any numbers and vice versa are displayed.

#### Values [#](#25-toc-title)

In the instance displayed, a progress bar, the value of which can be changed, causing the displayed rows to change depending on it.

### Checkbox [#](#26-toc-title)

#### Conditions [#](#27-toc-title)

Is – checkboxes have only one condition: the checkbox is marked as done or not.

#### Value [#](#28-toc-title)

Depending on the status change, the displayed lines are updated.

### Date [#](#29-toc-title)

#### Conditions [#](#30-toc-title)

There is only one condition for a date – it must match the selected time value. After filtering, the rows that match the selected values are displayed.

#### Values [#](#31-toc-title)

Dropdown list with values. You can select multiple values (for example, Today and a Custom date).

-   Today – cells with dates where today is specified;
-   Yesterday – cells with yesterday’s date;
-   Tomorrow – cells with tomorrow’s date;
-   Custom – opens the calendar where you can select:
    -   specific day;
    -   period, for example 1st June – 7th June.

### Links [#](#32-toc-title)

#### Conditions [#](#33-toc-title)

-   Contains (default) – shows the strings that contain part of the input. For example, if Nimbus web, then we show the string, nimbusweb.me. You can search both by link name and by URL;
-   Is – shows the rows with the exact values in the cell column. For example, if the cell reads nimbusweb.me. Then the filter must contain nimbusweb.me. Otherwise, it is not shown;
-   Is not – shows rows in which there is no exact match. For example, if the cell says mail.com. Then the filter should be exactly mail.com. Otherwise, the string will be shown. This filter is not case-sensitive. Search by both the name of the link and the URL;
-   Contains not – shows rows in which there is no specified content. For example, if you specify nimbus web, the string with nimbusweb.me is not shown. You can search both by link name and URL. This filter is not case-sensitive;
-   Empty/Not empty – shows rows with any data or vice versa.

#### Value [#](#34-toc-title)

Text injection where necessary text can be entered.

### Mentions [#](#35-toc-title)

#### Conditions [#](#36-toc-title)

-   Contains (default) – shows the rows that contain part of the input. For example, if Page, then displays the string My Page;
-   Is – shows rows with exact values in the column cell. For example, if the cell says My Page. Then My Page must be in the filter. Otherwise, it is not shown;
-   Is not – shows rows in which there is no exact match in the text. For example, if the cell says My Page. Then the filter should be My Page. Otherwise, the string will be shown;
-   Contains not – shows rows in which there is no specified content. For example, if a note is specified, the string with My Note will not be shown;
-   Empty/Not empty – shows rows with any data or vice versa.

#### Value [#](#37-toc-title)

The text part where the necessary text can be entered.
