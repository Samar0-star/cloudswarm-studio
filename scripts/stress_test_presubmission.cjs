const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function stressTest() {
  console.log('🔬 PRE-SUBMISSION STRESS TEST STARTING...\n');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('429') && !msg.text().includes('Failed to load resource')) {
      consoleErrors.push(msg.text());
    }
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(err.message));

  // ============================================================
  // TEST 1: Fresh cold load — no user interaction
  // ============================================================
  console.log('TEST 1: Fresh cold page load (checking for crashes)...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 15000 });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'stress_01_cold_load.png') });
  console.log('  Console errors on load:', consoleErrors.length === 0 ? '0 ✅' : consoleErrors);
  console.log('  Page crashes on load:', pageErrors.length === 0 ? '0 ✅' : pageErrors);

  // ============================================================
  // TEST 2: Empty prompt submission (edge case)
  // ============================================================
  console.log('\nTEST 2: Empty prompt submission (should be no-op)...');
  const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
  if (sendBtn) {
    await sendBtn.click();
    await new Promise(r => setTimeout(r, 500));
  }
  const errorsAfterEmpty = [...consoleErrors];
  console.log('  Errors after empty submit:', errorsAfterEmpty.length === 0 ? '0 ✅' : 'ERRORS FOUND');

  // ============================================================
  // TEST 3: Run the 1-Click Swarm Demo (no API keys needed)
  // ============================================================
  console.log('\nTEST 3: 1-Click Swarm Demo (deterministic, zero-key)...');
  const speedSelect = await page.$('[data-testid="speed-pacing-selector"]');
  if (speedSelect) await speedSelect.select('500');

  const demoBtn = await page.$('[data-testid="demo-btn"]') || await page.$('button ::-p-text(1-Click)') || await page.$('button ::-p-text(Swarm Demo)');
  if (demoBtn) {
    await demoBtn.click();
    await new Promise(r => setTimeout(r, 6000));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'stress_02_demo_running.png') });
  } else {
    console.log('  -> Could not find demo button, trying preset...');
    const presetBtn = await page.$('button ::-p-text(E-Commerce)');
    if (presetBtn) {
      await presetBtn.click();
      await new Promise(r => setTimeout(r, 6000));
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'stress_02_demo_running.png') });
    }
  }

  // ============================================================
  // TEST 4: Rapid double-click prompt submission (race condition test)
  // ============================================================
  console.log('\nTEST 4: Rapid double-click prompt (race condition test)...');
  // Clear first
  const clearBtn = await page.$('button ::-p-text(Clear)');
  if (clearBtn) {
    await clearBtn.click();
    await new Promise(r => setTimeout(r, 500));
  }

  const input = await page.$('[data-testid="prompt-input"]');
  const sendBtn2 = await page.$('[data-testid="prompt-send-btn"]');
  if (input && sendBtn2) {
    await input.click({ clickCount: 3 });
    await input.type('Deploy AWS EKS cluster with RDS Aurora and S3');
    // Double-click send rapidly
    await sendBtn2.click();
    await new Promise(r => setTimeout(r, 100));
    await sendBtn2.click(); // second click should be ignored (isSimulating guard)
    await new Promise(r => setTimeout(r, 5000));
  }
  const errorsAfterRace = consoleErrors.filter(e => !errorsAfterEmpty.includes(e));
  console.log('  Race condition errors:', errorsAfterRace.length === 0 ? '0 ✅' : errorsAfterRace);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'stress_03_race_condition.png') });

  // ============================================================
  // TEST 5: Node Inspector click test
  // ============================================================
  console.log('\nTEST 5: Node Inspector interaction...');
  const anyNode = await page.$('[data-testid^="canvas-node-"]');
  if (anyNode) {
    await anyNode.click();
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'stress_04_node_inspector.png') });

    // Try hardening button
    const hardenBtn = await page.$('button ::-p-text(Hardening)');
    if (hardenBtn) {
      await hardenBtn.click();
      await new Promise(r => setTimeout(r, 400));
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'stress_05_after_hardening.png') });
    }
  }

  // ============================================================
  // TEST 6: HCL Sync Drawer open/close/apply cycle
  // ============================================================
  console.log('\nTEST 6: HCL Sync Drawer open → Apply → close...');
  const hclBtn = await page.$('button ::-p-text(HCL)');
  if (hclBtn) {
    await hclBtn.click();
    await new Promise(r => setTimeout(r, 600));

    // Click "Apply to Canvas"
    const applyBtn = await page.$('button ::-p-text(Apply to Canvas)');
    if (applyBtn) {
      await applyBtn.click();
      await new Promise(r => setTimeout(r, 400));
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'stress_06_hcl_apply.png') });

    // Close
    await hclBtn.click();
    await new Promise(r => setTimeout(r, 300));
  }

  // ============================================================
  // TEST 7: Export modal → check all tabs
  // ============================================================
  console.log('\nTEST 7: Export modal tab cycling...');
  const exportBtn = await page.$('button ::-p-text(Export)');
  if (exportBtn) {
    await exportBtn.click();
    await new Promise(r => setTimeout(r, 500));

    // Click through tabs
    for (const tab of ['variables.tf', 'Dockerfile', 'audit_certificate.json', 'README.md']) {
      const tabBtn = await page.$(`button ::-p-text(${tab})`);
      if (tabBtn) {
        await tabBtn.click();
        await new Promise(r => setTimeout(r, 200));
      }
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'stress_07_export_tabs.png') });

    const cancelBtn = await page.$('button ::-p-text(Cancel)');
    if (cancelBtn) await cancelBtn.click();
    await new Promise(r => setTimeout(r, 300));
  }

  // ============================================================
  // TEST 8: Fork + branch switching
  // ============================================================
  console.log('\nTEST 8: DAG Fork & branch switching...');
  const forkBtn = await page.$('button ::-p-text(Fork)');
  if (forkBtn) {
    await forkBtn.click();
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'stress_08_fork_branch.png') });

    // Switch back to main
    const mainBtn = await page.$('button ::-p-text(main)');
    if (mainBtn) {
      await mainBtn.click();
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // ============================================================
  // TEST 9: FinOps modal — budget slider interaction
  // ============================================================
  console.log('\nTEST 9: FinOps budget slider interaction...');
  const costBtn = await page.$('button ::-p-text(/mo)');
  if (costBtn) {
    await costBtn.click();
    await new Promise(r => setTimeout(r, 500));

    // Try clicking the provider filter pills
    const awsTab = await page.$('button ::-p-text(AWS)');
    if (awsTab) {
      await awsTab.click();
      await new Promise(r => setTimeout(r, 200));
    }
    const gcpTab = await page.$('button ::-p-text(GCP)');
    if (gcpTab) {
      await gcpTab.click();
      await new Promise(r => setTimeout(r, 200));
    }
    const allTab = await page.$('button ::-p-text(All Clouds)');
    if (allTab) {
      await allTab.click();
      await new Promise(r => setTimeout(r, 200));
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'stress_09_finops_filters.png') });

    const doneBtn = await page.$('button ::-p-text(Done)');
    if (doneBtn) await doneBtn.click();
    await new Promise(r => setTimeout(r, 300));
  }

  // ============================================================
  // TEST 10: Activity Log drawer
  // ============================================================
  console.log('\nTEST 10: Activity Log drawer...');
  const logBtn = await page.$('button ::-p-text(Activity Log)');
  if (logBtn) {
    await logBtn.click();
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'stress_10_activity_log.png') });
  }

  // ============================================================
  // FINAL SUMMARY
  // ============================================================
  console.log('\n================================================================');
  console.log('🔬 PRE-SUBMISSION STRESS TEST COMPLETE');
  console.log('================================================================');
  console.log('  Console Errors (non-429):', consoleErrors.length === 0 ? '0 ✅ CLEAN' : `${consoleErrors.length} ⚠️`);
  if (consoleErrors.length > 0) console.log('  Error Details:', consoleErrors);
  console.log('  Page Crashes:', pageErrors.length === 0 ? '0 ✅ CLEAN' : `${pageErrors.length} ⚠️`);
  if (pageErrors.length > 0) console.log('  Crash Details:', pageErrors);
  console.log('  Console Warnings:', consoleWarnings.length);
  console.log('================================================================\n');

  await browser.close();
}

stressTest().catch(console.error);
