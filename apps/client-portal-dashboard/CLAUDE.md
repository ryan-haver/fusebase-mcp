# Always-on rules (read before @AGENTS.md)

**Default storage choice:** For new app-owned structured data, use **FuseBase PostgreSQL Database** by default. Use **FuseBase Project Dashboards** only when the user explicitly asks for dashboards or when the app is integrating with an existing dashboard surface.

**Do not present a default storage fork:** For a normal new app-owned data model, do not ask the user to choose between PostgreSQL and a new dashboard/database. PostgreSQL is the default. Mention dashboards only when the task is explicitly about dashboards or about extending an already existing dashboard surface.

**Type safety:** No `any` / `as Record<string, unknown>` / `as any` on SDK JSON; use `@fusebase/*` types, `sdk_describe`, narrowing — @AGENTS.md **Type safety invariant**.

**Dashboard SDK data (runtime code):** Before writing or reviewing code that calls dashboard data SDK methods (`getDashboardViewData`, `batchPutDashboardData`, and similar), you **must** (1) read `.claude/skills/fusebase-dashboards/references/data-patterns.md` for the actual response/request shapes, and (2) use `sdk_describe` on that method (e.g. `schemaMode: "output"`) before writing parsing logic. **Do not** guess shapes (for example assuming `response.data.rows` when the API returns a flat `data` array plus `meta`).

**Dashboard data SDK request args:** Methods such as `getDashboardViewData` and `batchPutDashboardData` take **route parameters under `path`**, e.g. `{ path: { dashboardId, viewId }, ... }` (plus `body` / query per `sdk_describe`). **Do not** pass `{ dashboardId, viewId }` at the top level — that matches MCP `tool_call` **args**, not the TypeScript SDK. Apply the **same** SDK shape in **SPA and app `backend/`** code.

**Custom skill-doc additions (required format):** When adding project-specific notes to managed skill markdown files (`.claude/skills/**/SKILL.md` and `.claude/skills/**/references/*.md`), write them only inside custom blocks:
`<!-- CUSTOM:SKILL:BEGIN --> ... <!-- CUSTOM:SKILL:END -->`.
You can have multiple blocks and place them anywhere in the file. Do not add custom content outside these blocks.

**FuseBase PostgreSQL Database schema discipline:** For any isolated SQL schema change, enforce this order with no exceptions: update/create migration files in `postgres/migrations/` -> compute checksum from file bytes -> run status -> then apply. Inline SQL in MCP is allowed only for one-off smoke/dev tests and must be marked temporary. Do not finish schema tasks without new/updated migration files + manifest.

@AGENTS.md (section **Dashboard data SDK: path parameters (SPA and backend)**).
