# Y.js Binary → HTML Decoder

## Overview

**Problem:** The `get_page_content` MCP tool currently returns raw Y.js binary (`application/octet-stream`) from the `/dump/{wsId}/{noteId}` endpoint. This binary is unreadable to both users and AI agents.

**Root Cause:** Fusebase is a CRDT-first architecture. Content is stored as Y.js documents and rendered client-side by the browser's editor. There is **no server-side HTML rendering** endpoint — the `/dump/` endpoint returns the raw Y.js state directly.

**Solution:** Build a server-side Y.js binary → HTML decoder that:
1. Fetches the raw Y.js binary from `/dump/`
2. Loads it into a `Y.Doc` using `Y.applyUpdate()`
3. Walks the document structure (`root → children → blocks`)
4. Emits clean, semantic HTML

**Why this matters:** Without this, every page read via the MCP server returns gibberish. This is the #1 blocking issue for content reading.

---

## Project Type

**BACKEND** — Pure TypeScript module, no UI. Integrates into existing MCP server codebase.

---

## Success Criteria

| # | Criterion | Measurement |
|---|-----------|-------------|
| 1 | `get_page_content` returns readable HTML | Content includes `<h1>`, `<p>`, `<ul>`, etc. |
| 2 | All text content is preserved | String comparison against known page content |
| 3 | Inline formatting works | Bold → `<strong>`, Italic → `<em>` |
| 4 | Complex blocks handled gracefully | Tables/boards/tasks show placeholder with metadata instead of crashing |
| 5 | Existing MCP server doesn't break | All other tools unaffected |
| 6 | Round-trip verified | Write content → read back → content matches |

---

## Tech Stack

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| `yjs` | Y.Doc parsing | Already a dependency, same library used for writing |
| TypeScript | Implementation | Consistent with codebase |
| No new dependencies | — | `yjs` is already installed; all we need |

---

## Architecture

### Y.js Document Structure (Fusebase Schema)

```
Y.Doc
└── root (Y.Map)
    ├── children (Y.Array<string>)       ← ordered block IDs
    ├── rootChildren (Y.Array<string>)   ← same ordering
    └── blocks (Y.Map<string, Y.Map>)    ← keyed by block ID
        └── each block (Y.Map)
            ├── id (string)
            ├── type (string)            ← block type key
            ├── indent (number)
            ├── color (string)
            ├── align (string)
            ├── characters (Y.Array)     ← individual chars + format toggles
            ├── children (Y.Array)       ← for nested blocks (toggle)
            └── [type-specific props]    ← componentType, boardId, etc.
```

### Character Encoding (Inline Format)

Characters in `Y.Array` are stored as alternating format toggles and single characters:

```
[{bold: "true"}, "H", "e", "l", "l", "o", {bold: "null"}, " ", "w", "o", "r", "l", "d"]
```

- **Format ON:** `{bold: "true"}` or `{italic: "true"}`
- **Format OFF:** `{bold: "null"}` or `{italic: "null"}`
- **Regular char:** Single character string `"a"`, `"b"`, etc.

### Known Block Types (Exhaustive from codebase + live pages)

| Block Type | HTML Output | Source |
|------------|-------------|--------|
| `paragraph` | `<p>` | Writer + Browser |
| `hLarge` | `<h1>` | Writer |
| `hMedium` | `<h2>` | Writer |
| `hSmall` | `<h3>` | Writer |
| `divider` | `<hr>` | Writer |
| `code` | `<pre><code>` | Writer |
| `blockQuote` | `<blockquote>` | Writer |
| `listItemBullet` | `<li>` inside `<ul>` | Writer |
| `listItemNumber` | `<li>` inside `<ol>` | Writer |
| `listItemChecked` | `<li>` with ☑ | Writer |
| `listItemUnchecked` | `<li>` with ☐ | Writer |
| `toggle` | `<details><summary>` | Browser |
| `foreign-component` | Embed placeholder | Browser (dashboards, tables) |
| `board` | Board placeholder | Browser (kanban boards) |
| `tasks-list` | Task list placeholder | Browser (embedded tasks) |
| `table` | `<table>` | Browser (inline tables) |
| `image` | `<img>` | Browser |
| `embed` | `<iframe>` / placeholder | Browser |

> **Strategy for complex blocks:** Render a descriptive placeholder with metadata (e.g., `[Embedded Dashboard: d95acc3e-...]`) rather than crashing or silently dropping content.

---

## File Structure

```
src/
├── yjs-html-decoder.ts   [NEW]  ← Core decoder module
├── client.ts              [MODIFY] ← Update getPageContent to decode
└── index.ts               [NO CHANGE] ← MCP tool already calls client
```

---

## Task Breakdown

### Task 1: Create `yjs-html-decoder.ts` Core Module
**Agent:** `backend-specialist`
**Skills:** `clean-code`
**Priority:** P0 (foundation)
**Dependencies:** None
**Estimated Time:** 15–20 min

**INPUT:**
- Raw Y.js binary (`Uint8Array`) from `/dump/` endpoint

**OUTPUT:**
- `decodeYjsToHtml(binary: Uint8Array): string` function
- Returns semantic HTML string

**VERIFY:**
- Unit test: known binary → expected HTML
- Handles empty document gracefully (returns empty string)
- Handles unknown block types without crashing

