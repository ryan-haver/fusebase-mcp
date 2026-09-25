/**
 * Safe construction of API request paths from untrusted identifiers.
 *
 * IDs passed to the client come from model-supplied tool arguments. Interpolating
 * them verbatim lets a value such as `x/../../orgs/abc` collapse under URL
 * normalisation and redirect an authenticated request (including DELETEs) to a
 * different endpoint on the same host (SEC-5).
 */

/**
 * Tagged template for API paths: every interpolated value is converted with
 * `String()` and passed through `encodeURIComponent`, so it can only ever occupy
 * a single path segment (`/`, `?`, `#`, `%` and `..`-traversal are neutralised).
 * Literal parts of the template are left untouched.
 *
 * Throws if an interpolated value is `undefined`, `null` or an empty string,
 * because an empty segment would silently address a different endpoint.
 *
 * Do not interpolate pre-built query strings or already-encoded values — append
 * those after the call instead, e.g. `apiPath\`/x/${id}/rows\` + "?" + qs`.
 *
 * @example apiPath`/v2/api/workspaces/${ws}/notes/${id}`
 */
export function apiPath(strings: TemplateStringsArray, ...values: unknown[]): string {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value === undefined || value === null || value === "") {
      throw new Error(
        `apiPath: path parameter #${i + 1} is ${value === "" ? "an empty string" : String(value)} ` +
          `(after "${strings.slice(0, i + 1).join("…")}")`,
      );
    }
    out += encodeURIComponent(String(value)) + strings[i + 1];
  }
  return out;
}
