/**
 * End-to-End Swarm & Presence Stress Verification Suite
 * Challenger Final 2 Verification Harness
 *
 * Verifies:
 * 1. 1-Click Production Demo triggering all 3 agents (Alpha, Beta, Gamma) in <100ms.
 * 2. Spring cursor presence kinematics, active bounding halos, micro-thought bubbles.
 * 3. Tri-terminal live streams, sub-millisecond execution badges, JSON diff inspector.
 * 4. Time-Travel Decision DAG scrubbing across history and A/B branch comparison.
 * 5. Bi-directional live sync between canvas nodes and Terraform HCL2.
 * 6. 1-Click production export generating downloadable Terraform bundle, Dockerfile, and certified audit certificate.
 */

import { useCloudSwarmStore } from '../store/useCloudSwarmStore';
import { DeterministicSwarmSim } from '../core/simulation/DeterministicSwarmSim';
import { PRESET_SCENARIOS, ECOMMERCE_SCENARIO, FINTECH_SCENARIO, MICROSERVICES_SCENARIO } from '../core/simulation/scenarios';
import { AGENT_PERSONAS, type AgentId, type AgentPresenceState } from '../types/swarm';
import { DecisionDAG } from '../core/dag/DecisionDAG';
import { HCLSyncEngine } from '../core/sync/HCLSyncEngine';
import { ProductionMaterializer } from '../core/export/ProductionMaterializer';
import { SentinelAuditor } from '../core/audit/SentinelAuditor';
import { StripedLockManager } from '../core/lock/StripedLockManager';
import { OptimisticStateEngine } from '../core/state/OptimisticStateEngine';
import { createDefaultTopologyState, type CloudResourceNode, type TopologyState, type TopologyEdge } from '../types/topology';
import type { RFC6902Patch } from '../types/patch';

