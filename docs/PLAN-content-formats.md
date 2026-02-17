# Comprehensive Content Format Coverage Plan

> Implement full support for **all Fusebase page block types** in the content schema, Y.js WebSocket writer, markdown parser, and MCP tools.

## Current State

### Implemented Block Types (7 of 30+)

| # | Block Type | Y.js Type | Schema | Writer | Parser |
|---|---|---|---|---|---|
| 1 | Heading H1 | `hLarge` | ✅ | ✅ | ✅ |
| 2 | Heading H2 | `hMedium` | ✅ | ✅ | ✅ |
| 3 | Paragraph | `paragraph` | ✅ | ✅ | ✅ |
| 4 | Bullet List | `listItemBullet` | ✅ | ✅ | ✅ |
| 5 | Numbered List | `listItemNumber` | ✅ | ✅ | ✅ |
| 6 | Checklist | `listItemChecked/Unchecked` | ✅ | ✅ | ❌ |
| 7 | Line / Divider | `divider` | ✅ | ✅ | ✅ |
| 8 | Quote / Blockquote | `blockQuote` | ✅ | ✅ | ✅ |
| 9 | Code Block | `code` | ✅ | ✅ | ✅ |

### Implemented Inline Formats (2 of ~7)

| Format | Schema | Writer | Parser |
|---|---|---|---|
| **Bold** | ✅ | ✅ | ✅ |
| **Italic** | ✅ | ✅ | ✅ |

---

## Complete Gap Analysis — Every Block Type from Editor Menu

> Derived from all 4 Fusebase editor screenshots. Every item is accounted for.

### ❌ Missing Block Types

| # | Block Type | Menu Section | Y.js Type (estimated) | Notes |
|---|---|---|---|---|
| 1 | **Heading H3** | BASIC | `hSmall` | Writer has partial `hSmall` case but schema only allows `level: 1\|2` |
| 2 | **Table** | BASIC | `table` / nested Y.Maps | Rows × columns of cells with inline content |
| 3 | **Toggle Block** | BASIC | `toggleBlock` | Collapsible section with title + child blocks |
| 4 | **Link (standalone block)** | BASIC | `bookmark` / `linkBlock` | URL preview card — different from inline `[text](url)` |
| 5 | **File** | BASIC | `file` / `fileBlock` | File attachment rendered as a download card |
| 6 | **Outline** | BASIC | `outline` | Auto-generated table of contents |
| 7 | **Task List (inline)** | ADVANCED | `taskList` | Inline task widget (not the standalone Kanban board) |
| 8 | **Steps** | ADVANCED | `steps` | Sequential numbered step blocks |
| 9 | **Step Outliner** | SUGGESTIONS | `stepOutliner` | Different from Steps — visual step outline |
| 10 | **Hint** | ADVANCED | `hint` / `callout` | Colored admonition/callout box (info/warning/success/error) |
| 11 | **Progress** | ADVANCED | `progress` | Progress bar (0-100%) |
| 12 | **Dropdown List** | ADVANCED | `dropdownList` | Collapsible list of items with toggle |
| 13 | **Collapsible Medium Heading** | OTHER | `hMediumToggle` | H2-like heading that collapses content below it |
| 14 | **Link Page / Create** | OTHER | `linkPage` | Internal page reference block (embed/link to another Fusebase page) |
| 15 | **Image** | TOOLBAR | `image` | Image block (upload or URL) |
| 16 | **File Uploader** | SUGGESTIONS | `fileUpload` | May be same as File block but via upload dialog |
| 17 | **Embed (Link/iFrame/JS Code)** | INTEGRATIONS | `embed` | URL preview, iframe, or custom JS embed |
| 18 | **Figma Embed** | INTEGRATIONS | `embed` (figma subtype) | Figma-specific integration |
| 19 | **Miro Embed** | INTEGRATIONS | `embed` (miro subtype) | Miro-specific integration |
| 20 | **2 Columns** | VIEWS | `columns` | Side-by-side container layout |
| 21 | **Audio Record** | OTHER | `audioRecord` | Recorded audio widget |
| 22 | **Video Record** | OTHER | `videoRecord` | Recorded video widget |
| 23 | **Database** | SUGGESTIONS | `database` | Full database/table view widget |
| 24 | **Kanban / Task Board** | ADVANCED | `kanban` | Interactive kanban board |

### ❌ Missing Inline Formats

