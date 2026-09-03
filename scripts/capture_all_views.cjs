const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function runCapture() {
  console.log('📸 Capturing all modal and drawer views...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // 1. Run demo to populate canvas
  const demoBtn = await page.$('[data-testid="run-demo-btn"]');
  if (demoBtn) await demoBtn.click();
  await new Promise(r => setTimeout(r, 4500));

  // 2. Open HCL Editor Modal
  const hclBtn = await page.$('[data-testid="hcl-toggle-btn"]');
  if (hclBtn) {
    await hclBtn.click();
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'view_02_hcl_modal.png') });
    console.log('✅ Captured view_02_hcl_modal.png');
    // Close HCL modal
    const closeBtn = await page.$('button[title*="Close"]') || await page.$('button svg.lucide-x');
    if (closeBtn) await closeBtn.click();
    await new Promise(r => setTimeout(r, 400));
  }

  // 3. Open Export Modal
  const exportBtn = await page.$('[data-testid="export-modal-btn"]');
  if (exportBtn) {
    await exportBtn.click();
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'view_03_export_modal.png') });
    console.log('✅ Captured view_03_export_modal.png');
    // Close Export modal
    const closeBtn = await page.$('button[title*="Close"]') || await page.$('button svg.lucide-x');
    if (closeBtn) await closeBtn.click();
    await new Promise(r => setTimeout(r, 400));
  }

  // 4. Switch Tri-Terminal tabs to Sentinel Auditor Matrix
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const auditorTab = tabs.find(t => t.textContent.includes('Sentinel Auditor Matrix') || t.textContent.includes('Auditor Matrix'));
    if (auditorTab) auditorTab.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'view_04_auditor_tab.png') });
  console.log('✅ Captured view_04_auditor_tab.png');

  await browser.close();
  console.log('🎉 Multi-view capture finished successfully!');
}

runCapture().catch(console.error);
