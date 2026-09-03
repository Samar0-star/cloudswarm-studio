import { WebModelContextEngine } from '../core/webmcp/WebModelContextEngine';
import { OptimisticStateEngine } from '../core/state/OptimisticStateEngine';
import {
  createResourceNodeTool,
  createConnectResourcesTool,
} from '../core/webmcp/tools/topologyTools';
import { useCloudSwarmStore } from '../store/useCloudSwarmStore';

describe('WebMCP Precision Cursor & Topology Orchestration Fixes', () => {
  let mcpEngine: WebModelContextEngine;
  let stateEngine: OptimisticStateEngine;

  beforeEach(() => {
    mcpEngine = new WebModelContextEngine(false);
    stateEngine = new OptimisticStateEngine();
  });

  describe('createResourceNodeTool non-overlapping staggered positions', () => {
    test('calculates staggered default positions when position is omitted', async () => {
      const tool = createResourceNodeTool(stateEngine);

      // Node 0
      const res0 = await tool.execute({
        id: 'node-0',
        type: 'aws_vpc',
        name: 'Node 0',
      });
      expect(res0.isError).toBeFalsy();
      const node0 = JSON.parse(res0.content?.[0]?.text ?? '{}');
      expect(node0.position).toEqual({ x: 180, y: 140 });

      // Node 1
      const res1 = await tool.execute({
        id: 'node-1',
        type: 'aws_subnet',
        name: 'Node 1',
      });
      const node1 = JSON.parse(res1.content?.[0]?.text ?? '{}');
      expect(node1.position).toEqual({ x: 180 + 280, y: 140 });

      // Node 2 & 3
      await tool.execute({ id: 'node-2', type: 'aws_subnet', name: 'Node 2' });
      await tool.execute({ id: 'node-3', type: 'aws_subnet', name: 'Node 3' });

      // Node 4 (wraps to next row: index 4 => 4 % 4 = 0, Math.floor(4/4) = 1)
      const res4 = await tool.execute({
        id: 'node-4',
        type: 'aws_instance',
        name: 'Node 4',
      });
      const node4 = JSON.parse(res4.content?.[0]?.text ?? '{}');
      expect(node4.position).toEqual({ x: 180, y: 140 + 160 });
    });

    test('preserves explicit position when provided', async () => {
      const tool = createResourceNodeTool(stateEngine);
      const res = await tool.execute({
        id: 'custom-node',
        type: 'aws_s3_bucket',
        name: 'Custom S3',
        position: { x: 750, y: 420 },
      });
      expect(res.isError).toBeFalsy();
      const node = JSON.parse(res.content?.[0]?.text ?? '{}');
      expect(node.position).toEqual({ x: 750, y: 420 });
    });
  });

  describe('createConnectResourcesTool edge_type & alias mapping', () => {
    beforeEach(async () => {
      await stateEngine.addNode({
        id: 'eks-cluster',
        type: 'aws_eks_cluster',
        name: 'EKS Primary',
        position: { x: 200, y: 200 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now(), status: 'healthy' },
        version: 1,
      }, 'alpha');

      await stateEngine.addNode({
        id: 'rds-db',
        type: 'aws_db_instance',
        name: 'Aurora Ledger',
        position: { x: 600, y: 200 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now(), status: 'healthy' },
        version: 1,
      }, 'alpha');
    });

    test('accepts edge_type alias and maps reads_from to stores_in', async () => {
      const tool = createConnectResourcesTool(stateEngine);
      const res = await tool.execute({
        source_id: 'eks-cluster',
        target_id: 'rds-db',
        edge_type: 'reads_from',
      });
      expect(res.isError).toBeFalsy();
      const edge = JSON.parse(res.content?.[0]?.text ?? '{}');
      expect(edge.type).toBe('stores_in');
    });

    test('maps aliases correctly: contains, data_pipeline, cache_sync, webhook_trigger', async () => {
      const tool = createConnectResourcesTool(stateEngine);

      const aliases: Array<{ input: string; expected: string }> = [
        { input: 'contains', expected: 'attached_to' },
        { input: 'data_pipeline', expected: 'network_flow' },
        { input: 'cache_sync', expected: 'network_flow' },
        { input: 'webhook_trigger', expected: 'network_flow' },
        { input: 'routes_to', expected: 'routes_to' },
      ];

      for (const { input, expected } of aliases) {
        const res = await tool.execute({
          source_id: 'eks-cluster',
          target_id: 'rds-db',
          relation_type: input,
        });
        expect(res.isError).toBeFalsy();
        const edge = JSON.parse(res.content?.[0]?.text ?? '{}');
        expect(edge.type).toBe(expected);
      }
    });

    test('defaults relation_type to depends_on when omitted', async () => {
      const tool = createConnectResourcesTool(stateEngine);
      const res = await tool.execute({
        source_id: 'eks-cluster',
        target_id: 'rds-db',
      });
      expect(res.isError).toBeFalsy();
      const edge = JSON.parse(res.content?.[0]?.text ?? '{}');
      expect(edge.type).toBe('depends_on');
    });

    test('resolves resource by name if name was supplied as node id', async () => {
      const tool = createConnectResourcesTool(stateEngine);
      const res = await tool.execute({
        source_id: 'EKS Primary',
        target_id: 'Aurora Ledger',
      });
      expect(res.isError).toBeFalsy();
      const edge = JSON.parse(res.content?.[0]?.text ?? '{}');
      expect(edge.source).toBe('eks-cluster');
      expect(edge.target).toBe('rds-db');
    });
  });

  describe('useCloudSwarmStore multiplayer agent presences & lifecycle', () => {
    test('initialPresences cleanly defines ext-1 through ext-4', () => {
      const state = useCloudSwarmStore.getState();
      for (const id of ['ext-1', 'ext-2', 'ext-3', 'ext-4'] as const) {
        const pres = state.agentPresences[id];
        expect(pres).toBeDefined();
        expect(pres.agentId).toBe(id);
        expect(pres.actionLabel).toBe('Standing by');
      }
    });

    test('tool-call targets exact node center and dispatches isClicking: true', async () => {
      const state = useCloudSwarmStore.getState();
      await state.stateEngine.addNode({
        id: 'target-node-center',
        type: 'aws_instance',
        name: 'App Server',
        position: { x: 300, y: 150 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now(), status: 'healthy' },
        version: 1,
      }, 'alpha');

      // Dispatch simulated webmcp:tool-call
      (state.mcpEngine as any).dispatchEvent('webmcp:tool-call', {
        toolName: 'update_resource_node',
        params: { node_id: 'target-node-center' },
        context: { agentId: 'ext-1' },
      });

      const pres = useCloudSwarmStore.getState().agentPresences['ext-1'];
      expect(pres.targetX).toBe(300 + 115);
      expect(pres.targetY).toBe(150 + 40);
      expect(pres.isClicking).toBe(true);
      expect(pres.isVisible).toBe(true);
    });

    test('tool-success does not vanish cursor and updates label to Ready (Synced)', async () => {
      jest.useFakeTimers();
      const state = useCloudSwarmStore.getState();

      (state.mcpEngine as any).dispatchEvent('webmcp:tool-success', {
        toolName: 'update_resource_node',
        context: { agentId: 'ext-2' },
        result: { meta: { executionTimeMs: 12 } },
      });

      let pres = useCloudSwarmStore.getState().agentPresences['ext-2'];
      expect(pres.actionLabel).toBe('Success');
      expect(pres.isVisible).toBe(true);

      // Fast-forward 1200ms
      jest.advanceTimersByTime(1200);

      pres = useCloudSwarmStore.getState().agentPresences['ext-2'];
      expect(pres.actionLabel).toBe('Ready (Synced)');
      expect(pres.isVisible).toBe(true);
      expect(pres.opacity).toBe(1);

      jest.useRealTimers();
    });
  });

  describe('connect_resources multi-hop cursor animation', () => {
    test('animates source click and then target click after 250ms', () => {
      jest.useFakeTimers();
      const state = useCloudSwarmStore.getState();

      const sourceId = 'src-hop-node';
      const targetId = 'tgt-hop-node';

      state.stateEngine.addNode({
        id: sourceId,
        type: 'aws_instance',
        name: 'Web Front',
        position: { x: 100, y: 100 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now(), status: 'healthy' },
        version: 1,
      }, 'alpha');

      state.stateEngine.addNode({
        id: targetId,
        type: 'aws_db_instance',
        name: 'Database Back',
        position: { x: 500, y: 300 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now(), status: 'healthy' },
        version: 1,
      }, 'alpha');

      (state.mcpEngine as any).dispatchEvent('webmcp:tool-call', {
        toolName: 'connect_resources',
        params: { source_id: sourceId, target_id: targetId },
        context: { agentId: 'ext-3' },
      });

      // Hop 1: source node
      let pres = useCloudSwarmStore.getState().agentPresences['ext-3'];
      expect(pres.targetX).toBe(100 + 115);
      expect(pres.targetY).toBe(100 + 40);
      expect(pres.isClicking).toBe(true);
      expect(pres.actionLabel).toContain('Connecting Web Front');

      // Fast-forward 250ms: Hop 2 to target node
      jest.advanceTimersByTime(250);

      pres = useCloudSwarmStore.getState().agentPresences['ext-3'];
      expect(pres.targetX).toBe(500 + 115);
      expect(pres.targetY).toBe(300 + 40);
      expect(pres.isClicking).toBe(true);
      expect(pres.actionLabel).toContain('Linking to Database Back');

      jest.useRealTimers();
    });
  });
});
