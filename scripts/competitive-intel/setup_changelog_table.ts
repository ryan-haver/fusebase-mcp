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

async function main() {
  const client = new FusebaseClient({ host, orgId, cookie, autoRefresh: true });

  console.log('--- Step 1: Adding custom columns to Intelligence Changelog ---');
  // 1. Company Name
  try {
    const colCompany = await client.addDatabaseColumn(changelogDashboardId, changelogViewId, 'Company', 'string');
    console.log('Added Company column:', colCompany);
  } catch (e: any) {
    console.log('Company column error/exists:', e.message);
  }

  // 2. Source URL
  try {
    const colUrl = await client.addDatabaseColumn(changelogDashboardId, changelogViewId, 'Source URL', 'link');
    console.log('Added Source URL column:', colUrl);
  } catch (e: any) {
    console.log('Source URL error/exists:', e.message);
  }

  // 3. Category (Label with color options)
  try {
    const colCat = await client.addDatabaseColumn(changelogDashboardId, changelogViewId, 'Event Category', 'label', {
      labels: [
        { name: 'Major Announcements', color: 'blue' },
        { name: 'Funding', color: 'emerald' },
        { name: 'Features / Capabilities', color: 'purple' },
        { name: 'Strategy / Messaging', color: 'amber' },
        { name: 'Customer Win', color: 'cyan' },
      ],
    });
    console.log('Added Event Category column:', colCat);
  } catch (e: any) {
    console.log('Category error/exists:', e.message);
  }

  // 4. Old Value
  try {
    const colOld = await client.addDatabaseColumn(changelogDashboardId, changelogViewId, 'Old Value', 'string');
    console.log('Added Old Value column:', colOld);
  } catch (e: any) {
    console.log('Old Value error/exists:', e.message);
  }

  // 5. New Value
  try {
    const colNew = await client.addDatabaseColumn(changelogDashboardId, changelogViewId, 'New Value', 'string');
    console.log('Added New Value column:', colNew);
  } catch (e: any) {
    console.log('New Value error/exists:', e.message);
  }

  // Inspect updated schema
  const schema = await client.getViewSchema(changelogDashboardId, changelogViewId);
  console.log('\n--- Updated Intelligence Changelog Schema ---');
  for (const c of schema.columns) {
    console.log(`- [${c.key}] ${c.name} (${c.type})`);
  }
}

main().catch(console.error);
