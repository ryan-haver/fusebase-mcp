---
title: "Custom Domain Name with FuseBase Portal"
url: "https://thefusebase.com/guides/client-portal/portal-guide-custom-domain-name-with-fusebase-portal/"
section: "client-portal"
lastScraped: "2026-09-12T05:17:16.209Z"
---

# Custom Domain Name with FuseBase Portal

Before setting the portal with Custom Domain, you need to configure the Custom Domain for your organization. You can find more information in our guides: [https://thefusebase.com/guides/](https://thefusebase.com/guides/)

If you want to use your own domain name, and you have access to your registrar’s dashboard / DNS control panel, you can easily connect your custom URL to the portal. In order to do so, please follow these steps:

1\. Click on the icon + and choose “New Portal” and the workspace you need.

![](https://thefusebase.com/wp-content/uploads/2023/11/image-1-1-1024x489.png)

2\. The window with the wizard will appear.

3\. Enter the title of your portal and the domain you want to use as in the example below. It may be any valid FQDN.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20487'%3E%3C/svg%3E)

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

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20484'%3E%3C/svg%3E)

## I want to create many portals, and do I need to manually set up CNAME for each one? This is time-consuming and complicated! [#](#0-toc-title)

For users who create multiple portals using CNAME, we offer a feature called Wild Card. This allows automatic activation of portals on CNAME immediately after setup, without the need to manually add DNS records. However, it is important to note that in this case, all new subdomains at this level are automatically created as portals. Therefore, if you need to use subdomains at the \*.yourdomain.com level for purposes other than portals, we recommend applying the wildcard to the 4th-level domain or higher, such as \*.p.yourdomain.com.

## How do I activate Wild Card? [#](#1-toc-title)

1) Go to your organization settings and click on Wildcard domain –

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20536'%3E%3C/svg%3E)

2) Next, click on Add wildcard domain –

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20580'%3E%3C/svg%3E)

3) Next, specify the domain or subdomain for the portals. For example, if you want the portals to be in the format clients.portals.x2t.com, you should add portals.x2t.com.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20946%20740'%3E%3C/svg%3E)

4) Next, you need to copy and add the CNAME records to your domain registrar or hosting provider.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20575'%3E%3C/svg%3E)

5) After adding the records, you need to wait for them to be activated. From time to time, you can click on Recheck to verify the activation status.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20578'%3E%3C/svg%3E)

After successful activation, the status will change to Active.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20576'%3E%3C/svg%3E)

Next, when creating a portal, simply select the desired Wild Card domain and specify the subdomain. After the portal is created, the subdomain will be activated automatically.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20624'%3E%3C/svg%3E)
