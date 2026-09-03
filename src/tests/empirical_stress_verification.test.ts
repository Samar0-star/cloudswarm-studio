/**
 * Empirical Concurrency & Multi-Agent Stress Verification Test Suite
 *
 * Adversarial Challenger Suite verifying:
 * 1. 50+ concurrent agent lock acquisitions with StripedLockManager (zero deadlocks & proper TTL eviction).
 * 2. Concurrent CAS state collisions and multi-step transaction rollbacks.
 * 3. 4-agent parallel thought streams, presence updates, and execution log tracing.
 * 4. Microsecond performance benchmarks and state invariance guarantees.
 */

import { StripedLockManager } from '../core/lock/StripedLockManager';
import { OptimisticStateEngine } from '../core/state/OptimisticStateEngine';
import { WebModelContextEngine } from '../core/webmcp/WebModelContextEngine';
import { registerTopologyTools } from '../core/webmcp/tools/topologyTools';
import { registerSecurityTools } from '../core/webmcp/tools/securityTools';
import { registerFinOpsTools } from '../core/webmcp/tools/finopsTools';
import { LiveSwarmOrchestrator } from '../core/swarm/LiveSwarmOrchestrator';
import { GeminiClient } from '../core/swarm/GeminiClient';
import { NvidiaNimClient } from '../core/swarm/NvidiaNimClient';
import { useCloudSwarmStore } from '../store/useCloudSwarmStore';
import { AGENT_PERSONAS, type AgentId, type AgentPresenceState, type SwarmDecompositionPlan, type SwarmActionType } from '../types/swarm';
import type { CloudResourceNode, TopologyEdge, TopologyState } from '../types/topology';
import type { StateTransaction, RFC6902Patch } from '../types/patch';

