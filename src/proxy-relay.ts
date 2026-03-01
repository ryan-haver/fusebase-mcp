/**
 * Local SOCKS5 proxy relay.
 *
 * Starts a local unauthenticated SOCKS5 proxy that forwards connections
 * through an upstream authenticated SOCKS5 proxy (e.g., PIA).
 *
 * Chromium can't authenticate to SOCKS5 proxies, so this relay bridges the
 * gap: Chromium connects to localhost (no auth) → relay authenticates to PIA.
 */

import * as net from "net";
import * as dns from "dns";
import { SocksClient, type SocksClientOptions } from "socks";
import type { ProxyConfig } from "./crypto.js";

export interface RelayHandle {
    port: number;
    stop: () => void;
}

/**
 * Start a local SOCKS5 relay that forwards to an authenticated upstream proxy.
 *
 * @param upstream - ProxyConfig with server URL, username, and password
 * @returns A handle with the local port and a stop() function
 */
export async function startProxyRelay(
    upstream: ProxyConfig,
): Promise<RelayHandle> {
    // Parse upstream URL: "socks5://host:port"
    const url = new URL(upstream.server);
    const upstreamHost = url.hostname;
    const upstreamPort = parseInt(url.port, 10) || 1080;

    const activeSockets = new Set<net.Socket>();
    const CONNECTION_TIMEOUT_MS = 120_000;

    const server = net.createServer((clientSocket) => {
        activeSockets.add(clientSocket);
        clientSocket.on("close", () => activeSockets.delete(clientSocket));
        clientSocket.setTimeout(CONNECTION_TIMEOUT_MS, () => clientSocket.destroy());

        handleSocks5Client(clientSocket, {
            host: upstreamHost,
            port: upstreamPort,
            username: upstream.username,
            password: upstream.password,
        }).catch(() => {
            clientSocket.destroy();
        });
    });

    return new Promise((resolve, reject) => {
        server.listen(0, "127.0.0.1", () => {
            const addr = server.address();
            if (!addr || typeof addr === "string") {
                reject(new Error("Failed to get relay address"));
                return;
            }
            const port = addr.port;
            console.error(`[proxy-relay] Listening on 127.0.0.1:${port} → ${upstreamHost}:${upstreamPort}`);

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

// ─── SOCKS5 Protocol Implementation ─────────────────────────────

/**
 * Handle one incoming SOCKS5 client connection:
 * 1. Perform local SOCKS5 greeting (no auth required)
 * 2. Read CONNECT request
 * 3. Forward via SocksClient to authenticated upstream
 * 4. Pipe data bidirectionally
 */
async function handleSocks5Client(
    client: net.Socket,
    upstream: { host: string; port: number; username: string; password: string },
): Promise<void> {
    // Step 1: Client greeting — read version + methods
    const greeting = await readBytes(client, 2);
    if (greeting[0] !== 0x05) throw new Error("Not SOCKS5");

    const nMethods = greeting[1];
    await readBytes(client, nMethods); // consume method list

    // Reply: no auth required (method 0x00)
    client.write(Buffer.from([0x05, 0x00]));

    // Step 2: Read CONNECT request
    const header = await readBytes(client, 4);
    if (header[0] !== 0x05 || header[1] !== 0x01) {
        // Only CONNECT (0x01) is supported
        client.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        throw new Error("Unsupported SOCKS5 command");
    }

    const addrType = header[3];
    let destHost: string;
    let destPort: number;

    if (addrType === 0x01) {
        // IPv4
        const addr = await readBytes(client, 4);
        destHost = addr.join(".");
    } else if (addrType === 0x03) {
        // Domain name
        const lenBuf = await readBytes(client, 1);
        const domainBuf = await readBytes(client, lenBuf[0]);
        destHost = domainBuf.toString("utf8");
    } else if (addrType === 0x04) {
        // IPv6
        const addr = await readBytes(client, 16);
        destHost = formatIPv6(addr);
    } else {
        client.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        throw new Error("Unsupported address type");
    }

    const portBuf = await readBytes(client, 2);
    destPort = (portBuf[0] << 8) | portBuf[1];

    console.error(`[proxy-relay] CONNECT → ${destHost}:${destPort}`);

    // PIA SOCKS5 proxy doesn't resolve DNS — resolve locally first
    let resolvedHost = destHost;
    if (addrType === 0x03) {
        try {
            const { address } = await dns.promises.lookup(destHost, { family: 4 });
            resolvedHost = address;
            console.error(`[proxy-relay]   DNS: ${destHost} → ${resolvedHost}`);
        } catch (err) {
            console.error(`[proxy-relay]   DNS FAILED: ${destHost} — ${err instanceof Error ? err.message : err}`);
            // DNS failed — send error reply to client
            client.write(Buffer.from([0x05, 0x04, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
            throw new Error(`DNS resolution failed for ${destHost}`);
        }
    }

    // Step 3: Connect through upstream authenticated SOCKS5
    console.error(`[proxy-relay]   Connecting via upstream → ${resolvedHost}:${destPort}`);
    const socksOptions: SocksClientOptions = {
        proxy: {
            host: upstream.host,
            port: upstream.port,
            type: 5,
            userId: upstream.username,
            password: upstream.password,
        },
        command: "connect",
        destination: {
            host: resolvedHost,
            port: destPort,
        },
        timeout: 30_000,
    };

    try {
        const { socket: remoteSocket } = await SocksClient.createConnection(socksOptions);
        console.error(`[proxy-relay]   ✅ Connected to ${destHost}:${destPort}`);

        // Step 4: Reply success to client
        // BND.ADDR = 0.0.0.0, BND.PORT = 0
        client.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));

        // Step 5: Pipe bidirectionally
        client.pipe(remoteSocket);
        remoteSocket.pipe(client);

        client.on("error", () => remoteSocket.destroy());
        remoteSocket.on("error", () => client.destroy());
        client.on("close", () => remoteSocket.destroy());
        remoteSocket.on("close", () => client.destroy());
    } catch (err) {
        console.error(`[proxy-relay]   ❌ Upstream failed for ${destHost}:${destPort} — ${err instanceof Error ? err.message : err}`);
        client.write(Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        throw err;
    }
}

// ─── Helpers ─────────────────────────────────────────────────────

function readBytes(socket: net.Socket, count: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let received = 0;

        const onData = (data: Buffer) => {
            chunks.push(data);
            received += data.length;
            if (received >= count) {
                socket.removeListener("data", onData);
                socket.removeListener("error", onError);
                socket.removeListener("close", onClose);
                const full = Buffer.concat(chunks);
                // Push back any excess bytes
                if (full.length > count) {
                    socket.unshift(full.subarray(count));
                }
                resolve(full.subarray(0, count));
            }
        };

        const onError = (err: Error) => {
            socket.removeListener("data", onData);
            socket.removeListener("close", onClose);
            reject(err);
        };

        const onClose = () => {
            socket.removeListener("data", onData);
            socket.removeListener("error", onError);
            reject(new Error("Socket closed before receiving enough data"));
        };

        socket.on("data", onData);
        socket.on("error", onError);
        socket.on("close", onClose);
    });
}

function formatIPv6(bytes: Buffer): string {
    const groups: string[] = [];
    for (let i = 0; i < 16; i += 2) {
        groups.push(((bytes[i] << 8) | bytes[i + 1]).toString(16));
    }
    return groups.join(":");
}
