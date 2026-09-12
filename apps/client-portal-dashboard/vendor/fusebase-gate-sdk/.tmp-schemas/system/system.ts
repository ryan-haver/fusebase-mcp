import type { PermissionContract } from "../shared/enums";
export interface ResolveOperationPermissionsRequestContract {
    operations: string[];
}
export interface ListPermissionCatalogResultContract {
    permissions: PermissionContract[];
}
export interface ListPermissionCatalogResponseContract {
    success: boolean;
    message?: string | null;
    data: ListPermissionCatalogResultContract;
}
export type OperationPermissionMatchTypeContract = "operation_id" | "mcp_tool_name";
export interface ResolvedOperationPermissionContract {
    requested: string;
    found: boolean;
    operation_id?: string | null;
    required_permission?: PermissionContract | null;
    match_type?: OperationPermissionMatchTypeContract | null;
}
export interface ResolveOperationPermissionsResultContract {
    permissions: PermissionContract[];
    operations: ResolvedOperationPermissionContract[];
    missing: string[];
}
export interface ResolveOperationPermissionsResponseContract {
    success: boolean;
    message?: string | null;
    data: ResolveOperationPermissionsResultContract;
}
