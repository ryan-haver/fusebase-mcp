# AGENTS.md - Single Source of Truth for LLMs

This file is the **definitive guide** for AI agents and LLMs working with Fusebase Apps apps.

**Invariant — MCP unavailable:** If MCP is not connected (tools not visible or `tools_list()` fails), **STOP**. Do not invent workarounds, scripts, or fake calls. Inform the user and follow troubleshooting; do not continue with dashboard/backend work until MCP is available.

## Golden Rule

**During development (LLM work): use MCP ONLY.**

- ✅ read/write data
- ✅ create/update databases/dashboards/views/columns
- ✅ upload files if exposed as MCP tool
- ✅ discover schemas, IDs, permissions
- ❌ **If MCP tools are not available, STOP and follow MCP troubleshooting steps - do NOT create workarounds**
- ✅ **verify API calls with test scripts** — when unsure about endpoint behavior or response shapes, use the **api-exploration** skill to create temporary tokens and run test scripts (`_test-api.ts` / `_test-sdk.ts`). These are **not** MCP workarounds; they test the real API directly. Clean up test files after verification.

**Inside the app (runtime code — UI and optional app `backend/`): use the SDK for every operation it covers.**

- ✅ UI and app backend read/write via SDK methods with the app token — for `DashboardDataApi`, use **`path: { dashboardId, viewId }`** ([details](#dashboard-data-sdk-path-parameters-spa-and-backend))
- ✅ SDK initialized with app token
- ✅ a few operations have **no SDK method** — runtime code calls those documented endpoints directly with `fetch` (follow the relevant skill or the scaffold)
- ❌ runtime code must not call MCP

## Type safety invariant (non-negotiable)

Senior bar: **do not** “fix” errors with **`any`**, **`as any`**, **`as Record<string, unknown>`**, or **`as unknown as …`** on **SDK/API JSON** — that passes `typecheck` but hides wrong fields (e.g. `role` vs `orgRole`). Use **`@fusebase/*` exports**, **`Awaited<ReturnType<Api["method"]>>`**, **`sdk_describe`**, narrow at boundaries; extend types instead of erasing them. Non‑trivial TS → **typescript-pro** ([Required Skills](#required-skills)).

## Skills Location

All skills are located in `.claude/skills/`. When this document references a skill (e.g., `fusebase-cli`), look for `SKILL.md` in that folder.

For named environment work, use local guide titles rather than repository-only
links: **App Environments Guide** explains `fusebase env`; **App Environment
Migration Guide** is the checklist for converting existing apps; **E2E
Playwright Setup Guide** explains how to add the CLI e2e template and GitLab
CI. Pair them with skills **fusebase-cli**, **app-e2e-tests**,
**app-backend**, and **fusebase-gate** as the task requires.

## Custom additions in skill docs (update-safe rule)

When adding project-specific guidance to skill markdown files (`SKILL.md` and `references/*.md`), place it only inside custom blocks:

```md

<!-- CUSTOM:SKILL:BEGIN -->
...your custom content...
<!-- CUSTOM:SKILL:END -->


```

Rules:

- You may use one or multiple custom blocks in a file.
- Custom blocks can be placed anywhere in the file.
- Keep base template content outside custom blocks unchanged.
- Never put custom additions outside this block in managed skill files.
- If blocks already exist, update only content inside them.

**"Skill in context"** means `SKILL.md` **and** its `references/*.md` files. Reading only `SKILL.md` is **not sufficient** — you **must** also read the relevant references. For dashboard work: `references/core-concepts.md` for the entity model; **`references/data-patterns.md` is mandatory** whenever you write runtime code that reads or writes dashboard data via the SDK — it documents the real shapes for data operations (not only `sdk_describe`). Skipping references leads to broken entities or silently empty UI (e.g. wrong `data` vs `data.rows` parsing).

**Two MCP-oriented skills (different products):**

- **`fusebase-dashboards`** (folder `.claude/skills/fusebase-dashboards/`) — dashboards, databases, views, dashboard data, and the dashboard-service SDK path during development. See [Required Skills](#required-skills).
- **`fusebase-gate`** (folder `.claude/skills/fusebase-gate/`) — **Fusebase Gate** and the wider platform surface: how to use the Gate MCP and SDK for org-scoped flows, user lists and membership, tokens and authz, health/bootstrap, and other platform capabilities (e.g. email campaigns, automation, integrations) **as exposed through Gate**. Load it **before** Gate MCP work or when integrating apps with orgs, users, and platform services beyond raw dashboard data.

## Platform-resolved resources are not secrets

Gate-managed resource identifiers are not app-owned secret configuration.

- Do **not** ask the user to create app secrets or env vars for `storeId`, database IDs, dashboard/view IDs, physical database names, provider connection details, `productId`, app subdomains, or Fusebase host URLs.
- For Gate isolated stores, runtime code must use the app token/source scope and a stable store alias to resolve the store through Gate, or use the platform-provided binding when available.
- `storeId` may appear in MCP/operator handoff logs, Studio links, or CLI migration commands, but it must not be persisted as an app secret, checked into runtime config, or hardcoded in app code.
- `fusebase secret create` is for real credentials such as third-party API tokens, OAuth client secrets, or app-owned HMAC/session signing keys when the relevant production flow explicitly requires one.

## Cross-App API Rule

If the task references **another Fusebase app in the same organization** and asks to use **its API**, treat that app as a **peer app**, not as a third-party opaque service.

**Default workflow:**

1. Discover the published app API through Gate:
   - `searchAppApiOperations`
   - `listAppApiOperations`
   - `getAppApiOperation`
2. Build the integration around the published contract.
3. Use `callAppApi` or direct runtime probing only after discovery if behavior still needs to be verified.

**Security-sensitive operations:**

- Prefer contract-level policy over ad hoc shared secrets when the platform supports it.
- Use `x-fusebase-allowed-callers` to restrict which caller project may invoke the operation — a caller id is the calling project's `productId` (`client:<productId>`), not an app id.
- Use `x-fusebase-required-permissions` only with the `app_api.<namespace>.<capability>.<action>` format, for example `app_api.client_portal.provision.write`.
- Treat `allowedCallers` as caller identity and `requiredPermissions` as caller capability; do not mix these concerns.
- **Enforcement arrives per environment.** Both extensions are published now, but `callAppApi` only enforces them where the platform has switched enforcement on. Declare them and grant the capability to caller apps now (`fusebase app update <callerAppId> --permissions "app_api.<namespace>.<capability>.<action>"`) so the grants are in place, but never make them your only authorization check.

**Anti-patterns:**

- Do **not** start with local source-code search if the target app is separately deployed.
- Do **not** ask for raw OpenAPI export, manual endpoint lists, or app settings screenshots as the first step.
- Do **not** treat dashboard tables, storage schemas, or MCP database access as the primary integration surface when a published app API exists.
- Do **not** claim end-to-end verification unless the real consumer path was tested against the target app API.

## Two Concepts (SDK, MCP)

| Concept | Where used                                                                                 | Purpose                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **SDK** | Runtime code **inside the generated app** (browser/UI and optional app **`backend/`**) | App reads/writes data via SDK; LLM does **not** use SDK.                                                                                  |
| **MCP** | **In the LLM** during development                                                          | LLM uses MCP tools to discover, create, update backend. Configure MCP in your IDE (project-level or globally per IDE instructions in `mcp/`). |

**Summary**: SDK = runtime, in app, not in LLM. MCP = in LLM, during development. Configure MCP in the IDE; for IDEs without project-level MCP, use the setup instructions in `mcp/`.

### Public npm SDK packages (required)

Runtime code must depend on the **published** `@fusebase/` packages from the public npm registry (see root `package.json`):

- **`@fusebase/dashboard-service-sdk`** — dashboards, databases, views, dashboard data.
- **`@fusebase/fusebase-gate-sdk`** — Fusebase Gate (orgs, users, tokens, platform APIs exposed via Gate).

Install with your package manager as needed, e.g. `npm install @fusebase/dashboard-service-sdk @fusebase/fusebase-gate-sdk`.

### Dashboard data SDK: path parameters (SPA and backend)

The OpenAPI-generated **`@fusebase/dashboard-service-sdk`** wraps HTTP path segments in a **`path` object** for many operations (notably **`DashboardDataApi`**: `getDashboardViewData`, `batchPutDashboardData`, etc.).

- **Correct (SDK):** `{ path: { dashboardId, viewId }, ... }` — plus `body`, `page`, `limit`, or other fields exactly as **`sdk_describe`** shows for that method.
- **Wrong (SDK):** top-level `{ dashboardId, viewId, ... }` — that shape matches **MCP** `tool_call` **args**, not the TypeScript SDK. Copy-pasting from MCP examples into SDK calls without nesting **`path`** breaks requests (often only noticed after deploy in **`backend/`** if the SPA used hooks that already wrapped `path` correctly).

Use the **same** SDK argument shape in **React code and in `backend/`** (Hono routes, `public.ts`, shared clients). Do not assume "backend can flatten" the object.

**Canonical detail and examples:** `.claude/skills/fusebase-dashboards/references/data-patterns.md` (Common Patterns, envelopes) and **`references/sdk.md`** (initialization and `getDashboardViewData` example with `path`).

## MCP Connection Check (REQUIRED - MUST BE FIRST STEP)

**CRITICAL — before ANY task:** verify MCP tools (`tools_list`, `tools_search`, `tools_describe`, `tool_call`) are visible in your tool list and `tools_list()` returns a non-empty list. If unavailable: **STOP**, inform the user, do **NOT** create scripts or workarounds, and follow troubleshooting in skill **fusebase-dashboards** (for Gate MCP, see **fusebase-gate**).

Config: `.env` (`DASHBOARDS_MCP_TOKEN`, `DASHBOARDS_MCP_URL`); MCP config: `.cursor/mcp.json`, `.vscode/mcp.json`, `.mcp.json`, `.codex/config.toml`; run `fusebase init` to set up; other IDEs see `mcp/`.

## Fusebase hosts

Read from the project **`.env`** when you need the host for links or docs:

- **FUSEBASE_HOST**: thefusebase.com
- **FUSEBASE_APP_HOST**: thefusebase.app (apps subdomain, e.g. for app URLs)

### Runtime host resolution (multi-env safe — REQUIRED)

**Never bake a platform host into the frontend bundle** (no
`VITE_FUSEBASE_HOST`-style constants for choosing API endpoints). A bundle
built with one backend's host and deployed against another silently sends SDK
calls cross-backend (`getMe` fails with status `0` — network/CORS — and blocks
the whole app load). Instead, resolve at runtime, in this order:

1. **Same-origin relative paths** for app-api/proxy calls — no host needed at
   all; the platform routes them. Prefer this always.
2. When an absolute host is unavoidable, derive it from
   **`window.location.hostname`** (`…thefusebase.app` → dev hosts,
   `…thefusebase.app` → prod hosts) or from **`/fusebase-env.json`**
   (`backend` field; present on environment-aware deploys).
3. Build-time env values are acceptable only for **backend** code (server
   processes get the correct values from platform secrets / deploy-time env).

**Degrade gracefully:** a failed `getMe` must not block the entire app load.
When env info is present, `orgId`/`appId` are already known — render the
shell, surface the auth error in the affected area only (see the
`handling-authentication-errors` skill).

### Runtime context priority (orgId / appId / backend)

Deploys inject the environment context **synchronously** as
`window.__FUSEBASE_ENV__` in `index.html` (same payload as
`/fusebase-env.json` — env name, `backend`, `orgId`, `productId`, `appId`).
Resolve runtime context in this strict order:

1. `window.__FUSEBASE_ENV__` (synchronous — available before any request;
   no race);
2. `/fusebase-env.json` fetch (older deploys);
3. `getMe` — for **user** identity only; it must never override the
   deploy-time `orgId`/`appId`;
4. build-time constants (`VITE_FBS_ORG_ID` and similar) — **last resort**,
   and never on a hostname that belongs to a different backend than the one
   they were baked for.

Do not fire data requests that need `orgId` before the context is resolved —
with `window.__FUSEBASE_ENV__` that resolution is synchronous, so there is
nothing to wait for. A Gate `FORBIDDEN` ("User does not have access to this
organization") right after load is the signature of a stale baked org id
racing the env context.

## Token Sources

### MCP Token (Development)

MCP token comes from `.env`:

```bash
DASHBOARDS_MCP_TOKEN=...
DASHBOARDS_MCP_URL=https://dashboards-mcp.thefusebase.com/mcp
```

**Used by**: LLM during development work (MCP tools). Hosts (`FUSEBASE_HOST`, `FUSEBASE_APP_HOST`) are separate project-wide vars — see [Fusebase hosts](#fusebase-hosts) above.

### productId in App Runtime

**productId** must be passed into the app at runtime (e.g. via dev server postMessage or deployment context).

### SDK Token (Runtime)

SDK token usage in app runtime:

**Browser/UI runtime**:

- Uses app token from cookie `fbsfeaturetoken`; if the cookie is absent, fall back to `window.FBS_FEATURE_TOKEN`
- `.env` is NOT accessible in browser
- LLM must never assume `.env` tokens in UI code
- Direct SDK / Fusebase proxy calls pass the token via `x-app-feature-token`
- Calls to the app's own backend (`/api/*`) must assume deployed platform proxies may strip `x-app-feature-token`; backend handlers must read header or fallback to cookie `fbsfeaturetoken` when the route needs **visitor app-proxy auth** (most `/api/*` traffic).
- For user-facing Gate **reads** of the current user (`getMyOrgAccess`, role-gated UI), stay in user context: use the request `fbsfeaturetoken` cookie on the app host. After NH1 platform magic links, org `eversessionid` is on the org domain only — do not require it on same-origin app-backend calls. For legacy `/link` + `activateAppMagicLink`, POST `{ featureToken, sessionToken }` in the body or forward `EverHelper-Session-ID` when you have `sessionToken` in hand. Do not use the backend service token to impersonate the visitor.
- **Exception — privileged provisioning:** trusted BFF routes such as `POST /api/account/register` that call `registerFusebaseOrgMember` or `addOrgUser` must use `process.env.FBS_FEATURE_TOKEN` for the Gate call (see `fusebase-gate/references/fusebase-auth.md`). The visitor cookie on the incoming request is not sufficient for org membership writes; that is not a "fallback" for user identity — it is a separate server-side provisioning step.
- **`window.FBS_FEATURE_TOKEN` / cookie `fbsfeaturetoken`** (browser) and **`process.env.FBS_FEATURE_TOKEN`** (backend env) are different artifacts — same name, different scope. Browser token is visitor JWE; backend env is the deploy-time service token with app permissions.
- Public/visitor apps can open with a visitor app token, but visitor tokens normally do **not** receive isolated-store permissions. For public portal reads/writes, use an app backend with a service token plus trusted portal/workspace context. Prefer `trustedRuntimeContext.portalId` / `trustedRuntimeContext.workspaceId` when the token has `isolated_store.rls.delegate`; if unavailable in the target environment, a custom `rlsContext` key such as `req_portal_id` is only a reviewed temporary fallback derived from trusted auth context.
- In local `fusebase dev start`, `FBS_FEATURE_TOKEN` may be absent in backend env. Backend-only service-token code may use `process.env.FBS_FEATURE_TOKEN ?? process.env.GATE_MCP_TOKEN` for dev, but browser/UI code must never read `.env` or use MCP/service tokens.
- On **deploy**, backend `FBS_FEATURE_TOKEN` must be sent to Gate as **`x-app-feature-token`**, not `Authorization: Bearer`. Use **`FBS_ORG_ID`** for org id; do not reject the token when `getMe().scopes` is empty — verify isolated-store access with `listIsolatedStores` instead (see `app-backend` skill). **`getMe` does not require `health.read` in the app grant** (authenticated-only op).

**Rules**:

- LLM must NOT use SDK token during development
- Browser runtime authenticates direct SDK / Fusebase proxy calls using `x-app-feature-token`
- App backend auth for **app-proxy forwarding** is `header || cookie('fbsfeaturetoken')` on routes that need a visitor token to reach the backend.
- User-facing Gate **identity** endpoints: fail closed on missing/invalid app token; use session header when required — do not substitute `FBS_FEATURE_TOKEN`.
- User-facing Gate **org provisioning** (`registerFusebaseOrgMember`, `addOrgUser`): use `FBS_FEATURE_TOKEN` inside the BFF handler only (see `fusebase-gate/references/fusebase-auth.md`).

## LLM Checklist

**Before starting ANY work, verify (in this exact order):**

- [ ] **MCP connection verified** — see [MCP Connection Check](#mcp-connection-check-required--must-be-first-step); `tools_list()` returns a non-empty list. If unavailable: **STOP**, do NOT create scripts or workarounds.
- [ ] **Loaded `fusebase-dashboards` skill** — read skill `fusebase-dashboards` **before any dashboard operations.** Do NOT skip; the skill contains prompts_search groups, validation rules, and intent schemas. **When this skill is in context, you do not need to call prompts_search for domain knowledge — the skill content is sufficient.**
- [ ] **Loaded `fusebase-gate` skill when relevant** — if the task involves **Fusebase Gate** (organization users, membership, platform tokens, Gate health/bootstrap, or other Gate/platform APIs), read skill `fusebase-gate` **before** discovery or `tool_call` on the gate MCP.
- [ ] **Backend system routes (`FBS_FEATURE_TOKEN`)** — if deploy backend calls Gate (isolated store, webhooks): feature header on prod, `FBS_ORG_ID` for org, capability via `listIsolatedStores` — not `getMe().scopes` (see `app-backend` skill).
- [ ] **Describe before use** — before using an MCP tool or adding SDK code for an operation, call `tools_describe` (or `sdk_describe` for SDK) to know input/output format; do not guess schemas.
- [ ] **No fake secrets for resource IDs** — before proposing `fusebase secret create` or new env vars, verify the value is a real credential. Never put Gate isolated-store IDs, database/dashboard/view IDs, host URLs, `productId`, or app subdomains into app secrets.
- [ ] **Dashboard SDK data code** — read `fusebase-dashboards/references/data-patterns.md` **and** call `sdk_describe` for the method before parsing responses; do not assume nested fields like `data.rows` without checking.
- [ ] **Dashboard data SDK `path` params** — for `getDashboardViewData` / `batchPutDashboardData` / similar, use `{ path: { dashboardId, viewId } }` in **both** SPA and **`backend/`**; do not pass flat `{ dashboardId, viewId }` copied from MCP `tool_call` args.
- [ ] **Type safety** — no `any`/broad casts on SDK JSON; see [Type safety invariant](#type-safety-invariant-non-negotiable).
- [ ] **Scaffolded app** (if creating a new app): Ran `fusebase scaffold --template spa` before writing app files
- [ ] **API verification** — if unsure about an endpoint's behavior or response shape, load skill **api-exploration** and run a test script with a temporary token before writing app code

## Mental Model: MCP + SDK Architecture

### MCP (Model Context Protocol) = Development Tool for LLMs

**Token**: `DASHBOARDS_MCP_TOKEN` from `.env`

**What MCP provides:** tools for discovery and execution (e.g. `tools_list`, `tools_search`, `tools_describe`, `tool_call`), bootstrap/context, prompts loading, and domain operations. **MCP is used for ALL backend operations during LLM development work.** For the exact flow (bootstrap → domain knowledge → discovery → tool_call) and schemas, see the **fusebase-dashboards** skill. **When that skill is in context, prompts_search for domain knowledge is optional — the skill content is sufficient.**

### SDK = Runtime Execution (browser and optional app backend)

**Token**: App token from cookie `fbsfeaturetoken` (fallback: `window.FBS_FEATURE_TOKEN` if cookie is absent); direct SDK / Fusebase API calls pass it via `x-app-feature-token`, but app backend handlers must support `header || cookie`

**SDK Structure**:

- `createClient()` - Single entrypoint
- Dashboard API classes: `DashboardsApi`, `DatabasesApi`, `DashboardDataApi`, `CustomDashboardRowsApi`, `TemplatesApi`, `TokensApi`
- Dashboard Base URL: `https://app-api.thefusebase.com/v4/api/proxy/dashboard-service/v1` (dev) or production URL
- Gate API classes: `HealthApi`, `TokensApi`, `SystemApi`, `OrgUsersApi`
- Gate Base URL: `https://app-api.thefusebase.com/v4/api/proxy/gate-service/v1` (dev) or production URL

**SDK is ONLY used in app runtime code, never during LLM development.**

### 1 MCP Tool ↔ 1 SDK Method

Every MCP tool has a corresponding SDK method with the same `operationId` and request/response schemas. MCP for LLM discovery/execution during development → SDK for runtime execution in app code.

**Discovery**: LLM uses MCP tools (`tools_search`, `tools_describe`) to find operations, then uses SDK discovery (`sdk_search`, `sdk_describe`) to find corresponding SDK methods for app code. Always **describe before use** — run `tools_describe` before calling an MCP tool, `sdk_describe` before inserting SDK code, and read **`fusebase-dashboards/references/data-patterns.md`** before parsing dashboard data responses. See the `fusebase-dashboards` skill for MCP flow and SDK discovery.

## Canonical Workflow

### Step 0: Pre-flight Check (MANDATORY - DO NOT SKIP)

Complete the [LLM Checklist](#llm-checklist) above before proceeding with any work.

### Step 0.5: Load Required Skills (MANDATORY - DO NOT SKIP)

Load skills as described in [Required Skills](#required-skills) before discovery or `tool_call` operations.

### Step 1: Discovery (MCP-only)

**Important**: All domain/business operations must be executed via **`tool_call`** with `opId` and `args`. Only meta/builtin tools can be called directly.

**Workflow:** Bootstrap/connection context → have domain knowledge (if **fusebase-dashboards** skill is in context, that is sufficient; otherwise load domain prompts via `prompts_search` with a **group filter** — see that skill; never call `prompts_search({})` without groups) → discover operations via `tools_search`/`tools_list` → `tools_describe` → execute via `tool_call`.
**Endpoint verification:** If you need to confirm an endpoint's actual response shape or behavior before writing app code, use the **api-exploration** skill — create a temporary token and run a test script. This complements MCP discovery; it does not replace it.

**Critical**: Never hardcode database/dashboard/view IDs. Always discover them via MCP first. Concrete opIds and flow details are in the **fusebase-dashboards** skill.

For Gate isolated stores, do not replace hardcoding with secrets. Runtime app code should resolve the store through Gate from app scope/permissions and stable alias; secrets/env vars for `storeId` or database identity are still hardcoding, just in a different file.

### Step 2: Plan (MCP-only)

Before making changes, write a plan:

- Tools you will call (by name)
- Entities you will create/update
- Data shape expectations
- Rollback/mitigation notes

**Plan must avoid**: SDK usage, manual REST calls, assumptions about schema.

### Step 2.5: Scaffold the App (if creating a new app)

Before writing any app files, scaffold:

1. `fusebase scaffold --template spa --dir apps/<name>` (+ `--template backend` if backend needed)

Never manually create `package.json`, `vite.config.ts`, `tsconfig.json`, `postcss.config.js`, `index.html`, or `globals.css` — scaffold generates the canonical versions. Then proceed to Steps 3–4 to implement the app. **Register and start dev after the code is written** — see Step 4.5.

### Step 3: Execute Changes (MCP-only)

**Creating structure** (LLM development only - NOT app code): Use `tool_call` with the appropriate opIds to create/update dashboards, views, and schema. See **fusebase-dashboards** skill for flow and operation names. These calls do NOT go into app code; app code uses SDK (Step 4: Handoff to Runtime).

**Reading/writing data** (during LLM development - NOT app code): Use `tool_call` for read/write; opIds and schema (e.g. data operations, `schemaMode`) are in the **fusebase-dashboards** skill. These calls do NOT go into app code; app code uses SDK (Step 4). Re-run list/describe tools to verify changes.

### Step 4: Handoff to Runtime (SDK-only)

When development is complete, provide:

**Output artifacts**:

- Discovered IDs (dashboardId/viewId/etc.)
- Column keys and types (schema snapshot)
- Mapping table: "Column Name → Column Key → Type"
- Constraints (required columns, enum/select ids)

**Runtime code** (SDK-only):

**Important**: LLM inserts SDK code into app files but does NOT execute it. App code executes SDK methods at runtime.

**Discovery**: Use MCP tools to discover SDK methods (see `fusebase-dashboards` skill and its `references/sdk.md`):

1. Find MCP tool via `tools_search`/`tools_describe`
2. Find corresponding SDK method via `sdk_search`/`sdk_describe`
3. Insert SDK code into app file using discovered schema

**Browser/UI runtime usage** (using app token):

```typescript
import {
  createClient,
  CustomDashboardRowsApi,
  DatabasesApi,
} from "@fusebase/dashboard-service-sdk";

const BASE_URL =
  "https://app-api.thefusebase.com/v4/api/proxy/dashboard-service/v1";

export function createSdkClient(appToken: string) {
  // Leave the SDK's 30000ms `timeout` default alone — skill app-backend § Cold Starts.
  return createClient({
    baseUrl: BASE_URL,
    defaultHeaders: { "x-app-feature-token": appToken },
  });
}

export function createDatabasesApi(appToken: string): DatabasesApi {
  return new DatabasesApi(createSdkClient(appToken));
}

// Usage: read app token from `fbsfeaturetoken` cookie (fallback `window.FBS_FEATURE_TOKEN`), then e.g.:
// const databasesApi = createDatabasesApi(appToken)
// const response = await databasesApi.listDatabases({})
```

**Custom app backend usage** (`/api/*`):

```typescript
// Same-origin requests automatically include the fbsfeaturetoken cookie.
// In deployed mode, do not rely on x-app-feature-token surviving the platform proxy.
const res = await fetch("/api/items");
```

Backend handlers must read the app token from header first and cookie second:

```typescript
import { getCookie } from "hono/cookie";

const appToken =
  c.req.header("x-app-feature-token") || getCookie(c, "fbsfeaturetoken");

if (!appToken) {
  return c.json({ error: "Missing app token" }, 401);
}
```

**Browser/UI runtime usage for Fusebase Gate** (using app token):

```typescript
import {
  createClient,
  OrgUsersApi,
  TokensApi,
} from "@fusebase/fusebase-gate-sdk";

const GATE_BASE_URL =
  "https://app-api.thefusebase.com/v4/api/proxy/gate-service/v1";

export function createGateSdkClient(appToken: string) {
  // Leave the SDK's 30000ms `timeout` default alone — skill app-backend § Cold Starts.
  return createClient({
    baseUrl: GATE_BASE_URL,
    defaultHeaders: { "x-app-feature-token": appToken },
  });
}

export function createOrgUsersApi(appToken: string): OrgUsersApi {
  return new OrgUsersApi(createGateSdkClient(appToken));
}

export function createGateTokensApi(appToken: string): TokensApi {
  return new TokensApi(createGateSdkClient(appToken));
}
```

### Step 4.5: Register the App and Start Dev (for new app after code is complete)

Once app code is written and ready to run, **execute these automatically — do NOT list them as "next steps" for the user**:

1. **Register**: `fusebase app create --name="<App Name>" --subdomain=<app-sub> --path=apps/<name> --dev-command="npm run dev" --build-command="npm run build" --output-dir=dist` `--coding-agent=<agent> --model=<model>`
2. **Start dev**: `fusebase dev start apps/<name>`

The app must be registered before it can run. Never leave these for the user to execute manually.

**When updating an existing app**: run `fusebase app update <appId>` if needed. See skill **fusebase-cli** for the full update reference.

## Explicitly Forbidden

### ❌ Guessed or hand-built HTTP Requests

**DO NOT** invent HTTP calls to Fusebase APIs:

- Don't guess endpoints
- Don't hand-build URLs for operations the SDK already covers
- Use MCP tools during development; in runtime, use the SDK for everything it covers

This rule is scoped to **Fusebase APIs**. It does not forbid documented
server-side API or official SDK calls to third-party services that the app owns,
such as Stripe. If an app has its own Stripe account and server-side secret, the
agent may implement or execute an authorized Stripe operation (for example,
creating a webhook endpoint) from trusted backend code without exposing the
secret. Load the `fusebase-gate` Stripe references to decide whether a billing
object is Gate-managed or app-owned.

**Allowed exception:** a few operations have no SDK method — runtime code may call the **documented** endpoint directly with `fetch`, as shown in the relevant skill or the scaffold. Calling a documented endpoint is fine; inventing one is not.

### ❌ Hand-written app `id` in `fusebase.json`

**DO NOT** invent or hand-write an `apps[].id` — the platform owns app ids. Register the app
with `fusebase app create` and let the CLI write the `id`.

### ❌ Calling MCP from Runtime

**DO NOT** call MCP tools from app runtime code:

- MCP is for LLM development only
- Use SDK methods in runtime
- MCP tools are not available in browser/runtime environment

### ❌ Creating Workarounds for MCP Access

**ABSOLUTELY FORBIDDEN** — see [Golden Rule](#golden-rule) for the full list of prohibited actions.

**How MCP MUST be called**: only through the LLM's built-in MCP tool mechanism (`tool_call` with `opId` + `args`). Never via raw HTTP, `curl`, or custom bridges to replace MCP.
**Exception:** Test scripts from the **api-exploration** skill (`_test-api.ts` / `_test-sdk.ts`) are allowed for verifying endpoint behavior — they call the real API, not MCP. Always clean up test files afterward.

**If MCP tools are not available**: **STOP**, inform the user, follow the troubleshooting protocol (check config, suggest restart, verify .env), and wait for MCP to be properly configured. Do not work around it.

### ❌ Hardcoding IDs

**DO NOT** hardcode database/dashboard/view IDs:

- Always discover IDs via MCP first
- IDs may change between environments
- Use MCP discovery tools to find IDs dynamically

## Required Skills

Dashboard skills are **not optional**. You **MUST** read the skill file **before** the corresponding work. Treat "required skill" as an **action**: load it first, then proceed.

### ✅ fusebase-dashboards

**MUST be loaded** — read skill `fusebase-dashboards` **before any dashboard operations.** Do NOT skip this step; it contains the exact `prompts_search` groups for each operation type, validation rules, and intent schemas. Without it you will rely on trial-and-error and risk failed `tool_call`s. **When this skill is in context, you do not need to call prompts_search for domain knowledge — the skill content is sufficient.**

Covers:

- Mandatory check: fusebase-dashboards MCP connection (suggest user check connected servers if missing)
- Bootstrap and connection context (resource or bootstrap + whoami, defaults)
- Tooling flow: have domain knowledge (skill in context or load prompts) → tools_search/tools_list → tools_describe → tool_call
- Schemas ($ref/$defs), error handling, MCP vs SDK
- MCP is for LLM development and dashboard access; SDK only for runtime code

### ✅ fusebase-gate

**Load when working with Fusebase Gate or platform-level flows** — organizations, org user lists and membership, Gate tokens and authorization scopes, health/bootstrap, and how to use the **Gate MCP** and **Gate SDK** during development vs runtime.

The skill explains how to interact with the **broader Fusebase ecosystem** beyond dashboard data: for example org-scoped user operations, platform services, email and campaign-related flows, automation, and integrations **as exposed through Gate** (see `references/*.md` for each topic). **Verify the fusebase-gate MCP server** is available before gate `tool_call` work (see skill). For runtime SDK code, follow **full `*Api` factory patterns** — not `Pick<>` / narrowed client types — so `fusebase analyze gate` and permission sync stay aligned with production calls.

For one-click client onboarding into AI Apps, load **`references/app-magic-links.md`**, **`references/fusebase-auth.md`**, and **`app-backend/SKILL.md`** (§ Magic-link session exchange): together they cover `createAppMagicLink` (owner invite), `requestAppMagicLink` (visitor self-service, generic-200 contract), and activation, including the 24h TTL and the `reason=expired|revoked` failure modes. Activation is handled server-side by the platform at `/_auth/magiclink/{key}` (HttpOnly cookies + redirect); the SPA scaffold only forwards legacy `/link?id={key}` email URLs to that endpoint and never activates links or writes session cookies itself.

**Magic-link session exchange (Test vs Production).** The only **mandatory** post-activation step for every magic-link app is the backend exchange: the SPA makes a same-origin `POST /api/account/from-magic-link` (or another app-owned route) **immediately** after the platform redirect — the HttpOnly `fbsfeaturetoken` cookie rides along — and the backend calls `getMyOrgAccess` with `x-app-feature-token` from that cookie, **fail-closed** on `source === 'member'`. Org `eversessionid` is on the org domain after NH1 and is **not** available on the app host (by design). Legacy `/link` + `activateAppMagicLink` may still POST `{ featureToken, sessionToken }` in the body. **HMAC-signed app-owned session cookies are only required in Production** (Memberspace, role-gated UI) — and that app session is the **endorsed** durable “stay signed in” path: platform `fbsfeaturetoken` is short-lived (~24h), invite `ttlSeconds` is only link-activation lifetime (not session length), and there is no silent visitor renew on the app host. **Smoke tests must not run `fusebase secret create` for `APP_SESSION_SECRET`** — and `fusebase secret create` must **never** be used for already-public values like `FUSEBASE_ORG_ID` (read from `fusebase.json`), `productId`, the app subdomain, or `FBS_*` config. See **`app-backend/SKILL.md` → "Magic-link session exchange"** for the Test/Production split, platform token lifetime, the no-secrets list, and the agent checklist.

### ✅ file-upload

For file upload functionality (separate service, not part of dashboard SDK). **Hard rule:** never store user file/binary bytes in isolated SQL (`base64` / `bytea` / data URL) — upload via Gate file service and persist only `storedFileUUID` + `readUrl`. Needing `files.write` is not a reason to use SQL blobs; visitor/public apps broker uploads on the feature backend with `FBS_FEATURE_TOKEN`.

### ✅ handling-authentication-errors

**Required for all apps.** Two layers: (1) platform `AppTokenValidationError` / `AuthExpiredModal`; (2) backend session apps — `/api/account/me` probe: **401 only** = logout, 5xx/network = retry during deploy, never false anon. Load before any auth bootstrap or global API error handler.

### ✅ app-ui-design

**Load when building or refining app UI**: pages, components, layouts, forms, theming, or accessibility. Covers visual design, UX principles, shadcn/ui patterns, layout/spacing, and avoiding generic AI aesthetics.

### ✅ app-dev-practices

**Load when creating or working on apps** — covers project structure, authentication (app token from cookie), Vite config, dev workflow, building, registering apps, cross-app navigation, and common build issues.

### ✅ dev-debug-logs

**Load when debugging an app started with `fusebase dev start`** — covers the local per-session logs in the selected app directory's `logs/dev-<timestamp>/`, including `browser-logs.jsonl`, `access-logs.jsonl`, `backend-logs.jsonl`, and `frontend-dev-server-logs.jsonl`, and explains which file to inspect for browser errors, proxied API traffic, frontend dev server output, and backend output.

### ✅ app-backend

**Load when an app needs a backend API** (REST endpoints, WebSockets, custom logic). Covers when to add a backend, `backend/` folder structure, Hono setup, `/api` route reservation, and `fusebase.json` backend config (`backend.minReplicas` only — **`maxReplicas` is not supported**; platform may scale to 3 replicas). Set `minReplicas: 1` for webhook/always-on apps. Also covers **cold starts under scale-to-zero** (client timeout floor, session handling). Session bootstrap during deploy: skill **handling-authentication-errors**. **The backend is optional** — only add when the app genuinely needs backend logic beyond dashboard SDK calls. **No code is shared between SPA and backend** — each side defines its own types independently. **Backends are not shared among apps** — only the app that owns the `backend/` folder can access it.

### ✅ app-secrets

**Load when an app backend reads `process.env` for API keys, passwords, or other sensitive config.** Covers creating secrets via `fusebase secret create`, accessing them at runtime, local development, and the checklist for verifying all secrets are registered. **After writing backend code that uses secrets from `process.env`**, you **must** run `fusebase secret create` to register every secret key — otherwise the backend will fail at runtime.

### ✅ api-exploration

**Load when you need to verify an API endpoint's actual behavior** before writing app code — response shapes, error codes, or request formats. Uses temporary tokens and test scripts (`_test-api.ts` / `_test-sdk.ts`) to make direct API calls. Complements MCP discovery; does not replace it. Clean up test files after use.

### ✅ app-sidecar

**Load when an app backend needs auxiliary sidecar containers** (headless browsers, caches, specialized services). Covers sidecar CLI commands (`fusebase sidecar add/remove/list`), `fusebase.json` configuration format, inter-container networking (localhost), resource tiers, environment variables, debugging with remote-logs, and limitations.

### Dev-level skills (TypeScript & React)

**Load when writing or reviewing TypeScript/React code** — language and framework reference skills for implementation quality. Read the skill's `SKILL.md` and, when relevant, the listed references.

- **typescript-pro** — `.claude/skills/typescript-pro/SKILL.md`
  Advanced TypeScript: strict mode, generics, conditional/mapped types, type guards, utility types, tsconfig, patterns. References: `references/advanced-types.md`, `references/type-guards.md`, `references/utility-types.md`, `references/configuration.md`, `references/patterns.md`.

- **react-expert** — `.claude/skills/react-expert/SKILL.md`
  React 18+/19: components, hooks, state management, Server Components, performance, testing. References: `references/server-components.md`, `references/react-19-apps.md`, `references/state-management.md`, `references/hooks-patterns.md`, `references/performance.md`, `references/testing-react.md`, `references/migration-class-to-modern.md`.

## Development Workflow

### Scaffolding a New App

When creating a new app, **always scaffold first** — never manually create `package.json`, `vite.config.ts`, `tsconfig.json`, `postcss.config.js`, `index.html`, or `globals.css`.

The full workflow is:

1. **Scaffold**: `fusebase scaffold --template spa --dir apps/<name>` (also run with `--template backend` if a backend is needed)
2. **Implement**: write the app code (Steps 3–4 of the Canonical Workflow)
3. **Register** _(after code is written)_: `fusebase app create --name="<App Name>" --subdomain=<app-sub> --path=apps/<name> --dev-command="npm run dev" --build-command="npm run build" --output-dir=dist` `--coding-agent=<agent> --model=<model>`
4. **Start dev** _(after registering)_: `fusebase dev start apps/<name>`

**Steps 3 and 4 must be executed automatically — do NOT list them as "next steps" for the user.**

### Starting Development

**ALWAYS use** the Fusebase CLI:

```bash
fusebase dev start FEATURE_PATH
```

**DO NOT** use `npm run dev` (or a similar command) directly - always use `fusebase dev start` as it sets up the proper development environment with authentication and app token injection.

When debugging local runtime issues through the CLI, load skill **dev-debug-logs** and inspect the current session folder under the selected app directory's `logs/dev-<timestamp>/`.

## Fusebase CLI

See `fusebase-cli` skill for complete CLI documentation.

The `fusebase` CLI is installed globally. **Always run it as `fusebase <command>` — never use `npx fusebase`** (other `npx` commands, e.g. `npx shadcn`, are allowed).

Key commands:

- `fusebase init` - Initialize new project (`--git` initializes local Git and syncs with configured GitLab remote; `--skip-git` force-disables git init/sync for this run; `--git-tag-managed` adds managed topic; interactive mode previews and allows editing suggested GitLab repo name; existing repos can be synced via `fusebase git sync` / `fusebase git --git-sync`; global flag `git-init` enables automatic post-init git flow)
- `fusebase config gitlab` - Configure GitLab sync settings in `~/.fusebase/config.json` (`gitlabHost`, `gitlabGroup`, `gitlabToken`), including interactive setup and `--show`
- `fusebase dev start` - Start development server (optional `--open` opens the dev UI in the browser; by default the URL is only printed; creates per-session debug logs in the selected app directory under `logs/dev-<timestamp>/`, including `browser-logs.jsonl`, `access-logs.jsonl`, `backend-logs.jsonl`, and `frontend-dev-server-logs.jsonl`)
- `fusebase app create --name=NAME --subdomain=FEATURE_SUB --path=PATH --dev-command=CMD --build-command=CMD --output-dir=DIR [--permissions="dashboardView.DASH_ID:VIEW_ID.read,write"]` `[--coding-agent=<agent> --model=<model>]` - Register app (all six core options required; served from subdomain root). **Set `--permissions` here at creation time** if the app needs dashboard access — do not defer to a separate `app update` step. **Always include `--coding-agent` and `--model`** to report anonymous usage stats.
- `fusebase deploy` - Deploy apps (runs lint then build per app)
- `fusebase isolated-store sql bundle --app <appPath> [--alias <alias>] [--stage dev|prod] [--status|--rls-status|--dry-run|--apply --yes|--json]` - Build the SQL migration bundle from `postgres/migrations/` plus `apps[].isolatedStores.sql[]`; use before/apply through Gate instead of hand-building JSON. Optional RLS manifest forwarding requires `fusebase config set-flag postgres-rls`.
- `fusebase update` - Single smart update command: in app directory runs full update flow (CLI self-update + agent assets + MCP/IDE + managed SDK deps/install), outside app directory runs CLI update only; use `--skip-product` for CLI-only mode even inside app
- `fusebase env create` - Create or overwrite `.env` with Dashboards/Gate MCP tokens; in TTY offers immediate `fusebase config ide --force` refresh for all IDE MCP configs (or prints it as next step when declined)
- `fusebase secret create --app <appPath> --secret "KEY:description"` - Declare app secret keys in `fusebase.json` (local edit, no URL printed); deploy/dev start registers them with empty values and prints the UI URL to set the values (`--feature` is a deprecated alias for `--app`)

Lint: run `npm run lint` from project root (or from an app directory). The project template includes ESLint (TypeScript/JavaScript plus `@eslint/json` for `*.json`). Invalid JSON — including a raw line break inside a quoted string — is reported as a parse error. Deploy runs lint automatically before build for each app that has a `lint` script.

Typecheck: run `npm run typecheck` from project root. It runs TypeScript (`tsc`) for each app that has a `typecheck` script, a `tsconfig.json`, or `tsconfig.app.json` — the same class of errors as `tsc` inside `fusebase deploy`'s build (e.g. `tsc -b && vite build`), without running Vite. ESLint does not replace this.

### Publish Rule: `deploy` does not publish permissions

`fusebase deploy` uploads code and creates a new app version. It does **not** update the app's runtime permissions.

App permissions are published only through app create/update calls:

- `fusebase app create ... --permissions="..."`
- `fusebase app update <appId> --permissions="..."`
- `fusebase app update <appId> --sync-gate-permissions`
- `fusebase app update <appId> --permissions="..." --sync-gate-permissions`

For apps that use Dashboard SDK or Gate SDK at runtime, a successful deploy is **not enough**. Before presenting the app as published, make sure permissions were explicitly synced.

If the app uses Fusebase Gate SDK:

- run `fusebase app update <appId> --sync-gate-permissions` after changing Gate SDK operations and before `fusebase deploy` or before calling the deployment published
- **SDK typing:** use factories that return full `*Api` classes (`AccessApi`, `OrgUsersApi`, …) with direct method calls — **do not** use `Pick<AccessApi, …>`, minimal interfaces, method destructuring, or `any` for Gate clients in production (breaks `fusebase analyze gate` / causes grant drift). See skill **fusebase-gate** § Gate SDK runtime patterns.
- when investigating **403** Gate errors (`Token missing required permission`, `token subject not allowed`), compare `fusebaseGateMeta.usedOps` vs `permissions` and run `fusebase analyze gate` before blaming a platform regression — especially after bumping `@fusebase/fusebase-gate-sdk`
- do not treat `Permissions: none` as success unless the app intentionally requires no runtime permissions
- run `fusebase analyze gate --operations --json --feature <featureId>` before publish and confirm `usedOps` is not empty when Gate SDK is used in runtime code
- if `usedOps` is empty but runtime imports `@fusebase/fusebase-gate-sdk`, treat publish as blocked and fix analysis/runtime call patterns before shipping

Recommended publish sequence:

1. update runtime permissions with `fusebase app update`
2. if Gate SDK is used, include `--sync-gate-permissions`
3. run `fusebase deploy`

### Isolated SQL bundle + RLS manifest

For SQL stores, keep app-owned schema files under `postgres/migrations/` and configure the app in `fusebase.json`:

```json
{
  "apps": [
    {
      "id": "client-portal",
      "path": "apps/client-portal",
      "isolatedStores": {
        "sql": [
          {
            "alias": "client-portal",
            "storeId": "00000000-0000-0000-0000-000000000000",
            "migrationsDir": "postgres/migrations",
            "schemaName": "public",
            "rlsManifestFile": "postgres/migrations/rls-manifest.json"
          }
        ]
      }
    }
  ]
}
```

Use `fusebase isolated-store sql bundle --app <appPath> --json` to inspect the exact Gate body. Use `--status`, `--rls-status`, and `--dry-run` before `--apply --yes`. The command reads `GATE_MCP_TOKEN` from `.env` for Gate calls. `rlsManifest` is attached only when the `postgres-rls` flag is enabled; otherwise SQL migrations still work and RLS validation is skipped.

RLS verification checklist after schema apply:

1. `bundle --status` must show the journal head that matches the migration manifest.
2. `bundle --rls-status` must show `bypassRls=false` for real PostgreSQL-enforced RLS tests.
3. Probe `current_setting('app.project_id', true)` or the relevant custom setting with sample `rlsContext`.
4. Scoped reads must return a subset, not all rows.
5. If `bypassRls=true`, use an explicit `WHERE current_setting(...)` filter as a temporary demo workaround and label the UI/environment as "policies not enforced".

Anti-pattern: do not assume `rlsContext` alone filters rows. It only sets transaction-local PostgreSQL settings; filtering requires a runtime role without `BYPASSRLS` plus table policies that use those settings.

## Common Failure Modes

### MCP fails / `tools_list()` fails / MCP tools not visible

**STOP IMMEDIATELY**. **DO NOT** create scripts or workarounds. Inform the user and follow the verification/troubleshooting protocol in the **fusebase-dashboards** skill. For config (`.env`, `.cursor/mcp.json`, `fusebase init`, `mcp/`), see that skill and the [LLM Checklist](#llm-checklist) above.

### "I don't know which ID / column key to use"

**STOP**. Use MCP discovery:

- `getAllDatabases` → `getDashboards` → `getDashboard` / `describeDashboard` (views in response) → `getDashboardView` for a single view

### Data saves but list/UI stays empty (silent parse bug)

Often wrong assumed response shape (e.g. `response.data.rows` vs top-level `data` and `meta`). **Fix:** read **`fusebase-dashboards/references/data-patterns.md`**, call **`sdk_describe`** for the SDK method (`schemaMode: "output"`), then align parsing with both.

### Dashboard SDK requests wrong shape (flat `dashboardId` / `viewId`)

Symptoms: 4xx from dashboard-service, empty data, or divergent behavior between SPA and **`backend/`** after deploy. **Cause:** using top-level `{ dashboardId, viewId }` in SDK calls instead of **`{ path: { dashboardId, viewId }, ... }`**. MCP `tool_call` uses a flat `args` object; the TypeScript SDK does not. **Fix:** align every `DashboardDataApi` (and similar) call with **`sdk_describe`** and [Dashboard data SDK: path parameters](#dashboard-data-sdk-path-parameters-spa-and-backend).

### Schema changed unexpectedly

- Re-run `describe_*` via MCP
- Update the mapping and plan accordingly

### Permission denied

- Confirm token scope via MCP/tool error
- Use MCP token management tools if available
- Otherwise escalate/configure

### Build fails: devDependencies missing

See skill **app-dev-practices** for the fix (`npm install --include=dev`).

### App works incorrectly in local dev

Load skill **dev-debug-logs** and inspect the latest session under the selected app directory's `logs/dev-<timestamp>/`:

- `browser-logs.jsonl` for browser console errors, uncaught errors, and unhandled rejections
- `access-logs.jsonl` for proxied `/api` request/response records and proxy errors
- `frontend-dev-server-logs.jsonl` for frontend dev server output, including Vite startup errors and proxy/dev-server messages
- `backend-logs.jsonl` for backend stdout and stderr

## Final Gate (Before Saying "Done")

You can only claim completion if:

- ✅ MCP discovery shows the expected structure exists
- ✅ MCP read/write operations succeed (for dev tasks)
- ✅ You produced a clean handoff package for runtime (IDs + schema mapping)
- ✅ No SDK was used during development work
- ✅ **Secrets registered** (if backend uses `process.env`): Every `process.env.KEY` in `backend/` code has a matching `fusebase secret create --secret "KEY:description"` call. No `backend/.env` file, no `dotenv` dependency.
- ✅ **Lint passes**: Before you say "Done", you **must** run `npm run lint` (from project root or from the app directory you changed). Fix any reported errors; address warnings where practical. If you leave any errors or important warnings unfixed, list them explicitly for the user. (Deploy runs lint before build—code that fails lint will fail `fusebase deploy`.)
- ✅ **Typecheck** (`npm run typecheck` or deploy build); **no** `any` / `as Record<…>` on SDK responses — [Type safety invariant](#type-safety-invariant-non-negotiable). **Claude Code**: `.claude/settings.json` hooks run lint+typecheck.
- ✅ **Permissions were published, not just code**: If the app uses Dashboard SDK or Gate SDK at runtime, verify that `app update` was run with the necessary flags before considering publish complete.
- ✅ **Gate apps require `--sync-gate-permissions`**: If runtime code uses `@fusebase/fusebase-gate-sdk`, run `fusebase app update <appId> --sync-gate-permissions` before calling the app published.
- ✅ **`Permissions: none` is a blocker for runtime-integrated apps**: If CLI output shows `Permissions: none`, do not present the app as fully published unless it intentionally requires no runtime permissions.
- ✅ **Gate analysis sanity check**: Run `fusebase analyze gate --operations --json --feature <featureId>` and verify `usedOps` is non-empty for Gate-integrated runtime code. Empty `usedOps` with active Gate SDK usage is a release blocker.
- ✅ **Gate SDK typing**: Factories return full `*Api` classes with direct method calls — no `Pick<AccessApi, …>`, minimal interfaces, or method destructuring in production (see **fusebase-gate** skill).

## One-line Reminder

**LLM builds and manipulates the backend via MCP (which must be verified first), discovers SDK methods via MCP, and inserts SDK code into apps. Apps execute SDK at runtime. No cross-over. No MCP workaround scripts. No workarounds.**
