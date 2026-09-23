/**
 * Local HTTP CONNECT proxy relay.
 *
 * Exposes a local HTTP CONNECT proxy on 127.0.0.1 that forwards connections
 * through an upstream authenticated SOCKS5 proxy (PIA).
 *
 * Flow: Chromium / undici → HTTP CONNECT (localhost, per-process credentials) → SOCKS5 (PIA, with auth) → Internet
 *
 * The relay requires a random username/password generated at startup, so other local
 * processes cannot tunnel through the stored upstream proxy account.
 *
 * We implement the upstream SOCKS5 handshake manually (no `socks` package)
 * to ensure IPv4-only connections, which PIA requires: host names are resolved to
 * IPv4 locally, and if that fails the name itself is sent (ATYP 0x03) so the proxy
 * resolves it, rather than handing an IPv4-only proxy an IPv6 address.
 */

import * as crypto from "crypto";
import * as net from "net";
import * as dns from "dns";
import * as http from "http";
import type { ProxyConfig } from "./crypto.js";

export interface RelayHandle {
    port: number;
    /** Relay credentials; required on every CONNECT. */
    username: string;
    password: string;
    /** Proxy URL including credentials, e.g. for undici's ProxyAgent. Do not log it. */
    url: string;
    stop: () => void;
}

/** Constant-time check of a Proxy-Authorization header against the expected value. */
function isAuthorized(header: string | undefined, expected: string): boolean {
    if (!header) return false;
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** RFC 1929: the username and password length fields are one byte each (max 255 bytes). */
function checkSocksCredential(label: string, value: string): void {
    const bytes = Buffer.byteLength(value ?? "", "utf8");
    if (bytes > 255) {
        throw new Error(`SOCKS5 ${label} is ${bytes} bytes; RFC 1929 allows at most 255 bytes.`);
    }
}

/**
 * Parse a CONNECT request target ("host:port" or "[v6]:port"); a missing port means 443.
 * Returns null for anything else, including unbracketed IPv6 (ambiguous with the port).
 */
export function parseConnectTarget(target: string | undefined): { host: string; port: number } | null {
    if (!target) return null;
    const m = /^\[([^\]]+)\](?::(\d{1,5}))?$/.exec(target) ?? /^([^:[\]\s]+)(?::(\d{1,5}))?$/.exec(target);
    if (!m) return null;
    const host = m[1];
    if (target.startsWith("[") && !net.isIPv6(host)) return null;
    const port = m[2] === undefined ? 443 : Number(m[2]);
    if (port < 1 || port > 65535) return null;
    return { host, port };
}

/** The 16 network-order bytes of an IPv6 address (a zone suffix is dropped). */
function ipv6Bytes(address: string): Buffer {
    let addr = address.split("%")[0];
    const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr);
    if (v4) {
        const p = v4[1].split(".").map(Number);
        addr = addr.slice(0, -v4[1].length) + ((p[0] << 8) | p[1]).toString(16) + ":" + ((p[2] << 8) | p[3]).toString(16);
    }
    const [head, tail] = addr.split("::");
    const headGroups = head ? head.split(":") : [];
    const tailGroups = tail ? tail.split(":") : [];
    const groups = tail === undefined
        ? headGroups
        : [...headGroups, ...new Array<string>(8 - headGroups.length - tailGroups.length).fill("0"), ...tailGroups];
    if (groups.length !== 8) throw new Error(`Invalid IPv6 address: ${address}`);
    const buf = Buffer.alloc(16);
    groups.forEach((g, i) => buf.writeUInt16BE(parseInt(g, 16), i * 2));
    return buf;
}

/** SOCKS5 ATYP + DST.ADDR: an IPv4 or IPv6 literal, or a domain name for the proxy to resolve. */
export function encodeSocksAddress(host: string): Buffer {
    if (net.isIPv4(host)) return Buffer.from([0x01, ...host.split(".").map(Number)]);
    if (net.isIPv6(host)) return Buffer.concat([Buffer.from([0x04]), ipv6Bytes(host)]);
    const name = Buffer.from(host, "utf8");
    if (name.length === 0 || name.length > 255) {
        throw new Error(`Destination host name must be 1-255 bytes for SOCKS5 (got ${name.length}).`);
    }
    return Buffer.concat([Buffer.from([0x03, name.length]), name]);
}

/**
 * Start a local HTTP CONNECT proxy that forwards through PIA SOCKS5.
 */
