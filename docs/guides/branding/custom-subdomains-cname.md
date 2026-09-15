---
title: "Custom Subdomains (CNAME)"
url: "https://thefusebase.com/guides/branding/custom-subdomains-cname"
section: "branding"
lastScraped: "2026-09-15T04:44:47.067Z"
---

# Custom Subdomains (CNAME)

[Back to Branding/White Label](/guides/branding)

Branding/White Label

# Custom Subdomains (CNAME)

By default, after you create an organization, you get a subdomain of the format "yourcompany.nimbusweb.me" Optionally, you can add your personal domain.

Guide details

Published

August 31, 2022

Read time

4 min read

Category

Branding/White Label

In this guide

1.  [Introduction: Why do you need Custom Subdomain (CNAME)?](#b130267691_24)
2.  [Adding a subdomain to your Fusebase account](#b1472408971_11746)
3.  [Check Domain Propagation Status](#b1472408971_11844)
4.  [How to add CNAME via DirectAdmin](#b3821783491_635)
5.  [How to add CNAME via Cpanel](#b3821783491_677)
6.  [More Links](#b1472408971_11906)
7.  [Cloudflare](#6-toc-title)

## Introduction: Why do you need Custom Subdomain (CNAME)?

By default, after you create an organization, you get a subdomain of the format “**yourcompany.nimbusweb.me**“

Optionally, you can add your personal domain. Then the web client and public pages will be displayed on a subdomain like “**mynotes.mydomain.com**“. For such purposes, there are CNAME records.

You can also add your own personalized [branding](/guides/organization/business-teams-account-branding).

## Adding a subdomain to your Fusebase account

As the look may differ based on your domain registrar, adding a subdomain to your [Fusebase](https://thefusebase.com/note/) account **usually** requires the following steps.

1\. Click on the settings icon and select Custom Domain.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2022/08/image-39-1024x542.png)

2\. In the **Enter your custom domain** input field, enter your desired subdomain (make sure to include the subdomain together with your domain), for example: `org.example.com`, and save the changes.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2022/08/image-40-1024x643.png)

3\. Copy the URL of your current subdomain on nimbusweb.me. This will be needed for adding the CNAME.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2022/08/image-41-1024x651.png)

4\. Log in to your domain registrar.

5\. Find the **DNS records** for the domain you would like to add a subdomain to.

6\. Create a **CNAME** record that points your desired subdomain to your FuseBase URL. The following screenshot from GoDaddy serves as an example of how it may look on your domain registrar.

For example. Your website is example.com and you want FuseBase to be on your subdomain org.example.com in HOST filed you put “org” and in POINTS TO filed you put “nimbus-sales.nimbusweb.me”

Please note: in very rare cases in HOST filed you need to put org.example.com instead of just subdomain “org” . You console will point it out for you.

![Adding a subdomain to your Nimbus Note account](/hosting-assets/legacy/thefusebase/box/attachment/4488155/w5kcd39m0no48erur41e/rsPNt57WeGVppX1E/preview.png)

7\. After you have added the CNAME record, click Verify DNS and wait until it becomes active.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2022/08/image-42-1024x654.png)

## Check Domain Propagation Status

It can take between 24 and 48 hours for your new domain to fully start working—a period called domain propagation. During this period, your visitors may not be directed to your new domain right away. You can check the current status of your domain’s DNS propagation by visiting this [DNS Propagation Checker](https://www.whatsmydns.net/) tool. After domain propagation, you should be directed to your new “**your-subdomain”** when you visit your new domain. If it takes more than 72 hours, [contact Customer Care.](https://support.nimbusweb.co/portal/en/newticket)

## How to add CNAME via DirectAdmin

In case you have NS-servers set in your registrar, then you should add CNAME records via your hosting panel, for example in DirectAdmin.

1) Open domain control panel in DirectAdmin and click DNS Management.

![How to add CNAME via DirectAdmin](/hosting-assets/legacy/thefusebase/box/attachment/4488155/w5kcd39m0no48erur41e/EmJ6HJRMpoLCLJUf/image.png)

2) Input necessary data into CNAME fields. The left field is for subdomain names. For instance, if you have pages.yourdomain.com, then you should enter “pages” as the name. In the True values field, you should add the link to your subdomain in FuseBase—for example, your-company.nimbusweb.me. (with a dot at the end). Then press the Add button and wait for DNS records to be updated (which usually takes around 1-2 hours).

![How to add CNAME via DirectAdmin](/hosting-assets/legacy/thefusebase/box/attachment/4488155/w5kcd39m0no48erur41e/aHgrcpFJ7pMUU3Rz/image.png)

## How to add CNAME via Cpanel

1) Log in to Cpanel with your account.

2) Under the “Domains” section, click on the “Simple DNS Zone Editor” icon.

3) Select your domain from the drop-down menu.

