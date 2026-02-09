#!/usr/bin/env npx tsx

/**
 * Fusebase API Endpoint Discovery
 *
 * Uses Playwright to crawl the Fusebase UI and intercept all API calls,
 * building a comprehensive reference of available endpoints.
 *
 * Usage:
 *   npx tsx scripts/discover.ts
 *   npx tsx scripts/discover.ts --host myorg.nimbusweb.me
 *   npx tsx scripts/discover.ts --headless
 */

import { chromium, type Request, type Response } from "playwright";
import * as fs from "fs";
import * as path from "path";

// ─── Types ──────────────────────────────────────────────────────

interface DiscoveredEndpoint {
  method: string;
  path: string;
  pathTemplate: string; // with IDs replaced by {param}
  queryParams: string[];
  requestBodyKeys: string[];
  responseKeys: string[];
  statusCode: number;
  count: number;
  firstSeen: string;
  sampleUrl: string;
}

interface DiscoveryResult {
  discoveredAt: string;
  host: string;
  totalRequests: number;
  uniqueEndpoints: number;
  endpoints: DiscoveredEndpoint[];
}

// ─── Config ─────────────────────────────────────────────────────

const IGNORED_EXTENSIONS = [
  ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg",
  ".woff", ".woff2", ".ttf", ".ico", ".map", ".webp",
];

const IGNORED_PATHS = [
  "/analytics", "/collect", "/track", "/_next/", "/static/",
  "/favicon", "google", "facebook", "hotjar", "sentry",
  "datadog", "segment", "amplitude", "mixpanel",
];

// ─── Core ───────────────────────────────────────────────────────

