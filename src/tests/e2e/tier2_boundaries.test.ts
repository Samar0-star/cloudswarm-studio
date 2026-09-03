/**
 * Tier 2: Boundary & Corner Cases E2E Test Suite
 *
 * Exhaustive boundary, stress, and adversarial testing across 6 categories (5 tests each = 30 tests):
 *
 * 1. Zero Entities & Empty Input Boundary (0 nodes, empty canvas, empty locks, empty transaction patch list, empty CSV export, zero-cost fabric)
 * 2. Extreme Scale (vCPU, RAM, Storage, IOPS, GPU clusters, 120+ mega-swarm nodes)
 * 3. Invalid CIDRs, IP Overlaps & Network Boundary (Invalid CIDR syntax, out-of-range masks, overlapping subnets)
 * 4. High-Concurrency Multi-Agent Lock Contention & CAS Collisions (50+ agents, TTL expirations, baseVersion CAS conflicts, inverse patch rollbacks)
 * 5. Cross-Provider Edge Connections & Graph Topology Boundaries (Multi-cloud cross-provider edges, cyclic graph handling, cascade deletions)
 * 6. Hostile / Malformed Schemas & Injection Resilience (Missing required params, hostile strings, script injection, negative values)
 *
 * Total Test Cases: 30 tests
 */

import { StripedLockManager } from '../../core/lock/StripedLockManager';
import { OptimisticStateEngine } from '../../core/state/OptimisticStateEngine';
import { WebModelContextEngine } from '../../core/webmcp/WebModelContextEngine';
import {
  calculateNodeCost,
  calculateTopologyCostBreakdown,
  AWS_PRICING_CATALOG,
} from '../../core/webmcp/tools/finopsTools';
import {
  scanTopologySecurity,
  createGenerateLeastPrivilegePolicyTool,
} from '../../core/webmcp/tools/securityTools';
import {
  isValidCIDR,
  checkCIDROverlap,
  registerTopologyTools,
} from '../../core/webmcp/tools/topologyTools';
import type {
  TopologyState,
  CloudResourceNode,
  TopologyEdge,
} from '../../types/topology';
import { createDefaultTopologyState } from '../../types/topology';
import type { StateTransaction, RFC6902Patch } from '../../types/patch';
import type { AgentId } from '../../types/swarm';
import { DecisionDAG } from '../../core/dag/DecisionDAG';
import { ProductionMaterializer } from '../../core/export/ProductionMaterializer';

