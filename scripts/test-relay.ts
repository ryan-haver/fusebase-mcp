/**
 * Test the HTTP CONNECT relay by tunneling through it.
 * Run: npx tsx scripts/test-relay.ts
 */

import { startProxyRelay } from "../src/proxy-relay.js";
import { loadCredentialStore } from "../src/crypto.js";
import * as http from "http";
import * as tls from "tls";
import * as net from "net";

async function main() {
    const store = loadCredentialStore();
    if (!store?.proxy) {
        console.error("No proxy config in credential store");
        process.exit(1);
    }

    console.log("Starting relay...");
    const relay = await startProxyRelay(store.proxy);
    console.log(`Relay on port ${relay.port}`);

    try {
        console.log("\nTest: HTTP CONNECT through relay to icanhazip.com:443...");

        // Send HTTP CONNECT to our local relay
        const tunnelSocket = await new Promise<net.Socket>((resolve, reject) => {
            const req = http.request({
                host: "127.0.0.1",
                port: relay.port,
                method: "CONNECT",
                path: "icanhazip.com:443",
            });

            req.on("connect", (_res, socket) => {
                resolve(socket);
            });

            req.on("error", reject);
            req.end();

            setTimeout(() => reject(new Error("CONNECT timed out")), 20_000);
        });

        console.log("✅ CONNECT tunnel established!");

        // Wrap in TLS
        const tlsSocket = tls.connect({
            socket: tunnelSocket,
            servername: "icanhazip.com",
        });

        const body = await new Promise<string>((resolve, reject) => {
            tlsSocket.on("secureConnect", () => {
                console.log("✅ TLS handshake complete!");
                tlsSocket.write(
                    "GET / HTTP/1.1\r\nHost: icanhazip.com\r\nConnection: close\r\n\r\n"
                );
            });

            let data = "";
            tlsSocket.on("data", (chunk) => { data += chunk.toString(); });
            tlsSocket.on("end", () => resolve(data.split("\r\n\r\n").pop()?.trim() || ""));
            tlsSocket.on("error", reject);
            setTimeout(() => reject(new Error("HTTP timeout")), 15_000);
        });

        console.log(`✅ Got IP: ${body}`);
        console.log(`   (Should be a PIA Netherlands IP, not your local IP)`);
    } catch (err) {
        console.error(`❌ Failed:`, err instanceof Error ? err.message : err);
    } finally {
        relay.stop();
    }
}

main();
