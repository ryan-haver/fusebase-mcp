import { schema } from "@fusebase-platform/contracts";
import type {
  MeAuthContract,
  MeOrgGroupContract,
  MeResponseContract,
  MeScopeContract,
  MeUserContract,
} from "./me";

export const MeSchemas = {
  MeScopeContract: schema<MeScopeContract>("MeScope"),
  MeOrgGroupContract: schema<MeOrgGroupContract>("MeOrgGroup"),
  MeUserContract: schema<MeUserContract>("MeUser"),
  MeAuthContract: schema<MeAuthContract>("MeAuth"),
  MeResponseContract: schema<MeResponseContract>("MeResponse"),
};
