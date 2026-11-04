import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerFusebasePostgresqlGateIsolatedSqlStoresTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === FuseBase PostgreSQL (Gate Isolated SQL Stores) ===

  registerAnnotatedTool(server,
    "list_isolated_stores",
    "List all isolated PostgreSQL stores (databases) in the organization provisioned via FuseBase Gate.",
    {
      orgId: z.string().optional().describe("Organization ID (defaults to active org)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ orgId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.listIsolatedStores(orgId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "create_isolated_store",
    "Provision a new isolated PostgreSQL database in the organization via FuseBase Gate.",
    {
      alias: z.string().describe("Database alias (identifier for app or workflow)"),
      engine: z.string().optional().default("postgres").describe("Database engine (default: 'postgres')"),
      storeType: z.string().optional().default("sql").describe("Store type (default: 'sql')"),
      orgId: z.string().optional().describe("Organization ID (defaults to active org)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ alias, engine, storeType, orgId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.createIsolatedStore(alias, { engine, storeType, orgId });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "query_isolated_sql",
    "Execute a read-only SQL query (SELECT) against a FuseBase PostgreSQL Isolated Store. Runs inside a READ ONLY transaction.",
    {
      storeId: z.string().describe("Isolated store ID"),
      sql: z.string().describe("SQL query (e.g. 'SELECT * FROM users WHERE active = true')"),
      params: z.array(z.unknown()).optional().describe("Query parameters for parameterized query ($1, $2)"),
      stage: z.enum(["dev", "prod"]).optional().default("prod").describe("Database stage ('prod' or 'dev', default: 'prod')"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ storeId, sql, params, stage, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.queryIsolatedStoreSql(storeId, sql, params, stage);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "execute_isolated_sql",
    "Execute a DML statement (INSERT, UPDATE, DELETE) against a FuseBase PostgreSQL Isolated Store. For schema DDL changes, use apply_isolated_sql_migrations instead.",
    {
      storeId: z.string().describe("Isolated store ID"),
      sql: z.string().describe("SQL statement (e.g. 'UPDATE users SET status = $1 WHERE id = $2')"),
      params: z.array(z.unknown()).optional().describe("Statement parameters ($1, $2)"),
      stage: z.enum(["dev", "prod"]).describe("Database stage to write to: 'dev' or 'prod'. Required so writes never reach production by default."),
      confirm: z.boolean().optional().default(false).describe("Gate confirmation: set true only after reviewing the operation and obtaining authorization for its target and changes."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ storeId, sql, params, stage, confirm, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.executeIsolatedStoreSql(storeId, sql, params, stage, confirm);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "select_isolated_sql_rows",
    "Select rows from a table in a FuseBase PostgreSQL Isolated Store using structured filters and options.",
    {
      storeId: z.string().describe("Isolated store ID"),
      table: z.string().describe("Table name"),
      where: z.record(z.string(), z.unknown()).optional().describe("Filter conditions as { column: value }"),
      limit: z.number().optional().default(100).describe("Max rows to return (default: 100, max: 500)"),
      offset: z.number().optional().default(0).describe("Row offset for pagination"),
      order: z.array(z.string()).optional().describe("Sort columns (e.g. ['created_at DESC'])"),
      stage: z.enum(["dev", "prod"]).optional().default("prod").describe("Database stage ('prod' or 'dev')"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ storeId, table, where, limit, offset, order, stage, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.selectIsolatedStoreSqlRows(storeId, table, { where, limit, offset, order, stage });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "insert_isolated_sql_row",
    "Insert a single row into a table in a FuseBase PostgreSQL Isolated Store.",
    {
      storeId: z.string().describe("Isolated store ID"),
      table: z.string().describe("Table name"),
      row: z.record(z.string(), z.unknown()).describe("Column values to insert"),
      stage: z.enum(["dev", "prod"]).describe("Database stage to write to: 'dev' or 'prod'. Required so writes never reach production by default."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ storeId, table, row, stage, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.insertIsolatedStoreSqlRow(storeId, table, row, stage);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "batch_insert_isolated_sql_rows",
    "Insert multiple rows into a table in a FuseBase PostgreSQL Isolated Store in a single request.",
    {
      storeId: z.string().describe("Isolated store ID"),
      table: z.string().describe("Table name"),
      rows: z.array(z.record(z.string(), z.unknown())).describe("Array of row objects to insert"),
      stage: z.enum(["dev", "prod"]).describe("Database stage to write to: 'dev' or 'prod'. Required so writes never reach production by default."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ storeId, table, rows, stage, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.batchInsertIsolatedStoreSqlRows(storeId, table, rows, stage);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "list_isolated_sql_tables",
    "List all user tables in a FuseBase PostgreSQL Isolated Store.",
    {
      storeId: z.string().describe("Isolated store ID"),
      stage: z.enum(["dev", "prod"]).optional().default("prod").describe("Database stage ('prod' or 'dev')"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ storeId, stage, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.listIsolatedStoreSqlTables(storeId, stage);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "apply_isolated_sql_migrations",
    "Apply a DDL schema migration bundle to a FuseBase PostgreSQL Isolated Store.",
    {
      storeId: z.string().describe("Isolated store ID"),
      bundle: z.record(z.string(), z.unknown()).describe("Migration bundle with optional bundleVersion and migrations array; each entry requires integer version, name, checksum and sql."),
      stage: z.enum(["dev", "prod"]).describe("Database stage to migrate: 'dev' or 'prod'. Required so migrations never reach production by default; run with dryRun first."),
      dryRun: z.boolean().optional().default(false).describe("Validate without applying (dry run)"),
      confirm: z.boolean().optional().default(false).describe("Gate confirmation, required even for dry runs: set true only after reviewing migration status and obtaining authorization for this store, stage and bundle."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ storeId, bundle, stage, dryRun, confirm, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.applyIsolatedStoreSqlMigrations(storeId, bundle, stage, dryRun, confirm);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
