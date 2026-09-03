import puppeteer from 'puppeteer-core';

async function testComplex() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1600,1000']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  console.log('🌐 Connected to live UI');

  // Trigger the 24-step Global Banking Core scenario directly
  await page.evaluate(() => {
    // @ts-ignore
    const store = window.__CLOUD_SWARM_STORE__ || (window as any).useCloudSwarmStore?.getState?.();
  });
  
  // Type prompt into PromptCommandBar
  await page.type('input[placeholder*="Describe multi-cloud architecture"]', 'Deploy 24-Stage Global Multi-Region Sovereign Banking Core with Multi-AZ Aurora and EKS Mesh');
  await page.keyboard.press('Enter');

  console.log('⚡ Swarm triggered via prompt input. Waiting 5s for parallel execution...');
  await new Promise(r => setTimeout(r, 5000));

  const nodeCount = await page.evaluate(() => {
    return document.querySelectorAll('[data-testid^="canvas-node-"]').length;
  });

  console.log(`📊 Nodes currently on canvas: ${nodeCount}`);
  await browser.close();
}

testComplex().catch(console.error);
