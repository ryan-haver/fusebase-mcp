import { describe, expect, it, vi } from 'vitest';
import { FusebaseClient } from '../../src/client.js';
import { FusebaseGateBridge } from '../../src/gate-bridge.js';

function setup() {
  const bridge = new FusebaseGateBridge({ gateToken: 'unit-test-token' });
  const toolCall = vi.spyOn(bridge, 'toolCall').mockResolvedValue({ data: { globalId: 'portal1', status: 'ready' } });
  const client = new FusebaseClient({ host: 'unit-test.invalid', orgId: 'org1', gateBridge: bridge, autoRefresh: false });
  return { client, toolCall };
}

describe('current v2 portal creation', () => {
  it('uses the Gate body contract and preserves explicit theme/access settings', async () => {
    const { client, toolCall } = setup();
    await expect(client.createPortal('ws1', 'QA', 'qa.p.nimbusweb.me', { theme: 'soft_light', accessMode: 'invite-only' }))
      .resolves.toEqual({ globalId: 'portal1', status: 'ready' });
    expect(toolCall).toHaveBeenCalledWith('createPortal', {
      orgId: 'org1', body: { workspaceId: 'ws1', name: 'QA', domain: 'qa.p.nimbusweb.me', theme: 'soft_light', accessMode: 'invite-only' },
    }, 'gate', { applyDefaults: false });
  });

  it('rejects a missing domain before sending any creation request', async () => {
    const { client, toolCall } = setup();
    await expect(client.createPortal('ws1', 'QA')).rejects.toThrow('full domain');
    expect(toolCall).not.toHaveBeenCalled();
  });

  it('does not retry a failed write through the obsolete web endpoint', async () => {
    const { client, toolCall } = setup();
    toolCall.mockRejectedValue(new Error('portal_service_conflict'));
    await expect(client.createPortal('ws1', 'QA', 'qa.p.nimbusweb.me')).rejects.toThrow('portal_service_conflict');
    expect(toolCall).toHaveBeenCalledTimes(1);
  });

  it('reports the Gate-token requirement for cookie-only connections', async () => {
    const client = new FusebaseClient({ host: 'unit-test.invalid', orgId: 'org1', cookie: 'unit-test', autoRefresh: false });
    await expect(client.createPortal('ws1', 'QA', 'qa.p.nimbusweb.me')).rejects.toThrow('requires a Gate token');
  });
});

describe('portal invitation and magic-link contracts', () => {
  function membership(users: Array<{ email: string; role: string }> = []) {
    const { client, toolCall } = setup();
    toolCall.mockImplementation(async (op) => op === 'listOrgUsers'
      ? { data: { users } }
      : { data: { magicLink: 'redacted-test-link', userId: 123 } });
    return { client, toolCall };
  }

  it('uses the current Gate invitation contract with explicit access', async () => {
    const { client, toolCall } = membership();
    await client.invitePortalClient('portal1', ' QA@example.com ', 'QA Client', { isFullAccess: false });
    expect(toolCall).toHaveBeenLastCalledWith('inviteToPortal', {
      orgId: 'org1', portalId: 'portal1',
      body: { email: 'qa@example.com', fullName: 'QA Client', orgRole: 'client', workspaceRole: 'reader', isFullAccess: false },
    }, 'gate', { applyDefaults: false });
  });

  it.each(['owner', 'manager', 'member', 'guest'])('refuses to overwrite existing %s role', async role => {
    const { client, toolCall } = membership([{ email: 'qa@example.com', role }]);
    await expect(client.invitePortalClient('portal1', 'QA@example.com', undefined, { isFullAccess: false })).rejects.toThrow('separate client email');
    expect(toolCall).toHaveBeenCalledTimes(1);
  });

  it('requires an access choice before any upstream call', async () => {
    const { client, toolCall } = membership();
    await expect(client.invitePortalClient('portal1', 'qa@example.com')).rejects.toThrow('Choose portal client access');
    expect(toolCall).not.toHaveBeenCalled();
  });

  it('fails closed if the membership check fails', async () => {
    const { client, toolCall } = membership();
    toolCall.mockRejectedValue(new Error('Permission denied'));
    await expect(client.invitePortalClient('portal1', 'qa@example.com', undefined, { isFullAccess: false })).rejects.toThrow('Permission denied');
    expect(toolCall).toHaveBeenCalledTimes(1);
  });

  it('does not retry a failed invitation', async () => {
    const { client, toolCall } = membership();
    toolCall.mockResolvedValueOnce({ data: { users: [] } }).mockRejectedValueOnce(new Error('invite_rate_limited'));
    await expect(client.invitePortalClient('portal1', 'qa@example.com', undefined, { isFullAccess: false })).rejects.toThrow('invite_rate_limited');
    expect(toolCall).toHaveBeenCalledTimes(2);
  });

  it('lists clients in the specified portal rather than all organization clients', async () => {
    const { client, toolCall } = setup();
    vi.spyOn(client, 'getPortal').mockResolvedValue({ workspaceId: 'ws1', domain: 'qa.p.nimbusweb.me' });
    toolCall.mockResolvedValue({ data: { members: [{ email: 'client@example.com', orgRole: 'client' }, { email: 'owner@example.com', orgRole: 'owner' }] } });
    await expect(client.listPortalClients('portal1')).resolves.toEqual([{ email: 'client@example.com', orgRole: 'client' }]);
    expect(toolCall).toHaveBeenCalledWith('listPortalMembers', { orgId: 'org1', workspaceId: 'ws1' }, 'gate', { applyDefaults: false });
  });

  it('creates a link only after checking membership in the target portal', async () => {
    const { client, toolCall } = setup();
    vi.spyOn(client, 'getPortal').mockResolvedValue({ workspaceId: 'ws1', domain: 'qa.p.nimbusweb.me' });
    toolCall.mockResolvedValue({ data: { members: [{ email: 'client@example.com' }] } });
    const request = vi.fn().mockResolvedValue({ magicLink: 'redacted-test-link' });
    Object.assign(client, { request });
    await client.getPortalMagicLink('portal1', 'CLIENT@example.com');
    expect(request).toHaveBeenCalledWith('/v2/api/workspaces/ws1/magic-links?orgId=org1', {
      method: 'POST', body: JSON.stringify({ email: 'client@example.com', url: 'https://qa.p.nimbusweb.me', deleteMagicLinkIds: [] }),
    });
  });

  it('does not provision an uninvited user while generating a link', async () => {
    const { client, toolCall } = setup();
    vi.spyOn(client, 'getPortal').mockResolvedValue({ workspaceId: 'ws1', domain: 'qa.p.nimbusweb.me' });
    toolCall.mockResolvedValue({ data: { members: [] } });
    const request = vi.fn();
    Object.assign(client, { request });
    await expect(client.getPortalMagicLink('portal1', 'new@example.com')).rejects.toThrow('invite it with an explicit access choice first');
    expect(request).not.toHaveBeenCalled();
  });
});
