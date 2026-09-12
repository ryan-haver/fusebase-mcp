export type OrgGroupIdInPathRequired = string;
export type OrgGroupUserIdInPathRequired = number;
export type OrgGroupWorkspaceIdInPathRequired = string;
export type OrgGroupIncludeWorkspaceInQueryOptional = boolean | null;
export type OrgWorkspaceGroupsIncludeGroupsInQueryOptional = boolean | null;
export type OrgGroupWorkspaceAssignmentTypeContract = "full" | "partial";

export interface OrgGroupContract {
  id: string;
  orgId: string;
  name: string;
  description?: string | null;
  userId?: number;
  createdAt: number;
  updatedAt: number;
  memberCount?: number;
  workspaceCount?: number;
}

export interface OrgGroupListResponseContract {
  groups: OrgGroupContract[];
}

export interface OrgGroupResponseContract {
  group: OrgGroupContract;
}

export interface OrgGroupMemberContract {
  groupId: string;
  orgId: string;
  userId: number;
  addedByUserId: number;
  createdAt: number;
  updatedAt: number;
}

export interface OrgGroupMemberListResponseContract {
  members: OrgGroupMemberContract[];
}

export interface OrgGroupWorkspaceRoleContract {
  workspaceId: string;
  role: string;
}

export interface OrgGroupWorkspaceDetailsContract {
  id?: string;
  orgId?: string;
  userId?: number;
  createdAt?: number;
  updatedAt?: number;
  title?: string | null;
  isDefault?: boolean;
  defaultEncryptionKeyId?: string | null;
  isNotesLimited?: boolean;
  color?: string | null;
  brandingProfileId?: string | null;
  webClientBrandingProfileId?: string | null;
  orgSubscriptionType?: string;
  orgSubscriptionPrivileges?: string[];
}

export interface OrgWorkspaceGroupContract {
  addedByUserId: number;
  groupId: string;
  createdAt: number;
  updatedAt: number;
  type: OrgGroupWorkspaceAssignmentTypeContract;
  workspaceId: string;
  role: string;
  orgId: string;
  workspace?: OrgGroupWorkspaceDetailsContract;
}

export interface OrgWorkspaceGroupListResponseContract {
  workspaceGroups: OrgWorkspaceGroupContract[];
}

export interface OrgWorkspaceGroupCountResponseContract {
  count: number;
}

export interface OrgGroupCreateRequestContract {
  name: string;
  description?: string | null;
  workspaces?: OrgGroupWorkspaceRoleContract[] | null;
}

export interface OrgGroupUpdateRequestContract {
  name?: string;
  description?: string | null;
  workspaces?: OrgGroupWorkspaceRoleContract[] | null;
}

export interface AddMembersToOrgGroupRequestContract {
  userIds: number[];
}

export interface AddMembersToOrgGroupResponseContract {
  members: OrgGroupMemberContract[];
}

export interface RemoveOrgGroupMemberResponseContract {
  removed: boolean;
  groupId: string;
  userId: number;
}

export interface AddGroupToWorkspaceRequestContract {
  groupId: string;
  role: string;
  type?: OrgGroupWorkspaceAssignmentTypeContract | null;
}

export interface UpdateWorkspaceGroupRequestContract {
  role: string;
}

export interface OrgWorkspaceGroupResponseContract {
  workspaceGroup: OrgWorkspaceGroupContract;
}

export interface DeleteOrgGroupResponseContract {
  deleted: boolean;
  groupId: string;
}

export interface DeleteWorkspaceGroupResponseContract {
  deleted: boolean;
  workspaceId: string;
  groupId: string;
}

export interface OrgGroupWorkspacesQueryContract {
  /**
   * Include workspace details in each workspace-group record.
   */
  workspace?: OrgGroupIncludeWorkspaceInQueryOptional;
}

export interface WorkspaceGroupsQueryContract {
  /**
   * Forward the org-service `groups` flag for workspace group listings.
   */
  groups?: OrgWorkspaceGroupsIncludeGroupsInQueryOptional;
}
