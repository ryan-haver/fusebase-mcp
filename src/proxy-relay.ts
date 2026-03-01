/**
 * Local HTTP CONNECT proxy relay.
 *
 * Exposes a local HTTP CONNECT proxy on 127.0.0.1 that forwards connections
 * through an upstream authenticated SOCKS5 proxy (PIA).
 *
 * Flow: Chromium → HTTP CONNECT (localhost, no auth) → SOCKS5 (PIA, with auth) → Internet
 *
 * We implement the upstream SOCKS5 handshake manually (no `socks` package)
 * to ensure IPv4-only connections, which PIA requires.
 */

import * as net from "net";
import * as dns from "dns";
import * as http from "http";
import type { ProxyConfig } from "./crypto.js";

export interface RelayHandle {
    port: number;
    stop: () => void;
}

/**
 * Start a local HTTP CONNECT proxy that forwards through PIA SOCKS5.
 */
export async function startProxyRelay(
    upstream: ProxyConfig,
): Promise<RelayHandle> {
    const url = new URL(upstream.server);
    const upstreamHost = url.hostname;
    const upstreamPort = parseInt(url.port, 10) || 1080;

    // Pre-resolve proxy to IPv4 (PIA doesn't support IPv6)
    const { address: upstreamIp } = await dns.promises.lookup(upstreamHost, { family: 4 });
    console.error(`[proxy-relay] Upstream: ${upstreamHost} → ${upstreamIp}:${upstreamPort}`);

    const activeSockets = new Set<net.Socket>();

    const server = http.createServer((_req, res) => {
        // Regular HTTP requests are not proxied
        res.writeHead(405, { "Content-Type": "text/plain" });
        res.end("This proxy only supports CONNECT tunneling.");
    });

    server.on("connect", async (req, rawSocket, head) => {
        const clientSocket = rawSocket as net.Socket;
        activeSockets.add(clientSocket);
        clientSocket.on("close", () => activeSockets.delete(clientSocket));

        const [destHost, destPortStr] = req.url!.split(":");
        const destPort = parseInt(destPortStr, 10) || 443;

        try {
            // Resolve destination to IPv4 (preferred) or any family
            let destIp: string;
            if (net.isIPv4(destHost)) {
                destIp = destHost;
            } else {
                try {
                    const resolved = await dns.promises.lookup(destHost, { family: 4 });
                    destIp = resolved.address;
                } catch {
                    // IPv4 failed — try any family
                    try {
                        const resolved = await dns.promises.lookup(destHost);
                        destIp = resolved.address;
                    } catch {
                        // DNS completely failed — non-critical for telemetry domains
                        console.error(`[proxy-relay]   ⚠ DNS failed: ${destHost} (skipped)`);
                        clientSocket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
                        clientSocket.destroy();
                        return;
                    }
                }
            }

            console.error(`[proxy-relay] CONNECT ${destHost}:${destPort} → ${destIp}`);

            // Connect to PIA SOCKS5 and tunnel
            const remoteSocket = await connectViaSocks5(
                upstreamIp, upstreamPort,
                upstream.username, upstream.password,
                destIp, destPort,
            );

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
            clientSocket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
            clientSocket.destroy();
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

// ─── Manual SOCKS5 handshake (IPv4-only, no `socks` package) ────

/**
 * Connect to a SOCKS5 proxy with username/password auth and establish
 * a tunnel to the destination. Returns the connected socket.
 */
async function connectViaSocks5(
    proxyHost: string, proxyPort: number,
    username: string, password: string,
    destIp: string, destPort: number,
): Promise<net.Socket> {
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

                    // Step 3: Send CONNECT request with IPv4 address
                    const ipParts = destIp.split(".").map(Number);
                    const connectMsg = Buffer.from([
                        0x05, 0x01, 0x00, 0x01,       // VER, CMD=CONNECT, RSV, ATYP=IPv4
                        ipParts[0], ipParts[1], ipParts[2], ipParts[3],  // DST.ADDR
                        (destPort >> 8) & 0xff, destPort & 0xff,         // DST.PORT
                    ]);
                    socket.write(connectMsg);
                }

                if (state === "connect") {
                    if (buf.length < 10) return; // VER + REP + RSV + ATYP + 4-byte addr + 2-byte port
                    if (buf[1] !== 0x00) {
                        clearTimeout(timeout);
                        socket.destroy();
                        reject(new Error(`SOCKS5 CONNECT failed: reply code ${buf[1]}`));
                        return;
                    }

                    // Success! Remove SOCKS5 header data, push back any trailing bytes
                    const headerLen = 10; // IPv4 response always 10 bytes
                    const trailing = buf.subarray(headerLen);
                    clearTimeout(timeout);

                    // Remove all listeners before resolving (caller manages the socket)
                    socket.removeAllListeners("data");
                    socket.removeAllListeners("error");

                    if (trailing.length > 0) {
                        socket.unshift(trailing);
                    }

                    resolve(socket);
                }
            });
        });
    });
}
