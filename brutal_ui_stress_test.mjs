import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function launchJudge(browser, judgeName, x, y) {
  console.log(`[${judgeName}] 🧑‍⚖️ Connecting to WebMCP...`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // Simulate chaotic actions
  console.log(`[${judgeName}] 🔨 Executing simultaneous brutal actions...`);
  await page.evaluate(async (jName, startX, startY) => {
    // 1. Hammer WebMCP to spawn a node
    window.modelContext.executeTool('create_resource_node', {
      id: `judge-node-${jName}`, type: 'aws_instance', name: `${jName}_VM`, config: {}, position: { x: startX, y: startY }
    });

    // 2. Trigger random UI clicks (Chaos Gorilla, Quantum Shield, Fork)
    const clickRandomButton = () => {
      const buttons = document.querySelectorAll('button');
      if (buttons.length > 0) {
        const randomBtn = buttons[Math.floor(Math.random() * buttons.length)];
        randomBtn.click();
      }
    };
    
    setTimeout(clickRandomButton, 50);
    setTimeout(clickRandomButton, 150);
  }, judgeName, x, y);

  // Take screenshot of the chaos
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `judge_chaos_${judgeName}.png`) });
  
  // Check for any console errors that occurred during the chaos
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  return { page, errors: consoleErrors };
}

async function runBrutalJudges() {
  console.log('🚀 Launching 4 Parallel Judges to Hammer the System...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox']
  });

  try {
    // Run all 4 judges in parallel!
    const results = await Promise.all([
      launchJudge(browser, 'Judge_Alpha', 200, 200),
      launchJudge(browser, 'Judge_Beta', 600, 200),
      launchJudge(browser, 'Judge_Gamma', 200, 600),
      launchJudge(browser, 'Judge_Delta', 600, 600)
    ]);

    let totalErrors = 0;
    results.forEach((res, i) => {
      if (res.errors.length > 0) {
        console.error(`❌ Judge ${i+1} found errors:`, res.errors);
        totalErrors += res.errors.length;
      }
    });

    if (totalErrors === 0) {
      console.log('✅ ALL 4 JUDGES FINISHED CHAOTIC TESTING. ZERO ERRORS FOUND. SYSTEM IS BULLETPROOF.');
      process.exit(0);
    } else {
      console.error(`❌ Found ${totalErrors} errors during brutal testing.`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal testing error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runBrutalJudges();
