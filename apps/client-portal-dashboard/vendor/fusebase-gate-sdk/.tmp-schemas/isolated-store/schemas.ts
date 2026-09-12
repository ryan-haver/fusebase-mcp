import { schema } from "@fusebase-platform/contracts";
import type {
  AdoptIsolatedStoreSqlMigrationBaselineRequestContract as AdoptIsolatedStoreSqlMigrationBaselineRequestContractType,
  AdoptIsolatedStoreSqlMigrationBaselineResponseContract as AdoptIsolatedStoreSqlMigrationBaselineResponseContractType,
  ApplyIsolatedStoreSqlMigrationsRequestContract as ApplyIsolatedStoreSqlMigrationsRequestContractType,
  ApplyIsolatedStoreSqlMigrationsResponseContract as ApplyIsolatedStoreSqlMigrationsResponseContractType,
  AttachIsolatedStoreSourceScopeRequestContract as AttachIsolatedStoreSourceScopeRequestContractType,
  AttachIsolatedStoreSourceScopeResponseContract as AttachIsolatedStoreSourceScopeResponseContractType,
  CreateIsolatedStoreCheckpointRequestContract as CreateIsolatedStoreCheckpointRequestContractType,
  CreateIsolatedStoreCheckpointResponseContract as CreateIsolatedStoreCheckpointResponseContractType,
  CreateIsolatedStoreRequestContract as CreateIsolatedStoreRequestContractType,
  CreateIsolatedStoreResponseContract as CreateIsolatedStoreResponseContractType,
  DeleteIsolatedStoreResponseContract as DeleteIsolatedStoreResponseContractType,
  DeleteIsolatedStoreStageResponseContract as DeleteIsolatedStoreStageResponseContractType,
  GetIsolatedStoreSqlMigrationStatusRequestContract as GetIsolatedStoreSqlMigrationStatusRequestContractType,
  GetOrCreateIsolatedStoreRequestContract as GetOrCreateIsolatedStoreRequestContractType,
  GetOrCreateIsolatedStoreResponseContract as GetOrCreateIsolatedStoreResponseContractType,
  GetOrCreateIsolatedStoreSourceContract as GetOrCreateIsolatedStoreSourceContractType,
  InitIsolatedStoreStageRequestContract as InitIsolatedStoreStageRequestContractType,
  InitIsolatedStoreStageResponseContract as InitIsolatedStoreStageResponseContractType,
  IsolatedStoreBindingConfigContract as IsolatedStoreBindingConfigContractType,
  IsolatedStoreContract as IsolatedStoreContractType,
  IsolatedStoreEngineContract as IsolatedStoreEngineContractType,
  IsolatedStoreIdInPathRequired as IsolatedStoreIdInPathRequiredType,
  IsolatedStoreListResponseContract as IsolatedStoreListResponseContractType,
  IsolatedStorePostgresBindingConfigContract as IsolatedStorePostgresBindingConfigType,
  IsolatedStoreResponseContract as IsolatedStoreResponseContractType,
  IsolatedStoreRevisionContract as IsolatedStoreRevisionContractType,
  IsolatedStoreRevisionIdInPathRequired as IsolatedStoreRevisionIdInPathRequiredType,
  IsolatedStoreRevisionKindContract as IsolatedStoreRevisionKindContractType,
  IsolatedStoreRevisionListResponseContract as IsolatedStoreRevisionListResponseContractType,
  IsolatedStoreScopeContract as IsolatedStoreScopeContractType,
  IsolatedStoreScopeTypeContract as IsolatedStoreScopeTypeContractType,
  IsolatedStoreSourceScopeContract as IsolatedStoreSourceScopeContractType,
  IsolatedStoreSqlAppliedMigrationContract as IsolatedStoreSqlAppliedMigrationContractType,
  IsolatedStoreSqlBatchInsertRequestContract as IsolatedStoreSqlBatchInsertRequestContractType,
  IsolatedStoreSqlBatchInsertResponseContract as IsolatedStoreSqlBatchInsertResponseContractType,
  IsolatedStoreSqlColumnContract as IsolatedStoreSqlColumnContractType,
  IsolatedStoreSqlCountRequestContract as IsolatedStoreSqlCountRequestContractType,
  IsolatedStoreSqlCountResponseContract as IsolatedStoreSqlCountResponseContractType,
  IsolatedStoreSqlDeleteRequestContract as IsolatedStoreSqlDeleteRequestContractType,
  IsolatedStoreSqlDeleteResponseContract as IsolatedStoreSqlDeleteResponseContractType,
  IsolatedStoreSqlDescribeTableQueryContract as IsolatedStoreSqlDescribeTableQueryContractType,
  IsolatedStoreSqlDescribeTableResponseContract as IsolatedStoreSqlDescribeTableResponseContractType,
  IsolatedStoreSqlExecuteRequestContract as IsolatedStoreSqlExecuteRequestContractType,
  IsolatedStoreSqlExecuteResponseContract as IsolatedStoreSqlExecuteResponseContractType,
  IsolatedStoreSqlFilterContract as IsolatedStoreSqlFilterContractType,
  IsolatedStoreSqlFilterOperatorContract as IsolatedStoreSqlFilterOperatorContractType,
  IsolatedStoreSqlImportRequestContract as IsolatedStoreSqlImportRequestContractType,
  IsolatedStoreSqlImportResponseContract as IsolatedStoreSqlImportResponseContractType,
  IsolatedStoreSqlInsertRequestContract as IsolatedStoreSqlInsertRequestContractType,
  IsolatedStoreSqlInsertResponseContract as IsolatedStoreSqlInsertResponseContractType,
  IsolatedStoreSqlListTablesQueryContract as IsolatedStoreSqlListTablesQueryContractType,
  IsolatedStoreSqlListTablesResponseContract as IsolatedStoreSqlListTablesResponseContractType,
  IsolatedStoreSqlMigrationBundleContract as IsolatedStoreSqlMigrationBundleContractType,
  IsolatedStoreSqlMigrationBundleEntryContract as IsolatedStoreSqlMigrationBundleEntryContractType,
  IsolatedStoreSqlMigrationConflictErrorBodyContract as IsolatedStoreSqlMigrationConflictErrorBodyContractType,
  IsolatedStoreSqlMigrationIssueContract as IsolatedStoreSqlMigrationIssueContractType,
  IsolatedStoreSqlMigrationStatusContract as IsolatedStoreSqlMigrationStatusContractType,
  IsolatedStoreSqlQueryRequestContract as IsolatedStoreSqlQueryRequestContractType,
  IsolatedStoreSqlQueryResponseContract as IsolatedStoreSqlQueryResponseContractType,
  IsolatedStoreSqlQueryResultContract as IsolatedStoreSqlQueryResultContractType,
  IsolatedStoreSqlRlsContextContract as IsolatedStoreSqlRlsContextContractType,
  IsolatedStoreSqlRlsContextValueContract as IsolatedStoreSqlRlsContextValueContractType,
  IsolatedStoreSqlRlsIndexContract as IsolatedStoreSqlRlsIndexContractType,
  IsolatedStoreSqlRlsManifestContract as IsolatedStoreSqlRlsManifestContractType,
  IsolatedStoreSqlRlsPolicyContract as IsolatedStoreSqlRlsPolicyContractType,
  IsolatedStoreSqlRlsScopeManifestContract as IsolatedStoreSqlRlsScopeManifestContractType,
  IsolatedStoreSqlRlsStatusResponseContract as IsolatedStoreSqlRlsStatusResponseContractType,
  IsolatedStoreSqlRlsTableClassificationContract as IsolatedStoreSqlRlsTableClassificationContractType,
  IsolatedStoreSqlRlsTableManifestContract as IsolatedStoreSqlRlsTableManifestContractType,
  IsolatedStoreSqlRlsTableStatusContract as IsolatedStoreSqlRlsTableStatusContractType,
  IsolatedStoreSqlRlsValidationResultContract as IsolatedStoreSqlRlsValidationResultContractType,
  IsolatedStoreSqlRlsValidationWarningCodeContract as IsolatedStoreSqlRlsValidationWarningCodeContractType,
  IsolatedStoreSqlRlsValidationWarningContract as IsolatedStoreSqlRlsValidationWarningContractType,
  IsolatedStoreSqlRlsWarningCodeContract as IsolatedStoreSqlRlsWarningCodeContractType,
  IsolatedStoreSqlRlsWarningContract as IsolatedStoreSqlRlsWarningContractType,
  IsolatedStoreSqlSchemaNameInQueryOptional as IsolatedStoreSqlSchemaNameInQueryOptionalType,
  IsolatedStoreSqlSelectRequestContract as IsolatedStoreSqlSelectRequestContractType,
  IsolatedStoreSqlSelectResponseContract as IsolatedStoreSqlSelectResponseContractType,
  IsolatedStoreSqlSortContract as IsolatedStoreSqlSortContractType,
  IsolatedStoreSqlSortDirectionContract as IsolatedStoreSqlSortDirectionContractType,
  IsolatedStoreSqlStatsResponseContract as IsolatedStoreSqlStatsResponseContractType,
  IsolatedStoreSqlTableContract as IsolatedStoreSqlTableContractType,
  IsolatedStoreSqlTableDescriptionContract as IsolatedStoreSqlTableDescriptionContractType,
  IsolatedStoreSqlTableNameInPathRequired as IsolatedStoreSqlTableNameInPathRequiredType,
  IsolatedStoreSqlTableStatsContract as IsolatedStoreSqlTableStatsContractType,
  IsolatedStoreSqlUpdateRequestContract as IsolatedStoreSqlUpdateRequestContractType,
  IsolatedStoreSqlUpdateResponseContract as IsolatedStoreSqlUpdateResponseContractType,
  IsolatedStoreStageInPathRequired as IsolatedStoreStageInPathRequiredType,
  IsolatedStoreStageInstanceContract as IsolatedStoreStageInstanceContractType,
  IsolatedStoreStageListResponseContract as IsolatedStoreStageListResponseContractType,
  IsolatedStoreStageStatusContract as IsolatedStoreStageStatusContractType,
  IsolatedStoreStatusContract as IsolatedStoreStatusContractType,
  IsolatedStoreTypeContract as IsolatedStoreTypeContractType,
  ListIsolatedStoresAliasLikeInQueryOptional as ListIsolatedStoresAliasLikeInQueryOptionalType,
  ListIsolatedStoresClientIdInQueryOptional as ListIsolatedStoresClientIdInQueryOptionalType,
  RepairIsolatedStoreSqlMigrationJournalChecksumsRequestContract as RepairIsolatedStoreSqlMigrationJournalChecksumsRequestContractType,
  RepairIsolatedStoreSqlMigrationJournalChecksumsResponseContract as RepairIsolatedStoreSqlMigrationJournalChecksumsResponseContractType,
  RestoreIsolatedStoreRevisionResponseContract as RestoreIsolatedStoreRevisionResponseContractType,
} from "./isolated-store";