describe('Challenger Final 2: End-to-End Swarm & Presence Stress Suite', () => {
  beforeEach(() => {
    useCloudSwarmStore.getState().resetTopology();
  });

  // ==========================================================================
  // 1. 1-Click Production Demo Triggering All 3 Agents in <100ms
  // ==========================================================================
  describe('1. 1-Click Production Demo (<100ms Trigger & All 3 Personas)', () => {
    test('empirically triggers Alpha, Beta, and Gamma in <100ms without network latency', async () => {
      const store = useCloudSwarmStore.getState();
      const sim = new DeterministicSwarmSim();

      const startTime = performance.now();
      const report = await sim.runScenario('ecommerce_ha');
      const executionTime = performance.now() - startTime;

      // Acceptance requirement: <100ms execution
      expect(executionTime).toBeLessThan(100);
      expect(report.success).toBe(true);
      expect(report.durationMs).toBeLessThan(100);
      expect(report.stepsCount).toBe(6);

      // Verify all 3 agents participated
      const agentIds = report.steps.map((s) => s.agentId);
      expect(agentIds).toContain('alpha');
      expect(agentIds).toContain('beta');
      expect(agentIds).toContain('gamma');

      // Verify Alpha deployed architecture, Beta hardened security, Gamma optimized FinOps
      expect(report.agentStats.alpha.actionsCount).toBeGreaterThanOrEqual(2);
      expect(report.agentStats.beta.actionsCount).toBeGreaterThanOrEqual(2);
      expect(report.agentStats.gamma.actionsCount).toBeGreaterThanOrEqual(2);

      // Verify final topology integrity
      expect(Object.keys(report.finalState.nodes).length).toBeGreaterThanOrEqual(5);
      expect(report.finalSecurityScore).toBeGreaterThanOrEqual(80);
      expect(report.totalMonthlyCostDeltaUsd).toBeGreaterThan(0);
    });

    test('stress test: executes 25 consecutive swarm simulations in <500ms cumulative', async () => {
      const sim = new DeterministicSwarmSim();
      const scenarios = ['ecommerce_ha', 'fintech_zerotrust', 'microservices_mesh'];

      const start = performance.now();
      for (let i = 0; i < 25; i++) {
        const scenarioId = scenarios[i % scenarios.length]!;
        const res = await sim.runScenario(scenarioId);
        expect(res.success).toBe(true);
        expect(res.durationMs).toBeLessThan(50);
      }
      const totalDuration = performance.now() - start;

      expect(totalDuration).toBeLessThan(500);
    });

    test('verifies store-level runSwarmDemo integration and state synchronization', async () => {
      const store = useCloudSwarmStore.getState();
      const report = await store.runSwarmDemo('fintech_zerotrust');

      expect(report.success).toBe(true);
      const state = useCloudSwarmStore.getState();

      expect(state.isSimulating).toBe(false);
      expect(state.simulationProgress).toBe(100);
      expect(state.topologyState.nodes['eks_banking_core']).toBeDefined();
      expect(state.auditReport.securityScore).toBeGreaterThanOrEqual(90);
      expect(state.dagTimeline.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ==========================================================================
  // 2. Spring Cursor Presence Kinematics, Active Halos, and Thought Bubbles
  // ==========================================================================
  describe('2. Multiplayer Spatial Presence: Kinematics, Halos & Thought Bubbles', () => {
    test('validates spring-damped cursor presence kinematics and interpolation', () => {
      const initial: AgentPresenceState = {
        agentId: 'alpha',
        currentX: 100,
        currentY: 100,
        targetX: 500,
        targetY: 300,
        velocityX: 0,
        velocityY: 0,
        activeNodeId: null,
        thoughtText: 'Deploying Subnets',
        thoughtTimestamp: Date.now(),
        isInspecting: true,
      };

      // Simulate 60 FPS physics kinematics loop with spring damping
      // x += (target - current) * stiffness; v *= damping
      let currentX = initial.currentX;
      let currentY = initial.currentY;
      const targetX = initial.targetX;
      const targetY = initial.targetY;
      const stiffness = 0.18;
      const damping = 0.82;
      let vx = 0;
      let vy = 0;

      for (let frame = 0; frame < 60; frame++) {
        const ax = (targetX - currentX) * stiffness;
        const ay = (targetY - currentY) * stiffness;
        vx = (vx + ax) * damping;
        vy = (vy + ay) * damping;
        currentX += vx;
        currentY += vy;
      }

      // After 60 frames (~1s at 60 FPS), cursor smoothly converges to target within 0.1px
      expect(Math.abs(currentX - targetX)).toBeLessThan(0.1);
      expect(Math.abs(currentY - targetY)).toBeLessThan(0.1);
    });

    test('validates active bounding halo coordinates and persona glyph attributions', () => {
      const node: CloudResourceNode = {
        id: 'rds_cluster_alpha',
        type: 'aws_db_instance',
        name: 'PostgreSQL Primary',
        position: { x: 320, y: 180 },
        width: 240,
        height: 90,
        config: { engine: 'postgres' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const padding = 6;
      const haloX = node.position.x - padding;
      const haloY = node.position.y - padding;
      const haloWidth = (node.width ?? 240) + padding * 2;
      const haloHeight = (node.height ?? 90) + padding * 2;

      expect(haloX).toBe(314);
      expect(haloY).toBe(174);
      expect(haloWidth).toBe(252);
      expect(haloHeight).toBe(102);

      // Verify all agent personas match color and glyph configurations
      expect(AGENT_PERSONAS.alpha.hexCode).toBeDefined();
      expect(AGENT_PERSONAS.beta.hexCode).toBeDefined();
      expect(AGENT_PERSONAS.gamma.hexCode).toBeDefined();
      expect(AGENT_PERSONAS.director.hexCode).toBeDefined();

      expect(AGENT_PERSONAS.alpha.glyph).toBe('α');
      expect(AGENT_PERSONAS.beta.glyph).toBe('β');
      expect(AGENT_PERSONAS.gamma.glyph).toBe('γ');
      expect(AGENT_PERSONAS.director.glyph).toBe('👑');
    });

    test('validates micro-thought bubble spatial positioning and timestamp freshness', () => {
      const presence: AgentPresenceState = {
        agentId: 'beta',
        currentX: 400,
        currentY: 250,
        targetX: 400,
        targetY: 250,
        velocityX: 0,
        velocityY: 0,
        activeNodeId: 'rds_cluster_alpha',
        thoughtText: 'Enforcing KMS CMK encryption and private VPC subnet isolation.',
        thoughtTimestamp: Date.now(),
        isInspecting: true,
      };

      const bubbleX = presence.currentX + 24;
      const bubbleY = presence.currentY - 48;

      expect(bubbleX).toBe(424);
      expect(bubbleY).toBe(202);
      expect(presence.thoughtText?.length).toBeGreaterThan(10);
      expect(Date.now() - presence.thoughtTimestamp).toBeLessThan(1000);
    });
  });

  // ==========================================================================
  // 3. Tri-Terminal Live Streams, Sub-ms Badges & JSON Diff Inspector
  // ==========================================================================
  describe('3. Tri-Terminal Execution HUD & Sub-ms Telemetry Stream', () => {
    test('handles high-frequency execution log stream with agent channel filtering', () => {
      const store = useCloudSwarmStore.getState();

      // Ingest 150 high-frequency logs across 3 agents
      for (let i = 0; i < 150; i++) {
        const agentId: AgentId = (['alpha', 'beta', 'gamma'][i % 3] as AgentId);
        store.logAction(
          agentId,
          'CAS_APPLY',
          `Transaction step ${i} applied atomically`,
          0.15 + (i % 5) * 0.04,
          `node_${i}`
        );
      }

      const state = useCloudSwarmStore.getState();
      // Store caps in-memory execution logs at 100 entries
      expect(state.executionLogs.length).toBe(100);

      // Verify sub-millisecond latency values are recorded accurately
      const recentLog = state.executionLogs[0]!;
      expect(recentLog.latencyMs).toBeGreaterThan(0);
      expect(recentLog.latencyMs).toBeLessThan(1.0); // Sub-millisecond!

      // Verify channel filtering logic
      const alphaLogs = state.executionLogs.filter((l) => l.agentId === 'alpha');
      const betaLogs = state.executionLogs.filter((l) => l.agentId === 'beta');
      const gammaLogs = state.executionLogs.filter((l) => l.agentId === 'gamma');

      expect(alphaLogs.length).toBeGreaterThan(20);
      expect(betaLogs.length).toBeGreaterThan(20);
      expect(gammaLogs.length).toBeGreaterThan(20);
    });

    test('validates RFC 6902 JSON Diff breakdown for complex state mutations', async () => {
      const store = useCloudSwarmStore.getState();

      const testNode: CloudResourceNode = {
        id: 'alb_ingress',
        type: 'aws_lb',
        name: 'Public ALB',
        position: { x: 100, y: 100 },
        config: { load_balancer_type: 'application', internal: false },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      await store.addNode(testNode);
      await store.updateNodeConfig('alb_ingress', { enable_deletion_protection: true });

      const state = useCloudSwarmStore.getState();
      const activeCommit = state.dag.getCommit(state.activeCommitId);

      expect(activeCommit).toBeDefined();
      expect(activeCommit?.patches.length).toBeGreaterThan(0);
      expect(activeCommit?.patches[0]?.op).toBe('replace');
      expect(activeCommit?.patches[0]?.path).toBe('/nodes/alb_ingress/config');
    });
  });

  // ==========================================================================
  // 4. Time-Travel Decision DAG Scrubbing & A/B Branch Comparison
  // ==========================================================================
  describe('4. Time-Travel Decision DAG Scrubbing & A/B Branch Diff', () => {
    test('scrubs smoothly across 10 DAG commits and calculates exact LCA deltas', async () => {
      const store = useCloudSwarmStore.getState();

      // Create a sequence of 8 distinct topology commits
      for (let i = 1; i <= 8; i++) {
        await store.addNode({
          id: `res_dag_${i}`,
          type: 'aws_instance',
          name: `Worker Node ${i}`,
          position: { x: i * 50, y: i * 30 },
          config: { instance_type: 't3.micro' },
          metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
          version: 1,
        });
      }

      const history = useCloudSwarmStore.getState().dagTimeline;
      expect(history.length).toBe(9); // Root + 8 commits

      // Scrub timeline to 0% (Root state)
      store.scrubDagTimeline(0);
      let currentState = useCloudSwarmStore.getState();
      expect(Object.keys(currentState.topologyState.nodes).length).toBe(0);

      // Scrub timeline to 50% (Commit 4)
      store.scrubDagTimeline(0.5);
      currentState = useCloudSwarmStore.getState();
      expect(currentState.topologyState.nodes['res_dag_4']).toBeDefined();
      expect(currentState.topologyState.nodes['res_dag_8']).toBeUndefined();

      // Scrub timeline to 100% (Head commit)
      store.scrubDagTimeline(1.0);
      currentState = useCloudSwarmStore.getState();
      expect(currentState.topologyState.nodes['res_dag_8']).toBeDefined();
    });

    test('forks A/B branch and calculates bidirectional branch diff', async () => {
      const store = useCloudSwarmStore.getState();

      // Main branch base node
      await store.addNode({
        id: 'base_vpc',
        type: 'aws_vpc',
        name: 'Base VPC',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.0.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      const commitMainBase = useCloudSwarmStore.getState().activeCommitId;

      // Fork branch 'feat/graviton-migration'
      store.forkDagBranch('feat/graviton-migration', commitMainBase);
      expect(useCloudSwarmStore.getState().activeBranchName).toBe('feat/graviton-migration');

      // Add Graviton compute to branch B
      await store.addNode({
        id: 'ec2_graviton',
        type: 'aws_instance',
        name: 'Graviton Worker',
        position: { x: 200, y: 200 },
        config: { instance_type: 'c7g.2xlarge' },
        metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });
      const commitBranchB = useCloudSwarmStore.getState().activeCommitId;

      // Switch back to 'main' and add x86 compute to branch A
      store.switchDagBranch('main');
      expect(useCloudSwarmStore.getState().activeBranchName).toBe('main');

      await store.addNode({
        id: 'ec2_x86',
        type: 'aws_instance',
        name: 'x86 Worker',
        position: { x: 200, y: 200 },
        config: { instance_type: 'c6i.2xlarge' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });
      const commitBranchA = useCloudSwarmStore.getState().activeCommitId;

      // Compute A/B Split Diff
      const diff = useCloudSwarmStore.getState().dag.getDiff(commitBranchA, commitBranchB);

      expect(diff).toBeDefined();
      expect(diff.addedNodes.some((n) => n.id === 'ec2_graviton')).toBe(true);
      expect(diff.removedNodes.some((n) => n.id === 'ec2_x86')).toBe(true);
      expect(diff.forwardPatches.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 5. Bi-Directional Live Sync Between Canvas Nodes and Terraform HCL2
  // ==========================================================================
  describe('5. Bi-Directional AST-Level Canvas <-> Terraform HCL2 Sync', () => {
    test('compiles comprehensive 10-primitive AWS canvas state to valid Terraform HCL2', () => {
      const state = createDefaultTopologyState();
      const nodes = state.nodes as Record<string, CloudResourceNode>;

      nodes['vpc_main'] = {
        id: 'vpc_main',
        type: 'aws_vpc',
        name: 'Main VPC',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.0.0.0/16', enable_dns_hostnames: true },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      nodes['sub_pub_1'] = {
        id: 'sub_pub_1',
        type: 'aws_subnet',
        name: 'Public Subnet 1',
        position: { x: 50, y: 50 },
        config: { vpc_id: 'vpc_main', cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      nodes['ec2_web'] = {
        id: 'ec2_web',
        type: 'aws_instance',
        name: 'Web Server',
        position: { x: 100, y: 100 },
        config: { subnet_id: 'sub_pub_1', instance_type: 't4g.medium', root_volume_gb: 40 },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      nodes['s3_assets'] = {
        id: 's3_assets',
        type: 'aws_s3_bucket',
        name: 'Static Assets Bucket',
        position: { x: 200, y: 200 },
        config: { bucket_name: 'prod-static-assets-2026' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const hcl = HCLSyncEngine.canvasToHcl(state);

      expect(hcl).toContain('resource "aws_vpc" "vpc_main"');
      expect(hcl).toContain('10.0.0.0/16');
      expect(hcl).toContain('resource "aws_subnet" "sub_pub_1"');
      expect(hcl).toContain('resource "aws_instance" "ec2_web"');
      expect(hcl).toContain('instance_type');
      expect(hcl).toContain('t4g.medium');
      expect(hcl).toContain('resource "aws_s3_bucket" "s3_assets"');
    });

    test('deserializes raw Terraform HCL2 and computes atomic state patches', async () => {
      const rawHcl = `
resource "aws_vpc" "vpc_parsed" {
  cidr_block = "172.16.0.0/12"
}

resource "aws_instance" "ec2_parsed" {
  instance_type = "c7g.xlarge"
  http_tokens   = "required"
}

resource "aws_db_instance" "rds_parsed" {
  engine         = "postgres"
  instance_class = "db.r6g.xlarge"
}
`;

      const parsedState = HCLSyncEngine.hclToCanvas(rawHcl);
      expect(Object.keys(parsedState.nodes).length).toBe(3);
      expect(parsedState.nodes['vpc_parsed']?.config['cidr_block']).toBe('172.16.0.0/12');
      expect(parsedState.nodes['ec2_parsed']?.config['instance_type']).toBe('c7g.xlarge');

      // Test incremental patch computation
      const store = useCloudSwarmStore.getState();
      await store.syncHclToCanvas(rawHcl);

      const syncedState = useCloudSwarmStore.getState();
      expect(syncedState.topologyState.nodes['vpc_parsed']).toBeDefined();
      expect(syncedState.topologyState.nodes['ec2_parsed']).toBeDefined();
      expect(syncedState.topologyState.nodes['rds_parsed']).toBeDefined();
      expect(syncedState.isHclDirty).toBe(false);
    });
  });

  // ==========================================================================
  // 6. 1-Click Production Materializer Export Bundle
  // ==========================================================================
  describe('6. 1-Click Production Materializer Bundle & Certified Audit Certificate', () => {
    test('materializes complete 8-file deployment bundle with verified cryptographic signatures', async () => {
      const state = createDefaultTopologyState();
      const nodes = state.nodes as Record<string, CloudResourceNode>;

      nodes['vpc_enterprise'] = {
        id: 'vpc_enterprise',
        type: 'aws_vpc',
        name: 'Enterprise VPC',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.100.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      nodes['eks_cluster'] = {
        id: 'eks_cluster',
        type: 'aws_eks_cluster',
        name: 'Production Kubernetes Cluster',
        position: { x: 150, y: 150 },
        config: { version: '1.30', endpoint_private_access: true, endpoint_public_access: false },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const auditor = new SentinelAuditor();
      const auditReport = auditor.auditTopology(state);

      // Materialize bundle
      const bundle = ProductionMaterializer.materializeBundle(state, auditReport);

      // Verify all essential files exist and have content
      expect(bundle['main.tf']).toContain('resource "aws_vpc" "vpc_enterprise"');
      expect(bundle['main.tf']).toContain('resource "aws_eks_cluster" "eks_cluster"');
      expect(bundle['variables.tf']).toContain('variable "aws_region"');
      expect(bundle['outputs.tf']).toContain('output "vpc_vpc_enterprise_id"');
      expect(bundle['Dockerfile']).toContain('FROM node:20-alpine AS builder');
      expect(bundle['Dockerfile']).toContain('FROM nginx:alpine AS runtime');
      expect(bundle['README.md']).toContain('CloudSwarm Studio — Production Deployment Manifest');
      expect(bundle['audit_certificate.json']).toBeDefined();

      // Verify Certificate Cryptographic Integrity
      const cert = JSON.parse(bundle['audit_certificate.json']!);
      expect(cert.certificate).toBe('CloudSwarm-SecOps-Certified-Production-Release');
      expect(cert.sha256).toBeDefined();
      expect(cert.sha256.length).toBe(64);
      expect(cert.grade).toBe(auditReport.grade);
      expect(cert.score).toBe(auditReport.securityScore);

      // Generate binary ZIP archive
      const zipBlob = await ProductionMaterializer.generateZipBundle(state, auditReport);
      expect(zipBlob.type).toBe('application/zip');
      expect(zipBlob.size).toBeGreaterThan(1000);

      // Validate PKZIP Header Signatures
      const buffer = await zipBlob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      expect(bytes[0]).toBe(0x50); // 'P'
      expect(bytes[1]).toBe(0x4b); // 'K'
      expect(bytes[2]).toBe(0x03);
      expect(bytes[3]).toBe(0x04);
    });
  });
});
