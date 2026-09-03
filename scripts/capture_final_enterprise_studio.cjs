const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function captureFinalScreenshots() {
  console.log('📸 CAPTURING FINAL ENTERPRISE MULTI-CLOUD SAAS STUDIO...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // 1. Initial Clean View
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'final_01_canvas_overview.png') });

  // 2. Open Resource Palette Flyout (showing AWS/Azure/GCP filters & 108 resources)
  const paletteToggle = await page.$('[data-testid="resource-palette"] button');
  if (paletteToggle) {
    await paletteToggle.click();
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'final_02_multi_cloud_palette_108_resources.png') });
  }

  // 3. Open Cost Modal with Multi-Cloud breakdown & CSV Export
  const costPill = await page.$('[data-testid="hud-cost-ticker"]');
  if (costPill) {
    await costPill.click();
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'final_03_finops_rate_cards_budget_modal.png') });
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
  }

  // 4. Open CIS Security & Zero-Trust Posture Modal
  const secPill = await page.$('[data-testid="hud-auditor-badge"]');
  if (secPill) {
    await secPill.click();
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'final_04_zero_trust_security_modal.png') });
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
  }

  // 5. Open Activity Log Drawer
  const activityBtn = await page.$('[data-testid="activity-log-toggle-btn"]');
  if (activityBtn) {
    await activityBtn.click();
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'final_05_4_agent_activity_log_drawer.png') });
  }

  console.log('✅ ALL FINAL ENTERPRISE SCREENSHOTS CAPTURED!');
  await browser.close();
}

captureFinalScreenshots().catch(console.error);
