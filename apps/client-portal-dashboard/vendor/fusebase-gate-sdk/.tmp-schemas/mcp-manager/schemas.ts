import { schema } from "@fusebase-platform/contracts";
import type {
  CallMcpManagerServerToolRequestContract as CallMcpManagerServerToolRequestContractType,
  CallMcpManagerServerToolResponseContract as CallMcpManagerServerToolResponseContractType,
  CreateMcpManagerServerFromTemplateRequestContract as CreateMcpManagerServerFromTemplateRequestContractType,
  InitiateMcpManagerAuthRequestContract as InitiateMcpManagerAuthRequestContractType,
  McpManagerAuthGlobalIdInPathRequired as McpManagerAuthGlobalIdInPathRequiredType,
  McpManagerAuthResponseContract as McpManagerAuthResponseContractType,
  McpManagerServerIdInPathRequired as McpManagerServerIdInPathRequiredType,
  McpManagerServerResponseContract as McpManagerServerResponseContractType,
  McpManagerTemplateIdInPathRequired as McpManagerTemplateIdInPathRequiredType,
  PublicMcpManagerAuthStatusResponseContract as PublicMcpManagerAuthStatusResponseContractType,
  TemplateContract as TemplateContractType,
  TemplatesListResponseContract as TemplatesListResponseContractType,
  UpdateMcpManagerAuthRequestContract as UpdateMcpManagerAuthRequestContractType,
} from "./mcp-manager";

const TemplateContractSchema = schema<TemplateContractType>("Template");
const McpManagerAuthGlobalIdInPathRequiredSchema =
  schema<McpManagerAuthGlobalIdInPathRequiredType>(
    "McpManagerAuthGlobalIdInPathRequired",
  );
const McpManagerServerIdInPathRequiredSchema =
  schema<McpManagerServerIdInPathRequiredType>(
    "McpManagerServerIdInPathRequired",
  );
const McpManagerTemplateIdInPathRequiredSchema =
  schema<McpManagerTemplateIdInPathRequiredType>(
    "McpManagerTemplateIdInPathRequired",
  );
const TemplatesListResponseContractSchema =
  schema<TemplatesListResponseContractType>("TemplatesListResponse");
const InitiateMcpManagerAuthRequestContractSchema =
  schema<InitiateMcpManagerAuthRequestContractType>(
    "InitiateMcpManagerAuthRequest",
  );
const McpManagerAuthResponseContractSchema =
  schema<McpManagerAuthResponseContractType>("McpManagerAuthResponse");
const UpdateMcpManagerAuthRequestContractSchema =
  schema<UpdateMcpManagerAuthRequestContractType>(
    "UpdateMcpManagerAuthRequest",
  );
const PublicMcpManagerAuthStatusResponseContractSchema =
  schema<PublicMcpManagerAuthStatusResponseContractType>(
    "PublicMcpManagerAuthStatusResponse",
  );
const CreateMcpManagerServerFromTemplateRequestContractSchema =
  schema<CreateMcpManagerServerFromTemplateRequestContractType>(
    "CreateMcpManagerServerFromTemplateRequest",
  );
const McpManagerServerResponseContractSchema =
  schema<McpManagerServerResponseContractType>("McpManagerServerResponse");
const CallMcpManagerServerToolRequestContractSchema =
  schema<CallMcpManagerServerToolRequestContractType>(
    "CallMcpManagerServerToolRequest",
  );
const CallMcpManagerServerToolResponseContractSchema =
  schema<CallMcpManagerServerToolResponseContractType>(
    "CallMcpManagerServerToolResponse",
  );

export const McpManagerSchemas = {
  TemplateContract: TemplateContractSchema,
  McpManagerAuthGlobalIdInPathRequired:
    McpManagerAuthGlobalIdInPathRequiredSchema,
  McpManagerServerIdInPathRequired: McpManagerServerIdInPathRequiredSchema,
  McpManagerTemplateIdInPathRequired: McpManagerTemplateIdInPathRequiredSchema,
  TemplatesListResponseContract: TemplatesListResponseContractSchema,
  InitiateMcpManagerAuthRequestContract:
    InitiateMcpManagerAuthRequestContractSchema,
  McpManagerAuthResponseContract: McpManagerAuthResponseContractSchema,
  UpdateMcpManagerAuthRequestContract:
    UpdateMcpManagerAuthRequestContractSchema,
  PublicMcpManagerAuthStatusResponseContract:
    PublicMcpManagerAuthStatusResponseContractSchema,
  CreateMcpManagerServerFromTemplateRequestContract:
    CreateMcpManagerServerFromTemplateRequestContractSchema,
  McpManagerServerResponseContract: McpManagerServerResponseContractSchema,
  CallMcpManagerServerToolRequestContract:
    CallMcpManagerServerToolRequestContractSchema,
  CallMcpManagerServerToolResponseContract:
    CallMcpManagerServerToolResponseContractSchema,
} as const;
