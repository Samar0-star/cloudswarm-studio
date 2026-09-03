/**
 * Challenger M1-1: Concurrency, Locking & CAS Rollback Invariance Stress Suite
 *
 * Adversarial stress harness verifying:
 * 1. Deadlock freedom under multi-resource circular wait & inverted acquisition orders.
 * 2. High-contention mutual exclusion on hot resources across distinct competing agents.
 * 3. TTL lease expiration, self-healing, and lease renewal boundaries.
 * 4. CAS Rollback Invariance Theorem: Apply(Apply(S, Delta), Delta^-1) === S across high-depth random mutations.
 * 5. Concurrent multi-agent optimistic CAS conflict handling on shared resources.
 * 6. Cascading topology graph rollback consistency.
 * 7. Sub-millisecond performance guarantees for transactions and microsecond rollbacks.
 * 8. Dynamic lock set expansion, subset acquisitions, and partial release semantics.
 * 9. Scale stress with 500+ operations over 50 distributed resources.
 * 10. Deep JSON Pointer CAS verification and all-or-nothing transaction atomicity.
 */

import { StripedLockManager } from '../core/lock/StripedLockManager';
import { OptimisticStateEngine } from '../core/state/OptimisticStateEngine';
import type { AgentId } from '../types/swarm';
import type { CloudResourceNode, TopologyEdge } from '../types/topology';
import type { StateTransaction, RFC6902Patch } from '../types/patch';

