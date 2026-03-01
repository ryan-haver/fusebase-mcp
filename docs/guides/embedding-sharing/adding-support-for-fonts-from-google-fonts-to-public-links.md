---
title: "Adding support for fonts from Google Fonts to public links"
url: "https://thefusebase.com/guides/embedding-sharing/adding-support-for-fonts-from-google-fonts-to-public-links/"
section: "embedding-sharing"
lastScraped: "2026-02-28T21:27:44.869Z"
---

# Adding support for fonts from Google Fonts to public links

Using custom scripts, you can connect any font from Google Fonts and public pages will be displayed with the selected font.

1) Go to the organization management panel – [https://teams.nimbusweb.me](https://teams.nimbusweb.me/).

2) Go to workspace management.

3) Click on **Custom HTML / JS** in the workspace menu.

![Click on Custom HTML / JS in the workspace menu.](https://app.nimbusweb.me/box/attachment/4581239/a49wiak2cm48pop2310l/Oyr7k9dOUaDkFSvp/image.png)

4) Press on **Add HTML/JS**.

![Press on Add HTML/JS](https://app.nimbusweb.me/box/attachment/4581239/a49wiak2cm48pop2310l/ipebGduzmRLgBM87/image.png)

5) Go to [https://fonts.google.com](https://fonts.google.com/)

6) Click on the desired font.

![Click on the desired font](https://app.nimbusweb.me/box/attachment/4581239/a49wiak2cm48pop2310l/Jbyuu1Pkvgkueu39/image.png)

7) Click on **\+ Select this style** next to the desired style.

![Click on + Select this style next to the desired style.](https://app.nimbusweb.me/box/attachment/4581239/a49wiak2cm48pop2310l/h43rDEWGmQQb0F01/image.png)

8) Click on **Embed**.

![Click on Embed](https://app.nimbusweb.me/box/attachment/4581239/a49wiak2cm48pop2310l/ZM1Q7AvVLO2FpLLB/image.png)

9) Copy the code.

![Copy the code](https://app.nimbusweb.me/box/attachment/4581239/a49wiak2cm48pop2310l/iAODQxt1lmslqf96/image.png)

10) Add the resulting code to the <head> </head> field in the new script dialog in [FuseBase](https://thefusebase.com/).

![Add the resulting code to the field in the new script dialog in Nimbus Note](https://app.nimbusweb.me/box/attachment/4581239/a49wiak2cm48pop2310l/i0TbBWW4NYh0mqH3/image.png)

Next, you need to choose how you want your public page to look.

a) If you want to apply the font to both the page text and the text of control links (for example, page cards or links like Share or Full Screen), then add the following text as well.

HTML/XML:

<style>body, .note-container{font-family: 'Font', cursive;}</style>

**Font** needs to be replaced by the name of the font, for example, in our case – Inconsolata. It will look like this –

![Font needs to be replaced by the name of the font, for example, in our case - Inconsolata. It will look like this](https://app.nimbusweb.me/box/attachment/4581239/a49wiak2cm48pop2310l/pawFBES87sHumMZr/image.png)

And this is how the public page will look like –

![And this is how the public page will look like](https://app.nimbusweb.me/box/attachment/4581239/a49wiak2cm48pop2310l/8rfSu3Wk8ysi7n4C/image.png)

b) If you want to change the font only for the control links, use the following text.

HTML/XML:

<style>body{font-family: 'Font', cursive;}</style>

Like this –

![If you want to change the font only for the control links, use the following text.](https://app.nimbusweb.me/box/attachment/4581239/a49wiak2cm48pop2310l/nmr5MiQpFx6Ylwxe/image.png)

c) Also, you can use different fonts for page text and for control links. To do this, use the following text.

HTML/XML:

<style>body{font-family: 'Font 1';}  .note-container{font-family: 'Font 2';}</style>

body{font-family: ‘Font 1’;} – this is for system links.

page-container{font-family: ‘Font 2’;} – this is for page text.

For example, we can use the Forum font for control links, and Inconsolata for text. Accordingly, we add both fonts with Google Fonts –

![For example, we can use the Forum font for control links, and Inconsolata for text. Accordingly, we add both fonts with Google Fonts](https://app.nimbusweb.me/box/attachment/4581239/a49wiak2cm48pop2310l/BS3XUAZtfw3mZtGa/image.png)

and add the following text –

HTML/XML:

<style>body{font-family: 'Forum';}  .note-container{font-family: 'Inconsolata';}</style>

![and add the following text](https://app.nimbusweb.me/box/attachment/4581239/a49wiak2cm48pop2310l/Ehei84CQUVqchsDn/image.png)

And we get this view –

![And we get this view](https://app.nimbusweb.me/box/attachment/4581239/a49wiak2cm48pop2310l/s7rocO0ULg2O3xXn/image.png)
