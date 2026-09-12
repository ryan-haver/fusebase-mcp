import { schema } from "@fusebase-platform/contracts";
import type {
  AppApiOperationContract,
  AppApiOperationListResponseContract,
  CallAppApiRequestContract,
  CallAppApiResponseContract,
  VerifyAppApiContractsRequestContract,
  VerifyAppApiContractsResponseContract,
  VerifyCaseResultContract,
} from "./app-api";

export const AppApiSchemas = {
  AppApiOperationContract: schema<AppApiOperationContract>("AppApiOperation"),
  AppApiOperationListResponseContract:
    schema<AppApiOperationListResponseContract>("AppApiOperationListResponse"),
  CallAppApiRequestContract:
    schema<CallAppApiRequestContract>("CallAppApiRequest"),
  CallAppApiResponseContract:
    schema<CallAppApiResponseContract>("CallAppApiResponse"),
  VerifyAppApiContractsRequestContract:
    schema<VerifyAppApiContractsRequestContract>(
      "VerifyAppApiContractsRequest",
    ),
  VerifyCaseResultContract:
    schema<VerifyCaseResultContract>("VerifyCaseResult"),
  VerifyAppApiContractsResponseContract:
    schema<VerifyAppApiContractsResponseContract>(
      "VerifyAppApiContractsResponse",
    ),
  ProductIdInQueryOptional: {
    type: "string",
  },
  AppIdInQueryOptional: {
    type: "string",
  },
  OperationVisibilityInQueryOptional: {
    type: "string",
  },
  SearchQueryRequired: {
    type: "string",
    minLength: 1,
  },
  LimitInQueryOptional: {
    type: "integer",
    minimum: 1,
    maximum: 200,
  },
  AppIdInPathRequired: { type: "string" },
  OperationIdInPathRequired: {
    type: "string",
  },
} as const;
