/**
 * Markdown Parser — Converts Markdown strings to Content Schema IR.
 *
 * Zero external dependencies. Handles standard and extended markdown constructs:
 * headings (H1-H3), paragraphs, bold, italic, strikethrough, underline, highlight,
 * inline code, links, bullet lists, numbered lists, checklists, dividers, blockquotes,
 * code blocks, GitHub callouts/admonitions, GFM tables, images, and HTML details/toggles.
 */

import type {
  ContentBlock,
  InlineSegment,
  ListItemBlock,
  ParagraphBlock,
  HeadingBlock,
  DividerBlock,
  ListBlock,
  BlockquoteBlock,
  CodeBlock,
  HintBlock,
  ImageBlock,
  ToggleBlock,
  TableBlock,
  TableColumn,
  TableRow,
  TableCell,
  TableCellType,
} from "./content-schema.js";

/* ------------------------------------------------------------------ */
/*  Inline formatting parser                                           */
/* ------------------------------------------------------------------ */

/**
 * Parse inline markdown formatting into InlineSegment[].
 * Supports: **bold**, *italic*, ***bold+italic***, __bold__, _italic_,
 *           ~~strikethrough~~, `inline code`, [link text](url),
 *           <u>underline</u>, ==highlight==, <mark>highlight</mark>
 */
export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let i = 0;

  while (i < text.length) {
    // Underline: <u>text</u>
    if (text.slice(i, i + 3).toLowerCase() === "<u>") {
      const close = text.toLowerCase().indexOf("</u>", i + 3);
      if (close !== -1) {
        segments.push({ text: text.slice(i + 3, close), underline: true });
        i = close + 4;
        continue;
      }
    }

    // Highlight: <mark>text</mark>
    if (text.slice(i, i + 6).toLowerCase() === "<mark>") {
      const close = text.toLowerCase().indexOf("</mark>", i + 6);
      if (close !== -1) {
        segments.push({ text: text.slice(i + 6, close), highlight: { color: "yellow" } });
        i = close + 7;
        continue;
      }
    }

    // Highlight: ==text==
    if (text[i] === "=" && text[i + 1] === "=") {
      const close = text.indexOf("==", i + 2);
      if (close !== -1 && close > i + 2) {
        segments.push({ text: text.slice(i + 2, close), highlight: { color: "yellow" } });
        i = close + 2;
        continue;
      }
    }

    // Inline code: `text` — check FIRST to avoid interference with other markers
    if (text[i] === "`") {
      const close = text.indexOf("`", i + 1);
      if (close !== -1 && close > i + 1) {
        segments.push({ text: text.slice(i + 1, close), code: true });
        i = close + 1;
        continue;
      }
    }

    // Markdown link: [text](url)
    if (text[i] === "[") {
      const closeB = text.indexOf("]", i + 1);
      if (closeB !== -1 && text[closeB + 1] === "(") {
        const closeP = text.indexOf(")", closeB + 2);
        if (closeP !== -1) {
          const linkText = text.slice(i + 1, closeB);
          const linkUrl = text.slice(closeB + 2, closeP);
          segments.push({ text: linkText, link: linkUrl });
          i = closeP + 1;
          continue;
        }
      }
    }

    // Strikethrough: ~~text~~
    if (text[i] === "~" && text[i + 1] === "~") {
      const close = text.indexOf("~~", i + 2);
      if (close !== -1) {
        segments.push({ text: text.slice(i + 2, close), strikethrough: true });
        i = close + 2;
        continue;
      }
    }

    // Bold+italic: ***text*** or ___text___
    if (
      (text[i] === "*" || text[i] === "_") &&
      text[i + 1] === text[i] &&
      text[i + 2] === text[i]
    ) {
      const marker = text[i];
      const close = text.indexOf(marker + marker + marker, i + 3);
      if (close !== -1) {
        segments.push({
          text: text.slice(i + 3, close),
          bold: true,
          italic: true,
        });
        i = close + 3;
        continue;
      }
    }

    // Bold: **text** or __text__
    if (
      (text[i] === "*" || text[i] === "_") &&
      text[i + 1] === text[i]
    ) {
      const marker = text[i];
      const close = text.indexOf(marker + marker, i + 2);
      if (close !== -1) {
        segments.push({ text: text.slice(i + 2, close), bold: true });
        i = close + 2;
        continue;
      }
    }

    // Italic: *text* or _text_
    if (text[i] === "*" || text[i] === "_") {
      const marker = text[i];
      const close = text.indexOf(marker, i + 1);
      if (close !== -1 && close > i + 1) {
        segments.push({ text: text.slice(i + 1, close), italic: true });
        i = close + 1;
        continue;
      }
    }

    // Plain text: accumulate until next potential marker
    let end = i + 1;
    while (
      end < text.length &&
      text[end] !== "*" &&
      text[end] !== "_" &&
      text[end] !== "`" &&
      text[end] !== "~" &&
      text[end] !== "[" &&
      text[end] !== "<" &&
      !(text[end] === "=" && text[end + 1] === "=")
    ) {
      end++;
    }
    segments.push({ text: text.slice(i, end) });
    i = end;
  }

  return segments;
}

