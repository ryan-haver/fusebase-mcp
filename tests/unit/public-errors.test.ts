import { afterEach, describe, expect, it, vi } from "vitest";
import { FusebaseClient } from "../../src/client.js";
import { errorResult } from "../../src/tools/helpers.js";
import { redactUpstreamDetail } from "../../src/gate-bridge.js";
import { startServer, fakeClient } from "./helpers/server.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerAnnotatedTool } from "../../src/tools/registry.js";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("REV-02: public error boundaries", () => {
  it("redacts upstream request configuration in the REST exception and MCP result", async () => {
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      message: "Request rejected", code: "UPSTREAM_FAILURE",
      config: { headers: { Authorization: "Bearer SYNTHETIC_HEADER", Cookie: "sid=SYNTHETIC_COOKIE" }, url: "http://internal-service/private" },
    }), { status: 500 })));
    const client = new FusebaseClient({ host: "errors.invalid", orgId: "org", cookie: "synthetic-cookie", autoRefresh: false });
    const failure = await client.getOrgUsage().catch((error: unknown) => error);
    const rendered = JSON.stringify(errorResult(failure));
    expect(rendered).toContain("500");
    expect(rendered).toContain("Request rejected");
    expect(rendered).toContain("UPSTREAM_FAILURE");
    for (const secret of ["SYNTHETIC_HEADER", "SYNTHETIC_COOKIE", "internal-service"]) {
      expect(String(failure)).not.toContain(secret);
      expect(JSON.stringify(failure)).not.toContain(secret);
      expect(rendered).not.toContain(secret);
      expect(JSON.stringify(logs.mock.calls)).not.toContain(secret);
    }
    const session = await startServer(client);
    try {
      const result = await session.callText("get_page", { workspaceId: "workspace", pageId: "page" });
      expect(result.isError).toBe(true);
      expect(result.text).not.toContain("SYNTHETIC_HEADER");
      expect(result.text).toContain("500");
    } finally { await session.close(); }
  });

  it.each([
    'Authorization: Bearer SYNTHETIC_TOKEN\nstatus 403',
    'Cookie: sid=SYNTHETIC_TOKEN; other=private\nstatus 403',
    'access_token=SYNTHETIC_TOKEN, status 403',
    "apiKey='SYNTHETIC_TOKEN', status 403",
    'https://example.invalid/link?id=SYNTHETIC_TOKEN&confirmEmail=private#secret',
    'https://user:SYNTHETIC_TOKEN@example.invalid/path?password=private',
  ])("redacts credential-bearing plain text: %s", (message) => {
    const output = JSON.stringify(errorResult(new Error(message)));
    expect(output).not.toContain("SYNTHETIC_TOKEN");
    expect(redactUpstreamDetail(message)).not.toContain("SYNTHETIC_TOKEN");
  });

  it("drops request-only JSON bodies without safe diagnostic fields", () => {
    const output = redactUpstreamDetail(JSON.stringify({ config: { headers: { Authorization: "Bearer SYNTHETIC_HEADER" }, data: "SYNTHETIC_BODY" } }));
    expect(output).not.toContain("SYNTHETIC_");
  });

  it("bounds generic public errors as well as upstream errors", () => {
    expect(errorResult(new Error("x".repeat(100_000))).content[0].text.length).toBeLessThanOrEqual(2010);
    expect(redactUpstreamDetail("x".repeat(100_000)).length).toBeLessThanOrEqual(501);
  });

  it("redacts an exception thrown before a handler's local error mapping", async () => {
    const server = new McpServer({ name: "error-test", version: "0" });
    registerAnnotatedTool(server, "test_failure", "Test failure", {}, async () => {
      throw new Error("Authorization: Bearer SYNTHETIC_PRE_HANDLER\nConfiguration failed");
    });
    const client = new Client({ name: "test", version: "0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(a), server.connect(b)]);
    try {
      const result = await client.callTool({ name: "test_failure", arguments: {} });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).not.toContain("SYNTHETIC_PRE_HANDLER");
      expect(JSON.stringify(result)).toContain("Configuration failed");
    } finally { await client.close(); await server.close(); }
  });

  it("redacts secrets inside an escaped JSON error message", () => {
    const message = JSON.stringify({ message: JSON.stringify({ message: "Failed", config: { privateValue: "SYNTHETIC_NESTED" } }) });
    expect(redactUpstreamDetail(message)).not.toContain("SYNTHETIC_NESTED");
    expect(redactUpstreamDetail(message)).toContain("Failed");
  });
});

it("redacts errors embedded in session health results", async () => {
  const session = await startServer(fakeClient({
    gateBridge: {isConfigured:true, getIdentity:async () => {throw new Error("Authorization: Bearer SYNTHETIC_HEALTH\nstatus 403");}},
    listWorkspaces: async () => [],
  }));
  try {
    const result = await session.callText("check_session_health", {});
    expect(result.text).not.toContain("SYNTHETIC_HEALTH");
    expect(result.text).toContain("WARNING");
  } finally {await session.close();}
});
it("redacts partial swarm errors while retaining created artifact IDs", async () => {
  const session = await startServer(fakeClient({createDatabase:async () => {throw new Error("Authorization: Bearer SYNTHETIC_SWARM\nstatus 403");}}), {tier:"all"});
  try {
    const result = await session.callText("fusebase_swarm_init", {workspaceId:"workspace",title:"QA"});
    expect(result.isError).toBe(true);
    expect(result.text).not.toContain("SYNTHETIC_SWARM");
    expect(result.text).toContain("created");
  } finally {await session.close();}
});
