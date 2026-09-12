---
title: "Tip: How to change the image on the Login page"
url: "https://thefusebase.com/guides/client-portal/tip-how-to-change-the-image-on-the-auth-page/"
section: "client-portal"
lastScraped: "2026-09-12T05:17:02.913Z"
---

# Tip: How to change the image on the Login page

If you need a custom image on the login page of the portal, this can be easily done through custom styles.

![](https://thefusebase.com/wp-content/uploads/2025/10/image-13-1024x538.png)

1) Go to Custom Code.

![](https://thefusebase.com/wp-content/uploads/2025/10/image-14-1024x522.png)

2) Add this code in Custom Style and save and publish it (Important: replace the link with the link to your image.)

```
<style>
.bg-error-layout {
      background-image: url("https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D");
}
.bg-error-layout img {
      display: none;
}
</style>
```

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20696'%3E%3C/svg%3E)

3) That’s it, you’re all set!

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20536'%3E%3C/svg%3E)
