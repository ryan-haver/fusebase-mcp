---
title: "Custom Subdomains (CNAME)"
url: "https://thefusebase.com/guides/branding/custom-subdomains-cname/"
section: "branding"
lastScraped: "2026-09-12T05:18:06.103Z"
---

# Custom Subdomains (CNAME)

## Introduction: Why do you need Custom Subdomain (CNAME)? [#](#b130267691_24)

By default, after you create an organization, you get a subdomain of the format “**yourcompany.nimbusweb.me**“

Optionally, you can add your personal domain. Then the web client and public pages will be displayed on a subdomain like “**mynotes.mydomain.com**“. For such purposes, there are CNAME records.

You can also add your own personalized [branding](https://thefusebase.com/guides/organization/business-teams-account-branding/).

## Adding a subdomain to your Fusebase account [#](#b1472408971_11746)

As the look may differ based on your domain registrar, adding a subdomain to your [Fusebase](https://thefusebase.com/note/) account **usually** requires the following steps.

1\. Click on the settings icon and select Custom Domain.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20542'%3E%3C/svg%3E)

2\. In the **Enter your custom domain** input field, enter your desired subdomain (make sure to include the subdomain together with your domain), for example: `org.example.com`, and save the changes.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20643'%3E%3C/svg%3E)

3\. Copy the URL of your current subdomain on nimbusweb.me. This will be needed for adding the CNAME.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20651'%3E%3C/svg%3E)

4\. Log in to your domain registrar.

5\. Find the **DNS records** for the domain you would like to add a subdomain to.

6\. Create a **CNAME** record that points your desired subdomain to your FuseBase URL. The following screenshot from GoDaddy serves as an example of how it may look on your domain registrar.

For example. Your website is example.com and you want FuseBase to be on your subdomain org.example.com in HOST filed you put “org” and in POINTS TO filed you put “nimbus-sales.nimbusweb.me”

Please note: in very rare cases in HOST filed you need to put org.example.com instead of just subdomain “org” . You console will point it out for you.

![Adding a subdomain to your Nimbus Note account](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

7\. After you have added the CNAME record, click Verify DNS and wait until it becomes active.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20654'%3E%3C/svg%3E)

## Check Domain Propagation Status [#](#b1472408971_11844)

It can take between 24 and 48 hours for your new domain to fully start working—a period called domain propagation. During this period, your visitors may not be directed to your new domain right away. You can check the current status of your domain’s DNS propagation by visiting this [DNS Propagation Checker](https://www.whatsmydns.net/) tool. After domain propagation, you should be directed to your new “**your-subdomain”** when you visit your new domain. If it takes more than 72 hours, [contact Customer Care.](https://support.nimbusweb.co/portal/en/newticket)

## How to add CNAME via DirectAdmin [#](#b3821783491_635)

In case you have NS-servers set in your registrar, then you should add CNAME records via your hosting panel, for example in DirectAdmin.

1) Open domain control panel in DirectAdmin and click DNS Management.

![How to add CNAME via DirectAdmin](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

2) Input necessary data into CNAME fields. The left field is for subdomain names. For instance, if you have pages.yourdomain.com, then you should enter “pages” as the name. In the True values field, you should add the link to your subdomain in FuseBase—for example, your-company.nimbusweb.me. (with a dot at the end). Then press the Add button and wait for DNS records to be updated (which usually takes around 1-2 hours).

![How to add CNAME via DirectAdmin](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

## How to add CNAME via Cpanel [#](#b3821783491_677)

1) Log in to Cpanel with your account.

2) Under the “Domains” section, click on the “Simple DNS Zone Editor” icon.

3) Select your domain from the drop-down menu.

4) Choose CNAME and click Add Record.

![How to add CNAME via Cpanel](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

5) Fill in the Name field with the same URL you used in the Custom domain field.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20661'%3E%3C/svg%3E)

It’s necessary to put a dot at the end. For example nimbus.mycompany.com.

In the CNAME field, fill the URL of your subdomain with nimbusweb.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201024%20649'%3E%3C/svg%3E)

For example mycompany.nimbusweb.me

6) Then click Add CNAME Record –

![How to add CNAME via Cpanel](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

## More Links [#](#b1472408971_11906)

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

## Cloudflare [#](#6-toc-title)

**Pay attention if you have a domain on CloudFlare!**

If you use Cloudflare to manage domains, remember to turn off proxying when you add a CNAME record.

![](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%200%200'%3E%3C/svg%3E)

If proxying is not disabled, it can negatively affect the client’s performance.
