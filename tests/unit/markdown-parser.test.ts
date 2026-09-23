import { describe, expect, it } from "vitest";
import { markdownToSchema, parseInline } from "../../src/markdown-parser.js";

// Moved from the offline half of scripts/test-regression.ts.
describe("markdownToSchema: GFM table", () => {
  const md = `| Name | Role | Salary | Active |
|:-----|:----:|-------:|:------:|
| Alice | Eng | $140,000 | [x] |
| Bob | Ops | $90,000 | [ ] |`;
  const table = markdownToSchema(md).find((b) => b.type === "table") as any;

  it("parses to a table block with 4 columns and 2 rows", () => {
    expect(table).toBeTruthy();
    expect(table.columns).toHaveLength(4);
    expect(table.rows).toHaveLength(2);
  });

  it("infers currency and checkbox columns", () => {
    expect(table.columns[2].type).toBe("currency");
    expect(table.columns[3].type).toBe("checkbox");
    expect(table.rows[0].cells[2].value).toBe(140000);
    expect(table.rows[0].cells[3].checked).toBe(true);
  });
});

describe("markdownToSchema: other blocks", () => {
  it("maps a GitHub WARNING callout to a yellow hint", () => {
    const hint = markdownToSchema("> [!WARNING]\n> Critical system update needed").find((b) => b.type === "hint") as any;
    expect(hint?.color).toBe("yellow");
  });

  it("parses an image with caption", () => {
    const img = markdownToSchema('![Network Architecture](https://example.com/net.png "Topology")').find((b) => b.type === "image") as any;
    expect(img?.src).toBe("https://example.com/net.png");
    expect(img?.caption?.[0]?.text).toBe("Topology");
  });

  it("parses <details> into a toggle with its summary", () => {
    const toggle = markdownToSchema("<details>\n<summary>Database Secrets</summary>\nPassword is hidden\n</details>").find((b) => b.type === "toggle") as any;
    expect(toggle?.summary?.[0]?.text).toBe("Database Secrets");
  });

  it("parses headings and code fences exactly", () => {
    const blocks = markdownToSchema("# Title\n\n```ts\nconst a = 1; // # not a heading | not a table\n```") as any[];
    expect(blocks[0]).toMatchObject({ type: "heading", level: 1, children: [{ text: "Title" }] });
    expect(blocks[1]).toMatchObject({ type: "code", code: "const a = 1; // # not a heading | not a table" });
  });

  it("returns no blocks for empty input", () => {
    expect(markdownToSchema("")).toEqual([]);
  });

  // CON-7: CRLF input leaves "\r" in heading text and code lines.
  it.fails("normalises CRLF line endings (CON-7)", () => {
    const blocks = markdownToSchema("# Title\r\n\r\nBody\r\n") as any[];
    expect(blocks[0].children[0].text).toBe("Title");
  });

  // CON-7: numeric-looking cells are coerced, losing leading zeros.
  it.fails("keeps leading zeros in table cells (CON-7)", () => {
    const table = markdownToSchema("| City | Zip |\n|---|---|\n| Boston | 02134 |").find((b) => b.type === "table") as any;
    expect(table).toBeTruthy();
    expect(JSON.stringify(table.rows)).toContain("02134");
  });

  // CON-7: a table needs 2+ columns to be detected.
  it.fails("detects single-column tables (CON-7)", () => {
    expect(markdownToSchema("| Name |\n|---|\n| Alpha |").some((b) => b.type === "table")).toBe(true);
  });
});

describe("parseInline", () => {
  it("parses <u> and ==highlight==", () => {
    const segs = parseInline("Word with <u>underlined text</u> and ==yellow highlight==");
    expect(segs.some((s) => s.underline && s.text === "underlined text")).toBe(true);
    expect(segs.some((s) => Boolean(s.highlight) && s.text === "yellow highlight")).toBe(true);
  });

  // CON-6: underscores inside words are treated as emphasis and deleted.
  it.fails("leaves intraword underscores alone (CON-6)", () => {
    const text = parseInline("the snake_case_name variable").map((s) => s.text).join("");
    expect(text).toBe("the snake_case_name variable");
  });

  // CON-6: a link URL containing parentheses is truncated.
  it.fails("keeps parentheses inside link URLs (CON-6)", () => {
    const link = parseInline("[wiki](https://en.wikipedia.org/wiki/Foo_(bar)) after").find((s) => s.link);
    expect(link?.link).toBe("https://en.wikipedia.org/wiki/Foo_(bar)");
  });
});
