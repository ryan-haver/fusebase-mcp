import { describe, expect, it, vi } from 'vitest';
import { parseAgentStream } from '../../src/agent-stream.js';
import { FusebaseClient } from '../../src/client.js';

const end = '[FULL]{}[!FULLEND]';
describe('agent completion evidence', () => {
  it('aggregates text and preserves citations and stored-message identifiers', () => {
    const raw = [
      { t: 'responseMessage', c: { id: 'message1' } },
      { t: 'text', c: 'Hello ' },
      { t: 'citations', c: [{ url: 'https://example.com' }] },
      { t: 'text', c: 'world' },
    ].map(e => JSON.stringify(e)).join('\r\n') + '\r\n' + end;
    expect(parseAgentStream(raw, 'thread1')).toMatchObject({
      success: true, status: 'completed', threadId: 'thread1', text: 'Hello world',
      events: [{ type: 'responseMessage', content: { id: 'message1' } }, { type: 'citations', content: [{ url: 'https://example.com' }] }],
    });
  });

  it.each([
    ['{"t":"text","c":"partial"}', 'before completion'],
    ['{"t":"done","c":"done"}', 'before completion'],
    ['{"t":"error","c":{"name":"LimitError"}}\n' + end, 'LimitError'],
    ['{"t":"aborted"}\n' + end, 'aborted'],
    ['{"t":"text","c":42}\n' + end, 'not a string'],
    ['null\n' + end, 'invalid event'],
    ['<html>login</html>\n' + end, 'malformed JSON'],
    ['{"t":"text","c":"cut\n' + end, 'malformed JSON'],
    [end + '\n{"t":"text","c":"late"}', 'after completion'],
  ])('rejects invalid/incomplete responses', (raw, message) => {
    expect(() => parseAgentStream(raw, 'thread1')).toThrow(message);
  });

  it('continues an existing thread without creating another', async () => {
    const client = new FusebaseClient({ host: 'unit-test.invalid', orgId: 'org1', cookie: 'test', autoRefresh: false });
    const request = vi.fn().mockResolvedValue('{"t":"text","c":"answer"}\n' + end);
    Object.assign(client, { request });
    await expect(client.runAiAgentTask('agent1', 'prompt', { workspaceId: 'ws1', threadId: 'thread/1' })).resolves.toMatchObject({ text: 'answer' });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('/ai-assistant/rest/orgs/org1/agent-messages?workspaceId=ws1&threadId=thread%2F1');
  });

  it('does not execute when thread creation returns no ID', async () => {
    const client = new FusebaseClient({ host: 'unit-test.invalid', orgId: 'org1', cookie: 'test', autoRefresh: false });
    const request = vi.fn().mockResolvedValue({ success: true });
    Object.assign(client, { request });
    await expect(client.runAiAgentTask('agent1', 'prompt', { workspaceId: 'ws1' })).rejects.toThrow('execution was not started');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('retains the created thread ID on a failed execution and never resubmits it', async () => {
    const client = new FusebaseClient({ host: 'unit-test.invalid', orgId: 'org1', cookie: 'test', autoRefresh: false });
    const request = vi.fn().mockResolvedValueOnce({ id: 'created1' }).mockRejectedValueOnce(new Error('timeout'));
    Object.assign(client, { request });
    await expect(client.runAiAgentTask('agent1', 'prompt', { workspaceId: 'ws1' })).rejects.toThrow('thread created1');
    expect(request).toHaveBeenCalledTimes(2);
  });
});
