# Changelog

This project follows [Semantic Versioning](https://semver.org/). Each release is described in its [GitHub release](https://github.com/ryan-haver/fusebase-mcp/releases).

## Unreleased

- Added live Gate/Dashboards operation discovery, schema selection and required domain guidance. Direct calls can disable legacy scope injection; discovery errors are no longer hidden as empty catalogs.
- Updated official CLI integration for update previews/application, named environments, access principals and additive Gate permission sync. Obsolete build flags fail before changing an app. Initialization is noninteractive and avoids implicit Git synchronization; Windows child processes stay hidden.
- Updated dependencies and managed FuseBase guidance, including MCP SDK 1.32.2, Gate SDK 2.17.5, Dashboards SDK 1.34.10-sdk.2, Vite 8.3.5, TypeScript 6.0.3 and ESLint 10.14.0. Node 22.19 is the supported minimum. Patched minimatch overrides resolve the audited vulnerability without downgrading ESLint.
- Updated the tool catalog to 177 tools (34 core / 143 extended). Tier changes work in both directions, emit one notification and prevent calls to disabled tools. All tools expose effect annotations; CRM prompt counts validate positive integer strings.
- Updated guide discovery for flat article URLs. The current CLI secret-list wrapper reads only local key/description declarations, never values; documentation distinguishes declaration from platform registration.
- Fixed stale Unsorted-folder listings after page moves and table creation to produce an independent dashboard/schema/default view under the parent database.
- Updated isolated SQL migrations to the integer-version/checksum contract, exposed explicit confirmation flags, and normalized nested SQL result envelopes.
- Added automation trigger/action configuration, publication and run-detail reads with actual step outputs. Both trigger wrappers now have live execution and cleanup proof.
- Fixed authentication-helper imports starting an extra login and printing a cookie. Unit workers now clear inherited credentials to isolate mocked gateway tests. Test-runner flags reject unknown/conflicting options before loading credentials.
- Updated portal creation and invitations to current Gate contracts. Client access must be explicit, existing non-client roles are protected, membership reads are scoped to the portal, and magic-link generation verifies membership.
- Corrected AI Assistant execution to create a thread, submit a separate message and require a completed response stream. Errors retain the thread ID. URL extraction uses a configured scraping agent; it is not a direct Firecrawl call.
- Verified hosted deployment/logs, account preference restoration and persisted authentication, portal invitation/email delivery/login, agent execution/continuation and real web retrieval. Added an isolated live agent regression with verified cleanup; scraping is included in write accounting.
- Validation: 468 passing unit tests, five passing offline stages, 32 focused agent assertions, 43 automation assertions and 15 account assertions. See [live validation](docs/LIVE-VALIDATION.md) for scope, cleanup and remaining upstream/permission limitations.

## 2.1.0 — 2026-09-25

Measured token-only coverage, fixes it found, and documentation that states only what's tested. See the [release notes](https://github.com/ryan-haver/fusebase-mcp/releases/tag/v2.1.0).

- Token-only coverage: the live harness can measure which tools work with only Gate and Dashboards tokens (`LIVE_TOKEN_COVERAGE=1`, report with `npm run coverage:tokens`). Results in [docs/TOKEN-COVERAGE.md](docs/TOKEN-COVERAGE.md): 14 of 129 measured tools work without a session cookie. The README badge that claimed 100% parity now shows the measured figure.
- Fixed, found by that measurement:
  - `list_pages` ignored the folder in token mode and returned the top-level pages instead.
  - `resolve_database_alias` answered "not found" when it couldn't read the database list; it now reports the error.
  - `get_user_preferences` and `get_billing_info` returned nulls when their requests failed; they now fail when every part fails and name the parts that did.
- Two timing-sensitive unit tests no longer fail on a busy machine.
- The status dashboard's test figures now come from real runs: `test-all` records each stage's outcome and counts, and the dashboard publishes only those. The `fusebase://status` resource no longer reports made-up assertion totals, and the README's "100% verified" badge and headline claims are replaced with what the tests prove.
- Repository reorganised:
  - Live test suites moved to `tests/live/`.
  - `ENDPOINT_REFERENCE.md` moved to `docs/`.
  - Added `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md` and this changelog.
- The FuseBase guides are no longer committed. They're downloaded into `.cache/guides` by `npm install` or `npm run guides:fetch`, and by the Docker build. The guide tools say how to fetch them when they're missing.
- The browser download for cookie capture is now opt-in (`npm run setup:browser`). Browser profiles live in `data/browser-profiles/`.
- The plugin manifests name the maintainer and describe the server as unofficial. `package.json` declares `license` and `engines` (Node ≥ 22.12).

## 2.0.0 — 2026-09-25

A hardening release, with every write verified against live FuseBase. See the [release notes](https://github.com/ryan-haver/fusebase-mcp/releases/tag/v2.0.0).

## 1.0.0 — 2026-09-23

First release.
