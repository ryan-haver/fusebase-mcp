/**
 * Data-integrity regressions for database tools (review findings COR-2, COR-9, COR-17).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { FusebaseClient } from "../../src/client.js";
import { fakeClient, startServer } from "./helpers/server.js";

function client() {
  return new FusebaseClient({ host: "unit-test.invalid", orgId: "unit-org", cookie: "unit-cookie", autoRefresh: false });
}

const DATABASES = {
  data: [
    {
      global_id: "db_sales",
      title: "Sales",
      dashboards: [{ global_id: "dash_ideal", name: "Ideal Customers", root_entity: "custom", views: [{ global_id: "view_ideal", name: "Everyone" }] }],
    },
    {
      global_id: "db_crm",
      title: "CRM",
      dashboards: [{ global_id: "dash_deals", name: "Deals", root_entity: "deal", views: [{ global_id: "view_deals", name: "All Deals" }] }],
    },
  ],
};

const COLUMNS = [
  { key: "k_name", name: "Name" },
  { key: "k_amount", name: "Amount" },
];

/** A real client whose network-facing methods are stubbed. */
function stubbedClient(overrides: Record<string, unknown> = {}) {
  const c = client() as any;
  c.listAllDatabases = async () => DATABASES;
  c.getViewSchema = async () => ({ columns: COLUMNS });
  c.getDashboardDetail = vi.fn(async (id: string) => ({ data: { global_id: id, views: [{ global_id: `view_of_${id}` }] } }));
  c.batchPutDashboardData = vi.fn(async () => ({ success: true, data: [{ root_index_value: "row_new" }] }));
  Object.assign(c, overrides);
  return c as FusebaseClient & Record<string, any>;
}

