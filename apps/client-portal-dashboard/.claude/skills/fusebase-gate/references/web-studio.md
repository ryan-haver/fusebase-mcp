---
version: "1.28.1"
mcp_prompt: webStudio
last_synced: "2026-10-22"
title: "Fusebase Gate Web Studio Operations"
category: specialized
---
# Fusebase Gate Web Studio Operations

> **MARKER**: `mcp-web-studio-loaded` — When this marker is present in context, MCP prompts for this topic may skip conceptual sections and use API reference only.

> **VERSION CHECK**: If operations fail unexpectedly, load MCP prompt `webStudio` for latest content.

---
## Table of contents

- [Fusebase Gate Web Studio Operations](#fusebase-gate-web-studio-operations)
- [Read this before anything else](#read-this-before-anything-else)
- [Access, entry and notes](#access-entry-and-notes)
- [Design taste](#design-taste)
- [`<fb-embed>` contract](#fb-embed-contract)
- [Relevant Operations](#relevant-operations)
- [Publishing](#publishing)
- [Look at what you made](#look-at-what-you-made)
- [Pointing a person at Studio itself](#pointing-a-person-at-studio-itself)
- [When a person asks for a new site](#when-a-person-asks-for-a-new-site)
- [When a person asks to change a site they already have](#when-a-person-asks-to-change-a-site-they-already-have)
- [Choosing an edit operation](#choosing-an-edit-operation)
- [Grouping edits](#grouping-edits)
- [The sequence that works](#the-sequence-that-works)
- [The site's own instructions](#the-sites-own-instructions)
- [Rules no single operation can state](#rules-no-single-operation-can-state)
- [FuseBase App runtime context](#fusebase-app-runtime-context)
- [Working Rules](#working-rules)

---
## Fusebase Gate Web Studio Operations

These operations manage **Web Studio sites**, which are a different
product from portals and share almost none of their vocabulary.

## Read this before anything else

**A Web Studio site is HTML and CSS that the site owns.** It is not a
tree of typed blocks. There is no `addWebStudioHeadingBlock`, no block
picker, and no settings object per block. Editing a page means editing
the file that page renders.

If you have read the `portals` prompt, set it aside here. Reaching for
the nearest portal-shaped operation and writing a block tree into an
HTML file is the single most likely way to get this wrong.

Structured data does exist alongside the markup, and it is small and
deliberate: the route table (pages), menus, access rules, theme tokens
and named palettes. Everything else is a file.

## Access, entry and notes
Use webStudioPermissions for participants and organization Studio access. Site entryPolicy is separate: open, email, invite (Restricted); read it in getWebStudioSiteContext and save it immediately with setWebStudioSiteEntryPolicy. Page access modes are public, unlisted, authenticated, grant. Never send signed-in or signedIn. Entry policy is live and independent of publishing and page Undo. Pass site.entryPolicyVersion from fresh context as expectedVersion; on 409 reload and review before saving.
For a note to embed on a site, createWorkspaceMarkdownNote creates V3 (notes.markdown.write); createWorkspaceNote creates classic V2 and is not interchangeable. Discover via listWebStudioFuseBasePages, then insertWebStudioFuseBasePage. Do not silently convert or duplicate an existing V2 note. App code reads getMe().auth.runtimeContext to detect Site context; /auth/context is not the Site context source.
setWebStudioSiteAddress assigns the platform label; publishing alone does not choose an address. resolveRoute requires route.read; the configured MCP token must explicitly contain it. Return studioUrl as supplied, never append goto parameters.
## Design taste

Editing markup and CSS here is a design act, not just a text edit.
This surface has no built-in design lead watching the result the way a
person does in Studio Chat, so the rules below are the substitute.
They apply whenever a call creates a page, rewrites a section, or
changes layout, typography, color, or spacing — not to a pure copy fix
or a one-line CSS tweak.

**Read the brief in one line before writing markup**: page kind,
audience, vibe, and the aesthetic family this leans toward. If genuinely
ambiguous, ask one question; otherwise commit and proceed rather than
defaulting to the nearest generic template.

**Vertical rhythm is a hard rule** — it is the defect generated pages
ship most. A heading, its text and its actions never sit flush. The
tight tracking and line height in a style's DESIGN.md are for a
heading's own lines, never the space between elements. Build every
heading-text-actions group (hero, section intro, card body, sidebar
page header) as a flex or grid column with `gap` from the spacing
scale: at least `var(--fb-space-3)` from a heading to its text and
`var(--fb-space-5)` before buttons, more under a display heading with
a line-height below 1. `margin: 0` on a heading or paragraph only when
the parent sets that gap. The visual review reports a heading that
overlaps the next line as an error (`text-crowded`).

**Anti-default discipline.** Do not reach for: a centered hero over a
gradient blob, three equal feature cards in a row, purple/violet
"AI" gradients and glows, nested cards for everything, or decorative
hero art with no real content behind it. For premium / artisan /
hospitality briefs specifically: warm cream plus terracotta-or-ochre
plus espresso ink is the single most repeated AI palette — rotate
through cold-luxury silver/chrome, deep forest plus bone, off-black plus
warm tan, cobalt plus cream, terracotta plus slate, olive plus brick, or
monochrome plus one saturated accent instead, and do not repeat the same
family as the last site this session touched. One accent hue per
project, used identically everywhere.

**Hard bans — check mechanically before saying a change is done:**
- No em dash (—) anywhere visible: headings, eyebrows, buttons, quotes,
  captions, alt text. Use a period, comma, or hyphen.
- No section-number or version eyebrows ("01 / Capabilities", "v0.6",
  "BETA", "Stage 1 / Stage 2 / Stage 3"). Name the topic in plain
  language, or drop the eyebrow.
- At most one small-uppercase eyebrow label per three sections, hero
  included. A 6-section page gets at most 2.
- No three-equal-card row as the default shape for a feature or benefit
  section — vary composition (2-up, asymmetric split, full-width band).
- No more than two consecutive sections sharing one layout family; the
  third repeat must break the pattern.
- No "big headline on one side, small explainer paragraph floating on
  the other" as a section header — stack vertically, or give the second
  column real content instead of filler prose.
- Hero fits without scrolling to the primary action: headline at most 2
  lines, supporting copy roughly 20 words or fewer, primary action
  visible on load, at most 4 text elements total (eyebrow, headline, one
  supporting line, up to 2 CTAs).
- No duplicate call-to-action intent under different wording ("Get in
  touch" / "Contact us" / "Let's talk" all mean the same thing) — one
  label per intent, reused exactly.
- Every button and tinted surface is checked for contrast against its
  own background specifically, not the page background.
- One corner-radius system and one accent color for the whole page.
- Quotes and testimonials: 2 to 3 lines of body at most, attributed with
  a name and role.
- No decorative colored dots, hairline crosshair grids, or locale/
  time-zone strips added purely for texture.

**Layout pitfalls — the defects generated pages actually ship.** These
are write-time rules; nothing renders the page to catch them later.
- No fixed height on anything holding text, and no `px` width on a
  content container. Use `max-width` with `width: 100%` and let height
  come from content.
- Flex and grid children do not shrink by default. A child that can
  hold a long heading, URL, table, or `<pre>` needs `min-width: 0` in a
  flex row, or `minmax(0, 1fr)` in a grid track, or the row grows past
  the viewport and the page scrolls sideways.
- Every multi-column row states how it stacks. Prefer
  `grid-template-columns: repeat(auto-fit, minmax(<floor>, 1fr))` so it
  collapses with no media query; otherwise write the media query.
- Never `100vw` — it ignores the scrollbar and overflows. Use `100%`.
- Images: `max-width: 100%; height: auto;` plus `width`/`height`
  attributes or `aspect-ratio`, so the page does not jump on load.
  `object-fit: cover` only when a fixed frame is deliberate; it crops.
- Long unbroken strings (URLs, emails, ids, compound words) need
  `overflow-wrap: anywhere`. No `overflow: hidden` on a text container
  without an explicit clamp.
- Sticky and fixed elements reserve their own space and must not cover
  the primary action at 375px. Absolute positioning is for decoration
  inside a container that already reserves the room.
- Tap targets at least 44x44px with real spacing between adjacent
  links, and never `user-scalable=no` or `maximum-scale=1`.
- An `<fb-embed>` must not sit in a fixed-height box; it negotiates its
  own height after it loads.

Check the widest things first: tables, code blocks, long headings, nav
rows, button rows, and card grids.

## `<fb-embed>` contract

Use `<fb-embed>` only for a public HTTPS page the person explicitly
asked to frame. `url` is required; `src`, `href`, and `source` are not
aliases. `title` is the accessible iframe label and should describe
the framed content. A minimal generic embed is:
`<fb-embed url="https://example.com/view" title="Project view"></fb-embed>`.

Supported sizing attributes are `auto-height="true|false"`,
`height` (CSS pixels, clamped to 120..50000, default 640), and
`viewport-height` (20..95, rendered as `vh`; it wins over `height`).
FuseBase notes and Apps default to auto height; other URLs opt in with
`auto-height="true"`. Width hints are
`data-fb-embed-width="full|fixed"` and, for fixed width only,
`data-fb-embed-width-px` (240..2560, default 960). `data-fb-id` is the
usual optional editor hint. Do not put an auto-height embed inside a
fixed-height wrapper.

The compiler turns the element into a sandboxed iframe and owns the
bridge. For an auto-height frame the parent sends
`{type: "fb:embed:hello", v: 1, theme, colorScheme, scale}`; the
child reports `{type: "fb:embed:height", v: 1, height}` or the
legacy App Wrapper `{type: "fbs-iframe-resize", height}`. These
messages carry visual theme and sizing only, never identity or access
authority. The runtime checks the sender window and origin.

A bound FuseBase App is different from a generic embed:
`data-fb-app-binding` and its launch URL are server-owned security
metadata. Never write or copy them. Use listWebStudioFuseBaseApps plus
insertWebStudioFuseBaseApp or replaceWebStudioFuseBaseApp; their launch
flow supplies the verified Site context separately from postMessage.

**Content pitfalls.**
- Nothing placeholder ships: no lorem ipsum, "[Your Company]", "TODO",
  or bracketed slots. If a value is genuinely unknown, write plausible
  generic copy and name in your reply the lines the owner must replace.
- Do not fabricate verifiable specifics: phone numbers, addresses,
  prices, dates, headcounts, certifications, award claims, or a
  testimonial attributed to an invented named person at a
  real-sounding company. An obvious placeholder is honest; a realistic
  fake is not.
- Every internal `href` points at a route the site actually has, and
  nav labels match the titles of the pages they open.
- Each page gets its own title and description, not a copy of the home
  page's.

**Editing an existing site is a redesign, not a rebuild.** Read the
current pages first and note the site's own accent, type choice,
radius, and copy voice — that is the baseline, not a default to
overwrite. Preserve routes, primary nav labels, and existing copy voice
unless asked to change them. Order changes by value against risk:
typography and spacing first, then color recalibration that keeps the
existing accent, then hero/section recomposition, and only replace a
section's structure entirely when it is not salvageable within the
current system. Never silently change route slugs, nav labels, form
field names, or the site's logo — those need an explicit ask.

**Imagery.** CSP on a site is `img-src 'self' data:` — no external URL,
stock site, or CDN reference will ever render, and there is no
server-side fetch tool reachable from here. A real photo can come from a
file the calling application already has and passes through as page
content, or from **generateWebStudioImage** where the caller holds
`sites.image.create` — most tokens do not, since it is a real paid call
per invocation and is granted separately from `sites.write`. A 400 from
it means image generation is not configured or not permitted in this
environment; do not invent an image URL or a plausible-looking `data:`
payload as a substitute. Prefer typography, layout, and SVG for
anything that is not backed by a real asset or a successful
generateWebStudioImage call.

**Motion.** Web Studio has three safe compiler-owned behaviours, shared
with Studio Chat. Never add a script, inline handler, animation library,
or custom runtime. Instead add one declared behaviour to a stable HTML
element: `data-fb-motion="reveal"` for one section entering when
visible; `data-fb-motion="count"` for one static number such as
`82%` or `1,240`; or `data-fb-motion="parallax"` for a decorative
background wrapper only. Do not reveal every card or navigation item,
do not count a live data island, and do not put text, forms, navigation,
or a critical action in a parallax layer. Optional attributes are
`data-fb-motion-speed="slow|normal|fast"`,
`data-fb-motion-distance="8|16|28"`, and
`data-fb-motion-delay="0|120|240|400"`. Default to normal, 16, and
0; prefer slow or normal, 8 or 16px, and no delay unless a small 120ms
sequence helps orientation. The compiler clamps values, respects
`prefers-reduced-motion`, and keeps content visible if motion is reduced
or unsupported.

**Repeatable content.** When a person may need to add another timeline
step, FAQ, feature card, metric, or agenda row, make it an opt-in Studio
collection: put `data-fb-collection="<kind>"` and a stable `data-fb-id`
on the direct container, and put `data-fb-item` plus a distinct stable
`data-fb-id` on each repeated child. Do not write a plus button, hover
control, script, or editor UI into page HTML. Studio supplies an
editor-only Add item control and published pages remain static.

## Relevant Operations

Read:
- listWebStudioSites: sites in the organization the caller may open, each with the `branchId` every other operation needs.
- getWebStudioSiteContext: the whole shape in one call — routes depth-first with access and source file, menus with their settings, palettes by name, a file inventory with sizes, recent changesets, how far the published site is behind the draft, and the site's own instructions for the AI (`instructions`: AGENTS.md, DESIGN.md and skills).
- readWebStudioFile: the exact current text of one project file — HTML and CSS with their `data-fb-id` attributes, or one of the site's Markdown instruction files.
- listWebStudioFuseBaseWorkspaces: FuseBase workspaces the current user may use in this site.
- listWebStudioFuseBasePages: one page of at most 15 accessible V3 notes, with folder paths and an opaque next cursor.
- listWebStudioFuseBaseFolders: one page of at most 15 accessible folders, with ancestor paths and an opaque next cursor.
- listWebStudioFuseBaseApps: accessible Your and Managed Products and Apps, including stable ids, current publicity and safe open links.

Start a site:
- listWebStudioTemplates: the catalog `createWebStudioSite` accepts as `templateKey`, each with a page count and a gallery description. Call this before naming a template — an unrecognized key is refused with `template_not_found`.
- createWebStudioSite: a new site, owned by the caller, in the organization named by `orgId` — never a default picked for you. Omit `templateKey` for the platform's demo project, or pass "blank" for a single page site in the neutral Clean style (with a DESIGN.md describing it), or a key from `listWebStudioTemplates`.

Move a whole site (each needs its own permission):
- exportWebStudioSite (`sites.export.read`): a 15-minute download link to the site as a .zip — the draft and the bytes of every Files asset. A credential; hand it to importWebStudioSite or to the person, nowhere else.
- importWebStudioSite (`sites.import.create`): a new unpublished site in `orgId` from such a link, here or in another environment. Its Files are copied in; App bindings are not — tell the person about every entry in `appEmbedsToReplace` and do not publish until those embeds point at Apps of this environment.

Edit the draft (none of these publish anything):
- Markup and styles: writeWebStudioFile, patchWebStudioFile, patchWebStudioBlock, insertWebStudioHtml.
- Routes: createWebStudioPage, updateWebStudioPage, deleteWebStudioPage, setWebStudioPageAccess, setWebStudioPageSeo.
- Navigation: addWebStudioMenu, updateWebStudioMenu.
- Look: setWebStudioTheme, addWebStudioPalette, setWebStudioStyleSets.
- The site itself: setWebStudioSiteIdentity.
- Its public address: setWebStudioSiteAddress with the label (`acme` → `acme.<platform base>`). Owner only; replaces the current address at once and is not undoable, so ask before moving an address that may have been shared. A taken label is refused with free labels nearby — offer them, do not guess.
- FuseBase content: insertWebStudioFuseBasePage adds one maintained FuseBase Page block; replaceWebStudioFuseBasePage changes an existing binding without rewriting its HTML; importWebStudioFuseBaseFolder creates or reuses linked pages and adds folder navigation.
- FuseBase Apps: insertWebStudioFuseBaseApp adds one Products/Apps block; replaceWebStudioFuseBaseApp reconfigures one explicit binding without changing its identity.
- applyWebStudioEdits: several of the above as one change.

Generate imagery (a real paid call, its own permission, not part of
applyWebStudioEdits):
- generateWebStudioImage: a new photo or illustration from a text prompt, placed as a `data:` URI. Requires `sites.image.create`; a 400 means it is not configured or not granted here.

History and looking at the result:
- moveWebStudioCursor: undo or redo, optionally straight to a `seq` from the history.
- createWebStudioPreviewLink: a link you can open to see how the draft actually renders.

Release — the only operations the public sees:
- listWebStudioReleases: every release, newest first, with the one currently served marked.
- publishWebStudioSite: cut a release from the draft and serve it.
- rollbackWebStudioSite: serve an earlier release again.

## Publishing

**Publish when a person asks you to, not when the work looks done.**
Everything else on this surface is recoverable by somebody who notices
it. This one is seen by whoever visits the site in the meantime, so
finishing a task is not consent to release it. Say the draft is ready
and let them decide, unless they already told you to publish.

`expectedVersion` is required here and optional everywhere else. Pass
the version you last read, so what goes public is what you looked at
rather than whatever the draft holds by the time the call lands.

Publish re-checks the whole project and refuses a release that would
expose a page behind sign-in, or leave a link pointing at a page that
no longer exists. The refusal names what to fix — fix it and publish
again rather than looking for a way around the check. Warnings come
back in `diagnostics`: repeat them to the person, do not act on them
alone.

If a publish turns out wrong, **rollbackWebStudioSite** is the fast way
out. It changes only which release visitors are served — nothing is
deleted and the draft does not move — so use it to stop the bleeding
first and fix the draft afterwards. The release to name is the one
listWebStudioReleases marks `current`, minus whatever went wrong; the
newest release is not always the current one, which is exactly what a
previous rollback leaves behind.

## Look at what you made

If you can open a URL, do. **createWebStudioPreviewLink** returns a
link that renders the draft the way a visitor would see it — layout,
stylesheet, menus and all — which is not something you can work out
reliably by reading the source. After a visual change, open it, look,
and fix what is wrong before saying you are done.

That link is a credential. It needs no sign-in and it shows
unpublished work, so it expires in minutes by design. Do not paste it
into anything that outlives the task, and do not offer it as a way to
share the site — the site is shared by publishing it.

## Pointing a person at Studio itself

A question about the editor, not the site — "how do I add a custom
domain", "where do I see AI usage", "how do I edit the raw HTML" —
is answered with a link into Studio, not a description of menus to
click through. Call listRoutes and resolveRoute with a `studio.*`
location, passing this site's `siteId`. Leave `branchId` out;
Studio opens the current draft. Pass it only to open a different
draft. Do not
append `&goto=` yourself and do not invent an id: the allowlist is
DEEP_LINKS in sites-codex apps/studio/src/App.tsx, exposed by
listRoutes. A color palette or theme question is `studio.styles`,
never `studio.settings.address`. The link text is human words
describing the destination ("Styles", "Settings → Sharing"),
never the id itself.

Also never fall back to describing a generic "Account settings" or
"Billing" menu: Studio has no such section, and a caller with no
screen has no way to check that guess before handing it over. If
the place someone is asking about has no id yet, resolve `studio.open`
and say plainly that you don't have a direct link to that one
section. resolveRoute answers `unsupported` when the Studio origin
is not configured. Do not guess a hostname.

## When a person asks for a new site

If the person is in front of a screen and asks you to make them a
site, hand them over to Studio rather than building it yourself:
resolveRoute `studio.new_site` with `params.prompt` set to their
brief in their own words (what the site is for, who it is for, what
must be on it; up to 4000 characters), and give them the link.
Studio opens Describe with AI with that text; they go on through the
questions, the look and the layout, and attach files there. It needs
`sites.create`. Use createWebStudioSite only when you are going to
build the site yourself with the edit operations below.

## When a person asks to change a site they already have

If they are in front of a screen and the change should happen in
Studio's chat rather than by you editing the files, resolveRoute
`studio.chat` with this site's `siteId` and `params.prompt` set to
their request in their own words (up to 4000 characters). Leave
`branchId` out so Studio opens the current draft, with the text
already in the
chat box; they send it. It needs `sites.read`. The text goes in the
URL fragment, the same way `studio.new_site` carries a brief. Edit
the site yourself with the operations below when they asked you to
do the change, not to hand them a box to type in.

## Choosing an edit operation

For anything in HTML that carries a `data-fb-id`, use
**patchWebStudioBlock**. The element keeps its id and nothing around it
has to be reproduced.

To add something while leaving an existing element alone, use
**insertWebStudioHtml**. Do not re-emit a neighbouring element inside a
replacement just to keep it — that is how a block silently loses its id
or an attribute nobody meant to touch.

For text with no id to aim at, such as a CSS rule, use
**patchWebStudioFile**, with `expectedText` copied verbatim from a fresh
readWebStudioFile. Text typed from memory does not match and the patch
is refused.

Use **writeWebStudioFile** for a new file, or when you are genuinely
replacing all of one. Rewriting a whole file to change one rule means
reproducing the rest of it correctly, and losing anything a person
changed since you read it.

For FuseBase notes, never assemble `data-fb-content-binding` HTML or
manifest data with generic edits. Resolve names with
listWebStudioFuseBaseWorkspaces and listWebStudioFuseBasePages, then
use insertWebStudioFuseBasePage or replaceWebStudioFuseBasePage.
Duplicate page titles are normal: use folderPath to ask which one.
A pasted FuseBase /space/{workspaceId}/document/{noteId} URL may be passed
directly to insertWebStudioFuseBasePage; do not trust or reuse ids
parsed from it yourself. The sites service verifies the organization
host and the current user's access again. MCP has no current page or
selection, so insertion requires pageId and replacement requires
bindingId. afterNodeId is optional; without it insertion appends.
For a folder request, resolve it with listWebStudioFuseBaseFolders
and call importWebStudioFuseBaseFolder exactly once. Pass the target
site page id and the draft version from getWebStudioSiteContext.
The import owns preview, snapshot validation, linked page creation,
routes, navigation and batching. Never recreate that workflow with
generic page, menu or HTML edits.

For FuseBase Apps, always call listWebStudioFuseBaseApps first and
use only Product and App ids it returns. Never assemble an App
`fb-embed`, binding id, embed URL or access metadata with
insertWebStudioHtml, patchWebStudioBlock, writeWebStudioFile or
applyWebStudioEdits. If names match more than once, distinguish Your
and Managed Products and ask which result the person means. MCP has
no current selection: insertion requires pageId and replacement
requires bindingId. Internal Team means accessPolicy `internalTeam`
(staff, managers and organization guests with site access); External
Team (clients) means `externalTeam`. Both teams means `containerMember`
(the insertion default). Empty team selection is invalid. `containerManager` is
a legacy setting; use it only to preserve existing managers-only access.
Public access uses `public`: `public` means anyone on this site, not that the App becomes
public everywhere. Global App publicity is intentionally unavailable
on this surface until Gate can enforce its separate App permission.
Use the dedicated App operations' height parameter for sizing:
`{mode: "auto", value: ""}` fits the content;
`{mode: "fixed", value: "720"}` sets pixels (120..5000);
`{mode: "viewport", value: "70"}` uses screen percent (20..95).
Omitted height means auto on insertion and preserves height
on replacement. For height-only edits, read the existing binding and
reuse its productId and appId; omit accessPolicy to keep its current rights.
Omitted accessPolicy on replacement preserves access. Changing access alone
must preserve height. Public access still respects site and page access.
Pass expectedVersion after reading the draft. Insert and replace
change only the draft. Offer a preview afterwards and publish only
when the person explicitly asks.

## Grouping edits

**applyWebStudioEdits** applies a list in order as one entry in the
history, and either all of them land or none do. Use it when the edits
are one change to the person who asked: a stylesheet rule and the markup
that uses it, or a new page and the menu it belongs in. A later edit in
the list sees the effect of the earlier ones.

Prefer the single-purpose operations when the edits are unrelated —
their arguments are typed and checked, and the batch's are not. Each
entry's `name` is the underlying vocabulary: write_file, apply_patch,
patch_by_id, insert_html, create_page, update_page, delete_page,
set_page_access, set_page_seo, add_menu, update_menu, set_theme,
add_palette, set_style_sets, set_site_identity.

## The sequence that works

1. `listWebStudioSites` — a request naming a site by title has to be
   resolved to an id first. Do not guess an id.
2. `getWebStudioSiteContext` — one call, not four. It is what replaces
   the screen a human editor is looking at, and it carries the site's
   own instructions: read them before you change anything.
3. `readWebStudioFile` — before changing anything in a file. A patch
   built from memory of what a page probably says does not apply.
4. Edit, then say what you changed. Check `getWebStudioSiteContext`
   again if a later edit depends on the shape you just altered.

## The site's own instructions

A site can carry instructions for the AI as files: `AGENTS.md` (the
author's standing instructions — who the site is for, words to use,
what not to touch), `DESIGN.md` (its design direction: colour roles,
type, shape, components) and `skills/<name>.md` (the steps for one kind
of request). `getWebStudioSiteContext` returns them as `instructions`,
each skill by name and description.

- Follow them as Studio Chat does. The platform's rules come first,
  then the request in front of you, then `AGENTS.md` and a matching
  skill, then `DESIGN.md` as the default for whatever the request
  leaves open. Where a request explicitly contradicts one of them, do
  what the request asks and say so in one line.
- A filled-in `DESIGN.md` has already made the design decisions. Where
  it differs from the design-taste rules above — a cream page, a
  grid-paper background, a typeface — the site's own direction wins;
  the rules above cover only what it leaves open.
- When a skill's description matches the request, read the skill with
  readWebStudioFile before acting, and follow it.
- `DESIGN.md` names roles and theme tokens, never colour values: the
  values live in the theme and palettes. When the author changes the
  direction on purpose, update `DESIGN.md` in the same set of edits.
  Never edit `AGENTS.md` unless the author asks.
- Instruction files are Markdown, written with writeWebStudioFile and
  `mediaType` `text/markdown`. Nothing compiles or serves them.
- A site started from a style has a shared set of classes in
  `styles/site.css` (`.hero`, `.section`, `.card`, `.btn`, `.band-dark`
  and more, listed at the top of the file). Build with them, and add
  rules to the stylesheet rather than rewriting it.

## Rules no single operation can state

- **There is no current page and no selection.** Every operation names
  its site and its branch. Nothing is remembered between calls, and
  that is deliberate: a remembered 'current page' is how an agent edits
  the wrong thing when two conversations interleave.
- **Elements are addressed by `data-fb-id`.** That attribute in the
  markup is the stable handle — the same one the built-in editor uses
  when a person clicks something. Get it from readWebStudioFile.
- **Structure is stated once, in the page tree.** A page nested under
  another is what produces a submenu. Menus are generated from that
  tree with a `depth` setting; navigation links written by hand into a
  layout stop following the pages and go stale.
- **Nothing is live until it is published.** Every edit lands in the
  draft. `changesAhead` in the site context says how far the public
  site is behind it. Publishing is what moves it, and it is the one
  operation here a mistake makes public.
- **Undo is cheap; treat it as the way back.** moveWebStudioCursor
  walks the journal rather than deleting anything, and an undone
  changeset stays redoable until something new lands on top of it. If
  an edit went wrong, undo it rather than patching over it — a patch
  that repairs a mistake leaves two entries in the history where the
  person reading it expects none.
- **Concurrency is explicit.** Pass the `expectedVersion` you read from
  getWebStudioSiteContext, and use the `version` each edit returns for
  the next one. A 409 means somebody else moved the draft — a person
  with the studio open, most likely. Re-read and rebuild the edit; do
  not retry it unchanged, and do not drop the version to force it
  through.
- **A refused edit is a message worth reading.** "Patch context was not
  found in styles/site.css" means your `expectedText` is stale, not
  that the operation is broken. Re-read the file.
- **Theme tokens before CSS.** Colors, radius and fonts live in the
  theme and in named palettes, which every template already reads.
  Writing color declarations or `html[data-fb-theme]` rules into a
  stylesheet makes a site that the palette picker no longer controls.
- **Never add scripts.** No `<script>`, no inline event handlers, no
  iframes, no `javascript:` URLs, no CSS `@import` or external
  stylesheet URLs. These are refused, and working around the refusal is
  not the task.
- **A preview URL is authenticated.** It shows unpublished work. It is
  not a link to paste anywhere that outlives the conversation.

## FuseBase App runtime context

A FuseBase App embedded in a Site does receive a verified Site context.
This is the Sites equivalent of `portalFeatureContextToken`; do not
infer from the absence of an MCP or public SDK operation that the
runtime context is missing.

When a bound App is launched, Web Studio creates a short-lived signed
`siteAppContextToken`. It identifies the `siteId`, `pageId`, `blockId`,
binding, Product and App; carries the access policy, current principals
(`visitor`, `containerMember`, `containerManager`), and the explicit
viewer `siteRole` (`visitor`, `client`, `member`, or `manager`); and includes the
FuseBase user subject when the visitor is authenticated.
The verified launch surface is `studio`, `preview`, or `published`.
Read it from `getMe().auth.runtimeContext` in the SDK or `runtimeContext` in MCP `whoami`
connection context. The same trusted object exposes `containerType`, `surface`,
`productId`, `appId`, `siteId`, `pageId`, `blockId`, `bindingId`,
`accessPolicy`, `principals`, and `siteRole`; do
not infer these values from the URL or working directory.
`pageUrl` is the public address of the Site page holding the App, nested
pages included; use it for links in notifications and emails. It is
absent while the Site has no public address, so do not build it yourself.
In App code, `runtimeContext?.containerType === "site"` is the
verified signal that this request was launched inside a Site. If that
context is absent, there is no verified Site launch; keep the App's
standalone defaults instead of guessing from its URL.
`accessPolicy` says who is allowed to open the binding; it is not the
current viewer's role. Use `siteRole` for role-aware App behavior:
`manager` may manage the Site App, `member` is an internal organization
participant, `client` is an external authenticated participant, and
`visitor` is an anonymous public launch. Do not collapse `member` into
`client`. A Site settings `Client` invitation yields `siteRole: client`,
`Member` yields `siteRole: member`, and `Manager` yields
`siteRole: manager`. During rollout an older session may omit
`siteRole`; ask the
user to reopen the App instead of guessing it from the policy.

The token is a server-to-server security contract, not page data and
not an agent tool. App Wrapper sends it to Web Studio's protected
`POST /internal/site-app-context/verify` endpoint. Web Studio verifies
the signature and expiry, then rechecks the current Site, page, bound
embed, access version, organization mapping and membership before
returning the context. Do not decode or trust the token in browser code,
expose it in site HTML, or look for an MCP operation that verifies it.

## Working Rules

- Use tools_describe before calling an operation whose input you are unsure of, rather than guessing a field name.
- A site the caller is not a member of answers 404, not 403. Treat it as absent; do not retry with a different id to probe.
- Report what you changed in terms of routes and files, not blocks. The person reading your summary can open the file you name.
---

## Version

- **Version**: 1.28.1
- **Category**: specialized
- **Last synced**: 2026-10-22
- **Priority rule**: If the MCP prompt has a higher version, follow the prompt's API Reference as source of truth.
