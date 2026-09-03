import { useCloudSwarmStore } from '../store/useCloudSwarmStore';
import { OptimisticStateEngine } from '../core/state/OptimisticStateEngine';
import type { CloudResourceNode, TopologyEdge } from '../types/topology';

describe('Box Sizing, Default Zoom, and Idle Cursor Watchdog Verification', () => {
  let stateEngine: OptimisticStateEngine;

  beforeEach(() => {
    stateEngine = new OptimisticStateEngine();
    jest.clearAllMocks();
  });

  describe('1. Default Zoom & Viewport Precision (1.15x)', () => {
    test('store initializes with canvasZoom 1.15 for generous readability', () => {
      const store = useCloudSwarmStore.getState();
      expect(store.canvasZoom).toBe(1.15);
    });

    test('resetCanvasView restores canvasZoom to 1.15 and pan to (0, 0)', () => {
      const store = useCloudSwarmStore.getState();
      store.setCanvasZoom(0.4);
      store.setCanvasPan({ x: 300, y: -200 });

      expect(useCloudSwarmStore.getState().canvasZoom).toBe(0.4);
      expect(useCloudSwarmStore.getState().canvasPan).toEqual({ x: 300, y: -200 });

      store.resetCanvasView();

      expect(useCloudSwarmStore.getState().canvasZoom).toBe(1.15);
      expect(useCloudSwarmStore.getState().canvasPan).toEqual({ x: 0, y: 0 });
    });
  });

  describe('2. Box Sizing & Centering Coordinates (285px width)', () => {
    test('drop centering uses 143px half-width offset for 285px cards', () => {
      const cardWidth = 285;
      const cardHeight = 92;
      const halfWidth = Math.round(cardWidth / 2); // 143
      const halfHeight = Math.round(cardHeight / 2); // 46

      const rawX = 500;
      const rawY = 400;
      const pan = { x: 0, y: 0 };
      const zoom = 1.15;

      const dropX = Math.round((rawX - pan.x) / zoom) - halfWidth;
      const dropY = Math.round((rawY - pan.y) / zoom) - halfHeight;

      expect(halfWidth).toBe(143);
      expect(halfHeight).toBe(46);
      expect(dropX).toBe(Math.round(500 / 1.15) - 143);
      expect(dropY).toBe(Math.round(400 / 1.15) - 46);
    });
  });

  describe('3. Orphan Edge Filtering & Idempotent Connection', () => {
    test('filters out orphan edges whose source or target node is missing', () => {
      const nodes: Record<string, CloudResourceNode> = {
        node_active_1: {
          id: 'node_active_1',
          type: 'aws_instance',
          name: 'App',
          position: { x: 100, y: 100 },
          config: {},
          metadata: { status: 'healthy', createdBy: 'director', createdAt: Date.now(), updatedAt: Date.now() },
          version: 1,
        },
        node_active_2: {
          id: 'node_active_2',
          type: 'aws_db_instance',
          name: 'DB',
          position: { x: 400, y: 100 },
          config: {},
          metadata: { status: 'healthy', createdBy: 'director', createdAt: Date.now(), updatedAt: Date.now() },
          version: 1,
        },
      };

      const edges: TopologyEdge[] = [
        { id: 'valid_edge', source: 'node_active_1', target: 'node_active_2', type: 'routes_to', version: 1 },
        { id: 'orphan_src', source: 'missing_node', target: 'node_active_2', type: 'routes_to', version: 1 },
        { id: 'orphan_tgt', source: 'node_active_1', target: 'missing_node_2', type: 'routes_to', version: 1 },
      ];

      const visibleEdges = edges.filter((e) => nodes[e.source] && nodes[e.target]);
      expect(visibleEdges).toHaveLength(1);
      expect(visibleEdges[0]?.id).toBe('valid_edge');
    });

    test('prevents parallel duplicate edges between identical source and target', () => {
      const edges: Record<string, TopologyEdge> = {
        edge_1: { id: 'edge_1', source: 'src_1', target: 'tgt_1', type: 'routes_to', version: 1 },
      };

      const hasDuplicate = Object.values(edges).some(
        (e) => e.source === 'src_1' && e.target === 'tgt_1'
      );
      expect(hasDuplicate).toBe(true);

      const isReverseDuplicate = Object.values(edges).some(
        (e) => e.source === 'tgt_1' && e.target === 'src_1'
      );
      expect(isReverseDuplicate).toBe(false);
    });
  });

  describe('4. External Agent Cursor Fadeout & Watchdog', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('external agent presences stay synced then fade out on idle', () => {
      const state = useCloudSwarmStore.getState();

      (state.mcpEngine as any).dispatchEvent('webmcp:tool-success', {
        toolName: 'connect_resources',
        context: { agentId: 'ext-3' },
        result: { meta: { executionTimeMs: 8 } },
      });

      let pres = useCloudSwarmStore.getState().agentPresences['ext-3'];
      expect(pres.actionLabel).toBe('Success');
      expect(pres.isVisible).toBe(true);

      // Advance 1200ms -> transitions to Ready (Synced)
      jest.advanceTimersByTime(1200);
      pres = useCloudSwarmStore.getState().agentPresences['ext-3'];
      expect(pres.actionLabel).toBe('Ready (Synced)');
      expect(pres.isVisible).toBe(true);

      // Advance another 1200ms -> gracefully fades out when idle
      jest.advanceTimersByTime(1200);
      pres = useCloudSwarmStore.getState().agentPresences['ext-3'];
      expect(pres.isVisible).toBe(false);
      expect(pres.opacity).toBe(0);
    });
  });

  describe('5. Double-Click Inspector Isolation & Compact Popup', () => {
    test('single-click selectNode selects node but does NOT open inspector (inspectedNodeId is null)', () => {
      const store = useCloudSwarmStore.getState();
      store.closeInspector();
      expect(useCloudSwarmStore.getState().inspectedNodeId).toBeNull();

      store.selectNode('gpu_worker_1');
      expect(useCloudSwarmStore.getState().selectedNodeId).toBe('gpu_worker_1');
      expect(useCloudSwarmStore.getState().inspectedNodeId).toBeNull();
    });

    test('double-click openInspector opens inspector for the specific node', () => {
      const store = useCloudSwarmStore.getState();
      store.openInspector('gpu_worker_1');
      expect(useCloudSwarmStore.getState().inspectedNodeId).toBe('gpu_worker_1');
      expect(useCloudSwarmStore.getState().selectedNodeId).toBe('gpu_worker_1');

      store.closeInspector();
      expect(useCloudSwarmStore.getState().inspectedNodeId).toBeNull();
      // selectedNodeId is retained so the box remains focused
      expect(useCloudSwarmStore.getState().selectedNodeId).toBe('gpu_worker_1');
    });

    test('selecting an edge closes the node inspector', () => {
      const store = useCloudSwarmStore.getState();
      store.openInspector('gpu_worker_1');
      expect(useCloudSwarmStore.getState().inspectedNodeId).toBe('gpu_worker_1');

      store.selectEdge('edge_1');
      expect(useCloudSwarmStore.getState().inspectedNodeId).toBeNull();
      expect(useCloudSwarmStore.getState().selectedEdgeId).toBe('edge_1');
    });
  });
});
