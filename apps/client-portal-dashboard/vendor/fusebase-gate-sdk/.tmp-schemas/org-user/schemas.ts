import { schema } from "@fusebase-platform/contracts";
import type {
  CreateWorkspaceRequestContract,
  OrgPortalContract,
  OrgPortalListResponseContract,
  OrgUserAddRequestContract,
  OrgUserAddResponseContract,
  OrgUserContract,
  OrgUserListResponseContract,
  OrgWorkspaceContract,
  OrgWorkspaceListResponseContract,
} from "./org-user";

export const OrgUserSchemas = {
  OrgUserContract: schema<OrgUserContract>("OrgUser"),
  OrgPortalContract: schema<OrgPortalContract>("OrgPortal"),
  OrgPortalListResponseContract: schema<OrgPortalListResponseContract>(
    "OrgPortalListResponse",
  ),
  OrgWorkspaceContract: schema<OrgWorkspaceContract>("OrgWorkspace"),
  OrgWorkspaceListResponseContract: schema<OrgWorkspaceListResponseContract>(
    "OrgWorkspaceListResponse",
  ),
  OrgUserListResponseContract: schema<OrgUserListResponseContract>(
    "OrgUserListResponse",
  ),
  OrgUserAddRequestContract:
    schema<OrgUserAddRequestContract>("OrgUserAddRequest"),
  OrgUserAddResponseContract:
    schema<OrgUserAddResponseContract>("OrgUserAddResponse"),
  CreateWorkspaceRequestContract: schema<CreateWorkspaceRequestContract>(
    "CreateWorkspaceRequest",
  ),
} as const;
