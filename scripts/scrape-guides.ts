/**
 * FuseBase Guide Scraper
 *
 * Scrapes all FuseBase guide pages, converts to markdown, and stores
 * in an organized folder structure. Subsequent runs detect changes
 * via SHA-256 hashing and only update modified content.
 *
 * Usage: npx tsx scripts/scrape-guides.ts [--force] [--sync-nlm <notebook-id>]
 *   --force              Re-scrape all pages regardless of hash
 *   --sync-nlm <id>      Add guide URLs as sources to the specified NotebookLM notebook
 */

import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(PROJECT_ROOT, 'docs', 'guides');
const META_FILE = join(OUTPUT_DIR, '.scrape-meta.json');
const INDEX_FILE = join(OUTPUT_DIR, 'index.md');

const FORCE = process.argv.includes('--force');
const SYNC_NLM_IDX = process.argv.indexOf('--sync-nlm');
const SYNC_NLM_NOTEBOOK = SYNC_NLM_IDX !== -1 ? process.argv[SYNC_NLM_IDX + 1] : null;
const DEFAULT_NLM_NOTEBOOK = '6d691591-cbca-4ca7-a31f-5b95b9a7884b'; // FuseBase Guides notebook
const CONCURRENCY = 5;
const DELAY_MS = 300; // polite delay between batches
const MAX_RETRIES = 3;
const NLM_RATE_LIMIT_MS = 2000; // 2s between NLM source adds

/** Category pages to discover guide links from */
const CATEGORY_URLS = [
    'https://thefusebase.com/guides/getting-started/',
    'https://thefusebase.com/guides/basics/',
    'https://thefusebase.com/guides/client-portal/',
    'https://thefusebase.com/guides/organization/',
    'https://thefusebase.com/guides/fusebase-ai/',
    'https://thefusebase.com/guides/branding/',
    'https://thefusebase.com/guides/settings/',
    'https://thefusebase.com/guides/embedding-sharing/',
    'https://thefusebase.com/guides/screenshot/',
    'https://thefusebase.com/guides/table-database/',
    'https://thefusebase.com/guides/dashboard-crm/',
    'https://thefusebase.com/guides/page-editor/',
    'https://thefusebase.com/guides/automations-and-integrations/',
    'https://thefusebase.com/guides/web-clipper/',
    'https://thefusebase.com/guides/android-ios/',
    'https://thefusebase.com/guides/import-fusebase/',
    'https://thefusebase.com/guides/personal-use/',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GuideMeta {
    hash: string;
    lastUpdated: string;
    filePath: string;
    title: string;
    section: string;
}

interface ScrapeMeta {
    lastRun: string;
    guides: Record<string, GuideMeta>;
    nlmSyncedUrls?: string[];   // URLs already added to NLM
    nlmNotebookId?: string;     // Persisted notebook ID for auto-sync
}

interface GuideLink {
    url: string;
    section: string;
    slug: string;
}

// ---------------------------------------------------------------------------
// Turndown setup
// ---------------------------------------------------------------------------

function createTurndown(): TurndownService {
    const td = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
        emDelimiter: '*',
        strongDelimiter: '**',
    });

    // Keep iframes as HTML (embedded content)
    td.addRule('iframe', {
        filter: 'iframe',
        replacement(_content, node) {
            const el = node as unknown as HTMLIFrameElement;
            const src = el.getAttribute('src') || '';
            return src ? `\n\n[Embedded content](${src})\n\n` : '';
        },
    });

    // Convert figure/figcaption
    td.addRule('figure', {
        filter: 'figure',
        replacement(content) {
            return `\n\n${content.trim()}\n\n`;
        },
    });

    // Better image handling — preserve alt text and src
    td.addRule('img', {
        filter: 'img',
        replacement(_content, node) {
            const el = node as unknown as HTMLImageElement;
            const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
            const alt = el.getAttribute('alt') || '';
            if (!src) return '';
            return `![${alt}](${src})`;
        },
    });

    return td;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

async function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<string> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const resp = await fetch(url, {
                headers: {
                    'User-Agent': 'FuseBase-Guide-Scraper/1.0',
                    'Accept': 'text/html',
                },
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
            return await resp.text();
        } catch (err) {
            if (attempt === retries) throw err;
            const delay = 1000 * Math.pow(2, attempt - 1);
            console.warn(`  ⚠ Attempt ${attempt}/${retries} failed for ${url}, retrying in ${delay}ms...`);
            await sleep(delay);
        }
    }
    throw new Error('unreachable');
}