4) Choose CNAME and click Add Record.

![How to add CNAME via Cpanel](/hosting-assets/legacy/thefusebase/box/attachment/4488155/w5kcd39m0no48erur41e/4BoVUOc3Kp65R4aB/изображение.png)

5) Fill in the Name field with the same URL you used in the Custom domain field.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2022/08/image-43-1024x661.png)

It’s necessary to put a dot at the end. For example nimbus.mycompany.com.

In the CNAME field, fill the URL of your subdomain with nimbusweb.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2022/08/image-44-1024x649.png)

For example mycompany.nimbusweb.me

6) Then click Add CNAME Record –

![How to add CNAME via Cpanel](/hosting-assets/legacy/thefusebase/box/attachment/4488155/w5kcd39m0no48erur41e/TnmPuLhIwI6pJGoq/изображение.png)

## More Links

[Godaddy – how to add CNAME for subdomain](https://www.godaddy.com/help/add-a-cname-record-19236)

[Namecheap – how to add CNAME for subdomain](https://www.namecheap.com/support/knowledgebase/article.aspx/9776/2237/how-to-create-a-subdomain-for-my-domain)

[Getresponse – how to add CNAME for subdomain](https://www.namecheap.com/support/knowledgebase/article.aspx/9776/2237/how-to-create-a-subdomain-for-my-domain)

[Ionos – how to add CNAME for subdomain](https://www.ionos.com/help/domains/configuring-cname-records-for-subdomains/configuring-a-cname-record-for-a-subdomain/)

[Getomnify – how to add CNAME for subdomain](https://support.getomnify.com/en/articles/1346693-set-up-a-custom-subdomain-domain-using-a-cname)

[Web24 – how to add CNAME for subdomain](https://www.web24.com.au/tutorials/cname-records-used)

[Ubnbounce – how to add CNAME for subdomain](https://documentation.unbounce.com/hc/en-us/articles/203687294-Setting-Up-Your-CNAME-with-BlueHost)

[Google – how to add CNAME for subdomain](https://support.google.com/domains/answer/9211383?hl=en)

[Bluehost – how to add CNAME for subdomain](https://www.bluehost.com/help/article/dns-records-explained)

[Namecheap – how to add CNAME for subdomain](https://www.namecheap.com/support/knowledgebase/article.aspx/9646/2237/how-to-create-a-cname-record-for-your-domain)

[Name.com – how to add CNAME for subdomain](https://www.name.com/support/articles/115004895548-Adding-a-CNAME-Record)

[iwantmyname – how to add CNAME for subdomain](https://help.iwantmyname.com/hc/en-gb/articles/360014832917-How-do-I-add-a-wildcard-subdomain-DNS-record-)

[Drift – how to add CNAME for subdomain](https://gethelp.drift.com/hc/en-us/articles/360019350914-How-to-Enable-a-Custom-Subdomain-Name-for-Your-Landing-Pages)

[Dreamhost – how to add CNAME for subdomain](https://help.dreamhost.com/hc/en-us/articles/360035516812)

## Cloudflare

**Pay attention if you have a domain on CloudFlare!**

If you use Cloudflare to manage domains, remember to turn off proxying when you add a CNAME record.

![](/hosting-assets/legacy/thefusebase/box/attachment/8880643/05sr0fzvfnrmhtxgp7s7/As64EwdWmj2PkXVL/4PMQjD9l4Q.gif)

If proxying is not disabled, it can negatively affect the client’s performance.
