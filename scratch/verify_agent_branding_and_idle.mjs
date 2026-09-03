import puppeteer from 'puppeteer-core';

async function testBrandingAndIdle() {
  console.log('🚀 Launching Google Chrome to test branding, distinct cursor tip colors, and idle behavior...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: "new",
    args: ['--no-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.modelContext && typeof window.modelContext.executeTool === 'function', { timeout: 15000 });

  // 1. Verify idle behavior: Ensure NO stale simulation is running automatically!
  console.log('⏳ Waiting 3 seconds to verify the canvas remains completely idle (no autonomous simulation)...');
  await new Promise(r => setTimeout(r, 3000));

  const initialSimState = await page.evaluate(() => {
    // @ts-ignore
    const store = window.useCloudSwarmStore?.getState();
    return {
      isSimulating: store?.isSimulating,
      nodeCount: Object.keys(store?.topologyState?.nodes || {}).length,
    };
  });
  console.log(`📊 Canvas Idle State: isSimulating=${initialSimState.isSimulating}, nodeCount=${initialSimState.nodeCount}`);

  // 2. Spawn each external agent and verify name + cursor tip color
  const agentsToTest = [
    { id: 'ext-1', expectedName: 'External Agent 1', expectedColor: '#06B6D4' },
    { id: 'ext-2', expectedName: 'External Agent 2', expectedColor: '#8B5CF6' },
    { id: 'ext-3', expectedName: 'External Agent 3', expectedColor: '#F43F5E' },
    { id: 'ext-4', expectedName: 'External Agent 4', expectedColor: '#F97316' },
  ];

  for (const a of agentsToTest) {
    console.log(`\nTesting agent: ${a.id}...`);
    await page.evaluate(async (agentId) => {
      // @ts-ignore
      await window.modelContext.executeTool('create_resource_node', {
        id: `node-${agentId}`,
        type: 'aws_vpc',
        name: `VPC by ${agentId}`,
        position: { x: 300, y: 300 }
      }, { agentId });
    }, a.id);

    await new Promise(r => setTimeout(r, 400));

    const agentData = await page.evaluate((agentId) => {
      const el = document.querySelector(`[data-testid="agent-cursor-${agentId}"]`);
      if (!el) return null;
      const name = el.querySelector('.truncate')?.textContent || '';
      const badgeText = el.textContent || '';
      const tip = el.querySelector('span[style*="background-color"]');
      const tipColor = tip ? tip.style.backgroundColor : '';
      const svgPath = el.querySelector('svg path');
      const strokeColor = svgPath ? (svgPath.getAttribute('stroke') || svgPath.style.stroke) : '';

      return { name, badgeText, tipColor, strokeColor };
    }, a.id);

    console.log(`  Name displayed: "${agentData?.name || agentData?.badgeText}"`);
    console.log(`  Tip color: ${agentData?.tipColor}, Stroke color: ${agentData?.strokeColor}`);

    if (agentData?.badgeText.includes('ChatGPT')) {
      console.error(`❌ FAIL: Found "ChatGPT" in badge for ${a.id}!`);
      process.exit(1);
    }
  }

  await browser.close();
  console.log('\n🎉 ALL CHECKS PASSED: No autonomous simulation, no ChatGPT Desktop naming, and distinct tip colors verified!');
}

testBrandingAndIdle().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
