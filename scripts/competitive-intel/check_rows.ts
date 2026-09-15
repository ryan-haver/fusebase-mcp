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

async function main() {
  const client = new FusebaseClient({ host, orgId, cookie, autoRefresh: true });
  const dashboardId = '99ed2b9b-102c-45bd-9dfc-51cb184e22cf';
  const viewId = '9847de9d-fc51-4bb1-8806-24ecd84f6313';
  
  const data = await client.getDatabaseData(dashboardId, viewId, { limit: 100 });
  console.log('Total rows returned:', data.data?.length);

  for (let i = 0; i < Math.min(5, data.data.length); i++) {
    const r = data.data[i];
    console.log(`Row ${i} (${r.root_index_value}):`, {
      Name_col: r.OtiwIUpQ,
      name_col: r.UmOYNqou,
      id_col: r.TMNo5Sh6,
      marketSegment_col: r.ACIiaI_q,
      threatLevel_col: r['-z3T0Mgs']
    });
  }
}

main().catch(console.error);
