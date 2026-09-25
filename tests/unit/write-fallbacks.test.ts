/**
 * COR-1: a write that fails on one API must only be retried on another API when the first
 * attempt provably did not apply (rejected with a 4xx, or never connected). Timeouts and
 * 5xx responses may have been applied, so retrying elsewhere can run the write twice.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/yjs-ws-writer.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/yjs-ws-writer.js")>();
  return { ...actual, appendContentViaWebSocket: vi.fn() };
});

import { appendContentViaWebSocket } from "../../src/yjs-ws-writer.js";
import { FusebaseClient } from "../../src/client.js";

function fakeBridge() {
  return {
    hasGate: true,
    hasDashboards: false,
    isConfigured: true,
    getIdentity: vi.fn(async () => ({ orgId: "unit-org" })),
    toolCall: vi.fn(async () => ({ data: { note: { globalId: "gate-note" } } })),
  };
}

function client(bridge = fakeBridge()) {
  const c = new FusebaseClient({ host: "unit-test.invalid", orgId: "unit-org", cookie: "eversessionid=s", autoRefresh: false, gateBridge: bridge as any });
  return { c, bridge };
}

type Responder = (url: string, init?: RequestInit) => Response | Promise<Response>;
function stubFetch(responder: Responder) {
  const calls: Array<{ url: string; method: string }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), method: (init?.method || "GET").toUpperCase() });
    return responder(String(url), init);
  }));
  return calls;
}

const timeout = () => {
  throw Object.assign(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
};
const connectRefused = () => {
  throw Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) });
};
const status = (code: number) => () => new Response(`{"error":"x"}`, { status: code, headers: { "content-type": "application/json" } });
const json = (body: unknown) => () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(appendContentViaWebSocket).mockReset();
});

describe("createPage fallback (COR-1)", () => {
  it("does not create the page again through Gate after a timeout", async () => {
    stubFetch(timeout);
    const { c, bridge } = client();
    await expect(c.createPage("ws", "Title")).rejects.toThrow();
    expect(bridge.toolCall).not.toHaveBeenCalled();
  });

  it("does not create the page again through Gate after a 5xx", async () => {
    stubFetch(status(502));
    const { c, bridge } = client();
    await expect(c.createPage("ws", "Title")).rejects.toThrow(/502/);
    expect(bridge.toolCall).not.toHaveBeenCalled();
  });

  it("falls back to Gate when the web API rejects the session (401)", async () => {
    stubFetch(status(401));
    const { c, bridge } = client();
    await expect(c.createPage("ws", "Title")).resolves.toMatchObject({ globalId: "gate-note" });
    expect(bridge.toolCall).toHaveBeenCalledWith("createWorkspaceNote", expect.anything());
  });

  it("falls back to Gate when the web API can't be reached", async () => {
    stubFetch(connectRefused);
    const { c, bridge } = client();
    await expect(c.createPage("ws", "Title")).resolves.toMatchObject({ globalId: "gate-note" });
    expect(bridge.toolCall).toHaveBeenCalled();
  });
});

describe("createFolder fallback (COR-1)", () => {
  it("does not create the folder again through Gate after a timeout", async () => {
    stubFetch(timeout);
    const { c, bridge } = client();
    await expect(c.createFolder("ws", "Folder")).rejects.toThrow();
    expect(bridge.toolCall).not.toHaveBeenCalled();
  });
});

describe("appendPageContent fallback (COR-1)", () => {
  it("does not append again through Gate when the WebSocket write timed out", async () => {
    vi.mocked(appendContentViaWebSocket).mockResolvedValue({ success: false, error: "Timeout" });
    const { c, bridge } = client();
    const res = await c.appendPageContent("ws", "p", { markdown: "hello" });
    expect(res.success).toBe(false);
    expect(bridge.toolCall).not.toHaveBeenCalled();
  });

  it("falls back to Gate when the WebSocket never authenticated", async () => {
    vi.mocked(appendContentViaWebSocket).mockResolvedValue({ success: false, error: "JWT auth failed: Token request failed: 401" });
    const { c, bridge } = client();
    const res = await c.appendPageContent("ws", "p", { markdown: "hello" });
    expect(res.success).toBe(true);
    expect(bridge.toolCall).toHaveBeenCalledWith("appendWorkspaceNoteContent", expect.anything());
  });
});

describe("isolated SQL writes (COR-1)", () => {
  it("does not re-run a statement over REST when Gate rejected it", async () => {
    const calls = stubFetch(json({ rowCount: 1 }));
    const bridge = fakeBridge();
    bridge.toolCall.mockRejectedValue(new Error("Upstream FuseBase [executeIsolatedStoreSql] error: duplicate key value violates unique constraint"));
    const { c } = client(bridge);
    await expect(c.executeIsolatedStoreSql("store", "INSERT INTO t VALUES (1)", [], "dev")).rejects.toThrow(/duplicate key/);
    expect(calls.filter((x) => x.url.includes("/sql/execute"))).toHaveLength(0);
  });

  it("does not re-apply migrations over REST when Gate rejected them", async () => {
    const calls = stubFetch(json({ applied: 1 }));
    const bridge = fakeBridge();
    bridge.toolCall.mockRejectedValue(new Error("Upstream FuseBase [applyIsolatedStoreSqlMigrations] error: syntax error"));
    const { c } = client(bridge);
    await expect(c.applyIsolatedStoreSqlMigrations("store", [{ name: "0001", sql: "CREATE TABLE t()" }] as any, "dev")).rejects.toThrow(/syntax error/);
    expect(calls.filter((x) => x.url.includes("/migrations"))).toHaveLength(0);
  });
});

describe("agent runs and automation triggers (COR-1)", () => {
  it("does not start the agent again on the second endpoint after a 5xx", async () => {
    const calls = stubFetch(status(504));
    const { c } = client();
    await expect(c.runAiAgentTask("agent", "do it", { workspaceId: "ws" })).rejects.toThrow(/504/);
    expect(calls.filter((x) => x.url.includes("/run"))).toHaveLength(0);
  });

  it("does not trigger the flow again via its webhook after a 5xx", async () => {
    const calls = stubFetch((url) => (url.includes("fusebase-auth") ? json({ token: "t", projectId: "p" })() : status(500)()));
    const { c } = client();
    await expect(c.triggerAutomationFlow("flow", {})).rejects.toThrow(/500/);
    expect(calls.filter((x) => x.url.includes("/webhooks/"))).toHaveLength(0);
  });
});
