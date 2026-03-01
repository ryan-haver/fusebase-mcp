---
title: "WebPage Context – create AI agent using page content"
url: "https://thefusebase.com/guides/fusebase-ai/webpage-context-create-ai-agent-using-page-content/"
section: "fusebase-ai"
lastScraped: "2026-02-28T21:27:17.070Z"
---

# WebPage Context – create AI agent using page content

As you know, you can use [AI agents](https://thefusebase.com/guides/fusebase-ai/ai-agents-quick-guide/) not only in the web client but also in our [browser extension](https://thefusebase.com/guides/fusebase-ai/fusebase-ai-assistant-browser-extension/). One of the major advantages of agents in the extension is their ability to understand the content of the current page you’re viewing, and we’ll show you how to successfully leverage this capability for your agents.

Let’s try creating an agent that can turn the current open page into a Q&A format. Speaking from my own experience, this is much more convenient and easier to digest than a standard summary. Essentially, it’s like a podcast—but in text form.

1) First, let’s create a new agent and give it a name and description if needed.

![](https://thefusebase.com/wp-content/uploads/2025/04/image-17-1024x649.png)

2) Next, we simply describe in the prompt what we want the agent to do—specifically, to analyze the content of the current page and turn it into questions and answers. How does the agent know the content of the page? For that, we need to include Webpage Context in the prompt. To do this, type @ and select Webpage Context.

![](https://thefusebase.com/wp-content/uploads/2025/04/image-18-1024x693.png)

In addition to the instruction itself, we also provide an example of the output we expect—let’s say, for an online store (but you can use your own example). The complete prompt might look like this –

**Analyze the content of the page @Webpage Content and create a list of questions that you think would be interesting to the user, along with the answers. For example, if it’s an e-commerce site, relevant questions might include:**

**General information about the product**

**Price of the product**

**Customer reviews**

**Delivery options**

**Return policy**

**Payment methods**

**Apply this logic based on the page content to generate useful questions and answers.**

And then, just click Publish Change.

![](https://thefusebase.com/wp-content/uploads/2025/04/image-19-1024x575.png)

3) Now let’s test how the new agent works. To do this, open the desired article and click on the agent from the list.

![](https://thefusebase.com/wp-content/uploads/2025/04/image-20-1024x556.png)

As a result, we’ll get a convenient summary of the article in the form of questions and answers. Super handy!

![](https://thefusebase.com/wp-content/uploads/2025/04/image-21-1024x553.png)