const IsolatedStoreIdInPathRequiredSchema =
  schema<IsolatedStoreIdInPathRequiredType>("IsolatedStoreIdInPathRequired");
const IsolatedStoreRevisionIdInPathRequiredSchema =
  schema<IsolatedStoreRevisionIdInPathRequiredType>(
    "IsolatedStoreRevisionIdInPathRequired",
  );
const IsolatedStoreStageInPathRequiredSchema =
  schema<IsolatedStoreStageInPathRequiredType>(
    "IsolatedStoreStageInPathRequired",
  );
const IsolatedStoreSqlTableNameInPathRequiredSchema =
  schema<IsolatedStoreSqlTableNameInPathRequiredType>(
    "IsolatedStoreSqlTableNameInPathRequired",
  );
const IsolatedStoreTypeContractSchema =
  schema<IsolatedStoreTypeContractType>("IsolatedStoreType");
const IsolatedStoreEngineContractSchema =
  schema<IsolatedStoreEngineContractType>("IsolatedStoreEngine");
const IsolatedStoreStatusContractSchema =
  schema<IsolatedStoreStatusContractType>("IsolatedStoreStatus");
const IsolatedStoreStageStatusContractSchema =
  schema<IsolatedStoreStageStatusContractType>("IsolatedStoreStageStatus");
