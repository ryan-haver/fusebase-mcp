/** Public diagnostics only. Never apply this to successful API data or created tokens. */
const SECRET_FIELD = /(["']?(?:authorization|proxy-authorization|cookie|set-cookie|x-secret|x-api-key|api[-_]?key|(?:access[-_]?|refresh[-_]?|id[-_]?)token|password|secret|client[-_]?secret|eversessionid|session[-_]?id|confirmEmail)["']?\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n,}\]]+)/gi;

/** Remove userinfo, queries and fragments from diagnostic URLs, including magic links. */
export function redactDiagnosticUrl(value: string): string {
  try {
    const url = new URL(value, "https://diagnostic.invalid");
    const suffix = url.search || url.hash ? "?[redacted]" : "";
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return url.pathname + suffix;
    return `${url.protocol}//${url.host}${url.pathname}${suffix}`;
  } catch { return "[invalid URL]"; }
}

function sanitize(text: string, limit: number, depth = 0): string {
  if (depth >= 4) return "[nested details omitted]";
  let out = text;
  const start = out.indexOf("{");
  if (start >= 0) {
    try {
      const obj: unknown = JSON.parse(out.slice(start));
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        const fields = obj as Record<string, unknown>;
        const keep = ["message", "name", "code", "status", "error"].filter((key) =>
          typeof fields[key] === "string" || typeof fields[key] === "number");
        out = out.slice(0, start) + (keep.length ? JSON.stringify(Object.fromEntries(keep.map((key) => {
          const value = fields[key];
          return [key, typeof value === "string" ? sanitize(value, limit, depth + 1) : value];
        }))) : "[upstream details omitted]");
      }
    } catch { /* Plain text or incomplete JSON: redact fields below. */ }
  }
  out = out.replace(/https?:\/\/[^\s<>"'\\]+/gi, redactDiagnosticUrl);
  out = out.replace(SECRET_FIELD, "$1\"[redacted]\"");
  // Bearer credentials can also appear without a field name.
  out = out.replace(/\bBearer\s+[A-Za-z0-9._~+/-]+={0,2}/gi, "Bearer [redacted]");
  return out.length > limit ? out.slice(0, limit) + "…" : out;
}

export function redactUpstreamDetail(text: string): string {
  return sanitize(text, 500);
}

export function publicErrorMessage(error: unknown): string {
  return sanitize(error instanceof Error ? error.message : String(error), 2000);
}
