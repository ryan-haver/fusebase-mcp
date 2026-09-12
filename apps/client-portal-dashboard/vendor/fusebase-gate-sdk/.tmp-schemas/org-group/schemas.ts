import { schema } from "@fusebase-platform/contracts";
import type {
  AddGroupToWorkspaceRequestContract as AddGroupToWorkspaceRequestContractType,
  AddMembersToOrgGroupRequestContract as AddMembersToOrgGroupRequestContractType,
  AddMembersToOrgGroupResponseContract as AddMembersToOrgGroupResponseContractType,
  DeleteOrgGroupResponseContract as DeleteOrgGroupResponseContractType,
  DeleteWorkspaceGroupResponseContract as DeleteWorkspaceGroupResponseContractType,
  OrgGroupContract as OrgGroupContractType,
  OrgGroupCreateRequestContract as OrgGroupCreateRequestContractType,
  OrgGroupIdInPathRequired as OrgGroupIdInPathRequiredType,
  OrgGroupIncludeWorkspaceInQueryOptional as OrgGroupIncludeWorkspaceInQueryOptionalType,
  OrgGroupListResponseContract as OrgGroupListResponseContractType,
  OrgGroupMemberContract as OrgGroupMemberContractType,
  OrgGroupMemberListResponseContract as OrgGroupMemberListResponseContractType,
  OrgGroupResponseContract as OrgGroupResponseContractType,
  OrgGroupUpdateRequestContract as OrgGroupUpdateRequestContractType,
  OrgGroupUserIdInPathRequired as OrgGroupUserIdInPathRequiredType,
  OrgGroupWorkspaceAssignmentTypeContract as OrgGroupWorkspaceAssignmentTypeContractType,
  OrgGroupWorkspaceDetailsContract as OrgGroupWorkspaceDetailsContractType,
  OrgGroupWorkspaceIdInPathRequired as OrgGroupWorkspaceIdInPathRequiredType,
  OrgGroupWorkspaceRoleContract as OrgGroupWorkspaceRoleContractType,
  OrgGroupWorkspacesQueryContract as OrgGroupWorkspacesQueryContractType,
  OrgWorkspaceGroupContract as OrgWorkspaceGroupContractType,
  OrgWorkspaceGroupCountResponseContract as OrgWorkspaceGroupCountResponseContractType,
  OrgWorkspaceGroupListResponseContract as OrgWorkspaceGroupListResponseContractType,
  OrgWorkspaceGroupResponseContract as OrgWorkspaceGroupResponseContractType,
  OrgWorkspaceGroupsIncludeGroupsInQueryOptional as OrgWorkspaceGroupsIncludeGroupsInQueryOptionalType,
  RemoveOrgGroupMemberResponseContract as RemoveOrgGroupMemberResponseContractType,
  UpdateWorkspaceGroupRequestContract as UpdateWorkspaceGroupRequestContractType,
  WorkspaceGroupsQueryContract as WorkspaceGroupsQueryContractType,
} from "./org-group";

const OrgGroupIdInPathRequiredSchema = schema<OrgGroupIdInPathRequiredType>(
  "OrgGroupIdInPathRequired",
);
const OrgGroupUserIdInPathRequiredSchema =
  schema<OrgGroupUserIdInPathRequiredType>("OrgGroupUserIdInPathRequired");
const OrgGroupWorkspaceIdInPathRequiredSchema =
  schema<OrgGroupWorkspaceIdInPathRequiredType>(
    "OrgGroupWorkspaceIdInPathRequired",
  );
const OrgGroupIncludeWorkspaceInQueryOptionalSchema =
  schema<OrgGroupIncludeWorkspaceInQueryOptionalType>(
    "OrgGroupIncludeWorkspaceInQueryOptional",
  );
const OrgWorkspaceGroupsIncludeGroupsInQueryOptionalSchema =
  schema<OrgWorkspaceGroupsIncludeGroupsInQueryOptionalType>(
    "OrgWorkspaceGroupsIncludeGroupsInQueryOptional",
  );
const OrgGroupWorkspaceAssignmentTypeContractSchema =
  schema<OrgGroupWorkspaceAssignmentTypeContractType>(
    "OrgGroupWorkspaceAssignmentType",
  );
const OrgGroupWorkspaceRoleContractSchema =
  schema<OrgGroupWorkspaceRoleContractType>("OrgGroupWorkspaceRole");
const OrgGroupWorkspaceDetailsContractSchema =
  schema<OrgGroupWorkspaceDetailsContractType>("OrgGroupWorkspaceDetails");
const OrgGroupContractSchema = schema<OrgGroupContractType>("OrgGroup");
const OrgGroupListResponseContractSchema =
  schema<OrgGroupListResponseContractType>("OrgGroupListResponse");
const OrgGroupResponseContractSchema =
  schema<OrgGroupResponseContractType>("OrgGroupResponse");
const OrgGroupMemberContractSchema =
  schema<OrgGroupMemberContractType>("OrgGroupMember");
const OrgGroupMemberListResponseContractSchema =
  schema<OrgGroupMemberListResponseContractType>("OrgGroupMemberListResponse");
const OrgWorkspaceGroupContractSchema =
  schema<OrgWorkspaceGroupContractType>("OrgWorkspaceGroup");
