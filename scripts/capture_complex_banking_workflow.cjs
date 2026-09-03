const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function captureComplexBanking() {
  console.log('📸 Launching Chrome to capture 24-Step Ultra-Complex Enterprise Banking Workflow...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // 1. Initial State showing 24-Step Hero Card & Speed Pacing Dial
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '20_complex_banking_hero.png') });
  console.log('✅ Captured 20_complex_banking_hero.png');

  // 2. Click the Global Banking Mesh starter card
  const bankingCard = await page.$('text/Global Banking Mesh');
  if (bankingCard) {
    await bankingCard.click();
  } else {
    await page.select('[data-testid="scenario-selector"]', 'global_banking_core');
    const demoBtn = await page.$('[data-testid="run-demo-btn"]');
    if (demoBtn) await demoBtn.click();
  }

  // 3. Capture Phase 1: Network & DR Region setup
  await new Promise(r => setTimeout(r, 2200));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '21_complex_banking_phase1_network.png') });
  console.log('✅ Captured 21_complex_banking_phase1_network.png');

  // 4. Capture Phase 2: Compute & Data Tier setup
  await new Promise(r => setTimeout(r, 3500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '22_complex_banking_phase2_compute_db.png') });
  console.log('✅ Captured 22_complex_banking_phase2_compute_db.png');

  // 5. Capture Phase 3: SecOps Hardening & FinOps Graviton setup
  await new Promise(r => setTimeout(r, 5000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '23_complex_banking_phase3_secops_finops.png') });
  console.log('✅ Captured 23_complex_banking_phase3_secops_finops.png');

  await browser.close();
  console.log('🎉 24-Step Complex Banking Workflow captured successfully!');
}

captureComplexBanking().catch(console.error);
