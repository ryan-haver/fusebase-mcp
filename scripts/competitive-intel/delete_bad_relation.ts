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

const relationId = '618618ec-650f-4c7e-9e89-e2b133b2cc4b';

async function main() {
  const client = new FusebaseClient({ host, orgId, cookie, autoRefresh: true });

  console.log(`Deleting relation ${relationId}...`);
  try {
    const delRes = await client.deleteRelation(relationId);
    console.log('Delete result:', delRes);
  } catch (e: any) {
    console.log('Delete error:', e.message);
  }

  // Now test updating row 0 on master dashboard
  const masterDashboardId = '99ed2b9b-102c-45bd-9dfc-51cb184e22cf';
  const masterViewId = '9847de9d-fc51-4bb1-8806-24ecd84f6313';
  const data = await client.getDatabaseData(masterDashboardId, masterViewId, { limit: 1 });
  const row0 = data.data[0];
  console.log('Testing cell update on row 0:', row0.root_index_value);

  const res = await client.updateDatabaseCell(
    masterDashboardId,
    masterViewId,
    row0.root_index_value,
    'vz07PLSM',
    'Proprietary Fine-Tuned SLMs'
  );
  console.log('Cell update succeeded!', res);
}

main().catch(console.error);