export async function startProxyRelay(
    upstream: ProxyConfig,
): Promise<RelayHandle> {
    checkSocksCredential("username", upstream.username);
    checkSocksCredential("password", upstream.password);

    const url = new URL(upstream.server);
    const upstreamHost = url.hostname;
    const upstreamPort = parseInt(url.port, 10) || 1080;

    // Pre-resolve proxy to IPv4 (PIA doesn't support IPv6)
    const { address: upstreamIp } = await dns.promises.lookup(upstreamHost, { family: 4 });
    console.error(`[proxy-relay] Upstream: ${upstreamHost} → ${upstreamIp}:${upstreamPort}`);

    const activeSockets = new Set<net.Socket>();
    const username = "relay";
    const password = crypto.randomBytes(24).toString("base64url");
    const expectedAuth = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

    const server = http.createServer((_req, res) => {
        // Regular HTTP requests are not proxied
        res.writeHead(405, { "Content-Type": "text/plain" });
        res.end("This proxy only supports CONNECT tunneling.");
    });

    server.on("connect", async (req, rawSocket, head) => {
        const clientSocket = rawSocket as net.Socket;
        activeSockets.add(clientSocket);
        clientSocket.on("close", () => activeSockets.delete(clientSocket));
        // Node's HTTP server removes its own socket error handler before emitting 'connect';
        // without this an early client disconnect (ECONNRESET) would be an uncaught error.
        clientSocket.on("error", () => clientSocket.destroy());

        if (!isAuthorized(req.headers["proxy-authorization"], expectedAuth)) {
            clientSocket.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="fusebase-relay"\r\n\r\n');
            return;
        }

        const target = parseConnectTarget(req.url);
        if (!target) {
            clientSocket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
            return;
        }
        const { host: destHost, port: destPort } = target;

        try {
            // IP literals are sent as-is. Names are resolved to IPv4 locally (PIA is IPv4-only);
            // if there is no IPv4 address, the name is sent for the proxy to resolve (ATYP 0x03).
            let destAddr = destHost;
            if (!net.isIP(destHost)) {
                try {
                    destAddr = (await dns.promises.lookup(destHost, { family: 4 })).address;
                } catch {
                    console.error(`[proxy-relay]   no local IPv4 address for ${destHost}; letting the proxy resolve it`);
                }
            }

            console.error(`[proxy-relay] CONNECT ${destHost}:${destPort} → ${destAddr}`);

            // Connect to PIA SOCKS5 and tunnel
            const remoteSocket = await connectViaSocks5(
                upstreamIp, upstreamPort,
                upstream.username, upstream.password,
                destAddr, destPort,
            );

            if (clientSocket.destroyed) {
                // The client went away while the tunnel was being set up.
                remoteSocket.destroy();
                return;
            }

            console.error(`[proxy-relay]   ✅ Tunnel established`);

            // Tell client the tunnel is ready
            clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");

            // Forward any buffered data from the CONNECT request
            if (head.length > 0) {
                remoteSocket.write(head);
            }

            // Pipe bidirectionally
            clientSocket.pipe(remoteSocket);
            remoteSocket.pipe(clientSocket);

            clientSocket.on("error", () => remoteSocket.destroy());
            remoteSocket.on("error", () => clientSocket.destroy());
            clientSocket.on("close", () => remoteSocket.destroy());
            remoteSocket.on("close", () => clientSocket.destroy());

        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[proxy-relay]   ❌ Failed: ${destHost}:${destPort} — ${msg}`);
            if (!clientSocket.destroyed) {
                clientSocket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
                clientSocket.destroy();
            }
        }
    });

    return new Promise((resolve, reject) => {
        server.listen(0, "127.0.0.1", () => {
            const addr = server.address();
            if (!addr || typeof addr === "string") {
                reject(new Error("Failed to get relay address"));
                return;
            }
            const port = addr.port;
            console.error(`[proxy-relay] Listening on http://127.0.0.1:${port}`);

            resolve({
                port,
                username,
                password,
                url: `http://${username}:${encodeURIComponent(password)}@127.0.0.1:${port}`,
                stop: () => {
                    for (const sock of activeSockets) sock.destroy();
                    activeSockets.clear();
                    server.close();
                    console.error("[proxy-relay] Stopped");
                },
            });
        });

        server.on("error", reject);
    });
}

// ─── Manual SOCKS5 handshake (no `socks` package) ────

