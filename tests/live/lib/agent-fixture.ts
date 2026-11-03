import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildClient } from '../../../src/client-factory.js';
import { assert, assertArray, assertEqual, assertString, callTool, verifyWrite } from './harness.js';

/** Exercise real responses and source retrieval using an agent created only for this run. */
export async function verifyExecutableAgent(client: Client, workspaceId: string): Promise<void> {
  const api = buildClient();
  // Fixture lifecycle and independent read-back use the same official web endpoints as
  // the customizer. Execution itself must go through the built MCP tools under test.
  const request = (api as unknown as { request(path: string, options?: object): Promise<any> }).request.bind(api);
  const orgId = process.env.FUSEBASE_ORG_ID;
  assertString(orgId, 'configured organization');
  const root = `/v4/api/proxy/ai-service/v1/orgs/${encodeURIComponent(orgId)}/agents`;
  const marker = `QA Agent Validation ${Date.now()}`;
  const journal: Record<string, unknown> = { marker, workspaceId, orgId };
  mkdirSync('scratch', { recursive: true });
  const journalPath = `scratch/agent-validation-${Date.now()}.json`;
  const save = () => writeFileSync(journalPath, JSON.stringify(journal, null, 2));
  save();
  let agentId: string | undefined;
  try {
    const config = {
      title: marker, description: 'Disposable QA agent', workspaceId, inputs: [], sources: [],
      systemPrompt: 'Follow instructions exactly. Answer in text without external actions.',
      webSearch: false, runButtonTitle: 'Validate', llmMode: 'auto', isPublic: false,
      permissions: { allowAll: true, rejectAll: false, allowUserIds: [], rejectUserIds: [] }, adminSettings: {},
    };
    const agent = await request(root, { method: 'POST', body: JSON.stringify(config) });
    assertString(agent.globalId, 'created QA agent ID');
    agentId = agent.globalId;
    journal.agentId = agentId; save();
    assert((await api.listAgents()).some(a => a.globalId === agentId && a.title === marker), 'created QA agent appears in fresh listing');
    const run = await callTool(client, 'fusebase_work_run_agent', {
      workspaceId, agentId, prompt: `Reply with exactly ${marker}:391`,
    }, { timeoutMs: 300_000 });
    journal.threadId = run.threadId; save();
    assertEqual(run.status, 'completed', 'agent completion status');
    assertEqual(run.text, `${marker}:391`, 'agent answer');
    const verifySaved = async (threadId: string, text: string) => {
      const threads = await callTool(client, 'list_ai_agent_threads', { agentId });
      assertArray(threads, 'MCP thread read-back');
      assert(threads.some((thread: { id: string }) => thread.id === threadId), 'MCP listing includes the executed thread');
      const saved = await request(`/ai-assistant/rest/org/${encodeURIComponent(orgId)}/threads/${encodeURIComponent(threadId)}/agent-messages?input=true`);
      assertArray(saved.messages, 'saved agent messages');
      assert(saved.messages.some((m: any) => m.role === 'assistant' && m.text === text), 'fresh stored assistant answer matches completed response');
    };
    await verifyWrite('fusebase_work_run_agent', 'completed answer is persisted', () => verifySaved(run.threadId, run.text));
    const continued = await callTool(client, 'fusebase_work_run_agent', {
      workspaceId, agentId, threadId: run.threadId, prompt: `Reply with exactly ${marker}:CONTINUED`,
    }, { timeoutMs: 300_000 });
    assertEqual(continued.threadId, run.threadId, 'continued conversation ID');
    assertEqual(continued.text, `${marker}:CONTINUED`, 'continued answer');
    await verifyWrite('fusebase_work_run_agent', 'continued answer is persisted', () => verifySaved(continued.threadId, continued.text));

    const { workspaceId: _creationWorkspace, ...editableConfig } = config;
    await request(`${root}/${agentId}`, { method: 'PUT', body: JSON.stringify({
      ...editableConfig, webSearch: true,
      systemPrompt: 'Use web tools to retrieve the exact target URL. Extract only the fetched content, never memory or guesses. Report retrieval failures.',
    }) });
    assert((await api.listAgents()).find(a => a.globalId === agentId)?.webSearch === true, 'QA agent web fetching is enabled');
    const url = 'https://httpbin.org/html';
    const scrape = await callTool(client, 'fusebase_work_scrape_url', {
      workspaceId, agentId, url,
      prompt: 'Retrieve this exact URL now with your web tool. Return the heading and first two sentences verbatim as markdown, followed by the source URL. Report any fetch failure.',
    }, { timeoutMs: 300_000 });
    journal.scrapeThreadId = scrape.threadId; save();
    assertEqual(scrape.status, 'completed', 'scraping completion status');
    assert(scrape.events.some((e: any) => e.type === 'toolCall' && e.content?.name === 'scrape_web_page' && e.content.parameters?.url === url), 'upstream emitted a scrape call for the exact target URL');
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    assert(response.ok, 'independent source fetch succeeded');
    const source = await response.text();
    const paragraph = source.match(/<p>([\s\S]*?)<\/p>/i)?.[1].replace(/\s+/g, ' ').trim();
    assertString(paragraph, 'source paragraph');
    const expected = paragraph.split(/(?<=\.)\s+/).slice(0, 2).join(' ');
    assert(scrape.text.replace(/\s+/g, ' ').includes(expected), 'scraped sentences match independent source fetch');
    await verifyWrite('fusebase_work_scrape_url', 'fetched content is persisted', () => verifySaved(scrape.threadId, scrape.text));
    journal.executionVerified = true; journal.scrapingVerified = true; save();
  } finally {
    if (agentId) {
      const owned = (await api.listAgents()).find(a => a.globalId === agentId);
      assert(owned?.title === marker, 'cleanup targets the exact QA agent');
      const threads = await api.listAiAgentThreads(agentId);
      assertArray(threads, 'QA agent thread list');
      for (const thread of threads as Array<{ id: string }>) {
        assertString(thread.id, 'QA thread ID');
        await request(`/ai-assistant/rest/orgs/${encodeURIComponent(orgId)}/agent-threads/${encodeURIComponent(thread.id)}`, { method: 'DELETE' });
      }
      assertEqual((await api.listAiAgentThreads(agentId)).length, 0, 'QA threads removed');
      await request(`${root}/${agentId}`, { method: 'DELETE' });
      assert(!(await api.listAgents()).some(a => a.globalId === agentId), 'QA agent removed');
      journal.cleanupVerified = true; save();
    }
  }
}
