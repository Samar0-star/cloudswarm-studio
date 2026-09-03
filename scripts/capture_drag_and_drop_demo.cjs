const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function captureDragAndDrop() {
  console.log('📸 Launching Chrome to capture Visual Drag-and-Drop...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // Type prompt
  const promptInput = await page.$('[data-testid="prompt-input"]');
  if (promptInput) {
    await promptInput.type('Build resilient payment processing architecture with RDS and ALB');
    const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
    if (sendBtn) await sendBtn.click();
  }

  // Capture at 0.8s (Alpha picking up VPC from Palette and dragging across)
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '14_agent_drag_and_drop_in_flight.png') });
  console.log('✅ Captured 14_agent_drag_and_drop_in_flight.png');

  // Capture at 2.2s (Alpha dragging ECS cluster to center)
  await new Promise(r => setTimeout(r, 1400));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '15_agent_drag_compute_in_flight.png') });
  console.log('✅ Captured 15_agent_drag_compute_in_flight.png');

  // Capture at 5.5s (Full synthesized multi-agent topology)
  await new Promise(r => setTimeout(r, 3300));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '16_drag_synthesis_complete.png') });
  console.log('✅ Captured 16_drag_synthesis_complete.png');

  await browser.close();
  console.log('🎉 Visual Drag-and-Drop capture finished!');
}

captureDragAndDrop().catch(console.error);
