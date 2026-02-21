/**
 * Check how the browser encodes bold text formatting in Y.Text deltas
 */
import * as Y from "yjs";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { loadEncryptedCookie } from "../src/crypto.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadEnv() {
    const envPath = path.resolve(__dirname, "..", ".env");
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
        const t = line.trim(); if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("="); if (eq < 0) continue;
        if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
}
loadEnv();

const HOST = process.env.FUSEBASE_HOST!;
const WS_ID = "45h7lom5ryjak34u";
const stored = loadEncryptedCookie();
const COOKIE = stored?.cookie || process.env.FUSEBASE_COOKIE!;

function readVarUint(data: Uint8Array, offset: number): [number, number] {
    let result = 0, shift = 0, byte: number;
    do { byte = data[offset++]; result |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
    return [result, offset];
}

async function main() {
    const res = await fetch(`https://${HOST}/dump/${WS_ID}/1s4J9xaqLjAehLJy`, { headers: { cookie: COOKIE } });
    const bin = new Uint8Array(await res.arrayBuffer());
    const [len, start] = readVarUint(bin, 1);
    const doc = new Y.Doc();
    Y.applyUpdate(doc, bin.slice(start, start + len));

    const blocks = doc.getMap("blocks");
    console.log("═══ BROWSER BLOCK DELTAS ═══\n");

    for (const [id, val] of blocks.entries()) {
        if (!(val instanceof Y.Map)) continue;
        const chars = val.get("characters");
        const type = val.get("type");

        if (chars instanceof Y.Text) {
            console.log(`Block "${id}" type="${type}":`);
            console.log(`  toString: "${chars.toString().replace(/\n/g, "\\n")}"`);
            console.log(`  toDelta:`, JSON.stringify(chars.toDelta()));
            console.log(`  length: ${chars.length}`);
            console.log();
        }
    }
}

main().catch(console.error);
