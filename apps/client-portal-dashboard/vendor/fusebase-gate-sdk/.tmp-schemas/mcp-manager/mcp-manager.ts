export const RuleScopeTypeContract = {
  Template: "template",
  Server: "server",
  Channel: "channel",
  Organization: "organization",
  Portal: "portal",
  Workspace: "workspace",
  User: "user",
} as const;
export type RuleScopeTypeContract =
  (typeof RuleScopeTypeContract)[keyof typeof RuleScopeTypeContract];

export const ServerProvider = {
  Custom: "custom",
  Composio: "composio",
  Pipedream: "pipedream",
} as const;
export type ServerProvider =
  (typeof ServerProvider)[keyof typeof ServerProvider];

export const ServerTransport = {
  Sse: "sse",
  Npx: "npx",
  Uvx: "uvx",
  Docker: "docker",
  StreamableHttp: "streamable_http",
} as const;
export type ServerTransport =
  (typeof ServerTransport)[keyof typeof ServerTransport];

export const MCPToolInputSchemaTypeEnumContract = {
  Object: "object",
} as const;
export type MCPToolInputSchemaTypeEnumContract =
  (typeof MCPToolInputSchemaTypeEnumContract)[keyof typeof MCPToolInputSchemaTypeEnumContract];

export const AuthTypeContract = {
  Oauth: "oauth",
  ComposioManaged: "composio_managed",
  TokenBearer: "token_bearer",
} as const;
export type AuthTypeContract =
  (typeof AuthTypeContract)[keyof typeof AuthTypeContract];

export const AuthStatusContract = {
  Active: "ACTIVE",
  Initiated: "INITIATED",
  Failed: "FAILED",
  Expired: "EXPIRED",
} as const;
export type AuthStatusContract =
  (typeof AuthStatusContract)[keyof typeof AuthStatusContract];

export const AuthScopeTypeContract = {
  Organization: "organization",
  Workspace: "workspace",
  Portal: "portal",
  User: "user",
  Client: "client",
} as const;
export type AuthScopeTypeContract =
  (typeof AuthScopeTypeContract)[keyof typeof AuthScopeTypeContract];

export type McpManagerAuthGlobalIdInPathRequired = string;
export type McpManagerServerIdInPathRequired = string;
export type McpManagerTemplateIdInPathRequired = string;

export const ServerStatusContract = {
  Initializing: "initializing",
  Connected: "connected",
  Disconnected: "disconnected",
  Failed: "failed",
} as const;
export type ServerStatusContract =
  (typeof ServerStatusContract)[keyof typeof ServerStatusContract];

export interface RuleRelationContract {
  scopeType: RuleScopeTypeContract;
  scopeId: string;
  enabled?: boolean;
}

export interface RuleResponseContract {
  touched: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  templateId?: string;
  labelIds?: Array<string>;
  globalId: string;
  name: string;
  description?: string;
  content: string;
  isTemplate?: boolean;
  metadata?: object;
  relations: Array<RuleRelationContract>;
}

export interface TemplateArgsContract {
  tools?: ToolListContract;
}

export interface ToolListCategoryContract {
  id: string;
  name: string;
}

export interface MCPToolInputSchemaContract {
  type: MCPToolInputSchemaTypeEnumContract;
  properties: { [key: string]: unknown };
  required?: Array<string>;
}

export interface ToolListItemContract {
  enabled: boolean;
  categories: Array<string>;
  name: string;
  description?: string;
  inputSchema: MCPToolInputSchemaContract;
}

export interface ToolListContract {
  categories: Array<ToolListCategoryContract>;
  tools: Array<ToolListItemContract>;
}

export interface TemplateAuthContract {
  type: AuthTypeContract;
  app?: string;
}

