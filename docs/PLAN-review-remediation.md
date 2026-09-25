# Review Remediation Plan

> Plan to fix every finding from the full project review (2026-09-23).
> Each finding has a stable ID. Commits and PRs should cite the IDs they close.

**Status key:** ✅ confirmed (reproduced live, reproduced offline, or verified by reading the code) · 🔎 reported by a reviewer and not yet reproduced. Before fixing a 🔎 finding, reproduce it with a failing test. If it doesn't reproduce, close it as "not a bug".

**Size key:** S = under half a day · M = about 1 day · L = 2–3 days.

---

## Ground rules

1. **Reproduce first.** Every fix starts with a test that fails. Offline pieces (parser, writer, decoder, path handling, SSE auth) get unit tests. Behaviour that only the live API shows gets a live test.
2. **Tests must fail honestly.** Phase 0 comes first: until the suites can fail, no later phase can be verified.
3. **One branch and one PR per phase.** Phases 1 and 2 can each be split into several PRs if they get large. Every PR runs `npm run build`, `npm test`, and the live suite for the areas it touches.
4. **Live tests run only in a sandbox workspace.** No test may fall back to `workspaces[0]` or to any hardcoded ID.
5. **Breaking changes are called out.** They are listed in Decisions and in the PR description.

## Prerequisites (owner: Ryan)

