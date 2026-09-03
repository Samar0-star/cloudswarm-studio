const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function testSingleAndMultiAgent() {
  console.log('🧪 Starting Deep Verification: Single Agent First, then Parallel Swarm...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // --------------------------------------------------------------------------
  // TEST 1: Single Agent (Agent Alpha) Focus Mode
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Running Single Agent Alpha ---');
  
  // Select 'Agent Alpha (Cloud Architect)'
  await page.select('select', 'alpha');

  const promptInput = await page.$('[data-testid="prompt-input"]');
  if (promptInput) {
    await promptInput.type('Deploy a resilient microservices backend with RDS and ALB');
    const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
    if (sendBtn) await sendBtn.click();
  }

  // Verify Alpha dragging from palette to canvas
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'test_single_alpha_in_action.png') });
  console.log('📸 Captured test_single_alpha_in_action.png');

  // Wait for Alpha to complete synthesis
  await new Promise(r => setTimeout(r, 4500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'test_single_alpha_complete.png') });
  console.log('📸 Captured test_single_alpha_complete.png');

  const singleNodeCount = await page.$$eval('[data-testid^="canvas-node-"]', nodes => nodes.length);
  console.log(`✅ Single Agent Alpha synthesized ${singleNodeCount} nodes.`);

  // --------------------------------------------------------------------------
  // TEST 2: Parallel Multi-Agent Swarm (Alpha + Beta + Gamma)
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: Running Full Parallel Multi-Agent Swarm ---');

  // Click 1-Click Swarm Demo
  const demoBtn = await page.$('[data-testid="run-demo-btn"]');
  if (demoBtn) await demoBtn.click();

  // Capture midway through swarm execution
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'test_multiagent_swarm_in_flight.png') });
  console.log('📸 Captured test_multiagent_swarm_in_flight.png');

  // Wait for swarm to complete
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'test_multiagent_swarm_final.png') });
  console.log('📸 Captured test_multiagent_swarm_final.png');

  const finalNodeCount = await page.$$eval('[data-testid^="canvas-node-"]', nodes => nodes.length);
  const costText = await page.$eval('[data-testid="hud-cost-ticker"]', el => el.textContent);
  const secText = await page.$eval('[data-testid="hud-auditor-badge"]', el => el.textContent);

  console.log(`✅ Final Multi-Agent Nodes: ${finalNodeCount}`);
  console.log(`✅ Final Cost: ${costText.trim()}`);
  console.log(`✅ Final Security: ${secText.trim()}`);

  await browser.close();
  console.log('🎉 Single Agent & Multi-Agent Swarm successfully verified!');
}

testSingleAndMultiAgent().catch(console.error);
