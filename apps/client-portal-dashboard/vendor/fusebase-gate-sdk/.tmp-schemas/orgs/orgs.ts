export type OrgUrlKindContract = "cname" | "subdomain";

export interface OrgUrlResponseContract {
  orgId: string;
  /** Canonical HTTPS base URL for the organization (no trailing path). */
  url: string;
  /** Hostname used in `url` (custom CNAME domain or `{sub}.{fusebaseHost}`). */
  host: string;
  /** `cname` when the org uses a custom domain; otherwise `subdomain`. */
  kind: OrgUrlKindContract;
  /** Organization subdomain slug from org-service. */
  sub: string;
  /** Custom CNAME domain when configured; null for subdomain-only orgs. */
  customDomain: string | null;
  /** Org branding flag from org-service; does not change hostname resolution. */
  domainShorter: boolean;
}
