import * as Y from "yjs";
import { loadEncryptedCookie } from "../src/crypto.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq > 0 && !process.env[t.slice(0, eq).trim()])
            process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
}

const HOST = process.env.FUSEBASE_HOST || "inkabeam.nimbusweb.me";
const WS_ID = process.env.FUSEBASE_WORKSPACE_ID || "45h7lom5ryjak34u";
const COOKIE = process.env.FUSEBASE_COOKIE || loadEncryptedCookie()?.cookie!;

async function dumpColumns(pageId: string) {
    const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, {
        headers: { cookie: COOKIE },
    });
    const buf = new Uint8Array(await res.arrayBuffer());
    let len = 0, shift = 0, idx = 1;
    let byte: number;
    do { byte = buf[idx++]; len |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
    const data = buf.slice(idx, idx + len);
    const doc = new Y.Doc();
    Y.applyUpdate(doc, data);

    const blocks = doc.getMap("blocks");
    for (const [key, val] of blocks.entries()) {
        if (val instanceof Y.Map) {
            const m = val as Y.Map<any>;
            const type = m.get("type");
            if (type === "column") {
                console.log(`\nColumn "${key}":`);
                for (const [k, v] of m.entries()) {
                    if (v instanceof Y.Map) {
                        const obj: Record<string, any> = {};
                        for (const [mk, mv] of v.entries()) obj[mk] = mv;
                        console.log(`  ${k}: Y.Map(${JSON.stringify(obj)})`);
                    } else {
                        console.log(`  ${k}: ${JSON.stringify(v)}`);
                    }
                }
            }
        }
    }
}

await dumpColumns("oYAn36ndBfNZlsf1");
