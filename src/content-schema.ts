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

export interface InlineMention { type: "workspace" | "folder" | "note"; object_id: string; name: string; }
export interface InlineDropdown { selected: number; labels: { id: number; name: string; color: string }[]; }
export interface InlineDate { value: number; name: string; }
export interface InlineProgress { value: number | string; }

export type InlineEmbed =
  | { mention: InlineMention }
  | { "dropdown-list": InlineDropdown }
  | { date: InlineDate }
  | { progress: string | number };

/** A segment of text with optional inline formatting or an embedded interactive widget */
export interface InlineSegment {
  text?: string;
  embed?: InlineEmbed;
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

/* ------------------------------------------------------------------ */
/*  Tables                                                             */
/* ------------------------------------------------------------------ */

export type TableCellType = "text" | "singleselect" | "progress" | "checkbox" | "date";

export interface TableColumn {
  text: string;
  type: TableCellType;
  /** Configuration for single-select columns. Key is arbitrary option ID. */
  dbSelect?: Record<string, { name: string; style: string; color: string }>;
}

export interface TableCellText {
  cellType: "text";
  children: InlineSegment[];
}

export interface TableCellSelect {
  cellType: "singleselect";
  selected: string[];
}

export interface TableCellProgress {
  cellType: "progress";
  progress: number; // 0-100
}

export interface TableCellCheckbox {
  cellType: "checkbox";
  checked: boolean;
}

export interface TableCellDate {
  cellType: "date";
  timestamp: number; // MS timestamp
}

export type TableCell =
  | TableCellText
  | TableCellSelect
  | TableCellProgress
  | TableCellCheckbox
  | TableCellDate;

export interface TableRow {
  cells: TableCell[];
}

/** 
 * Y.js type: "table" -> "row" -> "tableCellX" -> child texts
 */
export interface TableBlock {
  type: "table";
  columns: TableColumn[];
  rows: TableRow[];
}

/* ------------------------------------------------------------------ */
/*  Grids (Layouts)                                                    */
/* ------------------------------------------------------------------ */

export interface GridColumnBlock {
  type: "gridCol";
  width: "auto" | string;
  children: ContentBlock[];
}

export interface GridBlock {
  type: "grid";
  columns: GridColumnBlock[];
}

/* ------------------------------------------------------------------ */
/*  Files & Media & Embeds                                             */
/* ------------------------------------------------------------------ */

export interface FileBlock {
  type: "file";
  caption?: InlineSegment[];
  /** Flag for native audio/video recording. Often indicates an uploaded file asset. */
  fileId?: string;
}

export interface RemoteFrameBlock {
  type: "remote-frame";
  src: string;
  caption?: InlineSegment[];
}

export interface UploaderBlock {
  type: "uploader";
}

/* ------------------------------------------------------------------ */
/*  Embedded Apps & Dashboards                                         */
/* ------------------------------------------------------------------ */

export interface DatabaseBlock {
  type: "foreign-dashboard";
  /** The UUID of the database within the workspace */
  databaseId: string;
  dashboardId: string;
  dashboardViewId: string;
}

export interface BoardBlock {
  type: "board";
  boardId: string;
}

export interface TasksListBlock {
  type: "tasks-list";
  tasksListId: string;
}

export interface ButtonBlock {
  type: "button-single";
  title: string;
  url: string;
}

export interface StepBlock {
  type: "step";
  children: ContentBlock[];
}

export interface ImageBlock {
  type: "image";
  src: string;
  width?: number;
  ratio?: number;
  originalSize?: { width: number; height: number };
  caption?: InlineSegment[];
}

export interface BookmarkBlock {
  type: "bookmark";
  url?: string;
}

export interface OutlineBlock {
  type: "outline";
  bordered?: boolean;
  numbered?: boolean;
  expanded?: boolean;
}

export interface StepAggregatorBlock {
  type: "step-aggregator";
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
  | CollapsibleHeadingBlock
  | TableBlock
  | GridBlock
  | FileBlock
  | RemoteFrameBlock
  | UploaderBlock
  | DatabaseBlock
  | BoardBlock
  | TasksListBlock
  | ButtonBlock
  | StepBlock
  | ImageBlock
  | BookmarkBlock
  | OutlineBlock
  | StepAggregatorBlock;
