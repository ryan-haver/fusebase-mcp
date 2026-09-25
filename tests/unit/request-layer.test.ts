/**
 * The shared request layer in FusebaseClient (COR-4, COR-5, COR-8, COR-16).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { FusebaseClient } from "../../src/client.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

let hostCounter = 0;
/** Each test gets its own host so the per-host rate limiter doesn't couple tests. */
function newClient(extra: Record<string, unknown> = {}) {
  hostCounter++;
  return new FusebaseClient({ host: `unit-${hostCounter}.invalid`, orgId: "o", cookie: "eversessionid=s", autoRefresh: false, ...extra } as any);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("single-flight cookie refresh (COR-5)", () => {
  it("refreshes once when several requests hit 401 at the same time", async () => {
    let refreshed = false;
    vi.stubGlobal("fetch", vi.fn(async () => (refreshed ? json([]) : new Response("", { status: 401 }))));
    const refresh = vi.spyOn(FusebaseClient.prototype, "refreshAuth").mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      refreshed = true;
      return true;
    });

    const host = `unit-refresh-${Date.now()}.invalid`;
    const clients = [1, 2, 3].map(() => new FusebaseClient({ host, orgId: "o", cookie: "eversessionid=s", autoRefresh: true }));
    await Promise.all(clients.map((c) => c.listWorkspaces().catch(() => undefined)));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("response validation (COR-8)", () => {
  it("treats a redirect to the login page as an expired session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      redirected: true,
      url: "https://unit.invalid/auth/login",
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => "<html>Sign in</html>",
    })));
    await expect(newClient().getOrgUsage()).rejects.toThrow(/session expired/);
  });

  it("rejects truncated JSON instead of returning repaired partial data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"items":[{"id":1},{"id":', { status: 200, headers: { "content-type": "application/json" } })));
    await expect(newClient().getOrgUsage()).rejects.toThrow(/malformed JSON/);
  });

  it("rejects an HTML page where API data was expected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<!DOCTYPE html><html></html>", { status: 200, headers: { "content-type": "text/html" } })));
    await expect(newClient().getOrgUsage()).rejects.toThrow(/HTML page instead of data/);
  });

  it("agent public profile keeps complete fields from the server's truncated body", async () => {
    // Live: this endpoint sends JSON cut off mid-string with a matching Content-Length.
    const body = '{"id":39,"globalId":"dqw8","title":"Translator","settings":{"a":1},"iconName":"TRANSLATION_ICON","';
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200, headers: { "content-type": "application/json" } })));
    const profile = await newClient().getAgentPublicProfile("dqw8");
    expect(profile).toMatchObject({ id: 39, title: "Translator", settings: { a: 1 }, iconName: "TRANSLATION_ICON", _truncated: true });
  });

  it("parses JSON that the server labels text/html", async () => {
    // Live: /v1/portals/orgs/{org}/available answers `true` with content-type text/html.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("true", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } })));
    await expect(newClient().checkPortalAvailability()).resolves.toBe(true);
  });
});

describe("rate limiting under concurrency (COR-16)", () => {
  it("spaces concurrent requests to the same host at least ~200 ms apart", async () => {
    const starts: number[] = [];
    vi.stubGlobal("fetch", vi.fn(async () => {
      starts.push(Date.now());
      return json({});
    }));
    const c = newClient();
    await Promise.all([c.getOrgUsage(), c.getOrgUsage(), c.getOrgUsage()]);
    starts.sort((a, b) => a - b);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(180);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(180);
  });
});

describe("former raw-fetch calls use the shared request path (COR-4)", () => {
  it("deleteDatabase and exportCSV send the configured bearer token", async () => {
    const seen: Array<{ url: string; auth: string | null }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      seen.push({ url: String(url), auth: new Headers(init?.headers as HeadersInit).get("authorization") });
      return String(url).includes("/export/csv") ? new Response("a,b\n1,2", { status: 200 }) : new Response(null, { status: 204 });
    }));
    const c = newClient({ gateToken: "gate-token" });
    await c.deleteDatabase("db1");
    const csv = await c.exportCSV("dash", "view");
    expect(csv.csv).toBe("a,b\n1,2");
    expect(seen.map((s) => s.auth)).toEqual(["Bearer gate-token", "Bearer gate-token"]);
  });

  it("refuses to return a huge attachment inline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 200, headers: { "content-length": String(50 * 1024 * 1024) } })));
    await expect(newClient().downloadAttachment("ws", "att", "big.bin")).rejects.toThrow(/saveToDisk/);
  });
});

// Found by the token-only coverage run: every part failing came back as all-null "preferences".
describe("multi-part reads don't hide failures (getUserPreferences, getBillingInfo)", () => {
  it("throws when every part fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Unauthorized" }, 401)));
    await expect(newClient({ autoRefresh: false }).getUserPreferences()).rejects.toThrow(/401/);
    await expect(newClient({ autoRefresh: false }).getBillingInfo()).rejects.toThrow(/401/);
  });

  it("returns the parts that worked and names the ones that didn't", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("/notification/options") ? json({ email: true }) : json({ error: "Unauthorized" }, 401))));
    const prefs = await newClient({ autoRefresh: false }).getUserPreferences();
    expect(prefs.notificationOptions).toEqual({ email: true });
    expect(prefs.webEditorVars).toBeNull();
    expect(Object.keys(prefs.unavailable ?? {}).sort()).toEqual(["lastOpenedWorkspaces", "webEditorVars"]);
  });
});