**Implementation Details:**

```
decodeYjsToHtml(binary):
  1. Create Y.Doc
  2. Y.applyUpdate(doc, binary)
  3. Get root = doc.getMap("root")
  4. Get children = root.get("children")  ← ordered block IDs
  5. Get blocks = root.get("blocks")      ← block definitions
  6. For each blockId in children:
     a. Get block = blocks.get(blockId)
     b. Dispatch on block.get("type")
     c. Decode characters → inline HTML
     d. Emit appropriate HTML element
  7. Group adjacent list items into <ul>/<ol>
  8. Return joined HTML
```

**Sub-tasks:**

| # | Sub-task | Details |
|---|----------|---------|
| 1a | `decodeCharacters()` | Walk Y.Array, track bold/italic state, emit `<strong>`/`<em>` tags |
| 1b | `decodeBlock()` | Switch on block type, return HTML string |
| 1c | `groupListItems()` | Merge adjacent `listItemBullet`→`<ul>`, `listItemNumber`→`<ol>` |
| 1d | `handleComplexBlocks()` | foreign-component, board, tasks-list → descriptive placeholders |
| 1e | `handleIndent()` | Respect indent level for nested lists |
| 1f | `handleAlignment()` | Map `align` property to `style="text-align: ..."` |
| 1g | `handleColor()` | Map `color` property (skip if "transparent") |
| 1h | `handleToggle()` | Nested blocks → `<details><summary>` |

---

### Task 2: Integrate into `client.ts`
**Agent:** `backend-specialist`
**Skills:** `clean-code`
**Priority:** P1 (depends on Task 1)
**Dependencies:** Task 1
**Estimated Time:** 5 min

**INPUT:**
- Existing `getPageContent()` method at line 698

**OUTPUT:**
- Modified method: fetches binary, decodes to HTML, returns string

**VERIFY:**
- MCP `get_page_content` tool returns readable HTML
- No other client methods affected

**Current code:**
```typescript
async getPageContent(workspaceId: string, noteId: string): Promise<string> {
  return this.request<string>(`/dump/${workspaceId}/${noteId}`);
}
```

**New code:**
```typescript
async getPageContent(workspaceId: string, noteId: string): Promise<string> {
  const res = await fetch(`${this.baseUrl}/dump/${workspaceId}/${noteId}`, {
    headers: { cookie: this.cookie },
  });
  if (!res.ok) throw new Error(`Page content fetch failed: ${res.status}`);
  const binary = new Uint8Array(await res.arrayBuffer());
  return decodeYjsToHtml(binary);
}
```

> **Note:** We must switch from `this.request()` (which returns parsed JSON/text) to raw `fetch()` since the endpoint returns binary `application/octet-stream`.

---

### Task 3: End-to-End Verification Script
**Agent:** `backend-specialist`
**Skills:** `testing-patterns`
**Priority:** P2 (depends on Task 2)
**Dependencies:** Task 1, Task 2
**Estimated Time:** 10 min

**INPUT:**
- MCP `get_page_content` tool
- Known browser-created page ID (`1tZiv20EWydrHyaB`)
- Freshly written page via `writeContentViaWebSocket`

**OUTPUT:**
- Test script that verifies round-trip: write → read → compare

**VERIFY:**
- Browser-created page returns recognizable HTML with block types
- Written page returns HTML containing our test content
- No uncaught errors or crashes

---

### Task 4: Round-Trip Integration Test
**Agent:** `backend-specialist`
**Skills:** `testing-patterns`
**Priority:** P3 (depends on Task 3)
**Dependencies:** All above
**Estimated Time:** 10 min

**INPUT:**
- Write blocks via `writeContentViaWebSocket`
- Read back via `client.getPageContent()`

**OUTPUT:**
- Script that writes structured content, reads it back, validates HTML output

**VERIFY:**
- Heading text appears inside `<h1>` tags
- Paragraph text appears inside `<p>` tags
- Bold text wrapped in `<strong>`
- Italic text wrapped in `<em>`
- Divider produces `<hr>`
- Lists produce `<ul>`/`<ol>` with `<li>` items

---

## Edge Cases & Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Unknown block type in production | Render as `<!-- unknown block: {type} -->` with raw text if available |
| Empty document | Return empty string, not error |
| Binary fetch fails (auth) | Preserve existing error handling from `request()` |
| Y.js update format mismatch | Try V1 first (`applyUpdate`), fall back to V2 (`applyUpdateV2`) |
| Deeply nested toggles | Recursion with depth limit (max 10 levels) |
| Large pages (100KB+ binary) | Y.js handles efficiently; no special handling needed |
| `characters` is empty | Output empty `<p></p>` (matches browser behavior) |
| Adjacent list items of different types | Close current list, open new one |

---

## Phase X: Verification Checklist

- [ ] `yjs-html-decoder.ts` created with all block types
- [ ] `client.ts` updated to use decoder
- [ ] `get_page_content` returns readable HTML for browser-created pages
- [ ] `get_page_content` returns readable HTML for freshly written pages
- [ ] Bold/italic formatting preserved in output
- [ ] Lists correctly grouped into `<ul>`/`<ol>`
- [ ] Complex blocks (foreign-component, board) show placeholder text
- [ ] Empty pages return empty string without errors
- [ ] No existing MCP tools broken (quick smoke test)
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
