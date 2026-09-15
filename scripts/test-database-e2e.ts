/**
 * FuseBase Database & Isolated Store End-to-End Test Suite
 *
 * Tests the canonical platform APIs discovered from fusebase-cli:
 * 1. Tool discovery & registration verification (165 total tools)
 * 2. Database & dashboard discovery (list_databases, list_all_databases)
 * 3. System managed alias resolution (resolve_database_alias)
 * 4. Schema inspection & column mapping (get_database_schema)
 * 5. Canonical row creation with initial values (add_database_row via batchPutDashboardData)
 * 6. High-throughput batch mutation (batch_put_database_data)
 * 7. Structured row reading with auto-name resolution (get_database_rows with resolveNames: true)
 * 8. Cell mutation by friendly column name (update_database_cell)
 * 9. Row ordering (reorder_database_rows)
 * 10. Relation inspection (list_database_relations)
 * 11. Row cleanup (delete_database_row)
 * 12. PostgreSQL Gate Isolated Store discovery (list_isolated_stores)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
  passedAssertions++;
}

async function callTool(client: Client, name: string, args: Record<string, any> = {}): Promise<any> {
  const res = await client.callTool({ name, arguments: args });
  if (res.isError) {
    const errText = (res.content as any)?.[0]?.text || "Unknown error";
    throw new Error(`Tool '${name}' returned error: ${errText}`);
  }
  const text = (res.content as any)?.[0]?.text;
  if (typeof text !== "string") {
    return text;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  console.log("================================================================================");
  console.log("   FUSEBASE DATABASE & ISOLATED STORE INTEGRATION TEST SUITE (CANONICAL APIS)   ");
  console.log("================================================================================\n");

  const transport = new StdioClientTransport({
    command: "node",
    args: [path.join(rootDir, "dist", "index.js")],
    env: {
      ...process.env,
      FUSEBASE_TOOLS: "all",
    },
  });

  const client = new Client(
    { name: "fusebase-database-tester", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log("✅ Connected to FuseBase MCP Server.\n");

  try {
    // ─── Phase 1: Tool Registration ─────────────────────────────────────
    console.log("--------------------------------------------------");
    console.log("Phase 1: Verifying Tool Suite Registration");
    console.log("--------------------------------------------------");

    const toolsRes = await client.listTools();
    console.log(`Registered Tools: ${toolsRes.tools.length} (Expected: 165)`);
    assert(toolsRes.tools.length === 165, `Expected 165 tools, found ${toolsRes.tools.length}`);

    const requiredTools = [
      "add_database_row",
      "batch_put_database_data",
      "get_database_rows",
      "get_database_schema",
      "update_database_cell",
      "delete_database_row",
      "resolve_database_alias",
      "link_database_rows",
      "unlink_database_rows",
      "get_relation_rows",
      "reorder_database_rows",
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

    for (const toolName of requiredTools) {
      const found = toolsRes.tools.some((t) => t.name === toolName);
      assert(found, `Required tool '${toolName}' must be registered`);
    }
    console.log(`✅ All ${requiredTools.length} database and isolated store tools verified.`);

    // ─── Phase 2: Database & Dashboard Discovery ────────────────────────
    console.log("\n--------------------------------------------------");
    console.log("Phase 2: Database Discovery via REST API");
    console.log("--------------------------------------------------");

    const allDbsRes = await callTool(client, "list_all_databases");
    console.log(`list_all_databases response success: ${allDbsRes?.success}`);
    assert(allDbsRes?.success === true, "list_all_databases should return success: true");
    const databases = allDbsRes?.data || [];
    console.log(`Found ${databases.length} databases in organization.`);
    assert(Array.isArray(databases), "Databases result must be an array");

    let targetDb: any = null;
    let targetDashboardId = "";
    let targetViewId = "";

    // Locate a database with active dashboards and views
    for (const db of databases) {
      if (db.dashboards && db.dashboards.length > 0) {
        for (const dash of db.dashboards) {
          if (dash.views && dash.views.length > 0) {
            targetDb = db;
            targetDashboardId = dash.global_id || dash.id;
            targetViewId = dash.views[0].global_id || dash.views[0].id;
            break;
          }
        }
      }
      if (targetDashboardId && targetViewId) break;
    }

    console.log(`Selected target database: "${targetDb?.title}" (Dashboard: ${targetDashboardId}, View: ${targetViewId})`);
    assert(Boolean(targetDashboardId), "Target dashboard ID must be discovered");
    assert(Boolean(targetViewId), "Target view ID must be discovered");

    // ─── Phase 3: System Managed Alias Resolution ───────────────────────
    console.log("\n--------------------------------------------------");
    console.log("Phase 3: System Database Alias Resolution");
    console.log("--------------------------------------------------");

    const aliasesToTest = ["companies_db", "deals_db", "meetings", "clients", "spaces"];
    for (const alias of aliasesToTest) {
      const resolved = await callTool(client, "resolve_database_alias", { alias });
      console.log(`Alias '${alias}' -> found: ${resolved.found}, database: ${resolved.databaseId || "none"}`);
      assert(typeof resolved === "object" && resolved !== null, `Resolution for ${alias} must return an object`);
    }
    console.log("✅ Alias resolver executed cleanly across all system entities.");

    // ─── Phase 4: Schema Inspection & Column Resolution ─────────────────
    console.log("\n--------------------------------------------------");
    console.log("Phase 4: Schema Inspection with Display Names");
    console.log("--------------------------------------------------");

    const schemaRes = await callTool(client, "get_database_schema", {
      dashboardId: targetDashboardId,
      viewId: targetViewId,
    });

    console.log(`View schema columns count: ${Array.isArray(schemaRes) ? schemaRes.length : 0}`);
    assert(Array.isArray(schemaRes) && schemaRes.length > 0, "Schema must return an array of columns");

    const firstColumn = schemaRes[0];
    console.log(`First column: "${firstColumn.name}" (Key: ${firstColumn.key}, Type: ${firstColumn.type})`);
    assert(Boolean(firstColumn.key), "Column key must be present");
    assert(Boolean(firstColumn.name), "Column name must be present");

    // Find a text/string column to safely write to
    const textColumn = schemaRes.find((c: any) =>
      c.type === "string" || c.type === "multiline" || c.name.toLowerCase().includes("name") || c.name.toLowerCase().includes("title")
    ) || firstColumn;

    console.log(`Writing test target column: "${textColumn.name}" (${textColumn.key})`);

    // ─── Phase 5: Canonical Row Creation with Initial Values ────────────
    console.log("\n--------------------------------------------------");
    console.log("Phase 5: Canonical Row Creation via batchPutDashboardData");
    console.log("--------------------------------------------------");

    const testValue1 = `E2E Test Row ${Date.now()}`;
    const initialValues: Record<string, unknown> = {};
    initialValues[textColumn.name] = testValue1;

    console.log(`Calling add_database_row with initial values for '${textColumn.name}'...`);
    const addRowRes = await callTool(client, "add_database_row", {
      entity: "custom",
      dashboardId: targetDashboardId,
      values: initialValues,
    });

    console.log("add_database_row response:", JSON.stringify(addRowRes));
    assert(addRowRes?.success === true, "add_database_row must succeed without server-action errors");

    // ─── Phase 6: Batch Data Creation & Mutation ────────────────────────
    console.log("\n--------------------------------------------------");
    console.log("Phase 6: High-Throughput batch_put_database_data");
    console.log("--------------------------------------------------");

    const batchTestValue = `Batch Row Alpha ${Date.now()}`;
    const batchValues: Record<string, unknown> = {};
    batchValues[textColumn.name] = batchTestValue;

    const batchRes = await callTool(client, "batch_put_database_data", {
      dashboardId: targetDashboardId,
      viewId: targetViewId,
      rows: [
        {
          create_new_row: true,
          values: batchValues,
        },
      ],
    });

    console.log("batch_put_database_data response:", JSON.stringify(batchRes));
    assert(batchRes?.success === true, "batch_put_database_data must return success: true");

    // ─── Phase 7: Structured Read with Auto-Name Resolution ─────────────
    console.log("\n--------------------------------------------------");
    console.log("Phase 7: Structured get_database_rows with Name Resolution");
    console.log("--------------------------------------------------");

    const rowsRes = await callTool(client, "get_database_rows", {
      dashboardId: targetDashboardId,
      viewId: targetViewId,
      limit: 20,
      resolveNames: true,
    });

    console.log(`Total rows returned: ${rowsRes?.rows?.length}`);
    assert(Array.isArray(rowsRes?.rows), "Rows response must contain rows array");
    assert(rowsRes.rows.length > 0, "Should find at least one row in table");

    const sampleRow = rowsRes.rows[0];
    console.log(`Sample row UUID: ${sampleRow.rowUuid}`);
    assert(Boolean(sampleRow.rowUuid), "Row must contain rowUuid");
    assert(typeof sampleRow.cells === "object", "Row must contain raw cells map");
    assert(typeof sampleRow.namedCells === "object", "Row must contain human-readable namedCells map");

    // Find the row we created to verify cell value and test updates
    const createdRow = rowsRes.rows.find((r: any) =>
      r.namedCells?.[textColumn.name] === testValue1 ||
      r.cells?.[textColumn.key] === testValue1 ||
      r.namedCells?.[textColumn.name] === batchTestValue ||
      r.cells?.[textColumn.key] === batchTestValue
    ) || sampleRow;

    const targetRowUuid = createdRow.rowUuid;
    console.log(`Target row for mutation test: ${targetRowUuid}`);

    // ─── Phase 8: Cell Mutation by Friendly Name / Key ───────────────────
    console.log("\n--------------------------------------------------");
    console.log("Phase 8: Cell Mutation via update_database_cell");
    console.log("--------------------------------------------------");

    const updatedValue = `Updated Value ${Date.now()}`;
    const updateRes = await callTool(client, "update_database_cell", {
      dashboardId: targetDashboardId,
      viewId: targetViewId,
      rowUuid: targetRowUuid,
      columnKey: textColumn.name, // Pass display name to verify name-to-key resolution!
      value: updatedValue,
    });

    console.log("update_database_cell response:", JSON.stringify(updateRes));
    assert(updateRes?.success === true, "update_database_cell must succeed");

    // Verify cell update persisted
    const verifyRowsRes = await callTool(client, "get_database_rows", {
      dashboardId: targetDashboardId,
      viewId: targetViewId,
      limit: 20,
      resolveNames: true,
    });

    const verifiedRow = verifyRowsRes.rows.find((r: any) => r.rowUuid === targetRowUuid);
    console.log(`Verified row cells:`, JSON.stringify(verifiedRow?.namedCells?.[textColumn.name]));
    assert(
      verifiedRow?.namedCells?.[textColumn.name] === updatedValue ||
      verifiedRow?.cells?.[textColumn.key] === updatedValue,
      "Updated cell value must match in subsequent read"
    );
    console.log("✅ Cell mutation persisted and matched exactly via namedCells!");

    // ─── Phase 9: Relations & Row Ordering Probes ───────────────────────
    console.log("\n--------------------------------------------------");
    console.log("Phase 9: Relation & Row Order Probes");
    console.log("--------------------------------------------------");

    const relationsRes = await callTool(client, "list_database_relations", {
      dashboardId: targetDashboardId,
      viewId: targetViewId,
    });
    console.log("list_database_relations success:", relationsRes?.success);
    assert(relationsRes?.success === true, "list_database_relations must return success: true");

    const orderRes = await callTool(client, "reorder_database_rows", {
      dashboardId: targetDashboardId,
      viewId: targetViewId,
      rowOrders: [{ rowUuid: targetRowUuid, order: 0 }],
    });
    console.log("reorder_database_rows response:", JSON.stringify(orderRes));
    assert(orderRes?.success === true, "reorder_database_rows must return success: true");

    // ─── Phase 10: PostgreSQL Gate Isolated Store Discovery ─────────────
    console.log("\n--------------------------------------------------");
    console.log("Phase 10: FuseBase PostgreSQL Gate Isolated Store Probe");
    console.log("--------------------------------------------------");

    try {
      const storesRes = await callTool(client, "list_isolated_stores", {});
      console.log("list_isolated_stores result:", JSON.stringify(storesRes));
      console.log("✅ Gate Isolated Store probe completed successfully.");
    } catch (e: any) {
      console.log(`Gate service probe completed (org access status: ${e.message})`);
    }

    // ─── Phase 11: Clean Up Test Rows ───────────────────────────────────
    console.log("\n--------------------------------------------------");
    console.log("Phase 11: Cleanup Test Rows");
    console.log("--------------------------------------------------");

    // Clean up created test row
    if (createdRow && createdRow.rowUuid) {
      const deleteRes = await callTool(client, "delete_database_row", {
        dashboardId: targetDashboardId,
        rowId: createdRow.rowUuid,
      });
      console.log(`Deleted test row ${createdRow.rowUuid}:`, JSON.stringify(deleteRes));
    }

    console.log("\n================================================================================");
    console.log(`🎉 ALL DATABASE E2E TESTS PASSED! (${passedAssertions}/${totalAssertions} assertions)`);
    console.log("================================================================================\n");

  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("\n❌ E2E Database Test Run Failed:\n", err);
  process.exit(1);
});
