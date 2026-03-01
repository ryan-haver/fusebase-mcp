---
title: "Auto-Creation of a Portal for New HubSpot Contacts with Personalized Ticket Display"
url: "https://thefusebase.com/guides/automations-and-integrations/auto-creation-of-a-portal-for-new-hubspot-contacts-with-personalized-ticket-display/"
section: "automations-and-integrations"
lastScraped: "2026-02-28T21:27:35.218Z"
---

# Auto-Creation of a Portal for New HubSpot Contacts with Personalized Ticket Display

As you know, in our service, you can add a [block](https://thefusebase.com/guides/client-portal/displaying-data-from-other-services-hubspot-asana-etc-in-the-portal/) to the portal that displays information from HubSpot, such as tasks or tickets.

Now, let’s consider the following case: we want a new portal to be created for each new HubSpot client, containing a block that displays tickets from HubSpot. Moreover, only tickets associated with the client’s company should be shown.

This is an interesting task, and it is easy to implement in FuseBase.

1) First, you need to create a portal with a block that displays tickets from HubSpot. You can find a detailed guide [here](https://thefusebase.com/guides/client-portal/displaying-data-from-other-services-hubspot-asana-etc-in-the-portal/). This portal will be used as the template.

2) Next, go to our [automation module](https://thefusebase.com/guides/automations-and-integrations/fusebase-automation-quick-guide/).

3) Create a new flow and select **HubSpot -> New Contact Added** as the trigger.

4) In properties, select the output Primary Associated Company ID. This is needed to pass the Company ID to the widget to filter tickets.

Click Load Data to retrieve test data.

![](https://thefusebase.com/wp-content/uploads/2025/02/slide-1.png)

5) Next, you need to create a portal with a ticket block. Create a new action: **FuseBase -> Create new portal**. Select the **source portal** with the **HubSpot block** as the template.

![](https://thefusebase.com/wp-content/uploads/2025/02/image-22.png)

6) In the **HubSpot parameter**, choose **Company ID** from the trigger. This parameter is responsible for filtering the data in the block by the required company.

![](https://thefusebase.com/wp-content/uploads/2025/02/image-23.png)

7) After creating the portal, we need to **invite the client** to it. To do this, add the action: **FuseBase -> Invite client to portal**.

8) In the **Email** parameter, select the **contact’s email** from the trigger.

![](https://thefusebase.com/wp-content/uploads/2025/02/image-24.png)

9) In the **Portal** parameter, choose the **portal created in the previous action**.

![](https://thefusebase.com/wp-content/uploads/2025/02/image-25.png)

10) Next, click **Publish** to activate the flow.

![](https://thefusebase.com/wp-content/uploads/2025/02/image-26.png)

Everything is ready! Now, for each new contact in **HubSpot**, a **new portal** will be created with a block that displays **tickets filtered by the client’s company**.
