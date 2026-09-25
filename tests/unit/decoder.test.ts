import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { addBlocksToDoc } from "../../src/yjs-ws-writer.js";
import { applyYjsUpdate, decodeYDocToHtml, decodeYjsToHtml, YjsDecodeError } from "../../src/yjs-html-decoder.js";
import { htmlToMarkdown } from "../../src/tools/helpers.js";
import type { ContentBlock } from "../../src/content-schema.js";

function build(blocks: ContentBlock[]): Y.Doc {
  const doc = new Y.Doc();
  doc.transact(() => addBlocksToDoc(doc, blocks));
  return doc;
}

const html = (blocks: ContentBlock[]) => decodeYDocToHtml(build(blocks));
const md = (blocks: ContentBlock[]) => htmlToMarkdown(html(blocks));

/** Add a raw block map (for shapes addBlocksToDoc does not write) to the root. */
function addRaw(doc: Y.Doc, fields: Record<string, unknown>, text?: string): string {
  const id = `raw${Math.random().toString(36).slice(2)}`;
  const m = new Y.Map<unknown>();
  m.set("id", id);
  for (const [k, v] of Object.entries(fields)) m.set(k, v);
  if (text !== undefined) {
    const t = new Y.Text();
    t.insert(0, `${text}\n`);
    m.set("characters", t);
  }
  doc.getMap("blocks").set(id, m);
  doc.getArray<string>("rootChildren").push([id]);
  return id;
}

