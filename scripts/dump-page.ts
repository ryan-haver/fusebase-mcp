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
const WS_ID = "45h7lom5ryjak34u";
const COOKIE = process.env.FUSEBASE_COOKIE!;

function inspectYType(val: unknown, indent: string = ""): void {
    if (val instanceof Y.Map) {
        const keys = Array.from(val.keys()).sort();
        console.log(`${indent}Y.Map (${keys.length} entries):`);
        for (const k of keys) {
            const v = val.get(k);
            if (v instanceof Y.Map || v instanceof Y.Array || v instanceof Y.Text || v instanceof Y.XmlElement || v instanceof Y.XmlFragment || v instanceof Y.XmlText) {
                console.log(`${indent}  "${k}" →`);
                inspectYType(v, indent + "    ");
            } else {
                console.log(`${indent}  "${k}" → (${typeof v}) ${JSON.stringify(v)}`);
            }
        }
    } else if (val instanceof Y.Array) {
        const items = val.toJSON();
        if (items.length <= 5) {
            console.log(`${indent}Y.Array[${items.length}]: ${JSON.stringify(items)}`);
        } else {
            console.log(`${indent}Y.Array[${items.length}]: ${JSON.stringify(items.slice(0, 3))}...`);
        }
        for (let i = 0; i < Math.min(val.length, 5); i++) {
            const item = val.get(i);
            if (item instanceof Y.Map || item instanceof Y.Array) {
                console.log(`${indent}  [${i}] →`);
                inspectYType(item, indent + "    ");
            }
        }
    } else if (val instanceof Y.Text) {
        console.log(`${indent}Y.Text: "${val.toString().slice(0, 100)}"`);
    } else {
        console.log(`${indent}${typeof val}: ${JSON.stringify(val)}`);
    }
}

async function main() {
    const pageId = process.argv[2] || "1tZiv20EWydrHyaB";
    console.log(`=== Deep inspection of page ${pageId} ===\n`);

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

    console.log("\n--- All shared types in Y.Doc ---");
    console.log("doc.share keys:", Array.from((doc as any).share.keys()));

    for (const [name, type] of (doc as any).share.entries()) {
        console.log(`\nShared type "${name}" (${type.constructor.name}):`);
        inspectYType(type, "  ");
    }
}

main().catch(console.error);
