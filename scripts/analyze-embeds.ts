import * as Y from "yjs";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadEnv() {
    const envPath = path.resolve(__dirname, "..", ".env");
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq < 0) continue;
        if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
}
loadEnv();

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const WS_ID = process.env.FUSEBASE_WORKSPACE_ID || "45h7lom5ryjak34u";
const COOKIE = process.env.FUSEBASE_COOKIE!;

async function main() {
    const pageId = process.argv[2] || "NSREZPxM66UEa7KC";

    const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, {
        headers: { cookie: COOKIE },
    });
    const buf = new Uint8Array(await res.arrayBuffer());

    let len = 0, shift = 0, idx = 1;
    let byte: number;
    do {
        byte = buf[idx++];
        len |= (byte & 0x7f) << shift;
        shift += 7;
    } while (byte & 0x80);

    const data = buf.slice(idx, idx + len);
    const doc = new Y.Doc();
    Y.applyUpdate(doc, data);

    const blocks = doc.getMap("blocks");
    let found = false;
    for (const [key, val] of (blocks as Y.Map<any>).entries()) {
        if (val instanceof Y.Map) {
            const chars = val.get("characters");
            if (chars instanceof Y.Text) {
                const delta = chars.toDelta();
                for (const op of delta) {
                    if (typeof op.insert === "object" && op.insert !== null) {
                        found = true;
                        console.log(`\nInline Embed found in block "${key}":`);
                        console.log(JSON.stringify(op, null, 2));
                    }
                }
            }
        }
    }
    if (!found) {
        console.log("No inline object embeds found in any Y.Text blocks.");
    }
}
main().catch(console.error);
