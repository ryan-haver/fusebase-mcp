/**
 * Live database & relational end-to-end suite.
 *
 * Runs against live FuseBase (requires valid credentials and FUSEBASE_WORKSPACE_ID as an explicit
 * sandbox opt-in, since it creates and deletes org-level databases). Checks:
 *  1. Tool registration: exactly 175 tools with FUSEBASE_TOOLS=all, including the 51 database,
 *     relational and isolated-store tools listed below.
 *  2. Discovery: list_all_databases, resolve_database_alias for a set of system aliases,
 *     get_database_entity_templates, and get_database_entity for an alias that resolved (skipped
 *     if none resolved).
 *  3. Lifecycle of a fresh database: create_database, get_database_detail, get_dashboard_detail,
 *     update_database (title read back).
 *  4. Seven column types (string, number, label, multi-select label, checkbox, date, multiline)
 *     and that the schema lists them all by name.
 *  5. Schema mutations: rename, width, reorder, add+delete a temp column, verified by re-reading
 *     the schema.
 *  6. Rows: add_database_row, batch_put_database_data (3 rows), get_database_rows (resolveNames),
 *     get_database_data.
 *  7. update_database_cell by column name and by key (persisted value read back),
 *     reorder_database_rows.
 *  8. Views: create_view, set_view_representation (kanban), set_view_grouping, move_kanban_card,
 *     duplicate_view, update_view, delete_view.
 *  9. Relations: second database, add_relation_column, add_lookup_column, list_database_relations,
 *     link_database_rows, get_relation_rows, unlink_database_rows, delete_relation.
 * 10. export_csv (content contains seeded data), import_csv, duplicate_database + detail of clone.
 * 11. create_dashboard_table inside the test database.
 * 12. list_isolated_stores (skipped only when Gate isolated stores are not provisioned for the org).
 * Every write is proven by a separate fresh read (verifyWrite) of the exact values written.
 * Every database created is deleted in a finally block; cleanup failures are reported with ⚠️.
 */

import {
  assert,
  assertArray,
  assertBoolean,
  assertEqual,
  assertIncludes,
  assertObject,
  assertString,
  callTool,
  connectMcp,
  knownGap,
  requireSandboxWorkspace,
  runSuite,
  skip,
  ToolError,
  duringCleanup,
  verifyWrite,
  readViewRepresentations,
} from "./lib/live-harness.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

/** Gate isolated stores not provisioned / not enabled for this org. */
const ISOLATED_STORES_UNAVAILABLE =
  /requires Gate MCP bridge|Fusebase API error: (402|403|404) [^\n]*\/isolated-stores/;

const EXPECTED_TOOL_COUNT = 175;

const DATABASE_TOOLS = [
  // Core DB tools
  "list_databases",
  "get_database_data",
  "get_database_schema",
  "get_database_rows",
  "create_database",
  "add_database_row",
  "delete_database_row",
  "update_database_cell",
  "add_database_column",
  "delete_database_column",
  "update_database",
  "delete_database",
  // Extended DB tools
  "list_all_databases",
  "get_database_detail",
  "get_dashboard_detail",
  "create_dashboard_table",
  "delete_dashboard",
  "create_view",
  "duplicate_view",
  "update_view",
  "delete_view",
  "set_view_representation",
  "set_view_grouping",
  "rename_database_column",
  "set_column_width",
  "reorder_database_columns",
  "add_relation_column",
  "add_lookup_column",
  "delete_relation",
  "list_database_relations",
  "duplicate_database",
  "export_csv",
  "import_csv",
  "batch_put_database_data",
  "reorder_database_rows",
  "resolve_database_alias",
  "get_relation_rows",
  "link_database_rows",
  "unlink_database_rows",
  "get_database_entity",
  "get_database_entity_templates",
  "move_kanban_card",
  // PostgreSQL Gate Isolated Store tools
  "list_isolated_stores",
  "create_isolated_store",
  "query_isolated_sql",
  "execute_isolated_sql",
  "select_isolated_sql_rows",
  "insert_isolated_sql_row",
  "batch_insert_isolated_sql_rows",
  "list_isolated_sql_tables",
  "apply_isolated_sql_migrations",
];

function phase(title: string): void {
  console.log(`\n── ${title} ──`);
}

function columnKeyOf(res: any, what: string): string {
  const key = res?.columnKey || res?.column?.key;
  assertString(key, `${what} column key`);
  return key;
}

// ─── Read-back helpers (used by verifyWrite checks) ─────────────────

interface SchemaColumn {
  key: string;
  name: string;
  type: string;
  editType: string;
  readonly: boolean;
  metadata?: Record<string, unknown>;
  labels?: Array<{ nanoid: string; name: string }>;
}

/** The dashboard-service wraps most payloads as { success, data }. */
function payload(res: any): any {
  return res?.data ?? res;
}

async function readSchema(client: Client, dashboardId: string, viewId: string): Promise<SchemaColumn[]> {
  const schema = await callTool(client, "get_database_schema", { dashboardId, viewId });
  assertArray(schema, `get_database_schema(${viewId})`);
  return schema;
}

function columnByKey(schema: SchemaColumn[], key: string, what: string): SchemaColumn {
  const col = schema.find((c) => c.key === key);
  assertObject(col, `${what}: column ${key} in schema (keys: ${schema.map((c) => c.key).join(", ")})`);
  return col;
}

async function readRows(client: Client, dashboardId: string, viewId: string): Promise<any[]> {
  const res = await callTool(client, "get_database_rows", { dashboardId, viewId, limit: 50, resolveNames: true });
  assertArray(res?.rows, `get_database_rows(${viewId}).rows`);
  return res.rows;
}

async function readViews(client: Client, dashboardId: string): Promise<any[]> {
  const views = payload(await callTool(client, "get_dashboard_detail", { dashboardId }))?.views;
  assertArray(views, `get_dashboard_detail(${dashboardId}).views`);
  return views;
}

function viewById(views: any[], viewId: string): any {
  return views.find((v) => (v?.global_id ?? v?.id) === viewId);
}

/** True when some (key, value) pair anywhere inside `node` satisfies `pred`. */
function hasDeep(node: unknown, pred: (key: string, value: unknown) => boolean): boolean {
  if (Array.isArray(node)) return node.some((n) => hasDeep(n, pred));
  if (node === null || typeof node !== "object") return false;
  return Object.entries(node).some(([k, v]) => pred(k, v) || hasDeep(v, pred));
}

