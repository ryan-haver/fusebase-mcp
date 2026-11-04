import { registerAnnotatedTool } from "./registry.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FusebaseClient } from "../client.js";
import { errorResult } from "./helpers.js";

export function registerDatabaseDataTools(server: McpServer, getClient: (profile?: string) => FusebaseClient): void {
  // === Database Data ===

  registerAnnotatedTool(server,
    "get_database_data",
    "Get structured data from a Fusebase database/table view. Requires the dashboard UUID and view UUID, which can be found in the URL when viewing a database in the Fusebase UI. Supports pagination via page and limit parameters.",
    {
      dashboardId: z.string().describe("Dashboard UUID (from the database URL)"),
      viewId: z.string().describe("View UUID (from the database URL)"),
      page: z.number().optional().describe("Page number (default: 1)"),
      limit: z.number().optional().describe("Results per page (default: server default)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, page, limit, profile }) => {
      const client = getClient(profile);
      try {
        const data = await client.getDatabaseData(dashboardId, viewId, { page, limit });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(data, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "list_databases",
    "List all databases/dashboards in the organization. Returns dashboard and view UUIDs that can be used with get_database_data. Probes known entity types (spaces, clients) plus any custom entities you specify.",
    {
      orgId: z.string().optional().describe("Organization ID (defaults to env FUSEBASE_ORG_ID)"),
      customEntities: z.array(z.string()).optional().describe("Additional entity types to probe beyond defaults (spaces, clients)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ orgId, customEntities, profile }) => {
      const client = getClient(profile);
      try {
        const databases = await client.listDatabases(orgId, customEntities);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(databases, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "get_database_entity",
    "Get data from a specific database entity type (e.g. clients, spaces). Automatically discovers the correct dashboard/view UUIDs for the entity. Supports pagination.",
    {
      entity: z.string().describe("Entity type (e.g. 'clients', 'spaces', 'portals')"),
      page: z.number().optional().describe("Page number (default: 1)"),
      limit: z.number().optional().describe("Results per page"),
      orgId: z.string().optional().describe("Organization ID (defaults to env FUSEBASE_ORG_ID)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ entity, page, limit, orgId, profile }) => {
      const client = getClient(profile);
      try {
        const data = await client.getDatabaseEntity(entity, { page, limit }, orgId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(data, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "create_database",
    "Create a new database (table or kanban view) in the organization. Returns the new database, dashboard, and view UUIDs. The database is created with a default table representation. Use list_databases afterwards to see it.",
    {
      title: z.string().describe("Database title"),
      description: z.string().optional().describe("Database description (defaults to title)"),
      icon: z.string().optional().describe("Icon identifier (defaults to 'default')"),
      color: z.string().optional().describe("Color theme (e.g. 'fuchsia', 'blue', 'green')"),
      isPublic: z.boolean().optional().describe("Whether the database is public (defaults to false)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ title, description, icon, color, isPublic, profile }) => {
      const client = getClient(profile);
      try {
        const result: any = await client.createDatabase(title, { description, icon, color, isPublic });
        const dbData = result?.data || result;
        const databaseId = dbData?.global_id || dbData?.id || result?.databaseId;
        const dashboard = dbData?.dashboards?.[0];
        const dashboardId = dashboard?.global_id || dashboard?.id || result?.dashboardId;
        const view = dashboard?.views?.[0];
        const viewId = view?.global_id || view?.id || result?.viewId;
        const responseData = {
          databaseId,
          dashboardId,
          viewId,
          ...result,
        };
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(responseData, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "add_database_row",
    "Add a new row to a database table or entity. Uses canonical batchPutDashboardData with create_new_row: true. You can optionally supply initial column values as a key-value map (using column display names or opaque item_keys).",
    {
      entity: z.string().describe("Entity type (e.g. 'clients', 'spaces', 'custom')"),
      databaseId: z.string().optional().describe("Database UUID (required for custom databases, from create_database)"),
      dashboardId: z.string().optional().describe("Dashboard UUID (required for custom databases, from create_database)"),
      viewId: z.string().optional().describe("View UUID (optional, auto-discovered from dashboard if omitted)"),
      values: z.record(z.string(), z.unknown()).optional().describe("Initial column values as { 'Column Name' or item_key: value }"),
      orgId: z.string().optional().describe("Organization ID (defaults to env FUSEBASE_ORG_ID)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ entity, databaseId, dashboardId, viewId, values, orgId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.addDatabaseRow(entity, { databaseId, dashboardId, viewId, values, orgId });
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
    "delete_database_row",
    "[DESTRUCTIVE] Delete a row from a database. Requires the dashboard ID and the row ID. Use get_database_rows to find row IDs.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      rowId: z.string().describe("Row ID to delete (from get_database_rows)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, rowId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.deleteRow(dashboardId, rowId);
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
    "batch_put_database_data",
    "High-throughput batch create and update for database rows and cell values. Supports creating new rows (create_new_row: true) and updating existing rows (create_new_row: false, root_index_value: rowUuid). Values can use column display names or opaque item_keys. To delete a cell value, pass null.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      rows: z.array(z.object({
        create_new_row: z.boolean().optional().describe("Set true to create a new row (default false)"),
        root_index_value: z.string().optional().describe("Row UUID (required when updating, optional when creating)"),
        values: z.record(z.string(), z.unknown()).or(z.array(z.object({
          item_key: z.string(),
          value: z.unknown(),
        }))).describe("Row values: either { 'Column Name': value } map or [{ item_key, value }] array"),
      })).describe("Array of row creation/update specifications"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, rows, profile }) => {
      const client = getClient(profile);
      try {
        let keyByName: Map<string, string> | null = null;
        const normalizedRows: Array<{
          create_new_row?: boolean;
          root_index_value?: string;
          values: Array<{ item_key: string; value: unknown }>;
        }> = [];

        for (const r of rows) {
          if (Array.isArray(r.values)) {
            normalizedRows.push({
              create_new_row: r.create_new_row,
              root_index_value: r.root_index_value,
              values: r.values,
            });
          } else if (typeof r.values === "object" && r.values !== null) {
            if (!keyByName) {
              const mapping = await client.resolveColumnKeys(dashboardId, viewId);
              keyByName = mapping.keyByName;
            }
            const itemValues: Array<{ item_key: string; value: unknown }> = [];
            for (const [k, v] of Object.entries(r.values as Record<string, unknown>)) {
              const itemKey = keyByName.get(k.toLowerCase()) || k;
              itemValues.push({ item_key: itemKey, value: v });
            }
            normalizedRows.push({
              create_new_row: r.create_new_row,
              root_index_value: r.root_index_value,
              values: itemValues,
            });
          } else {
            normalizedRows.push({
              create_new_row: r.create_new_row,
              root_index_value: r.root_index_value,
              values: [],
            });
          }
        }

        const result = await client.batchPutDashboardData(dashboardId, viewId, normalizedRows);
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
    "resolve_database_alias",
    "Resolve a system managed database or dashboard alias ('companies_db', 'deals_db', 'meetings', 'clients', 'spaces') to its database, dashboard, and view UUIDs. Useful for CRM and pipeline automation.",
    {
      alias: z.string().describe("Database alias (e.g. 'companies_db', 'deals_db', 'meetings', 'clients', 'spaces')"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ alias, profile }) => {
      const client = getClient(profile);
      try {
        const resolved = await client.resolveDatabaseAlias(alias);
        if (resolved.lookupError) throw new Error(`Couldn't read the database list to resolve '${alias}': ${resolved.lookupError}`);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(resolved, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "link_database_rows",
    "Link two rows between related tables via an existing relation. Requires the relation ID, the source row UUID (from the source table), and the target row UUID (from the target table). Use list_database_relations to find relation IDs.",
    {
      relationId: z.string().describe("Relation ID (from list_database_relations)"),
      sourceRowUuid: z.string().describe("Row UUID in the source table"),
      targetRowUuid: z.string().describe("Row UUID in the target table"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ relationId, sourceRowUuid, targetRowUuid, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.addRelationRows(relationId, [{ source_index: sourceRowUuid, target_index: targetRowUuid }]);
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
    "unlink_database_rows",
    "Remove links between rows in related tables. Pass sourceRowUuid and targetRowUuid to remove one link; pass only one of them to remove every link of that row. At least one row UUID is required unless unlinkAll is true.",
    {
      relationId: z.string().describe("Relation ID"),
      sourceRowUuid: z.string().optional().describe("Source row UUID to unlink"),
      targetRowUuid: z.string().optional().describe("Target row UUID to unlink"),
      unlinkAll: z.boolean().optional().describe("[DESTRUCTIVE] Set true (with no row UUIDs) to remove EVERY link on this relation. Cannot be undone."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ relationId, sourceRowUuid, targetRowUuid, unlinkAll, profile }) => {
      const client = getClient(profile);
      try {
        const hasIds = Boolean(sourceRowUuid || targetRowUuid);
        if (hasIds && unlinkAll) {
          throw new Error("Pass either row UUIDs or unlinkAll: true, not both.");
        }
        if (!hasIds && unlinkAll !== true) {
          throw new Error(
            "sourceRowUuid and/or targetRowUuid is required. To remove every link on the relation, pass unlinkAll: true.",
          );
        }
        const result = await client.deleteRelationRows(
          relationId,
          hasIds ? { source_index: sourceRowUuid, target_index: targetRowUuid } : { unlinkAll: true },
        );
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
    "get_relation_rows",
    "Get active row link mappings for a relation. Shows which source rows are linked to which target rows.",
    {
      relationId: z.string().describe("Relation ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ relationId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.getRelationDetails(relationId, true);
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
    "reorder_database_rows",
    "Reorder rows within a database view or section. Takes an array of { rowUuid, order } objects.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      rowOrders: z.array(z.object({
        rowUuid: z.string().describe("Row UUID"),
        order: z.number().int().min(1).describe("1-based sort position (sent as sort_order)"),
      })).describe("Array of row positions"),
      sectionType: z.string().optional().describe("Section type (default: 'view')"),
      sectionKey: z.string().optional().describe("Section key (default: 'view')"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, rowOrders, sectionType, sectionKey, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.updateDashboardRowOrder(
          dashboardId,
          viewId,
          rowOrders.map((r) => ({ row_uuid: r.rowUuid, sort_order: r.order })),
          { section_type: sectionType, section_key: sectionKey },
        );
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
    "move_kanban_card",
    "Move a kanban card to a different column by updating the grouped column's cell value. Equivalent to update_database_cell but semantically describes moving a card. Use get_database_schema to find the groupBy column key, and get_database_rows to find the row UUID.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      rowId: z.string().describe("Row UUID of the card to move"),
      groupByColumnKey: z.string().describe("Column key of the kanban grouping column"),
      newValue: z.any().describe("New value for the grouped column (moves card to that group)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, rowId, groupByColumnKey, newValue, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.moveKanbanCard(dashboardId, viewId, rowId, groupByColumnKey, newValue);
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
    "list_database_relations",
    "List available relation targets and existing lookups for a dashboard. Returns linked tables/views that can be used for creating relation or lookup columns.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().optional().describe("View ID (helps narrow results)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.listRelations(dashboardId, viewId);
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
    "create_dashboard_table",
    "Create a new table (dashboard) within an existing database. Returns the new dashboard UUID and its default view UUID. Use list_all_databases to find the parent database ID.",
    {
      databaseId: z.string().optional().describe("Parent database UUID"),
      dashboardId: z.string().optional().describe("Parent database UUID (alias for databaseId)"),
      title: z.string().describe("Table title"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ databaseId, dashboardId, title, profile }) => {
      const parentId = databaseId || dashboardId;
      if (!parentId) {
        return errorResult(new Error("Either databaseId or dashboardId must be provided"));
      }
      const client = getClient(profile);
      try {
        const result = await client.createDashboardTable(parentId, title);
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
    "delete_relation",
    "[DESTRUCTIVE] Delete a relation by its ID. This removes the link between two database tables. Use list_database_relations to find relation IDs.",
    {
      relationId: z.string().describe("Relation ID to delete"),
      dashboardId: z.string().optional().describe("Dashboard ID (optional)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ relationId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.deleteRelation(relationId);
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
    "list_all_databases",
    "List all databases in the organization via the dashboard-service REST API. Returns database metadata, dashboard (table) UUIDs, and view UUIDs. More comprehensive than list_databases — returns full database objects with nested dashboards.",
    {
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.listAllDatabases();
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
    "get_database_detail",
    "Get detailed information about a specific database including all its dashboards (tables) and views. Use the database ID from list_all_databases or create_database.",
    {
      databaseId: z.string().optional().describe("Database UUID"),
      dashboardId: z.string().optional().describe("Database UUID (alias for databaseId)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ databaseId, dashboardId, profile }) => {
      const client = getClient(profile);
      try {
        const effectiveId = databaseId || dashboardId;
        if (!effectiveId) {
          return {
            content: [{ type: "text" as const, text: "Error: Either 'databaseId' or 'dashboardId' must be provided." }],
            isError: true,
          };
        }
        const result = await client.getDatabaseDetail(effectiveId);
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
    "update_database",
    "Update a database's title, description, icon, color, favorite status, or public visibility. Uses PUT (PATCH is not supported by this API).",
    {
      databaseId: z.string().optional().describe("Database UUID to update"),
      dashboardId: z.string().optional().describe("Database UUID to update (alias for databaseId)"),
      title: z.string().optional().describe("New database title"),
      description: z.string().optional().describe("New description"),
      icon: z.string().optional().describe("Icon name (e.g. 'default')"),
      color: z.string().optional().describe("Color name (e.g. 'blue', 'fuchsia', 'green')"),
      isPublic: z.boolean().optional().describe("Whether the database is public"),
      favorite: z.boolean().optional().describe("Toggle favorite status"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ databaseId, dashboardId, title, description, icon, color, isPublic, favorite, profile }) => {
      const client = getClient(profile);
      try {
        const effectiveId = databaseId || dashboardId;
        if (!effectiveId) {
          return {
            content: [{ type: "text" as const, text: "Error: Either 'databaseId' or 'dashboardId' must be provided." }],
            isError: true,
          };
        }
        const result = await client.updateDatabase(effectiveId, { title, description, icon, color, isPublic, favorite });
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
    "delete_database",
    "[DESTRUCTIVE] Delete a database and ALL its dashboards (tables), views, and data. This action is irreversible. Returns 204 on success.",
    {
      databaseId: z.string().optional().describe("Database UUID to delete"),
      dashboardId: z.string().optional().describe("Database UUID to delete (alias for databaseId)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ databaseId, dashboardId, profile }) => {
      const client = getClient(profile);
      try {
        const effectiveId = databaseId || dashboardId;
        if (!effectiveId) {
          return {
            content: [{ type: "text" as const, text: "Error: Either 'databaseId' or 'dashboardId' must be provided." }],
            isError: true,
          };
        }
        const result = await client.deleteDatabase(effectiveId);
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
    "get_dashboard_detail",
    "Get detailed information about a dashboard (table within a database). Returns the dashboard's views array (including custom views), metadata, root entity, and scopes. Use the dashboard ID from list_all_databases or get_database_detail.",
    {
      dashboardId: z.string().describe("Dashboard UUID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.getDashboardDetail(dashboardId);
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
    "delete_dashboard",
    "[DESTRUCTIVE] Delete a dashboard (table) within a database. Removes the table and its data. Use get_database_detail first to see available dashboards.",
    {
      dashboardId: z.string().describe("Dashboard UUID to delete"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.deleteDashboard(dashboardId);
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
    "update_view",
    "Update a custom view's name, filters, sorts, or hidden columns. Use get_dashboard_detail to find available views. Uses PUT (PATCH is not supported).",
    {
      dashboardId: z.string().describe("Dashboard UUID containing the view"),
      viewId: z.string().describe("View UUID to update"),
      name: z.string().optional().describe("New view name"),
      filters: z.array(z.object({
        column: z.string().describe("Column name to filter on"),
        op: z.string().describe("Filter operator (e.g. 'contains', 'equals', 'gt', 'lt')"),
        value: z.unknown().describe("Filter value"),
      })).optional().describe("Array of filter conditions"),
      sorts: z.array(z.object({
        column: z.string().describe("Column name to sort by"),
        direction: z.enum(["asc", "desc"]).describe("Sort direction"),
      })).optional().describe("Array of sort specifications"),
      hidden_columns: z.array(z.string()).optional().describe("Array of column names to hide in this view"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, name, filters, sorts, hidden_columns, profile }) => {
      const client = getClient(profile);
      try {
        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (filters !== undefined) updates.filters = filters;
        if (sorts !== undefined) updates.sorts = sorts;
        if (hidden_columns !== undefined) updates.hidden_columns = hidden_columns;
        const result = await client.updateView(dashboardId, viewId, updates as any);
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
    "set_view_representation",
    "Switch a view's display mode. Supports 8 types: table (default spreadsheet), kanban (card columns), board, calendar, timeline, gallery, list, grid. Table and kanban use the representations endpoint; the rest use PUT with default_representation_template_id. Use get_dashboard_detail to find dashboard and view UUIDs.",
    {
      dashboardId: z.string().describe("Dashboard UUID"),
      viewId: z.string().describe("View UUID"),
      representationType: z.enum(["table", "kanban", "board", "calendar", "timeline", "gallery", "list", "grid"]).describe("Display mode"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, representationType, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.setViewRepresentation(dashboardId, viewId, representationType);
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
    "duplicate_database",
    "Duplicate (copy) an entire database, including tables, views, relations, and optionally data. Returns the new database with its UUIDs. Discovered via captured API: POST /databases/copy-from/database.",
    {
      sourceDbId: z.string().optional().describe("Global ID of the database to duplicate"),
      databaseId: z.string().optional().describe("Global ID of the database to duplicate (alias for sourceDbId)"),
      dashboardId: z.string().optional().describe("Global ID of the database to duplicate (alias for sourceDbId)"),
      copyData: z.boolean().optional().default(true).describe("Copy row data too (default true). Set false for structure-only copy."),
      title: z.string().optional().describe("Title for the copy (default: FuseBase's own copy name)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ sourceDbId, databaseId, dashboardId, copyData, title, profile }) => {
      const client = getClient(profile);
      try {
        const effectiveId = sourceDbId || databaseId || dashboardId;
        if (!effectiveId) {
          return {
            content: [{ type: "text" as const, text: "Error: Either 'sourceDbId' or 'databaseId' must be provided." }],
            isError: true,
          };
        }
        const result = await client.duplicateDatabase(effectiveId, { copyData });
        const newDbId = (result as any)?.data?.global_id || (result as any)?.global_id;
        // The copy endpoint takes no title, so rename the copy afterwards.
        let renamed: string | undefined;
        if (title) {
          if (!newDbId) throw new Error("Database was duplicated, but its id is missing from the response, so it couldn't be renamed");
          await client.updateDatabase(newDbId, { title });
          renamed = title;
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ ...result, databaseId: newDbId, ...(renamed ? { title: renamed } : {}) }, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "create_view",
    "Create a new view within a dashboard (table). Each view can have its own filters, sorts, grouping, column visibility, and display mode. Optionally set its display mode (representationType) and, for kanban/board, the column to group by.",
    {
      dashboardId: z.string().describe("Dashboard UUID"),
      name: z.string().optional().describe("View name (defaults to auto-generated name)"),
      representationType: z.enum(["table", "kanban", "board", "calendar", "timeline", "gallery", "list", "grid"]).optional().describe("Display mode for the new view (default: table)"),
      groupByColumnKey: z.string().optional().describe("Column key to group a kanban/board view by"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, name, representationType, groupByColumnKey, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.createView(dashboardId, name);
        const viewId = (result as any)?.data?.global_id || (result as any)?.global_id;
        if ((representationType && representationType !== "table") || groupByColumnKey) {
          if (!viewId) throw new Error("View was created, but its id is missing from the response, so its display mode couldn't be set");
          if (groupByColumnKey) {
            const mode = representationType === "board" ? "board" : "kanban";
            await client.setViewGrouping(dashboardId, viewId, groupByColumnKey, mode);
          } else {
            await client.setViewRepresentation(dashboardId, viewId, representationType as any);
          }
        }
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ ...result, viewId, representationType: representationType ?? "table", ...(groupByColumnKey ? { groupByColumnKey } : {}) }, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "delete_view",
    "[DESTRUCTIVE] Delete a view from a dashboard. Cannot delete the default (first) view. Use get_dashboard_detail to find view UUIDs.",
    {
      dashboardId: z.string().describe("Dashboard UUID"),
      viewId: z.string().describe("View UUID to delete"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.deleteView(dashboardId, viewId);
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
    "export_csv",
    "Export a database view as CSV text. Returns the raw CSV content. Supports 5 delimiter options: comma, semicolon, pipe, tab, or caret. Use get_dashboard_detail to find dashboard and view UUIDs.",
    {
      dashboardId: z.string().describe("Dashboard UUID"),
      viewId: z.string().describe("View UUID"),
      delimiter: z.enum([",", ";", "|", "\t", "^"]).optional().describe("CSV delimiter (default comma)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, delimiter, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.exportCSV(dashboardId, viewId, delimiter);
        return {
          content: [
            { type: "text" as const, text: result.csv },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "duplicate_view",
    "Duplicate an existing view within a dashboard. Creates a copy with the same schema, filters, and configuration. Use get_dashboard_detail to find dashboard and view UUIDs.",
    {
      dashboardId: z.string().describe("Dashboard UUID"),
      sourceViewId: z.string().optional().describe("Source view UUID to duplicate"),
      viewId: z.string().optional().describe("Source view UUID to duplicate (alias for sourceViewId)"),
      name: z.string().optional().describe("Name for the new view (defaults to 'Copy of View')"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, sourceViewId, viewId, name, profile }) => {
      const client = getClient(profile);
      try {
        const targetViewId = sourceViewId || viewId;
        if (!targetViewId) {
          return errorResult(new Error("Either sourceViewId or viewId must be provided"));
        }
        const result = await client.duplicateView(dashboardId, targetViewId, name);
        const duplicatedViewId = (result as any)?.data?.global_id || (result as any)?.global_id;
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ ...result, viewId: duplicatedViewId }, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "import_csv",
    "Import CSV data into an existing database table/view. Provide the CSV content, the database ID, dashboard (table) ID, and the view ID. The server will import the rows into the database. Column mapping is auto-generated from CSV headers (all imported as 'Single line text').",
    {
      csvContent: z.string().optional().describe("CSV content as a string"),
      csv: z.string().optional().describe("CSV content as a string (alias for csvContent)"),
      databaseId: z.string().optional().describe("Database ID"),
      dashboardId: z.string().describe("Dashboard (table) ID to import into"),
      viewId: z.string().describe("View ID to import into"),
      delimiter: z.enum([",", ";", "|", "\t", "^"]).optional().describe("CSV delimiter (default comma)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ csvContent, csv, databaseId, dashboardId, viewId, delimiter, profile }) => {
      const client = getClient(profile);
      try {
        const content = csvContent || csv;
        if (!content) {
          return errorResult(new Error("Either csvContent or csv must be provided"));
        }
        const result = await client.importCSV(content, databaseId || "", dashboardId, viewId, { delimiter });
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
    "set_view_grouping",
    "Set the grouping column for a kanban or board view. Groups cards/rows by the specified column. Requires the dashboard ID, view ID, and the column key to group by. Use get_database_schema first to find column keys.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      groupByColumnKey: z.string().describe("Column key to group by (use get_database_schema to find keys)"),
      representationType: z.enum(["kanban", "board"]).optional().describe("Representation type (default: kanban)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, groupByColumnKey, representationType, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.setViewGrouping(dashboardId, viewId, groupByColumnKey, representationType || "kanban");
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
    "set_column_width",
    "Set the width of a column in a database view. Use get_database_schema first to find column keys. Width is in pixels.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      columnKey: z.string().describe("Column key to resize"),
      width: z.number().describe("Width in pixels (e.g. 200, 350, 500)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, columnKey, width, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.setColumnWidth(dashboardId, viewId, columnKey, width);
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
    "rename_database_column",
    "Rename a column in a database view. Updates the column's name in the view schema. Use get_database_schema first to find the column key.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      columnKey: z.string().describe("The column key to rename (8-char opaque string)"),
      newName: z.string().describe("New name for the column"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, columnKey, newName, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.renameColumn(dashboardId, viewId, columnKey, newName);
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
    "reorder_database_columns",
    "Reorder columns in a database view. Provide an array of column keys in the desired order. Columns not in the array are appended at the end. Use get_database_schema first to see current column keys and order.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      orderedKeys: z.array(z.string()).describe("Column keys in desired order"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    }, async ({ dashboardId, viewId, orderedKeys, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.reorderColumns(dashboardId, viewId, orderedKeys);
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
    "update_database_cell",
    "Set the value of a specific cell in a database row. Use get_database_rows or get_database_data first to obtain the rowUuid and the column key (short opaque string like 'eoZSNDPy'). The get_database_rows tool returns a schema array mapping column names to keys for easy lookup. Note: rich-text (Description), file, and relation columns may not accept plain string values.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      rowUuid: z.string().describe("Row UUID (from get_database_rows or get_database_data response)"),
      columnKey: z.string().describe("Column key — the short opaque ID for the column (e.g. 'eoZSNDPy'), found in schema returned by get_database_rows"),
      value: z.any().describe("New cell value (string, number, boolean, array, or object depending on column type)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, rowUuid, columnKey, value, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.updateDatabaseCell(dashboardId, viewId, rowUuid, columnKey, value);
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
    "get_database_rows",
    "Get rows from a database view in a structured format optimised for agent use. Each row includes: rowUuid (needed for update_database_cell), cells (raw column key → value map), and namedCells (human-readable column name → value map). Wraps get_database_data with friendly field names and schema reflection.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      page: z.number().optional().describe("Page number (default 1)"),
      limit: z.number().optional().describe("Rows per page (default 50)"),
      resolveNames: z.boolean().optional().describe("Whether to resolve opaque column keys to display names in namedCells (default: true)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, page, limit, resolveNames, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.getDatabaseRows(dashboardId, viewId, { page, limit, resolveNames });
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
    "get_database_schema",
    "Get the column schema for a database view. Returns an array of column definitions with key (opaque 8-char ID, needed for update_database_cell), name (human-readable), type (string, number, date, label, checkbox, etc.), and edit settings. Use this to understand a database's structure before reading or writing cells.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.getViewSchema(dashboardId, viewId);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result.columns, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "add_database_column",
    "Add a new column to a database view. Supported types: string (single-line text), multiline (multi-line text), number, date, label/status/select (with optional custom labels and colors), checkbox/boolean, email, phone, link/url, currency, files, user/assignee (assign org members), subtable/child-table-link (nested table). For relation columns use add_relation_column, for lookup columns use add_lookup_column. Returns the new column's key which is needed for update_database_cell. Use get_database_schema to verify the column was added.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      name: z.string().describe("Human-readable column name (e.g. 'Priority', 'Email Address')"),
      columnType: z.string().describe("Column type: string, multiline, number, date, label, status, select, checkbox, boolean, email, phone, link, url, currency, files, user, assignee, subtable"),
      labels: z.array(z.object({
        name: z.string().describe("Label text"),
        color: z.string().describe("Label color (gray, purple, green, blue, red, yellow, orange, pink)"),
      })).optional().describe("Custom label options (only for label/status/select type). Defaults to Option 1/2/3."),
      multiSelect: z.boolean().optional().describe("Allow multiple selections (for label/status/select and user/assignee types). Defaults to false."),
      description: z.string().optional().describe("Column description (defaults to 'A custom {type} field')"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, name, columnType, labels, multiSelect, description, profile }) => {
      const client = getClient(profile);
      try {
        const result: any = await client.addDatabaseColumn(dashboardId, viewId, name, columnType, { labels, multiSelect, description });
        const columnKey = result?.column?.key;
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ columnKey, key: columnKey, ...result }, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "delete_database_column",
    "[DESTRUCTIVE] Delete a column from a database view by its key. Use get_database_schema first to find the column key. This removes the column definition from the schema — existing cell data for that column key will no longer be visible. This action cannot be undone.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      columnKey: z.string().describe("Column key to delete (8-char opaque ID from get_database_schema)"),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, columnKey, profile }) => {
      const client = getClient(profile);
      try {
        const result = await client.deleteDatabaseColumn(dashboardId, viewId, columnKey);
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
    "add_relation_column",
    "Add a Relation column that links this database to another database table. This creates a cross-database relation (via POST /relations) and adds a lookup-source column. The column shows linked records from the target table. Use get_database_schema on the target table first to get its dashboardId and viewId.",
    {
      dashboardId: z.string().describe("Source dashboard (table) ID"),
      viewId: z.string().describe("Source view ID"),
      name: z.string().describe("Column name (e.g. 'Related Tasks', 'Linked Projects')"),
      targetDashboardId: z.string().describe("Target dashboard (table) ID to link to"),
      targetViewId: z.string().describe("Target view ID to link to"),
      relationType: z.enum(["many_to_many", "one_to_many", "many_to_one"]).optional().describe("Relation type. Defaults to many_to_many."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, name, targetDashboardId, targetViewId, relationType, profile }) => {
      const client = getClient(profile);
      try {
        const result: any = await client.addRelationColumn(dashboardId, viewId, name, targetDashboardId, targetViewId, { relationType: relationType as any });
        const columnKey = result?.column?.key;
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ columnKey, key: columnKey, ...result }, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAnnotatedTool(server,
    "add_lookup_column",
    "Add a Lookup column that displays data from a related table through an existing Relation column. The lookup column is read-only and automatically pulls data from the linked records. You must have an existing relation column first (created via add_relation_column). Use get_database_schema to find the relation column key.",
    {
      dashboardId: z.string().describe("Dashboard (table) ID"),
      viewId: z.string().describe("View ID"),
      name: z.string().describe("Column name (e.g. 'Project Name', 'Task Status')"),
      relationColumnKey: z.string().describe("Key of the existing relation column to look through (8-char ID from get_database_schema)"),
      lookupFieldKey: z.string().optional().describe("Key of the field in the related table to display. If omitted, defaults to the first text column (usually Name)."),
      profile: z.string().optional().describe("Agent profile to use for authentication"),
    },
    async ({ dashboardId, viewId, name, relationColumnKey, lookupFieldKey, profile }) => {
      const client = getClient(profile);
      try {
        const result: any = await client.addLookupColumn(dashboardId, viewId, name, relationColumnKey, lookupFieldKey);
        const columnKey = result?.column?.key;
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ columnKey, key: columnKey, ...result }, null, 2) },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  );


}
