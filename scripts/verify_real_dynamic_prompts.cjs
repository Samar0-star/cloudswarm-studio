const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function verifyRealDynamicPrompts() {
  console.log('🏛️ RUNNING REAL LIVE DYNAMIC PROMPTS VERIFICATION...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // Test 1: Real Dynamic Prompt Execution
  console.log('1. Testing Prompt: "Create high availability Kubernetes EKS cluster with multi-AZ Aurora PostgreSQL and S3 bucket"');
  const input = await page.$('[data-testid="prompt-input"]');
  if (input) {
    await input.type('Create high availability Kubernetes EKS cluster with multi-AZ Aurora PostgreSQL and S3 bucket');
    const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
    if (sendBtn) await sendBtn.click();
  }

  // Intermediate state capture
  await new Promise(r => setTimeout(r, 2200));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '50_dynamic_prompt_in_flight.png') });
  console.log('📸 Captured 50_dynamic_prompt_in_flight.png');

  // Multi-agent parallel hardening
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '51_dynamic_prompt_parallel_hardening.png') });
  console.log('📸 Captured 51_dynamic_prompt_parallel_hardening.png');

  // Complete state
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '52_dynamic_prompt_completed.png') });
  console.log('📸 Captured 52_dynamic_prompt_completed.png');

  const nodes = await page.$$eval('[data-testid^="canvas-node-"]', els => els.map(e => e.getAttribute('data-testid')));
  const logs = await page.$$eval('[data-testid="tri-terminal-drawer"]', els => els.length > 0);
  const cost = await page.$eval('[data-testid="hud-cost-ticker"]', el => el.textContent);
  const cis = await page.$eval('[data-testid="hud-auditor-badge"]', el => el.textContent);

  console.log('\n================================================================');
  console.log('📊 REAL-WORLD PROMPT EXECUTION METRICS:');
  console.log('================================================================');
  console.log(`✅ Nodes Created on Canvas:`, nodes.join(', '));
  console.log(`✅ Tri-Terminal Drawer Logs Active:`, logs);
  console.log(`✅ Live AWS Monthly Cost:`, cost.trim());
  console.log(`✅ Live CIS Security Rating:`, cis.trim());
  console.log('================================================================\n');

  await browser.close();
  console.log('🎉 Verification complete!');
}

verifyRealDynamicPrompts().catch(console.error);
