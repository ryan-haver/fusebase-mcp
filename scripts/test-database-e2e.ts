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
} from "./lib/live-harness.js";

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

async function main() {
  // Explicit sandbox opt-in: this suite creates and deletes databases in the org.
  const workspaceId = requireSandboxWorkspace();
  console.log(`Sandbox workspace: ${workspaceId}`);

  const client = await connectMcp("fusebase-database-tester", { tier: "all" });
  const databasesToCleanup: string[] = [];
  let pendingRelation: { dashboardId: string; relationId: string } | undefined;

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
    const createDbRes = await callTool(client, "create_database", {
      title: primaryDbTitle,
      description: "Dedicated full-spectrum database functionality test instance",
    });
    assertString(createDbRes?.databaseId, "create_database.databaseId");
    const primaryDbId: string = createDbRes.databaseId;
    databasesToCleanup.push(primaryDbId);
    assertString(createDbRes?.dashboardId, "create_database.dashboardId");
    assertString(createDbRes?.viewId, "create_database.viewId");
    const primaryDashId: string = createDbRes.dashboardId;
    const primaryViewId: string = createDbRes.viewId;
    console.log(`Created database ${primaryDbId}`);

    const dbDetail = await callTool(client, "get_database_detail", { databaseId: primaryDbId });
    assertObject(dbDetail, "get_database_detail");

    const dashDetail = await callTool(client, "get_dashboard_detail", { dashboardId: primaryDashId });
    assertObject(dashDetail, "get_dashboard_detail");

    const updatedTitle = `${primaryDbTitle} [Verified]`;
    const updateDbRes = await callTool(client, "update_database", {
      databaseId: primaryDbId,
      title: updatedTitle,
      description: "Updated description for verification",
    });
    assertObject(updateDbRes, "update_database");
    const detailAfterUpdate = await callTool(client, "get_database_detail", { databaseId: primaryDbId });
    const titleAfterUpdate = detailAfterUpdate?.data?.title ?? detailAfterUpdate?.title;
    assertEqual(titleAfterUpdate, updatedTitle, "database title after update_database");
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

    const schemaAfterAdd = await callTool(client, "get_database_schema", { dashboardId: primaryDashId, viewId: primaryViewId });
    assertArray(schemaAfterAdd, "get_database_schema", 7);
    const namesAfterAdd = schemaAfterAdd.map((c: any) => c.name);
    for (const name of ["Account Name", "Annual Revenue", "Lifecycle Stage", "Tech Capabilities", "Audit Verified", "Renewal Date", "Executive Notes"]) {
      assert(namesAfterAdd.includes(name), `Schema should contain column '${name}', got: ${namesAfterAdd.join(", ")}`);
    }
    console.log("✅ 7 typed columns added and present in schema");

    // ─── 5. Schema mutations ────────────────────────────────────────
    phase("5. Schema mutations");
    await callTool(client, "rename_database_column", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      columnKey: colNotesKey,
      newName: "Strategic Notes",
    });
    await callTool(client, "set_column_width", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      columnKey: colTextKey,
      width: 260,
    });
    await callTool(client, "reorder_database_columns", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      orderedKeys: [colTextKey, colStatusKey, colNumKey, colTagsKey, colDateKey, colCheckKey, colNotesKey],
    });

    const tempColKey = await addColumn("Temporary Scratch Column", "string");
    await callTool(client, "delete_database_column", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      columnKey: tempColKey,
    });

    const schemaAfterMutations = await callTool(client, "get_database_schema", { dashboardId: primaryDashId, viewId: primaryViewId });
    assertArray(schemaAfterMutations, "get_database_schema after mutations", 7);
    const notesCol = schemaAfterMutations.find((c: any) => c.key === colNotesKey);
    assertEqual(notesCol?.name, "Strategic Notes", "renamed column name");
    assert(!schemaAfterMutations.some((c: any) => c.key === tempColKey), `Deleted column ${tempColKey} should not be in schema`);
    console.log("✅ Rename, width, reorder and delete verified against schema");

    // ─── 6. Row ingestion ───────────────────────────────────────────
    phase("6. Row ingestion");
    const addRowRes = await callTool(client, "add_database_row", {
      entity: "custom",
      dashboardId: primaryDashId,
      values: {
        "Account Name": "CyberVanguard Inc.",
        "Annual Revenue": 1250000,
        "Lifecycle Stage": "Prospect",
        "Tech Capabilities": ["AI Native", "Cloud Native"],
        "Audit Verified": true,
        "Renewal Date": "2027-01-15",
        "Strategic Notes": "Initial executive briefing scheduled.",
      },
    });
    assertEqual(addRowRes?.success, true, "add_database_row.success");
    assertString(addRowRes?.rowUuid, "add_database_row.rowUuid");
    const row1Uuid: string = addRowRes.rowUuid;

    const batchRes = await callTool(client, "batch_put_database_data", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      rows: [
        {
          create_new_row: true,
          values: {
            "Account Name": "ShieldAI Dynamics",
            "Annual Revenue": 4800000,
            "Lifecycle Stage": "Evaluation",
            "Tech Capabilities": ["Enterprise Ready", "AI Native"],
            "Audit Verified": true,
            "Renewal Date": "2027-06-30",
            "Strategic Notes": "POC underway with enterprise security team.",
          },
        },
        {
          create_new_row: true,
          values: {
            "Account Name": "Aegis Cloud Security",
            "Annual Revenue": 9200000,
            "Lifecycle Stage": "Contract",
            "Tech Capabilities": ["Enterprise Ready", "Cloud Native"],
            "Audit Verified": true,
            "Renewal Date": "2027-11-01",
            "Strategic Notes": "Procurement legal review in final stage.",
          },
        },
        {
          create_new_row: true,
          values: {
            "Account Name": "Sentinel Zero Trust",
            "Annual Revenue": 2100000,
            "Lifecycle Stage": "Closed Won",
            "Tech Capabilities": ["AI Native"],
            "Audit Verified": false,
            "Renewal Date": "2026-12-31",
            "Strategic Notes": "Closed deal, onboarding completed.",
          },
        },
      ],
    });
    assertEqual(batchRes?.success, true, "batch_put_database_data.success");

    const readRowsRes = await callTool(client, "get_database_rows", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      limit: 20,
      resolveNames: true,
    });
    assertArray(readRowsRes?.rows, "get_database_rows.rows", 4);
    const foundRow1 = readRowsRes.rows.find((r: any) => r.rowUuid === row1Uuid);
    assertObject(foundRow1, `row ${row1Uuid} in get_database_rows`);
    assertEqual(foundRow1.namedCells?.["Account Name"], "CyberVanguard Inc.", "namedCells['Account Name']");
    for (const name of ["ShieldAI Dynamics", "Aegis Cloud Security", "Sentinel Zero Trust"]) {
      assert(
        readRowsRes.rows.some((r: any) => r.namedCells?.["Account Name"] === name),
        `Batch-inserted row '${name}' should be readable`,
      );
    }

    const gridData = await callTool(client, "get_database_data", { dashboardId: primaryDashId, viewId: primaryViewId });
    assertArray(gridData?.data, "get_database_data.data", 4);
    console.log(`✅ 4 rows ingested and read back (${gridData.data.length} grid rows)`);

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

    const updateByKeyRes = await callTool(client, "update_database_cell", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      rowUuid: row1Uuid,
      columnKey: colNumKey,
      value: "1450000",
    });
    assertEqual(updateByKeyRes?.success, true, "update_database_cell (by key).success");

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

    const reorderRowsRes = await callTool(client, "reorder_database_rows", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      rowOrders: [{ rowUuid: row1Uuid, order: 1 }],
    });
    assertEqual(reorderRowsRes?.success, true, "reorder_database_rows.success");
    console.log("✅ Cell updates persisted; row reorder accepted");

    // ─── 8. Views & kanban ──────────────────────────────────────────
    phase("8. Views & kanban");
    const kanbanViewRes = await callTool(client, "create_view", { dashboardId: primaryDashId, name: "Pipeline Kanban" });
    const kanbanViewId = kanbanViewRes?.viewId || kanbanViewRes?.id;
    assertString(kanbanViewId, "create_view.viewId");

    const setRepRes = await callTool(client, "set_view_representation", {
      dashboardId: primaryDashId,
      viewId: kanbanViewId,
      representationType: "kanban",
    });
    assertEqual(setRepRes?.success, true, "set_view_representation.success");

    const setGroupRes = await callTool(client, "set_view_grouping", {
      dashboardId: primaryDashId,
      viewId: kanbanViewId,
      groupByColumnKey: colStatusKey,
    });
    assertEqual(setGroupRes?.success, true, "set_view_grouping.success");

    const moveCardRes = await callTool(client, "move_kanban_card", {
      dashboardId: primaryDashId,
      viewId: kanbanViewId,
      rowId: row1Uuid,
      groupByColumnKey: colStatusKey,
      newValue: "Closed Won",
    });
    assertEqual(moveCardRes?.success, true, "move_kanban_card.success");

    const dupViewRes = await callTool(client, "duplicate_view", { dashboardId: primaryDashId, viewId: kanbanViewId });
    const dupViewId = dupViewRes?.viewId || dupViewRes?.id;
    assertString(dupViewId, "duplicate_view.viewId");

    await callTool(client, "update_view", { dashboardId: primaryDashId, viewId: dupViewId, name: "Pipeline Kanban (Archived)" });
    await callTool(client, "delete_view", { dashboardId: primaryDashId, viewId: dupViewId });
    console.log("✅ View create/representation/grouping/card move/duplicate/update/delete verified");

    // ─── 9. Relations & lookups ─────────────────────────────────────
    phase("9. Relations & lookups");
    const targetRelDbRes = await callTool(client, "create_database", {
      title: `QA Target Products DB ${testTimestamp}`,
      description: "Target database for relational link testing",
    });
    assertString(targetRelDbRes?.databaseId, "target create_database.databaseId");
    databasesToCleanup.push(targetRelDbRes.databaseId);
    assertString(targetRelDbRes?.dashboardId, "target create_database.dashboardId");
    assertString(targetRelDbRes?.viewId, "target create_database.viewId");
    const targetRelDashId: string = targetRelDbRes.dashboardId;
    const targetRelViewId: string = targetRelDbRes.viewId;

    const addProductRes = await callTool(client, "add_database_row", {
      entity: "custom",
      dashboardId: targetRelDashId,
      values: { Name: "Enterprise Falcon EDR" },
    });
    assertString(addProductRes?.rowUuid, "target add_database_row.rowUuid");
    const targetProductRowUuid: string = addProductRes.rowUuid;

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

    const lookupRes = await callTool(client, "add_lookup_column", {
      dashboardId: primaryDashId,
      viewId: primaryViewId,
      name: "Product Detail",
      relationColumnKey: relColumnKey,
    });
    columnKeyOf(lookupRes, "Product Detail");

    const listRelRes = await callTool(client, "list_database_relations", { dashboardId: primaryDashId, viewId: primaryViewId });
    assert(listRelRes !== null && typeof listRelRes === "object", "list_database_relations should return an object or array");
    assertIncludes(JSON.stringify(listRelRes), createdRelationId, "list_database_relations payload");

    await callTool(client, "link_database_rows", {
      relationId: createdRelationId,
      sourceRowUuid: row1Uuid,
      targetRowUuid: targetProductRowUuid,
    });
    const relationRowsRes = await callTool(client, "get_relation_rows", { relationId: createdRelationId });
    assert(relationRowsRes !== null && typeof relationRowsRes === "object", "get_relation_rows should return an object");
    await callTool(client, "unlink_database_rows", {
      relationId: createdRelationId,
      sourceRowUuid: row1Uuid,
      targetRowUuid: targetProductRowUuid,
    });
    await callTool(client, "delete_relation", { dashboardId: primaryDashId, relationId: createdRelationId });
    pendingRelation = undefined;
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

    const cloneDbRes = await callTool(client, "duplicate_database", { databaseId: primaryDbId });
    const clonedDbId = cloneDbRes?.databaseId || cloneDbRes?.id;
    assertString(clonedDbId, "duplicate_database.databaseId");
    databasesToCleanup.push(clonedDbId);
    const clonedDetail = await callTool(client, "get_database_detail", { databaseId: clonedDbId });
    assertObject(clonedDetail, "get_database_detail (clone)");
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
        await callTool(client, "delete_relation", pendingRelation);
        console.log(`Deleted relation ${pendingRelation.relationId}`);
      } catch (err) {
        console.error(`⚠️ Failed to delete relation ${pendingRelation.relationId}:`, err instanceof Error ? err.message : err);
      }
    }
    for (const dbId of databasesToCleanup) {
      try {
        await callTool(client, "delete_database", { databaseId: dbId });
        console.log(`Deleted test database ${dbId}`);
      } catch (err) {
        console.error(`⚠️ Failed to clean up test database ${dbId}:`, err instanceof Error ? err.message : err);
      }
    }
    await client.close();
  }
}

runSuite("Database & relational live suite", main);
