/**
 * Legacy `/link` magic-link route helper.
 *
 * Magic-link activation is handled server-side by the platform at
 * `/_auth/magiclink/{key}`: fusebase-gate activates the link, sets HttpOnly
 * session cookies, and redirects. The SPA no longer activates links or writes
 * session cookies via JS; it only forwards old `/link?id={key}` email URLs to
 * the platform endpoint. The `redirect` query param is ignored — the platform
 * reads the stored `redirectPath` from the link itself.
 */

export const MAGIC_LINK_ROUTE = '/link'
export const PLATFORM_MAGIC_LINK_PATH = '/_auth/magiclink/'

/** Map a legacy `/link?id={key}` query string to the platform activation path. Null when `id` is missing. */
export function buildLegacyMagicLinkRedirect(search: string): string | null {
  const id = new URLSearchParams(search).get('id')
  if (!id) return null
  return `${PLATFORM_MAGIC_LINK_PATH}${encodeURIComponent(id)}`
}
