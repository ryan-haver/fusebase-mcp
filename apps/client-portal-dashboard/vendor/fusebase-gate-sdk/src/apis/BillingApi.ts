/**
 * Billing API
 *
 * Generated from contract introspection
 * Domain: billing
 */

import type { Client } from "../runtime/transport";
import type {
  orgIdInPathRequired,
  StripeCheckoutLinkRequestContract,
  StripeCheckoutLinkResponseContract,
  StripeModeMutationResponseContract,
  StripeModeUpdateRequestContract,
  StripeOauthLookupRequestContract,
  StripeOauthLookupResponseContract,
  StripePaymentStateRequestContract,
  StripePaymentStateResponseContract,
  StripeProductCreateRequestContract,
  StripeProductDeleteRequestContract,
  StripeProductDeleteResponseContract,
  StripeProductFindRequestContract,
  StripeProductLookupResponseContract,
  StripeProductMutationResponseContract,
  StripeSubscriptionCancelRequestContract,
  StripeSubscriptionCancelResponseContract,
} from "../types";

export class BillingApi {
  constructor(private client: Client) {}

  /**
   * Cancel Stripe subscription
   * Cancels a Stripe subscription for the supplied buyer and Stripe product identity. When cancelAtPeriodEnd is omitted or true, cancellation is scheduled for the end of the billing period. Set cancelAtPeriodEnd=false for immediate cancellation.
   */
  async cancelStripeSubscription(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: StripeSubscriptionCancelRequestContract;
  }): Promise<StripeSubscriptionCancelResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/billing/stripe/subscription/cancel",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "cancelStripeSubscription",
      expectedContentType: "application/json",
    });
  }

  /**
   * Create Stripe product
   * Creates a Stripe payment or subscription product/link for the organization.
   */
  async createStripeProduct(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: StripeProductCreateRequestContract;
  }): Promise<StripeProductMutationResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/billing/stripe/products",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "createStripeProduct",
      expectedContentType: "application/json",
    });
  }

  /**
   * Delete Stripe product
   * Marks a Stripe product/link as deleted for the supplied kind and kindId.
   */
  async deleteStripeProduct(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: StripeProductDeleteRequestContract;
  }): Promise<StripeProductDeleteResponseContract> {
    return this.client.request({
      method: "DELETE",
      path: "/:orgId/billing/stripe/products",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "deleteStripeProduct",
      expectedContentType: "application/json",
    });
  }

  /**
   * Find Stripe product
   * Returns the Stripe product/link matching the supplied filters, or null when nothing matches.
   */
  async findStripeProduct(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body?: StripeProductFindRequestContract;
  }): Promise<StripeProductLookupResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/billing/stripe/products/find",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "findStripeProduct",
      expectedContentType: "application/json",
    });
  }

  /**
   * Get Stripe OAuth connection
   * Returns the Stripe OAuth connection for the organization, or null when no connected Stripe account matches the lookup.
   */
  async getStripeOauth(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body?: StripeOauthLookupRequestContract;
  }): Promise<StripeOauthLookupResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/billing/stripe/oauth/find",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "getStripeOauth",
      expectedContentType: "application/json",
    });
  }

  /**
   * Get Stripe payment link
   * Creates or retrieves the Stripe checkout URL that the buyer should be redirected to for payment.
   */
  async getStripePaymentLink(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: StripeCheckoutLinkRequestContract;
  }): Promise<StripeCheckoutLinkResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/billing/stripe/payment-link",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "getStripePaymentLink",
      expectedContentType: "application/json",
    });
  }

  /**
   * Get Stripe payment state
   * Returns the latest webhook-backed payment state for the supplied buyer and Stripe product identity.
   */
  async getStripePaymentState(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: StripePaymentStateRequestContract;
  }): Promise<StripePaymentStateResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/billing/stripe/payment-state",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "getStripePaymentState",
      expectedContentType: "application/json",
    });
  }

  /**
   * Update Stripe mode
   * Gate billing currently operates in live mode only. This endpoint updates the Stripe OAuth state but should not be treated as a user-facing live/test mode switch.
   */
  async updateStripeMode(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: StripeModeUpdateRequestContract;
  }): Promise<StripeModeMutationResponseContract> {
    return this.client.request({
      method: "PUT",
      path: "/:orgId/billing/stripe/mode",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "updateStripeMode",
      expectedContentType: "application/json",
    });
  }

  /**
   * Update Stripe product
   * Replaces a Stripe product by marking the existing record deleted for the same kind and kindId, then creating a new one.
   */
  async updateStripeProduct(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: StripeProductCreateRequestContract;
  }): Promise<StripeProductMutationResponseContract> {
    return this.client.request({
      method: "PUT",
      path: "/:orgId/billing/stripe/products",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "updateStripeProduct",
      expectedContentType: "application/json",
    });
  }
}
