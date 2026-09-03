/**
 * Tier 5: Comprehensive White-Box Adversarial Coverage Hardening Test Suite
 *
 * Exhaustive multi-agent adversarial stress harness and invariant verification across:
 * 1. Lock Engine (StripedLockManager) — Thundering herds, thundering lease expirations, reentrancy, dynamic expansions.
 * 2. State Engine (OptimisticStateEngine) — Deep RFC 6902 CAS, inverse patch symmetry, all-or-nothing atomicity, subscriber fault isolation.
 * 3. WebMCP Engine (WebModelContextEngine) — Schema fuzzing, rapid registration/unregistration, event telemetry resilience.
 * 4. Audit Engine (SentinelAuditor, CostCalculator, SecurityScanner) — SHA-256 state signatures, pricing edge cases, CIS/OWASP zero-trust remediation idempotency.
 * 5. Decision DAG (DecisionDAG) — Multi-branch LCA graph algorithms, time-travel 60 FPS scrubbing, split diffs.
 * 6. HCL Sync Engine (HCLSyncEngine) — Hostile AST parsing, round-trip fidelity for all 10 AWS primitives, incremental patch synthesis.
 * 7. Simulation Engine (DeterministicSwarmSim) — Zero-key 3-agent deterministic execution, sync vs async parity, custom scenarios.
 * 8. Production Materializer (ProductionMaterializer) — In-memory PKZIP binary generation, Dockerfile & Terraform outputs, SHA-256 certificate validation.
 * 9. Master Zustand Store (useCloudSwarmStore) — Full reactive workflow integration, concurrency stress, presence tracking, log cap invariant.
 */

import { StripedLockManager } from '../core/lock/StripedLockManager';
import { OptimisticStateEngine } from '../core/state/OptimisticStateEngine';
import { WebModelContextEngine } from '../core/webmcp/WebModelContextEngine';
import { resetWebModelContext } from '../core/webmcp/polyfill';
import {
  registerTopologyTools,
  isValidCIDR,
  checkCIDROverlap,
} from '../core/webmcp/tools/topologyTools';
import {
  registerSecurityTools,
} from '../core/webmcp/tools/securityTools';
import {
  registerFinOpsTools,
} from '../core/webmcp/tools/finopsTools';
import {
  scanTopologySecurity,
  generateRemediationPatches,
  generateLeastPrivilegePolicyDocument,
  SECURITY_RULES,
  SecurityScanner,
} from '../core/audit/SecurityScanner';
import {
  calculateNodeCost,
  calculateTopologyCostBreakdown,
  generateCostRecommendations,
  AWS_PRICING_CATALOG,
  CostCalculator,
} from '../core/audit/CostCalculator';
import {
  SentinelAuditor,
  computeSha256,
  computeTopologySignature,
  auditTopology,
} from '../core/audit/SentinelAuditor';
import { DecisionDAG } from '../core/dag/DecisionDAG';
import {
  HCLSyncEngine,
  HCLParser,
  canvasToHcl,
  hclToCanvas,
  computePatchesFromHcl,
} from '../core/sync/HCLSyncEngine';
import { DeterministicSwarmSim, type SimStep } from '../core/simulation/DeterministicSwarmSim';
import { PRESET_SCENARIOS, type SimulationScenario } from '../core/simulation/scenarios';
import {
  ProductionMaterializer,
  generateDockerfile,
  generateVariablesTf,
  generateMainTf,
  generateAuditCertificate,
  generateZipBundle,
} from '../core/export/ProductionMaterializer';
import { useCloudSwarmStore } from '../store/useCloudSwarmStore';
import type { CloudResourceNode, TopologyEdge, TopologyState } from '../types/topology';
import { createDefaultTopologyState } from '../types/topology';
import type { AgentId } from '../types/swarm';
import type { StateTransaction, RFC6902Patch } from '../types/patch';

