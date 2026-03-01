---
title: "Custom Domain Name with FuseBase Portal"
url: "https://thefusebase.com/guides/client-portal/portal-guide-custom-domain-name-with-fusebase-portal/"
section: "client-portal"
lastScraped: "2026-02-28T21:26:53.095Z"
---

# Custom Domain Name with FuseBase Portal

Before setting the portal with Custom Domain, you need to configure the Custom Domain for your organization. You can find more information in our guides: [https://thefusebase.com/guides/](https://thefusebase.com/guides/)

If you want to use your own domain name, and you have access to your registrar’s dashboard / DNS control panel, you can easily connect your custom URL to the portal. In order to do so, please follow these steps:

1\. Click on the icon + and choose “New Portal” and the workspace you need.

![](https://thefusebase.com/wp-content/uploads/2023/11/image-1-1-1024x489.png)

2\. The window with the wizard will appear.

3\. Enter the title of your portal and the domain you want to use as in the example below. It may be any valid FQDN.

![](https://thefusebase.com/wp-content/uploads/2023/11/image-2-1-1024x487.png)

🚩Your portal hasn’t been ready yet. You need to configure CNAME records to finish creating the portal.

4\. Complete the wizard and you will be redirected to the Buider Console. You can find more information [how to complete the Wizard here.](https://thefusebase.com/guides/client-portal/creation/)

5\. Here you can see the message, click on the **“Activate Cname”** and the window with the DNS settings will be opened.

6\. Login into your domain’s registrar control panel.

7\. Go to `Domain List` → click on `your-company-name.com` → click on `DNS Zone Settings`

8\. Click on `Add New DNS Record` link and Choose the type CNAME.

9\. In the dialogue **Proceed to configurations** copy the Name and Value.

10\. Paste it to the value in your domain’s registrar control panel. `TTL has to be a default value`

11\. Once done, click on the `Save` button. The first CNAME record is successfully created.

12\. Follow the same steps with the second CNAME record in the dialogue

🚩The DNS records are valid for 72 hours. Configure your DNS records in the domain’s registrar control panel during 72 hours.

🚩Once the CNAME records are created in the domain’s registrar control panel, the process of setting up is started. When the portal is ready, a message will disappear. 

![](https://thefusebase.com/wp-content/uploads/2023/11/image-3-1-1024x484.png)

## I want to create many portals, and do I need to manually set up CNAME for each one? This is time-consuming and complicated! [#](#0-toc-title)

For users who create multiple portals using CNAME, we offer a test-mode feature called Wild Card. This allows automatic activation of portals on CNAME immediately after setup, without the need to manually add DNS records. However, it is important to note that in this case, all new subdomains at this level are automatically created as portals. Therefore, if you need to use subdomains at the \*.yourdomain.com level for purposes other than portals, we recommend applying the wildcard to the 4th-level domain or higher, such as \*.p.yourdomain.com.

If you are interested in this functionality, please contact us at [contact@thefusebase.com](mailto:contact@thefusebase.com).
