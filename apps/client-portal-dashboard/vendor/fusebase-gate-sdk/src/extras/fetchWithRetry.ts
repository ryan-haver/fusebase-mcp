/* eslint-disable no-console */
export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type BackoffValue =
  | number
  | ((
      attempt: number,
      response?: Response | undefined,
      error?: unknown,
    ) => number);

export interface RetryOptions {
  /**
   * Number of retry attempts after the initial request.
   * A value of 0 disables retries.
   * @default 3
   */
  retries?: number;
  /**
   * Static or dynamic backoff duration (ms) between retries.
   * When a function is provided, it receives the current attempt index (starting at 1),
   * the last failing response (if any), and the last thrown error (if any).
   * @default attempt => Math.min(1000 * 2 ** attempt, 30000)
   */
  backoffMs?: BackoffValue;
  /**
   * Predicate that determines whether a response should be retried.
   * Throwing inside this function will abort the retry loop.
   * @default status >= 500 && status < 600
   */
  shouldRetry?: (response: Response) => boolean;
  /**
   * Optional guard to abort retrying on specific errors (network, abort, etc.).
   * Return true to continue retrying, false to rethrow immediately.
   */
  shouldRetryError?: (error: unknown) => boolean;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const defaultShouldRetry = (response: Response): boolean =>
  response.status >= 500 && response.status < 600;

const defaultBackoff = (attempt: number): number =>
  Math.min(1000 * 2 ** attempt, 30_000);

const shouldRetryNetworkError = (error: unknown): boolean => {
  if (error == null) {
    return true;
  }
  if (typeof error !== "object") {
    return true;
  }
  if ((error as { name?: string }).name === "AbortError") {
    return false;
  }
  return true;
};

export function createFetchWithRetry(
  baseFetch: FetchLike,
  {
    retries = 3,
    backoffMs = defaultBackoff,
    shouldRetry = defaultShouldRetry,
    shouldRetryError = shouldRetryNetworkError,
  }: RetryOptions = {},
): FetchLike {
  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const originalRequest =
      input instanceof Request ? input : new Request(input, init);

    let lastError: unknown;
    let lastResponse: Response | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        const wait =
          typeof backoffMs === "function"
            ? backoffMs(attempt, lastResponse, lastError)
            : backoffMs;
        if (wait > 0) {
          const reason =
            lastError instanceof Error
              ? lastError.message
              : lastResponse != null
                ? `HTTP ${lastResponse.status} (retryable response)`
                : "unknown error";
          console.log(
            `Waiting ${wait}ms before next attempt #${attempt}, ${reason}`,
          );
          await sleep(wait);
        }
      }

      try {
        const response = await baseFetch(originalRequest.clone());

        if (!shouldRetry(response) || attempt === retries) {
          return response;
        }

        lastResponse = response;
      } catch (error) {
        lastError = error;

        if (!shouldRetryError(error) || attempt === retries) {
          throw error;
        }
      }
    }

    // Should never reach here, but TypeScript needs a final throw.
    throw lastError instanceof Error
      ? lastError
      : new Error(
          "createFetchWithRetry exhausted all retries without a terminal condition",
        );
  };
}
