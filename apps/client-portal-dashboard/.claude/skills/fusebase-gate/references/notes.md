---
version: "1.11.0"
mcp_prompt: notes
last_synced: "2026-09-29"
title: "Fusebase Gate Notes Operations"
category: specialized
---
# Fusebase Gate Notes Operations

> **MARKER**: `mcp-notes-loaded` — When this marker is present in context, MCP prompts for this topic may skip conceptual sections and use API reference only.

> **VERSION CHECK**: If operations fail unexpectedly, load MCP prompt `notes` for latest content.

---
## Table of contents

- [Fusebase Gate Notes Operations](#fusebase-gate-notes-operations)
- [Relevant Operations](#relevant-operations)
- [Identity And Scoping Rules](#identity-and-scoping-rules)
- [Read Flow Rules](#read-flow-rules)
- [Create Flow Rules](#create-flow-rules)
- [Append Flow Rules](#append-flow-rules)
- [Attachment Flow Rules](#attachment-flow-rules)
- [Access Model](#access-model)
- [Markdown (v3) Note Rules](#markdown-v3-note-rules)
- [Markdown (v3) Share Rules](#markdown-v3-share-rules)
- [Directive Widgets (markdown-native UI)](#directive-widgets-markdown-native-ui)
- [Working Rules](#working-rules)

---
## Fusebase Gate Notes Operations

These operations manage workspace note folders, workspace notes, note reads, note creation, append-only note content updates, and stored-file attachment flows exposed by Gate.

## Relevant Operations

- listWorkspaceNoteFolders lists visible non-portal note folders for a workspace.
- listWorkspaceNotes lists visible non-portal notes for a workspace folder.
- searchWorkspaceNotes finds v2 and v3 notes by words in their title or text and returns matching note ids with snippets.
- getWorkspaceNote returns one workspace note together with markdown content.
- createWorkspaceNoteFolder creates a workspace note folder.
- createWorkspaceNote creates a workspace note and can optionally append initial content after creation.
- appendWorkspaceNoteContent appends text or html to the end of an existing workspace note without replacing existing content.
- addWorkspaceNoteAttachment attaches a `storedFileUUID` to a workspace note and appends the matching editor blot.
- createWorkspaceMarkdownNote creates a v3 note whose source of truth is markdown stored in note-service.
- getWorkspaceMarkdownNote reads a v3 note's markdown and current `revision`.
- updateWorkspaceMarkdownNoteContent replaces the whole markdown document of a v3 note using an optimistic `revision` lock.
- appendWorkspaceMarkdownNoteContent appends markdown to a v3 note with an optional `revision` lock.
- addWorkspaceMarkdownNoteAttachment attaches a `storedFileUUID` to a v3 note and appends the matching markdown image or link.

## Identity And Scoping Rules

- Treat `orgId` and `workspaceId` as required path inputs for every notes operation.
- Treat `workspaceId`, `parentId`, and `noteId` as opaque ids. Reuse values returned by previous responses instead of inventing them.
- When a user says "default workspace", interpret that as the organization's default workspace id, not the literal string `default`.
- For notes operations, call `listWorkspaces`, find the workspace with `isDefault: true`, and use its real `id` value.
- Gate accepts the literal path alias `workspaceId: "default"` as a compatibility fallback, but do not choose it when you can discover the real workspace id.
- When `parentId` is omitted for list or create flows, Gate defaults to the workspace root folder id `default`.

## Read Flow Rules

- Use `listWorkspaceNoteFolders` before browsing nested folders when the caller does not already know a folder id.
- `listWorkspaceNotes` returns notes for one parent folder at a time. Omit `parentId` to read the root folder.
- `getWorkspaceNote` is the operation that returns note body content through `note.md`.
- Workspace attachment image links inside `note.md` remain editor attachment paths; use the files completion `readUrl` when you need the public object URL.
- Portal-shared and trashed notes are filtered out from these workspace note list operations.
- To find a note by its content, call `searchWorkspaceNotes` with `query` (optional `parentId` to search one folder subtree, `limit` up to 100). It is keyword full-text search, not semantic: pass the distinctive words, not a question.
- Each search hit has `contentVersion`: read `v2` hits with `getWorkspaceNote` and `markdown_v3` hits with `getWorkspaceMarkdownNote`. v3 hits appear only when the token also holds `notes.markdown.read`.

## Create Flow Rules

- `createWorkspaceNoteFolder` requires a non-empty `title` and optionally accepts `parentId`.
- `createWorkspaceNote` requires a non-empty `title` and optionally accepts `parentId`, `content`, and `format`.
- `format` is only valid when `content` is provided.
- `format` defaults to `text`, which stores content literally. Markdown syntax (`#`, `**`, `>`) sent as `text` appears as raw characters in the editor.
- When initial note content comes from Markdown, convert Markdown to HTML app-side and call `createWorkspaceNote` with `format: html`.
- Use `format: text` only for plain text where literal Markdown characters are intended.
- `createWorkspaceNote` returns note summary metadata, not the final note body. Call `getWorkspaceNote` afterward when you need the resulting markdown.

## Append Flow Rules

- `appendWorkspaceNoteContent` requires a known `noteId` and non-empty `content`.
- It always appends to the end of the existing note. Do not use it for replacement or full-document editing.
- `format` defaults to `text`, which stores content literally. Markdown syntax (`#`, `**`, `>`) sent as `text` appears as raw characters in the editor.
- Gate reads note bodies as markdown via `getWorkspaceNote`, but editor-server append writes currently accept text or html, not a dedicated md body.
- For Markdown input, convert Markdown to HTML in the app and call `appendWorkspaceNoteContent` with `format: html`. Do not send user-authored Markdown as `format: text` unless raw Markdown characters are the desired output.
- Editor fidelity is not 1:1: headings, bold, italic, inline code, ordered/unordered lists, and links survive normal HTML paste; markdown blockquotes (`>`, rendered as `<blockquote>`) can degrade to plain paragraphs because of editor limitations.
- `appendWorkspaceNoteContent` returns the refreshed note metadata and `note.md` after the append.

## Attachment Flow Rules

- Upload files with the files operations first. Complete the upload and use the returned `storedFileUUID` for attachment creation. In Gate file responses this is file-service `storedFile.uuid` exposed as `storedFileUUID`; `fileId` is only an alias. Use the completion `readUrl` for direct file reads or image `src`.
- `addWorkspaceNoteAttachment` creates the note-service attachment and then appends an editor blot. It is v2-only — for a v3 markdown note use `addWorkspaceMarkdownNoteAttachment`, which never touches the editor document.
- Image attachments are inserted as `image` blots. All other attachment types are inserted as `file` blots.
- The operation returns attachment metadata, not the full note body. Call `getWorkspaceNote` when you need refreshed markdown.

## Access Model

- Classic (v2) note reads require `notes.read` and org access.
- Classic (v2) note creation, content append, and attachment writes require `notes.write` and org access.
- Markdown (v3) note reads require `notes.markdown.read` and org access.
- Markdown (v3) note creation, content replacement, content append, and attachment writes require `notes.markdown.write` and org access.
- Markdown (v3) note operations also require the Gate env feature flag `notes_markdown`; when it is off, the operations fail closed.
- Sharing a markdown (v3) note requires `notes.share.manage`, which is deliberately separate from `notes.markdown.read`/`notes.markdown.write`: a token that may edit a note cannot publish it. Sharing also requires the env feature flag `notes_markdown_share` on top of `notes_markdown`.
- Tokens that only have `notes.read`/`notes.write` must use the classic (v2) note operations.
- If note-service or editor-server writes fail, verify caller permissions and workspace scope before assuming a schema mismatch.

## Markdown (v3) Note Rules

- Markdown ops only work on notes created with `createWorkspaceMarkdownNote`. Classic (v2) notes keep using `getWorkspaceNote`, `createWorkspaceNote`, and `appendWorkspaceNoteContent`.
- Markdown is stored literally as the source of truth; no HTML conversion is needed or supported on these ops. Send real markdown, not HTML.
- Every markdown response includes `note.revision`. Save it: `updateWorkspaceMarkdownNoteContent` requires the last-read `revision`, and `appendWorkspaceMarkdownNoteContent` accepts it optionally.
- On HTTP 409 (`apiData.errorCode` = markdown_note_revision_conflict) the stored content changed since your read. Re-read with `getWorkspaceMarkdownNote` (or use `apiData.currentRevision`), reconcile, and retry the write.
- Use update for full-document rewrites and append for adding to the end; do not emulate append by rewriting the whole document.
- Attach files with `addWorkspaceMarkdownNoteAttachment`; it appends the markdown itself and returns the canonical attachment `url` plus the appended `markdown` snippet, so never hand-build the link format. To place the attachment somewhere other than the end, take that `url` and rewrite the document with `updateWorkspaceMarkdownNoteContent` using the returned `note.revision`.

## Markdown (v3) Share Rules

- `shareWorkspaceMarkdownNote` publishes a v3 markdown note and returns `share.urls`: `ui` (full share page), `rendered` (markdown only, no Fusebase chrome) and `raw` (the markdown source as `text/markdown`). Hand out those URLs as returned; do not assemble share links yourself.
- `accessControl` decides who may open the link: `public` (anyone with the link, the default), `workspace` (workspace members) or `org` (organization members). `password` adds a password prompt; both are stored and enforced by note-service.
- Sharing again on an already shared note updates that same share — it never creates a second link. Omitting `password` on that call clears an existing password.
- `unshareWorkspaceMarkdownNote` revokes the share. Re-sharing later revives the same link, so treat a revoked URL as dormant, not destroyed.
- v2 notes are rejected by these ops (HTTP 404); their sharing is unchanged and lives outside the markdown operations.

## Directive Widgets (markdown-native UI)

Fusebase v3 notes may contain remark leaf/container directives that the Notes UI renders as widgets. Prefer these over inventing HTML or JSON blobs. The markdown string is the only widget state — there is no separate widget API.

**Scope:** widgets render only in v3 markdown notes. Write them with `createWorkspaceMarkdownNote`, `updateWorkspaceMarkdownNoteContent`, or `appendWorkspaceMarkdownNoteContent`. Never use classic v2 `createWorkspaceNote` / `appendWorkspaceNoteContent` (HTML) for widgets.

**How to edit:** `getWorkspaceMarkdownNote` → change the directive line's `[label]` and `{attrs}` in the markdown → `updateWorkspaceMarkdownNoteContent` with the last-read `revision`. To add widgets at the end of a note, append the directive lines with `appendWorkspaceMarkdownNoteContent`.

**Pick the right widget:**
- `::progress` — filled share toward a goal (`value` / `max`).
- `::rating` — discrete score (stars / hearts / thumbs).
- `::stat` — a single metric number with optional `unit`, `delta` and `hint`.
- `:::stats` — a row of 2–4 `::stat`s side by side.
- `::kv` — one label → value metadata row (owner, region, SLA); the value is free text, not a metric.
- `:badge` — short status chip with a tone; it is inline, so several fit on one line with ordinary text.
- `:avatar` — a decorative initials circle; inline, so several fit in a byline.
- `::person` — a decorative row: initials circle, name, optional role.
- `::divider` — labelled section rule (`::divider[After M8]`); use it to break a long note into phases. It is chrome, not a heading: it adds no outline entry and holds no body. A plain `---` thematic break still works and is the right choice when the break needs no label.
- `::check` — one checklist row whose state is the `done` attribute; `:::checklist` groups rows under a title.
- `:::collapse` — hide secondary markdown behind a title.
- `:::quote` — a pull quote attributed to a person (`[Author]` plus an optional `role`).
- `:::steps` — ordered stages with a status each (a plan, an onboarding, a rollout). Prefer it over `::progress` when the stages have names, and over a checklist when their order matters; `::progress` stays the choice for a single percentage.
- `:::dl` — group several `::kv` rows under an optional title.
- `::::tabs` — panes behind a strip of names, for a note that says the same thing several ways (one pane per environment, per plan, per platform). Note the **four** colons on the container: a container inside a container needs the longer fence.

Syntax (put each leaf directive on its own line; badge is inline and goes inside a paragraph; container = `:::name[title]` … `:::`):

    ::progress[Label]{value=0 max=100 color="auto|<tone>" thickness="thin|medium|thick"}
    ::rating[Label]{value=1 max=5 icon="star|heart|thumbsUp"}
    ::stat[Label]{value=0 unit="/wk" delta="+1" hint="last 7d"}
    ::divider[Label]{tone="<tone>"}
    ::kv[Key]{value="free text"}
    :badge[Label]{tone="<tone>"} :badge[Another]{tone="info"} and text on the same line
    Reviewed by :avatar[AB]{tone="<tone>" size="sm|md"} :avatar[CD]{tone="violet"} this week
    ::person[Full name]{role="Owner" initials="AB" tone="<tone>" size="sm|md"}
    ::check[Label]{done=true}

    :::checklist[Title]
    ::check[API freeze]{done=true}
    ::check[Runbook]{done=false}
    :::

    :::stats
    ::stat[Open bugs]{value=3}
    ::stat[P95]{value=120 unit="ms" delta="-8%"}
    :::

    :::collapse[Title]
    Hidden markdown body (lists, code, nested markdown OK).
    :::

    :::quote[Alex Rivera]{role="Founder"}
    We ship the note as the source of truth.
    :::

    :::steps{orientation="vertical|horizontal"}
    ::step[Design]{status="done"}
    ::step[Build]{status="current"}
    ::step[Ship]{status="todo"}
    :::

    ::::tabs
    :::tab[Overview]
    Any block markdown; each pane's content is its own.
    :::

    :::tab[Details]
    Second pane.
    :::
    ::::

    :::dl[Service meta]
    ::kv[Owner]{value="Dmitriy"}
    ::kv[On-call]{value="#platform"}
    :::

- `[Label]` / `[Title]` is human-readable text stored in the directive itself; keep it short. For collapse, set the title only via markdown (the UI does not edit the summary).
- Keep `value` and `max` numeric. Omit attrs you do not need — do not write empty values like `unit=""`.
- Quoted and unquoted attrs both parse (`{value=72}` and `{value="72"}`); the editor may rewrite them with quotes on save.
- A `<tone>` is one of the semantic tones `neutral|info|success|warning|danger` or one of the hues `slate|cyan|teal|blue|indigo|violet|pink|orange|amber|lime` (NIM-43310). The same vocabulary serves badge `tone` and progress `color`; there are no free-text hex colours.
- Defaults when an attr is omitted: progress `max=100`, `color`→neutral, `thickness`→medium; rating `max=5`, `icon`→star; badge `tone`→neutral; divider `tone`→neutral; avatar/person `tone`→neutral, `size`→sm. A rating `max` is capped at 10 in the UI.
- Divider vs `---` vs headings: use `::divider[Label]` when the break carries a short caption (`After M8`, `QA sign-off`), `---` when a bare rule is enough, and a heading (`## …`) when the section needs a title in the document outline. A divider with an empty label renders as a plain rule, so prefer `---` in that case.
- stat `unit`, `delta` and `hint` are free text; `value` is what the widget paints big, so write a number. `delta` reads as up when it starts with `+` and down when it starts with `-`; anything else is neutral. `hint` is a small subtitle under the number, e.g. the period the number covers.
- `::stat` was called `::kpi` and its `delta` was called `trend` (NIM-43325). Both old spellings still open — a `trend` attr is read as `delta` — and the editor rewrites them to `::stat`/`delta` on the next save. Write the new form.
- `:::stats` wraps 2–4 `::stat` lines and lays them out in a row that stacks on narrow screens. Put only `::stat` lines in it; other markdown inside is kept but takes a cell of the row, which rarely reads well. A single metric needs no `:::stats` wrapper.
- Prefer writing attrs the UI understands; unknown attrs still round-trip, and an unknown tone/colour/icon/thickness falls back to the default above instead of breaking the note.
- Do not convert these widgets to HTML; send the directive forms above in markdown ops only.
- `color="auto"` on progress picks danger (<34%), warning (<67%), or success from the filled percentage.
- Collapse open/closed is editor UI state only — it is not written to markdown and resets on reload.
- Steps: `:::steps` accepts only `::step` lines between its fences — no paragraphs, no nested containers; anything else there is dropped when the note opens. A step `status` is `done|current|todo` (default `todo`), and `orientation` is `vertical` (default) or `horizontal`. Write the stages in the order they happen; there is no `index` attribute. An unknown status or orientation renders as the default and still round-trips.
- Badge and avatar are the inline widgets: write them as the text directives `:badge[Label]{…}` / `:avatar[AB]{…}` inside a paragraph, never on a line of their own. The older block forms `::badge[…]` / `::avatar[…]` still open, but the editor rewrites them to the inline form on the next save.
- `:avatar` and `::person` are decorative only (NIM-43328). They do NOT mention, tag, look up, link or notify a Fusebase user, and they store no user id — they are initials over a tone. Never use them to notify someone or to represent a real account; there is no image upload either.
- Person initials: the `initials` attr wins (trimmed to two characters, uppercased); with no attr they are derived from the name — first letter of each of the first two words (`Dmitriy Tilik` → `DT`, `Dmitriy` → `D`). An `:avatar` label is the circle text itself, so write it as the one or two characters you want to see.
- Avatar/person `size` is `sm` (default) or `md`; both take the same `<tone>` vocabulary as badge. Person `role` is free text and is omitted when empty.
- Quote is for words someone said, with the speaker: `:::quote[Author]{role="Job title"}` … `:::`. The author is the `[label]` and `role` is optional; either may be omitted, and with neither the quote renders without an attribution line. Its body is normal block markdown (paragraphs, lists, emphasis).
- Do not confuse the three quoting forms: `:::quote` is an attributed pull quote; a callout (`:::info`, `:::warning`, `:::danger`, `:::note`) is an admonition that warns or highlights and never carries an author; a plain markdown `>` blockquote is a quotation with no attribution and no styling. Use `>` when there is nobody to credit, a callout when the point is the warning, and `:::quote` only when a person is being quoted. Never write a callout name as a quote or the other way round.
- For structured metadata (owner, environment, SLA, on-call) use `::kv` rows, optionally wrapped in `:::dl[Title]` — not ad-hoc bold lines like `**Owner:** …`, and never an HTML `<dl>`/`<table>`. Use a real markdown table only for genuinely tabular data with more than one value column; `::kv` is not a table and does not replace one.
- `::kv` takes exactly one attr, `value`, and it is free text (`value="eu-west"`, `value="#platform"`). Put the key in `[Label]`. Do not use `::kv` for metrics — a number with a unit or a delta is `::stat`.
- `:::dl` groups `::kv` rows written on their own lines between the fences; its `[Title]` is optional, and other markdown blocks are allowed inside the group. Setting the title is markdown-only (the UI does not edit it), same as collapse.
- `::check` vs a GFM task list: use `::check` when the status is data you or another agent will read and update later — `done` is a stable attribute you can flip in place. Use an ordinary markdown task list (`- [ ] item`) for casual, prose-level lists. Never rewrite existing `- [ ]` lists into `::check`; the UI leaves them as markdown lists on purpose.
- `done` is `true` or `false`, and only a literal `true` renders as ticked. Omit it entirely for a new unchecked row (`::check[Label]`); write `{done="true"}` to tick it.
- Tabs: `::::tabs` accepts only `:::tab` panes between its fences — anything else written there is dropped when the note opens, as with `:::steps`. A pane's name is its `[Label]`, so renaming one means rewriting that label; a pane holds ordinary block markdown. Which pane is open is not stored in the note: a reader always starts on the first one.
- `:::checklist[Title]` groups `::check` rows under one optional title. Keep it to a single level — a checklist inside a checklist is not rendered specially. Its title, like collapse's, is set only via markdown.
- Text directives (`:name`) other than `:badge` and `:avatar`, and leaf `::name` directives other than progress/rating/stat/divider/step/kv/check/person, are not widgets; leave them as literal text. A `:::name` container that is neither `collapse` nor `quote` nor `steps` nor `dl` nor `stats` nor `checklist` renders as a callout.

## Working Rules

- Always inspect the exact contract with `tools_describe` or `sdk_describe` before integration work.
- Before creating notes in an unspecified/default workspace, call `listWorkspaces` and use the default workspace's real `id` instead of building note URLs with `/workspaces/default`.
- For root note creation or listing, prefer omitting `parentId` instead of inventing a folder id.
- For v3 markdown notes (including directive widgets), use the markdown ops (`createWorkspaceMarkdownNote` / `getWorkspaceMarkdownNote` / `updateWorkspaceMarkdownNoteContent` / `appendWorkspaceMarkdownNoteContent`), not the classic v2 create/append ops.
- If the caller needs note content after a classic v2 create, follow `createWorkspaceNote` with `getWorkspaceNote`.
- If the caller wants to add content to an existing classic v2 note, use `appendWorkspaceNoteContent` instead of creating a replacement note.
---

## Version

- **Version**: 1.11.0
- **Category**: specialized
- **Last synced**: 2026-09-29
- **Priority rule**: If the MCP prompt has a higher version, follow the prompt's API Reference as source of truth.
