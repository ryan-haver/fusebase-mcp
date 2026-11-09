import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const root = resolve(import.meta.dirname, '..');
const artifactRoot = resolve(process.env.FUSEBASE_TEST_ARTIFACT_DIR || join(root, 'scratch'));
mkdirSync(artifactRoot, { recursive: true });
const fixture = mkdtempSync(join(artifactRoot, 'package-smoke-'));
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this check using npm run test:package');
const runNpm = (args, cwd = root) => execFileSync(process.execPath, [npm, ...args], { cwd, encoding: 'utf8', windowsHide: true, timeout: 180000 });
const packed = JSON.parse(runNpm(['pack', '--ignore-scripts', '--json', '--pack-destination', fixture]))[0];
assert(packed.files.every(file => !/(^|\/)(scratch|data|\.env|node_modules)(\/|$)/.test(file.path)), 'Private files must not be packed');
for (const stale of ['dist/token-builder.js', 'dist/yjs-writer.js']) assert(!packed.files.some(file => file.path === stale));
const installed = join(fixture, 'consumer'); mkdirSync(installed);
writeFileSync(join(installed, 'package.json'), JSON.stringify({name:'fusebase-package-consumer',private:true}));
runNpm(['install', '--omit=dev', '--no-audit', '--no-fund', join(fixture, packed.filename)], installed);
const pkg = join(installed, 'node_modules', 'fusebase-mcp');
const env = { ...process.env, FUSEBASE_NO_DOTENV: '1', FUSEBASE_DATA_DIR: join(fixture, 'runtime'), FUSEBASE_PROFILE: '', MCP_TRANSPORT: 'stdio' };
for (const key of Object.keys(env)) if (/TOKEN|COOKIE|SECRET|PASSWORD|FUSEBASE_OP_/.test(key)) delete env[key];
const transport = new StdioClientTransport({ command: process.execPath, args: [join(pkg, 'dist/index.js')], cwd: installed, env, stderr: 'pipe' });
const client = new Client({ name: 'package-smoke', version: '1' });
try {
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 34);
  await client.callTool({ name: 'set_tool_tier', arguments: { tier: 'all' } });
  assert.equal((await client.listTools()).tools.length, 177);
} finally { await client.close(); }
for (const helper of ['auth.js', 'scrape-guides.js']) {
  const output = execFileSync(process.execPath, [join(pkg, 'dist', helper), '--help'], { cwd: installed, env, encoding: 'utf8', timeout: 10000, windowsHide: true });
  assert(output.includes('fusebase-'));
}
const auth = await import(pathToFileURL(join(pkg, 'dist/auth.js')).href);
assert.equal(typeof auth.refreshCookies, 'function');
const { startHttpServer } = await import(pathToFileURL(join(pkg, 'dist/http-server.js')).href);
const { createFusebaseServer } = await import(pathToFileURL(join(pkg, 'dist/server.js')).href);
const handle = await startHttpServer({ host: '127.0.0.1', port: 0, allowedHosts: ['127.0.0.1'], allowedOrigins: [], maxSessions: 2 }, () => createFusebaseServer({ buildClient: () => { throw new Error('No account access in package smoke'); } }).server, { version: JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).version });
try {
  assert.equal((await fetch(`http://127.0.0.1:${handle.port}/health`)).status, 200);
  const remote = new Client({name:'packed-http',version:'1'});
  try {
    await remote.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${handle.port}/mcp`)));
    assert.equal((await remote.listTools()).tools.length, 34);
  } finally { await remote.close(); }
}
finally { await handle.close(); }
console.log('Packed production install, stdio tool listing/tier switch, HTTP health and runtime helper checks passed.');
