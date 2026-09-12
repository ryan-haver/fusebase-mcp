/**
 * Tokens API
 *
 * Generated from contract introspection
 * Domain: tokens
 */

import type { Client } from "../runtime/transport";
import type {
  CreateTokenRequestContract,
  CreateTokenResponseContract,
  RevokeTokenResponseContract,
  scopeIdInQueryRequired,
  scopeTypeOrgInQueryRequired,
  TokenListResponseContract,
  TokenResponseContract,
  UpdateTokenRequestContract,
} from "../types";

export class TokensApi {
  constructor(private client: Client) {}

  /**
   * Create a new API token
   * Create a new API token with specified scopes and permissions.
   * The token value is only returned once on creation - store it securely.
   * At least one org scope is required in the scopes array.
   *
   */
  async createToken(params: {
    headers?: Record<string, string>;
    body: CreateTokenRequestContract;
  }): Promise<CreateTokenResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/tokens",
      headers: params.headers,
      body: params.body,
      opId: "createToken",
      expectedContentType: "application/json",
    });
  }

  /**
   * Get token by ID
   * Retrieve details of a specific API token by its global ID
   */
  async getToken(params: {
    path: {
      tokenId: string;
    };
    headers?: Record<string, string>;
  }): Promise<TokenResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/tokens/:tokenId",
      pathParams: params.path,
      headers: params.headers,
      opId: "getToken",
      expectedContentType: "application/json",
    });
  }

  /**
   * List user's API tokens
   * Retrieve a list of all API tokens for the authenticated user.
   * Optionally filter by scope type and scope ID (both must be provided together).
   *
   */
  async listTokens(params: {
    query?: {
      scope_type: scopeTypeOrgInQueryRequired;
      scope_id: scopeIdInQueryRequired;
    };
    headers?: Record<string, string>;
  }): Promise<TokenListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/tokens",
      query: params.query,
      headers: params.headers,
      opId: "listTokens",
      expectedContentType: "application/json",
    });
  }

  /**
   * Revoke token
   * Permanently revoke (soft delete) an API token.
   * Once revoked, the token can no longer be used for authentication.
   *
   */
  async revokeToken(params: {
    path: {
      tokenId: string;
    };
    headers?: Record<string, string>;
  }): Promise<RevokeTokenResponseContract> {
    return this.client.request({
      method: "DELETE",
      path: "/tokens/:tokenId",
      pathParams: params.path,
      headers: params.headers,
      opId: "revokeToken",
      expectedContentType: "application/json",
    });
  }

  /**
   * Update token
   * Update token properties (name, permissions, expiration).
   * Note: The token value itself cannot be changed.
   *
   */
  async updateToken(params: {
    path: {
      tokenId: string;
    };
    headers?: Record<string, string>;
    body: UpdateTokenRequestContract;
  }): Promise<TokenResponseContract> {
    return this.client.request({
      method: "PUT",
      path: "/tokens/:tokenId",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "updateToken",
      expectedContentType: "application/json",
    });
  }
}