describe('Challenger M1-1: Concurrency, Deadlock & CAS Rollback Stress Harness', () => {
  describe('StripedLockManager Adversarial Stress', () => {
    let lockManager: StripedLockManager;

    beforeEach(() => {
      lockManager = new StripedLockManager(64, 1000);
    });

    afterEach(() => {
      lockManager.clearAll();
    });

    test('Deadlock Freedom: Circular Wait Elimination with Inverted Acquisition Orders', async () => {
      // Classic Dining Philosophers / Circular Wait Scenario across Swarm Agents:
      // Agent alpha:    [res_A, res_B]
      // Agent beta:     [res_B, res_C]
      // Agent gamma:    [res_C, res_D]
      // Agent director: [res_D, res_A] (Inverted order)
      // Agent human:    [res_D, res_C, res_B, res_A] (Fully inverted)
      const agents: AgentId[] = ['alpha', 'beta', 'gamma', 'delta', 'director', 'human'];
      const resourceCycles: Partial<Record<AgentId, string[]>> = {
        alpha: ['res_A', 'res_B'],
        beta: ['res_B', 'res_C'],
        gamma: ['res_C', 'res_D'],
        delta: ['res_D', 'res_B'],
        director: ['res_D', 'res_A'],
        human: ['res_D', 'res_C', 'res_B', 'res_A'],
      };

      const cyclesPerAgent = 40;
      let totalAcquisitions = 0;
      let totalContentionTimeouts = 0;

      // Run each agent's autonomous operational loop concurrently
      const agentLoops = agents.map(async (agent) => {
        const requestedResources = resourceCycles[agent] || [];

        for (let cycle = 0; cycle < cyclesPerAgent; cycle++) {
          try {
            const handle = await lockManager.acquireLocks(requestedResources, agent, 120, {
              retryOnContention: true,
              maxRetries: 15,
              initialBackoffMs: 2,
              maxBackoffMs: 25,
              timeoutMs: 250,
            });

            // Verify mutual exclusion and holder verification
            expect(lockManager.isHeldBy(requestedResources, agent)).toBe(true);
            for (const res of requestedResources) {
              expect(lockManager.getHolder(res)).toBe(agent);
            }

            // Simulate microsecond async work while holding locks
            await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 3) + 1));

            totalAcquisitions++;
            await handle.release();
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            expect(msg).toContain('LOCK_ACQUISITION_TIMEOUT');
            totalContentionTimeouts++;
          }
        }
      });

      await Promise.all(agentLoops);

      // Verify all agent loops completed without deadlock
      expect(totalAcquisitions + totalContentionTimeouts).toBe(agents.length * cyclesPerAgent);
      expect(totalAcquisitions).toBeGreaterThan(50); // High throughput

      // Lock table should be fully clean after completion
      lockManager.sweepExpiredLeases();
      expect(lockManager.getActiveLocks().length).toBe(0);
    });

    test('High-Contention Hot-Spot: Mutual Exclusion Across Competing Agents', async () => {
      const hotResourceId = 'hot_spot_vpc_main';
      const agents: AgentId[] = ['alpha', 'beta', 'gamma', 'director', 'human'];
      let activeHoldersCount = 0;
      let maxSimultaneousHolders = 0;
      let successCount = 0;

      const cyclesPerAgent = 30;

      const agentLoops = agents.map(async (agent) => {
        for (let cycle = 0; cycle < cyclesPerAgent; cycle++) {
          try {
            const handle = await lockManager.acquireLocks([hotResourceId], agent, 80, {
              retryOnContention: true,
              maxRetries: 20,
              initialBackoffMs: 2,
              maxBackoffMs: 20,
              timeoutMs: 400,
            });

            // CRITICAL INVARIANT: Mutual exclusion check across distinct agents
            activeHoldersCount++;
            maxSimultaneousHolders = Math.max(maxSimultaneousHolders, activeHoldersCount);

            expect(lockManager.getHolder(hotResourceId)).toBe(agent);

            // Hold lock briefly
            await new Promise((r) => setTimeout(r, 1));

            activeHoldersCount--;
            await handle.release();
            successCount++;
          } catch {
            // Contention timeout is expected under high concurrency
          }
        }
      });

      await Promise.all(agentLoops);

      // Mutual exclusion must NEVER be violated (strictly <= 1 at any moment)
      expect(maxSimultaneousHolders).toBe(1);
      expect(activeHoldersCount).toBe(0);
      expect(successCount).toBeGreaterThan(20);
      expect(lockManager.isLocked(hotResourceId)).toBe(false);
    });

    test('TTL Lease Abandonment & Self-Healing', async () => {
      const abandonedResource = 'abandoned_ec2_node';
      const shortTtlMs = 40;

      // Agent alpha acquires lock and abandons it without releasing
      const handleAlpha = await lockManager.acquireLocks([abandonedResource], 'alpha', shortTtlMs);
      expect(lockManager.getHolder(abandonedResource)).toBe('alpha');
      expect(handleAlpha.isExpired()).toBe(false);

      // Agent beta attempts immediate acquisition -> must be rejected
      await expect(
        lockManager.acquireLocks([abandonedResource], 'beta', 100, { retryOnContention: false })
      ).rejects.toThrow(/LOCK_ACQUISITION_TIMEOUT/);

      // Wait for TTL expiry
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Invariant: Expired lock must be recognized as expired
      expect(handleAlpha.isExpired()).toBe(true);
      expect(lockManager.isLocked(abandonedResource)).toBe(false);
      expect(lockManager.getHolder(abandonedResource)).toBeNull();

      // Invariant: Expired lease renewal must fail
      expect(handleAlpha.renew(100)).toBe(false);

      // Invariant: Beta can now acquire abandoned resource immediately
      const handleBeta = await lockManager.acquireLocks([abandonedResource], 'beta', 200);
      expect(handleBeta.agentId).toBe('beta');
      expect(lockManager.getHolder(abandonedResource)).toBe('beta');
      await handleBeta.release();
    });

    test('Idempotent Multi-Release and Batch Renewal Integrity', async () => {
      const handle = await lockManager.acquireLocks(['res_x', 'res_y', 'res_z'], 'gamma', 500);

      // Multiple releases must not throw
      await handle.release();
      await expect(handle.release()).resolves.not.toThrow();
      await expect(lockManager.releaseLocks(['res_x', 'res_y'], 'gamma')).resolves.not.toThrow();

      // Renewing released locks must return false
      expect(handle.renew(500)).toBe(false);
    });

    test('Stripe Hashing Edge Cases: Negative Hashes, Unicode & Special Characters', () => {
      const testKeys = [
        '',
        ' ',
        'aws:vpc:us-east-1:123456789012:vpc/vpc-0a1b2c3d4e5f67890',
        '🚀_cloud_node_#100!',
        'node-with-slashes/and.dots_and-dashes',
        '中文_节点_aws',
        'a'.repeat(500),
      ];

      for (const key of testKeys) {
        const stripe = lockManager.getStripe(key);
        expect(Number.isInteger(stripe)).toBe(true);
        expect(stripe).toBeGreaterThanOrEqual(0);
        expect(stripe).toBeLessThan(64);
      }
    });

    test('Lock Set Expansion and Independent Partial Release', async () => {
      // Step 1: Agent alpha acquires [res_1, res_2]
      const handle1 = await lockManager.acquireLocks(['res_1', 'res_2'], 'alpha', 1000);
      expect(lockManager.isHeldBy(['res_1', 'res_2'], 'alpha')).toBe(true);

      // Step 2: Agent alpha acquires [res_2, res_3] (expanding lock set)
      const handle2 = await lockManager.acquireLocks(['res_2', 'res_3'], 'alpha', 1000);
      expect(lockManager.isHeldBy(['res_1', 'res_2', 'res_3'], 'alpha')).toBe(true);

      // Step 3: Release handle2 ([res_2, res_3])
      await handle2.release();
      expect(lockManager.isLocked('res_3')).toBe(false);

      // Step 4: Release handle1 ([res_1, res_2])
      await handle1.release();
      expect(lockManager.isLocked('res_1')).toBe(false);
      expect(lockManager.isLocked('res_2')).toBe(false);
      expect(lockManager.getActiveLocks().length).toBe(0);
    });

    test('Scale Stress: 500 Concurrent Batches Across 50 Distributed Resources', async () => {
      const totalResources = 50;
      const resourcePool = Array.from({ length: totalResources }, (_, i) => `cluster_res_${i}`);
      const agents: AgentId[] = ['alpha', 'beta', 'gamma', 'director', 'human'];

      const totalTasks = 500;
      const tasks: Promise<void>[] = [];
      let successfulAcquisitions = 0;

      for (let i = 0; i < totalTasks; i++) {
        const agent = agents[i % agents.length]!;
        // Pick 3 pseudo-random resources
        const r1 = resourcePool[i % totalResources]!;
        const r2 = resourcePool[(i * 7 + 3) % totalResources]!;
        const r3 = resourcePool[(i * 13 + 7) % totalResources]!;
        const requested = [r1, r2, r3];

        tasks.push(
          (async () => {
            try {
              const handle = await lockManager.acquireLocks(requested, agent, 100, {
                retryOnContention: true,
                maxRetries: 15,
                initialBackoffMs: 2,
                maxBackoffMs: 20,
                timeoutMs: 300,
              });

              successfulAcquisitions++;
              await new Promise((r) => setTimeout(r, 1));
              await handle.release();
            } catch {
              // Timeouts under 500 concurrent operations are valid
            }
          })()
        );
      }

      await Promise.all(tasks);

      expect(successfulAcquisitions).toBeGreaterThan(100);
      lockManager.sweepExpiredLeases();
      expect(lockManager.getActiveLocks().length).toBe(0);
    });
  });

  describe('OptimisticStateEngine CAS Rollback Invariance & Stress', () => {
    let engine: OptimisticStateEngine;

    beforeEach(() => {
      engine = new OptimisticStateEngine();
    });

    test('Patch Symmetry & CAS Rollback Invariance Theorem: S === Rollback(Apply(S, Delta))', async () => {
      const initialSnapshot = JSON.parse(JSON.stringify(engine.getState()));
      const appliedTransactions: StateTransaction[] = [];
      const inversePatchStack: RFC6902Patch[][] = [];

      const totalCycles = 50;

      // 1. Generate 50 randomized mutation transactions
      for (let i = 0; i < totalCycles; i++) {
        const nodeId = `node_fuzz_${i}`;
        const node: CloudResourceNode = {
          id: nodeId,
          type: i % 2 === 0 ? 'aws_vpc' : 'aws_instance',
          name: `Fuzz Node ${i}`,
          position: { x: i * 10, y: i * 15 },
          config: {
            cidr_block: `10.${i}.0.0/16`,
            tags: { Environment: i % 2 === 0 ? 'prod' : 'dev', Index: i },
            security_groups: [`sg-${i}-a`, `sg-${i}-b`],
            nested: { level1: { level2: { value: i * 100 } } },
          },
          metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
          version: 1,
        };

        const tx: StateTransaction = {
          id: `tx_fuzz_add_${i}`,
          agentId: 'alpha',
          description: `Add ${nodeId}`,
          timestamp: Date.now(),
          patches: [{ op: 'add', path: `/nodes/${nodeId}`, value: node }],
        };

        const res = await engine.applyTransaction(tx);
        expect(res.success).toBe(true);
        appliedTransactions.push(tx);
        inversePatchStack.push([...res.inversePatches]);
      }

      // Add 20 interconnecting edges
      for (let i = 0; i < 20; i++) {
        const edgeId = `edge_fuzz_${i}`;
        const edge: TopologyEdge = {
          id: edgeId,
          source: `node_fuzz_${i}`,
          target: `node_fuzz_${i + 1}`,
          type: 'routes_to',
          version: 1,
        };

        const tx: StateTransaction = {
          id: `tx_fuzz_edge_${i}`,
          agentId: 'beta',
          description: `Add ${edgeId}`,
          timestamp: Date.now(),
          patches: [{ op: 'add', path: `/edges/${edgeId}`, value: edge }],
        };

        const res = await engine.applyTransaction(tx);
        expect(res.success).toBe(true);
        appliedTransactions.push(tx);
        inversePatchStack.push([...res.inversePatches]);
      }

      // Modify 20 node configs
      for (let i = 0; i < 20; i++) {
        const nodeId = `node_fuzz_${i}`;
        const tx: StateTransaction = {
          id: `tx_fuzz_mod_${i}`,
          agentId: 'gamma',
          description: `Modify ${nodeId}`,
          timestamp: Date.now(),
          patches: [
            { op: 'replace', path: `/nodes/${nodeId}/config/cidr_block`, value: `172.16.${i}.0/24` },
            { op: 'replace', path: `/nodes/${nodeId}/config/nested/level1/level2/value`, value: 9999 },
          ],
        };

        const res = await engine.applyTransaction(tx);
        expect(res.success).toBe(true);
        appliedTransactions.push(tx);
        inversePatchStack.push([...res.inversePatches]);
      }

      expect(Object.keys(engine.getState().nodes).length).toBe(totalCycles);
      expect(Object.keys(engine.getState().edges).length).toBe(20);
      expect(engine.getState().version).toBe(appliedTransactions.length);

      // 2. Rollback all transactions in reverse order
      while (inversePatchStack.length > 0) {
        const inversePatches = inversePatchStack.pop()!;
        const rollbackRes = engine.rollback(inversePatches);
        expect(rollbackRes.success).toBe(true);
      }

      // 3. Mathematical Verification: State must be restored to initial empty topology
      const restoredState = engine.getState();
      expect(restoredState.nodes).toEqual(initialSnapshot.nodes);
      expect(restoredState.edges).toEqual(initialSnapshot.edges);
      expect(Object.keys(restoredState.nodes).length).toBe(0);
      expect(Object.keys(restoredState.edges).length).toBe(0);
    });

    test('Concurrent Multi-Agent Optimistic CAS Contention Race', async () => {
      // 1. Setup shared node
      const sharedNodeId = 'shared_db_cluster';
      const initialNode: CloudResourceNode = {
        id: sharedNodeId,
        type: 'aws_db_instance',
        name: 'Shared Aurora DB',
        position: { x: 100, y: 100 },
        config: { instance_class: 'db.r6g.large', allocated_storage_gb: 100 },
        metadata: { createdBy: 'director', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      await engine.addNode(initialNode, 'director');

      const currentExpectedVersion = engine.getState().nodes[sharedNodeId]!.version;
      const initialRootVersion = engine.getState().version;

      // 2. Launch 20 concurrent agents trying to update the same node with expectedVersions
      const concurrentAgents: AgentId[] = ['alpha', 'beta', 'gamma', 'director', 'human'];
      const numCompetitors = 20;

      const results = await Promise.all(
        Array.from({ length: numCompetitors }, (_, i) => {
          const agent = concurrentAgents[i % concurrentAgents.length]!;
          const tx: StateTransaction = {
            id: `tx_race_${i}`,
            agentId: agent,
            description: `Agent ${agent} updating allocated_storage_gb to ${200 + i}`,
            timestamp: Date.now(),
            expectedVersions: { [sharedNodeId]: currentExpectedVersion },
            patches: [
              {
                op: 'replace',
                path: `/nodes/${sharedNodeId}/config/allocated_storage_gb`,
                value: 200 + i,
              },
            ],
          };
          return engine.applyTransaction(tx);
        })
      );

      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      // EXACTLY ONE agent must succeed
      expect(successes.length).toBe(1);
      // Remaining 19 agents must fail with CAS conflict
      expect(failures.length).toBe(numCompetitors - 1);

      for (const fail of failures) {
        expect(fail.casFailedKey).toBe(sharedNodeId);
        expect(fail.conflictError).toContain('CAS node version mismatch');
      }

      // Root state version incremented by exactly 1
      expect(engine.getState().version).toBe(initialRootVersion + 1);
      // Per-node version incremented to currentExpectedVersion + 1
      expect(engine.getState().nodes[sharedNodeId]?.version).toBe(currentExpectedVersion + 1);
    });

    test('Cascading Graph Rollback Invariance', async () => {
      // 1. Build a complex topology: 1 VPC, 2 Subnets, 4 EC2 instances, 6 Edges
      const vpc: CloudResourceNode = {
        id: 'vpc_root',
        type: 'aws_vpc',
        name: 'Root VPC',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.0.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
        version: 1,
      };
      await engine.addNode(vpc, 'alpha');

      for (let i = 1; i <= 2; i++) {
        const sub: CloudResourceNode = {
          id: `sub_${i}`,
          type: 'aws_subnet',
          name: `Subnet ${i}`,
          position: { x: i * 50, y: 50 },
          config: { cidr_block: `10.0.${i}.0/24` },
          metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
          version: 1,
        };
        await engine.addNode(sub, 'alpha');
        await engine.addEdge(
          { id: `edge_vpc_sub_${i}`, source: 'vpc_root', target: `sub_${i}`, type: 'contains', version: 1 },
          'alpha'
        );
      }

      for (let i = 1; i <= 4; i++) {
        const parentSub = i <= 2 ? 'sub_1' : 'sub_2';
        const inst: CloudResourceNode = {
          id: `inst_${i}`,
          type: 'aws_instance',
          name: `Instance ${i}`,
          position: { x: i * 30, y: 100 },
          config: { instance_type: 't3.micro' },
          metadata: { createdBy: 'beta', createdAt: 100, updatedAt: 100 },
          version: 1,
        };
        await engine.addNode(inst, 'beta');
        await engine.addEdge(
          { id: `edge_sub_inst_${i}`, source: parentSub, target: `inst_${i}`, type: 'contains', version: 1 },
          'beta'
        );
      }

      expect(Object.keys(engine.getState().nodes).length).toBe(7); // 1 vpc + 2 sub + 4 inst
      expect(Object.keys(engine.getState().edges).length).toBe(6); // 2 vpc-sub + 4 sub-inst

      const preCascadeState = JSON.parse(JSON.stringify(engine.getState()));

      // 2. Cascade delete sub_1 (should cascade delete edge_vpc_sub_1, edge_sub_inst_1, edge_sub_inst_2)
      const deleteResult = await engine.removeNode('sub_1', true, 'alpha');
      expect(deleteResult.success).toBe(true);
      expect(engine.getState().nodes['sub_1']).toBeUndefined();
      expect(engine.getState().edges['edge_vpc_sub_1']).toBeUndefined();
      expect(engine.getState().edges['edge_sub_inst_1']).toBeUndefined();
      expect(engine.getState().edges['edge_sub_inst_2']).toBeUndefined();

      // 3. Rollback cascade delete using inverse patches
      const rollbackRes = engine.rollback(deleteResult.inversePatches);
      expect(rollbackRes.success).toBe(true);

      // Invariant: Subnet and all 3 cascading edges are fully restored
      const restoredState = engine.getState();
      expect(restoredState.nodes['sub_1']).toBeDefined();
      expect(restoredState.nodes['sub_1']?.name).toBe('Subnet 1');
      expect(restoredState.edges['edge_vpc_sub_1']).toBeDefined();
      expect(restoredState.edges['edge_sub_inst_1']).toBeDefined();
      expect(restoredState.edges['edge_sub_inst_2']).toBeDefined();
      expect(restoredState.nodes).toEqual(preCascadeState.nodes);
      expect(restoredState.edges).toEqual(preCascadeState.edges);
    });

    test('Deep JSON Pointer Pathological Indexing and Array Mutation Verification', async () => {
      const node: CloudResourceNode = {
        id: 'node_deep_json',
        type: 'aws_ecs_cluster',
        name: 'ECS Cluster',
        position: { x: 50, y: 50 },
        config: {
          cluster_name: 'prod-cluster',
          capacity_providers: ['FARGATE', 'FARGATE_SPOT'],
          default_capacity_provider_strategy: [
            { capacity_provider: 'FARGATE', weight: 1, base: 1 },
            { capacity_provider: 'FARGATE_SPOT', weight: 4, base: 0 },
          ],
          settings: {
            containerInsights: 'enabled',
            deep: { nested: { array: [10, 20, 30] } },
          },
        },
        metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
        version: 1,
      };

      await engine.addNode(node, 'alpha');

      // Test 1: CAS test on deep array element
      const tx1: StateTransaction = {
        id: 'tx_deep_cas_success',
        agentId: 'beta',
        description: 'Verify deep array element and mutate',
        timestamp: Date.now(),
        patches: [
          {
            op: 'test',
            path: '/nodes/node_deep_json/config/default_capacity_provider_strategy/1/weight',
            value: 4,
          },
          {
            op: 'replace',
            path: '/nodes/node_deep_json/config/default_capacity_provider_strategy/1/weight',
            value: 10,
          },
        ],
      };

      const res1 = await engine.applyTransaction(tx1);
      expect(res1.success).toBe(true);

      const updatedNode = engine.getState().nodes['node_deep_json']!;
      const strat = updatedNode.config.default_capacity_provider_strategy as Array<{ weight: number }>;
      expect(strat[1]?.weight).toBe(10);

      // Test 2: CAS test on non-existent path gracefully rejects
      const tx2: StateTransaction = {
        id: 'tx_deep_cas_nonexistent',
        agentId: 'gamma',
        description: 'CAS test on missing path',
        timestamp: Date.now(),
        patches: [
          {
            op: 'test',
            path: '/nodes/node_deep_json/config/missing/nested/path',
            value: 'some_value',
          },
        ],
      };

      const res2 = await engine.applyTransaction(tx2);
      expect(res2.success).toBe(false);
      expect(res2.casFailedKey).toBe('/nodes/node_deep_json/config/missing/nested/path');
    });

    test('Transaction Atomicity: All-or-Nothing on CAS Failure', async () => {
      const node: CloudResourceNode = {
        id: 'node_atomic_test',
        type: 'aws_s3_bucket',
        name: 'Atomic Bucket',
        position: { x: 0, y: 0 },
        config: { bucket_name: 'initial-bucket-name', versioning: false },
        metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
        version: 1,
      };
      await engine.addNode(node, 'alpha');

      const versionBefore = engine.getState().version;

      // Transaction contains valid patch 1, but failing CAS test on patch 2
      const failingTx: StateTransaction = {
        id: 'tx_atomic_fail',
        agentId: 'beta',
        description: 'Partial valid mutation with failing CAS test',
        timestamp: Date.now(),
        patches: [
          { op: 'replace', path: '/nodes/node_atomic_test/config/bucket_name', value: 'modified-name' },
          { op: 'test', path: '/nodes/node_atomic_test/config/versioning', value: true }, // actual is false -> fails!
        ],
      };

      const res = await engine.applyTransaction(failingTx);
      expect(res.success).toBe(false);

      // Invariant: NONE of the patches were applied (atomicity guarantee)
      const currentNode = engine.getState().nodes['node_atomic_test']!;
      expect(currentNode.config.bucket_name).toBe('initial-bucket-name');
      expect(currentNode.config.versioning).toBe(false);
      expect(engine.getState().version).toBe(versionBefore);
    });

    test('Microsecond Latency Benchmark: 300 Transactions and Rollbacks', async () => {
      const executionTimes: number[] = [];
      const rollbackTimes: number[] = [];

      for (let i = 0; i < 300; i++) {
        const node: CloudResourceNode = {
          id: `bench_node_${i}`,
          type: 'aws_s3_bucket',
          name: `Bucket ${i}`,
          position: { x: i, y: i },
          config: { bucket_name: `my-bucket-${i}` },
          metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
          version: 1,
        };

        const res = await engine.addNode(node, 'alpha');
        executionTimes.push(res.executionTimeMs);

        const rb = engine.rollback(res.inversePatches);
        rollbackTimes.push(rb.executionTimeMs);
      }

      const avgExecTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const avgRollbackTime = rollbackTimes.reduce((a, b) => a + b, 0) / rollbackTimes.length;

      // Invariant: Atomic transactions must average < 1.0ms
      expect(avgExecTime).toBeLessThan(1.0);
      // Invariant: Microsecond rollbacks must average < 0.2ms
      expect(avgRollbackTime).toBeLessThan(0.2);
    });
  });
});
