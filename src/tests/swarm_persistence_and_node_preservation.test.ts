import { useCloudSwarmStore } from '../store/useCloudSwarmStore';
import type { CloudResourceNode } from '../types/topology';
import type { AgentId } from '../types/swarm';

describe('Swarm Persistence, Node Preservation, and 4-Agent Concurrent Visibility', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useCloudSwarmStore.getState();
    store.stateEngine.setState({ nodes: {}, edges: {}, version: 1 });
    useCloudSwarmStore.setState({
      topologyState: { nodes: {}, edges: {}, version: 1 },
      isSimulating: false,
      simulationProgress: 0,
      inspectedNodeId: null,
      selectedNodeId: null,
    });
  });

  test('runSwarmDemo preserves existing human-placed nodes rather than nuking canvas', async () => {
    const store = useCloudSwarmStore.getState();

    // 1. Human user adds a custom node (e.g. user-placed GPU instance)
    const humanNode: CloudResourceNode = {
      id: 'custom_human_gpu_1',
      type: 'aws_instance_gpu',
      name: 'Human Custom GPU Node',
      position: { x: 420, y: 350 },
      config: { instance_type: 'g5.2xlarge' },
      metadata: {
        createdBy: 'human',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'healthy',
      },
      version: 1,
    };

    store.addNode(humanNode);
    expect(useCloudSwarmStore.getState().topologyState.nodes['custom_human_gpu_1']).toBeDefined();

    // 2. Trigger runSwarmDemo for ecommerce_ha
    const runPromise = store.runSwarmDemo('ecommerce_ha');

    // Verify immediately that human node was NOT erased at the start of runSwarmDemo
    const intermediateNodes = useCloudSwarmStore.getState().topologyState.nodes;
    expect(intermediateNodes['custom_human_gpu_1']).toBeDefined();
    expect(intermediateNodes['custom_human_gpu_1']?.name).toBe('Human Custom GPU Node');

    // Wait for simulation to finish
    await runPromise;

    // Verify human node is still present after scenario completes
    const finalNodes = useCloudSwarmStore.getState().topologyState.nodes;
    expect(finalNodes['custom_human_gpu_1']).toBeDefined();
    expect(finalNodes['custom_human_gpu_1']?.position).toEqual({ x: 420, y: 350 });
  });

  test('All 4 agents are concurrently visible and active during swarm simulation', async () => {
    const store = useCloudSwarmStore.getState();

    const runPromise = store.runSwarmDemo('fintech_zerotrust');

    // Check agent presences
    const presences = useCloudSwarmStore.getState().agentPresences;
    const requiredAgents: AgentId[] = ['alpha', 'beta', 'gamma', 'delta'];

    for (const agentId of requiredAgents) {
      expect(presences[agentId]).toBeDefined();
      expect(presences[agentId]?.isVisible).toBe(true);
      expect(presences[agentId]?.opacity).toBe(1);
      expect(presences[agentId]?.actionLabel).toBeDefined();
      expect(presences[agentId]?.thoughtText).toBeTruthy();
    }

    await runPromise;
  });

  test('Agents transition to calm Standing by status on simulation settlement', async () => {
    jest.useFakeTimers();
    const store = useCloudSwarmStore.getState();

    const runPromise = store.runSwarmDemo('microservices_mesh');
    await runPromise;

    // Fast-forward 2000ms for standing-by transition
    jest.advanceTimersByTime(2100);

    const presences = useCloudSwarmStore.getState().agentPresences;
    for (const agentId of ['alpha', 'beta', 'gamma', 'delta'] as AgentId[]) {
      expect(presences[agentId]?.actionLabel).toBe('Standing by');
      expect(presences[agentId]?.isClicking).toBe(false);
      expect(presences[agentId]?.isDragging).toBe(false);
    }

    jest.useRealTimers();
  });

  test('DAG timeline uses getBranchTimeline for 1-to-1 scrubbing accuracy', async () => {
    const store = useCloudSwarmStore.getState();
    await store.runSwarmDemo('ecommerce_ha');

    const timeline = useCloudSwarmStore.getState().dagTimeline;
    expect(Array.isArray(timeline)).toBe(true);
    expect(timeline.length).toBeGreaterThan(0);

    // Active commit should match the tip of branch timeline
    const activeCommitId = useCloudSwarmStore.getState().activeCommitId;
    expect(activeCommitId).toBe(timeline[timeline.length - 1]?.id);
  });
});
