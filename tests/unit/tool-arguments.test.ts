/**
 * Arguments that tools used to accept silently and ignore, found by the write-verification
 * suite: duplicate_database title, create_view display mode, search_tasks query, the swarm
 * transition's audit comment and handover, and list_folders subfolders.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { FusebaseClient } from "../../src/client.js";
import { fakeClient, startServer } from "./helpers/server.js";

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  await close?.();
  close = undefined;
  vi.unstubAllGlobals();
});

async function server(overrides: Record<string, unknown>) {
  const s = await startServer(fakeClient(overrides), { tier: "all" });
  close = s.close;
  return s;
}

describe("duplicate_database", () => {
  it("renames the copy to the requested title", async () => {
    const updateDatabase = vi.fn(async () => ({ success: true }));
    const s = await server({ duplicateDatabase: async () => ({ data: { global_id: "copy-1" } }), updateDatabase });
    const { isError, text } = await s.callText("duplicate_database", { sourceDbId: "src", title: "My Copy" });
    expect(isError).toBe(false);
    expect(updateDatabase).toHaveBeenCalledWith("copy-1", { title: "My Copy" });
    expect(JSON.parse(text)).toMatchObject({ databaseId: "copy-1", title: "My Copy" });
  });
});

describe("create_view", () => {
  it("sets the display mode when one is given", async () => {
    const setViewRepresentation = vi.fn(async () => ({ success: true }));
    const s = await server({ createView: async () => ({ data: { global_id: "v1" } }), setViewRepresentation });
    await s.callText("create_view", { dashboardId: "d1", name: "Board", representationType: "kanban" });
    expect(setViewRepresentation).toHaveBeenCalledWith("d1", "v1", "kanban");
  });

  it("groups a kanban view by the given column", async () => {
    const setViewGrouping = vi.fn(async () => ({ success: true }));
    const s = await server({ createView: async () => ({ data: { global_id: "v2" } }), setViewGrouping });
    await s.callText("create_view", { dashboardId: "d1", representationType: "kanban", groupByColumnKey: "col1" });
    expect(setViewGrouping).toHaveBeenCalledWith("d1", "v2", "col1", "kanban");
  });

  it("leaves a plain table view alone", async () => {
    const setViewRepresentation = vi.fn();
    const s = await server({ createView: async () => ({ data: { global_id: "v3" } }), setViewRepresentation });
    await s.callText("create_view", { dashboardId: "d1" });
    expect(setViewRepresentation).not.toHaveBeenCalled();
  });
});

describe("search_tasks query", () => {
  it("matches task titles across pages, then applies offset and limit", async () => {
    const all = Array.from({ length: 150 }, (_, i) => ({ globalId: `t${i}`, title: i % 50 === 0 ? `Deploy step ${i}` : `Other ${i}` }));
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const { offset, limit } = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ total: all.length, tasks: all.slice(offset, offset + limit) }), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const client = new FusebaseClient({ host: "search-unit.invalid", orgId: "o", cookie: "eversessionid=s", autoRefresh: false } as any);
    const res = await client.searchTasks("ws", { query: "deploy", limit: 2 });
    expect(res.total).toBe(3);
    expect(res.tasks.map((t) => t.globalId)).toEqual(["t0", "t50"]);
  });
});

describe("fusebase_swarm_task_transition", () => {
  const base = { dashboardId: "d", viewId: "v", rowId: "r1", groupByColumnKey: "status", newStatus: "Review", comment: "Tests pass" };

  it("appends the audit entry to the Audit Log and hands over the Role", async () => {
    const updateDatabaseCell = vi.fn(async () => ({ success: true }));
    const s = await server({
      moveKanbanCard: async () => ({ success: true }),
      getDatabaseRows: async () => ({ rows: [{ rowUuid: "r1", cells: { audit: "[earlier] agent-pm → In Progress: started" } }] }),
      updateDatabaseCell,
    });
    const { text } = await s.callText("fusebase_swarm_task_transition", { ...base, nextRole: "agent-qa", auditColumnKey: "audit", roleColumnKey: "role", profile: "agent-dev" });
    expect(JSON.parse(text)).toMatchObject({ auditStored: true, handoverStored: true });
    const auditCall = updateDatabaseCell.mock.calls.find((c: unknown[]) => c[3] === "audit") as unknown[];
    expect(String(auditCall[4])).toMatch(/^\[earlier\] agent-pm → In Progress: started\n\[.+\] agent-dev → Review: Tests pass \(handed over to agent-qa\)$/);
    expect(updateDatabaseCell).toHaveBeenCalledWith("d", "v", "r1", "role", "agent-qa");
  });

  it("says the audit entry wasn't stored when no Audit Log column is given", async () => {
    const s = await server({ moveKanbanCard: async () => ({ success: true }) });
    const { text } = await s.callText("fusebase_swarm_task_transition", base);
    expect(JSON.parse(text)).toMatchObject({ auditStored: false, handoverStored: false });
    expect(JSON.parse(text).note).toMatch(/not stored/);
  });
});

describe("list_folders", () => {
  it("returns nested subfolders", async () => {
    const folder = (id: string, name: string, children: unknown[] = []) =>
      ({ type: "folder", id: `notesFolder#${id}`, parentId: "", hasChildren: children.length > 0, name, icon: "", children });
    const s = await server({ listFolders: async () => [folder("default", "Unsorted", [folder("sub1", "Portal pages", [folder("sub2", "Deep")])])] });
    const { text } = await s.callText("list_folders", { workspaceId: "ws" });
    const [root] = JSON.parse(text);
    expect(root.children[0]).toMatchObject({ id: "sub1", name: "Portal pages" });
    expect(root.children[0].children[0]).toMatchObject({ id: "sub2", name: "Deep" });
  });
});

describe("add_database_row without values (COR-28)", () => {
  it("finds the new row's id when FuseBase doesn't return it", async () => {
    let created = false;
    const client = new FusebaseClient({ host: "addrow-unit.invalid", orgId: "o", cookie: "eversessionid=s", autoRefresh: false } as any);
    Object.assign(client, {
      batchPutDashboardData: async () => {
        created = true;
        return { success: true, message: "Successfully updated 0 dashboard value(s)" };
      },
      getDatabaseRows: async () => ({ rows: [{ rowUuid: "a" }, { rowUuid: "b" }, ...(created ? [{ rowUuid: "new" }] : [])] }),
    });
    const res = await client.addDatabaseRow("custom", { dashboardId: "d", viewId: "v" });
    expect(res.rowUuid).toBe("new");
  });
});

describe("publish_page_to_portal (COR-29)", () => {
  it("sends the camelCase isPortalShare field the upsert endpoint accepts", async () => {
    const bodies: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return new Response(JSON.stringify({ globalId: "p1" }), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const client = new FusebaseClient({ host: "portal-unit.invalid", orgId: "o", cookie: "eversessionid=s", autoRefresh: false } as any);
    await client.setPagePortalShare("ws", "p1", true);
    expect(JSON.parse(bodies[0])).toEqual({ note: { isPortalShare: true } });
  });
});
