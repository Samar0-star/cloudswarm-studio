const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function capturePromptWalkthrough() {
  console.log('📸 Launching Chrome to capture Live Prompt Deep Walkthrough...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // Type prompt
  const input = await page.$('[data-testid="prompt-input"]');
  if (input) {
    await input.type('Deploy multi-tier resilient cloud architecture with EKS, Postgres, and S3');
    const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
    if (sendBtn) await sendBtn.click();
  }

  // 1. Capture at 3.5s (VPC & Subnets created, Atlas dragging ALB)
  await new Promise(r => setTimeout(r, 3500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '30_prompt_network_tier.png') });
  console.log('✅ Captured 30_prompt_network_tier.png');

  // 2. Capture at 7.5s (EKS & Aurora Postgres created, Atlas inspecting)
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '31_prompt_compute_db_tier.png') });
  console.log('✅ Captured 31_prompt_compute_db_tier.png');

  // 3. Capture at 12.5s (Breach & Cost hardening and pricing)
  await new Promise(r => setTimeout(r, 5000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '32_prompt_secops_finops_complete.png') });
  console.log('✅ Captured 32_prompt_secops_finops_complete.png');

  const nodes = await page.$$eval('[data-testid^="canvas-node-"]', els => els.length);
  const cost = await page.$eval('[data-testid="hud-cost-ticker"]', el => el.textContent);
  const cis = await page.$eval('[data-testid="hud-auditor-badge"]', el => el.textContent);

  console.log(`📊 Result: ${nodes} nodes created, Cost: ${cost.trim()}, Security: ${cis.trim()}`);

  await browser.close();
  console.log('🎉 Prompt walkthrough captured successfully!');
}

capturePromptWalkthrough().catch(console.error);
