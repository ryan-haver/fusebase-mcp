---
title: "Managing Members and Clients of an Organization via Fusebase CLI"
url: "https://thefusebase.com/guides/fusebase-vibe-code/managing-members-and-clients-of-an-organization-via-fusebase-cli"
section: "fusebase-vibe-code"
lastScraped: "2026-09-15T04:45:04.323Z"
---

# Managing Members and Clients of an Organization via Fusebase CLI

[Back to Fusebase Vibe Code](/guides/fusebase-vibe-code)

Fusebase Vibe Code

# Managing Members and Clients of an Organization via Fusebase CLI

Fusebase allows you to fine-tune access to features within the app, as well as fully manage members, including inviting new ones. What Fusebase CLI Can Currently Do for Managing...

Guide details

Published

March 31, 2026

Read time

5 min read

Category

Fusebase Vibe Code

In this guide

1.  [What Fusebase CLI Can Currently Do for Managing Organization Members:](#0-toc-title)
2.  [What use cases can be implemented in AI apps using the User API?](#1-toc-title)
3.  [Is it possible to grant access to a feature to specific roles?](#17-toc-title)
4.  [Is it possible to set up sending invites to an organization or portal through a feature?](#3-toc-title)
5.  [Is Magic Link support available for apps, as it is for portals?](#4-toc-title)
6.  [Can clients create accounts themselves?](#5-toc-title)
7.  [Is there an option to sign in to the app via Google or Microsoft?](#6-toc-title)
8.  [Is it possible to customize the appearance of emails sent when inviting users to the app?](#7-toc-title)

Fusebase allows you to fine-tune access to features within the app, as well as fully manage members, including inviting new ones.

## What Fusebase CLI Can Currently Do for Managing Organization Members:

-   Retrieve the list of organization members by roles.
-   Retrieve the list of workspace and portal members by roles.
-   Manage feature access by roles (for example, grant access only to members).
-   Send invites to new organization members with the ability to specify a role (manager, member, or custom role).
-   Add clients to a portal by sending a Magic Link.
-   Retrieve the list of members (emails and IDs) when using the Users column in the database;
-   Identify the emails of users who have accessed a feature and who are currently active on it;
-   etc.

## What use cases can be implemented in AI apps using the User API?

There are many possible use cases (limited only by your imagination). Here are a few examples:

-   Project management apps where you need to assign responsible team members at different stages of task execution, with notifications sent automatically.
-   E-signature apps that allow you to send documents for signing to selected clients.
-   Onboarding apps that enable you to customize the onboarding process for a specific user or role.
-   Group email notifications. For example, you can send tailored emails to portal clients upon request.
-   Membership features in apps — for instance, you can open a specific feature to all users, while granting access to others only after registration. And so on.

## Is it possible to grant access to a feature to specific roles?

Absolutely! For example, consider a ticketing system where there is a ticket management feature and a client-facing feature – creating and viewing tickets. Access to ticket management can be granted only to organization managers, while ticket creation can be available to any members and clients.

This is done using standard prompts. When creating a feature, simply instruct the agent: “**Only organization managers can access this feature**” or, for example, “**All members except clients can access this feature**” and so on.

You can read more about roles here: [https://thefusebase.com/guides/getting-started/key-role-differences/](/guides/getting-started/key-role-differences)

## Is it possible to set up sending invites to an organization or portal through a feature?

Yes, absolutely! For example, we created a chat feature for working with clients. By default, the chat displays the list of current members.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/03/image-43-1024x790.png)

However, if needed, you can send an invite to a new member.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/03/image-42-1024x587.png)

You just need to specify this in the feature requirements for the AI. For example, simply write:

**Add an Invite button that opens a popup where you can enter an email address. When clicking Invite, check if this user is already in the organization. If not, send an invitation to join the organization with the Member role. If the member already exists, display the corresponding message.**

## Is Magic Link support available for apps, as it is for portals?

Yes, Magic Link is a very convenient authentication method for clients – simply following the link grants access to the desired location. We already use [Magic Links in portals](/guides/client-portal/magic-links), and you can use them in apps in exactly the same way. You just need to specify this explicitly in your prompt; for example, “**send invites to the portal via Magic Link**” or “**add authentication to the app using Magic Link**” In this case, the client will receive a link via email, and by following it, they will be directed to the appropriate app (even to a specific page within the app) and will be automatically authenticated in their account.

It’s important to note that you can change the lifetime of a Magic Link. By default, a Magic Link is active for 24 hours after being sent. However, you can adjust this – either decrease or increase the link’s lifetime as needed (7 days maximum). This is done via a prompt. For example, you can say: “**Send invites using a Magic Link that should remain active for one week after being sent.**”

## Can clients create accounts themselves?

Yes, absolutely! You can add full authorization and registration with email and password to your apps. Currently, you can allow clients to:

-   Create new accounts (with email and password)
-   Add new clients to your organization with the appropriate role (Client, Member, or Manager)
-   After account creation, clients can be directed to the specific section of the app you specify
-   Clients can also reset their password if needed

You can also manage clients within the app, for example, by removing them from the organization. All of this is done through standard prompts, for example:

**Create an authorization form on the page where users need to enter their email and password. After creating an account, the client should be added to the organization with the Client role and granted access to the Games section.**

It is important to note that if you add a registration form directly to your app, the app must have public status so that anonymous visitors can access the registration form. If your prompt is set up correctly, the agent will usually make the app public automatically. However, you can also request this from the agent yourself or set it manually on the app page.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/03/image-73-1024x441.png)

## Is there an option to sign in to the app via Google or Microsoft?

Yes, of course. You can ask the agent to add this type of authentication or registration to your app.

For example, the prompt could be:

**Add sign-in and registration to the app using email and password. Also add Google/Microsoft sign-in for quick authentication or registration.**

In this case, the app will have ready-made integrations with Google/Microsoft built in.

![](/hosting-assets/legacy/thefusebase/wp-content/uploads/2026/03/image-74-1024x866.png)

## Is it possible to customize the appearance of emails sent when inviting users to the app?

Yes, we offer fully white-labeled emails for apps, including magic links, invitations, and password resets. You just need to describe the desired appearance and content of the email to the agent (including localization).
