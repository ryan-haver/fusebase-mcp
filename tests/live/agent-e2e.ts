import { assert, connectMcp, requireSandboxWorkspace, runSuite } from './lib/harness.js';
import { verifyExecutableAgent } from './lib/agent-fixture.js';

runSuite('AI agent execution and web extraction', async () => {
  assert(process.argv.includes('--execute'), 'pass --execute to permit isolated agent execution');
  const client = await connectMcp('agent-validation');
  try { await verifyExecutableAgent(client, requireSandboxWorkspace()); }
  finally { await client.close(); }
});