/* ------------------------------------------------------------------ */
/*  Table parsing helpers                                              */
/* ------------------------------------------------------------------ */

function splitTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((c) => c.trim());
}

function isTableDelimiter(line: string): boolean {
  const trimmed = line.trim();
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(trimmed);
}

function inferCellType(val: string): TableCellType {
  const trimmed = val.trim();
  if (!trimmed) return "text";
  if (/^[-+]?\$[\d,]+(\.\d+)?$/.test(trimmed)) return "currency";
  if (/^[-+]?[\d,]+(\.\d+)?%?$/.test(trimmed) && !isNaN(Number(trimmed.replace(/[,%]/g, "")))) return "number";
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/.test(trimmed) && !isNaN(Date.parse(trimmed))) return "date";
  if (/^\[[ xX]\]$/.test(trimmed) || /^(true|false)$/i.test(trimmed)) return "checkbox";
  return "text";
}

/* ------------------------------------------------------------------ */
/*  Block-level parser                                                 */
/* ------------------------------------------------------------------ */

/**
 * Parse a markdown string into an array of ContentBlock objects.
 */
export function markdownToSchema(md: string): ContentBlock[] {
  const lines = md.split("\n");
  const blocks: ContentBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Skip empty lines
    if (trimmed === "") {
      i++;
      continue;
    }

    // Code block: ```
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      const block: CodeBlock = {
        type: "code",
        language: lang,
        code: codeLines.join("\n"),
      };
      blocks.push(block);
      continue;
    }

    // Standalone Image: ![alt](url) or ![alt](url "caption")
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)(?:\s+"(.*?)")?\)\s*$/);
    if (imgMatch) {
      const altText = imgMatch[1];
      const srcUrl = imgMatch[2];
      const captionText = imgMatch[3] || altText;
      const imgBlock: ImageBlock = {
        type: "image",
        src: srcUrl,
        caption: captionText ? parseInline(captionText) : undefined,
      };
      blocks.push(imgBlock);
      i++;
      continue;
    }

    // Collapsible Details / Toggle: <details> ... </details>
    if (trimmed.toLowerCase().startsWith("<details")) {
      const detailLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].toLowerCase().includes("</details>")) {
        detailLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing </details>

      let summaryText = "Details";
      const fullDetailText = detailLines.join("\n");
      const summaryMatch = fullDetailText.match(/<summary>(.*?)<\/summary>/is);
      if (summaryMatch) {
        summaryText = summaryMatch[1].trim();
      }
      const innerMarkdown = fullDetailText.replace(/<summary>.*?<\/summary>/is, "").trim();
      const innerBlocks = innerMarkdown ? markdownToSchema(innerMarkdown) : [];

      const toggleBlock: ToggleBlock = {
        type: "toggle",
        summary: parseInline(summaryText),
        children: innerBlocks,
        collapsed: true,
      };
      blocks.push(toggleBlock);
      continue;
    }

    // Table: | col1 | col2 | followed by delimiter line
    if (trimmed.includes("|") && i + 1 < lines.length && isTableDelimiter(lines[i + 1])) {
      const headerRow = splitTableRow(trimmed);
      const delimiterRow = splitTableRow(lines[i + 1]);
      i += 2;

      // Extract alignments
      const alignments: ("left" | "center" | "right")[] = delimiterRow.map((d) => {
        const t = d.trim();
        if (t.startsWith(":") && t.endsWith(":")) return "center";
        if (t.endsWith(":")) return "right";
        return "left";
      });

      // Extract rows
      const rawRows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|") && !isTableDelimiter(lines[i])) {
        rawRows.push(splitTableRow(lines[i]));
        i++;
      }

      // Infer column types based on column values across all rows
      const columns: TableColumn[] = headerRow.map((colName, colIdx) => {
        const types = rawRows
          .map((r) => (r[colIdx] !== undefined ? inferCellType(r[colIdx]) : "text"))
          .filter((t) => t !== "text" || rawRows.some((r) => r[colIdx]?.trim().length > 0));

        let dominantType: TableCellType = "text";
        if (types.length > 0 && types.every((t) => t === types[0])) {
          dominantType = types[0];
        }

        return {
          text: colName,
          type: dominantType,
        };
      });

      // Build TableRow[]
      const rows: TableRow[] = rawRows.map((rawRow) => {
        const cells: (TableCell | null)[] = columns.map((col, colIdx) => {
          const rawVal = rawRow[colIdx] || "";
          const align = alignments[colIdx];

          if (col.type === "currency") {
            const num = parseFloat(rawVal.replace(/[$,]/g, ""));
            return { cellType: "currency", value: isNaN(num) ? 0 : num };
          }
          if (col.type === "number") {
            const num = parseFloat(rawVal.replace(/[,%]/g, ""));
            return { cellType: "number", value: isNaN(num) ? 0 : num };
          }
          if (col.type === "date") {
            const ts = Date.parse(rawVal);
            return { cellType: "date", timestamp: isNaN(ts) ? Date.now() : ts };
          }
          if (col.type === "checkbox") {
            return { cellType: "checkbox", checked: /x|true/i.test(rawVal) };
          }
          // Default text
          return {
            cellType: "text",
            children: parseInline(rawVal),
            align: align !== "left" ? align : undefined,
          };
        });
        return { cells };
      });

      const tableBlock: TableBlock = { type: "table", columns, rows };
      blocks.push(tableBlock);
      continue;
    }

    // Heading: # H1
    if (trimmed.startsWith("# ")) {
      const block: HeadingBlock = {
        type: "heading",
        level: 1,
        children: parseInline(trimmed.slice(2)),
      };
      blocks.push(block);
      i++;
      continue;
    }
    // Heading: ## H2
    if (trimmed.startsWith("## ")) {
      const block: HeadingBlock = {
        type: "heading",
        level: 2,
        children: parseInline(trimmed.slice(3)),
      };
      blocks.push(block);
      i++;
      continue;
    }
    // Heading: ### H3
    if (trimmed.startsWith("### ")) {
      const block: HeadingBlock = {
        type: "heading",
        level: 3,
        children: parseInline(trimmed.slice(4)),
      };
      blocks.push(block);
      i++;
      continue;
    }
    // H4-H6: map to H3 (Fusebase only has 3 heading levels)
    const h4Match = trimmed.match(/^#{4,6}\s+(.+)/);
    if (h4Match) {
      const block: HeadingBlock = {
        type: "heading",
        level: 3,
        children: parseInline(h4Match[1]),
      };
      blocks.push(block);
      i++;
      continue;
    }

    // Divider: ---, ***, ___
    if (/^[-*_]{3,}\s*$/.test(trimmed)) {
      const block: DividerBlock = { type: "divider" };
      blocks.push(block);
      i++;
      continue;
    }

    // GitHub Callout: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
    const calloutMatch = trimmed.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s+(.*))?$/i);
    if (calloutMatch) {
      const typeKey = calloutMatch[1].toUpperCase();
      const colorMap: Record<string, string> = {
        NOTE: "indigo",
        TIP: "green",
        IMPORTANT: "purple",
        WARNING: "yellow",
        CAUTION: "red",
      };
      const color = colorMap[typeKey] || "indigo";
      const bodyLines: string[] = [];
      if (calloutMatch[2]?.trim()) {
        bodyLines.push(calloutMatch[2].trim());
      }
      i++;
      while (i < lines.length) {
        const nextTrim = lines[i].trimStart();
        if (nextTrim.startsWith(">")) {
          if (/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(nextTrim)) break;
          const content = nextTrim.replace(/^>\s?/, "");
          bodyLines.push(content);
          i++;
        } else {
          break;
        }
      }
      blocks.push({
        type: "hint",
        color,
        children: parseInline(bodyLines.join("\n")),
      });
      continue;
    }

    // Blockquote: > text
    if (trimmed.startsWith("> ")) {
      const block: BlockquoteBlock = {
        type: "blockquote",
        children: parseInline(trimmed.slice(2)),
      };
      blocks.push(block);
      i++;
      continue;
    }

    // Hint/callout: >> text (double greater-than for hints)
    if (trimmed.startsWith(">> ")) {
      const block: HintBlock = {
        type: "hint",
        children: parseInline(trimmed.slice(3)),
      };
      blocks.push(block);
      i++;
      continue;
    }

    // Checkbox list: - [x] or - [ ]
    if (/^[-*+]\s+\[[ xX]\]\s+/.test(trimmed)) {
      const items: { children: InlineSegment[]; checked?: boolean }[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const t = l.trimStart();
        const cbMatch = t.match(/^[-*+]\s+\[([ xX])\]\s+(.*)/);
        if (!cbMatch) break;
        items.push({
          children: parseInline(cbMatch[2]),
          checked: cbMatch[1].toLowerCase() === "x",
        });
        i++;
      }
      blocks.push({ type: "checklist", items });
      continue;
    }

    // Bullet list: - item, * item, + item
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: ListItemBlock[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const t = l.trimStart();
        const listMatch = t.match(/^[-*+]\s+(.*)/);
        if (!listMatch) break;
        const indentLevel = Math.floor(
          (l.length - l.trimStart().length) / 2,
        );
        items.push({
          children: parseInline(listMatch[1]),
          indent: indentLevel,
        });
        i++;
      }
      const block: ListBlock = { type: "list", style: "bullet", items };
      blocks.push(block);
      continue;
    }

    // Numbered list: 1. item
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: ListItemBlock[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const t = l.trimStart();
        const listMatch = t.match(/^\d+\.\s+(.*)/);
        if (!listMatch) break;
        const indentLevel = Math.floor(
          (l.length - l.trimStart().length) / 2,
        );
        items.push({
          children: parseInline(listMatch[1]),
          indent: indentLevel,
        });
        i++;
      }
      const block: ListBlock = { type: "list", style: "number", items };
      blocks.push(block);
      continue;
    }

    // Default: paragraph
    const para: ParagraphBlock = {
      type: "paragraph",
      children: parseInline(trimmed),
    };
    blocks.push(para);
    i++;
  }

  return blocks;
}
