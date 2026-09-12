/**
 * Workspaces API
 *
 * Generated from contract introspection
 * Domain: workspaces
 */

import type { Client } from "../runtime/transport";
import type {
  CreateWorkspaceRequestContract,
  orgIdInPathRequired,
  OrgWorkspaceContract,
  OrgWorkspaceListResponseContract,
} from "../types";

export class WorkspacesApi {
  constructor(private client: Client) {}

  /**
   * Create a new workspace
   * Creates a new workspace in the organization. Returns the created workspace details. Requires org.write and org access.
   */
  async createWorkspace(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: CreateWorkspaceRequestContract;
  }): Promise<OrgWorkspaceContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/workspaces",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "createWorkspace",
      expectedContentType: "application/json",
    });
  }

  /**
   * List organization workspaces
   * Returns workspaces visible for the caller in the organization and marks the default workspace. Requires org.read and org access.
   */
  async listWorkspaces(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<OrgWorkspaceListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/workspaces",
      pathParams: params.path,
      headers: params.headers,
      opId: "listWorkspaces",
      expectedContentType: "application/json",
    });
  }
}
