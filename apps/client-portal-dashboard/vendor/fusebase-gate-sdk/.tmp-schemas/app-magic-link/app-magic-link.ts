/**
 * Request body for createAppMagicLink (owner/admin invite flow).
 */
export interface CreateAppMagicLinkRequestContract {
  /**
   * Recipient email address. The link is dispatched to this address.
   * @format email
   */
  email: string;
  /**
   * Relative app path to land on after activation (e.g. /proposals/abc).
   * Omit for root.
   * @nullable true
   */
  redirectPath?: string | null;
  /**
   * When true (default), append a user principal to every feature of the app
   * and provision a new user record if the email is not yet known.
   * When false, the user must already exist or the call rejects with NotFound.
   */
  addToAccessPrincipals?: boolean;
}

/**
 * Response body for createAppMagicLink.
 */
export interface CreateAppMagicLinkResponseContract {
  /**
   * globalId of the magic link row, also the value passed to the activation
   * endpoint. NIM-42663: omitted together with `magicLinkUrl` when the link
   * may not be handed to the caller.
   */
  id?: string;
  /**
   * Fully qualified URL to the app `/link` route with `id` (and optional
   * `redirect`) query params.
   *
   * NIM-42663: omitted when the recipient email belongs to an existing
   * FuseBase account that is not already a member of this organization —
   * activating a link logs the caller in as that user, so the link is only
   * emailed to the address itself. Present when the invite provisions a
   * brand-new account or targets an existing org member.
   */
  magicLinkUrl?: string;
  /**
   * Unix timestamp (seconds) when the link expires (createdAt + 24h).
   */
  expiresAt: number;
}

/**
 * Request body for requestAppMagicLink (visitor self-service flow).
 */
export interface RequestAppMagicLinkRequestContract {
  /**
   * Email address typed by the visitor. The link is dispatched to this address
   * only when it already has access to the app.
   * @format email
   */
  email: string;
  /**
   * Optional relative app path to land on after activation
   * (e.g. /proposals/abc). Omit for root.
   * @nullable true
   */
  redirectPath?: string | null;
}

/**
 * Generic acknowledgment. Returned for both allowed and denied requests so
 * the response cannot be used to enumerate emails or access state.
 */
export interface RequestAppMagicLinkResponseContract {
  /**
   * Always true.
   */
  ok: boolean;
}

/**
 * Response body for activateAppMagicLink.
 */
export interface ActivateAppMagicLinkResponseContract {
  /**
   * globalId of the magic link that was activated.
   */
  id: string;
  /**
   * Session id usable as the `eversessionid` cookie value.
   */
  sessionToken: string;
  /**
   * Fusebase Gate token scoped to the resolved app feature and target user.
   * May be empty if upstream token issuance failed; the activation itself
   * still succeeded and the SPA can retry.
   */
  featureToken: string;
  /**
   * Dashboard service token scoped to the same feature and user. May be empty
   * if upstream token issuance failed.
   */
  dashboardToken: string;
  /**
   * Relative app path the SPA should navigate to after the cookie is set
   * (e.g. /proposals/abc). Defaults to `/` when no `redirectPath` was provided
   * when the link was created.
   */
  redirectPath: string;
  /**
   * Unix timestamp (seconds) when the magic link expires.
   */
  expiresAt: number;
  /**
   * globalId of the resolved app feature whose access the tokens are scoped to.
   */
  appFeatureId: string;
}