/**
 * Connect to a SOCKS5 proxy with username/password auth and establish
 * a tunnel to the destination. Returns the connected socket.
 */
async function connectViaSocks5(
    proxyHost: string, proxyPort: number,
    username: string, password: string,
    destHost: string, destPort: number,
): Promise<net.Socket> {
    let destAddr: Buffer;
    try {
        checkSocksCredential("username", username);
        checkSocksCredential("password", password);
        destAddr = encodeSocksAddress(destHost);
    } catch (err) {
        return Promise.reject(err);
    }
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.destroy();
            reject(new Error("SOCKS5 handshake timed out (15s)"));
        }, 15_000);

        // Connect to proxy over IPv4
        const socket = net.connect({
            host: proxyHost,
            port: proxyPort,
            family: 4,
        });

        socket.once("error", (err) => {
            clearTimeout(timeout);
            reject(err);
        });

        socket.once("connect", () => {
            // Step 1: Send greeting — offer username/password auth (method 0x02)
            socket.write(Buffer.from([0x05, 0x01, 0x02]));

            let state: "greeting" | "auth" | "connect" = "greeting";
            let buf = Buffer.alloc(0);

            socket.on("data", (chunk) => {
                buf = Buffer.concat([buf, chunk]);

                if (state === "greeting") {
                    if (buf.length < 2) return;
                    if (buf[0] !== 0x05 || buf[1] !== 0x02) {
                        clearTimeout(timeout);
                        socket.destroy();
                        reject(new Error(`SOCKS5 auth method rejected: ${buf[1]}`));
                        return;
                    }
                    buf = buf.subarray(2);
                    state = "auth";

                    // Step 2: Send username/password (RFC 1929)
                    const userBuf = Buffer.from(username, "utf8");
                    const passBuf = Buffer.from(password, "utf8");
                    const authMsg = Buffer.alloc(3 + userBuf.length + passBuf.length);
                    authMsg[0] = 0x01; // version
                    authMsg[1] = userBuf.length;
                    userBuf.copy(authMsg, 2);
                    authMsg[2 + userBuf.length] = passBuf.length;
                    passBuf.copy(authMsg, 3 + userBuf.length);
                    socket.write(authMsg);
                }

                if (state === "auth") {
                    if (buf.length < 2) return;
                    if (buf[1] !== 0x00) {
                        clearTimeout(timeout);
                        socket.destroy();
                        reject(new Error("SOCKS5 authentication failed — bad credentials"));
                        return;
                    }
                    buf = buf.subarray(2);
                    state = "connect";

                    // Step 3: Send CONNECT: VER, CMD=CONNECT, RSV, ATYP + DST.ADDR, DST.PORT
                    const connectMsg = Buffer.concat([
                        Buffer.from([0x05, 0x01, 0x00]),
                        destAddr,
                        Buffer.from([(destPort >> 8) & 0xff, destPort & 0xff]),
                    ]);
                    socket.write(connectMsg);
                }

                if (state === "connect") {
                    if (buf.length < 5) return; // VER + REP + RSV + ATYP + first address byte
                    if (buf[1] !== 0x00) {
                        clearTimeout(timeout);
                        socket.destroy();
                        reject(new Error(`SOCKS5 CONNECT failed: reply code ${buf[1]}`));
                        return;
                    }

                    // The reply's BND.ADDR length depends on its ATYP (IPv4 4, IPv6 16, name 1+len).
                    const atyp = buf[3];
                    const addrLen = atyp === 0x01 ? 4 : atyp === 0x04 ? 16 : atyp === 0x03 ? 1 + buf[4] : -1;
                    if (addrLen < 0) {
                        clearTimeout(timeout);
                        socket.destroy();
                        reject(new Error(`SOCKS5 CONNECT reply has unknown address type ${atyp}`));
                        return;
                    }
                    const headerLen = 4 + addrLen + 2;
                    if (buf.length < headerLen) return;

                    // Success! Remove SOCKS5 header data, push back any trailing bytes
                    const trailing = buf.subarray(headerLen);
                    clearTimeout(timeout);

                    // Remove all listeners before resolving (caller manages the socket), and
                    // pause so nothing is emitted to no one before the caller pipes the socket.
                    socket.removeAllListeners("data");
                    socket.removeAllListeners("error");
                    socket.pause();

                    if (trailing.length > 0) {
                        socket.unshift(trailing);
                    }

                    resolve(socket);
                }
            });
        });
    });
}
