import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPortalFixture, cleanupPortalFixture, type PortalFixtureApi, type FixtureUser } from "../live/lib/portal-fixture.js";
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture(fail: "none" | "create" | "invite" | "link" = "none") {
  const dir = mkdtempSync(join(tmpdir(), "fusebase-portal-test-")); dirs.push(dir);
  const state = { users: [] as FixtureUser[], workspaces: [] as Array<{id: string; title: string}>, portals: [] as Array<{id: string; workspaceId: string}>, links: 0 };
  const api: PortalFixtureApi = {
    users: async () => state.users,
    workspaces: async () => state.workspaces,
    workspace: async id => state.workspaces.find(w => w.id === id),
    portals: async () => state.portals,
    createWorkspace: async title => { state.workspaces.push({ id: "owned-ws", title }); if (fail === "create") throw new Error("lost response"); return "owned-ws"; },
    createPortal: async workspaceId => { state.portals.push({ id: "owned-portal", workspaceId }); },
    invite: async (_portal, email) => { state.users.push({ id: 42, email, role: "client" }); state.links++; if (fail === "invite") throw new Error("lost invite response"); },
    magicLink: async () => { state.links++; if (fail === "link") throw new Error("verification failure"); },
    revokeLinks: async () => { state.links = 0; },
    removeMember: async id => { state.users = state.users.filter(user => user.id !== id); },
    deletePortal: async id => { state.portals = state.portals.filter(p => p.id !== id); },
    deleteWorkspace: async id => { state.workspaces = state.workspaces.filter(w => w.id !== id); },
  };
  return { api, state, file: join(dir, "journal.json") };
}
it.each(["none", "create", "invite", "link"] as const)("cleans up after %s outcomes including lost write responses", async fail => {
  const { api, state, file } = fixture(fail);
  const result = runPortalFixture(api, "qa@example.invalid", "org", file);
  if (fail === "none") await result; else await expect(result).rejects.toThrow();
  expect(state).toEqual({ users: [], workspaces: [], portals: [], links: 0 });
  expect(JSON.parse(readFileSync(file, "utf8")).complete).toBe(true);
});
it("refuses pre-existing membership without changing it", async () => {
  const { api, state, file } = fixture();
  state.users.push({ id: 1, email: "qa@example.invalid", role: "owner" });
  const create = vi.spyOn(api, "createWorkspace");
  await expect(runPortalFixture(api, "qa@example.invalid", "org", file)).rejects.toThrow("already has");
  expect(create).not.toHaveBeenCalled(); expect(state.users[0].role).toBe("owner");
});
it("preserves the journal and reports failed cleanup, then supports recovery", async () => {
  const { api, state, file } = fixture();
  const remove = api.removeMember;
  api.removeMember = async () => { throw new Error("temporary upstream failure"); };
  await expect(runPortalFixture(api, "qa@example.invalid", "org", file)).rejects.toThrow("cleanup incomplete");
  const saved = JSON.parse(readFileSync(file, "utf8")); expect(saved.complete).not.toBe(true);
  api.removeMember = remove;
  await cleanupPortalFixture(api, saved, () => {});
  expect(state.users).toEqual([]); expect(saved.complete).toBe(true);
});

it("does not remove a membership when invitation was never attempted", async () => {
  const {api,state} = fixture();
  state.users.push({id:9,email:"qa@example.invalid",role:"client"});
  await cleanupPortalFixture(api, {marker:"QA-fixture",email:"qa@example.invalid",startedAt:new Date().toISOString(),orgId:"org"}, () => {});
  expect(state.users).toHaveLength(1);
});
it("refuses to delete a journaled workspace whose identity changed", async () => {
  const {api,state} = fixture();
  state.workspaces.push({id:"workspace",title:"Real workspace"});
  await expect(cleanupPortalFixture(api, {marker:"QA-fixture",email:"qa@example.invalid",startedAt:new Date().toISOString(),orgId:"org",workspaceId:"workspace"}, () => {})).rejects.toThrow("title changed");
  expect(state.workspaces).toHaveLength(1);
});

it("recovers a portal workspace hidden from the normal workspace list", async () => {
 const {api,state,file}=fixture();
 api.workspaces=async()=>[];
 await runPortalFixture(api,"qa@example.invalid","org",file);
 expect(state.workspaces).toEqual([]);expect(state.portals).toEqual([]);expect(state.users).toEqual([]);
});
it("keeps the workspace and portal recoverable if link revocation fails",async()=>{
 const {api,state,file}=fixture();api.revokeLinks=async()=>{throw new Error("revocation unavailable")};
 await expect(runPortalFixture(api,"qa@example.invalid","org",file)).rejects.toThrow("revocation unavailable");
 expect(state.workspaces).toHaveLength(1);expect(state.portals).toHaveLength(1);
 expect(JSON.parse(readFileSync(file,"utf8")).complete).not.toBe(true);
});

it("keeps a lost creation response unresolved until the workspace becomes visible", async () => {
  const { api, state, file } = fixture("create");
  const list = api.workspaces;
  api.workspaces = async () => [];
  await expect(runPortalFixture(api, "qa@example.invalid", "org", file)).rejects.toThrow("creation outcome is uncertain");
  const saved = JSON.parse(readFileSync(file, "utf8"));
  expect(saved.workspaceCreateStarted).toBe(true);
  expect(saved.complete).not.toBe(true);
  expect(state.workspaces).toHaveLength(1);
  api.workspaces = list;
  await cleanupPortalFixture(api, saved, () => {});
  expect(saved.complete).toBe(true);
  expect(state.workspaces).toEqual([]);
});
