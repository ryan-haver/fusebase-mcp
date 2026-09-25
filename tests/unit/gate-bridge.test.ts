/**
 * COR-7: FusebaseGateBridge transport behaviour — request timeout, session re-init only on a
 * session-missing signal (never resend a write after a plain 400/404), proper SSE parsing,
 * and a memoised init. MCP-12: an UNAUTHORIZED whoami payload must be an error.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { FusebaseGateBridge } from "../../src/gate-bridge.js";
import { fakeClient, startServer } from "./helpers/server.js";

interface RpcRequest {
  jsonrpc: string;
  id?: number;
  method: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}

type Handler = (req: RpcRequest, init: RequestInit) => Response | Promise<Response>;

const IDENTITY = {
  server: { name: "gate", version: "1" },
  auth: { org: { id: "org1" }, permissions: ["notes.read"] },
  defaults: { defaultWorkspaceId: "ws1" },
};

function jsonResponse(body: unknown, status = 200, sessionId?: string): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  return new Response(JSON.stringify(body), { status, headers });
}

function toolResult(id: number | undefined, payload: unknown, isError = false) {
  return { jsonrpc: "2.0", id, result: { isError, content: [{ type: "text", text: JSON.stringify(payload) }] } };
}

/** A fake Gate MCP endpoint. `onToolCall` answers tools/call; handshake messages are handled here. */
function stubGate(onToolCall: Handler, opts: { onInitialize?: Handler } = {}) {
  const calls: RpcRequest[] = [];
  let sessions = 0;
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const req = JSON.parse(String(init.body)) as RpcRequest;
    calls.push(req);
    if (req.method === "initialize") {
      if (opts.onInitialize) return opts.onInitialize(req, init);
      sessions++;
      return jsonResponse({ jsonrpc: "2.0", id: req.id, result: { protocolVersion: "2024-11-05" } }, 200, `session-${sessions}`);
    }
    if (req.method === "notifications/initialized") return new Response(null, { status: 202 });
    if (req.params?.name === "whoami") return jsonResponse(toolResult(req.id, IDENTITY));
    return onToolCall(req, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  const count = (pred: (r: RpcRequest) => boolean) => calls.filter(pred).length;
  return {
    calls,
    initializeCount: () => count((r) => r.method === "initialize"),
    toolCallCount: (name: string) => count((r) => r.method === "tools/call" && r.params?.name === name),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("gate-bridge fetch timeout (COR-7)", () => {
  it("aborts a request that takes longer than the configured timeout", async () => {
    stubGate((req, init) => new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => resolve(jsonResponse(toolResult(req.id, { ok: true }))), 400);
      init.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(init.signal?.reason ?? new DOMException("aborted", "AbortError"));
      });
    }));
    const bridge = new FusebaseGateBridge({ gateToken: "t", timeoutMs: 50 } as any);
    await bridge.init();
    await expect(bridge.toolCall("listWorkspaces", {})).rejects.toThrow(/timed out after 50 ?ms/);
  });
});

describe("gate-bridge session re-init (COR-7)", () => {
  it("does not resend tools/call after a plain 400 validation error", async () => {
    const gate = stubGate((req) => jsonResponse(
      { jsonrpc: "2.0", id: req.id, error: { code: -32602, message: "Invalid params: title is required" } },
      400,
    ));
    const bridge = new FusebaseGateBridge({ gateToken: "t" });
    await bridge.init();
    await expect(bridge.toolCall("createWorkspaceNote", { title: "" })).rejects.toThrow(/title is required/);
    expect(gate.toolCallCount("tool_call")).toBe(1);
    expect(gate.initializeCount()).toBe(1);
  });

  it("does not resend tools/call after a plain 404", async () => {
    const gate = stubGate(() => new Response("<html>Not Found</html>", { status: 404, headers: { "content-type": "text/html" } }));
    const bridge = new FusebaseGateBridge({ gateToken: "t" });
    await bridge.init();
    await expect(bridge.toolCall("createWorkspaceNote", { title: "x" })).rejects.toThrow(/HTTP 404/);
    expect(gate.toolCallCount("tool_call")).toBe(1);
    expect(gate.initializeCount()).toBe(1);
  });

  it("re-initialises and resends once when the server says the session is missing", async () => {
    let first = true;
    const gate = stubGate((req) => {
      if (first) {
        first = false;
        return jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Bad Request: Missing session ID" } }, 400);
      }
      return jsonResponse(toolResult(req.id, { ok: true, data: { workspaces: [] } }));
    });
    const bridge = new FusebaseGateBridge({ gateToken: "t" });
    await bridge.init();
    await expect(bridge.toolCall("listWorkspaces", {})).resolves.toEqual({ ok: true, data: { workspaces: [] } });
    expect(gate.toolCallCount("tool_call")).toBe(2);
    expect(gate.initializeCount()).toBe(2);
  });

  it("re-initialises when the server says the session was not found (MCP SDK wording)", async () => {
    let first = true;
    const gate = stubGate((req) => {
      if (first) {
        first = false;
        return jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Session not found" } }, 404);
      }
      return jsonResponse(toolResult(req.id, { ok: true }));
    });
    const bridge = new FusebaseGateBridge({ gateToken: "t" });
    await bridge.init();
    await expect(bridge.toolCall("listWorkspaces", {})).resolves.toEqual({ ok: true });
    expect(gate.initializeCount()).toBe(2);
  });
});

