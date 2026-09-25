/**
 * HTTP transport for the MCP server.
 *
 * Endpoints:
 *   POST/GET/DELETE /mcp   Streamable HTTP (current MCP transport)
 *   GET /sse, POST /message  legacy SSE transport (kept for one release, same protections)
 *   GET /health            liveness probe (no auth, no details)
 *
 * Every session runs with the server owner's FuseBase credentials, so access is guarded:
 *   - binds 127.0.0.1 unless told otherwise; a non-loopback bind requires MCP_AUTH_TOKEN
 *   - when MCP_AUTH_TOKEN is set, every MCP request needs `Authorization: Bearer <token>`
 *   - the Host header must be an allowed host (blocks DNS rebinding)
 *   - requests carrying an Origin header must come from an allowed origin; no wildcard CORS
 */

import * as http from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

export interface HttpServerOptions {
  host: string;
  port: number;
  /** Bearer token required on MCP endpoints. Mandatory when host is not loopback. */
  authToken?: string;
  /** Allowed Host header values (hostname, or hostname:port), or "*" to skip the check. */
  allowedHosts: string[] | "*";
  /** Browser origins allowed to call the server (exact match, e.g. "http://localhost:5173"). */
  allowedOrigins: string[];
  maxSessions: number;
}

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];
const MAX_BODY_BYTES = 4 * 1024 * 1024;

export function isLoopback(host: string): boolean {
  return LOOPBACK_HOSTS.includes(host.toLowerCase());
}

