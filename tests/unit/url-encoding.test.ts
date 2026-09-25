import { afterEach, describe, expect, it, vi } from "vitest";
import { FusebaseClient } from "../../src/client.js";
import { apiPath } from "../../src/url-path.js";

// SEC-5: model-supplied IDs must not be able to traverse to other endpoints.
const EVIL = "x/../../../v2/api/orgs/evil";
const EVIL_ENC = encodeURIComponent(EVIL);

function client() {
  return new FusebaseClient({ host: "unit-test.invalid", orgId: "unit-org", cookie: "unit-cookie", autoRefresh: false });
}

function stubFetch() {
  const urls: string[] = [];
  const fetchMock = vi.fn(async (url: string | URL) => {
    urls.push(String(url));
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return urls;
}

function pathOf(url: string): string {
  return new URL(url).pathname;
}

afterEach(() => vi.unstubAllGlobals());

describe("apiPath", () => {
  it("encodes each interpolated value as a single segment", () => {
    expect(apiPath`/a/${"b/c"}/d`).toBe("/a/b%2Fc/d");
    expect(apiPath`/a/${"q?x=1#h"}`).toBe("/a/q%3Fx%3D1%23h");
    expect(apiPath`/a/${"has space"}`).toBe("/a/has%20space");
    expect(apiPath`/a/${"50%"}`).toBe("/a/50%25");
    expect(apiPath`/a/${42}/b`).toBe("/a/42/b");
  });

  it("neutralises dot-segment traversal", () => {
    const p = apiPath`/v2/api/workspaces/${"ws"}/notes/${"../../../orgs/evil"}`;
    expect(p).toBe("/v2/api/workspaces/ws/notes/..%2F..%2F..%2Forgs%2Fevil");
    expect(new URL(p, "https://h.invalid").pathname).toBe(p);
  });

  it("leaves literal template parts untouched", () => {
    expect(apiPath`/gwapi2/ft%3Atasks/workspaces/${"ws"}/tasks?addToOrder=false`).toBe(
      "/gwapi2/ft%3Atasks/workspaces/ws/tasks?addToOrder=false",
    );
  });

  it("throws on empty, undefined or null values", () => {
    expect(() => apiPath`/a/${""}/b`).toThrow(/empty string/);
    expect(() => apiPath`/a/${undefined}/b`).toThrow(/undefined/);
    expect(() => apiPath`/a/${null}/b`).toThrow(/null/);
  });
});

describe("FusebaseClient path-ID encoding (SEC-5)", () => {
  it("deletePage cannot be redirected by a traversal noteId", async () => {
    const urls = stubFetch();
    await client().deletePage("ws", EVIL);
    expect(urls).toHaveLength(1);
    expect(pathOf(urls[0])).toBe(`/v2/api/workspaces/ws/notes/${EVIL_ENC}`);
  });

  it("getPage cannot be redirected by a traversal noteId or workspaceId", async () => {
    const urls = stubFetch();
    await client().getPage(EVIL, EVIL);
    expect(pathOf(urls[0])).toBe(`/v2/api/web-editor/space/${EVIL_ENC}/note/${EVIL_ENC}`);
  });

  it("deleteRow cannot be redirected by a traversal rowId", async () => {
    const urls = stubFetch();
    await client().deleteRow("dash", EVIL);
    expect(pathOf(urls[0])).toBe(`/v4/api/proxy/dashboard-service/v1/dashboards/dash/rows/${EVIL_ENC}`);
  });

  it("deleteDatabase (raw fetch) cannot be redirected by a traversal dbId", async () => {
    const urls = stubFetch();
    await client().deleteDatabase(EVIL);
    expect(pathOf(urls[0])).toBe(`/v4/api/proxy/dashboard-service/v1/databases/${EVIL_ENC}`);
  });

  it("query-string values are encoded and cannot inject parameters", async () => {
    const urls = stubFetch();
    await client().listFolders("ws&depth=1");
    const u = new URL(urls[0]);
    expect(u.pathname).toBe("/gwapi2/ft:notes/menu");
    expect(u.searchParams.get("workspace")).toBe("ws&depth=1");
    expect(u.searchParams.get("depth")).toBe("-1");
  });

  it("rejects an empty path ID instead of hitting the parent endpoint", async () => {
    const urls = stubFetch();
    await expect(client().deletePage("ws", "")).rejects.toThrow(/apiPath/);
    expect(urls).toHaveLength(0);
  });
});
