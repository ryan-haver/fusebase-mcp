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
  const schema = await client.getViewSchema(changelogDashboardId, changelogViewId);
  console.log('Changelog Table Schema Columns:');
  for (const col of schema.columns) {
    console.log(`  - [${col.key}] ${col.name} (${col.type})`);
  }
}

main().catch(console.error);
