import { publicErrorMessage } from "../../../src/error-redaction.js";
import { randomUUID } from "node:crypto";
import { atomicWrite } from "../../../src/runtime-data.js";
export interface FixtureUser { id: number; email: string; role: string }
export interface PortalFixtureState {
  marker: string; email: string; startedAt: string; orgId: string;
  workspaceId?: string; workspaceCreateStarted?: boolean; portalId?: string; memberId?: number; inviteStarted?: boolean; complete?: boolean;
}
export interface PortalFixtureApi {
  users(): Promise<FixtureUser[]>;
  createWorkspace(title: string): Promise<string>;
  workspace(id: string): Promise<{id: string; title: string} | undefined>;
  workspaces(): Promise<Array<{ id: string; title: string }>>;
  createPortal(workspaceId: string, title: string): Promise<void>;
  portals(): Promise<Array<{ id: string; workspaceId: string }>>;
  invite(portalId: string, email: string): Promise<void>;
  magicLink(portalId: string, email: string): Promise<void>;
  revokeLinks(workspaceId: string): Promise<void>;
  removeMember(userId: number, joinedAfter: string): Promise<void>;
  deletePortal(id: string): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;
}
/** Recovery only uses the persisted, unique fixture identity and exact returned IDs. */
export async function cleanupPortalFixture(api: PortalFixtureApi, state: PortalFixtureState, save: () => void): Promise<void> {
  const workspaces = await api.workspaces();
  if (state.workspaceId && workspaces.some(w => w.id === state.workspaceId && w.title !== state.marker)) throw new Error("Owned workspace title changed; refusing cleanup");
  const workspace = state.workspaceId ? await api.workspace(state.workspaceId) : workspaces.find(w => w.title === state.marker);
  if (!workspace && !state.workspaceId && state.workspaceCreateStarted) throw new Error("Workspace creation outcome is uncertain; retain the journal and retry recovery after visibility is restored");
  if (workspace && workspace.title !== state.marker) throw new Error("Owned workspace title changed; refusing cleanup");
  if (!workspace && state.portalId && (await api.portals()).some(p => p.id === state.portalId)) throw new Error("Owned portal remains but workspace identity is unavailable; inspect the saved journal");
  if (workspace) { state.workspaceId = workspace.id; save(); }
  const failures: unknown[] = [];
  const step = async (fn: () => Promise<void>) => { try { await fn(); } catch (error) { failures.push(error); } };
  if (workspace) {
    const portals = (await api.portals()).filter(p => p.workspaceId === workspace.id);
    if (portals.length > 1) throw new Error("Unexpected portals in disposable workspace; inspect journal");
    if (portals[0]) { state.portalId = portals[0].id; save(); }
    await step(() => api.revokeLinks(workspace.id));
  }
  if (state.inviteStarted) await step(async () => {
    const user = (await api.users()).find(u => u.email.toLowerCase() === state.email);
    if (!user) return;
    if (user.role !== "client" || (state.memberId !== undefined && state.memberId !== user.id)) throw new Error("Membership identity/role changed; refusing removal");
    state.memberId = user.id; save();
    await api.removeMember(user.id, state.startedAt);
    if ((await api.users()).some(u => u.id === user.id)) throw new Error("Disposable membership remains");
  });
  if (failures.length) throw new AggregateError(failures, "Portal cleanup incomplete; recover using the saved journal: " + failures.map(publicErrorMessage).join("; "));
  if (workspace && state.portalId) await step(async () => {
    await api.deletePortal(state.portalId!);
    if ((await api.portals()).some(p => p.id === state.portalId)) throw new Error("Disposable portal remains");
  });
  if (failures.length) throw new AggregateError(failures, "Portal deletion failed; workspace retained for recovery: " + failures.map(publicErrorMessage).join("; "));
  if (workspace) await step(async () => {
    await api.deleteWorkspace(workspace.id);
    if (await api.workspace(workspace.id)) throw new Error("Disposable workspace remains");
  });
  if (failures.length) throw new AggregateError(failures, "Portal cleanup incomplete; recover using the saved journal: " + failures.map(publicErrorMessage).join("; "));
  state.complete = true; save();
}
export async function runPortalFixture(api: PortalFixtureApi, email: string, orgId: string, file: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if ((await api.users()).some(user => user.email.toLowerCase() === normalized)) throw new Error("Test recipient already has organization membership; use a different test address. No access changed.");
  const state: PortalFixtureState = { marker: `QA-${randomUUID()}`, email: normalized, startedAt: new Date().toISOString(), orgId };
  const save = () => atomicWrite(file, JSON.stringify(state, null, 2));
  save();
  let failure: unknown;
  try {
    state.workspaceCreateStarted = true; save();
    state.workspaceId = await api.createWorkspace(state.marker); save();
    await api.createPortal(state.workspaceId, state.marker);
    const portal = (await api.portals()).find(p => p.workspaceId === state.workspaceId);
    if (!portal) throw new Error("Created portal not found by fresh read");
    state.portalId = portal.id; save();
    state.inviteStarted = true; save();
    await api.invite(portal.id, normalized);
    const user = (await api.users()).find(u => u.email.toLowerCase() === normalized);
    if (!user || user.role !== "client") throw new Error("Client invitation not verified");
    state.memberId = user.id; save();
    await api.magicLink(portal.id, normalized);
  } catch (error) { failure = error; }
  try { await cleanupPortalFixture(api, state, save); }
  catch (cleanupError) {
    if (failure) throw new AggregateError([failure, cleanupError], `Portal execution and cleanup failed: ${publicErrorMessage(failure)}; ${publicErrorMessage(cleanupError)}`, {cause: cleanupError});
    throw cleanupError;
  }
  if (failure) throw failure;
}
