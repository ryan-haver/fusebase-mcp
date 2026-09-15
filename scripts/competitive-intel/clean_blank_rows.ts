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
  // delete the blank row
  try {
    await client.deleteDatabaseRow(masterDashboardId, masterViewId, '6c3df683-e4b8-4beb-9a75-37b0c0acc4f2');
    console.log('Deleted blank row 6c3df683');
  } catch (e: any) {
    console.log('Error deleting blank row:', e.message);
  }

  const data = await client.getDatabaseData(masterDashboardId, masterViewId, { limit: 100 });
  const rows = data.data || [];
  console.log(`Remaining rows: ${rows.length}`);
  const names = rows.map((r: any) => r.OtiwIUpQ || r.UmOYNqou || '(blank)');
  console.log('Names:', names.sort());
}

main().catch(console.error);
