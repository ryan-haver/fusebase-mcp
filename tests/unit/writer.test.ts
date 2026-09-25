import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { addBlocksToDoc, docHasUpdate, withPageLock } from "../../src/yjs-ws-writer.js";
import type { ContentBlock } from "../../src/content-schema.js";

function build(blocks: ContentBlock[]): Y.Doc {
  const doc = new Y.Doc();
  doc.transact(() => addBlocksToDoc(doc, blocks));
  return doc;
}

/** Block map + helpers to walk the stored structure. */
function view(doc: Y.Doc) {
  const blocks = doc.getMap<Y.Map<unknown>>("blocks");
  const get = (id: string) => blocks.get(id)!;
  const text = (id: string) => String((get(id).get("characters") as Y.Text | undefined)?.toString() ?? "").replace(/\n$/, "");
  const children = (id: string) => ((get(id).get("children") as Y.Array<string> | undefined)?.toArray() ?? []);
  const root = doc.getArray<string>("rootChildren").toArray();
  return { get, text, children, root, type: (id: string) => String(get(id).get("type")) };
}

describe("nested content is written, not replaced by placeholders (CON-3)", () => {
  it("writes a list inside a toggle as a real list container", () => {
    const doc = build([
      { type: "toggle", summary: [{ text: "More" }], children: [{ type: "list", style: "bullet", items: [{ children: [{ text: "nested item" }] }] }] },
    ] as ContentBlock[]);
    const v = view(doc);
    expect(v.root).toHaveLength(1); // nested blocks must not leak into the page root
    const [listId] = v.children(v.root[0]);
    expect(v.type(listId)).toBe("list");
    const [itemId] = v.children(listId);
    expect(v.type(itemId)).toBe("listItemBullet");
    expect(v.text(itemId)).toBe("nested item");
  });

  it("writes code and nested toggles inside collapsible headings, steps and grid columns", () => {
    const doc = build([
      { type: "collapsible-heading", level: 2, summary: [{ text: "Section" }], children: [{ type: "code", language: "ts", code: "let a = 1;" }] },
      { type: "step", children: [{ type: "toggle", summary: [{ text: "Inner" }], children: [{ type: "paragraph", children: [{ text: "deep" }] }] }] },
      { type: "grid", columns: [{ type: "gridCol", width: "auto", children: [{ type: "heading", level: 3, children: [{ text: "Col head" }] }] }] },
    ] as ContentBlock[]);
    const v = view(doc);
    expect(v.root).toHaveLength(3);
    const [codeId] = v.children(v.root[0]);
    expect(v.type(codeId)).toBe("syntax");
    const [innerToggle] = v.children(v.root[1]);
    expect(v.type(innerToggle)).toBe("toggle");
    expect(v.text(v.children(innerToggle)[0])).toBe("deep");
    const [colId] = v.children(v.root[2]);
    expect(v.text(v.children(colId)[0])).toBe("Col head");
    expect(JSON.stringify(doc.toJSON())).not.toMatch(/nested (block|item)/);
  });
});

describe("docHasUpdate (CON-4 confirmation)", () => {
  it("is true only when the server doc contains our client's updates up to the sent clock", () => {
    const ours = build([{ type: "paragraph", children: [{ text: "x" }] }] as ContentBlock[]);
    const pending = { clientId: ours.clientID, clock: Y.decodeStateVector(Y.encodeStateVector(ours)).get(ours.clientID)! };

    const server = new Y.Doc();
    expect(docHasUpdate(server, pending)).toBe(false);
    Y.applyUpdate(server, Y.encodeStateAsUpdate(ours));
    expect(docHasUpdate(server, pending)).toBe(true);
  });
});

describe("withPageLock (CON-5)", () => {
  it("runs writes to the same page one after another", async () => {
    const events: string[] = [];
    const task = (name: string, ms: number) => async () => {
      events.push(`${name}:start`);
      await new Promise((r) => setTimeout(r, ms));
      events.push(`${name}:end`);
    };
    await Promise.all([withPageLock("page", task("a", 30)), withPageLock("page", task("b", 1))]);
    expect(events).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });

  it("lets writes to different pages run concurrently and survives a failed write", async () => {
    const events: string[] = [];
    const failing = withPageLock("p1", async () => { events.push("p1"); throw new Error("boom"); });
    const other = withPageLock("p2", async () => { events.push("p2"); });
    await expect(failing).rejects.toThrow("boom");
    await other;
    await withPageLock("p1", async () => { events.push("p1-again"); });
    expect(events).toEqual(["p1", "p2", "p1-again"]);
  });
});
