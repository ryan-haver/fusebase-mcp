/**
 * Orgs API
 *
 * Generated from contract introspection
 * Domain: orgs
 */

import type { Client } from "../runtime/transport";
import type { orgIdInPathRequired, OrgUrlResponseContract } from "../types";

export class OrgsApi {
  constructor(private client: Client) {}

  /**
   * Get organization URL
   * Returns the canonical HTTPS base URL for the organization. When a custom CNAME domain is configured, the response uses that hostname; otherwise it uses the org subdomain on the environment Fusebase host (for example `https://{sub}.dev-thefusebase.com`). Requires org.read and org access.
   */
  async getOrgUrl(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<OrgUrlResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/url",
      pathParams: params.path,
      headers: params.headers,
      opId: "getOrgUrl",
      expectedContentType: "application/json",
    });
  }
}
