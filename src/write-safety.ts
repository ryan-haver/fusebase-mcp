/**
 * Deciding whether a failed write may be retried through a different API.
 *
 * Several operations have two routes (web API and Gate MCP, or two endpoints). Retrying a
 * write on the second route is only safe when the first attempt provably did not apply;
 * otherwise the write can happen twice (duplicate pages, SQL run twice, flow triggered
 * twice). Anything ambiguous — timeouts, 5xx, dropped connections mid-request — is not safe.
 */

/** Thrown by FusebaseClient.request() for non-2xx responses. */
export class FusebaseApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(message);
    this.name = "FusebaseApiError";
  }
}

/** Network errors raised before a request reaches the server. */
const CONNECT_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

/** 4xx statuses that do not guarantee the request was rejected without effect. */
const AMBIGUOUS_4XX = new Set([408, 409, 425, 429]);

function errorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } } | undefined;
  return e?.cause?.code || e?.code;
}

/**
 * True when `err` shows the request was not applied, so the same write may be sent through
 * another route. Upstream (Gate) business errors return false: the operation ran and was
 * rejected, and the caller should see that error rather than a retry elsewhere.
 */
export function isSafeToRetryElsewhere(err: unknown): boolean {
  if (err instanceof FusebaseApiError) {
    return err.status >= 400 && err.status < 500 && !AMBIGUOUS_4XX.has(err.status);
  }
  const code = errorCode(err);
  if (code && CONNECT_ERROR_CODES.has(code)) return true;

  const message = err instanceof Error ? err.message : String(err);
  // Gate bridge could not be reached or authenticated, so nothing was executed.
  const gateHttp = /^HTTP (\d{3}) from /.exec(message);
  if (gateHttp) {
    const status = Number(gateHttp[1]);
    return status >= 400 && status < 500 && !AMBIGUOUS_4XX.has(status);
  }
  return /Failed to obtain mcp-session-id|not configured with any tokens/i.test(message);
}

/**
 * WebSocket writer failures that happen before any update is sent (see yjs-ws-writer.ts).
 * "Timeout" is deliberately excluded: the update may already have been sent.
 */
export function wsWriteNeverSent(error: string | undefined): boolean {
  if (!error) return false;
  return (
    error.startsWith("JWT auth failed") ||
    error.startsWith("WebSocket upgrade failed") ||
    error.startsWith("Connection closed before sync") ||
    error === "Failed to apply server document state" ||
    /^WebSocket error: .*(ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH)/.test(error)
  );
}
