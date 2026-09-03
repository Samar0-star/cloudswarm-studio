const puppeteer = require('puppeteer-core');

async function debugCrash() {
  console.log('🔍 Launching browser to reproduce prompt crash...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900']
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[Browser ${msg.type()}]:`, msg.text());
  });

  page.on('pageerror', err => {
    console.error(`💥 [Page Error Exception]:`, err);
  });

  page.on('requestfailed', req => {
    console.error(`❌ [Request Failed]: ${req.url()} - ${req.failure()?.errorText}`);
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  console.log('Submitting prompt in prompt command bar...');
  const input = await page.$('[data-testid="prompt-input"]');
  if (input) {
    await input.type('Create a secure 3-tier VPC architecture on the canvas with Postgres DB');
    const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
    if (sendBtn) {
      console.log('Clicking send...');
      await sendBtn.click();
    }
  }

  // Wait 10 seconds and log whatever happens
  for (let i = 1; i <= 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    console.log(`Second ${i} elapsed...`);
  }

  await browser.close();
  console.log('Debug run complete.');
}

debugCrash().catch(console.error);
