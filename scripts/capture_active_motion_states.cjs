const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function captureMotionStates() {
  console.log('📸 CAPTURING REAL-TIME MULTI-AGENT PARALLEL MOTION SNAPSHOTS...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  const input = await page.$('[data-testid="prompt-input"]');
  if (input) {
    await input.type('Deploy production multi-tier architecture with EKS, Postgres, and S3');
    const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
    if (sendBtn) await sendBtn.click();
  }

  // 1. In-flight Atlas drag-and-drop
  await new Promise(r => setTimeout(r, 2200));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '40_motion_atlas_dragging.png') });
  console.log('✅ Captured 40_motion_atlas_dragging.png');

  // 2. Parallel Breach & Cost node visitation
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '41_motion_breach_cost_parallel_visit.png') });
  console.log('✅ Captured 41_motion_breach_cost_parallel_visit.png');

  // 3. Parallel Inspector configuration
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '42_motion_inspector_parallel_config.png') });
  console.log('✅ Captured 42_motion_inspector_parallel_config.png');

  await browser.close();
  console.log('🎉 Motion states captured!');
}

captureMotionStates().catch(console.error);
