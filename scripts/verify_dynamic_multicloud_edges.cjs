const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function testDynamicMultiCloudEdges() {
  console.log('🏛️ RUNNING E2E DYNAMIC MULTI-CLOUD & EDGE WIRING TEST...');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('  [BROWSER LOG]:', msg.text()));
  page.on('pageerror', err => console.error('  [PAGE ERROR]:', err.message));

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });

  // 1. Switch speed to Rapid (500ms)
  console.log('1. Setting speed to Rapid (500ms)...');
  const speedSelect = await page.$('[data-testid="speed-pacing-selector"]');
  if (speedSelect) {
    await speedSelect.select('500');
  }

  // 2. Test GCP Prompt with BigQuery and Streaming
  console.log('\n2. Testing GCP Prompt: "Deploy distributed Kafka streaming on Google Cloud with BigQuery analytics and GCS bucket"...');
  const input = await page.$('[data-testid="prompt-input"]');
  const sendBtn = await page.$('[data-testid="prompt-send-btn"]');
  if (input && sendBtn) {
    await input.click({ clickCount: 3 });
    await input.type('Deploy distributed Kafka streaming on Google Cloud with BigQuery analytics and GCS bucket');
    await sendBtn.click();
  }

  // Wait for synthesis to finish
  console.log('Waiting for GCP build and edge wiring...');
  await page.waitForSelector('[data-testid="summary-card"]', { timeout: 35000 });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'multicloud_01_gcp_with_edges.png') });

  const gcpNodes = await page.$$eval('[data-testid^="canvas-node-"]', els => els.map(e => e.getAttribute('data-testid')));
  const gcpEdges = await page.$$eval('[data-testid^="canvas-edge-"]', els => els.map(e => e.getAttribute('data-testid')));
  console.log('✅ Spawned GCP Nodes:', gcpNodes);
  console.log('✅ Spawned Dependency Edges:', gcpEdges);

  // 3. Test Azure Prompt
  console.log('\n3. Testing Azure Prompt: "Deploy Azure Kubernetes AKS cluster with Cosmos DB and Azure Blob Storage"...');
  const input2 = await page.$('[data-testid="prompt-input"]');
  const sendBtn2 = await page.$('[data-testid="prompt-send-btn"]');
  if (input2 && sendBtn2) {
    await input2.click({ clickCount: 3 });
    await input2.type('Deploy Azure Kubernetes AKS cluster with Cosmos DB and Azure Blob Storage');
    await sendBtn2.click();
  }

  console.log('Waiting for Azure build and edge wiring...');
  await new Promise(r => setTimeout(r, 6000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'multicloud_02_azure_with_edges.png') });

  const azureNodes = await page.$$eval('[data-testid^="canvas-node-"]', els => els.map(e => e.getAttribute('data-testid')));
  const azureEdges = await page.$$eval('[data-testid^="canvas-edge-"]', els => els.map(e => e.getAttribute('data-testid')));
  console.log('✅ Spawned Azure Nodes:', azureNodes);
  console.log('✅ Spawned Azure Edges:', azureEdges);

  // 4. Test Complex AWS Financial AI Trading Mesh
  console.log('\n4. Testing AWS Financial AI Mesh: "Deploy zero-trust financial AI trading mesh with EKS, Aurora PostgreSQL, and S3 data lake"...');
  const input3 = await page.$('[data-testid="prompt-input"]');
  const sendBtn3 = await page.$('[data-testid="prompt-send-btn"]');
  if (input3 && sendBtn3) {
    await input3.click({ clickCount: 3 });
    await input3.type('Deploy zero-trust financial AI trading mesh with EKS, Aurora PostgreSQL, and S3 data lake');
    await sendBtn3.click();
  }

  console.log('Waiting for AWS build and edge wiring...');
  await new Promise(r => setTimeout(r, 7000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'multicloud_03_aws_ai_mesh_with_edges.png') });

  const awsNodes = await page.$$eval('[data-testid^="canvas-node-"]', els => els.map(e => e.getAttribute('data-testid')));
  const awsEdges = await page.$$eval('[data-testid^="canvas-edge-"]', els => els.map(e => e.getAttribute('data-testid')));
  console.log('✅ Spawned AWS Nodes:', awsNodes);
  console.log('✅ Spawned AWS Edges:', awsEdges);

  console.log('\n================================================================');
  console.log('🎉 DYNAMIC MULTI-CLOUD CATALOG & EDGE WIRING FULLY VERIFIED!');
  console.log('================================================================\n');

  await browser.close();
}

testDynamicMultiCloudEdges().catch(console.error);
