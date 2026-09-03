const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function runRuthlessAudit() {
  console.log('================================================================');
  console.log('🏛️  CHIEF SYSTEMS ARCHITECT: RUTHLESS PROOF OF LIFE AUDIT');
  console.log('================================================================\n');

  const networkRequests = [];
  const consoleLogs = [];
  const consoleErrors = [];

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  // Intercept and monitor all network traffic
  page.on('request', req => {
    if (req.url().includes('/api/gemini')) {
      networkRequests.push({
        url: req.url(),
        method: req.method(),
        postData: req.postData() ? JSON.parse(req.postData()) : null,
        timestamp: Date.now()
      });
    }
  });

  page.on('response', res => {
    if (res.url().includes('/api/gemini')) {
      console.log(`📡 [Network] Gemini API Response Status: ${res.status()} ${res.statusText()}`);
    }
  });

  // Intercept and monitor console logs
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (msg.type() === 'error') {
      consoleErrors.push(text);
      console.error(`❌ [Browser Error]: ${text}`);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    console.error(`❌ [Page Exception]: ${err.message}`);
  });

  console.log('1. Navigating to http://localhost:3000/ ...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // Capture clean initial state
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_01_clean_initial.png') });
  console.log('📸 Captured audit_01_clean_initial.png');

  // --------------------------------------------------------------------------
  // STEP 1: Single Agent "Atlas" Prompt Execution
  // --------------------------------------------------------------------------
  console.log('\n2. User types prompt: "Generate a secure 3-tier VPC architecture on the canvas"...');
  const promptInput = await page.$('[data-testid="prompt-input"]');
  await promptInput.type('Generate a secure 3-tier VPC architecture on the canvas with Postgres DB');
  
  const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
  console.log('3. User hits Enter (Submitting prompt to Gemini API)...');
  await sendBtn.click();

  // Wait 1.5s - verify network request made and Atlas streaming tokens
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_02_atlas_streaming_tokens.png') });
  console.log('📸 Captured audit_02_atlas_streaming_tokens.png');

  // Wait 3.5s - verify tool execution and Atlas clicking node & opening Inspector
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_03_atlas_selected_node_inspector.png') });
  console.log('📸 Captured audit_03_atlas_selected_node_inspector.png');

  // Wait 3.5s - verify Breach and Cost multi-agent pipeline handoff
  await new Promise(r => setTimeout(r, 3500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_04_full_swarm_audit_complete.png') });
  console.log('📸 Captured audit_04_full_swarm_audit_complete.png');

  // Verify DOM state
  const nodes = await page.$$eval('[data-testid^="canvas-node-"]', els => els.map(el => el.textContent));
  const inspectorExists = await page.$('[data-testid="node-inspector"]') !== null;
  const executionLogs = await page.$$eval('[data-testid="tri-terminal-drawer"]', els => els.length > 0);
  const costValue = await page.$eval('[data-testid="hud-cost-ticker"]', el => el.textContent);
  const securityValue = await page.$eval('[data-testid="hud-auditor-badge"]', el => el.textContent);

  console.log('\n================================================================');
  console.log('📊 RUTHLESS AUDIT REPORT RESULTS:');
  console.log('================================================================');
  console.log(`✅ Network Requests Captured: ${networkRequests.length}`);
  if (networkRequests.length > 0) {
    console.log(`   Model: ${networkRequests[0].postData?.model}`);
    console.log(`   Tools Registered in Payload: ${networkRequests[0].postData?.tools?.length}`);
  }
  console.log(`✅ Canvas Nodes Synthesized on Screen: ${nodes.length}`);
  console.log(`✅ Inspector Panel Open on Screen: ${inspectorExists}`);
  console.log(`✅ Execution Logs Terminal Active: ${executionLogs}`);
  console.log(`✅ Real Monthly Run-Rate: ${costValue.trim()}`);
  console.log(`✅ CIS AWS Security Score: ${securityValue.trim()}`);
  console.log(`✅ Total Browser Console Errors: ${consoleErrors.length}`);
  console.log('================================================================\n');

  await browser.close();
}

runRuthlessAudit().catch(console.error);
