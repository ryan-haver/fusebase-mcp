# FuseBase Guide Scraper

Automated scraper that extracts all FuseBase help guides into organized markdown files and optionally syncs them to NotebookLM.

## Quick Start

```bash
# Basic scrape (incremental — only fetches changed pages)
npm run scrape:guides
# or: npx tsx scripts/scrape-guides.ts

# Optional NLM sync (persists notebook ID and syncs to NotebookLM)
npm run scrape:guides -- --sync-nlm 6d691591-cbca-4ca7-a31f-5b95b9a7884b

# Force re-scrape all pages
npm run scrape:guides -- --force
```

## How It Works

| Phase | What It Does |
|-------|-------------|
| **1. Discovery** | Fetches 19 category pages, extracts all guide URLs from sidebar nav |
| **2. Scraping** | Fetches each guide page, extracts content from `.betterdocs-content` |
| **3. Writing** | Converts HTML→Markdown via Turndown, writes with YAML frontmatter |
| **4. Index** | Generates `index.md` with all guides grouped by section |
| **5. NLM Sync** | Adds new URLs to NotebookLM (opt-in via `--sync-nlm <notebookId>`) |

## Change Detection

Each guide's markdown output is SHA-256 hashed. On re-runs, only files whose content changed get rewritten. Console indicators: `+` = new, `U` = updated, `.` = unchanged.

## NLM Sync (Opt-In)

To sync guides to NotebookLM, pass `--sync-nlm <notebook-id>`:
- **New guides found** → synced to the target NotebookLM notebook
- **Session Auth**: Ensure you run `nlm login` first; sessions expire periodically
- If omitted, the scraper runs purely locally without making external NLM calls.

## Output Structure

```
docs/guides/
├── index.md                      ← master link list
├── .scrape-meta.json             ← hashes, sync state, notebook ID
├── README.md                     ← this file
├── getting-started/       (8)
├── basics/                (38)
├── client-portal/         (43)
├── organization/          (18)
├── fusebase-ai/           (16)
├── fusebase-vibe-code/    (25)
├── fusebase-work/         (9)
├── branding/              (12)
├── settings/              (6)
├── automations-and-integrations/ (16)
├── embedding-sharing/     (25)
├── screenshot/            (6)
├── table-database/        (7)
├── dashboard-crm/         (13)
├── page-editor/           (13)
├── web-clipper/           (4)
├── android-ios/           (10)
├── import-fusebase/       (7)
└── personal-use/          (2)
```

**Total: 278 guides across 19 sections**

## Agent Notes

When asked to update or refresh FuseBase guides:
1. Run `npm run scrape:guides` from the `fusebase-mcp` project root
2. If NotebookLM sync is specifically requested: run `nlm login` first, then `npm run scrape:guides -- --sync-nlm 6d691591-cbca-4ca7-a31f-5b95b9a7884b`
3. Default Notebook ID: `6d691591-cbca-4ca7-a31f-5b95b9a7884b`
