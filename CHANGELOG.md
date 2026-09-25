# Changelog

This project follows [Semantic Versioning](https://semver.org/). Each release is described in its [GitHub release](https://github.com/ryan-haver/fusebase-mcp/releases).

## Unreleased

- Token-only coverage: the live harness can measure which tools work with only Gate and Dashboards tokens (`LIVE_TOKEN_COVERAGE=1`, report with `npm run coverage:tokens`). Results in [docs/TOKEN-COVERAGE.md](docs/TOKEN-COVERAGE.md): 14 of 129 measured tools work without a session cookie. The README badge that claimed 100% parity now shows the measured figure.
- Fixed, found by that measurement:
  - `list_pages` ignored the folder in token mode and returned the top-level pages instead.
  - `resolve_database_alias` answered "not found" when it couldn't read the database list; it now reports the error.
  - `get_user_preferences` and `get_billing_info` returned nulls when their requests failed; they now fail when every part fails and name the parts that did.
- Two timing-sensitive unit tests no longer fail on a busy machine.
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