describe('Empirical Concurrency & Multi-Agent Stress Verification', () => {
  // =========================================================================
  // SECTION 1: StripedLockManager 50+ Concurrent Lock Acquisitions & TTL Eviction
  // =========================================================================
  describe('1. StripedLockManager Concurrency & Deadlock Freedom Stress', () => {
    let lockManager: StripedLockManager;

    beforeEach(() => {
      lockManager = new StripedLockManager(64, 1500);
    });

    afterEach(() => {
      lockManager.clearAll();
    });

    test('1.1: 60 Concurrent Agent Lock Acquisitions Across Distributed Resources (Zero Deadlocks)', async () => {
      const resourcePool = Array.from({ length: 30 }, (_, i) => `ent_res_${i}`);
      const agentList: AgentId[] = ['alpha', 'beta', 'gamma', 'delta', 'director', 'human'];
      const totalCompetitors = 60;
      let successfulHolders = 0;
      let contentionCount = 0;

      // Launch 60 concurrent acquisition tasks
      const tasks = Array.from({ length: totalCompetitors }, async (_, i) => {
        const agent = agentList[i % agentList.length]!;
        // Select 3 deterministic pseudo-random resources
        const r1 = resourcePool[i % resourcePool.length]!;
        const r2 = resourcePool[(i * 7 + 1) % resourcePool.length]!;
        const r3 = resourcePool[(i * 13 + 5) % resourcePool.length]!;
        // Intentionally reverse or scramble ordering in requested array to test lexicographical sorting
        const requested = i % 2 === 0 ? [r3, r1, r2] : [r2, r3, r1];

        try {
          const handle = await lockManager.acquireLocks(requested, agent, 120, {
            retryOnContention: true,
            maxRetries: 15,
            initialBackoffMs: 2,
            maxBackoffMs: 25,
            timeoutMs: 350,
          });

          // Verify that this agent holds all requested resources
          expect(lockManager.isHeldBy(requested, agent)).toBe(true);
          for (const res of requested) {
            expect(lockManager.getHolder(res)).toBe(agent);
          }

          successfulHolders++;
          // Simulate micro-work
          await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 3) + 1));
          await handle.release();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          expect(msg).toContain('LOCK_ACQUISITION_TIMEOUT');
          contentionCount++;
        }
      });

      await Promise.all(tasks);

      // Invariant: Total tasks accounted for (no unhandled hangs or deadlocks)
      expect(successfulHolders + contentionCount).toBe(totalCompetitors);
      expect(successfulHolders).toBeGreaterThan(15);

      // Clean table post-execution
      lockManager.sweepExpiredLeases();
      expect(lockManager.getActiveLocks().length).toBe(0);
    });

    test('1.2: 50 Concurrent Competitors on a Single Hot Resource (Strict Mutual Exclusion Across Distinct Agents)', async () => {
      const hotResource = 'critical_shared_subnet';
      const agents: AgentId[] = ['alpha', 'beta', 'gamma', 'delta', 'director', 'human'];
      let activeHolders = 0;
      let maxSimultaneousHolders = 0;
      let totalSuccess = 0;

      // Each distinct agent runs concurrent loops contending for the same hot resource
      const cyclesPerAgent = 10;
      const tasks = agents.map(async (agent) => {
        for (let c = 0; c < cyclesPerAgent; c++) {
          try {
            const handle = await lockManager.acquireLocks([hotResource], agent, 60, {
              retryOnContention: true,
              maxRetries: 25,
              initialBackoffMs: 2,
              maxBackoffMs: 20,
              timeoutMs: 500,
            });

            activeHolders++;
            maxSimultaneousHolders = Math.max(maxSimultaneousHolders, activeHolders);

            expect(lockManager.getHolder(hotResource)).toBe(agent);
            await new Promise((r) => setTimeout(r, 2));

            activeHolders--;
            await handle.release();
            totalSuccess++;
          } catch {
            // Expected under extreme contention
          }
        }
      });

      await Promise.all(tasks);

      // Invariant: Mutual exclusion must NEVER exceed 1 across distinct competing agents
      expect(maxSimultaneousHolders).toBe(1);
      expect(activeHolders).toBe(0);
      expect(totalSuccess).toBeGreaterThan(10);
      expect(lockManager.isLocked(hotResource)).toBe(false);
    });

    test('1.3: Rapid TTL Lease Abandonment, Sweeping, and Re-Acquisition Under Churn', async () => {
      const totalChurnLocks = 80;
      const shortTtlMs = 35;

      // Agent Alpha acquires 80 locks with 35ms TTL and intentionally abandons them
      for (let i = 0; i < totalChurnLocks; i++) {
        await lockManager.acquireLocks([`churn_res_${i}`], 'alpha', shortTtlMs);
      }

      // Verify active count initially
      expect(lockManager.getActiveLocks().length).toBe(totalChurnLocks);

      // Wait for TTL expiry
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Invariant: sweepExpiredLeases reclaims all 80 expired leases
      const reclaimed = lockManager.sweepExpiredLeases();
      expect(reclaimed).toBe(totalChurnLocks);
      expect(lockManager.getActiveLocks().length).toBe(0);

      // Invariant: Agent Beta can now immediately acquire all 80 resources
      const batchIds = Array.from({ length: totalChurnLocks }, (_, i) => `churn_res_${i}`);
      const betaHandle = await lockManager.acquireLocks(batchIds, 'beta', 500);
      expect(betaHandle.agentId).toBe('beta');
      expect(lockManager.isHeldBy(batchIds, 'beta')).toBe(true);
      await betaHandle.release();
    });

    test('1.4: Multi-Resource Circular Wait Inversion Elimination (Alpha, Beta, Gamma, Delta)', async () => {
      // 4 agents requesting intersecting resources in opposing order
      // Alpha: [A, B]
      // Beta:  [B, C]
      // Gamma: [C, D]
      // Delta: [D, A]  <- Inverted
      const cycles = 25;
      const resourceMap: Partial<Record<AgentId, string[]>> = {
        alpha: ['res_A', 'res_B'],
        beta: ['res_B', 'res_C'],
        gamma: ['res_C', 'res_D'],
        delta: ['res_D', 'res_A'],
        director: ['res_A', 'res_C'],
        human: ['res_D', 'res_B'],
      };

      const agents: AgentId[] = ['alpha', 'beta', 'gamma', 'delta'];
      let completedRounds = 0;

      const agentRoutines = agents.map(async (agent) => {
        const req = resourceMap[agent]!;
        for (let c = 0; c < cycles; c++) {
          try {
            const handle = await lockManager.acquireLocks(req, agent, 100, {
              retryOnContention: true,
              maxRetries: 20,
              initialBackoffMs: 2,
              maxBackoffMs: 20,
              timeoutMs: 300,
            });

            expect(lockManager.isHeldBy(req, agent)).toBe(true);
            await new Promise((r) => setTimeout(r, 1));
            await handle.release();
            completedRounds++;
          } catch {
            // Contention timeouts are valid
          }
        }
      });

      await Promise.all(agentRoutines);
      expect(completedRounds).toBeGreaterThan(20);
      lockManager.sweepExpiredLeases();
      expect(lockManager.getActiveLocks().length).toBe(0);
    });
  });

  // =========================================================================
  // SECTION 2: Concurrent CAS State Collisions and Multi-Step Rollbacks
  // =========================================================================
  describe('2. OptimisticStateEngine CAS Collisions & Multi-Step Rollbacks', () => {
    let engine: OptimisticStateEngine;

    beforeEach(() => {
      engine = new OptimisticStateEngine();
    });

    test('2.1: 50 Concurrent CAS Update Collisions (Exact Linearizability & Failure Audit)', async () => {
      // Seed a shared database instance node
      const dbNode: CloudResourceNode = {
        id: 'shared_aurora_pg',
        type: 'aws_db_instance',
        name: 'Shared Aurora Postgres',
        position: { x: 100, y: 100 },
        config: { instance_class: 'db.r6g.xlarge', allocated_storage_gb: 100 },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      await engine.addNode(dbNode, 'alpha');

      const initialVersion = engine.getState().version;
      const expectedNodeVer = engine.getState().nodes['shared_aurora_pg']!.version;
      const competitorsCount = 50;
      const agents: AgentId[] = ['alpha', 'beta', 'gamma', 'delta'];

      // Launch 50 concurrent transactions with expectedVersions constraint
      const txResults = await Promise.all(
        Array.from({ length: competitorsCount }, (_, i) => {
          const agent = agents[i % agents.length]!;
          const tx: StateTransaction = {
            id: `tx_cas_race_${i}`,
            agentId: agent,
            description: `Agent ${agent} updating allocated storage to ${200 + i}`,
            timestamp: Date.now(),
            expectedVersions: { shared_aurora_pg: expectedNodeVer },
            patches: [
              {
                op: 'replace',
                path: '/nodes/shared_aurora_pg/config/allocated_storage_gb',
                value: 200 + i,
              },
            ],
          };
          return engine.applyTransaction(tx);
        })
      );

      const successfulTx = txResults.filter((r) => r.success);
      const failedTx = txResults.filter((r) => !r.success);

      // Invariant: Exactly 1 transaction succeeds
      expect(successfulTx.length).toBe(1);
      // Invariant: Exactly 49 transactions are rejected
      expect(failedTx.length).toBe(competitorsCount - 1);

      // Verify each failed transaction reported the exact collision key
      for (const fail of failedTx) {
        expect(fail.casFailedKey).toBe('shared_aurora_pg');
        expect(fail.conflictError).toContain('CAS node version mismatch');
      }

      // Root state version incremented by exactly 1
      expect(engine.getState().version).toBe(initialVersion + 1);
      expect(engine.getState().nodes['shared_aurora_pg']?.version).toBe(expectedNodeVer + 1);
    });

    test('2.2: 50-Step Deep Chained Mutation & Reverse Rollback Invariance: S === Rollback(Apply(S, Delta))', async () => {
      const initialSnapshot = JSON.parse(JSON.stringify(engine.getState()));
      const inverseStack: RFC6902Patch[][] = [];
      const totalSteps = 50;

      // 1. Add 20 nodes
      for (let i = 0; i < 20; i++) {
        const nodeId = `res_node_${i}`;
        const node: CloudResourceNode = {
          id: nodeId,
          type: i % 3 === 0 ? 'aws_vpc' : i % 3 === 1 ? 'aws_subnet' : 'aws_instance',
          name: `Resource Node ${i}`,
          position: { x: i * 20, y: i * 15 },
          config: {
            cidr_block: `10.${i}.0.0/16`,
            instance_type: 't3.medium',
            tags: { Environment: 'stress', Index: i },
            nested_settings: { auto_scale: true, max_size: i + 2 },
          },
          metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
          version: 1,
        };

        const res = await engine.addNode(node, 'alpha');
        expect(res.success).toBe(true);
        inverseStack.push([...res.inversePatches]);
      }

      // 2. Add 15 interconnecting edges
      for (let i = 0; i < 15; i++) {
        const edge: TopologyEdge = {
          id: `edge_res_${i}`,
          source: `res_node_${i}`,
          target: `res_node_${i + 1}`,
          type: 'routes_to',
          version: 1,
        };
        const res = await engine.addEdge(edge, 'beta');
        expect(res.success).toBe(true);
        inverseStack.push([...res.inversePatches]);
      }

      // 3. Update 15 node configs with deep JSON pointers
      for (let i = 0; i < 15; i++) {
        const nodeId = `res_node_${i}`;
        const tx: StateTransaction = {
          id: `tx_deep_mod_${i}`,
          agentId: 'gamma',
          description: `Deep mutate ${nodeId}`,
          timestamp: Date.now(),
          patches: [
            { op: 'replace', path: `/nodes/${nodeId}/config/tags/Environment`, value: 'production_hardened' },
            { op: 'replace', path: `/nodes/${nodeId}/config/nested_settings/max_size`, value: 999 },
          ],
        };
        const res = await engine.applyTransaction(tx);
        expect(res.success).toBe(true);
        inverseStack.push([...res.inversePatches]);
      }

      expect(Object.keys(engine.getState().nodes).length).toBe(20);
      expect(Object.keys(engine.getState().edges).length).toBe(15);
      expect(engine.getState().version).toBe(totalSteps);

      // 4. Rollback in reverse order
      while (inverseStack.length > 0) {
        const patches = inverseStack.pop()!;
        const rollbackRes = engine.rollback(patches);
        expect(rollbackRes.success).toBe(true);
      }

      // 5. Invariant: State restored to initial empty state
      const finalState = engine.getState();
      expect(Object.keys(finalState.nodes).length).toBe(0);
      expect(Object.keys(finalState.edges).length).toBe(0);
      expect(finalState.nodes).toEqual(initialSnapshot.nodes);
      expect(finalState.edges).toEqual(initialSnapshot.edges);
    });

    test('2.3: Transaction All-or-Nothing Atomicity on Mid-Batch CAS Failure', async () => {
      const testNode: CloudResourceNode = {
        id: 'atomic_test_node',
        type: 'aws_instance',
        name: 'Atomic Node',
        position: { x: 0, y: 0 },
        config: { instance_type: 't3.micro', monitoring: false },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      await engine.addNode(testNode, 'alpha');

      const versionBefore = engine.getState().version;

      // Transaction contains 2 valid replacement patches and 1 failing test patch
      const poisonedTx: StateTransaction = {
        id: 'tx_poisoned_batch',
        agentId: 'beta',
        description: 'Batch with failing CAS test',
        timestamp: Date.now(),
        patches: [
          { op: 'replace', path: '/nodes/atomic_test_node/config/instance_type', value: 'c6i.32xlarge' },
          { op: 'test', path: '/nodes/atomic_test_node/config/monitoring', value: true }, // FAILS! (actual is false)
          { op: 'replace', path: '/nodes/atomic_test_node/config/monitoring', value: true },
        ],
      };

      const result = await engine.applyTransaction(poisonedTx);
      expect(result.success).toBe(false);
      expect(result.casFailedKey).toBe('/nodes/atomic_test_node/config/monitoring');

      // Invariant: Zero partial mutations applied
      const currentNode = engine.getState().nodes['atomic_test_node']!;
      expect(currentNode.config.instance_type).toBe('t3.micro');
      expect(currentNode.config.monitoring).toBe(false);
      expect(engine.getState().version).toBe(versionBefore);
    });
  });

  // =========================================================================
  // SECTION 3: 4-Agent Parallel Thought Streams, Presence & Execution Log Tracing
  // =========================================================================
  describe('3. 4-Agent Parallel Thought Streams, Presence & Telemetry Tracing', () => {
    beforeEach(() => {
      useCloudSwarmStore.getState().resetTopology();
    });

    test('3.1: 4-Agent Concurrent Spatial Presence Kinematics & High-Frequency Stream (400 Ticks)', async () => {
      const store = useCloudSwarmStore.getState();
      const agents: AgentId[] = ['alpha', 'beta', 'gamma', 'delta'];

      // Generate 100 parallel presence updates per agent (400 total)
      const updatesPerAgent = 100;
      const tasks = agents.map(async (agentId) => {
        for (let i = 0; i < updatesPerAgent; i++) {
          store.updateAgentPresence(agentId, {
            currentX: 100 + i * 2,
            currentY: 150 + i * 2,
            targetX: 200 + i * 2,
            targetY: 250 + i * 2,
            thoughtText: `Agent ${agentId} step ${i}: Analyzing cloud infrastructure bounds`,
            thoughtTimestamp: Date.now(),
            isInspecting: i % 2 === 0,
            activeNodeId: `node_${agentId}_${i % 5}`,
          });
          // Micro-tick yield
          if (i % 25 === 0) {
            await new Promise((r) => setTimeout(r, 1));
          }
        }
      });

      await Promise.all(tasks);

      const finalPresence = useCloudSwarmStore.getState().agentPresences;

      // Verify all 4 agents have valid, updated presence states
      for (const agentId of agents) {
        const p = finalPresence[agentId];
        expect(p).toBeDefined();
        expect(p?.agentId).toBe(agentId);
        expect(p?.currentX).toBe(100 + (updatesPerAgent - 1) * 2);
        expect(p?.thoughtText).toContain(`Agent ${agentId} step ${updatesPerAgent - 1}`);
        expect(Date.now() - p?.thoughtTimestamp!).toBeLessThan(5000);
      }
    });

    test('3.2: High-Concurrency Execution Log Tracing Across Alpha, Beta, Gamma, Delta (200 Logs)', () => {
      const store = useCloudSwarmStore.getState();
      const agents: AgentId[] = ['alpha', 'beta', 'gamma', 'delta'];

      // Ingest 200 execution logs across 4 agents
      for (let i = 0; i < 200; i++) {
        const agentId = agents[i % agents.length]!;
        const actionType: SwarmActionType = i % 4 === 0 ? 'MCP_CALL' : i % 4 === 1 ? 'CAS_APPLY' : i % 4 === 2 ? 'LOCK' : 'FINOPS_EVAL';
        store.logAction(
          agentId,
          actionType,
          `High-frequency action ${i} executed by ${agentId}`,
          0.12 + (i % 10) * 0.05,
          `resource_target_${i % 10}`,
          { iteration: i }
        );
      }

      const logs = useCloudSwarmStore.getState().executionLogs;

      // Invariant: In-memory logs are capped at 100 (FIFO)
      expect(logs.length).toBe(100);

      // Verify distribution across all 4 agents
      const alphaLogs = logs.filter((l) => l.agentId === 'alpha');
      const betaLogs = logs.filter((l) => l.agentId === 'beta');
      const gammaLogs = logs.filter((l) => l.agentId === 'gamma');
      const deltaLogs = logs.filter((l) => l.agentId === 'delta');

      expect(alphaLogs.length).toBeGreaterThanOrEqual(20);
      expect(betaLogs.length).toBeGreaterThanOrEqual(20);
      expect(gammaLogs.length).toBeGreaterThanOrEqual(20);
      expect(deltaLogs.length).toBeGreaterThanOrEqual(20);

      // Verify log schema integrity
      const sampleLog = logs[0]!;
      expect(sampleLog.id).toBeDefined();
      expect(sampleLog.timestamp).toBeGreaterThan(0);
      expect(sampleLog.latencyMs).toBeGreaterThan(0);
      expect(sampleLog.latencyMs).toBeLessThan(1.0); // Sub-millisecond latency
      expect(sampleLog.message).toBeDefined();
    });

    test('3.3: 4-Agent Orchestrator Decomposition and Concurrent WebMCP Tool Execution', async () => {
      const stateEngine = new OptimisticStateEngine();
      const webmcp = new WebModelContextEngine();
      const lockManager = new StripedLockManager(64, 3000);
      const executionLogs: any[] = [];

      registerTopologyTools(webmcp, stateEngine);
      registerSecurityTools(webmcp, () => stateEngine.getState(), stateEngine);
      registerFinOpsTools(webmcp, () => stateEngine.getState());

      const orchestrator = new LiveSwarmOrchestrator(
        new GeminiClient([]),
        webmcp,
        () => ({
          topologyState: stateEngine.getState(),
          updateAgentPresence: () => {},
          addExecutionLog: (log) => executionLogs.push(log),
          selectNode: () => {},
          stepDelayMs: 0,
          acquireLock: async (ids, agent) => {
            await lockManager.acquireLocks(ids, agent);
            return true;
          },
          releaseLock: async (ids, agent) => {
            await lockManager.releaseLocks(ids, agent);
          },
          logAction: (agentId, actionType, message, latencyMs, targetResourceId, metadata) => {
            executionLogs.push({ agentId, actionType, message, latencyMs, targetResourceId, metadata });
          },
        }),
        () => {},
        new NvidiaNimClient('')
      );

      // Decompose a multi-cloud enterprise prompt
      const plan = await orchestrator.decomposePrompt(
        'Design an enterprise multi-cloud mesh with AWS EKS, Azure VM, GCP Cloud SQL, and FinOps cost optimization'
      );

      expect(plan).toBeDefined();
      expect(plan.tasks.length).toBeGreaterThanOrEqual(4);

      // Verify tasks assign distinct work to Alpha, Beta, Gamma, and Delta
      const assignedAgents = new Set(plan.tasks.map((t) => t.agentId));
      expect(assignedAgents.has('alpha')).toBe(true);
      expect(assignedAgents.has('beta')).toBe(true);
      expect(assignedAgents.has('gamma')).toBe(true);
      expect(assignedAgents.has('delta')).toBe(true);

      // Execute plan tasks concurrently with Promise.all
      const taskResults = await Promise.all(
        plan.tasks.map(async (task, idx) => {
          const lockKey = (task.params.id as string) || `task_res_${task.agentId}_${idx}`;
          const handle = await lockManager.acquireLocks(
            [lockKey],
            task.agentId,
            2000,
            { retryOnContention: true, maxRetries: 10, timeoutMs: 1000 }
          );
          try {
            const res = await webmcp.executeTool(task.tool, task.params, { agentId: task.agentId });
            return { task, res };
          } finally {
            await handle.release();
          }
        })
      );

      expect(taskResults.length).toBe(plan.tasks.length);
      for (const { res } of taskResults) {
        expect(res.isError).toBeFalsy();
      }

      // Verify topology was populated
      expect(Object.keys(stateEngine.getState().nodes).length).toBeGreaterThanOrEqual(2);
      expect(lockManager.getActiveLocks().length).toBe(0);
    });
  });

  // =========================================================================
  // SECTION 4: Extreme Multi-Agent CAS Retry Loops & Cascading Rollback Invariants
  // =========================================================================
  describe('4. Extreme Multi-Agent CAS Retry Loops & Graph Rollback Invariants', () => {
    test('4.1: 50 Agents in Optimistic CAS Retry Loop (Zero Lost Updates, Monotonic Versioning)', async () => {
      const stateEngine = new OptimisticStateEngine();
      const lockManager = new StripedLockManager(64, 2000);

      // Seed a shared counter node
      const counterNode: CloudResourceNode = {
        id: 'shared_cluster_registry',
        type: 'aws_ecs_cluster',
        name: 'Shared Cluster Registry',
        position: { x: 0, y: 0 },
        config: { revision: 0, agents_recorded: [] },
        metadata: { createdBy: 'director', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      await stateEngine.addNode(counterNode, 'director');

      const agents: AgentId[] = ['alpha', 'beta', 'gamma', 'delta'];
      const totalWorkers = 50;

      // 50 workers race to increment the cluster revision with full CAS retry loop
      const workerPromises = Array.from({ length: totalWorkers }, async (_, i) => {
        const agent = agents[i % agents.length]!;
        let applied = false;
        let attempts = 0;
        const maxAttempts = 100;

        while (!applied && attempts < maxAttempts) {
          attempts++;
          const currentState = stateEngine.getState();
          const node = currentState.nodes['shared_cluster_registry'];
          if (!node) throw new Error('Shared node vanished');

          const currentRev = (node.config['revision'] as number) || 0;
          const currentAgents = (node.config['agents_recorded'] as string[]) || [];

          const tx: StateTransaction = {
            id: `tx_worker_${i}_attempt_${attempts}`,
            agentId: agent,
            description: `Worker ${i} recording agent ${agent} at revision ${currentRev + 1}`,
            timestamp: Date.now(),
            expectedVersions: { shared_cluster_registry: node.version },
            patches: [
              {
                op: 'replace',
                path: '/nodes/shared_cluster_registry/config/revision',
                value: currentRev + 1,
              },
              {
                op: 'replace',
                path: '/nodes/shared_cluster_registry/config/agents_recorded',
                value: [...currentAgents, `${agent}_${i}`],
              },
            ],
          };

          const res = await stateEngine.applyTransaction(tx);
          if (res.success) {
            applied = true;
          } else {
            // Jittered backoff on CAS collision
            await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 5) + 1));
          }
        }

        expect(applied).toBe(true);
      });

      await Promise.all(workerPromises);

      // Invariant: Exactly 50 increments applied, revision is 50, exactly 50 records in array
      const finalNode = stateEngine.getState().nodes['shared_cluster_registry']!;
      expect(finalNode.config['revision']).toBe(50);
      expect((finalNode.config['agents_recorded'] as string[]).length).toBe(50);
      // Root state version incremented: 0 (init) + 1 (addNode) + 50 (updates) = 51
      expect(stateEngine.getState().version).toBe(51);
    });

    test('4.2: Cascading Deletion of 1 VPC, 4 Subnets, 16 EC2s, 32 Edges and Full Inverse Rollback', async () => {
      const stateEngine = new OptimisticStateEngine();

      // Step 1: Create VPC
      const vpc: CloudResourceNode = {
        id: 'vpc_mega',
        type: 'aws_vpc',
        name: 'Mega VPC',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.0.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      };
      await stateEngine.addNode(vpc, 'alpha');

      // Step 2: Create 4 subnets
      for (let s = 1; s <= 4; s++) {
        const sub: CloudResourceNode = {
          id: `subnet_${s}`,
          type: 'aws_subnet',
          name: `Subnet ${s}`,
          position: { x: s * 50, y: 50 },
          config: { cidr_block: `10.0.${s}.0/24` },
          metadata: { createdBy: 'beta', createdAt: 0, updatedAt: 0 },
          version: 1,
        };
        await stateEngine.addNode(sub, 'beta');
        await stateEngine.addEdge({ id: `e_vpc_sub_${s}`, source: 'vpc_mega', target: `subnet_${s}`, type: 'contains', version: 1 }, 'beta');
      }

      // Step 3: Create 16 EC2 instances connected to subnets and peer instances
      for (let inst = 1; inst <= 16; inst++) {
        const parentSub = `subnet_${((inst - 1) % 4) + 1}`;
        const ec2: CloudResourceNode = {
          id: `ec2_${inst}`,
          type: 'aws_instance',
          name: `EC2 Instance ${inst}`,
          position: { x: inst * 30, y: 100 },
          config: { instance_type: 't3.micro' },
          metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
          version: 1,
        };
        await stateEngine.addNode(ec2, 'alpha');
        await stateEngine.addEdge({ id: `e_sub_ec2_${inst}`, source: parentSub, target: `ec2_${inst}`, type: 'contains', version: 1 }, 'alpha');
        if (inst > 1) {
          await stateEngine.addEdge({ id: `e_peer_${inst - 1}_${inst}`, source: `ec2_${inst - 1}`, target: `ec2_${inst}`, type: 'routes_to', version: 1 }, 'alpha');
        }
      }

      const preDeletionSnapshot = JSON.parse(JSON.stringify(stateEngine.getState()));
      expect(Object.keys(stateEngine.getState().nodes).length).toBe(1 + 4 + 16); // 21 nodes
      expect(Object.keys(stateEngine.getState().edges).length).toBe(4 + 16 + 15); // 35 edges

      // Step 4: Cascade delete subnet_1 (should cascade delete its edges)
      const delSub1 = await stateEngine.removeNode('subnet_1', true, 'alpha');
      expect(delSub1.success).toBe(true);
      expect(stateEngine.getState().nodes['subnet_1']).toBeUndefined();
      expect(stateEngine.getState().edges['e_vpc_sub_1']).toBeUndefined();
      expect(stateEngine.getState().edges['e_sub_ec2_1']).toBeUndefined();

      // Step 5: Rollback subnet_1 deletion
      const rbRes = stateEngine.rollback(delSub1.inversePatches);
      expect(rbRes.success).toBe(true);

      // Invariant: Exact topology state restored
      const restoredState = stateEngine.getState();
      expect(restoredState.nodes).toEqual(preDeletionSnapshot.nodes);
      expect(restoredState.edges).toEqual(preDeletionSnapshot.edges);
      expect(Object.keys(restoredState.nodes).length).toBe(21);
      expect(Object.keys(restoredState.edges).length).toBe(35);
    });
  });
});
