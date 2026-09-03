import http from 'http';

const clients = new Set();
const actionHistory = [];
let actionIdCounter = Math.max(1000, Date.now());

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // SSE endpoint for Browser Tabs
  if (req.url === '/events' || req.url === '/api/webmcp/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('data: {"type":"CONNECTED"}\n\n');
    clients.add(res);
    console.log(`🔌 [Bridge] Browser connected via SSE. Active tabs: ${clients.size}`);

    req.on('close', () => {
      clients.delete(res);
      console.log(`🔌 [Bridge] Browser disconnected. Active tabs: ${clients.size}`);
    });
    return;
  }

  // Clear/drain queue endpoint for test isolation
  if (req.url?.startsWith('/clear') || req.url?.startsWith('/api/webmcp/clear') || req.url?.startsWith('/stop') || req.url?.startsWith('/api/webmcp/stop')) {
    const drained = actionHistory.length;
    actionHistory.length = 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'STOPPED', drained }));
    return;
  }

  // Polling endpoint for Browser Tabs (Offset-based broadcast: non-destructive ring buffer)
  if (req.url?.startsWith('/poll') || req.url?.startsWith('/api/webmcp/poll')) {
    const parsedUrl = new URL(req.url, 'http://127.0.0.1');
    const sinceParam = parsedUrl.searchParams.get('since');
    if (sinceParam !== 'latest') {
      console.log(`[Bridge Poll] since=${sinceParam}, latestId=${actionIdCounter}`);
    }

    let actionsToDeliver = [];
    if (sinceParam === 'latest') {
      actionsToDeliver = [];
    } else if (sinceParam !== null && sinceParam !== '') {
      const since = parseInt(sinceParam, 10);
      if (!isNaN(since)) {
        // If client's since is higher than current server counter, the bridge restarted: deliver current active actions
        if (since > actionIdCounter) {
          actionsToDeliver = actionHistory;
        } else {
          actionsToDeliver = actionHistory.filter(act => act._id > since);
        }
      }
    } else {
      actionsToDeliver = [];
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ actions: actionsToDeliver, latestId: actionIdCounter }));
    return;
  }

  // State synchronization endpoints for bi-directional live canvas state
  if (req.url === '/state' || req.url === '/api/webmcp/state') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const incoming = JSON.parse(body);
          const currentNodes = Object.keys(globalThis._latestTopologyState?.nodes || {}).length;
          const incomingNodes = Object.keys(incoming?.nodes || {}).length;

          // Protect active architecture from being wiped by an unhydrated tab mount
          if (currentNodes > 0 && incomingNodes === 0 && (incoming.version === 0 || !incoming.version)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'STATE_PRESERVED', nodeCount: currentNodes }));
            return;
          }

          globalThis._latestTopologyState = incoming;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'STATE_RECEIVED',
            nodeCount: Object.keys(globalThis._latestTopologyState?.nodes || {}).length,
            edgeCount: Object.keys(globalThis._latestTopologyState?.edges || {}).length
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    } else if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(globalThis._latestTopologyState || { nodes: {}, edges: {}, version: 0 }));
      return;
    }
  }

  // Tools discovery endpoint for MCP clients / ChatGPT Desktop
  const ALL_TOOLS = [
    {
      name: 'webmcp_list_tools',
      description: 'WebMCP discovery command: returns the complete array of interactive tools and JSON schemas registered by the active canvas session.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'webmcp_call_tool',
      description: 'WebMCP execution command: invokes a registered WebMCP tool by name with arguments.',
      inputSchema: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', description: 'Name of the tool to execute.' },
          arguments: { type: 'object', description: 'Arguments to pass to the tool.' },
          parameters: { type: 'object', description: 'Alternative parameters object.' }
        }
      }
    },
    {
      name: 'webmcp_execute_tool',
      description: 'Alias for webmcp_call_tool: executes a registered WebMCP tool by name with arguments.',
      inputSchema: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', description: 'Name of the tool to execute.' },
          arguments: { type: 'object', description: 'Arguments to pass to the tool.' },
          parameters: { type: 'object', description: 'Alternative parameters object.' }
        }
      }
    },
    { name: 'orchestrate_cloud_topology', description: 'Decomposes a high-level natural language prompt and synthesizes complete multi-cloud infrastructure.' },
    { name: 'create_resource_node', description: 'Instantiates a new cloud resource node on the canvas.' },
    { name: 'update_resource_node', description: 'Updates properties or configuration of an existing canvas node.' },
    { name: 'update_node_config', description: 'Updates granular configuration fields of a specific node.' },
    { name: 'connect_resources', description: 'Creates a directed edge between two cloud resources.' },
    { name: 'remove_resource_node', description: 'Deletes a resource node and its associated edges from canvas.' },
    { name: 'get_canvas_state', description: 'Returns the current complete topology snapshot of all nodes and edges.' },
    { name: 'clear_canvas', description: 'Resets the canvas to an empty root state.' },
    { name: 'canvas_clear', description: 'Alias for clear_canvas.' },
    { name: 'apply_canvas_layout', description: 'Deterministically organizes all canvas nodes into a balanced, non-overlapping 3-tier directional workflow DAG.' },
    { name: 'inspect_distributed_locks', description: 'Inspects active multi-agent distributed resource locks (StripedLockManager) across canvas nodes.' },
    { name: 'time_travel_to_step', description: 'Rewinds or fast-forwards the canvas topology to any historical commit step in the Decision DAG timeline.' },
    { name: 'fork_architecture_branch', description: 'Creates an isolated experimental architecture branch to test topology alternatives.' },
    { name: 'switch_architecture_branch', description: 'Switches the active visual canvas between branches.' },
    { name: 'compare_architecture_branches', description: 'Computes deep structural, cost, and security diffs between two branches.' },
    { name: 'get_dag_history', description: 'Returns the complete Decision DAG commit timeline, active branch, and historical state commits.' },
    { name: 'export_terraform_hcl', description: 'Compiles current visual canvas architecture into production-ready Terraform / OpenTofu HCL2 code.' },
    { name: 'import_terraform_hcl', description: 'Parses raw Terraform HCL2 code and materializes it into interactive cloud resource nodes and edges.' },
    { name: 'list_catalog_primitives', description: 'Queries the multi-cloud CAD catalog of 108 distinct cloud primitives across AWS, Azure, and GCP.' },
    { name: 'get_primitive_schema', description: 'Returns granular configuration schema, default settings, and pricing metrics for a specific cloud primitive type.' },
    { name: 'audit_iam_zero_trust', description: 'Audits topology for IAM least-privilege and CIS benchmark violations.' },
    { name: 'generate_least_privilege_policy', description: 'Generates scoped IAM policies with minimal necessary actions.' },
    { name: 'apply_security_hardening', description: 'Applies automated remediation patches to resolve security findings.' },
    { name: 'get_compliance_scorecard', description: 'Evaluates current topology against CIS Foundations Benchmark, PCI-DSS v3.2.1, and SOC2 Type II compliance frameworks.' },
    { name: 'query_resource_pricing', description: 'Queries live rate cards for a specific cloud resource type.' },
    { name: 'calculate_topology_cost', description: 'Calculates aggregate monthly run-rate ($/mo) for current topology.' },
    { name: 'optimize_cost_allocation', description: 'Applies FinOps rightsizing optimizations across the cluster.' },
    { name: 'get_finops_breakdown', description: 'Returns an executive FinOps cost breakdown grouped by cloud provider and architectural layer.' },
    { name: 'trigger_chaos_gorilla', description: 'Simulates a multi-AZ outage or node failure to test self-healing.' },
    { name: 'trigger_threat_attack', description: 'Simulates an adversary attack to test Zero-Trust intrusion defense.' },
    { name: 'trigger_self_healing', description: 'Dispatches autonomous multi-agent swarm remediation to isolate compromised resources and repair downed AZ instances.' },
    { name: 'get_active_incidents', description: 'Returns the list of active simulated infrastructure outages, chaos incidents, and Red-Team threat attacks.' }
  ];

  if (req.url === '/tools' || req.url === '/api/webmcp/tools' || req.url === '/mcp/tools' || req.url?.includes('webmcp_list_tools')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tools: ALL_TOOLS }));
    return;
  }

  // First-Class MCP GET & SSE Handlers (handles http://localhost:3001/mcp, /sse, /)
  if (req.method === 'GET' && (req.url === '/mcp' || req.url?.startsWith('/mcp?') || req.url === '/sse' || req.url?.startsWith('/sse?') || req.url === '/')) {
    const isSSE = req.headers.accept?.includes('text/event-stream') || req.url.includes('transport=sse');
    if (isSSE) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write('event: endpoint\ndata: /mcp\n\n');
      res.write('data: {"type":"CONNECTED","protocolVersion":"2024-11-05"}\n\n');
      clients.add(res);
      console.log(`🔌 [Bridge MCP SSE] Client connected on /mcp. Active clients: ${clients.size}`);
      req.on('close', () => {
        clients.delete(res);
        console.log(`🔌 [Bridge MCP SSE] Client disconnected. Active clients: ${clients.size}`);
      });
      return;
    }

    // Standard HTTP GET /mcp returns full MCP discovery & tools manifest
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ready',
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'cloudswarm-webmcp-bridge',
        version: '1.0.0'
      },
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true }
      },
      tools: ALL_TOOLS,
      resources: [
        { uri: 'cloudswarm://topology/current', name: 'Current Canvas Topology', mimeType: 'application/json' },
        { uri: 'cloudswarm://dag/history', name: 'Decision DAG Timeline & History', mimeType: 'application/json' },
        { uri: 'cloudswarm://terraform/hcl', name: 'Generated Terraform HCL Code', mimeType: 'text/plain' },
        { uri: 'cloudswarm://audit/security', name: 'Security & Zero-Trust Audit Report', mimeType: 'application/json' },
        { uri: 'cloudswarm://audit/finops', name: 'FinOps Cost Audit Report', mimeType: 'application/json' }
      ]
    }, null, 2));
    return;
  }

  // Universal MCP JSON-RPC 2.0 & REST POST Endpoint
  const isPost = req.method === 'POST';
  const isMcpPath = req.url === '/' || req.url?.startsWith('/mcp') || req.url === '/rpc' || req.url === '/execute' || req.url?.startsWith('/api/webmcp');

  if (isPost && isMcpPath) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');

        // Check if this is a standard MCP JSON-RPC 2.0 request
        if (payload.jsonrpc === '2.0' || (payload.method && typeof payload.method === 'string' && payload.id !== undefined)) {
          const id = payload.id ?? 1;
          const method = payload.method;

          if (method === 'initialize') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                  tools: { listChanged: true },
                  resources: { listChanged: true }
                },
                serverInfo: {
                  name: 'cloudswarm-webmcp-bridge',
                  version: '1.0.0'
                }
              }
            }));
            return;
          }

          if (method === 'notifications/initialized') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ jsonrpc: '2.0', id, result: {} }));
            return;
          }

          if (method === 'ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ jsonrpc: '2.0', id, result: {} }));
            return;
          }

          if (method === 'tools/list' || method === 'webmcp_list_tools') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id,
              result: {
                tools: ALL_TOOLS
              }
            }));
            return;
          }

          if (method === 'tools/call' || method === 'webmcp_call_tool' || method === 'webmcp_execute_tool') {
            let toolName = payload.params?.name || payload.params?.toolName;
            let toolParams = payload.params?.arguments || payload.params?.args || payload.params || {};

            // Handle direct webmcp_list_tools call
            if (toolName === 'webmcp_list_tools') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                jsonrpc: '2.0',
                id,
                result: {
                  content: [{ type: 'text', text: JSON.stringify(ALL_TOOLS, null, 2) }],
                  tools: ALL_TOOLS,
                  isError: false
                }
              }));
              return;
            }

            // Handle webmcp_call_tool forwarding
            if (toolName === 'webmcp_call_tool' || toolName === 'webmcp_execute_tool') {
              toolName = toolParams.name || toolParams.toolName || toolParams.tool;
              toolParams = toolParams.arguments || toolParams.params || toolParams.parameters || {};
            }

            // Multi-Agent Persona Resolution: Support 4 concurrent ChatGPT Desktop sessions!
            // Priority: 1. explicit payload agentId, 2. URL query ?agent=, 3. Header X-Agent-Id, 4. URL path /mcp/alpha, 5. tool-type classification
            const urlObj = new URL(req.url, 'http://127.0.0.1');
            const queryAgent = urlObj.searchParams.get('agent') || urlObj.searchParams.get('agentId');
            const headerAgent = req.headers['x-agent-id'] || req.headers['x-mcp-agent'];
            const pathMatch = req.url.match(/\/mcp\/(alpha|beta|gamma|delta|ext-1|ext-2|ext-3|ext-4|agent-[1-4])/i);
            const pathAgent = pathMatch ? pathMatch[1].toLowerCase().replace('agent-1', 'alpha').replace('agent-2', 'beta').replace('agent-3', 'gamma').replace('agent-4', 'delta') : null;

            let agentId = toolParams.agentId || queryAgent || headerAgent || pathAgent;
            if (!agentId) {
              const lowerTool = (toolName || '').toLowerCase();
              if (lowerTool.includes('security') || lowerTool.includes('iam') || lowerTool.includes('threat') || lowerTool.includes('waf') || lowerTool.includes('audit') || lowerTool.includes('policy') || lowerTool.includes('hardening')) {
                agentId = 'beta'; // Security Guardian
              } else if (lowerTool.includes('storage') || lowerTool.includes('database') || lowerTool.includes('db') || lowerTool.includes('s3') || lowerTool.includes('lustre') || lowerTool.includes('redis')) {
                agentId = 'gamma'; // Storage & DB Specialist
              } else if (lowerTool.includes('cost') || lowerTool.includes('pricing') || lowerTool.includes('finops') || lowerTool.includes('lock')) {
                agentId = 'delta'; // FinOps Auditor
              } else {
                agentId = 'alpha'; // Compute & Infra Architect
              }
            }
            const actionId = ++actionIdCounter;

            const actionItem = {
              _id: actionId,
              toolName,
              params: toolParams,
              agentId,
              timestamp: Date.now()
            };

            if (toolName === 'clear_canvas' || toolName === 'canvas_clear') {
              actionHistory.length = 0;
              globalThis._latestTopologyState = { nodes: {}, edges: {}, version: 0 };
            } else {
              if (!globalThis._latestTopologyState) {
                globalThis._latestTopologyState = { nodes: {}, edges: {}, version: 0 };
              }
              if (toolName === 'create_resource_node') {
                const nId = String(toolParams.id || toolParams.node_id || `node_${Date.now()}`);
                globalThis._latestTopologyState.nodes[nId] = {
                  id: nId,
                  type: toolParams.type || 'aws_instance',
                  name: toolParams.name || nId,
                  position: toolParams.position || { x: 400, y: 200 },
                  config: toolParams.config || {},
                  metadata: { createdBy: agentId, createdAt: Date.now(), updatedAt: Date.now(), status: 'healthy' },
                  version: 1
                };
                globalThis._latestTopologyState.version = (globalThis._latestTopologyState.version || 0) + 1;
              } else if (toolName === 'connect_resources') {
                const src = toolParams.source_id || toolParams.source;
                const tgt = toolParams.target_id || toolParams.target;
                if (src && tgt) {
                  const edgeId = `edge_${src}_${tgt}_${Date.now()}`;
                  globalThis._latestTopologyState.edges[edgeId] = {
                    id: edgeId,
                    source: src,
                    target: tgt,
                    type: toolParams.relation_type || 'routes_to',
                    port: toolParams.port,
                    protocol: toolParams.protocol || (toolParams.port ? 'tcp' : undefined),
                    version: 1
                  };
                  globalThis._latestTopologyState.version = (globalThis._latestTopologyState.version || 0) + 1;
                }
              } else if (toolName === 'remove_resource_node') {
                const nId = toolParams.id || toolParams.node_id;
                if (nId && globalThis._latestTopologyState.nodes[nId]) {
                  delete globalThis._latestTopologyState.nodes[nId];
                  for (const eId of Object.keys(globalThis._latestTopologyState.edges || {})) {
                    const ed = globalThis._latestTopologyState.edges[eId];
                    if (ed && (ed.source === nId || ed.target === nId)) {
                      delete globalThis._latestTopologyState.edges[eId];
                    }
                  }
                  globalThis._latestTopologyState.version = (globalThis._latestTopologyState.version || 0) + 1;
                }
              }
            }

            actionHistory.push(actionItem);
            if (actionHistory.length > 500) actionHistory.shift();

            if (clients.size > 0) {
              const eventData = `data: ${JSON.stringify(actionItem)}\n\n`;
              for (const client of clients) {
                client.write(eventData);
              }
            }

            console.log(`🚀 [Bridge JSON-RPC] Dispatched tool call (#${actionId}) [${agentId}]: ${toolName}`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  { type: 'text', text: `Action '${toolName}' queued and executing on live canvas.` }
                ],
                isError: false,
                meta: { actionId, queueSize: actionHistory.length }
              }
            }));
            return;
          }

          if (method === 'resources/list') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id,
              result: {
                resources: [
                  { uri: 'cloudswarm://topology/current', name: 'Current Canvas Topology', mimeType: 'application/json' },
                  { uri: 'cloudswarm://dag/history', name: 'Decision DAG Timeline & History', mimeType: 'application/json' },
                  { uri: 'cloudswarm://terraform/hcl', name: 'Generated Terraform HCL Code', mimeType: 'text/plain' },
                  { uri: 'cloudswarm://audit/security', name: 'Security & Zero-Trust Audit Report', mimeType: 'application/json' },
                  { uri: 'cloudswarm://audit/finops', name: 'FinOps Cost Audit Report', mimeType: 'application/json' }
                ]
              }
            }));
            return;
          }

          if (method === 'resources/read') {
            const uri = payload.params?.uri || 'cloudswarm://topology/current';
            const stateText = JSON.stringify(globalThis._latestTopologyState || { nodes: {}, edges: {}, version: 0 });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id,
              result: {
                contents: [{ uri, mimeType: 'application/json', text: stateText }]
              }
            }));
            return;
          }
        }

        // Standard REST payload handling
        payload.toolName = payload.toolName || payload.method || payload.tool || payload.name;
        payload.params = payload.params || payload.args || payload.parameters || {};
        payload.agentId = payload.agentId || payload.params?.agentId || 'alpha';
        payload._id = ++actionIdCounter;
        console.log(`🚀 [Bridge REST] Dispatching tool call (#${payload._id}) [${payload.agentId}]: ${payload.toolName}`);
        
        actionHistory.push(payload);
        if (actionHistory.length > 500) actionHistory.shift();

        if (clients.size > 0) {
          const eventData = `data: ${JSON.stringify(payload)}\n\n`;
          for (const client of clients) {
            client.write(eventData);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'DELIVERED_AND_QUEUED',
          id: payload._id,
          activeClients: clients.size,
          queueSize: actionHistory.length
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(3001, '0.0.0.0', () => {
  console.log('⚡ WebMCP Terminal-to-Browser Live Bridge running on http://127.0.0.1:3001 (0.0.0.0:3001)');
});