/** Row links ({ source_index, target_index }) anywhere in a get_relation_rows payload. */
function relationLinks(res: unknown): Array<{ source: string; target: string }> {
  const links: Array<{ source: string; target: string }> = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node === null || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    if ("source_index" in obj && "target_index" in obj) links.push({ source: String(obj.source_index), target: String(obj.target_index) });
    Object.values(obj).forEach(walk);
  };
  walk(res);
  return links;
}

/** Label cells hold label nanoids; map them back to option names (a name the API kept as-is stays). */
function labelNames(col: SchemaColumn, value: unknown): string[] {
  const items = value === null || value === undefined ? [] : Array.isArray(value) ? value : [value];
  return items.map((v) => {
    const s = String(v);
    return col.labels?.find((l) => l.nanoid === s)?.name ?? s;
  });
}

function isSameDate(actual: unknown, expected: string): boolean {
  if (typeof actual === "string" && actual.startsWith(expected)) return true;
  const ms = typeof actual === "number" ? (actual < 1e11 ? actual * 1000 : actual) : typeof actual === "string" ? Date.parse(actual) : NaN;
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === expected;
}

function isSameNumber(actual: unknown, expected: number): boolean {
  if (typeof actual === "number") return actual === expected;
  return typeof actual === "string" && actual.trim() !== "" && Number(actual) === expected;
}

/**
 * Assert a row read back from get_database_rows holds exactly the values written, given as
 * { columnKey: value }. Label values are compared by option name, dates by calendar day.
 */
function assertRowValues(row: any, expected: Record<string, unknown>, schema: SchemaColumn[], what: string): void {
  assertObject(row, what);
  for (const [key, want] of Object.entries(expected)) {
    const col = columnByKey(schema, key, what);
    const got = row.cells?.[key];
    const field = `${what} '${col.name}'`;
    if (col.type === "label") {
      const wantNames = (Array.isArray(want) ? want : [want]).map(String).sort();
      assertEqual(JSON.stringify(labelNames(col, got).sort()), JSON.stringify(wantNames), `${field} (label names; raw ${JSON.stringify(got)})`);
    } else if (col.type === "date") {
      assert(isSameDate(got, String(want)), `${field}: expected date ${String(want)}, got ${JSON.stringify(got)}`);
    } else if (col.type === "number") {
      assert(isSameNumber(got, Number(want)), `${field}: expected number ${String(want)}, got ${JSON.stringify(got)}`);
    } else {
      assertEqual(got, want, field);
    }
  }
}

/** Run a read that must fail because the thing it reads was deleted. */
async function expectNotFound(read: () => Promise<unknown>, what: string): Promise<void> {
  try {
    await read();
  } catch (err) {
    if (err instanceof ToolError && /\b404\b|not.?found|does not exist/i.test(err.detail)) {
      assert(true, `${what} is gone`);
      return;
    }
    throw err;
  }
  assert(false, `${what} should be gone, but it can still be read`);
}

