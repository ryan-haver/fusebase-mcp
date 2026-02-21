/**
 * Content Schema IR — Intermediate representation for Fusebase page content.
 *
 * This is the "source of truth" layer between human-friendly inputs
 * (markdown, structured JSON) and Fusebase's internal Y.js document format.
 *
 * Y.js type name mapping (verified via browser Y.doc dumps):
 *   paragraph       → "paragraph"
 *   heading 1       → "hLarge"
 *   heading 2       → "hMedium"
 *   heading 3       → "hSmall"
 *   bullet list     → "listItemBullet"
 *   numbered list   → "listItemNumber"
 *   checkbox list   → "listItemChecked" / "listItemUnchecked"
 *   blockquote      → "blockquote"  (all lowercase!)
 *   code            → "code"
 *   divider/line    → "hLine"  (only id + type, no characters)
 *   toggle          → "toggle" (has collapsed + children)
 *   hint/callout    → "hint"
 *   collapsible H1  → "collapsibleHLarge"
 *   collapsible H2  → "collapsibleHMedium"
 *   collapsible H3  → "collapsibleHSmall"
 *
 * Inline marks (Y.Text attributes):
 *   bold: true, italic: true, strikethrough: true, underline: true
 *   code: true, link: "https://..."
 */

/* ------------------------------------------------------------------ */
/*  Inline text segments                                               */
/* ------------------------------------------------------------------ */

/** A segment of text with optional inline formatting */
export interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  code?: boolean;
  /** Inline link URL */
  link?: string;
}

/* ------------------------------------------------------------------ */
/*  Block types                                                        */
/* ------------------------------------------------------------------ */

export interface ParagraphBlock {
  type: "paragraph";
  children: InlineSegment[];
  indent?: number;
  align?: "left" | "center" | "right";
  color?: string;
}

export interface HeadingBlock {
  type: "heading";
  /** 1 = hLarge, 2 = hMedium, 3 = hSmall */
  level: 1 | 2 | 3;
  children: InlineSegment[];
  indent?: number;
  align?: "left" | "center" | "right";
  color?: string;
}

export interface DividerBlock {
  type: "divider";
}

export interface ListItemBlock {
  children: InlineSegment[];
  indent?: number;
}

export interface ListBlock {
  type: "list";
  style: "bullet" | "number";
  items: ListItemBlock[];
}

export interface ChecklistItemBlock {
  children: InlineSegment[];
  checked?: boolean;
}

export interface ChecklistBlock {
  type: "checklist";
  items: ChecklistItemBlock[];
}

export interface BlockquoteBlock {
  type: "blockquote";
  children: InlineSegment[];
}

export interface CodeBlock {
  type: "code";
  language?: string;
  code: string;
}

/**
 * Toggle block — collapsible section with a summary line and child blocks.
 * Y.js type: "toggle" with fields: id, type, collapsed, children (block IDs), characters.
 */
export interface ToggleBlock {
  type: "toggle";
  summary: InlineSegment[];
  /** Child blocks nested inside the toggle */
  children: ContentBlock[];
  /** Whether collapsed by default */
  collapsed?: boolean;
}

/**
 * Hint/callout block — colored callout box.
 * Y.js type: "hint"
 */
export interface HintBlock {
  type: "hint";
  children: InlineSegment[];
  color?: string;
}

/**
 * Collapsible heading — heading that can toggle child blocks.
 * Y.js types: "collapsibleHLarge", "collapsibleHMedium", "collapsibleHSmall"
 */
export interface CollapsibleHeadingBlock {
  type: "collapsible-heading";
  level: 1 | 2 | 3;
  summary: InlineSegment[];
  children: ContentBlock[];
  collapsed?: boolean;
}

/** Union of all supported block types */
export type ContentBlock =
  | ParagraphBlock
  | HeadingBlock
  | DividerBlock
  | ListBlock
  | ChecklistBlock
  | BlockquoteBlock
  | CodeBlock
  | ToggleBlock
  | HintBlock
  | CollapsibleHeadingBlock;