const OrgWorkspaceGroupListResponseContractSchema =
  schema<OrgWorkspaceGroupListResponseContractType>(
    "OrgWorkspaceGroupListResponse",
  );
const OrgWorkspaceGroupCountResponseContractSchema =
  schema<OrgWorkspaceGroupCountResponseContractType>(
    "OrgWorkspaceGroupCountResponse",
  );
const OrgGroupCreateRequestContractSchema =
  schema<OrgGroupCreateRequestContractType>("OrgGroupCreateRequest");
const OrgGroupUpdateRequestContractSchema =
  schema<OrgGroupUpdateRequestContractType>("OrgGroupUpdateRequest");
const AddMembersToOrgGroupRequestContractSchema =
  schema<AddMembersToOrgGroupRequestContractType>(
    "AddMembersToOrgGroupRequest",
  );
const AddMembersToOrgGroupResponseContractSchema =
  schema<AddMembersToOrgGroupResponseContractType>(
    "AddMembersToOrgGroupResponse",
  );
const RemoveOrgGroupMemberResponseContractSchema =
  schema<RemoveOrgGroupMemberResponseContractType>(
    "RemoveOrgGroupMemberResponse",
  );
const AddGroupToWorkspaceRequestContractSchema =
  schema<AddGroupToWorkspaceRequestContractType>("AddGroupToWorkspaceRequest");
const UpdateWorkspaceGroupRequestContractSchema =
  schema<UpdateWorkspaceGroupRequestContractType>(
    "UpdateWorkspaceGroupRequest",
  );
const OrgWorkspaceGroupResponseContractSchema =
  schema<OrgWorkspaceGroupResponseContractType>("OrgWorkspaceGroupResponse");
const DeleteOrgGroupResponseContractSchema =
  schema<DeleteOrgGroupResponseContractType>("DeleteOrgGroupResponse");
const DeleteWorkspaceGroupResponseContractSchema =
  schema<DeleteWorkspaceGroupResponseContractType>(
    "DeleteWorkspaceGroupResponse",
  );
const OrgGroupWorkspacesQueryContractSchema =
  schema<OrgGroupWorkspacesQueryContractType>("OrgGroupWorkspacesQuery");
const WorkspaceGroupsQueryContractSchema =
  schema<WorkspaceGroupsQueryContractType>("WorkspaceGroupsQuery");

export const OrgGroupSchemas = {
  OrgGroupIdInPathRequired: OrgGroupIdInPathRequiredSchema,
  OrgGroupUserIdInPathRequired: OrgGroupUserIdInPathRequiredSchema,
  OrgGroupWorkspaceIdInPathRequired: OrgGroupWorkspaceIdInPathRequiredSchema,
  OrgGroupIncludeWorkspaceInQueryOptional:
    OrgGroupIncludeWorkspaceInQueryOptionalSchema,
  OrgWorkspaceGroupsIncludeGroupsInQueryOptional:
    OrgWorkspaceGroupsIncludeGroupsInQueryOptionalSchema,
  OrgGroupWorkspaceAssignmentTypeContract:
    OrgGroupWorkspaceAssignmentTypeContractSchema,
  OrgGroupWorkspaceRoleContract: OrgGroupWorkspaceRoleContractSchema,
  OrgGroupWorkspaceDetailsContract: OrgGroupWorkspaceDetailsContractSchema,
  OrgGroupContract: OrgGroupContractSchema,
  OrgGroupListResponseContract: OrgGroupListResponseContractSchema,
  OrgGroupResponseContract: OrgGroupResponseContractSchema,
  OrgGroupMemberContract: OrgGroupMemberContractSchema,
  OrgGroupMemberListResponseContract: OrgGroupMemberListResponseContractSchema,
  OrgWorkspaceGroupContract: OrgWorkspaceGroupContractSchema,
  OrgWorkspaceGroupListResponseContract:
    OrgWorkspaceGroupListResponseContractSchema,
  OrgWorkspaceGroupCountResponseContract:
    OrgWorkspaceGroupCountResponseContractSchema,
  OrgGroupCreateRequestContract: OrgGroupCreateRequestContractSchema,
  OrgGroupUpdateRequestContract: OrgGroupUpdateRequestContractSchema,
  AddMembersToOrgGroupRequestContract:
    AddMembersToOrgGroupRequestContractSchema,
  AddMembersToOrgGroupResponseContract:
    AddMembersToOrgGroupResponseContractSchema,
  RemoveOrgGroupMemberResponseContract:
    RemoveOrgGroupMemberResponseContractSchema,
  AddGroupToWorkspaceRequestContract: AddGroupToWorkspaceRequestContractSchema,
  UpdateWorkspaceGroupRequestContract:
    UpdateWorkspaceGroupRequestContractSchema,
  OrgWorkspaceGroupResponseContract: OrgWorkspaceGroupResponseContractSchema,
  DeleteOrgGroupResponseContract: DeleteOrgGroupResponseContractSchema,
  DeleteWorkspaceGroupResponseContract:
    DeleteWorkspaceGroupResponseContractSchema,
  OrgGroupWorkspacesQueryContract: OrgGroupWorkspacesQueryContractSchema,
  WorkspaceGroupsQueryContract: WorkspaceGroupsQueryContractSchema,
} as const;
