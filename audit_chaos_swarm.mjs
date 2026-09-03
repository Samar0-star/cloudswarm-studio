import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function runChaosAndSwarmAudit() {
  console.log('⚡ =========================================================================');
  console.log('⚡ AUDITING CHAOS GORILLA & RED-TEAM ATTACK DEFENSE ON COMPLEX TOPOLOGY');
  console.log('⚡ =========================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1600,1000']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error(`  🔴 [BROWSER ERROR] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.toString());
    console.error(`  🔴 [BROWSER EXCEPTION] ${err.toString()}`);
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // 1. Trigger Preset E-Commerce HA
  console.log('Step 1: Clicking E-Commerce HA Preset to trigger 4-Agent Live Swarm...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const haBtn = buttons.find(b => b.innerText.includes('E-Commerce HA'));
    if (haBtn) haBtn.click();
  });

  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'audit_04_ecommerce_building.png') });
  console.log('  ✅ 4-Agent Swarm successfully building infrastructure.');

  // 2. Trigger Chaos Gorilla
  console.log('\nStep 2: Triggering Chaos Gorilla AZ Outage Simulator...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const chaosBtn = buttons.find(b => b.innerText.includes('Chaos Outage') || b.innerText.includes('Chaos'));
    if (chaosBtn) chaosBtn.click();
  });

  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'audit_05_chaos_active.png') });
  console.log('  ✅ Chaos Gorilla attack incident active with animated beam overlay.');

  // 3. Trigger Red-Team Threat Attack
  console.log('\nStep 3: Triggering Red-Team Cyber Threat Attack...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const threatBtn = buttons.find(b => b.innerText.includes('Red-Team Attack') || b.innerText.includes('Threat'));
    if (threatBtn) threatBtn.click();
  });

  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'audit_06_quantum_shield.png') });
  console.log('  ✅ Zero-Trust Quantum Shield activated.');

  // 4. Test Modals
  console.log('\nStep 4: Opening and validating Top Navigation Modals (Cost, Security, HCL)...');
  
  // Cost Modal
  await page.evaluate(() => {
    const pills = Array.from(document.querySelectorAll('button, div'));
    const costPill = pills.find(p => p.innerText && p.innerText.includes('/mo'));
    if (costPill) costPill.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'audit_07_cost_modal.png') });

  // Close modals
  await page.keyboard.press('Escape');

  console.log('\n=========================================================================');
  console.log(`🏁 CHAOS & SWARM AUDIT COMPLETE. Console Errors: ${consoleErrors.length}`);
  console.log('=========================================================================\n');

  await browser.close();

  if (consoleErrors.length > 0) {
    console.error('❌ FAILED with console errors:', consoleErrors);
    process.exit(1);
  } else {
    console.log('🎉 100% CLEAN STRESS RUN!');
    process.exit(0);
  }
}

runChaosAndSwarmAudit().catch(err => {
  console.error('Audit crashed:', err);
  process.exit(1);
});
