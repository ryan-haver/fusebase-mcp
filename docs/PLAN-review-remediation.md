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
| P1 | Regenerate the Gate and Dashboards MCP tokens and put them in `.env` | The current tokens return `UNAUTHORIZED: Invalid token` |
| P2 | Get a fresh session cookie: `cd C:\scripts\fusebase-mcp; npx tsx scripts/auth.ts` (capital `C:`) | `cookie.enc` doesn't decrypt. The key depends on the project path, so the drive-letter casing must match how the tests run (see SEC-10) |
| P3 | Create a sandbox workspace and set `FUSEBASE_WORKSPACE_ID` in `.env` | So live tests never touch real data |
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

| ID | Finding | Status | Fix |
|---|---|---|---|
| SEC-1 | The SSE server binds `0.0.0.0`, sends `ACAO: *`, has no auth and no Host or Origin check. Confirmed live: an unauthenticated LAN client can list and call every tool | ✅ | Bind `127.0.0.1` by default (`--host` to override). When not on loopback, require `MCP_AUTH_TOKEN` (bearer) and refuse to start without it. Allow-list Host and Origin (SDK `hostHeaderValidation`). Remove the wildcard CORS header. Move to `StreamableHTTPServerTransport` (see D1) |
| SEC-1b | `docker-compose.yml` publishes 3000 on every interface | ✅ | Publish `127.0.0.1:3000:3000` and pass through `MCP_AUTH_TOKEN` |
| SEC-2 | `download_attachment` writes to any `outputPath`; `filename` can escape the folder with `../` | ✅ | Write only inside `data/downloads` (or `FUSEBASE_DOWNLOAD_DIR`); use `path.basename(filename)`; reject a resolved path outside the root |
| SEC-3 | `get_guide` reads any `.md` file on disk through `..` in section or slug | ✅ | Allow-list section and slug with `^[a-z0-9-]+$`, plus a check that the resolved path stays inside the root |
| SEC-4 | Profile names become file paths (`cookie_${profile}.enc`) | 🔎 | Validate with `^[A-Za-z0-9_-]{1,64}$` in `crypto.ts` and in `switch_active_profile` |
| SEC-5 | IDs are put into URL paths without encoding (`..` reaches other endpoints) | 🔎 | Add a `path\`…\`` tagged-template helper that encodes each segment, and use it for every URL built in `client.ts` |
| SEC-6 | `cli-manager` uses `shell: true` for `.cmd`/`.bat` CLIs with model-supplied arguments; `cwd` is unrestricted | ✅ | Never use a shell. For a `.cmd` shim, find the underlying `node` + script and spawn that directly. Validate arguments; limit `cwd` to an allow-list (default: `apps/`) |
| SEC-7 | The local proxy relay accepts any local process and forwards stored proxy credentials | 🔎 | Bind to an ephemeral loopback port and require a per-process random token (`Proxy-Authorization`) |
| SEC-8 | Test logs print token and cookie prefixes | ✅ | Covered by TST-6 |
| SEC-9 | The `summarize-page` prompt embeds unbounded, untrusted page content | 🔎 | Truncate the content and wrap it in clear delimiters marking it as data |

**Exit criteria:**
- The SSE probe (`scratchpad/sse-probe.mjs`, moved into `tests/`) shows: not reachable on the LAN by default, 401 without a token, and 403 on a foreign Host or Origin.
- Unit tests cover every path-traversal case.

---

## Phase 2: Stop data loss and duplicate writes (L)

*These are the bugs that corrupt or duplicate data in someone's workspace. They come before content fidelity.*

| ID | Finding | Status | Fix |
|---|---|---|---|
| CON-1 | Formatting bleeds into the following plain text (`attributes: undefined` makes the text take the formatting of the character before it) | ✅ | `yjs-ws-writer.ts:150-155`: always pass `attrs` (`{}` when empty); also check the embed path |
| CON-9a | Whitespace-only markdown with `replace: true` wipes the page | ✅ | Refuse an empty block list when replacing unless `allowEmpty: true` is passed |
| COR-12 | Page content can't be written in token-only mode (`update_page_content`, `create_page`, `create_interactive_app_page` are cookie-only); `create_page` reports success when `contentWritten: false` | ✅ | Route every write through `client` so that cookie → WS and token → Gate `appendWorkspaceNoteContent`. Find out live whether Gate has a replace operation (see D5). Return `isError` when content was requested but not written |
| COR-1 | Retrying a failed write by another route after *any* error runs it twice (isolated SQL, migrations, createIsolatedStore, createPage, createFolder, runAiAgentTask, triggerAutomationFlow) | 🔎 | Fall back only on errors raised before the request was sent (DNS, connect, 401 before send). Never fall back on a timeout or 5xx after sending. Reuse the generated `noteId` so a retry is idempotent |
| COR-11 | SQL write tools default to `stage: "prod"` and `dryRun: false` | 🔎 | Make `stage` required, with no default (see D3) |
| COR-2 | `addDatabaseRow`: substring alias match ("deals" matches "Ideal"); `viewId` taken from a different table after a failure; unknown columns passed through; always returns `success: true` | 🔎 | Match exactly (case-insensitive) with an explicit alias map; fail if the table can't be resolved; reject unknown columns and list the valid ones |
| COR-3 | `importCSV`: a 200 on the probe GET counts as success with no upload; `.json()` then `.text()` on the same body throws | ✅ | Remove the GET; POST the multipart form through `request()`; read the body once with `text()` then `JSON.parse` |
| COR-9 | `unlink_database_rows` with no IDs deletes every link on the relation; `updateDashboardRowOrder` uses a path that doesn't match its docstring | 🔎 | Require explicit row IDs (add a separate `unlinkAll: true` flag); check the path against a live capture |
| COR-10 | `process.exit(1)` inside `getClient()` lets one tool call kill the server | ✅ | Throw a typed `ConfigError` instead; the SDK turns it into `isError` |
| COR-17 | `fusebase_swarm_init` creates a plain database: no status column, no stage options, no kanban view, no role column. It still reports the stages as if they were created, so `fusebase_swarm_task_transition` has nothing to move cards along | ✅ (code read) | Create a single-select status column with the template's stages, a kanban view grouped by it, and a role column; return their keys. Or reduce the tool's claims to what it does |