const IsolatedStoreRevisionKindContractSchema =
  schema<IsolatedStoreRevisionKindContractType>("IsolatedStoreRevisionKind");
const IsolatedStoreSqlSchemaNameInQueryOptionalSchema =
  schema<IsolatedStoreSqlSchemaNameInQueryOptionalType>(
    "IsolatedStoreSqlSchemaNameInQueryOptional",
  );
const ListIsolatedStoresClientIdInQueryOptionalSchema =
  schema<ListIsolatedStoresClientIdInQueryOptionalType>(
    "ListIsolatedStoresClientIdInQueryOptional",
  );
const ListIsolatedStoresAliasLikeInQueryOptionalSchema =
  schema<ListIsolatedStoresAliasLikeInQueryOptionalType>(
    "ListIsolatedStoresAliasLikeInQueryOptional",
  );
const IsolatedStoreScopeTypeContractSchema =
  schema<IsolatedStoreScopeTypeContractType>("IsolatedStoreScopeType");
const IsolatedStoreScopeContractSchema =
  schema<IsolatedStoreScopeContractType>("IsolatedStoreScope");
const IsolatedStoreSourceScopeContractSchema =
  schema<IsolatedStoreSourceScopeContractType>("IsolatedStoreSourceScope");
const IsolatedStoreContractSchema =
  schema<IsolatedStoreContractType>("IsolatedStore");
const IsolatedStorePostgresBindingConfigSchema =
  schema<IsolatedStorePostgresBindingConfigType>(
    "IsolatedStorePostgresBindingConfig",
  );
const IsolatedStoreBindingConfigSchema =
  schema<IsolatedStoreBindingConfigContractType>("IsolatedStoreBindingConfig");
const IsolatedStoreStageInstanceContractSchema =
  schema<IsolatedStoreStageInstanceContractType>("IsolatedStoreStageInstance");
const IsolatedStoreRevisionContractSchema =
  schema<IsolatedStoreRevisionContractType>("IsolatedStoreRevision");
const IsolatedStoreSqlTableContractSchema =
  schema<IsolatedStoreSqlTableContractType>("IsolatedStoreSqlTable");
const IsolatedStoreSqlColumnContractSchema =
  schema<IsolatedStoreSqlColumnContractType>("IsolatedStoreSqlColumn");
const IsolatedStoreSqlTableDescriptionContractSchema =
  schema<IsolatedStoreSqlTableDescriptionContractType>(
    "IsolatedStoreSqlTableDescription",
  );
const IsolatedStoreSqlTableStatsContractSchema =
  schema<IsolatedStoreSqlTableStatsContractType>("IsolatedStoreSqlTableStats");
const IsolatedStoreSqlStatsResponseContractSchema =
  schema<IsolatedStoreSqlStatsResponseContractType>(
    "IsolatedStoreSqlStatsResponse",
  );
const IsolatedStoreSqlRlsWarningCodeContractSchema =
  schema<IsolatedStoreSqlRlsWarningCodeContractType>(
    "IsolatedStoreSqlRlsWarningCode",
  );
const IsolatedStoreSqlRlsWarningContractSchema =
  schema<IsolatedStoreSqlRlsWarningContractType>("IsolatedStoreSqlRlsWarning");
