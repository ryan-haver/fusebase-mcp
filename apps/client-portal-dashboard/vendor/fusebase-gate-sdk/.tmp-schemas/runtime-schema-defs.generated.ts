/**
 * Runtime Schema Definitions
 *
 * Generated from TypeScript contract files
 * This file provides InlineSchema definitions for runtime $ref resolution
 */

import type { SchemaLike } from "@fusebase-platform/contracts";

export const serviceRuntimeSchemaDefs: Record<string, SchemaLike> = {
  ActivateAppMagicLinkResponse: {
    type: "object",
    description: "Response body for activateAppMagicLink.",
    properties: {
      appFeatureId: {
        type: "string",
        description:
          "globalId of the resolved app feature whose access the tokens are scoped to.",
      },
      dashboardToken: {
        type: "string",
        description:
          "Dashboard service token scoped to the same feature and user. May be empty\nif upstream token issuance failed.",
      },
      expiresAt: {
        type: "number",
        description: "Unix timestamp (seconds) when the magic link expires.",
      },
      featureToken: {
        type: "string",
        description:
          "Fusebase Gate token scoped to the resolved app feature and target user.\nMay be empty if upstream token issuance failed; the activation itself\nstill succeeded and the SPA can retry.",
      },
      id: {
        type: "string",
        description: "globalId of the magic link that was activated.",
      },
      redirectPath: {
        type: "string",
        description:
          "Relative app path the SPA should navigate to after the cookie is set\n(e.g. /proposals/abc). Defaults to `/` when no `redirectPath` was provided\nwhen the link was created.",
      },
      sessionToken: {
        type: "string",
        description: "Session id usable as the `eversessionid` cookie value.",
      },
    },
    required: [
      "appFeatureId",
      "dashboardToken",
      "expiresAt",
      "featureToken",
      "id",
      "redirectPath",
      "sessionToken",
    ] as string[],
    additionalProperties: false,
  },
  AddGroupToWorkspaceRequest: {
    type: "object",
    properties: {
      groupId: {
        type: "string",
      },
      role: {
        type: "string",
      },
      type: {
        type: "string",
        enum: ["full", "partial"] as const,
        nullable: true,
      },
    },
    required: ["groupId", "role"] as string[],
    additionalProperties: false,
  },
  AddMembersToOrgGroupRequest: {
    type: "object",
    properties: {
      userIds: {
        type: "array",
        items: {
          type: "number",
        },
      },
    },
    required: ["userIds"] as string[],
    additionalProperties: false,
  },
  AddMembersToOrgGroupResponse: {
    type: "object",
    properties: {
      members: {
        type: "array",
        items: { $ref: "#/components/schemas/OrgGroupMember" } as const,
      },
    },
    required: ["members"] as string[],
    additionalProperties: false,
  },
  AddWorkspaceNoteAttachmentRequest: {
    type: "object",
    properties: {
      storedFileUUID: {
        type: "string",
        description:
          "Stored-file UUID returned by completeMultipartFileUpload.",
      },
    },
    required: ["storedFileUUID"] as string[],
    additionalProperties: false,
  },
  AddWorkspaceNoteAttachmentResponse: {
    type: "object",
    properties: {
      attachment: {
        $ref: "#/components/schemas/WorkspaceNoteAttachment",
      } as const,
    },
    required: ["attachment"] as string[],
    additionalProperties: false,
  },
  AdoptIsolatedStoreSqlMigrationBaselineRequest: {
    type: "object",
    properties: {
      bundle: {
        $ref: "#/components/schemas/IsolatedStoreSqlMigrationBundle",
      } as const,
      dryRun: {
        type: "boolean",
        description:
          "Validate eligibility and return the projected post-adoption status without writing the journal.",
        nullable: true,
      },
      rlsManifest: {
        $ref: "#/components/schemas/IsolatedStoreSqlRlsManifest",
      } as const,
      schemaName: {
        type: "string",
        nullable: true,
      },
    },
    required: ["bundle"] as string[],
    additionalProperties: false,
  },
  AdoptIsolatedStoreSqlMigrationBaselineResponse: {
    type: "object",
    properties: {
      adoptedCount: {
        type: "number",
      },
      adoptedVersions: {
        type: "array",
        items: {
          type: "number",
        },
      },
      checkpointRevision: {
        $ref: "#/components/schemas/IsolatedStoreRevision",
      } as const,
      dryRun: {
        type: "boolean",
        nullable: true,
      },
      status: {
        $ref: "#/components/schemas/IsolatedStoreSqlMigrationStatus",
      } as const,
    },
    required: ["adoptedCount", "adoptedVersions", "status"] as string[],
    additionalProperties: false,
  },
  AppApiOperation: {
    type: "object",
    properties: {
      allowedCallers: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
      },
      appId: {
        type: "string",
      },
      createdAt: {
        type: "number",
      },
      description: {
        type: "string",
        nullable: true,
      },
      executionMode: {
        type: "string",
        nullable: true,
      },
      id: {
        type: "number",
        nullable: true,
      },
      manifestVersion: {
        type: "string",
        nullable: true,
      },
      method: {
        type: "string",
      },
      operationId: {
        type: "string",
      },
      orgId: {
        type: "string",
      },
      path: {
        type: "string",
      },
      productId: {
        type: "string",
      },
      publishedAt: {
        type: "string",
        nullable: true,
      },
      requiredPermissions: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
      },
      summary: {
        type: "string",
        nullable: true,
      },
      tags: {
        type: "array",
        items: {
          type: "string",
        },
      },
      title: {
        type: "string",
        nullable: true,
      },
      updatedAt: {
        type: "number",
      },
      visibility: {
        type: "string",
        nullable: true,
      },
    },
    required: [
      "appId",
      "createdAt",
      "method",
      "operationId",
      "orgId",
      "path",
      "productId",
      "tags",
      "updatedAt",
    ] as string[],
    additionalProperties: false,
  },
  AppApiOperationListResponse: {
    type: "object",
    properties: {
      operations: {
        type: "array",
        items: { $ref: "#/components/schemas/AppApiOperation" } as const,
      },
    },
    required: ["operations"] as string[],
    additionalProperties: false,
  },
  ApplyIsolatedStoreSqlMigrationsRequest: {
    type: "object",
    properties: {
      bundle: {
        $ref: "#/components/schemas/IsolatedStoreSqlMigrationBundle",
      } as const,
      dryRun: {
        type: "boolean",
        description:
          "When true, runs the same journal/bundle prefix checks as apply (including optional\nexpected-head validation) but does not execute SQL or write the journal.",
        nullable: true,
      },
      expectedLastAppliedChecksum: {
        type: "string",
        description:
          "Optimistic lock: checksum of the last applied journal row must match.\nOmit to skip. Use `null` only together with an empty journal expectation.",
        nullable: true,
      },
      expectedLastAppliedVersion: {
        type: "number",
        description:
          "Optimistic lock: last applied migration version on the server must match.\nOmit to skip. Use `null` to require an empty journal (no rows applied).",
        nullable: true,
      },
      rlsManifest: {
        $ref: "#/components/schemas/IsolatedStoreSqlRlsManifest",
      } as const,
      schemaName: {
        type: "string",
        nullable: true,
      },
    },
    required: ["bundle"] as string[],
    additionalProperties: false,
  },
  ApplyIsolatedStoreSqlMigrationsResponse: {
    type: "object",
    properties: {
      appliedCount: {
        type: "number",
      },
      appliedVersions: {
        type: "array",
        items: {
          type: "number",
        },
      },
      checkpointRevision: {
        $ref: "#/components/schemas/IsolatedStoreRevision",
      } as const,
      dryRun: {
        type: "boolean",
        description:
          "Present and true when the request used `dryRun` and no migrations were executed.",
        nullable: true,
      },
      status: {
        $ref: "#/components/schemas/IsolatedStoreSqlMigrationStatus",
      } as const,
    },
    required: ["appliedCount", "appliedVersions", "status"] as string[],
    additionalProperties: false,
  },
  AttachIsolatedStoreSourceScopeRequest: {
    type: "object",
    properties: {
      source: {
        $ref: "#/components/schemas/IsolatedStoreSourceScope",
      } as const,
    },
    required: ["source"] as string[],
    additionalProperties: false,
  },
  AttachIsolatedStoreSourceScopeResponse: {
    type: "object",
    properties: {
      store: { $ref: "#/components/schemas/IsolatedStore" } as const,
    },
    required: ["store"] as string[],
    additionalProperties: false,
  },
  AuthScopeType: {
    type: "string",
    enum: ["workspace", "portal", "user", "client", "organization"] as const,
  },
  AuthStatus: {
    type: "string",
    enum: ["ACTIVE", "INITIATED", "FAILED", "EXPIRED"] as const,
  },
  AuthType: {
    type: "string",
    enum: ["oauth", "composio_managed", "token_bearer"] as const,
  },
  AuthenticatedUserSummary: {
    type: "object",
    properties: {
      email: {
        type: "string",
        nullable: true,
      },
      firstname: {
        type: "string",
        nullable: true,
      },
      id: {
        type: "number",
      },
      lastname: {
        type: "string",
        nullable: true,
      },
    },
    required: ["id"] as string[],
    additionalProperties: false,
  },
  CallAppApiRequest: {
    type: "object",
    properties: {
      body: {
        type: "object",
        additionalProperties: true,
      },
      path: {
        type: "object",
        nullable: true,
        additionalProperties: {
          type: "string",
        },
      },
      query: {
        type: "object",
        nullable: true,
        additionalProperties: {
          oneOf: [
            {
              type: "string",
            },
            {
              type: "number",
            },
            {
              type: "boolean",
              enum: [false] as const,
            },
            {
              type: "boolean",
              enum: [true] as const,
            },
          ] as SchemaLike[],
        },
      },
    },
    additionalProperties: false,
  },
  CallAppApiResponse: {
    type: "object",
    properties: {
      contentType: {
        type: "string",
        nullable: true,
      },
      data: {
        type: "object",
        additionalProperties: true,
      },
      ok: {
        type: "boolean",
      },
      status: {
        type: "number",
      },
      text: {
        type: "string",
        nullable: true,
      },
    },
    required: ["ok", "status"] as string[],
    additionalProperties: false,
  },
  CallMcpManagerServerToolRequest: {
    type: "object",
    properties: {
      args: {
        type: "object",
        additionalProperties: {
          type: "object",
          additionalProperties: true,
        },
      },
      toolName: {
        type: "string",
      },
    },
    required: ["args", "toolName"] as string[],
    additionalProperties: false,
  },
  CallMcpManagerServerToolResponse: {
    type: "object",
    additionalProperties: true,
  },
  CompleteMultipartFileUploadPart: {
    type: "object",
    properties: {
      etag: {
        type: "string",
      },
      partNumber: {
        type: "number",
      },
    },
    required: ["etag", "partNumber"] as string[],
    additionalProperties: false,
  },
  CompleteMultipartFileUploadRequest: {
    type: "object",
    properties: {
      contentType: {
        type: "string",
        nullable: true,
      },
      folder: {
        type: "string",
        nullable: true,
      },
      parts: {
        type: "array",
        items: {
          $ref: "#/components/schemas/CompleteMultipartFileUploadPart",
        } as const,
      },
      tempStoredfileName: {
        type: "string",
      },
    },
    required: ["parts", "tempStoredfileName"] as string[],
    additionalProperties: false,
  },
  CompleteMultipartFileUploadResponse: {
    type: "object",
    properties: {
      committed: {
        type: "boolean",
      },
      contentType: {
        type: "string",
      },
      fileId: {
        type: "string",
      },
      filename: {
        type: "string",
      },
      kind: {
        type: "string",
      },
      partCount: {
        type: "number",
      },
      publicFileName: {
        type: "string",
        description:
          "File-service public object name returned by finish multipart upload.",
      },
      readUrl: {
        type: "string",
        format: "uri",
        description:
          "Public URL built from the file-service public object name.",
      },
      size: {
        type: "number",
      },
      storedFileUUID: {
        type: "string",
      },
    },
    required: [
      "committed",
      "contentType",
      "fileId",
      "filename",
      "kind",
      "partCount",
      "publicFileName",
      "readUrl",
      "size",
      "storedFileUUID",
    ] as string[],
    additionalProperties: false,
  },
  CreateAppMagicLinkRequest: {
    type: "object",
    description:
      "Request body for createAppMagicLink (owner/admin invite flow).",
    properties: {
      addToAccessPrincipals: {
        type: "boolean",
        description:
          "When true (default), append a user principal to every feature of the app\nand provision a new user record if the email is not yet known.\nWhen false, the user must already exist or the call rejects with NotFound.",
        nullable: true,
      },
      email: {
        type: "string",
        format: "email",
        description:
          "Recipient email address. The link is dispatched to this address.",
      },
      redirectPath: {
        type: "string",
        description:
          "Relative app path to land on after activation (e.g. /proposals/abc).\nOmit for root.",
        nullable: true,
      },
    },
    required: ["email"] as string[],
    additionalProperties: false,
  },
  CreateAppMagicLinkResponse: {
    type: "object",
    description: "Response body for createAppMagicLink.",
    properties: {
      expiresAt: {
        type: "number",
        description:
          "Unix timestamp (seconds) when the link expires (createdAt + 24h).",
      },
      id: {
        type: "string",
        description:
          "globalId of the magic link row, also the value passed to the activation\nendpoint.",
      },
      magicLinkUrl: {
        type: "string",
        description:
          "Fully qualified URL to the app `/link` route with `id` (and optional\n`redirect`) query params.",
      },
    },
    required: ["expiresAt", "id", "magicLinkUrl"] as string[],
    additionalProperties: false,
  },
  CreateIsolatedStoreCheckpointRequest: {
    type: "object",
    properties: {
      label: {
        type: "string",
        nullable: true,
      },
      metadata: {
        type: "object",
        nullable: true,
        additionalProperties: {
          type: "object",
          additionalProperties: true,
        },
      },
      snapshotRef: {
        type: "string",
        nullable: true,
      },
    },
    additionalProperties: false,
  },
  CreateIsolatedStoreCheckpointResponse: {
    type: "object",
    properties: {
      revision: { $ref: "#/components/schemas/IsolatedStoreRevision" } as const,
    },
    required: ["revision"] as string[],
    additionalProperties: false,
  },
  CreateIsolatedStoreRequest: {
    type: "object",
    properties: {
      alias: {
        type: "string",
      },
      engine: { $ref: "#/components/schemas/IsolatedStoreEngine" } as const,
      source: {
        $ref: "#/components/schemas/IsolatedStoreSourceScope",
      } as const,
      storeType: { $ref: "#/components/schemas/IsolatedStoreType" } as const,
    },
    required: ["alias", "engine", "source", "storeType"] as string[],
    additionalProperties: false,
  },
  CreateIsolatedStoreResponse: {
    type: "object",
    properties: {
      store: { $ref: "#/components/schemas/IsolatedStore" } as const,
    },
    required: ["store"] as string[],
    additionalProperties: false,
  },
  CreateMcpManagerServerFromTemplateRequest: {
    type: "object",
    properties: {
      args: { $ref: "#/components/schemas/TemplateArgs" } as const,
      authId: {
        type: "string",
        nullable: true,
      },
      channels: {
        type: "array",
        items: {
          $ref: "#/components/schemas/McpManagerServerChannel",
        } as const,
      },
      globalId: {
        type: "string",
      },
      name: {
        type: "string",
        nullable: true,
      },
      prompt: {
        type: "string",
        nullable: true,
      },
      scopes: {
        type: "array",
        items: { $ref: "#/components/schemas/McpManagerScope" } as const,
      },
    },
    required: ["channels", "globalId", "scopes"] as string[],
    additionalProperties: false,
  },
  CreatePortalRequest: {
    type: "object",
    properties: {
      domain: {
        type: "string",
      },
      name: {
        type: "string",
        nullable: true,
      },
      theme: {
        type: "string",
        enum: [
          "light_purple",
          "soft_light",
          "quite_green",
          "space_gray",
          "carbon",
          "oxford",
          "ultramarine",
          "milky_blue",
          "shades_of_green",
          "savvy_red",
          "light_orange",
          "light_blue",
          "lemon_drop",
        ] as const,
        description:
          "Color theme key for the portal. When provided, applied via updateThemeSettings changeEvent.",
        nullable: true,
      },
      workspaceId: {
        type: "string",
      },
    },
    required: ["domain", "workspaceId"] as string[],
    additionalProperties: false,
  },
  CreatePortalResponse: {
    type: "object",
    properties: {
      portal: { $ref: "#/components/schemas/PortalDetail" } as const,
    },
    required: ["portal"] as string[],
    additionalProperties: false,
  },
  CreateWorkspaceNoteFolderRequest: {
    type: "object",
    properties: {
      parentId: {
        type: "string",
        description: "Parent folder global id. Defaults to `default`.",
        nullable: true,
      },
      title: {
        type: "string",
      },
    },
    required: ["title"] as string[],
    additionalProperties: false,
  },
  CreateWorkspaceNoteFolderResponse: {
    type: "object",
    properties: {
      folder: { $ref: "#/components/schemas/WorkspaceNoteSummary" } as const,
    },
    required: ["folder"] as string[],
    additionalProperties: false,
  },
  CreateWorkspaceNoteRequest: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description:
          "Optional initial text or html appended to the note after creation.",
        nullable: true,
      },
      format: {
        type: "string",
        enum: ["text", "html"] as const,
        description: "Content format used with `content`. Defaults to `text`.",
        nullable: true,
      },
      parentId: {
        type: "string",
        description: "Parent folder global id. Defaults to `default`.",
        nullable: true,
      },
      title: {
        type: "string",
      },
    },
    required: ["title"] as string[],
    additionalProperties: false,
  },
  CreateWorkspaceNoteResponse: {
    type: "object",
    properties: {
      note: { $ref: "#/components/schemas/WorkspaceNoteSummary" } as const,
    },
    required: ["note"] as string[],
    additionalProperties: false,
  },
  CreateWorkspaceRequest: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Display name for the new workspace. Required.",
      },
    },
    required: ["title"] as string[],
    additionalProperties: false,
  },
  DeleteFileRequest: {
    type: "object",
    properties: {
      fileId: {
        type: "string",
      },
    },
    required: ["fileId"] as string[],
    additionalProperties: false,
  },
  DeleteFileResponse: {
    type: "object",
    properties: {
      deleted: {
        type: "boolean",
      },
      fileId: {
        type: "string",
      },
    },
    required: ["deleted", "fileId"] as string[],
    additionalProperties: false,
  },
  DeleteIsolatedStoreResponse: {
    type: "object",
    properties: {
      deleted: {
        type: "boolean",
        enum: [true] as const,
      },
      storeId: {
        type: "string",
      },
    },
    required: ["deleted", "storeId"] as string[],
    additionalProperties: false,
  },
  DeleteIsolatedStoreStageResponse: {
    type: "object",
    properties: {
      deleted: {
        type: "boolean",
        enum: [true] as const,
      },
      stage: {
        type: "string",
        enum: ["dev", "prod"] as const,
      },
    },
    required: ["deleted", "stage"] as string[],
    additionalProperties: false,
  },
  DeleteOrgGroupResponse: {
    type: "object",
    properties: {
      deleted: {
        type: "boolean",
      },
      groupId: {
        type: "string",
      },
    },
    required: ["deleted", "groupId"] as string[],
    additionalProperties: false,
  },
  DeleteWorkspaceGroupResponse: {
    type: "object",
    properties: {
      deleted: {
        type: "boolean",
      },
      groupId: {
        type: "string",
      },
      workspaceId: {
        type: "string",
      },
    },
    required: ["deleted", "groupId", "workspaceId"] as string[],
    additionalProperties: false,
  },
  DuplicatePortalRequest: {
    type: "object",
    properties: {
      domain: {
        type: "string",
      },
      name: {
        type: "string",
        nullable: true,
      },
      workspaceId: {
        type: "string",
      },
    },
    required: ["domain", "workspaceId"] as string[],
    additionalProperties: false,
  },
  FileUploadHeaders: {
    type: "object",
    additionalProperties: {
      type: "string",
    },
  },
  FileUploadMethod: {
    type: "string",
    enum: ["PUT"] as const,
  },
  FusebaseAuthChallenge: {
    type: "object",
    properties: {
      email: {
        type: "string",
        nullable: true,
      },
      image: {
        type: "string",
        nullable: true,
      },
      question: {
        type: "string",
        nullable: true,
      },
      state: {
        type: "string",
      },
      type: {
        type: "string",
      },
    },
    required: ["state", "type"] as string[],
    additionalProperties: false,
  },
  FusebaseAuthChallengeRequest: {
    type: "object",
    properties: {
      answer: {
        type: "string",
      },
      redirectPath: {
        type: "string",
        nullable: true,
      },
      state: {
        type: "string",
      },
    },
    required: ["answer", "state"] as string[],
    additionalProperties: false,
  },
  FusebaseAuthChallengeResponse: {
    type: "object",
    properties: {
      challenge: {
        $ref: "#/components/schemas/FusebaseAuthChallenge",
      } as const,
      redirectPath: {
        type: "string",
      },
      session: { $ref: "#/components/schemas/FusebaseAuthSession" } as const,
      status: {
        type: "string",
        enum: ["authenticated", "challenge_required"] as const,
      },
    },
    required: ["redirectPath", "status"] as string[],
    additionalProperties: false,
  },
  FusebaseAuthLoginRequest: {
    type: "object",
    properties: {
      device: {
        type: "object",
        nullable: true,
        additionalProperties: {
          type: "object",
          additionalProperties: true,
        },
      },
      email: {
        type: "string",
        format: "email",
        description: "User email. Forwarded to auth-form as `login`.",
      },
      password: {
        type: "string",
      },
      redirectPath: {
        type: "string",
        nullable: true,
      },
    },
    required: ["email", "password"] as string[],
    additionalProperties: false,
  },
  FusebaseAuthLoginResponse: {
    type: "object",
    properties: {
      challenge: {
        $ref: "#/components/schemas/FusebaseAuthChallenge",
      } as const,
      redirectPath: {
        type: "string",
      },
      session: { $ref: "#/components/schemas/FusebaseAuthSession" } as const,
      status: {
        type: "string",
        enum: ["authenticated", "challenge_required"] as const,
      },
    },
    required: ["redirectPath", "status"] as string[],
    additionalProperties: false,
  },
  FusebaseAuthLogoutResponse: {
    type: "object",
    properties: {
      cookiesToDelete: {
        type: "array",
        description: "App/BFF should clear these cookies on its own domain.",
        items: {
          type: "string",
        },
      },
      ok: {
        type: "boolean",
        enum: [true] as const,
      },
    },
    required: ["cookiesToDelete", "ok"] as string[],
    additionalProperties: false,
  },
  FusebaseAuthPasswordResetRequest: {
    type: "object",
    properties: {
      password: {
        type: "string",
      },
    },
    required: ["password"] as string[],
    additionalProperties: false,
  },
  FusebaseAuthPasswordResetResponse: {
    type: "object",
    properties: {
      ok: {
        type: "boolean",
        enum: [true] as const,
      },
    },
    required: ["ok"] as string[],
    additionalProperties: false,
  },
  FusebaseAuthPasswordRestoreKeyResponse: {
    type: "object",
    properties: {
      valid: {
        type: "boolean",
      },
    },
    required: ["valid"] as string[],
    additionalProperties: false,
  },
  FusebaseAuthPasswordRestoreRequest: {
    type: "object",
    properties: {
      customAuthUrl: {
        type: "string",
        nullable: true,
      },
      email: {
        type: "string",
        format: "email",
        description: "User email. The response is intentionally generic.",
      },
      portalId: {
        type: "string",
        nullable: true,
      },
      workspaceId: {
        type: "string",
        nullable: true,
      },
    },
    required: ["email"] as string[],
    additionalProperties: false,
  },
  FusebaseAuthPasswordRestoreResponse: {
    type: "object",
    properties: {
      ok: {
        type: "boolean",
        enum: [true] as const,
      },
    },
    required: ["ok"] as string[],
    additionalProperties: false,
  },
  FusebaseAuthRegisterMemberRequest: {
    type: "object",
    properties: {
      defaultWorkspaceRole: {
        type: "string",
        nullable: true,
      },
      email: {
        type: "string",
        format: "email",
        description: "User email. Forwarded to auth-form as `login`.",
      },
      firstName: {
        type: "string",
        nullable: true,
      },
      fullName: {
        type: "string",
        nullable: true,
      },
      lastName: {
        type: "string",
        nullable: true,
      },
      memberTTL: {
        type: "number",
        nullable: true,
      },
      orgRole: {
        type: "string",
        description:
          "Org role to grant after the Fusebase account is created.\nDefaults to `client`.",
        nullable: true,
      },
      password: {
        type: "string",
      },
      redirectPath: {
        type: "string",
        nullable: true,
      },
      subscribe: {
        type: "boolean",
        nullable: true,
      },
      tags: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
      },
    },
    required: ["email", "password"] as string[],
    additionalProperties: false,
  },
  FusebaseAuthRegisterMemberResponse: {
    type: "object",
    properties: {
      challenge: {
        $ref: "#/components/schemas/FusebaseAuthChallenge",
      } as const,
      membership: {
        type: "object",
        nullable: true,
        properties: {
          memberTTL: {
            type: "number",
            nullable: true,
          },
          orgId: {
            type: "string",
          },
          role: {
            type: "string",
          },
          userId: {
            type: "number",
          },
        },
        required: ["orgId", "role", "userId"] as string[],
        additionalProperties: false,
      },
      redirectPath: {
        type: "string",
      },
      session: { $ref: "#/components/schemas/FusebaseAuthSession" } as const,
      status: {
        type: "string",
        enum: ["authenticated", "challenge_required"] as const,
      },
    },
    required: ["redirectPath", "status"] as string[],
    additionalProperties: false,
  },
  FusebaseAuthRegisterRequest: {
    type: "object",
    properties: {
      email: {
        type: "string",
        format: "email",
        description: "User email. Forwarded to auth-form as `login`.",
      },
      firstName: {
        type: "string",
        nullable: true,
      },
      fullName: {
        type: "string",
        nullable: true,
      },
      lastName: {
        type: "string",
        nullable: true,
      },
      password: {
        type: "string",
      },
      redirectPath: {
        type: "string",
        nullable: true,
      },
      subscribe: {
        type: "boolean",
        nullable: true,
      },
      tags: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
      },
    },
    required: ["email", "password"] as string[],
    additionalProperties: false,
  },
  FusebaseAuthRegisterResponse: {
    type: "object",
    properties: {
      challenge: {
        $ref: "#/components/schemas/FusebaseAuthChallenge",
      } as const,
      redirectPath: {
        type: "string",
      },
      session: { $ref: "#/components/schemas/FusebaseAuthSession" } as const,
      status: {
        type: "string",
        enum: ["authenticated", "challenge_required"] as const,
      },
    },
    required: ["redirectPath", "status"] as string[],
    additionalProperties: false,
  },
  FusebaseAuthSession: {
    type: "object",
    properties: {
      sessionId: {
        type: "string",
      },
      userId: {
        type: "number",
      },
    },
    required: ["sessionId", "userId"] as string[],
    additionalProperties: false,
  },
  GetIsolatedStoreSqlMigrationStatusRequest: {
    type: "object",
    properties: {
      bundle: {
        $ref: "#/components/schemas/IsolatedStoreSqlMigrationBundle",
      } as const,
      expectedLastAppliedChecksum: {
        type: "string",
        nullable: true,
      },
      expectedLastAppliedVersion: {
        type: "number",
        description:
          "Same optimistic-lock semantics as `applyIsolatedStoreSqlMigrations`; HTTP 409 when the journal tail disagrees.",
        nullable: true,
      },
      rlsManifest: {
        $ref: "#/components/schemas/IsolatedStoreSqlRlsManifest",
      } as const,
      schemaName: {
        type: "string",
        nullable: true,
      },
    },
    required: ["bundle"] as string[],
    additionalProperties: false,
  },
  GetOrCreateIsolatedStoreRequest: {
    type: "object",
    properties: {
      alias: {
        type: "string",
      },
      clientId: {
        type: "string",
      },
      engine: { $ref: "#/components/schemas/IsolatedStoreEngine" } as const,
      source: {
        $ref: "#/components/schemas/GetOrCreateIsolatedStoreSource",
      } as const,
      storeType: { $ref: "#/components/schemas/IsolatedStoreType" } as const,
      targetStage: {
        type: "string",
        enum: ["dev", "prod"] as const,
      },
    },
    required: [
      "alias",
      "clientId",
      "engine",
      "storeType",
      "targetStage",
    ] as string[],
    additionalProperties: false,
  },
  GetOrCreateIsolatedStoreResponse: {
    type: "object",
    properties: {
      cloned: {
        type: "boolean",
      },
      copiedFromRevision: {
        $ref: "#/components/schemas/IsolatedStoreRevision",
      } as const,
      created: {
        type: "boolean",
      },
      lineageMetadata: {
        type: "object",
        nullable: true,
        additionalProperties: {
          type: "object",
          additionalProperties: true,
        },
      },
      source: {
        type: "object",
        nullable: true,
        properties: {
          alias: {
            type: "string",
          },
          orgId: {
            type: "string",
          },
          stage: {
            type: "string",
            enum: ["dev", "prod"] as const,
          },
          storeId: {
            type: "string",
          },
        },
        required: ["alias", "orgId", "stage", "storeId"] as string[],
        additionalProperties: false,
      },
      stageInstance: {
        $ref: "#/components/schemas/IsolatedStoreStageInstance",
      } as const,
      store: { $ref: "#/components/schemas/IsolatedStore" } as const,
    },
    required: ["cloned", "created", "stageInstance", "store"] as string[],
    additionalProperties: false,
  },
  GetOrCreateIsolatedStoreSource: {
    type: "object",
    properties: {
      alias: {
        type: "string",
        nullable: true,
      },
      copyStrategy: {
        type: "string",
        enum: ["checkpoint_restore"] as const,
        nullable: true,
      },
      orgId: {
        type: "string",
      },
      stage: {
        type: "string",
        enum: ["dev", "prod"] as const,
      },
      storeId: {
        type: "string",
        nullable: true,
      },
    },
    required: ["orgId", "stage"] as string[],
    additionalProperties: false,
  },
  InitIsolatedStoreStageRequest: {
    type: "object",
    properties: {
      bindingConfig: {
        $ref: "#/components/schemas/IsolatedStorePostgresBindingConfig",
      } as const,
      provisioningMetadata: {
        type: "object",
        nullable: true,
        additionalProperties: {
          type: "object",
          additionalProperties: true,
        },
      },
      stage: {
        type: "string",
        enum: ["dev", "prod"] as const,
      },
      status: {
        type: "string",
        enum: ["disabled", "provisioning", "ready", "failed"] as const,
        nullable: true,
      },
    },
    required: ["stage"] as string[],
    additionalProperties: false,
  },
  InitIsolatedStoreStageResponse: {
    type: "object",
    properties: {
      stageInstance: {
        $ref: "#/components/schemas/IsolatedStoreStageInstance",
      } as const,
    },
    required: ["stageInstance"] as string[],
    additionalProperties: false,
  },
  InitiateMcpManagerAuthRequest: {
    oneOf: [
      {
        type: "object",
        properties: {
          app: {
            type: "string",
          },
          globalId: {
            type: "string",
          },
          name: {
            type: "string",
            nullable: true,
          },
          replaceInactiveAuth: {
            type: "boolean",
            nullable: true,
          },
          scopes: {
            type: "array",
            items: { $ref: "#/components/schemas/McpManagerScope" } as const,
          },
          type: {
            type: "string",
            enum: ["oauth"] as const,
          },
        },
        required: ["app", "globalId", "scopes", "type"] as string[],
        additionalProperties: false,
      },
      {
        type: "object",
        properties: {
          app: {
            type: "string",
          },
          globalId: {
            type: "string",
          },
          name: {
            type: "string",
            nullable: true,
          },
          replaceInactiveAuth: {
            type: "boolean",
            nullable: true,
          },
          scopes: {
            type: "array",
            items: { $ref: "#/components/schemas/McpManagerScope" } as const,
          },
          type: {
            type: "string",
            enum: ["composio_managed"] as const,
          },
        },
        required: ["app", "globalId", "scopes", "type"] as string[],
        additionalProperties: false,
      },
      {
        type: "object",
        properties: {
          app: {
            type: "string",
          },
          globalId: {
            type: "string",
          },
          name: {
            type: "string",
            nullable: true,
          },
          replaceInactiveAuth: {
            type: "boolean",
            nullable: true,
          },
          scopes: {
            type: "array",
            items: { $ref: "#/components/schemas/McpManagerScope" } as const,
          },
          token: {
            type: "string",
          },
          type: {
            type: "string",
            enum: ["token_bearer"] as const,
          },
        },
        required: ["app", "globalId", "scopes", "token", "type"] as string[],
        additionalProperties: false,
      },
    ] as SchemaLike[],
  },
  InitiateMcpManagerComposioManagedRequest: {
    type: "object",
    properties: {
      app: {
        type: "string",
      },
      globalId: {
        type: "string",
      },
      name: {
        type: "string",
        nullable: true,
      },
      replaceInactiveAuth: {
        type: "boolean",
        nullable: true,
      },
      scopes: {
        type: "array",
        items: { $ref: "#/components/schemas/McpManagerScope" } as const,
      },
      type: {
        type: "string",
        enum: ["composio_managed"] as const,
      },
    },
    required: ["app", "globalId", "scopes", "type"] as string[],
    additionalProperties: false,
  },
  InitiateMcpManagerOAuthRequest: {
    type: "object",
    properties: {
      app: {
        type: "string",
      },
      globalId: {
        type: "string",
      },
      name: {
        type: "string",
        nullable: true,
      },
      replaceInactiveAuth: {
        type: "boolean",
        nullable: true,
      },
      scopes: {
        type: "array",
        items: { $ref: "#/components/schemas/McpManagerScope" } as const,
      },
      type: {
        type: "string",
        enum: ["oauth"] as const,
      },
    },
    required: ["app", "globalId", "scopes", "type"] as string[],
    additionalProperties: false,
  },
  InitiateMcpManagerTokenBearerRequest: {
    type: "object",
    properties: {
      app: {
        type: "string",
      },
      globalId: {
        type: "string",
      },
      name: {
        type: "string",
        nullable: true,
      },
      replaceInactiveAuth: {
        type: "boolean",
        nullable: true,
      },
      scopes: {
        type: "array",
        items: { $ref: "#/components/schemas/McpManagerScope" } as const,
      },
      token: {
        type: "string",
      },
      type: {
        type: "string",
        enum: ["token_bearer"] as const,
      },
    },
    required: ["app", "globalId", "scopes", "token", "type"] as string[],
    additionalProperties: false,
  },
  InviteToPortalRequest: {
    type: "object",
    properties: {
      email: {
        type: "string",
      },
      fullName: {
        type: "string",
        nullable: true,
      },
      isFullAccess: {
        type: "boolean",
        description:
          'Only relevant when orgRole="client".\ntrue  = Full access (sees all pages including private) — default.\nfalse = Shared only (public/shared pages only).\nFor orgRole "member" and "manager" this is always true and the field is ignored.',
        nullable: true,
      },
      orgRole: {
        type: "string",
        enum: ["client", "member", "manager"] as const,
        description:
          'Org role for the invitee (default: "client").\nSupported: "client", "member", "manager".',
        nullable: true,
      },
      workspaceRole: {
        type: "string",
        enum: ["reader", "editor"] as const,
        description: 'Workspace role (default: "editor").',
        nullable: true,
      },
    },
    required: ["email"] as string[],
    additionalProperties: false,
  },
  InviteToPortalResponse: {
    type: "object",
    properties: {
      magicLink: {
        type: "string",
        description:
          "Magic link for direct portal access (no email confirmation needed).",
      },
      url: {
        type: "string",
        description: "Portal URL.",
      },
      userId: {
        type: "number",
        description: "User ID in the system.",
      },
    },
    required: ["magicLink", "url", "userId"] as string[],
    additionalProperties: false,
  },
  IsolatedStore: {
    type: "object",
    properties: {
      alias: {
        type: "string",
      },
      createdAt: {
        type: "string",
      },
      createdByUserId: {
        type: "string",
      },
      engine: { $ref: "#/components/schemas/IsolatedStoreEngine" } as const,
      globalId: {
        type: "string",
      },
      scopes: {
        type: "array",
        items: { $ref: "#/components/schemas/IsolatedStoreScope" } as const,
      },
      sourceScopes: {
        type: "array",
        items: {
          $ref: "#/components/schemas/IsolatedStoreSourceScope",
        } as const,
      },
      status: { $ref: "#/components/schemas/IsolatedStoreStatus" } as const,
      storeType: { $ref: "#/components/schemas/IsolatedStoreType" } as const,
      updatedAt: {
        type: "string",
      },
    },
    required: [
      "alias",
      "createdAt",
      "createdByUserId",
      "engine",
      "globalId",
      "scopes",
      "sourceScopes",
      "status",
      "storeType",
      "updatedAt",
    ] as string[],
    additionalProperties: false,
  },
  IsolatedStoreBindingConfig: {
    type: "object",
    properties: {
      connectionMode: {
        type: "string",
        enum: ["raw", "server"] as const,
        nullable: true,
      },
      database: {
        type: "string",
      },
      host: {
        type: "string",
        nullable: true,
      },
      password: {
        type: "string",
        nullable: true,
      },
      port: {
        type: "number",
        nullable: true,
      },
      schema: {
        type: "string",
        nullable: true,
      },
      serverKey: {
        type: "string",
        nullable: true,
      },
      ssl: {
        type: "boolean",
        nullable: true,
      },
      user: {
        type: "string",
        nullable: true,
      },
      username: {
        type: "string",
        nullable: true,
      },
    },
    required: ["database"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreEngine: {
    type: "string",
    enum: ["postgres"] as const,
  },
  IsolatedStoreListResponse: {
    type: "object",
    properties: {
      stores: {
        type: "array",
        items: { $ref: "#/components/schemas/IsolatedStore" } as const,
      },
    },
    required: ["stores"] as string[],
    additionalProperties: false,
  },
  IsolatedStorePostgresBindingConfig: {
    type: "object",
    description:
      "Connection binding for a SQL/postgres isolated store stage (control plane + MCP).",
    properties: {
      connectionMode: {
        type: "string",
        enum: ["raw", "server"] as const,
        nullable: true,
      },
      database: {
        type: "string",
      },
      host: {
        type: "string",
        nullable: true,
      },
      password: {
        type: "string",
        nullable: true,
      },
      port: {
        type: "number",
        nullable: true,
      },
      schema: {
        type: "string",
        nullable: true,
      },
      serverKey: {
        type: "string",
        nullable: true,
      },
      ssl: {
        type: "boolean",
        nullable: true,
      },
      user: {
        type: "string",
        nullable: true,
      },
      username: {
        type: "string",
        nullable: true,
      },
    },
    required: ["database"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreResponse: {
    type: "object",
    properties: {
      store: { $ref: "#/components/schemas/IsolatedStore" } as const,
    },
    required: ["store"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreRevision: {
    type: "object",
    properties: {
      createdAt: {
        type: "string",
      },
      createdByUserId: {
        type: "string",
      },
      globalId: {
        type: "string",
      },
      kind: { $ref: "#/components/schemas/IsolatedStoreRevisionKind" } as const,
      label: {
        type: "string",
        nullable: true,
      },
      metadata: {
        type: "object",
        nullable: true,
        additionalProperties: {
          type: "object",
          additionalProperties: true,
        },
      },
      revisionNumber: {
        type: "number",
      },
      snapshotRef: {
        type: "string",
        nullable: true,
      },
      stage: {
        type: "string",
        enum: ["dev", "prod"] as const,
      },
      storeGlobalId: {
        type: "string",
      },
      updatedAt: {
        type: "string",
      },
    },
    required: [
      "createdAt",
      "createdByUserId",
      "globalId",
      "kind",
      "revisionNumber",
      "stage",
      "storeGlobalId",
      "updatedAt",
    ] as string[],
    additionalProperties: false,
  },
  IsolatedStoreRevisionKind: {
    type: "string",
    enum: ["checkpoint", "promotion"] as const,
  },
  IsolatedStoreRevisionListResponse: {
    type: "object",
    properties: {
      revisions: {
        type: "array",
        items: { $ref: "#/components/schemas/IsolatedStoreRevision" } as const,
      },
    },
    required: ["revisions"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreScope: {
    type: "object",
    properties: {
      scopeId: {
        type: "string",
      },
      scopeType: {
        $ref: "#/components/schemas/IsolatedStoreScopeType",
      } as const,
    },
    required: ["scopeId", "scopeType"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreScopeType: {
    type: "string",
    enum: [
      "org",
      "workspace",
      "portal",
      "user",
      "client",
      "block",
      "tracker",
      "parent_row",
      "parent_table",
    ] as const,
  },
  IsolatedStoreSourceScope: {
    type: "object",
    properties: {
      sourceId: {
        type: "string",
      },
      sourceType: {
        type: "string",
      },
    },
    required: ["sourceId", "sourceType"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlAppliedMigration: {
    type: "object",
    properties: {
      appliedAt: {
        type: "string",
      },
      appliedBy: {
        type: "string",
      },
      bundleVersion: {
        type: "string",
        nullable: true,
      },
      checksum: {
        type: "string",
      },
      name: {
        type: "string",
      },
      version: {
        type: "number",
      },
    },
    required: [
      "appliedAt",
      "appliedBy",
      "checksum",
      "name",
      "version",
    ] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlBatchInsertRequest: {
    type: "object",
    properties: {
      returning: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
      },
      rlsContext: {
        type: "object",
        nullable: true,
        additionalProperties: {
          nullable: true,
          oneOf: [
            {
              type: "string",
            },
            {
              type: "number",
            },
            {
              type: "boolean",
              enum: [false] as const,
            },
            {
              type: "boolean",
              enum: [true] as const,
            },
          ] as SchemaLike[],
        },
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
      schemaName: {
        type: "string",
        nullable: true,
      },
      tableName: {
        type: "string",
      },
      trustedRuntimeContext: {
        $ref: "#/components/schemas/IsolatedStoreSqlTrustedRuntimeContext",
      } as const,
    },
    required: ["rows", "tableName"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlBatchInsertResponse: {
    type: "object",
    properties: {
      rowCount: {
        type: "number",
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
    required: ["rowCount", "rows"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlColumn: {
    type: "object",
    properties: {
      columnName: {
        type: "string",
      },
      dataType: {
        type: "string",
      },
      defaultValue: {
        type: "string",
        nullable: true,
      },
      isNullable: {
        type: "boolean",
      },
      ordinalPosition: {
        type: "number",
      },
      udtName: {
        type: "string",
        nullable: true,
      },
    },
    required: [
      "columnName",
      "dataType",
      "isNullable",
      "ordinalPosition",
    ] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlCountRequest: {
    type: "object",
    properties: {
      filters: {
        type: "array",
        nullable: true,
        items: { $ref: "#/components/schemas/IsolatedStoreSqlFilter" } as const,
      },
      rlsContext: {
        type: "object",
        nullable: true,
        additionalProperties: {
          nullable: true,
          oneOf: [
            {
              type: "string",
            },
            {
              type: "number",
            },
            {
              type: "boolean",
              enum: [false] as const,
            },
            {
              type: "boolean",
              enum: [true] as const,
            },
          ] as SchemaLike[],
        },
      },
      schemaName: {
        type: "string",
        nullable: true,
      },
      tableName: {
        type: "string",
      },
      trustedRuntimeContext: {
        $ref: "#/components/schemas/IsolatedStoreSqlTrustedRuntimeContext",
      } as const,
    },
    required: ["tableName"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlCountResponse: {
    type: "object",
    properties: {
      count: {
        type: "number",
      },
    },
    required: ["count"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlDeleteRequest: {
    type: "object",
    properties: {
      allowAll: {
        type: "boolean",
        nullable: true,
      },
      filters: {
        type: "array",
        nullable: true,
        items: { $ref: "#/components/schemas/IsolatedStoreSqlFilter" } as const,
      },
      rlsContext: {
        type: "object",
        nullable: true,
        additionalProperties: {
          nullable: true,
          oneOf: [
            {
              type: "string",
            },
            {
              type: "number",
            },
            {
              type: "boolean",
              enum: [false] as const,
            },
            {
              type: "boolean",
              enum: [true] as const,
            },
          ] as SchemaLike[],
        },
      },
      schemaName: {
        type: "string",
        nullable: true,
      },
      tableName: {
        type: "string",
      },
      trustedRuntimeContext: {
        $ref: "#/components/schemas/IsolatedStoreSqlTrustedRuntimeContext",
      } as const,
    },
    required: ["tableName"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlDeleteResponse: {
    type: "object",
    properties: {
      rowCount: {
        type: "number",
      },
    },
    required: ["rowCount"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlDescribeTableQuery: {
    type: "object",
    properties: {
      schemaName: {
        type: "string",
        nullable: true,
      },
    },
    additionalProperties: false,
  },
  IsolatedStoreSqlDescribeTableResponse: {
    type: "object",
    properties: {
      table: {
        $ref: "#/components/schemas/IsolatedStoreSqlTableDescription",
      } as const,
    },
    required: ["table"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlExecuteRequest: {
    type: "object",
    properties: {
      params: {
        type: "array",
        nullable: true,
        items: {},
      },
      rlsContext: {
        type: "object",
        nullable: true,
        additionalProperties: {
          nullable: true,
          oneOf: [
            {
              type: "string",
            },
            {
              type: "number",
            },
            {
              type: "boolean",
              enum: [false] as const,
            },
            {
              type: "boolean",
              enum: [true] as const,
            },
          ] as SchemaLike[],
        },
      },
      sql: {
        type: "string",
      },
      trustedRuntimeContext: {
        $ref: "#/components/schemas/IsolatedStoreSqlTrustedRuntimeContext",
      } as const,
    },
    required: ["sql"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlExecuteResponse: {
    type: "object",
    properties: {
      result: {
        $ref: "#/components/schemas/IsolatedStoreSqlQueryResult",
      } as const,
    },
    required: ["result"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlFilter: {
    type: "object",
    properties: {
      column: {
        type: "string",
      },
      operator: {
        $ref: "#/components/schemas/IsolatedStoreSqlFilterOperator",
      } as const,
      value: {
        type: "object",
        additionalProperties: true,
      },
    },
    required: ["column", "operator"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlFilterOperator: {
    type: "string",
    enum: [
      "eq",
      "ne",
      "gt",
      "gte",
      "lt",
      "lte",
      "like",
      "ilike",
      "in",
      "is_null",
      "is_not_null",
    ] as const,
  },
  IsolatedStoreSqlImportFormat: {
    type: "string",
    enum: ["csv", "tsv"] as const,
  },
  IsolatedStoreSqlImportRequest: {
    type: "object",
    properties: {
      columns: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
      },
      data: {
        type: "string",
      },
      format: {
        $ref: "#/components/schemas/IsolatedStoreSqlImportFormat",
      } as const,
      hasHeader: {
        type: "boolean",
        nullable: true,
      },
      nullString: {
        type: "string",
        nullable: true,
      },
      rlsContext: {
        type: "object",
        nullable: true,
        additionalProperties: {
          nullable: true,
          oneOf: [
            {
              type: "string",
            },
            {
              type: "number",
            },
            {
              type: "boolean",
              enum: [false] as const,
            },
            {
              type: "boolean",
              enum: [true] as const,
            },
          ] as SchemaLike[],
        },
      },
      schemaName: {
        type: "string",
        nullable: true,
      },
      tableName: {
        type: "string",
      },
      trustedRuntimeContext: {
        $ref: "#/components/schemas/IsolatedStoreSqlTrustedRuntimeContext",
      } as const,
    },
    required: ["data", "format", "tableName"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlImportResponse: {
    type: "object",
    properties: {
      format: {
        $ref: "#/components/schemas/IsolatedStoreSqlImportFormat",
      } as const,
      imported: {
        type: "boolean",
        enum: [true] as const,
      },
      rowCount: {
        type: "number",
      },
      tableName: {
        type: "string",
      },
    },
    required: ["format", "imported", "rowCount", "tableName"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlInsertRequest: {
    type: "object",
    properties: {
      returning: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
      },
      rlsContext: {
        type: "object",
        nullable: true,
        additionalProperties: {
          nullable: true,
          oneOf: [
            {
              type: "string",
            },
            {
              type: "number",
            },
            {
              type: "boolean",
              enum: [false] as const,
            },
            {
              type: "boolean",
              enum: [true] as const,
            },
          ] as SchemaLike[],
        },
      },
      schemaName: {
        type: "string",
        nullable: true,
      },
      tableName: {
        type: "string",
      },
      trustedRuntimeContext: {
        $ref: "#/components/schemas/IsolatedStoreSqlTrustedRuntimeContext",
      } as const,
      values: {
        type: "object",
        additionalProperties: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
    required: ["tableName", "values"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlInsertResponse: {
    type: "object",
    properties: {
      rowCount: {
        type: "number",
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
    required: ["rowCount", "rows"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlListTablesQuery: {
    type: "object",
    properties: {
      schemaName: {
        type: "string",
        nullable: true,
      },
    },
    additionalProperties: false,
  },
  IsolatedStoreSqlListTablesResponse: {
    type: "object",
    properties: {
      tables: {
        type: "array",
        items: { $ref: "#/components/schemas/IsolatedStoreSqlTable" } as const,
      },
    },
    required: ["tables"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlMigrationBundle: {
    type: "object",
    properties: {
      bundleVersion: {
        type: "string",
        nullable: true,
      },
      migrations: {
        type: "array",
        items: {
          $ref: "#/components/schemas/IsolatedStoreSqlMigrationBundleEntry",
        } as const,
      },
    },
    required: ["migrations"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlMigrationBundleEntry: {
    type: "object",
    properties: {
      checksum: {
        type: "string",
      },
      name: {
        type: "string",
      },
      sql: {
        type: "string",
      },
      version: {
        type: "number",
      },
    },
    required: ["checksum", "name", "sql", "version"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlMigrationConflictErrorBody: {
    type: "object",
    description:
      "Documented shape of JSON error responses for migration state conflicts (HTTP 409).",
    properties: {
      data: {
        type: "object",
        properties: {
          code: {
            type: "string",
          },
          errorCode: {
            type: "string",
          },
          issues: {
            type: "array",
            nullable: true,
            items: {
              $ref: "#/components/schemas/IsolatedStoreSqlMigrationIssue",
            } as const,
          },
        },
        required: ["code", "errorCode"] as string[],
        additionalProperties: false,
      },
      message: {
        type: "string",
      },
      success: {
        type: "boolean",
        enum: [false] as const,
      },
    },
    required: ["data", "message", "success"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlMigrationIssue: {
    type: "object",
    description:
      "Machine-readable drift detail; omits raw SQL (only safe fingerprints).",
    properties: {
      actual: {
        description: "Value from the submitted bundle.",
        nullable: true,
        oneOf: [
          {
            type: "string",
          },
          {
            type: "number",
          },
        ] as SchemaLike[],
      },
      actualLastAppliedChecksum: {
        type: "string",
        nullable: true,
      },
      actualLastAppliedVersion: {
        type: "number",
        nullable: true,
      },
      bundle: {
        type: "object",
        nullable: true,
        properties: {
          checksum: {
            type: "string",
          },
          name: {
            type: "string",
          },
          version: {
            type: "number",
          },
        },
        required: ["checksum", "name", "version"] as string[],
        additionalProperties: false,
      },
      bundleSqlContentSha256: {
        type: "string",
        description:
          "SHA-256 of the bundle entry SQL UTF-8 bytes (diagnostic; not raw SQL).",
        nullable: true,
      },
      code: {
        $ref: "#/components/schemas/IsolatedStoreSqlMigrationIssueCode",
      } as const,
      expected: {
        description: "Value from the migration journal (applied history).",
        nullable: true,
        oneOf: [
          {
            type: "string",
          },
          {
            type: "number",
          },
        ] as SchemaLike[],
      },
      expectedLastAppliedChecksum: {
        type: "string",
        nullable: true,
      },
      expectedLastAppliedVersion: {
        type: "number",
        description:
          "Set when `expectedLastApplied*` optimistic locks fail (apply/status preflight).",
        nullable: true,
      },
      field: {
        $ref: "#/components/schemas/IsolatedStoreSqlMigrationIssueField",
      } as const,
      journal: {
        type: "object",
        nullable: true,
        properties: {
          checksum: {
            type: "string",
          },
          name: {
            type: "string",
          },
          version: {
            type: "number",
          },
        },
        required: ["checksum", "name", "version"] as string[],
        additionalProperties: false,
      },
      message: {
        type: "string",
      },
      version: {
        type: "number",
        description:
          "Bundle migration version at the comparison index when relevant.",
        nullable: true,
      },
    },
    required: ["code", "message"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlMigrationIssueCode: {
    type: "string",
    enum: [
      "isolated_sql_journal_longer_than_bundle",
      "isolated_sql_version_mismatch",
      "isolated_sql_name_mismatch",
      "isolated_sql_checksum_mismatch",
      "isolated_sql_schema_exists_without_journal",
      "isolated_sql_journal_head_mismatch",
    ] as const,
  },
  IsolatedStoreSqlMigrationIssueField: {
    type: "string",
    enum: [
      "history_length",
      "version",
      "name",
      "checksum",
      "bootstrap",
      "journal_head",
    ] as const,
  },
  IsolatedStoreSqlMigrationStatus: {
    type: "object",
    properties: {
      appliedCount: {
        type: "number",
      },
      appliedMigrations: {
        type: "array",
        items: {
          $ref: "#/components/schemas/IsolatedStoreSqlAppliedMigration",
        } as const,
      },
      bundleHeadVersion: {
        type: "number",
        nullable: true,
      },
      canApply: {
        type: "boolean",
        description:
          "True when the bundle prefix matches the journal and pending migrations may run.",
      },
      currentVersion: {
        type: "number",
        nullable: true,
      },
      databaseName: {
        type: "string",
      },
      isDrifted: {
        type: "boolean",
      },
      issues: {
        type: "array",
        items: {
          type: "string",
        },
      },
      journalTableName: {
        type: "string",
      },
      pendingCount: {
        type: "number",
      },
      pendingMigrations: {
        type: "array",
        items: {
          $ref: "#/components/schemas/IsolatedStoreSqlMigrationBundleEntry",
        } as const,
      },
      requiresBaselineAdoption: {
        type: "boolean",
        description:
          "True when the stage already has schema objects but no matching journaled migration history.",
      },
      rlsValidation: {
        $ref: "#/components/schemas/IsolatedStoreSqlRlsValidationResult",
      } as const,
      schemaName: {
        type: "string",
      },
      structuredIssues: {
        type: "array",
        items: {
          $ref: "#/components/schemas/IsolatedStoreSqlMigrationIssue",
        } as const,
      },
    },
    required: [
      "appliedCount",
      "appliedMigrations",
      "canApply",
      "databaseName",
      "isDrifted",
      "issues",
      "journalTableName",
      "pendingCount",
      "pendingMigrations",
      "requiresBaselineAdoption",
      "schemaName",
      "structuredIssues",
    ] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlQueryRequest: {
    type: "object",
    properties: {
      params: {
        type: "array",
        nullable: true,
        items: {},
      },
      rlsContext: {
        type: "object",
        nullable: true,
        additionalProperties: {
          nullable: true,
          oneOf: [
            {
              type: "string",
            },
            {
              type: "number",
            },
            {
              type: "boolean",
              enum: [false] as const,
            },
            {
              type: "boolean",
              enum: [true] as const,
            },
          ] as SchemaLike[],
        },
      },
      sql: {
        type: "string",
      },
      trustedRuntimeContext: {
        $ref: "#/components/schemas/IsolatedStoreSqlTrustedRuntimeContext",
      } as const,
    },
    required: ["sql"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlQueryResponse: {
    type: "object",
    properties: {
      result: {
        $ref: "#/components/schemas/IsolatedStoreSqlQueryResult",
      } as const,
    },
    required: ["result"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlQueryResult: {
    type: "object",
    properties: {
      columns: {
        type: "array",
        items: {
          type: "string",
        },
      },
      command: {
        type: "string",
      },
      rowCount: {
        type: "number",
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
    required: ["columns", "command", "rowCount", "rows"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlRlsContext: {
    type: "object",
    additionalProperties: {
      nullable: true,
      oneOf: [
        {
          type: "string",
        },
        {
          type: "number",
        },
        {
          type: "boolean",
          enum: [false] as const,
        },
        {
          type: "boolean",
          enum: [true] as const,
        },
      ] as SchemaLike[],
    },
  },
  IsolatedStoreSqlRlsContextValue: {
    nullable: true,
    oneOf: [
      {
        type: "string",
      },
      {
        type: "number",
      },
      {
        type: "boolean",
        enum: [false] as const,
      },
      {
        type: "boolean",
        enum: [true] as const,
      },
    ] as SchemaLike[],
  },
  IsolatedStoreSqlRlsIndex: {
    type: "object",
    properties: {
      columnNames: {
        type: "array",
        items: {
          type: "string",
        },
      },
      indexDefinition: {
        type: "string",
      },
      indexName: {
        type: "string",
      },
      isUnique: {
        type: "boolean",
      },
    },
    required: [
      "columnNames",
      "indexDefinition",
      "indexName",
      "isUnique",
    ] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlRlsManifest: {
    type: "object",
    properties: {
      tables: {
        type: "object",
        additionalProperties: {
          $ref: "#/components/schemas/IsolatedStoreSqlRlsTableManifest",
        } as const,
      },
    },
    required: ["tables"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlRlsPolicy: {
    type: "object",
    properties: {
      command: {
        type: "string",
      },
      policyName: {
        type: "string",
      },
      roles: {
        type: "array",
        items: {
          type: "string",
        },
      },
      usingExpression: {
        type: "string",
        nullable: true,
      },
      withCheckExpression: {
        type: "string",
        nullable: true,
      },
    },
    required: ["command", "policyName", "roles"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlRlsScopeManifest: {
    type: "object",
    properties: {
      column: {
        type: "string",
      },
      name: {
        type: "string",
      },
      setting: {
        type: "string",
        nullable: true,
      },
    },
    required: ["column", "name"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlRlsStatusResponse: {
    type: "object",
    properties: {
      bypassRls: {
        type: "boolean",
      },
      currentUser: {
        type: "string",
      },
      databaseName: {
        type: "string",
      },
      rlsEnabledCount: {
        type: "number",
      },
      rlsForcedCount: {
        type: "number",
      },
      schemaName: {
        type: "string",
      },
      superuser: {
        type: "boolean",
      },
      tableCount: {
        type: "number",
      },
      tables: {
        type: "array",
        items: {
          $ref: "#/components/schemas/IsolatedStoreSqlRlsTableStatus",
        } as const,
      },
    },
    required: [
      "bypassRls",
      "currentUser",
      "databaseName",
      "rlsEnabledCount",
      "rlsForcedCount",
      "schemaName",
      "superuser",
      "tableCount",
      "tables",
    ] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlRlsTableClassification: {
    type: "string",
    enum: [
      "user",
      "tenant",
      "owner_collaborator",
      "scoped",
      "none",
      "technical",
    ] as const,
  },
  IsolatedStoreSqlRlsTableManifest: {
    type: "object",
    properties: {
      classification: {
        $ref: "#/components/schemas/IsolatedStoreSqlRlsTableClassification",
      } as const,
      collaboratorTable: {
        type: "string",
        nullable: true,
      },
      orgColumn: {
        type: "string",
        nullable: true,
      },
      ownerColumn: {
        type: "string",
        nullable: true,
      },
      reason: {
        type: "string",
        nullable: true,
      },
      schemaName: {
        type: "string",
        nullable: true,
      },
      scopes: {
        type: "array",
        nullable: true,
        items: {
          $ref: "#/components/schemas/IsolatedStoreSqlRlsScopeManifest",
        } as const,
      },
      userColumn: {
        type: "string",
        nullable: true,
      },
    },
    required: ["classification"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlRlsTableStatus: {
    type: "object",
    properties: {
      columns: {
        type: "array",
        items: { $ref: "#/components/schemas/IsolatedStoreSqlColumn" } as const,
      },
      indexes: {
        type: "array",
        items: {
          $ref: "#/components/schemas/IsolatedStoreSqlRlsIndex",
        } as const,
      },
      policies: {
        type: "array",
        items: {
          $ref: "#/components/schemas/IsolatedStoreSqlRlsPolicy",
        } as const,
      },
      rlsEnabled: {
        type: "boolean",
      },
      rlsForced: {
        type: "boolean",
      },
      schemaName: {
        type: "string",
      },
      tableName: {
        type: "string",
      },
      tableType: {
        type: "string",
      },
      warnings: {
        type: "array",
        items: {
          $ref: "#/components/schemas/IsolatedStoreSqlRlsWarning",
        } as const,
      },
    },
    required: [
      "columns",
      "indexes",
      "policies",
      "rlsEnabled",
      "rlsForced",
      "schemaName",
      "tableName",
      "tableType",
      "warnings",
    ] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlRlsValidationResult: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["warn"] as const,
      },
      tableCount: {
        type: "number",
      },
      warningCount: {
        type: "number",
      },
      warnings: {
        type: "array",
        items: {
          $ref: "#/components/schemas/IsolatedStoreSqlRlsValidationWarning",
        } as const,
      },
    },
    required: ["mode", "tableCount", "warningCount", "warnings"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlRlsValidationWarning: {
    type: "object",
    properties: {
      code: {
        $ref: "#/components/schemas/IsolatedStoreSqlRlsValidationWarningCode",
      } as const,
      columnName: {
        type: "string",
        nullable: true,
      },
      message: {
        type: "string",
      },
      schemaName: {
        type: "string",
        nullable: true,
      },
      tableName: {
        type: "string",
      },
    },
    required: ["code", "message", "tableName"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlRlsValidationWarningCode: {
    type: "string",
    enum: [
      "rls_manifest_table_missing",
      "rls_manifest_column_missing",
      "rls_manifest_index_missing",
      "rls_manifest_policy_missing",
      "rls_manifest_rls_not_enabled",
      "rls_manifest_rls_not_forced",
      "rls_manifest_exemption_reason_missing",
      "rls_manifest_collaborator_table_missing",
    ] as const,
  },
  IsolatedStoreSqlRlsWarning: {
    type: "object",
    properties: {
      code: {
        $ref: "#/components/schemas/IsolatedStoreSqlRlsWarningCode",
      } as const,
      message: {
        type: "string",
      },
    },
    required: ["code", "message"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlRlsWarningCode: {
    type: "string",
    enum: [
      "rls_not_enabled",
      "rls_not_forced",
      "rls_enabled_without_policies",
    ] as const,
  },
  IsolatedStoreSqlSelectRequest: {
    type: "object",
    properties: {
      columns: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
      },
      filters: {
        type: "array",
        nullable: true,
        items: { $ref: "#/components/schemas/IsolatedStoreSqlFilter" } as const,
      },
      limit: {
        type: "number",
        nullable: true,
      },
      offset: {
        type: "number",
        nullable: true,
      },
      rlsContext: {
        type: "object",
        nullable: true,
        additionalProperties: {
          nullable: true,
          oneOf: [
            {
              type: "string",
            },
            {
              type: "number",
            },
            {
              type: "boolean",
              enum: [false] as const,
            },
            {
              type: "boolean",
              enum: [true] as const,
            },
          ] as SchemaLike[],
        },
      },
      schemaName: {
        type: "string",
        nullable: true,
      },
      sort: {
        type: "array",
        nullable: true,
        items: { $ref: "#/components/schemas/IsolatedStoreSqlSort" } as const,
      },
      tableName: {
        type: "string",
      },
      trustedRuntimeContext: {
        $ref: "#/components/schemas/IsolatedStoreSqlTrustedRuntimeContext",
      } as const,
    },
    required: ["tableName"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlSelectResponse: {
    type: "object",
    properties: {
      columns: {
        type: "array",
        items: {
          type: "string",
        },
      },
      page: {
        type: "object",
        properties: {
          limit: {
            type: "number",
          },
          offset: {
            type: "number",
          },
          rowCount: {
            type: "number",
          },
        },
        required: ["limit", "offset", "rowCount"] as string[],
        additionalProperties: false,
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
    required: ["columns", "page", "rows"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlSort: {
    type: "object",
    properties: {
      column: {
        type: "string",
      },
      direction: {
        $ref: "#/components/schemas/IsolatedStoreSqlSortDirection",
      } as const,
    },
    required: ["column"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlSortDirection: {
    type: "string",
    enum: ["asc", "desc"] as const,
  },
  IsolatedStoreSqlStatsResponse: {
    type: "object",
    properties: {
      databaseName: {
        type: "string",
      },
      schemaName: {
        type: "string",
      },
      tableCount: {
        type: "number",
      },
      tables: {
        type: "array",
        items: {
          $ref: "#/components/schemas/IsolatedStoreSqlTableStats",
        } as const,
      },
      totalBytes: {
        type: "number",
        nullable: true,
      },
      totalRowCount: {
        type: "number",
      },
    },
    required: [
      "databaseName",
      "schemaName",
      "tableCount",
      "tables",
      "totalRowCount",
    ] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlTable: {
    type: "object",
    properties: {
      schemaName: {
        type: "string",
      },
      tableName: {
        type: "string",
      },
      tableType: {
        type: "string",
      },
    },
    required: ["schemaName", "tableName", "tableType"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlTableDescription: {
    type: "object",
    properties: {
      columns: {
        type: "array",
        items: { $ref: "#/components/schemas/IsolatedStoreSqlColumn" } as const,
      },
      schemaName: {
        type: "string",
      },
      tableName: {
        type: "string",
      },
    },
    required: ["columns", "schemaName", "tableName"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlTableStats: {
    type: "object",
    properties: {
      columns: {
        type: "array",
        items: { $ref: "#/components/schemas/IsolatedStoreSqlColumn" } as const,
      },
      rowCount: {
        type: "number",
      },
      schemaName: {
        type: "string",
      },
      tableName: {
        type: "string",
      },
      tableType: {
        type: "string",
      },
      totalBytes: {
        type: "number",
        nullable: true,
      },
    },
    required: [
      "columns",
      "rowCount",
      "schemaName",
      "tableName",
      "tableType",
    ] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlTrustedRuntimeContext: {
    type: "object",
    properties: {
      portalId: {
        type: "string",
        description:
          "Trusted delegated portal context for backend/operator paths.\nRequires `isolated_store.rls.delegate`; callers cannot set this through `rlsContext`.",
        nullable: true,
      },
      workspaceId: {
        type: "string",
        description:
          "Trusted delegated workspace context for backend/operator paths.\nRequires `isolated_store.rls.delegate`; callers cannot set this through `rlsContext`.",
        nullable: true,
      },
    },
    additionalProperties: false,
  },
  IsolatedStoreSqlUpdateRequest: {
    type: "object",
    properties: {
      allowAll: {
        type: "boolean",
        nullable: true,
      },
      filters: {
        type: "array",
        nullable: true,
        items: { $ref: "#/components/schemas/IsolatedStoreSqlFilter" } as const,
      },
      returning: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
      },
      rlsContext: {
        type: "object",
        nullable: true,
        additionalProperties: {
          nullable: true,
          oneOf: [
            {
              type: "string",
            },
            {
              type: "number",
            },
            {
              type: "boolean",
              enum: [false] as const,
            },
            {
              type: "boolean",
              enum: [true] as const,
            },
          ] as SchemaLike[],
        },
      },
      schemaName: {
        type: "string",
        nullable: true,
      },
      tableName: {
        type: "string",
      },
      trustedRuntimeContext: {
        $ref: "#/components/schemas/IsolatedStoreSqlTrustedRuntimeContext",
      } as const,
      values: {
        type: "object",
        additionalProperties: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
    required: ["tableName", "values"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreSqlUpdateResponse: {
    type: "object",
    properties: {
      rowCount: {
        type: "number",
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
    required: ["rowCount", "rows"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreStageInstance: {
    type: "object",
    properties: {
      bindingConfig: {
        $ref: "#/components/schemas/IsolatedStorePostgresBindingConfig",
      } as const,
      createdAt: {
        type: "string",
      },
      createdByUserId: {
        type: "string",
      },
      globalId: {
        type: "string",
      },
      provisioningMetadata: {
        type: "object",
        nullable: true,
        additionalProperties: {
          type: "object",
          additionalProperties: true,
        },
      },
      stage: {
        type: "string",
        enum: ["dev", "prod"] as const,
      },
      status: {
        $ref: "#/components/schemas/IsolatedStoreStageStatus",
      } as const,
      storeGlobalId: {
        type: "string",
      },
      updatedAt: {
        type: "string",
      },
    },
    required: [
      "createdAt",
      "createdByUserId",
      "globalId",
      "stage",
      "status",
      "storeGlobalId",
      "updatedAt",
    ] as string[],
    additionalProperties: false,
  },
  IsolatedStoreStageListResponse: {
    type: "object",
    properties: {
      stages: {
        type: "array",
        items: {
          $ref: "#/components/schemas/IsolatedStoreStageInstance",
        } as const,
      },
    },
    required: ["stages"] as string[],
    additionalProperties: false,
  },
  IsolatedStoreStageStatus: {
    type: "string",
    enum: ["disabled", "provisioning", "ready", "failed"] as const,
  },
  IsolatedStoreStatus: {
    type: "string",
    enum: ["active", "disabled"] as const,
  },
  IsolatedStoreType: {
    type: "string",
    enum: ["sql"] as const,
  },
  ListPortalContentResponse: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/PortalContentItem" } as const,
      },
    },
    required: ["items"] as string[],
    additionalProperties: false,
  },
  MCPToolInputSchema: {
    type: "object",
    properties: {
      properties: {
        type: "object",
        additionalProperties: {
          type: "object",
          additionalProperties: true,
        },
      },
      required: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
      },
      type: {
        $ref: "#/components/schemas/MCPToolInputSchemaTypeEnum",
      } as const,
    },
    required: ["properties", "type"] as string[],
    additionalProperties: false,
  },
  MCPToolInputSchemaTypeEnum: {
    type: "string",
    enum: ["object"] as const,
  },
  McpManagerAuthData: {
    type: "object",
    properties: {
      app: {
        type: "string",
      },
      connectedAccountId: {
        type: "string",
      },
      connectionStatus: { $ref: "#/components/schemas/AuthStatus" } as const,
      redirectUrl: {
        type: "string",
        nullable: true,
      },
    },
    required: ["app", "connectedAccountId", "connectionStatus"] as string[],
    additionalProperties: false,
  },
  McpManagerAuthResponse: {
    oneOf: [
      {
        type: "object",
        properties: {
          app: {
            type: "string",
          },
          createdAt: {
            type: "string",
          },
          data: { $ref: "#/components/schemas/McpManagerAuthData" } as const,
          globalId: {
            type: "string",
          },
          name: {
            type: "string",
          },
          scopes: {
            type: "array",
            items: { $ref: "#/components/schemas/McpManagerScope" } as const,
          },
          status: { $ref: "#/components/schemas/AuthStatus" } as const,
          type: {
            type: "string",
            enum: ["oauth"] as const,
          },
          updatedAt: {
            type: "string",
          },
        },
        required: [
          "app",
          "createdAt",
          "data",
          "globalId",
          "name",
          "scopes",
          "status",
          "type",
          "updatedAt",
        ] as string[],
        additionalProperties: false,
      },
      {
        type: "object",
        properties: {
          app: {
            type: "string",
          },
          createdAt: {
            type: "string",
          },
          data: { $ref: "#/components/schemas/McpManagerAuthData" } as const,
          globalId: {
            type: "string",
          },
          name: {
            type: "string",
          },
          scopes: {
            type: "array",
            items: { $ref: "#/components/schemas/McpManagerScope" } as const,
          },
          status: { $ref: "#/components/schemas/AuthStatus" } as const,
          type: {
            type: "string",
            enum: ["composio_managed"] as const,
          },
          updatedAt: {
            type: "string",
          },
        },
        required: [
          "app",
          "createdAt",
          "data",
          "globalId",
          "name",
          "scopes",
          "status",
          "type",
          "updatedAt",
        ] as string[],
        additionalProperties: false,
      },
      {
        type: "object",
        properties: {
          app: {
            type: "string",
          },
          createdAt: {
            type: "string",
          },
          data: { $ref: "#/components/schemas/McpManagerAuthData" } as const,
          globalId: {
            type: "string",
          },
          name: {
            type: "string",
          },
          scopes: {
            type: "array",
            items: { $ref: "#/components/schemas/McpManagerScope" } as const,
          },
          status: { $ref: "#/components/schemas/AuthStatus" } as const,
          token: {
            type: "string",
          },
          type: {
            type: "string",
            enum: ["token_bearer"] as const,
          },
          updatedAt: {
            type: "string",
          },
        },
        required: [
          "app",
          "createdAt",
          "data",
          "globalId",
          "name",
          "scopes",
          "status",
          "token",
          "type",
          "updatedAt",
        ] as string[],
        additionalProperties: false,
      },
    ] as SchemaLike[],
  },
  McpManagerComposioManagedResponse: {
    type: "object",
    properties: {
      app: {
        type: "string",
      },
      createdAt: {
        type: "string",
      },
      data: { $ref: "#/components/schemas/McpManagerAuthData" } as const,
      globalId: {
        type: "string",
      },
      name: {
        type: "string",
      },
      scopes: {
        type: "array",
        items: { $ref: "#/components/schemas/McpManagerScope" } as const,
      },
      status: { $ref: "#/components/schemas/AuthStatus" } as const,
      type: {
        type: "string",
        enum: ["composio_managed"] as const,
      },
      updatedAt: {
        type: "string",
      },
    },
    required: [
      "app",
      "createdAt",
      "data",
      "globalId",
      "name",
      "scopes",
      "status",
      "type",
      "updatedAt",
    ] as string[],
    additionalProperties: false,
  },
  McpManagerOAuthResponse: {
    type: "object",
    properties: {
      app: {
        type: "string",
      },
      createdAt: {
        type: "string",
      },
      data: { $ref: "#/components/schemas/McpManagerAuthData" } as const,
      globalId: {
        type: "string",
      },
      name: {
        type: "string",
      },
      scopes: {
        type: "array",
        items: { $ref: "#/components/schemas/McpManagerScope" } as const,
      },
      status: { $ref: "#/components/schemas/AuthStatus" } as const,
      type: {
        type: "string",
        enum: ["oauth"] as const,
      },
      updatedAt: {
        type: "string",
      },
    },
    required: [
      "app",
      "createdAt",
      "data",
      "globalId",
      "name",
      "scopes",
      "status",
      "type",
      "updatedAt",
    ] as string[],
    additionalProperties: false,
  },
  McpManagerScope: {
    type: "object",
    properties: {
      scopeId: {
        type: "string",
      },
      scopeType: { $ref: "#/components/schemas/AuthScopeType" } as const,
    },
    required: ["scopeId", "scopeType"] as string[],
    additionalProperties: false,
  },
  McpManagerServerChannel: {
    type: "object",
    properties: {
      channelId: {
        type: "string",
      },
      enabled: {
        type: "boolean",
      },
    },
    required: ["channelId", "enabled"] as string[],
    additionalProperties: false,
  },
  McpManagerServerResponse: {
    type: "object",
    properties: {
      args: { $ref: "#/components/schemas/TemplateArgs" } as const,
      authId: {
        type: "string",
        nullable: true,
      },
      channels: {
        type: "array",
        items: {
          $ref: "#/components/schemas/McpManagerServerChannel",
        } as const,
      },
      command: {
        type: "string",
      },
      connectedAt: {
        type: "string",
        nullable: true,
      },
      createdAt: {
        type: "string",
      },
      deletedAt: {
        type: "string",
        nullable: true,
      },
      globalId: {
        type: "string",
      },
      name: {
        type: "string",
      },
      prompt: {
        type: "string",
      },
      provider: {
        type: "string",
        enum: ["custom", "composio", "pipedream"] as const,
      },
      scopes: {
        type: "array",
        items: { $ref: "#/components/schemas/McpManagerScope" } as const,
      },
      status: { $ref: "#/components/schemas/ServerStatus" } as const,
      templateId: {
        type: "string",
        nullable: true,
      },
      transport: {
        type: "string",
        enum: ["sse", "npx", "uvx", "docker", "streamable_http"] as const,
      },
      updatedAt: {
        type: "string",
      },
    },
    required: [
      "args",
      "channels",
      "command",
      "createdAt",
      "globalId",
      "name",
      "prompt",
      "provider",
      "scopes",
      "status",
      "transport",
      "updatedAt",
    ] as string[],
    additionalProperties: false,
  },
  McpManagerTokenBearerResponse: {
    type: "object",
    properties: {
      app: {
        type: "string",
      },
      createdAt: {
        type: "string",
      },
      data: { $ref: "#/components/schemas/McpManagerAuthData" } as const,
      globalId: {
        type: "string",
      },
      name: {
        type: "string",
      },
      scopes: {
        type: "array",
        items: { $ref: "#/components/schemas/McpManagerScope" } as const,
      },
      status: { $ref: "#/components/schemas/AuthStatus" } as const,
      token: {
        type: "string",
      },
      type: {
        type: "string",
        enum: ["token_bearer"] as const,
      },
      updatedAt: {
        type: "string",
      },
    },
    required: [
      "app",
      "createdAt",
      "data",
      "globalId",
      "name",
      "scopes",
      "status",
      "token",
      "type",
      "updatedAt",
    ] as string[],
    additionalProperties: false,
  },
  MeAuth: {
    type: "object",
    properties: {
      orgGroups: {
        type: "array",
        nullable: true,
        items: { $ref: "#/components/schemas/MeOrgGroup" } as const,
      },
      orgRole: {
        type: "string",
        nullable: true,
      },
      permissions: {
        type: "array",
        items: {
          type: "string",
        },
      },
      scopes: {
        type: "array",
        items: { $ref: "#/components/schemas/MeScope" } as const,
      },
      source: {
        type: "string",
        nullable: true,
      },
      type: {
        type: "string",
      },
    },
    required: ["permissions", "scopes", "source", "type"] as string[],
    additionalProperties: false,
  },
  MeOrgGroup: {
    type: "object",
    properties: {
      id: {
        type: "string",
      },
      name: {
        type: "string",
      },
    },
    required: ["id", "name"] as string[],
    additionalProperties: false,
  },
  MeResponse: {
    type: "object",
    properties: {
      auth: { $ref: "#/components/schemas/MeAuth" } as const,
      authenticated: {
        type: "boolean",
        enum: [true] as const,
      },
      user: { $ref: "#/components/schemas/MeUser" } as const,
    },
    required: ["auth", "authenticated", "user"] as string[],
    additionalProperties: false,
  },
  MeScope: {
    type: "object",
    properties: {
      scopeId: {
        type: "string",
      },
      scopeType: {
        type: "string",
      },
    },
    required: ["scopeId", "scopeType"] as string[],
    additionalProperties: false,
  },
  MeUser: {
    type: "object",
    properties: {
      id: {
        type: "number",
        nullable: true,
      },
    },
    required: ["id"] as string[],
    additionalProperties: false,
  },
  MyOrgAccessResponse: {
    type: "object",
    properties: {
      authenticated: {
        type: "boolean",
        enum: [true] as const,
      },
      expiresAt: {
        type: "number",
        nullable: true,
      },
      hasOrgAccess: {
        type: "boolean",
      },
      memberTTL: {
        type: "number",
        nullable: true,
      },
      membershipStatus: {
        type: "string",
        enum: ["disabled", "ready", "none", "expired"] as const,
      },
      orgId: {
        type: "string",
      },
      role: {
        type: "string",
        nullable: true,
      },
      source: {
        type: "string",
        enum: ["none", "owner", "member"] as const,
      },
      user: { $ref: "#/components/schemas/AuthenticatedUserSummary" } as const,
    },
    required: [
      "authenticated",
      "hasOrgAccess",
      "membershipStatus",
      "orgId",
      "source",
      "user",
    ] as string[],
    additionalProperties: false,
  },
  OrgEmailSendRequest: {
    type: "object",
    properties: {
      body: {
        type: "string",
      },
      links: {
        type: "object",
        description:
          "Optional link variables that the mail rendering layer may use.\nCurrently accepted for forward compatibility and not yet applied during sending.",
        nullable: true,
        additionalProperties: {
          type: "string",
        },
      },
      recipient: {
        type: "string",
        description:
          "Recipient user id or email.\nDigit-only strings are treated as user ids.\nStrings containing `@` are treated as emails.\nThe resolved user must already belong to the organization.",
      },
      subject: {
        type: "string",
      },
      variables: {
        type: "object",
        description:
          "Optional variables that the mail rendering layer may use.\nCurrently accepted for forward compatibility and not yet applied during sending.",
        nullable: true,
        additionalProperties: {
          type: "string",
        },
      },
    },
    required: ["body", "recipient", "subject"] as string[],
    additionalProperties: false,
  },
  OrgEmailSendResponse: {
    type: "object",
    properties: {
      requestId: {
        type: "string",
      },
      sentEmail: {
        type: "string",
        description: "Recipient email accepted for delivery when known.",
        nullable: true,
      },
      sentUserId: {
        type: "number",
        description: "Organization member user id accepted for delivery.",
      },
    },
    required: ["requestId", "sentUserId"] as string[],
    additionalProperties: false,
  },
  OrgGroup: {
    type: "object",
    properties: {
      createdAt: {
        type: "number",
      },
      description: {
        type: "string",
        nullable: true,
      },
      id: {
        type: "string",
      },
      memberCount: {
        type: "number",
        nullable: true,
      },
      name: {
        type: "string",
      },
      orgId: {
        type: "string",
      },
      updatedAt: {
        type: "number",
      },
      userId: {
        type: "number",
        nullable: true,
      },
      workspaceCount: {
        type: "number",
        nullable: true,
      },
    },
    required: ["createdAt", "id", "name", "orgId", "updatedAt"] as string[],
    additionalProperties: false,
  },
  OrgGroupCreateRequest: {
    type: "object",
    properties: {
      description: {
        type: "string",
        nullable: true,
      },
      name: {
        type: "string",
      },
      workspaces: {
        type: "array",
        nullable: true,
        items: { $ref: "#/components/schemas/OrgGroupWorkspaceRole" } as const,
      },
    },
    required: ["name"] as string[],
    additionalProperties: false,
  },
  OrgGroupListResponse: {
    type: "object",
    properties: {
      groups: {
        type: "array",
        items: { $ref: "#/components/schemas/OrgGroup" } as const,
      },
    },
    required: ["groups"] as string[],
    additionalProperties: false,
  },
  OrgGroupMember: {
    type: "object",
    properties: {
      addedByUserId: {
        type: "number",
      },
      createdAt: {
        type: "number",
      },
      groupId: {
        type: "string",
      },
      orgId: {
        type: "string",
      },
      updatedAt: {
        type: "number",
      },
      userId: {
        type: "number",
      },
    },
    required: [
      "addedByUserId",
      "createdAt",
      "groupId",
      "orgId",
      "updatedAt",
      "userId",
    ] as string[],
    additionalProperties: false,
  },
  OrgGroupMemberListResponse: {
    type: "object",
    properties: {
      members: {
        type: "array",
        items: { $ref: "#/components/schemas/OrgGroupMember" } as const,
      },
    },
    required: ["members"] as string[],
    additionalProperties: false,
  },
  OrgGroupResponse: {
    type: "object",
    properties: {
      group: { $ref: "#/components/schemas/OrgGroup" } as const,
    },
    required: ["group"] as string[],
    additionalProperties: false,
  },
  OrgGroupUpdateRequest: {
    type: "object",
    properties: {
      description: {
        type: "string",
        nullable: true,
      },
      name: {
        type: "string",
        nullable: true,
      },
      workspaces: {
        type: "array",
        nullable: true,
        items: { $ref: "#/components/schemas/OrgGroupWorkspaceRole" } as const,
      },
    },
    additionalProperties: false,
  },
  OrgGroupWorkspaceAssignmentType: {
    type: "string",
    enum: ["full", "partial"] as const,
  },
  OrgGroupWorkspaceDetails: {
    type: "object",
    properties: {
      brandingProfileId: {
        type: "string",
        nullable: true,
      },
      color: {
        type: "string",
        nullable: true,
      },
      createdAt: {
        type: "number",
        nullable: true,
      },
      defaultEncryptionKeyId: {
        type: "string",
        nullable: true,
      },
      id: {
        type: "string",
        nullable: true,
      },
      isDefault: {
        type: "boolean",
        nullable: true,
      },
      isNotesLimited: {
        type: "boolean",
        nullable: true,
      },
      orgId: {
        type: "string",
        nullable: true,
      },
      orgSubscriptionPrivileges: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
      },
      orgSubscriptionType: {
        type: "string",
        nullable: true,
      },
      title: {
        type: "string",
        nullable: true,
      },
      updatedAt: {
        type: "number",
        nullable: true,
      },
      userId: {
        type: "number",
        nullable: true,
      },
      webClientBrandingProfileId: {
        type: "string",
        nullable: true,
      },
    },
    additionalProperties: false,
  },
  OrgGroupWorkspaceRole: {
    type: "object",
    properties: {
      role: {
        type: "string",
      },
      workspaceId: {
        type: "string",
      },
    },
    required: ["role", "workspaceId"] as string[],
    additionalProperties: false,
  },
  OrgGroupWorkspacesQuery: {
    type: "object",
    properties: {
      workspace: {
        type: "boolean",
        description:
          "Include workspace details in each workspace-group record.",
        nullable: true,
      },
    },
    additionalProperties: false,
  },
  OrgInvite: {
    type: "object",
    properties: {
      email: {
        type: "string",
      },
      id: {
        type: "number",
      },
      orgId: {
        type: "string",
        nullable: true,
      },
      role: {
        type: "string",
      },
      url: {
        type: "string",
        nullable: true,
      },
      used: {
        type: "boolean",
      },
    },
    required: ["email", "id", "role", "used"] as string[],
    additionalProperties: false,
  },
  OrgMagicLink: {
    type: "object",
    properties: {
      createdAt: {
        type: "number",
        nullable: true,
      },
      expiresAt: {
        type: "number",
        nullable: true,
      },
      id: {
        type: "string",
      },
      magicLink: {
        type: "string",
      },
      orgId: {
        type: "string",
      },
      type: {
        type: "string",
      },
      updatedAt: {
        type: "number",
        nullable: true,
      },
      url: {
        type: "string",
      },
      userId: {
        type: "number",
      },
      workspaceId: {
        type: "string",
      },
    },
    required: [
      "id",
      "magicLink",
      "orgId",
      "type",
      "url",
      "userId",
      "workspaceId",
    ] as string[],
    additionalProperties: false,
  },
  OrgPortal: {
    type: "object",
    properties: {
      createdAt: {
        type: "number",
      },
      domain: {
        type: "string",
      },
      id: {
        type: "string",
      },
      lastPublishedAt: {
        type: "number",
        nullable: true,
      },
      orgId: {
        type: "string",
      },
      status: {
        type: "string",
      },
      updatedAt: {
        type: "number",
      },
      version: {
        type: "number",
      },
      workspaceId: {
        type: "string",
      },
    },
    required: [
      "createdAt",
      "domain",
      "id",
      "orgId",
      "status",
      "updatedAt",
      "version",
      "workspaceId",
    ] as string[],
    additionalProperties: false,
  },
  OrgPortalListResponse: {
    type: "object",
    properties: {
      portals: {
        type: "array",
        items: { $ref: "#/components/schemas/OrgPortal" } as const,
      },
    },
    required: ["portals"] as string[],
    additionalProperties: false,
  },
  OrgUrlKind: {
    type: "string",
    enum: ["cname", "subdomain"] as const,
  },
  OrgUrlResponse: {
    type: "object",
    properties: {
      customDomain: {
        type: "string",
        description:
          "Custom CNAME domain when configured; null for subdomain-only orgs.",
        nullable: true,
      },
      domainShorter: {
        type: "boolean",
        description:
          "Org branding flag from org-service; does not change hostname resolution.",
      },
      host: {
        type: "string",
        description:
          "Hostname used in `url` (custom CNAME domain or `{sub}.{fusebaseHost}`).",
      },
      kind: { $ref: "#/components/schemas/OrgUrlKind" } as const,
      orgId: {
        type: "string",
      },
      sub: {
        type: "string",
        description: "Organization subdomain slug from org-service.",
      },
      url: {
        type: "string",
        description:
          "Canonical HTTPS base URL for the organization (no trailing path).",
      },
    },
    required: [
      "customDomain",
      "domainShorter",
      "host",
      "kind",
      "orgId",
      "sub",
      "url",
    ] as string[],
    additionalProperties: false,
  },
  OrgUser: {
    type: "object",
    properties: {
      email: {
        type: "string",
        nullable: true,
      },
      firstname: {
        type: "string",
        nullable: true,
      },
      id: {
        type: "number",
      },
      lastname: {
        type: "string",
        nullable: true,
      },
      role: {
        type: "string",
      },
      username: {
        type: "string",
        nullable: true,
      },
    },
    required: ["id", "role"] as string[],
    additionalProperties: false,
  },
  OrgUserAddRequest: {
    type: "object",
    properties: {
      autoConfirmClientInvite: {
        type: "boolean",
        description:
          "Org-only shortcut for instant client onboarding without invite\nconfirmation. Valid only when `orgRole` is `client` and `workspaceId`\nis omitted.",
        nullable: true,
      },
      email: {
        type: "string",
        description: "Email to invite/create access for.",
      },
      encryptRole: {
        type: "string",
        description: "Optional workspace encryption role.",
        nullable: true,
      },
      fullName: {
        type: "string",
        nullable: true,
      },
      memberTTL: {
        type: "number",
        nullable: true,
      },
      orgRole: {
        type: "string",
        description:
          "Root role in org-service (e.g. owner/manager/member/guest/client).\nUsed for org-only invites, or as the org role when a workspace invite\nneeds to create org membership first.",
        nullable: true,
      },
      portalUrl: {
        type: "string",
        description:
          "Optional portal domain/host. When combined with `workspaceId`,\norg-service creates a portal magic link instead of a regular invite.\nWithout `workspaceId`, this remains an org invite email hint only.",
        nullable: true,
      },
      workspaceId: {
        type: "string",
        description:
          "Workspace target. Supports a literal workspace global id or the alias\n`default`, which gate resolves to the default workspace of `orgId`.\nWhen set, `workspaceRole` becomes required and the invite flows through\norg-service `POST /workspaces/:workspaceId/members`.",
        nullable: true,
      },
      workspaceRole: {
        type: "string",
        description:
          "Workspace role for workspace-aware invites (e.g. admin/editor/reader).",
        nullable: true,
      },
    },
    required: ["email"] as string[],
    additionalProperties: false,
  },
  OrgUserAddResponse: {
    type: "object",
    properties: {
      magicLink: { $ref: "#/components/schemas/OrgMagicLink" } as const,
      orgInvite: { $ref: "#/components/schemas/OrgInvite" } as const,
      orgMember: { $ref: "#/components/schemas/OrgUser" } as const,
      result: {
        type: "string",
        enum: ["member", "invite", "link"] as const,
        description:
          "org-service returns `invite` or `member` for org invites, and\n`invite`, `member`, or `link` for workspace-aware invites.\n`invite` means an invite exists; it is not proof that org access is\nalready active for the current session.",
      },
      target: {
        type: "string",
        enum: ["org", "workspace", "portal"] as const,
        description: "Target flow used by the endpoint.",
      },
      workspaceInvite: {
        $ref: "#/components/schemas/OrgWorkspaceInvite",
      } as const,
      workspaceMember: {
        $ref: "#/components/schemas/OrgWorkspaceMember",
      } as const,
    },
    required: ["result", "target"] as string[],
    additionalProperties: false,
  },
  OrgUserListResponse: {
    type: "object",
    properties: {
      users: {
        type: "array",
        items: { $ref: "#/components/schemas/OrgUser" } as const,
      },
    },
    required: ["users"] as string[],
    additionalProperties: false,
  },
  OrgWorkspace: {
    type: "object",
    properties: {
      color: {
        type: "string",
        nullable: true,
      },
      id: {
        type: "string",
      },
      isDefault: {
        type: "boolean",
      },
      orgId: {
        type: "string",
        nullable: true,
      },
      role: {
        type: "string",
        nullable: true,
      },
      title: {
        type: "string",
        nullable: true,
      },
    },
    required: ["id", "isDefault"] as string[],
    additionalProperties: false,
  },
  OrgWorkspaceGroup: {
    type: "object",
    properties: {
      addedByUserId: {
        type: "number",
      },
      createdAt: {
        type: "number",
      },
      groupId: {
        type: "string",
      },
      orgId: {
        type: "string",
      },
      role: {
        type: "string",
      },
      type: {
        $ref: "#/components/schemas/OrgGroupWorkspaceAssignmentType",
      } as const,
      updatedAt: {
        type: "number",
      },
      workspace: {
        $ref: "#/components/schemas/OrgGroupWorkspaceDetails",
      } as const,
      workspaceId: {
        type: "string",
      },
    },
    required: [
      "addedByUserId",
      "createdAt",
      "groupId",
      "orgId",
      "role",
      "type",
      "updatedAt",
      "workspaceId",
    ] as string[],
    additionalProperties: false,
  },
  OrgWorkspaceGroupCountResponse: {
    type: "object",
    properties: {
      count: {
        type: "number",
      },
    },
    required: ["count"] as string[],
    additionalProperties: false,
  },
  OrgWorkspaceGroupListResponse: {
    type: "object",
    properties: {
      workspaceGroups: {
        type: "array",
        items: { $ref: "#/components/schemas/OrgWorkspaceGroup" } as const,
      },
    },
    required: ["workspaceGroups"] as string[],
    additionalProperties: false,
  },
  OrgWorkspaceGroupResponse: {
    type: "object",
    properties: {
      workspaceGroup: {
        $ref: "#/components/schemas/OrgWorkspaceGroup",
      } as const,
    },
    required: ["workspaceGroup"] as string[],
    additionalProperties: false,
  },
  OrgWorkspaceInvite: {
    type: "object",
    properties: {
      addedByUserId: {
        type: "number",
      },
      createdAt: {
        type: "number",
      },
      email: {
        type: "string",
      },
      encryptRole: {
        type: "string",
        nullable: true,
      },
      role: {
        type: "string",
      },
      updatedAt: {
        type: "number",
      },
      used: {
        type: "boolean",
      },
      usedByUserId: {
        type: "number",
        nullable: true,
      },
      workspaceId: {
        type: "string",
      },
    },
    required: [
      "addedByUserId",
      "createdAt",
      "email",
      "role",
      "updatedAt",
      "used",
      "workspaceId",
    ] as string[],
    additionalProperties: false,
  },
  OrgWorkspaceListResponse: {
    type: "object",
    properties: {
      workspaces: {
        type: "array",
        items: { $ref: "#/components/schemas/OrgWorkspace" } as const,
      },
    },
    required: ["workspaces"] as string[],
    additionalProperties: false,
  },
  OrgWorkspaceMember: {
    type: "object",
    properties: {
      addedByUserId: {
        type: "number",
      },
      createdAt: {
        type: "number",
      },
      encryptRole: {
        type: "string",
        nullable: true,
      },
      id: {
        type: "string",
      },
      magicLink: {
        type: "string",
        nullable: true,
      },
      privileges: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
      },
      role: {
        type: "string",
      },
      type: {
        type: "string",
        nullable: true,
      },
      updatedAt: {
        type: "number",
      },
      userId: {
        type: "number",
      },
      workspaceId: {
        type: "string",
      },
    },
    required: [
      "addedByUserId",
      "createdAt",
      "id",
      "role",
      "updatedAt",
      "userId",
      "workspaceId",
    ] as string[],
    additionalProperties: false,
  },
  PortalContentItem: {
    type: "object",
    properties: {
      children: {
        type: "array",
        items: { $ref: "#/components/schemas/PortalContentItem" } as const,
      },
      id: {
        type: "string",
      },
      index: {
        type: "number",
      },
      name: {
        type: "string",
      },
      noteId: {
        type: "string",
        description:
          "Only for type === 'note': id of the Fusebase note (from targetId).",
        nullable: true,
      },
      pageId: {
        type: "string",
        nullable: true,
      },
      positionType: {
        type: "string",
        enum: ["top", "sidebar", "footer"] as const,
      },
      slug: {
        type: "string",
      },
      type: {
        type: "string",
        enum: [
          "link",
          "home",
          "notesFolder",
          "note",
          "portalSection",
          "portalProcess",
          "portalPage",
          "unknown",
          "allPages",
          "tasks",
          "chat",
          "folders",
          "tags",
          "portalFilesDashboard",
          "filesManager",
          "portalTasksDashboard",
          "portalChatsDashboard",
        ] as const,
      },
      visible: {
        type: "boolean",
      },
    },
    required: [
      "children",
      "id",
      "index",
      "name",
      "positionType",
      "slug",
      "type",
      "visible",
    ] as string[],
    additionalProperties: false,
  },
  PortalDetail: {
    type: "object",
    properties: {
      cnameStatus: {
        type: "string",
        nullable: true,
      },
      cnameType: {
        type: "string",
        nullable: true,
      },
      cnameValue: {
        type: "string",
        nullable: true,
      },
      createdAt: {
        type: "number",
      },
      domain: {
        type: "string",
      },
      id: {
        type: "string",
      },
      lastPublishedAt: {
        type: "number",
        nullable: true,
      },
      orgId: {
        type: "string",
      },
      status: {
        type: "string",
      },
      updatedAt: {
        type: "number",
      },
      version: {
        type: "number",
      },
      workspaceId: {
        type: "string",
      },
    },
    required: [
      "createdAt",
      "domain",
      "id",
      "orgId",
      "status",
      "updatedAt",
      "version",
      "workspaceId",
    ] as string[],
    additionalProperties: false,
  },
  PublicMcpManagerAuthStatusResponse: {
    type: "object",
    properties: {
      status: { $ref: "#/components/schemas/AuthStatus" } as const,
    },
    required: ["status"] as string[],
    additionalProperties: false,
  },
  RemoveOrgGroupMemberResponse: {
    type: "object",
    properties: {
      groupId: {
        type: "string",
      },
      removed: {
        type: "boolean",
      },
      userId: {
        type: "number",
      },
    },
    required: ["groupId", "removed", "userId"] as string[],
    additionalProperties: false,
  },
  RepairIsolatedStoreSqlMigrationJournalChecksumsRequest: {
    type: "object",
    properties: {
      bundle: {
        $ref: "#/components/schemas/IsolatedStoreSqlMigrationBundle",
      } as const,
      dryRun: {
        type: "boolean",
        description:
          "Validate eligibility and return the projected post-repair status without writing the journal.",
        nullable: true,
      },
      expectedLastAppliedChecksum: {
        type: "string",
        nullable: true,
      },
      expectedLastAppliedVersion: {
        type: "number",
        description:
          "Same optimistic-lock semantics as `applyIsolatedStoreSqlMigrations`; HTTP 409 when the journal tail disagrees.",
        nullable: true,
      },
      schemaName: {
        type: "string",
        nullable: true,
      },
    },
    required: ["bundle"] as string[],
    additionalProperties: false,
  },
  RepairIsolatedStoreSqlMigrationJournalChecksumsResponse: {
    type: "object",
    properties: {
      dryRun: {
        type: "boolean",
        nullable: true,
      },
      repairedCount: {
        type: "number",
      },
      repairedVersions: {
        type: "array",
        items: {
          type: "number",
        },
      },
      status: {
        $ref: "#/components/schemas/IsolatedStoreSqlMigrationStatus",
      } as const,
    },
    required: ["repairedCount", "repairedVersions", "status"] as string[],
    additionalProperties: false,
  },
  RequestAppMagicLinkRequest: {
    type: "object",
    description:
      "Request body for requestAppMagicLink (visitor self-service flow).",
    properties: {
      email: {
        type: "string",
        format: "email",
        description:
          "Email address typed by the visitor. The link is dispatched to this address\nonly when it already has access to the app.",
      },
      redirectPath: {
        type: "string",
        description:
          "Optional relative app path to land on after activation\n(e.g. /proposals/abc). Omit for root.",
        nullable: true,
      },
    },
    required: ["email"] as string[],
    additionalProperties: false,
  },
  RequestAppMagicLinkResponse: {
    type: "object",
    description:
      "Generic acknowledgment. Returned for both allowed and denied requests so\nthe response cannot be used to enumerate emails or access state.",
    properties: {
      ok: {
        type: "boolean",
        description: "Always true.",
      },
    },
    required: ["ok"] as string[],
    additionalProperties: false,
  },
  RestoreIsolatedStoreRevisionResponse: {
    type: "object",
    properties: {
      restored: {
        type: "boolean",
        enum: [true] as const,
      },
      revision: { $ref: "#/components/schemas/IsolatedStoreRevision" } as const,
      stageInstance: {
        $ref: "#/components/schemas/IsolatedStoreStageInstance",
      } as const,
    },
    required: ["restored", "revision", "stageInstance"] as string[],
    additionalProperties: false,
  },
  RuleRelation: {
    type: "object",
    properties: {
      enabled: {
        type: "boolean",
        nullable: true,
      },
      scopeId: {
        type: "string",
      },
      scopeType: { $ref: "#/components/schemas/RuleScopeType" } as const,
    },
    required: ["scopeId", "scopeType"] as string[],
    additionalProperties: false,
  },
  RuleResponse: {
    type: "object",
    properties: {
      content: {
        type: "string",
      },
      createdAt: {
        type: "string",
      },
      deletedAt: {
        type: "string",
        nullable: true,
      },
      description: {
        type: "string",
        nullable: true,
      },
      globalId: {
        type: "string",
      },
      isTemplate: {
        type: "boolean",
        nullable: true,
      },
      labelIds: {
        type: "array",
        nullable: true,
        items: {
          type: "string",
        },
      },
      metadata: {
        type: "object",
        nullable: true,
        additionalProperties: true,
      },
      name: {
        type: "string",
      },
      relations: {
        type: "array",
        items: { $ref: "#/components/schemas/RuleRelation" } as const,
      },
      templateId: {
        type: "string",
        nullable: true,
      },
      touched: {
        type: "boolean",
      },
      updatedAt: {
        type: "string",
      },
    },
    required: [
      "content",
      "createdAt",
      "globalId",
      "name",
      "relations",
      "touched",
      "updatedAt",
    ] as string[],
    additionalProperties: false,
  },
  RuleScopeType: {
    type: "string",
    enum: [
      "workspace",
      "portal",
      "user",
      "server",
      "template",
      "channel",
      "organization",
    ] as const,
  },
  ServerStatus: {
    type: "string",
    enum: ["failed", "initializing", "connected", "disconnected"] as const,
  },
  StartMultipartFileUploadRequest: {
    type: "object",
    properties: {
      contentType: {
        type: "string",
        nullable: true,
      },
      filename: {
        type: "string",
      },
      folder: {
        type: "string",
        nullable: true,
      },
      size: {
        type: "number",
      },
    },
    required: ["filename", "size"] as string[],
    additionalProperties: false,
  },
  StartMultipartFileUploadResponse: {
    type: "object",
    properties: {
      fileId: {
        type: "string",
      },
      headers: { $ref: "#/components/schemas/FileUploadHeaders" } as const,
      method: { $ref: "#/components/schemas/FileUploadMethod" } as const,
      partNumber: {
        type: "number",
      },
      partSize: {
        type: "number",
      },
      partsUrls: {
        type: "array",
        format: "uri",
        items: {
          type: "string",
        },
      },
      tempStoredfileName: {
        type: "string",
      },
      uploadId: {
        type: "string",
        description:
          "File-service multipart upload id. Treat as opaque and send it back unchanged.",
      },
      uploadUrl: {
        type: "string",
        format: "uri",
      },
    },
    required: [
      "fileId",
      "headers",
      "method",
      "partNumber",
      "partSize",
      "partsUrls",
      "tempStoredfileName",
      "uploadId",
      "uploadUrl",
    ] as string[],
    additionalProperties: false,
  },
  StripeCheckoutLinkRequest: {
    type: "object",
    properties: {
      buyerId: {
        type: "number",
      },
      cancelUrl: {
        type: "string",
      },
      customerEmail: {
        type: "string",
        nullable: true,
      },
      kind: {
        type: "string",
      },
      kindId: {
        type: "string",
      },
      stripeAccountId: {
        type: "string",
      },
      successUrl: {
        type: "string",
      },
    },
    required: [
      "buyerId",
      "cancelUrl",
      "kind",
      "kindId",
      "stripeAccountId",
      "successUrl",
    ] as string[],
    additionalProperties: false,
  },
  StripeCheckoutLinkResponse: {
    type: "object",
    properties: {
      url: {
        type: "string",
        nullable: true,
      },
    },
    additionalProperties: false,
  },
  StripeInterval: {
    type: "string",
    enum: ["day", "week", "month", "year"] as const,
  },
  StripeMode: {
    type: "string",
    enum: ["payment", "subscription"] as const,
  },
  StripeModeMutationResponse: {
    type: "object",
    properties: {
      oauth: { $ref: "#/components/schemas/StripeOauth" } as const,
    },
    required: ["oauth"] as string[],
    additionalProperties: false,
  },
  StripeModeUpdateRequest: {
    type: "object",
    properties: {
      liveMode: {
        type: "boolean",
      },
      stripeAccountId: {
        type: "string",
      },
    },
    required: ["liveMode", "stripeAccountId"] as string[],
    additionalProperties: false,
  },
  StripeOauth: {
    type: "object",
    properties: {
      liveMode: {
        type: "boolean",
        nullable: true,
      },
      orgId: {
        type: "string",
        nullable: true,
      },
      stripeAccountId: {
        type: "string",
        nullable: true,
      },
      userId: {
        type: "number",
        nullable: true,
      },
    },
    additionalProperties: false,
  },
  StripeOauthLookupRequest: {
    type: "object",
    properties: {
      stripeAccountId: {
        type: "string",
        nullable: true,
      },
    },
    additionalProperties: false,
  },
  StripeOauthLookupResponse: {
    type: "object",
    properties: {
      oauth: { $ref: "#/components/schemas/StripeOauth" } as const,
    },
    required: ["oauth"] as string[],
    additionalProperties: false,
  },
  StripePaymentStateRequest: {
    type: "object",
    properties: {
      buyerId: {
        type: "number",
      },
      kind: {
        type: "string",
      },
      kindId: {
        type: "string",
      },
      mode: { $ref: "#/components/schemas/StripeMode" } as const,
      stripeAccountId: {
        type: "string",
      },
    },
    required: [
      "buyerId",
      "kind",
      "kindId",
      "mode",
      "stripeAccountId",
    ] as string[],
    additionalProperties: false,
  },
  StripePaymentStateResponse: {
    type: "object",
    properties: {
      active: {
        type: "boolean",
        nullable: true,
      },
    },
    additionalProperties: false,
  },
  StripeProduct: {
    type: "object",
    properties: {
      amountCents: {
        type: "number",
        nullable: true,
      },
      createdAt: {
        type: "number",
        nullable: true,
      },
      currency: {
        type: "string",
        nullable: true,
      },
      deleted: {
        type: "boolean",
        nullable: true,
      },
      id: {
        type: "number",
        nullable: true,
      },
      interval: { $ref: "#/components/schemas/StripeInterval" } as const,
      intervalCount: {
        type: "number",
        nullable: true,
      },
      kind: {
        type: "string",
        nullable: true,
      },
      kindId: {
        type: "string",
        nullable: true,
      },
      mode: { $ref: "#/components/schemas/StripeMode" } as const,
      orgId: {
        type: "string",
        nullable: true,
      },
      priceId: {
        type: "string",
        nullable: true,
      },
      productId: {
        type: "string",
        nullable: true,
      },
      stripeAccountId: {
        type: "string",
        nullable: true,
      },
      title: {
        type: "string",
        nullable: true,
      },
      updatedAt: {
        type: "number",
        nullable: true,
      },
      userId: {
        type: "number",
        nullable: true,
      },
    },
    additionalProperties: false,
  },
  StripeProductCreateRequest: {
    type: "object",
    description:
      "For mode=subscription, interval and intervalCount are required.\nFor mode=payment, interval and intervalCount must be omitted.",
    properties: {
      amountCents: {
        type: "number",
      },
      currency: {
        type: "string",
      },
      interval: { $ref: "#/components/schemas/StripeInterval" } as const,
      intervalCount: {
        type: "number",
        nullable: true,
      },
      kind: {
        type: "string",
      },
      kindId: {
        type: "string",
      },
      mode: { $ref: "#/components/schemas/StripeMode" } as const,
      stripeAccountId: {
        type: "string",
      },
      title: {
        type: "string",
      },
    },
    required: [
      "amountCents",
      "currency",
      "kind",
      "kindId",
      "mode",
      "stripeAccountId",
      "title",
    ] as string[],
    additionalProperties: false,
  },
  StripeProductDeleteRequest: {
    type: "object",
    properties: {
      kind: {
        type: "string",
      },
      kindId: {
        type: "string",
      },
      stripeAccountId: {
        type: "string",
        nullable: true,
      },
    },
    required: ["kind", "kindId"] as string[],
    additionalProperties: false,
  },
  StripeProductDeleteResponse: {
    type: "object",
    properties: {
      deleted: {
        type: "boolean",
      },
      kind: {
        type: "string",
      },
      kindId: {
        type: "string",
      },
      stripeAccountId: {
        type: "string",
        nullable: true,
      },
    },
    required: ["deleted", "kind", "kindId"] as string[],
    additionalProperties: false,
  },
  StripeProductFindRequest: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        nullable: true,
      },
      kindId: {
        type: "string",
        nullable: true,
      },
      mode: {
        type: "string",
        enum: ["payment", "subscription"] as const,
        nullable: true,
      },
      stripeAccountId: {
        type: "string",
        nullable: true,
      },
    },
    additionalProperties: false,
  },
  StripeProductLookupResponse: {
    type: "object",
    properties: {
      product: { $ref: "#/components/schemas/StripeProduct" } as const,
    },
    required: ["product"] as string[],
    additionalProperties: false,
  },
  StripeProductMutationResponse: {
    type: "object",
    properties: {
      product: { $ref: "#/components/schemas/StripeProduct" } as const,
    },
    required: ["product"] as string[],
    additionalProperties: false,
  },
  StripeSubscriptionCancelRequest: {
    type: "object",
    description:
      "Cancels a Stripe subscription for a buyer and product identity.\nWhen cancelAtPeriodEnd is omitted or true, cancellation is scheduled for the end\nof the current billing period. Set false for immediate cancellation.",
    properties: {
      buyerId: {
        type: "number",
      },
      cancelAtPeriodEnd: {
        type: "boolean",
        nullable: true,
      },
      kind: {
        type: "string",
      },
      kindId: {
        type: "string",
      },
      stripeAccountId: {
        type: "string",
      },
    },
    required: ["buyerId", "kind", "kindId", "stripeAccountId"] as string[],
    additionalProperties: false,
  },
  StripeSubscriptionCancelResponse: {
    type: "object",
    properties: {
      cancelAtPeriodEnd: {
        type: "boolean",
      },
      currentPeriodEnd: {
        type: "number",
        nullable: true,
      },
      ok: {
        type: "boolean",
      },
      stripeStatus: {
        type: "string",
        nullable: true,
      },
      subscriptionId: {
        type: "string",
        nullable: true,
      },
    },
    required: [
      "cancelAtPeriodEnd",
      "currentPeriodEnd",
      "ok",
      "stripeStatus",
      "subscriptionId",
    ] as string[],
    additionalProperties: false,
  },
  Template: {
    type: "object",
    properties: {
      args: { $ref: "#/components/schemas/TemplateArgs" } as const,
      auth: { $ref: "#/components/schemas/TemplateAuth" } as const,
      command: {
        type: "string",
      },
      createdAt: {
        type: "string",
      },
      globalId: {
        type: "string",
      },
      name: {
        type: "string",
      },
      prompt: {
        type: "string",
      },
      provider: {
        type: "string",
        enum: ["custom", "composio", "pipedream"] as const,
      },
      rules: {
        type: "array",
        nullable: true,
        items: { $ref: "#/components/schemas/RuleResponse" } as const,
      },
      transport: {
        type: "string",
        enum: ["sse", "npx", "uvx", "docker", "streamable_http"] as const,
      },
      updatedAt: {
        type: "string",
      },
    },
    required: [
      "args",
      "command",
      "createdAt",
      "globalId",
      "name",
      "prompt",
      "provider",
      "transport",
      "updatedAt",
    ] as string[],
    additionalProperties: false,
  },
  TemplateArgs: {
    type: "object",
    properties: {
      tools: { $ref: "#/components/schemas/ToolList" } as const,
    },
    additionalProperties: false,
  },
  TemplateAuth: {
    type: "object",
    properties: {
      app: {
        type: "string",
        nullable: true,
      },
      type: { $ref: "#/components/schemas/AuthType" } as const,
    },
    required: ["type"] as string[],
    additionalProperties: false,
  },
  TemplatesListResponse: {
    type: "object",
    properties: {
      templates: {
        type: "array",
        items: { $ref: "#/components/schemas/Template" } as const,
      },
    },
    required: ["templates"] as string[],
    additionalProperties: false,
  },
  ToolList: {
    type: "object",
    properties: {
      categories: {
        type: "array",
        items: { $ref: "#/components/schemas/ToolListCategory" } as const,
      },
      tools: {
        type: "array",
        items: { $ref: "#/components/schemas/ToolListItem" } as const,
      },
    },
    required: ["categories", "tools"] as string[],
    additionalProperties: false,
  },
  ToolListCategory: {
    type: "object",
    properties: {
      id: {
        type: "string",
      },
      name: {
        type: "string",
      },
    },
    required: ["id", "name"] as string[],
    additionalProperties: false,
  },
  ToolListItem: {
    type: "object",
    properties: {
      categories: {
        type: "array",
        items: {
          type: "string",
        },
      },
      description: {
        type: "string",
        nullable: true,
      },
      enabled: {
        type: "boolean",
      },
      inputSchema: { $ref: "#/components/schemas/MCPToolInputSchema" } as const,
      name: {
        type: "string",
      },
    },
    required: ["categories", "enabled", "inputSchema", "name"] as string[],
    additionalProperties: false,
  },
  UpdateMcpManagerAuthRequest: {
    type: "object",
    properties: {
      autofillName: {
        type: "boolean",
      },
      refetch: {
        type: "boolean",
      },
    },
    required: ["autofillName", "refetch"] as string[],
    additionalProperties: false,
  },
  UpdateWorkspaceGroupRequest: {
    type: "object",
    properties: {
      role: {
        type: "string",
      },
    },
    required: ["role"] as string[],
    additionalProperties: false,
  },
  VerifyAppApiContractsRequest: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        nullable: true,
      },
      provider: {
        type: "string",
        nullable: true,
      },
    },
    additionalProperties: false,
  },
  VerifyAppApiContractsResponse: {
    type: "object",
    properties: {
      cases: {
        type: "array",
        items: { $ref: "#/components/schemas/VerifyCaseResult" } as const,
      },
      ok: {
        type: "boolean",
      },
      summary: {
        type: "object",
        properties: {
          caseCount: {
            type: "number",
          },
          contractCount: {
            type: "number",
          },
          failCount: {
            type: "number",
          },
          passCount: {
            type: "number",
          },
          warnCount: {
            type: "number",
          },
        },
        required: [
          "caseCount",
          "contractCount",
          "failCount",
          "passCount",
          "warnCount",
        ] as string[],
        additionalProperties: false,
      },
    },
    required: ["cases", "ok", "summary"] as string[],
    additionalProperties: false,
  },
  VerifyCaseResult: {
    type: "object",
    properties: {
      caseName: {
        type: "string",
      },
      consumerAppId: {
        type: "string",
        nullable: true,
      },
      message: {
        type: "string",
        nullable: true,
      },
      operationId: {
        type: "string",
      },
      providerAppId: {
        type: "string",
      },
      request: {
        type: "object",
        nullable: true,
        properties: {
          envelope: { $ref: "#/components/schemas/CallAppApiRequest" } as const,
          url: {
            type: "string",
            nullable: true,
          },
        },
        additionalProperties: false,
      },
      response: {
        type: "object",
        nullable: true,
        properties: {
          body: {
            type: "object",
            additionalProperties: true,
          },
          status: {
            type: "number",
            nullable: true,
          },
        },
        additionalProperties: false,
      },
      status: {
        type: "string",
        enum: ["PASS", "FAIL"] as const,
      },
      warnings: {
        type: "array",
        items: {
          type: "string",
        },
      },
    },
    required: [
      "caseName",
      "operationId",
      "providerAppId",
      "status",
      "warnings",
    ] as string[],
    additionalProperties: false,
  },
  WorkspaceGroupsQuery: {
    type: "object",
    properties: {
      groups: {
        type: "boolean",
        description:
          "Forward the org-service `groups` flag for workspace group listings.",
        nullable: true,
      },
    },
    additionalProperties: false,
  },
  WorkspaceNoteAttachment: {
    type: "object",
    properties: {
      displayName: {
        type: "string",
      },
      globalId: {
        type: "string",
      },
      inList: {
        type: "boolean",
      },
      mime: {
        type: "string",
        nullable: true,
      },
      size: {
        type: "number",
      },
      storedFileUUID: {
        type: "string",
      },
      type: {
        type: "string",
      },
    },
    required: [
      "displayName",
      "globalId",
      "inList",
      "size",
      "storedFileUUID",
      "type",
    ] as string[],
    additionalProperties: false,
  },
  WorkspaceNoteContent: {
    type: "object",
    properties: {
      globalId: {
        type: "string",
      },
      md: {
        type: "string",
      },
      parentId: {
        type: "string",
        nullable: true,
      },
      title: {
        type: "string",
        nullable: true,
      },
    },
    required: ["globalId", "md"] as string[],
    additionalProperties: false,
  },
  WorkspaceNoteContentFormat: {
    type: "string",
    enum: ["text", "html"] as const,
  },
  WorkspaceNoteContentResponse: {
    type: "object",
    properties: {
      note: { $ref: "#/components/schemas/WorkspaceNoteContent" } as const,
    },
    required: ["note"] as string[],
    additionalProperties: false,
  },
  WorkspaceNoteFolderListResponse: {
    type: "object",
    properties: {
      folders: {
        type: "array",
        items: { $ref: "#/components/schemas/WorkspaceNoteSummary" } as const,
      },
    },
    required: ["folders"] as string[],
    additionalProperties: false,
  },
  WorkspaceNoteListQuery: {
    type: "object",
    properties: {
      parentId: {
        type: "string",
        description:
          "Folder global id to list notes from. When omitted, gate defaults to `default`.",
        nullable: true,
      },
    },
    additionalProperties: false,
  },
  WorkspaceNoteListResponse: {
    type: "object",
    properties: {
      notes: {
        type: "array",
        items: { $ref: "#/components/schemas/WorkspaceNoteSummary" } as const,
      },
    },
    required: ["notes"] as string[],
    additionalProperties: false,
  },
  WorkspaceNoteSummary: {
    type: "object",
    properties: {
      globalId: {
        type: "string",
      },
      parentId: {
        type: "string",
        nullable: true,
      },
      title: {
        type: "string",
        nullable: true,
      },
    },
    required: ["globalId"] as string[],
    additionalProperties: false,
  },
} as const;
