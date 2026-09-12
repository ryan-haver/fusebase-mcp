/**
 * Deadline for every request this app makes. The backend scales to zero, so a
 * cold start can take ~10s; CloudFront aborts at 30s. Keep between 15000 and
 * 30000 — skill app-backend § Cold Starts (Scale-to-Zero).
 */
export const REQUEST_TIMEOUT_MS = 20000

function collectErrorObjects(error: unknown): Record<string, unknown>[] {
  if (!error || typeof error !== 'object') return []
  const err = error as Record<string, unknown>
  const nested = [err, err['data'], err['error'], err['body']]
  return nested.filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object')
}

/**
 * Detects AppTokenValidationError across different error shapes returned by the SDK.
 * Use this in every API call's catch block.
 */
export function isAppTokenValidationError(error: unknown): boolean {
  return collectErrorObjects(error).some((e) => e['name'] === 'AppTokenValidationError')
}

/**
 * Reads `reason` from an AppTokenValidationError payload (e.g. `missing_gate_service_token`, `expired`).
 */
export function extractAppTokenValidationReason(error: unknown): string | undefined {
  for (const e of collectErrorObjects(error)) {
    if (e['name'] !== 'AppTokenValidationError') continue
    const r = e['reason']
    return typeof r === 'string' && r.length > 0 ? r : undefined
  }
  return undefined
}

/**
 * Optional platform `hint` on AppTokenValidationError (e.g. from nx gate-service proxy).
 */
export function extractAppTokenValidationHint(error: unknown): string | undefined {
  for (const e of collectErrorObjects(error)) {
    if (e['name'] !== 'AppTokenValidationError') continue
    const h = e['hint']
    return typeof h === 'string' && h.length > 0 ? h : undefined
  }
  return undefined
}

/** Map a caught API error to the modal error type (reason + optional server hint). */
export function authErrorFromAppTokenFailure(error: unknown): AuthTokenExpiredError {
  return new AuthTokenExpiredError(extractAppTokenValidationReason(error), extractAppTokenValidationHint(error))
}

/** User-facing title + body for the auth modal; driven by platform `reason`, not only clock expiry. */
export function authUiForAppTokenReason(
  reason: string | undefined,
  serverHint?: string,
): { title: string; body: string } {
  if (reason === 'expired') {
    return {
      title: 'Session expired',
      body: 'Your app session expired. Refresh the page to get a new token.',
    }
  }
  if (reason === 'missing_gate_service_token') {
    const title = 'Gate access missing from app token'
    const base =
      'This is not a browser session timeout. The platform issued an app token without the Gate (gst) part, so every Gate API call is rejected. Refresh once; if it persists, the app likely declares Gate permissions that your org role cannot receive together — review fusebaseGateMeta.permissions and org role matrix, or contact support with the x-request-id from the failed response.'
    const body = serverHint ? `${serverHint}\n\n${base}` : base
    return { title, body }
  }
  if (reason) {
    return {
      title: 'Authentication error',
      body: `The platform rejected the app token (reason: ${reason}). Refresh the page, or contact support if it continues.`,
    }
  }
  return {
    title: 'Authentication error',
    body: 'The platform could not validate the app token. Refresh the page to try again.',
  }
}

/**
 * Thrown when Gate/dashboard returns AppTokenValidationError. Catch at the UI level to show AuthExpiredModal.
 * `appTokenReason` mirrors the server `reason` field when present.
 */
export class AuthTokenExpiredError extends Error {
  readonly appTokenReason: string | undefined
  readonly serverHint: string | undefined

  constructor(appTokenReason?: string, serverHint?: string) {
    const ui = authUiForAppTokenReason(appTokenReason, serverHint)
    super(ui.title)
    this.name = 'AuthTokenExpiredError'
    this.appTokenReason = appTokenReason
    this.serverHint = serverHint
  }
}

/** Read a cookie value by name. */
export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

/**
 * Read the app token. Checks the `fbsfeaturetoken` cookie first;
 * falls back to `window.FBS_FEATURE_TOKEN` if the cookie is absent.
 *
 * NOTE: cookie name and window global keep the legacy `feature` identifiers
 * because the dev-server proxy and platform runtime still emit those names.
 * Wire-protocol rename is tracked as a separate cleanup ticket.
 */
export function getFeatureToken(): string | null {
  return (window as Window & { FBS_FEATURE_TOKEN?: string }).FBS_FEATURE_TOKEN ?? getCookie('fbsfeaturetoken') ?? null
}
