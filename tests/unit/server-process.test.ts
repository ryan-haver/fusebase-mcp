/**
 * Tests that need the real server process (built dist/index.js). They run hermetically:
 * FUSEBASE_NO_DOTENV=1 and no tokens, so nothing reaches FuseBase.
 */
import { afterEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "child_process";
import * as net from "net";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENTRY = path.join(ROOT, "dist", "index.js");

/** Environment with every credential variable removed. */
function hermeticEnv(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !/^(FUSEBASE_|GATE_MCP_|DASHBOARDS_MCP_|MCP_TRANSPORT$|PORT$)/.test(k)) env[k] = v;
  }
  return { ...env, FUSEBASE_NO_DOTENV: "1", FUSEBASE_PROFILE: "unit-test-no-such-profile", ...extra };
}

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealth(port: number, host = "127.0.0.1"): Promise<void> {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`http://${host}:${port}/health`)).ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("SSE server did not start");
}

const children: ChildProcess[] = [];
afterEach(() => {
  for (const c of children.splice(0)) c.kill();
});

async function startSse(): Promise<number> {
  const port = await freePort();
  const child = spawn(process.execPath, [ENTRY, "--transport", "sse", "--port", String(port)], { env: hermeticEnv(), stdio: "ignore" });
  children.push(child);
  await waitForHealth(port);
  return port;
}

describe("SSE transport security (SEC-1)", () => {
  // SEC-1: /sse opens a session with no credentials at all.
  it.fails("rejects an SSE connection without a bearer token", async () => {
    const port = await startSse();
    const ctrl = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/sse`, { signal: ctrl.signal });
    ctrl.abort();
    expect(res.status).toBe(401);
  });

  // SEC-1: the wildcard CORS header lets any web page drive the server.
  it.fails("does not send a wildcard Access-Control-Allow-Origin header", async () => {
    const port = await startSse();
    const res = await fetch(`http://127.0.0.1:${port}/health`, { headers: { Origin: "https://evil.example" } });
    expect(res.headers.get("access-control-allow-origin")).not.toBe("*");
  });

  // SEC-1: the server binds 0.0.0.0, so it is reachable from the LAN.
  const lanIp = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal)?.address;
  it.skipIf(!lanIp).fails("is not reachable on a non-loopback interface by default", async () => {
    const port = await startSse();
    const reachable = await fetch(`http://${lanIp}:${port}/health`, { signal: AbortSignal.timeout(2000) }).then(() => true, () => false);
    expect(reachable).toBe(false);
  });
});

describe("configuration errors (COR-10)", () => {
  // COR-10: getClient() calls process.exit(1) when host/org are missing, killing the server.
  it.fails("returns an error result instead of exiting when FUSEBASE_HOST is missing", async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [ENTRY], env: hermeticEnv(), stderr: "ignore" });
    const client = new Client({ name: "unit", version: "0" }, { capabilities: {} });
    await client.connect(transport);
    try {
      const res = await client.callTool({ name: "list_workspaces", arguments: {} });
      expect(res.isError).toBe(true);
      // The server must still be alive afterwards.
      expect((await client.listTools()).tools.length).toBeGreaterThan(0);
    } finally {
      await client.close().catch(() => {});
    }
  });
});
