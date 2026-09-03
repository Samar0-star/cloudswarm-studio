const puppeteer = require('puppeteer-core');

async function inspectLiveSession() {
  console.log('🔍 Inspecting active CloudSwarm Studio session...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  const sessionData = await page.evaluate(() => {
    const logs = Array.from(document.querySelectorAll('[data-testid="tri-terminal-drawer"] .font-mono')).map(el => el.textContent?.trim());
    const nodes = Array.from(document.querySelectorAll('[data-testid^="canvas-node-"]')).map(el => el.getAttribute('data-testid')?.replace('canvas-node-', ''));
    const cost = document.querySelector('[data-testid="hud-cost-ticker"]')?.textContent?.trim();
    const cis = document.querySelector('[data-testid="hud-auditor-badge"]')?.textContent?.trim();
    const commits = Array.from(document.querySelectorAll('[data-testid^="commit-pill-"]')).map(el => el.textContent?.trim());

    return {
      nodes,
      cost,
      cis,
      commits,
      terminalLogs: logs.slice(-10)
    };
  });

  console.log('\n================================================================');
  console.log('📊 ACTIVE LIVE SESSION SNAPSHOT:');
  console.log('================================================================');
  console.log('Nodes on Canvas:', sessionData.nodes);
  console.log('Live AWS Monthly Spend:', sessionData.cost);
  console.log('Live CIS Security Rating:', sessionData.cis);
  console.log('DAG Commit Lineage:', sessionData.commits);
  console.log('\nRecent Terminal Execution Logs:');
  sessionData.terminalLogs.forEach(l => console.log('  >', l));
  console.log('================================================================\n');

  await browser.close();
}

inspectLiveSession().catch(console.error);
