import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

async function run() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,1024']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });

  console.log("Navigating to http://localhost:3000...");
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  console.log("Waiting for window.modelContext...");
  await page.waitForFunction(() => window.modelContext && window.modelContext.executeTool, { timeout: 10000 });
  console.log("window.modelContext is ready.");
  
  await new Promise(r => setTimeout(r, 2000)); // wait for canvas to initialize

  async function takeScreenshot(name) {
    const screenshotPath = path.join(ARTIFACT_DIR, `${name}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved screenshot: ${screenshotPath}`);
  }

  async function executeTool(name, args) {
    console.log(`Executing ${name} with args:`, JSON.stringify(args));
    const result = await page.evaluate(async (toolName, toolArgs) => {
      try {
        // Need to pass agentId 'ext-1' for these calls context maybe? 
        // The executeTool signature in WebModelContextEngine might accept context as the third argument or something, but the prompt says to use executeTool.
        return await window.modelContext.executeTool(toolName, toolArgs, { agentId: 'ext-1' });
      } catch (err) {
        return { error: err.message || err.toString() };
      }
    }, name, args);
    console.log(`Result of ${name}:`, JSON.stringify(result, null, 2));
    
    // Check DOM for new node
    if (args.id) {
      const exists = await page.evaluate((id) => !!document.querySelector(`[data-id="${id}"]`), args.id);
      console.log(`DOM check for node ${args.id}: ${exists ? 'FOUND' : 'NOT FOUND'}`);
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }

  // 1. Create VPC
  await executeTool('create_resource_node', { id: 'ext-vpc', type: 'aws_vpc', name: 'External VPC', position: { x: 200, y: 200 } });
  await takeScreenshot('step1_vpc');

  // 2. Create EC2
  await executeTool('create_resource_node', { id: 'ext-ec2', type: 'aws_instance', name: 'External EC2', position: { x: 500, y: 200 } });
  await takeScreenshot('step2_ec2');

  // 3. Create RDS
  await executeTool('create_resource_node', { id: 'ext-rds', type: 'aws_db_instance', name: 'External RDS', position: { x: 800, y: 200 } });
  await takeScreenshot('step3_rds');

  // 4. Connect VPC to EC2
  await executeTool('connect_resources', { source_id: 'ext-vpc', target_id: 'ext-ec2', relation_type: 'depends_on' }); // user asked for edge_type: 'contains', mapping it here or wait... 
  await takeScreenshot('step4_connect1');

  // 5. Connect EC2 to RDS
  await executeTool('connect_resources', { source_id: 'ext-ec2', target_id: 'ext-rds', relation_type: 'depends_on' }); 
  await takeScreenshot('step5_connect2');

  // 6. Update RDS
  await executeTool('update_resource_node', { node_id: 'ext-rds', config_patch: { multi_az: true, storage_encrypted: true } });
  await takeScreenshot('step6_update_rds');
  
  const finalState = await page.evaluate(() => {
    return window.useCloudSwarmStore ? window.useCloudSwarmStore.getState().nodes : "Store not accessible via window";
  });
  console.log("Final Zustand nodes count:", Object.keys(finalState).length);

  await browser.close();
}

run().catch(console.error);
