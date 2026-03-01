/**
 * Guide Loader — reads and searches the local FuseBase guide corpus.
 *
 * The guides live in docs/guides/<section>/<slug>.md with YAML frontmatter.
 * This module provides fast, in-memory search and retrieval.
 *
 * @module guide-loader
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUIDES_DIR = path.resolve(__dirname, "..", "docs", "guides");

// ─── Types ───

export interface GuideEntry {
    section: string;
    title: string;
    slug: string;
    /** Relative path from guides dir, e.g. "basics/hint-object.md" */
    relativePath: string;
    /** Absolute path on disk */
    absolutePath: string;
}

export interface GuideSection {
    name: string;
    count: number;
}

// ─── Index cache ───

let cachedIndex: GuideEntry[] | null = null;

/**
 * Load the guide index by scanning the docs/guides directory.
 * Reads index.md for structured entries, falls back to filesystem scan.
 * Results are cached after first call.
 */
export function loadGuideIndex(): GuideEntry[] {
    if (cachedIndex) return cachedIndex;

    const entries: GuideEntry[] = [];
    const indexPath = path.join(GUIDES_DIR, "index.md");

    if (fs.existsSync(indexPath)) {
        // Parse index.md for structured guide list
        const content = fs.readFileSync(indexPath, "utf-8");
        let currentSection = "";

        for (const line of content.split("\n")) {
            // Section headers: "## basics (36)"
            const sectionMatch = line.match(/^## (\S+)\s*\(\d+\)/);
            if (sectionMatch) {
                currentSection = sectionMatch[1];
                continue;
            }

            // Guide entries: "- [Title](section/slug.md)"
            const entryMatch = line.match(/^- \[(.+?)\]\((.+?\.md)\)/);
            if (entryMatch && currentSection) {
                const title = entryMatch[1];
                const relativePath = entryMatch[2];
                const slug = path.basename(relativePath, ".md");
                const absolutePath = path.join(GUIDES_DIR, relativePath);

                if (fs.existsSync(absolutePath)) {
                    entries.push({ section: currentSection, title, slug, relativePath, absolutePath });
                }
            }
        }
    }

    // Fallback: scan filesystem if index.md didn't yield results
    if (entries.length === 0) {
        const sections = fs.readdirSync(GUIDES_DIR, { withFileTypes: true })
            .filter(d => d.isDirectory());

        for (const section of sections) {
            const sectionDir = path.join(GUIDES_DIR, section.name);
            const files = fs.readdirSync(sectionDir)
                .filter(f => f.endsWith(".md"));

            for (const file of files) {
                const slug = path.basename(file, ".md");
                const absolutePath = path.join(sectionDir, file);

                // Read title from frontmatter
                let title = slug.replace(/-/g, " ");
                try {
                    const content = fs.readFileSync(absolutePath, "utf-8");
                    const titleMatch = content.match(/^title:\s*"(.+?)"/m);
                    if (titleMatch) title = titleMatch[1];
                } catch { /* use slug as title */ }

                entries.push({
                    section: section.name,
                    title,
                    slug,
                    relativePath: `${section.name}/${file}`,
                    absolutePath,
                });
            }
        }
    }

    cachedIndex = entries;
    return entries;
}

/**
 * Search guides by query string. Case-insensitive substring match
 * against title and section name. Returns top N matches (default 10).
 */
export function searchGuides(query: string, limit: number = 10): GuideEntry[] {
    const index = loadGuideIndex();
    const q = query.toLowerCase();

    // Score: title match is worth more than section match
    const scored = index.map(entry => {
        let score = 0;
        const titleLower = entry.title.toLowerCase();
        const sectionLower = entry.section.toLowerCase();
        const slugLower = entry.slug.toLowerCase();

        if (titleLower.includes(q)) score += 10;
        if (titleLower.startsWith(q)) score += 5;
        if (slugLower.includes(q)) score += 3;
        if (sectionLower.includes(q)) score += 1;

        return { entry, score };
    });

    return scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(s => s.entry);
}

/**
 * Get the full markdown content of a specific guide.
 *
 * @param section - Section name (e.g. "basics", "page-editor")
 * @param slug - Guide slug without .md extension (e.g. "hint-object")
 * @returns Guide markdown content, or null if not found
 */
export function getGuideContent(section: string, slug: string): string | null {
    const filePath = path.join(GUIDES_DIR, section, `${slug}.md`);
    if (!fs.existsSync(filePath)) return null;

    try {
        return fs.readFileSync(filePath, "utf-8");
    } catch {
        return null;
    }
}

/**
 * List all guide sections with their guide counts.
 */
export function listGuideSections(): GuideSection[] {
    const index = loadGuideIndex();
    const sectionMap = new Map<string, number>();

    for (const entry of index) {
        sectionMap.set(entry.section, (sectionMap.get(entry.section) || 0) + 1);
    }

    return Array.from(sectionMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
