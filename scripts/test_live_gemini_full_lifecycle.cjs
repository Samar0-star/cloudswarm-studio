const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function testFullLifecycle() {
  console.log('⚡ Running Full 3-Agent Gemini Lifecycle Test...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // Type prompt & execute
  const promptInput = await page.$('[data-testid="prompt-input"]');
  if (promptInput) {
    await promptInput.type('Deploy resilient FinTech banking microservices with Postgres DB');
    const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
    if (sendBtn) await sendBtn.click();
  }

  // Poll until isSimulating turns false (synthesis complete)
  console.log('Waiting for swarm synthesis to complete...');
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const navText = await page.$eval('[data-testid="top-navbar"]', el => el.textContent);
    if (!navText.includes('Stop (')) {
      console.log(`Synthesis finished at ~${i + 1}s!`);
      break;
    }
  }

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '09_gemini_synthesis_final.png') });
  console.log('📸 Captured 09_gemini_synthesis_final.png');

  const nodes = await page.$$('[data-testid^="canvas-node-"]');
  console.log(`✅ Canvas nodes synthesized by Gemini: ${nodes.length}`);

  await browser.close();
}

testFullLifecycle().catch(console.error);
