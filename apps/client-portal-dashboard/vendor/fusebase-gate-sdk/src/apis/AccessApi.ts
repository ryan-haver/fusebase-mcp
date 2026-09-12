/**
 * Access API
 *
 * Generated from contract introspection
 * Domain: access
 */

import type { Client } from "../runtime/transport";
import type {
  MeResponseContract,
  MyOrgAccessResponseContract,
  orgIdInPathRequired,
} from "../types";

export class AccessApi {
  constructor(private client: Client) {}

  /**
   * Get current actor identity
   * Returns current user identity details together with auth method and resolved permissions/scopes.
   */
  async getMe(params: {
    headers?: Record<string, string>;
  }): Promise<MeResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/me",
      headers: params.headers,
      opId: "getMe",
      expectedContentType: "application/json",
    });
  }

  /**
   * Get current user's organization access status
   * Returns the authenticated user's access status for the specified organization. Unlike org-scoped read endpoints, this route is available before membership exists so clients can distinguish authenticated-but-not-provisioned users from signed-out users.
   */
  async getMyOrgAccess(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<MyOrgAccessResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/me/access",
      pathParams: params.path,
      headers: params.headers,
      opId: "getMyOrgAccess",
      expectedContentType: "application/json",
    });
  }
}
