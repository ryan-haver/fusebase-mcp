---
title: "Adding support for fonts from Google Fonts to portal"
url: "https://thefusebase.com/guides/client-portal/adding-support-for-fonts-from-google-fonts-to-porta/"
section: "client-portal"
lastScraped: "2026-09-12T05:17:13.017Z"
---

# Adding support for fonts from Google Fonts to portal

If for any reason you are not satisfied with the default font available in the portals, you can add custom fonts, such as those from Google Fonts. Let me show you how to do this.

1) Open Google Fonts – [https://fonts.google.com/](https://fonts.google.com/)

2) Select the desired font and click on it.

![](https://thefusebase.com/wp-content/uploads/2024/09/image-58-1024x517.png)

3) Click on Get Font and then click on Embed.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20472'%3E%3C/svg%3E)

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20476'%3E%3C/svg%3E)

4) Copy the Embed code.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20509'%3E%3C/svg%3E)

5) Go to the Customizer of your portal.

6) Navigate to Settings -> Custom Code.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20544'%3E%3C/svg%3E)

7) Paste the copied code into the Head section.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20749'%3E%3C/svg%3E)

8) In the Custom styles section, you need to insert the code that will be applied to all blocks of the portal.

```
<style>
#main-scrolling-container > * {
  font-family: "Playwrite DE Grund", cursive;
}
</style>
```

In the **font-family** field, you need to insert the name of your font, which can be copied from the embed code.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20549'%3E%3C/svg%3E)

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20754'%3E%3C/svg%3E)

9) Click **Publish** to apply the changes.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20485'%3E%3C/svg%3E)

10) You can open the portal and check that the fonts have been applied correctly.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20544'%3E%3C/svg%3E)
