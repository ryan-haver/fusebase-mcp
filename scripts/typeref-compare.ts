/**
 * Compare the exact Y.js binary type refs between browser and our Y.Text-based writer.
 * Focus on the typeRef byte in the characters field.
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
    // Browser page (working)
    const bRes = await fetch(`https://${HOST}/dump/${WS_ID}/1s4J9xaqLjAehLJy`, { headers: { cookie: COOKIE } });
    const bBin = new Uint8Array(await bRes.arrayBuffer());
    const [bLen, bStart] = readVarUint(bBin, 1);
    const browserUpdate = bBin.slice(bStart, bStart + bLen);

    // Our Y.Text page (broken - version error)
    const wRes = await fetch(`https://${HOST}/dump/${WS_ID}/IWyfP86CXtkCxQft`, { headers: { cookie: COOKIE } });
    const wBin = new Uint8Array(await wRes.arrayBuffer());
    const [wLen, wStart] = readVarUint(wBin, 1);
    const writerUpdate = wBin.slice(wStart, wStart + wLen);

    // Search for "characters" in the binary as ASCII bytes
    const charsBytes = Buffer.from("characters");

    function findTypeRefAfterCharacters(data: Uint8Array, label: string) {
        console.log(`\n═══ ${label} (${data.length} bytes) ═══\n`);

        // Find all occurrences of "characters" in the binary
        for (let i = 0; i < data.length - charsBytes.length; i++) {
            let match = true;
            for (let j = 0; j < charsBytes.length; j++) {
                if (data[i + j] !== charsBytes[j]) { match = false; break; }
            }
            if (!match) continue;

            // Found "characters" at offset i
            // Show context: 10 bytes before and 20 bytes after
            const before = Math.max(0, i - 10);
            const after = Math.min(data.length, i + charsBytes.length + 30);
            const context = Array.from(data.slice(before, after));
            console.log(`  Found at offset ${i}`);
            console.log(`    Context hex: ${Buffer.from(data.slice(before, after)).toString("hex")}`);
            console.log(`    Context dec: [${context.join(",")}]`);

            // The byte AFTER "characters" string: length prefix, then the content.
            // In Y.js V1 encoding for ContentType, the typeRef byte comes after
            // the parent info. Let me show the surrounding op context.
            const endOfStr = i + charsBytes.length;
            console.log(`    Bytes after "characters": [${Array.from(data.slice(endOfStr, endOfStr + 15)).join(",")}]`);
            console.log(`    Hex after: ${Buffer.from(data.slice(endOfStr, endOfStr + 15)).toString("hex")}`);
        }
    }

    findTypeRefAfterCharacters(browserUpdate, "BROWSER (working)");
    findTypeRefAfterCharacters(writerUpdate, "WRITER Y.Text (broken)");

    // Also create a minimal doc with both Y.Array and Y.Text for characters
    // to see the exact binary difference
    console.log("\n═══ MINIMAL DOC COMPARISON ═══\n");

    // Y.Array version
    const doc1 = new Y.Doc();
    doc1.transact(() => {
        const blocks = doc1.getMap("blocks");
        const bm = new Y.Map();
        bm.set("type", "paragraph");
        const chars = new Y.Array();
        for (const ch of "Hi\n") chars.push([ch]);
        bm.set("characters", chars);
        blocks.set("b1", bm);
    });
    const u1 = Y.encodeStateAsUpdate(doc1);

    // Y.Text version  
    const doc2 = new Y.Doc();
    doc2.transact(() => {
        const blocks = doc2.getMap("blocks");
        const bm = new Y.Map();
        bm.set("type", "paragraph");
        const chars = new Y.Text();
        chars.insert(0, "Hi\n");
        bm.set("characters", chars);
        blocks.set("b1", bm);
    });
    const u2 = Y.encodeStateAsUpdate(doc2);

    console.log("Y.Array version:");
    findTypeRefAfterCharacters(u1, "Y.Array minimal");

    console.log("\nY.Text version:");
    findTypeRefAfterCharacters(u2, "Y.Text minimal");

    // Show full hex to compare
    console.log(`\nY.Array full hex (${u1.length}b): ${Buffer.from(u1).toString("hex")}`);
    console.log(`Y.Text  full hex (${u2.length}b): ${Buffer.from(u2).toString("hex")}`);
}

main().catch(console.error);
