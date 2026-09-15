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

  console.log('--- Step 1: Adding Compliance Tier (Custom Label Multi-Select) ---');
  let colComplianceKey = '';
  try {
    const colCompliance = await client.addDatabaseColumn(masterDashboardId, masterViewId, 'Compliance Tier', 'label', {
      multiSelect: true,
      labels: [
        { name: 'SOC 2 Type II', color: 'emerald' },
        { name: 'ISO 27001', color: 'blue' },
        { name: 'FedRAMP Moderate', color: 'purple' },
        { name: 'FedRAMP High', color: 'rose' },
        { name: 'HIPAA', color: 'amber' },
      ],
    });
    console.log('Added Compliance Tier:', colCompliance);
    colComplianceKey = colCompliance.key || (colCompliance as any).columnKey;
  } catch (e: any) {
    console.log('Compliance Tier notice:', e.message);
  }

  console.log('\n--- Step 2: Adding Battlecards & Collateral (Files) ---');
  let colFilesKey = '';
  try {
    const colFiles = await client.addDatabaseColumn(masterDashboardId, masterViewId, 'Battlecards & Collateral', 'files');
    console.log('Added Battlecards & Collateral:', colFiles);
    colFilesKey = colFiles.key || (colFiles as any).columnKey;
  } catch (e: any) {
    console.log('Battlecards & Collateral notice:', e.message);
  }

  const schema = await client.getViewSchema(masterDashboardId, masterViewId);
  console.log('\n--- Master View Columns (Last 8) ---');
  for (const c of schema.columns.slice(-8)) {
    console.log(`- [${c.key}] ${c.name} (${c.type})`);
  }
}

main().catch(console.error);
