import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const DASH_DIR = 'C:\\scripts\\comptetitive-intel-dash';

async function callTool(client: Client, name: string, args: Record<string, any> = {}): Promise<any> {
  console.log(`Calling tool: ${name}...`);
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
  console.log('Connecting to FuseBase MCP server...');
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(rootDir, 'dist', 'index.js')],
    env: {
      ...process.env,
      FUSEBASE_TOOLS: 'all',
    },
  });

  const client = new Client(
    { name: 'competitive-intel-provisioner', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log('Connected successfully to FuseBase MCP!\n');

  // Step 1: Create Database
  console.log('Step 1: Creating "Competitive Intelligence Platform" database...');
  const createDbRes = await callTool(client, 'create_database', {
    title: 'Competitive Intelligence Platform',
    description: 'Enterprise Competitive Intelligence Tracker: AI-Native, AI-Adjacent, and Legacy Security Platforms',
    icon: 'shield',
    color: 'blue',
    isPublic: false
  });

  console.log('create_database response:', JSON.stringify(createDbRes, null, 2));
  const databaseId = createDbRes.databaseId || createDbRes.global_id || createDbRes.id;
  const compDashboardId = createDbRes.dashboardId || createDbRes.dashboards?.[0]?.global_id || createDbRes.dashboards?.[0]?.id;
  const compViewId = createDbRes.viewId || createDbRes.dashboards?.[0]?.views?.[0]?.global_id || createDbRes.dashboards?.[0]?.views?.[0]?.id;

  if (!databaseId || !compDashboardId || !compViewId) {
    throw new Error(`Failed to resolve database, dashboard, or view IDs: ${JSON.stringify(createDbRes)}`);
  }

  console.log(`Database created: ${databaseId}`);
  console.log(`Primary Dashboard (Competitor Master): ${compDashboardId}`);
  console.log(`Primary View: ${compViewId}\n`);

  // Step 2: Import Competitors Master CSV
  console.log('Step 2: Ingesting 41 Competitors via import_csv...');
  const compCsvContent = fs.readFileSync(path.join(DASH_DIR, 'data', 'competitors_master.csv'), 'utf8');
  const compImportRes = await callTool(client, 'import_csv', {
    csvContent: compCsvContent,
    databaseId,
    dashboardId: compDashboardId,
    viewId: compViewId,
    delimiter: ','
  });
  console.log('Competitors CSV imported successfully:', JSON.stringify(compImportRes, null, 2).slice(0, 300));

  // Step 3: Create Secondary Table for Changelogs
  console.log('\nStep 3: Creating secondary table "Intelligence Changelog"...');
  let changelogDashboardId: string | undefined;
  let changelogViewId: string | undefined;
  try {
    const createTableRes = await callTool(client, 'create_dashboard_table', {
      databaseId,
      title: 'Intelligence Changelog'
    });
    console.log('create_dashboard_table response:', JSON.stringify(createTableRes, null, 2));
    changelogDashboardId = createTableRes.dashboardId || createTableRes.dashboard?.global_id || createTableRes.dashboard?.id || createTableRes.id;
    changelogViewId = createTableRes.viewId || createTableRes.dashboard?.views?.[0]?.global_id || createTableRes.views?.[0]?.id;
  } catch (err: any) {
    console.warn('create_dashboard_table notice:', err.message);
  }

  // Step 4: Import Changelogs CSV if secondary view exists
  if (changelogDashboardId && changelogViewId) {
    console.log(`\nStep 4: Ingesting 164 Changelog Events into table ${changelogDashboardId}...`);
    const changelogCsvContent = fs.readFileSync(path.join(DASH_DIR, 'data', 'changelogs_master.csv'), 'utf8');
    const changelogImportRes = await callTool(client, 'import_csv', {
      csvContent: changelogCsvContent,
      databaseId,
      dashboardId: changelogDashboardId,
      viewId: changelogViewId,
      delimiter: ','
    });
    console.log('Changelog CSV imported successfully:', JSON.stringify(changelogImportRes, null, 2).slice(0, 300));
  }

  // Save configuration
  const config = {
    databaseId,
    competitorTable: {
      dashboardId: compDashboardId,
      viewId: compViewId,
      name: 'Competitor Master',
      rowCount: 41
    },
    changelogTable: changelogDashboardId ? {
      dashboardId: changelogDashboardId,
      viewId: changelogViewId,
      name: 'Intelligence Changelog',
      rowCount: 164
    } : null,
    provisionedAt: new Date().toISOString()
  };

  const configPath = path.join(DASH_DIR, 'data', 'fusebase_db_config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log(`\nSaved database configuration to ${configPath}!`);

  await transport.close();
  console.log('Provisioning completed successfully!');
}

main().catch(err => {
  console.error('Fatal error during database provisioning:', err);
  process.exit(1);
});
