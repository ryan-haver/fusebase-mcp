import { schema } from "@fusebase-platform/contracts";
import type {
  ActivateAppMagicLinkResponseContract,
  CreateAppMagicLinkRequestContract,
  CreateAppMagicLinkResponseContract,
  RequestAppMagicLinkRequestContract,
  RequestAppMagicLinkResponseContract,
} from "./app-magic-link";

export const AppMagicLinkSchemas = {
  CreateAppMagicLinkRequestContract: schema<CreateAppMagicLinkRequestContract>(
    "CreateAppMagicLinkRequest",
  ),
  CreateAppMagicLinkResponseContract:
    schema<CreateAppMagicLinkResponseContract>("CreateAppMagicLinkResponse"),
  RequestAppMagicLinkRequestContract:
    schema<RequestAppMagicLinkRequestContract>("RequestAppMagicLinkRequest"),
  RequestAppMagicLinkResponseContract:
    schema<RequestAppMagicLinkResponseContract>("RequestAppMagicLinkResponse"),
  ActivateAppMagicLinkResponseContract:
    schema<ActivateAppMagicLinkResponseContract>(
      "ActivateAppMagicLinkResponse",
    ),
  AppIdInPathRequired: {
    type: "string",
    minLength: 1,
  },
  HostInPathRequired: {
    type: "string",
    minLength: 1,
  },
  MagicLinkGlobalIdInPathRequired: {
    type: "string",
    minLength: 1,
  },
} as const;
