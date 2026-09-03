const puppeteer = require('puppeteer-core');

async function debugPrompt() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[PAGE ERROR]', err.message));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  console.log('Typing and submitting prompt...');
  const input = await page.$('[data-testid="prompt-input"]');
  const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
  if (input && sendBtn) {
    await input.type('Create secure 3-tier VPC with Kubernetes EKS and Postgres');
    await sendBtn.click();
  }

  await new Promise(r => setTimeout(r, 4000));
  await browser.close();
}

debugPrompt().catch(console.error);
