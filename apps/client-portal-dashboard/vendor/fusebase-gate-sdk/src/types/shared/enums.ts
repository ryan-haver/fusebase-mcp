export type OrgRoleContract = "owner" | "manager" | "member" | "client" | "guest" | "visitor";
export type PermissionContract = string & {
    __pattern: "^[^.]+\\.(?:[^.]+\\.)?(read|write|delete|execute|create|manage)$";
};
export type RootEntityContract = "custom" | "portal" | "workspace" | "org" | "user" | "client" | "form" | "form-response" | "tracker" | "tracker-result" | "meeting";
export type ScopeTypeContract = "org" | "workspace" | "portal" | "user" | "client" | "block" | "tracker" | "parent_row" | "parent_table";
export type ScopeTypeOrgContract = "org";

export const OrgRoleContract = {
  Owner: "owner",
  Manager: "manager",
  Member: "member",
  Client: "client",
  Guest: "guest",
  Visitor: "visitor"
} as const;

export const RootEntityContract = {
  Custom: "custom",
  Portal: "portal",
  Workspace: "workspace",
  Org: "org",
  User: "user",
  Client: "client",
  Form: "form",
  FormResponse: "form-response",
  Tracker: "tracker",
  TrackerResult: "tracker-result",
  Meeting: "meeting"
} as const;

export const ScopeTypeContract = {
  Org: "org",
  Workspace: "workspace",
  Portal: "portal",
  User: "user",
  Client: "client",
  Block: "block",
  Tracker: "tracker",
  ParentRow: "parent_row",
  ParentTable: "parent_table"
} as const;

export const ScopeTypeOrgContract = {
  Org: "org"
} as const;

const PERMISSION_RE = /^[^.]+\.(?:[^.]+\.)?(read|write|delete|execute|create|manage)$/;
export function asPermission(value: string): PermissionContract {
  if (!PERMISSION_RE.test(value)) {
    throw new Error(`Invalid permission: ${value}`);
  }
  return value as PermissionContract;
}
