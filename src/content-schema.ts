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

export type TableCellType =
  | "text" | "number" | "currency"
  | "checkbox" | "date"
  | "singleselect" | "multiselect"
  | "progress" | "rating"
  | "link" | "mention" | "collaborator" | "attachment";

export type NumberFormatType = "number" | "commas" | "percent";
export type CurrencyType = "dollar" | "euro" | "yen" | "yuan" | "rouble" | "pound" | "rupee" | "hryvnia" | "won" | "frank" | "real" | "other";
export type DateFormatType = "browser" | "dd/mm/yyyy" | "mm/dd/yyyy" | "yyyy/mm/dd" | "month_dd_yyyy";
export type RatingIcon = "star" | "flag" | "heart";
export type ProgressStyle = "colored" | "simple";

export interface ColumnFormat {
  /** Number cells: format type */
  type?: NumberFormatType;
  /** Currency columns: currency type */
  currency?: CurrencyType;
  /** Currency: custom symbol for "other" type */
  customSymbol?: string;
  /** Currency: symbol position */
  symbolPosition?: "before" | "after";
  /** Number/Currency: decimal separator */
  decimalSeparator?: "point" | "comma";
  /** Number/Currency: enable color numbers (negative=red) */
  colorNumbers?: boolean;
  /** Date columns: date display format */
  dateFormat?: DateFormatType;
  /** Date columns: show time */
  showTime?: boolean;
  /** Date columns: first day of week */
  firstDayOfWeek?: "sunday" | "monday";
  /** Rating columns: icon type */
  ratingIcon?: RatingIcon;
  /** Rating columns: max amount (1-10, default 5) */
  ratingAmount?: number;
  /** Progress columns: style */
  progressStyle?: ProgressStyle;
}

export interface TableColumn {
  text: string;
  type: TableCellType;
  /** Configuration for single-select or multi-select columns. Key is option ID. */
  dbSelect?: Record<string, { name: string; style: string; color: string }>;
  /** Column-level format options (number, currency, date, rating, progress) */
  format?: ColumnFormat;
}

export interface TableCellText {
  cellType: "text";
  children: InlineSegment[];
  /** Background color (e.g. "indigo", "yellow", "red") */
  color?: string;
  /** Text alignment */
  align?: "left" | "center" | "right";
}

export interface TableCellSelect {
  cellType: "singleselect" | "multiselect";
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
  timestamp: number; // MS epoch
}

export interface TableCellNumber {
  cellType: "number";
  value: number;
  /** Override column-level number format */
  format?: { type: NumberFormatType };
}

export interface TableCellCurrency {
  cellType: "currency";
  value: number;
  /** Override column-level currency format */
  format?: { currency?: CurrencyType };
}

export interface TableCellLink {
  cellType: "link";
  url: string;
  /** Display text label (different from URL) */
  text?: string;
}

export interface TableCellRating {
  cellType: "rating";
  rating: number; // 0-5
}

export interface MentionDate {
  mentionType: "date";
  /** Display name: "Now", "Today", "Tomorrow", or custom label */
  name: string;
  /** Epoch ms timestamp */
  value: number;
  /** Optional date format string */
  format?: string | null;
}

export interface MentionUser {
  mentionType: "user";
  /** Display name, e.g. "Ryan Haver" */
  name: string;
  /** Numeric user ID from workspace */
  objectId: number;
}

export interface MentionFolder {
  mentionType: "folder";
  /** Display name, e.g. "Unsorted" */
  name: string;
  /** Folder ID (e.g. "default" for Unsorted) */
  objectId: string;
  /** Workspace ID */
  workspaceId?: string;
}

export interface MentionWorkspace {
  mentionType: "workspace";
  /** Display name, e.g. "Inkabeam" */
  name: string;
  /** Workspace ID */
  objectId: string;
  /** Same as objectId for workspaces */
  workspaceId?: string;
}

export interface MentionPage {
  mentionType: "page";
  /** Page title */
  name: string;
  /** Page ID (globalId) */
  objectId: string;
  /** Workspace ID */
  workspaceId?: string;
}

export type MentionEmbed = MentionDate | MentionUser | MentionFolder | MentionWorkspace | MentionPage;

export interface TableCellMention {
  cellType: "mention";
  mention: MentionEmbed;
}

export interface TableCellCollaborator {
  cellType: "collaborator";
  // Collaborator cells reference workspace members; schema TBD for full implementation
}

export interface TableCellAttachment {
  cellType: "attachment";
  /** Attachment global ID (from uploaded file) */
  attachmentGlobalId: string;
  /** File source path (e.g. "/box/attachment/{wsId}/{attachId}/filename.png") */
  src: string;
}

export type TableCell =
  | TableCellText
  | TableCellSelect
  | TableCellProgress
  | TableCellCheckbox
  | TableCellDate
  | TableCellNumber
  | TableCellCurrency
  | TableCellLink
  | TableCellRating
  | TableCellMention
  | TableCellCollaborator
  | TableCellAttachment;

export interface TableRow {
  /** Cells in the row. null/undefined entries become empty cells. */
  cells: (TableCell | null | undefined)[];
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
