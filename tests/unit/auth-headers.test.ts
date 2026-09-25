/**
 * COR-5: automation endpoints authenticate with their own JWT. When a Gate/Dashboards token
 * is also configured, the generic `authorization` header must not be sent alongside it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { FusebaseClient } from "../../src/client.js";

afterEach(() => vi.unstubAllGlobals());

function capture() {
  const sent: Array<{ url: string; headers: Headers }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    sent.push({ url: String(url), headers: new Headers(init?.headers as HeadersInit) });
    const body = String(url).includes("fusebase-auth") ? { token: "automation-jwt", projectId: "proj" } : [];
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return sent;
}

describe("automation auth headers (COR-5)", () => {
  it("sends only the automation JWT to automation endpoints when a Gate token is configured", async () => {
    const sent = capture();
    const c = new FusebaseClient({ host: "unit-test.invalid", orgId: "o", cookie: "eversessionid=s", gateToken: "gate-token", autoRefresh: false });
    await c.listAutomationPieces();
    const call = sent.find((s) => s.url.includes("/automation/api/v1/pieces"))!;
    expect(call.headers.get("authorization")).toBe("Bearer automation-jwt");
  });

  it("still sends the Gate token to non-automation endpoints", async () => {
    const sent = capture();
    const c = new FusebaseClient({ host: "unit-test.invalid", orgId: "o", cookie: "eversessionid=s", gateToken: "gate-token", autoRefresh: false });
    await c.listWorkspaces().catch(() => {});
    expect(sent[0].headers.get("authorization")).toBe("Bearer gate-token");
  });
});
