export type OrgMembershipStatus = "ready" | "none" | "expired" | "disabled";

export type OrgAccessSource = "owner" | "member" | "none";

export interface AuthenticatedUserSummaryContract {
  id: number;
  email?: string | null;
  firstname?: string | null;
  lastname?: string | null;
}

export interface MyOrgAccessResponseContract {
  authenticated: true;
  orgId: string;
  hasOrgAccess: boolean;
  membershipStatus: OrgMembershipStatus;
  source: OrgAccessSource;
  role?: string | null;
  expiresAt?: number | null;
  memberTTL?: number | null;
  user: AuthenticatedUserSummaryContract;
}
