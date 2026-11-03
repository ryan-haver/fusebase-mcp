# Live validation — November 3, 2026

This report summarizes tests against an explicitly configured sandbox account. Account
identifiers, recipient addresses, login links, credentials, browser state and raw responses
are deliberately excluded. Detailed run journals and screenshots stay in ignored local
storage. These results establish the tested behavior, not universal API or token coverage.

## Results

| Area | Verified behavior |
| --- | --- |
| MCP server | 177 tools, 34-tool core tier, bidirectional tier switching, one notification per change, disabled-tool enforcement, effect annotations and prompt validation. |
| Pages and databases | Content read-back, folder moves and Unsorted filtering, independent table/schema creation, rows, columns, views and relations. |
| Isolated SQL | Current migration/checksum contract, confirmation flags, result envelopes and dev-stage write/read/delete checks. The reusable QA store remains by design. |
| Automations | Both trigger wrappers executed a configured flow, returned distinct successful runs and the expected calculated output; run logs and cleanup were verified. |
| Account operations | Sidebar preference changed, read back and restored. Authentication refresh persisted a new cookie; a new server verified cookie-authenticated access. |
| Hosted CLI | Disposable product initialization, deployment, frontend/backend responses, app-access change/restoration, build logs and runtime-log correlation; remote product/app/token cleanup verified. |
| Portals | Disposable workspace and portal creation, name/theme/access read-back, explicit client access, scoped membership and protection against changing an existing owner's role. |
| Portal email and login | The recipient confirmed both native FuseBase emails and a separate test email. Invitation and generated magic links each opened the correct portal in fresh browser contexts. |
| AI agents | Exact response, same-thread continuation and independently read stored assistant answers. |
| Web extraction | A real upstream `scrape_web_page` call targeted the test URL. Extracted text matched an independent HTTP fetch and the persisted assistant answer. |

## Validation counts

- All five offline stages passed: typecheck, lint, build, unit tests and tool/README audit.
- **468 unit tests passed**, with no expected failures.
- Lint reported zero errors and 395 nonblocking warnings.
- The seven broad live stages passed across the full run and correction reruns, with
  **1,663 assertions** across assertion-reporting stages. Optional operations are reported
  as skips in individual runs; targeted follow-ups provide separate evidence below.
- Focused automation validation: **43 assertions**, no skips, nine writes proved by fresh
  reads. Both trigger paths returned the expected result.
- Focused account validation: **15 assertions**, including preference restoration and
  persisted-cookie verification.
- Focused agent validation: **32 assertions**, no skips or known gaps, all three execution
  and scraping writes proved by fresh reads. The suite creates and removes its own agent.
- The earlier token-only snapshot measured **29 of 150 remote tools** working without a
  session cookie. Later hybrid portal/agent checks do not change that tally; see
  [TOKEN-COVERAGE.md](TOKEN-COVERAGE.md).

## Cleanup

Fresh reads confirmed removal of temporary pages, tasks, tables/databases, flows, hosted
products/apps, associated Gate tokens, AI agents and their conversations. For the email
workflow, both issued links were revoked and the temporary client membership, portal and
workspace were removed. The owner's role and original test portal remained unchanged.
No global user account was deleted. The links in the test emails are intentionally invalid.

The reusable isolated SQL store and migration history remain for future dev-stage tests;
run-specific rows were removed. Some generated local fixtures remain in ignored `scratch/`
storage because local deletion was blocked. They are not release artifacts, and their
associated remote tokens were revoked. No local logs, credentials or browser state belong
in a commit.

## Limits and reliability observations

- The tested credentials lack permission for the separate Paperclip Work-agent API.
  Successful AI Assistant execution does not establish Paperclip access. Discover the
  current schema and required permissions before using that API; permissions were not
  broadened during validation.
- One repeat returned a stream rejected as malformed. Its raw body was not captured, so
  the cause remains undiagnosed. Subsequent captured runs and the final focused suite
  passed. The client rejected the incomplete result and did not automatically replay it.
- Hosted runtime logs were delayed: the correlated test marker appeared about nine minutes
  after the request. An immediate empty log result is not execution proof.
- The CLI's production installer and advertised launcher version differ; see
  [UPSTREAM-COMPATIBILITY.md](UPSTREAM-COMPATIBILITY.md).
- The expanded suite passed on the current Node runtime. Earlier tests passed on the
  supported minimum Node 22.19, but the entire expanded suite has not been repeated there.

## Repeatable checks

See [TESTING.md](TESTING.md) for credentials, sandbox selection, opt-ins and cleanup rules.
The focused agent suite is `npm run test:agents -- --execute`; the automation and account
suites have their own documented commands. Live writes must be proved by fresh reads.
Email API acceptance alone is not delivery evidence: confirm actual receipt and link access.