const IsolatedStoreSqlRlsPolicyContractSchema =
  schema<IsolatedStoreSqlRlsPolicyContractType>("IsolatedStoreSqlRlsPolicy");
const IsolatedStoreSqlRlsIndexContractSchema =
  schema<IsolatedStoreSqlRlsIndexContractType>("IsolatedStoreSqlRlsIndex");
const IsolatedStoreSqlRlsTableStatusContractSchema =
  schema<IsolatedStoreSqlRlsTableStatusContractType>(
    "IsolatedStoreSqlRlsTableStatus",
  );
const IsolatedStoreSqlRlsStatusResponseContractSchema =
  schema<IsolatedStoreSqlRlsStatusResponseContractType>(
    "IsolatedStoreSqlRlsStatusResponse",
  );
const IsolatedStoreSqlRlsTableClassificationContractSchema =
  schema<IsolatedStoreSqlRlsTableClassificationContractType>(
    "IsolatedStoreSqlRlsTableClassification",
  );
const IsolatedStoreSqlRlsScopeManifestContractSchema =
  schema<IsolatedStoreSqlRlsScopeManifestContractType>(
    "IsolatedStoreSqlRlsScopeManifest",
  );
const IsolatedStoreSqlRlsTableManifestContractSchema =
  schema<IsolatedStoreSqlRlsTableManifestContractType>(
    "IsolatedStoreSqlRlsTableManifest",
  );
const IsolatedStoreSqlRlsManifestContractSchema =
  schema<IsolatedStoreSqlRlsManifestContractType>(
    "IsolatedStoreSqlRlsManifest",
  );
const IsolatedStoreSqlRlsValidationWarningCodeContractSchema =
  schema<IsolatedStoreSqlRlsValidationWarningCodeContractType>(
    "IsolatedStoreSqlRlsValidationWarningCode",
  );
const IsolatedStoreSqlRlsValidationWarningContractSchema =
  schema<IsolatedStoreSqlRlsValidationWarningContractType>(
    "IsolatedStoreSqlRlsValidationWarning",
  );
const IsolatedStoreSqlRlsValidationResultContractSchema =
  schema<IsolatedStoreSqlRlsValidationResultContractType>(
    "IsolatedStoreSqlRlsValidationResult",
  );
const IsolatedStoreSqlMigrationBundleEntryContractSchema =
  schema<IsolatedStoreSqlMigrationBundleEntryContractType>(
    "IsolatedStoreSqlMigrationBundleEntry",
  );
const IsolatedStoreSqlMigrationBundleContractSchema =
  schema<IsolatedStoreSqlMigrationBundleContractType>(
    "IsolatedStoreSqlMigrationBundle",
  );
const IsolatedStoreSqlAppliedMigrationContractSchema =
  schema<IsolatedStoreSqlAppliedMigrationContractType>(
    "IsolatedStoreSqlAppliedMigration",
  );
const IsolatedStoreSqlMigrationIssueContractSchema =
  schema<IsolatedStoreSqlMigrationIssueContractType>(
    "IsolatedStoreSqlMigrationIssue",
  );
const IsolatedStoreSqlMigrationConflictErrorBodyContractSchema =
  schema<IsolatedStoreSqlMigrationConflictErrorBodyContractType>(
    "IsolatedStoreSqlMigrationConflictErrorBody",
  );
const IsolatedStoreSqlMigrationStatusContractSchema =
  schema<IsolatedStoreSqlMigrationStatusContractType>(
    "IsolatedStoreSqlMigrationStatus",
  );
const GetIsolatedStoreSqlMigrationStatusRequestContractSchema =
  schema<GetIsolatedStoreSqlMigrationStatusRequestContractType>(
    "GetIsolatedStoreSqlMigrationStatusRequest",
  );
const ApplyIsolatedStoreSqlMigrationsRequestContractSchema =
  schema<ApplyIsolatedStoreSqlMigrationsRequestContractType>(
    "ApplyIsolatedStoreSqlMigrationsRequest",
  );
const ApplyIsolatedStoreSqlMigrationsResponseContractSchema =
  schema<ApplyIsolatedStoreSqlMigrationsResponseContractType>(
    "ApplyIsolatedStoreSqlMigrationsResponse",
  );
const AdoptIsolatedStoreSqlMigrationBaselineRequestContractSchema =
  schema<AdoptIsolatedStoreSqlMigrationBaselineRequestContractType>(
    "AdoptIsolatedStoreSqlMigrationBaselineRequest",
  );
const AdoptIsolatedStoreSqlMigrationBaselineResponseContractSchema =
  schema<AdoptIsolatedStoreSqlMigrationBaselineResponseContractType>(
    "AdoptIsolatedStoreSqlMigrationBaselineResponse",
  );
const RepairIsolatedStoreSqlMigrationJournalChecksumsRequestContractSchema =
  schema<RepairIsolatedStoreSqlMigrationJournalChecksumsRequestContractType>(
    "RepairIsolatedStoreSqlMigrationJournalChecksumsRequest",
  );
