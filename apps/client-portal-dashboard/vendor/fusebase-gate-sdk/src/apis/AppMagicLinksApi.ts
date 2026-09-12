/**
 * AppMagicLinks API
 *
 * Generated from contract introspection
 * Domain: app-magic-links
 */

import type { Client } from "../runtime/transport";
import type {
  ActivateAppMagicLinkResponseContract,
  CreateAppMagicLinkRequestContract,
  CreateAppMagicLinkResponseContract,
  orgIdInPathRequired,
  RequestAppMagicLinkRequestContract,
  RequestAppMagicLinkResponseContract,
} from "../types";

export class AppMagicLinksApi {
  constructor(private client: Client) {}

  /**
   * Activate an app magic link
   * Unauthenticated activation: exchange a magic-link globalId for a session token (used to set the eversessionid cookie on the app subdomain), a Gate feature token, and a Dashboard feature token, all scoped to the magic link's app and target user. Re-evaluates accessPrincipals at activation time so a link issued before access was revoked can no longer be redeemed. Within the 24h TTL the link can be activated more than once.
   */
  async activateAppMagicLink(params: {
    path: {
      globalId: string;
    };
    headers?: Record<string, string>;
  }): Promise<ActivateAppMagicLinkResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/apps/magic-links/:globalId/activate",
      pathParams: params.path,
      headers: params.headers,
      opId: "activateAppMagicLink",
      expectedContentType: "application/json",
    });
  }

  /**
   * Create an app magic link (invite flow)
   * Owner/admin invite flow. Issues a 24h magic link for the recipient email and dispatches it via the magic_link_app email template. When addToAccessPrincipals is true (default), provisions a brand-new user record if needed and appends a user principal to every feature of the app. Requires app_magic_link.write and org access.
   */
  async createAppMagicLink(params: {
    path: {
      orgId: orgIdInPathRequired;
      appId: string;
    };
    headers?: Record<string, string>;
    body: CreateAppMagicLinkRequestContract;
  }): Promise<CreateAppMagicLinkResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/apps/:appId/magic-links",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "createAppMagicLink",
      expectedContentType: "application/json",
    });
  }

  /**
   * Request an app magic link (visitor self-service flow)
   * Unauthenticated visitor flow. The link is dispatched only when the email already has access to the app under its current accessPrincipals; otherwise the call is a no-op. Always returns 200 with `{ ok: true }` so the response cannot be used to enumerate emails or access. Apply per-IP rate limiting upstream of this call.
   */
  async requestAppMagicLink(params: {
    path: {
      host: string;
    };
    headers?: Record<string, string>;
    body: RequestAppMagicLinkRequestContract;
  }): Promise<RequestAppMagicLinkResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/apps/by-host/:host/magic-links/request",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "requestAppMagicLink",
      expectedContentType: "application/json",
    });
  }
}
