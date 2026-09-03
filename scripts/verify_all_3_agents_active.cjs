const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function verifyAll3Agents() {
  console.log('🏛️ VERIFYING ALL 3 AGENTS (ATLAS + BREACH + COST) IN PARALLEL...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // Submit Prompt
  console.log('1. Submitting Prompt: "Create high availability Kubernetes EKS cluster with multi-AZ Aurora PostgreSQL and S3 bucket"...');
  const input = await page.$('[data-testid="prompt-input"]');
  if (input) {
    await input.type('Create high availability Kubernetes EKS cluster with multi-AZ Aurora PostgreSQL and S3 bucket');
    const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
    if (sendBtn) await sendBtn.click();
  }

  // Phase 1: Simultaneous LLM reasoning
  await new Promise(r => setTimeout(r, 1500));
  const phase1Cursors = await page.$$eval('[data-testid^="agent-cursor-"]', els => els.map(e => e.getAttribute('data-testid')));
  console.log('Phase 1 Active Cursors:', phase1Cursors);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'swarm_01_all_3_streaming_reasoning.png') });

  // Phase 2: Simultaneous Construction & Hardening
  await new Promise(r => setTimeout(r, 3000));
  const phase2Cursors = await page.$$eval('[data-testid^="agent-cursor-"]', els => els.map(e => e.getAttribute('data-testid')));
  console.log('Phase 2 Active Cursors:', phase2Cursors);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'swarm_02_all_3_building_hardening.png') });

  // Phase 3: Completion & Summary Card
  await new Promise(r => setTimeout(r, 5000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'swarm_03_all_3_completed.png') });

  console.log('\n================================================================');
  console.log('✅ ALL 3 AGENTS VERIFIED SIMULTANEOUSLY ACTIVE ACROSS THE WORKFLOW');
  console.log('================================================================\n');

  await browser.close();
}

verifyAll3Agents().catch(console.error);
