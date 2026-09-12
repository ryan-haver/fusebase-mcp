import { schema } from "@fusebase-platform/contracts";
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
} from "./fusebase-auth";

export const FusebaseAuthSchemas = {
  FusebaseAuthRegisterRequestContract:
    schema<FusebaseAuthRegisterRequestContract>("FusebaseAuthRegisterRequest"),
  FusebaseAuthRegisterResponseContract:
    schema<FusebaseAuthRegisterResponseContract>(
      "FusebaseAuthRegisterResponse",
    ),
  FusebaseAuthRegisterMemberRequestContract:
    schema<FusebaseAuthRegisterMemberRequestContract>(
      "FusebaseAuthRegisterMemberRequest",
    ),
  FusebaseAuthRegisterMemberResponseContract:
    schema<FusebaseAuthRegisterMemberResponseContract>(
      "FusebaseAuthRegisterMemberResponse",
    ),
  FusebaseAuthLoginRequestContract: schema<FusebaseAuthLoginRequestContract>(
    "FusebaseAuthLoginRequest",
  ),
  FusebaseAuthLoginResponseContract: schema<FusebaseAuthLoginResponseContract>(
    "FusebaseAuthLoginResponse",
  ),
  FusebaseAuthChallengeRequestContract:
    schema<FusebaseAuthChallengeRequestContract>(
      "FusebaseAuthChallengeRequest",
    ),
  FusebaseAuthChallengeResponseContract:
    schema<FusebaseAuthChallengeResponseContract>(
      "FusebaseAuthChallengeResponse",
    ),
  FusebaseAuthPasswordRestoreRequestContract:
    schema<FusebaseAuthPasswordRestoreRequestContract>(
      "FusebaseAuthPasswordRestoreRequest",
    ),
  FusebaseAuthPasswordRestoreResponseContract:
    schema<FusebaseAuthPasswordRestoreResponseContract>(
      "FusebaseAuthPasswordRestoreResponse",
    ),
  FusebaseAuthPasswordRestoreKeyResponseContract:
    schema<FusebaseAuthPasswordRestoreKeyResponseContract>(
      "FusebaseAuthPasswordRestoreKeyResponse",
    ),
  FusebaseAuthPasswordResetRequestContract:
    schema<FusebaseAuthPasswordResetRequestContract>(
      "FusebaseAuthPasswordResetRequest",
    ),
  FusebaseAuthPasswordResetResponseContract:
    schema<FusebaseAuthPasswordResetResponseContract>(
      "FusebaseAuthPasswordResetResponse",
    ),
  FusebaseAuthLogoutResponseContract:
    schema<FusebaseAuthLogoutResponseContract>("FusebaseAuthLogoutResponse"),
  RestoreKeyInPathRequired: {
    type: "string",
    minLength: 1,
  },
} as const;