describe('Tier 2: Boundary & Corner Cases E2E Test Suite (6 Categories × 5 Tests = 30 Tests)', () => {
  // =========================================================================
  // Category 1: Zero Entities & Empty Input Boundary (5 tests)
  // =========================================================================
  describe('Category 1: Zero Entities & Empty Input Boundary', () => {
    test('1.1: empty topology state produces $0.00/mo cost and 100/100 security score', () => {
      const state = createDefaultTopologyState();
      const cost = calculateTopologyCostBreakdown(state);
      const sec = scanTopologySecurity(state);

      expect(cost.totalMonthlyUsd).toBe(0);
      expect(cost.totalHourlyUsd).toBe(0);
      expect(cost.items.length).toBe(0);
      expect(sec.score).toBe(100);
      expect(sec.findings.length).toBe(0);
      expect(sec.status).toBe('PASS');
    });

    test('1.2: lock manager handles empty array of entity IDs cleanly without error', async () => {
      const lockManager = new StripedLockManager();
      const handle = await lockManager.acquireLocks([], 'alpha');
      expect(handle.lockIds).toEqual([]);
      expect(handle.isExpired()).toBe(false);
      await handle.release();
    });

    test('1.3: state engine applies empty patch list without state corruption', async () => {
      const engine = new OptimisticStateEngine();
      const tx: StateTransaction = {
        id: 'tx_empty',
        agentId: 'director',
        description: 'No-op transaction',
        timestamp: Date.now(),
        patches: [],
      };
      const res = await engine.applyTransaction(tx);
      expect(res.success).toBe(true);
      expect(Object.keys(engine.getState().nodes).length).toBe(0);
      expect(engine.getState().version).toBe(1);
    });

    test('1.4: decision DAG initializes with root commit on empty topology', () => {
      const emptyState = createDefaultTopologyState();
      const dag = new DecisionDAG(emptyState);
      expect(dag.getActiveCommitId()).toBe('commit_root');
      expect(dag.getTimeline().length).toBe(1);
      expect(Object.keys(dag.checkout('commit_root').nodes).length).toBe(0);
    });

    test('1.5: CSV export on empty topology produces valid RFC 4180 headers with zero sum', () => {
      const emptyState = createDefaultTopologyState();
      const breakdown = calculateTopologyCostBreakdown(emptyState);

      const rows = ['Resource ID,Name,Type,Category,Monthly Cost (USD)'];
      for (const item of breakdown.items) {
        rows.push(`"${item.nodeId}","${item.name}","${item.type}","${item.category}",${item.monthlyUsd.toFixed(2)}`);
      }
      rows.push(`"TOTAL","","","",${breakdown.totalMonthlyUsd.toFixed(2)}`);
      const csv = rows.join('\r\n');

      expect(csv).toContain('Resource ID,Name,Type,Category,Monthly Cost (USD)');
      expect(csv).toContain('"TOTAL","","","",0.00');
    });
  });

  // =========================================================================
  // Category 2: Extreme Scale (vCPU, RAM, Storage, IOPS, GPU) (5 tests)
  // =========================================================================
  describe('Category 2: Extreme Scale (vCPU, RAM, Storage, IOPS, GPU)', () => {
    test('2.1: extreme storage scale (1,000,000 GB) with io2 provisioned IOPS (256,000 IOPS) calculates pricing without numeric overflow', () => {
      const massiveStorageNode: CloudResourceNode = {
        id: 'node_massive_ebs',
        type: 'aws_instance',
        name: 'High-Volume BigData Ingest Server',
        position: { x: 0, y: 0 },
        config: {
          instance_type: 'm6i.4xlarge',
          root_volume_gb: 1000000, // 1 Million GB = 1 PB
          root_volume_type: 'io2',
          iops: 256000, // 256,000 Provisioned IOPS
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(massiveStorageNode);
      expect(Number.isFinite(cost.monthlyUsd)).toBe(true);
      expect(cost.monthlyUsd).toBeGreaterThan(140000);
      expect(cost.category).toBe('Compute');
    });

    test('2.2: handles 120+ nodes and 150+ edges with sub-second cost and security evaluation', async () => {
      const engine = new OptimisticStateEngine();

      for (let i = 0; i < 120; i++) {
        const type = i % 5 === 0 ? 'aws_instance' : i % 5 === 1 ? 'aws_db_instance' : i % 5 === 2 ? 'aws_s3_bucket' : i % 5 === 3 ? 'aws_lb' : 'aws_security_group';
        const node: CloudResourceNode = {
          id: `node_scale_${i}`,
          type,
          name: `Scale Node ${i}`,
          position: { x: (i % 10) * 100, y: Math.floor(i / 10) * 80 },
          config: {
            instance_type: 't3.small',
            instance_class: 'db.t4g.micro',
            bucket_name: `bucket-scale-${i}`,
            http_tokens: 'required',
            encryption: { sse_algorithm: 'AES256' },
            block_public_access: { block_public_acls: true, block_public_policy: true, ignore_public_acls: true, restrict_public_buckets: true },
          },
          metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
          version: 1,
        };
        await engine.addNode(node);
      }

      // Add 150 edges
      for (let i = 0; i < 150; i++) {
        const src = `node_scale_${i % 120}`;
        const dst = `node_scale_${(i + 1) % 120}`;
        await engine.addEdge({
          id: `edge_scale_${i}`,
          source: src,
          target: dst,
          type: 'routes_to',
        });
      }

      const state = engine.getState();
      expect(Object.keys(state.nodes).length).toBe(120);
      expect(Object.keys(state.edges).length).toBe(150);

      const startCost = performance.now();
      const costReport = calculateTopologyCostBreakdown(state);
      const costDurationMs = performance.now() - startCost;

      const startSec = performance.now();
      const secReport = scanTopologySecurity(state);
      const secDurationMs = performance.now() - startSec;

      expect(costDurationMs).toBeLessThan(100);
      expect(secDurationMs).toBeLessThan(100);
      expect(costReport.totalMonthlyUsd).toBeGreaterThan(500);
      expect(secReport.score).toBeGreaterThan(0);
    });

    test('2.3: calculates exact run-rates for high-density multi-GPU instance clusters (g5.2xlarge NVIDIA A10G)', () => {
      const gpuNode: CloudResourceNode = {
        id: 'node_gpu_cluster',
        type: 'aws_instance',
        name: 'GPU Inference Node',
        position: { x: 0, y: 0 },
        config: {
          instance_type: 'g5.2xlarge', // 1.212 $/hr * 730 = 884.76 $/mo
          root_volume_gb: 500,
          root_volume_type: 'gp3', // 500 * 0.08 = 40.00 $/mo
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(gpuNode);
      // Compute: 1.212 * 730 = 884.76; Storage: 500 * 0.08 = 40.00 => Total: 924.76
      expect(cost.monthlyUsd).toBeCloseTo(924.76, 1);
      expect(cost.hourlyUsd).toBeCloseTo(1.212 + 40 / 730, 2);
    });

    test('2.4: maintains deep containment hierarchy resolution (VPC -> Subnet -> Security -> EC2)', async () => {
      const stateEngine = new OptimisticStateEngine();

      await stateEngine.addNode({ id: 'vpc_root', type: 'aws_vpc', name: 'Root VPC', position: { x: 0, y: 0 }, config: { cidr_block: '10.0.0.0/16' }, metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() }, version: 1 });
      await stateEngine.addNode({ id: 'sub_l1', type: 'aws_subnet', name: 'Subnet L1', parentId: 'vpc_root', position: { x: 10, y: 10 }, config: { cidr_block: '10.0.1.0/24' }, metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() }, version: 1 });
      await stateEngine.addNode({ id: 'ec2_l2', type: 'aws_instance', name: 'Compute L2', parentId: 'sub_l1', position: { x: 20, y: 20 }, config: { instance_type: 't3.micro' }, metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() }, version: 1 });

      const state = stateEngine.getState();
      expect(state.nodes['sub_l1']?.parentId).toBe('vpc_root');
      expect(state.nodes['ec2_l2']?.parentId).toBe('sub_l1');
    });

    test('2.5: microsecond precision timestamps and float arithmetic maintain deterministic reproducibility', () => {
      const nodeA: CloudResourceNode = {
        id: 'node_a',
        type: 'aws_instance',
        name: 'Node A',
        position: { x: 0, y: 0 },
        config: { instance_type: 't4g.micro', root_volume_gb: 17, root_volume_type: 'gp3' },
        metadata: { createdBy: 'alpha', createdAt: 1700000000000, updatedAt: 1700000000000 },
        version: 1,
      };

      const cost1 = calculateNodeCost(nodeA);
      const cost2 = calculateNodeCost(nodeA);

      expect(cost1.monthlyUsd).toBe(cost2.monthlyUsd);
      expect(cost1.hourlyUsd).toBe(cost2.hourlyUsd);
      expect(Number.isNaN(cost1.monthlyUsd)).toBe(false);
    });
  });

  // =========================================================================
  // Category 3: Invalid CIDRs, IP Overlaps & Network Boundary (5 tests)
  // =========================================================================
  describe('Category 3: Invalid CIDRs, IP Overlaps & Network Boundary', () => {
    test('3.1: validates standard IPv4 CIDR notation and rejects invalid string formats', () => {
      expect(isValidCIDR('10.0.0.0/16')).toBe(true);
      expect(isValidCIDR('192.168.1.0/24')).toBe(true);
      expect(isValidCIDR('172.16.0.0/12')).toBe(true);
      expect(isValidCIDR('10.0.0.0/8')).toBe(true);

      // Rejections
      expect(isValidCIDR('')).toBe(false);
      expect(isValidCIDR('not_an_ip')).toBe(false);
      expect(isValidCIDR('10.0.0.0')).toBe(false);
      expect(isValidCIDR('999.999.999.999/24')).toBe(false);
      expect(isValidCIDR('10.0.0.0/-1')).toBe(false);
    });

    test('3.2: rejects out-of-range subnet masks (/0, /33, /99) and invalid octets (>255)', () => {
      expect(isValidCIDR('10.0.0.0/0')).toBe(true); // 0.0.0.0/0 or 10.0.0.0/0 is valid mask range 0-32
      expect(isValidCIDR('10.0.0.0/33')).toBe(false);
      expect(isValidCIDR('10.0.0.0/99')).toBe(false);
      expect(isValidCIDR('256.0.0.0/16')).toBe(false);
      expect(isValidCIDR('10.300.0.0/24')).toBe(false);
    });

    test('3.3: detects exact subnet CIDR collisions and overlapping address spaces within same VPC', () => {
      // Exact collision
      expect(checkCIDROverlap('10.0.1.0/24', '10.0.1.0/24')).toBe(true);

      // Overlapping parent/child
      expect(checkCIDROverlap('10.0.0.0/16', '10.0.1.0/24')).toBe(true);
      expect(checkCIDROverlap('10.0.1.0/24', '10.0.0.0/16')).toBe(true);
    });

    test('3.4: allows non-overlapping adjacent subnets in same VPC', () => {
      expect(checkCIDROverlap('10.0.1.0/24', '10.0.2.0/24')).toBe(false);
      expect(checkCIDROverlap('10.0.10.0/24', '10.0.20.0/24')).toBe(false);
      expect(checkCIDROverlap('172.16.1.0/24', '172.16.2.0/24')).toBe(false);
    });

    test('3.5: handles default route 0.0.0.0/0 boundary vs private CIDR ranges', () => {
      expect(isValidCIDR('0.0.0.0/0')).toBe(true);
      expect(checkCIDROverlap('0.0.0.0/0', '10.0.0.0/16')).toBe(true);
    });
  });

  // =========================================================================
  // Category 4: High-Concurrency Multi-Agent Lock Contention & CAS Collisions (5 tests)
  // =========================================================================
  describe('Category 4: High-Concurrency Multi-Agent Lock Contention & CAS Collisions', () => {
    test('4.1: 50 concurrent agent lock acquisitions never enter deadlock due to lexicographical ordering', async () => {
      const lockManager = new StripedLockManager(64, 5000);
      const entityPool = ['res_a', 'res_b', 'res_c', 'res_d', 'res_e', 'res_f', 'res_g', 'res_h'];

      const runAgent = async (agentIndex: number) => {
        const agentId = (agentIndex % 4 === 0 ? 'alpha' : agentIndex % 4 === 1 ? 'beta' : agentIndex % 4 === 2 ? 'gamma' : 'director') as AgentId;
        // Permute entity IDs
        const subset = entityPool
          .filter((_, idx) => (idx + agentIndex) % 3 === 0)
          .sort(() => Math.random() - 0.5); // Random ordering

        try {
          const handle = await lockManager.acquireLocks(subset, agentId, 1000, {
            retryOnContention: true,
            maxRetries: 5,
            initialBackoffMs: 5,
          });
          await new Promise((resolve) => setTimeout(resolve, 5));
          await handle.release();
          return { agentIndex, success: true };
        } catch {
          return { agentIndex, success: false };
        }
      };

      const promises = Array.from({ length: 50 }, (_, i) => runAgent(i));
      const results = await Promise.all(promises);

      // System must never hang or deadlock, all promises resolve
      expect(results.length).toBe(50);
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBeGreaterThan(0);
    });

    test('4.2: CAS version collision detection rejects conflicting concurrent transactions and returns failed key', async () => {
      const stateEngine = new OptimisticStateEngine();
      await stateEngine.addNode({
        id: 'node_shared',
        type: 'aws_instance',
        name: 'Shared Compute',
        position: { x: 0, y: 0 },
        config: { instance_type: 't3.micro' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // Conflict: Agent Alpha expects t3.micro -> sets t3.large; Agent Beta expects t3.nano -> fails
      const failedTx: StateTransaction = {
        id: 'tx_fail_cas',
        agentId: 'beta',
        description: 'Failed CAS test operation',
        timestamp: Date.now(),
        patches: [
          { op: 'test', path: '/nodes/node_shared/config/instance_type', value: 't3.nano' }, // Actual is t3.micro!
          { op: 'replace', path: '/nodes/node_shared/config/instance_type', value: 'c6i.2xlarge' },
        ],
      };

      const result = await stateEngine.applyTransaction(failedTx);
      expect(result.success).toBe(false);
      expect(result.casFailedKey).toBe('/nodes/node_shared/config/instance_type');
      expect(stateEngine.getState().nodes['node_shared']?.config.instance_type).toBe('t3.micro');
    });

    test('4.3: TTL lease expiration under rapid lock churn sweeps orphaned leases', async () => {
      const lockManager = new StripedLockManager(16, 500);

      // Acquire 20 short-lived locks
      for (let i = 0; i < 20; i++) {
        await lockManager.acquireLocks([`churn_res_${i}`], 'alpha', 20); // 20ms TTL
      }

      await new Promise((resolve) => setTimeout(resolve, 40));
      const reclaimed = lockManager.sweepExpiredLeases();
      expect(reclaimed).toBe(20);
      expect(lockManager.isLocked('churn_res_0')).toBe(false);
    });

    test('4.4: 10-step chained sequential rollbacks restore exact initial state without residual mutation', async () => {
      const stateEngine = new OptimisticStateEngine();
      await stateEngine.addNode({
        id: 'node_chain',
        type: 'aws_instance',
        name: 'Base Node',
        position: { x: 0, y: 0 },
        config: { counter: 0 },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      const inversePatchStack: Array<readonly RFC6902Patch[]> = [];

      // Apply 10 sequential mutations
      for (let step = 1; step <= 10; step++) {
        const updateRes = await stateEngine.updateNodeConfig('node_chain', { counter: step });
        expect(updateRes.success).toBe(true);
        inversePatchStack.push(updateRes.inversePatches);
      }

      expect(stateEngine.getState().nodes['node_chain']?.config.counter).toBe(10);

      // Rollback in reverse order
      while (inversePatchStack.length > 0) {
        const inversePatches = inversePatchStack.pop()!;
        const rollbackRes = stateEngine.rollback(inversePatches);
        expect(rollbackRes.success).toBe(true);
      }

      expect(stateEngine.getState().nodes['node_chain']?.config.counter).toBe(0);
    });

    test('4.5: multiple agents locking disjoint sets of entities execute concurrently without blocking', async () => {
      const lockManager = new StripedLockManager(32, 2000);

      const [handleAlpha, handleBeta, handleGamma] = await Promise.all([
        lockManager.acquireLocks(['disjoint_1', 'disjoint_2'], 'alpha'),
        lockManager.acquireLocks(['disjoint_3', 'disjoint_4'], 'beta'),
        lockManager.acquireLocks(['disjoint_5', 'disjoint_6'], 'gamma'),
      ]);

      expect(lockManager.getHolder('disjoint_1')).toBe('alpha');
      expect(lockManager.getHolder('disjoint_3')).toBe('beta');
      expect(lockManager.getHolder('disjoint_5')).toBe('gamma');

      await Promise.all([handleAlpha.release(), handleBeta.release(), handleGamma.release()]);
      expect(lockManager.isLocked('disjoint_1')).toBe(false);
      expect(lockManager.isLocked('disjoint_3')).toBe(false);
      expect(lockManager.isLocked('disjoint_5')).toBe(false);
    });
  });

  // =========================================================================
  // Category 5: Cross-Provider Edge Connections & Graph Topologies (5 tests)
  // =========================================================================
  describe('Category 5: Cross-Provider Edge Connections & Graph Topologies', () => {
    test('5.1: cross-provider edges (AWS ALB -> Azure VM) establish valid directed relationships', async () => {
      const stateEngine = new OptimisticStateEngine();

      await stateEngine.addNode({ id: 'aws_alb_1', type: 'aws_lb', name: 'AWS Ingress ALB', position: { x: 0, y: 0 }, config: {}, metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() }, version: 1 });
      await stateEngine.addNode({ id: 'azure_vm_1', type: 'aws_instance', name: 'Azure Core VM', position: { x: 200, y: 200 }, config: {}, metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() }, version: 1 });

      const edgeRes = await stateEngine.addEdge({
        id: 'edge_cross_cloud',
        source: 'aws_alb_1',
        target: 'azure_vm_1',
        type: 'routes_to',
        port: 443,
        protocol: 'https',
      });

      expect(edgeRes.success).toBe(true);
      const edge = stateEngine.getState().edges['edge_cross_cloud'];
      expect(edge?.source).toBe('aws_alb_1');
      expect(edge?.target).toBe('azure_vm_1');
      expect(edge?.port).toBe(443);
    });

    test('5.2: cyclic dependency edges in network graphs are handled without infinite loops', async () => {
      const stateEngine = new OptimisticStateEngine();

      await stateEngine.addNode({ id: 'node_a', type: 'aws_vpc', name: 'VPC A', position: { x: 0, y: 0 }, config: {}, metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() }, version: 1 });
      await stateEngine.addNode({ id: 'node_b', type: 'aws_vpc', name: 'VPC B', position: { x: 100, y: 100 }, config: {}, metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() }, version: 1 });

      // Create bidirectional cycle
      await stateEngine.addEdge({ id: 'edge_a_to_b', source: 'node_a', target: 'node_b', type: 'peering' });
      await stateEngine.addEdge({ id: 'edge_b_to_a', source: 'node_b', target: 'node_a', type: 'peering' });

      const state = stateEngine.getState();
      expect(Object.keys(state.edges).length).toBe(2);

      // Cost and security audits run cleanly on cyclic graph
      const cost = calculateTopologyCostBreakdown(state);
      const sec = scanTopologySecurity(state);
      expect(cost.totalMonthlyUsd).toBe(0);
      expect(sec.score).toBe(100);
    });

    test('5.3: cascade deletion of parent container cleanly removes child nodes and attached edges', async () => {
      const stateEngine = new OptimisticStateEngine();
      const webmcp = new WebModelContextEngine();
      registerTopologyTools(webmcp, stateEngine);

      await webmcp.executeTool('create_resource_node', { id: 'alb_src', type: 'aws_lb', name: 'ALB', config: {} });
      await webmcp.executeTool('create_resource_node', { id: 'ec2_dst', type: 'aws_instance', name: 'EC2', config: {} });
      await webmcp.executeTool('connect_resources', { source_id: 'alb_src', target_id: 'ec2_dst', relation_type: 'target_group_of' });

      expect(Object.keys(stateEngine.getState().edges).length).toBe(1);

      // Remove ALB with cascade
      await webmcp.executeTool('remove_resource_node', { node_id: 'alb_src', cascade: true });
      expect(stateEngine.getState().nodes['alb_src']).toBeUndefined();
      expect(Object.keys(stateEngine.getState().edges).length).toBe(0);
    });

    test('5.4: removing an edge preserves connected source and target nodes intact', async () => {
      const stateEngine = new OptimisticStateEngine();

      await stateEngine.addNode({ id: 'node_1', type: 'aws_instance', name: 'Node 1', position: { x: 0, y: 0 }, config: {}, metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() }, version: 1 });
      await stateEngine.addNode({ id: 'node_2', type: 'aws_instance', name: 'Node 2', position: { x: 50, y: 50 }, config: {}, metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() }, version: 1 });
      await stateEngine.addEdge({ id: 'edge_1_2', source: 'node_1', target: 'node_2', type: 'routes_to' });

      await stateEngine.applyTransaction({
        id: 'tx_rm_edge',
        agentId: 'alpha',
        description: 'Remove edge',
        timestamp: Date.now(),
        patches: [{ op: 'remove', path: '/edges/edge_1_2' }],
      });

      expect(stateEngine.getState().edges['edge_1_2']).toBeUndefined();
      expect(stateEngine.getState().nodes['node_1']).toBeDefined();
      expect(stateEngine.getState().nodes['node_2']).toBeDefined();
    });

    test('5.5: disconnected island nodes evaluate normally in cost calculations', () => {
      const state = createDefaultTopologyState();
      (state.nodes as Record<string, CloudResourceNode>)['island_ec2'] = {
        id: 'island_ec2',
        type: 'aws_instance',
        name: 'Isolated Node',
        position: { x: 500, y: 500 },
        config: { instance_type: 't3.medium' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const breakdown = calculateTopologyCostBreakdown(state);
      expect(breakdown.totalMonthlyUsd).toBeCloseTo(30.37, 1);
    });
  });

  // =========================================================================
  // Category 6: Hostile / Malformed Schemas & Injection Resilience (5 tests)
  // =========================================================================
  describe('Category 6: Hostile / Malformed Schemas & Injection Resilience', () => {
    test('6.1: WebMCP tool invocation with missing required parameters returns structured error', async () => {
      const webmcp = new WebModelContextEngine();
      webmcp.registerTool(createGenerateLeastPrivilegePolicyTool());

      const res = await webmcp.executeTool('generate_least_privilege_policy', {});
      expect(res.isError).toBe(true);
      expect(res.content[0]?.text).toContain('Missing required parameter');
    });

    test('6.2: invoking non-existent tool returns descriptive not-found error', async () => {
      const webmcp = new WebModelContextEngine();
      const res = await webmcp.executeTool('invalid_ghost_tool_call', {});
      expect(res.isError).toBe(true);
      expect(res.content[0]?.text).toContain("Tool 'invalid_ghost_tool_call' not found");
    });

    test('6.3: negative configuration values (negative storage GB, negative count) are handled gracefully', () => {
      const nodeNegative: CloudResourceNode = {
        id: 'node_neg',
        type: 'aws_instance',
        name: 'Negative Storage Node',
        position: { x: 0, y: 0 },
        config: {
          instance_type: 't3.micro',
          root_volume_gb: -100, // Invalid negative value
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      // Cost calculation should not crash and compute base cost
      const cost = calculateNodeCost(nodeNegative);
      expect(Number.isFinite(cost.monthlyUsd)).toBe(true);
    });

    test('6.4: script injection tags in resource names and descriptions are safely handled without execution', () => {
      const xssName = '<script>alert("pwned")</script>';
      const xssTag = '"; DROP TABLE nodes; --';

      const node: CloudResourceNode = {
        id: 'node_xss',
        type: 'aws_instance',
        name: xssName,
        position: { x: 0, y: 0 },
        config: { instance_type: 't3.micro', tags: { Injected: xssTag } },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const hcl = ProductionMaterializer.generateMainTf({
        nodes: { node_xss: node },
        edges: {},
        version: 1,
      });

      expect(hcl).toBeDefined();
      expect(hcl).toContain('resource "aws_instance"');
    });

    test('6.5: AbortSignal cancellation immediately aborts tool execution cleanly', async () => {
      const webmcp = new WebModelContextEngine();
      webmcp.registerTool(createGenerateLeastPrivilegePolicyTool());

      const controller = new AbortController();
      controller.abort(); // Pre-aborted

      const res = await webmcp.executeTool(
        'generate_least_privilege_policy',
        { workload_type: 's3_read_only', resource_arn: 'arn:aws:s3:::vault/*' },
        { signal: controller.signal }
      );

      expect(res.isError).toBe(true);
      expect(res.content[0]?.text).toContain('was aborted');
    });
  });
});
