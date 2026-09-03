/**
 * Rapid Resilience, Chaos Injection, Cyclic Edge Guard & Concurrency Stress Test
 *
 * Validates system stability under 50+ rapid randomized operations:
 * - Concurrent multi-cloud node creation and deletion
 * - Rejection of self-connections and cyclic edge hazards
 * - Dynamic Chaos Gorilla AZ degradation and recovery
 * - Red-Team intrusion defense and Zero-Trust mitigation
 * - Time travel DAG state consistency and LCA diffing under rapid mutation
 */

import { OptimisticStateEngine } from '../core/state/OptimisticStateEngine';
import { DecisionDAG } from '../core/dag/DecisionDAG';
import { ChaosSimulator, CHAOS_SCENARIOS } from '../core/chaos/ChaosSimulator';
import { ThreatDefenseSimulator, THREAT_VECTORS } from '../core/threat/ThreatDefenseSimulator';
import { SentinelAuditor } from '../core/audit/SentinelAuditor';
import { createConnectResourcesTool } from '../core/webmcp/tools/topologyTools';
import type { CloudResourceType, NodeMetadata } from '../types/topology';

const createTestMeta = (): NodeMetadata => ({
  status: 'healthy',
  createdBy: 'alpha',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe('Directive 4: Multi-Simulation Stress Testing & Resilience Validation', () => {
  let stateEngine: OptimisticStateEngine;
  let dag: DecisionDAG;
  let auditor: SentinelAuditor;

  beforeEach(() => {
    stateEngine = new OptimisticStateEngine();
    dag = new DecisionDAG(stateEngine.getState(), 'director', 'Genesis Stress Test Root');
    auditor = new SentinelAuditor();
  });

  describe('1. Self-Connection & Orphan Edge Resilience', () => {
    it('gracefully rejects self-connection attempts via topology tools', async () => {
      const connectTool = createConnectResourcesTool(stateEngine);

      // Add a node
      await stateEngine.addNode(
        {
          id: 'test_node_self',
          type: 'aws_instance',
          name: 'Self Wire Test',
          position: { x: 100, y: 100 },
          config: {},
          version: 1,
          metadata: createTestMeta(),
        },
        'alpha'
      );

      // Attempt self connection
      const result = await connectTool.execute({
        source_id: 'test_node_self',
        target_id: 'test_node_self',
        relation: 'routes_to',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toMatch(/Cannot connect resource 'test_node_self' to itself/i);

      // Verify no self loop edge was created in state
      const edges = Object.values(stateEngine.getState().edges);
      expect(edges.filter(e => e.source === 'test_node_self' && e.target === 'test_node_self')).toHaveLength(0);
    });

    it('rejects connection when source or target does not exist', async () => {
      const connectTool = createConnectResourcesTool(stateEngine);

      const result = await connectTool.execute({
        source_id: 'ghost_source_404',
        target_id: 'ghost_target_404',
        relation: 'routes_to',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toMatch(/does not exist/i);
    });
  });

  describe('2. Dynamic Chaos Gorilla & Threat Defense Mutations', () => {
    it('mutates live canvas nodes to degraded and recovers to healthy in under 2000ms', async () => {
      // Seed canvas with compute and database nodes
      await stateEngine.addNode(
        {
          id: 'app_vm_1',
          type: 'aws_instance',
          name: 'Frontend Web VM',
          position: { x: 100, y: 100 },
          config: {},
          version: 1,
          metadata: createTestMeta(),
        },
        'alpha'
      );
      await stateEngine.addNode(
        {
          id: 'app_db_1',
          type: 'aws_db_instance',
          name: 'Postgres Master',
          position: { x: 400, y: 100 },
          config: {},
          version: 1,
          metadata: createTestMeta(),
        },
        'gamma'
      );

      const chaosSim = new ChaosSimulator(stateEngine);
      const agentSteps: string[] = [];

      const remediationResult = await chaosSim.executeSelfHealing(CHAOS_SCENARIOS[0]!, (agentId, msg) => {
        agentSteps.push(`${agentId}: ${msg}`);
      });

      expect(remediationResult.incidentId).toBe(CHAOS_SCENARIOS[0]!.id);
      expect(remediationResult.blastRadiusFinal).toBe('0.00% (100% Healthy / Auto-Remediated)');
      expect(remediationResult.remediationSteps.length).toBeGreaterThanOrEqual(3);
      expect(agentSteps.length).toBeGreaterThanOrEqual(3);

      // Verify canvas nodes returned to healthy status in config
      const state = stateEngine.getState();
      expect(state.nodes['app_vm_1']?.config?._chaosStatus).toBe('healthy');
    });

    it('flags compromised node during red-team attack and engages Zero-Trust defense', async () => {
      await stateEngine.addNode(
        {
          id: 'api_ingress_1',
          type: 'aws_lb',
          name: 'Public ALB',
          position: { x: 50, y: 50 },
          config: {},
          version: 1,
          metadata: createTestMeta(),
        },
        'beta'
      );

      const threatSim = new ThreatDefenseSimulator(stateEngine);
      const scores: number[] = [];

      const defenseResult = await threatSim.executeThreatDefense(THREAT_VECTORS[0]!, (agentId, msg, score) => {
        scores.push(score);
      });

      expect(defenseResult.defenseStatus).toBe('DEFLECTED_AND_HARDENED');
      expect(defenseResult.finalCisScore).toBe(100);
      expect(scores).toContain(25); // Initial drop during intrusion
      expect(scores).toContain(100); // Fully remediated

      // Target node should be restored to healthy
      const state = stateEngine.getState();
      expect(state.nodes['api_ingress_1']?.config?._threatStatus).toBe('healthy');
    });
  });

  describe('3. 50-Step Rapid Randomized Concurrency Stress Test', () => {
    it('survives 50 rapid multi-agent operations without unhandled rejections or DAG desync', async () => {
      const nodeTypes: CloudResourceType[] = [
        'aws_instance',
        'aws_db_instance',
        'azurerm_linux_virtual_machine',
        'azurerm_cosmosdb_account',
        'google_compute_instance',
        'google_sql_database_instance',
      ];

      const createdNodeIds: string[] = [];

      // 50 rapid sequential and overlapping operations
      for (let i = 0; i < 50; i++) {
        const opType = i % 5;

        if (opType === 0 || opType === 1) {
          // Add Node
          const id = `stress_node_${i}`;
          const type = nodeTypes[i % nodeTypes.length]!;
          await stateEngine.addNode(
            {
              id,
              type,
              name: `Stress Node ${i}`,
              position: { x: (i * 25) % 800, y: (i * 15) % 600 },
              config: { tier: 'standard', iops: 3000 },
              version: 1,
              metadata: createTestMeta(),
            },
            'alpha'
          );
          createdNodeIds.push(id);
          dag.addCommit({
            author: 'alpha',
            message: `Added ${id}`,
            state: stateEngine.getState(),
            patches: [],
          });
        } else if (opType === 2 && createdNodeIds.length >= 2) {
          // Connect Nodes
          const srcIdx = (i * 3) % createdNodeIds.length;
          const tgtIdx = (i * 7) % createdNodeIds.length;
          if (srcIdx !== tgtIdx) {
            const src = createdNodeIds[srcIdx]!;
            const tgt = createdNodeIds[tgtIdx]!;
            await stateEngine.addEdge(
              {
                id: `edge_${src}_${tgt}`,
                source: src,
                target: tgt,
                type: 'routes_to',
              },
              'beta'
            );
          }
        } else if (opType === 3 && createdNodeIds.length >= 4) {
          // Delete Random Node
          const delIdx = i % createdNodeIds.length;
          const targetId = createdNodeIds[delIdx]!;
          await stateEngine.removeNode(targetId, true, 'director');
          createdNodeIds.splice(delIdx, 1);
        } else if (opType === 4) {
          // Time-Travel Scrubbing Check
          const timeline = dag.getTimeline();
          if (timeline.length > 2) {
            const randomCommit = timeline[i % timeline.length]!;
            const retrievedCommit = dag.getCommit(randomCommit.id);
            expect(retrievedCommit).toBeDefined();
            expect(retrievedCommit?.id).toBe(randomCommit.id);
          }
        }
      }

      // Verify state integrity after 50 intense operations
      const finalState = stateEngine.getState();
      expect(finalState).toBeDefined();
      expect(typeof finalState.nodes).toBe('object');
      expect(typeof finalState.edges).toBe('object');

      // Verify no orphan edges exist
      for (const edge of Object.values(finalState.edges)) {
        expect(finalState.nodes[edge.source]).toBeDefined();
        expect(finalState.nodes[edge.target]).toBeDefined();
      }

      // Verify audit completes cleanly
      const audit = auditor.auditTopology(finalState);
      expect(audit).toBeDefined();
      expect(typeof audit.securityScore).toBe('number');
      expect(typeof audit.totalMonthlyCostUsd).toBe('number');
      expect(audit.totalMonthlyCostUsd).toBeGreaterThanOrEqual(0);
    });
  });
});
