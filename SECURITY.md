# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's **Report a vulnerability** button on the [Security tab](https://github.com/ryan-haver/fusebase-mcp/security/advisories/new), not in public issues. Include:

- the affected version;
- how to reproduce it;
- the impact.

You'll get a reply within a week.

## Supported versions

Only the latest release receives security fixes.

## Scope notes

This server acts with the FuseBase credentials it's given.

- **HTTP mode** listens on loopback by default. Binding to any other address requires `MCP_AUTH_TOKEN`. Anyone holding that token can do everything the configured FuseBase account can, so treat it like a password.
- **Credentials at rest** (`data/*.enc`) are encrypted with `FUSEBASE_SECRET_KEY` or `data/.key`. Keep that key secret too. We recommend keeping all secrets in 1Password ([docs/1PASSWORD.md](docs/1PASSWORD.md)).
- **FuseBase itself:** issues in FuseBase's own service should be reported to FuseBase.
