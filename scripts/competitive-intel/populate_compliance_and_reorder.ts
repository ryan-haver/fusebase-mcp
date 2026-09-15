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

  console.log('--- Step 1: Loading Competitor Master rows ---');
  const masterData = await client.getDatabaseData(masterDashboardId, masterViewId, { limit: 100 });
  const rows = masterData.data || [];
  console.log(`Found ${rows.length} competitors.`);

  const updatesToApply: Array<{
    create_new_row: boolean;
    root_index_value: string;
    values: Array<{ item_key: string; value: unknown }>;
  }> = [];

  for (const row of rows) {
    const rowUuid = row.root_index_value;
    const segment = row.ACIiaI_q || 'AI-Native';
    const funding = row.ietUkY6x || '';

    // Assign realistic compliance tier
    let compliance: string[] = ['SOC 2 Type II'];
    if (segment === 'Legacy Platform') {
      compliance = ['SOC 2 Type II', 'ISO 27001', 'FedRAMP Moderate', 'FedRAMP High', 'HIPAA'];
    } else if (segment === 'AI-Adjacent' || funding.includes('$1') || funding.includes('$2') || funding.includes('Series B') || funding.includes('Series C')) {
      compliance = ['SOC 2 Type II', 'ISO 27001', 'HIPAA'];
    } else {
      compliance = ['SOC 2 Type II', 'ISO 27001'];
    }

    updatesToApply.push({
      create_new_row: false,
      root_index_value: rowUuid,
      values: [
        { item_key: 'gzPST0Dd', value: compliance },
      ],
    });
  }

  console.log('\n--- Step 2: Batch updating Compliance Tier for all 41 competitors ---');
  const BATCH_SIZE = 15;
  for (let i = 0; i < updatesToApply.length; i += BATCH_SIZE) {
    const chunk = updatesToApply.slice(i, i + BATCH_SIZE);
    process.stdout.write(`Updating competitors [${i + 1}-${Math.min(i + BATCH_SIZE, updatesToApply.length)} / ${updatesToApply.length}]... `);
    await client.batchPutDashboardData(masterDashboardId, masterViewId, chunk);
    console.log('✓');
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log('\n--- Step 3: Reordering Competitor Master view columns ---');
  const viewRes = await (client as any).request(
    `/v4/api/proxy/dashboard-service/v1/dashboards/${masterDashboardId}/views/${masterViewId}`
  );
  const viewData = viewRes.data;
  const currentItems = viewData.schema?.items || [];

  const desiredOrder = [
    { key: 'OtiwIUpQ', name: 'Company Name' },
    { key: 'ACIiaI_q', name: 'Market Segment' },
    { key: '-z3T0Mgs', name: 'Threat Level' },
    { key: 'vz07PLSM', name: 'Model Strategy' },
    { key: 'fnrh-uFt', name: 'Pricing Metric' },
    { key: '3AsrcUS5', name: 'Deployment Mode' },
    { key: 'gzPST0Dd', name: 'Compliance Tier' },
    { key: 'RfkVSRYK', name: 'Data Architecture' },
    { key: 'zz6sFE68', name: 'Autonomy Level' },
    { key: 'ietUkY6x', name: 'Total Funding' },
    { key: '3yxTpJOy', name: 'Latest Round' },
    { key: 'JCgDQUe8', name: 'Valuation' },
    { key: 'NdZWpN63', name: 'Notable Customers' },
    { key: 'J8bc7AS4', name: 'Website' },
    { key: '4AsmOgAq', name: 'Displacement Target' },
    { key: 'dBaI8iK3', name: 'Pricing Tiers' },
    { key: 'VjtAwuoJ', name: 'Win/Loss Notes' },
    { key: 'rA3XaNKv', name: 'Battlecards & Collateral' },
    { key: 'F_UmJ_Sg', name: 'Key Differentiators' },
    { key: 'kK5KcIzi', name: 'Key Capabilities' },
    { key: 'z-xUq8Pu', name: 'Recent Announcements' },
    { key: 'pMHytq8b', name: 'Last Updated' },
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
    `/v4/api/proxy/dashboard-service/v1/dashboards/${masterDashboardId}/views/${masterViewId}`,
    {
      method: 'PUT',
      body: JSON.stringify(viewData),
    }
  );
  console.log('Competitor Master view schema updated with clean ordering.');
}

main().catch(console.error);
