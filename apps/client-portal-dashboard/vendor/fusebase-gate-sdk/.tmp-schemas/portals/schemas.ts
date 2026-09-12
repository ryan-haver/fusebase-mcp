import { schema } from "@fusebase-platform/contracts";
import type {
  CreatePortalRequestContract,
  CreatePortalResponseContract,
  DuplicatePortalRequestContract,
  globalIdInPathRequired,
  InviteToPortalRequestContract,
  InviteToPortalResponseContract,
  ListPortalContentResponseContract,
  PortalDetailContract,
} from "./portals";

export const PortalSchemas = {
  PortalDetailContract: schema<PortalDetailContract>("PortalDetail"),
  GlobalIdInPathRequired: schema<globalIdInPathRequired>(
    "globalIdInPathRequired",
  ),
  CreatePortalRequestContract: schema<CreatePortalRequestContract>(
    "CreatePortalRequest",
  ),
  CreatePortalResponseContract: schema<CreatePortalResponseContract>(
    "CreatePortalResponse",
  ),
  DuplicatePortalRequestContract: schema<DuplicatePortalRequestContract>(
    "DuplicatePortalRequest",
  ),
  InviteToPortalRequestContract: schema<InviteToPortalRequestContract>(
    "InviteToPortalRequest",
  ),
  InviteToPortalResponseContract: schema<InviteToPortalResponseContract>(
    "InviteToPortalResponse",
  ),
  ListPortalContentResponseContract: schema<ListPortalContentResponseContract>(
    "ListPortalContentResponse",
  ),
} as const;
