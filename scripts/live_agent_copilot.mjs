import http from 'http';

function fetchState() {
  return new Promise((resolve) => {
    http.get('http://localhost:3001/state', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ nodes: {}, edges: {} });
        }
      });
    }).on('error', () => resolve({ nodes: {}, edges: {} }));
  });
}

function callMcp(toolName, args, agentId = 'alpha') {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: { ...args, agentId }
      }
    });

    const req = http.request('http://localhost:3001/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function startCopilotWatcher() {
  console.log('🤖 [CloudSwarm Live Autonomous Co-Pilot] Active & Watching Canvas...');
  
  let knownNodeIds = new Set();
  let knownEdgeIds = new Set();
  let lastHandledSelectedId = null;
  let isActing = false;

  while (true) {
    await sleep(400);

    const state = await fetchState();
    const nodes = state.nodes || {};
    const edges = state.edges || {};
    const selectedId = state.selectedNodeId;
    const currentNodeIds = new Set(Object.keys(nodes));
    const currentEdgeIds = new Set(Object.keys(edges));

    // Detect if canvas was cleared
    if (currentNodeIds.size === 0 && knownNodeIds.size > 0) {
      console.log('🔄 [Co-Pilot] Detected canvas reset. Standing by for human actions.');
      knownNodeIds = new Set();
      knownEdgeIds = new Set();
      lastHandledSelectedId = null;
      continue;
    }

    // Detect new nodes placed by the human
    const addedNodeIds = [...currentNodeIds].filter(id => !knownNodeIds.has(id));
    for (const id of addedNodeIds) {
      knownNodeIds.add(id);
    }
    for (const id of Object.keys(edges)) {
      knownEdgeIds.add(id);
    }

    // If human placed a new node, help them collaboratively!
    for (const newId of addedNodeIds) {
      const node = nodes[newId];
      if (!node) continue;
      const isHumanPlaced = node.metadata?.createdBy === 'director' || node.metadata?.createdBy === 'human' || !node.metadata?.createdBy;
      
      if (isHumanPlaced && !isActing) {
        isActing = true;
        console.log(`👤 [Human Action Detected] Human placed: "${node.name}" (${node.type}) at (${node.position.x}, ${node.position.y})`);

        // Case 1: Human placed an Application Load Balancer
        if (node.type.includes('lb') || node.type.includes('gateway') || node.name.toLowerCase().includes('alb')) {
          console.log('⚡ [Breach Co-Pilot] Assisting: Attaching WAF OWASP Security Shield...');
          const wafId = `waf_${Date.now().toString(36)}`;
          await sleep(600);
          await callMcp('create_resource_node', {
            id: wafId,
            type: 'aws_wafv2_web_acl',
            name: 'WAF OWASP Top-10 Shield',
            position: { x: node.position.x + 320, y: node.position.y }
          }, 'beta');
          knownNodeIds.add(wafId);

          await sleep(500);
          console.log('🔗 [Breach Co-Pilot] Wiring WAF to ALB...');
          await callMcp('connect_resources', {
            source_id: wafId,
            target_id: newId,
            relation_type: 'attaches_to'
          }, 'beta');

          await sleep(400);
          await callMcp('calculate_topology_cost', {}, 'delta');
        }

        // Case 2: Human placed a Compute Node (VM / Container)
        else if (node.type.includes('instance') || node.type.includes('ecs') || node.type.includes('vm')) {
          // Check if there is an ALB without targets
          const existingAlb = Object.values(nodes).find(n => n.type.includes('lb') && n.id !== newId);
          if (existingAlb) {
            const hasEdge = Object.values(edges).some(e => e.source === existingAlb.id && e.target === newId);
            if (!hasEdge) {
              console.log(`🔗 [Atlas Co-Pilot] Assisting: Routing ALB traffic to "${node.name}"...`);
              await sleep(600);
              await callMcp('connect_resources', {
                source_id: existingAlb.id,
                target_id: newId,
                relation_type: 'routes_to',
                port: 443
              }, 'alpha');
            }
          }

          // Check if a database is needed
          const hasDb = Object.values(nodes).some(n => n.type.includes('db') || n.type.includes('sql') || n.type.includes('postgres'));
          if (!hasDb) {
            console.log('💾 [Forge Co-Pilot] Assisting: Synthesizing Multi-AZ Aurora DB tier...');
            const dbId = `db_${Date.now().toString(36)}`;
            await sleep(700);
            await callMcp('create_resource_node', {
              id: dbId,
              type: 'aws_db_instance',
              name: 'Aurora PostgreSQL Multi-AZ Primary',
              position: { x: node.position.x, y: node.position.y + 240 }
            }, 'gamma');
            knownNodeIds.add(dbId);

            await sleep(500);
            console.log('🔗 [Forge Co-Pilot] Wiring compute instance to database...');
            await callMcp('connect_resources', {
              source_id: newId,
              target_id: dbId,
              relation_type: 'connects_to',
              port: 5432
            }, 'gamma');

            await sleep(400);
            await callMcp('calculate_topology_cost', {}, 'delta');
          }
        }

        // Case 3: Human placed a Database
        else if (node.type.includes('db') || node.type.includes('sql') || node.type.includes('postgres')) {
          // Check if there is an unconnected compute node
          const existingCompute = Object.values(nodes).find(n => (n.type.includes('instance') || n.type.includes('ecs')) && n.id !== newId);
          if (existingCompute) {
            const hasEdge = Object.values(edges).some(e => (e.source === existingCompute.id && e.target === newId) || (e.source === newId && e.target === existingCompute.id));
            if (!hasEdge) {
              console.log(`🔗 [Forge Co-Pilot] Assisting: Wiring "${existingCompute.name}" to database...`);
              await sleep(600);
              await callMcp('connect_resources', {
                source_id: existingCompute.id,
                target_id: newId,
                relation_type: 'connects_to',
                port: 5432
              }, 'gamma');
            }
          }

          // Apply Zero-Trust hardening
          console.log(`🛡️ [Breach Co-Pilot] Hardening database with KMS encryption & Multi-AZ...`);
          await sleep(500);
          await callMcp('update_node_config', {
            node_id: newId,
            config: { storage_encrypted: true, multi_az: true, backup_retention_period: 7 }
          }, 'beta');

          await sleep(400);
          await callMcp('calculate_topology_cost', {}, 'delta');
        }

        isActing = false;
      }
    }

    // Detect if human selected / clicked a node to inspect
    if (selectedId && selectedId !== lastHandledSelectedId && !isActing) {
      lastHandledSelectedId = selectedId;
      const selNode = nodes[selectedId];
      if (selNode) {
        console.log(`🎯 [Human Selected Node] "${selNode.name}" (${selNode.type}). Co-Pilot auditing...`);
        isActing = true;
        // Glide delta to audit cost
        await callMcp('calculate_topology_cost', {}, 'delta');
        isActing = false;
      }
    }
  }
}

startCopilotWatcher().catch(console.error);
