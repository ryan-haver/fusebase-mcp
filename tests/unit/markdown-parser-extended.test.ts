import { describe, expect, it } from "vitest";
import { markdownToSchema, parseInline } from "../../src/markdown-parser.js";
import type { ContentBlock, InlineSegment } from "../../src/content-schema.js";

const text = (segs: InlineSegment[] | undefined): string => (segs ?? []).map((s) => s.text ?? "").join("");
const only = (md: string): any => {
  const blocks = markdownToSchema(md);
  expect(blocks).toHaveLength(1);
  return blocks[0];
};
const table = (md: string): any => markdownToSchema(md).find((b) => b.type === "table");

describe("headings", () => {
  it("maps H1–H3 to levels 1–3", () => {
    const blocks = markdownToSchema("# One\n## Two\n### Three") as any[];
    expect(blocks.map((b) => [b.type, b.level, text(b.children)])).toEqual([
      ["heading", 1, "One"],
      ["heading", 2, "Two"],
      ["heading", 3, "Three"],
    ]);
  });

  it("maps H4–H6 to level 3", () => {
    const blocks = markdownToSchema("#### Four\n##### Five\n###### Six") as any[];
    expect(blocks.map((b) => b.level)).toEqual([3, 3, 3]);
    expect(text(blocks[2].children)).toBe("Six");
  });

  it("keeps inline formatting in headings", () => {
    expect(only("## A **bold** word").children).toEqual([{ text: "A " }, { text: "bold", bold: true }, { text: " word" }]);
  });
});

describe("inline formatting", () => {
  it("parses bold, italic, strikethrough and code", () => {
    expect(parseInline("**b** *i* ~~s~~ `c`")).toEqual([
      { text: "b", bold: true },
      { text: " " },
      { text: "i", italic: true },
      { text: " " },
      { text: "s", strikethrough: true },
      { text: " " },
      { text: "c", code: true },
    ]);
  });

  it("parses bold+italic", () => {
    expect(parseInline("***both***")).toEqual([{ text: "both", bold: true, italic: true }]);
  });

  it("leaves `2 * 3 * 4` alone (CON-6)", () => {
    expect(parseInline("2 * 3 * 4")).toEqual([{ text: "2 * 3 * 4" }]);
  });

  it("leaves intraword underscores alone (CON-6)", () => {
    expect(parseInline("snake_case_name and __init__")).toEqual([
      { text: "snake_case_name and " },
      { text: "init", bold: true },
    ]);
  });

  it("honours backslash escapes (CON-6)", () => {
    expect(parseInline("\\*not italic\\* and \\_x\\_")).toEqual([{ text: "*not italic* and _x_" }]);
  });

  it("nests a link inside bold (CON-6)", () => {
    expect(parseInline("**see [x](https://y.io)**")).toEqual([
      { text: "see ", bold: true },
      { text: "x", bold: true, link: "https://y.io" },
    ]);
  });

  it("nests bold inside a link (CON-6)", () => {
    expect(parseInline("[**bold**](https://u.io) text")).toEqual([
      { text: "bold", bold: true, link: "https://u.io" },
      { text: " text" },
    ]);
  });

  it("keeps parentheses in link URLs (CON-6)", () => {
    expect(parseInline("[w](https://e.org/Foo_(bar))")).toEqual([{ text: "w", link: "https://e.org/Foo_(bar)" }]);
  });

  it("resolves reference-style links", () => {
    expect(only("See [docs][d].\n\n[d]: https://docs.io").children).toEqual([
      { text: "See " },
      { text: "docs", link: "https://docs.io" },
      { text: "." },
    ]);
  });

  it("parses <u> underline and <mark> highlight", () => {
    expect(parseInline("<u>under</u> <mark>mark</mark>")).toEqual([
      { text: "under", underline: true },
      { text: " " },
      { text: "mark", highlight: { color: "yellow" } },
    ]);
  });

  it("keeps an unclosed <u> literally", () => {
    expect(text(parseInline("a <u>b"))).toBe("a <u>b");
  });

  it("parses ==highlight== including around formatting", () => {
    expect(parseInline("x ==hi== y")).toEqual([{ text: "x " }, { text: "hi", highlight: { color: "yellow" } }, { text: " y" }]);
    expect(parseInline("==**b**==")).toEqual([{ text: "b", bold: true, highlight: { color: "yellow" } }]);
  });

  it("does not treat `a == b` as highlight", () => {
    expect(parseInline("if a == b and c == d")).toEqual([{ text: "if a == b and c == d" }]);
    expect(parseInline("x ==not closed")).toEqual([{ text: "x ==not closed" }]);
  });

  it("does not highlight inside inline code", () => {
    expect(parseInline("`a ==b== c`")).toEqual([{ text: "a ==b== c", code: true }]);
  });

  it("keeps other raw HTML as literal text", () => {
    expect(text(parseInline("<script>alert(1)</script>"))).toBe("<script>alert(1)</script>");
  });

  it("turns hard breaks and <br> into newlines", () => {
    expect(text(only("one  \ntwo\\\nthree<br>four").children)).toBe("one\ntwo\nthree\nfour");
  });

  it("joins soft-wrapped lines into one paragraph (CON-7)", () => {
    expect(only("first line\nsecond line")).toEqual({ type: "paragraph", children: [{ text: "first line second line" }] });
  });
});

