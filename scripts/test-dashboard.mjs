import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const spa = resolve('apps/client-portal-dashboard/apps/status-dashboard');
const requireSpa = createRequire(pathToFileURL(resolve(spa, 'package.json')));
const { createServer, preview } = await import(pathToFileURL(requireSpa.resolve('vite')).href);
const baseData = JSON.parse(readFileSync(resolve(spa, 'src/data/project-status.json'), 'utf8'));
const browser = await chromium.launch({headless: true});
const dev = await createServer({ root: spa, server: { host: '127.0.0.1', port: 0 } });
const captures = resolve('scratch/dashboard-browser'); mkdirSync(captures, { recursive: true });
let checks = 0;
try {
  await dev.listen();
  const address = dev.httpServer.address();
  const url = `http://127.0.0.1:${address.port}`;
  const scenarios = [
    ['current', 'Selected checks passed'], ['working-tree', 'Uncommitted validation'],
    ['stale', 'Stale validation evidence'], ['incomplete', 'Validation incomplete'],
    ['missing', 'No validation evidence'], ['failed', 'Recorded run failed'],
    ['offline-only', 'Selected checks passed'], ['stale-cleanup', 'Stale validation evidence'],
  ];
  for (const [scenario, label] of scenarios) {
    const data = JSON.parse(JSON.stringify(baseData));
    const state = scenario === 'failed' || scenario === 'offline-only' ? 'current' : scenario === 'stale-cleanup' ? 'stale' : scenario;
    data.evidence = {...data.evidence, status: state, complete: state !== 'incomplete', runId: 'browser-fixture', selectedStages: ['Unit tests'], source: {...data.evidence.source, dirty: state === 'working-tree'}};
    data.testSuites = scenario === 'missing' ? [] : [{id:1,name:'Unit tests',kind:'offline',toolsCount:0,assertionsPassed:2,assertionsTotal:2,status:scenario === 'failed'?'failed':'passed',evidenceStatus:state,description:'Synthetic browser evidence fixture'}];
    if (scenario === 'incomplete') data.testSuites.push({id:2,name:'Missing stage',kind:'unknown',toolsCount:0,assertionsPassed:null,assertionsTotal:null,status:'not-run',evidenceStatus:state,description:'Selected stage has no recorded result.'});
    if (scenario === 'stale-cleanup') data.testSuites.push({id:2,name:'Leftover sweep',kind:'live',toolsCount:0,assertionsPassed:null,assertionsTotal:null,status:'passed',evidenceStatus:'stale',description:'Historical cleanup must not verify current resources.'});
    data.summary = {...data.summary, totalSuites:data.testSuites.length,totalAssertions:state === 'current'?2:0,passedAssertions:state === 'current'?2:0,passRatePercent:state === 'current'?100:null};
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/src/data/project-status.json*',route=>route.fulfill({contentType:'text/javascript',body:`export default ${JSON.stringify(data)};`}));
    await page.goto(url); await page.getByTestId('validation-status').waitFor();
    assert((await page.getByTestId('validation-status').innerText()).includes(label), scenario);
    assert.equal(await page.getByTestId('cloud-status').innerText(),'Cloud health: UNVERIFIED');
    assert.equal(await page.getByTestId('assertion-rate').innerText(),state === 'current'?'100%':'N/A');
    assert.equal(await page.getByTestId('overview-assertion-rate').innerText(),state === 'current'?'100%':'N/A');
    if (state !== 'current') assert((await page.getByTestId('overview-assertion-rate').getAttribute('class')).includes('evidence-warning'));
    if (scenario === 'stale-cleanup' || scenario === 'offline-only') assert((await page.locator('body').innerText()).includes('Cleanup not verified'));
    await page.getByRole('button',{name:/Validation Suites/}).click();
    if (scenario === 'incomplete') assert((await page.locator('body').innerText()).includes('Not run'));
    if (scenario === 'failed') assert.equal(await page.locator('.suite-badges .evidence-danger').count(),1);
    await page.screenshot({path:resolve(captures,`${scenario}.png`),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(() => { /* global document, window */ return document.documentElement.scrollWidth <= window.innerWidth; }),`${scenario}: horizontal overflow`);
    assert.deepEqual(errors,[],scenario); checks++; await page.close();
  }
  await dev.close();
  const server = await preview({root:spa,preview:{host:'127.0.0.1',port:0}});
  try {
    const page = await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
    assert(response.ok());await page.getByRole('heading',{name:'FuseBase MCP',exact:true}).waitFor();
    assert.equal(await page.getByTestId('dashboard').getAttribute('data-source-hash'),baseData.evidence.source.sourceHash);
    await page.getByRole('button',{name:/Tools Directory/}).click();
    await page.getByPlaceholder(/Search/).fill('get_page_content');
    assert((await page.locator('body').innerText()).includes('get_page_content'));
    assert.deepEqual(errors,[]);checks++;await page.close();
  } finally { await new Promise(resolveClose=>server.httpServer.close(resolveClose)); }
  console.log(`Dashboard browser checks: ${checks}/${checks} passed (evidence states, failed/incomplete stages, stale cleanup, mobile width, production bundle).`);
} finally { await dev.close(); await browser.close(); }
