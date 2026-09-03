import { WebModelContextEngine } from './src/core/webmcp/WebModelContextEngine.js';
import { OptimisticStateEngine } from './src/core/state/OptimisticStateEngine.js';
import { registerTopologyTools } from './src/core/webmcp/tools/topologyTools.js';

async function run() {
  const stateEngine = new OptimisticStateEngine();
  const mcpEngine = new WebModelContextEngine(false);
  registerTopologyTools(mcpEngine, stateEngine);
  await mcpEngine.executeTool('create_resource_node', {
    id: 'test-node-1',
    type: 'aws_instance',
    name: 'Web Server',
    config: { instance_type: 't3.micro' },
    position: { x: 100, y: 100 }
  });
  
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(mcpEngine.executeTool('update_resource_node', {
      node_id: 'test-node-1',
      config_patch: { [`tags_${i}`]: `value_${i}` }
    }, { agentId: `ext-${i}` }));
  }
  
  const results = await Promise.all(promises);
  console.log(JSON.stringify(results, null, 2));
}
run();
