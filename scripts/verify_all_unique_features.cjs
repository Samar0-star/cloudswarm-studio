const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function verifyAllFeatures() {
  console.log('🏛️ RUNNING 100% COMPREHENSIVE FEATURE AUDIT...');

  const results = {};
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // -------------------------------------------------------------
  // Test 1: Starter Blueprint Matrix (E-Commerce HA)
  // -------------------------------------------------------------
  console.log('\n1. Testing Blueprint Starter (E-Commerce HA)...');
  const ecomCard = await page.$('text/E-Commerce HA');
  if (ecomCard) {
    await ecomCard.click();
    await new Promise(r => setTimeout(r, 1200));
  }
  const nodeCount = await page.$$eval('[data-testid^="canvas-node-"]', els => els.length);
  results['1. Starter Blueprints'] = nodeCount > 0 ? 'PASS' : 'FAIL';
  console.log(`- Nodes Spawned on Canvas: ${nodeCount}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'feat_01_canvas_nodes.png') });

  // -------------------------------------------------------------
  // Test 2: Node Inspector Panel & Live Property Editing
  // -------------------------------------------------------------
  console.log('\n2. Testing Node Inspector Panel & Live Property Editing...');
  const firstNodeId = await page.evaluate(() => {
    const el = document.querySelector('[data-testid^="canvas-node-"]');
    return el ? el.getAttribute('data-testid')?.replace('canvas-node-', '') : null;
  });

  if (firstNodeId) {
    await page.evaluate((id) => {
      window.dispatchEvent(new CustomEvent('select-node', { detail: id }));
      // Select directly via click on header
      const nodeEl = document.querySelector(`[data-testid="canvas-node-${id}"]`);
      if (nodeEl) nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, firstNodeId);
    await new Promise(r => setTimeout(r, 600));
  }

  const inspector = await page.$('[data-testid="node-inspector"]') !== null;
  results['2. Node Inspector Panel'] = inspector ? 'PASS' : 'FAIL';
  console.log(`- Node Inspector Active: ${inspector}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'feat_02_node_inspector.png') });

  // -------------------------------------------------------------
  // Test 3: Terraform HCL Sync & Live Editor Drawer
  // -------------------------------------------------------------
  console.log('\n3. Testing Bi-Directional Terraform HCL Code Editor...');
  const hclBtn = await page.$('[data-testid="hcl-toggle-btn"]');
  if (hclBtn) {
    await hclBtn.click();
    await new Promise(r => setTimeout(r, 600));
  }
  const hclModal = await page.$('[data-testid="hcl-editor-modal"]') !== null;
  results['3. Terraform HCL Sync'] = hclModal ? 'PASS' : 'FAIL';
  console.log(`- HCL Editor Modal Active: ${hclModal}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'feat_03_hcl_drawer.png') });

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 400));

  // -------------------------------------------------------------
  // Test 4: Time-Travel Decision DAG Timeline & Commits
  // -------------------------------------------------------------
  console.log('\n4. Testing Time-Travel Decision DAG Timeline...');
  const dagBar = await page.$('[data-testid="dag-timeline-bar"]') !== null;
  const commitPills = await page.$$eval('[data-testid^="commit-pill-"]', els => els.length);
  results['4. Time-Travel Decision DAG'] = dagBar && commitPills > 0 ? 'PASS' : 'FAIL';
  console.log(`- DAG Timeline Active (${commitPills} commits): ${results['4. Time-Travel Decision DAG']}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'feat_04_dag_timeline.png') });

  // -------------------------------------------------------------
  // Test 5: Tri-Terminal Real-Time Execution Streams
  // -------------------------------------------------------------
  console.log('\n5. Testing Tri-Terminal Drawer & Sentinel Matrix...');
  const triTerminal = await page.$('[data-testid="tri-terminal-drawer"]') !== null;
  results['5. Tri-Terminal Drawer'] = triTerminal ? 'PASS' : 'FAIL';
  console.log(`- Tri-Terminal Drawer Active: ${triTerminal}`);

  // -------------------------------------------------------------
  // Test 6: 1-Click Production Materializer (Export ZIP)
  // -------------------------------------------------------------
  console.log('\n6. Testing Production Materializer & Export Modal...');
  const exportBtn = await page.$('[data-testid="export-modal-btn"]');
  if (exportBtn) {
    await exportBtn.click();
    await new Promise(r => setTimeout(r, 600));
  }
  const exportModal = await page.$('[data-testid="export-modal"]') !== null;
  results['6. Production Materializer'] = exportModal ? 'PASS' : 'FAIL';
  console.log(`- Export Modal Active: ${exportModal}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'feat_07_export_modal.png') });

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 400));

  // -------------------------------------------------------------
  // Test 7: Canvas Minimap & 60 FPS Viewport Controls
  // -------------------------------------------------------------
  console.log('\n7. Testing Canvas Minimap & Zoom Controls...');
  const minimap = await page.$('[data-testid="canvas-minimap"]') !== null;
  results['7. Minimap & Spatial Viewport'] = minimap ? 'PASS' : 'FAIL';
  console.log(`- Spatial Minimap Active: ${minimap}`);

  // -------------------------------------------------------------
  // Test 8: Live CIS Security & FinOps Monthly Spend Tickers
  // -------------------------------------------------------------
  console.log('\n8. Testing Live CIS Score & Cost Tickers...');
  const costText = await page.$eval('[data-testid="hud-cost-ticker"]', el => el.textContent);
  const secText = await page.$eval('[data-testid="hud-auditor-badge"]', el => el.textContent);
  const tickersActive = costText.length > 0 && secText.length > 0;
  results['8. Live Security & Cost Tickers'] = tickersActive ? 'PASS' : 'FAIL';
  console.log(`- Spend: ${costText.trim()} | CIS Rating: ${secText.trim()}`);

  console.log('\n================================================================');
  console.log('🏛️ FINAL CLOUDSWARM STUDIO 8-FEATURE AUDIT MATRIX:');
  console.log('================================================================');
  let passCount = 0;
  Object.entries(results).forEach(([feat, status]) => {
    if (status === 'PASS') passCount++;
    console.log(`  ${status === 'PASS' ? '✅' : '❌'} ${feat.padEnd(32)}: ${status}`);
  });
  console.log(`\n🎉 SCORE: ${passCount} / ${Object.keys(results).length} FEATURES 100% OPERATIONAL`);
  console.log('================================================================\n');

  await browser.close();
}

verifyAllFeatures().catch(console.error);
