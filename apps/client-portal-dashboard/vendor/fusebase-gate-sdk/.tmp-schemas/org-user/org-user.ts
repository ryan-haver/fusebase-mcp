export interface OrgUserContract {
  id: number;
  firstname?: string | null;
  lastname?: string | null;
  email?: string | null;
  username?: string | null;
  role: string;
}

export interface OrgUserListResponseContract {
  users: OrgUserContract[];
}

export interface OrgUserAddRequestContract {
  /**
   * Email to invite/create access for.
   */
  email: string;
  /**
   * Root role in org-service (e.g. owner/manager/member/guest/client).
   * Used for org-only invites, or as the org role when a workspace invite
   * needs to create org membership first.
   */
  orgRole?: string | null;
  /**
   * Workspace target. Supports a literal workspace global id or the alias
   * `default`, which gate resolves to the default workspace of `orgId`.
   * When set, `workspaceRole` becomes required and the invite flows through
   * org-service `POST /workspaces/:workspaceId/members`.
   */
  workspaceId?: string | null;
  /**
   * Workspace role for workspace-aware invites (e.g. admin/editor/reader).
   */
  workspaceRole?: string | null;
  /**
   * Optional workspace encryption role.
   */
  encryptRole?: string | null;
  fullName?: string;
  memberTTL?: number | null;
  /**
   * Optional portal domain/host. When combined with `workspaceId`,
   * org-service creates a portal magic link instead of a regular invite.
   * Without `workspaceId`, this remains an org invite email hint only.
   */
  portalUrl?: string;
  /**
   * Org-only shortcut for instant client onboarding without invite
   * confirmation. Valid only when `orgRole` is `client` and `workspaceId`
   * is omitted.
   */
  autoConfirmClientInvite?: boolean;
}

export interface OrgInviteContract {
  id: number;
  orgId?: string;
  role: string;
  email: string;
  used: boolean;
  url?: string;
}

export interface OrgWorkspaceContract {
  id: string;
  orgId?: string;
  title?: string | null;
  isDefault: boolean;
  color?: string | null;
  role?: string | null;
}

export interface OrgWorkspaceListResponseContract {
  workspaces: OrgWorkspaceContract[];
}

export interface CreateWorkspaceRequestContract {
  /** Display name for the new workspace. Required. */
  title: string;
}

export interface OrgPortalContract {
  id: string;
  orgId: string;
  workspaceId: string;
  domain: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  lastPublishedAt?: number;
  version: number;
}

export interface OrgPortalListResponseContract {
  portals: OrgPortalContract[];
}

export interface OrgWorkspaceInviteContract {
  workspaceId: string;
  role: string;
  encryptRole?: string | null;
  addedByUserId: number;
  email: string;
  createdAt: number;
  updatedAt: number;
  used: boolean;
  usedByUserId?: number | null;
}

export interface OrgWorkspaceMemberContract {
  id: string;
  workspaceId: string;
  userId: number;
  role: string;
  encryptRole?: string | null;
  addedByUserId: number;
  createdAt: number;
  updatedAt: number;
  type?: string | null;
  privileges?: string[] | null;
  magicLink?: string | null;
}

export interface OrgMagicLinkContract {
  id: string;
  type: string;
  userId: number;
  orgId: string;
  workspaceId: string;
  url: string;
  magicLink: string;
  createdAt?: number;
  updatedAt?: number;
  expiresAt?: number;
}

export interface OrgUserAddResponseContract {
  /**
   * Target flow used by the endpoint.
   */
  target: "org" | "workspace" | "portal";
  /**
   * org-service returns `invite` or `member` for org invites, and
   * `invite`, `member`, or `link` for workspace-aware invites.
   * `invite` means an invite exists; it is not proof that org access is
   * already active for the current session.
   */
  result: "invite" | "member" | "link";
  orgInvite?: OrgInviteContract;
  orgMember?: OrgUserContract;
  workspaceInvite?: OrgWorkspaceInviteContract;
  workspaceMember?: OrgWorkspaceMemberContract;
  magicLink?: OrgMagicLinkContract;
}
