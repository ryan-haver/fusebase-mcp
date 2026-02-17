/**
 * Content Schema IR — Intermediate representation for Fusebase page content.
 *
 * This is the "source of truth" layer between human-friendly inputs
 * (markdown, structured JSON) and Fusebase's internal token format.
 */

/* ------------------------------------------------------------------ */
/*  Inline text segments                                               */
/* ------------------------------------------------------------------ */

/** A segment of text with optional inline formatting */
export interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Future: link URL, code, strikethrough, etc. */
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
  /** 1 = hLarge (H1), 2 = hMedium (H2) */
  level: 1 | 2;
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

/** Union of all supported block types */
export type ContentBlock =
  | ParagraphBlock
  | HeadingBlock
  | DividerBlock
  | ListBlock
  | ChecklistBlock
  | BlockquoteBlock
  | CodeBlock;
