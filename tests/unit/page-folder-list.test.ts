import { describe, expect, it, vi } from "vitest";
import { FusebaseClient } from "../../src/client.js";

describe("default folder after moving a Gate-created page", () => {
  it("filters stale folder membership before pagination and computes the matching total", async () => {
    const client = new FusebaseClient({ host: "folder-test.invalid", orgId: "test", cookie: "test", autoRefresh: false });
    const records = Array.from({ length: 102 }, (_, i) => ({ globalId: `p${i}`, parentId: i === 0 || i === 101 ? "default" : "moved-folder" }));
    const request = vi.fn(async (url: string) => {
      const params = new URL(url, "https://folder-test.invalid").searchParams;
      expect(params.get("rootId")).toBe("root");
      const range = JSON.parse(params.get("range")!);
      return { items: records.slice(range.offset, range.offset + range.limit), total: records.length };
    });
    Object.assign(client, { request });
    const result = await client.listPages("sandbox", { rootId: "default", offset: 1, limit: 1 });
    expect(result).toEqual({ items: [records[101]], total: 2 });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("preserves the workspace-wide root listing", async () => {
    const client = new FusebaseClient({ host: "folder-test.invalid", orgId: "test", cookie: "test", autoRefresh: false });
    const items = [{ globalId: "child", parentId: "folder" }];
    Object.assign(client, { request: vi.fn(async () => ({ items, total: 1 })) });
    expect(await client.listPages("sandbox", { rootId: "root" })).toEqual({ items, total: 1 });
  });
});
