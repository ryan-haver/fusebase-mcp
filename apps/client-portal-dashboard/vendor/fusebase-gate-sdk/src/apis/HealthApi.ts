/**
 * Health API
 *
 * Generated from contract introspection
 * Domain: health
 */

import type { Client } from "../runtime/transport";
import type { GetHealth200ResponseContract } from "../types";

export class HealthApi {
  constructor(private client: Client) {}

  /**
   * Basic health check
   * Returns a simple health status
   */
  async getHealth(params: {
    headers?: Record<string, string>;
  }): Promise<GetHealth200ResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/health",
      headers: params.headers,
      opId: "getHealth",
      expectedContentType: "application/json",
    });
  }
}
