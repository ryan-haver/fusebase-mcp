/**
 * System API
 *
 * Generated from contract introspection
 * Domain: system
 */

import type { Client } from "../runtime/transport";
import type {
  ListPermissionCatalogResponseContract,
  ResolveOperationPermissionsRequestContract,
  ResolveOperationPermissionsResponseContract,
} from "../types";

export class SystemApi {
  constructor(private client: Client) {}

  /**
   * List all registered permissions
   * Return the full permission catalog registered by the current service, including platform base permissions and service-owned permissions.
   */
  async listPermissionCatalog(params: {
    headers?: Record<string, string>;
  }): Promise<ListPermissionCatalogResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/system/permissions/catalog",
      headers: params.headers,
      opId: "listPermissionCatalog",
      expectedContentType: "application/json",
    });
  }

  /**
   * Resolve required permissions for operations
   * Return the unique required permissions for a list of operation identifiers. Supports exact operation ids and sanitized MCP tool names. Public operations contribute no permission.
   */
  async resolveOperationPermissions(params: {
    headers?: Record<string, string>;
    body: ResolveOperationPermissionsRequestContract;
  }): Promise<ResolveOperationPermissionsResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/system/operations/permissions",
      headers: params.headers,
      body: params.body,
      opId: "resolveOperationPermissions",
      expectedContentType: "application/json",
    });
  }
}
