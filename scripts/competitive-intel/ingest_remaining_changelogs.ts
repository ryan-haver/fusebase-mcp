import { FusebaseClient } from '../src/client.js';
import { loadEncryptedCookie } from '../src/crypto.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}

const host = process.env.FUSEBASE_HOST || 'inkabeam.nimbusweb.me';
const orgId = process.env.FUSEBASE_ORG_ID || 'u268r1';
let cookie = process.env.FUSEBASE_COOKIE || '';
if (!cookie) {
  const stored = loadEncryptedCookie(process.env.FUSEBASE_PROFILE);
  if (stored?.cookie) cookie = stored.cookie;
}

const changelogDashboardId = '1e4fe893-269c-4687-bfc3-e61f5a0a2b24';
const changelogViewId = 'f15d1d9d-c34e-4a7e-9afe-ea52d30efe56';

function parseSafeDate(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString();
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString();
  const yr = dateStr.match(/\b(202\d)\b/);
  if (yr) return new Date(`${yr[1]}-06-01T00:00:00.000Z`).toISOString();
  return new Date().toISOString();
}

function normalizeCategory(cat?: string): string {
  const c = cat || 'Major Announcements';
  const allowed = [
    'Major Announcements',
    'Funding',
    'Features / Capabilities',
    'Strategy / Messaging',
    'Customer Win',
  ];
  if (allowed.includes(c)) return c;
  if (c.toLowerCase().includes('fund') || c.toLowerCase().includes('seed') || c.toLowerCase().includes('series')) return 'Funding';
  if (c.toLowerCase().includes('feature') || c.toLowerCase().includes('launch') || c.toLowerCase().includes('product')) return 'Features / Capabilities';
  if (c.toLowerCase().includes('strateg') || c.toLowerCase().includes('messag') || c.toLowerCase().includes('pivot')) return 'Strategy / Messaging';
  if (c.toLowerCase().includes('customer') || c.toLowerCase().includes('case') || c.toLowerCase().includes('win')) return 'Customer Win';
  return 'Major Announcements';
}

async function main() {
  const client = new FusebaseClient({ host, orgId, cookie, autoRefresh: true });

  const currentData = await client.getDatabaseData(changelogDashboardId, changelogViewId, { limit: 200 });
  const existingCount = currentData.data?.length || 0;
  console.log(`Current existing rows in Changelog table: ${existingCount}`);

  const changelogJsonPath = path.resolve('C:\\scripts\\comptetitive-intel-dash\\data\\seed_changelogs.json');
  const rawEvents: Array<any> = JSON.parse(fs.readFileSync(changelogJsonPath, 'utf-8'));
  console.log(`Total events to ensure: ${rawEvents.length}`);

  const remainingEvents = rawEvents.slice(existingCount);
  console.log(`Remaining events to ingest: ${remainingEvents.length}`);

  if (remainingEvents.length === 0) {
    console.log('All events already ingested!');
    return;
  }

  const BATCH_SIZE = 10;
  for (let i = 0; i < remainingEvents.length; i += BATCH_SIZE) {
    const chunk = remainingEvents.slice(i, i + BATCH_SIZE);
    const rows = chunk.map((ev) => ({
      create_new_row: true,
      values: [
        { item_key: 'KtNc9FdL', value: ev.headline || `${ev.company}: ${ev.category}` },
        { item_key: 'l7FmQxh8', value: ev.company },
        { item_key: 'cTZ-k3we', value: normalizeCategory(ev.category) },
        { item_key: 'xR8Pxxlt', value: parseSafeDate(ev.date) },
        { item_key: 'NZp5jTqh', value: ev.summary || ev.headline || '' },
        {
          item_key: 'iovzmAlW',
          value: ev.sourceUrl ? { url: ev.sourceUrl, text: ev.sourceUrl } : null,
        },
        { item_key: 'IXYR7QYQ', value: ev.oldValue || '' },
        { item_key: 'u35rF0D1', value: ev.newValue || '' },
      ],
    }));

    process.stdout.write(`Ingesting events [${existingCount + i + 1}-${Math.min(existingCount + i + BATCH_SIZE, rawEvents.length)} / ${rawEvents.length}]... `);
    try {
      const res = await client.batchPutDashboardData(changelogDashboardId, changelogViewId, rows);
      console.log(res?.data?.length ? `✓ (${res.data.length} created)` : '✓');
    } catch (e: any) {
      console.log(`Error: ${e.message}`);
      if (e.message.includes('429')) {
        console.log('Hit 429 limit, sleeping 60s...');
        await new Promise((r) => setTimeout(r, 60000));
        i -= BATCH_SIZE;
        continue;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const finalData = await client.getDatabaseData(changelogDashboardId, changelogViewId, { limit: 200 });
  console.log(`\n✅ Ingestion complete! Total events in Intelligence Changelog: ${finalData.data?.length}`);
}

main().catch(console.error);
