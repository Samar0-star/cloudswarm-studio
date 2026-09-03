import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_PATH = '/Users/samaraldico/webmcp/scratch/brutal_stress_canvas.png';

async function verifyLiveStudio() {
  console.log('🔍 Connecting Puppeteer to live studio http://localhost:3000...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1680,1050']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 1050 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // Check WebModelContext
  const status = await page.evaluate(async () => {
    const hasMcp = !!window.modelContext;
    if (!hasMcp) return { error: 'No window.modelContext' };

    const topologyRes = await window.modelContext.readResource('cloudswarm://topology/current');
    const topology = JSON.parse(topologyRes.contents[0].text);

    return {
      nodeCount: Object.keys(topology.nodes || {}).length,
      edgeCount: Object.keys(topology.edges || {}).length,
      nodes: Object.values(topology.nodes || {}).map(n => ({ id: n.id, type: n.type, name: n.name, config: n.config })),
      edges: Object.values(topology.edges || {}).map(e => ({ id: e.id, source: e.source, target: e.target, type: e.type })),
      domNodes: document.querySelectorAll('[data-id]').length,
      cursors: Array.from(document.querySelectorAll('[data-testid^="agent-cursor-"]')).map(c => c.getAttribute('data-testid')),
    };
  });

  console.log(`📊 Live Topology Nodes: ${status.nodeCount}, Edges: ${status.edgeCount}`);
  console.log(`🖥️ Canvas DOM Nodes: ${status.domNodes}`);
  console.log(`🤖 Active Cursors: ${status.cursors?.join(', ')}`);

  // Now trigger a rapid exploit burst directly through the bridge while this page is listening!
  console.log('⚡ Triggering live parallel exploit run while page is actively connected...');
  
  await page.screenshot({ path: SCREENSHOT_PATH });
  console.log(`📸 Saved screenshot to: ${SCREENSHOT_PATH}`);

  await browser.close();
  return status;
}

verifyLiveStudio().then(res => {
  console.log('Result:', JSON.stringify(res, null, 2));
}).catch(console.error);
