/**
 * Unit Tests for DeterministicSwarmSim — Zero-Key Swarm Execution Engine
 */

import { DeterministicSwarmSim, type SimStep } from '../core/simulation/DeterministicSwarmSim';
import { PRESET_SCENARIOS, ECOMMERCE_SCENARIO, FINTECH_SCENARIO, MICROSERVICES_SCENARIO } from '../core/simulation/scenarios';
import type { AgentId } from '../types/swarm';

describe('DeterministicSwarmSim — Zero-Key Deterministic Swarm Simulator', () => {
  let sim: DeterministicSwarmSim;

  beforeEach(() => {
    sim = new DeterministicSwarmSim();
  });

  describe('Scenario Registry & Catalog', () => {
    test('contains all 3 core preset scenarios with valid steps', () => {
      const scenarios = sim.listScenarios();
      expect(scenarios.length).toBeGreaterThanOrEqual(3);

      const ids = scenarios.map((s) => s.id);
      expect(ids).toContain('ecommerce_ha');
      expect(ids).toContain('fintech_zerotrust');
      expect(ids).toContain('microservices_mesh');

      expect(sim.getScenario('ecommerce_ha')).toBeDefined();
      expect(sim.getScenario('fintech_zerotrust')).toBeDefined();
      expect(sim.getScenario('microservices_mesh')).toBeDefined();
    });

    test('supports custom scenario registration', () => {
      sim.registerScenario({
        id: 'custom_mesh',
        name: 'Custom Mesh',
        category: 'general',
        description: 'Test Custom',
        targetArchitecture: 'Test Arch',
        initialPrompt: 'Run test',
        steps: [
          {
            stepIndex: 1,
            agentId: 'alpha',
            role: 'Architect',
            action: 'TEST_ACTION',
            thought: 'Testing thought',
            patchSummary: 'Test patch',
            patches: [],
          },
        ],
      });

      expect(sim.getScenario('custom_mesh')).toBeDefined();
    });

    test('throws when running unknown scenario ID', async () => {
      await expect(sim.runScenario('non_existent_scenario_123')).rejects.toThrow(
        "Scenario 'non_existent_scenario_123' not found"
      );
    });
  });

  describe('Swarm Execution Timing & Performance (<100ms)', () => {
    test('executes E-Commerce scenario in <100ms without network calls', async () => {
      const report = await sim.runScenario('ecommerce_ha');

      expect(report.success).toBe(true);
      expect(report.durationMs).toBeLessThan(100);
      expect(report.stepsCount).toBe(6);
      expect(report.scenarioName).toBe(ECOMMERCE_SCENARIO.name);

      // Verify topology contains spawned resources
      expect(report.finalState.nodes['vpc_ecom']).toBeDefined();
      expect(report.finalState.nodes['ec2_ecom_web']).toBeDefined();
      expect(report.finalState.nodes['rds_ecom_db']).toBeDefined();
      expect(report.finalState.nodes['s3_ecom_assets']).toBeDefined();
    });

    test('executes FinTech Zero-Trust scenario in <100ms', async () => {
      const report = await sim.runScenario('fintech_zerotrust');

      expect(report.success).toBe(true);
      expect(report.durationMs).toBeLessThan(100);
      expect(report.stepsCount).toBe(4);
      expect(report.finalState.nodes['eks_banking_core']).toBeDefined();
    });

    test('executes Microservices scenario in <100ms', async () => {
      const report = await sim.runScenario('microservices_mesh');

      expect(report.success).toBe(true);
      expect(report.durationMs).toBeLessThan(100);
      expect(report.stepsCount).toBe(3);
      expect(report.finalState.nodes['ecs_mesh_cluster']).toBeDefined();
    });
  });

  describe('3-Agent Workflow Progression & Role Handoff', () => {
    test('orchestrates sequential handoff: Alpha (Topology) -> Beta (SecOps) -> Gamma (FinOps)', async () => {
      const agentProgression: AgentId[] = [];
      const actions: string[] = [];

      await sim.runScenario('ecommerce_ha', (step) => {
        agentProgression.push(step.agentId);
        actions.push(step.action);
      });

      expect(agentProgression).toEqual(['alpha', 'alpha', 'beta', 'beta', 'gamma', 'gamma']);
      expect(actions).toEqual([
        'SPAWN_VPC_HA_NETWORK',
        'DEPLOY_COMPUTE_AND_DATA_LAYER',
        'SCAN_OWASP_AND_CIS_BENCHMARKS',
        'AUTO_REMEDIATE_SECURITY_VULNERABILITIES',
        'EVALUATE_FINOPS_RATE_CARDS',
        'APPLY_FINOPS_RIGHTSIZING_OPTIMIZATION',
      ]);
    });

    test('validates state hardening by Agent Beta and rightsizing by Agent Gamma', async () => {
      const report = await sim.runScenario('ecommerce_ha');

      const ec2Node = report.finalState.nodes['ec2_ecom_web'];
      expect(ec2Node).toBeDefined();
      // Hardened by Beta
      expect(ec2Node?.config.http_tokens).toBe('required');
      // Rightsized to Graviton3 and gp3 by Gamma
      expect(ec2Node?.config.instance_type).toBe('c7g.large');
      expect(ec2Node?.config.root_volume_type).toBe('gp3');

      const s3Node = report.finalState.nodes['s3_ecom_assets'];
      expect(s3Node?.config.encryption).toEqual({ sse_algorithm: 'AES256' });

      const rdsNode = report.finalState.nodes['rds_ecom_db'];
      expect(rdsNode?.config.storage_encrypted).toBe(true);
      expect(rdsNode?.config.storage_type).toBe('gp3');
    });
  });

  describe('Monotonicity & Progressive Metrics', () => {
    test('step timestamps and indices are strictly monotonic', async () => {
      const timestamps: number[] = [];
      const indices: number[] = [];

      await sim.runScenario('ecommerce_ha', (step) => {
        timestamps.push(step.timestampMs);
        indices.push(step.stepIndex);
      });

      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]!).toBeGreaterThan(timestamps[i - 1]!);
        expect(indices[i]!).toBe(indices[i - 1]! + 1);
      }
    });

    test('tracks cumulative cost delta and security scores progressively', async () => {
      const steps: SimStep[] = [];
      const report = await sim.runScenario('ecommerce_ha', (s) => {
        steps.push(s);
      });

      expect(steps.length).toBe(6);

      // Step 2 adds cost
      expect(steps[1]?.cumulativeCostDeltaUsd).toBeGreaterThan(0);
      // Step 4 improves security score
      expect(steps[3]?.cumulativeSecurityScore).toBeGreaterThan(steps[1]!.cumulativeSecurityScore);
      // Step 6 optimizes cost
      expect(steps[5]?.cumulativeCostDeltaUsd).toBeLessThan(steps[1]!.cumulativeCostDeltaUsd);

      expect(report.totalMonthlyCostDeltaUsd).toBeCloseTo(428.25, 1);
    });

    test('aggregates agent performance metrics accurately', async () => {
      const report = await sim.runScenario('ecommerce_ha');

      expect(report.agentStats.alpha.actionsCount).toBe(2);
      expect(report.agentStats.beta.actionsCount).toBe(2);
      expect(report.agentStats.gamma.actionsCount).toBe(2);

      expect(report.agentStats.alpha.patchesApplied).toBeGreaterThan(0);
      expect(report.agentStats.beta.patchesApplied).toBeGreaterThan(0);
      expect(report.agentStats.gamma.patchesApplied).toBeGreaterThan(0);
    });
  });

  describe('Synchronous Execution Runner (runScenarioSync)', () => {
    test('executes scenario synchronously in memory', () => {
      const report = sim.runScenarioSync('ecommerce_ha');

      expect(report.success).toBe(true);
      expect(report.stepsCount).toBe(6);
      expect(report.finalState.nodes['vpc_ecom']).toBeDefined();
    });
  });
});
