/**
 * CON-10: a replace deletes only the blocks in the copy of the page it received. Blocks that
 * reached the server without being in that copy (e.g. a just-confirmed append) survived the
 * replace; found live by the write-verification suite. The writer now re-reads the page after
 * a replace and removes top-level blocks it didn't write.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { addBlocksToDoc, foreignRootBlocks, removeRootBlocks } from "../../src/yjs-ws-writer.js";
import { markdownToSchema } from "../../src/markdown-parser.js";

function textOf(doc: Y.Doc): string {
  const blocks = doc.getMap("blocks");
  return doc.getArray<string>("rootChildren").toArray()
    .map((id) => String((blocks.get(id) as Y.Map<unknown> | undefined)?.get("characters") ?? ""))
    .join("");
}

describe("replace completion (CON-10)", () => {
  it("removes blocks the replacing writer never saw", () => {
    // Server copy: original content, then an append from another connection.
    const server = new Y.Doc();
    addBlocksToDoc(server, markdownToSchema("# Original Header\n\nOriginal body."));
    const stale = new Y.Doc();
    Y.applyUpdate(stale, Y.encodeStateAsUpdate(server)); // the replacer's copy: no append yet
    const appender = new Y.Doc();
    Y.applyUpdate(appender, Y.encodeStateAsUpdate(server));
    addBlocksToDoc(appender, markdownToSchema("## Appended\n\nToken 987654."));
    Y.applyUpdate(server, Y.encodeStateAsUpdate(appender));

    // The replace, made against the stale copy: clear what it sees, write the new content.
    const before = Y.encodeStateVector(stale);
    stale.transact(() => {
      const rch = stale.getArray<string>("rootChildren");
      rch.delete(0, rch.length);
      const blocks = stale.getMap("blocks");
      for (const k of Array.from(blocks.keys())) blocks.delete(k);
      addBlocksToDoc(stale, markdownToSchema("# Replaced\n\nNew body."));
    });
    const own = stale.getArray<string>("rootChildren").toArray();
    Y.applyUpdate(server, Y.encodeStateAsUpdate(stale, before));

    // Reproduces the live failure: original gone, appended text survives.
    expect(textOf(server)).not.toContain("Original Header");
    expect(textOf(server)).toContain("987654");

    const foreign = foreignRootBlocks(server, own);
    expect(foreign.length).toBeGreaterThan(0);
    server.transact(() => removeRootBlocks(server, foreign));

    expect(foreignRootBlocks(server, own)).toEqual([]);
    expect(textOf(server)).not.toContain("987654");
    expect(textOf(server)).toContain("Replaced");
    expect(textOf(server)).toContain("New body.");
  });

  it("removes nested blocks under a removed block", () => {
    const doc = new Y.Doc();
    addBlocksToDoc(doc, [{ type: "toggle", summary: [{ text: "Toggle" }], children: [{ type: "paragraph", children: [{ text: "Inside" }] }] }]);
    const ids = doc.getArray<string>("rootChildren").toArray();
    const before = doc.getMap("blocks").size;
    expect(before).toBeGreaterThan(1);
    doc.transact(() => removeRootBlocks(doc, ids));
    expect(doc.getArray("rootChildren").length).toBe(0);
    expect(doc.getMap("blocks").size).toBe(0);
  });

  it("finds nothing when the page holds only the replace's blocks", () => {
    const doc = new Y.Doc();
    addBlocksToDoc(doc, markdownToSchema("# Only mine"));
    expect(foreignRootBlocks(doc, doc.getArray<string>("rootChildren").toArray())).toEqual([]);
  });

  it("a delete-only update leaves the clock unchanged but carries a delete set (so it must still be sent)", () => {
    const server = new Y.Doc();
    addBlocksToDoc(server, markdownToSchema("# Leftover"));
    const writer = new Y.Doc();
    Y.applyUpdate(writer, Y.encodeStateAsUpdate(server));
    const before = Y.encodeStateVector(writer);
    writer.transact(() => removeRootBlocks(writer, writer.getArray<string>("rootChildren").toArray()));
    const diff = Y.encodeStateAsUpdate(writer, before);
    expect(Y.decodeStateVector(Y.encodeStateVector(writer)).get(writer.clientID) ?? 0).toBe(0);
    expect(Y.decodeUpdate(diff).ds.clients.size).toBeGreaterThan(0);
    Y.applyUpdate(server, diff);
    expect(server.getArray("rootChildren").length).toBe(0);
  });
});
