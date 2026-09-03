const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function runVerification() {
  console.log('🚀 Starting Chrome Browser Visual & Functional Verification...');
  
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  const consoleLogs = [];
  const consoleErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(`[PageError] ${err.toString()}`);
  });

  // Step 1: Navigate to app
  console.log('1. Navigating to http://localhost:3000/...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_initial_load.png') });
  console.log('   📸 Captured 01_initial_load.png');

  // Step 2: Trigger 1-Click Swarm Demo
  console.log('2. Clicking "1-Click Swarm Demo"...');
  const demoBtn = await page.$('[data-testid="run-demo-btn"]') || await page.$('[data-testid="hero-run-demo-btn"]');
  if (demoBtn) {
    await demoBtn.click();
    console.log('   Clicked run demo button.');
  } else {
    console.log('   Warning: Demo button not found by testid');
  }

  // Wait 1.5s to capture in-flight swarm animation
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_swarm_executing.png') });
  console.log('   📸 Captured 02_swarm_executing.png');

  // Wait for simulation to complete (~4 seconds)
  await new Promise(r => setTimeout(r, 4500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_swarm_completed.png') });
  console.log('   📸 Captured 03_swarm_completed.png');

  // Step 3: Click a canvas node to open Node Inspector
  console.log('3. Clicking a canvas node to inspect...');
  const nodes = await page.$$('[data-testid^="canvas-node-"]');
  console.log(`   Found ${nodes.length} canvas nodes.`);
  if (nodes.length > 0) {
    await nodes[0].click();
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_node_inspector_opened.png') });
    console.log('   📸 Captured 04_node_inspector_opened.png');
  }

  // Step 4: Toggle HCL Editor
  console.log('4. Toggling Terraform HCL Drawer...');
  const hclBtn = await page.$('[data-testid="hcl-editor-toggle"]') || await page.$('button[title*="HCL"]');
  if (hclBtn) {
    await hclBtn.click();
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_hcl_drawer_opened.png') });
    console.log('   📸 Captured 05_hcl_drawer_opened.png');
  }

  // Step 5: Open Export Modal
  console.log('5. Clicking Export Production Bundle...');
  const exportBtn = await page.$('button[title*="Export"]') || await page.$('[data-testid="export-bundle-btn"]');
  if (exportBtn) {
    await exportBtn.click();
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '06_export_modal_opened.png') });
    console.log('   📸 Captured 06_export_modal_opened.png');
  }

  await browser.close();

  console.log('\n--- VERIFICATION SUMMARY ---');
  console.log(`Canvas Nodes Created: ${nodes.length}`);
  console.log(`Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
  } else {
    console.log('✅ Zero console runtime errors detected!');
  }
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