| # | Format | Toggle Key (estimated) | Notes |
|---|---|---|---|
| 1 | **Link** | `link` attribute | `{link: "url"}` before, `{link: null}` after |
| 2 | **Inline Code** | `code` attribute | `{code: "true"}` toggle |
| 3 | **Strikethrough** | `strikethrough` | `{strikethrough: "true"}` toggle |
| 4 | **Underline** | `underline` | `{underline: "true"}` toggle |
| 5 | **Highlight / BG Color** | `highlight` | Inline background color |

---

## Five-Phase Implementation Plan

### Phase 1 — Quick Wins: Inline Formats + H3 + Checklist Parsing

> **Effort**: Small · **Value**: 🔴 Very High  
> Extends existing patterns — no reverse engineering needed.

| Item | File | Change |
|---|---|---|
| **H3 heading** | `content-schema.ts` | Add `level: 3` to `HeadingBlock` |
| **Inline link** | `content-schema.ts` | Add `link?: string` to `InlineSegment` |
| **Inline code** | `content-schema.ts` | Add `code?: boolean` to `InlineSegment` |
| **Strikethrough** | `content-schema.ts` | Add `strikethrough?: boolean` to `InlineSegment` |
| **Underline** | `content-schema.ts` | Add `underline?: boolean` to `InlineSegment` |
| **Highlight** | `content-schema.ts` | Add `highlight?: string` to `InlineSegment` |
| All above toggles | `yjs-ws-writer.ts` | Add toggle pairs in `addInlineChars()` |
| H3 parsing (`###`) | `markdown-parser.ts` | Map `###` → `level: 3` instead of H2 fallback |
| `~~text~~` | `markdown-parser.ts` | Parse strikethrough |
| `` `text` `` inline | `markdown-parser.ts` | Parse inline code |
| `[text](url)` | `markdown-parser.ts` | Parse inline links |
| `- [ ]` / `- [x]` | `markdown-parser.ts` | Parse checkbox/checklist items |

