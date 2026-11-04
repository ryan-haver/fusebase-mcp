import { FusebaseApiError } from "../../src/write-safety.js";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { buildClient } from "../../src/client-factory.js";
import { gateList } from "../../src/gate-bridge.js";
import { atomicWrite } from "../../src/runtime-data.js";
import { assert, runSuite } from "./lib/harness.js";
import { runPortalFixture, cleanupPortalFixture, type PortalFixtureApi } from "./lib/portal-fixture.js";

runSuite("Disposable portal email lifecycle", async () => {
  const recovery = process.argv.find(arg => arg.startsWith("--recover="))?.slice(10);
  assert(Boolean(recovery) || (process.argv.includes("--send-email") && process.env.FUSEBASE_TEST_SEND_EMAIL === "1"), "explicit email opt-in required");
  const email = process.env.FUSEBASE_TEST_INVITE_EMAIL;
  assert(Boolean(recovery || email), "set the designated test email");
  const client = buildClient();
  const orgId = process.env.FUSEBASE_ORG_ID!;
  assert(Boolean(client.gateBridge?.hasGate && client.getCookie()), "portal lifecycle needs Gate and cookie authentication");
  const gate = (op: string, args: Record<string, unknown>) => client.gateBridge!.toolCall(op, { orgId, ...args }, "gate", { applyDefaults: false });
  // Test-only adapter for documented admin endpoints without a named MCP wrapper.
  const request = (client as unknown as { request<T>(path: string, options?: RequestInit): Promise<T> }).request.bind(client);
  const linkSchema = z.object({ magicLinks: z.array(z.object({ id: z.union([z.string(), z.number()]) })) });
  const api: PortalFixtureApi = {
    users: async () => z.array(z.object({ id: z.number(), email: z.string(), role: z.string() })).parse(gateList(await gate("listOrgUsers", { includeMetadata: false }), "users", "listOrgUsers")),
    createWorkspace: async title => { const result = await gate("createWorkspace", { body: { title } }); return z.object({ id: z.string() }).parse(result.data ?? result).id; },
    workspace: async id => {
      try {
        const detail = z.object({globalId:z.string(),orgId:z.string(),title:z.string().optional(),name:z.string().optional()}).parse(await client.getWorkspaceDetail(id));
        assert(detail.orgId === orgId, "owned workspace belongs to configured organization");
        const title = detail.title ?? detail.name;
        if (!title) throw new Error("Workspace detail omitted its title; refusing cleanup");
        return {id:detail.globalId,title};
      } catch (error) { if (error instanceof FusebaseApiError && error.status === 404) return undefined; throw error; }
    },
    workspaces: async () => (await client.listWorkspaces()).map(w => ({ id: w.workspaceId, title: w.title })),
    createPortal: async (workspaceId, title) => { await client.createPortal(workspaceId, title, `${title.toLowerCase()}.p.nimbusweb.me`, { theme: "soft_light", accessMode: "invite-only" }); },
    portals: async () => z.array(z.object({ globalId: z.string(), workspaceId: z.string() })).parse(await client.listPortals()).map(p => ({ id: p.globalId, workspaceId: p.workspaceId })),
    invite: async (id, address) => { await client.invitePortalClient(id, address, undefined, { isFullAccess: false }); },
    magicLink: async (id, address) => { await client.getPortalMagicLink(id, address); },
    revokeLinks: async workspaceId => {
      const url = `/v2/api/workspaces/${encodeURIComponent(workspaceId)}/details?orgId=${encodeURIComponent(orgId)}`;
      const links = linkSchema.parse(await request(url)).magicLinks;
      if (links.length) await request(`/v2/api/workspaces/${encodeURIComponent(workspaceId)}/magic-links?orgId=${encodeURIComponent(orgId)}${links.map(link => `&id=${encodeURIComponent(link.id)}`).join("")}`, { method: "DELETE" });
      assert(linkSchema.parse(await request(url)).magicLinks.length === 0, "issued links revoked by fresh read");
    },
    removeMember: async (userId, expectedJoinedAfter) => { await gate("removeOrgMember", { userId, expectedRole: "client", expectedJoinedAfter: Math.floor(Date.parse(expectedJoinedAfter) / 1000), confirm: true }); },
    deletePortal: async id => { await request(`/v4/api/portal/delete?portalId=${encodeURIComponent(id)}&keepSyncedItems=true`, { method: "DELETE" }); },
    deleteWorkspace: async id => { await request(`/v1/workspaces/${encodeURIComponent(id)}`, { method: "DELETE" }); },
  };
  if (recovery) {
    const state = z.object({ marker: z.string().regex(/^QA-[a-f0-9-]{36}$/), email: z.string().email(), orgId: z.string(), startedAt: z.string().datetime(), workspaceId: z.string().optional(), workspaceCreateStarted: z.boolean().optional(), portalId: z.string().optional(), memberId: z.number().optional(), inviteStarted: z.boolean().optional(), complete: z.boolean().optional() }).parse(JSON.parse(readFileSync(resolve(recovery), "utf8")));
    assert(state.orgId === orgId && /^QA-[a-f0-9-]{36}$/.test(state.marker), "recovery journal identity matches this organization");
    if (!state.complete) await cleanupPortalFixture(api, state, () => atomicWrite(resolve(recovery), JSON.stringify(state, null, 2)));
  } else {
    await runPortalFixture(api, email!, orgId, resolve(`scratch/live-runs/${process.env.LIVE_RUN_ID || Date.now()}/portal.json`));
    assert(true, "portal, membership, and link cleanup verified; delivery and browser activation need separate evidence");
  }
});
