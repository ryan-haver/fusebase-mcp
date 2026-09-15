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
  const existingNames = new Set(rows.map((r: any) => r.OtiwIUpQ || r.UmOYNqou || ''));

  const seed = JSON.parse(fs.readFileSync('c:/scripts/comptetitive-intel-dash/app/src/data/seed_competitors.json', 'utf-8'));
  const missing = seed.filter((c: any) => !existingNames.has(c.name));
  console.log('Missing from Competitor Master:', missing.map((m: any) => m.name));

  if (missing.length > 0) {
    const newRows = missing.map((m: any) => ({
      create_new_row: true,
      values: [
        { item_key: 'OtiwIUpQ', value: m.name },
        { item_key: 'ACIiaI_q', value: m.marketSegment || 'AI-Native' },
        { item_key: '-z3T0Mgs', value: m.threatLevel || 'Medium' },
        { item_key: 'vz07PLSM', value: 'Frontier LLM Router' },
        { item_key: 'fnrh-uFt', value: 'Outcome / Ticket Resolved' },
        { item_key: '3AsrcUS5', value: ['Multi-Tenant SaaS'] },
        { item_key: 'RfkVSRYK', value: m.dataArchitecture || 'Orchestration Overlay' },
        { item_key: 'zz6sFE68', value: m.autonomyLevel || 'Supervised / Human-on-the-Loop' },
        { item_key: 'ietUkY6x', value: m.totalFundingRaised || 'Undisclosed' },
        { item_key: '3yxTpJOy', value: m.latestFundingRound || 'Seed' },
        { item_key: 'JCgDQUe8', value: m.valuation || 'Undisclosed' },
        { item_key: 'NdZWpN63', value: (m.notableCustomers || []).join(', ') },
        { item_key: 'J8bc7AS4', value: m.website || '' },
        { item_key: '4AsmOgAq', value: Array.isArray(m.primaryDisplacementTarget) ? m.primaryDisplacementTarget.join(', ') : String(m.primaryDisplacementTarget || '') },
        { item_key: 'F_UmJ_Sg', value: Array.isArray(m.keyDifferentiators) ? m.keyDifferentiators.join('; ') : (m.keyDifferentiators || '') },
        { item_key: 'kK5KcIzi', value: Array.isArray(m.keyCapabilities) ? m.keyCapabilities.join(', ') : (m.keyCapabilities || '') },
        { item_key: 'z-xUq8Pu', value: Array.isArray(m.recentAnnouncements) ? m.recentAnnouncements.join('; ') : (m.recentAnnouncements || '') },
        { item_key: 'pMHytq8b', value: m.lastUpdated || '2026-09-14' },
      ],
    }));

    await client.batchPutDashboardData(masterDashboardId, masterViewId, newRows);
    console.log('Inserted missing competitors!');
  }

  const finalCheck = await client.getDatabaseData(masterDashboardId, masterViewId, { limit: 100 });
  console.log(`Total verified competitors in database: ${finalCheck.data?.length}`);
}

main().catch(console.error);
