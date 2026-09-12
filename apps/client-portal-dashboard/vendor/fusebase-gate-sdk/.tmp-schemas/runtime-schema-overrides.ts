import type { SchemaLike } from "@fusebase-platform/contracts";

export const serviceRuntimeSchemaOverrides = {
  OrgGroupIdInPathRequired: {
    type: "string",
    format: "opaque-id",
    description:
      "Opaque org-service group identifier. This value is not guaranteed to be a UUID.",
  },
  OrgGroupUserIdInPathRequired: {
    type: "number",
    description:
      "Numeric org-service user identifier used by org-group routes.",
  },
  OrgGroupWorkspaceIdInPathRequired: {
    type: "string",
    format: "opaque-id",
    description:
      "Opaque workspace identifier used by org-service group assignment routes. Supports a real workspace id or `default`, which gate resolves to the organization's default workspace before calling org-service.",
  },
  OrgGroupIncludeWorkspaceInQueryOptional: {
    type: "boolean",
    description: "Include workspace details in each workspace-group record.",
    nullable: true,
  },
  OrgWorkspaceGroupsIncludeGroupsInQueryOptional: {
    type: "boolean",
    description:
      "Forward the org-service groups flag for workspace group listings.",
    nullable: true,
  },
  OrgGroupCreateRequest: {
    type: "object",
    properties: {
      name: {
        type: "string",
      },
      description: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      workspaces: {
        anyOf: [
          {
            type: "array",
            items: { $ref: "#/components/schemas/OrgGroupWorkspaceRole" },
          },
          { type: "null" },
        ],
      },
    },
    required: ["name"] as string[],
    additionalProperties: false,
  } as unknown as SchemaLike,
  OrgGroupUpdateRequest: {
    type: "object",
    properties: {
      name: {
        type: "string",
      },
      description: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      workspaces: {
        anyOf: [
          {
            type: "array",
            items: { $ref: "#/components/schemas/OrgGroupWorkspaceRole" },
          },
          { type: "null" },
        ],
      },
    },
    additionalProperties: false,
  } as unknown as SchemaLike,
  WorkspaceIdInPathRequired: {
    type: "string",
    format: "opaque-id",
    description:
      "Opaque workspace identifier used by the notes service. Prefer a real workspace id returned by listWorkspaces; notes routes also accept `default` as a path alias that gate resolves to the organization's default workspace.",
  },
  StartMultipartFileUploadRequest: {
    type: "object",
    description:
      "Start a public file-service multipart upload. `filename` and byte `size` are required; `folder` is optional and defaults to `apps`.",
    properties: {
      filename: {
        type: "string",
        maxLength: 255,
        description: "Original client filename. Max length: 255 characters.",
      },
      size: {
        type: "number",
        minimum: 1,
        description: "Total file size in bytes.",
      },
      contentType: {
        anyOf: [
          {
            type: "string",
            maxLength: 255,
          },
          { type: "null" },
        ],
        description:
          "Optional MIME type sent to file-service. Defaults to application/octet-stream. Max length: 255 characters.",
      },
      folder: {
        anyOf: [
          {
            type: "string",
            maxLength: 512,
          },
          { type: "null" },
        ],
        description:
          "Optional file-service folder. Defaults to `apps`. Max length: 512 characters.",
      },
    },
    required: ["filename", "size"] as string[],
    additionalProperties: false,
  } as unknown as SchemaLike,
  DeleteFileRequest: {
    type: "object",
    description: "Delete a previously returned stored-file UUID.",
    properties: {
      fileId: {
        type: "string",
        description:
          "Stored-file UUID returned by completeMultipartFileUpload.",
      },
    },
    required: ["fileId"] as string[],
    additionalProperties: false,
  } as unknown as SchemaLike,
  CompleteMultipartFileUploadRequest: {
    type: "object",
    description:
      "Finish a file-service multipart upload and create the stored-file record.",
    properties: {
      tempStoredfileName: {
        type: "string",
        minLength: 1,
        description:
          "Temp stored-file name returned by startMultipartFileUpload.",
      },
      parts: {
        type: "array",
        minItems: 1,
        items: {
          $ref: "#/components/schemas/CompleteMultipartFileUploadPart",
        },
        description:
          "Uploaded parts with ETags returned by the direct PUT responses.",
      },
      contentType: {
        anyOf: [{ type: "string", maxLength: 255 }, { type: "null" }],
        description:
          "MIME type for the stored-file record. Defaults to application/octet-stream.",
      },
      folder: {
        anyOf: [{ type: "string", maxLength: 512 }, { type: "null" }],
        description: "File-service folder. Defaults to `apps`.",
      },
    },
    required: ["tempStoredfileName", "parts"] as string[],
    additionalProperties: false,
  } as unknown as SchemaLike,
  FileIdInPathRequired: {
    type: "string",
    format: "opaque-id",
    description:
      "Opaque file identifier returned by the files APIs. This value is not guaranteed to be a UUID.",
  },
  MultipartUploadIdInPathRequired: {
    type: "string",
    format: "opaque-id",
    description:
      "File-service multipart upload id returned by startMultipartFileUpload.",
  },
  WorkspaceNoteIdInPathRequired: {
    type: "string",
    format: "opaque-id",
    description:
      "Opaque note identifier returned by the notes service. This value is not guaranteed to be a UUID.",
  },
  WorkspaceNoteParentIdInQueryOptional: {
    type: "string",
    format: "opaque-id",
    description:
      "Opaque parent folder identifier returned by the notes service.",
    nullable: true,
  },
  ListIsolatedStoresClientIdInQueryOptional: {
    type: "string",
    format: "opaque-id",
    description:
      "Client identifier matching an isolated store `app` source scope `sourceId` (same value as the token `client` scope for app-owned stores).",
    nullable: true,
  },
  /** MCP/jsonSchemaToZod: union literals must stay a string enum for tool_call path args. */
  IsolatedStoreStageInPathRequired: {
    type: "string",
    enum: ["dev", "prod"],
    description: "Isolated store deployment stage.",
  },
  GetOrCreateIsolatedStoreRequest: {
    type: "object",
    properties: {
      clientId: {
        type: "string",
      },
      alias: {
        type: "string",
      },
      storeType: {
        $ref: "#/components/schemas/IsolatedStoreType",
      },
      engine: {
        $ref: "#/components/schemas/IsolatedStoreEngine",
      },
      targetStage: {
        type: "string",
        enum: ["dev", "prod"],
        default: "prod",
        description:
          "Target stage for get-or-create flow. Defaults to `prod` when omitted by clients that honor schema defaults.",
      },
      source: {
        type: "object",
        nullable: true,
        properties: {
          orgId: {
            type: "string",
          },
          storeId: {
            type: "string",
            nullable: true,
          },
          alias: {
            type: "string",
            nullable: true,
          },
          stage: {
            type: "string",
            enum: ["dev", "prod"],
            default: "prod",
            description:
              "Source stage for template copy. Defaults to `prod` when omitted by clients that honor schema defaults.",
          },
          copyStrategy: {
            type: "string",
            enum: ["checkpoint_restore"],
            nullable: true,
          },
        },
        required: ["orgId", "stage"] as string[],
        additionalProperties: false,
      },
    },
    required: [
      "clientId",
      "alias",
      "storeType",
      "engine",
      "targetStage",
    ] as string[],
    additionalProperties: false,
  } as unknown as SchemaLike,
  IsolatedStoreSqlTableNameInPathRequired: {
    type: "string",
    description:
      "SQL table name inside the isolated store stage database, for example demo_customers.",
  },
  /** MCP/jsonSchemaToZod: Record<string, unknown> must accept scalars, not only nested objects. */
  CallMcpManagerServerToolRequest: {
    type: "object",
    properties: {
      toolName: {
        type: "string",
        description: "Name of the MCP server tool to call.",
      },
      args: {
        type: "object",
        description:
          "Tool arguments keyed by input name. Scalar JSON values are allowed; this is not an object-of-objects payload.",
        additionalProperties: true,
      },
    },
    required: ["args", "toolName"] as string[],
    additionalProperties: false,
  },
  /** MCP/jsonSchemaToZod: Record<string, unknown> must accept scalars, not only nested objects. */
  IsolatedStoreSqlInsertRequest: {
    type: "object",
    description:
      "Insert one row into a SQL table. `values` is a plain object whose field values may be strings, numbers, booleans, null, arrays, or nested JSON objects.",
    properties: {
      schemaName: {
        type: "string",
        nullable: true,
        description: "Optional schema name. Defaults to the stage schema.",
      },
      tableName: {
        type: "string",
        description: "Target SQL table name.",
      },
      values: {
        type: "object",
        description:
          "Row values keyed by column name. Scalar JSON values are allowed; this is not an object-of-objects payload.",
        additionalProperties: true,
      },
      returning: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
        description:
          'Optional list of columns to return after insert. Use ["*"] for all columns.',
      },
    },
    required: ["tableName", "values"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlBatchInsertRequest: {
    type: "object",
    description:
      "Insert multiple rows into a SQL table. Each row is a plain object whose field values may be scalar JSON values.",
    properties: {
      schemaName: {
        type: "string",
        nullable: true,
        description: "Optional schema name. Defaults to the stage schema.",
      },
      tableName: {
        type: "string",
        description: "Target SQL table name.",
      },
      rows: {
        type: "array",
        description:
          "Rows to insert. All rows should use the same set of columns. Scalar JSON values are allowed inside each row object. Max length per request: floor(65535 / columnCount) (Postgres bind-parameter limit).",
        items: {
          type: "object",
          additionalProperties: true,
        },
      },
      returning: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
        description:
          'Optional list of columns to return after insert. Use ["*"] for all columns.',
      },
    },
    required: ["rows", "tableName"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlImportRequest: {
    type: "object",
    description:
      "Bulk SQL import request. Use this for large CSV or TSV loads; the server streams the payload into postgres COPY FROM STDIN.",
    properties: {
      schemaName: {
        type: "string",
        nullable: true,
        description: "Optional schema name. Defaults to the stage schema.",
      },
      tableName: {
        type: "string",
        description: "Target SQL table name.",
      },
      format: {
        type: "string",
        enum: ["csv", "tsv"] as const,
        description: "Delimited payload format.",
      },
      data: {
        type: "string",
        description:
          "Raw CSV or TSV payload string to stream into COPY. Default max UTF-8 size 64MiB (ISOLATED_SQL_IMPORT_MAX_PAYLOAD_BYTES, hard cap 256MiB). Split larger files across multiple requests.",
      },
      columns: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
        description:
          "Optional explicit target column order. Use this when the file contains only a subset of table columns or when hasHeader is false.",
      },
      hasHeader: {
        type: "boolean",
        nullable: true,
        description:
          "Set true when the first row contains CSV or TSV column headers.",
      },
      nullString: {
        type: "string",
        nullable: true,
        description:
          "Optional token that should be treated as SQL NULL during COPY.",
      },
    },
    required: ["tableName", "format", "data"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlMigrationBundleEntry: {
    type: "object",
    description:
      "Single ordered SQL migration entry from the app bundle. Keep versions strictly increasing and stable across stages.",
    properties: {
      version: {
        type: "integer",
        minimum: 1,
        description: "Positive integer migration version.",
      },
      name: {
        type: "string",
        description: "Human-readable migration name.",
      },
      checksum: {
        type: "string",
        description:
          "Stable checksum of the SQL contents, for drift detection.",
      },
      sql: {
        type: "string",
        description:
          "SQL text for this migration. Multi-statement migration files are allowed.",
      },
    },
    required: ["version", "name", "checksum", "sql"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlMigrationBundle: {
    type: "object",
    description:
      "Ordered SQL migration bundle supplied by the app. Gate treats this as the source of truth for schema evolution on a stage.",
    properties: {
      bundleVersion: {
        type: "string",
        nullable: true,
        description:
          "Optional app or release version associated with this migration bundle.",
      },
      migrations: {
        type: "array",
        items: {
          $ref: "#/components/schemas/IsolatedStoreSqlMigrationBundleEntry",
        } as const,
        description:
          "Ordered migration entries. Versions must be strictly increasing.",
      },
    },
    required: ["migrations"] as string[],
    additionalProperties: false,
  },
  GetIsolatedStoreSqlMigrationStatusRequest: {
    type: "object",
    description:
      "Compare a SQL migration bundle against the migration journal in the selected stage database and return applied, pending, or drift status.",
    properties: {
      schemaName: {
        type: "string",
        nullable: true,
        description:
          "Optional schema name for the migration journal table. Defaults to the stage schema.",
      },
      bundle: {
        $ref: "#/components/schemas/IsolatedStoreSqlMigrationBundle",
      } as const,
      expectedLastAppliedVersion: {
        type: "integer",
        nullable: true,
        description:
          "Optional optimistic lock: must match the last applied migration version on the server, or null to require an empty journal. HTTP 409 when it disagrees.",
      },
      expectedLastAppliedChecksum: {
        type: "string",
        nullable: true,
        description:
          "Optional optimistic lock: must match the last journal row checksum. HTTP 409 when it disagrees.",
      },
    },
    required: ["bundle"] as string[],
    additionalProperties: false,
  },
  ApplyIsolatedStoreSqlMigrationsRequest: {
    type: "object",
    description:
      "Apply pending SQL migrations from an ordered bundle into the selected stage. Prod applies automatically create a checkpoint before pending migrations run.",
    properties: {
      schemaName: {
        type: "string",
        nullable: true,
        description:
          "Optional schema name for the migration journal table. Defaults to the stage schema.",
      },
      bundle: {
        $ref: "#/components/schemas/IsolatedStoreSqlMigrationBundle",
      } as const,
      dryRun: {
        type: "boolean",
        nullable: true,
        description:
          "When true, validates bundle prefix and optional journal-head locks only; does not execute SQL or write the journal.",
      },
      expectedLastAppliedVersion: {
        type: "integer",
        nullable: true,
        description:
          "Optional optimistic lock: must match the last applied migration version on the server, or null to require an empty journal.",
      },
      expectedLastAppliedChecksum: {
        type: "string",
        nullable: true,
        description:
          "Optional optimistic lock: must match the last journal row checksum.",
      },
    },
    required: ["bundle"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlUpdateRequest: {
    type: "object",
    description:
      "Update rows in a SQL table. `values` is a plain object whose field values may be strings, numbers, booleans, null, arrays, or nested JSON objects.",
    properties: {
      schemaName: {
        type: "string",
        nullable: true,
        description: "Optional schema name. Defaults to the stage schema.",
      },
      tableName: {
        type: "string",
        description: "Target SQL table name.",
      },
      values: {
        type: "object",
        description:
          "Updated column values keyed by column name. Scalar JSON values are allowed; this is not an object-of-objects payload.",
        additionalProperties: true,
      },
      filters: {
        type: "array",
        nullable: true,
        items: { $ref: "#/components/schemas/IsolatedStoreSqlFilter" } as const,
        description:
          "AND filters for the update. Omit only when allowAll=true is explicitly provided.",
      },
      allowAll: {
        type: "boolean",
        nullable: true,
        description:
          "Set true only when you intentionally want to update all rows in the table.",
      },
      returning: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
        description:
          'Optional list of columns to return after update. Use ["*"] for all columns.',
      },
    },
    required: ["tableName", "values"] as string[],
    additionalProperties: false,
  },
  /** MCP/jsonSchemaToZod: filter value must accept scalars and arrays (eq/in), not only objects. */
  IsolatedStoreSqlFilter: {
    type: "object",
    description:
      "Portable SQL filter for isolated store row operations. Use column + operator + value for most operators; omit value for is_null/is_not_null.",
    properties: {
      column: {
        type: "string",
        description: "Column name to filter on.",
      },
      operator: {
        $ref: "#/components/schemas/IsolatedStoreSqlFilterOperator",
      } as const,
      value: {
        description:
          "Compare value for eq/ne/gt/gte/lt/lte/like/ilike; use a JSON array for `in`. Scalar JSON values are allowed.",
      },
    },
    required: ["column", "operator"] as string[],
    additionalProperties: false,
  },
  CreateIsolatedStoreCheckpointRequest: {
    type: "object",
    description:
      "Create a revision checkpoint for the selected stage. When the engine is auto-configured, Gate also creates a physical snapshot and stores the resulting provider-backed reference in snapshotRef.",
    properties: {
      label: {
        type: "string",
        description: "Optional human-readable label for the checkpoint.",
      },
      snapshotRef: {
        type: "string",
        description:
          "Optional external snapshot reference to preserve in revision metadata alongside Gate-created physical snapshots.",
      },
      metadata: {
        type: "object",
        description:
          "Optional arbitrary JSON metadata. Primitive values, arrays, and nested objects are allowed.",
        additionalProperties: true,
      },
    },
    additionalProperties: false,
  },
  globalIdInPathRequired: {
    type: "string",
    format: "opaque-id",
    description:
      "Opaque portal global identifier. Portal globalIds are not UUIDs.",
  },
} satisfies Record<string, SchemaLike>;
