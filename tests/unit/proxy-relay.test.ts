/**
 * COR-15: the local HTTP CONNECT relay's SOCKS5 handshake, checked byte-for-byte against a
 * tiny fake SOCKS5 server on 127.0.0.1.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as dns from "dns";
import * as net from "net";
import type * as httpTypes from "http";

/** Every http.Server the relay creates, so a test can observe raw CONNECT sockets. */
const httpServers: httpTypes.Server[] = [];
vi.mock("http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("http")>();
  const createServer = ((...args: any[]) => {
    const server = (actual.createServer as any)(...args);
    httpServers.push(server);
    return server;
  }) as typeof actual.createServer;
  return { ...actual, createServer, default: { ...actual, createServer } };
});

import { startProxyRelay, type RelayHandle } from "../../src/proxy-relay.js";

interface FakeSocks {
  port: number;
  /** Raw bytes received on each upstream connection, in order. */
  connections: Buffer[][];
  close: () => Promise<void>;
}

/**
 * A minimal SOCKS5 server: accepts username/password auth, records the greeting, auth and
 * CONNECT messages, replies with success, then sends `afterConnect` down the tunnel.
 */
async function startFakeSocks(opts: { replyAtyp?: 1 | 4; afterConnect?: string } = {}): Promise<FakeSocks> {
  const connections: Buffer[][] = [];
  const sockets = new Set<net.Socket>();
  const server = net.createServer((sock) => {
    sockets.add(sock);
    sock.on("close", () => sockets.delete(sock));
    sock.on("error", () => {});
    const msgs: Buffer[] = [];
    connections.push(msgs);
    let buf = Buffer.alloc(0);
    let stage: "greeting" | "auth" | "connect" | "tunnel" = "greeting";
    sock.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (stage === "greeting") {
          if (buf.length < 2 || buf.length < 2 + buf[1]) return;
          const n = 2 + buf[1];
          msgs.push(buf.subarray(0, n));
          buf = buf.subarray(n);
          sock.write(Buffer.from([0x05, 0x02]));
          stage = "auth";
        } else if (stage === "auth") {
          if (buf.length < 2) return;
          const ulen = buf[1];
          if (buf.length < 3 + ulen) return;
          const plen = buf[2 + ulen];
          const n = 3 + ulen + plen;
          if (buf.length < n) return;
          msgs.push(buf.subarray(0, n));
          buf = buf.subarray(n);
          sock.write(Buffer.from([0x01, 0x00]));
          stage = "connect";
        } else if (stage === "connect") {
          if (buf.length < 5) return;
          const atyp = buf[3];
          const addrLen = atyp === 0x01 ? 4 : atyp === 0x04 ? 16 : 1 + buf[4];
          const n = 4 + addrLen + 2;
          if (buf.length < n) return;
          msgs.push(buf.subarray(0, n));
          buf = buf.subarray(n);
          const bnd = opts.replyAtyp === 4
            ? Buffer.from([0x05, 0x00, 0x00, 0x04, ...new Array(16).fill(0), 0x1f, 0x90])
            : Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0x1f, 0x90]);
          sock.write(opts.afterConnect ? Buffer.concat([bnd, Buffer.from(opts.afterConnect)]) : bnd);
          stage = "tunnel";
        } else {
          return;
        }
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  return {
    port,
    connections,
    close: () => new Promise<void>((resolve) => {
      for (const s of sockets) s.destroy();
      server.close(() => resolve());
    }),
  };
}

function authHeader(relay: RelayHandle): string {
  const u = new URL(relay.url);
  return `Basic ${Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString("base64")}`;
}

