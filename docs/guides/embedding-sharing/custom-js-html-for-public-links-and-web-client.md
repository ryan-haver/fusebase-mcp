---
title: "Custom JS/HTML for public links and web-client"
url: "https://thefusebase.com/guides/embedding-sharing/custom-js-html-for-public-links-and-web-client/"
section: "embedding-sharing"
lastScraped: "2026-02-28T21:27:41.674Z"
---

# Custom JS/HTML for public links and web-client

[FuseBase](https://thefusebase.com/) has a function for adding custom code from other services, which will be displayed on public links (folders and pages) and/or in the web client. For example, you can add analytics with Google Analytics, chat with Intercom, and other marketing tools.

It will be possible to add code within one workspace. For example, workspace A makes and inserts one code, and workspace B makes and uses another code. You can add a code only if your organization uses a separate subdomain (CNAME).

All participants who have access to the business panel—namely the organization owner and managers—will be able to use this function.

## Adding a new script [#](#b745032984_747)

In FuseBase, the code is not added immediately, but by separate scripts. For example, there will be one script for analytics, another for chat, a third for CTA, and so on.

An example of adding the first script:

1) Open the organization console – [https://teams.nimbusweb.me](https://teams.nimbusweb.me)

2) Go to workspaces management. In the menu select the desired workspace.

![Go to workspaces management. In the menu select the desired workspace.](https://app.nimbusweb.me/box/attachment/4080931/bk8trab1r981msdpx5n3/Ocfb37o1pkAh7ebY/image.png)

3) Select Custom HTML/JS –

![Select Custom HTML/JS](https://app.nimbusweb.me/box/attachment/4080931/bk8trab1r981msdpx5n3/m1GErC1nw7BAjMwN/image.png)

4) Next, you will see the script management page –

![Next, you will see the script management page](https://app.nimbusweb.me/box/attachment/4080931/bk8trab1r981msdpx5n3/iQOSnSqGA3EYMmzq/image.png)

5) To add a script, you need to click on the button “Add HTML/JS” –

![To add a script, you need to click on the button "Add HTML/JS"](https://app.nimbusweb.me/box/attachment/4080931/bk8trab1r981msdpx5n3/z3lrTzVpPnlhfvF2/image.png)

6) After that, the page for adding the code will appear:

**Name** – the name of the script. For example, you can specify the name of a service for the “Intercom Chat” type.

**Head** – the form for inserting the code that will be added to the block <head></head> . Most services require code to be inserted into this block.

**Body** – the form for inserting the code added to the block <body></body>. Also, you can immediately determine where the script will be located – at the top of the page or at the bottom.

The code can be added to either “Head” or “Body,” or both blocks at once (for many services this is a mandatory requirement). HTML and JavaScript are supported.

**Where to integrate** – you can choose where the script code will be added: to public pages and/or web client.

After adding the script code, you need to save it. When you’re ready, press Publish.

![After adding the script code, you need to save it. When you're ready, press Publish.](https://app.nimbusweb.me/box/attachment/4080931/bk8trab1r981msdpx5n3/KFc0CIy4MPNJ4LyS/image.png)

## Scripts management [#](#b745032984_3859)

Any added and saved script will be stored in the project’s script list. You can easily find it in the “Custom HTML / JS” section.

![You can easily find it in the "Custom HTML / JS" section.](https://app.nimbusweb.me/box/attachment/4080931/bk8trab1r981msdpx5n3/hZxapFCHnrnaT45t/image.png)

This list displays not only the name of the script, but also its author, as well as the location (public pages and/or web client). You can also see the last edit date and much more. In a large number of scripts, the one you need can be found using the search function.

You can also sort the script names alphabetically –

![You can also sort the script names alphabetically](https://app.nimbusweb.me/box/attachment/4080931/bk8trab1r981msdpx5n3/kl8uIHd8N9oJsvuv/image.png)

In addition to general information, each script has a separate menu with actions –

![In addition to general information, each script has a separate menu with actions](https://app.nimbusweb.me/box/attachment/4080931/bk8trab1r981msdpx5n3/YVuruWVbaz6s8vJn/image.png)

the following items are available here:

**Edit** – opens the script editing page.  
**Deactivate** – as you know, a script can be shown in public links and/or on the web. If you click on Deactivate, the script will not be deleted, but simply will no longer be displayed anywhere. In the future, you can activate it through the page editing the script.

## Editing the script [#](#b745032984_5724)

As mentioned above, the “Edit” button in the menu of each script allows you to edit it.

![As mentioned above, the “Edit” button in the menu of each script allows you to edit it.](https://app.nimbusweb.me/box/attachment/4080931/bk8trab1r981msdpx5n3/zOwwc6yvVMy8yOtN/image.png)

After clicking it, the script editing page will open, where you can change all the values: the name, the code itself in head and body, and where you want to place the script. Changes take effect immediately after saving the script.

## Useful links [#](#b778331315_36)

Adding support for fonts from Google Fonts to public links – [https://thefusebase.com/guides/embedding-sharing/adding-support-for-fonts-from-google-fonts-to-public-links/](https://thefusebase.com/guides/embedding-sharing/adding-support-for-fonts-from-google-fonts-to-public-links/)

Adding Google Analytics to public pages using custom scripts – [https://thefusebase.com/guides/branding/adding-google-analytics-to-public-pages-using-custom-scripts/](https://thefusebase.com/guides/branding/adding-google-analytics-to-public-pages-using-custom-scripts/)

Adding Intercom chat to public pages using custom scripts – [https://thefusebase.com/guides/embedding-sharing/adding-intercom-chat-to-public-pages-using-custom-scripts/](https://thefusebase.com/guides/embedding-sharing/adding-intercom-chat-to-public-pages-using-custom-scripts/)
