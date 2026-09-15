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

const masterDashboardId = '99ed2b9b-102c-45bd-9dfc-51cb184e22cf';
const masterViewId = '9847de9d-fc51-4bb1-8806-24ecd84f6313';

async function main() {
  const client = new FusebaseClient({ host, orgId, cookie, autoRefresh: true });
  const data = await client.getDatabaseData(masterDashboardId, masterViewId, { limit: 100 });
  const rows = data.data || [];
  console.log(`Total rows: ${rows.length}`);
  const counts = new Map<string, string[]>();
  for (const r of rows) {
    const name = r.OtiwIUpQ || r.UmOYNqou || '(blank)';
    if (!counts.has(name)) counts.set(name, []);
    counts.get(name)!.push(r.root_index_value);
  }
  for (const [name, uuids] of counts.entries()) {
    if (uuids.length > 1 || name === '(blank)') {
      console.log(`Duplicate / blank row: "${name}" -> count ${uuids.length} (UUIDs: ${uuids.join(', ')})`);
    }
  }
}

main().catch(console.error);