const RepairIsolatedStoreSqlMigrationJournalChecksumsResponseContractSchema =
  schema<RepairIsolatedStoreSqlMigrationJournalChecksumsResponseContractType>(
    "RepairIsolatedStoreSqlMigrationJournalChecksumsResponse",
  );
const IsolatedStoreSqlQueryResultContractSchema =
  schema<IsolatedStoreSqlQueryResultContractType>(
    "IsolatedStoreSqlQueryResult",
  );
const IsolatedStoreSqlRlsContextValueContractSchema =
  schema<IsolatedStoreSqlRlsContextValueContractType>(
    "IsolatedStoreSqlRlsContextValue",
  );
const IsolatedStoreSqlRlsContextContractSchema =
  schema<IsolatedStoreSqlRlsContextContractType>("IsolatedStoreSqlRlsContext");
const IsolatedStoreSqlFilterOperatorContractSchema =
  schema<IsolatedStoreSqlFilterOperatorContractType>(
    "IsolatedStoreSqlFilterOperator",
  );
const IsolatedStoreSqlFilterContractSchema =
  schema<IsolatedStoreSqlFilterContractType>("IsolatedStoreSqlFilter");
const IsolatedStoreSqlSortDirectionContractSchema =
  schema<IsolatedStoreSqlSortDirectionContractType>(
    "IsolatedStoreSqlSortDirection",
  );
const IsolatedStoreSqlSortContractSchema =
  schema<IsolatedStoreSqlSortContractType>("IsolatedStoreSqlSort");
const IsolatedStoreSqlCountRequestContractSchema =
  schema<IsolatedStoreSqlCountRequestContractType>(
    "IsolatedStoreSqlCountRequest",
  );
const IsolatedStoreSqlCountResponseContractSchema =
  schema<IsolatedStoreSqlCountResponseContractType>(
    "IsolatedStoreSqlCountResponse",
  );
const IsolatedStoreSqlSelectRequestContractSchema =
  schema<IsolatedStoreSqlSelectRequestContractType>(
    "IsolatedStoreSqlSelectRequest",
  );
const IsolatedStoreSqlSelectResponseContractSchema =
  schema<IsolatedStoreSqlSelectResponseContractType>(
    "IsolatedStoreSqlSelectResponse",
  );
const IsolatedStoreSqlInsertRequestContractSchema =
  schema<IsolatedStoreSqlInsertRequestContractType>(
    "IsolatedStoreSqlInsertRequest",
  );
const IsolatedStoreSqlInsertResponseContractSchema =
  schema<IsolatedStoreSqlInsertResponseContractType>(
    "IsolatedStoreSqlInsertResponse",
  );
const IsolatedStoreSqlBatchInsertRequestContractSchema =
  schema<IsolatedStoreSqlBatchInsertRequestContractType>(
    "IsolatedStoreSqlBatchInsertRequest",
  );
const IsolatedStoreSqlBatchInsertResponseContractSchema =
  schema<IsolatedStoreSqlBatchInsertResponseContractType>(
    "IsolatedStoreSqlBatchInsertResponse",
  );
const IsolatedStoreSqlImportRequestContractSchema =
  schema<IsolatedStoreSqlImportRequestContractType>(
    "IsolatedStoreSqlImportRequest",
  );
const IsolatedStoreSqlImportResponseContractSchema =
  schema<IsolatedStoreSqlImportResponseContractType>(
    "IsolatedStoreSqlImportResponse",
  );
const IsolatedStoreSqlUpdateRequestContractSchema =
  schema<IsolatedStoreSqlUpdateRequestContractType>(
    "IsolatedStoreSqlUpdateRequest",
  );
const IsolatedStoreSqlUpdateResponseContractSchema =
  schema<IsolatedStoreSqlUpdateResponseContractType>(
    "IsolatedStoreSqlUpdateResponse",
  );
const IsolatedStoreSqlDeleteRequestContractSchema =
  schema<IsolatedStoreSqlDeleteRequestContractType>(
    "IsolatedStoreSqlDeleteRequest",
  );
const IsolatedStoreSqlDeleteResponseContractSchema =
  schema<IsolatedStoreSqlDeleteResponseContractType>(
    "IsolatedStoreSqlDeleteResponse",
  );
const CreateIsolatedStoreRequestContractSchema =
  schema<CreateIsolatedStoreRequestContractType>("CreateIsolatedStoreRequest");
const CreateIsolatedStoreResponseContractSchema =
  schema<CreateIsolatedStoreResponseContractType>(
    "CreateIsolatedStoreResponse",
  );
const AttachIsolatedStoreSourceScopeRequestContractSchema =
  schema<AttachIsolatedStoreSourceScopeRequestContractType>(
    "AttachIsolatedStoreSourceScopeRequest",
  );
const AttachIsolatedStoreSourceScopeResponseContractSchema =
  schema<AttachIsolatedStoreSourceScopeResponseContractType>(
    "AttachIsolatedStoreSourceScopeResponse",
  );
const IsolatedStoreListResponseContractSchema =
  schema<IsolatedStoreListResponseContractType>("IsolatedStoreListResponse");
const IsolatedStoreResponseContractSchema =
  schema<IsolatedStoreResponseContractType>("IsolatedStoreResponse");
