import { afterEach, describe, expect, it } from "vitest";
import * as http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { z } from "zod";
import { resolveHttpOptions, startHttpServer, type HttpServerHandle, type HttpServerOptions } from "../../src/http-server.js";

const TOKEN = "unit-test-token-0123456789abcdef";

function makeServer(): McpServer {
  const server = new McpServer({ name: "fusebase", version: "test" });
  server.tool("echo", "Echo text back", { text: z.string().describe("Text") }, async ({ text }) => ({
    content: [{ type: "text" as const, text }],
  }));
  return server;
}

let handle: HttpServerHandle | undefined;
afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

async function start(overrides: Partial<HttpServerOptions> = {}): Promise<string> {
  handle = await startHttpServer(
    { host: "127.0.0.1", port: 0, authToken: TOKEN, allowedHosts: ["localhost", "127.0.0.1"], allowedOrigins: [], maxSessions: 5, ...overrides },
    makeServer,
    { version: "test" },
  );
  return `http://127.0.0.1:${handle.port}`;
}

const auth = { Authorization: `Bearer ${TOKEN}` };
const initBody = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } } });
const post = (base: string, headers: Record<string, string> = {}) =>
  fetch(`${base}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers }, body: initBody });

describe("resolveHttpOptions", () => {
  it("binds loopback with no token by default", () => {
    const o = resolveHttpOptions([], {});
    expect(o.host).toBe("127.0.0.1");
    expect(o.authToken).toBeUndefined();
  });

  it("refuses a non-loopback bind without MCP_AUTH_TOKEN", () => {
    expect(() => resolveHttpOptions(["--host", "0.0.0.0"], {})).toThrow(/Refusing to listen/);
    expect(() => resolveHttpOptions([], { MCP_HOST: "192.168.1.5" })).toThrow(/Refusing to listen/);
  });

  it("allows a non-loopback bind with a token", () => {
    expect(resolveHttpOptions(["--host", "0.0.0.0"], { MCP_AUTH_TOKEN: TOKEN }).host).toBe("0.0.0.0");
  });

  it("rejects short tokens and an unauthenticated host wildcard", () => {
    expect(() => resolveHttpOptions([], { MCP_AUTH_TOKEN: "short" })).toThrow(/16 characters/);
    expect(() => resolveHttpOptions([], { MCP_ALLOWED_HOSTS: "*" })).toThrow(/requires MCP_AUTH_TOKEN/);
  });
});

describe("HTTP access control (SEC-1)", () => {
  it("serves /health without auth and without internal details", async () => {
    const base = await start();
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(Object.keys(await res.json()).sort()).toEqual(["server", "status", "version"]);
  });

  it("rejects MCP requests without the bearer token", async () => {
    const base = await start();
    expect((await post(base)).status).toBe(401);
    expect((await post(base, { Authorization: "Bearer wrong-token-wrong-token-xx" })).status).toBe(401);
    expect((await fetch(`${base}/sse`)).status).toBe(401);
  });

  it("rejects a foreign Host header (DNS rebinding)", async () => {
    await start();
    // fetch() silently drops a custom Host header, so use http.request.
    const status = (host: string) => new Promise<number>((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port: handle!.port, path: "/health", headers: { Host: host } }, (res) => {
        res.resume();
        resolve(res.statusCode!);
      });
      req.on("error", reject);
      req.end();
    });
    expect(await status("attacker.example")).toBe(403);
    expect(await status("attacker.example:80")).toBe(403);
    expect(await status(`localhost:${handle!.port}`)).toBe(200);
  });

  it("rejects a foreign Origin and never sends a wildcard CORS header", async () => {
    const base = await start();
    const res = await post(base, { ...auth, Origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("echoes an allowed Origin", async () => {
    const base = await start({ allowedOrigins: ["http://localhost:5173"] });
    const res = await fetch(`${base}/health`, { headers: { Origin: "http://localhost:5173" } });
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("requires initialize as the first request and caps sessions", async () => {
    const base = await start({ maxSessions: 1 });
    const notInit = await fetch(`${base}/mcp`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
    expect(notInit.status).toBe(400);
    expect((await post(base, auth)).status).toBe(200);
    expect((await post(base, auth)).status).toBe(503);
  });
});

describe("MCP over HTTP", () => {
  it("works end to end over Streamable HTTP with the token", async () => {
    const base = await start();
    const client = new Client({ name: "t", version: "0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: auth } }));
    expect((await client.listTools()).tools.map((t) => t.name)).toEqual(["echo"]);
    const res = await client.callTool({ name: "echo", arguments: { text: "hi" } });
    expect((res.content as any)[0].text).toBe("hi");
    await client.close();
  });

  it("still works over legacy SSE with the token", async () => {
    const base = await start();
    const client = new Client({ name: "t", version: "0" });
    const withAuth: typeof fetch = (url, init) => fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string>), ...auth } });
    await client.connect(new SSEClientTransport(new URL(`${base}/sse`), { requestInit: { headers: auth }, eventSourceInit: { fetch: withAuth } }));
    expect((await client.listTools()).tools).toHaveLength(1);
    await client.close();
  });

  it("works on loopback without a token when none is configured", async () => {
    const base = await start({ authToken: undefined });
    const client = new Client({ name: "t", version: "0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
    expect((await client.listTools()).tools).toHaveLength(1);
    await client.close();
  });
});
