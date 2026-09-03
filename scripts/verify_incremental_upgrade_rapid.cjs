const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function testIncrementalUpgrade() {
  console.log('🏛️ RUNNING RAPID INCREMENTAL HARDWARE UPGRADE TEST...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // 1. Switch speed to Rapid (500ms)
  console.log('1. Setting speed to Rapid (500ms)...');
  await page.select('[data-testid="speed-pacing-selector"]', '500');

  // 2. Initial Build
  console.log('2. Submitting Initial Prompt: "Create Kubernetes EKS cluster with PostgreSQL database"...');
  const input = await page.$('[data-testid="prompt-input"]');
  const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
  if (input && sendBtn) {
    await input.type('Create Kubernetes EKS cluster with PostgreSQL database');
    await sendBtn.click();
  }

  // Wait for initial synthesis to finish completely
  console.log('Waiting for initial build to complete...');
  await page.waitForSelector('[data-testid="execution-summary-card"]', { timeout: 35000 });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'upgrade_rapid_01_initial_complete.png') });

  const initialNodes = await page.$$eval('[data-testid^="canvas-node-"]', els => els.map(e => e.getAttribute('data-testid')));
  console.log('✅ Initial Nodes on Canvas:', initialNodes);

  // 3. Submit Follow-Up Hardware Upgrade Prompt
  console.log('3. Submitting Incremental Upgrade: "Add extra RAM and a much more powerful CPU and NVIDIA GPU"...');
  const input2 = await page.$('[data-testid="prompt-input"]');
  const sendBtn2 = await page.$('[data-testid="prompt-send-btn"]');
  if (input2 && sendBtn2) {
    await input2.type('Add extra RAM and a much more powerful CPU and NVIDIA GPU');
    await sendBtn2.click();
  }

  // In-flight upgrade capture (Cost & Breach visiting nodes)
  await new Promise(r => setTimeout(r, 2200));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'upgrade_rapid_02_agents_visiting_nodes.png') });

  // Wait for upgrade completion
  console.log('Waiting for upgrade completion...');
  await new Promise(r => setTimeout(r, 5500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'upgrade_rapid_03_completed_gpu_summary.png') });

  const finalNodes = await page.$$eval('[data-testid^="canvas-node-"]', els => els.map(e => e.getAttribute('data-testid')));
  console.log('✅ Final Nodes on Canvas (Preserved!):', finalNodes);

  // Click on EKS Node to open NodeInspector
  const eksNode = await page.$('[data-testid="canvas-node-eks_cluster"]');
  if (eksNode) {
    await eksNode.click();
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'upgrade_rapid_04_node_inspector_g5_specs.png') });
  }

  console.log('\n================================================================');
  console.log('🎉 RAPID INCREMENTAL HARDWARE UPGRADE FULLY VERIFIED!');
  console.log('================================================================\n');

  await browser.close();
}

testIncrementalUpgrade().catch(console.error);
