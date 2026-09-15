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

async function main() {
  const client = new FusebaseClient({ host, orgId, cookie, autoRefresh: true });

  console.log('--- Step 1: Checking and clearing existing changelog rows ---');
  let existingData = await client.getDatabaseData(changelogDashboardId, changelogViewId, { limit: 200 });
  let existingRows = existingData.data || [];
  console.log(`Found ${existingRows.length} existing rows in Changelog table.`);

  for (const row of existingRows) {
    await client.deleteRow(changelogDashboardId, row.root_index_value);
  }
  console.log('Cleared existing changelog rows for clean ingestion.');

  console.log('\n--- Step 2: Loading seed changelog events ---');
  const changelogJsonPath = path.resolve('C:\\scripts\\comptetitive-intel-dash\\data\\seed_changelogs.json');
  const rawEvents: Array<{
    company: string;
    date: string;
    category: string;
    headline: string;
    summary: string;
    sourceUrl?: string;
    oldValue?: string;
    newValue?: string;
  }> = JSON.parse(fs.readFileSync(changelogJsonPath, 'utf-8'));

  console.log(`Loaded ${rawEvents.length} events from seed_changelogs.json.`);

  console.log('\n--- Step 3: Batch ingesting changelog events ---');
  const BATCH_SIZE = 10; // Under 100 cells per request limit (10 * 8 = 80 cells)
  for (let i = 0; i < rawEvents.length; i += BATCH_SIZE) {
    const chunk = rawEvents.slice(i, i + BATCH_SIZE);
    const rows = chunk.map((ev) => ({
      create_new_row: true,
      values: [
        { item_key: 'KtNc9FdL', value: ev.headline || `${ev.company}: ${ev.category}` },
        { item_key: 'l7FmQxh8', value: ev.company },
        { item_key: 'cTZ-k3we', value: ev.category || 'Major Announcements' },
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

    process.stdout.write(`Ingesting events [${i + 1}-${Math.min(i + BATCH_SIZE, rawEvents.length)} / ${rawEvents.length}]... `);
    try {
      const res = await client.batchPutDashboardData(changelogDashboardId, changelogViewId, rows);
      console.log(res?.data?.length ? `✓ (${res.data.length} created)` : '✓');
    } catch (e: any) {
      console.log(`Failed batch: ${e.message}`);
      if (e.message.includes('429')) {
        console.log('Hit 429 rate limit, sleeping 15s before retry...');
        await new Promise((r) => setTimeout(r, 15000));
        i -= BATCH_SIZE; // retry this batch
        continue;
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log('\n--- Step 4: Configuring view schema and column order ---');
  const viewRes = await (client as any).request(
    `/v4/api/proxy/dashboard-service/v1/dashboards/${changelogDashboardId}/views/${changelogViewId}`
  );
  const viewData = viewRes.data;
  const currentItems = viewData.schema?.items || [];

  const desiredOrder = [
    { key: 'KtNc9FdL', name: 'Headline' },
    { key: 'l7FmQxh8', name: 'Company' },
    { key: 'cTZ-k3we', name: 'Event Category' },
    { key: 'xR8Pxxlt', name: 'Event Date' },
    { key: 'NZp5jTqh', name: 'Summary' },
    { key: 'iovzmAlW', name: 'Source URL' },
    { key: 'IXYR7QYQ', name: 'Old Value' },
    { key: 'u35rF0D1', name: 'New Value' },
  ];

  const itemMap = new Map<string, any>();
  for (const it of currentItems) {
    itemMap.set(it.key, it);
  }

  const newItems: any[] = [];
  for (const cfg of desiredOrder) {
    const it = itemMap.get(cfg.key);
    if (it) {
      newItems.push({ ...it, name: cfg.name, hidden: false });
      itemMap.delete(cfg.key);
    }
  }
  for (const it of itemMap.values()) {
    newItems.push({ ...it, hidden: true });
  }

  viewData.schema.items = newItems;
  await (client as any).request(
    `/v4/api/proxy/dashboard-service/v1/dashboards/${changelogDashboardId}/views/${changelogViewId}`,
    {
      method: 'PUT',
      body: JSON.stringify(viewData),
    }
  );
  console.log('Changelog view schema updated and ordered.');

  console.log('\n--- Step 5: Verification ---');
  const verifyData = await client.getDatabaseData(changelogDashboardId, changelogViewId, { limit: 5 });
  console.log(`Total rows in Intelligence Changelog: ${verifyData.meta?.total || verifyData.data?.length}`);
  for (let i = 0; i < Math.min(3, verifyData.data?.length || 0); i++) {
    const r = verifyData.data[i];
    console.log(`  ${i + 1}. [${r.KtNc9FdL}] Company: ${r.l7FmQxh8} | Date: ${r.xR8Pxxlt} | Category: ${r['cTZ-k3we']}`);
  }
}

main().catch(console.error);
