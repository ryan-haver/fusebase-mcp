/**
 * Byte-level comparison: Create a Y.Doc that should be IDENTICAL to the browser's
 * initial Step2, then compare the binary encoding byte-by-byte.
 * 
 * The browser's initial Step2 for a fresh page creates:
 *   top-level doc.getMap("blocks"): one paragraph block "b2503365551_1" with chars=["\n"]
 *   top-level doc.getArray("rootChildren"): ["b2503365551_1"]
 *   doc.getMap("root").get("children"): empty Y.Array
 *   Block fields: id, type, indent, color, align, characters
 * 
 * Run: npx tsx scripts/byte-compare.ts > data/byte-compare-output.txt 2>&1
 */
import * as Y from "yjs";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readVarUint(data: Uint8Array, offset: number): [number, number] {
    let result = 0, shift = 0, byte: number;
    do { byte = data[offset++]; result |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
    return [result, offset];
}

async function main() {
    // Load browser's actual Step2 from capture
    const capturePath = path.resolve(__dirname, "..", "data", "ws-capture.json");
    const data = JSON.parse(fs.readFileSync(capturePath, "utf-8"));
    const frame3 = data.editorFrames[2]; // frame 3 = browser's Step2 (sent)
    const f3buf = Buffer.from(frame3.payloadHex, "hex");
    const [_sub, f3off] = readVarUint(f3buf, 1);
    const [f3uLen, f3uStart] = readVarUint(f3buf, f3off);
    const browserUpdate = f3buf.slice(f3uStart, f3uStart + f3uLen);

    console.log("═══ BYTE-LEVEL COMPARISON ═══\n");
    console.log(`Browser Step2 update: ${browserUpdate.length} bytes`);
    console.log(`Browser hex: ${browserUpdate.toString("hex")}\n`);

    // Decode the browser update to see exact structure
    const browserDoc = new Y.Doc();
    Y.applyUpdate(browserDoc, browserUpdate);

    console.log("Browser doc shared types:");
    browserDoc.share.forEach((type, name) => {
        console.log(`  "${name}": ${type.constructor.name}`);
        if (type instanceof Y.Map) {
            console.log(`    keys: [${Array.from(type.keys()).join(", ")}]`);
            for (const [k, v] of type.entries()) {
                if (v instanceof Y.Map) {
                    console.log(`    Map "${k}":`);
                    for (const [ik, iv] of v.entries()) {
                        if (iv instanceof Y.Array) {
                            console.log(`      ${ik}: Y.Array(${iv.length}) = ${JSON.stringify(iv.toJSON())}`);
                        } else {
                            console.log(`      ${ik}: ${JSON.stringify(iv)} (${typeof iv})`);
                        }
                    }
                } else if (v instanceof Y.Array) {
                    console.log(`    Array "${k}": ${JSON.stringify(v.toJSON())}`);
                }
            }
        } else if (type instanceof Y.Array) {
            console.log(`    values: ${JSON.stringify(type.toJSON())}`);
        }
    });

    // Now create our doc to match
    console.log("\n─── Creating matched doc ───\n");
    const ourDoc = new Y.Doc();
    // Use same clientID to get identical encoding
    // Actually, we CAN'T use the same clientID since that's random. 
    // The update format includes clientID, so bytes will differ there.
    // Instead, let's focus on STRUCTURAL comparison.

    ourDoc.transact(() => {
        // 1. Root.children (empty)
        const root = ourDoc.getMap("root");
        root.set("children", new Y.Array<string>());

        // 2. Block in top-level blocks map
        const blocks = ourDoc.getMap("blocks");
        const blockId = "b_test_1";
        const bm = new Y.Map();
        bm.set("id", blockId);
        bm.set("type", "paragraph");
        bm.set("indent", 0);
        bm.set("color", "transparent");
        bm.set("align", "left");
        const chars = new Y.Array();
        chars.push(["\n"]);
        bm.set("characters", chars);
        blocks.set(blockId, bm);

        // 3. rootChildren
        const rch = ourDoc.getArray<string>("rootChildren");
        rch.push([blockId]);
    });

    const ourUpdate = Y.encodeStateAsUpdate(ourDoc);
    console.log(`Our update: ${ourUpdate.length} bytes`);
    console.log(`Our hex: ${Buffer.from(ourUpdate).toString("hex")}\n`);

    // Verify our doc can be decoded
    const verifyDoc = new Y.Doc();
    Y.applyUpdate(verifyDoc, ourUpdate);

    console.log("Our doc shared types:");
    verifyDoc.share.forEach((type, name) => {
        console.log(`  "${name}": ${type.constructor.name}`);
        if (type instanceof Y.Map) {
            console.log(`    keys: [${Array.from(type.keys()).join(", ")}]`);
            for (const [k, v] of type.entries()) {
                if (v instanceof Y.Map) {
                    console.log(`    Map "${k}":`);
                    for (const [ik, iv] of v.entries()) {
                        if (iv instanceof Y.Array) {
                            console.log(`      ${ik}: Y.Array(${iv.length}) = ${JSON.stringify(iv.toJSON())}`);
                        } else {
                            console.log(`      ${ik}: ${JSON.stringify(iv)} (${typeof iv})`);
                        }
                    }
                } else if (v instanceof Y.Array) {
                    console.log(`    Array "${k}": ${JSON.stringify(v.toJSON())}`);
                }
            }
        } else if (type instanceof Y.Array) {
            console.log(`    values: ${JSON.stringify(type.toJSON())}`);
        }
    });

    // Compare the TYPE structure byte sequences
    // Y.js update format: numClientStates + [clientID, clock, numOps, [ops...]] + deleteSet
    // Let's parse both to find structural differences
    console.log("\n─── PARSE UPDATE STRUCTURE ───\n");

    function parseUpdate(data: Uint8Array, label: string) {
        console.log(`${label} (${data.length} bytes):`);
        let off = 0;
        const [numStructs, off1] = readVarUint(data, off);
        off = off1;
        console.log(`  numClientStates: ${numStructs}`);

        for (let s = 0; s < numStructs; s++) {
            const [numOps, off2] = readVarUint(data, off);
            off = off2;
            const [clientID, off3] = readVarUint(data, off);
            off = off3;
            const [clock, off4] = readVarUint(data, off);
            off = off4;
            console.log(`  Client ${s}: id=${clientID} clock=${clock} ops=${numOps}`);

            for (let o = 0; o < numOps; o++) {
                const info = data[off++];
                const contentType = info & 0x1f;
                const leftOriginBit = (info >> 5) & 1;
                const rightOriginBit = (info >> 6) & 1;
                const parentInfoBit = (info >> 7) & 1;

                let desc = `    Op ${o}: info=0x${info.toString(16)} contentType=${contentType}`;
                desc += ` leftOrig=${leftOriginBit} rightOrig=${rightOriginBit} parentInfo=${parentInfoBit}`;

                // Skip origins
                if (leftOriginBit) {
                    const [origLen, origOff] = readVarUint(data, off);
                    off = origOff + origLen;
                }
                if (rightOriginBit) {
                    const [origLen, origOff] = readVarUint(data, off);
                    off = origOff + origLen;
                }

                // Parent
                if (parentInfoBit) {
                    // parentYKey (type name)
                    const [keyLen, keyOff] = readVarUint(data, off);
                    const parentKey = Buffer.from(data.slice(keyOff, keyOff + keyLen)).toString("utf-8");
                    off = keyOff + keyLen;
                    desc += ` parent="${parentKey}"`;
                } else {
                    // parentID
                    const [pid, pidOff] = readVarUint(data, off);
                    off = pidOff;
                    const [pcl, pclOff] = readVarUint(data, off);
                    off = pclOff;
                    desc += ` parentID=(${pid},${pcl})`;
                }

                // parentSub (if has parentYKey)
                if (parentInfoBit) {
                    const [subLen, subOff] = readVarUint(data, off);
                    if (subLen > 0) {
                        const parentSub = Buffer.from(data.slice(subOff, subOff + subLen)).toString("utf-8");
                        off = subOff + subLen;
                        desc += `.${parentSub}`;
                    } else {
                        off = subOff;
                    }
                }

                // Content
                switch (contentType) {
                    case 0: { // GC
                        const [len, noff] = readVarUint(data, off);
                        off = noff;
                        desc += ` [GC len=${len}]`;
                        break;
                    }
                    case 2: { // ContentDeleted
                        const [len, noff] = readVarUint(data, off);
                        off = noff;
                        desc += ` [Deleted len=${len}]`;
                        break;
                    }
                    case 3: { // ContentJSON
                        const [len, noff] = readVarUint(data, off);
                        off = noff;
                        const vals: string[] = [];
                        for (let i = 0; i < len; i++) {
                            const [sLen, sOff] = readVarUint(data, off);
                            vals.push(Buffer.from(data.slice(sOff, sOff + sLen)).toString("utf-8"));
                            off = sOff + sLen;
                        }
                        desc += ` [JSON ${vals.map(v => v.slice(0, 50)).join(", ")}]`;
                        break;
                    }
                    case 4: { // ContentString
                        const [sLen, sOff] = readVarUint(data, off);
                        const s = Buffer.from(data.slice(sOff, sOff + sLen)).toString("utf-8");
                        off = sOff + sLen;
                        desc += ` [String "${s.slice(0, 50)}"]`;
                        break;
                    }
                    case 5: { // ContentEmbed
                        const [sLen, sOff] = readVarUint(data, off);
                        off = sOff + sLen;
                        desc += ` [Embed]`;
                        break;
                    }
                    case 6: { // ContentFormat
                        const [kLen, kOff] = readVarUint(data, off);
                        const key = Buffer.from(data.slice(kOff, kOff + kLen)).toString("utf-8");
                        off = kOff + kLen;
                        const [vLen, vOff] = readVarUint(data, off);
                        const val = Buffer.from(data.slice(vOff, vOff + vLen)).toString("utf-8");
                        off = vOff + vLen;
                        desc += ` [Format "${key}"="${val}"]`;
                        break;
                    }
                    case 7: { // ContentType
                        const typeRef = data[off++];
                        const typeNames = ["YArray", "YMap", "YText", "YXmlDoc", "YXmlElement", "YXmlFrag", "YXmlHook", "YXmlText"];
                        desc += ` [Type ref=${typeRef}=${typeNames[typeRef] || "?"}]`;
                        break;
                    }
                    case 8: { // ContentAny
                        const [len, noff] = readVarUint(data, off);
                        off = noff;
                        for (let i = 0; i < len; i++) {
                            const anyType = data[off++];
                            switch (anyType) {
                                case 119: { // string
                                    const [sLen, sOff] = readVarUint(data, off);
                                    const s = Buffer.from(data.slice(sOff, sOff + sLen)).toString("utf-8");
                                    off = sOff + sLen;
                                    desc += ` any-str="${s.slice(0, 50)}"`;
                                    break;
                                }
                                case 120: // false
                                    desc += ` any-false`;
                                    break;
                                case 121: // true
                                    desc += ` any-true`;
                                    break;
                                case 123: { // float64
                                    off += 8;
                                    desc += ` any-float`;
                                    break;
                                }
                                case 124: { // bigint
                                    off += 8;
                                    desc += ` any-bigint`;
                                    break;
                                }
                                case 125: { // int
                                    const [n, noff2] = readVarUint(data, off);
                                    off = noff2;
                                    desc += ` any-int=${n}`;
                                    break;
                                }
                                case 126: // null
                                    desc += ` any-null`;
                                    break;
                                case 127: // undefined
                                    desc += ` any-undef`;
                                    break;
                                default:
                                    desc += ` any-unknown(${anyType})`;
                            }
                        }
                        break;
                    }
                    default:
                        desc += ` [ContentType${contentType}]`;
                        // Can't parse further without known format
                        break;
                }

                console.log(desc);
            }
        }

        // Delete set
        const [numDS, dsOff] = readVarUint(data, off);
        console.log(`  deleteSet: ${numDS} entries`);
    }

    try {
        parseUpdate(browserUpdate, "BROWSER");
    } catch (e) {
        console.log(`  Parse error: ${(e as Error).message}`);
    }

    console.log("");

    try {
        parseUpdate(ourUpdate, "OURS");
    } catch (e) {
        console.log(`  Parse error: ${(e as Error).message}`);
    }

    // Now also decode and compare the dump of our latest page
    console.log("\n\n─── DUMP OF OUR LATEST PAGE ───\n");

    // Load env for dump check
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

    const { loadEncryptedCookie } = await import("../src/crypto.js");
    const stored = loadEncryptedCookie();
    const cookie = stored?.cookie || process.env.FUSEBASE_COOKIE!;
    const host = process.env.FUSEBASE_HOST!;
    const wsId = "45h7lom5ryjak34u";

    // Check the latest page dump
    const pageId = "d1KbzI1l8kEEOYqB"; // latest verify-fix page
    const dumpRes = await fetch(`https://${host}/dump/${wsId}/${pageId}`, { headers: { cookie } });
    const dumpBin = new Uint8Array(await dumpRes.arrayBuffer());

    console.log(`Dump: ${dumpBin.length} bytes`);
    console.log(`First 20 bytes: [${Array.from(dumpBin.slice(0, 20)).join(",")}]\n`);

    // Parse the dump header and find the update inside
    // Dump format: version(1b) + varuint(length) + V1 update
    let dumpUpdate: Uint8Array;
    let dumpOffset = 1; // skip version byte
    const [dumpLen, dumpStart] = readVarUint(dumpBin, dumpOffset);
    dumpUpdate = dumpBin.slice(dumpStart, dumpStart + dumpLen);
    console.log(`Dump update: ${dumpUpdate.length}b from offset ${dumpStart}\n`);

    try {
        parseUpdate(dumpUpdate, "OUR PAGE DUMP");
    } catch (e) {
        console.log(`  Parse error at some point: ${(e as Error).message}`);
    }

    // Also check the browser page dump for comparison
    console.log("\n");
    const browserPageId = data.pageId; // from the ws-capture  
    const brDumpRes = await fetch(`https://${host}/dump/${wsId}/${browserPageId}`, { headers: { cookie } });
    const brDumpBin = new Uint8Array(await brDumpRes.arrayBuffer());
    console.log(`Browser page dump (${browserPageId}): ${brDumpBin.length} bytes`);

    if (brDumpBin.length > 10) {
        const [brLen, brStart] = readVarUint(brDumpBin, 1);
        const brUpdate = brDumpBin.slice(brStart, brStart + brLen);
        console.log(`Browser dump update: ${brUpdate.length}b\n`);
        try {
            parseUpdate(brUpdate, "BROWSER PAGE DUMP");
        } catch (e) {
            console.log(`  Parse error: ${(e as Error).message}`);
        }
    }
}

main().catch(console.error);
