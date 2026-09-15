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

const dashboardId = '99ed2b9b-102c-45bd-9dfc-51cb184e22cf';
const viewId = '9847de9d-fc51-4bb1-8806-24ecd84f6313';

async function main() {
  const client = new FusebaseClient({ host, orgId, cookie, autoRefresh: true });

  console.log('--- Step 1: Deleting remaining empty placeholder rows ---');
  const emptyRowsToDelete = [
    'b028f3c6-3db0-4dd5-89b8-8cf55627c860',
    '629fb149-96fa-434c-8a91-b9925c8bc0cc',
  ];
  for (const rId of emptyRowsToDelete) {
    try {
      const del = await client.deleteRow(dashboardId, rId);
      console.log(`Deleted placeholder row ${rId}:`, del.success);
    } catch (e: any) {
      console.log(`Could not delete row ${rId}:`, e.message);
    }
  }

  console.log('\n--- Step 2: Fetching all competitor rows ---');
  const dbData = await client.getDatabaseData(dashboardId, viewId, { limit: 100 });
  const rows = dbData.data || [];
  console.log(`Found ${rows.length} rows in database.`);

  console.log('\n--- Step 3: Setting primary Name column (OtiwIUpQ) for all competitors ---');
  let updatedCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowUuid = row.root_index_value;
    const name = row.UmOYNqou || row.OtiwIUpQ;
    if (!name) {
      console.log(`Skipping empty row: ${rowUuid}`);
      continue;
    }

    if (row.OtiwIUpQ !== name) {
      process.stdout.write(`[${i + 1}/${rows.length}] ${name}... `);
      await client.updateDatabaseCell(dashboardId, viewId, rowUuid, 'OtiwIUpQ', name);
      process.stdout.write('✓\n');
      updatedCount++;
    } else {
      console.log(`[${i + 1}/${rows.length}] ${name} already set.`);
    }
  }
  console.log(`Updated ${updatedCount} rows with primary Name.`);

  console.log('\n--- Step 4: Reordering and configuring visible view columns ---');
  const viewRes = await (client as any).request(
    `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`
  );
  const viewData = viewRes.data;
  const currentItems = viewData.schema?.items || [];

  // Map of column keys to desired display name and order
  const displayConfig: Array<{ key: string; name: string }> = [
    { key: 'OtiwIUpQ', name: 'Company Name' },
    { key: 'ACIiaI_q', name: 'Market Segment' },
    { key: '-z3T0Mgs', name: 'Threat Level' },
    { key: 'RfkVSRYK', name: 'Data Architecture' },
    { key: 'zz6sFE68', name: 'Autonomy Level' },
    { key: 'ietUkY6x', name: 'Total Funding' },
    { key: '3yxTpJOy', name: 'Latest Round' },
    { key: 'JCgDQUe8', name: 'Valuation' },
    { key: 'NdZWpN63', name: 'Notable Customers' },
    { key: 'J8bc7AS4', name: 'Website' },
    { key: '4AsmOgAq', name: 'Displacement Target' },
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
  // 1. Add ordered visible columns with friendly display names
  for (const cfg of displayConfig) {
    const item = itemMap.get(cfg.key);
    if (item) {
      newItems.push({
        ...item,
        name: cfg.name,
        hidden: false,
      });
      itemMap.delete(cfg.key);
    }
  }

  // 2. Add all remaining columns marked as hidden
  for (const item of itemMap.values()) {
    newItems.push({
      ...item,
      hidden: true,
    });
  }

  viewData.schema.items = newItems;

  const updateViewRes = await (client as any).request(
    `/v4/api/proxy/dashboard-service/v1/dashboards/${dashboardId}/views/${viewId}`,
    {
      method: 'PUT',
      body: JSON.stringify(viewData),
    }
  );
  console.log('Update view schema result:', updateViewRes.success ? 'Success' : updateViewRes);

  console.log('\n--- Step 5: Final verification ---');
  const finalRows = await client.getDatabaseData(dashboardId, viewId, { limit: 100 });
  console.log(`Total rows in database: ${finalRows.data?.length}`);
  for (let i = 0; i < Math.min(5, finalRows.data?.length || 0); i++) {
    const r = finalRows.data[i];
    console.log(`  ${i + 1}. [${r.OtiwIUpQ}] Segment: ${r.ACIiaI_q} | Threat: ${r['-z3T0Mgs']} | Funding: ${r.ietUkY6x} | Customers: ${r.NdZWpN63}`);
  }
}

main().catch(console.error);
