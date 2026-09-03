const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function captureCleanUi() {
  console.log('📸 Launching Headless Chrome to verify Clean Grey Enterprise UI...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // 1. Initial Clean Dark Grey UI
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '10_clean_grey_initial.png') });
  console.log('✅ Captured 10_clean_grey_initial.png');

  // 2. Type prompt & click Send
  const promptInput = await page.$('[data-testid="prompt-input"]');
  if (promptInput) {
    await promptInput.type('Deploy production Kubernetes EKS cluster with multi-AZ Postgres');
    const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
    if (sendBtn) await sendBtn.click();
  }

  // 3. Capture during execution (at 1.5s - Alpha at Palette/Canvas)
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '11_alpha_palette_canvas_movement.png') });
  console.log('✅ Captured 11_alpha_palette_canvas_movement.png');

  // 4. Capture at 3.5s - Beta at Top Security / Right Inspector
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '12_beta_security_inspector_movement.png') });
  console.log('✅ Captured 12_beta_security_inspector_movement.png');

  // 5. Capture at 6s - Full multi-agent execution completed
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '13_full_screen_synthesis_complete.png') });
  console.log('✅ Captured 13_full_screen_synthesis_complete.png');

  await browser.close();
  console.log('🎉 Clean UI & Multi-Screen Agent Verification complete!');
}

captureCleanUi().catch(console.error);
