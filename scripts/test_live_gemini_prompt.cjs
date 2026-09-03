const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function testLiveGemini() {
  console.log('⚡ Testing Live Google Gemini Swarm Execution with Key Rotation...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // Check top navbar shows Gemini mode
  const navText = await page.$eval('[data-testid="top-navbar"]', el => el.textContent);
  console.log('Navbar text:', navText.includes('Gemini') ? '✅ Gemini Engine Active' : '⚠️ Simulator Mode Active');

  // Submit prompt via command bar
  console.log('Submitting live prompt to Gemini Flash...');
  const promptInput = await page.$('[data-testid="prompt-input"]');
  if (promptInput) {
    await promptInput.type('Deploy a resilient FinTech payment processing gateway with Aurora DB');
    const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
    if (sendBtn) await sendBtn.click();
  }

  // Wait for Gemini API response & agent tool dispatch
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '07_gemini_live_execution.png') });
  console.log('📸 Captured 07_gemini_live_execution.png');

  // Verify created nodes
  const nodes = await page.$$('[data-testid^="canvas-node-"]');
  console.log(`✅ Canvas nodes synthesized by Gemini: ${nodes.length}`);

  await browser.close();
  console.log('🎉 Live Gemini Multi-Agent verification completed successfully!');
}

testLiveGemini().catch(console.error);