const GetOrCreateIsolatedStoreSourceContractSchema =
  schema<GetOrCreateIsolatedStoreSourceContractType>(
    "GetOrCreateIsolatedStoreSource",
  );
const GetOrCreateIsolatedStoreRequestContractSchema =
  schema<GetOrCreateIsolatedStoreRequestContractType>(
    "GetOrCreateIsolatedStoreRequest",
  );
const GetOrCreateIsolatedStoreResponseContractSchema =
  schema<GetOrCreateIsolatedStoreResponseContractType>(
    "GetOrCreateIsolatedStoreResponse",
  );
const InitIsolatedStoreStageRequestContractSchema =
  schema<InitIsolatedStoreStageRequestContractType>(
    "InitIsolatedStoreStageRequest",
  );
const InitIsolatedStoreStageResponseContractSchema =
  schema<InitIsolatedStoreStageResponseContractType>(
    "InitIsolatedStoreStageResponse",
  );
const IsolatedStoreStageListResponseContractSchema =
  schema<IsolatedStoreStageListResponseContractType>(
    "IsolatedStoreStageListResponse",
  );
const DeleteIsolatedStoreResponseContractSchema =
  schema<DeleteIsolatedStoreResponseContractType>(
    "DeleteIsolatedStoreResponse",
  );
const DeleteIsolatedStoreStageResponseContractSchema =
  schema<DeleteIsolatedStoreStageResponseContractType>(
    "DeleteIsolatedStoreStageResponse",
  );
const CreateIsolatedStoreCheckpointRequestContractSchema =
  schema<CreateIsolatedStoreCheckpointRequestContractType>(
    "CreateIsolatedStoreCheckpointRequest",
  );
const CreateIsolatedStoreCheckpointResponseContractSchema =
  schema<CreateIsolatedStoreCheckpointResponseContractType>(
    "CreateIsolatedStoreCheckpointResponse",
  );
const IsolatedStoreRevisionListResponseContractSchema =
  schema<IsolatedStoreRevisionListResponseContractType>(
    "IsolatedStoreRevisionListResponse",
  );
const RestoreIsolatedStoreRevisionResponseContractSchema =
  schema<RestoreIsolatedStoreRevisionResponseContractType>(
    "RestoreIsolatedStoreRevisionResponse",
  );
const IsolatedStoreSqlListTablesQueryContractSchema =
  schema<IsolatedStoreSqlListTablesQueryContractType>(
    "IsolatedStoreSqlListTablesQuery",
  );
const IsolatedStoreSqlDescribeTableQueryContractSchema =
  schema<IsolatedStoreSqlDescribeTableQueryContractType>(
    "IsolatedStoreSqlDescribeTableQuery",
  );
const IsolatedStoreSqlListTablesResponseContractSchema =
  schema<IsolatedStoreSqlListTablesResponseContractType>(
    "IsolatedStoreSqlListTablesResponse",
  );
const IsolatedStoreSqlDescribeTableResponseContractSchema =
  schema<IsolatedStoreSqlDescribeTableResponseContractType>(
    "IsolatedStoreSqlDescribeTableResponse",
  );
const IsolatedStoreSqlQueryRequestContractSchema =
  schema<IsolatedStoreSqlQueryRequestContractType>(
    "IsolatedStoreSqlQueryRequest",
  );
const IsolatedStoreSqlQueryResponseContractSchema =
  schema<IsolatedStoreSqlQueryResponseContractType>(
    "IsolatedStoreSqlQueryResponse",
  );
const IsolatedStoreSqlExecuteRequestContractSchema =
  schema<IsolatedStoreSqlExecuteRequestContractType>(
    "IsolatedStoreSqlExecuteRequest",
  );
const IsolatedStoreSqlExecuteResponseContractSchema =
  schema<IsolatedStoreSqlExecuteResponseContractType>(
    "IsolatedStoreSqlExecuteResponse",
  );

