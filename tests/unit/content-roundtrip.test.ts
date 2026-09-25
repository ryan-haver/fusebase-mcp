import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { addBlocksToDoc } from "../../src/yjs-ws-writer.js";
import { decodeYDocToHtml } from "../../src/yjs-html-decoder.js";
import { markdownToSchema } from "../../src/markdown-parser.js";
import { htmlToMarkdown } from "../../src/tools/helpers.js";
import type { ContentBlock } from "../../src/content-schema.js";

function build(blocks: ContentBlock[]): Y.Doc {
  const doc = new Y.Doc();
  doc.transact(() => addBlocksToDoc(doc, blocks));
  return doc;
}

/** Deltas of every block's characters, in document order. */
function deltas(doc: Y.Doc): any[][] {
  const blocks = doc.getMap<Y.Map<unknown>>("blocks");
  return doc.getArray<string>("rootChildren").toArray().map((id) => {
    const chars = blocks.get(id)?.get("characters");
    return chars instanceof Y.Text ? chars.toDelta() : [];
  });
}

describe("Y.Doc writer → HTML decoder round trip", () => {
  it("round-trips headings, lists, quotes and code", () => {
    const html = decodeYDocToHtml(build(markdownToSchema("# Title\n\n- one\n- two\n\n> quoted\n\n```\ncode here\n```")));
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("two");
    expect(html).toContain("quoted");
    expect(html).toContain("code here");
  });

  it("escapes HTML in text", () => {
    const html = decodeYDocToHtml(build(markdownToSchema("<script>alert(1)</script>")));
    expect(html).not.toContain("<script>");
  });

  // CON-1 regressions: text inserted with `undefined` attributes inherits the previous format.
  it("does not give the block terminator the last segment's format (CON-1)", () => {
    const [delta] = deltas(build(markdownToSchema("ends in **bold**")));
    expect(delta.at(-1)).toEqual({ insert: "\n" });
  });

  it("does not bleed bold into following plain text (CON-1)", () => {
    const [delta] = deltas(build(markdownToSchema("**Note:** the rest is plain.")));
    expect(delta[0]).toEqual({ insert: "Note:", attributes: { bold: true } });
    expect(delta[1].attributes).toBeUndefined();
  });

  it("does not bleed a link into following plain text (CON-1)", () => {
    const html = decodeYDocToHtml(build(markdownToSchema("See [the docs](https://x.io) for details.")));
    expect(html).toContain('<a href="https://x.io">the docs</a> for details.');
  });

  // CON-2: tables decoded to a placeholder, so read → write-back destroyed them.
  it("decodes table cell contents (CON-2)", () => {
    const html = decodeYDocToHtml(build(markdownToSchema("| Name | Qty |\n|---|---|\n| Alpha | 42 |")));
    expect(html).toContain("<th>Name</th><th>Qty</th>");
    expect(html).toContain("<td>Alpha</td><td>42</td>");
  });

  // CON-3 regression: non-paragraph children of a toggle were written as "(nested block)".
  it("keeps nested list content inside a toggle (CON-3)", () => {
    const doc = build([
      { type: "toggle", summary: [{ text: "More" }], children: [{ type: "list", style: "bullet", items: [{ children: [{ text: "nested item" }] }] }] },
    ] as ContentBlock[]);
    expect(decodeYDocToHtml(doc)).toContain("nested item");
  });
});

describe("htmlToMarkdown (get_page_content markdown mode)", () => {
  it("converts basic formatting", () => {
    expect(htmlToMarkdown("<h1>Title</h1><p><strong>b</strong> and <em>i</em></p>")).toContain("# Title");
    expect(htmlToMarkdown("<p>line one<br>line two</p>")).toBe("line one\\\nline two");
  });

  it("keeps line breaks through a read → write round trip", () => {
    const blocks = markdownToSchema(htmlToMarkdown("<p>line one<br>line two</p>")) as any[];
    expect(blocks).toHaveLength(1);
    expect(blocks[0].children.map((c: any) => c.text).join("")).toBe("line one\nline two");
  });

  // CON-8: `<i[^>]*>` also matches `<img ...>`, destroying the image.
  it("keeps an image that precedes italic text (CON-8)", () => {
    expect(htmlToMarkdown('<p><img src="a.png" alt="pic"> and <i>ital</i></p>')).toContain("![pic](a.png)");
  });

  // CON-8: tables flatten to concatenated cell text.
  it("renders tables as GFM tables (CON-8)", () => {
    expect(htmlToMarkdown("<table><tr><td>a</td><td>b</td></tr></table>")).toContain("| a | b |");
  });
});
