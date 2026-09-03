import { OptimisticStateEngine } from '../core/state/OptimisticStateEngine';
import { autoConnectTopology } from '../core/layout/autoLayout';
import type { CloudResourceNode, TopologyEdge, TopologyState } from '../types/topology';

function makeTestNode(partial: Partial<CloudResourceNode> & { id: string; type: CloudResourceNode['type']; name: string; position: { x: number; y: number } }): CloudResourceNode {
  return {
    config: {},
    version: 1,
    metadata: {
      createdBy: 'director',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'healthy',
    },
    ...partial,
  };
}

describe('Interactive Node Connection & Human-Agent Collaboration', () => {
  let stateEngine: OptimisticStateEngine;

  beforeEach(() => {
    stateEngine = new OptimisticStateEngine();
  });

  describe('Interactive Edge Management', () => {
    test('human user can add direct directed edges between any two nodes', async () => {
      const nodeA = makeTestNode({
        id: 'user_ec2_app',
        type: 'aws_instance',
        name: 'Human App Server',
        position: { x: 200, y: 200 },
      });
      const nodeB = makeTestNode({
        id: 'user_rds_db',
        type: 'aws_db_instance',
        name: 'Human Postgres DB',
        position: { x: 600, y: 200 },
      });

      await stateEngine.addNode(nodeA, 'director');
      await stateEngine.addNode(nodeB, 'director');

      const edge: TopologyEdge = {
        id: 'edge_user_app_to_db',
        source: 'user_ec2_app',
        target: 'user_rds_db',
        type: 'reads_from',
        label: 'TCP:5432',
        port: 5432,
        protocol: 'tcp',
        version: 1,
      };

      const result = await stateEngine.addEdge(edge, 'director');
      expect(result.success).toBe(true);

      const state = stateEngine.getState();
      expect(state.edges['edge_user_app_to_db']).toBeDefined();
      expect(state.edges['edge_user_app_to_db']?.source).toBe('user_ec2_app');
      expect(state.edges['edge_user_app_to_db']?.target).toBe('user_rds_db');
      expect(state.edges['edge_user_app_to_db']?.type).toBe('reads_from');
      expect(state.edges['edge_user_app_to_db']?.port).toBe(5432);
    });

    test('human user can disconnect an edge via 1-click delete', async () => {
      const nodeA = makeTestNode({
        id: 'user_lb',
        type: 'aws_lb',
        name: 'App Load Balancer',
        position: { x: 100, y: 100 },
      });
      const nodeB = makeTestNode({
        id: 'user_ec2',
        type: 'aws_instance',
        name: 'Target EC2',
        position: { x: 400, y: 100 },
      });

      await stateEngine.addNode(nodeA, 'director');
      await stateEngine.addNode(nodeB, 'director');

      await stateEngine.addEdge(
        {
          id: 'edge_lb_ec2',
          source: 'user_lb',
          target: 'user_ec2',
          type: 'routes_to',
          label: 'PORT:443',
          version: 1,
        },
        'director'
      );

      expect(stateEngine.getState().edges['edge_lb_ec2']).toBeDefined();

      // Delete the edge
      const delResult = await stateEngine.removeEdge('edge_lb_ec2', 'director');
      expect(delResult.success).toBe(true);
      expect(stateEngine.getState().edges['edge_lb_ec2']).toBeUndefined();
    });
  });

  describe('Auto-Connect of Human-Placed Loose Boxes', () => {
    test('autoConnectTopology links loose human-placed boxes into the architecture mesh', () => {
      // Simulate human user placing a VPC, a loose EC2, and a loose S3 bucket
      const initialState: TopologyState = {
        nodes: {
          vpc_main: makeTestNode({
            id: 'vpc_main',
            type: 'aws_vpc',
            name: 'Main VPC',
            position: { x: 50, y: 50 },
            width: 800,
            height: 600,
            config: { cidr_block: '10.0.0.0/16' },
          }),
          subnet_pub: makeTestNode({
            id: 'subnet_pub',
            type: 'aws_subnet',
            name: 'Public Subnet',
            position: { x: 100, y: 120 },
            config: { cidr_block: '10.0.1.0/24', is_public: true },
          }),
          user_dragged_ec2: makeTestNode({
            id: 'user_dragged_ec2',
            type: 'aws_instance',
            name: 'Human Placed Web Worker',
            position: { x: 300, y: 200 },
            config: { instance_type: 't3.large' },
          }),
          user_dragged_s3: makeTestNode({
            id: 'user_dragged_s3',
            type: 'aws_s3_bucket',
            name: 'Human Placed Audit Bucket',
            position: { x: 700, y: 200 },
          }),
        },
        edges: {},
        version: 1,
      };

      // Initially 0 edges
      expect(Object.keys(initialState.edges).length).toBe(0);

      // Run autoConnectTopology
      const connected = autoConnectTopology(initialState);
      const edgeValues = Object.values(connected.edges);

      // Verify human placed nodes are NOT ignored and are fully wired
      expect(edgeValues.length).toBeGreaterThan(0);

      // VPC connects to subnet
      const vpcToSubnet = edgeValues.find(
        (e) => e.source === 'vpc_main' && e.target === 'subnet_pub'
      );
      expect(vpcToSubnet).toBeDefined();

      // EC2 is connected to S3 storage
      const ec2ToS3 = edgeValues.find(
        (e) => e.source === 'user_dragged_ec2' && e.target === 'user_dragged_s3'
      );
      expect(ec2ToS3).toBeDefined();
      expect(ec2ToS3?.type).toBe('stores_in');
    });

    test('retains all existing edges while connecting newly placed human nodes', () => {
      const stateWithExistingEdge: TopologyState = {
        nodes: {
          alb: makeTestNode({
            id: 'alb',
            type: 'aws_lb',
            name: 'Ingress ALB',
            position: { x: 100, y: 100 },
          }),
          ec2_1: makeTestNode({
            id: 'ec2_1',
            type: 'aws_instance',
            name: 'Backend 1',
            position: { x: 350, y: 100 },
          }),
          human_db: makeTestNode({
            id: 'human_db',
            type: 'aws_db_instance',
            name: 'Human Dropped RDS',
            position: { x: 650, y: 100 },
          }),
        },
        edges: {
          existing_wire: {
            id: 'existing_wire',
            source: 'alb',
            target: 'ec2_1',
            type: 'routes_to',
            label: 'PORT:443',
            version: 1,
          },
        },
        version: 1,
      };

      const result = autoConnectTopology(stateWithExistingEdge);

      // Existing wire must be preserved
      expect(result.edges['existing_wire']).toBeDefined();

      // Human DB must now have a connection from EC2
      const ec2ToDb = Object.values(result.edges).find(
        (e) => e.source === 'ec2_1' && e.target === 'human_db'
      );
      expect(ec2ToDb).toBeDefined();
      expect(ec2ToDb?.type).toBe('reads_from');
    });

    test('boxes moved far apart preserve their exact coordinates when connected with a wire (never squeeze)', async () => {
      const nodeA = makeTestNode({
        id: 'far_node_a',
        type: 'aws_instance',
        name: 'Far Node A',
        position: { x: 100, y: 100 },
      });
      const nodeB = makeTestNode({
        id: 'far_node_b',
        type: 'aws_db_instance',
        name: 'Far Node B',
        position: { x: 100, y: 150 }, // initially close
      });

      await stateEngine.addNode(nodeA, 'director');
      await stateEngine.addNode(nodeB, 'director');

      // User drags both nodes far apart
      const farPosA = { x: 1450, y: 350 };
      const farPosB = { x: 2200, y: 950 };

      stateEngine.updateNodePosition('far_node_a', farPosA);
      stateEngine.updateNodePosition('far_node_b', farPosB);

      // Verify stateEngine immediately has the far positions
      expect(stateEngine.getState().nodes['far_node_a']?.position).toEqual(farPosA);
      expect(stateEngine.getState().nodes['far_node_b']?.position).toEqual(farPosB);

      // Now user connects them with a wire
      const edge: TopologyEdge = {
        id: 'edge_far_a_to_b',
        source: 'far_node_a',
        target: 'far_node_b',
        type: 'reads_from',
        label: 'TCP:5432',
        version: 1,
      };

      const result = await stateEngine.addEdge(edge, 'director');
      expect(result.success).toBe(true);

      // CRITICAL: Both nodes must remain at their far positions and NOT snap back/squeeze together!
      const finalState = stateEngine.getState();
      expect(finalState.nodes['far_node_a']?.position).toEqual(farPosA);
      expect(finalState.nodes['far_node_b']?.position).toEqual(farPosB);
      expect(finalState.edges['edge_far_a_to_b']).toBeDefined();
    });
  });
});
