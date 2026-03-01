---
title: "Custom SMTP"
url: "https://thefusebase.com/guides/branding/custom-smtp/"
section: "branding"
lastScraped: "2026-02-28T21:27:25.657Z"
---

# Custom SMTP

By default, email messages to members of your organization are sent under the name FuseBase. However, you can connect your SMTP server to FuseBase, and all messages from the organization (for example, invites or mentions) will be sent from your email address and name.

## Custom SMTP server [#](#b3050113305_541)

Members of your organization will receive emails from your professional email address!

Connect your SMTP server to FuseBase and then all messages from the organization workspace (for example, invites or mentions) will be sent from your email address and name.

Provide your clients and teams with a powerful on-brand experience and set yourself apart from others!

[Embedded content](https://www.youtube.com/embed/SELELB0I7QM?feature=oembed)

**Please note:** this feature is a part of the White-Label solution.

## What Is SMTP And How To Set It Up? [#](#b1040013840_288)

An SMTP server is used to transmit e-mail for information exchange on the Internet.

If you don’t have your own SMTP server yet, you can configure it. Here are some articles that you can read about setting up your SMTP server:

-   [How to configure an SMTP server](https://www.serversmtp.com/smtp-configuration/)
-   [Set Up SMTP Server – A Step-By-Step Tutorial](https://mailtrap.io/blog/setup-smtp-server/)
-   [Gmail SMTP Server (Google) – How to Configure & Send Emails for Free?](https://www.siteground.com/kb/gmail-smtp-server/)
-   [Hotmail SMTP configuration](https://serversmtp.com/smtp-hotmail/)

We do not recommend using Yahoo’s SMTP due to the technical peculiarities of its implementation.

## How To Add Your SMTP Server To FuseBase [#](#b1040013840_619)

Let’s assume that you already have an SMTP server and you know its settings. Now let’s try to add it to FuseBase.

1) Go to your organization’s settings – [https://teams.nimbusweb.me](https://teams.nimbusweb.me/)

2) In the SMTP server option, select **Custom Server**:

![](https://thefusebase.com/wp-content/uploads/2022/08/image-32-1024x982.png)

3) The server settings will open, where you will need to **fill in** the following data:

-   Server address – SMTP server address.
-   Port – server port.
-   Login / Password – login and password to the SMTP server (all data is encrypted)
-   Sender email – the email address from which emails will be sent to members of the organization. We highly recommend using the same email that you specified for the login.
-   Sender name – The name that will be specified as the Sender.
-   Type – here you need to select the type of connection. Usually, this is SSL.

After all the data is entered, click on **Save** to save the server settings. Now, you can check the SMTP server – for this, for example, you can mention any workspace member in a page and check from which email the notification was received.

![After all the data is entered, click on Save to save the server settings. ](https://app.nimbusweb.me/box/attachment/5626371/xv63rg7xptrolhg58lbg/wTvRdGaC4GvnykQG/image.png)

### How to change SMTP server settings? [#](#b1040013840_1785)

It’s very easy to do this! Open your organization’s settings again and click on **Open Settings**, then change the settings to the desired ones.

![](https://thefusebase.com/wp-content/uploads/2022/08/image-33-938x1024.png)

### How do you return to SMTP from FuseBase? [#](#b1040013840_1987)

If you don’t want to use your SMTP server, then you can return to the SMTP server from FuseBase. To do this, you need to open the settings of your organization and switch to **FuseBase Server**, and then save the changes.

![](https://thefusebase.com/wp-content/uploads/2022/08/image-34-796x1024.png)

## SMTP From Gmail/GSuite Does Not Work For Me. Why? [#](#b1658079541_0)

Most likely, you have not enabled IMAP, or security settings are not configured.

### Turn on IMAP [#](#b1658079541_198)

-   Open your Gmail and click on the settings icon. Next, select See all settings –

![](https://thefusebase.com/wp-content/uploads/2022/08/image-35.png)

2) Open the Forwarding and POP / IMAP tab and enable IMAP –

![Open the Forwarding and POP / IMAP tab and enable IMAP -](https://app.nimbusweb.me/box/attachment/5626371/xv63rg7xptrolhg58lbg/yrwSQ65Egmy8KDOO/image.png)

3) Save changes –

![Save changes](https://app.nimbusweb.me/box/attachment/5626371/xv63rg7xptrolhg58lbg/x9f2gAW9eS7HnGMw/image.png)

### Ensure your account is properly configured [#](#7-toc-title)

If you are experiencing issues with SMTP from GSuite/Gmail, ensure that two conditions are met for it to work correctly:

1.  You need to have two-factor authentication enabled on your account. You can enable this by visiting the following page: [Turn on 2-Step Verification](https://support.google.com/accounts/answer/185839?hl=en).
2.  You must enable App Password and use it as your password when setting up SMTP in FuseBase. To enable App Password, follow the instructions: [Sign in with app passwords](https://support.google.com/accounts/answer/185833).

By following these two conditions, you’ll be able to send and receive emails with ease.

## I have set up a custom SMTP, but your logo still appears in the email. How can I change this? [#](#8-toc-title)

This is the organization logo, and you can update it. You can find all the necessary information in this guide: [https://thefusebase.com/guides/branding/organization-logo/](https://thefusebase.com/guides/branding/organization-logo/)
