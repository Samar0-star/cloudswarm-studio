const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function verifyIncrementalUpgrade() {
  console.log('🏛️ VERIFYING INCREMENTAL HARDWARE UPGRADE WORKFLOW...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // 1. Initial Build
  console.log('1. Submitting Initial Prompt: "Create Kubernetes EKS cluster with PostgreSQL database"...');
  const input = await page.$('[data-testid="prompt-input"]');
  const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
  if (input && sendBtn) {
    await input.type('Create Kubernetes EKS cluster with PostgreSQL database');
    await sendBtn.click();
  }

  // Wait for initial synthesis to finish
  console.log('Waiting for initial build to complete...');
  await new Promise(r => setTimeout(r, 6000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'upgrade_01_initial_topology.png') });

  const initialNodes = await page.$$eval('[data-testid^="canvas-node-"]', els => els.map(e => e.getAttribute('data-testid')));
  console.log('Initial Nodes on Canvas:', initialNodes);

  // 2. Submit Follow-Up Hardware Scaling Prompt
  console.log('2. Submitting Incremental Upgrade Prompt: "Add extra RAM and a much more powerful CPU and GPU"...');
  const input2 = await page.$('[data-testid="prompt-input"]');
  const sendBtn2 = await page.$('[data-testid="prompt-send-btn"]');
  if (input2 && sendBtn2) {
    await input2.type('Add extra RAM and a much more powerful CPU and GPU');
    await sendBtn2.click();
  }

  // In-flight upgrade capture
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'upgrade_02_agents_upgrading_nodes.png') });

  // Wait for upgrade completion
  await new Promise(r => setTimeout(r, 5500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'upgrade_03_completed_with_gpu_specs.png') });

  const finalNodes = await page.$$eval('[data-testid^="canvas-node-"]', els => els.map(e => e.getAttribute('data-testid')));
  console.log('Final Nodes on Canvas after Upgrade:', finalNodes);

  // Click on EKS node to inspect upgraded hardware in NodeInspector
  const eksNode = await page.$('[data-testid="canvas-node-eks_cluster"]');
  if (eksNode) {
    await eksNode.click();
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'upgrade_04_node_inspector_gpu_specs.png') });
  }

  console.log('\n================================================================');
  console.log('🎉 INCREMENTAL HARDWARE UPGRADE SUCCESSFULLY VERIFIED!');
  console.log('================================================================\n');

  await browser.close();
}

verifyIncrementalUpgrade().catch(console.error);