describe("images", () => {
  it("maps a standalone image to an image block with the title as caption", () => {
    expect(only('![Alt](https://x.io/a.png "Cap")')).toEqual({ type: "image", src: "https://x.io/a.png", caption: [{ text: "Cap" }] });
  });

  it("falls back to alt text for the caption", () => {
    expect(only("![Alt text](a.png)")).toEqual({ type: "image", src: "a.png", caption: [{ text: "Alt text" }] });
  });

  it("splits an image after text into its own block (CON-6)", () => {
    expect(markdownToSchema("text ![alt](https://x.io/i.png) more")).toEqual([
      { type: "paragraph", children: [{ text: "text" }] },
      { type: "image", src: "https://x.io/i.png", caption: [{ text: "alt" }] },
      { type: "paragraph", children: [{ text: "more" }] },
    ]);
  });

  it("keeps a linked badge image as a link", () => {
    expect(only("[![build](https://b.io/badge.svg)](https://ci.io)").children).toEqual([
      { text: "build", link: "https://ci.io" },
    ]);
  });
});

describe("lists", () => {
  it("parses bullet lists with nesting", () => {
    expect(only("- a\n  - b\n    - c\n- d")).toEqual({
      type: "list",
      style: "bullet",
      items: [
        { children: [{ text: "a" }], indent: 0 },
        { children: [{ text: "b" }], indent: 1 },
        { children: [{ text: "c" }], indent: 2 },
        { children: [{ text: "d" }], indent: 0 },
      ],
    });
  });

  it("parses numbered lists (start number is not representable in the IR)", () => {
    const list = only("3. three\n4. four");
    expect(list.style).toBe("number");
    expect(list.items.map((i: any) => text(i.children))).toEqual(["three", "four"]);
  });

  it("handles tab indentation (CON-7)", () => {
    const list = only("- a\n\t- b");
    expect(list.items.map((i: any) => i.indent)).toEqual([0, 1]);
  });

  it("joins list continuation lines into the item (CON-7)", () => {
    const list = only("- first line\n  continued here\n- second");
    expect(list.items.map((i: any) => text(i.children))).toEqual(["first line continued here", "second"]);
  });

  it("keeps a lazy continuation line in the item", () => {
    const list = only("- item\nlazy");
    expect(text(list.items[0].children)).toBe("item lazy");
  });

  it("parses task lists with checked state", () => {
    expect(only("- [x] done\n- [ ] todo\n- [X] also")).toEqual({
      type: "checklist",
      items: [
        { children: [{ text: "done" }], checked: true },
        { children: [{ text: "todo" }], checked: false },
        { children: [{ text: "also" }], checked: true },
      ],
    });
  });

  it("keeps nested task items in one checklist", () => {
    const list = only("- [ ] parent\n  - [x] child");
    expect(list.type).toBe("checklist");
    expect(list.items.map((i: any) => [text(i.children), i.checked])).toEqual([
      ["parent", false],
      ["child", true],
    ]);
  });

  it("splits a bullet list with a nested numbered list into blocks of one style", () => {
    const blocks = markdownToSchema("- a\n  1. one\n- b") as any[];
    expect(blocks.map((b) => [b.style, b.items.map((i: any) => [text(i.children), i.indent])])).toEqual([
      ["bullet", [["a", 0]]],
      ["number", [["one", 1]]],
      ["bullet", [["b", 0]]],
    ]);
  });

  it("keeps a code block inside a list item", () => {
    const blocks = markdownToSchema("- item\n\n  ```js\n  x()\n  ```\n- next") as any[];
    expect(blocks.map((b) => b.type)).toEqual(["list", "code", "list"]);
    expect(blocks[1]).toEqual({ type: "code", language: "js", code: "x()" });
  });
});

