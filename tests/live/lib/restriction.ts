export class ExpectedRestriction extends Error {}
export function requireAuthRejection(result: { success: boolean; error?: string }): boolean {
  if (result.success) return true;
  if (/JWT auth failed.*\b(401|403)\b|session cookie (?:is )?required|No authentication configured/i.test(result.error || "")) throw new ExpectedRestriction("Cookie authentication rejected");
  throw new Error(result.error || "Unclassified failure; not evidence of a permission restriction");
}