describe("decodeYDocToHtml: block output", () => {
  it("decodes tables with a header row and every writer cell type (CON-2)", () => {
    const out = html([
      {
        type: "table",
        columns: [
          { text: "Name", type: "text" },
          { text: "Qty", type: "number" },
          { text: "Price", type: "currency" },
          { text: "Done", type: "checkbox" },
          { text: "Due", type: "date" },
          { text: "Status", type: "singleselect", dbSelect: { o1: { name: "Open", style: "solid", color: "green" } } },
          { text: "Site", type: "link" },
        ],
        rows: [{
          cells: [
            { cellType: "text", children: [{ text: "Alpha " }, { text: "one", bold: true }] },
            { cellType: "number", value: 42 },
            { cellType: "currency", value: 9.5 },
            { cellType: "checkbox", checked: true },
            { cellType: "date", timestamp: Date.UTC(2026, 0, 31) },
            { cellType: "singleselect", selected: ["o1"] },
            { cellType: "link", url: "https://x.io", text: "X site" },
          ],
        }],
      },
    ] as ContentBlock[]);
    expect(out).toContain("<thead><tr><th>Name</th><th>Qty</th><th>Price</th><th>Done</th><th>Due</th><th>Status</th><th>Site</th></tr></thead>");
    expect(out).toContain("<td>Alpha <strong>one</strong></td>");
    expect(out).toContain("<td>42</td>");
    expect(out).toContain("<td>$9.5</td>");
    expect(out).toContain('<td><input type="checkbox" checked disabled></td>');
    expect(out).toContain('<td><time datetime="2026-01-31T00:00:00.000Z">2026-01-31</time></td>');
    expect(out).toContain("<td>Open</td>");
    expect(out).toContain('<td><a href="https://x.io">X site</a></td>');
  });

  it("decodes merged and empty table cells", () => {
    const out = html([
      {
        type: "table",
        columns: [{ text: "A", type: "text" }, { text: "B", type: "text" }, { text: "C", type: "text" }],
        rows: [
          { cells: [{ cellType: "text", children: [{ text: "wide" }], colspan: 2 }, null, { cellType: "text", children: [{ text: "c" }] }] },
        ],
      },
    ] as ContentBlock[]);
    expect(out).toContain('<tr><td colspan="2">wide</td><td>c</td></tr>');
    expect(htmlToMarkdown(out)).toContain("| wide |  | c |");
  });

  it("outputs both a collapsible heading's title and its body (CON-3 read side)", () => {
    const out = html([
      { type: "collapsible-heading", level: 2, summary: [{ text: "Section" }], children: [{ type: "paragraph", children: [{ text: "Section body" }] }] },
    ] as ContentBlock[]);
    expect(out).toContain("<h2>Section</h2>");
    expect(out).toContain("<p>Section body</p>");
    expect(out).toMatch(/^<details class="collapsible-heading" open><summary><h2>Section<\/h2><\/summary>/);
  });

  it("outputs heading children for the collapsibleH* block types", () => {
    const doc = new Y.Doc();
    const child = new Y.Map<unknown>();
    const t = new Y.Text();
    t.insert(0, "inside\n");
    child.set("id", "c1");
    child.set("type", "paragraph");
    child.set("characters", t);
    doc.getMap("blocks").set("c1", child);
    const kids = new Y.Array<string>();
    kids.push(["c1"]);
    addRaw(doc, { type: "collapsibleHSmall", children: kids, collapsed: true }, "Small");
    const out = decodeYDocToHtml(doc);
    expect(out).toBe('<details class="collapsible-heading"><summary><h3>Small</h3></summary>\n<p>inside</p>\n</details>');
  });

  it("keeps checklist state", () => {
    const out = html([
      { type: "checklist", items: [{ children: [{ text: "done" }], checked: true }, { children: [{ text: "todo" }], checked: false }] },
    ]);
    expect(out).toContain('<ul class="checklist">');
    expect(out).toContain('<li data-checked="true"><input type="checkbox" checked disabled> done</li>');
    expect(out).toContain('<li data-checked="false"><input type="checkbox" disabled> todo</li>');
  });

  it("nests list items by indent", () => {
    const out = html([
      { type: "list", style: "bullet", items: [{ children: [{ text: "a" }] }, { children: [{ text: "b" }], indent: 1 }, { children: [{ text: "c" }] }] },
    ]);
    expect(out).toBe("<ul>\n<li>a\n<ul>\n<li>b</li>\n</ul></li>\n<li>c</li>\n</ul>");
  });

  it("outputs image captions in a figure", () => {
    const out = html([{ type: "image", src: "https://x.io/a.png", width: 400, caption: [{ text: "A & B" }] }]);
    expect(out).toBe('<figure class="image"><img src="https://x.io/a.png" width="400" alt="A &amp; B"><figcaption>A &amp; B</figcaption></figure>');
  });

  it("outputs hints as a callout aside with their colour", () => {
    expect(html([{ type: "hint", color: "yellow", children: [{ text: "careful" }] }])).toBe('<aside class="hint" data-color="yellow">careful</aside>');
    expect(html([{ type: "hint", children: [{ text: "plain" }] }])).toBe('<aside class="hint">plain</aside>');
  });

  it("outputs toggles, steps and grids with their bodies", () => {
    const out = html([
      { type: "toggle", summary: [{ text: "More" }], children: [{ type: "paragraph", children: [{ text: "toggle body" }] }] },
      { type: "step", children: [{ type: "paragraph", children: [{ text: "step body" }] }] },
      { type: "grid", columns: [{ type: "gridCol", width: "auto", children: [{ type: "paragraph", children: [{ text: "left" }] }] }] },
    ] as ContentBlock[]);
    expect(out).toContain("<details open><summary>More</summary>\n<p>toggle body</p>\n</details>");
    expect(out).toContain("step body");
    expect(out).toContain('<div class="grid-column">');
    expect(out).toContain("left");
  });

  it("uses the button title and code language", () => {
    const out = html([
      { type: "button-single", title: "Go", url: "https://x.io/go" },
      { type: "code", language: "typescript", code: "a < b\nc" },
    ] as ContentBlock[]);
    expect(out).toContain('<a class="button" href="https://x.io/go">Go</a>');
    expect(out).toContain('<pre><code class="language-typescript">a &lt; b\nc</code></pre>');
  });

  it("renders soft line breaks inside a block as <br>", () => {
    expect(html([{ type: "paragraph", children: [{ text: "one\ntwo" }] }])).toBe("<p>one<br>two</p>");
  });

  it("escapes style and attribute values (CON-8)", () => {
    const doc = new Y.Doc();
    addRaw(doc, { type: "paragraph", color: 'red" onmouseover="alert(1)', align: "center" }, "styled");
    addRaw(doc, { type: "image", src: 'x.png" onerror="alert(1)', width: '1" onload="alert(1)' });
    addRaw(doc, { type: "hint", color: "<script>" }, "hint");
    const out = decodeYDocToHtml(doc);
    expect(out).not.toMatch(/"\s*on\w+=/);
    expect(out).not.toContain("<script>");
    expect(out).toContain('<p style="text-align:center">styled</p>');
    expect(out).toContain('src="x.png&quot; onerror=&quot;alert(1)"');
  });

  it("returns an empty string for an empty document", () => {
    expect(decodeYDocToHtml(new Y.Doc())).toBe("");
  });
});

describe("decoder errors surface instead of returning empty HTML (CON-8)", () => {
  it("throws when the root lists blocks that do not exist", () => {
    const doc = new Y.Doc();
    doc.getArray<string>("rootChildren").push(["missing1", "missing2"]);
    expect(() => decodeYDocToHtml(doc)).toThrow(YjsDecodeError);
  });

  it("applyYjsUpdate throws on an undecodable update", () => {
    expect(() => applyYjsUpdate(new Y.Doc(), new Uint8Array([0xff, 0xff, 0xff, 0x01, 0x02]))).toThrow(YjsDecodeError);
  });

  it("decodeYjsToHtml throws on garbage and decodes a real update", () => {
    expect(() => decodeYjsToHtml(new Uint8Array([0xff, 0xff, 0xff, 0x01, 0x02]))).toThrow(YjsDecodeError);
    const update = Y.encodeStateAsUpdate(build([{ type: "paragraph", children: [{ text: "hi" }] }]));
    expect(decodeYjsToHtml(update)).toBe("<p>hi</p>");
  });
});

describe("htmlToMarkdown mapping", () => {
  it("renders decoded tables as GFM tables", () => {
    const out = md([
      {
        type: "table",
        columns: [{ text: "Name", type: "text" }, { text: "Value", type: "number" }, { text: "Ok", type: "checkbox" }],
        rows: [{ cells: [{ cellType: "text", children: [{ text: "a|b" }] }, { cellType: "number", value: 42 }, { cellType: "checkbox", checked: false }] }],
      },
    ] as ContentBlock[]);
    expect(out).toBe("| Name | Value | Ok |\n| --- | --- | --- |\n| a\\|b | 42 | [ ] |");
  });

  it("uses the first row as the header of a table without one", () => {
    expect(htmlToMarkdown("<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>"))
      .toBe("| a | b |\n| --- | --- |\n| c | d |");
  });

  it("keeps images next to italic text", () => {
    expect(htmlToMarkdown('<p><img src="a.png" alt="pic"> and <i>ital</i></p>')).toBe("![pic](a.png) and *ital*");
  });

  it("turns captioned images into ![caption](src)", () => {
    expect(md([{ type: "image", src: "https://x.io/a.png", caption: [{ text: "Cap" }] }])).toBe("![Cap](https://x.io/a.png)");
  });

  it("keeps nested list indentation and numbers", () => {
    expect(md([
      { type: "list", style: "bullet", items: [{ children: [{ text: "a" }] }, { children: [{ text: "b" }], indent: 1 }, { children: [{ text: "c" }], indent: 2 }, { children: [{ text: "d" }] }] },
    ])).toBe("- a\n  - b\n    - c\n- d");
    expect(md([
      { type: "list", style: "number", items: [{ children: [{ text: "one" }] }, { children: [{ text: "two" }] }, { children: [{ text: "sub" }], indent: 1 }, { children: [{ text: "three" }] }] },
    ])).toBe("1. one\n2. two\n   1. sub\n3. three");
  });

  it("renders checklists as task items", () => {
    expect(md([
      { type: "checklist", items: [{ children: [{ text: "done" }], checked: true }, { children: [{ text: "todo" }] }] },
    ])).toBe("- [x] done\n- [ ] todo");
  });

  it("renders hints as GitHub callouts matching the parser's colour mapping", () => {
    const pairs: [string | undefined, string][] = [
      ["indigo", "NOTE"], ["green", "TIP"], ["purple", "IMPORTANT"], ["yellow", "WARNING"], ["red", "CAUTION"], [undefined, "NOTE"],
    ];
    for (const [color, kind] of pairs) {
      expect(md([{ type: "hint", color, children: [{ text: "body" }] }])).toBe(`> [!${kind}]\n> body`);
    }
  });

  it("fences code blocks with their language", () => {
    expect(md([{ type: "code", language: "python", code: "print('*hi*')\n" }])).toBe("```python\nprint('*hi*')\n```");
    expect(md([{ type: "code", code: "plain" }])).toBe("```\nplain\n```");
  });

  it("renders toggles as <details> and collapsible headings as heading + body", () => {
    expect(md([
      { type: "toggle", summary: [{ text: "More", bold: true }], children: [{ type: "paragraph", children: [{ text: "inside" }] }] },
    ] as ContentBlock[])).toBe("<details open>\n<summary>**More**</summary>\n\ninside\n\n</details>");
    expect(md([
      { type: "collapsible-heading", level: 2, summary: [{ text: "Sec" }], children: [{ type: "paragraph", children: [{ text: "body" }] }] },
    ] as ContentBlock[])).toBe("## Sec\n\nbody");
  });

  it("maps inline formats and escapes markdown characters in text", () => {
    expect(md([{
      type: "paragraph",
      children: [
        { text: "b", bold: true }, { text: " " }, { text: "s", strikethrough: true }, { text: " " },
        { text: "u", underline: true }, { text: " " }, { text: "h", highlight: "yellow" }, { text: " " },
        { text: "c", code: true }, { text: " snake_case *not italic* [x] <u>" },
      ],
    }])).toBe("**b** ~~s~~ <u>u</u> ==h== `c` snake_case \\*not italic\\* \\[x\\] \\<u>");
  });
});

// Every block type from the live regression suite (tests/live/block-regression.ts).
const BLOCKS: ContentBlock[] = [
  { type: "heading", level: 1, children: [{ text: "Full Regression Test" }] },
  { type: "heading", level: 2, children: [{ text: "Heading H2" }] },
  { type: "heading", level: 3, children: [{ text: "Heading H3" }] },
  {
    type: "paragraph", children: [
      { text: "Normal " },
      { text: "bold", bold: true },
      { text: " " },
      { text: "italic", italic: true },
      { text: " " },
      { text: "struck", strikethrough: true },
      { text: " " },
      { text: "underlined", underline: true },
      { text: " " },
      { text: "code", code: true },
      { text: " " },
      { text: "link", link: "https://example.com" },
      { text: " trailing plain text" },
    ],
  },
  { type: "divider" },
  { type: "list", style: "bullet", items: [{ children: [{ text: "Bullet 1" }] }, { children: [{ text: "Bullet 2" }] }] },
  { type: "list", style: "number", items: [{ children: [{ text: "Number 1" }] }, { children: [{ text: "Number 2" }] }] },
  { type: "checklist", items: [{ children: [{ text: "Unchecked item" }], checked: false }, { children: [{ text: "Checked item" }], checked: true }] },
  { type: "blockquote", children: [{ text: "A wise quote" }] },
  { type: "code", language: "typescript", code: "const answer: number = 4242;" },
  { type: "toggle", summary: [{ text: "Toggle Summary" }], children: [{ type: "paragraph", children: [{ text: "Hidden toggle content" }] }] },
  { type: "hint", children: [{ text: "Important callout" }] },
  { type: "collapsible-heading", level: 2, summary: [{ text: "Collapsible Section" }], children: [{ type: "paragraph", children: [{ text: "Collapsible body" }] }] },
  { type: "image", src: "https://via.placeholder.com/400x200.png?text=Regression+Test", width: 400 },
  { type: "bookmark", url: "https://github.com" },
  { type: "outline", bordered: true, numbered: true, expanded: true },
  { type: "button-single", title: "Test Button", url: "https://example.com/button" },
  { type: "step-aggregator" },
  { type: "step", children: [{ type: "paragraph", children: [{ text: "Step one body" }] }] },
  { type: "step", children: [{ type: "paragraph", children: [{ text: "Step two body" }] }] },
  {
    type: "table",
    columns: [{ text: "Name", type: "text" }, { text: "Value", type: "number" }],
    rows: [
      { cells: [{ cellType: "text", children: [{ text: "Alpha" }] }, { cellType: "number", value: 42 }] },
      { cells: [{ cellType: "text", children: [{ text: "Beta" }] }, { cellType: "number", value: 99 }] },
    ],
  },
  {
    type: "grid",
    columns: [
      { type: "gridCol", width: "auto", children: [{ type: "paragraph", children: [{ text: "Left column" }] }] },
      { type: "gridCol", width: "auto", children: [{ type: "paragraph", children: [{ text: "Right column" }] }] },
    ],
  },
  { type: "paragraph", children: [{ text: "End of regression test" }] },
];

describe("regression block list: Y.Doc → HTML → markdown round trip", () => {
  const withCaption = BLOCKS.map((b) => (b.type === "image" ? { ...b, caption: [{ text: "Regression caption" }] } : b));
  const decoded = decodeYDocToHtml(build(withCaption));
  const markdown = htmlToMarkdown(decoded);

  it("keeps every block's text in the HTML", () => {
    for (const text of [
      "Collapsible body", "Hidden toggle content", "Step one body", "Step two body",
      "<td>Alpha</td><td>42</td>", "<td>Beta</td><td>99</td>", "<th>Name</th><th>Value</th>",
      "<figcaption>Regression caption</figcaption>", 'data-checked="true"',
    ]) {
      expect(decoded).toContain(text);
    }
  });

  it("keeps all text content, structure and checklist state in the markdown", () => {
    const expected = [
      "# Full Regression Test",
      "## Heading H2",
      "### Heading H3",
      "Normal **bold** *italic* ~~struck~~ <u>underlined</u> `code` [link](https://example.com) trailing plain text",
      "---",
      "- Bullet 1\n- Bullet 2",
      "1. Number 1\n2. Number 2",
      "- [ ] Unchecked item\n- [x] Checked item",
      "> A wise quote",
      "```typescript\nconst answer: number = 4242;\n```",
      "<summary>Toggle Summary</summary>\n\nHidden toggle content\n\n</details>",
      "> [!NOTE]\n> Important callout",
      "## Collapsible Section\n\nCollapsible body",
      "![Regression caption](https://via.placeholder.com/400x200.png?text=Regression+Test)",
      "https://github.com",
      "Table of Contents",
      "[Test Button](https://example.com/button)",
      "Step one body",
      "Step two body",
      "| Name | Value |\n| --- | --- |\n| Alpha | 42 |\n| Beta | 99 |",
      "Left column",
      "Right column",
      "End of regression test",
    ];
    for (const text of expected) expect(markdown).toContain(text);
  });
});
