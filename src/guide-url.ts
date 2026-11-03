/** Map official nested and flat help-center URLs to safe cache paths. */
export function parseGuideUrl(value: string): { section: string; slug: string; url: string } | null {
  let url: URL;
  try { url = new URL(value, "https://thefusebase.com"); } catch { return null; }
  if (url.origin !== "https://thefusebase.com") return null;
  const match = /^\/guides\/([a-z0-9][a-z0-9%-]*)(?:\/([a-z0-9][a-z0-9%-]*))?\/?$/i.exec(url.pathname);
  if (!match) return null;
  return {
    section: match[2] ? match[1] : "general",
    slug: match[2] || match[1],
    url: `https://thefusebase.com${url.pathname.replace(/\/$/, "")}/`,
  };
}
