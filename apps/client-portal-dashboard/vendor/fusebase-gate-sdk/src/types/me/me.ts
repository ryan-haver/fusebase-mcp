export interface MeScopeContract {
  scopeType: string;
  scopeId: string;
}

export interface MeOrgGroupContract {
  id: string;
  name: string;
}

export interface MeUserContract {
  id: number | null;
}

export interface MeAuthContract {
  type: string;
  source: string | null;
  orgRole?: string | null;
  orgGroups?: MeOrgGroupContract[];
  permissions: string[];
  scopes: MeScopeContract[];
}

export interface MeResponseContract {
  authenticated: true;
  user: MeUserContract;
  auth: MeAuthContract;
}
