import type { ScopeTypeContract, ScopeTypeOrgContract } from "./enums";
export type AliasContract = (string & {
    __pattern: "^[a-z0-9._-]+$";
}) | null;
export type ApiErrorCodeContract = "INTERNAL_ERROR" | "COLUMN_VALUE_NOT_UNIQUE" | "DATA_LOSS_CHILD_TABLE_LINK";
export interface FilterConfigContract {
    required?: Record<string, unknown>;
    optional?: Record<string, unknown>;
}
export interface GetHealthResponseContract extends StandardApiResponseContract {
    data: {
        status: string;
    };
}
export interface GlobalIdsToReplaceMapContract {
    database?: Record<string, string>;
    dashboard?: Record<string, string>;
    view?: Record<string, string>;
    representation?: Record<string, string>;
    row?: Record<string, string>;
    section?: Record<string, string>;
    relation?: Record<string, string>;
    value?: Record<string, string>;
}
export interface PaginatedResponseContract {
    data: unknown[];
    meta: {
        total: number;
        page: number;
        limit: number;
        total_pages: number;
    };
}
export interface ScopeContract {
    scope_type: ScopeTypeContract;
    scope_id: string;
}
export interface ScopeOrgContract {
    scope_type: ScopeTypeOrgContract;
    scope_id: string;
}
export interface StandardApiResponseContract {
    success: boolean;
    message: string;
    error_code?: ApiErrorCodeContract;
    data?: object;
}