async function loadMeta(): Promise<ScrapeMeta> {
    if (existsSync(META_FILE)) {
        const raw = await readFile(META_FILE, 'utf-8');
        return JSON.parse(raw);
    }
    return { lastRun: '', guides: {} };
}

async function saveMeta(meta: ScrapeMeta): Promise<void> {
    await writeFile(META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
}

/** Parse a guide URL into section + slug */
function parseGuideUrl(url: string): { section: string; slug: string } | null {
    const m = url.match(/\/guides\/([^/]+)\/([^/]+)\/?$/);
    if (!m) return null;
    return { section: m[1], slug: m[2] };
}

/** Run promises in batches of `n` with optional delay between batches */
async function batchRun<T, R>(
    items: T[],
    n: number,
    delayMs: number,
    fn: (item: T) => Promise<R>,
): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += n) {
        const batch = items.slice(i, i + n);
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);
        if (i + n < items.length) await sleep(delayMs);
    }
    return results;
}

// ---------------------------------------------------------------------------
// Phase 1: Link Discovery
// ---------------------------------------------------------------------------

async function discoverLinks(): Promise<GuideLink[]> {
    console.log('\n📡 Phase 1: Discovering guide links...\n');
    const allLinks = new Map<string, GuideLink>();

    for (const catUrl of CATEGORY_URLS) {
        try {
            const html = await fetchWithRetry(catUrl);
            const $ = cheerio.load(html);

            // Extract all guide links — they follow pattern /guides/section/slug/
            $('a[href*="/guides/"]').each((_i, el) => {
                const href = $(el).attr('href');
                if (!href) return;

                // Normalize URL
                let fullUrl = href;
                if (href.startsWith('/')) {
                    fullUrl = `https://thefusebase.com${href}`;
                }

                const parsed = parseGuideUrl(fullUrl);
                if (!parsed) return;

                // Skip category-level pages (they're not individual guides)
                if (CATEGORY_URLS.some((cu) => fullUrl === cu || fullUrl === cu.replace(/\/$/, ''))) return;
                // Also skip if it exactly matches one of the known section roots
                const sectionRoots = CATEGORY_URLS.map(u => {
                    const m = u.match(/\/guides\/([^/]+)\/?$/);
                    return m ? m[1] : '';
                }).filter(Boolean);
                if (sectionRoots.includes(parsed.slug)) return;

                if (!allLinks.has(fullUrl)) {
                    allLinks.set(fullUrl, {
                        url: fullUrl,
                        section: parsed.section,
                        slug: parsed.slug,
                    });
                }
            });

            console.log(`  ✓ ${catUrl.split('/guides/')[1]?.replace(/\/$/, '') || catUrl} — ${allLinks.size} total links so far`);
        } catch (err) {
            console.error(`  ✗ Failed to fetch ${catUrl}: ${err}`);
        }
        await sleep(200);
    }

    const links = Array.from(allLinks.values());
    console.log(`\n  Found ${links.length} unique guide URLs\n`);
    return links;
}

// ---------------------------------------------------------------------------
// Phase 2: Content Extraction
// ---------------------------------------------------------------------------

function extractContent($: cheerio.CheerioAPI): { title: string; html: string } {
    // BetterDocs-based FuseBase guide pages
    const title =
        $('.betterdocs-entry-header h1').first().text().trim() ||
        $('h1').first().text().trim() ||
        $('title').text().replace(/ [-–|] FuseBase.*$/i, '').trim() ||
        'Untitled';

    // Primary: BetterDocs content container
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contentEl: any = $('.betterdocs-content');

    if (contentEl.length === 0) {
        // Fallback: try other common selectors
        for (const sel of ['.entry-content', '.post-content', 'article', 'main']) {
            const el = $(sel);
            if (el.length > 0) { contentEl = el; break; }
        }
    }

    if (contentEl.length === 0) {
        const body = $('body').clone();
        body.find('nav, header, footer, .sidebar, .betterdocs-sidebar, script, style, noscript').remove();
        return { title, html: body.html() || '' };
    }

    // Remove non-content elements
    contentEl.find([
        '.betterdocs-toc',           // inline table of contents
        '.betterdocs-entry-footer',  // "was this helpful?" feedback
        '.docs-navigation',          // prev/next links
        '.betterdocs-breadcrumb',    // breadcrumb trail
        '.reading-time',             // "X min read"
        '.betterdocs-mobile-nav',    // mobile nav
        '.betterdocs-sidebar',       // sidebar if nested
        'script', 'style', 'noscript',
    ].join(', ')).remove();

    return { title, html: contentEl.html() || '' };
}