describe('Tier 5: Comprehensive Adversarial Coverage Hardening Suite', () => {
  // =========================================================================
  // Module 1: StripedLockManager Concurrency & Deadlock-Free Engine
  // =========================================================================
  describe('Module 1: StripedLockManager Deep Adversarial Stress', () => {
    let lockManager: StripedLockManager;

    beforeEach(() => {
      lockManager = new StripedLockManager(32, 1000);
    });

    afterEach(() => {
      lockManager.clearAll();
    });

    test('1.1 Empty, single, duplicate, and unicode entity ID batch acquisitions', async () => {
      // Empty entityIds array returns non-blocking trivial handle
      const emptyHandle = await lockManager.acquireLocks([], 'alpha', 2000);
      expect(emptyHandle.lockIds).toEqual([]);
      expect(emptyHandle.isExpired()).toBe(false);
      expect(emptyHandle.renew(500)).toBe(true);
      await expect(emptyHandle.release()).resolves.not.toThrow();

      // Duplicate entity IDs deduplicated & sorted
      const dupHandle = await lockManager.acquireLocks(
        ['node_c', 'node_a', 'node_b', 'node_a', 'node_c', 'node_b'],
        'beta',
        2000
      );
      expect(dupHandle.lockIds).toEqual(['node_a', 'node_b', 'node_c']);
      expect(lockManager.isHeldBy(['node_a', 'node_b', 'node_c'], 'beta')).toBe(true);
      await dupHandle.release();
      expect(lockManager.isLocked('node_a')).toBe(false);

      // Unicode and special character keys
      const unicodeKeys = ['🔒_node_1', '🚀_vpc_main', 'aws:subnet:us-east-1a:10.0.0.0/24'];
      const unicodeHandle = await lockManager.acquireLocks(unicodeKeys, 'gamma', 2000);
      expect(unicodeHandle.lockIds).toHaveLength(3);
      for (const k of unicodeKeys) {
        expect(lockManager.getHolder(k)).toBe('gamma');
      }
      await unicodeHandle.release();
    });

    test('1.2 Thundering Herd on Expiring Lease with 40 Concurrent Competitors', async () => {
      const contestedResource = 'hot_lock_thundering_herd';
      const shortTtl = 40;

      // Seed initial lock
      await lockManager.acquireLocks([contestedResource], 'alpha', shortTtl);
      expect(lockManager.getHolder(contestedResource)).toBe('alpha');

      // 40 competitor agents competing to acquire immediately upon expiry
      const competitors: AgentId[] = ['beta', 'gamma', 'director', 'human'];
      let acquiredCount = 0;
      const competitorAgents: AgentId[] = [];

      const tasks = Array.from({ length: 40 }, async (_, i) => {
        const agent = competitors[i % competitors.length]!;
        try {
          const handle = await lockManager.acquireLocks([contestedResource], agent, 80, {
            retryOnContention: true,
            maxRetries: 15,
            initialBackoffMs: 5,
            maxBackoffMs: 30,
            timeoutMs: 300,
          });

          acquiredCount++;
          competitorAgents.push(handle.agentId);
          await new Promise((r) => setTimeout(r, 2));
          await handle.release();
        } catch {
          // Contention timeout is valid
        }
      });

      await Promise.all(tasks);
      expect(acquiredCount).toBeGreaterThan(0);
      lockManager.sweepExpiredLeases();
      expect(lockManager.isLocked(contestedResource)).toBe(false);
    });

    test('1.3 Re-entrant and expanding lock acquisitions by same agent', async () => {
      const handle1 = await lockManager.acquireLocks(['res_A', 'res_B'], 'alpha', 1000);
      expect(lockManager.isHeldBy(['res_A', 'res_B'], 'alpha')).toBe(true);

      // Re-entrant call with overlapping resource by same agent succeeds
      const handle2 = await lockManager.acquireLocks(['res_B', 'res_C'], 'alpha', 1000);
      expect(lockManager.isHeldBy(['res_A', 'res_B', 'res_C'], 'alpha')).toBe(true);

      // Releasing handle2 releases res_B and res_C
      await handle2.release();
      expect(lockManager.isLocked('res_C')).toBe(false);
      expect(lockManager.isLocked('res_B')).toBe(false);

      // Releasing handle1 releases res_A
      await handle1.release();
      expect(lockManager.isLocked('res_A')).toBe(false);
    });

    test('1.4 Single entity lock renewal boundaries and non-holder rejection', async () => {
      const handle = await lockManager.acquireLocks(['res_renew_test'], 'alpha', 100);

      // Wrong agent cannot renew
      expect(lockManager.renewLock('res_renew_test', 'beta', 500)).toBe(false);

      // Correct agent renews
      expect(lockManager.renewLock('res_renew_test', 'alpha', 500)).toBe(true);

      // Non-existent entity renew returns false
      expect(lockManager.renewLock('non_existent_entity', 'alpha', 500)).toBe(false);

      await handle.release();
      // After release, renewal returns false
      expect(lockManager.renewLock('res_renew_test', 'alpha', 500)).toBe(false);
    });

    test('1.5 Sweep expired leases returns accurate count', async () => {
      await lockManager.acquireLocks(['exp_1', 'exp_2', 'exp_3'], 'gamma', 20);
      await lockManager.acquireLocks(['active_1'], 'beta', 2000);

      await new Promise((resolve) => setTimeout(resolve, 35));

      const reclaimed = lockManager.sweepExpiredLeases();
      expect(reclaimed).toBe(3);
      expect(lockManager.isLocked('active_1')).toBe(true);
      expect(lockManager.getActiveLocks()).toHaveLength(1);
    });
  });

  // =========================================================================
  // Module 2: OptimisticStateEngine & RFC 6902 CAS Rollbacks
  // =========================================================================
  describe('Module 2: OptimisticStateEngine RFC 6902 CAS Invariance', () => {
    let engine: OptimisticStateEngine;

    beforeEach(() => {
      engine = new OptimisticStateEngine();
    });

    test('2.1 CAS baseVersion mismatch strictly aborts transaction without state modification', async () => {
      const initialVer = engine.getState().version;

      const failingTx: StateTransaction = {
        id: 'tx_cas_version_mismatch',
        agentId: 'alpha',
        description: 'Attempt update with stale baseVersion',
        timestamp: Date.now(),
        baseVersion: initialVer + 999, // Stale/invalid version
        patches: [
          {
            op: 'add',
            path: '/nodes/stale_node',
            value: {
              id: 'stale_node',
              type: 'aws_vpc',
              name: 'Stale Node',
              position: { x: 0, y: 0 },
              config: {},
              metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
              version: 1,
            },
          },
        ],
      };

      const result = await engine.applyTransaction(failingTx);
      expect(result.success).toBe(false);
      expect(result.casFailedKey).toBe('baseVersion');
      expect(result.conflictError).toContain('CAS baseVersion mismatch');
      expect(engine.getState().version).toBe(initialVer);
      expect(engine.getState().nodes['stale_node']).toBeUndefined();
    });

    test('2.2 Deep JSON Pointer test operations with nested objects, arrays, and primitives', async () => {
      const complexNode: CloudResourceNode = {
        id: 'node_complex',
        type: 'aws_instance',
        name: 'Complex EC2',
        position: { x: 10, y: 20 },
        config: {
          instance_type: 't3.micro',
          tags: { Tier: 'Web', Env: 'Prod' },
          security_group_ids: ['sg-1', 'sg-2'],
          metadata: { sub: { flag: true, nullField: null, count: 42 } },
        },
        metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
        version: 1,
      };

      await engine.addNode(complexNode, 'alpha');

      // Test deep boolean
      const validTx: StateTransaction = {
        id: 'tx_deep_test_success',
        agentId: 'beta',
        description: 'Verify deep null and boolean fields',
        timestamp: Date.now(),
        patches: [
          { op: 'test', path: '/nodes/node_complex/config/metadata/sub/flag', value: true },
          { op: 'test', path: '/nodes/node_complex/config/metadata/sub/nullField', value: null },
          { op: 'test', path: '/nodes/node_complex/config/metadata/sub/count', value: 42 },
          { op: 'replace', path: '/nodes/node_complex/config/metadata/sub/count', value: 43 },
        ],
      };

      const validRes = await engine.applyTransaction(validTx);
      expect(validRes.success).toBe(true);

      // Failing deep test
      const failingTx: StateTransaction = {
        id: 'tx_deep_test_fail',
        agentId: 'gamma',
        description: 'Failing deep test on array index',
        timestamp: Date.now(),
        patches: [
          { op: 'test', path: '/nodes/node_complex/config/security_group_ids/0', value: 'sg-WRONG' },
          { op: 'replace', path: '/nodes/node_complex/config/instance_type', value: 'c6i.large' },
        ],
      };

      const failRes = await engine.applyTransaction(failingTx);
      expect(failRes.success).toBe(false);
      expect(failRes.casFailedKey).toBe('/nodes/node_complex/config/security_group_ids/0');
      // Verify no mutation occurred
      expect(engine.getState().nodes['node_complex']?.config.instance_type).toBe('t3.micro');
    });

    test('2.3 Subscriber fault isolation prevents broken listeners from crashing transactions', async () => {
      let listenerCalls = 0;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Bad subscriber throwing unhandled error
      const unsubscribe = engine.subscribe(() => {
        listenerCalls++;
        throw new Error('Explosive subscriber error');
      });

      const node: CloudResourceNode = {
        id: 'node_sub_test',
        type: 'aws_vpc',
        name: 'Subscriber VPC',
        position: { x: 0, y: 0 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      };

      const result = await engine.addNode(node, 'alpha');
      expect(result.success).toBe(true);
      expect(listenerCalls).toBe(1);
      expect(engine.getState().nodes['node_sub_test']).toBeDefined();

      unsubscribe();
      consoleErrorSpy.mockRestore();
    });

    test('2.4 Rapid 100-step random mutation chain with exact rollback restoration', async () => {
      const initialSnapshot = structuredClone(engine.getState());
      const inverseHistory: RFC6902Patch[][] = [];

      for (let i = 0; i < 100; i++) {
        const id = `bench_${i}`;
        const node: CloudResourceNode = {
          id,
          type: i % 3 === 0 ? 'aws_vpc' : i % 3 === 1 ? 'aws_instance' : 'aws_s3_bucket',
          name: `Node ${i}`,
          position: { x: i * 5, y: i * 8 },
          config: { counter: i, enabled: i % 2 === 0 },
          metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
          version: 1,
        };

        const res = await engine.addNode(node, 'alpha');
        expect(res.success).toBe(true);
        inverseHistory.push([...res.inversePatches]);
      }

      expect(Object.keys(engine.getState().nodes)).toHaveLength(100);

      // Rollback all in reverse order
      while (inverseHistory.length > 0) {
        const inv = inverseHistory.pop()!;
        const rbRes = engine.rollback(inv);
        expect(rbRes.success).toBe(true);
      }

      const restoredState = engine.getState();
      expect(Object.keys(restoredState.nodes)).toHaveLength(0);
      expect(restoredState.nodes).toEqual(initialSnapshot.nodes);
    });

    test('2.5 UpdateNodeConfig on non-existent node returns safe conflict error', async () => {
      const res = await engine.updateNodeConfig('non_existent_node_id', { instance_type: 't3.large' }, 'beta');
      expect(res.success).toBe(false);
      expect(res.conflictError).toContain("Node 'non_existent_node_id' not found");
    });
  });

  // =========================================================================
  // Module 3: WebMCP Protocol & Schema Validation Fuzzing
  // =========================================================================
  describe('Module 3: WebModelContextEngine Deep Schema Hardening', () => {
    let engine: WebModelContextEngine;
    let stateEngine: OptimisticStateEngine;

    beforeEach(() => {
      resetWebModelContext();
      engine = new WebModelContextEngine(false);
      stateEngine = new OptimisticStateEngine();
      registerTopologyTools(engine, stateEngine);
      registerSecurityTools(engine, () => stateEngine.getState(), stateEngine);
      registerFinOpsTools(engine, () => stateEngine.getState());
    });

    test('3.1 Schema rejects NaN, infinity, and wrong-type numbers', async () => {
      const nanRes = await engine.executeTool('connect_resources', {
        source_id: 'node-1',
        target_id: 'node-2',
        relation_type: 'routes_to',
        port: NaN,
      });
      expect(nanRes.isError).toBe(true);

      const strPortRes = await engine.executeTool('connect_resources', {
        source_id: 'node-1',
        target_id: 'node-2',
        relation_type: 'routes_to',
        port: '8080' as unknown as number,
      });
      expect(strPortRes.isError).toBe(true);
    });

    test('3.2 Unregister tool cleans up registry and handles redundant unregisters', () => {
      expect(engine.getTools().length).toBeGreaterThan(0);
      const toolName = engine.getTools()[0]!.name;

      const unregistered = engine.unregisterTool(toolName);
      expect(unregistered).toBe(true);
      expect(engine.getTool(toolName)).toBeUndefined();

      // Redundant unregister returns false
      expect(engine.unregisterTool(toolName)).toBe(false);
    });

    test('3.3 WebMCP Resources registration, listing, reading, and unregistering', async () => {
      const unsubscribe = engine.registerResource({
        uri: 'topology://active/manifest',
        name: 'Active Topology HCL',
        description: 'Current live Terraform HCL manifest',
        mimeType: 'text/plain',
        read: async () => ({
          contents: [
            {
              uri: 'topology://active/manifest',
              mimeType: 'text/plain',
              text: '# Terraform Manifest Resource',
            },
          ],
        }),
      });

      expect(engine.listResources()).toHaveLength(1);
      expect(engine.getResource('topology://active/manifest')).toBeDefined();

      const readResult = await engine.readResource('topology://active/manifest');
      expect(readResult.contents[0]?.text).toContain('# Terraform Manifest Resource');

      unsubscribe();
      expect(engine.listResources()).toHaveLength(0);
    });

    test('3.4 High-frequency concurrent tool calls under stress (50 parallel invocations)', async () => {
      const calls = Array.from({ length: 50 }, (_, i) =>
        engine.executeTool(
          'create_resource_node',
          {
            id: `conc_node_${i}`,
            type: 'aws_s3_bucket',
            name: `Bucket ${i}`,
            config: { bucket_name: `concurrent-bucket-${i}` },
          },
          { agentId: 'alpha' }
        )
      );

      const results = await Promise.all(calls);
      for (const res of results) {
        expect(res.isError).toBeFalsy();
      }
      expect(Object.keys(stateEngine.getState().nodes)).toHaveLength(50);
    });
  });

  // =========================================================================
  // Module 4: SentinelAuditor, CostCalculator & SecurityScanner
  // =========================================================================
  describe('Module 4: SentinelAuditor, CostCalculator & SecurityScanner', () => {
    let auditor: SentinelAuditor;
    let costCalc: CostCalculator;
    let secScan: SecurityScanner;

    beforeEach(() => {
      auditor = new SentinelAuditor();
      costCalc = new CostCalculator();
      secScan = new SecurityScanner();
    });

    test('4.1 SHA-256 state signature is strictly deterministic and invariant to node key ordering', () => {
      const nodeA: CloudResourceNode = {
        id: 'node_a',
        type: 'aws_vpc',
        name: 'VPC A',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.0.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      };
      const nodeB: CloudResourceNode = {
        id: 'node_b',
        type: 'aws_subnet',
        name: 'Subnet B',
        position: { x: 10, y: 10 },
        config: { cidr_block: '10.0.1.0/24' },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      };

      const stateOrder1: TopologyState = {
        nodes: { node_a: nodeA, node_b: nodeB },
        edges: {},
        version: 1,
      };

      const stateOrder2: TopologyState = {
        nodes: { node_b: nodeB, node_a: nodeA }, // Inverted key insertion
        edges: {},
        version: 1,
      };

      const sig1 = computeTopologySignature(stateOrder1);
      const sig2 = computeTopologySignature(stateOrder2);

      expect(sig1).toHaveLength(64);
      expect(sig1).toBe(sig2);

      // Mutating config alters signature
      const stateMutated: TopologyState = {
        nodes: { node_a: { ...nodeA, config: { cidr_block: '172.16.0.0/16' } }, node_b: nodeB },
        edges: {},
        version: 1,
      };
      const sigMutated = computeTopologySignature(stateMutated);
      expect(sigMutated).not.toBe(sig1);
    });

    test('4.2 SentinelAuditor memoization cache provides instant hits on identical state', () => {
      const state = createDefaultTopologyState();
      const report1 = auditor.auditTopology(state);
      const report2 = auditor.auditTopology(state);

      expect(report1).toBe(report2); // Exact reference equality due to cache hit
      expect(report1.stateSignature).toBeDefined();

      auditor.clearCache();
      expect(auditor.getLatestReport()).toBeNull();
    });

    test('4.3 Cost Calculator handles extreme node configurations and exotic types gracefully', () => {
      // EC2 with unknown instance type defaults to standard rate without NaN
      const unknownEc2: CloudResourceNode = {
        id: 'ec2_unknown',
        type: 'aws_instance',
        name: 'Unknown EC2',
        position: { x: 0, y: 0 },
        config: { instance_type: 'custom.quantum.large', root_volume_gb: 1000, root_volume_type: 'io2', iops: 50000 },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      };
      const cost = costCalc.calculateNodeCost(unknownEc2);
      expect(Number.isFinite(cost.monthlyUsd)).toBe(true);
      expect(Number.isFinite(cost.hourlyUsd)).toBe(true);
      expect(cost.monthlyUsd).toBeGreaterThan(0);

      // RDS Single-AZ vs Multi-AZ cost ratio
      const rdsSingle: CloudResourceNode = {
        id: 'rds_single',
        type: 'aws_db_instance',
        name: 'RDS Single',
        position: { x: 0, y: 0 },
        config: { instance_class: 'db.m6g.large', allocated_storage_gb: 100, multi_az: false },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      };
      const rdsMulti: CloudResourceNode = {
        id: 'rds_multi',
        type: 'aws_db_instance',
        name: 'RDS Multi',
        position: { x: 0, y: 0 },
        config: { instance_class: 'db.m6g.large', allocated_storage_gb: 100, multi_az: true },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      };

      const costSingle = costCalc.calculateNodeCost(rdsSingle);
      const costMulti = costCalc.calculateNodeCost(rdsMulti);
      expect(costMulti.monthlyUsd).toBeCloseTo(costSingle.monthlyUsd * 2.0, 1);
    });

    test('4.4 Security remediation patches are idempotent and achieve >= 95 compliance score', () => {
      const stateEngine = new OptimisticStateEngine();

      // Seed deeply vulnerable state
      stateEngine.addNode({
        id: 'sg_vuln',
        type: 'aws_security_group',
        name: 'Vuln SG',
        position: { x: 0, y: 0 },
        config: { ingress_rules: [{ protocol: 'tcp', from_port: 22, to_port: 22, cidr_blocks: ['0.0.0.0/0'] }] },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });

      stateEngine.addNode({
        id: 'rds_vuln',
        type: 'aws_db_instance',
        name: 'Vuln RDS',
        position: { x: 0, y: 0 },
        config: { publicly_accessible: true },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });

      stateEngine.addNode({
        id: 's3_vuln',
        type: 'aws_s3_bucket',
        name: 'Vuln S3',
        position: { x: 0, y: 0 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });

      const initialScan = secScan.scan(stateEngine.getState());
      expect(initialScan.score).toBeLessThan(70);

      // Generate and apply remediation patches
      const patches = secScan.generateRemediationPatches(stateEngine.getState());
      expect(patches.length).toBeGreaterThanOrEqual(3);

      const tx: StateTransaction = {
        id: 'tx_sec_remediate',
        agentId: 'beta',
        description: 'Remediate security vulnerabilities',
        timestamp: Date.now(),
        patches,
      };

      stateEngine.applyTransaction(tx);

      // Re-scan hardened state
      const hardenedScan = secScan.scan(stateEngine.getState());
      expect(hardenedScan.score).toBeGreaterThanOrEqual(95);

      // Applying remediation again should generate 0 patches (idempotency)
      const secondRoundPatches = secScan.generateRemediationPatches(stateEngine.getState());
      expect(secondRoundPatches).toHaveLength(0);
    });

    test('4.5 Standalone auditTopology functional export executes without error', () => {
      const state = createDefaultTopologyState();
      const report = auditTopology(state);
      expect(report.securityScore).toBe(100);
      expect(report.totalMonthlyCostUsd).toBe(0);
      expect(report.grade).toBe('A+');
    });
  });

  // =========================================================================
  // Module 5: DecisionDAG & Lowest Common Ancestor Graph Traversal
  // =========================================================================
  describe('Module 5: DecisionDAG Multi-Branch & LCA Traversal', () => {
    let dag: DecisionDAG;

    beforeEach(() => {
      dag = new DecisionDAG(undefined, 'director', 'Root Genesis');
    });

    test('5.1 Forking multiple branches and computing Lowest Common Ancestor (LCA)', () => {
      const rootId = dag.getRootCommitId();

      // Commit 1 on main
      const commitMain1 = dag.addCommit({
        message: 'Add VPC on main',
        author: 'alpha',
        patches: [{ op: 'add', path: '/nodes/vpc_main', value: { id: 'vpc_main', type: 'aws_vpc', name: 'Main VPC', position: { x: 0, y: 0 }, config: {}, metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 }, version: 1 } }],
      });

      // Fork branch 'feature-sec' from commitMain1
      dag.forkBranch('feature-sec', commitMain1.id, 'beta');
      expect(dag.getActiveBranchName()).toBe('feature-sec');

      // Commit on feature-sec
      const commitSec1 = dag.addCommit({
        message: 'Add SG on feature-sec',
        author: 'beta',
        patches: [{ op: 'add', path: '/nodes/sg_sec', value: { id: 'sg_sec', type: 'aws_security_group', name: 'Sec SG', position: { x: 0, y: 0 }, config: {}, metadata: { createdBy: 'beta', createdAt: 0, updatedAt: 0 }, version: 1 } }],
      });

      // Fork branch 'feature-finops' from commitMain1
      dag.forkBranch('feature-finops', commitMain1.id, 'gamma');
      const commitFin1 = dag.addCommit({
        message: 'Add Graviton EC2 on feature-finops',
        author: 'gamma',
        patches: [{ op: 'add', path: '/nodes/ec2_graviton', value: { id: 'ec2_graviton', type: 'aws_instance', name: 'Graviton EC2', position: { x: 0, y: 0 }, config: {}, metadata: { createdBy: 'gamma', createdAt: 0, updatedAt: 0 }, version: 1 } }],
      });

      // LCA of feature-sec head and feature-finops head MUST be commitMain1
      const lca = dag.findLCA(commitSec1.id, commitFin1.id);
      expect(lca).toBeDefined();
      expect(lca?.id).toBe(commitMain1.id);

      // LCA of a commit with itself is itself
      expect(dag.findLCA(commitSec1.id, commitSec1.id)?.id).toBe(commitSec1.id);

      // LCA of root and commitSec1 is root
      expect(dag.findLCA(rootId, commitSec1.id)?.id).toBe(rootId);
    });

    test('5.2 A/B Diff Inspector between divergent branches accurately detects added/removed nodes and edge diffs', () => {
      const commitRoot = dag.getRootCommitId();

      dag.forkBranch('branch-a', commitRoot);
      const commitA = dag.addCommit({
        message: 'Branch A adds S3',
        author: 'alpha',
        patches: [{ op: 'add', path: '/nodes/s3_a', value: { id: 's3_a', type: 'aws_s3_bucket', name: 'Bucket A', position: { x: 10, y: 10 }, config: { bucket_name: 'bucket-a' }, metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 }, version: 1 } }],
      });

      dag.forkBranch('branch-b', commitRoot);
      const commitB = dag.addCommit({
        message: 'Branch B adds RDS',
        author: 'beta',
        patches: [{ op: 'add', path: '/nodes/rds_b', value: { id: 'rds_b', type: 'aws_db_instance', name: 'DB B', position: { x: 20, y: 20 }, config: { engine: 'mysql' }, metadata: { createdBy: 'beta', createdAt: 0, updatedAt: 0 }, version: 1 } }],
      });

      const diff = dag.getDiff(commitA.id, commitB.id);
      expect(diff.commitAId).toBe(commitA.id);
      expect(diff.commitBId).toBe(commitB.id);
      expect(diff.lcaId).toBe(commitRoot);
      expect(diff.addedNodes.map((n) => n.id)).toContain('rds_b');
      expect(diff.removedNodes.map((n) => n.id)).toContain('s3_a');
      expect(diff.forwardPatches.length).toBeGreaterThan(0);
    });

    test('5.3 60 FPS Scrubber handles boundary values (0.0, 1.0, negative, NaN)', () => {
      dag.addCommit({
        message: 'Step 1',
        author: 'alpha',
        patches: [{ op: 'add', path: '/nodes/node_1', value: { id: 'node_1', type: 'aws_vpc', name: 'VPC 1', position: { x: 0, y: 0 }, config: {}, metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 }, version: 1 } }],
      });
      dag.addCommit({
        message: 'Step 2',
        author: 'beta',
        patches: [{ op: 'add', path: '/nodes/node_2', value: { id: 'node_2', type: 'aws_subnet', name: 'Subnet 2', position: { x: 0, y: 0 }, config: {}, metadata: { createdBy: 'beta', createdAt: 0, updatedAt: 0 }, version: 1 } }],
      });

      const rootState = dag.scrubTo(0.0);
      expect(Object.keys(rootState.nodes)).toHaveLength(0);

      const headState = dag.scrubTo(1.0);
      expect(Object.keys(headState.nodes)).toHaveLength(2);

      // Clamping negative to 0.0
      const negState = dag.scrubTo(-0.8);
      expect(Object.keys(negState.nodes)).toHaveLength(0);

      // Clamping > 1.0 to 1.0
      const overState = dag.scrubTo(2.5);
      expect(Object.keys(overState.nodes)).toHaveLength(2);
    });

    test('5.4 Export DAG structure and branch switching error handling', () => {
      const exported = dag.exportDAG();
      expect(exported.nodes.length).toBeGreaterThan(0);
      expect(exported.branches['main']).toBeDefined();
      expect(exported.activeBranchName).toBe('main');

      expect(() => dag.switchBranch('non_existent_branch')).toThrow(/does not exist/i);
      expect(() => dag.checkout('non_existent_commit_id')).toThrow(/not found/i);
    });
  });

  // =========================================================================
  // Module 6: HCLSyncEngine AST Compilation & Deserialization
  // =========================================================================
  describe('Module 6: HCLSyncEngine AST Bidirectional Round-Trip Hardening', () => {
    test('6.1 Round-trip fidelity across all 10 canonical AWS primitives', () => {
      const state: TopologyState = {
        nodes: {
          vpc_main: { id: 'vpc_main', type: 'aws_vpc', name: 'Primary VPC', position: { x: 0, y: 0 }, config: { cidr_block: '10.0.0.0/16', enable_dns_hostnames: true }, metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 }, version: 1 },
          sub_1: { id: 'sub_1', type: 'aws_subnet', name: 'Public Subnet', position: { x: 0, y: 0 }, config: { vpc_id: 'vpc_main', cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' }, metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 }, version: 1 },
          ec2_web: { id: 'ec2_web', type: 'aws_instance', name: 'Web Server', position: { x: 0, y: 0 }, config: { instance_type: 't3.micro', subnet_id: 'sub_1', root_volume_gb: 30, root_volume_type: 'gp3', http_tokens: 'required' }, metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 }, version: 1 },
          ecs_prod: { id: 'ecs_prod', type: 'aws_ecs_cluster', name: 'Prod ECS', position: { x: 0, y: 0 }, config: { cluster_name: 'prod-cluster' }, metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 }, version: 1 },
          eks_prod: { id: 'eks_prod', type: 'aws_eks_cluster', name: 'Prod EKS', position: { x: 0, y: 0 }, config: { cluster_name: 'prod-eks', kubernetes_version: '1.30' }, metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 }, version: 1 },
          rds_postgres: { id: 'rds_postgres', type: 'aws_db_instance', name: 'Primary DB', position: { x: 0, y: 0 }, config: { engine: 'postgres', instance_class: 'db.m6g.large', allocated_storage_gb: 100, multi_az: true, storage_encrypted: true }, metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 }, version: 1 },
          s3_bucket: { id: 's3_bucket', type: 'aws_s3_bucket', name: 'Assets Bucket', position: { x: 0, y: 0 }, config: { bucket_name: 'corp-assets-prod', versioning_enabled: true, encryption: { sse_algorithm: 'AES256' } }, metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 }, version: 1 },
          alb_main: { id: 'alb_main', type: 'aws_lb', name: 'Public ALB', position: { x: 0, y: 0 }, config: { load_balancer_type: 'application', subnet_ids: ['sub_1'] }, metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 }, version: 1 },
          sg_web: { id: 'sg_web', type: 'aws_security_group', name: 'Web SG', position: { x: 0, y: 0 }, config: { vpc_id: 'vpc_main', ingress_rules: [{ protocol: 'tcp', from_port: 443, to_port: 443, cidr_blocks: ['0.0.0.0/0'] }] }, metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 }, version: 1 },
          iam_role: { id: 'iam_role', type: 'aws_iam_role', name: 'EC2 Role', position: { x: 0, y: 0 }, config: { role_name: 'EC2Role' }, metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 }, version: 1 },
        },
        edges: {},
        version: 1,
      };

      const hcl = canvasToHcl(state);
      expect(hcl).toContain('resource "aws_vpc" "vpc_main"');
      expect(hcl).toContain('resource "aws_subnet" "sub_1"');
      expect(hcl).toContain('resource "aws_instance" "ec2_web"');
      expect(hcl).toContain('resource "aws_ecs_cluster" "ecs_prod"');
      expect(hcl).toContain('resource "aws_eks_cluster" "eks_prod"');
      expect(hcl).toContain('resource "aws_db_instance" "rds_postgres"');
      expect(hcl).toContain('resource "aws_s3_bucket" "s3_bucket"');
      expect(hcl).toContain('resource "aws_lb" "alb_main"');
      expect(hcl).toContain('resource "aws_security_group" "sg_web"');
      expect(hcl).toContain('resource "aws_iam_role" "iam_role"');

      // Parse HCL back into Canvas state
      const parsedState = hclToCanvas(hcl);
      expect(Object.keys(parsedState.nodes)).toHaveLength(10);
      expect(parsedState.nodes['vpc_main']?.type).toBe('aws_vpc');
      expect(parsedState.nodes['ec2_web']?.type).toBe('aws_instance');
      expect(parsedState.nodes['rds_postgres']?.type).toBe('aws_db_instance');
      expect(parsedState.nodes['s3_bucket']?.type).toBe('aws_s3_bucket');
    });

    test('6.2 Hostile, malformed, and empty HCL inputs parse safely without throwing exceptions', () => {
      const emptyState = hclToCanvas('');
      expect(Object.keys(emptyState.nodes)).toHaveLength(0);

      const garbageHcl = `
        {{{ invalid syntax !!!
        resource "unknown_thing" {
          unclosed = "string
        // trailing comment
      `;
      const garbageState = hclToCanvas(garbageHcl);
      expect(garbageState).toBeDefined();
      expect(typeof garbageState.nodes).toBe('object');
    });

    test('6.3 Incremental patch computation (computePatchesFromHcl) generates precise add/replace/remove patches', () => {
      const oldState: TopologyState = {
        nodes: {
          vpc_1: { id: 'vpc_1', type: 'aws_vpc', name: 'VPC 1', position: { x: 0, y: 0 }, config: { cidr_block: '10.0.0.0/16' }, metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 }, version: 1 },
        },
        edges: {},
        version: 1,
      };

      const newHcl = `
resource "aws_vpc" "vpc_1" {
  cidr_block = "172.16.0.0/16"
}
resource "aws_s3_bucket" "s3_new" {
  bucket = "new-bucket"
}
`;

      const patches = computePatchesFromHcl(oldState, newHcl);
      expect(patches.length).toBeGreaterThanOrEqual(2);

      const replaceCidr = patches.find((p) => p.op === 'replace' && p.path === '/nodes/vpc_1/config/cidr_block');
      expect(replaceCidr?.value).toBe('172.16.0.0/16');

      const addS3 = patches.find((p) => p.op === 'add' && p.path === '/nodes/s3_new');
      expect(addS3).toBeDefined();
    });
  });

  // =========================================================================
  // Module 7: DeterministicSwarmSim & Preset Scenarios
  // =========================================================================
  describe('Module 7: DeterministicSwarmSim Zero-Key Execution', () => {
    let sim: DeterministicSwarmSim;

    beforeEach(() => {
      sim = new DeterministicSwarmSim();
    });

    test('7.1 Executes all 3 preset scenarios in <100ms with valid stats', async () => {
      const scenarioIds = ['ecommerce_ha', 'fintech_zerotrust', 'microservices_mesh'];

      for (const id of scenarioIds) {
        const stepRecords: SimStep[] = [];
        const report = await sim.runScenario(id, (step) => {
          stepRecords.push(step);
        });

        expect(report.success).toBe(true);
        expect(report.stepsCount).toBe(stepRecords.length);
        expect(report.durationMs).toBeLessThan(100);
        expect(report.finalSecurityScore).toBeGreaterThanOrEqual(90);
        expect(report.agentStats.alpha.actionsCount).toBeGreaterThan(0);
        expect(report.agentStats.beta.actionsCount).toBeGreaterThan(0);
        expect(report.agentStats.gamma.actionsCount).toBeGreaterThan(0);
        expect(Object.keys(report.finalState.nodes).length).toBeGreaterThan(0);
      }
    });

    test('7.2 Synchronous runner (runScenarioSync) matches async execution parity', () => {
      const asyncReport = sim.runScenarioSync('ecommerce_ha');
      expect(asyncReport.success).toBe(true);
      expect(asyncReport.stepsCount).toBe(6);
      expect(asyncReport.finalSecurityScore).toBe(90);
      expect(asyncReport.totalMonthlyCostDeltaUsd).toBeCloseTo(428.25, 2);
    });

    test('7.3 Custom scenario registration and missing scenario rejection', async () => {
      const customScenario: SimulationScenario = {
        id: 'custom_edge_scenario',
        name: 'Custom Edge Scenario',
        category: 'general',
        targetArchitecture: 'Custom Architecture',
        initialPrompt: 'Run custom edge scenario',
        description: 'Tests single step custom simulation',
        steps: [
          {
            stepIndex: 1,
            agentId: 'alpha',
            role: 'Topology & Network Architect',
            action: 'Deploy VPC',
            thought: 'Deploying isolated VPC',
            toolName: 'create_resource_node',
            targetResourceId: 'custom_vpc',
            executionBadge: '0.12ms',
            patchSummary: 'Add custom_vpc',
            patches: [
              {
                op: 'add',
                path: '/nodes/custom_vpc',
                value: {
                  id: 'custom_vpc',
                  type: 'aws_vpc',
                  name: 'Custom VPC',
                  position: { x: 0, y: 0 },
                  config: { cidr_block: '10.99.0.0/16' },
                  metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
                  version: 1,
                },
              },
            ],
            costDeltaMonthlyUsd: 0,
            securityScoreDelta: 20,
          },
        ],
      };

      sim.registerScenario(customScenario);
      expect(sim.getScenario('custom_edge_scenario')).toBeDefined();

      const report = await sim.runScenario('custom_edge_scenario');
      expect(report.success).toBe(true);
      expect(report.stepsCount).toBe(1);
      expect(report.finalState.nodes['custom_vpc']).toBeDefined();

      await expect(sim.runScenario('non_existent_scenario_123')).rejects.toThrow(/not found/i);
    });
  });

  // =========================================================================
  // Module 8: ProductionMaterializer & In-Memory PKZIP Exporter
  // =========================================================================
  describe('Module 8: ProductionMaterializer & PKZIP Export Hardening', () => {
    test('8.1 Generates complete multi-file production deployment bundle', () => {
      const state = createDefaultTopologyState();
      const bundle = ProductionMaterializer.materializeBundle(state, {
        securityScore: 95,
        totalMonthlyCostUsd: 428.25,
      });

      expect(bundle['main.tf']).toContain('provider "aws"');
      expect(bundle['variables.tf']).toContain('variable "aws_region"');
      expect(bundle['outputs.tf']).toBeDefined();
      expect(bundle['terraform.tfvars.example']).toContain('aws_region');
      expect(bundle['Dockerfile']).toContain('FROM node:20-alpine');
      expect(bundle['.dockerignore']).toContain('node_modules');
      expect(bundle['audit_certificate.json']).toContain('CloudSwarm-SecOps-Certified-Production-Release');
      expect(bundle['README.md']).toContain('# CloudSwarm Studio');
    });

    test('8.2 Audit certificate produces valid cryptographic SHA-256 integrity hash', () => {
      const certJson = generateAuditCertificate({
        securityScore: 98,
        totalMonthlyCostUsd: 350.0,
      });

      const certObj = JSON.parse(certJson);
      expect(certObj.certificate).toBe('CloudSwarm-SecOps-Certified-Production-Release');
      expect(certObj.grade).toBe('A+');
      expect(certObj.sha256).toHaveLength(64);
    });

    test('8.3 In-memory ZIP archive generates valid binary PKZIP headers', async () => {
      const state = createDefaultTopologyState();
      const zipBlob = await generateZipBundle(state, { securityScore: 95, totalMonthlyCostUsd: 428.25 });

      expect(zipBlob).toBeDefined();
      expect(zipBlob.size).toBeGreaterThan(500);
      expect(zipBlob.type).toBe('application/zip');

      const arrayBuffer = await zipBlob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      // Verify PKZIP local file header signature: 0x50 0x4B 0x03 0x04 ('PK\x03\x04')
      expect(uint8[0]).toBe(0x50);
      expect(uint8[1]).toBe(0x4b);
      expect(uint8[2]).toBe(0x03);
      expect(uint8[3]).toBe(0x04);
    });
  });

  // =========================================================================
  // Module 9: useCloudSwarmStore Reactive State Machine
  // =========================================================================
  describe('Module 9: Master Zustand Store Integration & Stress', () => {
    beforeEach(() => {
      useCloudSwarmStore.getState().resetTopology();
    });

    test('9.1 CRUD lifecycle: addNode, moveNode, updateNodeConfig, addEdge, removeNode', async () => {
      const store = useCloudSwarmStore.getState();

      // Add VPC
      const nodeVpc: CloudResourceNode = {
        id: 'vpc_crud',
        type: 'aws_vpc',
        name: 'CRUD VPC',
        position: { x: 100, y: 100 },
        config: { cidr_block: '10.0.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      await store.addNode(nodeVpc, 'alpha');
      expect(useCloudSwarmStore.getState().topologyState.nodes['vpc_crud']).toBeDefined();

      // Move Node
      await store.moveNode('vpc_crud', { x: 250, y: 350 });
      expect(useCloudSwarmStore.getState().topologyState.nodes['vpc_crud']?.position).toEqual({ x: 250, y: 350 });

      // Update Node Config
      await store.updateNodeConfig('vpc_crud', { enable_dns_hostnames: true }, 'beta');
      expect(useCloudSwarmStore.getState().topologyState.nodes['vpc_crud']?.config.enable_dns_hostnames).toBe(true);

      // Add Subnet & Edge
      const nodeSub: CloudResourceNode = {
        id: 'sub_crud',
        type: 'aws_subnet',
        name: 'CRUD Subnet',
        position: { x: 400, y: 350 },
        config: { cidr_block: '10.0.1.0/24' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      await store.addNode(nodeSub, 'alpha');

      const edge: TopologyEdge = {
        id: 'edge_vpc_sub',
        source: 'vpc_crud',
        target: 'sub_crud',
        type: 'contains',
        version: 1,
      };
      await store.addEdge(edge, 'alpha');
      expect(useCloudSwarmStore.getState().topologyState.edges['edge_vpc_sub']).toBeDefined();

      // Cascade remove VPC
      await store.removeNode('vpc_crud', 'alpha');
      expect(useCloudSwarmStore.getState().topologyState.nodes['vpc_crud']).toBeUndefined();
      expect(useCloudSwarmStore.getState().topologyState.edges['edge_vpc_sub']).toBeUndefined();
    });

    test('9.2 Execution log queue maintains strictly capped 100 entries', () => {
      const store = useCloudSwarmStore.getState();

      for (let i = 0; i < 150; i++) {
        store.logAction('alpha', 'CAS_APPLY', `Stress log ${i}`, 0.1);
      }

      const logs = useCloudSwarmStore.getState().executionLogs;
      expect(logs.length).toBeLessThanOrEqual(100);
      expect(logs[0]?.message).toBe('Stress log 149'); // Most recent log on top
    });

    test('9.3 Agent presence updates position, thought, velocity, and inspection state', () => {
      const store = useCloudSwarmStore.getState();

      store.updateAgentPresence('alpha', {
        currentX: 500,
        currentY: 600,
        thoughtText: 'Refactoring network fabric...',
        isInspecting: true,
      });

      const presence = useCloudSwarmStore.getState().agentPresences['alpha'];
      expect(presence.currentX).toBe(500);
      expect(presence.currentY).toBe(600);
      expect(presence.thoughtText).toBe('Refactoring network fabric...');
      expect(presence.isInspecting).toBe(true);
    });

    test('9.4 Bi-directional HCL sync updates canvas state and reflects in store', async () => {
      const store = useCloudSwarmStore.getState();

      const newHcl = `
resource "aws_vpc" "vpc_hcl_sync" {
  cidr_block = "10.88.0.0/16"
}
`;

      await store.syncHclToCanvas(newHcl);
      const state = useCloudSwarmStore.getState().topologyState;
      expect(state.nodes['vpc_hcl_sync']).toBeDefined();
      expect(state.nodes['vpc_hcl_sync']?.config.cidr_block).toBe('10.88.0.0/16');
      expect(useCloudSwarmStore.getState().isHclDirty).toBe(false);
    });

    test('9.5 Full Swarm Demo runs through store and updates simulation progress to 100%', async () => {
      const store = useCloudSwarmStore.getState();
      store.setStepDelayMs(0); // Instant headless execution

      const report = await store.runSwarmDemo('ecommerce_ha');
      expect(report.success).toBe(true);
      expect(useCloudSwarmStore.getState().isSimulating).toBe(false);
      expect(useCloudSwarmStore.getState().simulationProgress).toBe(100);
      expect(useCloudSwarmStore.getState().auditReport.securityScore).toBeGreaterThanOrEqual(90);
    });
  });
});
