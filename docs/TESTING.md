# Testing and validation

Local validation gates are available in `.githooks/`; they apply only when installed and can be bypassed.
CI independently checks pull requests and master pushes. Install hooks once per clone:

```bash
npm run hooks:install   # git config core.hooksPath .githooks
```

| When | What runs | Time |
| --- | --- | --- |
| Every commit (`pre-commit`) | Offline checks: typecheck, lint, build, unit tests, tool/README audit | ~1 min |
| Every push (`pre-push`) | Offline checks, then the seven standard live stages against the sandbox workspace, with write verification and a leftover sweep | ~6 min, one 1Password approval |
| Every pull request (CI) | Offline + packed install on Linux Node 22.19.0/24/26 and Windows 22.19.0; dashboard, container, audits and secret scan | ~1 min |

`git push --no-verify` bypasses the gate. Don't use it for normal work.

## Offline checks

```bash
npx tsx scripts/test-all.ts --offline
```

These need no credentials. Known bugs are pinned with `it.fails` / `knownGap()`, using IDs from
[PLAN-review-remediation.md](PLAN-review-remediation.md). Remove the marker when you fix one.

`--offline-only` is accepted as an alias. Unknown options and conflicting offline/live flags
fail before credentials are loaded or account tests start.

Every invocation creates a new evidence run, archived under `.cache/test-runs/` and copied to
`.cache/test-results.json`. It records selected stages, start/end, full commit, source-content hash,
dirty status, Node version, stage outcomes and counts. Partial runs never inherit old stage results.
Source changes during a run invalidate it. Dashboard data generation labels stale or incomplete
records and does not count them as current passing assertions. Cloud health requires separate live evidence.
After committing, rerun checks to bind results to the new commit before deployment.

## Live suites

For the focused agent execution/scraping regression, run
`npm run test:agents -- --execute` under the same authenticated environment as the other live
suites. It creates its own QA agent, verifies saved answers and actual web retrieval against
an independent source fetch, then removes its threads and agent. Cleanup evidence is saved
in `scratch/agent-validation-*.json`. The full data suite runs it with
`FUSEBASE_TEST_WORK_AGENTS=1`; it never selects an arbitrary existing agent for execution.

```bash
op run --account <your-account>.1password.com --env-file=.env -- npx tsx scripts/test-all.ts --live-only
```

- They run only in the sandbox workspace named by `FUSEBASE_WORKSPACE_ID`, never "the first
  workspace". They create real content there and delete it again.
- Secrets come from 1Password (see [1PASSWORD.md](1PASSWORD.md)). Run everything under one `op run`.
- To test a running server (for example the Docker container) instead of starting one, set
  `FUSEBASE_MCP_URL` and `MCP_AUTH_TOKEN`.
- Only one live run at a time: two runs in the same sandbox interfere, so a second run is
  refused while one is in progress.

To rerun failed stages without repeating unrelated mutations, add one or more exact names,
for example `--stage="Database engine" --stage="Leftover sweep"`. Results are still recorded
per stage. Include the cleanup sweep when rerunning any mutating stage.

`npm run test:automation` runs the focused automation lifecycle through the built MCP server.
It creates a disposable QA flow using FuseBase's manual trigger, adds and updates a code action,
publishes it, and invokes both trigger tools. Each invocation must produce a distinct completed
run whose step output contains the unique fixture ID and the expected calculation (`21 * 2 = 42`).
It then disables/deletes the flow and verifies that both the flow and its runs are absent.
The broad data-validation suite uses the same execution checks. FuseBase's manual trigger emits
an empty event; this test does not establish arbitrary webhook-payload forwarding.
Run it under `op run` with the same sandbox configuration, separately from other live suites.

`npm run test:account -- --preferences --refresh-auth` explicitly tests the remaining
account-wide operations. The preference check reads the original value, flips it, verifies it,
and restores/verifies the original value in a `finally` block. The refresh check allows up to
seven minutes for browser authentication, then starts a new MCP process and verifies fresh
cookie metadata plus an authenticated read of the intended sandbox through a cookie-only
endpoint. Either flag can be run separately. These checks require 1Password access and may
require a browser login; a prepared test is not counted as a successful live verification.

The `fusebase_cli_init` wrapper passes `--yes --skip-git` and allows five minutes for setup.
This makes fixture initialization noninteractive without initializing or syncing a Git remote.
Initialization creates a remote product; arrange cleanup before using it for disposable tests.

The data-validation suite also tests secret declarations and sidecar add/list/remove through
the installed official CLI in a disposable `scratch/cli-validation-*` project. These checks
do not deploy containers or register secret values. Hosted deployment, initialization, app
permission updates and remote logs require a separately designated sandbox app.

