import puppeteer from 'puppeteer-core';

async function runSimulation() {
  console.log('🚀 Launching WebMCP Judge Simulator (Simulating ChatGPT Desktop)...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  
  // Track console errors
  let errorCount = 0;
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`[PAGE ERROR] ${msg.text()}`);
      errorCount++;
    }
  });
  page.on('pageerror', err => {
    console.error(`[PAGE EXCEPTION] ${err.toString()}`);
    errorCount++;
  });

  console.log('🌐 Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // 1. Verify WebMCP Polyfill / Native Bridge
  console.log('🔍 Checking for window.modelContext...');
  const bridgeStatus = await page.evaluate(() => {
    return {
      exists: !!window.modelContext,
      version: window.modelContext?.version,
      isPolyfill: window.modelContext?.isPolyfill
    };
  });
  console.log(`Bridge Status: ${JSON.stringify(bridgeStatus)}`);
  
  if (!bridgeStatus.exists) {
    throw new Error('window.modelContext not found! WebMCP Bridge failed.');
  }

  // 2. Query available tools
  console.log('🛠️ Querying available WebMCP Tools...');
  const tools = await page.evaluate(() => {
    return window.modelContext.getTools().map(t => t.name);
  });
  console.log(`Found ${tools.length} tools: ${tools.join(', ')}`);

  if (tools.length === 0) {
    throw new Error('No tools registered to WebMCP!');
  }

  // 3. Act as ChatGPT: Execute a tool and measure latency
  console.log('🤖 Simulating ChatGPT Desktop executing a tool (create_resource_node)...');
  const startTime = Date.now();
  
  const toolResult = await page.evaluate(async () => {
    try {
      const result = await window.modelContext.executeTool('create_resource_node', {
        id: 'judge_vpc_1',
        type: 'aws_vpc',
        name: 'Judge_VPC_Test',
        config: { cidr_block: '10.99.0.0/16' }
      });
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message || err.toString() };
    }
  });
  
  const latency = Date.now() - startTime;
  console.log(`⏱️ Tool Execution Latency: ${latency}ms`);
  
  if (!toolResult.success) {
    console.error(`❌ Tool execution failed: ${toolResult.error}`);
    errorCount++;
  } else {
    console.log(`✅ Tool execution succeeded. Result metadata: ${JSON.stringify(toolResult.result?.meta)}`);
  }

  // 4. Verify UI updated (Canvas Node should exist)
  console.log('🖼️ Verifying Canvas DOM updated in real-time...');
  try {
    await page.waitForFunction(
      () => document.body.innerHTML.includes('Judge_VPC_Test'),
      { timeout: 3000 }
    );
    console.log('✅ UI Reactivity Confirmed: "Judge_VPC_Test" appeared in the DOM!');
  } catch (err) {
    console.error('❌ UI Reactivity Failed: Node did not appear in the DOM within 3 seconds.');
    errorCount++;
  }

  // 5. Check cloudswarm://topology/current
  console.log('📡 Simulating ChatGPT reading cloudswarm://topology/current...');
  const resourceData = await page.evaluate(async () => {
    const res = await window.modelContext.readResource('cloudswarm://topology/current');
    return res.contents[0].text;
  });
  
  if (resourceData.includes('Judge_VPC_Test')) {
    console.log('✅ Resource Streaming Confirmed: Topology resource contains the new node.');
  } else {
    console.error('❌ Resource Streaming Failed: New node not in resource state.');
    errorCount++;
  }

  // Final Health Check
  console.log('--------------------------------------------------');
  console.log(`🏁 SIMULATION COMPLETE. Console Errors: ${errorCount}`);
  
  await browser.close();

  if (errorCount > 0) {
    console.error('⚠️ The app has critical errors that judges will notice.');
    process.exit(1);
  } else {
    console.log('🎉 APP IS FLAWLESS. Zero errors, seamless WebMCP integration.');
    process.exit(0);
  }
}

runSimulation().catch(err => {
  console.error('Simulation crashed:', err);
  process.exit(1);
});
