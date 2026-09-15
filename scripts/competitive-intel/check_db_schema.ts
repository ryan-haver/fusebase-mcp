import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(rootDir, 'dist', 'index.js')],
    env: { ...process.env, FUSEBASE_TOOLS: 'all' },
  });

  const client = new Client({ name: 'schema-checker', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);

  const dashboardId = '99ed2b9b-102c-45bd-9dfc-51cb184e22cf';
  const viewId = '9847de9d-fc51-4bb1-8806-24ecd84f6313';

  const schema = await client.callTool({
    name: 'get_database_schema',
    arguments: { dashboardId, viewId }
  });

  console.log('Schema:', JSON.stringify(schema, null, 2));
  await transport.close();
}

main();