**Exit criteria:**
- Offline test: a markdown → Y.Doc delta test shows no formatting bleed.
- Live, in token-only mode: create, update and append page content round-trip.
- Live: a CSV import round-trip adds rows.
- An idempotency test runs `create_page` with an injected timeout and still produces exactly one page.

---

## Phase 3: Content fidelity (L)

| ID | Finding | Status | Fix |
|---|---|---|---|
| CON-6 | Inline parser: underscores inside words become emphasis, `2 * 3 * 4` becomes italic, `==` becomes a highlight, parentheses in URLs break links, no nesting, no `\` escapes, and an image after text becomes a link | ✅ | Replace the hand-written regexes with `mdast-util-from-markdown` + `mdast-util-gfm` (see D2) and map mdast to the block IR |
| CON-7 | Block parser: CRLF not handled, `<details>` edge cases, single-column tables, escaped `\|`, number coercion (`001` becomes 1), adjacent blockquote lines split, list continuations, tab indentation, checklist nesting, numbered-list start, `~~~` fences, soft-wrapped lines | ✅ | Mostly fixed by the mdast switch. Add `\r\n` normalisation. Keep cell values as strings unless a column is explicitly numeric |
| CON-3 | Nested children are written as the literal "(nested block)"; heading children are dropped on read | ✅ | Make `addBlocksToDoc` recursive over a target children array; make the decoder output both heading text and children |
| CON-2 | Tables decode to `[Table: inline table]`, so reading a page and writing it back erases tables | ✅ | Decode `columns`, `rows` and cell `children` into `<table>`, and emit GFM tables in markdown |
| CON-8 | Read path: checklist state lost, image captions dropped, hint and callout lost, `htmlToMarkdown` destroys an image followed by italic (`<i[^>]*>` matches `<img>`), tables flattened, nested lists flattened, a decode failure returns `success: true`, `style` values not escaped | ✅ (img + italic, tables) / 🔎 | Replace the regex `htmlToMarkdown` with `turndown` (already a dependency) plus the GFM plugin, or better, produce markdown straight from the IR. Escape style values. Report a decode failure as an error |
| CON-4 | A write counts as successful 3 s after sending, with no check the server accepted it; the token fetch has no timeout; a duplicate step 2 writes twice; a step 2 after the timeout still writes; closing after the update is reported as failure | 🔎 | Add a `wrote` guard; remove the listeners once done; put `AbortSignal.timeout` on the token fetch; confirm the write by sending SyncStep1 and checking the server's state vector includes our clientID and clock; report different errors for "closed before the update" and "closed after the update" |
| CON-5 | Concurrent `replace` writes interleave; there is no per-page lock | 🔎 | Add an in-process per-page async mutex; document that `replace` only removes what the writer had seen |
| CON-9b | Repeated unclosed `<u>` takes quadratic time; step 2 is encoded as V2 while updates are V1 | 🔎 | Linear scan; confirm live which encoding the server expects |

**Exit criteria:**
- Offline golden round-trip tests (markdown → IR → Y.Doc → HTML → markdown) for every block type in `content-schema.ts`, including tables, nesting, checklists, CRLF and escapes.
- Live: write a kitchen-sink page, read it back, and diff.

---

## Phase 4: HTTP, auth and credential layer (L)

| ID | Finding | Status | Fix |
|---|---|---|---|
| COR-4 | 8 raw `fetch` calls skip `request()` (no proxy, no bearer token, `cookie: ""`, no 401 refresh, not logged); `downloadAttachment` loads the whole file into memory with a 10 s timeout | 🔎 | Send everything through `request()`, with a raw-body/stream option for downloads |
| COR-5 | Several 401s at once each start their own Playwright refresh; `authorization` and `Authorization` headers get merged; dead code at 292-301 | 🔎 | Share a single `refreshPromise`; build headers with a `Headers` object; remove the dead code |
| COR-6 | Gate fallback results have the wrong shape (`id` vs `workspaceId`, `global_id/title` vs `id/name`); hardcoded workspace `45h7lom5ryjak34u` and agent `qMjAPHPS1e6UdoYf` | 🔎 | Add a normaliser per entity, with typed mapping and no `as unknown as`; remove the hardcoded IDs (resolve them or fail) |
| COR-7 | gate-bridge: no fetch timeout; re-initialises and resends `tools/call` after any 400/404; SSE parser reads only the first `data:` line; `init` not memoised | 🔎 | Add a timeout; re-init only on a session-expired signal; parse SSE properly; memoise the init promise |
| COR-8 | `tryRepairTruncatedJson` returns partial data as success; a non-JSON 200 is returned as `T`; an HTML login redirect could look like data | 🔎 | Treat these as errors (`redirect: "manual"`, check content-type); remove the truncation repair or return a `truncated: true` error |
| COR-13 | `_activeProfile` is shared across SSE sessions; the Gate bridge ignores the profile | 🔎 | Keep profile and bridge state per session (passed through `createFusebaseServer`), and look up bridges per profile |
| COR-14 | CLI: `init` wraps the name in literal quotes; `getLogs` ignores `type`; on Windows the timeout kills only `cmd.exe` | ✅ | Fix the arguments; use `taskkill /T` or kill the process tree |
| COR-15 | proxy-relay: IPv6 fallback produces NaN bytes; `split(":")` breaks on IPv6; credentials over 255 bytes overflow; no early `error` listener | 🔎 | Fix all of these and add unit tests with a fake SOCKS server |
| COR-16 | Silent catch at client.ts:171; misleading "No authentication configured" message; rate limiter not safe under concurrency; `Math.random` keys; `getOrgTrials` ignores `orgId` | 🔎 | Fix each; use `crypto.randomUUID()` for keys |
| SEC-10 | Stored-credential key comes from hostname, username and path: any process running as the user can decrypt, and moving the folder or changing case, or running in Docker, makes the files unreadable; synchronous PBKDF2 on every load | ✅ | Random 256-bit key file `data/.key` (0600, with a Windows ACL via `icacls`) or `FUSEBASE_SECRET_KEY` env var (Docker); cache the key; migrate by trying the legacy key and re-encrypting (see D4) |

**Exit criteria:**
- All live suites pass in all three auth modes (token-only, cookie-only, hybrid).
- The parity table is generated from the actual results, not hand-written.

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

**Exit criteria:**
- Every tool has annotations.
- The protocol probe shows one `list_changed` per tier switch, and switching back to core works.
- The `tools/list` payload for the full tier is smaller than today's roughly 119k characters (set a target once measured).

---

## Phase 6: Docs, packaging and honesty (M)

| ID | Finding | Status | Fix |
|---|---|---|---|
| DOC-1 | README and badges claim "100% verified" and give inconsistent counts (165/168/175 tools, 206/212 assertions) | ✅ | Generate counts and pass rates from test output (`scripts/generate-status-data.ts`); remove the hand-maintained badges; make the status resource show real data |
| DOC-2 | `GATE_MCP_TOKEN` vs `FUSEBASE_GATE_TOKEN` naming | ✅ | Use `FUSEBASE_*` names everywhere; accept the old names and warn that they're deprecated; one `config.ts` loader, validated with zod |
| DOC-3 | The plugin manifests say author "FuseBase" with homepage thefusebase.com, which reads as official; they say "MIT" but the repo has no LICENSE | ✅ | Set yourself as author and the GitHub repo as homepage, add "unofficial" to the description, add a `LICENSE` file (see D6) |
| DOC-4 | `package.json`: no `engines` or `license`; `zod` not declared; `@modelcontextprotocol/sdk` range `^1.0.0` too loose; `postinstall` downloads Chromium for every user; `turndown` unused (until CON-8) | ✅ | Fix each; make the Playwright install opt-in (`npm run setup:browser`) |
| DOC-5 | Docker: Playwright can't refresh cookies on alpine; host-encrypted credentials don't decrypt in the container | ✅ | Document Docker as token-mode only; use `FUSEBASE_SECRET_KEY` (SEC-10) |
| DOC-6 | Version hardcoded in 3 places | ✅ | Read it from `package.json` |
| DOC-7 | `loadDotEnv` doesn't handle quoted values and also loads `apps/client-portal-dashboard/.env` | ✅ | Use Node's built-in `process.loadEnvFile` (Node ≥ 20.12) and drop the apps coupling |
| DOC-8 | Dev tooling (vitest 5) needs Node ≥ 22.12, the Docker image uses `node:20`, and `package.json` has no `engines` field | ✅ | Declare `engines` (runtime ≥ 20.12); document Node 22+ for development; consider moving the image to `node:22-alpine` |

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
