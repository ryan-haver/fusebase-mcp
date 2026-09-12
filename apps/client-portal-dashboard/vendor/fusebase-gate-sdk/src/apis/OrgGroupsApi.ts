/**
 * OrgGroups API
 *
 * Generated from contract introspection
 * Domain: org-groups
 */

import type { Client } from "../runtime/transport";
import type {
  AddGroupToWorkspaceRequestContract,
  AddMembersToOrgGroupRequestContract,
  AddMembersToOrgGroupResponseContract,
  DeleteOrgGroupResponseContract,
  DeleteWorkspaceGroupResponseContract,
  OrgGroupCreateRequestContract,
  OrgGroupIdInPathRequired,
  OrgGroupIncludeWorkspaceInQueryOptional,
  OrgGroupListResponseContract,
  OrgGroupMemberListResponseContract,
  OrgGroupResponseContract,
  OrgGroupUpdateRequestContract,
  OrgGroupUserIdInPathRequired,
  OrgGroupWorkspaceIdInPathRequired,
  orgIdInPathRequired,
  OrgWorkspaceGroupCountResponseContract,
  OrgWorkspaceGroupListResponseContract,
  OrgWorkspaceGroupResponseContract,
  OrgWorkspaceGroupsIncludeGroupsInQueryOptional,
  RemoveOrgGroupMemberResponseContract,
  UpdateWorkspaceGroupRequestContract,
} from "../types";

export class OrgGroupsApi {
  constructor(private client: Client) {}