describe("blockquotes and callouts", () => {
  it("merges adjacent > lines into one blockquote (CON-7)", () => {
    expect(only("> line one\n> line two")).toEqual({ type: "blockquote", children: [{ text: "line one line two" }] });
  });

  it("keeps quote paragraphs in one blockquote separated by a newline", () => {
    expect(only("> para one\n>\n> para two")).toEqual({ type: "blockquote", children: [{ text: "para one\npara two" }] });
  });

  it.each([
    ["NOTE", "indigo"],
    ["TIP", "green"],
    ["IMPORTANT", "purple"],
    ["WARNING", "yellow"],
    ["CAUTION", "red"],
  ])("maps [!%s] to a %s hint", (kind, color) => {
    expect(only(`> [!${kind}]\n> Body **text**`)).toEqual({
      type: "hint",
      color,
      children: [{ text: "Body " }, { text: "text", bold: true }],
    });
  });

  it("accepts a callout body on the marker line", () => {
    expect(only("> [!TIP] Same line")).toEqual({ type: "hint", color: "green", children: [{ text: "Same line" }] });
  });

  it("maps >> to an uncoloured hint", () => {
    expect(only(">> legacy hint")).toEqual({ type: "hint", children: [{ text: "legacy hint" }] });
  });
});

describe("code and dividers", () => {
  it("parses backtick and tilde fences with language", () => {
    expect(markdownToSchema("```python\nprint(1)\n```\n\n~~~bash\necho hi\n~~~")).toEqual([
      { type: "code", language: "python", code: "print(1)" },
      { type: "code", language: "bash", code: "echo hi" },
    ]);
  });

  it("keeps a fenced block without language", () => {
    expect(only("```\nplain\n```")).toEqual({ type: "code", code: "plain" });
  });

  it("maps thematic breaks to dividers", () => {
    expect(markdownToSchema("a\n\n---\n\n***\n\n___\n\nb").map((b) => b.type)).toEqual([
      "paragraph",
      "divider",
      "divider",
      "divider",
      "paragraph",
    ]);
  });
});

describe("tables", () => {
  it("parses alignment into text cells", () => {
    const t = table("| L | C | R |\n|:--|:-:|--:|\n| a | b | c |");
    expect(t.rows[0].cells.map((c: any) => c.align)).toEqual([undefined, "center", "right"]);
  });

  it("handles escaped pipes in cells (CON-7)", () => {
    const t = table("| Expr |\n|---|\n| a \\| b |\n| `x \\| y` |");
    expect(text(t.rows[0].cells[0].children)).toBe("a | b");
    expect(t.rows[1].cells[0].children).toEqual([{ text: "x | y", code: true }]);
  });

  it("detects single-column tables (CON-7)", () => {
    const t = table("| Name |\n|---|\n| Alpha |\n| Beta |");
    expect(t.columns).toEqual([{ text: "Name", type: "text" }]);
    expect(t.rows).toHaveLength(2);
  });

  it("keeps inline formatting in text cells", () => {
    const t = table("| A |\n|---|\n| **bold** [l](https://l.io) |");
    expect(t.rows[0].cells[0].children).toEqual([
      { text: "bold", bold: true },
      { text: " " },
      { text: "l", link: "https://l.io" },
    ]);
  });

  it("infers number columns only when every value round-trips", () => {
    const t = table("| N |\n|---|\n| 42 |\n| -3.5 |\n| 1,234 |");
    expect(t.columns[0].type).toBe("number");
    expect(t.rows.map((r: any) => r.cells[0].value)).toEqual([42, -3.5, 1234]);
  });

  it.each([
    ["leading zeros", "02134"],
    ["ambiguous separator", "1,2"],
    ["percentage", "50%"],
    ["trailing zero", "1.50"],
    ["precision loss", "12345678901234567890"],
    ["explicit plus", "+5"],
  ])("keeps a column as text when a value would lose information (%s)", (_label, value) => {
    const t = table(`| V |\n|---|\n| 7 |\n| ${value} |`);
    expect(t.columns[0].type).toBe("text");
    expect(text(t.rows[1].cells[0].children)).toBe(value);
  });

  it("infers currency columns", () => {
    const t = table("| Price |\n|---|\n| $1,200.50 |\n| -$3 |");
    expect(t.columns[0].type).toBe("currency");
    expect(t.rows.map((r: any) => r.cells[0].value)).toEqual([1200.5, -3]);
  });

  it("keeps mixed currency / number columns as text", () => {
    expect(table("| X |\n|---|\n| $5 |\n| 7 |").columns[0].type).toBe("text");
  });

  it("infers checkbox columns from [x] / [ ]", () => {
    const t = table("| Done |\n|---|\n| [x] |\n| [ ] |");
    expect(t.columns[0].type).toBe("checkbox");
    expect(t.rows.map((r: any) => r.cells[0].checked)).toEqual([true, false]);
  });

  it("writes empty cells in typed columns as empty, not 0", () => {
    const t = table("| A | N |\n|---|---|\n| a | 5 |\n| b |  |");
    expect(t.columns[1].type).toBe("number");
    expect(t.rows[1].cells[1]).toBeNull();
  });

  it("keeps a formatted value as text", () => {
    expect(table("| N |\n|---|\n| **5** |").columns[0].type).toBe("text");
  });

  it("pads short rows with empty cells", () => {
    const t = table("| A | B |\n|---|---|\n| only |");
    expect(t.rows[0].cells).toHaveLength(2);
    expect(t.rows[0].cells[1]).toEqual({ cellType: "text", children: [] });
  });
});

