export type OrgRoleContract = "owner" | "manager" | "member" | "client" | "guest" | "visitor";
export type PermissionContract = string & {
    __pattern: "^[^.]+\\.(?:[^.]+\\.)?(read|write|delete|execute|create|manage)$";
};
export type RootEntityContract = "custom" | "portal" | "workspace" | "org" | "user" | "client" | "form" | "form-response" | "tracker" | "tracker-result" | "meeting";
export type ScopeTypeContract = "org" | "workspace" | "portal" | "user" | "client" | "block" | "tracker" | "parent_row" | "parent_table";
export type ScopeTypeOrgContract = "org";
