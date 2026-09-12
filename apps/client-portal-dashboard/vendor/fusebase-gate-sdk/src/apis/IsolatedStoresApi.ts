/**
 * IsolatedStores API
 *
 * Generated from contract introspection
 * Domain: isolated-stores
 */

import type { Client } from "../runtime/transport";
import type {
  AdoptIsolatedStoreSqlMigrationBaselineRequestContract,
  AdoptIsolatedStoreSqlMigrationBaselineResponseContract,
  ApplyIsolatedStoreSqlMigrationsRequestContract,
  ApplyIsolatedStoreSqlMigrationsResponseContract,
  AttachIsolatedStoreSourceScopeRequestContract,
  AttachIsolatedStoreSourceScopeResponseContract,
  CreateIsolatedStoreCheckpointRequestContract,
  CreateIsolatedStoreCheckpointResponseContract,
  CreateIsolatedStoreRequestContract,
  CreateIsolatedStoreResponseContract,
  DeleteIsolatedStoreResponseContract,
  DeleteIsolatedStoreStageResponseContract,
  GetIsolatedStoreSqlMigrationStatusRequestContract,
  GetOrCreateIsolatedStoreRequestContract,
  GetOrCreateIsolatedStoreResponseContract,
  InitIsolatedStoreStageRequestContract,
  InitIsolatedStoreStageResponseContract,
  IsolatedStoreIdInPathRequired,
  IsolatedStoreListResponseContract,
  IsolatedStoreResponseContract,
  IsolatedStoreRevisionIdInPathRequired,
  IsolatedStoreRevisionListResponseContract,
  IsolatedStoreSqlBatchInsertRequestContract,
  IsolatedStoreSqlBatchInsertResponseContract,
  IsolatedStoreSqlCountRequestContract,
  IsolatedStoreSqlCountResponseContract,
  IsolatedStoreSqlDeleteRequestContract,
  IsolatedStoreSqlDeleteResponseContract,
  IsolatedStoreSqlDescribeTableResponseContract,
  IsolatedStoreSqlExecuteRequestContract,
  IsolatedStoreSqlExecuteResponseContract,
  IsolatedStoreSqlImportRequestContract,
  IsolatedStoreSqlImportResponseContract,
  IsolatedStoreSqlInsertRequestContract,
  IsolatedStoreSqlInsertResponseContract,
  IsolatedStoreSqlListTablesResponseContract,
  IsolatedStoreSqlMigrationStatusContract,
  IsolatedStoreSqlQueryRequestContract,
  IsolatedStoreSqlQueryResponseContract,
  IsolatedStoreSqlRlsStatusResponseContract,
  IsolatedStoreSqlSchemaNameInQueryOptional,
  IsolatedStoreSqlSelectRequestContract,
  IsolatedStoreSqlSelectResponseContract,
  IsolatedStoreSqlStatsResponseContract,
  IsolatedStoreSqlTableNameInPathRequired,
  IsolatedStoreSqlUpdateRequestContract,
  IsolatedStoreSqlUpdateResponseContract,
  IsolatedStoreStageInPathRequired,
  IsolatedStoreStageListResponseContract,
  ListIsolatedStoresAliasLikeInQueryOptional,
  ListIsolatedStoresClientIdInQueryOptional,
  orgIdInPathRequired,
  RepairIsolatedStoreSqlMigrationJournalChecksumsRequestContract,
  RepairIsolatedStoreSqlMigrationJournalChecksumsResponseContract,
  RestoreIsolatedStoreRevisionResponseContract,
} from "../types";

export class IsolatedStoresApi {
  constructor(private client: Client) {}