async function discover(host: string, headless: boolean) {
  const baseUrl = `https://${host}`;
  const endpoints = new Map<string, DiscoveredEndpoint>();
  let totalRequests = 0;

  const userDataDir = path.resolve(
    import.meta.dirname ?? ".",
    "..",
    ".browser-data",
  );

  console.error(`[discover] Launching browser (headless=${headless})...`);
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    args: ["--disable-blink-features=AutomationControlled"],
    viewport: { width: 1280, height: 900 },
  });

  // ─── Request Interceptor ────────────────────────────────────

  const interceptRequest = (request: Request) => {
    const url = new URL(request.url());
    if (url.hostname !== host) return;
    if (IGNORED_EXTENSIONS.some((ext) => url.pathname.endsWith(ext))) return;
    if (IGNORED_PATHS.some((p) => url.pathname.includes(p) || url.hostname.includes(p))) return;

    totalRequests++;
  };

  const interceptResponse = async (response: Response) => {
    const request = response.request();
    let url: URL;
    try {
      url = new URL(request.url());
    } catch {
      return;
    }
    if (url.hostname !== host) return;
    if (IGNORED_EXTENSIONS.some((ext) => url.pathname.endsWith(ext))) return;
    if (IGNORED_PATHS.some((p) => url.pathname.includes(p) || url.hostname.includes(p))) return;

    const method = request.method();
    const pathTemplate = templatizePath(url.pathname);
    const key = `${method} ${pathTemplate}`;

    // Parse request body
    let requestBodyKeys: string[] = [];
    try {
      const postData = request.postData();
      if (postData) {
        const parsed = JSON.parse(postData);
        requestBodyKeys = extractKeys(parsed);
      }
    } catch { /* not JSON */ }

    // Parse response body
    let responseKeys: string[] = [];
    try {
      const contentType = response.headers()["content-type"] || "";
      if (contentType.includes("application/json")) {
        const body = await response.json();
        responseKeys = extractKeys(body);
      }
    } catch { /* not JSON or failed */ }

    const queryParams = [...url.searchParams.keys()];

    if (endpoints.has(key)) {
      const existing = endpoints.get(key)!;
      existing.count++;
      // Merge keys we haven't seen before
      if (requestBodyKeys.length > existing.requestBodyKeys.length) {
        existing.requestBodyKeys = requestBodyKeys;
      }
      if (responseKeys.length > existing.responseKeys.length) {
        existing.responseKeys = responseKeys;
      }
    } else {
      endpoints.set(key, {
        method,
        path: url.pathname,
        pathTemplate,
        queryParams,
        requestBodyKeys,
        responseKeys,
        statusCode: response.status(),
        count: 1,
        firstSeen: new Date().toISOString(),
        sampleUrl: request.url().substring(0, 200),
      });
    }
  };

  // Bind interceptors to all pages
  context.on("page", (page) => {
    page.on("request", interceptRequest);
    page.on("response", interceptResponse);
  });

  const page = context.pages()[0] || (await context.newPage());
  page.on("request", interceptRequest);
  page.on("response", interceptResponse);

  try {
    // Navigate to base
    console.error(`[discover] Navigating to ${baseUrl}...`);
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // Check if we need to log in
    if (page.url().includes("/auth")) {
      console.error("[discover] Not logged in. Run 'npx tsx scripts/auth.ts' first.");
      return;
    }

    // ─── Crawl Strategy ─────────────────────────────────────

    // Extract workspace IDs (API → URL → cache fallback)
    const workspaceIds = await extractWorkspaceIds(page, host);
    console.error(`[discover] Found ${workspaceIds.length} workspace(s): ${workspaceIds.join(", ")}`);

    // Determine orgId early for org-level routes
    const orgId = process.env.FUSEBASE_ORG_ID || await extractOrgId(page, host) || "";

    for (const wsId of workspaceIds) {
      console.error(`\n[discover] === Crawling workspace: ${wsId} ===`);

      // ── Core views ──
      await navigateAndWait(page, `${baseUrl}/space/${wsId}/all`);
      await navigateAndWait(page, `${baseUrl}/space/${wsId}/folder/root`);
      await navigateAndWait(page, `${baseUrl}/space/${wsId}/tasks`);
      await navigateAndWait(page, `${baseUrl}/space/${wsId}/files`);
      await navigateAndWait(page, `${baseUrl}/space/${wsId}/agents`);
      await navigateAndWait(page, `${baseUrl}/space/${wsId}/recent`);

      // ── Databases / tables ──
      await navigateAndWait(page, `${baseUrl}/space/${wsId}/databases`);

      // ── Workspace settings (members, labels, tags) ──
      await navigateAndWait(page, `${baseUrl}/space/${wsId}/settings`);
      await navigateAndWait(page, `${baseUrl}/space/${wsId}/settings/members`);
      await navigateAndWait(page, `${baseUrl}/space/${wsId}/settings/labels`);

      // ── Individual pages (open first few, scroll to trigger lazy loads) ──
      try {
        const pagesRes = await page.evaluate(
          async (args: { baseUrl: string; wsId: string }) => {
            const filter = encodeURIComponent(JSON.stringify({ type: "note", is_portal_share: false }));
            const range = encodeURIComponent(JSON.stringify({ offset: 0, limit: 10 }));
            const res = await fetch(
              `${args.baseUrl}/v2/api/workspaces/${args.wsId}/notes?filter=${filter}&range=${range}&rootId=root&order=${encodeURIComponent('["createdAt","ASC"]')}`,
            );
            return res.json();
          },
          { baseUrl, wsId },
        );

        if (pagesRes?.items) {
          for (const p of pagesRes.items.slice(0, 5)) {
            await navigateAndWait(
              page,
              `${baseUrl}/space/${wsId}/page/${p.globalId}`,
            );
            // Scroll down to trigger any lazy-loaded content
            await page.evaluate(() => window.scrollBy(0, 1000)).catch(() => {});
            await page.waitForTimeout(1000);
          }
        }
      } catch (e) {
        console.error(`[discover] Failed to enumerate pages: ${e}`);
      }

      // ── Task boards / lists (try to open task list views) ──
      try {
        const taskListsRes = await page.evaluate(
          async (args: { baseUrl: string; wsId: string }) => {
            const res = await fetch(
              `${args.baseUrl}/gwapi2/ft%3Atasks/workspaces/${args.wsId}/taskLists`,
            );
            return res.json();
          },
          { baseUrl, wsId },
        );
        if (Array.isArray(taskListsRes)) {
          for (const tl of taskListsRes.slice(0, 3)) {
            if (tl.globalId) {
              await navigateAndWait(
                page,
                `${baseUrl}/space/${wsId}/tasks/${tl.globalId}`,
              );
            }
          }
        }
      } catch (e) {
        console.error(`[discover] Failed to enumerate task lists: ${e}`);
      }

      // ── Comments (trigger comment thread loading on first page) ──
      try {
        const firstPageRes = await page.evaluate(
          async (args: { baseUrl: string; wsId: string }) => {
            const filter = encodeURIComponent(JSON.stringify({ type: "note", is_portal_share: false }));
            const range = encodeURIComponent(JSON.stringify({ offset: 0, limit: 1 }));
            const res = await fetch(
              `${args.baseUrl}/v2/api/workspaces/${args.wsId}/notes?filter=${filter}&range=${range}&rootId=root&order=${encodeURIComponent('["createdAt","ASC"]')}`,
            );
            return res.json();
          },
          { baseUrl, wsId },
        );
        if (firstPageRes?.items?.[0]) {
          const noteId = firstPageRes.items[0].globalId;
          // Trigger comment threads API
          await page.evaluate(
            async (args: { baseUrl: string; wsId: string; noteId: string }) => {
              await fetch(
                `${args.baseUrl}/gwapi2/svc:comment/workspaces/${args.wsId}/notes/${args.noteId}/threadsInfo`,
              );
            },
            { baseUrl, wsId, noteId },
          );
        }
      } catch { /* comments may not exist */ }

      // ── Mention entities ──
      try {
        await page.evaluate(
          async (args: { baseUrl: string; wsId: string }) => {
            await fetch(`${args.baseUrl}/v2/api/web-editor/mention-entities/${args.wsId}`);
          },
          { baseUrl, wsId },
        );
      } catch { /* optional */ }
    }

    // ── Org-level views ──
    console.error(`\n[discover] === Crawling org views (${orgId}) ===`);
    await navigateAndWait(page, `${baseUrl}/dashboard/${orgId}/space`);
    await navigateAndWait(page, `${baseUrl}/dashboard/${orgId}/tables/entity/spaces`);
    await navigateAndWait(page, `${baseUrl}/dashboard/${orgId}/tables/databases`);
    await navigateAndWait(page, `${baseUrl}/dashboard/${orgId}/members`);
    await navigateAndWait(page, `${baseUrl}/dashboard/${orgId}/settings`);

    // ── AI Agents org endpoint ──
    try {
      await page.evaluate(
        async (args: { baseUrl: string; orgId: string }) => {
          await fetch(
            `${args.baseUrl}/v4/api/proxy/ai-service/v1/orgs/${args.orgId}/agent-categories/agents?globalId=all`,
          );
        },
        { baseUrl, orgId },
      );
    } catch { /* optional */ }

    // ── Automation ──
    await navigateAndWait(page, `${baseUrl}/space/automation`);

  } finally {
    // Save results
    const result: DiscoveryResult = {
      discoveredAt: new Date().toISOString(),
      host,
      totalRequests,
      uniqueEndpoints: endpoints.size,
      endpoints: [...endpoints.values()].sort((a, b) =>
        a.pathTemplate.localeCompare(b.pathTemplate),
      ),
    };

    const dataDir = path.resolve(import.meta.dirname ?? ".", "..", "data");
    fs.mkdirSync(dataDir, { recursive: true });
    const outPath = path.join(dataDir, "api_discovery.json");
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.error(`\n[discover] Done! ${result.uniqueEndpoints} unique endpoints found from ${totalRequests} requests`);
    console.error(`[discover] Saved to ${outPath}`);

    // Also save a human-readable summary
    let summary = `# Fusebase API Discovery — ${result.discoveredAt}\n\n`;
    summary += `Total requests: ${totalRequests}\nUnique endpoints: ${result.uniqueEndpoints}\n\n`;
    for (const ep of result.endpoints) {
      summary += `## ${ep.method} ${ep.pathTemplate}\n`;
      summary += `Status: ${ep.statusCode} | Hits: ${ep.count}\n`;
      if (ep.queryParams.length) summary += `Query: ${ep.queryParams.join(", ")}\n`;
      if (ep.requestBodyKeys.length) summary += `Request body: ${ep.requestBodyKeys.join(", ")}\n`;
      if (ep.responseKeys.length) summary += `Response: ${ep.responseKeys.join(", ")}\n`;
      summary += `Sample: ${ep.sampleUrl}\n\n`;
    }
    fs.writeFileSync(path.join(dataDir, "api_discovery.md"), summary);

    await context.close();
  }
}