describe("COR-2: database alias resolution and addDatabaseRow", () => {
  it("matches aliases exactly, not by substring ('deals' must not match 'Ideal Customers')", async () => {
    const res = await stubbedClient().resolveDatabaseAlias("deals");
    expect(res).toMatchObject({ found: true, dashboardId: "dash_deals", viewId: "view_deals" });
  });

  it("normalises spaces, underscores and hyphens when matching table names", async () => {
    const res = await stubbedClient().resolveDatabaseAlias("ideal-customers");
    expect(res).toMatchObject({ found: true, dashboardId: "dash_ideal" });
  });

  // Found by the token-only coverage run: an unreadable database list was reported as "not found".
  it("says the lookup failed, rather than 'not found', when the database list can't be read", async () => {
    const c = stubbedClient({ listAllDatabases: async () => { throw new Error("401 Unauthorized"); } });
    expect(await c.resolveDatabaseAlias("deals")).toMatchObject({ found: false, lookupError: "401 Unauthorized" });

    const srv = await startServer(fakeClient({ resolveDatabaseAlias: async () => ({ alias: "deals", found: false, lookupError: "401 Unauthorized" }) }), { tier: "all" });
    try {
      const res = await srv.callText("resolve_database_alias", { alias: "deals" });
      expect(res.isError).toBe(true);
      expect(res.text).toMatch(/Couldn't read the database list.*401/);
    } finally {
      await srv.close();
    }
  });

  it("fails with the candidate list when several tables tie", async () => {
    const c = stubbedClient({
      listAllDatabases: async () => ({
        data: [
          { global_id: "db_a", title: "A", dashboards: [{ global_id: "dash_a", name: "Deals", root_entity: "custom", views: [{ global_id: "v_a" }] }] },
          { global_id: "db_b", title: "B", dashboards: [{ global_id: "dash_b", name: "Deals", root_entity: "custom", views: [{ global_id: "v_b" }] }] },
        ],
      }),
    });
    await expect(c.resolveDatabaseAlias("Deals")).rejects.toThrow(/ambiguous.*dash_a.*dash_b/is);
  });

  it("throws instead of borrowing another table's viewId when getDashboardDetail fails", async () => {
    const c = stubbedClient({ getDashboardDetail: vi.fn(async () => { throw new Error("404 dashboard not found"); }) });
    await expect(c.addDatabaseRow("deals", { dashboardId: "dash_caller" })).rejects.toThrow(/dash_caller/);
    expect(c.batchPutDashboardData).not.toHaveBeenCalled();
  });

  it("rejects unknown column names and lists the valid ones", async () => {
    const c = stubbedClient();
    await expect(c.addDatabaseRow("deals", { values: { Nmae: "Acme" } })).rejects.toThrow(/Nmae.*Name.*Amount/s);
    expect(c.batchPutDashboardData).not.toHaveBeenCalled();
  });

  it("does not report success when the API reports failure", async () => {
    const c = stubbedClient({ batchPutDashboardData: vi.fn(async () => ({ success: false, message: "validation failed: boom" })) });
    await expect(c.addDatabaseRow("deals", { values: { Name: "Acme" } })).rejects.toThrow(/boom/);
  });

  it("resolves column names to keys and returns the created row", async () => {
    const c = stubbedClient();
    const res = await c.addDatabaseRow("deals", { values: { name: "Acme", k_amount: 5 } });
    expect(res).toMatchObject({ success: true, rowUuid: "row_new", dashboardId: "dash_deals", viewId: "view_deals" });
    expect(c.batchPutDashboardData).toHaveBeenCalledWith("dash_deals", "view_deals", [
      { create_new_row: true, values: [{ item_key: "k_name", value: "Acme" }, { item_key: "k_amount", value: 5 }] },
    ]);
  });
});

describe("COR-9: relation unlinking and row ordering", () => {
  afterEach(() => vi.restoreAllMocks());

  it("unlink_database_rows refuses to run without row IDs or unlinkAll", async () => {
    const deleteRelationRows = vi.fn(async () => ({ success: true }));
    const srv = await startServer(fakeClient({ deleteRelationRows }), { tier: "all" });
    try {
      const res = await srv.callText("unlink_database_rows", { relationId: "rel_1" });
      expect(res.isError).toBe(true);
      expect(deleteRelationRows).not.toHaveBeenCalled();
    } finally {
      await srv.close();
    }
  });

  it("unlink_database_rows with unlinkAll: true removes every link explicitly", async () => {
    const deleteRelationRows = vi.fn(async () => ({ success: true }));
    const srv = await startServer(fakeClient({ deleteRelationRows }), { tier: "all" });
    try {
      const res = await srv.callText("unlink_database_rows", { relationId: "rel_1", unlinkAll: true });
      expect(res.isError).toBe(false);
      expect(deleteRelationRows).toHaveBeenCalledWith("rel_1", expect.objectContaining({ unlinkAll: true }));
    } finally {
      await srv.close();
    }
  });

  it("deleteRelationRows never sends a bare DELETE unless unlinkAll is set", async () => {
    const c = client() as any;
    const calls: string[] = [];
    c.request = async (path: string) => { calls.push(path); return {}; };
    await expect(c.deleteRelationRows("rel_1")).rejects.toThrow(/unlinkAll/);
    await expect(c.deleteRelationRows("rel_1", {})).rejects.toThrow(/unlinkAll/);
    expect(calls).toHaveLength(0);

    await c.deleteRelationRows("rel_1", { source_index: "row_s" });
    await c.deleteRelationRows("rel_1", { unlinkAll: true });
    expect(calls).toEqual([
      "/v4/api/proxy/dashboard-service/v1/relations/rel_1/rows?source_index=row_s",
      "/v4/api/proxy/dashboard-service/v1/relations/rel_1/rows",
    ]);
  });

  it("updateDashboardRowOrder matches the dashboard-service SDK contract (PUT /rows/order, sort_order)", async () => {
    const c = client() as any;
    const calls: Array<{ path: string; init: RequestInit }> = [];
    c.request = async (path: string, init: RequestInit) => { calls.push({ path, init }); return {}; };
    await c.updateDashboardRowOrder("dash_1", "view_1", [{ row_uuid: "row_1", sort_order: 1 }]);
    expect(calls[0].path).toMatch(/^\/v4\/api\/proxy\/dashboard-service\/v1\/dashboards\/dash_1\/rows\/order\?view_id=view_1&section_type=view&section_key=view/);
    expect(calls[0].init.method).toBe("PUT");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ row_orders: [{ row_uuid: "row_1", sort_order: 1 }] });
  });

  it("reorder_database_rows sends the SDK's 1-based sort_order field on the wire", async () => {
    const c = client() as any;
    const bodies: unknown[] = [];
    c.request = async (_path: string, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return {}; };
    const srv = await startServer(c, { tier: "all" });
    try {
      const res = await srv.callText("reorder_database_rows", { dashboardId: "dash_1", viewId: "view_1", rowOrders: [{ rowUuid: "row_1", order: 2 }] });
      expect(res.isError).toBe(false);
      expect(bodies).toEqual([{ row_orders: [{ row_uuid: "row_1", sort_order: 2 }] }]);
    } finally {
      await srv.close();
    }
  });
});