  /**
   * Add group to workspace
   * Assigns an organization group to a workspace with the requested role. The workspace must belong to orgId.
   */
  async addGroupToWorkspace(params: {
    path: {
      orgId: orgIdInPathRequired;
      workspaceId: OrgGroupWorkspaceIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: AddGroupToWorkspaceRequestContract;
  }): Promise<OrgWorkspaceGroupResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/workspaces/:workspaceId/groups",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "addGroupToWorkspace",
      expectedContentType: "application/json",
    });
  }

  /**
   * Add members to organization group
   * Adds one or more users to the specified organization group.
   */
  async addMembersToOrgGroup(params: {
    path: {
      orgId: orgIdInPathRequired;
      groupId: OrgGroupIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: AddMembersToOrgGroupRequestContract;
  }): Promise<AddMembersToOrgGroupResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/groups/:groupId/members",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "addMembersToOrgGroup",
      expectedContentType: "application/json",
    });
  }

  /**
   * Count workspace groups
   * Returns the number of group assignments for the requested workspace. The workspace must belong to orgId.
   */
  async countWorkspaceGroups(params: {
    path: {
      orgId: orgIdInPathRequired;
      workspaceId: OrgGroupWorkspaceIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<OrgWorkspaceGroupCountResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/workspaces/:workspaceId/groups/count",
      pathParams: params.path,
      headers: params.headers,
      opId: "countWorkspaceGroups",
      expectedContentType: "application/json",
    });
  }

  /**
   * Create organization group
   * Creates a group in the organization and can optionally assign it to workspace roles in the same request.
   */
  async createOrgGroup(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: OrgGroupCreateRequestContract;
  }): Promise<OrgGroupResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/groups",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "createOrgGroup",
      expectedContentType: "application/json",
    });
  }

  /**
   * Delete organization group
   * Deletes the group from the organization and removes its workspace assignments.
   */
  async deleteOrgGroup(params: {
    path: {
      orgId: orgIdInPathRequired;
      groupId: OrgGroupIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<DeleteOrgGroupResponseContract> {
    return this.client.request({
      method: "DELETE",
      path: "/:orgId/groups/:groupId",
      pathParams: params.path,
      headers: params.headers,
      opId: "deleteOrgGroup",
      expectedContentType: "application/json",
    });
  }

  /**
   * Delete workspace group assignment
   * Removes a group from the requested workspace. The workspace must belong to orgId.
   */
  async deleteWorkspaceGroup(params: {
    path: {
      orgId: orgIdInPathRequired;
      workspaceId: OrgGroupWorkspaceIdInPathRequired;
      groupId: OrgGroupIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<DeleteWorkspaceGroupResponseContract> {
    return this.client.request({
      method: "DELETE",
      path: "/:orgId/workspaces/:workspaceId/groups/:groupId",
      pathParams: params.path,
      headers: params.headers,
      opId: "deleteWorkspaceGroup",
      expectedContentType: "application/json",
    });
  }

  /**
   * Get organization group
   * Returns one group in the organization by id.
   */
  async getOrgGroup(params: {
    path: {
      orgId: orgIdInPathRequired;
      groupId: OrgGroupIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<OrgGroupResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/groups/:groupId",
      pathParams: params.path,
      headers: params.headers,
      opId: "getOrgGroup",
      expectedContentType: "application/json",
    });
  }

  /**
   * List organization group members
   * Returns the current users assigned to the specified group.
   */
  async listOrgGroupMembers(params: {
    path: {
      orgId: orgIdInPathRequired;
      groupId: OrgGroupIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<OrgGroupMemberListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/groups/:groupId/members",
      pathParams: params.path,
      headers: params.headers,
      opId: "listOrgGroupMembers",
      expectedContentType: "application/json",
    });
  }

  /**
   * List organization groups
   * Returns groups in the organization with current member and workspace counts.
   */
  async listOrgGroups(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<OrgGroupListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/groups",
      pathParams: params.path,
      headers: params.headers,
      opId: "listOrgGroups",
      expectedContentType: "application/json",
    });
  }

  /**
   * List organization group workspaces
   * Returns workspace role assignments for a group. Set query.workspace=true to include workspace details when available from org-service.
   */
  async listOrgGroupWorkspaces(params: {
    path: {
      orgId: orgIdInPathRequired;
      groupId: OrgGroupIdInPathRequired;
    };
    query?: {
      workspace?: OrgGroupIncludeWorkspaceInQueryOptional;
    };
    headers?: Record<string, string>;
  }): Promise<OrgWorkspaceGroupListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/groups/:groupId/workspaces",
      pathParams: params.path,
      query: params.query,
      headers: params.headers,
      opId: "listOrgGroupWorkspaces",
      expectedContentType: "application/json",
    });
  }

  /**
   * List organization workspace-group assignments
   * Returns all current workspace-group assignments visible for the organization.
   */
  async listOrgWorkspaceGroups(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<OrgWorkspaceGroupListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/workspace-groups",
      pathParams: params.path,
      headers: params.headers,
      opId: "listOrgWorkspaceGroups",
      expectedContentType: "application/json",
    });
  }

  /**
   * List user organization groups
   * Returns groups that currently include the requested user inside the organization.
   */
  async listUserOrgGroups(params: {
    path: {
      orgId: orgIdInPathRequired;
      userId: OrgGroupUserIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<OrgGroupListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/users/:userId/groups",
      pathParams: params.path,
      headers: params.headers,
      opId: "listUserOrgGroups",
      expectedContentType: "application/json",
    });
  }

  /**
   * List workspace groups
   * Returns group-to-workspace assignments for the requested workspace. The workspace must belong to orgId.
   */
  async listWorkspaceGroups(params: {
    path: {
      orgId: orgIdInPathRequired;
      workspaceId: OrgGroupWorkspaceIdInPathRequired;
    };
    query?: {
      groups?: OrgWorkspaceGroupsIncludeGroupsInQueryOptional;
    };
    headers?: Record<string, string>;
  }): Promise<OrgWorkspaceGroupListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/workspaces/:workspaceId/groups",
      pathParams: params.path,
      query: params.query,
      headers: params.headers,
      opId: "listWorkspaceGroups",
      expectedContentType: "application/json",
    });
  }

  /**
   * Remove member from organization group
   * Removes one user from the specified organization group.
   */
  async removeOrgGroupMember(params: {
    path: {
      orgId: orgIdInPathRequired;
      groupId: OrgGroupIdInPathRequired;
      userId: OrgGroupUserIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<RemoveOrgGroupMemberResponseContract> {
    return this.client.request({
      method: "DELETE",
      path: "/:orgId/groups/:groupId/members/:userId",
      pathParams: params.path,
      headers: params.headers,
      opId: "removeOrgGroupMember",
      expectedContentType: "application/json",
    });
  }

  /**
   * Update organization group
   * Updates group metadata and, when provided, replaces its workspace assignments.
   */
  async updateOrgGroup(params: {
    path: {
      orgId: orgIdInPathRequired;
      groupId: OrgGroupIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: OrgGroupUpdateRequestContract;
  }): Promise<OrgGroupResponseContract> {
    return this.client.request({
      method: "PUT",
      path: "/:orgId/groups/:groupId",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "updateOrgGroup",
      expectedContentType: "application/json",
    });
  }

  /**
   * Update workspace group assignment
   * Updates one group's role inside a workspace. The workspace must belong to orgId.
   */
  async updateWorkspaceGroup(params: {
    path: {
      orgId: orgIdInPathRequired;
      workspaceId: OrgGroupWorkspaceIdInPathRequired;
      groupId: OrgGroupIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: UpdateWorkspaceGroupRequestContract;
  }): Promise<OrgWorkspaceGroupResponseContract> {
    return this.client.request({
      method: "PUT",
      path: "/:orgId/workspaces/:workspaceId/groups/:groupId",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "updateWorkspaceGroup",
      expectedContentType: "application/json",
    });
  }
}
