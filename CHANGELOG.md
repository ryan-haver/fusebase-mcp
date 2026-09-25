# Changelog

This project follows [Semantic Versioning](https://semver.org/). Each release is described in its [GitHub release](https://github.com/ryan-haver/fusebase-mcp/releases).

## Unreleased

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
