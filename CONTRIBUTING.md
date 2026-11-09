# Contributing

Thanks for helping improve this unofficial FuseBase MCP server.

## Set-up

```bash
npm ci --ignore-scripts  # install locked dependencies; guides/browser are opt-in
npm run hooks:install    # commit and push validation gate
npm run build
```

- Node 22.19 or later.
- Keep secrets in 1Password, not in files. See [docs/1PASSWORD.md](docs/1PASSWORD.md).
- For browser-based cookie capture (`npm run auth` after building), run `npm run setup:browser` once. Fetch reference guides explicitly with `npm run guides:fetch`.

## Making changes

1. Branch from `master`.
2. Write or update tests:
   - **Unit tests** go in `tests/unit/` and run offline.
   - **Live tests** go in `tests/live/` and run against a sandbox workspace. Every write must be proven by a fresh read with `verifyWrite()`. See [docs/TESTING.md](docs/TESTING.md).
   - When fixing a bug pinned with `it.fails` or `knownGap()`, remove the marker.
3. Commit. The pre-commit hook runs the offline checks: typecheck, lint, build, unit tests and the tool audit.
4. Push. The pre-push hook also runs the live suites (one 1Password approval), and verifies cleanup. Open a pull request separately when needed.

Record findings and fixes in [docs/PLAN-review-remediation.md](docs/PLAN-review-remediation.md) with an ID.

## Style

- Match the surrounding code. Don't add comments that restate the code.
- Tool descriptions and error messages are read by models and people: say what happens and how to fix a problem.
- Never print, log or commit secret values.