  /**
   * Adopt existing SQL schema as migration baseline
   * Records the supplied ordered migration bundle as already applied in the stage journal without executing SQL. Use this only for legacy or demo-created stages where schema objects already exist but the migration journal is empty or missing.
   */
  async adoptIsolatedStoreSqlMigrationBaseline(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: AdoptIsolatedStoreSqlMigrationBaselineRequestContract;
  }): Promise<AdoptIsolatedStoreSqlMigrationBaselineResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/migrations/adopt-baseline",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "adoptIsolatedStoreSqlMigrationBaseline",
      expectedContentType: "application/json",
    });
  }

  /**
   * Apply SQL migrations
   * Workflow: call `getIsolatedStoreSqlMigrationStatus` with the **same** bundle, confirm `canApply` and expected `pendingCount`, then apply. Applies pending postgres migrations from an ordered bundle into the selected stage database. For prod, gate creates a checkpoint automatically before applying pending migrations. Applied history must match the bundle prefix exactly; drift returns HTTP 409 with `data.issues` (version/name/checksum, journal vs bundle). Optional `dryRun: true` performs the same prefix + optimistic-lock checks as apply but does not run SQL or write the journal (returns `dryRun: true` and the computed status). Optional `expectedLastAppliedVersion` / `expectedLastAppliedChecksum` reject with HTTP 409 before migrations run when the journal tail changed since the client's last status snapshot. Never change name, checksum, or sql for migrations already in the journal — ship fixes as new higher versions (see MCP prompt isolatedSqlMigrationDiscipline). MCP clients often cap tool_call JSON body size (on the order of a few thousand characters); the request includes full SQL text for every bundle version cumulatively, so large bundles may fail or truncate in chat-only MCP. Keep canonical SQL plus a manifest for apply from SDK, CLI, or any non-MCP caller without a tight body-size limit.
   */
  async applyIsolatedStoreSqlMigrations(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: ApplyIsolatedStoreSqlMigrationsRequestContract;
  }): Promise<ApplyIsolatedStoreSqlMigrationsResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/migrations/apply",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "applyIsolatedStoreSqlMigrations",
      expectedContentType: "application/json",
    });
  }

  /**
   * Attach isolated store source scope
   * Non-destructively grants an additional app source binding to an existing isolated store without changing stages or data. Useful when a store was originally created under an older app id but runtime app tokens need access.
   */
  async attachIsolatedStoreSourceScope(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: AttachIsolatedStoreSourceScopeRequestContract;
  }): Promise<AttachIsolatedStoreSourceScopeResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/source-scopes",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "attachIsolatedStoreSourceScope",
      expectedContentType: "application/json",
    });
  }

  /**
   * Batch insert rows
   * Inserts multiple rows into a postgres table with a shared column set. Row cap per request is floor(65535 / columnCount) (Postgres bind-parameter limit). For very large loads use importIsolatedStoreSqlRows (COPY FROM STDIN).
   */
  async batchInsertIsolatedStoreSqlRows(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: IsolatedStoreSqlBatchInsertRequestContract;
  }): Promise<IsolatedStoreSqlBatchInsertResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/rows/batch-insert",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "batchInsertIsolatedStoreSqlRows",
      expectedContentType: "application/json",
    });
  }

  /**
   * Count rows
   * Counts rows in a postgres table using simple structured filters. Useful for pagination without writing raw SQL.
   */
  async countIsolatedStoreSqlRows(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: IsolatedStoreSqlCountRequestContract;
  }): Promise<IsolatedStoreSqlCountResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/rows/count",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "countIsolatedStoreSqlRows",
      expectedContentType: "application/json",
    });
  }

  /**
   * Count rows with RLS bypass
   * Counts rows in a postgres table through the explicit audited RLS-bypass read path. Intended for Studio/admin data explorer views only; normal runtime reads must use countIsolatedStoreSqlRows.
   */
  async countIsolatedStoreSqlRowsRlsBypass(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: IsolatedStoreSqlCountRequestContract;
  }): Promise<IsolatedStoreSqlCountResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/rows/count/rls-bypass",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "countIsolatedStoreSqlRowsRlsBypass",
      expectedContentType: "application/json",
    });
  }

  /**
   * Create isolated store
   * Registers a low-level store and binds it to the organization scope plus an isolated source scope such as app.
   */
  async createIsolatedStore(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: CreateIsolatedStoreRequestContract;
  }): Promise<CreateIsolatedStoreResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "createIsolatedStore",
      expectedContentType: "application/json",
    });
  }

  /**
   * Create isolated store checkpoint
   * Creates a new revision marker for the selected stage instance. For sql/postgres stages, gate also creates a physical pg_dump snapshot. The resulting provider-backed snapshot reference is stored in snapshotRef; a caller-provided snapshotRef is preserved in revision metadata as an external reference.
   */
  async createIsolatedStoreCheckpoint(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: CreateIsolatedStoreCheckpointRequestContract;
  }): Promise<CreateIsolatedStoreCheckpointResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/checkpoints",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "createIsolatedStoreCheckpoint",
      expectedContentType: "application/json",
    });
  }

  /**
   * Delete isolated store
   * Deletes every stage instance for the store (same behavior as deleteIsolatedStoreStage per stage, including optional drop of auto-provisioned databases), then removes the store registry row and its org/source scope links. Use this to remove the whole store in one call instead of deleting each stage separately.
   */
  async deleteIsolatedStore(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<DeleteIsolatedStoreResponseContract> {
    return this.client.request({
      method: "DELETE",
      path: "/:orgId/isolated-stores/:storeId",
      pathParams: params.path,
      headers: params.headers,
      opId: "deleteIsolatedStore",
      expectedContentType: "application/json",
    });
  }

  /**
   * Delete rows
   * Deletes rows from a postgres table using structured filters. Filterless deletes are blocked unless allowAll=true is explicitly set.
   */
  async deleteIsolatedStoreSqlRows(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: IsolatedStoreSqlDeleteRequestContract;
  }): Promise<IsolatedStoreSqlDeleteResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/rows/delete",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "deleteIsolatedStoreSqlRows",
      expectedContentType: "application/json",
    });
  }

  /**
   * Delete isolated store stage
   * Removes the stage instance and its revisions. When the stage was auto-provisioned on the isolated Postgres server, gate also drops the provisioned database after registry rows are removed. After deletion the stage no longer appears in listIsolatedStoreStages; recreate it with initIsolatedStoreStage using the same stage name.
   */
  async deleteIsolatedStoreStage(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<DeleteIsolatedStoreStageResponseContract> {
    return this.client.request({
      method: "DELETE",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage",
      pathParams: params.path,
      headers: params.headers,
      opId: "deleteIsolatedStoreStage",
      expectedContentType: "application/json",
    });
  }

  /**
   * Describe isolated store SQL table
   * Returns postgres column metadata for a single table in the selected isolated store stage instance.
   */
  async describeIsolatedStoreSqlTable(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
      tableName: IsolatedStoreSqlTableNameInPathRequired;
    };
    query?: {
      schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
    };
    headers?: Record<string, string>;
  }): Promise<IsolatedStoreSqlDescribeTableResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/tables/:tableName",
      pathParams: params.path,
      query: params.query,
      headers: params.headers,
      opId: "describeIsolatedStoreSqlTable",
      expectedContentType: "application/json",
    });
  }

  /**
   * Download isolated store revision snapshot
   * Streams the stored physical snapshot artifact for the selected isolated store revision. This is an operator-facing download path for backup extraction and works through gate regardless of whether the snapshot provider is local_file or azure_blob.
   */
  async downloadIsolatedStoreRevisionSnapshot(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
      revisionId: IsolatedStoreRevisionIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<ArrayBuffer> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/revisions/:revisionId/download",
      pathParams: params.path,
      headers: params.headers,
      opId: "downloadIsolatedStoreRevisionSnapshot",
      expectedContentType: "application/octet-stream",
    });
  }

  /**
   * Run writable SQL statement
   * Runs a single raw DML statement with execute access against the postgres binding of the selected isolated store stage instance. Only INSERT, UPDATE, and DELETE are allowed on this privileged escape hatch. DDL and schema changes are blocked here and must go through applyIsolatedStoreSqlMigrations so the stage migration journal (fusebase_schema_migrations) stays authoritative.
   */
  async executeIsolatedStoreSql(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: IsolatedStoreSqlExecuteRequestContract;
  }): Promise<IsolatedStoreSqlExecuteResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/execute",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "executeIsolatedStoreSql",
      expectedContentType: "application/json",
    });
  }

  /**
   * Get isolated store
   * Returns a single isolated store by store global id within the organization scope.
   */
  async getIsolatedStore(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<IsolatedStoreResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/isolated-stores/:storeId",
      pathParams: params.path,
      headers: params.headers,
      opId: "getIsolatedStore",
      expectedContentType: "application/json",
    });
  }

  /**
   * Get SQL migration status
   * Compares an ordered SQL migration bundle with the migration journal stored inside the selected postgres stage database. Returns applied migrations, pending migrations, drift issues when the applied history no longer matches the bundle prefix, and `canApply` / `structuredIssues` for automation. Prefer calling this immediately before `applyIsolatedStoreSqlMigrations` with the same bundle. Optional request fields `expectedLastAppliedVersion` / `expectedLastAppliedChecksum` (same semantics as apply) reject with HTTP 409 when the live journal tail disagrees — useful as a cheap preflight without sending `dryRun` on apply. Load MCP prompt isolatedSqlMigrationDiscipline (required with isolatedSql/isolated groups) before interpreting drift — do not edit applied migration metadata or the journal to force a match.
   */
  async getIsolatedStoreSqlMigrationStatus(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: GetIsolatedStoreSqlMigrationStatusRequestContract;
  }): Promise<IsolatedStoreSqlMigrationStatusContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/migrations/status",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "getIsolatedStoreSqlMigrationStatus",
      expectedContentType: "application/json",
    });
  }

  /**
   * Get SQL RLS status
   * Returns read-only PostgreSQL row-level security introspection for the selected isolated store stage: table RLS flags, FORCE RLS flags, policies, columns, indexes, and table-level warnings. This is intended for Studio/support visibility; policy changes must still flow through app migrations.
   */
  async getIsolatedStoreSqlRlsStatus(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    query?: {
      schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
    };
    headers?: Record<string, string>;
  }): Promise<IsolatedStoreSqlRlsStatusResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/rls/status",
      pathParams: params.path,
      query: params.query,
      headers: params.headers,
      opId: "getIsolatedStoreSqlRlsStatus",
      expectedContentType: "application/json",
    });
  }

  /**
   * Get SQL stats
   * Returns table-level stats for the selected isolated postgres stage, including tables, columns, row counts, and relation-size hints.
   */
  async getIsolatedStoreSqlStats(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<IsolatedStoreSqlStatsResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/stats",
      pathParams: params.path,
      headers: params.headers,
      opId: "getIsolatedStoreSqlStats",
      expectedContentType: "application/json",
    });
  }

  /**
   * Get or create isolated store
   * Idempotent control-plane operation for app-owned stores. Resolves an existing store by org/client/alias or creates it. Optionally bootstraps target stage from a source org store/stage using checkpoint/restore.
   */
  async getOrCreateIsolatedStore(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: GetOrCreateIsolatedStoreRequestContract;
  }): Promise<GetOrCreateIsolatedStoreResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/get-or-create",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "getOrCreateIsolatedStore",
      expectedContentType: "application/json",
    });
  }

  /**
   * Import CSV or TSV rows
   * Imports CSV or TSV payloads into a postgres table using server-side COPY FROM STDIN. Use this bulk path for large seeds or migrations instead of repeated row inserts. Max UTF-8 payload size defaults to 64MiB (override ISOLATED_SQL_IMPORT_MAX_PAYLOAD_BYTES; hard cap 256MiB); split larger files across multiple calls.
   */
  async importIsolatedStoreSqlRows(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: IsolatedStoreSqlImportRequestContract;
  }): Promise<IsolatedStoreSqlImportResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/rows/import",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "importIsolatedStoreSqlRows",
      expectedContentType: "application/json",
    });
  }

  /**
   * Initialize isolated store stage
   * Creates a stage instance. For postgres, gate can auto-provision a dedicated stage database when the isolated server is configured; otherwise an explicit bindingConfig is required.
   */
  async initIsolatedStoreStage(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: InitIsolatedStoreStageRequestContract;
  }): Promise<InitIsolatedStoreStageResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "initIsolatedStoreStage",
      expectedContentType: "application/json",
    });
  }

  /**
   * Insert row
   * Inserts a single row into a postgres table and optionally returns selected columns.
   */
  async insertIsolatedStoreSqlRow(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: IsolatedStoreSqlInsertRequestContract;
  }): Promise<IsolatedStoreSqlInsertResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/rows/insert",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "insertIsolatedStoreSqlRow",
      expectedContentType: "application/json",
    });
  }

  /**
   * List isolated store revisions
   * Returns version checkpoints for a specific isolated store stage instance.
   */
  async listIsolatedStoreRevisions(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<IsolatedStoreRevisionListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/revisions",
      pathParams: params.path,
      headers: params.headers,
      opId: "listIsolatedStoreRevisions",
      expectedContentType: "application/json",
    });
  }

  /**
   * List isolated stores
   * Returns the isolated store registry for the organization. Optional query `clientId` limits results to stores whose `app` source scope `sourceId` matches (same identifier as the token `client` scope for app-owned stores). Optional query `aliasLike` supports either an exact alias or a glob pattern (`*`, `?`) against store alias. Omit or leave empty to list all org stores. This is a control-plane endpoint behind FEATURE_FLAGS=isolated_stores.
   */
  async listIsolatedStores(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    query?: {
      clientId?: ListIsolatedStoresClientIdInQueryOptional;
      aliasLike?: ListIsolatedStoresAliasLikeInQueryOptional;
    };
    headers?: Record<string, string>;
  }): Promise<IsolatedStoreListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/isolated-stores",
      pathParams: params.path,
      query: params.query,
      headers: params.headers,
      opId: "listIsolatedStores",
      expectedContentType: "application/json",
    });
  }

  /**
   * List isolated store SQL tables
   * Returns postgres tables and views for the requested isolated store stage instance. Token access must include the matching isolated_store_stage_instance resource scope.
   */
  async listIsolatedStoreSqlTables(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    query?: {
      schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
    };
    headers?: Record<string, string>;
  }): Promise<IsolatedStoreSqlListTablesResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/tables",
      pathParams: params.path,
      query: params.query,
      headers: params.headers,
      opId: "listIsolatedStoreSqlTables",
      expectedContentType: "application/json",
    });
  }

  /**
   * List isolated store stages
   * Returns stage instances for the selected isolated store. MVP uses separate stage instances for dev and prod.
   */
  async listIsolatedStoreStages(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<IsolatedStoreStageListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/isolated-stores/:storeId/stages",
      pathParams: params.path,
      headers: params.headers,
      opId: "listIsolatedStoreStages",
      expectedContentType: "application/json",
    });
  }

  /**
   * Run read-only SQL query
   * Runs a single read-only SQL statement against the postgres binding of the selected isolated store stage instance.
   */
  async queryIsolatedStoreSql(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: IsolatedStoreSqlQueryRequestContract;
  }): Promise<IsolatedStoreSqlQueryResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/query",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "queryIsolatedStoreSql",
      expectedContentType: "application/json",
    });
  }

  /**
   * Repair migration journal checksums
   * Operator repair path for historical checksum algorithm lock-in. Validates the submitted bundle with the current canonical SQL rules, then rewrites only checksum values for the already-applied journal prefix when version/name/order already match and the only drift is checksum mismatch.
   */
  async repairIsolatedStoreSqlMigrationJournalChecksums(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: RepairIsolatedStoreSqlMigrationJournalChecksumsRequestContract;
  }): Promise<RepairIsolatedStoreSqlMigrationJournalChecksumsResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/migrations/repair-checksums",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "repairIsolatedStoreSqlMigrationJournalChecksums",
      expectedContentType: "application/json",
    });
  }

  /**
   * Restore isolated store revision
   * Restores a sql/postgres stage from a previously created physical snapshot. For auto-provisioned dedicated stage databases, gate recreates the target database before running pg_restore. Restorable snapshotRef values depend on the configured snapshot storage provider; gate currently supports file:// and azure-blob:// refs.
   */
  async restoreIsolatedStoreRevision(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
      revisionId: IsolatedStoreRevisionIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<RestoreIsolatedStoreRevisionResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/revisions/:revisionId/restore",
      pathParams: params.path,
      headers: params.headers,
      opId: "restoreIsolatedStoreRevision",
      expectedContentType: "application/json",
    });
  }

  /**
   * Select rows
   * Reads rows from a postgres table using simple filters, sort, limit and offset. This is the primary low-overhead runtime read surface.
   */
  async selectIsolatedStoreSqlRows(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: IsolatedStoreSqlSelectRequestContract;
  }): Promise<IsolatedStoreSqlSelectResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/rows/select",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "selectIsolatedStoreSqlRows",
      expectedContentType: "application/json",
    });
  }

  /**
   * Select rows with RLS bypass
   * Reads rows through the explicit audited RLS-bypass read path. Intended for Studio/admin data explorer views only; normal runtime reads must use selectIsolatedStoreSqlRows.
   */
  async selectIsolatedStoreSqlRowsRlsBypass(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: IsolatedStoreSqlSelectRequestContract;
  }): Promise<IsolatedStoreSqlSelectResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/rows/select/rls-bypass",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "selectIsolatedStoreSqlRowsRlsBypass",
      expectedContentType: "application/json",
    });
  }

  /**
   * Update rows
   * Updates rows in a postgres table using structured filters. Filterless updates are blocked unless allowAll=true is explicitly set.
   */
  async updateIsolatedStoreSqlRows(params: {
    path: {
      orgId: orgIdInPathRequired;
      storeId: IsolatedStoreIdInPathRequired;
      stage: IsolatedStoreStageInPathRequired;
    };
    headers?: Record<string, string>;
    body: IsolatedStoreSqlUpdateRequestContract;
  }): Promise<IsolatedStoreSqlUpdateResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/isolated-stores/:storeId/stages/:stage/sql/rows/update",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "updateIsolatedStoreSqlRows",
      expectedContentType: "application/json",
    });
  }
}
