/**
 * Markdown Parser — Converts Markdown strings to Content Schema IR.
 *
 * Zero external dependencies. Handles the most common markdown constructs:
 * headings (H1-H3), paragraphs, bold, italic, strikethrough, inline code,
 * links, bullet lists, numbered lists, dividers, blockquotes, and code blocks.
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
} from "./content-schema.js";

/* ------------------------------------------------------------------ */
/*  Inline formatting parser                                           */
/* ------------------------------------------------------------------ */

/**
 * Parse inline markdown formatting into InlineSegment[].
 * Supports: **bold**, *italic*, ***bold+italic***, __bold__, _italic_,
 *           ~~strikethrough~~, `inline code`, [link text](url)
 */
export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let i = 0;

  while (i < text.length) {
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
      text[end] !== "["
    ) {
      end++;
    }
    segments.push({ text: text.slice(i, end) });
    i = end;
  }

  return segments;
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
    // This is a custom syntax since markdown doesn't have native callouts
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
