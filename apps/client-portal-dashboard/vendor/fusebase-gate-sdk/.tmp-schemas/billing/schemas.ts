import { schema } from "@fusebase-platform/contracts";
import type {
  StripeCheckoutLinkRequestContract as StripeCheckoutLinkRequestContractType,
  StripeCheckoutLinkResponseContract as StripeCheckoutLinkResponseContractType,
  StripeIntervalContract as StripeIntervalContractType,
  StripeModeContract as StripeModeContractType,
  StripeModeMutationResponseContract as StripeModeMutationResponseContractType,
  StripeModeUpdateRequestContract as StripeModeUpdateRequestContractType,
  StripeOauthContract as StripeOauthContractType,
  StripeOauthLookupRequestContract as StripeOauthLookupRequestContractType,
  StripeOauthLookupResponseContract as StripeOauthLookupResponseContractType,
  StripePaymentStateRequestContract as StripePaymentStateRequestContractType,
  StripePaymentStateResponseContract as StripePaymentStateResponseContractType,
  StripeProductContract as StripeProductContractType,
  StripeProductCreateRequestContract as StripeProductCreateRequestContractType,
  StripeProductDeleteRequestContract as StripeProductDeleteRequestContractType,
  StripeProductDeleteResponseContract as StripeProductDeleteResponseContractType,
  StripeProductFindRequestContract as StripeProductFindRequestContractType,
  StripeProductLookupResponseContract as StripeProductLookupResponseContractType,
  StripeProductMutationResponseContract as StripeProductMutationResponseContractType,
  StripeSubscriptionCancelRequestContract as StripeSubscriptionCancelRequestContractType,
  StripeSubscriptionCancelResponseContract as StripeSubscriptionCancelResponseContractType,
} from "./billing";

const StripeModeContractSchema = schema<StripeModeContractType>("StripeMode");
const StripeIntervalContractSchema =
  schema<StripeIntervalContractType>("StripeInterval");
const StripeOauthContractSchema =
  schema<StripeOauthContractType>("StripeOauth");
const StripeOauthLookupRequestContractSchema =
  schema<StripeOauthLookupRequestContractType>("StripeOauthLookupRequest");
const StripeOauthLookupResponseContractSchema =
  schema<StripeOauthLookupResponseContractType>("StripeOauthLookupResponse");
const StripeModeUpdateRequestContractSchema =
  schema<StripeModeUpdateRequestContractType>("StripeModeUpdateRequest");
const StripeModeMutationResponseContractSchema =
  schema<StripeModeMutationResponseContractType>("StripeModeMutationResponse");
const StripeProductContractSchema =
  schema<StripeProductContractType>("StripeProduct");
const StripeProductCreateRequestContractSchema =
  schema<StripeProductCreateRequestContractType>("StripeProductCreateRequest");
const StripeProductFindRequestContractSchema =
  schema<StripeProductFindRequestContractType>("StripeProductFindRequest");
const StripeProductLookupResponseContractSchema =
  schema<StripeProductLookupResponseContractType>(
    "StripeProductLookupResponse",
  );
const StripeProductMutationResponseContractSchema =
  schema<StripeProductMutationResponseContractType>(
    "StripeProductMutationResponse",
  );
const StripeProductDeleteRequestContractSchema =
  schema<StripeProductDeleteRequestContractType>("StripeProductDeleteRequest");
const StripeProductDeleteResponseContractSchema =
  schema<StripeProductDeleteResponseContractType>(
    "StripeProductDeleteResponse",
  );
const StripeCheckoutLinkRequestContractSchema =
  schema<StripeCheckoutLinkRequestContractType>("StripeCheckoutLinkRequest");
const StripeCheckoutLinkResponseContractSchema =
  schema<StripeCheckoutLinkResponseContractType>("StripeCheckoutLinkResponse");
const StripeSubscriptionCancelRequestContractSchema =
  schema<StripeSubscriptionCancelRequestContractType>(
    "StripeSubscriptionCancelRequest",
  );
const StripeSubscriptionCancelResponseContractSchema =
  schema<StripeSubscriptionCancelResponseContractType>(
    "StripeSubscriptionCancelResponse",
  );
const StripePaymentStateRequestContractSchema =
  schema<StripePaymentStateRequestContractType>("StripePaymentStateRequest");
const StripePaymentStateResponseContractSchema =
  schema<StripePaymentStateResponseContractType>("StripePaymentStateResponse");

export const BillingSchemas = {
  StripeModeContract: StripeModeContractSchema,
  StripeIntervalContract: StripeIntervalContractSchema,
  StripeOauthContract: StripeOauthContractSchema,
  StripeOauthLookupRequestContract: StripeOauthLookupRequestContractSchema,
  StripeOauthLookupResponseContract: StripeOauthLookupResponseContractSchema,
  StripeModeUpdateRequestContract: StripeModeUpdateRequestContractSchema,
  StripeModeMutationResponseContract: StripeModeMutationResponseContractSchema,
  StripeProductContract: StripeProductContractSchema,
  StripeProductCreateRequestContract: StripeProductCreateRequestContractSchema,
  StripeProductFindRequestContract: StripeProductFindRequestContractSchema,
  StripeProductLookupResponseContract:
    StripeProductLookupResponseContractSchema,
  StripeProductMutationResponseContract:
    StripeProductMutationResponseContractSchema,
  StripeProductDeleteRequestContract: StripeProductDeleteRequestContractSchema,
  StripeProductDeleteResponseContract:
    StripeProductDeleteResponseContractSchema,
  StripeCheckoutLinkRequestContract: StripeCheckoutLinkRequestContractSchema,
  StripeCheckoutLinkResponseContract: StripeCheckoutLinkResponseContractSchema,
  StripeSubscriptionCancelRequestContract:
    StripeSubscriptionCancelRequestContractSchema,
  StripeSubscriptionCancelResponseContract:
    StripeSubscriptionCancelResponseContractSchema,
  StripePaymentStateRequestContract: StripePaymentStateRequestContractSchema,
  StripePaymentStateResponseContract: StripePaymentStateResponseContractSchema,
} as const;
