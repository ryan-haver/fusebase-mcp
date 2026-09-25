/**
 * COR-6: in token-only mode (no session cookie) the client falls back to the Gate bridge.
 * Those fallbacks must return the same shapes as the web API branches / Fusebase* types,
 * so the tools that consume them keep working. Also: no hardcoded workspace id, an
 * accurate error when Gate returns nothing usable (COR-16), and listTaskLists typed as
 * the object the API really returns (MCP-12 / MNT-2).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The client writes a workspace/folder cache to data/; keep tests off the real file but
// capture what would have been written.
const cacheWrites: string[] = [];
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  const isCache = (file: unknown) => String(file).endsWith("workspace_cache.json");
  return {
    ...actual,
    existsSync: vi.fn((file: import("fs").PathLike) => !isCache(file) && actual.existsSync(file)),
    writeFileSync: vi.fn((...args: Parameters<typeof actual.writeFileSync>) => {
      if (isCache(args[0])) cacheWrites.push(String(args[1]));
      else actual.writeFileSync(...args);
    }),
  };
});

import { FusebaseClient } from "../../src/client.js";
import type { FusebaseTaskListsResponse } from "../../src/types.js";
import { fakeClient, startServer } from "./helpers/server.js";

type Ops = Record<string, (args: Record<string, unknown>) => unknown>;

function fakeBridge(ops: Ops) {
  return {
    hasGate: true,
    hasDashboards: false,
    isConfigured: true,
    getIdentity: vi.fn(async () => ({ orgId: "o", permissions: [], serverName: "g", serverVersion: "1" })),
    toolCall: vi.fn(async (opId: string, args: Record<string, unknown> = {}) => {
      const op = ops[opId];
      if (!op) throw new Error(`fake bridge: ${opId} not stubbed`);
      return op(args);
    }),
  };
}

function tokenOnlyClient(ops: Ops) {
  const gateBridge = fakeBridge(ops);
  const client = new FusebaseClient({ host: "unit-test.invalid", orgId: "o", autoRefresh: false, gateBridge: gateBridge as any });
  return { client, gateBridge };
}

beforeEach(() => {
  cacheWrites.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Gate fallback shapes (COR-6)", () => {
  it("listWorkspaces returns FusebaseWorkspace objects keyed by workspaceId", async () => {
    const { client } = tokenOnlyClient({
      listWorkspaces: () => ({ ok: true, data: { workspaces: [
        { id: "ws1", orgId: "o", title: "Main", isDefault: true, color: "#fff", role: "owner" },
        { id: "ws2", title: null, isDefault: false },
      ] } }),
    });
    const workspaces = await client.listWorkspaces();
    expect(workspaces).toEqual([
      { orgId: "o", workspaceId: "ws1", title: "Main", color: "#fff" },
      { orgId: "o", workspaceId: "ws2", title: "ws2", color: "" },
    ]);
    const cache = JSON.parse(cacheWrites.at(-1) ?? "{}");
    expect(Object.keys(cache.workspaces ?? {})).toEqual(expect.arrayContaining(["ws1", "ws2"]));
    expect(cache.workspaces).not.toHaveProperty("undefined");
  });

  it("listFolders returns the web menu shape that list_folders expects", async () => {
    const { client } = tokenOnlyClient({
      listWorkspaceNoteFolders: () => ({ ok: true, data: { folders: [
        { globalId: "f1", title: "Projects", parentId: "default" },
        { globalId: "f2", title: "Sub", parentId: "f1" },
      ] } }),
    });
    const folders = await client.listFolders("ws1");
    expect(folders).toHaveLength(2);
    expect(folders[0]).toMatchObject({ type: "folder", id: "notesFolder#f1", name: "Projects", parentId: "default", hasChildren: true, children: [] });
    expect(folders[1]).toMatchObject({ type: "folder", id: "notesFolder#f2", name: "Sub", parentId: "f1", hasChildren: false });
    for (const f of folders) expect(f).not.toHaveProperty("global_id");

    const cache = JSON.parse(cacheWrites.at(-1) ?? "{}");
    expect(cache.workspaces.ws1.folders).toEqual([
      { id: "f1", name: "Projects", parentId: "default" },
      { id: "f2", name: "Sub", parentId: "f1" },
    ]);
  });

  it("list_folders tool shows ids and names in token-only mode", async () => {
    const { client } = tokenOnlyClient({
      listWorkspaceNoteFolders: () => ({ ok: true, data: { folders: [{ globalId: "f1", title: "Projects", parentId: "default" }] } }),
    });
    const server = await startServer(fakeClient({ listFolders: (ws: string) => client.listFolders(ws) }));
    try {
      const res = await server.callText("list_folders", { workspaceId: "ws1" });
      expect(res.isError).toBe(false);
      expect(JSON.parse(res.text)).toEqual([{ id: "f1", name: "Projects", parentId: "default", hasChildren: false, icon: "", children: [] }]);
    } finally {
      await server.close();
    }
  });

  it("listPages returns full FusebaseNote items", async () => {
    const { client } = tokenOnlyClient({
      listWorkspaceNotes: () => ({ ok: true, data: { notes: [
        { globalId: "n1", title: "One", parentId: "default" },
        { globalId: "n2", title: null, parentId: null },
      ] } }),
    });
    const res = await client.listPages("ws1");
    expect(res.total).toBe(2);
    expect(res.items[0]).toMatchObject({ globalId: "n1", title: "One", parentId: "default", workspaceId: "ws1", type: "note" });
    expect(res.items[1]).toMatchObject({ globalId: "n2", title: "", parentId: "default", workspaceId: "ws1", type: "note" });
    for (const key of ["createdAt", "updatedAt", "size", "favorite", "shared", "emoji", "isPortalShare"]) {
      expect(res.items[0]).toHaveProperty(key);
    }
  });

  it("listPages applies offset and limit", async () => {
    const notes = Array.from({ length: 5 }, (_, i) => ({ globalId: `n${i}`, title: `T${i}`, parentId: "default" }));
    const { client } = tokenOnlyClient({ listWorkspaceNotes: () => ({ ok: true, data: { notes } }) });
    const res = await client.listPages("ws1", { offset: 1, limit: 2 });
    expect(res.items.map((n) => n.globalId)).toEqual(["n1", "n2"]);
    expect(res.total).toBe(5);
  });

  it("getPage returns a FusebaseNote with the workspace id", async () => {
    const { client } = tokenOnlyClient({
      getWorkspaceNote: () => ({ ok: true, data: { note: { globalId: "n1", title: "One", parentId: "f1", md: "# One" } } }),
    });
    const note = await client.getPage("ws1", "n1");
    expect(note).toMatchObject({ globalId: "n1", title: "One", parentId: "f1", workspaceId: "ws1", type: "note", isPortalShare: false });
    expect(note).not.toHaveProperty("md");
  });

  it("createFolder returns a folder-typed FusebaseNote", async () => {
    const { client } = tokenOnlyClient({
      createWorkspaceNoteFolder: () => ({ ok: true, data: { folder: { globalId: "f9", title: "New", parentId: "default" } } }),
    });
    const folder = await client.createFolder("ws1", "New");
    expect(folder).toMatchObject({ globalId: "f9", title: "New", parentId: "default", type: "folder", workspaceId: "ws1" });
  });
});

describe("Gate fallback errors (COR-16)", () => {
  it("getPage says what Gate returned instead of 'No authentication configured'", async () => {
    const { client } = tokenOnlyClient({ getWorkspaceNote: () => ({ ok: true, data: {} }) });
    const err = await client.getPage("ws1", "n1").catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).not.toMatch(/No authentication configured/);
    expect((err as Error).message).toMatch(/getWorkspaceNote returned no note/);
  });

  it("createPage says what Gate returned instead of 'No authentication configured'", async () => {
    const { client } = tokenOnlyClient({ createWorkspaceNote: () => ({ ok: true, data: { note: {} } }) });
    await expect(client.createPage("ws1", "T")).rejects.toThrow(/createWorkspaceNote returned no note id/);
  });

  it("listWorkspaces rejects a response without a workspaces array", async () => {
    const { client } = tokenOnlyClient({ listWorkspaces: () => ({ ok: true, data: {} }) });
    await expect(client.listWorkspaces()).rejects.toThrow(/listWorkspaces returned no workspaces/);
  });

  it("still says 'No authentication configured' with neither cookie nor Gate", async () => {
    const client = new FusebaseClient({ host: "unit-test.invalid", orgId: "o", autoRefresh: false });
    await expect(client.getPage("ws1", "n1")).rejects.toThrow(/No authentication configured/);
  });
});

describe("getNavigationMenu workspace (COR-6)", () => {
  function stubMenuFetch() {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(String(url));
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }));
    return urls;
  }

  it("uses the first workspace from the Gate fallback, not a hardcoded id", async () => {
    const urls = stubMenuFetch();
    const { client } = tokenOnlyClient({
      listWorkspaces: () => ({ ok: true, data: { workspaces: [{ id: "wsA", isDefault: true }] } }),
    });
    await client.getNavigationMenu().catch(() => undefined);
    expect(urls.join("\n")).not.toContain("45h7lom5ryjak34u");
    expect(urls.some((u) => u.includes("workspace=wsA"))).toBe(true);
  });

  it("fails clearly when no workspace can be found", async () => {
    const urls = stubMenuFetch();
    const { client } = tokenOnlyClient({ listWorkspaces: () => ({ ok: true, data: { workspaces: [] } }) });
    await expect(client.getNavigationMenu()).rejects.toThrow(/workspace/i);
    expect(urls.join("\n")).not.toContain("45h7lom5ryjak34u");
  });
});

describe("listTaskLists return type (MCP-12)", () => {
  it("is the { taskLists, tasks, ... } object the API returns", async () => {
    const live = { taskLists: [{ globalId: "tl1", workspaceId: "ws1", title: "Board", createdAt: 1, updatedAt: 2 }], tasks: [], notes: [], labels: [] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(live), { status: 200, headers: { "content-type": "application/json" } })));
    const client = new FusebaseClient({ host: "unit-test.invalid", orgId: "o", cookie: "eversessionid=s", autoRefresh: false });
    // Compile-time check (tsc -p tsconfig.check.json): fails while the method is typed as an array.
    const res: FusebaseTaskListsResponse = await client.listTaskLists("ws1");
    expect(res.taskLists[0].globalId).toBe("tl1");
  });
});