// ─── Helpers ────────────────────────────────────────────────────

async function navigateAndWait(page: import("playwright").Page, url: string) {
  try {
    console.error(`[discover] → ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(2000);
  } catch (e) {
    console.error(`[discover]   (timeout/error, continuing)`);
  }
}

async function extractWorkspaceIds(
  page: import("playwright").Page,
  host: string,
): Promise<string[]> {
  // Strategy 1: workspace-infos API
  try {
    const infos = await page.evaluate(async (h: string) => {
      const res = await fetch(`https://${h}/gwapi2/ft%3Atasks/workspace-infos`);
      if (res.ok) return res.json();
      return [];
    }, host);
    if (Array.isArray(infos) && infos.length > 0) {
      return infos.map((i: { workspaceId: string }) => i.workspaceId);
    }
  } catch { /* fallback below */ }

  // Strategy 2: identity/spaces API
  try {
    const spaces = await page.evaluate(async (h: string) => {
      const res = await fetch(`https://${h}/v2/api/identity/spaces`);
      if (res.ok) return res.json();
      return [];
    }, host);
    if (Array.isArray(spaces) && spaces.length > 0) {
      return spaces.map((s: { workspaceId?: string; id?: string }) => s.workspaceId || s.id || "").filter(Boolean);
    }
  } catch { /* fallback below */ }

  // Strategy 3: URL match
  const match = page.url().match(/space\/([a-z0-9]+)/);
  if (match) return [match[1]];

  // Strategy 4: workspace_cache.json fallback
  try {
    const cachePath = path.resolve(import.meta.dirname ?? ".", "..", "data", "workspace_cache.json");
    if (fs.existsSync(cachePath)) {
      const cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      if (cache.workspaces) {
        const ids = Object.keys(cache.workspaces);
        if (ids.length > 0) {
          console.error(`[discover] Using cached workspace IDs: ${ids.join(", ")}`);
          return ids;
        }
      }
    }
  } catch { /* no cache */ }

  return [];
}