export interface TemplateContract {
  createdAt: string;
  updatedAt: string;
  rules?: Array<RuleResponseContract>;
  globalId: string;
  name: string;
  prompt: string;
  transport: ServerTransport;
  provider: ServerProvider;
  command: string;
  args: TemplateArgsContract;
  auth?: TemplateAuthContract;
}

export interface TemplatesListResponseContract {
  templates: TemplateContract[];
}

export interface McpManagerScopeContract {
  scopeType: AuthScopeTypeContract;
  scopeId: string;
}

export interface McpManagerServerChannelContract {
  channelId: string;
  enabled: boolean;
}

export interface CreateMcpManagerServerFromTemplateRequestContract {
  globalId: string;
  scopes: Array<McpManagerScopeContract>;
  channels: Array<McpManagerServerChannelContract>;
  name?: string;
  prompt?: string;
  args?: TemplateArgsContract;
  authId?: string;
}

export interface McpManagerServerResponseContract {
  templateId?: string;
  status: ServerStatusContract;
  createdAt: string;
  updatedAt: string;
  connectedAt?: string;
  deletedAt?: string;
  globalId: string;
  scopes: Array<McpManagerScopeContract>;
  channels: Array<McpManagerServerChannelContract>;
  name: string;
  prompt: string;
  provider: ServerProvider;
  transport: ServerTransport;
  command: string;
  args: TemplateArgsContract;
  authId?: string;
}

export interface UpdateMcpManagerAuthRequestContract {
  refetch: boolean;
  autofillName: boolean;
}

export interface PublicMcpManagerAuthStatusResponseContract {
  status: AuthStatusContract;
}

export interface CallMcpManagerServerToolRequestContract {
  toolName: string;
  args: Record<string, unknown>;
}

export type CallMcpManagerServerToolResponseContract = object;

interface InitiateMcpManagerAuthRequestBaseContract {
  name?: string;
  globalId: string;
  scopes: Array<McpManagerScopeContract>;
  type: AuthTypeContract;
  app: string;
  replaceInactiveAuth?: boolean;
}

export interface InitiateMcpManagerOAuthRequestContract extends InitiateMcpManagerAuthRequestBaseContract {
  type: typeof AuthTypeContract.Oauth;
}

export interface InitiateMcpManagerComposioManagedRequestContract extends InitiateMcpManagerAuthRequestBaseContract {
  type: typeof AuthTypeContract.ComposioManaged;
}

export interface InitiateMcpManagerTokenBearerRequestContract extends InitiateMcpManagerAuthRequestBaseContract {
  type: typeof AuthTypeContract.TokenBearer;
  token: string;
}

export type InitiateMcpManagerAuthRequestContract =
  | InitiateMcpManagerOAuthRequestContract
  | InitiateMcpManagerComposioManagedRequestContract
  | InitiateMcpManagerTokenBearerRequestContract;

export interface McpManagerAuthDataContract {
  connectionStatus: AuthStatusContract;
  connectedAccountId: string;
  redirectUrl?: string;
  app: string;
}

interface McpManagerAuthResponseBaseContract {
  name: string;
  globalId: string;
  scopes: Array<McpManagerScopeContract>;
  type: AuthTypeContract;
  app: string;
  status: AuthStatusContract;
  data: McpManagerAuthDataContract;
  updatedAt: string;
  createdAt: string;
}

export interface McpManagerOAuthResponseContract extends McpManagerAuthResponseBaseContract {
  type: typeof AuthTypeContract.Oauth;
}

export interface McpManagerComposioManagedResponseContract extends McpManagerAuthResponseBaseContract {
  type: typeof AuthTypeContract.ComposioManaged;
}

export interface McpManagerTokenBearerResponseContract extends McpManagerAuthResponseBaseContract {
  type: typeof AuthTypeContract.TokenBearer;
  token: string;
}

export type McpManagerAuthResponseContract =
  | McpManagerOAuthResponseContract
  | McpManagerComposioManagedResponseContract
  | McpManagerTokenBearerResponseContract;
