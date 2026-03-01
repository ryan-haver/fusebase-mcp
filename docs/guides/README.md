# FuseBase Guide Scraper

Automated scraper that extracts all FuseBase help guides into organized markdown files and optionally syncs them to NotebookLM.

## Quick Start

```bash
# Basic scrape (incremental — only fetches changed pages)
npx tsx scripts/scrape-guides.ts

# First-time NLM sync (persists notebook ID for auto-sync on future runs)
npx tsx scripts/scrape-guides.ts --sync-nlm 6d691591-cbca-4ca7-a31f-5b95b9a7884b

# Subsequent runs auto-sync new guides to NLM (no flag needed)
npx tsx scripts/scrape-guides.ts

# Force re-scrape all pages
npx tsx scripts/scrape-guides.ts --force
```

## How It Works

| Phase | What It Does |
|-------|-------------|
| **1. Discovery** | Fetches 17 category pages, extracts all guide URLs from sidebar nav |
| **2. Scraping** | Fetches each guide page, extracts content from `.betterdocs-content` |
| **3. Writing** | Converts HTML→Markdown via Turndown, writes with YAML frontmatter |
| **4. Index** | Generates `index.md` with all guides grouped by section |
| **5. NLM Sync** | Adds new URLs to NotebookLM (auto if new guides detected + notebook ID stored) |

## Change Detection

Each guide's markdown output is SHA-256 hashed. On re-runs, only files whose content changed get rewritten. Console indicators: `+` = new, `U` = updated, `.` = unchanged.

## NLM Auto-Sync

After the first run with `--sync-nlm <notebook-id>`, the notebook ID is persisted in `.scrape-meta.json`. On subsequent runs:
- **New guides found** → automatically synced to NLM
- **Previously failed syncs** → retried automatically
- **All synced** → skipped (no NLM calls)

> **Prerequisite**: Run `nlm login` before any NLM sync. Sessions expire in ~20min.

## Output Structure

```
docs/guides/
├── index.md                      ← master link list
├── .scrape-meta.json             ← hashes, sync state, notebook ID
├── README.md                     ← this file
├── getting-started/       (8)
├── basics/                (36)
├── client-portal/         (38)
├── organization/          (18)
├── fusebase-ai/           (14)
├── branding/              (11)
├── settings/              (6)
├── automations-and-integrations/ (16)
├── embedding-sharing/     (25)
├── screenshot/            (6)
├── table-database/        (6)
├── dashboard-crm/         (11)
├── page-editor/           (13)
├── web-clipper/           (4)
├── android-ios/           (10)
├── import-fusebase/       (7)
└── personal-use/          (2)
```

**Total: ~231 guides across 17 sections**

## Agent Notes

When asked to update or refresh FuseBase guides:
1. Run `npx tsx scripts/scrape-guides.ts` from the `fusebase-mcp` project root
2. New guides are auto-synced to NLM if the notebook ID is stored
3. If NLM auth has expired, run `nlm login` first then re-run the scraper
4. Notebook ID: `6d691591-cbca-4ca7-a31f-5b95b9a7884b`