/** Send CONNECT through the relay; resolve with the status line and anything tunnelled after it. */
function connectThrough(relay: RelayHandle, target: string): Promise<{ status: string; body: string }> {
  return new Promise((resolve, reject) => {
    const sock = net.connect(relay.port, "127.0.0.1", () => {
      sock.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\nProxy-Authorization: ${authHeader(relay)}\r\n\r\n`);
    });
    let buf = "";
    const done = () => {
      const [head, ...rest] = buf.split("\r\n\r\n");
      resolve({ status: head.split("\r\n")[0], body: rest.join("\r\n\r\n") });
      sock.destroy();
    };
    sock.on("data", (d) => {
      buf += d.toString("latin1");
      if (buf.includes("\r\n\r\n") && !buf.startsWith("HTTP/1.1 200")) done();
    });
    sock.on("close", () => done());
    sock.on("error", reject);
    setTimeout(done, 1500);
  });
}

/** Bytes of the SOCKS CONNECT request the relay sent on its first upstream connection. */
function connectRequest(socks: FakeSocks): number[] {
  return [...socks.connections[0][2]];
}

describe("proxy relay SOCKS5 handshake (COR-15)", () => {
  let relay: RelayHandle | undefined;
  let socks: FakeSocks | undefined;
  const realLookup = dns.promises.lookup;

  beforeEach(() => {
    httpServers.length = 0;
  });
  afterEach(async () => {
    relay?.stop();
    relay = undefined;
    await socks?.close();
    socks = undefined;
    vi.restoreAllMocks();
  });

  /** Stub DNS: IP literals resolve to themselves, names come from `table` (missing → ENOTFOUND). */
  function stubDns(table: Record<string, { 4?: string; any?: { address: string; family: number } }>) {
    vi.spyOn(dns.promises, "lookup").mockImplementation((async (host: string, opts?: any) => {
      if (net.isIP(host)) return realLookup(host, opts);
      const entry = table[host];
      const hit = opts?.family === 4 ? (entry?.[4] ? { address: entry[4], family: 4 } : undefined) : entry?.any ?? (entry?.[4] ? { address: entry[4], family: 4 } : undefined);
      if (!hit) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: "ENOTFOUND" });
      return hit;
    }) as any);
  }

  async function start(opts: Parameters<typeof startFakeSocks>[0] = {}, creds = { username: "user", password: "pass" }) {
    socks = await startFakeSocks(opts);
    relay = await startProxyRelay({ server: `socks5://127.0.0.1:${socks.port}`, ...creds });
    return relay;
  }

  it("sends the greeting, RFC 1929 auth and an IPv4 CONNECT", async () => {
    await start();
    const res = await connectThrough(relay!, "127.0.0.1:9");
    expect(res.status).toBe("HTTP/1.1 200 Connection Established");
    const [greeting, auth] = socks!.connections[0];
    expect([...greeting]).toEqual([0x05, 0x01, 0x02]);
    expect([...auth]).toEqual([0x01, 4, ...Buffer.from("user"), 4, ...Buffer.from("pass")]);
    expect(connectRequest(socks!)).toEqual([0x05, 0x01, 0x00, 0x01, 127, 0, 0, 1, 0x00, 0x09]);
  });

  it("resolves a host name to IPv4 locally when it can", async () => {
    stubDns({ "example.test": { 4: "93.184.216.34" } });
    await start();
    expect((await connectThrough(relay!, "example.test:443")).status).toMatch(/ 200 /);
    expect(connectRequest(socks!)).toEqual([0x05, 0x01, 0x00, 0x01, 93, 184, 216, 34, 0x01, 0xbb]);
  });

  it("falls back to a domain-name CONNECT (not NaN IPv4 bytes) when there is no local IPv4 address", async () => {
    stubDns({ "v6only.test": { any: { address: "2001:db8::1", family: 6 } } });
    await start();
    expect((await connectThrough(relay!, "v6only.test:443")).status).toMatch(/ 200 /);
    const name = Buffer.from("v6only.test");
    expect(connectRequest(socks!)).toEqual([0x05, 0x01, 0x00, 0x03, name.length, ...name, 0x01, 0xbb]);
  });

  it("parses a bracketed IPv6 literal and sends ATYP 0x04 with 16 address bytes", async () => {
    await start({ replyAtyp: 4 });
    expect((await connectThrough(relay!, "[2001:db8::1]:443")).status).toMatch(/ 200 /);
    expect(connectRequest(socks!)).toEqual([
      0x05, 0x01, 0x00, 0x04,
      0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x00, 0x01,
      0x01, 0xbb,
    ]);
  });

  it("strips a 22-byte IPv6 bound-address reply so no header bytes leak into the tunnel", async () => {
    await start({ replyAtyp: 4, afterConnect: "hello" });
    const res = await connectThrough(relay!, "127.0.0.1:9");
    expect(res.status).toMatch(/ 200 /);
    expect(res.body).toBe("hello");
  });

  it("answers 400 to a malformed CONNECT target without contacting the proxy", async () => {
    await start();
    expect((await connectThrough(relay!, "2001:db8::1:443")).status).toMatch(/^HTTP\/1\.1 400/);
    expect(socks!.connections).toHaveLength(0);
  });

  it.each([
    ["username", { username: "é".repeat(128), password: "p" }],
    ["password", { username: "u", password: "x".repeat(256) }],
  ])("rejects a SOCKS %s longer than 255 UTF-8 bytes", async (field, creds) => {
    socks = await startFakeSocks();
    await expect(startProxyRelay({ server: `socks5://127.0.0.1:${socks.port}`, ...creds })).rejects.toThrow(new RegExp(`${field}.*255 bytes`));
  });

  it("accepts credentials of exactly 255 bytes", async () => {
    await start({}, { username: "u".repeat(255), password: "p".repeat(255) });
    expect((await connectThrough(relay!, "127.0.0.1:9")).status).toMatch(/ 200 /);
    const auth = socks!.connections[0][1];
    expect(auth[1]).toBe(255);
    expect(auth[2 + 255]).toBe(255);
  });

  it("has an 'error' listener on the client socket before the tunnel is set up", async () => {
    await start();
    const checks: Array<{ listeners: number; threw: unknown }> = [];
    httpServers[0].on("connect", (_req, sock: net.Socket) => {
      // Runs right after the relay's own handler has reached its first await.
      const listeners = sock.listenerCount("error");
      let threw: unknown;
      try {
        sock.emit("error", Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }));
      } catch (err) {
        threw = err;
      }
      checks.push({ listeners, threw });
    });
    await connectThrough(relay!, "127.0.0.1:9");
    expect(checks).toHaveLength(1);
    expect(checks[0].threw).toBeUndefined();
    expect(checks[0].listeners).toBeGreaterThan(0);
  });
});
