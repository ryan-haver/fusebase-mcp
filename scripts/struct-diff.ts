/**
 * Structural diff: Compare the Y.Doc from a WORKING page (browser/transplant)
 * vs our BROKEN writer page to find the EXACT field-level difference.
 * 
 * Run: npx tsx scripts/struct-diff.ts
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
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq < 0) continue;
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

async function loadPageDoc(pageId: string): Promise<Y.Doc> {
    const res = await fetch(`https://${HOST}/dump/${WS_ID}/${pageId}`, { headers: { cookie: COOKIE } });
    const bin = new Uint8Array(await res.arrayBuffer());
    const [len, start] = readVarUint(bin, 1);
    const update = bin.slice(start, start + len);
    const doc = new Y.Doc();
    Y.applyUpdate(doc, update);
    return doc;
}

function dumpBlockDetails(doc: Y.Doc, label: string) {
    console.log(`\n═══ ${label} ═══`);

    // All shared types
    console.log("\nShared types:");
    doc.share.forEach((type, name) => {
        const tn = type.constructor.name;
        if (type instanceof Y.Map) console.log(`  "${name}" (YMap) size=${type.size}`);
        else if (type instanceof Y.Array) console.log(`  "${name}" (YArray) length=${type.length}`);
        else if (type instanceof Y.Text) console.log(`  "${name}" (YText) length=${type.length}`);
        else console.log(`  "${name}" (${tn})`);
    });

    // root map
    const root = doc.getMap("root");
    if (root.size > 0) {
        console.log("\nroot map:");
        for (const [k, v] of root.entries()) {
            if (v instanceof Y.Array) console.log(`  "${k}": YArray(${v.length}) = ${JSON.stringify(v.toJSON()).slice(0, 100)}`);
            else if (v instanceof Y.Map) console.log(`  "${k}": YMap(${v.size})`);
            else console.log(`  "${k}": ${JSON.stringify(v)}`);
        }
    }

    // rootChildren
    const rch = doc.getArray("rootChildren");
    console.log(`\nrootChildren (${rch.length}): ${JSON.stringify(rch.toJSON())}`);

    // top-level children (if exists)
    const ch = doc.getArray("children");
    if (ch.length > 0) {
        console.log(`children (${ch.length}): ${JSON.stringify(ch.toJSON())}`);
    }

    // blocks
    const blocks = doc.getMap("blocks");
    console.log(`\nblocks (${blocks.size}):`);

    for (const [blockId, blockVal] of blocks.entries()) {
        if (!(blockVal instanceof Y.Map)) { console.log(`  "${blockId}": NOT a YMap!`); continue; }
        const bm = blockVal;
        console.log(`\n  Block "${blockId}":`);

        // Sort keys for comparison
        const keys = Array.from(bm.keys()).sort();
        console.log(`    Keys (${keys.length}): [${keys.join(", ")}]`);

        for (const key of keys) {
            const val = bm.get(key);
            if (val instanceof Y.Array) {
                const arr = val.toJSON();
                // Show raw array elements including format objects and newlines
                const elements: string[] = [];
                for (const item of arr) {
                    if (typeof item === "string") {
                        if (item === "\n") elements.push("\\n");
                        else elements.push(item);
                    } else if (typeof item === "object" && item !== null) {
                        elements.push(JSON.stringify(item));
                    } else {
                        elements.push(String(item));
                    }
                }
                const textOnly = arr.filter((c: any) => typeof c === "string").join("").replace(/\n/g, "\\n");
                console.log(`    ${key}: YArray(${arr.length}) text="${textOnly}" raw=[${elements.slice(0, 30).join(",")}]`);
            } else if (val instanceof Y.Map) {
                console.log(`    ${key}: YMap(${val.size})`);
            } else {
                console.log(`    ${key}: ${JSON.stringify(val)} (${typeof val})`);
            }
        }
    }

    // Check the internal Y.Doc structure info
    console.log("\n  Y.Doc clientID:", doc.clientID);
    console.log("  Total shared types:", doc.share.size);
}

async function main() {
    // Working pages:
    const BROWSER_PAGE = "1s4J9xaqLjAehLJy";     // Original browser-created page (known renders)
    const TRANSPLANT_PAGE = "1MSGc1yZK6rTrEsc";   // Transplanted page (confirmed renders)

    // Broken pages:
    const WRITER_V1 = "WJGLWrQmCycTdmY6";        // Our first fix attempt (skeleton)
    const WRITER_V2 = "d1KbzI1l8kEEOYqB";        // Our second fix attempt with \n (skeleton)

    console.log("Loading page dumps...\n");

    const [browserDoc, writerDoc] = await Promise.all([
        loadPageDoc(BROWSER_PAGE),
        loadPageDoc(WRITER_V2),
    ]);

    dumpBlockDetails(browserDoc, "BROWSER PAGE (WORKING)");
    dumpBlockDetails(writerDoc, "OUR WRITER PAGE (BROKEN)");

    // Direct comparison
    console.log("\n\n═══ STRUCTURAL DIFFERENCES ═══\n");

    const bBlocks = browserDoc.getMap("blocks");
    const wBlocks = writerDoc.getMap("blocks");

    // Compare first block of each
    const bFirst = bBlocks.values().next().value as Y.Map<any>;
    const wFirst = wBlocks.values().next().value as Y.Map<any>;

    if (bFirst && wFirst) {
        const bKeys = new Set(Array.from(bFirst.keys()));
        const wKeys = new Set(Array.from(wFirst.keys()));

        const onlyBrowser = [...bKeys].filter(k => !wKeys.has(k));
        const onlyWriter = [...wKeys].filter(k => !bKeys.has(k));
        const common = [...bKeys].filter(k => wKeys.has(k));

        if (onlyBrowser.length) console.log(`Keys ONLY in browser: [${onlyBrowser.join(", ")}]`);
        if (onlyWriter.length) console.log(`Keys ONLY in writer: [${onlyWriter.join(", ")}]`);
        console.log(`Common keys: [${common.join(", ")}]`);

        // Compare values for common keys
        for (const key of common) {
            const bv = bFirst.get(key);
            const wv = wFirst.get(key);

            if (bv instanceof Y.Array && wv instanceof Y.Array) {
                const bArr = bv.toJSON();
                const wArr = wv.toJSON();
                const bText = bArr.filter((c: any) => typeof c === "string").join("");
                const wText = wArr.filter((c: any) => typeof c === "string").join("");
                if (bText !== wText) {
                    console.log(`  ${key}: browser="${bText.replace(/\n/g, "\\n")}" writer="${wText.replace(/\n/g, "\\n")}"`);
                }
                // Check array element types
                const bTypes = bArr.map((c: any) => typeof c).join(",");
                const wTypes = wArr.map((c: any) => typeof c).join(",");
                if (bTypes !== wTypes) {
                    console.log(`  ${key} types: browser=[${bTypes.slice(0, 60)}] writer=[${wTypes.slice(0, 60)}]`);
                }
            } else {
                const bj = JSON.stringify(bv);
                const wj = JSON.stringify(wv);
                if (bj !== wj) {
                    console.log(`  ${key}: browser=${bj} writer=${wj}`);
                }
            }
        }
    }

    // Compare rootChildren
    const bRch = browserDoc.getArray("rootChildren").toJSON();
    const wRch = writerDoc.getArray("rootChildren").toJSON();
    console.log(`\nrootChildren: browser=${bRch.length} items, writer=${wRch.length} items`);

    // Compare root map
    const bRoot = browserDoc.getMap("root");
    const wRoot = writerDoc.getMap("root");
    console.log(`root map: browser has ${bRoot.size} keys, writer has ${wRoot.size} keys`);

    const bRootKeys = Array.from(bRoot.keys());
    const wRootKeys = Array.from(wRoot.keys());
    console.log(`  browser root keys: [${bRootKeys.join(", ")}]`);
    console.log(`  writer root keys: [${wRootKeys.join(", ")}]`);
}

main().catch(console.error);
