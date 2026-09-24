# Using FuseBase MCP with 1Password

This is how to run the server with every secret in 1Password and none on disk. It follows
1Password's guidance for agents and MCP servers: `.env` holds only `op://` references, and
`op run` resolves them in memory when the server starts.

What the server needs:

| Variable | What it is |
| --- | --- |
| `FUSEBASE_GATE_TOKEN` | Gate MCP token |
| `FUSEBASE_DASHBOARDS_TOKEN` | Dashboards MCP token |
| `FUSEBASE_SECRET_KEY` | Key that encrypts the saved cookies and credentials in `data/*.enc` (64 hex characters, or base64 of 32 bytes) |

Anything else in `.env` (`FUSEBASE_HOST`, `FUSEBASE_ORG_ID`, IDs, account names) is not secret.

> **Keep your own configuration private.** Your `.env` and your MCP client configs name your
> vaults, items, Environment and account. `.env` is gitignored; don't commit it, and don't put
> your `op run` launch command in the shared `.mcp.json`.

## Recommendations for storing tokens that agents use

These apply to any agent or MCP server, not just this one. Vault, item and Environment
names are up to you.

- **Keep agent secrets apart from your personal ones.** Put the secrets for each project or
  agent in their own vault or 1Password Environment, holding only what that agent needs.
- **Running the agent yourself?** Use your own 1Password account with `op run`. You approve
  once when the process starts, and no token is stored anywhere.
- **Running unattended (CI, Docker, always-on agents)?** Create a service account with
  **read-only** access to that one vault or Environment. Service account access can't be
  changed later, so create a new one if the needs change.
- **Store a service account token outside the vault it unlocks**, for example in your private
  vault, and never in the repo, `.env`, MCP client configs or shell profiles. For unattended
  runs, supply it through the platform's secret store.
- **Use one service account per tool.** Avoid a machine-wide `OP_SERVICE_ACCOUNT_TOKEN`:
  every `op` command on the machine picks it up, whichever tool it was meant for.
- **Agents see names, not values.** An agent can check which variables are set, but shouldn't
  read, print or copy secret values.
- **Rotate anything that was ever stored in plaintext**, and revoke tokens you no longer use.

## Choose where the secrets live

**A. Vault items (simplest).** Store each secret as an item in a vault and reference it:

```env
FUSEBASE_GATE_TOKEN=op://<vault>/<gate token item>/credential
FUSEBASE_DASHBOARDS_TOKEN=op://<vault>/<dashboards token item>/credential
FUSEBASE_SECRET_KEY=op://<vault>/<key item>/password
```

Copy an item's exact reference from the 1Password app (item → field → **Copy Secret
Reference**).

**B. A 1Password Environment.** Put the three variables in an Environment, and give a service
account read access to it. The stable `op` CLI can't read Environments yet (it needs the beta,
2.33.0-beta.02 or later), so the server reads the Environment itself with the 1Password SDK:

```env
FUSEBASE_OP_ENVIRONMENT_ID=<environment id>
FUSEBASE_OP_SERVICE_ACCOUNT_TOKEN=op://<vault>/<service account token item>/credential
```

- The Environment ID is under Developer → View Environments → your Environment → Manage
  environment → **Copy environment ID**.
- A service account's vault and Environment access can't be changed after it's created.
  Give it **read** access only.
- Save the service account token in 1Password when you create it, and reference it as above.
  `op run` resolves it at startup, and the server uses it to read the Environment.

Precedence at startup: real environment variables, then the 1Password Environment, then
`.env`.

## Start the server with `op run`

```bash
op run --account <your-account>.1password.com --env-file=.env -- node dist/index.js
```

With desktop-app sign-in, you approve **once each time the server starts** (1Password shows
the prompt). `op run` resolves every reference in that one approval, and processes the server
starts inherit the values.

### Claude Code

Add a **local-scope** entry: it is stored in your `~/.claude.json`, overrides the project's
shared `.mcp.json`, and is never committed. Use absolute paths.

```bash
claude mcp add fusebase --scope local \
  -e FUSEBASE_TOOLS=all \
  -e OP_SERVICE_ACCOUNT_TOKEN= \
  -- op run --account <your-account>.1password.com --env-file=/path/to/fusebase-mcp/.env \
     -- node /path/to/fusebase-mcp/dist/index.js
```