describe("gate-bridge SSE parsing (COR-7)", () => {
  const sse = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });

  it("picks the response whose id matches, joining multi-line data fields", async () => {
    stubGate((req) => {
      const text = JSON.stringify({ ok: true, data: { hello: "world" } });
      const response = JSON.stringify({ jsonrpc: "2.0", id: req.id, result: { content: [{ type: "text", text }] } });
      const cut = response.indexOf('"result"');
      return sse(
        `event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress","params":{"progress":1}}\n\n` +
        `event: message\ndata: {"jsonrpc":"2.0","id":999999,"result":{"content":[{"type":"text","text":"{\\"wrong\\":true}"}]}}\n\n` +
        `event: message\nid: 7\ndata: ${response.slice(0, cut)}\ndata: ${response.slice(cut)}\n\n`,
      );
    });
    const bridge = new FusebaseGateBridge({ gateToken: "t" });
    await bridge.init();
    await expect(bridge.toolCall("listWorkspaces", {})).resolves.toEqual({ ok: true, data: { hello: "world" } });
  });

  it("handles CRLF line endings", async () => {
    stubGate((req) => sse(
      `event: message\r\ndata: ${JSON.stringify(toolResult(req.id, { ok: true, n: 1 }))}\r\n\r\n`,
    ));
    const bridge = new FusebaseGateBridge({ gateToken: "t" });
    await bridge.init();
    await expect(bridge.toolCall("listWorkspaces", {})).resolves.toEqual({ ok: true, n: 1 });
  });
});

describe("gate-bridge init memoisation (COR-7)", () => {
  it("initialises once for concurrent first calls", async () => {
    const gate = stubGate(() => jsonResponse({}));
    const bridge = new FusebaseGateBridge({ gateToken: "t" });
    const [a, b, c] = await Promise.all([bridge.getIdentity(), bridge.getIdentity(), bridge.init()]);
    expect(gate.initializeCount()).toBe(1);
    expect(gate.toolCallCount("whoami")).toBe(1);
    expect(a.orgId).toBe("org1");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("clears a failed init so a later call can retry", async () => {
    let fail = true;
    const gate = stubGate(() => jsonResponse({}), {
      onInitialize: (req) => fail
        ? new Response("upstream down", { status: 503 })
        : jsonResponse({ jsonrpc: "2.0", id: req.id, result: {} }, 200, "session-ok"),
    });
    const bridge = new FusebaseGateBridge({ gateToken: "t" });
    await expect(bridge.getIdentity()).rejects.toThrow(/503/);
    fail = false;
    await expect(bridge.getIdentity()).resolves.toMatchObject({ orgId: "org1" });
    expect(gate.initializeCount()).toBe(2);
  });
});

describe("gate-bridge whoami errors (MCP-12)", () => {
  const unauthorized = (req: RpcRequest) => jsonResponse(toolResult(
    req.id,
    { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid token" } },
    true,
  ));

  function stubUnauthorizedWhoami() {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const req = JSON.parse(String(init.body)) as RpcRequest;
      if (req.method === "initialize") return jsonResponse({ jsonrpc: "2.0", id: req.id, result: {} }, 200, "s");
      if (req.method === "notifications/initialized") return new Response(null, { status: 202 });
      return unauthorized(req);
    }));
  }

  it("whoami throws on an UNAUTHORIZED payload", async () => {
    stubUnauthorizedWhoami();
    const bridge = new FusebaseGateBridge({ gateToken: "bad" });
    await expect(bridge.whoami("gate")).rejects.toThrow(/UNAUTHORIZED|Invalid token/);
  });

  it("whoami throws on an ok:false payload even without isError", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const req = JSON.parse(String(init.body)) as RpcRequest;
      if (req.method === "initialize") return jsonResponse({ jsonrpc: "2.0", id: req.id, result: {} }, 200, "s");
      if (req.method === "notifications/initialized") return new Response(null, { status: 202 });
      return jsonResponse(toolResult(req.id, { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid token" } }, false));
    }));
    const bridge = new FusebaseGateBridge({ gateToken: "bad" });
    await expect(bridge.whoami("gate")).rejects.toThrow(/Invalid token/);
  });

  it("fusebase_gate_whoami reports the UNAUTHORIZED payload as isError", async () => {
    stubUnauthorizedWhoami();
    const bridge = new FusebaseGateBridge({ gateToken: "bad" });
    const server = await startServer(fakeClient({ gateWhoami: (t?: "gate" | "dashboards") => bridge.whoami(t) }), { tier: "all" });
    try {
      const res = await server.callText("fusebase_gate_whoami", {});
      expect(res.isError).toBe(true);
      expect(res.text).toMatch(/UNAUTHORIZED|Invalid token/);
    } finally {
      await server.close();
    }
  });
});
