import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

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

  const client = new Client({ name: 'embedder', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);

  console.log('Listing workspaces...');
  const workspaces = await callTool(client, 'list_workspaces');
  console.log('Workspaces:', JSON.stringify(workspaces, null, 2));

  const workspaceList = Array.isArray(workspaces) ? workspaces : (workspaces?.workspaces || []);
  if (workspaceList.length === 0) {
    throw new Error('No workspaces found');
  }

  const targetWorkspace = workspaceList.find((w: any) => w.title === 'Inkabeam') || workspaceList[0];
  const workspaceId = targetWorkspace.workspaceId || targetWorkspace.id || targetWorkspace.globalId;
  console.log(`Using Workspace: "${targetWorkspace.title}" (${workspaceId})`);

  console.log('Calling create_interactive_app_page...');
  const embedRes = await callTool(client, 'create_interactive_app_page', {
    workspaceId,
    title: 'Executive Competitive Intelligence Dashboard',
    appUrl: 'https://competitive-intel.thefusebase.app/',
    description: `## CyberSec Competitive Intelligence Hub
Real-time tracking of **AI-Native**, **AI-Adjacent**, and **Legacy** cybersecurity platforms.
- **Hosted App**: https://competitive-intel.thefusebase.app/
- **Connected Database**: [Competitive Intelligence Platform](https://inkabeam.nimbusweb.me/dashboard/u268r1/tables/databases/85e2a515-c382-45bc-bdf4-1db942b5db9a/dashboard/99ed2b9b-102c-45bd-9dfc-51cb184e22cf)
- **Automated Research**: Firecrawl + LLM autonomous update pipeline active.`
  });

  console.log('Interactive page created:', JSON.stringify(embedRes, null, 2));
  await transport.close();
}

main().catch(err => {
  console.error('Embedding failed:', err);
  process.exit(1);
});
