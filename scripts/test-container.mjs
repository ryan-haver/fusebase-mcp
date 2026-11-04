import { readFileSync } from "node:fs";
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const image = process.argv[2] || 'fusebase-mcp:ci';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 120000 }).trim();
const token = randomBytes(24).toString('hex');
const id = docker('run', '-d', '--rm', '-p', '127.0.0.1::3000', '-e', 'MCP_TRANSPORT=http', '-e', 'MCP_HOST=0.0.0.0', '-e', `MCP_AUTH_TOKEN=${token}`, '-e', 'FUSEBASE_NO_DOTENV=1', image);
try {
  const port = docker('port', id, '3000/tcp').split(':').at(-1);
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { if ((await fetch(base + '/health', { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* container starting */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert(ready, 'Container health did not become ready');
  const request = (body, session) => fetch(base + '/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(session ? { 'mcp-session-id': session } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  const init = await request({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'container-smoke',version:'1'}}});
  assert(init.ok); const session = init.headers.get('mcp-session-id'); assert(session);
  await init.text();
  assert((await request({jsonrpc:'2.0',method:'notifications/initialized'}, session)).ok);
  const listing = await request({jsonrpc:'2.0',id:2,method:'tools/list',params:{}}, session);
  assert(listing.ok); assert((await listing.text()).includes('get_page_content'));
  assert.equal((await fetch(base + '/mcp', {method:'POST'})).status, 401);
  console.log('Container health, authenticated MCP initialize/tools/list, and unauthenticated rejection passed. No account credentials or remote mutations.');
} finally { docker('stop', '-t', '3', id); }

const probe = readFileSync(new URL('./container-readonly-probe.mjs', import.meta.url),'utf8');
console.log(docker('run','--rm','--read-only','--tmpfs','/runtime:rw,uid=1000,gid=1000','-e','FUSEBASE_DATA_DIR=/runtime','-e','FUSEBASE_NO_DOTENV=1','--entrypoint','node',image,'--input-type=module','-e',probe));
