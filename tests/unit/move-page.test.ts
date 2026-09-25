/**
 * COR-26: FuseBase can recreate a moved page under a new id (found live: after moving a page
 * into a folder, the old id returned "Note not found" and a new page with the same title
 * appeared in the folder). move_page must return the id the page has afterwards.
 */
import { describe, expect, it } from "vitest";
import { FusebaseClient, moveDestination } from "../../src/client.js";

function client(overrides: Partial<Record<"getPage" | "movePage" | "listPages", (...args: any[]) => Promise<any>>>) {
  const c = new FusebaseClient({ host: "move-unit.invalid", orgId: "o", cookie: "eversessionid=s", autoRefresh: false } as any);
  Object.assign(c, overrides);
  return c;
}
const now = () => Math.floor(Date.now() / 1000);
const fast = { attempts: 3, delayMs: 1 };

describe("movePageAndResolve (COR-26)", () => {
  it("keeps the id when the page is still readable in the destination", async () => {
    const c = client({
      getPage: async () => ({ globalId: "p1", title: "Plan", parentId: "f1" }),
      movePage: async () => ({ id: "op1" }),
      listPages: async () => ({ items: [], total: 0 }),
    });
    expect(await c.movePageAndResolve("ws", "p1", { folderId: "f1" }, fast)).toMatchObject({ pageId: "p1", idChanged: false });
  });

  it("returns the new id when FuseBase recreated the page in the destination folder", async () => {
    let moved = false;
    const c = client({
      getPage: async (_ws: string, id: string) => {
        if (moved && id === "p1") throw new Error("404 Note not found");
        return { globalId: "p1", title: "Plan", parentId: "default" };
      },
      movePage: async () => {
        moved = true;
        return { id: "op1" };
      },
      listPages: async (_ws: string, opts: any) => ({
        total: 2,
        items: opts.rootId === "f1"
          ? [{ globalId: "old-same-title", title: "Plan", createdAt: now() - 3600 }, { globalId: "p2", title: "Plan", createdAt: now() }]
          : [],
      }),
    });
    expect(await c.movePageAndResolve("ws", "p1", { folderId: "f1" }, fast)).toEqual({ pageId: "p2", previousPageId: "p1", idChanged: true, operationId: "op1" });
  });

  it("fails loudly instead of returning a dead id when the page can't be found", async () => {
    let moved = false;
    const c = client({
      getPage: async () => {
        if (moved) throw new Error("404 Note not found");
        return { globalId: "p1", title: "Plan", parentId: "default" };
      },
      movePage: async () => {
        moved = true;
        return { id: "op1" };
      },
      listPages: async () => ({ items: [], total: 0 }),
    });
    await expect(c.movePageAndResolve("ws", "p1", { folderId: "f1" }, fast)).rejects.toThrow(/wasn't found in the destination/);
  });

  it("doesn't accept an unmoved page: a move to root that FuseBase ignored fails (COR-27)", async () => {
    const c = client({
      getPage: async () => ({ globalId: "p1", title: "Plan", parentId: "folder-1" }), // still in the folder
      movePage: async () => ({ id: "op1" }),
      listPages: async () => ({ items: [], total: 0 }),
    });
    await expect(c.movePageAndResolve("ws", "p1", { folderId: "root" }, fast)).rejects.toThrow(/wasn't found in the destination/);
  });
});

describe("moveDestination (COR-27)", () => {
  it("sends top-level moves to the default (Unsorted) folder", () => {
    expect(moveDestination("root")).toBe("default");
    expect(moveDestination(undefined)).toBe("default");
    expect(moveDestination("")).toBe("default");
    expect(moveDestination("f1")).toBe("f1");
  });
});