Some checks need additional fixtures or explicit opt-ins:

| Variable | Scope |
| --- | --- |
| `FUSEBASE_TEST_CREATE_SQL_STORE=1` | Create the reusable `qa-val-store` if absent. Tests use only its `dev` stage and delete each run's rows; the store and migration table persist. |
| `FUSEBASE_TEST_SEND_EMAIL=1`, `FUSEBASE_TEST_INVITE_EMAIL`, and `FUSEBASE_TEST_CLIENT_FULL_ACCESS=true|false` | Permit portal invitation/link tests using the designated client address and explicit access scope. These can change membership; API success does not verify email delivery or link activation. |
| `FUSEBASE_TEST_ACCOUNT_PREFERENCES=1` | Flip and restore the account-wide sidebar preference. |
| `FUSEBASE_TEST_WORK_AGENTS=1` | Create an isolated QA agent; verify execution, continuation, saved answers, actual web scraping and source text; delete its threads and agent afterward. |
| `FUSEBASE_TEST_REFRESH_AUTH=1` | Launch browser authentication and replace the cached cookie. |

Absent fixtures are reported as skips, never passes. An authenticated session's cookie-age
warning is accepted, but Gate/workspace connectivity errors still fail validation.

SQL setup uses discovery to initialize only the test store's `dev` stage and preview migration
status. The authorized QA migration and run-scoped cleanup pass `confirm: true` explicitly;
Gate requires confirmation even for a migration dry run. The named wrappers default it to false.

### Every write is proven by a fresh read

A write's own response (an id, "created", "updated") is **not** proof that FuseBase stored the
data. The harness (`tests/live/lib/harness.ts`) records every successful call to a tool in
`WRITE_TOOLS`. At the end of a suite, any write that wasn't proven **fails the suite**, and the
report lists each one with the file and line that made it.

Prove a write straight after making it:

```ts
const page = await callTool(client, "create_page", { workspaceId, title, markdown: "# Hello" });

await verifyWrite("create_page", "title and content stored", async () => {
  const meta = await callTool(client, "get_page", { workspaceId, pageId: page.id });
  assertEqual(meta.title, title, "stored title");
  const md = await callTool(client, "get_page_content", { workspaceId, pageId: page.id, format: "markdown" });
  assertIncludes(md, "# Hello", "stored content");
});
```

- The check must make at least one **read** call and assert the **specific values written**,
  not just that something exists. It is retried for up to 15 s, because FuseBase can take a
  moment to reflect a write.
- Read through a different path than the write where one exists. For example, content written
  over the Y.js WebSocket is read back from the server's copy of the document.
- **Deletes** are proven by a read showing the item is gone.
- **Several writes** of the same tool can be proven together with `{ count: n }`, provided the
  check covers all of them.
- `noReadBack(tool, reason)` exempts a write that no available tool can observe. Give a
  specific reason; exemptions are listed in every report.
- Calls that fail (for example negative tests that expect an error) claim no write and need no
  proof.
- Deletes in cleanup blocks run inside `duringCleanup()`. The leftover sweep proves them.
- `LIVE_VERIFY_WRITES=report` lists unproven writes without failing, for auditing a suite. The
  gate always enforces.

### Leftover sweep

The last live stage (`tests/live/sweep-sandbox.ts`) reads FuseBase directly, not through the MCP
tools. It fails if anything created in the sandbox during the run still exists: pages, tasks,
and test-named databases, automations or tokens. It also reports test-named orphans from earlier,
interrupted runs.

```bash
npx tsx tests/live/sweep-sandbox.ts --since=<ISO time>   # report
npx tsx tests/live/sweep-sandbox.ts --clean              # delete leftovers and orphans with test-style names only
```

## Token-only coverage

Measures which tools work with only the Gate and Dashboards tokens (no session cookie). With `LIVE_TOKEN_COVERAGE=1`, each suite client gets a twin server with an empty data folder and no cookie:

- Every tool call goes to the twin first. If it fails, the failure is recorded and the call is repeated on the normal server, so the suite carries on with real data.
- A twin write counts as working only when the suite's `verifyWrite()` proves it. Reads inside `verifyWrite()` take their answer from the normal server, so a token-mode read gap can't fake a proof.
- Local tools (CLI, profiles, guides) go to the normal server only. Calls that fail in both modes aren't counted against tokens.

```bash
LIVE_TOKEN_COVERAGE=1 npx tsx tests/live/database-e2e.ts   # repeat for mcp-e2e and data-validation, under one op run
npm run coverage:tokens -- --markdown docs/TOKEN-COVERAGE.md
```

