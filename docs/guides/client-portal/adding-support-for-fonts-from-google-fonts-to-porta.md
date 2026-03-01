---
title: "Adding support for fonts from Google Fonts to portal"
url: "https://thefusebase.com/guides/client-portal/adding-support-for-fonts-from-google-fonts-to-porta/"
section: "client-portal"
lastScraped: "2026-02-28T21:26:50.258Z"
---

# Adding support for fonts from Google Fonts to portal

If for any reason you are not satisfied with the default font available in the portals, you can add custom fonts, such as those from Google Fonts. Let me show you how to do this.

1) Open Google Fonts – [https://fonts.google.com/](https://fonts.google.com/)

2) Select the desired font and click on it.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-58-1024x517.png)

3) Click on Get Font and then click on Embed.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-59-1024x472.png)

![](https://thefusebase.com/wp-content/uploads/2024/09/image-60-1024x476.png)

4) Copy the Embed code.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-61-1024x509.png)

5) Go to the Customizer of your portal.

6) Navigate to Settings -> Custom Code.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-62-1024x544.png)

7) Paste the copied code into the Head section.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-64-1024x749.png)

8) In the Custom styles section, you need to insert the code that will be applied to all blocks of the portal.

```
<style>
#main-scrolling-container > * {
  font-family: "Playwrite DE Grund", cursive;
}
</style>
```

In the **font-family** field, you need to insert the name of your font, which can be copied from the embed code.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-69-1024x549.png)

![](https://thefusebase.com/wp-content/uploads/2024/09/image-70-1024x754.png)

9) Click **Publish** to apply the changes.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-71-1024x485.png)

10) You can open the portal and check that the fonts have been applied correctly.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-73-1024x544.png)
