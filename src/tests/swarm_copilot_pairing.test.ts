import { useCloudSwarmStore } from '../store/useCloudSwarmStore';
import type { CloudResourceNode } from '../types/topology';

describe('Swarm Co-Pilot Live Pairing & Spatial Cursor Invariants', () => {
  beforeEach(() => {
    const testTopology = {
      nodes: {
        node_alpha_test: {
          id: 'node_alpha_test',
          name: 'h100_supercluster_test',
          type: 'aws_instance',
          position: { x: 400, y: 300 },
          config: {
            instance_type: 'p5.48xlarge',
            imds_v2: false,
            storage_encrypted: false,
          },
          version: 1,
          metadata: {
            createdBy: 'alpha',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            status: 'healthy',
          },
        } as CloudResourceNode,
        node_beta_test: {
          id: 'node_beta_test',
          name: 's3_training_lake',
          type: 'aws_s3_bucket',
          position: { x: 650, y: 300 },
          config: {
            bucket_name: 'llm-weights-lake',
          },
          version: 1,
          metadata: {
            createdBy: 'gamma',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            status: 'healthy',
          },
        } as CloudResourceNode,
      },
      edges: {},
      version: 1,
    };

    useCloudSwarmStore.getState().stateEngine.setState(testTopology);
    useCloudSwarmStore.setState({
      topologyState: testTopology,
      selectedNodeId: null,
      activeLocks: [],
    });
  });

  test('Core agents are hidden on canvas when not working and have valid non-negative coordinates', () => {
    const presences = useCloudSwarmStore.getState().agentPresences;
    for (const id of ['alpha', 'beta', 'gamma', 'delta'] as const) {
      const p = presences[id];
      expect(p).toBeDefined();
      expect(p.isVisible).toBe(false);
      expect(p.opacity).toBe(0);
      expect(p.targetX).toBeGreaterThanOrEqual(0);
      expect(p.targetY).toBeGreaterThanOrEqual(0);
      expect(p.actionLabel).toBe('Standing by');
    }
  });

  test('summonAgent glides Breach (beta) to the node and remediates security', async () => {
    const store = useCloudSwarmStore.getState();
    await store.summonAgent('beta', 'node_alpha_test', 'remediate');

    // Breach cursor should now be targeted at the node
    const breachPresence = useCloudSwarmStore.getState().agentPresences.beta;
    expect(breachPresence.activeNodeId).toBe('node_alpha_test');
    expect(breachPresence.targetX).toBe(400 + 120);
    expect(breachPresence.targetY).toBe(300 - 25);
    expect(breachPresence.isVisible).toBe(true);
    expect(breachPresence.opacity).toBe(1);

    // Node config should have imds_v2 and storage_encrypted set to true
    const updatedNode = useCloudSwarmStore.getState().topologyState.nodes['node_alpha_test'];
    expect(updatedNode?.config['imds_v2']).toBe(true);
    expect(updatedNode?.config['storage_encrypted']).toBe(true);
  });

  test('summonAgent autowire creates a smart connection between closest resources', async () => {
    const store = useCloudSwarmStore.getState();
    await store.summonAgent('alpha', 'node_alpha_test', 'autowire');

    const edges = Object.values(useCloudSwarmStore.getState().topologyState.edges);
    expect(edges.length).toBe(1);
    expect(edges[0]?.source).toBe('node_alpha_test');
    expect(edges[0]?.target).toBe('node_beta_test');
    expect(edges[0]?.label).toBe('CO-PILOT ROUTE');
  });

  test('summonAgent with chaos degrades node health', async () => {
    const store = useCloudSwarmStore.getState();
    await store.summonAgent('alpha', 'node_alpha_test', 'chaos');

    // Should immediately set warning status on metadata
    const node = useCloudSwarmStore.getState().topologyState.nodes['node_alpha_test'];
    expect(node?.metadata?.status).toBe('warning');
  });

  test('stopSwarmDemo transitions agents cleanly to standing by', () => {
    useCloudSwarmStore.getState().stopSwarmDemo();
    const presences = useCloudSwarmStore.getState().agentPresences;
    for (const id of ['alpha', 'beta', 'gamma', 'delta'] as const) {
      expect(presences[id].actionLabel).toBe('Standing by');
      expect(presences[id].isClicking).toBe(false);
    }
  });
});
