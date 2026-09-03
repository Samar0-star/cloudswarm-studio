const puppeteer = require('puppeteer-core');

async function measurePacing() {
  console.log('⏱️ MEASURING EXECUTION PACING & DURATION...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // 1. Submit prompt in Standard (~45s) mode
  const input = await page.$('[data-testid="prompt-input"]');
  if (input) {
    await input.type('Create resilient multi-tier VPC architecture with EKS and Postgres');
    const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
    if (sendBtn) {
      console.log('🚀 Triggering Prompt Execution...');
      const startTime = Date.now();
      await sendBtn.click();

      // Poll until isSimulating becomes false
      let isSimulating = true;
      let checkCount = 0;
      while (isSimulating && checkCount < 100) {
        await new Promise(r => setTimeout(r, 500));
        checkCount++;
        isSimulating = await page.evaluate(() => {
          const stopBtn = document.querySelector('[data-testid="stop-demo-btn"]');
          return !!stopBtn;
        });
      }

      const totalDurationSec = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n✅ Standard Prompt Workflow Execution Duration: ${totalDurationSec} seconds`);
    }
  }

  await browser.close();
  console.log('🎉 Pacing measurement complete!');
}

measurePacing().catch(console.error);
