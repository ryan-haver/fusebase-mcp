import type { ScopeContract } from "../shared/common";
import type { PermissionContract } from "../shared/enums";
export interface CreateTokenRequestContract {
    scopes: ScopeContract[];
    permissions: PermissionContract[];
    resource_scope: ResourceScopeContract;
    name?: string | null;
    expires_at?: Date | null;
    meta?: TokenMetaContract;
}
export interface CreateTokenResponseContract {
    success: boolean;
    message?: string | null;
    data: {
        token: string;
        global_id: string;
        name?: string | null;
        permissions: string[];
        expires_at?: Date | null;
        meta?: TokenMetaContract;
        created_at: Date;
    };
}
export interface ResourceScopeContract {
    allow?: ResourceScopeRuleContract[];
    deny?: ResourceScopeRuleContract[];
}
export interface ResourceScopeRuleContract {
    resource_type: string;
    ids: string[];
}
export interface TokenMetaIssuerContract {
    kind: string;
    id: string;
}
export interface TokenMetaContract {
    issuer?: TokenMetaIssuerContract;
}
export interface RevokeTokenResponseContract {
    success: boolean;
    message: string;
}
export interface TokenContract {
    global_id: string;
    name?: string | null;
    permissions: PermissionContract[];
    scopes?: ScopeContract[];
    meta?: TokenMetaContract;
    expires_at?: Date | null;
    last_used_at?: Date | null;
    created_at: Date;
}
export interface TokenListResponseContract {
    success: boolean;
    message?: string | null;
    data: TokenContract[];
}
export interface TokenResponseContract {
    success: boolean;
    message?: string | null;
    data: TokenContract;
}
export interface UpdateTokenRequestContract {
    name?: string | null;
    permissions?: PermissionContract[];
    expires_at?: Date | null;
    meta?: TokenMetaContract;
}
