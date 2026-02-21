/**
 * Deep decode: Decode the browser's captured frames from ws-capture.json
 * to understand the exact Y.Doc structure the browser uses.
 * 
 * Run: npx tsx scripts/decode-browser-frames.ts > data/browser-decode-output.txt 2>&1
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

function dumpDoc(doc: Y.Doc, label: string) {
    console.log(`\n─── ${label} ───`);

    // List all shared types
    console.log("All shared types:");
    doc.share.forEach((type, name) => {
        const typeName = type.constructor.name;
        let info = "";
        if (type instanceof Y.Map) info = `size=${type.size} keys=[${Array.from(type.keys()).sort().join(", ")}]`;
        else if (type instanceof Y.Array) info = `length=${type.length}`;
        else if (type instanceof Y.Text) info = `length=${type.length} text="${type.toString().slice(0, 100)}"`;
        console.log(`  "${name}" (${typeName}): ${info}`);
    });

    // Dump root map if it exists
    const root = doc.getMap("root");
    if (root.size > 0) {
        console.log("\nroot map entries:");
        for (const [key, val] of root.entries()) {
            if (val instanceof Y.Array) {
                const json = val.toJSON();
                console.log(`  "${key}" (Y.Array[${json.length}]): ${JSON.stringify(json).slice(0, 200)}`);
            } else if (val instanceof Y.Map) {
                console.log(`  "${key}" (Y.Map[${val.size}]):`);
                for (const [bk, bv] of val.entries()) {
                    if (bv instanceof Y.Map) {
                        console.log(`    "${bk}" (Y.Map):`);
                        for (const [fk, fv] of bv.entries()) {
                            if (fv instanceof Y.Array) {
                                const arr = fv.toJSON();
                                const text = arr.filter((c: any) => typeof c === "string").join("");
                                console.log(`      ${fk} (Y.Array[${arr.length}]): "${text.slice(0, 80)}"`);
                            } else {
                                console.log(`      ${fk}: ${JSON.stringify(fv)}`);
                            }
                        }
                    } else {
                        console.log(`    "${bk}": ${JSON.stringify(bv)}`);
                    }
                }
            } else {
                console.log(`  "${key}": ${JSON.stringify(val)}`);
            }
        }
    }

    // Also check top-level blocks/children
    const topBlocks = doc.getMap("blocks");
    if (topBlocks.size > 0) {
        console.log("\ntop-level 'blocks' map entries:");
        for (const [bk, bv] of topBlocks.entries()) {
            if (bv instanceof Y.Map) {
                console.log(`  "${bk}" (Y.Map):`);
                for (const [fk, fv] of bv.entries()) {
                    if (fv instanceof Y.Array) {
                        const arr = fv.toJSON();
                        const text = arr.filter((c: any) => typeof c === "string").join("");
                        console.log(`    ${fk} (Y.Array[${arr.length}]): "${text.slice(0, 80)}"`);
                    } else {
                        console.log(`    ${fk}: ${JSON.stringify(fv)}`);
                    }
                }
            }
        }
    }

    const topCh = doc.getArray("children");
    if (topCh.length > 0) {
        console.log(`\ntop-level 'children' (${topCh.length}): ${JSON.stringify(topCh.toJSON()).slice(0, 200)}`);
    }
    const topRch = doc.getArray("rootChildren");
    if (topRch.length > 0) {
        console.log(`top-level 'rootChildren' (${topRch.length}): ${JSON.stringify(topRch.toJSON()).slice(0, 200)}`);
    }
}

async function main() {
    const capturePath = path.resolve(__dirname, "..", "data", "ws-capture.json");
    const data = JSON.parse(fs.readFileSync(capturePath, "utf-8"));
    const frames = data.editorFrames;

    console.log("═══ DEEP DECODE OF BROWSER FRAMES ═══\n");
    console.log(`Page: ${data.pageId}`);
    console.log(`Frames: ${frames.length}\n`);

    // ─── Decode browser's initial SyncStep2 (frame 3, sent by browser) ───
    console.log("═══ BROWSER'S INITIAL STEP2 (frame 3: >> 234b) ═══");
    const frame3 = frames[2]; // 0-indexed
    const f3buf = Buffer.from(frame3.payloadHex, "hex");
    console.log(`  Full hex: ${frame3.payloadHex}`);
    console.log(`  Length: ${f3buf.length}`);

    const [f3sub, f3off] = readVarUint(f3buf, 1);
    console.log(`  subType: ${f3sub} (${f3sub === 1 ? "Step2" : "?"})`);
    const [f3uLen, f3uStart] = readVarUint(f3buf, f3off);
    const f3update = f3buf.slice(f3uStart, f3uStart + f3uLen);
    console.log(`  Inner update: ${f3update.length}b from offset ${f3uStart}`);
    console.log(`  Update hex: ${f3update.toString("hex")}`);

    const step2Doc = new Y.Doc();
    try { Y.applyUpdate(step2Doc, f3update); console.log("  Applied as V1 ✓"); } catch (e) {
        console.log(`  V1 failed: ${(e as Error).message}`);
        try { Y.applyUpdateV2(step2Doc, f3update); console.log("  Applied as V2 ✓"); } catch (e2) {
            console.log(`  V2 also failed: ${(e2 as Error).message}`);
        }
    }
    dumpDoc(step2Doc, "Browser Step2 doc");

    // ─── Decode server's SyncStep2 (frame 4, received by browser) ───
    console.log("\n\n═══ SERVER'S STEP2 (frame 4: << 16b) ═══");
    const frame4 = frames[3];
    const f4buf = Buffer.from(frame4.payloadHex, "hex");
    console.log(`  Full hex: ${frame4.payloadHex}`);
    const [f4sub, f4off] = readVarUint(f4buf, 1);
    const [f4uLen, f4uStart] = readVarUint(f4buf, f4off);
    const f4update = f4buf.slice(f4uStart, f4uStart + f4uLen);
    console.log(`  subType: ${f4sub}, inner update: ${f4update.length}b`);
    console.log(`  Update hex: ${f4update.toString("hex")}`);

    // ─── Decode FIRST content update (frame 5) ───
    console.log("\n\n═══ FIRST CONTENT UPDATE (frame 5: >> 21b) ═══");
    const frame5 = frames[4];
    const f5buf = Buffer.from(frame5.payloadHex, "hex");
    console.log(`  Full hex: ${frame5.payloadHex}`);
    const [f5sub, f5off] = readVarUint(f5buf, 1);
    const [f5uLen, f5uStart] = readVarUint(f5buf, f5off);
    const f5update = f5buf.slice(f5uStart, f5uStart + f5uLen);
    console.log(`  Inner update: ${f5update.length}b`);
    console.log(`  Update hex: ${f5update.toString("hex")}`);

    const f5Doc = new Y.Doc();
    // Apply Step2 first, then this update
    try { Y.applyUpdate(f5Doc, f3update); } catch { } // browser's initial state
    try { Y.applyUpdate(f5Doc, f5update); console.log("  Applied V1 ✓"); } catch (e) {
        console.log(`  V1 failed: ${(e as Error).message}`);
        try { Y.applyUpdateV2(f5Doc, f5update); console.log("  Applied V2 ✓"); } catch { };
    }
    dumpDoc(f5Doc, "After first content update");

    // ─── Build full browser doc incrementally ───
    console.log("\n\n═══ FULL BROWSER DOC (all frames applied) ═══");
    const fullDoc = new Y.Doc();
    let applied = 0;
    for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        const buf = Buffer.from(f.payloadHex, "hex");
        if (buf[0] !== 0x00) continue; // only sync
        const [sub, off] = readVarUint(buf, 1);
        if (sub !== 1 && sub !== 2) continue;
        const [len, start] = readVarUint(buf, off);
        const ud = buf.slice(start, start + len);

        // Apply both sent and received Step2/Updates
        try { Y.applyUpdate(fullDoc, ud); applied++; } catch {
            try { Y.applyUpdateV2(fullDoc, ud); applied++; } catch { }
        }
    }
    console.log(`Applied ${applied} updates total`);
    dumpDoc(fullDoc, "Full browser doc");

    // ─── Decode the 0xAC message ───
    console.log("\n\n═══ MYSTERY 0xAC MESSAGE (frame 34: >> 723b) ═══");
    const frame34 = frames.find((f: any) => f.firstBytes[0] === 0xAC);
    if (frame34) {
        const acBuf = Buffer.from(frame34.payloadHex, "hex");
        console.log(`  Length: ${acBuf.length}`);
        console.log(`  First 10 bytes: [${Array.from(acBuf.slice(0, 10)).join(",")}]`);
        console.log(`  Hex (first 100): ${frame34.payloadHex.slice(0, 200)}`);

        // Try to decode as text
        const text = acBuf.toString("utf-8");
        const readable = text.replace(/[^\x20-\x7E]/g, "·");
        console.log(`  Readable: ${readable.slice(0, 300)}`);

        // Check if it looks like JWT
        if (text.includes("eyJ")) {
            console.log("  ⭐ Contains JWT token!");
        }
    }

    // ─── Compare frame 16 (212b, the big block creation update) ───
    console.log("\n\n═══ LARGE UPDATE FRAME 16 (>> 212b) — likely block creation ═══");
    const frame16 = frames[15];
    const f16buf = Buffer.from(frame16.payloadHex, "hex");
    const [f16sub, f16off] = readVarUint(f16buf, 1);
    const [f16uLen, f16uStart] = readVarUint(f16buf, f16off);
    const f16update = f16buf.slice(f16uStart, f16uStart + f16uLen);
    console.log(`  Inner update: ${f16update.length}b`);

    // Apply all updates up to and including frame 16
    const docAt16 = new Y.Doc();
    for (let i = 0; i <= 15; i++) {
        const f = frames[i];
        const buf = Buffer.from(f.payloadHex, "hex");
        if (buf[0] !== 0x00) continue;
        const [sub, off] = readVarUint(buf, 1);
        if (sub !== 1 && sub !== 2) continue;
        const [len, start] = readVarUint(buf, off);
        const ud = buf.slice(start, start + len);
        try { Y.applyUpdate(docAt16, ud); } catch {
            try { Y.applyUpdateV2(docAt16, ud); } catch { }
        }
    }
    dumpDoc(docAt16, "Doc after frame 16 (Hello World typed)");

    // ─── Compare frame 20 (240b) — Enter + second block ───
    console.log("\n\n═══ FRAME 20 (>> 240b) — likely Enter + new block ═══");
    const docAt20 = new Y.Doc();
    for (let i = 0; i <= 19; i++) {
        const f = frames[i];
        const buf = Buffer.from(f.payloadHex, "hex");
        if (buf[0] !== 0x00) continue;
        const [sub, off] = readVarUint(buf, 1);
        if (sub !== 1 && sub !== 2) continue;
        const [len, start] = readVarUint(buf, off);
        const ud = buf.slice(start, start + len);
        try { Y.applyUpdate(docAt20, ud); } catch {
            try { Y.applyUpdateV2(docAt20, ud); } catch { }
        }
    }
    dumpDoc(docAt20, "Doc after frame 20 (Enter pressed + Heading start)");
}

main().catch(console.error);
