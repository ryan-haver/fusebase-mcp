export interface AppApiOperationContract {
  id?: number;
  orgId: string;
  productId: string;
  appId: string;
  operationId: string;
  method: string;
  path: string;
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  visibility?: string | null;
  executionMode?: string | null;
  allowedCallers?: string[];
  requiredPermissions?: string[];
  tags: string[];
  manifestVersion?: string | null;
  publishedAt?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AppApiOperationListResponseContract {
  operations: AppApiOperationContract[];
}

export interface CallAppApiRequestContract {
  path?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
}

export interface CallAppApiResponseContract {
  ok: boolean;
  status: number;
  contentType?: string | null;
  data?: unknown;
  text?: string;
}

export interface VerifyAppApiContractsRequestContract {
  provider?: string;
  operation?: string;
}

export interface VerifyCaseResultContract {
  consumerAppId?: string;
  providerAppId: string;
  operationId: string;
  caseName: string;
  status: "PASS" | "FAIL";
  warnings: string[];
  message?: string;
  request?: {
    url?: string;
    envelope?: CallAppApiRequestContract;
  };
  response?: {
    status?: number;
    body?: unknown;
  };
}

export interface VerifyAppApiContractsResponseContract {
  ok: boolean;
  summary: {
    contractCount: number;
    caseCount: number;
    passCount: number;
    failCount: number;
    warnCount: number;
  };
  cases: VerifyCaseResultContract[];
}
