# Testing and validation

Nothing is committed or pushed without passing validation. The gate is enforced by git hooks
in `.githooks/`. Install them once per clone:

```bash
npm run hooks:install   # git config core.hooksPath .githooks
```

| When | What runs | Time |
| --- | --- | --- |
| Every commit (`pre-commit`) | Offline checks: typecheck, lint, build, unit tests, tool/README audit | ~1 min |
| Every push (`pre-push`) | Offline checks, then all live suites against the sandbox workspace, with write verification and a leftover sweep | ~6 min, one 1Password approval |
| Every pull request (CI) | Offline checks on Node 22 and 24 | ~1 min |

`git push --no-verify` bypasses the gate. Don't use it for normal work.

## Offline checks

```bash
npx tsx scripts/test-all.ts --offline
```

These need no credentials. Known bugs are pinned with `it.fails` / `knownGap()`, using IDs from
[PLAN-review-remediation.md](PLAN-review-remediation.md). Remove the marker when you fix one.

Every run of `scripts/test-all.ts` records each stage's outcome in `.cache/test-results.json`: pass or fail, duration, and the assertion, skip and tool counts the stage printed. `scripts/generate-status-data.ts` publishes those figures on the status dashboard; nothing there is written by hand.

## Live suites

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
