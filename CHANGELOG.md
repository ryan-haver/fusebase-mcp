# Changelog

This project follows [Semantic Versioning](https://semver.org/). Each release is described in its [GitHub release](https://github.com/ryan-haver/fusebase-mcp/releases).

## Unreleased

No changes recorded yet.

## 2.2.0 — 2026-11-08

API/CLI compatibility updates, safer authentication and sandbox validation, reproducible packaging,
and source-verified dashboard releases. Includes all changes since v2.1.0.

**Upgrade notes:** Node.js 22.19 or later is required. Browser binaries and reference guides are
explicit opt-ins (`npm run setup:browser`, `npm run guides:fetch` in a source checkout). Named
profiles must supply their own credentials; they no longer inherit default-account authority.
Token-only coverage remains partial; cookie/hybrid mode is needed for unsupported operations.


- Addressed REV-01: named profiles no longer inherit default cookies or tokens, including a missing gateway token. Missing credentials and known tenant mismatches fail before requests; the default profile keeps environment precedence.
- Addressed REV-02: shared bounded error redaction now covers REST exception fields, Gate diagnostics, MCP handler failures, CLI failure output, and transport/client logs. Diagnostic URLs omit credentials, queries, and fragments; successful API payloads remain intact.
- Remediation validation: the November 4 working-tree run passed all 17 selected stages and 1,783 live assertions. The subsequent cleanup fix passes 540 unit tests and a fresh portal/sweep run. Windows/Linux Node 22.19, package and container checks pass; dashboard browser checks and remote CI/release gates are now enforced.

- Dashboard validation totals, pass rates, failed-check counts, cleanup status and guide counts now come from generated results instead of fixed display strings.

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
- Pre-remediation validation: 468 passing unit tests, five passing offline stages, 32 focused agent assertions, 43 automation assertions and 15 account assertions. See [live validation](docs/LIVE-VALIDATION.md) for scope, cleanup and remaining upstream/permission limitations.

### Review remediation

- Package a clean runtime with authentication and guide helpers; remove install-time downloads and source builds.
- Journal sandbox mutations before sending; refuse ambiguous credential fallback; clean exact owned IDs and verify deletion.
- Add an opt-in disposable portal/email lifecycle with membership protection and recoverable cleanup.
- Record per-run source identities; display stale, incomplete and uncommitted evidence explicitly; verify the deployed manifest and rendered source hash. Nine browser scenarios cover evidence states and the production bundle.
- Bound HTTP sessions and runtime logs; isolate tenant/profile caches under the configured data directory.
- Share conservative operation effects with write-proof accounting; separate expected restrictions from real failures.
- Split extended tools into domain modules and cap existing lint warnings. Expand CI to package, dashboard,
  container, minimum-runtime, dependency and secret checks. See the dated review for outstanding validation gates.


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