`-e OP_SERVICE_ACCOUNT_TOKEN=` clears a machine-wide service account token that another tool
may have set. When that variable is set, `op` signs in as that service account instead of
you, and it usually can't see your FuseBase items.

### Claude Desktop

Claude Desktop's config file is also private. Use the same command:

```json
{
  "mcpServers": {
    "fusebase": {
      "command": "op",
      "args": ["run", "--account", "<your-account>.1password.com", "--env-file", "C:\\path\\to\\fusebase-mcp\\.env",
               "--", "node", "C:\\path\\to\\fusebase-mcp\\dist\\index.js"],
      "env": { "OP_SERVICE_ACCOUNT_TOKEN": "" }
    }
  }
}
```

### Tests and scripts

Run anything that needs secrets under `op run` as well, for example:

```bash
op run --account <your-account>.1password.com --env-file=.env -- npx tsx scripts/check-1password.ts
op run --account <your-account>.1password.com --env-file=.env -- npx tsx scripts/test-all.ts --live-only
```

`scripts/check-1password.ts` reports which secrets are set and where each came from (names
only, never values). It also flags any plaintext secret left in `.env`.

## Without `op run`

The server also resolves `op://` values in `.env` on its own at startup, using the CLI
through the desktop app as `FUSEBASE_OP_ACCOUNT` (one approval per start). `op run` is the
recommended form. This fallback is for clients that can't wrap the command.

## Docker

The image contains no secrets. Pass them in at start-up by wrapping `docker compose` in
`op run`, which resolves `.env` into the environment Compose reads:

```bash
export MCP_AUTH_TOKEN=$(openssl rand -hex 32)   # clients send this as a bearer token
op run --account <your-account>.1password.com --env-file=.env -- docker compose up -d
```

- Using a 1Password Environment, the container receives only `FUSEBASE_OP_SERVICE_ACCOUNT_TOKEN`
  and `FUSEBASE_OP_ENVIRONMENT_ID`, and loads the tokens and key itself with the 1Password SDK.
  The log shows `Loaded 3 variable(s) from 1Password Environment: …`, names only.
- Mount `./data` (the compose file does) so the container can read the encrypted cookies and
  credentials. It needs the same `FUSEBASE_SECRET_KEY` that wrote them.
- Don't run `docker compose up` without `op run`. Compose reads `.env` on its own and would
  pass the `op://` text instead of the value. There's no `op` CLI in the image, so the server
  logs that it couldn't read the variable and runs without it.
- Variables passed to a container are visible to anyone who can run `docker inspect` on this
  host. For a shared or production host, use your platform's secret store rather than plain
  environment variables.

To run the live suites against a running server (for example this container) instead of a
local one, set `FUSEBASE_MCP_URL` and `MCP_AUTH_TOKEN`:

```bash
op run --account <your-account>.1password.com --env-file=.env -- \
  env FUSEBASE_MCP_URL=http://127.0.0.1:3000/mcp npx tsx scripts/test-all.ts --live-only
```

## Unattended use (CI, servers)

There's no one to approve a prompt, so give the process a service account token
(`OP_SERVICE_ACCOUNT_TOKEN` for `op run`, or `FUSEBASE_OP_SERVICE_ACCOUNT_TOKEN` for the
server's own Environment loading) through the platform's secret store. Never put it in a
committed file or an image.

## Moving existing secrets into 1Password

1. Put the tokens and the key in 1Password (vault items or an Environment). The key is the
   contents of `data/.key`, or your existing `FUSEBASE_SECRET_KEY`.
2. Replace the values in `.env` with references (see above).
3. Run `scripts/check-1password.ts` and the live tests under `op run`.
4. Once they pass, delete the plaintext copies: the token lines in `.env`, `data/.key`, and
   any `data/*.legacy-bak` files. Consider rotating tokens that were stored in plaintext.

If `FUSEBASE_SECRET_KEY` can't be loaded and `data/.key` is gone, the server stops with a
clear error instead of creating a new key. A new key couldn't read the existing encrypted
files.

## For AI agents working in this repo

- Never print, log or commit secret values, and never paste them into chat. Check secrets
  with `scripts/check-1password.ts`, which shows names only.
- New tokens go into 1Password (in the app, or with `op item create` using your own account);
  add only the reference to `.env`.
- Don't run many separate `op` commands: each new process needs its own approval. Put the
  work under a single `op run`.
