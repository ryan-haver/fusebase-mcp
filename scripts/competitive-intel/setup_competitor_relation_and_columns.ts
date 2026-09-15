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

const changelogDashboardId = '1e4fe893-269c-4687-bfc3-e61f5a0a2b24';
const changelogViewId = 'f15d1d9d-c34e-4a7e-9afe-ea52d30efe56';

async function main() {
  const client = new FusebaseClient({ host, orgId, cookie, autoRefresh: true });

  console.log('--- Step 1: Adding Relation Column (Competitor Master -> Intelligence Changelog) ---');
  try {
    const relRes = await client.addRelationColumn(
      masterDashboardId,
      masterViewId,
      'Changelog History',
      changelogDashboardId,
      changelogViewId,
      { relationType: 'one_to_many' }
    );
    console.log('Added Relation Column:', relRes);
  } catch (e: any) {
    console.log('Relation Column notice:', e.message);
  }

  console.log('\n--- Step 2: Adding Model Strategy Column (Custom Label) ---');
  try {
    const colModel = await client.addDatabaseColumn(masterDashboardId, masterViewId, 'Model Strategy', 'label', {
      labels: [
        { name: 'Proprietary Fine-Tuned SLMs', color: 'purple' },
        { name: 'Frontier LLM Router', color: 'blue' },
        { name: 'Hybrid Local+Cloud', color: 'emerald' },
        { name: 'BYO-LLM', color: 'amber' },
      ],
    });
    console.log('Added Model Strategy:', colModel);
  } catch (e: any) {
    console.log('Model Strategy notice:', e.message);
  }

  console.log('\n--- Step 3: Adding Pricing Metric Column (Custom Label) ---');
  try {
    const colPricing = await client.addDatabaseColumn(masterDashboardId, masterViewId, 'Pricing Metric', 'label', {
      labels: [
        { name: 'Ingested GB/TB', color: 'rose' },
        { name: 'Per-Seat / Analyst', color: 'purple' },
        { name: 'Per-Endpoint', color: 'blue' },
        { name: 'Outcome / Ticket Resolved', color: 'emerald' },
        { name: 'Flat Platform Tier', color: 'cyan' },
      ],
    });
    console.log('Added Pricing Metric:', colPricing);
  } catch (e: any) {
    console.log('Pricing Metric notice:', e.message);
  }

  console.log('\n--- Step 4: Adding Deployment Mode Column (Custom Label Multi-Select) ---');
  try {
    const colDeploy = await client.addDatabaseColumn(masterDashboardId, masterViewId, 'Deployment Mode', 'label', {
      multiSelect: true,
      labels: [
        { name: 'Multi-Tenant SaaS', color: 'cyan' },
        { name: 'Dedicated VPC', color: 'blue' },
        { name: 'Customer Cloud On-Prem', color: 'purple' },
        { name: 'Air-Gapped / Sovereign', color: 'rose' },
      ],
    });
    console.log('Added Deployment Mode:', colDeploy);
  } catch (e: any) {
    console.log('Deployment Mode notice:', e.message);
  }

  console.log('\n--- Step 5: Adding Subtable Columns (Pricing Tiers & Win/Loss Notes) ---');
  try {
    const colTiers = await client.addDatabaseColumn(masterDashboardId, masterViewId, 'Pricing Tiers', 'subtable');
    console.log('Added Pricing Tiers Subtable:', colTiers);
  } catch (e: any) {
    console.log('Pricing Tiers Subtable notice:', e.message);
  }

  try {
    const colWinLoss = await client.addDatabaseColumn(masterDashboardId, masterViewId, 'Win/Loss Notes', 'subtable');
    console.log('Added Win/Loss Notes Subtable:', colWinLoss);
  } catch (e: any) {
    console.log('Win/Loss Notes Subtable notice:', e.message);
  }

  console.log('\n--- Step 6: Verifying Updated Master Schema ---');
  const schema = await client.getViewSchema(masterDashboardId, masterViewId);
  console.log(`Total columns in Competitor Master: ${schema.columns.length}`);
  for (const c of schema.columns.slice(-8)) {
    console.log(`  - [${c.key}] ${c.name} (${c.type}, editType: ${c.editType})`);
  }
}

main().catch(console.error);