describe("<details> toggles", () => {
  it("maps details with a markdown body separated by blank lines", () => {
    const blocks = markdownToSchema("<details>\n<summary>More</summary>\n\n- item **one**\n\n</details>\n\nAfter");
    expect(blocks).toEqual([
      {
        type: "toggle",
        summary: [{ text: "More" }],
        collapsed: true,
        children: [{ type: "list", style: "bullet", items: [{ children: [{ text: "item " }, { text: "one", bold: true }], indent: 0 }] }],
      },
      { type: "paragraph", children: [{ text: "After" }] },
    ]);
  });

  it("handles the summary on the opening line", () => {
    const t = only("<details><summary>S</summary>\n\nBody\n\n</details>");
    expect(text(t.summary)).toBe("S");
    expect(t.children).toEqual([{ type: "paragraph", children: [{ text: "Body" }] }]);
  });

  it("handles details opened and closed on one line", () => {
    const t = only("<details><summary>S</summary>Body</details>");
    expect(text(t.summary)).toBe("S");
    expect(t.children).toEqual([{ type: "paragraph", children: [{ text: "Body" }] }]);
  });

  it("maps <details open> to an expanded toggle and defaults the summary", () => {
    const t = only("<details open>\n\nBody\n\n</details>");
    expect(t.collapsed).toBe(false);
    expect(text(t.summary)).toBe("Details");
  });

  it("supports nested details", () => {
    const t = only("<details>\n<summary>Outer</summary>\n\n<details>\n<summary>Inner</summary>\n\nDeep\n\n</details>\n\n</details>");
    expect(text(t.summary)).toBe("Outer");
    const inner = t.children[0] as any;
    expect(inner.type).toBe("toggle");
    expect(text(inner.summary)).toBe("Inner");
    expect(inner.children).toEqual([{ type: "paragraph", children: [{ text: "Deep" }] }]);
  });

  it("keeps content after the closing tag on the same line", () => {
    const blocks = markdownToSchema("<details><summary>S</summary>B</details>\n\nNext") as ContentBlock[];
    expect(blocks.map((b) => b.type)).toEqual(["toggle", "paragraph"]);
  });
});

describe("misc", () => {
  it("normalises CRLF everywhere (CON-7)", () => {
    const blocks = markdownToSchema("# T\r\n\r\n```js\r\na\r\nb\r\n```\r\n\r\n- x\r\n- y\r\n") as any[];
    expect(JSON.stringify(blocks)).not.toContain("\\r");
    expect(blocks[1].code).toBe("a\nb");
  });

  it("returns nothing for whitespace-only input", () => {
    expect(markdownToSchema("  \n\n\t\n")).toEqual([]);
  });

  it("drops HTML comments", () => {
    expect(markdownToSchema("<!-- hidden -->\n\nshown")).toEqual([{ type: "paragraph", children: [{ text: "shown" }] }]);
  });

  it("keeps literal raw HTML blocks as text", () => {
    expect(text(only("<div>raw</div>").children)).toBe("<div>raw</div>");
  });

  it("parses a mixed document in order", () => {
    const md = "# Title\n\nIntro *text*.\n\n- a\n- b\n\n> quote\n\n| A | B |\n|---|---|\n| 1 | x |\n\n---\n\n```\ncode\n```";
    expect(markdownToSchema(md).map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "list",
      "blockquote",
      "table",
      "divider",
      "code",
    ]);
  });
});