| # | Item | Why |
|---|---|---|
| P1 | Regenerate the Gate and Dashboards MCP tokens and put them in `.env` | The current tokens return `UNAUTHORIZED: Invalid token` ✅ done 2026-09-23 |
| P2 | Get a fresh session cookie: `cd C:\scripts\fusebase-mcp; npx tsx scripts/auth.ts` (capital `C:`) | `cookie.enc` doesn't decrypt. The key depends on the project path, so the drive-letter casing must match how the tests run (see SEC-10) ✅ done 2026-09-23 |
| P3 | Create a sandbox workspace and set `FUSEBASE_WORKSPACE_ID` in `.env` | So live tests never touch real data ✅ done 2026-09-23 |
| P4 | Answer the questions in [Decisions](#decisions-needed) | Several fixes change tool behaviour |

The cookie will need refreshing more than once. Before each live run, check that it is less than about 20 hours old.

---

## Phase 0: Make the test suite trustworthy (M–L)

*Goal: a failure turns red, `npm test` runs offline and fast, and live suites are opt-in.*

> **Status (branch `fix/phase-0-test-harness`):** implemented; live verification pending fresh credentials (P1–P3).
> - Findings now pinned by tests: offline `it.fails` for SEC-1, SEC-2, SEC-3, SEC-6, CON-1, CON-2, CON-3, CON-6, CON-7, CON-8, CON-9a, COR-3, COR-10, COR-12, COR-14, MCP-1, MCP-3, MCP-5, MCP-6; live `knownGap()` for CON-1, CON-2, CON-3, COR-12.
> - Reproduced offline for the first time: CON-9a, COR-14, COR-3's "Body is unusable", MCP-6.
> - Also found and fixed while converting the suites: the data-validation suite had ~57 swallowing catches (not 34); `batch_put_database_data` was called without `viewId` and always failed silently; `create_view`/`update_view` were passed `title` instead of `name`; `audit-tools.ts` could never fail; the parity test hardcoded cookie results as PASS and never deleted what it created; portal invite tests emailed real addresses (now opt-in via `FUSEBASE_TEST_INVITE_EMAIL`).

| ID | Finding | Status | Fix |
|---|---|---|---|
| TST-1a | `test-token-parity.ts` exits 0 on a crash (`.catch(console.error)`) | ✅ fixed | `.catch(e => { console.error(e); process.exit(1) })`; also assert on every result row |
| TST-1b | `test-token-direct-connection.ts` passes when the response is `UNAUTHORIZED` (`ok !== false`) | ✅ fixed | Check `isError` and the absence of an `error` key; assert the expected fields |
| TST-1c | `test-database-e2e.ts` prints "🎉 100% … VALIDATED" from `finally` even after failing | ✅ fixed | Move the banner out of `finally`; print it only on success |
| TST-1d | `test-data-validation.ts` has 34 `catch → console.log` blocks that count failures as passes | ✅ fixed | Remove them. Where a feature really is optional, record it as `SKIP(reason)` and report skips separately |
| TST-1e | `test-cli-and-flow.ts` only checks mocks and file contents but is described as "validation" | ✅ fixed | Move it to the offline unit suite and describe it accurately |
| TST-2 | No unit-test framework and no offline tests | ✅ fixed | Add `vitest`. `npm test` runs offline units; `npm run test:live` runs the live suites. Seed it with regression tests for every ✅ finding below |
| TST-3 | Hardcoded IDs (`49b306wxd9oa7hyc`, task `9yc1s7…`) and `workspaces[0]` fallback | ✅ fixed | Require `FUSEBASE_WORKSPACE_ID`; create any needed fixtures (tasks and so on) during the run |
| TST-4 | No CI and no lint | ✅ fixed | GitHub Actions: `build`, `tsc --noUnusedLocals`, `eslint`, `vitest`. Live suites don't run in CI (they need credentials) |
| TST-5 | The parity test reads only `FUSEBASE_GATE_TOKEN`, not `GATE_MCP_TOKEN` | ✅ fixed | Share one config loader between the server and the tests (see DOC-2) |
| TST-6 | Live suites log token and cookie prefixes | ✅ fixed | Log only "present / missing" (also SEC-8) |
| TST-7 | Suites called tools with wrong arguments, hidden by swallowed catches: `batch_put_database_data` without `viewId` (always failed), `create_view`/`update_view` with `title` instead of `name`, `duplicate_database` with an unsupported `title` | ✅ fixed | Corrected the calls; failures now propagate |
| TST-8 | `audit-tools.ts` printed results but could never exit non-zero | ✅ fixed | Fails on duplicate tools, missing descriptions, undescribed parameters, tools missing from README |
| TST-9 | The parity test hardcoded cookie results as PASS, included two fabricated rows, and never deleted the notes/folders it created | ✅ fixed | Every row is measured in both modes; restrictions are verified, not assumed; everything created is deleted |
| TST-10 | Portal invite / magic-link tests sent real email to fixed `@inkabeam.com` addresses | ✅ fixed | Opt-in via `FUSEBASE_TEST_INVITE_EMAIL` |
| TST-11 | The data-validation suite creates an isolated SQL store (`qa-val-store`) that can't be deleted | ✅ | Blocked on MCP-10 (no delete tool); reused across runs meanwhile |

**Exit criteria:**
- With the current broken credentials, every live suite exits non-zero.
- `npm test` runs offline, and the known-bug regression tests are either failing or marked `it.fails`.

---

## Phase 1: Security (L)

> **Status (branch `fix/phase-1-security`):** implemented, all SEC findings closed with tests. Notes:
> - SEC-4, SEC-5, SEC-7 and SEC-9 were reproduced with failing tests before fixing. SEC-5 was worse than reported: an empty ID silently hit the parent endpoint, and `listFolders("ws&depth=1")` injected a query parameter.
> - D1 applied: `/mcp` (Streamable HTTP) is the primary endpoint; legacy `/sse` stays for one release behind the same auth, Host and Origin checks. `--transport sse` / `MCP_TRANSPORT=sse` now mean HTTP mode.
> - Loopback without `MCP_AUTH_TOKEN` is still allowed (other local processes can already read `data/`); Host and Origin checks still apply there.
> - SEC-6 deviates slightly from the plan: a tool-supplied `cwd` may be inside the server's working directory (unless it is a filesystem root), `apps/`, or `FUSEBASE_CLI_ALLOWED_DIRS`. Restricting to `apps/` alone would break running the CLI in the user's own project.
> - SEC-2 is the breaking change from D3: `download_attachment` only writes inside `data/downloads` (or `FUSEBASE_DOWNLOAD_DIR`).

| ID | Finding | Status | Fix |
|---|---|---|---|
| SEC-1 | The SSE server binds `0.0.0.0`, sends `ACAO: *`, has no auth and no Host or Origin check. Confirmed live: an unauthenticated LAN client can list and call every tool | ✅ fixed | Bind `127.0.0.1` by default (`--host` to override). When not on loopback, require `MCP_AUTH_TOKEN` (bearer) and refuse to start without it. Allow-list Host and Origin (SDK `hostHeaderValidation`). Remove the wildcard CORS header. Move to `StreamableHTTPServerTransport` (see D1) |
| SEC-1b | `docker-compose.yml` publishes 3000 on every interface | ✅ fixed | Publish `127.0.0.1:3000:3000` and pass through `MCP_AUTH_TOKEN` |
| SEC-2 | `download_attachment` writes to any `outputPath`; `filename` can escape the folder with `../` | ✅ fixed | Write only inside `data/downloads` (or `FUSEBASE_DOWNLOAD_DIR`); use `path.basename(filename)`; reject a resolved path outside the root |
| SEC-3 | `get_guide` reads any `.md` file on disk through `..` in section or slug | ✅ fixed | Allow-list section and slug with `^[a-z0-9-]+$`, plus a check that the resolved path stays inside the root |
| SEC-4 | Profile names become file paths (`cookie_${profile}.enc`) | ✅ fixed | Validate with `^[A-Za-z0-9_-]{1,64}$` in `crypto.ts` and in `switch_active_profile` |
| SEC-5 | IDs are put into URL paths without encoding (`..` reaches other endpoints) | ✅ fixed | Add a `path\`…\`` tagged-template helper that encodes each segment, and use it for every URL built in `client.ts` |
| SEC-6 | `cli-manager` uses `shell: true` for `.cmd`/`.bat` CLIs with model-supplied arguments; `cwd` is unrestricted | ✅ fixed | Never use a shell. For a `.cmd` shim, find the underlying `node` + script and spawn that directly. Validate arguments; limit `cwd` to an allow-list (default: `apps/`) |
| SEC-7 | The local proxy relay accepts any local process and forwards stored proxy credentials | ✅ fixed | Bind to an ephemeral loopback port and require a per-process random token (`Proxy-Authorization`) |
| SEC-8 | Test logs print token and cookie prefixes | ✅ fixed | Covered by TST-6 |
| SEC-9 | The `summarize-page` prompt embeds unbounded, untrusted page content | ✅ fixed | Truncate the content and wrap it in clear delimiters marking it as data |

**Exit criteria:**
- The SSE probe (`scratchpad/sse-probe.mjs`, moved into `tests/`) shows: not reachable on the LAN by default, 401 without a token, and 403 on a foreign Host or Origin.
- Unit tests cover every path-traversal case.

---

## Phase 2: Stop data loss and duplicate writes (L)

> **Status (branch `fix/phase-2-data-integrity`):** implemented; every finding reproduced with a failing test first (COR-1: 8 duplicate-write scenarios; COR-2: 7; COR-9: 4; COR-17: 3; COR-18: 3). Needs live confirmation:
> - COR-1: fallbacks now happen only on a rejecting 4xx (not 408/409/425/429) or a connection that never opened (`src/write-safety.ts`). Gate business errors are surfaced instead of being retried over REST. The plan's "reuse noteId" idea wasn't needed: the second route is only used when the first provably created nothing.
> - COR-12 / D5: no Gate "replace note content" operation is known, so token-only `update_page_content` with `replace` returns a clear error; markdown appends and `create_page` content go through Gate. Confirm live whether Gate has a replace operation.
> - COR-9: the row-order endpoint (`PUT /dashboards/:id/rows/order`, body `sort_order`, 1-based) comes from the official dashboard SDK in `apps/`; the tool was sending `order`. Unverified live.
> - COR-17 / COR-18: `fusebase_swarm_init` now creates Status/Role label columns and groups the view as kanban; label cells are sent as arrays of label nanoids. Unverified live: whether `setViewGrouping` switches the default view to kanban.

*These are the bugs that corrupt or duplicate data in someone's workspace. They come before content fidelity.*

| ID | Finding | Status | Fix |
|---|---|---|---|
| CON-1 | Formatting bleeds into the following plain text (`attributes: undefined` makes the text take the formatting of the character before it) | ✅ fixed | `yjs-ws-writer.ts:150-155`: always pass `attrs` (`{}` when empty); also check the embed path |
| CON-9a | Whitespace-only markdown with `replace: true` wipes the page | ✅ fixed | Refuse an empty block list when replacing unless `allowEmpty: true` is passed |
| COR-12 | Page content can't be written in token-only mode (`update_page_content`, `create_page`, `create_interactive_app_page` are cookie-only); `create_page` reports success when `contentWritten: false` | ✅ fixed | Route every write through `client` so that cookie → WS and token → Gate `appendWorkspaceNoteContent`. Find out live whether Gate has a replace operation (see D5). Return `isError` when content was requested but not written |
| COR-1 | Retrying a failed write by another route after *any* error runs it twice (isolated SQL, migrations, createIsolatedStore, createPage, createFolder, runAiAgentTask, triggerAutomationFlow) | ✅ fixed | Fall back only on errors raised before the request was sent (DNS, connect, 401 before send). Never fall back on a timeout or 5xx after sending. Reuse the generated `noteId` so a retry is idempotent |
| COR-11 | SQL write tools default to `stage: "prod"` and `dryRun: false` | ✅ fixed | Make `stage` required, with no default (see D3) |
| COR-2 | `addDatabaseRow`: substring alias match ("deals" matches "Ideal"); `viewId` taken from a different table after a failure; unknown columns passed through; always returns `success: true` | ✅ fixed | Match exactly (case-insensitive) with an explicit alias map; fail if the table can't be resolved; reject unknown columns and list the valid ones |
| COR-3 | `importCSV`: a 200 on the probe GET counts as success with no upload; `.json()` then `.text()` on the same body throws | ✅ fixed (live: also moved `mapping` into the multipart body as JSON, per the SDK) | Remove the GET; POST the multipart form through `request()`; read the body once with `text()` then `JSON.parse` |
| COR-9 | `unlink_database_rows` with no IDs deletes every link on the relation; `updateDashboardRowOrder` uses a path that doesn't match its docstring | ✅ fixed | Require explicit row IDs (add a separate `unlinkAll: true` flag); check the path against a live capture |
| COR-10 | `process.exit(1)` inside `getClient()` lets one tool call kill the server | ✅ fixed | Throw a typed `ConfigError` instead; the SDK turns it into `isError` |
| COR-17 | `fusebase_swarm_init` creates a plain database: no status column, no stage options, no kanban view, no role column. It still reports the stages as if they were created, so `fusebase_swarm_task_transition` has nothing to move cards along | ✅ fixed | Create a single-select status column with the template's stages, a kanban view grouped by it, and a role column; return their keys. Or reduce the tool's claims to what it does |
| COR-18 | Label (single/multi-select) cells were written as bare strings, but the API needs an array of label nanoids (a bare string is a 400 per the dashboards SDK docs). Broke `fusebase_swarm_task_transition`, `move_kanban_card` and label updates through `update_database_cell` | ✅ fixed | `updateDatabaseCell` maps label names or IDs (single or array) to an array of nanoids and rejects unknown options, listing the valid ones |
| COR-19 | `check_session_health` ran the Gate check and `listWorkspaces` in one `try`: a rejected token skipped the workspace check, so a working cookie session was reported as EXPIRED. `gateConnected` only meant "a token is configured" | ✅ fixed (found live) | Each route checked separately; partial failure is `WARNING` with `gateError`; `gateConnected` means the Gate call succeeded |
| COR-20 | `add_relation_column` created the relation in the wrong direction (source = the table getting the column). FuseBase needs source = the table fetched from, target = the table the column is on; the view update then failed with "Dashboard view not found". Hidden by a swallowed catch until Phase 0 | ✅ fixed (found live) | Swap direction in `addRelationColumn` (per the dashboards SDK relations guide) |
| COR-21 | `create_dashboard_table` is broken for any input: with a database ID it posts to `/dashboards/<databaseId>/views` (404); with a table ID it creates a view and fails with 500 "global_id is required". It never created a table. Hidden by a swallowed catch until Phase 0 | ✅ (found live) | Reimplement with `POST /dashboards` (`database_id`, `root_entity: custom`, schema) or `createDashboardFromTemplate`; needs live exploration. Tracked as `knownGap` in both live suites |
| COR-22 | `update_page_tags` sent the tag array as the body; the endpoint takes `{ tag }` per call, so it stored a literal tag "undefined" and never set the requested tags | ✅ fixed (found live, contract probed) | PUT `{ tag }` adds, DELETE `/tags/{tag}` removes; replace = diff current vs desired |
| COR-23 | `refresh_auth` launches a browser and can run past the 60 s MCP request timeout, so clients see a timeout even when the refresh succeeds | ✅ (found live) | Return quickly and refresh in the background, or report progress; live suite now runs it only with `FUSEBASE_TEST_REFRESH_AUTH=1` |
| COR-24 | Gate isolated-store calls didn't follow the Gate SDK contract: `createIsolatedStore` sent its fields flat ("Unrecognized keys: alias, engine, storeType, source") and migrations sent `bundle`/`dryRun` outside `body`. Before COR-1 the Gate error was hidden by a REST retry that 404'd. Token-managed stores must also use `sourceType: "app"` | ✅ fixed (found live) | Wrap request fields in `body` per the SDK; default the store source to the token's app scope from `whoami` |
| COR-25 | `fusebase_work_run_agent` / `fusebase_work_scrape_url` never worked: the thread endpoint requires `workspaceId` in the query, and the fallback `/v4/api/proxy/ai-service/.../run` doesn't exist (it only masked the real error). The scraper also fell back to a hardcoded agent ID from another org | ✅ partly fixed (found live) | `workspaceId` is now a required tool parameter; dead fallback and hardcoded agent removed. Still open: the POST body the server expects (it answers 500) — capture the web app's request. Tracked as `knownGap` |

**Exit criteria:**
- Offline test: a markdown → Y.Doc delta test shows no formatting bleed.
- Live, in token-only mode: create, update and append page content round-trip.
- Live: a CSV import round-trip adds rows.
- An idempotency test runs `create_page` with an injected timeout and still produces exactly one page.

---

## Live verification (2026-09-23, sandbox "Agent Projects", cookie session + Gate/Dashboards tokens)

| Suite | Result |
|---|---|
| Block regression | ✅ 31/31 (known gaps: CON-2 tables, CON-3 collapsible-heading body) |
| MCP end-to-end | ✅ 189/189, 49 tools |
| Database & relations | ✅ 138/138, 40 tools (known gap COR-21) |
| Data validation | ✅ 269/269, 154 of 175 tools; 21 skips with stated reasons (hosted-app CLI mutations, real-email invites, undeletable SQL store, cookie-rewriting refresh); known gaps COR-21, COR-25 |
| Direct token | ✅ 10/10 |
| Token vs cookie parity | ✅ every row measured; replace-content, Y.js socket and automation auth verified cookie-only |

Bugs that only showed up live, each reproduced offline with a failing test first: COR-5, COR-19, COR-20, COR-22, COR-24, COR-25 (partly), the CSV `mapping` format (COR-3), MCP-12 (partly). Still open: COR-21, COR-23, COR-25 body. Also corrected response shapes the rewritten suites had guessed (task lists, comment threads, whoami, token list/create, isolated stores) and noted that the raw web folder list prefixes ids with `notesFolder#` (the `list_folders` tool strips it; part of COR-6).

**Token audit (same day).** All 22 Gate tokens were traced to a source: 17 app-minted tokens (one per app load/deploy), a CLI-created full-access pair from another agent's project set-up (now reused here), 2 manual Paperclip tokens (confirmed by the owner) and a leftover test token. 11 known-safe tokens were revoked (the leftover test token and never-used duplicate app tokens, keeping the newest per app). Likely cause of the original dead tokens: the FuseBase CLI appears to replace the org's MCP token pair whenever it sets up a project.

## Phase 3: Content fidelity (L)

> **Status (branch `fix/phase-3-content-fidelity`):** implemented and verified live (block regression 51/51 with no known gaps, including a read → markdown → write → read round trip; all six live suites pass).
> - D2 applied: the parser is `mdast-util-from-markdown` + GFM, mapped onto the existing IR (two-pass, so a 200 KB paragraph parses in ~80 ms).
> - Writes are confirmed by re-reading the page and checking the server's state vector holds our client's updates; an unconfirmed write returns `unconfirmed: true` instead of a guess. Per-page in-process lock added.
> - Also fixed while here: `<br>` exported as a CommonMark hard break so line breaks survive read → write; `javascript:` / `data:` / `file:` link URLs are dropped (text kept); an empty page is no longer reported as a read failure.
> - IR limits still open: numbered-list start numbers are dropped (`ListBlock` has no start), nested task lists are flattened (`ChecklistItemBlock` has no indent), formatting spanning a 5 KB chunk boundary in a >10 KB paragraph stays literal. Not verified: how FuseBase's own web editor renders non-paragraph blocks nested in toggles (our reader round-trips them).

| ID | Finding | Status | Fix |
|---|---|---|---|
| CON-6 | Inline parser: underscores inside words become emphasis, `2 * 3 * 4` becomes italic, `==` becomes a highlight, parentheses in URLs break links, no nesting, no `\` escapes, and an image after text becomes a link | ✅ fixed | Replace the hand-written regexes with `mdast-util-from-markdown` + `mdast-util-gfm` (see D2) and map mdast to the block IR |
| CON-7 | Block parser: CRLF not handled, `<details>` edge cases, single-column tables, escaped `\|`, number coercion (`001` becomes 1), adjacent blockquote lines split, list continuations, tab indentation, checklist nesting, numbered-list start, `~~~` fences, soft-wrapped lines | ✅ fixed | Mostly fixed by the mdast switch. Add `\r\n` normalisation. Keep cell values as strings unless a column is explicitly numeric |
| CON-3 | Nested children are written as the literal "(nested block)"; heading children are dropped on read | ✅ fixed | Make `addBlocksToDoc` recursive over a target children array; make the decoder output both heading text and children |
| CON-2 | Tables decode to `[Table: inline table]`, so reading a page and writing it back erases tables | ✅ fixed | Decode `columns`, `rows` and cell `children` into `<table>`, and emit GFM tables in markdown |
| CON-8 | Read path: checklist state lost, image captions dropped, hint and callout lost, `htmlToMarkdown` destroys an image followed by italic (`<i[^>]*>` matches `<img>`), tables flattened, nested lists flattened, a decode failure returns `success: true`, `style` values not escaped | ✅ fixed | Replace the regex `htmlToMarkdown` with `turndown` (already a dependency) plus the GFM plugin, or better, produce markdown straight from the IR. Escape style values. Report a decode failure as an error |
| CON-4 | A write counts as successful 3 s after sending, with no check the server accepted it; the token fetch has no timeout; a duplicate step 2 writes twice; a step 2 after the timeout still writes; closing after the update is reported as failure | ✅ fixed | Add a `wrote` guard; remove the listeners once done; put `AbortSignal.timeout` on the token fetch; confirm the write by sending SyncStep1 and checking the server's state vector includes our clientID and clock; report different errors for "closed before the update" and "closed after the update" |
| CON-5 | Concurrent `replace` writes interleave; there is no per-page lock | ✅ fixed | Add an in-process per-page async mutex; document that `replace` only removes what the writer had seen |
| CON-9b | Repeated unclosed `<u>` takes quadratic time; step 2 is encoded as V2 while updates are V1 | ✅ fixed | Linear scan; confirm live which encoding the server expects |

**Exit criteria:**
- Offline golden round-trip tests (markdown → IR → Y.Doc → HTML → markdown) for every block type in `content-schema.ts`, including tables, nesting, checklists, CRLF and escapes.
- Live: write a kitchen-sink page, read it back, and diff.

---

## Phase 4: HTTP, auth and credential layer (L)

> **Status (branch `fix/phase-4-transport-auth`):** implemented and verified live (all six live suites pass in the sandbox; direct token 10/10, MCP 189/189, block regression 51/51, database 139/139, data validation 269/269).
> - Every web API call now goes through one `send()` path (headers, timeout, proxy, 401/login-redirect refresh, logging); `request()` adds parsing. Cookie refresh is single-flight per host and profile; the rate limiter reserves slots so concurrent calls stay spaced.
> - `src/index.ts` is now a thin entry point: `src/server.ts` builds one MCP server per session (its own active profile), `src/client-factory.ts` builds clients and caches Gate bridges per token set.
> - Credential store: random key in `data/.key` (owner-only ACL checked on Windows) or `FUSEBASE_SECRET_KEY`; files are written as `v2:` blobs, atomically. Legacy files (including other drive-letter spellings of the path) are read, backed up once to `*.legacy-bak`, and re-encrypted. All 12 local credential files migrated during the live run. `FUSEBASE_DATA_DIR` moves the directory. `data` added to `.dockerignore` (it was being copied into images).
> - Found live and fixed: `/v1/portals/orgs/{org}/available` returns `true` labelled `text/html`, so HTML is now detected from the body, not the header. The agent public-profile endpoint sends JSON cut off mid-string (server-side; Content-Length matches), so that one tool returns the complete top-level fields with `_truncated: true` instead of failing; everything else treats truncated JSON as an error.
> - Also fixed: three prompts (`launch-client-portal`, `workspace-activity-digest`, `audit-page-governance`) read the wrong response shapes, so their workspace context was always empty; `get_org_trials` advertised an `orgId` argument the endpoint can't take (removed); the parser performance bounds were loosened to 500 ms (they guard against a multi-second quadratic, and 200 ms failed under a loaded test run).
> - CLI: the real CLI has no `logs` command. `fusebase_cli_logs` now maps to `remote-logs runtime|build`; `dev` returns an error. Not done: `fusebase init` supports `-y/--yes`, which the tool doesn't pass.
> - Still to check live: the exact Gate "session missing" wording (the regex also covers the MCP SDK's phrasing), and the Gate UNAUTHORIZED payload shape. In token-only mode `list_pages` shows 1970 dates because Gate returns no timestamps, and the Gate `listPages` fallback still ignores `rootId`.
> - Exit criterion "all three auth modes" is partly met: the parity suite runs token-only and cookie-only side by side; a separate hybrid-only run was not done. The parity table is generated from results.

| ID | Finding | Status | Fix |
|---|---|---|---|
| COR-4 | 8 raw `fetch` calls skip `request()` (no proxy, no bearer token, `cookie: ""`, no 401 refresh, not logged); `downloadAttachment` loads the whole file into memory with a 10 s timeout | ✅ fixed | Send everything through `request()`, with a raw-body/stream option for downloads |
| COR-5 | Several 401s at once each start their own Playwright refresh; `authorization` and `Authorization` headers get merged; dead code at 292-301 | ✅ fixed | Share a single `refreshPromise`; build headers with a `Headers` object; remove the dead code |
| COR-6 | Gate fallback results have the wrong shape (`id` vs `workspaceId`, `global_id/title` vs `id/name`); hardcoded workspace `45h7lom5ryjak34u` and agent `qMjAPHPS1e6UdoYf` | ✅ fixed | Add a normaliser per entity, with typed mapping and no `as unknown as`; remove the hardcoded IDs (resolve them or fail) |
| COR-7 | gate-bridge: no fetch timeout; re-initialises and resends `tools/call` after any 400/404; SSE parser reads only the first `data:` line; `init` not memoised | ✅ fixed | Add a timeout; re-init only on a session-expired signal; parse SSE properly; memoise the init promise |
| COR-8 | `tryRepairTruncatedJson` returns partial data as success; a non-JSON 200 is returned as `T`; an HTML login redirect could look like data | ✅ fixed | Treat these as errors (`redirect: "manual"`, check content-type); remove the truncation repair or return a `truncated: true` error |
| COR-13 | `_activeProfile` is shared across SSE sessions; the Gate bridge ignores the profile | ✅ fixed | Keep profile and bridge state per session (passed through `createFusebaseServer`), and look up bridges per profile |
| COR-14 | CLI: `init` wraps the name in literal quotes; `getLogs` ignores `type`; on Windows the timeout kills only `cmd.exe` | ✅ fixed | Fix the arguments; use `taskkill /T` or kill the process tree |
| COR-15 | proxy-relay: IPv6 fallback produces NaN bytes; `split(":")` breaks on IPv6; credentials over 255 bytes overflow; no early `error` listener | ✅ fixed | Fix all of these and add unit tests with a fake SOCKS server |
| COR-16 | Silent catch at client.ts:171; misleading "No authentication configured" message; rate limiter not safe under concurrency; `Math.random` keys; `getOrgTrials` ignores `orgId` | ✅ fixed | Fix each; use `crypto.randomUUID()` for keys |
| SEC-10 | Stored-credential key comes from hostname, username and path: any process running as the user can decrypt, and moving the folder or changing case, or running in Docker, makes the files unreadable; synchronous PBKDF2 on every load | ✅ fixed | Random 256-bit key file `data/.key` (0600, with a Windows ACL via `icacls`) or `FUSEBASE_SECRET_KEY` env var (Docker); cache the key; migrate by trying the legacy key and re-encrypting (see D4) |

**Exit criteria:**
- All live suites pass in all three auth modes (token-only, cookie-only, hybrid).
- The parity table is generated from the actual results, not hand-written.

---

## Write verification and the validation gate (2026-09-24)

The owner's rule: every write a test makes must be proven by a separate read showing the data
was stored as intended. A write's own response is not proof. Nothing is committed or pushed
without passing validation. See [TESTING.md](TESTING.md).

> **Status:** done. All seven live stages pass with every write proven by a fresh read: MCP
> end-to-end 17, database 36, data validation 65 (two exempt with stated reasons: triggers on draft
> automation flows, which FuseBase never runs), and the leftover sweep finds nothing. Proving the
> writes found seven real bugs (CON-10, COR-26 to COR-29, MCP-13, MCP-14), listed below.

| ID | Finding | Status | Fix |
|---|---|---|---|
| TST-11 | All six live suites passed while none of their ~130 writes was proven by a read of the stored data (111 write sites) | ✅ fixed | The harness records every successful write; `verifyWrite()` must prove each with a fresh read of the specific values (retried); `noReadBack()` only with a stated reason; unproven writes fail the suite |
| TST-12 | Nothing checked that tests cleaned up; a killed run left content behind silently | ✅ fixed | `scripts/sweep-sandbox.ts` (last live stage) reads FuseBase directly and fails on anything created during the run; reports test-named orphans; `--clean` deletes only test-named items |
| TST-13 | No gate: code could be committed and pushed without running the checks | ✅ fixed | `.githooks/pre-commit` (offline checks) and `.githooks/pre-push` (offline + live suites under one `op run`), installed with `npm run hooks:install` |
| TST-15 | Two live runs at once in one sandbox interfered (each sweep saw the other's content; both flipped the same account setting) | ✅ fixed | `test-all` takes a lock; a second live run is refused while one is in progress |
| TST-14 | Some checks passed without proving a change: move a page to where it already was, reorder a row that was already first, write the sidebar setting with its current value | ✅ fixed | Make a visible change, read it back, then restore and read back |
| CON-10 | `update_page_content` (replace) intermittently left behind content appended just before it: the replace deletes only the blocks in its copy of the page, and a just-confirmed append hadn't reached that copy | ✅ fixed, verified live | After a confirmed replace, re-read the page and remove top-level blocks it didn't write (up to two passes, each confirmed); report failure if any remain. Unit test reproduces the race. Found on the next live run: a delete-only update was never sent (deletes don't advance the Y.js clock, which the writer used as "nothing to write"); fixed by checking the delete set, and the removal is confirmed by re-reading. Write confirmation now waits up to ~10 s with back-off (was 3.5 s) |
| MCP-13 | `get_comment_threads` promised "nested comments" but returned only counts, so nothing could prove a comment was stored | ✅ fixed | Each thread now includes `commentList` (id, plain text, replyTo, userId, createdAt) from the comments endpoint |
| SEC-11 | Gate errors relayed FuseBase's internal request objects to MCP clients and logs, including an internal Authorization header and what looks like a service secret (FuseBase-side leak; worth reporting to them) | ✅ fixed on our side | `redactUpstreamDetail()`: keep message/name/code/status, redact secret-looking values, cap length |
| COR-26 | `move_page` into a folder: FuseBase recreates the page under a **new id** (a background operation) and the old id returns "Note not found", but the tool reported success with the old, dead id | ✅ fixed, verified live | `movePageAndResolve()` finds the page afterwards (same id still readable, or the new page with the same title created since the move in the destination) and returns `pageId`, `previousPageId`, `idChanged`; fails loudly if it can't be found |
| COR-27 | `move_page` to `root` (as its own description instructed) was silently ignored by FuseBase: the page stayed in its folder, and the tool reported success. Top-level pages live in the built-in `default` (Unsorted) folder; the `root` page listing also covers the whole workspace, not just the top level | ✅ fixed, verified live | `moveDestination()` sends top-level moves to `default`; a move only counts when the page is found in the destination; tests use the `default` listing for the top level |
| COR-28 | `add_database_row` without initial values created the row but returned no `rowUuid` (FuseBase only reports ids for written values), so the caller couldn't refer to the new row | ✅ fixed, verified live | For an empty row, note the existing row ids first and return the one new id; a `note` explains when it can't be identified |
| COR-29 | `publish_page_to_portal` reported "published" but never changed anything: it sent `is_portal_share` (snake_case), which the upsert endpoint silently ignores | ✅ fixed, verified live | Send camelCase `isPortalShare` (confirmed live: both `isPortalShare` and `isSharedForPortal` become true) |
| CON-11 | A replace right after an append (same process) could report success while the append stayed on the page, or be reported unconfirmed: FuseBase's editor servers briefly handed the replace a copy without the append, and reading back through the same lag couldn't detect it. Caught by the push gate; reproduced in the sandbox | ✅ fixed | The writer remembers the state it last wrote per page, merges it into the copy it receives, and sends everything that copy lacks. Reads never use this state, so read-backs still come from FuseBase. Unit tests reproduce the race, show the fix on lagging and up-to-date copies, and that no deleted content is resurrected |
| MCP-14 | Tools silently ignored arguments callers passed: `duplicate_database` title, `create_view` view type, `search_tasks` query; `fusebase_swarm_task_transition` echoed its audit comment and handover but stored neither; `list_folders` dropped subfolders | ✅ fixed | Added `title`, `representationType`/`groupByColumnKey`, `query`; swarm init creates an Audit Log column and the transition appends to it and sets Role (`auditStored`/`handoverStored` in the response); `list_folders` returns the full tree |

---

## Token-only coverage (2026-09-25)

Measured which tools work with only Gate and Dashboards tokens: **14 of 129 exercised** ([TOKEN-COVERAGE.md](TOKEN-COVERAGE.md)). The measurement also found three silent wrong answers in token mode.

| ID | Finding | Status | Fix |
|---|---|---|---|
| TST-16 | README claimed "Token vs Cookie Parity 100% Verified" from 11 capabilities; nothing measured the tools | ✅ fixed | Coverage mode in the live harness (`LIVE_TOKEN_COVERAGE=1`) and `scripts/token-coverage-report.ts`; badge shows the measured figure |
| COR-30 | `list_pages` with a folder in token mode returned the top-level pages: the Gate fallback never passed `parentId` | ✅ fixed | Pass the folder as `parentId`; "root" lists the top level (Gate has no workspace-wide listing) |
| COR-31 | `resolve_database_alias` reported `found: false` when the database list couldn't be read | ✅ fixed | `lookupError` on the resolution; the tool reports it as an error; internal callers still fall back |
| COR-32 | `get_user_preferences` / `get_billing_info` turned every request error into `null` | ✅ fixed | `readParts()`: throw when all parts fail, name failed parts in `unavailable` |
| P5-14 | 41 database tools call the web app's dashboard service, which rejects tokens, though the Dashboards MCP has operations for most of them | Open (P1 for a hosted edition) | Route rows, cells, relations, row order, view data, tables and views through the Dashboards MCP in token mode |
| P5-15 | About 75 tools have no official token route (tasks, comments, tags, members, usage, page rename/move/delete, automations, most portal tools) | Open (needs FuseBase) | Raise with FuseBase; a hosted edition can't offer them until official routes exist |
| TST-17 | Intermittent: after a move into a folder, the top-level listing still showed the page after 15 s (read through the cookie), in one coverage run | Watch | Seen once; if it recurs in normal runs, lengthen that verification's timeout |

---

## Phase 5: MCP best practices and tool-layer refactor (L)

This is done together with the refactor. Adding annotations and output limits one tool at a time across 141 hand-written handlers would add yet more duplication.

| ID | Finding | Status | Fix |
|---|---|---|---|
| MNT-1 | `extended-tools.ts` (3.5k lines) repeats the same boilerplate 141 times; `client.ts` is a single class of about 4.6k lines | ✅ | One `defineTool({ name, title, schema, annotations, run })` wrapper that handles `getClient`, errors, truncation and compact JSON. Split the tools into `src/tools/<domain>.ts` and the client into per-domain modules (`pages`, `databases`, `automations`, `portals`, `gate`) sharing one transport |
| MCP-1 | 0 of 175 tools have annotations; 13 destructive tools have no `destructiveHint` | ✅ | Move to `registerTool` with `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint` on every tool, plus a unit test that fails if a tool named `delete\|revoke\|remove\|unlink\|execute` lacks `destructiveHint` |
| MCP-2 | Outputs have no size limit (about 130 pretty-printed `JSON.stringify` dumps, full CSV, base64 attachments) | 🔎 | Compact JSON, a default output cap (about 25k characters) with a truncation notice and a pagination hint, `maxLength` default on `get_page_content`, and `saveToDisk` for large blobs |
| MCP-3 | Enabling the full tier sends 141 `list_changed` notifications; no way back to core; `/health` reports the tier from an env var | ✅ | Register every tool at startup and `disable()` the extended ones; switch tiers with one enable/disable batch and a single notification; allow switching back to core; report the tier per session |
| MCP-4 | Deprecated `server.tool()` and `SSEServerTransport` | ✅ | Covered by MNT-1 and SEC-1 |
| MCP-5 | Descriptions don't match behaviour: `set_tool_tier` counts; `create_task`/`update_task` advertise assignees and due dates; `get_recently_updated_notes` claims pagination; `search_guides` counts; `swarm_task_transition` doesn't save comment or next role; `status` resource hardcoded as OPERATIONAL | ✅ (tier counts) / 🔎 | Implement or remove each advertised parameter; compute counts at runtime; add a test that checks descriptions against the schema |
| MCP-6 | Prompts with `z.number()`/`z.boolean()` arguments reject every call | ✅ | Use `z.coerce` or string enums |
| MCP-7 | Two "legacy" resource templates can never be reached | 🔎 | Remove them (or give them different URI patterns) |
| MCP-8 | `dashboardId` means a database ID in some tools and a table ID in others; `delete_relation` ignores it | 🔎 | Standardise on `databaseId` / `tableId` and keep the old names as deprecated aliases for one release |
| MCP-9 | No SIGINT/SIGTERM handling; the HTTP server is never closed | ✅ | Graceful shutdown: close transports, the HTTP server and the relay |
| MCP-10 | Resources that can be created but not deleted through MCP: folders (no `delete_folder`; `delete_page` on a folder ID is unverified), isolated SQL stores, portals, portal clients / invites | ✅ (tool list) | Add the missing delete tools with `destructiveHint`, or confirm live that `delete_page` removes folders and document it |
| MCP-11 | 13 tools don't accept the `profile` parameter, so multi-profile use is inconsistent | ✅ (audit) | Add `profile` where the tool touches FuseBase; document the local-only exceptions. Enforce in `audit-tools.ts` once done |
| MCP-12 | Tools that return empty or misleading text: `delete_automation_flow` returned `""` on success and `get_active_import_status` returned `""` when idle (both fixed live); `fusebase_gate_whoami` returned an `UNAUTHORIZED` payload as a normal result instead of `isError` (fixed in Phase 4: `whoami()` throws on an RPC error, `isError` or `ok:false`). `listTaskLists` was typed as an array but returns `{ taskLists, tasks, ... }` (fixed in Phase 4: `FusebaseTaskListsResponse`) | ✅ fixed | Return an explicit message/`null`; set `isError` for upstream auth errors; fix the types |

**Exit criteria:**
- Every tool has annotations.
- The protocol probe shows one `list_changed` per tier switch, and switching back to core works.
- The `tools/list` payload for the full tier is smaller than today's roughly 119k characters (set a target once measured).

---

### Phase 5 additions: MCP best-practice gap analysis (2026-09-25)

The MCP specification's current revision is **2026-07-28**, which makes the protocol stateless: no `initialize`, no session id, and `tools/list` must not change per connection or as a side effect of other requests. That affects two designs here: the per-session tool tier (`set_tool_tier`, MCP-3) and the per-session active profile (COR-13). SDK: 1.26.0 is installed; the latest 1.x is 1.30.1 (security fixes: request body limits, SSE keep-alives, a dependency advisory); v2 (split packages, 2026 spec) is current, and 1.x gets fixes until about January 2027.

| ID | Finding | Priority | Fix |
|---|---|---|---|
| P5-1 | SDK 1.26 with range `^1.0.0`; `zod` undeclared | P0 | Bump to `^1.30.1`; declare `zod ^4.2`. Write the refactor against APIs present in both 1.x and v2 (`registerTool`, `enable()/disable()`), then migrate to v2 as its own step (P5-12) |
| P5-2 | `fusebase_direct_tool_call` runs any Gate/Dashboards operation, bypassing every other safeguard | P0 | `destructiveHint`, and an allow-list or separate read/write variants |
| P5-3 | HTTP sessions are never evicted: after 50 abandoned sessions every new client gets 503; no rate limit on tool calls (the spec requires one) | P0 | Idle TTL and maximum session age; per-principal rate limit |
| P5-4 | Over HTTP, callers can pick any stored profile, spawn CLI processes, start a browser login, and write host paths | P0 | A "remote mode": disable the CLI/local toolsets and saving to disk; bind the profile to the authenticated principal |
| P5-5 | `fusebase_token_create` and `fusebase_cli_secret_create` return secrets into model context | P0 | Mark with `audience: ["user"]`, return once, redact from logs |
| P5-6 | `tools/list` for all tools is 121k characters (the `profile` parameter alone is 11%); 48 tools have no required parameter (alias pattern); unbounded numbers; 18 `unknown`/`any` inputs | P1 | Canonical required ids with aliases via `z.preprocess`; `.int().min().max()`; strict objects; enums; a real schema for `blocks`. Budget: ≤ 60k characters for all tools |
| P5-7 | No `outputSchema`/`structuredContent`; outputs are pretty-printed JSON | P1 | Structured output for ~20 high-traffic tools (compact JSON also in the text block) |
| P5-8 | Output caps must truncate data, not strings (MCP-2 detail); `list_pages` has no `hasMore`; `get_page_content` defaults to HTML; `export_csv` and attachments uncapped | P1 | `capList()` with `truncated` and `nextCursor`; markdown default with `maxLength`/`offset`; resources or resource links for blobs |
| P5-9 | No cancellation or progress | P1 | Pass the request's abort signal through the client, writer and CLI; progress notifications for long operations |
| P5-10 | Resources and prompts use the removed `server.resource()`/`server.prompt()`; no completions; page resource served as HTML | P1 | `registerResource`/`registerPrompt`, completions for ids, markdown |
| P5-11 | Tool outputs carrying page content, comments or activity aren't marked untrusted; errors thrown before a handler's `try` are unredacted; `instructions` hard-code counts | P1 | Delimit untrusted content; one error mapper in `defineTool`; generate `instructions` from the registry |
| P5-12 | Adopt SDK v2 and the 2026-07-28 spec | P2 | `createMcpHandler` (stateless; 2025 clients still served), `serveStdio`; drop `/sse` (deprecated in the spec); toolsets from configuration or auth scopes instead of `set_tool_tier`; profile from the principal |
| P5-13 | Remote/public hosting needs real auth | P2 | OAuth 2.1 resource server (external authorization server, protected-resource metadata, audience check, scopes from each tool's access level) for multi-user; a long static bearer token is acceptable for a private single-user deployment |
| MCP-15 | `fusebase_cli_secret_list` calls `fusebase secret list`, which doesn't exist (CLI 0.29 has only `create`/`delete`) | P1 | Read the app's declared secrets from `fusebase.json`, or remove the tool |

**Design for MNT-1 (`defineTool`):** each tool declares `name`, `title`, `description`, `toolset`, `access` (`read` / `write` / `destructive`), `idempotent`, `local`, an `input` zod object and optional `output` schema, and `run(args, ctx)`. The wrapper derives the annotations from `access` (so they can't drift), adds `profile` unless the tool is local, resolves the client inside one `try`, builds `ctx.signal` and `ctx.progress`, returns compact JSON plus `structuredContent`, caps outputs at the data level, and maps errors (config/auth with a fix hint, redacted upstream, validation, cancelled). Tools live in a static array per domain (`src/tools/<domain>.ts`); the audit and unit tests iterate the same array. Tier switching on 1.x: register everything, `disable()` what's off, and use `debouncedNotificationMethods` for a single `list_changed`.

---

## Phase 7: Hosting the MCP server in a FuseBase app (investigation, 2026-09-25)

**Verdict: feasible, with conditions.** A FuseBase app is a static SPA unless it has a `backend/` (a Node container, port 3000, on Azure Container Apps). A backend can have up to 3 sidecars (pre-built Docker images, reachable on `localhost`), secrets injected as environment variables, and WebSockets. Sources: the app's own skills (`apps/client-portal-dashboard/.claude/skills/app-backend`, `app-sidecar`, `app-secrets`, `fusebase-gate/references/fusebase-auth.md`) and `fusebase --help`.

Constraints that shape the design:
- Only `/api/*` reaches the backend, and it sits behind the platform's login wall, **except** `/api/webhooks/*`, which the proxy doesn't authenticate. An MCP client can therefore only reach `https://<app>/api/webhooks/<unguessable>`, and the server must enforce its own bearer token.
- The backend is **stateless** (ephemeral disk): token mode only (no saved cookie, no `data/*.enc`, no browser login), so cookie-only features (live page editing, automations) don't work.
- Up to **3 replicas** with no `maxReplicas`: in-memory sessions break without sticky routing, so the server needs a stateless HTTP mode (P5-12).
- A **30 s** proxy ceiling (CloudFront) on requests; long silent calls may be cut.
- Cold starts of about 10 s unless `minReplicas: 1`; backend apps are billed higher; every app deploy restarts the backend.
- The backend's own deploy address is publicly reachable without platform auth, so the bearer token is the real control.
- The app's own identity (`FBS_FEATURE_TOKEN`, sent as `x-app-feature-token`) is not a drop-in for our Gate/Dashboards MCP tokens; keep those as app secrets.

| Option | How | Notes |
|---|---|---|
| **1. Backend + sidecar (recommended to try first)** | Publish our Docker image to a public registry (GHCR); run it as a sidecar on `127.0.0.1:3001`; a small Hono backend forwards `/api/webhooks/mcp-<random>` to `/mcp`, streaming, passing `Authorization`, `mcp-session-id`, `mcp-protocol-version`, `accept`, `content-type`, `last-event-id` | No server code changes; secrets whitelisted to the sidecar |
| 2. The MCP server as the backend | Vendor `dist` into `backend/`; add a configurable base path (`/mcp` and `/health` are fixed today) | One container; directly reachable on the deploy address, so it relies on the token alone |
| 3. Host elsewhere | Our own container host or a tunnel, with the existing image | Persistent `data/` (cookie mode works); no replica or 30 s limits |

**Recommendation:** a separate app in the same FuseBase product (for example subdomain `fusebase-mcp-api`) rather than adding a backend to the status dashboard, so dashboard deploys don't restart the MCP server and the risks stay separate.

**Live experiments needed before committing:** whether the proxy passes `Authorization`/`mcp-session-id` and streams `text/event-stream` unbuffered on `/api/webhooks/*`; what the 30 s limit cuts; replica stickiness; the `Host` header the backend sees; pulling a sidecar image from GHCR and confirming a `127.0.0.1` sidecar isn't reachable from outside; the backend deploy address; the cost of a backend app with and without `minReplicas: 1`.

---

## Phase 6: Docs, packaging and honesty (M)

| ID | Finding | Status | Fix |
|---|---|---|---|
| DOC-1 | README and badges claim "100% verified" and give inconsistent counts (165/168/175 tools, 206/212 assertions) | ✅ | Generate counts and pass rates from test output (`scripts/generate-status-data.ts`); remove the hand-maintained badges; make the status resource show real data |
| DOC-2 | `GATE_MCP_TOKEN` vs `FUSEBASE_GATE_TOKEN` naming | ✅ | Use `FUSEBASE_*` names everywhere; accept the old names and warn that they're deprecated; one `config.ts` loader, validated with zod |
| DOC-3 | The plugin manifests say author "FuseBase" with homepage thefusebase.com, which reads as official; they say "MIT" but the repo has no LICENSE | ✅ fixed (manifests: maintainer, repo homepage, "unofficial"; MIT LICENSE added) | Set yourself as author and the GitHub repo as homepage, add "unofficial" to the description, add a `LICENSE` file (see D6) |
| DOC-4 | `package.json`: no `engines` or `license`; `zod` not declared; `@modelcontextprotocol/sdk` range `^1.0.0` too loose; `postinstall` downloads Chromium for every user; `turndown` unused (until CON-8) | ✅ partly fixed (`license`, `engines`, Playwright opt-in via `setup:browser`; `zod`/SDK range still open, see P5-1) | Fix each; make the Playwright install opt-in (`npm run setup:browser`) |
| DOC-5 | Docker: Playwright can't refresh cookies on alpine; host-encrypted credentials don't decrypt in the container | ✅ | Document Docker as token-mode only; use `FUSEBASE_SECRET_KEY` (SEC-10) |
| DOC-6 | Version hardcoded in 3 places | ✅ | Read it from `package.json` |
| DOC-7 | `loadDotEnv` doesn't handle quoted values and also loads `apps/client-portal-dashboard/.env` | ✅ | Use Node's built-in `process.loadEnvFile` (Node ≥ 20.12) and drop the apps coupling |
| DOC-8 | Dev tooling (vitest 5) needs Node ≥ 22.12, the Docker image uses `node:20`, and `package.json` has no `engines` field | ✅ fixed (image `node:22-alpine`, verified live; `engines: node >= 22.12`) | Declare `engines` (runtime ≥ 20.12); document Node 22+ for development; consider moving the image to `node:22-alpine` |

---

## Decisions needed

| # | Question | Recommendation |
|---|---|---|
| D1 | Keep legacy SSE (`/sse`) alongside Streamable HTTP? | **Yes, for one release**, behind the same auth; then remove it |
| D2 | Markdown engine: keep the hand-written parser or adopt a library? | **Adopt `mdast-util-from-markdown` + GFM.** Most CON-6/CON-7 findings disappear instead of being patched one by one |
| D3 | Breaking changes: `stage` required on SQL writes; `unlink_database_rows` requires IDs; `download_attachment` restricted to a download folder | **Accept all three.** Each one closes a data-loss or file-write risk |
| D4 | Credential key: random key file / env var, or OS keychain? | **Key file + `FUSEBASE_SECRET_KEY`.** Portable, works in Docker, no native dependencies; migrate existing files automatically |
| D5 | If Gate has no "replace note content" operation, what should token-mode `update_page_content` do? | Return a clear `isError` ("replace requires a cookie session") rather than quietly appending |
| D6 | License: is MIT intended? | Confirm; add `LICENSE` |

## Order and dependencies

```
Phase 0 (tests) ─┬─> Phase 1 (security)
                 ├─> Phase 2 (data integrity) ─> Phase 3 (content fidelity)
                 └─> Phase 4 (HTTP/auth) ─> Phase 5 (MCP + refactor) ─> Phase 6 (docs)
```

- Phases 1 and 2 can run in parallel.
- Phase 5 comes after 4 because the client split and the tool wrapper need the transport layer to be stable first.
- Phase 6 comes last so the docs describe what actually shipped.

## Live validation protocol (every phase)

1. Check the cookie is less than 20 hours old and the tokens are valid (`fusebase_gate_whoami`).
2. Run `npm run test:live` against `FUSEBASE_WORKSPACE_ID` in each auth mode the phase touches.
3. After the run, list the sandbox workspace and confirm nothing was left behind.
4. Paste the summary into the PR.
