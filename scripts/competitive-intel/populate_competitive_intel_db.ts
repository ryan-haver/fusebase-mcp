import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const DASH_DIR = 'C:\\scripts\\comptetitive-intel-dash';

async function callTool(client: Client, name: string, args: Record<string, any> = {}): Promise<any> {
  const res = await client.callTool({ name, arguments: args });
  if (res.isError) {
    const errText = (res.content as any)?.[0]?.text || 'Unknown error';
    throw new Error(`Tool '${name}' failed: ${errText}`);
  }
  const text = (res.content as any)?.[0]?.text;
  if (typeof text !== 'string') return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(rootDir, 'dist', 'index.js')],
    env: { ...process.env, FUSEBASE_TOOLS: 'all' },
  });

  const client = new Client({ name: 'competitive-intel-populator', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  console.log('Connected to FuseBase MCP!\n');

  const databaseId = '85e2a515-c382-45bc-bdf4-1db942b5db9a';
  const dashboardId = '99ed2b9b-102c-45bd-9dfc-51cb184e22cf';
  const viewId = '9847de9d-fc51-4bb1-8806-24ecd84f6313';

  // 1. Rename table to "Competitor Master"
  try {
    await callTool(client, 'update_view', {
      dashboardId,
      viewId,
      name: 'Competitor Master View'
    });
    console.log('Renamed default view to "Competitor Master View"');
  } catch (e: any) {
    console.log('update_view note:', e.message);
  }

  // 2. Add columns
  const columnsToAdd = [
    { name: 'Market Segment', type: 'string' },
    { name: 'Data Architecture', type: 'string' },
    { name: 'Autonomy Level', type: 'string' },
    { name: 'Total Funding', type: 'string' },
    { name: 'Valuation', type: 'string' },
    { name: 'Latest Round', type: 'string' },
    { name: 'Notable Customers', type: 'string' },
    { name: 'Website', type: 'string' },
    { name: 'Threat Level', type: 'string' },
    { name: 'Displacement Target', type: 'string' }
  ];

  console.log('Adding custom columns...');
  for (const col of columnsToAdd) {
    try {
      const colRes = await callTool(client, 'add_database_column', {
        dashboardId,
        viewId,
        name: col.name,
        columnType: col.type
      });
      console.log(`Added column: ${col.name}`);
    } catch (e: any) {
      console.log(`Column ${col.name} note:`, e.message);
    }
  }

  // Fetch updated schema to map column names to keys
  const schemaRes = await callTool(client, 'get_database_schema', { dashboardId, viewId });
  const schemaList = Array.isArray(schemaRes) ? schemaRes : (schemaRes.schema || []);
  const colMap = new Map<string, string>();
  for (const col of schemaList) {
    colMap.set(col.name, col.key);
  }
  console.log('\nColumn Schema Mapping:');
  for (const [name, key] of colMap.entries()) {
    console.log(`- "${name}": ${key}`);
  }

  // Read seed competitors
  const competitors = JSON.parse(fs.readFileSync(path.join(DASH_DIR, 'data', 'seed_competitors.json'), 'utf8'));
  console.log(`\nPopulating ${competitors.length} competitors...`);

  const nameKey = colMap.get('Name') || 'OtiwIUpQ';
  const descKey = colMap.get('Description') || 'ilAot3Uk';
  const segKey = colMap.get('Market Segment');
  const archKey = colMap.get('Data Architecture');
  const autoKey = colMap.get('Autonomy Level');
  const fundKey = colMap.get('Total Funding');
  const valKey = colMap.get('Valuation');
  const roundKey = colMap.get('Latest Round');
  const custKey = colMap.get('Notable Customers');
  const webKey = colMap.get('Website');
  const threatKey = colMap.get('Threat Level');
  const dispKey = colMap.get('Displacement Target');

  // Add rows
  for (let i = 0; i < competitors.length; i++) {
    const comp = competitors[i];
    try {
      const addRowRes = await callTool(client, 'add_database_row', {
        databaseId,
        dashboardId,
        entity: 'custom'
      });
      const rowUuid = addRowRes?.data?.row?.global_id || addRowRes?.row?.global_id || addRowRes?.data?.global_id || addRowRes?.global_id;
      
      if (rowUuid) {
        // Set Name
        if (nameKey) await callTool(client, 'update_database_cell', { dashboardId, viewId, rowUuid, columnKey: nameKey, value: comp.name });
        // Set Segment
        if (segKey) await callTool(client, 'update_database_cell', { dashboardId, viewId, rowUuid, columnKey: segKey, value: comp.marketSegment });
        // Set Arch
        if (archKey) await callTool(client, 'update_database_cell', { dashboardId, viewId, rowUuid, columnKey: archKey, value: comp.dataArchitecture });
        // Set Autonomy
        if (autoKey) await callTool(client, 'update_database_cell', { dashboardId, viewId, rowUuid, columnKey: autoKey, value: comp.autonomyLevel });
        // Set Funding
        if (fundKey) await callTool(client, 'update_database_cell', { dashboardId, viewId, rowUuid, columnKey: fundKey, value: comp.totalFundingRaised });
        // Set Valuation
        if (valKey) await callTool(client, 'update_database_cell', { dashboardId, viewId, rowUuid, columnKey: valKey, value: comp.valuation });
        // Set Round
        if (roundKey) await callTool(client, 'update_database_cell', { dashboardId, viewId, rowUuid, columnKey: roundKey, value: comp.latestFundingRound });
        // Set Customers
        if (custKey && comp.notableCustomers?.length) await callTool(client, 'update_database_cell', { dashboardId, viewId, rowUuid, columnKey: custKey, value: comp.notableCustomers.join(', ') });
        // Set Website
        if (webKey && comp.website) await callTool(client, 'update_database_cell', { dashboardId, viewId, rowUuid, columnKey: webKey, value: comp.website });
        // Set Threat
        if (threatKey && comp.threatLevel) await callTool(client, 'update_database_cell', { dashboardId, viewId, rowUuid, columnKey: threatKey, value: comp.threatLevel });
        // Set Displacement Target
        if (dispKey && comp.primaryDisplacementTarget?.length) await callTool(client, 'update_database_cell', { dashboardId, viewId, rowUuid, columnKey: dispKey, value: comp.primaryDisplacementTarget.join(', ') });
        
        console.log(`[${i + 1}/${competitors.length}] Inserted: ${comp.name} (${comp.marketSegment})`);
      } else {
        console.warn(`[${i + 1}/${competitors.length}] Row created without rowUuid:`, addRowRes);
      }
    } catch (err: any) {
      console.error(`Error inserting ${comp.name}:`, err.message);
    }
  }

  // Create Secondary Table for Changelogs
  console.log('\nCreating secondary table for Intelligence Changelogs...');
  let changelogDashId = '';
  let changelogViewId = '';
  try {
    const tableRes = await callTool(client, 'create_dashboard_table', {
      databaseId,
      title: 'Intelligence Changelog'
    });
    changelogDashId = tableRes?.dashboardId || tableRes?.id || '';
    changelogViewId = tableRes?.viewId || '';
    console.log(`Changelog Table Created: Dashboard=${changelogDashId}, View=${changelogViewId}`);
  } catch (e: any) {
    console.log('Changelog table notice:', e.message);
  }

  // Save config
  const dbConfig = {
    databaseId,
    databaseTitle: 'Competitive Intelligence Platform',
    competitorTable: {
      dashboardId,
      viewId,
      name: 'Competitor Master',
      columns: Object.fromEntries(colMap.entries())
    },
    changelogTable: {
      dashboardId: changelogDashId,
      viewId: changelogViewId,
      name: 'Intelligence Changelog'
    },
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(path.join(DASH_DIR, 'data', 'fusebase_db_config.json'), JSON.stringify(dbConfig, null, 2), 'utf8');
  console.log('\nSaved configuration to data/fusebase_db_config.json');

  await transport.close();
  console.log('Phase 2 Database Provisioning Complete!');
}

main().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