describe("performance", () => {
  // These tests guard against quadratic parsing (2–5 s per case before the fix), not against a
  // slow machine: they compare how time scales with input size, which holds on any runner.
  const PERF_TIMEOUT = 60_000;

  /** Fastest of 5 calls, in ms: noise from a busy machine only ever adds time, so the minimum is the stable measure. */
  const fastestMs = (fn: () => unknown): number => {
    let best = Infinity;
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      fn();
      best = Math.min(best, performance.now() - t0);
    }
    return best;
  };

  /**
   * 4× the input should take about 4× as long; quadratic parsing takes 16×. Allow 8×, with a
   * 50 ms floor so timer noise on fast machines can't fail the test.
   */
  const expectLinear = (make: (size: number) => string, parse: (input: string) => unknown, size = 100_000) => {
    const small = make(size / 4);
    const large = make(size);
    parse(small); // warm up the JIT so the ratio measures the parser, not compilation
    const smallMs = fastestMs(() => parse(small));
    const largeMs = fastestMs(() => parse(large));
    expect(largeMs, `${size / 4} chars: ${smallMs.toFixed(0)} ms, ${size} chars: ${largeMs.toFixed(0)} ms`)
      .toBeLessThan(Math.max(smallMs * 8, 50));
  };

  const PROSE =
    "Lorem ipsum dolor sit amet, **consectetur** adipiscing elit, sed do _eiusmod_ tempor incididunt ut " +
    "labore et dolore magna aliqua. See [the docs](https://example.com/docs) for `details`. ";
  const repeatTo = (unit: string) => (size: number) => unit.repeat(Math.ceil(size / unit.length)).slice(0, size);

  it("parses a 200 KB single line in linear time", () => {
    const line = repeatTo(PROSE)(200_000);
    const result = markdownToSchema(line);
    expect(result).toHaveLength(1);
    expect(text((result[0] as any).children)).toContain("consectetur adipiscing");
    expectLinear(repeatTo(PROSE), markdownToSchema);
  }, PERF_TIMEOUT);

  it("keeps formatting across the whole of a huge paragraph", () => {
    const line = PROSE.repeat(Math.ceil(200_000 / PROSE.length));
    const segs = (markdownToSchema(line)[0] as any).children as InlineSegment[];
    expect(segs.filter((s) => s.bold)).toHaveLength(Math.ceil(200_000 / PROSE.length));
    expect(text(segs)).not.toContain("**");
  });

  it("parses unclosed <u> in linear time (CON-9b)", () => {
    for (const unit of ["<u>", "<u>x "]) {
      const input = repeatTo(unit)(60_000);
      expect(text(parseInline(input))).toBe(input.trim());
      expect(markdownToSchema(input)).toHaveLength(1);
      expectLinear(repeatTo(unit), (s) => ({ segs: parseInline(s), blocks: markdownToSchema(s) }));
    }
  }, PERF_TIMEOUT);

  // Worst cases for micromark's inline resolution (quadratic in one large paragraph without chunking).
  it.each([["a **b** "], ["a <u>u</u> "], ["a * b "], ["`a "], ["[a](b "], ["word ==hl== _it_ [l](https://x.io) "]])(
    "parses 200 KB of dense %j without quadratic blow-up",
    (unit) => {
      expect(markdownToSchema(repeatTo(unit)(200_000)).length).toBeGreaterThan(0);
      expectLinear(repeatTo(unit), markdownToSchema);
    },
    PERF_TIMEOUT,
  );
});

describe("link schemes", () => {
  const links = (md: string) => (markdownToSchema(md)[0] as any).children.filter((c: any) => c.link).map((c: any) => c.link);

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
  ])("drops the link for %j but keeps its text", (url) => {
    const blocks = markdownToSchema(`[click](<${url}>) here`) as any[];
    const segs = blocks[0].children;
    expect(segs.some((c: any) => c.link)).toBe(false);
    expect(segs.map((c: any) => c.text).join("")).toContain("click");
  });

  it("keeps http(s), mailto, tel and relative links", () => {
    expect(links("[a](https://x.io) [b](http://y.io) [c](mailto:a@b.c) [d](tel:+123) [e](/page) [f](#top)"))
      .toEqual(["https://x.io", "http://y.io", "mailto:a@b.c", "tel:+123", "/page", "#top"]);
  });
});
