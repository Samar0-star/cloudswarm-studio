import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function simulateParallelExternalAgents() {
  console.log('🚀 Launching WebMCP Parallel External Agent Simulator...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1600,1000']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  console.log('🌐 Connected to http://localhost:3000');

  // Spawn 4 parallel external tool executions simultaneously
  console.log('🤖 Firing 4 simultaneous executeTool calls from external clients...');
  
  await page.evaluate(() => {
    // Fire all 4 without awaiting, simulating 4 parallel connections
    window.modelContext.executeTool('create_resource_node', {
      id: 'ext-node-1', type: 'aws_instance', name: 'Parallel_Node_1', config: {}, position: { x: 200, y: 300 }
    });
    
    window.modelContext.executeTool('create_resource_node', {
      id: 'ext-node-2', type: 'aws_s3_bucket', name: 'Parallel_Node_2', config: {}, position: { x: 600, y: 300 }
    });

    window.modelContext.executeTool('create_resource_node', {
      id: 'ext-node-3', type: 'aws_db_instance', name: 'Parallel_Node_3', config: {}, position: { x: 1000, y: 300 }
    });

    window.modelContext.executeTool('create_resource_node', {
      id: 'ext-node-4', type: 'aws_lb', name: 'Parallel_Node_4', config: {}, position: { x: 1400, y: 300 }
    });
  });

  // Give React 1000ms to render the 4 external agent cursors
  await new Promise(r => setTimeout(r, 1000));
  
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'audit_08_external_parallel_agents.png') });
  console.log('📸 Captured parallel external agent cursors on the canvas!');

  // Validate the DOM has 4 nodes
  const nodesCreated = await page.evaluate(() => {
    return document.querySelectorAll('[data-testid^="canvas-node-ext-node"]').length;
  });

  console.log(`✅ DOM confirmed ${nodesCreated} external nodes rendered simultaneously.`);
  
  await browser.close();

  if (nodesCreated === 4) {
    console.log('🎉 TRUE PARALLEL EXTERNAL AGENT EXECUTION VALIDATED!');
    process.exit(0);
  } else {
    console.error('❌ Failed to render all 4 parallel nodes.');
    process.exit(1);
  }
}

simulateParallelExternalAgents().catch(err => {
  console.error(err);
  process.exit(1);
});
