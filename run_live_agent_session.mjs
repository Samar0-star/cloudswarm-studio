import puppeteer from 'puppeteer-core';

async function startInteractiveSession() {
  console.log('🚀 Opening visible Chrome window on your Mac screen...');
  
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false, // VISIBLE WINDOW ON USER'S SCREEN
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  console.log('🌐 Navigating to CloudSwarm Studio at http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

  console.log('⚡ Ready! Acting as ChatGPT Desktop agent...');
  
  // Step 1: External Agent 1 creates VPC & Network Core
  await new Promise(r => setTimeout(r, 1500));
  console.log('🤖 [ChatGPT-1] Deploying Sovereign VPC & Subnets...');
  await page.evaluate(async () => {
    await window.modelContext.executeTool('create_resource_node', {
      id: 'ext-vpc-core',
      type: 'aws_vpc',
      name: 'Primary Sovereign Banking VPC',
      position: { x: 320, y: 120 }
    }, { agentId: 'ext-1' });
  });

  // Step 2: 4 Parallel Tool Calls hit the canvas simultaneously
  await new Promise(r => setTimeout(r, 1000));
  console.log('🤖 [ChatGPT-1..4] Firing 4 Simultaneous Parallel WebMCP Tools...');
  await page.evaluate(async () => {
    await Promise.all([
      window.modelContext.executeTool('create_resource_node', {
        id: 'ext-eks-cluster',
        type: 'aws_eks_cluster',
        name: 'Sovereign EKS Mesh',
        position: { x: 180, y: 380 }
      }, { agentId: 'ext-1' }),

      window.modelContext.executeTool('create_resource_node', {
        id: 'ext-db-aurora',
        type: 'aws_db_instance',
        name: 'Aurora Postgres Ledger',
        position: { x: 550, y: 380 }
      }, { agentId: 'ext-2' }),

      window.modelContext.executeTool('create_resource_node', {
        id: 'ext-s3-vault',
        type: 'aws_s3_bucket',
        name: 'Audit Lake Vault',
        position: { x: 920, y: 380 }
      }, { agentId: 'ext-3' }),

      window.modelContext.executeTool('create_resource_node', {
        id: 'ext-alb-ingress',
        type: 'aws_lb',
        name: 'Sovereign Ingress ALB',
        position: { x: 550, y: 120 }
      }, { agentId: 'ext-4' })
    ]);
  });

  // Step 3: Connect Edges & Harden with KMS
  await new Promise(r => setTimeout(r, 1200));
  console.log('🤖 [ChatGPT-2] Connecting topology edges & applying Zero-Trust policies...');
  await page.evaluate(async () => {
    await window.modelContext.executeTool('connect_resources', {
      source_id: 'ext-alb-ingress',
      target_id: 'ext-eks-cluster',
      edge_type: 'routes_to'
    }, { agentId: 'ext-2' });

    await window.modelContext.executeTool('connect_resources', {
      source_id: 'ext-eks-cluster',
      target_id: 'ext-db-aurora',
      edge_type: 'routes_to'
    }, { agentId: 'ext-2' });
  });

  // Step 4: Rapid multi-agent updates (Stress testing the spinlocks)
  await new Promise(r => setTimeout(r, 1200));
  console.log('🤖 [ChatGPT-3..4] Rapid concurrent updates to Aurora DB configuration...');
  await page.evaluate(async () => {
    await Promise.all([
      window.modelContext.executeTool('update_resource_node', {
        node_id: 'ext-db-aurora',
        config_patch: { storage_encrypted: true, kms_key_id: 'alias/aws/rds-banking' }
      }, { agentId: 'ext-3' }),

      window.modelContext.executeTool('update_resource_node', {
        node_id: 'ext-s3-vault',
        config_patch: { enforce_ssl: true, block_public_acls: true }
      }, { agentId: 'ext-4' })
    ]);
  });

  console.log('✅ All WebMCP operations applied live on your screen!');
  console.log('💡 Window remains open so you can interact with it live!');
}

startInteractiveSession().catch(console.error);
