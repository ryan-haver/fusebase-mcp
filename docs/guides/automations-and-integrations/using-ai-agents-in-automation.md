---
title: "Using AI Agents in Automation"
url: "https://thefusebase.com/guides/automations-and-integrations/using-ai-agents-in-automation/"
section: "automations-and-integrations"
lastScraped: "2026-02-28T21:27:35.146Z"
---

# Using AI Agents in Automation

Not long ago, we released our [AI agents](https://thefusebase.com/guides/fusebase-ai/ai-agents-quick-guide/)—designed to help with a wide range of routine tasks. But you can go beyond using them individually by creating entire agent systems through our automation module.

To enable this, we’ve added a new action – FuseBase Agents – where you can select the agent you need to work as part of your automation flow.

Let’s try to build a simple automation. As a business, it’s very important for me to stay updated on what’s happening with competitors, but visiting their websites and checking blogs and releases every time takes a lot of time. So, I’ll create an agent that will check the main competitors’ websites for news and set up a flow that runs the agent every week and sends the news to a Slack channel.

## **Creating an Agent for Competitor Research** [#](#0-toc-title)

First, you need to create an agent. To do this, go to the Agents page and create a new one.

Give your agent a name and a description.

![](https://thefusebase.com/wp-content/uploads/2025/04/image-31-1024x834.png)

In the prompt, we need to clearly specify what we want. State directly that we want to gather all the latest news about competitors from their websites and blogs. List the competitors and the desired output format. Here’s an example prompt:

**We need all the latest updates about our competitors:**

**List of Competitors**

**When launched, you must perform a sequential search for each competitor and provide news and updates from the past week. Priority should be given to: press releases and feature updates.**

**Format:  
Product name  
List of news in bullet format. + show the source link for each news item.**

Don’t forget to activate the web search switcher. This will allow the agent to access the internet to search for information.

![](https://thefusebase.com/wp-content/uploads/2025/04/image-33-896x1024.png)

Next, publish the agent.

## Creating the Automation Flow [#](#1-toc-title)

Now, we need to create an automation flow. Go to the Automation section and create a new flow.

1) For the trigger, select Scheduler and set it to run once a week.

![](https://thefusebase.com/wp-content/uploads/2025/04/image-34-1024x591.png)

2) Next, add our new agent as the first action. To do this, select Fusebase AI Agents. Then, choose Call agent -> select the agent you created.

![](https://thefusebase.com/wp-content/uploads/2025/04/image-35-1024x659.png)

For the response format, select Markdown. Don’t forget to click Step test or Load data to fetch the data for the next step.

![](https://thefusebase.com/wp-content/uploads/2025/04/image-36-1024x716.png)

If you get an empty response during **Load Data**, don’t worry – this is normal and sufficient for passing data to the next action.

When using **Load Data**, we only retrieve variables but do not actually run the agent. Otherwise, data retrieval could take a long time, as agents may include their own integrations, reasoning, etc.

3) The next step will be sending the update to Slack. To do this, choose Slack from the actions list and authorize your account.

For the action, select Send a message to either a channel or a user, depending on your preference. Then, choose the desired channel or member.

![](https://thefusebase.com/wp-content/uploads/2025/04/image-39-1024x704.png)

In the Message field, insert the response from the agent.

![](https://thefusebase.com/wp-content/uploads/2025/04/image-40-1024x730.png)

For the Username, enter any name you prefer, and then publish the flow. The flow is now published, and once a week, you’ll receive the latest news from your competitors.