describe("COR-17: fusebase_swarm_init builds a usable swarm board", () => {
  function swarmClient(overrides: Record<string, unknown> = {}) {
    let n = 0;
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const record = (method: string, impl: (...args: any[]) => unknown) => async (...args: any[]) => {
      calls.push({ method, args });
      return impl(...args);
    };
    const c = fakeClient({
      createDatabase: record("createDatabase", () => ({
        success: true,
        data: { global_id: "db_swarm", dashboards: [{ global_id: "dash_swarm", views: [{ global_id: "view_swarm" }] }] },
      })),
      addDatabaseColumn: record("addDatabaseColumn", (_d: string, _v: string, name: string, type: string) => ({
        success: true,
        column: { key: `key_${++n}`, name, type },
      })),
      setViewGrouping: record("setViewGrouping", () => ({ success: true })),
      ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, record(k, v as any)])),
    });
    return { c, calls };
  }

  it("creates status and role columns, groups the view by status and returns the keys", async () => {
    const { c, calls } = swarmClient();
    const srv = await startServer(c, { tier: "all" });
    try {
      const res = await srv.callText("fusebase_swarm_init", { title: "Sprint" });
      expect(res.isError).toBe(false);
      const body = JSON.parse(res.text);

      const columns = calls.filter((x) => x.method === "addDatabaseColumn");
      expect(columns).toHaveLength(3);
      const [status, role, audit] = columns.map((x) => x.args as any[]);
      expect(audit.slice(0, 4)).toEqual(["dash_swarm", "view_swarm", "Audit Log", "multiline"]);
      expect(status.slice(0, 4)).toEqual(["dash_swarm", "view_swarm", "Status", "label"]);
      expect(status[4].labels.map((l: any) => l.name)).toEqual(["Backlog", "In Progress", "Review", "Done"]);
      expect(status[4].multiSelect).toBe(false);
      expect(role.slice(0, 4)).toEqual(["dash_swarm", "view_swarm", "Role", "label"]);
      expect(role[4].labels.map((l: any) => l.name)).toEqual(body.availableRoles);

      expect(calls.find((x) => x.method === "setViewGrouping")?.args).toEqual(["dash_swarm", "view_swarm", "key_1", "kanban"]);
      expect(body).toMatchObject({ success: true, dashboardId: "dash_swarm", viewId: "view_swarm", statusColumnKey: "key_1", roleColumnKey: "key_2", auditColumnKey: "key_3" });
    } finally {
      await srv.close();
    }
  });

  it("uses the flow template's eight stages", async () => {
    const { c, calls } = swarmClient();
    const srv = await startServer(c, { tier: "all" });
    try {
      await srv.callText("fusebase_swarm_init", { title: "Sprint", template: "flow" });
      const status = calls.find((x) => x.method === "addDatabaseColumn")!.args as any[];
      expect(status[4].labels.map((l: any) => l.name)).toEqual(["Specify", "Clarify", "Plan", "Decisions", "Tasks", "Verify Gate", "Implement", "Review & Deploy"]);
    } finally {
      await srv.close();
    }
  });

  it("reports isError with what was created when a later step fails", async () => {
    const { c } = swarmClient({ setViewGrouping: () => { throw new Error("grouping rejected"); } });
    const srv = await startServer(c, { tier: "all" });
    try {
      const res = await srv.callText("fusebase_swarm_init", { title: "Sprint" });
      expect(res.isError).toBe(true);
      expect(res.text).toMatch(/grouping rejected/);
      expect(res.text).toMatch(/db_swarm/);
      expect(res.text).toMatch(/key_1/);
      expect(res.text).toMatch(/key_2/);
    } finally {
      await srv.close();
    }
  });
});

