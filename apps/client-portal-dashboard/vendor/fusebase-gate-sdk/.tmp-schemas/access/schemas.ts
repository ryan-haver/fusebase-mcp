import { schema } from "@fusebase-platform/contracts";
import type {
  AuthenticatedUserSummaryContract,
  MyOrgAccessResponseContract,
} from "./access";

export const AccessSchemas = {
  AuthenticatedUserSummaryContract: schema<AuthenticatedUserSummaryContract>(
    "AuthenticatedUserSummary",
  ),
  MyOrgAccessResponseContract: schema<MyOrgAccessResponseContract>(
    "MyOrgAccessResponse",
  ),
};
