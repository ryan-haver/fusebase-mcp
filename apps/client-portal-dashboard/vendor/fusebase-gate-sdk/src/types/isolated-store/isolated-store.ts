export type IsolatedStoreIdInPathRequired = string;
export type IsolatedStoreStageInPathRequired = "dev" | "prod";
export type IsolatedStoreRevisionIdInPathRequired = string;
export type IsolatedStoreSqlTableNameInPathRequired = string;
export type IsolatedStoreTypeContract = "sql";
export type IsolatedStoreEngineContract = "postgres";
export type IsolatedStoreStatusContract = "active" | "disabled";
export type IsolatedStoreStageStatusContract =
  | "provisioning"
  | "ready"
  | "failed"
  | "disabled";
export type IsolatedStoreRevisionKindContract = "checkpoint" | "promotion";
export type IsolatedStoreScopeTypeContract =
  | "org"
  | "workspace"
  | "portal"
  | "user"
  | "client"
  | "block"
  | "tracker"
  | "parent_row"
  | "parent_table";

export interface IsolatedStoreScopeContract {
  scopeType: IsolatedStoreScopeTypeContract;
  scopeId: string;
}

export interface IsolatedStoreSourceScopeContract {
  sourceType: string;
  sourceId: string;
}

export interface IsolatedStoreContract {
  globalId: string;
  alias: string;
  storeType: IsolatedStoreTypeContract;
  engine: IsolatedStoreEngineContract;
  status: IsolatedStoreStatusContract;
  scopes: IsolatedStoreScopeContract[];
  sourceScopes: IsolatedStoreSourceScopeContract[];
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/** Connection binding for a SQL/postgres isolated store stage (control plane + MCP). */
export interface IsolatedStorePostgresBindingConfigContract {
  connectionMode?: "raw" | "server";
  serverKey?: string;
  host?: string;
  port?: number | null;
  database: string;
  username?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  schema?: string;
}

export type IsolatedStoreBindingConfigContract =
  IsolatedStorePostgresBindingConfigContract;

export interface IsolatedStoreStageInstanceContract {
  globalId: string;
  storeGlobalId: string;
  stage: IsolatedStoreStageInPathRequired;
  status: IsolatedStoreStageStatusContract;
  bindingConfig?: IsolatedStoreBindingConfigContract | null;
  provisioningMetadata?: Record<string, unknown> | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface IsolatedStoreRevisionContract {
  globalId: string;
  storeGlobalId: string;
  stage: IsolatedStoreStageInPathRequired;
  revisionNumber: number;
  kind: IsolatedStoreRevisionKindContract;
  label?: string | null;
  snapshotRef?: string | null;
  metadata?: Record<string, unknown> | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export type IsolatedStoreSqlSchemaNameInQueryOptional = string | null;

export interface IsolatedStoreSqlListTablesQueryContract {
  schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
}

export interface IsolatedStoreSqlDescribeTableQueryContract {
  schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
}

export interface IsolatedStoreSqlTableContract {
  schemaName: string;
  tableName: string;
  tableType: string;
}

export interface IsolatedStoreSqlColumnContract {
  columnName: string;
  dataType: string;
  udtName?: string | null;
  isNullable: boolean;
  defaultValue?: string | null;
  ordinalPosition: number;
}

export interface IsolatedStoreSqlTableDescriptionContract {
  schemaName: string;
  tableName: string;
  columns: IsolatedStoreSqlColumnContract[];
}

export interface IsolatedStoreSqlTableStatsContract {
  schemaName: string;
  tableName: string;
  tableType: string;
  rowCount: number;
  totalBytes?: number | null;
  columns: IsolatedStoreSqlColumnContract[];
}

export interface IsolatedStoreSqlStatsResponseContract {
  databaseName: string;
  schemaName: string;
  tableCount: number;
  totalRowCount: number;
  totalBytes?: number | null;
  tables: IsolatedStoreSqlTableStatsContract[];
}

export type IsolatedStoreSqlRlsWarningCodeContract =
  | "rls_not_enabled"
  | "rls_not_forced"
  | "rls_enabled_without_policies";

export interface IsolatedStoreSqlRlsWarningContract {
  code: IsolatedStoreSqlRlsWarningCodeContract;
  message: string;
}

export interface IsolatedStoreSqlRlsPolicyContract {
  policyName: string;
  command: string;
  roles: string[];
  usingExpression?: string | null;
  withCheckExpression?: string | null;
}

export interface IsolatedStoreSqlRlsIndexContract {
  indexName: string;
  isUnique: boolean;
  columnNames: string[];
  indexDefinition: string;
}

export interface IsolatedStoreSqlRlsTableStatusContract {
  schemaName: string;
  tableName: string;
  tableType: string;
  rlsEnabled: boolean;
  rlsForced: boolean;
  columns: IsolatedStoreSqlColumnContract[];
  indexes: IsolatedStoreSqlRlsIndexContract[];
  policies: IsolatedStoreSqlRlsPolicyContract[];
  warnings: IsolatedStoreSqlRlsWarningContract[];
}

export interface IsolatedStoreSqlRlsStatusResponseContract {
  databaseName: string;
  schemaName: string;
  currentUser: string;
  bypassRls: boolean;
  superuser: boolean;
  tableCount: number;
  rlsEnabledCount: number;
  rlsForcedCount: number;
  tables: IsolatedStoreSqlRlsTableStatusContract[];
}

export type IsolatedStoreSqlRlsTableClassificationContract =
  | "tenant"
  | "user"
  | "owner_collaborator"
  | "scoped"
  | "none"
  | "technical";

export interface IsolatedStoreSqlRlsScopeManifestContract {
  name: string;
  column: string;
  setting?: string | null;
}

export interface IsolatedStoreSqlRlsTableManifestContract {
  classification: IsolatedStoreSqlRlsTableClassificationContract;
  schemaName?: string | null;
  orgColumn?: string | null;
  userColumn?: string | null;
  ownerColumn?: string | null;
  collaboratorTable?: string | null;
  scopes?: IsolatedStoreSqlRlsScopeManifestContract[] | null;
  reason?: string | null;
}

export interface IsolatedStoreSqlRlsManifestContract {
  tables: Record<string, IsolatedStoreSqlRlsTableManifestContract>;
}

export type IsolatedStoreSqlRlsValidationWarningCodeContract =
  | "rls_manifest_table_missing"
  | "rls_manifest_column_missing"
  | "rls_manifest_index_missing"
  | "rls_manifest_policy_missing"
  | "rls_manifest_rls_not_enabled"
  | "rls_manifest_rls_not_forced"
  | "rls_manifest_exemption_reason_missing"
  | "rls_manifest_collaborator_table_missing";

export interface IsolatedStoreSqlRlsValidationWarningContract {
  code: IsolatedStoreSqlRlsValidationWarningCodeContract;
  message: string;
  tableName: string;
  schemaName?: string | null;
  columnName?: string | null;
}

export interface IsolatedStoreSqlRlsValidationResultContract {
  mode: "warn";
  tableCount: number;
  warningCount: number;
  warnings: IsolatedStoreSqlRlsValidationWarningContract[];
}

export interface IsolatedStoreSqlMigrationBundleEntryContract {
  version: number;
  name: string;
  checksum: string;
  sql: string;
}

export interface IsolatedStoreSqlMigrationBundleContract {
  bundleVersion?: string | null;
  migrations: IsolatedStoreSqlMigrationBundleEntryContract[];
}

export interface IsolatedStoreSqlAppliedMigrationContract {
  version: number;
  name: string;
  checksum: string;
  bundleVersion?: string | null;
  appliedAt: string;
  appliedBy: string;
}

export type IsolatedStoreSqlMigrationIssueCodeContract =
  | "isolated_sql_journal_longer_than_bundle"
  | "isolated_sql_version_mismatch"
  | "isolated_sql_name_mismatch"
  | "isolated_sql_checksum_mismatch"
  | "isolated_sql_schema_exists_without_journal"
  | "isolated_sql_journal_head_mismatch";

export type IsolatedStoreSqlMigrationIssueFieldContract =
  | "history_length"
  | "version"
  | "name"
  | "checksum"
  | "bootstrap"
  | "journal_head";

/** Machine-readable drift detail; omits raw SQL (only safe fingerprints). */
export interface IsolatedStoreSqlMigrationIssueContract {
  code: IsolatedStoreSqlMigrationIssueCodeContract;
  message: string;
  /** Bundle migration version at the comparison index when relevant. */
  version?: number | null;
  field?: IsolatedStoreSqlMigrationIssueFieldContract;
  /** Value from the migration journal (applied history). */
  expected?: string | number | null;
  /** Value from the submitted bundle. */
  actual?: string | number | null;
  journal?: {
    version: number;
    name: string;
    checksum: string;
  } | null;
  bundle?: {
    version: number;
    name: string;
    checksum: string;
  } | null;
  /** SHA-256 of the bundle entry SQL UTF-8 bytes (diagnostic; not raw SQL). */
  bundleSqlContentSha256?: string | null;
  /** Set when `expectedLastApplied*` optimistic locks fail (apply/status preflight). */
  expectedLastAppliedVersion?: number | null;
  actualLastAppliedVersion?: number | null;
  expectedLastAppliedChecksum?: string | null;
  actualLastAppliedChecksum?: string | null;
}

export interface IsolatedStoreSqlMigrationStatusContract {
  databaseName: string;
  schemaName: string;
  journalTableName: string;
  currentVersion?: number | null;
  bundleHeadVersion?: number | null;
  appliedCount: number;
  pendingCount: number;
  isDrifted: boolean;
  /** True when the stage already has schema objects but no matching journaled migration history. */
  requiresBaselineAdoption: boolean;
  /** True when the bundle prefix matches the journal and pending migrations may run. */
  canApply: boolean;
  issues: string[];
  structuredIssues: IsolatedStoreSqlMigrationIssueContract[];
  appliedMigrations: IsolatedStoreSqlAppliedMigrationContract[];
  pendingMigrations: IsolatedStoreSqlMigrationBundleEntryContract[];
  rlsValidation?: IsolatedStoreSqlRlsValidationResultContract | null;
}

export interface GetIsolatedStoreSqlMigrationStatusRequestContract {
  schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
  bundle: IsolatedStoreSqlMigrationBundleContract;
  rlsManifest?: IsolatedStoreSqlRlsManifestContract | null;
  /** Same optimistic-lock semantics as `applyIsolatedStoreSqlMigrations`; HTTP 409 when the journal tail disagrees. */
  expectedLastAppliedVersion?: number | null;
  expectedLastAppliedChecksum?: string | null;
}

export interface ApplyIsolatedStoreSqlMigrationsRequestContract {
  schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
  bundle: IsolatedStoreSqlMigrationBundleContract;
  /**
   * When true, runs the same journal/bundle prefix checks as apply (including optional
   * expected-head validation) but does not execute SQL or write the journal.
   */
  dryRun?: boolean | null;
  /** Optional warn-only RLS manifest validation for current/post-apply database state. */
  rlsManifest?: IsolatedStoreSqlRlsManifestContract | null;
  /**
   * Optimistic lock: last applied migration version on the server must match.
   * Omit to skip. Use `null` to require an empty journal (no rows applied).
   */
  expectedLastAppliedVersion?: number | null;
  /**
   * Optimistic lock: checksum of the last applied journal row must match.
   * Omit to skip. Use `null` only together with an empty journal expectation.
   */
  expectedLastAppliedChecksum?: string | null;
}

export interface ApplyIsolatedStoreSqlMigrationsResponseContract {
  appliedCount: number;
  appliedVersions: number[];
  checkpointRevision?: IsolatedStoreRevisionContract | null;
  status: IsolatedStoreSqlMigrationStatusContract;
  /** Present and true when the request used `dryRun` and no migrations were executed. */
  dryRun?: boolean | null;
}

export interface AdoptIsolatedStoreSqlMigrationBaselineRequestContract {
  schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
  bundle: IsolatedStoreSqlMigrationBundleContract;
  rlsManifest?: IsolatedStoreSqlRlsManifestContract | null;
  /** Validate eligibility and return the projected post-adoption status without writing the journal. */
  dryRun?: boolean | null;
}

export interface AdoptIsolatedStoreSqlMigrationBaselineResponseContract {
  adoptedCount: number;
  adoptedVersions: number[];
  checkpointRevision?: IsolatedStoreRevisionContract | null;
  status: IsolatedStoreSqlMigrationStatusContract;
  dryRun?: boolean | null;
}

export interface RepairIsolatedStoreSqlMigrationJournalChecksumsRequestContract {
  schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
  bundle: IsolatedStoreSqlMigrationBundleContract;
  /** Validate eligibility and return the projected post-repair status without writing the journal. */
  dryRun?: boolean | null;
  /** Same optimistic-lock semantics as `applyIsolatedStoreSqlMigrations`; HTTP 409 when the journal tail disagrees. */
  expectedLastAppliedVersion?: number | null;
  expectedLastAppliedChecksum?: string | null;
}

export interface RepairIsolatedStoreSqlMigrationJournalChecksumsResponseContract {
  repairedCount: number;
  repairedVersions: number[];
  status: IsolatedStoreSqlMigrationStatusContract;
  dryRun?: boolean | null;
}

/** Documented shape of JSON error responses for migration state conflicts (HTTP 409). */
export interface IsolatedStoreSqlMigrationConflictErrorBodyContract {
  success: false;
  message: string;
  data: {
    code: string;
    errorCode: string;
    issues?: IsolatedStoreSqlMigrationIssueContract[];
  };
}

export interface IsolatedStoreSqlListTablesResponseContract {
  tables: IsolatedStoreSqlTableContract[];
}

export interface IsolatedStoreSqlDescribeTableResponseContract {
  table: IsolatedStoreSqlTableDescriptionContract;
}

export interface IsolatedStoreSqlQueryRequestContract {
  sql: string;
  params?: unknown[] | null;
  rlsContext?: IsolatedStoreSqlRlsContextContract | null;
  trustedRuntimeContext?: IsolatedStoreSqlTrustedRuntimeContextContract | null;
}

export interface IsolatedStoreSqlQueryResultContract {
  command: string;
  rowCount: number;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface IsolatedStoreSqlQueryResponseContract {
  result: IsolatedStoreSqlQueryResultContract;
}

export interface IsolatedStoreSqlExecuteRequestContract {
  sql: string;
  params?: unknown[] | null;
  rlsContext?: IsolatedStoreSqlRlsContextContract | null;
  trustedRuntimeContext?: IsolatedStoreSqlTrustedRuntimeContextContract | null;
}

export type IsolatedStoreSqlRlsContextValueContract =
  | string
  | number
  | boolean
  | null;

export type IsolatedStoreSqlRlsContextContract = Record<
  string,
  IsolatedStoreSqlRlsContextValueContract
>;

export interface IsolatedStoreSqlTrustedRuntimeContextContract {
  /**
   * Trusted delegated portal context for backend/operator paths.
   * Requires `isolated_store.rls.delegate`; callers cannot set this through `rlsContext`.
   */
  portalId?: string | null;
  /**
   * Trusted delegated workspace context for backend/operator paths.
   * Requires `isolated_store.rls.delegate`; callers cannot set this through `rlsContext`.
   */
  workspaceId?: string | null;
}

export interface IsolatedStoreSqlExecuteResponseContract {
  result: IsolatedStoreSqlQueryResultContract;
}

export type IsolatedStoreSqlFilterOperatorContract =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "in"
  | "is_null"
  | "is_not_null";

export type IsolatedStoreSqlSortDirectionContract = "asc" | "desc";

export interface IsolatedStoreSqlFilterContract {
  column: string;
  operator: IsolatedStoreSqlFilterOperatorContract;
  value?: unknown;
}

export interface IsolatedStoreSqlSortContract {
  column: string;
  direction?: IsolatedStoreSqlSortDirectionContract;
}

export interface IsolatedStoreSqlCountRequestContract {
  schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
  tableName: string;
  filters?: IsolatedStoreSqlFilterContract[] | null;
  rlsContext?: IsolatedStoreSqlRlsContextContract | null;
  trustedRuntimeContext?: IsolatedStoreSqlTrustedRuntimeContextContract | null;
}

export interface IsolatedStoreSqlCountResponseContract {
  count: number;
}

export interface IsolatedStoreSqlSelectRequestContract {
  schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
  tableName: string;
  columns?: string[] | null;
  filters?: IsolatedStoreSqlFilterContract[] | null;
  sort?: IsolatedStoreSqlSortContract[] | null;
  limit?: number | null;
  offset?: number | null;
  rlsContext?: IsolatedStoreSqlRlsContextContract | null;
  trustedRuntimeContext?: IsolatedStoreSqlTrustedRuntimeContextContract | null;
}

export interface IsolatedStoreSqlSelectResponseContract {
  columns: string[];
  rows: Record<string, unknown>[];
  page: {
    limit: number;
    offset: number;
    rowCount: number;
  };
}

export interface IsolatedStoreSqlInsertRequestContract {
  schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
  tableName: string;
  values: Record<string, unknown>;
  returning?: string[] | null;
  rlsContext?: IsolatedStoreSqlRlsContextContract | null;
  trustedRuntimeContext?: IsolatedStoreSqlTrustedRuntimeContextContract | null;
}

export interface IsolatedStoreSqlInsertResponseContract {
  rowCount: number;
  rows: Record<string, unknown>[];
}

export interface IsolatedStoreSqlBatchInsertRequestContract {
  schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
  tableName: string;
  rows: Record<string, unknown>[];
  returning?: string[] | null;
  rlsContext?: IsolatedStoreSqlRlsContextContract | null;
  trustedRuntimeContext?: IsolatedStoreSqlTrustedRuntimeContextContract | null;
}

export interface IsolatedStoreSqlBatchInsertResponseContract {
  rowCount: number;
  rows: Record<string, unknown>[];
}

export type IsolatedStoreSqlImportFormatContract = "csv" | "tsv";

export interface IsolatedStoreSqlImportRequestContract {
  schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
  tableName: string;
  format: IsolatedStoreSqlImportFormatContract;
  data: string;
  columns?: string[] | null;
  hasHeader?: boolean | null;
  nullString?: string | null;
  rlsContext?: IsolatedStoreSqlRlsContextContract | null;
  trustedRuntimeContext?: IsolatedStoreSqlTrustedRuntimeContextContract | null;
}

export interface IsolatedStoreSqlImportResponseContract {
  imported: true;
  tableName: string;
  format: IsolatedStoreSqlImportFormatContract;
  rowCount: number;
}

export interface IsolatedStoreSqlUpdateRequestContract {
  schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
  tableName: string;
  values: Record<string, unknown>;
  filters?: IsolatedStoreSqlFilterContract[] | null;
  allowAll?: boolean | null;
  returning?: string[] | null;
  rlsContext?: IsolatedStoreSqlRlsContextContract | null;
  trustedRuntimeContext?: IsolatedStoreSqlTrustedRuntimeContextContract | null;
}

export interface IsolatedStoreSqlUpdateResponseContract {
  rowCount: number;
  rows: Record<string, unknown>[];
}

export interface IsolatedStoreSqlDeleteRequestContract {
  schemaName?: IsolatedStoreSqlSchemaNameInQueryOptional;
  tableName: string;
  filters?: IsolatedStoreSqlFilterContract[] | null;
  allowAll?: boolean | null;
  rlsContext?: IsolatedStoreSqlRlsContextContract | null;
  trustedRuntimeContext?: IsolatedStoreSqlTrustedRuntimeContextContract | null;
}

export interface IsolatedStoreSqlDeleteResponseContract {
  rowCount: number;
}

export interface CreateIsolatedStoreRequestContract {
  alias: string;
  storeType: IsolatedStoreTypeContract;
  engine: IsolatedStoreEngineContract;
  source: IsolatedStoreSourceScopeContract;
}

export interface CreateIsolatedStoreResponseContract {
  store: IsolatedStoreContract;
}

export interface AttachIsolatedStoreSourceScopeRequestContract {
  source: IsolatedStoreSourceScopeContract;
}

export interface AttachIsolatedStoreSourceScopeResponseContract {
  store: IsolatedStoreContract;
}

export interface IsolatedStoreListResponseContract {
  stores: IsolatedStoreContract[];
}

/** Optional `clientId` query for `listIsolatedStores`; matches `app` source scope `sourceId`. */
export type ListIsolatedStoresClientIdInQueryOptional = string | null;
/** Optional `aliasLike` query for `listIsolatedStores`; exact alias or glob (`*`, `?`). */
export type ListIsolatedStoresAliasLikeInQueryOptional = string | null;

export interface GetOrCreateIsolatedStoreSourceContract {
  orgId: string;
  storeId?: string | null;
  alias?: string | null;
  stage: IsolatedStoreStageInPathRequired;
  copyStrategy?: "checkpoint_restore" | null;
}

export interface GetOrCreateIsolatedStoreRequestContract {
  clientId: string;
  alias: string;
  storeType: IsolatedStoreTypeContract;
  engine: IsolatedStoreEngineContract;
  targetStage: IsolatedStoreStageInPathRequired;
  source?: GetOrCreateIsolatedStoreSourceContract | null;
}

export interface GetOrCreateIsolatedStoreResponseContract {
  created: boolean;
  cloned: boolean;
  store: IsolatedStoreContract;
  stageInstance: IsolatedStoreStageInstanceContract;
  source?: {
    orgId: string;
    storeId: string;
    alias: string;
    stage: IsolatedStoreStageInPathRequired;
  } | null;
  copiedFromRevision?: IsolatedStoreRevisionContract | null;
  lineageMetadata?: Record<string, unknown> | null;
}

export interface IsolatedStoreResponseContract {
  store: IsolatedStoreContract;
}

export interface InitIsolatedStoreStageRequestContract {
  stage: IsolatedStoreStageInPathRequired;
  status?: IsolatedStoreStageStatusContract | null;
  bindingConfig?: IsolatedStoreBindingConfigContract | null;
  provisioningMetadata?: Record<string, unknown> | null;
}

export interface InitIsolatedStoreStageResponseContract {
  stageInstance: IsolatedStoreStageInstanceContract;
}

export interface IsolatedStoreStageListResponseContract {
  stages: IsolatedStoreStageInstanceContract[];
}

export interface DeleteIsolatedStoreStageResponseContract {
  deleted: true;
  stage: IsolatedStoreStageInPathRequired;
}

export interface DeleteIsolatedStoreResponseContract {
  deleted: true;
  storeId: IsolatedStoreIdInPathRequired;
}

export interface CreateIsolatedStoreCheckpointRequestContract {
  label?: string | null;
  snapshotRef?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateIsolatedStoreCheckpointResponseContract {
  revision: IsolatedStoreRevisionContract;
}

export interface IsolatedStoreRevisionListResponseContract {
  revisions: IsolatedStoreRevisionContract[];
}

export interface RestoreIsolatedStoreRevisionResponseContract {
  restored: true;
  revision: IsolatedStoreRevisionContract;
  stageInstance: IsolatedStoreStageInstanceContract;
}

export const IsolatedStoreTypeContract = {
  Sql: "sql"
} as const;

export const IsolatedStoreEngineContract = {
  Postgres: "postgres"
} as const;

export const IsolatedStoreStatusContract = {
  Active: "active",
  Disabled: "disabled"
} as const;

export const IsolatedStoreStageStatusContract = {
  Provisioning: "provisioning",
  Ready: "ready",
  Failed: "failed",
  Disabled: "disabled"
} as const;

export const IsolatedStoreRevisionKindContract = {
  Checkpoint: "checkpoint",
  Promotion: "promotion"
} as const;

export const IsolatedStoreScopeTypeContract = {
  Org: "org",
  Workspace: "workspace",
  Portal: "portal",
  User: "user",
  Client: "client",
  Block: "block",
  Tracker: "tracker",
  ParentRow: "parent_row",
  ParentTable: "parent_table"
} as const;

export const IsolatedStoreSqlRlsWarningCodeContract = {
  RlsNotEnabled: "rls_not_enabled",
  RlsNotForced: "rls_not_forced",
  RlsEnabledWithoutPolicies: "rls_enabled_without_policies"
} as const;

export const IsolatedStoreSqlRlsTableClassificationContract = {
  Tenant: "tenant",
  User: "user",
  OwnerCollaborator: "owner_collaborator",
  Scoped: "scoped",
  None: "none",
  Technical: "technical"
} as const;

export const IsolatedStoreSqlRlsValidationWarningCodeContract = {
  RlsManifestTableMissing: "rls_manifest_table_missing",
  RlsManifestColumnMissing: "rls_manifest_column_missing",
  RlsManifestIndexMissing: "rls_manifest_index_missing",
  RlsManifestPolicyMissing: "rls_manifest_policy_missing",
  RlsManifestRlsNotEnabled: "rls_manifest_rls_not_enabled",
  RlsManifestRlsNotForced: "rls_manifest_rls_not_forced",
  RlsManifestExemptionReasonMissing: "rls_manifest_exemption_reason_missing",
  RlsManifestCollaboratorTableMissing: "rls_manifest_collaborator_table_missing"
} as const;

export const IsolatedStoreSqlMigrationIssueCodeContract = {
  IsolatedSqlJournalLongerThanBundle: "isolated_sql_journal_longer_than_bundle",
  IsolatedSqlVersionMismatch: "isolated_sql_version_mismatch",
  IsolatedSqlNameMismatch: "isolated_sql_name_mismatch",
  IsolatedSqlChecksumMismatch: "isolated_sql_checksum_mismatch",
  IsolatedSqlSchemaExistsWithoutJournal: "isolated_sql_schema_exists_without_journal",
  IsolatedSqlJournalHeadMismatch: "isolated_sql_journal_head_mismatch"
} as const;

export const IsolatedStoreSqlMigrationIssueFieldContract = {
  HistoryLength: "history_length",
  Version: "version",
  Name: "name",
  Checksum: "checksum",
  Bootstrap: "bootstrap",
  JournalHead: "journal_head"
} as const;

export const IsolatedStoreSqlFilterOperatorContract = {
  Eq: "eq",
  Ne: "ne",
  Gt: "gt",
  Gte: "gte",
  Lt: "lt",
  Lte: "lte",
  Like: "like",
  Ilike: "ilike",
  In: "in",
  IsNull: "is_null",
  IsNotNull: "is_not_null"
} as const;

export const IsolatedStoreSqlSortDirectionContract = {
  Asc: "asc",
  Desc: "desc"
} as const;

export const IsolatedStoreSqlImportFormatContract = {
  Csv: "csv",
  Tsv: "tsv"
} as const;
