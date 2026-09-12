/**
 * FusebaseAuth API
 *
 * Generated from contract introspection
 * Domain: fusebase-auth
 */

import type { Client } from "../runtime/transport";
import type {
  FusebaseAuthChallengeRequestContract,
  FusebaseAuthChallengeResponseContract,
  FusebaseAuthLoginRequestContract,
  FusebaseAuthLoginResponseContract,
  FusebaseAuthLogoutResponseContract,
  FusebaseAuthPasswordResetRequestContract,
  FusebaseAuthPasswordResetResponseContract,
  FusebaseAuthPasswordRestoreKeyResponseContract,
  FusebaseAuthPasswordRestoreRequestContract,
  FusebaseAuthPasswordRestoreResponseContract,
  FusebaseAuthRegisterMemberRequestContract,
  FusebaseAuthRegisterMemberResponseContract,
  FusebaseAuthRegisterRequestContract,
  FusebaseAuthRegisterResponseContract,
  orgIdInPathRequired,
} from "../types";

export class FusebaseAuthApi {
  constructor(private client: Client) {}

  /**
   * Check Fusebase password restore key
   * Checks a restore-password session key through user-service. Returns `{ valid: false }` instead of exposing upstream errors.
   */
  async checkFusebasePasswordRestoreKey(params: {
    path: {
      key: string;
    };
    headers?: Record<string, string>;
  }): Promise<FusebaseAuthPasswordRestoreKeyResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/auth/fusebase/password-restore/:key",
      pathParams: params.path,
      headers: params.headers,
      opId: "checkFusebasePasswordRestoreKey",
      expectedContentType: "application/json",
    });
  }

  /**
   * Complete Fusebase auth challenge
   * Visitor-safe challenge completion endpoint for CAPTCHA, OTP, mail OTP, and MFA flows returned by register/login.
   */
  async completeFusebaseAuthChallenge(params: {
    headers?: Record<string, string>;
    body: FusebaseAuthChallengeRequestContract;
  }): Promise<FusebaseAuthChallengeResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/auth/fusebase/challenge",
      headers: params.headers,
      body: params.body,
      opId: "completeFusebaseAuthChallenge",
      expectedContentType: "application/json",
    });
  }

  /**
   * Login a Fusebase user
   * Visitor-safe email/password login proxy for AI App auth. Forwards to auth-form `/auth/api/auth` server-side and returns sessionId for the app backend to set as its own cookie. Never provisions org membership.
   */
  async loginFusebaseUser(params: {
    headers?: Record<string, string>;
    body: FusebaseAuthLoginRequestContract;
  }): Promise<FusebaseAuthLoginResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/auth/fusebase/login",
      headers: params.headers,
      body: params.body,
      opId: "loginFusebaseUser",
      expectedContentType: "application/json",
    });
  }

  /**
   * Get Fusebase auth logout cookie hints
   * Returns the app-domain cookies that the AI App backend/frontend should clear. Gate cannot clear cookies for an app domain when called on the Gate domain.
   */
  async logoutFusebaseUser(params: {
    headers?: Record<string, string>;
  }): Promise<FusebaseAuthLogoutResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/auth/fusebase/logout",
      headers: params.headers,
      opId: "logoutFusebaseUser",
      expectedContentType: "application/json",
    });
  }

  /**
   * Register a Fusebase user and add org membership
   * Protected AI App onboarding flow. Creates a Fusebase account through auth-form, then adds the newly created user to the path org with the requested role. Requires org.members.write and org access. This endpoint is for registration only; do not call it on login because that can overwrite or duplicate existing membership intent.
   */
  async registerFusebaseOrgMember(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: FusebaseAuthRegisterMemberRequestContract;
  }): Promise<FusebaseAuthRegisterMemberResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/auth/fusebase/register-member",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "registerFusebaseOrgMember",
      expectedContentType: "application/json",
    });
  }

  /**
   * Register a Fusebase user
   * Visitor-safe email/password Fusebase registration proxy for AI App auth. Forwards to auth-form `/auth/api/register` server-side and returns the Fusebase sessionId for the app backend to set as its own cookie. Does not add org membership.
   */
  async registerFusebaseUser(params: {
    headers?: Record<string, string>;
    body: FusebaseAuthRegisterRequestContract;
  }): Promise<FusebaseAuthRegisterResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/auth/fusebase/register",
      headers: params.headers,
      body: params.body,
      opId: "registerFusebaseUser",
      expectedContentType: "application/json",
    });
  }

  /**
   * Request Fusebase password restore
   * Visitor-safe password restore request. Forwards to auth-form `/auth/api/remind` and always returns a generic success shape so the route does not enumerate accounts.
   */
  async requestFusebasePasswordRestore(params: {
    headers?: Record<string, string>;
    body: FusebaseAuthPasswordRestoreRequestContract;
  }): Promise<FusebaseAuthPasswordRestoreResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/auth/fusebase/password-restore",
      headers: params.headers,
      body: params.body,
      opId: "requestFusebasePasswordRestore",
      expectedContentType: "application/json",
    });
  }

  /**
   * Reset Fusebase password
   * Completes a password restore session by setting a new password through user-service.
   */
  async resetFusebasePassword(params: {
    path: {
      key: string;
    };
    headers?: Record<string, string>;
    body: FusebaseAuthPasswordResetRequestContract;
  }): Promise<FusebaseAuthPasswordResetResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/auth/fusebase/password-restore/:key",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "resetFusebasePassword",
      expectedContentType: "application/json",
    });
  }
}