async function main() {
  // Explicit sandbox opt-in: this suite creates and deletes databases in the org.
  const workspaceId = requireSandboxWorkspace();
  console.log(`Sandbox workspace: ${workspaceId}`);

  const client = await connectMcp("fusebase-database-tester", { tier: "all" });
  const databasesToCleanup: string[] = [];
  let pendingRelation: { dashboardId: string; relationId: string } | undefined;
  let pendingView: { dashboardId: string; viewId: string } | undefined;

  try {
    // ─── 1. Tool registration ───────────────────────────────────────
    phase("1. Tool registration");
    const toolsRes = await client.listTools();
    assertEqual(toolsRes.tools.length, EXPECTED_TOOL_COUNT, "registered tool count");
    const registered = new Set(toolsRes.tools.map((t) => t.name));
    for (const toolName of DATABASE_TOOLS) {
      assert(registered.has(toolName), `Required database tool '${toolName}' must be registered`);
    }
    console.log(`✅ ${DATABASE_TOOLS.length} database/relational/isolated-store tools registered`);

    // ─── 2. Discovery & alias resolution ────────────────────────────
    phase("2. Discovery & alias resolution");
    const allDbsRes = await callTool(client, "list_all_databases");
    assertEqual(allDbsRes?.success, true, "list_all_databases.success");
    assertArray(allDbsRes?.data, "list_all_databases.data");
    console.log(`Found ${allDbsRes.data.length} existing databases`);

    const aliasesToTest = ["companies_db", "deals_db", "deals_pipeline", "deals_table", "meetings", "clients", "spaces"];
    const resolvedAliases: string[] = [];
    for (const alias of aliasesToTest) {
      const resolved = await callTool(client, "resolve_database_alias", { alias });
      assertObject(resolved, `resolve_database_alias(${alias})`);
      assertBoolean(resolved.found, `resolve_database_alias(${alias}).found`);
      if (resolved.found) {
        assertString(resolved.databaseId || resolved.dashboardId, `resolve_database_alias(${alias}) id`);
        resolvedAliases.push(alias);
      }
      console.log(`Alias '${alias}' -> found: ${resolved.found}`);
    }

    const templatesRes = await callTool(client, "get_database_entity_templates");
    assertArray(templatesRes?.data, "get_database_entity_templates.data");
    console.log(`✅ ${templatesRes.data.length} entity templates`);

    if (resolvedAliases.length > 0) {
      const entity = resolvedAliases[0];
      const entityData = await callTool(client, "get_database_entity", { entity, limit: 5 });
      assertObject(entityData, `get_database_entity(${entity})`);
      assertArray(entityData.data, `get_database_entity(${entity}).data`);
      console.log(`✅ get_database_entity('${entity}') returned ${entityData.data.length} rows`);
    } else {
      skip("get_database_entity", `none of the system aliases (${aliasesToTest.join(", ")}) resolved in this org`);
    }

    // ─── 3. Database lifecycle ──────────────────────────────────────
    phase("3. Database lifecycle");
    const testTimestamp = Date.now();
    const primaryDbTitle = `QA Full Validation DB ${testTimestamp}`;
    const primaryDbDescription = "Dedicated full-spectrum database functionality test instance";
    const createDbRes = await callTool(client, "create_database", {
      title: primaryDbTitle,
      description: primaryDbDescription,
    });
    assertString(createDbRes?.databaseId, "create_database.databaseId");
    const primaryDbId: string = createDbRes.databaseId;
    databasesToCleanup.push(primaryDbId);
    assertString(createDbRes?.dashboardId, "create_database.dashboardId");
    assertString(createDbRes?.viewId, "create_database.viewId");
    const primaryDashId: string = createDbRes.dashboardId;
    const primaryViewId: string = createDbRes.viewId;
    console.log(`Created database ${primaryDbId}`);

    await verifyWrite("create_database", `database ${primaryDbId} stored with its title, description, table and view`, async () => {
      const dbDetail = await callTool(client, "get_database_detail", { databaseId: primaryDbId });
      assertObject(dbDetail, "get_database_detail");
      const db = payload(dbDetail);
      assertEqual(db?.global_id, primaryDbId, "get_database_detail.data.global_id");
      assertEqual(db?.title, primaryDbTitle, "created database title");
      assertEqual(db?.metadata?.description, primaryDbDescription, "created database metadata.description");
      assertArray(db?.dashboards, "get_database_detail.data.dashboards", 1);
      const dash = db.dashboards.find((d: any) => d?.global_id === primaryDashId);
      assertObject(dash, `dashboard ${primaryDashId} in get_database_detail`);

      const dashDetail = await callTool(client, "get_dashboard_detail", { dashboardId: primaryDashId });
      assertObject(dashDetail, "get_dashboard_detail");
      assertEqual(payload(dashDetail)?.database_id, primaryDbId, "get_dashboard_detail.data.database_id");
      assertObject(viewById(payload(dashDetail)?.views ?? [], primaryViewId), `view ${primaryViewId} in get_dashboard_detail.views`);
    });

    const updatedTitle = `${primaryDbTitle} [Verified]`;
    const updatedDescription = "Updated description for verification";
    const updateDbRes = await callTool(client, "update_database", {
      databaseId: primaryDbId,
      title: updatedTitle,
      description: updatedDescription,
    });
    assertObject(updateDbRes, "update_database");
    await verifyWrite("update_database", `database ${primaryDbId} title and description updated`, async () => {
      const detailAfterUpdate = await callTool(client, "get_database_detail", { databaseId: primaryDbId });
      const titleAfterUpdate = detailAfterUpdate?.data?.title ?? detailAfterUpdate?.title;
      assertEqual(titleAfterUpdate, updatedTitle, "database title after update_database");
      assertEqual(payload(detailAfterUpdate)?.metadata?.description, updatedDescription, "database metadata.description after update_database");
    });
    console.log("✅ Database detail, dashboard detail and update verified");

    // ─── 4. Column types ────────────────────────────────────────────
    phase("4. Column types");
    const addColumn = async (name: string, columnType: string, extra: Record<string, unknown> = {}) =>
      columnKeyOf(
        await callTool(client, "add_database_column", { dashboardId: primaryDashId, viewId: primaryViewId, name, columnType, ...extra }),
        name,
      );

    const colTextKey = await addColumn("Account Name", "string");
    const colNumKey = await addColumn("Annual Revenue", "number");
    const colStatusKey = await addColumn("Lifecycle Stage", "label", {
      labels: [
        { name: "Prospect", color: "blue" },
        { name: "Evaluation", color: "yellow" },
        { name: "Contract", color: "purple" },
        { name: "Closed Won", color: "green" },
      ],
    });
    const colTagsKey = await addColumn("Tech Capabilities", "label", {
      multiSelect: true,
      labels: [
        { name: "AI Native", color: "purple" },
        { name: "Cloud Native", color: "blue" },
        { name: "Enterprise Ready", color: "green" },
      ],
    });
    const colCheckKey = await addColumn("Audit Verified", "checkbox");
    const colDateKey = await addColumn("Renewal Date", "date");
    const colNotesKey = await addColumn("Executive Notes", "multiline");

    // Each added column, as it should read back: key, name, schema type, edit type and label options.
    const expectedColumns: Array<{ key: string; name: string; type: string; editType?: string; labels?: string[] }> = [
      { key: colTextKey, name: "Account Name", type: "string", editType: "string-single-line" },
      { key: colNumKey, name: "Annual Revenue", type: "number" },
      { key: colStatusKey, name: "Lifecycle Stage", type: "label", labels: ["Prospect", "Evaluation", "Contract", "Closed Won"] },
      { key: colTagsKey, name: "Tech Capabilities", type: "label", labels: ["AI Native", "Cloud Native", "Enterprise Ready"] },
      { key: colCheckKey, name: "Audit Verified", type: "boolean" },
      { key: colDateKey, name: "Renewal Date", type: "date" },
      { key: colNotesKey, name: "Executive Notes", type: "string", editType: "string-multi-line" },
    ];
    await verifyWrite("add_database_column", "7 typed columns present in the schema with their names, types and label options", async () => {
      const schemaAfterAdd = await readSchema(client, primaryDashId, primaryViewId);
      assertArray(schemaAfterAdd, "get_database_schema", 7);
      const namesAfterAdd = schemaAfterAdd.map((c: any) => c.name);
      for (const name of ["Account Name", "Annual Revenue", "Lifecycle Stage", "Tech Capabilities", "Audit Verified", "Renewal Date", "Executive Notes"]) {
        assert(namesAfterAdd.includes(name), `Schema should contain column '${name}', got: ${namesAfterAdd.join(", ")}`);
      }
      for (const exp of expectedColumns) {
        const col = columnByKey(schemaAfterAdd, exp.key, "get_database_schema after add");
        assertEqual(col.name, exp.name, `column ${exp.key} name`);
        assertEqual(col.type, exp.type, `column '${exp.name}' type`);
        if (exp.editType) assertEqual(col.editType, exp.editType, `column '${exp.name}' editType`);
        if (exp.labels) assertEqual(JSON.stringify((col.labels ?? []).map((l) => l.name)), JSON.stringify(exp.labels), `column '${exp.name}' label options`);
      }
    }, { count: 7 });
    console.log("✅ 7 typed columns added and present in schema");

    // ─── 5. Schema mutations ────────────────────────────────────────
    phase("5. Schema mutations");
    await callTool(client, "rename_database_column", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      columnKey: colNotesKey,
      newName: "Strategic Notes",
    });
    await verifyWrite("rename_database_column", `column ${colNotesKey} renamed to 'Strategic Notes'`, async () => {
      const schema = await readSchema(client, primaryDashId, primaryViewId);
      const notesCol = columnByKey(schema, colNotesKey, "get_database_schema after rename");
      assertEqual(notesCol?.name, "Strategic Notes", "renamed column name");
      assertEqual(notesCol.editType, "string-multi-line", "renamed column keeps its multi-line type");
      assert(!schema.some((c) => c.name === "Executive Notes"), "old column name 'Executive Notes' should be gone from the schema");
    });

    await callTool(client, "set_column_width", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      columnKey: colTextKey,
      width: 260,
    });
    await verifyWrite("set_column_width", `column ${colTextKey} width is 260`, async () => {
      const schema = await readSchema(client, primaryDashId, primaryViewId);
      assertEqual(columnByKey(schema, colTextKey, "get_database_schema after width").metadata?.width, 260, "'Account Name' metadata.width");
    });

    const newColumnOrder = [colTextKey, colStatusKey, colNumKey, colTagsKey, colDateKey, colCheckKey, colNotesKey];
    await callTool(client, "reorder_database_columns", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      orderedKeys: newColumnOrder,
    });
    await verifyWrite("reorder_database_columns", "the 7 columns read back in the new order", async () => {
      const schema = await readSchema(client, primaryDashId, primaryViewId);
      const order = schema.map((c) => c.key).filter((k) => newColumnOrder.includes(k));
      assertEqual(JSON.stringify(order), JSON.stringify(newColumnOrder), "column order after reorder_database_columns");
    });

    const tempColKey = await addColumn("Temporary Scratch Column", "string");
    await verifyWrite("add_database_column", `temporary column ${tempColKey} present in the schema`, async () => {
      const schema = await readSchema(client, primaryDashId, primaryViewId);
      const tempCol = columnByKey(schema, tempColKey, "get_database_schema after temp add");
      assertEqual(tempCol.name, "Temporary Scratch Column", "temporary column name");
      assertEqual(tempCol.type, "string", "temporary column type");
    });
    await callTool(client, "delete_database_column", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      columnKey: tempColKey,
    });
    await verifyWrite("delete_database_column", `column ${tempColKey} gone from the schema, the other 7 kept`, async () => {
      const schemaAfterMutations = await readSchema(client, primaryDashId, primaryViewId);
      assertArray(schemaAfterMutations, "get_database_schema after mutations", 7);
      assert(!schemaAfterMutations.some((c: any) => c.key === tempColKey), `Deleted column ${tempColKey} should not be in schema`);
      assert(!schemaAfterMutations.some((c) => c.name === "Temporary Scratch Column"), "no column named 'Temporary Scratch Column' should remain");
      for (const key of newColumnOrder) columnByKey(schemaAfterMutations, key, "get_database_schema after delete");
    });
    console.log("✅ Rename, width, reorder and delete verified against schema");

    // ─── 6. Row ingestion ───────────────────────────────────────────
    phase("6. Row ingestion");
    // Column name -> key, to compare written values against the raw cells read back.
    const keyByColumnName: Record<string, string> = {
      "Account Name": colTextKey,
      "Annual Revenue": colNumKey,
      "Lifecycle Stage": colStatusKey,
      "Tech Capabilities": colTagsKey,
      "Audit Verified": colCheckKey,
      "Renewal Date": colDateKey,
      "Strategic Notes": colNotesKey,
    };
    const byKey = (values: Record<string, unknown>): Record<string, unknown> =>
      Object.fromEntries(Object.entries(values).map(([name, v]) => [keyByColumnName[name], v]));

    const row1Values = {
      "Account Name": "CyberVanguard Inc.",
      "Annual Revenue": 1250000,
      "Lifecycle Stage": "Prospect",
      "Tech Capabilities": ["AI Native", "Cloud Native"],
      "Audit Verified": true,
      "Renewal Date": "2027-01-15",
      "Strategic Notes": "Initial executive briefing scheduled.",
    };
    const addRowRes = await callTool(client, "add_database_row", {
      entity: "custom",
      dashboardId: primaryDashId,
      values: row1Values,
    });
    assertEqual(addRowRes?.success, true, "add_database_row.success");
    assertString(addRowRes?.rowUuid, "add_database_row.rowUuid");
    const row1Uuid: string = addRowRes.rowUuid;
    await verifyWrite("add_database_row", `row ${row1Uuid} stored with all 7 values`, async () => {
      const schema = await readSchema(client, primaryDashId, primaryViewId);
      const rows = await readRows(client, primaryDashId, primaryViewId);
      const foundRow1 = rows.find((r: any) => r.rowUuid === row1Uuid);
      assertObject(foundRow1, `row ${row1Uuid} in get_database_rows`);
      assertEqual(foundRow1.namedCells?.["Account Name"], "CyberVanguard Inc.", "namedCells['Account Name']");
      assertRowValues(foundRow1, byKey(row1Values), schema, `row ${row1Uuid}`);
    });

    const batchRowValues = [
      {
        "Account Name": "ShieldAI Dynamics",
        "Annual Revenue": 4800000,
        "Lifecycle Stage": "Evaluation",
        "Tech Capabilities": ["Enterprise Ready", "AI Native"],
        "Audit Verified": true,
        "Renewal Date": "2027-06-30",
        "Strategic Notes": "POC underway with enterprise security team.",
      },
      {
        "Account Name": "Aegis Cloud Security",
        "Annual Revenue": 9200000,
        "Lifecycle Stage": "Contract",
        "Tech Capabilities": ["Enterprise Ready", "Cloud Native"],
        "Audit Verified": true,
        "Renewal Date": "2027-11-01",
        "Strategic Notes": "Procurement legal review in final stage.",
      },
      {
        "Account Name": "Sentinel Zero Trust",
        "Annual Revenue": 2100000,
        "Lifecycle Stage": "Closed Won",
        "Tech Capabilities": ["AI Native"],
        "Audit Verified": false,
        "Renewal Date": "2026-12-31",
        "Strategic Notes": "Closed deal, onboarding completed.",
      },
    ];
    const batchRes = await callTool(client, "batch_put_database_data", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      rows: batchRowValues.map((values) => ({ create_new_row: true, values })),
    });
    assertEqual(batchRes?.success, true, "batch_put_database_data.success");

    await verifyWrite("batch_put_database_data", "3 batch-created rows stored once each with all 7 values", async () => {
      const schema = await readSchema(client, primaryDashId, primaryViewId);
      const readRowsRes = await callTool(client, "get_database_rows", {
        dashboardId: primaryDashId,
        viewId: primaryViewId,
        limit: 20,
        resolveNames: true,
      });
      assertArray(readRowsRes?.rows, "get_database_rows.rows", 4);
      for (const values of batchRowValues) {
        const name = values["Account Name"];
        assert(
          readRowsRes.rows.some((r: any) => r.namedCells?.["Account Name"] === name),
          `Batch-inserted row '${name}' should be readable`,
        );
        const matches = readRowsRes.rows.filter((r: any) => r.cells?.[colTextKey] === name);
        assertEqual(matches.length, 1, `rows named '${name}'`);
        assertRowValues(matches[0], byKey(values), schema, `batch row '${name}'`);
      }

      const gridData = await callTool(client, "get_database_data", { dashboardId: primaryDashId, viewId: primaryViewId });
      assertArray(gridData?.data, "get_database_data.data", 4);
      console.log(`✅ 4 rows ingested and read back (${gridData.data.length} grid rows)`);
    });

    // ─── 7. Cell mutations & row reordering ─────────────────────────
    phase("7. Cell mutations & row reordering");
    const updateByNameVal = "CyberVanguard Technologies Global";
    const updateByNameRes = await callTool(client, "update_database_cell", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      rowUuid: row1Uuid,
      columnKey: "Account Name",
      value: updateByNameVal,
    });
    assertEqual(updateByNameRes?.success, true, "update_database_cell (by name).success");
    await verifyWrite("update_database_cell", `row ${row1Uuid} 'Account Name' reads back as '${updateByNameVal}'`, async () => {
      const verifyMutationsRes = await callTool(client, "get_database_rows", {
        dashboardId: primaryDashId,
        viewId: primaryViewId,
        limit: 20,
        resolveNames: true,
      });
      assertArray(verifyMutationsRes?.rows, "get_database_rows.rows after update", 1);
      const recheckedRow = verifyMutationsRes.rows.find((r: any) => r.rowUuid === row1Uuid);
      assert(
        recheckedRow?.namedCells?.["Account Name"] === updateByNameVal || recheckedRow?.cells?.[colTextKey] === updateByNameVal,
        `Updated 'Account Name' should read back as '${updateByNameVal}', got ${JSON.stringify(recheckedRow?.namedCells?.["Account Name"])}`,
      );
      assertEqual(recheckedRow?.cells?.[colTextKey], updateByNameVal, `row ${row1Uuid} cells[${colTextKey}] after update by name`);
    });

    const updateByKeyRes = await callTool(client, "update_database_cell", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      rowUuid: row1Uuid,
      columnKey: colNumKey,
      value: "1450000",
    });
    assertEqual(updateByKeyRes?.success, true, "update_database_cell (by key).success");
    await verifyWrite("update_database_cell", `row ${row1Uuid} 'Annual Revenue' reads back as the number 1450000`, async () => {
      const rows = await readRows(client, primaryDashId, primaryViewId);
      const row = rows.find((r: any) => r.rowUuid === row1Uuid);
      assertObject(row, `row ${row1Uuid} in get_database_rows`);
      // The tool converts "1450000" to a number for a number column: it must be stored as one.
      assertEqual(row.cells?.[colNumKey], 1450000, `row ${row1Uuid} 'Annual Revenue' after update by key`);
      assertEqual(row.cells?.[colTextKey], updateByNameVal, `row ${row1Uuid} 'Account Name' kept after the second update`);
    });

    // Move the row that is currently last to the top, so the read-back proves the order changed.
    const rowsBeforeReorder = await readRows(client, primaryDashId, primaryViewId);
    assertArray(rowsBeforeReorder, "get_database_rows.rows before reorder", 2);
    const previousFirstUuid: string = rowsBeforeReorder[0].rowUuid;
    const movedRowUuid: string = rowsBeforeReorder[rowsBeforeReorder.length - 1].rowUuid;
    assertString(movedRowUuid, "row to move to the top");
    assert(movedRowUuid !== previousFirstUuid, "the row moved to the top must not already be first");
    const reorderRowsRes = await callTool(client, "reorder_database_rows", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      rowOrders: [{ rowUuid: movedRowUuid, order: 1 }],
    });
    assertEqual(reorderRowsRes?.success, true, "reorder_database_rows.success");
    await verifyWrite("reorder_database_rows", `previously last row ${movedRowUuid} is now first, ahead of ${previousFirstUuid}`, async () => {
      const rows = await readRows(client, primaryDashId, primaryViewId);
      assertEqual(rows[0]?.rowUuid, movedRowUuid, "first row in the view after reorder_database_rows (order 1)");
      assert(rows[0]?.rowUuid !== previousFirstUuid, `previous first row ${previousFirstUuid} should no longer be first`);
      assertEqual(rows.length, rowsBeforeReorder.length, "row count unchanged by reorder_database_rows");
    });
    console.log("✅ Cell updates persisted; row reorder verified");

    // ─── 8. Views & kanban ──────────────────────────────────────────
    phase("8. Views & kanban");
    const kanbanViewRes = await callTool(client, "create_view", { dashboardId: primaryDashId, name: "Pipeline Kanban" });
    const kanbanViewId = kanbanViewRes?.viewId || kanbanViewRes?.id;
    assertString(kanbanViewId, "create_view.viewId");
    await verifyWrite("create_view", `view ${kanbanViewId} 'Pipeline Kanban' listed on the dashboard with the table's columns`, async () => {
      const view = viewById(await readViews(client, primaryDashId), kanbanViewId);
      assertObject(view, `view ${kanbanViewId} in get_dashboard_detail.views`);
      assertEqual(view.name, "Pipeline Kanban", "created view name");
      const schema = await readSchema(client, primaryDashId, kanbanViewId);
      for (const key of newColumnOrder) columnByKey(schema, key, `schema of view ${kanbanViewId}`);
    });

    const setRepRes = await callTool(client, "set_view_representation", {
      dashboardId: primaryDashId,
      viewId: kanbanViewId,
      representationType: "kanban",
    });
    assertEqual(setRepRes?.success, true, "set_view_representation.success");
    await verifyWrite("set_view_representation", `view ${kanbanViewId} has a kanban representation`, async () => {
      const reps = await readViewRepresentations(client, primaryDashId, kanbanViewId);
      const kanban = reps.find((r) => r.global_id === "kanban");
      assert(kanban !== undefined, `view ${kanbanViewId} should have a kanban representation, got: ${JSON.stringify(reps).slice(0, 300)}`);
      assertEqual(kanban.is_default, true, `view ${kanbanViewId} kanban representation is the default`);
    });

    const setGroupRes = await callTool(client, "set_view_grouping", {
      dashboardId: primaryDashId,
      viewId: kanbanViewId,
      groupByColumnKey: colStatusKey,
    });
    assertEqual(setGroupRes?.success, true, "set_view_grouping.success");
    await verifyWrite("set_view_grouping", `view ${kanbanViewId} grouped by 'Lifecycle Stage' (${colStatusKey})`, async () => {
      const reps = await readViewRepresentations(client, primaryDashId, kanbanViewId);
      const kanban = reps.find((r) => r.global_id === "kanban");
      assert(kanban !== undefined, `view ${kanbanViewId} should have a kanban representation, got: ${JSON.stringify(reps).slice(0, 300)}`);
      assertEqual(kanban.settings?.groupByField, colStatusKey, `view ${kanbanViewId} kanban groupByField`);
    });

    const moveCardRes = await callTool(client, "move_kanban_card", {
      dashboardId: primaryDashId,
      viewId: kanbanViewId,
      rowId: row1Uuid,
      groupByColumnKey: colStatusKey,
      newValue: "Closed Won",
    });
    assertEqual(moveCardRes?.success, true, "move_kanban_card.success");
    await verifyWrite("move_kanban_card", `row ${row1Uuid} 'Lifecycle Stage' is 'Closed Won'`, async () => {
      const schema = await readSchema(client, primaryDashId, kanbanViewId);
      const row = (await readRows(client, primaryDashId, kanbanViewId)).find((r: any) => r.rowUuid === row1Uuid);
      assertRowValues(row, { [colStatusKey]: "Closed Won" }, schema, `card ${row1Uuid}`);
    });

    const dupViewRes = await callTool(client, "duplicate_view", { dashboardId: primaryDashId, viewId: kanbanViewId });
    const dupViewId = dupViewRes?.viewId || dupViewRes?.id;
    assertString(dupViewId, "duplicate_view.viewId");
    await verifyWrite("duplicate_view", `view copy ${dupViewId} ('Copy of View') listed with the source view's columns`, async () => {
      const views = await readViews(client, primaryDashId);
      const dup = viewById(views, dupViewId);
      assertObject(dup, `duplicated view ${dupViewId} in get_dashboard_detail.views`);
      assertEqual(dup.name, "Copy of View", "duplicated view name (tool default)");
      assertObject(viewById(views, kanbanViewId), `source view ${kanbanViewId} still listed`);
      const schema = await readSchema(client, primaryDashId, dupViewId);
      for (const key of newColumnOrder) columnByKey(schema, key, `schema of duplicated view ${dupViewId}`);
    });

    await callTool(client, "update_view", { dashboardId: primaryDashId, viewId: dupViewId, name: "Pipeline Kanban (Archived)" });
    await verifyWrite("update_view", `view ${dupViewId} renamed to 'Pipeline Kanban (Archived)'`, async () => {
      const dup = viewById(await readViews(client, primaryDashId), dupViewId);
      assertObject(dup, `view ${dupViewId} in get_dashboard_detail.views`);
      assertEqual(dup.name, "Pipeline Kanban (Archived)", "view name after update_view");
    });

    await callTool(client, "delete_view", { dashboardId: primaryDashId, viewId: dupViewId });
    await verifyWrite("delete_view", `view ${dupViewId} no longer listed; source view kept`, async () => {
      const views = await readViews(client, primaryDashId);
      assert(!viewById(views, dupViewId), `Deleted view ${dupViewId} should not be in get_dashboard_detail.views`);
      assertObject(viewById(views, kanbanViewId), `view ${kanbanViewId} still listed after deleting its copy`);
    });

    // A view created directly as a grouped kanban (create_view's representationType + groupByColumnKey).
    const directKanbanRes = await callTool(client, "create_view", {
      dashboardId: primaryDashId,
      name: "Direct Kanban",
      representationType: "kanban",
      groupByColumnKey: colStatusKey,
    });
    const directKanbanViewId = directKanbanRes?.viewId || directKanbanRes?.id;
    assertString(directKanbanViewId, "create_view (kanban).viewId");
    pendingView = { dashboardId: primaryDashId, viewId: directKanbanViewId };
    await verifyWrite("create_view", `view ${directKanbanViewId} 'Direct Kanban' created as a kanban grouped by ${colStatusKey}`, async () => {
      const view = viewById(await readViews(client, primaryDashId), directKanbanViewId);
      assertObject(view, `view ${directKanbanViewId} in get_dashboard_detail.views`);
      assertEqual(view.name, "Direct Kanban", "kanban view name");
      const reps = await readViewRepresentations(client, primaryDashId, directKanbanViewId);
      const kanban = reps.find((r) => r.global_id === "kanban");
      assert(kanban !== undefined, `view ${directKanbanViewId} should have a kanban representation, got: ${JSON.stringify(reps).slice(0, 300)}`);
      assertEqual(kanban.is_default, true, `view ${directKanbanViewId} kanban representation is the default`);
      assertEqual(kanban.settings?.groupByField, colStatusKey, `view ${directKanbanViewId} kanban groupByField`);
    });
    console.log("✅ View create/representation/grouping/card move/duplicate/update/delete verified");

    // ─── 9. Relations & lookups ─────────────────────────────────────
    phase("9. Relations & lookups");
    const targetRelDbTitle = `QA Target Products DB ${testTimestamp}`;
    const targetRelDbDescription = "Target database for relational link testing";
    const targetRelDbRes = await callTool(client, "create_database", {
      title: targetRelDbTitle,
      description: targetRelDbDescription,
    });
    assertString(targetRelDbRes?.databaseId, "target create_database.databaseId");
    databasesToCleanup.push(targetRelDbRes.databaseId);
    assertString(targetRelDbRes?.dashboardId, "target create_database.dashboardId");
    assertString(targetRelDbRes?.viewId, "target create_database.viewId");
    const targetRelDbId: string = targetRelDbRes.databaseId;
    const targetRelDashId: string = targetRelDbRes.dashboardId;
    const targetRelViewId: string = targetRelDbRes.viewId;
    await verifyWrite("create_database", `target database ${targetRelDbId} stored with its title, description, table and view`, async () => {
      const db = payload(await callTool(client, "get_database_detail", { databaseId: targetRelDbId }));
      assertEqual(db?.title, targetRelDbTitle, "target database title");
      assertEqual(db?.metadata?.description, targetRelDbDescription, "target database metadata.description");
      assertArray(db?.dashboards, "target get_database_detail.data.dashboards", 1);
      assertObject(db.dashboards.find((d: any) => d?.global_id === targetRelDashId), `dashboard ${targetRelDashId} in target database`);
      assertObject(viewById(await readViews(client, targetRelDashId), targetRelViewId), `view ${targetRelViewId} in target dashboard`);
    });

    const addProductRes = await callTool(client, "add_database_row", {
      entity: "custom",
      dashboardId: targetRelDashId,
      values: { Name: "Enterprise Falcon EDR" },
    });
    assertString(addProductRes?.rowUuid, "target add_database_row.rowUuid");
    const targetProductRowUuid: string = addProductRes.rowUuid;
    await verifyWrite("add_database_row", `product row ${targetProductRowUuid} stored with Name 'Enterprise Falcon EDR'`, async () => {
      const row = (await readRows(client, targetRelDashId, targetRelViewId)).find((r: any) => r.rowUuid === targetProductRowUuid);
      assertObject(row, `product row ${targetProductRowUuid} in get_database_rows`);
      assertEqual(row.namedCells?.Name, "Enterprise Falcon EDR", "product row namedCells.Name");
    });

    const addRelColRes = await callTool(client, "add_relation_column", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      name: "Associated Products",
      targetDashboardId: targetRelDashId,
      targetViewId: targetRelViewId,
      relationType: "many_to_many",
    });
    const createdRelationId = addRelColRes?.relationId || addRelColRes?.id;
    assertString(createdRelationId, "add_relation_column.relationId");
    pendingRelation = { dashboardId: primaryDashId, relationId: createdRelationId };
    const relColumnKey = columnKeyOf(addRelColRes, "Associated Products");
    await verifyWrite("add_relation_column", `relation ${createdRelationId} links the two tables; column 'Associated Products' (${relColumnKey}) in the schema`, async () => {
      const schema = await readSchema(client, primaryDashId, primaryViewId);
      const relCol = columnByKey(schema, relColumnKey, "get_database_schema after add_relation_column");
      assertEqual(relCol.name, "Associated Products", "relation column name");
      assertEqual(relCol.type, "lookup", "relation column type (source.type)");

      const listRelRes = await callTool(client, "list_database_relations", { dashboardId: primaryDashId, viewId: primaryViewId });
      assert(listRelRes !== null && typeof listRelRes === "object", "list_database_relations should return an object or array");
      assertIncludes(JSON.stringify(listRelRes), createdRelationId, "list_database_relations payload");

      const relation = JSON.stringify(await callTool(client, "get_relation_rows", { relationId: createdRelationId }));
      assertIncludes(relation, primaryDashId, "get_relation_rows: relation's table on the column side");
      assertIncludes(relation, targetRelDashId, "get_relation_rows: relation's linked table");
      assertIncludes(relation, "many_to_many", "get_relation_rows: relation type");
    });

    const lookupRes = await callTool(client, "add_lookup_column", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      name: "Product Detail",
      relationColumnKey: relColumnKey,
    });
    const lookupColumnKey = columnKeyOf(lookupRes, "Product Detail");
    await verifyWrite("add_lookup_column", `lookup column 'Product Detail' (${lookupColumnKey}) in the schema`, async () => {
      const schema = await readSchema(client, primaryDashId, primaryViewId);
      const lookupCol = columnByKey(schema, lookupColumnKey, "get_database_schema after add_lookup_column");
      assertEqual(lookupCol.name, "Product Detail", "lookup column name");
      assertEqual(lookupCol.type, "lookup", "lookup column type (source.type)");
      assertEqual(lookupCol.readonly, true, "lookup column readonly");
      columnByKey(schema, relColumnKey, "relation column kept after adding the lookup");
    });

    await callTool(client, "link_database_rows", {
      relationId: createdRelationId,
      sourceRowUuid: row1Uuid,
      targetRowUuid: targetProductRowUuid,
    });
    await verifyWrite("link_database_rows", `relation ${createdRelationId} maps row ${row1Uuid} -> ${targetProductRowUuid}`, async () => {
      const relationRowsRes = await callTool(client, "get_relation_rows", { relationId: createdRelationId });
      assert(relationRowsRes !== null && typeof relationRowsRes === "object", "get_relation_rows should return an object");
      const links = relationLinks(relationRowsRes);
      assert(
        links.some((l) => l.source === row1Uuid && l.target === targetProductRowUuid),
        `get_relation_rows should contain link ${row1Uuid} -> ${targetProductRowUuid}, got ${JSON.stringify(links)}`,
      );
    });

    await callTool(client, "unlink_database_rows", {
      relationId: createdRelationId,
      sourceRowUuid: row1Uuid,
      targetRowUuid: targetProductRowUuid,
    });
    await verifyWrite("unlink_database_rows", `link ${row1Uuid} -> ${targetProductRowUuid} gone from relation ${createdRelationId}`, async () => {
      const relationRowsRes = await callTool(client, "get_relation_rows", { relationId: createdRelationId });
      assertIncludes(JSON.stringify(relationRowsRes), createdRelationId, "get_relation_rows still returns the relation");
      const links = relationLinks(relationRowsRes);
      assert(
        !links.some((l) => l.source === row1Uuid || l.target === targetProductRowUuid),
        `get_relation_rows should no longer link ${row1Uuid} or ${targetProductRowUuid}, got ${JSON.stringify(links)}`,
      );
    });

    await callTool(client, "delete_relation", { dashboardId: primaryDashId, relationId: createdRelationId });
    pendingRelation = undefined;
    await verifyWrite("delete_relation", `relation ${createdRelationId} can no longer be read`, async () => {
      await expectNotFound(() => callTool(client, "get_relation_rows", { relationId: createdRelationId }), `relation ${createdRelationId}`);
    });
    console.log("✅ Relation column, lookup, list, link, get, unlink and delete verified");

    // ─── 10. CSV & duplication ──────────────────────────────────────
    phase("10. CSV export/import & duplication");
    const csvExportRes = await callTool(client, "export_csv", { dashboardId: primaryDashId, viewId: primaryViewId });
    assertString(csvExportRes, "export_csv content");
    assertIncludes(csvExportRes, "Account Name", "export_csv header");
    assertIncludes(csvExportRes, "ShieldAI Dynamics", "export_csv rows");

    const importRes = await callTool(client, "import_csv", {
      databaseId: primaryDbId,
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      csv: "Account Name,Annual Revenue\nOmega Defense Systems,3400000\n",
    });
    assert(importRes !== null && importRes !== undefined, "import_csv should return a payload");
    // Imports may run as a background job, so allow longer than the default for the row to appear.
    await verifyWrite("import_csv", "imported row 'Omega Defense Systems' / 3400000 present once in the table", async () => {
      const rows = await readRows(client, primaryDashId, primaryViewId);
      const imported = rows.filter((r: any) => Object.values(r.cells ?? {}).includes("Omega Defense Systems"));
      assertEqual(imported.length, 1, "rows holding the imported 'Omega Defense Systems'");
      assert(
        Object.values(imported[0].cells ?? {}).some((v) => isSameNumber(v, 3400000)),
        `imported row should hold Annual Revenue 3400000, got ${JSON.stringify(imported[0].cells)}`,
      );
    }, { timeoutMs: 60_000, intervalMs: 3000 });

    const cloneDbTitle = `QA Clone DB ${testTimestamp}`;
    const cloneDbRes = await callTool(client, "duplicate_database", { databaseId: primaryDbId, title: cloneDbTitle });
    const clonedDbId = cloneDbRes?.databaseId || cloneDbRes?.id;
    assertString(clonedDbId, "duplicate_database.databaseId");
    databasesToCleanup.push(clonedDbId);
    await verifyWrite("duplicate_database", `clone ${clonedDbId} titled '${cloneDbTitle}' with the source table's columns and rows`, async () => {
      const clonedDetail = await callTool(client, "get_database_detail", { databaseId: clonedDbId });
      assertObject(clonedDetail, "get_database_detail (clone)");
      const clone = payload(clonedDetail);
      assertEqual(clone?.global_id, clonedDbId, "clone global_id");
      assertEqual(clone?.title, cloneDbTitle, "clone title after duplicate_database with title");
      assert(clonedDbId !== primaryDbId, "clone must be a new database");
      assertArray(clone?.dashboards, "clone dashboards", 1);
      const cloneDashId: string = clone.dashboards[0].global_id;
      const cloneViewId: string | undefined = clone.dashboards[0].views?.[0]?.global_id
        ?? (await readViews(client, cloneDashId))[0]?.global_id;
      assertString(cloneViewId, "clone view id");
      const cloneSchema = await readSchema(client, cloneDashId, cloneViewId);
      const cloneNames = cloneSchema.map((c) => c.name);
      for (const name of Object.keys(keyByColumnName)) {
        assert(cloneNames.includes(name), `clone schema should contain column '${name}', got: ${cloneNames.join(", ")}`);
      }
      const cloneRows = await readRows(client, cloneDashId, cloneViewId);
      for (const name of [updateByNameVal, ...batchRowValues.map((v) => v["Account Name"])]) {
        assert(
          cloneRows.some((r: any) => r.namedCells?.["Account Name"] === name),
          `clone should hold the copied row '${name}'`,
        );
      }
    }, { timeoutMs: 60_000, intervalMs: 3000 });
    console.log(`✅ CSV export/import and duplicate_database (${clonedDbId}) verified`);

    // ─── 11. Multi-table dashboards ─────────────────────────────────
    phase("11. Multi-table dashboards");
    // COR-21: the tool posts a *view* to /dashboards/<databaseId>/views, which 404s; creating
    // a real table needs POST /dashboards (or createDashboardFromTemplate) with a schema.
    let tableCreated = false;
    try {
      const newTableRes = await callTool(client, "create_dashboard_table", {
        databaseId: primaryDbId,
        title: "Secondary Action Items Table",
      });
      tableCreated = newTableRes !== null && typeof newTableRes === "object";
    } catch (err) {
      if (!(err instanceof ToolError)) throw err;
    }
    // An error response records no write; only a claimed success needs proving.
    if (tableCreated) {
      await verifyWrite("create_dashboard_table", "table 'Secondary Action Items Table' listed in the database", async () => {
        const db = payload(await callTool(client, "get_database_detail", { databaseId: primaryDbId }));
        assertArray(db?.dashboards, "get_database_detail.data.dashboards", 1);
        assert(
          hasDeep(db.dashboards, (k, v) => (k === "name" || k === "title") && v === "Secondary Action Items Table"),
          `database ${primaryDbId} should list 'Secondary Action Items Table', got: ${JSON.stringify(db.dashboards).slice(0, 500)}`,
        );
      });
    }
    knownGap("COR-21", "create_dashboard_table creates a table in a database", tableCreated);

    // ─── 12. Gate isolated stores ───────────────────────────────────
    phase("12. Gate isolated stores");
    try {
      const stores = await callTool(client, "list_isolated_stores", {});
      assertArray(stores, "list_isolated_stores");
      console.log(`✅ list_isolated_stores returned ${stores.length} stores`);
    } catch (err) {
      if (err instanceof ToolError && ISOLATED_STORES_UNAVAILABLE.test(err.detail)) {
        skip("list_isolated_stores", `Gate isolated stores not provisioned for this org (${err.detail.split("\n")[0].slice(0, 160)})`);
      } else {
        throw err;
      }
    }
  } finally {
    phase("Cleanup");
    if (pendingRelation) {
      try {
        await duringCleanup(() => callTool(client, "delete_relation", pendingRelation!));
        console.log(`Deleted relation ${pendingRelation.relationId}`);
      } catch (err) {
        console.error(`⚠️ Failed to delete relation ${pendingRelation.relationId}:`, err instanceof Error ? err.message : err);
      }
    }
    if (pendingView) {
      try {
        await duringCleanup(() => callTool(client, "delete_view", pendingView!));
        console.log(`Deleted view ${pendingView.viewId}`);
      } catch (err) {
        console.error(`⚠️ Failed to delete view ${pendingView.viewId}:`, err instanceof Error ? err.message : err);
      }
    }
    for (const dbId of databasesToCleanup) {
      try {
        await duringCleanup(() => callTool(client, "delete_database", { databaseId: dbId }));
        console.log(`Deleted test database ${dbId}`);
      } catch (err) {
        console.error(`⚠️ Failed to clean up test database ${dbId}:`, err instanceof Error ? err.message : err);
      }
    }
    await client.close();
  }
}

runSuite("Database & relational live suite", main);
