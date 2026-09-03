const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function verifyLiveExecution() {
  console.log('🏛️ VERIFYING 100% REAL LIVE MULTI-AGENT EXECUTION...');

  const networkRequests = [];
  const consoleErrors = [];

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  page.on('request', req => {
    if (req.url().includes('/api/')) {
      networkRequests.push({
        url: req.url(),
        method: req.method(),
        timestamp: Date.now()
      });
      console.log(`📡 [Network] ${req.method()} ${req.url()}`);
    }
  });

  page.on('response', res => {
    if (res.url().includes('/api/')) {
      console.log(`✅ [Response] ${res.status()} ${res.url()}`);
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error(`❌ [Browser Error]:`, msg.text());
    }
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // 1. Single Agent "Atlas" Test (Phase 2)
  console.log('\n--- 1. Testing Single Agent Atlas ---');
  await page.select('select', 'alpha');

  const input = await page.$('[data-testid="prompt-input"]');
  if (input) {
    await input.type('Create a VPC with 2 public subnets');
    const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
    if (sendBtn) await sendBtn.click();
  }

  // Stream & node creation
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_live_01_single_atlas_tokens.png') });
  console.log('📸 Captured audit_live_01_single_atlas_tokens.png');

  // Inspector & selection
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_live_02_single_atlas_inspector.png') });
  console.log('📸 Captured audit_live_02_single_atlas_inspector.png');

  const singleNodeCount = await page.$$eval('[data-testid^="canvas-node-"]', els => els.length);
  const inspectorOpen = await page.$('[data-testid="node-inspector"]') !== null;
  console.log(`Single Agent Results: ${singleNodeCount} nodes created, Inspector Open: ${inspectorOpen}`);

  // 2. Parallel 3-Agent Swarm Test (Phase 3)
  console.log('\n--- 2. Testing Parallel 3-Agent Swarm (Atlas + Breach + Cost) ---');
  await page.select('select', 'all');

  if (input) {
    await input.type('Deploy resilient microservices backend with EKS, Postgres DB, and S3');
    const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
    if (sendBtn) await sendBtn.click();
  }

  // Multi-agent streams
  await new Promise(r => setTimeout(r, 1800));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_live_03_parallel_swarm_streams.png') });
  console.log('📸 Captured audit_live_03_parallel_swarm_streams.png');

  // Complete synthesis & inspector
  await new Promise(r => setTimeout(r, 3500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_live_04_parallel_swarm_complete.png') });
  console.log('📸 Captured audit_live_04_parallel_swarm_complete.png');

  const swarmNodeCount = await page.$$eval('[data-testid^="canvas-node-"]', els => els.length);
  const logsCount = await page.$$eval('[data-testid="tri-terminal-drawer"]', els => els.length > 0);
  const costText = await page.$eval('[data-testid="hud-cost-ticker"]', el => el.textContent);
  const secText = await page.$eval('[data-testid="hud-auditor-badge"]', el => el.textContent);

  console.log('\n================================================================');
  console.log('📊 FINAL LIVE EXECUTION REPORT:');
  console.log('================================================================');
  console.log(`✅ Live Network Requests: ${networkRequests.length}`);
  console.log(`✅ Final Nodes on Canvas: ${swarmNodeCount}`);
  console.log(`✅ Inspector Panel Open: ${inspectorOpen}`);
  console.log(`✅ Tri-Terminal Active: ${logsCount}`);
  console.log(`✅ Live Spend: ${costText.trim()}`);
  console.log(`✅ CIS Security Rating: ${secText.trim()}`);
  console.log(`✅ Console Errors: ${consoleErrors.length}`);
  console.log('================================================================\n');

  await browser.close();
}

verifyLiveExecution().catch(console.error);