describe("COR-18: label cells take an array of label IDs", () => {
  const viewSchema = {
    data: {
      schema: {
        items: [
          { key: "k_status", name: "Status", source: { custom_type: "label" }, render: { edit_type: "label", labels: [
            { nanoid: "lbl_backlog", name: "Backlog", color: "gray" },
            { nanoid: "lbl_progress", name: "In Progress", color: "blue" },
          ] } },
        ],
      },
    },
  };

  function stub() {
    const puts: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if ((init?.method || "GET") === "GET") {
        return new Response(JSON.stringify(viewSchema), { status: 200, headers: { "content-type": "application/json" } });
      }
      puts.push(JSON.parse(String(init?.body)));
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }));
    return puts;
  }
  const client = () => new FusebaseClient({ host: "unit-test.invalid", orgId: "unit-org", cookie: "c", autoRefresh: false });
  const sentValue = (puts: any[]) => JSON.stringify(puts[0]).match(/"value":(\[[^\]]*\]|"[^"]*")/)?.[1];

  it("maps a label name to its ID wrapped in an array", async () => {
    const puts = stub();
    await client().updateDatabaseCell("dash", "view", "row", "Status", "In Progress");
    expect(sentValue(puts)).toBe('["lbl_progress"]');
  });

  it("accepts label IDs and arrays", async () => {
    const puts = stub();
    await client().updateDatabaseCell("dash", "view", "row", "k_status", ["lbl_backlog", "In Progress"]);
    expect(sentValue(puts)).toBe('["lbl_backlog","lbl_progress"]');
  });

  it("rejects an unknown label and lists the valid ones", async () => {
    stub();
    await expect(client().updateDatabaseCell("dash", "view", "row", "Status", "Doing")).rejects.toThrow(/Backlog.*In Progress/);
  });
});

describe("COR-20: relation direction for relation columns", () => {
  // FuseBase: relation source = table the data is fetched FROM, target = table the column is ON.
  it("creates the relation from the linked table to the table that gets the column", async () => {
    const posts: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method || "GET";
      if (method === "POST" && String(url).endsWith("/relations")) {
        posts.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ data: { global_id: "rel1" } }), { status: 201, headers: { "content-type": "application/json" } });
      }
      const schema = { data: { schema: { items: [{ key: "name", name: "Name", source: { custom_type: "string" } }] } } };
      return new Response(JSON.stringify(schema), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const c = new FusebaseClient({ host: "unit-test.invalid", orgId: "o", cookie: "c", autoRefresh: false });
    await c.addRelationColumn("dash_on", "view_on", "Linked", "dash_from", "view_from");
    expect(posts[0]).toMatchObject({ source_dashboard_id: "dash_from", target_dashboard_id: "dash_on" });
  });
});

describe("COR-22: page tags use one call per tag", () => {
  // Live contract (probed): PUT .../tags {tag} adds one tag; DELETE .../tags/{tag} removes one.
  // Sending an array stored the literal tag "undefined".
  it("replaces tags by removing extras and adding missing ones, one tag per call", async () => {
    const calls: Array<{ method: string; path: string; body?: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method || "GET";
      calls.push({ method, path: new URL(url).pathname, body: init?.body as string | undefined });
      const body = method === "GET" ? ["keep", "old"] : true;
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const c = new FusebaseClient({ host: "unit-test.invalid", orgId: "o", cookie: "c", autoRefresh: false });
    await c.updatePageTags("ws", "note", ["keep", "new tag"]);
    const writes = calls.filter((x) => x.method !== "GET");
    expect(writes).toEqual([
      { method: "DELETE", path: "/v2/api/workspaces/ws/notes/note/tags/old", body: undefined },
      { method: "PUT", path: "/v2/api/workspaces/ws/notes/note/tags", body: JSON.stringify({ tag: "new tag" }) },
    ]);
  });
});
