export type StripeModeContract = "payment" | "subscription";
export type StripeIntervalContract = "day" | "week" | "month" | "year";

export interface StripeOauthLookupRequestContract {
  stripeAccountId?: string | null;
}

export interface StripeOauthContract {
  orgId?: string;
  userId?: number;
  stripeAccountId?: string;
  liveMode?: boolean;
}

export interface StripeOauthLookupResponseContract {
  oauth: StripeOauthContract | null;
}

export interface StripeModeUpdateRequestContract {
  stripeAccountId: string;
  liveMode: boolean;
}

export interface StripeModeMutationResponseContract {
  oauth: StripeOauthContract;
}

export interface StripeProductContract {
  id?: number;
  orgId?: string;
  userId?: number;
  stripeAccountId?: string;
  mode?: StripeModeContract;
  amountCents?: number;
  currency?: string;
  title?: string;
  productId?: string | null;
  priceId?: string | null;
  interval?: StripeIntervalContract;
  intervalCount?: number | null;
  kind?: string;
  kindId?: string;
  deleted?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * For mode=subscription, interval and intervalCount are required.
 * For mode=payment, interval and intervalCount must be omitted.
 */
export interface StripeProductCreateRequestContract {
  stripeAccountId: string;
  mode: StripeModeContract;
  amountCents: number;
  currency: string;
  title: string;
  kind: string;
  kindId: string;
  interval?: StripeIntervalContract;
  intervalCount?: number;
}

export interface StripeProductFindRequestContract {
  stripeAccountId?: string | null;
  kind?: string | null;
  kindId?: string | null;
  mode?: StripeModeContract | null;
}

export interface StripeProductLookupResponseContract {
  product: StripeProductContract | null;
}

export interface StripeProductMutationResponseContract {
  product: StripeProductContract;
}

export interface StripeProductDeleteRequestContract {
  kind: string;
  kindId: string;
  stripeAccountId?: string | null;
}

export interface StripeProductDeleteResponseContract {
  deleted: boolean;
  kind: string;
  kindId: string;
  stripeAccountId?: string | null;
}

export interface StripeCheckoutLinkRequestContract {
  stripeAccountId: string;
  kind: string;
  kindId: string;
  buyerId: number;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
}

export interface StripeCheckoutLinkResponseContract {
  url?: string | null;
}

/**
 * Cancels a Stripe subscription for a buyer and product identity.
 * When cancelAtPeriodEnd is omitted or true, cancellation is scheduled for the end
 * of the current billing period. Set false for immediate cancellation.
 */
export interface StripeSubscriptionCancelRequestContract {
  stripeAccountId: string;
  kind: string;
  kindId: string;
  buyerId: number;
  cancelAtPeriodEnd?: boolean;
}

export interface StripeSubscriptionCancelResponseContract {
  ok: boolean;
  subscriptionId: string | null;
  stripeStatus: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
}

export interface StripePaymentStateRequestContract {
  stripeAccountId: string;
  mode: StripeModeContract;
  kind: string;
  kindId: string;
  buyerId: number;
}

export interface StripePaymentStateResponseContract {
  active?: boolean | null;
}

export const StripeModeContract = {
  Payment: "payment",
  Subscription: "subscription"
} as const;

export const StripeIntervalContract = {
  Day: "day",
  Week: "week",
  Month: "month",
  Year: "year"
} as const;