**Files modified**: [content-schema.ts](file:///c:/scripts/fusebase-mcp/src/content-schema.ts), [yjs-ws-writer.ts](file:///c:/scripts/fusebase-mcp/src/yjs-ws-writer.ts), [markdown-parser.ts](file:///c:/scripts/fusebase-mcp/src/markdown-parser.ts)

---

### Phase 2 — Core Text Blocks (Reverse Engineering Required)

> **Effort**: Medium · **Value**: 🔴 High  
> Requires Y.js structure capture from browser for each new type.

**Prerequisite**: Create [scripts/capture-block-types.ts](file:///c:/scripts/fusebase-mcp/scripts/capture-block-types.ts) — a script that reads Y.js binary state for manually-created blocks to discover internal structure.

| Item | Y.js Type | Priority | Rationale |
|---|---|---|---|
| **Table** | `table` + nested rows/cells | 🔴 High | Core BASIC block, high-value for structured data |
| **Hint / Callout** | `hint` | 🔴 High | Common in documentation and notes |
| **Toggle Block** | `toggleBlock` | 🔴 High | BASIC block, collapsible sections |
| **Collapsible Medium Heading** | `hMediumToggle` | 🟡 Medium | Collapsible H2 variant |
| **Link (standalone block)** | `linkBlock` / `bookmark` | 🟡 Medium | BASIC block, URL preview card |
| **Outline (TOC)** | `outline` | 🟡 Medium | Auto table of contents |
| **Steps** | `steps` | 🟡 Medium | Sequential step indicator |
| **Step Outliner** | `stepOutliner` | 🟡 Medium | Visual hierarchical step outline |
| **Progress** | `progress` | 🟢 Low | Progress bar widget |
| **Dropdown List** | `dropdownList` | 🟢 Low | Collapsible list toggle |
| **Task List (inline)** | `taskList` | 🟢 Low | Inline task widget — lightweight version of Kanban |

**Files modified**: [content-schema.ts](file:///c:/scripts/fusebase-mcp/src/content-schema.ts), [yjs-ws-writer.ts](file:///c:/scripts/fusebase-mcp/src/yjs-ws-writer.ts), [markdown-parser.ts](file:///c:/scripts/fusebase-mcp/src/markdown-parser.ts)

**New interfaces** (exact shapes confirmed during reverse engineering):

```typescript
TableBlock         // type: "table", headers: cells[][], rows: cells[][]
HintBlock          // type: "hint", style: info|warning|success|error, children: segments
ToggleBlock        // type: "toggle", title: segments, children: blocks[]
CollapsibleHeading // type: "collapsibleHeading", children: segments
LinkBlock          // type: "linkBlock", url: string, title?: string, description?: string
OutlineBlock       // type: "outline"
StepsBlock         // type: "steps", items: { children: segments }[]
StepOutlinerBlock  // type: "stepOutliner", items: { children: segments }[]
ProgressBlock      // type: "progress", value: number
DropdownBlock      // type: "dropdown", title: segments, children: blocks[]
TaskListBlock      // type: "taskList", items: { text, checked, assignee? }[]
```

---

### Phase 3 — Media, Files & Embeds

> **Effort**: Medium-High · **Value**: 🟡 Medium  
> Requires discovering the file upload REST API, plus how uploaded assets are referenced in Y.js.

**Prerequisite**: Discover the file/image upload endpoint (likely in the API discovery data or by HAR capture).

| Item | Mechanism | Priority | Notes |
|---|---|---|---|
| **Image** | Upload API → Y.js reference | 🔴 High | Images are core content; toolbar has dedicated button |
| **File** | Upload API → Y.js reference | 🔴 High | BASIC block type; download card |
| **File Uploader** | Same as File but via upload dialog | — | Likely same Y.js block as File |
| **Link Page / Create** | Y.js + page ID reference | 🟡 Medium | Internal cross-page link |
| **Embed (Link/iFrame/JS)** | Y.js + URL/code metadata | 🟡 Medium | Generic embed container |
| **Figma Embed** | Embed subtype with Figma URL | 🟢 Low | Specialized integration |
| **Miro Embed** | Embed subtype with Miro URL | 🟢 Low | Specialized integration |
| **Audio Record** | Upload API → audio player widget | 🟢 Low | Recorded audio embed |
| **Video Record** | Upload API → video player widget | 🟢 Low | Recorded video embed |

**New files**:
- [src/file-uploader.ts](file:///c:/scripts/fusebase-mcp/src/file-uploader.ts) — REST upload client for images/files

**New interfaces**:

```typescript
ImageBlock     // type: "image", url|path: string, caption?: string, width?: number
FileBlock      // type: "file", url|path: string, filename: string, size?: number
LinkPageBlock  // type: "linkPage", pageId: string, title?: string
EmbedBlock     // type: "embed", url: string, embedType: "link"|"iframe"|"figma"|"miro"|"js"
AudioBlock     // type: "audio", url: string
VideoBlock     // type: "video", url: string
```

---

### Phase 4 — MCP Tool Updates & Documentation

> **Effort**: Small · **Value**: 🟡 Medium  
> Wire up all new types to the MCP interface and update documentation.

| Item | File | Change |
|---|---|---|
| Update `update_page_content` tool schema | `index.ts` | Document all block types in tool description + input schema |
| Add `list_content_types` tool | `index.ts` | New tool that returns all supported block types and their schemas |
| Update Y.js write tool | `index.ts` | Ensure the MCP tool accepts the full `ContentBlock` union |
| Update architecture diagram | `SKILL.md` | Add content-schema.ts, yjs-ws-writer.ts, markdown-parser.ts, file-uploader.ts |
| Document all block types | `SKILL.md` | New "Content Block Types" section with usage examples |
| Update markdown cheat sheet | `SKILL.md` | Document supported markdown → block mappings |

---

### Phase 5 — Layout & Complex Widgets (Stretch)

> **Effort**: High · **Value**: 🟢 Low  
> Structural/interactive widgets. These need deep Y.js nesting or are full app features.

| Item | Complexity | Priority | Notes |
|---|---|---|---|
| **2 Columns** | High | 🟡 Medium | Container layout — nested blocks in columns |
| **Database** | Very High | 🟢 Low | Full DB view widget — already has `get_database_data` MCP tool |
| **Kanban / Task Board** | Very High | 🟢 Low | Interactive board — already has task MCP tools |

> [!NOTE]
> Database and Kanban are **interactive application widgets**, not simple content blocks. They already have dedicated MCP tools (`get_database_data`, `list_task_lists`, `create_task`). They should be created through their existing MCP tools, not the content writer. Only 2 Columns is a true content layout block.

---

## Complete Block Type Coverage Matrix

> Every single item from the Fusebase editor menu, mapped to a phase.

| # | Block/Format Type | Menu Location | Phase | Status |
|---|---|---|---|---|
| 1 | Heading H1 | BASIC | — | ✅ Done |
| 2 | Heading H2 | BASIC | — | ✅ Done |
| 3 | **Heading H3** | BASIC | **Phase 1** | ❌ |
| 4 | Paragraph | — | — | ✅ Done |
| 5 | Bullet List | BASIC | — | ✅ Done |
| 6 | Numbered List | BASIC | — | ✅ Done |
| 7 | Checkbox List | BASIC | — | ✅ Done |
| 8 | Line / Divider | BASIC | — | ✅ Done |
| 9 | Quote / Blockquote | ADVANCED | — | ✅ Done |
| 10 | Code Block | ADVANCED | — | ✅ Done |
| 11 | **Bold** (inline) | Toolbar | — | ✅ Done |
| 12 | **Italic** (inline) | Toolbar | — | ✅ Done |
| 13 | **Inline Link** | Toolbar | **Phase 1** | ❌ |
| 14 | **Inline Code** | Toolbar | **Phase 1** | ❌ |
| 15 | **Strikethrough** | Toolbar | **Phase 1** | ❌ |
| 16 | **Underline** | Toolbar | **Phase 1** | ❌ |
| 17 | **Highlight/BG Color** | Toolbar | **Phase 1** | ❌ |
| 18 | **Table** | BASIC | **Phase 2** | ❌ |
| 19 | **Toggle Block** | BASIC | **Phase 2** | ❌ |
| 20 | **Link (standalone)** | BASIC | **Phase 2** | ❌ |
| 21 | **Outline (TOC)** | BASIC | **Phase 2** | ❌ |
| 22 | **Hint / Callout** | ADVANCED | **Phase 2** | ❌ |
| 23 | **Steps** | ADVANCED | **Phase 2** | ❌ |
| 24 | **Step Outliner** | SUGGESTIONS | **Phase 2** | ❌ |
| 25 | **Collapsible Medium Heading** | OTHER | **Phase 2** | ❌ |
| 26 | **Progress** | ADVANCED | **Phase 2** | ❌ |
| 27 | **Dropdown List** | ADVANCED | **Phase 2** | ❌ |
| 28 | **Task List (inline)** | ADVANCED | **Phase 2** | ❌ |
| 29 | **Image** | TOOLBAR | **Phase 3** | ❌ |
| 30 | **File / File Uploader** | BASIC + SUGGESTIONS | **Phase 3** | ❌ |
| 31 | **Link Page / Create** | OTHER | **Phase 3** | ❌ |
| 32 | **Embed (Link/iFrame/JS)** | INTEGRATIONS | **Phase 3** | ❌ |
| 33 | **Figma Embed** | INTEGRATIONS | **Phase 3** | ❌ |
| 34 | **Miro Embed** | INTEGRATIONS | **Phase 3** | ❌ |
| 35 | **Audio Record** | OTHER | **Phase 3** | ❌ |
| 36 | **Video Record** | OTHER | **Phase 3** | ❌ |
| 37 | **2 Columns Layout** | VIEWS | **Phase 5** | ❌ |
| 38 | **Database** | SUGGESTIONS | **Phase 5** | ⚠️ Existing MCP tools |
| 39 | **Kanban / Task Board** | ADVANCED | **Phase 5** | ⚠️ Existing MCP tools |
| — | Checklist parsing | — | **Phase 1** | ❌ Parser only |
| — | Use Fusebase AI | SUGGESTIONS | N/A | UI action, not content block |

**Total: 39 items · 9 done · 28 to implement · 2 existing tools**

---

## Verification Plan

### Per-Phase Verification
1. **Phase 1**: Write test page with H3, inline code, links, strikethrough, underline. Verify in browser. Unit test markdown parser for new constructs.
2. **Phase 2**: For each new block type, use capture script to confirm Y.js structure, then write a test page and verify rendering.
3. **Phase 3**: Upload test image/file, embed on page, verify rendering. Test Figma/Miro embed URLs.
4. **Phase 4**: Verify MCP tool accepts all block types. Test via `create_page` → `update_page_content` workflow.
5. **Phase 5**: Write 2-column layout, verify rendering.

### Full Coverage Test
- Create a single **"Format Showcase"** page containing every implemented block type
- Capture browser screenshot as visual proof
- Add `npm test` suite for schema validation + parser unit tests

---

## Risks & Dependencies

> [!IMPORTANT]
> **Reverse engineering** is required for Phase 2 and Phase 3. For each unknown block type, we must:
> 1. Manually create the block in the Fusebase browser editor
> 2. Connect via WebSocket and capture the Y.js binary state
> 3. Decode the structure to build correct writer code

> [!WARNING]
> **Table** is likely the most complex single item. Tables in Y.js editors use deeply nested structures (table → rows → cells → characters). Budget extra time for this.

> [!NOTE]
> **File uploads** (Phase 3) require discovering the REST upload endpoint. This may already be in our API discovery data or require a new HAR capture session.