Results are appended to `LIVE_TOKEN_COVERAGE_FILE` (default: `fusebase-token-coverage.jsonl` in the temp folder); delete it before a fresh measurement. The report replaces the org host and ids in error text with placeholders.

## Writing a new live test

1. Give everything you create a test-style name (containing `Test`, `QA`, `E2E`…) and a timestamp.
2. Prove every write with `verifyWrite` straight after it.
3. Delete what you created in a `finally` block, inside `duringCleanup()`.
4. Run the suite once with `LIVE_VERIFY_WRITES=report` to check nothing is unproven.

## Focused stages and fixture recovery

Use `npm run test:all -- --stage="Focused automation"` (or `Account preferences`,
`Authentication refresh`, `Agent execution`, `Portal email lifecycle`) to record focused evidence.
Email also requires `FUSEBASE_TEST_SEND_EMAIL=1` and `FUSEBASE_TEST_INVITE_EMAIL`; it refuses an existing
organization member, creates a disposable workspace/portal, verifies invitation and link issuance,
and revokes links/removes access/deletes the fixture in cleanup. API success does not prove inbox
delivery or browser activation. Recovery: `npx tsx tests/live/portal-email-e2e.ts --recover=<journal>`.

Each standard live run journals mutations before sending under `scratch/live-runs/<run-id>/`.
An uncertain write is never retried with another credential. Inspect its request IDs and fresh upstream
state before appending an explicit reconciled event. Never delete resources based on a QA-like name.
`LIVE_FIXTURE_JOURNAL=<journal> npm run test:sweep -- --clean` deletes only confirmed exact IDs in
that journal, then re-enumerates; incomplete listings or deletion failures fail cleanup. Journals with
unresolved attempts fail closed. Keep journals private and outside version control.

`npm run test:package` verifies a real tarball installed with production dependencies and lifecycle
scripts enabled in an isolated consumer. `docker build -t fusebase-mcp:ci .` followed by
`node scripts/test-container.mjs fusebase-mcp:ci` checks container HTTP/MCP startup without credentials.
Use `--build-arg FETCH_GUIDES=1` only when a build should fetch external reference content.

### Recovery verification details

Task searches paginate over mixed task/list/board ranges. Follow the returned `nextOffset`, not
`tasks.length`; a short task array does not prove the last page. The sweep shares this range-aware
collector. SQL insert fixtures journal the exact dev-store/table/row/run identities before sending;
recovery verifies the stored row's run identity before deleting it with bound parameters. The reusable
QA SQL store is retained, while its run-owned rows must be absent.

An explicit HTTP 404/410 from a recorded read can prove deletion through `confirmNotFound`.
Caught timeouts, 403/500 responses and generic “not found” strings do not count as proof.
Portal recovery looks up the exact workspace directly because portal workspaces may be absent from
the normal list. Membership guards use epoch seconds. Failed revocation or membership removal
keeps the workspace/portal available for recovery, and execution errors are retained alongside cleanup errors.
A lost workspace-creation response followed by an empty listing remains unresolved; retry recovery
when visibility returns. An empty list alone must not mark an uncertain creation as cleaned up.

Dirty-source runs are labelled `working-tree`; they never appear as committed release passes.
The container smoke also tests encrypted credentials, cache, logging and downloads against a read-only
installation with a separate writable data directory.


### Status dashboard and release checks

After installing the root and dashboard dependencies, run the dashboard's lint/build, then
`npm run test:dashboard` from the repository root. The browser suite covers current, uncommitted,
stale, incomplete, missing and failed evidence, an offline-only selection, stale cleanup, mobile
width and the actual production bundle. It uses synthetic local evidence; it does not send email
or change account data. Screenshots stay under ignored `scratch/dashboard-browser/`.

The pre-push hook runs offline and standard live checks in one runner invocation, preserving one
complete source identity rather than overwriting offline results with a second live-only record.
Deployment requires that exact clean, pushed source and passing offline stages. It builds and
checks the dashboard locally, opens Chromium before publishing, then verifies both the exact
release manifest and the rendered source hash. A 200 response from an old or broken bundle fails.
The cloud-health label stays unverified because release identity does not measure backend health.


To use host-registered temporary storage, set `FUSEBASE_TEST_ARTIFACT_DIR` before
`npm run test:package`; isolated consumer installs and their tarballs go there.
Set `FUSEBASE_LIVE_ARTIFACT_DIR` before the standard runner/pre-push hook to keep
run-specific mutation journals under an owned evidence directory. Preserve live
journals as recovery evidence. The normal `.cache` source/result ledger is unchanged.
