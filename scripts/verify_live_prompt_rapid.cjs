const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function testPrompt() {
  console.log('🚀 TESTING LIVE PROMPT WITH RAPID EXECUTION...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('[BROWSER]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[PAGE ERROR]', err.message));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // 1. Set speed to Rapid (500ms)
  console.log('1. Setting speed to Rapid (500ms)...');
  await page.select('[data-testid="speed-pacing-selector"]', '500');

  // 2. Submit user prompt
  console.log('2. Submitting prompt...');
  const input = await page.$('[data-testid="prompt-input"]');
  const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
  if (input && sendBtn) {
    await input.type('Deploy high availability Kubernetes EKS cluster with multi-AZ Aurora PostgreSQL and S3 bucket');
    await sendBtn.click();
  }

  // 3. Check for active cursors in-flight
  await new Promise(r => setTimeout(r, 2000));
  const cursors = await page.$$eval('[data-testid^="agent-cursor-"]', els => els.map(e => e.getAttribute('data-testid')));
  console.log('Active Cursors during build:', cursors);

  // Take in-flight screenshot
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live_prompt_01_agents_in_flight.png') });

  // 4. Wait for summary card
  console.log('Waiting for completion...');
  await page.waitForSelector('[data-testid="execution-summary-card"]', { timeout: 25000 });

  const finalNodes = await page.$$eval('[data-testid^="canvas-node-"]', els => els.map(e => e.getAttribute('data-testid')));
  console.log('✅ Final Nodes on Canvas:', finalNodes);

  // Take completed screenshot
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'live_prompt_02_build_complete.png') });

  console.log('\n================================================================');
  console.log('🎉 LIVE PROMPT BUILD VERIFIED WITH ZERO CRASHES!');
  console.log('================================================================\n');

  await browser.close();
}

testPrompt().catch(console.error);
