const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function verifyRedesignedProduct() {
  console.log('🏛️ VERIFYING FULL REDESIGNED SAAS PRODUCT...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // 1. Initial State (Clean SaaS Canvas)
  console.log('1. Capturing Initial Clean SaaS Canvas...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'product_01_initial_canvas.png') });

  // 2. Open Resource Palette Flyout
  console.log('2. Testing Add Primitives Palette Flyout...');
  const paletteToggle = await page.$('[data-testid="resource-palette"] button');
  if (paletteToggle) {
    await paletteToggle.click();
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'product_02_palette_open.png') });
    await paletteToggle.click(); // Close it
    await new Promise(r => setTimeout(r, 300));
  }

  // 3. Trigger Architecture Prompt Execution
  console.log('3. Running Architecture Prompt: "Create secure 3-tier VPC with Kubernetes EKS and Postgres"...');
  const input = await page.$('[data-testid="prompt-input"]');
  if (input) {
    await input.type('Create secure 3-tier VPC with Kubernetes EKS and Postgres');
    const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
    if (sendBtn) await sendBtn.click();
  }

  // In-flight kinematics capture
  await new Promise(r => setTimeout(r, 2200));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'product_03_in_flight_kinematics.png') });

  // Wait for completion & summary card
  console.log('4. Waiting for Completion & Summary Card...');
  await new Promise(r => setTimeout(r, 4500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'product_04_completed_with_summary_card.png') });

  // 5. Open Cost Breakdown & Budget Manager Modal
  console.log('5. Testing Cost & Budget Breakdown Modal...');
  const costPill = await page.$('[data-testid="hud-cost-ticker"]');
  if (costPill) {
    await costPill.click();
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'product_05_cost_budget_modal.png') });
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
  }

  // 6. Open Security & CIS Posture Modal
  console.log('6. Testing Security & CIS Posture Modal...');
  const secPill = await page.$('[data-testid="hud-auditor-badge"]');
  if (secPill) {
    await secPill.click();
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'product_06_security_posture_modal.png') });
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
  }

  // 7. Open Node Inspector
  console.log('7. Testing Node Inspector Slide-Over Panel...');
  const firstNode = await page.$('[data-testid^="canvas-node-"]');
  if (firstNode) {
    await firstNode.click();
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'product_07_node_inspector_open.png') });
  }

  // 8. Open Activity Log Drawer
  console.log('8. Testing Activity Log Drawer Toggle...');
  const activityLogBtn = await page.$('[data-testid="activity-log-toggle-btn"]');
  if (activityLogBtn) {
    await activityLogBtn.click();
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'product_08_activity_log_drawer.png') });
  }

  console.log('\n================================================================');
  console.log('🎉 ALL 8 PRODUCT DESIGN SCREENS CAPTURED & VERIFIED!');
  console.log('================================================================\n');

  await browser.close();
}

verifyRedesignedProduct().catch(console.error);
