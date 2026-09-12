/**
 * AppApis API
 *
 * Generated from contract introspection
 * Domain: app-apis
 */

import type { Client } from "../runtime/transport";
import type {
  AppApiOperationContract,
  AppApiOperationListResponseContract,
  CallAppApiRequestContract,
  CallAppApiResponseContract,
  orgIdInPathRequired,
  VerifyAppApiContractsRequestContract,
  VerifyAppApiContractsResponseContract,
} from "../types";

export class AppApisApi {
  constructor(private client: Client) {}

  /**
   * Call app API operation
   * Invokes a published app API operation through the owner app runtime using a runtime app token minted for the current authenticated caller context.
   */
  async callAppApi(params: {
    path: {
      orgId: orgIdInPathRequired;
      appId: string;
      operationId: string;
    };
    headers?: Record<string, string>;
    body?: CallAppApiRequestContract;
  }): Promise<CallAppApiResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/apps/:appId/app-apis/:operationId/call",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "callAppApi",
      expectedContentType: "application/json",
    });
  }

  /**
   * Describe app API operation
   * Returns one published app API operation for the requested app and operation id.
   */
  async getAppApiOperation(params: {
    path: {
      orgId: orgIdInPathRequired;
      appId: string;
      operationId: string;
    };
    headers?: Record<string, string>;
  }): Promise<AppApiOperationContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/apps/:appId/app-apis/:operationId",
      pathParams: params.path,
      headers: params.headers,
      opId: "getAppApiOperation",
      expectedContentType: "application/json",
    });
  }

  /**
   * List app API operations
   * Returns published app API operations visible inside the organization. Optional filters narrow the result by app, feature, visibility, and limit.
   */
  async listAppApiOperations(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    query?: {
      productId?: string;
      appId?: string;
      visibility?: string;
      limit?: number;
    };
    headers?: Record<string, string>;
  }): Promise<AppApiOperationListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/app-apis",
      pathParams: params.path,
      query: params.query,
      headers: params.headers,
      opId: "listAppApiOperations",
      expectedContentType: "application/json",
    });
  }

  /**
   * Search app API operations
   * Searches published app API operations by operation id and descriptive fields inside the organization.
   */
  async searchAppApiOperations(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    query?: {
      query?: string;
      limit?: number;
    };
    headers?: Record<string, string>;
  }): Promise<AppApiOperationListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/app-apis/search",
      pathParams: params.path,
      query: params.query,
      headers: params.headers,
      opId: "searchAppApiOperations",
      expectedContentType: "application/json",
    });
  }

  /**
   * Verify consumer app API contracts
   * Loads stored consumer contracts for the selected app, executes each case through Gate's real app API call path as the authenticated user, and returns PASS/FAIL results plus schema warnings.
   */
  async verifyConsumerAppApiContracts(params: {
    path: {
      orgId: orgIdInPathRequired;
      appId: string;
    };
    headers?: Record<string, string>;
    body?: VerifyAppApiContractsRequestContract;
  }): Promise<VerifyAppApiContractsResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/apps/:appId/app-api-contracts/verify-consumer",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "verifyConsumerAppApiContracts",
      expectedContentType: "application/json",
    });
  }

  /**
   * Verify inbound app API contracts
   * Loads all stored consumer contracts targeting the selected provider app inside the organization and executes them through Gate's real app API call path as the authenticated user.
   */
  async verifyProviderAppApiContracts(params: {
    path: {
      orgId: orgIdInPathRequired;
      appId: string;
    };
    headers?: Record<string, string>;
    body?: VerifyAppApiContractsRequestContract;
  }): Promise<VerifyAppApiContractsResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/apps/:appId/app-api-contracts/verify-provider",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "verifyProviderAppApiContracts",
      expectedContentType: "application/json",
    });
  }
}
