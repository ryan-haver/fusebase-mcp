export type globalIdInPathRequired = string;

export type PortalThemeKey =
  | "light_purple"
  | "soft_light"
  | "quite_green"
  | "space_gray"
  | "carbon"
  | "oxford"
  | "ultramarine"
  | "milky_blue"
  | "shades_of_green"
  | "savvy_red"
  | "light_orange"
  | "light_blue"
  | "lemon_drop";

export interface DuplicatePortalRequestContract {
  workspaceId: string;
  domain: string;
  name?: string;
}

export interface CreatePortalRequestContract {
  workspaceId: string;
  domain: string;
  name?: string;
  /** Color theme key for the portal. When provided, applied via updateThemeSettings changeEvent. */
  theme?: PortalThemeKey;
}

export interface CreatePortalResponseContract {
  portal: PortalDetailContract;
}

export interface PortalDetailContract {
  id: string;
  orgId: string;
  workspaceId: string;
  domain: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  lastPublishedAt?: number;
  version: number;
  cnameType?: string;
  cnameValue?: string;
  cnameStatus?: string;
}

export interface InviteToPortalRequestContract {
  email: string;
  fullName?: string;
  /**
   * Org role for the invitee (default: "client").
   * Supported: "client", "member", "manager".
   */
  orgRole?: "client" | "member" | "manager";
  /** Workspace role (default: "editor"). */
  workspaceRole?: "reader" | "editor";
  /**
   * Only relevant when orgRole="client".
   * true  = Full access (sees all pages including private) — default.
   * false = Shared only (public/shared pages only).
   * For orgRole "member" and "manager" this is always true and the field is ignored.
   */
  isFullAccess?: boolean;
}

export interface InviteToPortalResponseContract {
  /** Magic link for direct portal access (no email confirmation needed). */
  magicLink: string;
  /** Portal URL. */
  url: string;
  /** User ID in the system. */
  userId: number;
}

export type PortalMenuItemType =
  | "home"
  | "link"
  | "notesFolder"
  | "note"
  | "portalSection"
  | "portalProcess"
  | "portalPage"
  | "unknown"
  | "allPages"
  | "tasks"
  | "chat"
  | "folders"
  | "tags"
  | "portalFilesDashboard"
  | "filesManager"
  | "portalTasksDashboard"
  | "portalChatsDashboard";

export type PortalContentPositionType = "top" | "sidebar" | "footer";

export interface PortalContentItemContract {
  id: string;
  type: PortalMenuItemType;
  name: string;
  slug: string;
  positionType: PortalContentPositionType;
  index: number;
  visible: boolean;
  pageId?: string;
  /** Only for type === 'note': id of the Fusebase note (from targetId). */
  noteId?: string;
  children: PortalContentItemContract[];
}

export interface ListPortalContentResponseContract {
  items: PortalContentItemContract[];
}
