const puppeteer = require('puppeteer-core');

async function traceSwarmTrajectory() {
  console.log('🔬 TRACING PARALLEL 3-AGENT CHOREOGRAPHY & KINEMATICS...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // Set to all agents
  await page.select('select', 'all');

  const input = await page.$('[data-testid="prompt-input"]');
  if (input) {
    await input.type('Deploy production multi-tier architecture with EKS, Postgres, and S3');
    const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
    if (sendBtn) await sendBtn.click();
  }

  const trajectory = [];
  const startTime = Date.now();

  for (let i = 0; i < 50; i++) {
    const elapsed = Date.now() - startTime;
    const sample = await page.evaluate(() => {
      const alphaCursor = document.querySelector('[data-testid="agent-cursor-alpha"]');
      const betaCursor = document.querySelector('[data-testid="agent-cursor-beta"]');
      const gammaCursor = document.querySelector('[data-testid="agent-cursor-gamma"]');
      const inspector = document.querySelector('[data-testid="node-inspector"]');
      const nodes = Array.from(document.querySelectorAll('[data-testid^="canvas-node-"]')).length;

      return {
        alphaPos: alphaCursor ? alphaCursor.style.transform : null,
        betaPos: betaCursor ? betaCursor.style.transform : null,
        gammaPos: gammaCursor ? gammaCursor.style.transform : null,
        inspectorOpen: !!inspector,
        nodes: nodes
      };
    });

    trajectory.push({ timeMs: elapsed, ...sample });
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n--- MULTI-AGENT SYNCHRONIZED TIMELINE ---');
  let prevAlpha = '', prevBeta = '', prevGamma = '';
  for (const t of trajectory) {
    if (t.alphaPos !== prevAlpha || t.betaPos !== prevBeta || t.gammaPos !== prevGamma) {
      console.log(`[t=${t.timeMs}ms] Alpha: ${t.alphaPos} | Beta: ${t.betaPos} | Gamma: ${t.gammaPos} | Nodes: ${t.nodes}`);
      prevAlpha = t.alphaPos;
      prevBeta = t.betaPos;
      prevGamma = t.gammaPos;
    }
  }

  await browser.close();
}

traceSwarmTrajectory().catch(console.error);