async function scrapeGuide(
    link: GuideLink,
    td: TurndownService,
): Promise<{ url: string; markdown: string; title: string } | null> {
    try {
        const html = await fetchWithRetry(link.url);
        const $ = cheerio.load(html);

        const { title, html: contentHtml } = extractContent($);

        // Convert to markdown
        let markdown = td.turndown(contentHtml);

        // Clean up excessive blank lines
        markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();

        // Add YAML frontmatter
        const frontmatter = [
            '---',
            `title: "${title.replace(/"/g, '\\"')}"`,
            `url: "${link.url}"`,
            `section: "${link.section}"`,
            `lastScraped: "${new Date().toISOString()}"`,
            '---',
        ].join('\n');

        return {
            url: link.url,
            markdown: `${frontmatter}\n\n# ${title}\n\n${markdown}\n`,
            title,
        };
    } catch (err) {
        console.error(`  ✗ Failed to scrape ${link.url}: ${err}`);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Phase 3: Write files with change detection
// ---------------------------------------------------------------------------

async function writeGuides(
    links: GuideLink[],
    td: TurndownService,
    meta: ScrapeMeta,
): Promise<{ newCount: number; updatedCount: number; unchangedCount: number; failedCount: number }> {
    console.log('📝 Phase 2-3: Scraping and writing guides...\n');
    const stats = { newCount: 0, updatedCount: 0, unchangedCount: 0, failedCount: 0 };

    const results = await batchRun(links, CONCURRENCY, DELAY_MS, async (link) => {
        const result = await scrapeGuide(link, td);
        if (!result) {
            stats.failedCount++;
            return;
        }

        const hash = sha256(result.markdown);
        const existing = meta.guides[link.url];
        const filePath = join(link.section, `${link.slug}.md`);
        const absPath = join(OUTPUT_DIR, filePath);

        if (!FORCE && existing && existing.hash === hash && existsSync(absPath)) {
            stats.unchangedCount++;
            process.stdout.write('.');
            return;
        }

        // Write file
        await mkdir(dirname(absPath), { recursive: true });
        await writeFile(absPath, result.markdown, 'utf-8');

        if (existing) {
            stats.updatedCount++;
            process.stdout.write('U');
        } else {
            stats.newCount++;
            process.stdout.write('+');
        }

        meta.guides[link.url] = {
            hash,
            lastUpdated: new Date().toISOString(),
            filePath,
            title: result.title,
            section: link.section,
        };
    });

    console.log('\n');
    return stats;
}

// ---------------------------------------------------------------------------
// Phase 4: Generate index
// ---------------------------------------------------------------------------

async function generateIndex(meta: ScrapeMeta): Promise<void> {
    console.log('📋 Phase 4: Generating index.md...\n');

    // Group by section
    const sections = new Map<string, { title: string; url: string; filePath: string }[]>();

    for (const [url, guide] of Object.entries(meta.guides)) {
        if (!sections.has(guide.section)) {
            sections.set(guide.section, []);
        }
        sections.get(guide.section)!.push({
            title: guide.title,
            url,
            filePath: guide.filePath,
        });
    }

    // Sort sections alphabetically, guides alphabetically within each
    const sortedSections = Array.from(sections.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    let md = `---\ntitle: "FuseBase Guides Index"\nlastGenerated: "${new Date().toISOString()}"\n---\n\n`;
    md += `# FuseBase Guides\n\n`;
    md += `> Auto-generated index of all FuseBase guide pages.\n`;
    md += `> Total: **${Object.keys(meta.guides).length}** guides across **${sortedSections.length}** sections.\n\n`;

    for (const [section, guides] of sortedSections) {
        const sorted = guides.sort((a, b) => a.title.localeCompare(b.title));
        md += `## ${section} (${sorted.length})\n\n`;
        for (const guide of sorted) {
            md += `- [${guide.title}](${guide.filePath.replace(/\\/g, '/')})\n`;
        }
        md += '\n';
    }

    await writeFile(INDEX_FILE, md, 'utf-8');
}

// ---------------------------------------------------------------------------
// Phase 5: NotebookLM Sync
// ---------------------------------------------------------------------------

async function syncToNotebookLM(meta: ScrapeMeta, notebookId: string): Promise<void> {
    console.log(`\n🔗 Phase 5: Syncing to NotebookLM (${notebookId})...\n`);

    // Step 1: Query existing sources in the notebook
    let existingUrls = new Set<string>();
    try {
        console.log('  Checking existing sources in notebook...');
        const listOutput = execSync(`nlm source list ${notebookId} --url`, {
            stdio: 'pipe',
            timeout: 30000,
        }).toString();
        // Parse output — format is "SOURCE_ID: URL" per line
        for (const line of listOutput.split('\n')) {
            const match = line.match(/:\s*(https?:\/\/.+)/);
            if (match) existingUrls.add(match[1].trim().replace(/\/$/, ''));
        }
        console.log(`  Found ${existingUrls.size} existing source(s) in notebook\n`);
    } catch (err: any) {
        const msg = err?.stderr?.toString() || err?.message || '';
        if (msg.includes('expired') || msg.includes('authentication') || msg.includes('login')) {
            console.error('  ✗ NLM auth expired. Run `nlm login` and re-run.');
            return;
        }
        console.warn(`  ⚠ Could not list existing sources: ${msg.trim().slice(0, 80)}`);
        console.warn('  Proceeding with meta-based tracking only.\n');
    }

    // Step 2: Determine which URLs need adding
    const alreadySynced = new Set(meta.nlmSyncedUrls || []);
    const allUrls = Object.keys(meta.guides);
    const toSync = allUrls.filter((u) => {
        const normalized = u.replace(/\/$/, '');
        // Skip if already in notebook OR already tracked as synced
        if (existingUrls.has(normalized) || existingUrls.has(u)) {
            alreadySynced.add(u); // Mark as synced since it's already in the notebook
            return false;
        }
        if (alreadySynced.has(u)) return false;
        return true;
    });

    if (toSync.length === 0) {
        console.log('  All URLs already present in NotebookLM.\n');
        meta.nlmSyncedUrls = Array.from(alreadySynced);
        await saveMeta(meta);
        return;
    }

    console.log(`  ${allUrls.length - toSync.length} already in notebook, ${toSync.length} new URL(s) to add\n`);

    // Step 3: Add new sources
    let added = 0;
    let failed = 0;

    for (const url of toSync) {
        try {
            const cmd = `nlm source add ${notebookId} --url "${url}"`;
            execSync(cmd, { stdio: 'pipe', timeout: 30000 });
            added++;
            alreadySynced.add(url);
            process.stdout.write('+');
        } catch (err: any) {
            failed++;
            const msg = err?.stderr?.toString() || err?.message || 'unknown error';
            if (msg.includes('expired') || msg.includes('authentication') || msg.includes('login')) {
                console.error(`\n\n  ✗ NLM auth expired after ${added} adds. Run \`nlm login\` and re-run.`);
                break;
            }
            console.error(`\n  ✗ Failed: ${url} — ${msg.trim().slice(0, 80)}`);
        }
        await sleep(NLM_RATE_LIMIT_MS);
    }

    meta.nlmSyncedUrls = Array.from(alreadySynced);
    await saveMeta(meta);

    console.log(`\n\n  NLM sync: ${added} added, ${failed} failed, ${alreadySynced.size} total synced\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  FuseBase Guide Scraper');
    console.log(`  Output: ${OUTPUT_DIR}`);
    console.log(`  Mode: ${FORCE ? 'FORCE (re-scrape all)' : 'INCREMENTAL (changed only)'}`);
    if (SYNC_NLM_NOTEBOOK) console.log(`  NLM Sync: ${SYNC_NLM_NOTEBOOK}`);
    console.log('═══════════════════════════════════════════════════════');

    // Ensure output dir
    await mkdir(OUTPUT_DIR, { recursive: true });

    // Load existing metadata
    const meta = await loadMeta();
    const previousCount = Object.keys(meta.guides).length;

    // Phase 1: Discover links
    const links = await discoverLinks();

    if (links.length === 0) {
        console.error('No guide links found. Aborting.');
        process.exit(1);
    }

    // Phase 2-3: Scrape and write
    const td = createTurndown();
    const stats = await writeGuides(links, td, meta);

    // Check for removed pages
    const currentUrls = new Set(links.map((l) => l.url));
    const removedUrls = Object.keys(meta.guides).filter((u) => !currentUrls.has(u));
    if (removedUrls.length > 0) {
        console.log(`⚠ ${removedUrls.length} previously scraped page(s) no longer found:`);
        for (const u of removedUrls) {
            console.log(`   - ${u} (file: ${meta.guides[u].filePath})`);
        }
        console.log('  These files were NOT deleted. Remove manually if desired.\n');
    }

    // Phase 4: Generate index
    meta.lastRun = new Date().toISOString();
    await generateIndex(meta);
    await saveMeta(meta);

    // Phase 5: NLM sync
    // If --sync-nlm was passed, persist the notebook ID for future auto-sync.
    // If no flag but we have a stored ID and new guides were found, auto-sync.
    const nlmNotebook = SYNC_NLM_NOTEBOOK || meta.nlmNotebookId || DEFAULT_NLM_NOTEBOOK;
    if (SYNC_NLM_NOTEBOOK) {
        meta.nlmNotebookId = SYNC_NLM_NOTEBOOK;
        await saveMeta(meta);
    }
    if (nlmNotebook && stats.newCount > 0) {
        await syncToNotebookLM(meta, nlmNotebook);
    } else if (nlmNotebook && stats.newCount === 0) {
        // Check if there are unsynced URLs from prior failed syncs
        const unsynced = Object.keys(meta.guides).filter(u => !(meta.nlmSyncedUrls || []).includes(u));
        if (unsynced.length > 0) {
            console.log(`\n🔗 Found ${unsynced.length} previously unsynced URL(s), syncing...`);
            await syncToNotebookLM(meta, nlmNotebook);
        }
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Previous guides:  ${previousCount}`);
    console.log(`  Discovered links: ${links.length}`);
    console.log(`  New:              ${stats.newCount}`);
    console.log(`  Updated:          ${stats.updatedCount}`);
    console.log(`  Unchanged:        ${stats.unchangedCount}`);
    console.log(`  Failed:           ${stats.failedCount}`);
    console.log(`  Removed (flagged):${removedUrls.length}`);
    const syncedCount = (meta.nlmSyncedUrls || []).length;
    const totalGuides = Object.keys(meta.guides).length;
    const unsyncedCount = totalGuides - syncedCount;
    if (nlmNotebook) {
        console.log(`  NLM synced:       ${syncedCount}/${totalGuides}`);
    }
    console.log('═══════════════════════════════════════════════════════');

    // Prominent action-required banner for unsynced NLM sources
    if (unsyncedCount > 0 && nlmNotebook) {
        console.log('');
        console.log('⚠️ ══════════════════════════════════════════════════════');
        console.log(`  🆕 ${unsyncedCount} NEW GUIDE(S) NEED TO BE SYNCED TO NOTEBOOKLM`);
        console.log(`     Notebook: ${nlmNotebook}`);
        console.log('     NLM auth may have expired. Run:');
        console.log('       nlm login');
        console.log(`       npx tsx scripts/scrape-guides.ts --sync-nlm ${nlmNotebook}`);
        console.log('⚠️ ══════════════════════════════════════════════════════');
    } else if (unsyncedCount > 0 && !nlmNotebook) {
        console.log('');
        console.log('⚠️ ══════════════════════════════════════════════════════');
        console.log(`  🆕 ${unsyncedCount} NEW GUIDE(S) DETECTED — NOT SYNCED TO NOTEBOOKLM`);
        console.log('     No notebook ID configured. Run with --sync-nlm:');
        console.log('       npx tsx scripts/scrape-guides.ts --sync-nlm <notebook-id>');
        console.log('⚠️ ══════════════════════════════════════════════════════');
    }

    console.log(`\n✅ Done! Output at: ${OUTPUT_DIR}`);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
