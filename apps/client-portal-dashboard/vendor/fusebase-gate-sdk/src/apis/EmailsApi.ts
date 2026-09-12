/**
 * Emails API
 *
 * Generated from contract introspection
 * Domain: emails
 */

import type { Client } from "../runtime/transport";
import type {
  OrgEmailSendRequestContract,
  OrgEmailSendResponseContract,
  orgIdInPathRequired,
} from "../types";

export class EmailsApi {
  constructor(private client: Client) {}

  /**
   * Send an email to one organization member
   * Sends an email to exactly one organization member identified by a recipient string that is interpreted as a digit-only userId or an email. The target must already belong to the provided organization.
   */
  async sendOrgEmail(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: OrgEmailSendRequestContract;
  }): Promise<OrgEmailSendResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/email",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "sendOrgEmail",
      expectedContentType: "application/json",
    });
  }
}
