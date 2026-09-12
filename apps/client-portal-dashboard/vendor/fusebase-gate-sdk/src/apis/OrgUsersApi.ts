/**
 * OrgUsers API
 *
 * Generated from contract introspection
 * Domain: org-users
 */

import type { Client } from "../runtime/transport";
import type {
  orgIdInPathRequired,
  OrgUserAddRequestContract,
  OrgUserAddResponseContract,
  OrgUserListResponseContract,
} from "../types";

export class OrgUsersApi {
  constructor(private client: Client) {}

  /**
   * Add user to organization
   * Invites a user into the organization. Without workspaceId it performs an org invite. With workspaceId it performs a workspace-aware invite and can resolve `default` to the organization's default workspace. For org-only instant client onboarding, send orgRole=`client` with autoConfirmClientInvite=`true`. A successful write does not prove that the current session already has org access; confirm access with getMyOrgAccess. Requires org.members.write and org access.
   */
  async addOrgUser(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: OrgUserAddRequestContract;
  }): Promise<OrgUserAddResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/users",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "addOrgUser",
      expectedContentType: "application/json",
    });
  }

  /**
   * List organization users
   * Returns the list of users (members) of the organization. Requires org.members.read and org access.
   */
  async listOrgUsers(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<OrgUserListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/users",
      pathParams: params.path,
      headers: params.headers,
      opId: "listOrgUsers",
      expectedContentType: "application/json",
    });
  }
}