async function extractOrgId(
  page: import("playwright").Page,
  _host: string,
): Promise<string | null> {
  const match = page.url().match(/dashboard\/([a-z0-9]+)/);
  if (match) return match[1];
  // Try to find in page content
  try {
    const orgId = await page.evaluate(() => {
      const el = document.querySelector('[data-org-id]');
      return el?.getAttribute('data-org-id') ?? null;
    });
    return orgId;
  } catch {
    return null;
  }
}

/** Replace IDs in paths with {param} placeholders */
function templatizePath(pathname: string): string {
  return decodeURIComponent(pathname)
    .replace(/\/[a-zA-Z0-9]{16}(?=\/|$)/g, "/{id}")      // 16-char IDs
    .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, "/{uuid}") // UUIDs
    .replace(/\/[a-z0-9]{12,20}(?=\/|$)/g, "/{id}")       // Variable-length alphanumeric IDs
    .replace(/\/\d{5,}(?=\/|$)/g, "/{numId}");             // Numeric IDs
}

/** Extract top-level keys from a JSON value */
function extractKeys(obj: unknown): string[] {
  if (Array.isArray(obj)) {
    return obj.length > 0 ? extractKeys(obj[0]) : [];
  }
  if (obj && typeof obj === "object") {
    return Object.keys(obj);
  }
  return [];
}

// ─── CLI ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const headless = args.includes("--headless");
const hostIdx = args.indexOf("--host");
const host =
  hostIdx !== -1 && args[hostIdx + 1]
    ? args[hostIdx + 1]
    : process.env.FUSEBASE_HOST || "";

discover(host, headless).catch((e) => {
  console.error("[discover] Fatal:", e);
  process.exit(1);
});
