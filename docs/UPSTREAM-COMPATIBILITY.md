# FuseBase upstream compatibility review

Reviewed November 2, 2026 against official release sources and read-only live MCP discovery. These are observations for the configured account, not a claim that every advertised capability works with every token.

## Project structure

The TypeScript MCP server registers everyday operations in `src/tools/core-tools.ts` and on-demand operations in `src/tools/extended-tools.ts`. `src/client.ts` combines session-cookie REST operations with token fallbacks through `src/gate-bridge.ts`. Collaborative document writes use the Y.js writer and the Markdown/content-schema modules. `src/cli-manager.ts` wraps the installed official CLI. Resources, prompts, downloaded guides, and the offline/live test harness provide the agent-facing context and validation. `apps/client-portal-dashboard` is a separate managed FuseBase product, with its own dependencies and instructions.

## Verified versions

| Component | Observed version | Evidence |
| --- | --- | --- |
| Official CLI production channel | 0.33.1, upgraded locally from 0.29.12 | [Official release manifest](https://fusebase-cli-bin.s3.us-east-1.amazonaws.com/manifest.json), installed CLI |
| Official CLI source | 0.33.1, commit `344384d6d047c453f83e42b4fb3d8521cf2f2ab1` | [Official repository](https://github.com/fusebase-dev/fusebase-cli/tree/344384d6d047c453f83e42b4fb3d8521cf2f2ab1) |
| Gate MCP | 2.17.5; 206 catalog operations | Authenticated `whoami`, `tools_list` at `https://gate-mcp.thefusebase.com/mcp` |
| Dashboards MCP | 1.34.10; 28 catalog operations | Authenticated `whoami`, `tools_list` at `https://dashboards-mcp.thefusebase.com/mcp` |
| Published Gate SDK | 2.17.5 | [Official npm package](https://www.npmjs.com/package/@fusebase/fusebase-gate-sdk); downloaded package release notes |
| Published Dashboards SDK | 1.34.10-sdk.2 | [Official npm package](https://www.npmjs.com/package/@fusebase/dashboard-service-sdk) |

The CLI's cached update banner initially reported 0.30.0. Its live release manifest was newer. Use the manifest or the updater rather than treating the cached banner as authoritative. Likewise, the public [update guide](https://thefusebase.com/guides/update/) still describes `--skip-app`; the released CLI and its source use `--skip-product`.

## Changes made

- Added `fusebase_discover_operations`: filter/paginate compact upstream summaries, preserve `dangerous`, inspect schemas with `schemaMode`, and load the `requiredPrompts.groups` through `promptGroups`. It uses the live upstream contract instead of a frozen local SDK snapshot.
- Added `applyDefaults: false` to `fusebase_direct_tool_call`. This preserves exact schema arguments and avoids injecting `orgId` into strict operations such as `getHealth`. Existing wrapper defaults remain compatible.
- Discovery reports upstream RPC/tool errors and malformed responses instead of disguising them as an empty catalog. Both text JSON and MCP structured results are supported.
- Added `fusebase_cli_update` with dry-run and CLI-only defaults, optional managed product refresh, named environment selection, and no automatic Git checkpoints. Applying updates requires `dryRun: false`.
- Updated app permissions/access wrappers and environment selection for app listing, deploy and update. Unsupported build flags fail before running any change, with guidance to edit `fusebase.json`. CLI status uses the argument-vector execution path with agent mode.
- Verified installed CLI help for init, logs, secrets and sidecars. The current CLI has no `secret list`; `fusebase_cli_secret_list` now reads local key/description declarations, with tests ensuring values and malformed JSON contents cannot leak. Secret creation declares keys locally; deploy/dev-start performs platform registration.
- Fixed guide discovery for flat URLs and declared the missing `tsx` script dependency. The refresh discovered 281 articles, added 7, updated 274, and had no fetch failures. Four old URLs were flagged, with cached files preserved.
- Refreshed runtime and development dependencies, including ESLint 10.14.0, TypeScript 6.0.3, undici 8.12.3, Playwright 1.64.1 (and its Chromium browser), and socks-proxy-agent 10.1.0. Node 22.19 is now the minimum. TypeScript 6 is the newest version supported by the current TypeScript ESLint peer range (`<6.1`); Node typings track the supported Node 22 baseline rather than newer runtime APIs.
- All three package trees (server, managed product, dashboard SPA) report **zero vulnerabilities**, including development dependencies. The server and product override minimatch to `^11.0.4`, resolving [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) without downgrading ESLint. ESLint 10 already uses the modern minimatch API; lint and test runs passed with the override. Remove it when upstream dependency ranges include patched minimatch.
- Updated the product and SPA to published Gate SDK 2.17.5 and Dashboards SDK 1.34.10-sdk.2. Updated the SPA build to Vite 8.3.5 and its current React plugin. The SPA has no runtime SDK imports, so no API call-site migration or permission expansion was needed. Its lint, direct typecheck, and production build passed. The historical vendored SDK directory is reference material, not a runtime dependency.
- Refreshed the official managed AGENTS/skills/hooks through `fusebase update --skip-cli-update --skip-mcp --skip-deps --skip-install --skip-commit`. MCP credentials were preserved; the CLI template's older SDK ranges were not allowed to replace the updated package declarations.
- Kept the default 34-tool core tier. There are now 143 extended tools (177 total).

## New upstream areas to use through discovery

The current Gate catalog includes published-app search and cross-app API contract discovery/verification; app magic links; Stripe integration operations; multipart uploads and bucket attachments; org groups and membership; substantially expanded portal page/block editing; and isolated-store checkpoints, revisions, migrations, RLS status and SQL batches. Find their current schemas before invoking them; listing an operation is not proof that the configured token can execute it.

Gate's published 2.17.1 release notes also describe compact dashboard reads, delegated visitor/site context for RLS, Web Studio data and access operations, dashboard share links, and v3 note app-embed syntax (`::fusebase-app{appId="..." height="480"}`). Some of these are not in this token-visible MCP catalog. Their presence in SDK release notes must not be treated as proof of account access, MCP exposure, or rollout. No token permissions were broadened.

The CLI also exposes jobs, API contracts, token management, named environments and isolated-store lifecycle commands. They are available through the installed CLI; this change does not add a separate local MCP wrapper for every command.

## Remaining boundaries

- Ran `fusebase update --launcher`. The signed production installer upgraded the launcher from `2026.082611.0121` to **`2026.093012.2207`** (signature verified). The release manifest advertises `2026.093014.3932`, but the production installer supplied by the official updater installs the former; the corresponding advertised standalone artifact was not accessible (HTTP 403). This upstream packaging discrepancy remains. The CLI itself is production 0.33.1; no development-channel binary was installed.
- Existing named wrappers were not all migrated to new token APIs. Fresh [token-only coverage](TOKEN-COVERAGE.md) measured 150 remote tools: 29 worked without cookies and 121 required cookies. Both automation trigger wrappers now have verified completed runs and exact expected outputs.
- All seven live stages now have passing results against the configured test workspace after correction reruns through `op run`. Testing fixed folder listing, table creation, Gate SQL confirmation and SQL result-envelope handling, plus the outdated migration fixture. The broad suite passed 574 assertions across 165 tools with 12 explicit skips. See [LIVE-VALIDATION.md](LIVE-VALIDATION.md) for verified follow-up workflows, cleanup evidence and remaining limits. Disposable hosted-app deployments were also verified and removed.
- Offline validation passed all five stages: typecheck, lint (nonblocking warnings), build, unit tests, and the tool-schema/README audit. The latest Node 26 run reports **468 passed, zero expected failures**. The five local MCP failures are fixed: bidirectional tier switching, batched notifications, tool-effect annotations, and string-valued CRM prompt counts. The earlier 414-total-test suite also passed on the supported minimum Node 22.19, followed by all 16 CLI-manager tests; the newly expanded suite has not been repeated on that minimum version.
- No running FuseBase MCP server was found in the local process inventory, so there was no persistent instance to restart. The updated build was exercised by the test-created MCP servers.
- The managed product guidance requires a fresh agent session after managed asset/MCP changes. Updating the repository does not itself publish the status dashboard; its deployment is a separate operation.

## Repeat the check

1. Inspect `fusebase version` and the official release manifest. Run `fusebase update --skip-product` to update the CLI alone.
2. Enable extended tools. Call `fusebase_gate_whoami` and `fusebase_discover_operations` for each gateway.
3. Discover an operation, inspect its schema, and load the requested domain guidance. Use exact arguments for new operations.
4. Refresh help articles with `npm run guides:fetch`.
5. Run `npx tsx scripts/test-all.ts --offline`; use the sandbox live suites in [TESTING.md](TESTING.md) when changing remote writes.
