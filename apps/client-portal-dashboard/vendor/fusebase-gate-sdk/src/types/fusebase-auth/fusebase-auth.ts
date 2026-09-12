export interface FusebaseAuthSessionContract {
  sessionId: string;
  userId: number;
}

export interface FusebaseAuthChallengeContract {
  type: string;
  state: string;
  image?: string;
  question?: string;
  email?: string;
}

export interface FusebaseAuthRegisterRequestContract {
  /**
   * User email. Forwarded to auth-form as `login`.
   * @format email
   */
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  subscribe?: boolean;
  redirectPath?: string | null;
  tags?: string[];
}

export interface FusebaseAuthRegisterResponseContract {
  status: "authenticated" | "challenge_required";
  session?: FusebaseAuthSessionContract;
  challenge?: FusebaseAuthChallengeContract;
  redirectPath: string;
}

export interface FusebaseAuthRegisterMemberRequestContract extends FusebaseAuthRegisterRequestContract {
  /**
   * Org role to grant after the Fusebase account is created.
   * Defaults to `client`.
   */
  orgRole?: string;
  memberTTL?: number | null;
  defaultWorkspaceRole?: string;
}

export interface FusebaseAuthRegisterMemberResponseContract extends FusebaseAuthRegisterResponseContract {
  membership?: {
    orgId: string;
    userId: number;
    role: string;
    memberTTL?: number | null;
  };
}

export interface FusebaseAuthLoginRequestContract {
  /**
   * User email. Forwarded to auth-form as `login`.
   * @format email
   */
  email: string;
  password: string;
  redirectPath?: string | null;
  device?: Record<string, unknown>;
}

export interface FusebaseAuthLoginResponseContract {
  status: "authenticated" | "challenge_required";
  session?: FusebaseAuthSessionContract;
  challenge?: FusebaseAuthChallengeContract;
  redirectPath: string;
}

export interface FusebaseAuthChallengeRequestContract {
  state: string;
  answer: string;
  redirectPath?: string | null;
}

export interface FusebaseAuthChallengeResponseContract {
  status: "authenticated" | "challenge_required";
  session?: FusebaseAuthSessionContract;
  challenge?: FusebaseAuthChallengeContract;
  redirectPath: string;
}

export interface FusebaseAuthPasswordRestoreRequestContract {
  /**
   * User email. The response is intentionally generic.
   * @format email
   */
  email: string;
  customAuthUrl?: string;
  portalId?: string;
  workspaceId?: string;
}

export interface FusebaseAuthPasswordRestoreResponseContract {
  ok: true;
}

export interface FusebaseAuthPasswordRestoreKeyResponseContract {
  valid: boolean;
}

export interface FusebaseAuthPasswordResetRequestContract {
  password: string;
}

export interface FusebaseAuthPasswordResetResponseContract {
  ok: true;
}

export interface FusebaseAuthLogoutResponseContract {
  ok: true;
  /**
   * App/BFF should clear these cookies on its own domain.
   */
  cookiesToDelete: string[];
}