export const IsolatedStoreSchemas = {
  IsolatedStoreIdInPathRequired: IsolatedStoreIdInPathRequiredSchema,
  IsolatedStoreRevisionIdInPathRequired:
    IsolatedStoreRevisionIdInPathRequiredSchema,
  IsolatedStoreStageInPathRequired: IsolatedStoreStageInPathRequiredSchema,
  IsolatedStoreSqlTableNameInPathRequired:
    IsolatedStoreSqlTableNameInPathRequiredSchema,
  IsolatedStoreTypeContract: IsolatedStoreTypeContractSchema,
  IsolatedStoreEngineContract: IsolatedStoreEngineContractSchema,
  IsolatedStoreStatusContract: IsolatedStoreStatusContractSchema,
  IsolatedStoreStageStatusContract: IsolatedStoreStageStatusContractSchema,
  IsolatedStoreRevisionKindContract: IsolatedStoreRevisionKindContractSchema,
  IsolatedStoreSqlSchemaNameInQueryOptional:
    IsolatedStoreSqlSchemaNameInQueryOptionalSchema,
  ListIsolatedStoresClientIdInQueryOptional:
    ListIsolatedStoresClientIdInQueryOptionalSchema,
  ListIsolatedStoresAliasLikeInQueryOptional:
    ListIsolatedStoresAliasLikeInQueryOptionalSchema,
  IsolatedStoreScopeTypeContract: IsolatedStoreScopeTypeContractSchema,
  IsolatedStoreScopeContract: IsolatedStoreScopeContractSchema,
  IsolatedStoreSourceScopeContract: IsolatedStoreSourceScopeContractSchema,
  IsolatedStoreContract: IsolatedStoreContractSchema,
  IsolatedStorePostgresBindingConfig: IsolatedStorePostgresBindingConfigSchema,
  IsolatedStoreBindingConfig: IsolatedStoreBindingConfigSchema,
  IsolatedStoreStageInstanceContract: IsolatedStoreStageInstanceContractSchema,
  IsolatedStoreRevisionContract: IsolatedStoreRevisionContractSchema,
  IsolatedStoreSqlTableContract: IsolatedStoreSqlTableContractSchema,
  IsolatedStoreSqlColumnContract: IsolatedStoreSqlColumnContractSchema,
  IsolatedStoreSqlTableDescriptionContract:
    IsolatedStoreSqlTableDescriptionContractSchema,
  IsolatedStoreSqlTableStatsContract: IsolatedStoreSqlTableStatsContractSchema,
  IsolatedStoreSqlStatsResponseContract:
    IsolatedStoreSqlStatsResponseContractSchema,
  IsolatedStoreSqlRlsWarningCodeContract:
    IsolatedStoreSqlRlsWarningCodeContractSchema,
  IsolatedStoreSqlRlsWarningContract: IsolatedStoreSqlRlsWarningContractSchema,
  IsolatedStoreSqlRlsPolicyContract: IsolatedStoreSqlRlsPolicyContractSchema,
  IsolatedStoreSqlRlsIndexContract: IsolatedStoreSqlRlsIndexContractSchema,
  IsolatedStoreSqlRlsTableStatusContract:
    IsolatedStoreSqlRlsTableStatusContractSchema,
  IsolatedStoreSqlRlsStatusResponseContract:
    IsolatedStoreSqlRlsStatusResponseContractSchema,
  IsolatedStoreSqlRlsTableClassificationContract:
    IsolatedStoreSqlRlsTableClassificationContractSchema,
  IsolatedStoreSqlRlsScopeManifestContract:
    IsolatedStoreSqlRlsScopeManifestContractSchema,
  IsolatedStoreSqlRlsTableManifestContract:
    IsolatedStoreSqlRlsTableManifestContractSchema,
  IsolatedStoreSqlRlsManifestContract:
    IsolatedStoreSqlRlsManifestContractSchema,
  IsolatedStoreSqlRlsValidationWarningCodeContract:
    IsolatedStoreSqlRlsValidationWarningCodeContractSchema,
  IsolatedStoreSqlRlsValidationWarningContract:
    IsolatedStoreSqlRlsValidationWarningContractSchema,
  IsolatedStoreSqlRlsValidationResultContract:
    IsolatedStoreSqlRlsValidationResultContractSchema,
  IsolatedStoreSqlMigrationBundleEntryContract:
    IsolatedStoreSqlMigrationBundleEntryContractSchema,
  IsolatedStoreSqlMigrationBundleContract:
    IsolatedStoreSqlMigrationBundleContractSchema,
  IsolatedStoreSqlAppliedMigrationContract:
    IsolatedStoreSqlAppliedMigrationContractSchema,
  IsolatedStoreSqlMigrationIssueContract:
    IsolatedStoreSqlMigrationIssueContractSchema,
  IsolatedStoreSqlMigrationConflictErrorBodyContract:
    IsolatedStoreSqlMigrationConflictErrorBodyContractSchema,
  IsolatedStoreSqlMigrationStatusContract:
    IsolatedStoreSqlMigrationStatusContractSchema,
  GetIsolatedStoreSqlMigrationStatusRequestContract:
    GetIsolatedStoreSqlMigrationStatusRequestContractSchema,
  ApplyIsolatedStoreSqlMigrationsRequestContract:
    ApplyIsolatedStoreSqlMigrationsRequestContractSchema,
  ApplyIsolatedStoreSqlMigrationsResponseContract:
    ApplyIsolatedStoreSqlMigrationsResponseContractSchema,
  AdoptIsolatedStoreSqlMigrationBaselineRequestContract:
    AdoptIsolatedStoreSqlMigrationBaselineRequestContractSchema,
  AdoptIsolatedStoreSqlMigrationBaselineResponseContract:
    AdoptIsolatedStoreSqlMigrationBaselineResponseContractSchema,
  RepairIsolatedStoreSqlMigrationJournalChecksumsRequestContract:
    RepairIsolatedStoreSqlMigrationJournalChecksumsRequestContractSchema,
  RepairIsolatedStoreSqlMigrationJournalChecksumsResponseContract:
    RepairIsolatedStoreSqlMigrationJournalChecksumsResponseContractSchema,
  IsolatedStoreSqlQueryResultContract:
    IsolatedStoreSqlQueryResultContractSchema,
  IsolatedStoreSqlRlsContextValueContract:
    IsolatedStoreSqlRlsContextValueContractSchema,
  IsolatedStoreSqlRlsContextContract: IsolatedStoreSqlRlsContextContractSchema,
  IsolatedStoreSqlFilterOperatorContract:
    IsolatedStoreSqlFilterOperatorContractSchema,
  IsolatedStoreSqlFilterContract: IsolatedStoreSqlFilterContractSchema,
  IsolatedStoreSqlSortDirectionContract:
    IsolatedStoreSqlSortDirectionContractSchema,
  IsolatedStoreSqlSortContract: IsolatedStoreSqlSortContractSchema,
  IsolatedStoreSqlCountRequestContract:
    IsolatedStoreSqlCountRequestContractSchema,
  IsolatedStoreSqlCountResponseContract:
    IsolatedStoreSqlCountResponseContractSchema,
  IsolatedStoreSqlSelectRequestContract:
    IsolatedStoreSqlSelectRequestContractSchema,
  IsolatedStoreSqlSelectResponseContract:
    IsolatedStoreSqlSelectResponseContractSchema,
  IsolatedStoreSqlInsertRequestContract:
    IsolatedStoreSqlInsertRequestContractSchema,
  IsolatedStoreSqlInsertResponseContract:
    IsolatedStoreSqlInsertResponseContractSchema,
  IsolatedStoreSqlBatchInsertRequestContract:
    IsolatedStoreSqlBatchInsertRequestContractSchema,
  IsolatedStoreSqlBatchInsertResponseContract:
    IsolatedStoreSqlBatchInsertResponseContractSchema,
  IsolatedStoreSqlImportRequestContract:
    IsolatedStoreSqlImportRequestContractSchema,
  IsolatedStoreSqlImportResponseContract:
    IsolatedStoreSqlImportResponseContractSchema,
  IsolatedStoreSqlUpdateRequestContract:
    IsolatedStoreSqlUpdateRequestContractSchema,
  IsolatedStoreSqlUpdateResponseContract:
    IsolatedStoreSqlUpdateResponseContractSchema,
  IsolatedStoreSqlDeleteRequestContract:
    IsolatedStoreSqlDeleteRequestContractSchema,
  IsolatedStoreSqlDeleteResponseContract:
    IsolatedStoreSqlDeleteResponseContractSchema,
  CreateIsolatedStoreRequestContract: CreateIsolatedStoreRequestContractSchema,
  CreateIsolatedStoreResponseContract:
    CreateIsolatedStoreResponseContractSchema,
  AttachIsolatedStoreSourceScopeRequestContract:
    AttachIsolatedStoreSourceScopeRequestContractSchema,
  AttachIsolatedStoreSourceScopeResponseContract:
    AttachIsolatedStoreSourceScopeResponseContractSchema,
  IsolatedStoreListResponseContract: IsolatedStoreListResponseContractSchema,
  IsolatedStoreResponseContract: IsolatedStoreResponseContractSchema,
  GetOrCreateIsolatedStoreSourceContract:
    GetOrCreateIsolatedStoreSourceContractSchema,
  GetOrCreateIsolatedStoreRequestContract:
    GetOrCreateIsolatedStoreRequestContractSchema,
  GetOrCreateIsolatedStoreResponseContract:
    GetOrCreateIsolatedStoreResponseContractSchema,
  InitIsolatedStoreStageRequestContract:
    InitIsolatedStoreStageRequestContractSchema,
  InitIsolatedStoreStageResponseContract:
    InitIsolatedStoreStageResponseContractSchema,
  IsolatedStoreStageListResponseContract:
    IsolatedStoreStageListResponseContractSchema,
  DeleteIsolatedStoreResponseContract:
    DeleteIsolatedStoreResponseContractSchema,
  DeleteIsolatedStoreStageResponseContract:
    DeleteIsolatedStoreStageResponseContractSchema,
  CreateIsolatedStoreCheckpointRequestContract:
    CreateIsolatedStoreCheckpointRequestContractSchema,
  CreateIsolatedStoreCheckpointResponseContract:
    CreateIsolatedStoreCheckpointResponseContractSchema,
  IsolatedStoreRevisionListResponseContract:
    IsolatedStoreRevisionListResponseContractSchema,
  RestoreIsolatedStoreRevisionResponseContract:
    RestoreIsolatedStoreRevisionResponseContractSchema,
  IsolatedStoreSqlListTablesQueryContract:
    IsolatedStoreSqlListTablesQueryContractSchema,
  IsolatedStoreSqlDescribeTableQueryContract:
    IsolatedStoreSqlDescribeTableQueryContractSchema,
  IsolatedStoreSqlListTablesResponseContract:
    IsolatedStoreSqlListTablesResponseContractSchema,
  IsolatedStoreSqlDescribeTableResponseContract:
    IsolatedStoreSqlDescribeTableResponseContractSchema,
  IsolatedStoreSqlQueryRequestContract:
    IsolatedStoreSqlQueryRequestContractSchema,
  IsolatedStoreSqlQueryResponseContract:
    IsolatedStoreSqlQueryResponseContractSchema,
  IsolatedStoreSqlExecuteRequestContract:
    IsolatedStoreSqlExecuteRequestContractSchema,
  IsolatedStoreSqlExecuteResponseContract:
    IsolatedStoreSqlExecuteResponseContractSchema,
} as const;