function csv(value: string | undefined): string[] {
  return (value || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function argValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : undefined;
}

/**
 * Build HTTP options from CLI flags and environment:
 *   --host / MCP_HOST (default 127.0.0.1), --port / PORT (default 3000), MCP_AUTH_TOKEN,
 *   MCP_ALLOWED_HOSTS (comma list, or "*" when a token is set), MCP_ALLOWED_ORIGINS,
 *   MCP_MAX_SESSIONS (default 50).
 * Throws when the configuration would expose the server without authentication.
 */
export function resolveHttpOptions(argv: string[], env: NodeJS.ProcessEnv): HttpServerOptions {
  const host = argValue(argv, "--host") || env.MCP_HOST || "127.0.0.1";
  const port = parseInt(argValue(argv, "--port") || env.PORT || "3000", 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid port: ${port}`);

  const authToken = env.MCP_AUTH_TOKEN || undefined;
  if (authToken !== undefined && authToken.length < 16) {
    throw new Error("MCP_AUTH_TOKEN must be at least 16 characters.");
  }
  if (!isLoopback(host) && !authToken) {
    throw new Error(
      `Refusing to listen on ${host} without authentication: every session uses your FuseBase credentials. ` +
      "Set MCP_AUTH_TOKEN (e.g. `openssl rand -hex 32`), or bind to 127.0.0.1.",
    );
  }

  const hostsSetting = env.MCP_ALLOWED_HOSTS?.trim();
  let allowedHosts: string[] | "*";
  if (hostsSetting === "*") {
    if (!authToken) throw new Error('MCP_ALLOWED_HOSTS="*" requires MCP_AUTH_TOKEN.');
    allowedHosts = "*";
  } else {
    allowedHosts = [...LOOPBACK_HOSTS, ...csv(hostsSetting).map((h) => h.toLowerCase())];
  }

  return {
    host,
    port,
    authToken,
    allowedHosts,
    allowedOrigins: csv(env.MCP_ALLOWED_ORIGINS),
    maxSessions: parseInt(env.MCP_MAX_SESSIONS || "50", 10),
  };
}

function hostAllowed(header: string | undefined, allowed: string[] | "*"): boolean {
  if (allowed === "*") return true;
  if (!header) return false;
  const value = header.toLowerCase();
  const hostname = value.startsWith("[") ? value.slice(0, value.indexOf("]") + 1) : value.split(":")[0];
  return allowed.includes(value) || allowed.includes(hostname);
}

function tokenMatches(header: string | undefined, token: string): boolean {
  const match = /^Bearer\s+(.+)$/i.exec(header || "");
  if (!match) return false;
  const a = Buffer.from(match[1].trim());
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "Content-Type": "application/json", ...headers }).end(JSON.stringify(body));
}

function jsonRpcError(res: http.ServerResponse, status: number, message: string): void {
  sendJson(res, status, { jsonrpc: "2.0", error: { code: -32000, message }, id: null });
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Request body too large"), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { status: 400 });
  }
}

export interface HttpServerHandle {
  server: http.Server;
  port: number;
  close(): Promise<void>;
}

export async function startHttpServer(
  options: HttpServerOptions,
  createServer: () => McpServer,
  info: { version: string },
): Promise<HttpServerHandle> {
  const streamable = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();
  const legacy = new Map<string, { server: McpServer; transport: SSEServerTransport }>();
  const sessionCount = () => streamable.size + legacy.size;

  const httpServer = http.createServer(async (req, res) => {
    try {
      // 1. Host header (DNS rebinding protection)
      if (!hostAllowed(req.headers.host, options.allowedHosts)) {
        sendJson(res, 403, { error: "Host not allowed" });
        return;
      }

      // 2. Origin (browser callers). Non-browser MCP clients send no Origin header.
      const origin = req.headers.origin;
      if (origin) {
        if (!options.allowedOrigins.includes(origin)) {
          sendJson(res, 403, { error: "Origin not allowed" });
          return;
        }
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
      }
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id, mcp-protocol-version, last-event-id",
        }).end();
        return;
      }

      const url = new URL(req.url || "/", "http://localhost");

      // 3. Liveness probe: no auth, no details.
      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { status: "ok", server: "fusebase-mcp", version: info.version });
        return;
      }

      // 4. Authentication
      if (options.authToken && !tokenMatches(req.headers.authorization, options.authToken)) {
        sendJson(res, 401, { error: "Unauthorized" }, { "WWW-Authenticate": 'Bearer realm="fusebase-mcp"' });
        return;
      }

      // 5. Streamable HTTP
      if (url.pathname === "/mcp") {
        const sessionId = req.headers["mcp-session-id"];
        if (typeof sessionId === "string") {
          const session = streamable.get(sessionId);
          if (!session) return jsonRpcError(res, 404, "Session not found");
          const body = req.method === "POST" ? await readJsonBody(req) : undefined;
          await session.transport.handleRequest(req, res, body);
          return;
        }
        if (req.method !== "POST") return jsonRpcError(res, 400, "Missing mcp-session-id header");
        const body = await readJsonBody(req);
        if (!isInitializeRequest(body)) return jsonRpcError(res, 400, "First request must be initialize");
        if (sessionCount() >= options.maxSessions) return jsonRpcError(res, 503, "Too many sessions");

        const server = createServer();
        const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            streamable.set(id, { server, transport });
          },
        });
        transport.onclose = () => {
          if (transport.sessionId) streamable.delete(transport.sessionId);
        };
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }

      // 6. Legacy SSE
      if (req.method === "GET" && url.pathname === "/sse") {
        if (sessionCount() >= options.maxSessions) return jsonRpcError(res, 503, "Too many sessions");
        const transport = new SSEServerTransport("/message", res);
        const server = createServer();
        legacy.set(transport.sessionId, { server, transport });
        transport.onclose = () => {
          legacy.delete(transport.sessionId);
        };
        await server.connect(transport);
        return;
      }
      if (req.method === "POST" && url.pathname === "/message") {
        const session = legacy.get(url.searchParams.get("sessionId") || "");
        if (!session) return jsonRpcError(res, 404, "Session not found");
        await session.transport.handlePostMessage(req, res);
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      const status = (err as { status?: number }).status || 500;
      console.error(`[fusebase] HTTP ${req.method} ${req.url} failed: ${err instanceof Error ? err.message : err}`);
      if (!res.headersSent) jsonRpcError(res, status, status === 500 ? "Internal server error" : (err as Error).message);
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(options.port, options.host, () => resolve());
  });
  const port = (httpServer.address() as { port: number }).port;

  return {
    server: httpServer,
    port,
    async close() {
      for (const { transport } of [...streamable.values(), ...legacy.values()]) {
        await transport.close().catch(() => {});
      }
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}
