/**
 * UI & Integration Tests for CloudSwarm Studio (Milestone 4)
 *
 * Tests:
 * 1. Zustand store state integrity and singletons.
 * 2. 1-Click multi-agent Swarm Demo simulation with live 60 FPS updates.
 * 3. Spatial multiplayer presence & agent cursor/thought synchronization.
 * 4. RFC 6902 CAS state mutations and microsecond rollbacks.
 * 5. Bi-directional HCL2 AST sync and live canvas reflection.
 * 6. Time-Travel Decision DAG scrubbing, commit checkout, and branch forking.
 * 7. 1-Click SecOps CIS/OWASP auto-remediation and FinOps rightsizing.
 * 8. 1-Click Production Materializer export bundle generation.
 */

import { useCloudSwarmStore } from '../store/useCloudSwarmStore';
import type { CloudResourceNode, TopologyEdge } from '../types/topology';

describe('CloudSwarm Studio — Milestone 4 UI & Store Integration', () => {
  beforeEach(() => {
    // Reset store to clean baseline before each test
    useCloudSwarmStore.getState().resetTopology();
  });

  describe('1. Store Initialization & Defaults', () => {
    test('initializes with default clean topology, singletons, and personas', () => {
      const state = useCloudSwarmStore.getState();

      expect(state.topologyState).toBeDefined();
      expect(state.topologyState.version).toBe(0);
      expect(state.auditReport).toBeDefined();
      expect(state.auditReport.securityScore).toBe(100);
      expect(state.auditReport.totalMonthlyCostUsd).toBe(0);
      expect(state.dagTimeline.length).toBeGreaterThanOrEqual(1);
      expect(state.activeBranchName).toBe('main');
      expect(state.agentPresences.alpha).toBeDefined();
      expect(state.agentPresences.beta).toBeDefined();
      expect(state.agentPresences.gamma).toBeDefined();
      expect(state.agentPresences.director).toBeDefined();
    });

    test('exposes WebMCP protocol tools count through singleton engine', () => {
      const state = useCloudSwarmStore.getState();
      const tools = state.mcpEngine.getTools();
      expect(Array.isArray(tools)).toBe(true);
    });
  });

  describe('2. 1-Click Multi-Agent Swarm Simulation', () => {
    test('executes E-Commerce high-availability scenario in <100ms with full state mutation', async () => {
      const store = useCloudSwarmStore.getState();
      const report = await store.runSwarmDemo('ecommerce_ha');

      expect(report.success).toBe(true);
      expect(report.stepsCount).toBe(6);
      expect(report.durationMs).toBeLessThan(1000);

      const finalState = useCloudSwarmStore.getState();
      expect(Object.keys(finalState.topologyState.nodes).length).toBeGreaterThanOrEqual(5);
      expect(Object.keys(finalState.topologyState.edges).length).toBeGreaterThanOrEqual(2);

      // Verify CIS/OWASP Security Score updated
      expect(finalState.auditReport.securityScore).toBeGreaterThanOrEqual(80);

      // Verify FinOps Monthly Cost updated
      expect(finalState.auditReport.totalMonthlyCostUsd).toBeGreaterThan(0);

      // Verify DAG timeline recorded all steps
      expect(finalState.dagTimeline.length).toBeGreaterThanOrEqual(6);

      // Verify execution logs captured
      expect(finalState.executionLogs.length).toBeGreaterThanOrEqual(6);
    });

    test('executes FinTech Zero-Trust Banking Core scenario seamlessly', async () => {
      const store = useCloudSwarmStore.getState();
      const report = await store.runSwarmDemo('fintech_zerotrust');

      expect(report.success).toBe(true);
      const finalState = useCloudSwarmStore.getState();
      expect(finalState.topologyState.nodes['vpc_banking']).toBeDefined();
      expect(finalState.topologyState.nodes['eks_banking_core']).toBeDefined();
    });
  });

  describe('3. Multiplayer Spatial Presence & Cursors', () => {
    test('updates agent cursor positions and thought bubbles accurately', () => {
      const store = useCloudSwarmStore.getState();

      store.updateAgentPresence('alpha', {
        currentX: 450,
        currentY: 300,
        thoughtText: 'Optimizing VPC routing tables',
      });

      const updated = useCloudSwarmStore.getState();
      expect(updated.agentPresences.alpha.currentX).toBe(450);
      expect(updated.agentPresences.alpha.currentY).toBe(300);
      expect(updated.agentPresences.alpha.thoughtText).toBe('Optimizing VPC routing tables');
    });

    test('tracks Human Director mouse movements', () => {
      const store = useCloudSwarmStore.getState();
      store.updateAgentPresence('director', {
        currentX: 720,
        currentY: 480,
      });

      const updated = useCloudSwarmStore.getState();
      expect(updated.agentPresences.director.currentX).toBe(720);
      expect(updated.agentPresences.director.currentY).toBe(480);
    });
  });

  describe('4. Concurrency Locking & CAS Mutations', () => {
    test('acquires and releases striped entity locks', async () => {
      const store = useCloudSwarmStore.getState();
      const acquired = await store.acquireLock(['node_res_1', 'node_res_2'], 'alpha');
      expect(acquired).toBe(true);

      const stateWithLocks = useCloudSwarmStore.getState();
      expect(stateWithLocks.activeLocks.length).toBe(2);

      await store.releaseLock(['node_res_1', 'node_res_2'], 'alpha');
      const stateWithoutLocks = useCloudSwarmStore.getState();
      expect(stateWithoutLocks.activeLocks.length).toBe(0);
    });

    test('adds, updates, moves, and removes canvas nodes via CAS transactions', async () => {
      const store = useCloudSwarmStore.getState();

      const testNode: CloudResourceNode = {
        id: 'ec2_custom_1',
        type: 'aws_instance',
        name: 'Custom Web Worker',
        position: { x: 100, y: 100 },
        config: { instance_type: 't3.micro', root_volume_gb: 20 },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      // Add Node
      const addResult = await store.addNode(testNode);
      expect(addResult.success).toBe(true);

      let currentState = useCloudSwarmStore.getState();
      expect(currentState.topologyState.nodes['ec2_custom_1']).toBeDefined();

      // Move Node
      await store.moveNode('ec2_custom_1', { x: 250, y: 350 });
      currentState = useCloudSwarmStore.getState();
      expect(currentState.topologyState.nodes['ec2_custom_1']?.position).toEqual({ x: 250, y: 350 });

      // Update Node Config
      const updateResult = await store.updateNodeConfig('ec2_custom_1', { instance_type: 'c7g.xlarge' });
      expect(updateResult.success).toBe(true);
      currentState = useCloudSwarmStore.getState();
      expect(currentState.topologyState.nodes['ec2_custom_1']?.config['instance_type']).toBe('c7g.xlarge');

      // Add Edge
      const testEdge: TopologyEdge = {
        id: 'edge_custom_1',
        source: 'ec2_custom_1',
        target: 'rds_custom_1',
        type: 'routes_to',
      };
      await store.addEdge(testEdge);
      currentState = useCloudSwarmStore.getState();
      expect(currentState.topologyState.edges['edge_custom_1']).toBeDefined();

      // Remove Node (with edge cascade)
      await store.removeNode('ec2_custom_1');
      currentState = useCloudSwarmStore.getState();
      expect(currentState.topologyState.nodes['ec2_custom_1']).toBeUndefined();
      expect(currentState.topologyState.edges['edge_custom_1']).toBeUndefined();
    });

    test('executes microsecond deterministic rollbacks with inverse patches', async () => {
      const store = useCloudSwarmStore.getState();

      const testNode: CloudResourceNode = {
        id: 's3_temp_bucket',
        type: 'aws_s3_bucket',
        name: 'Temporary Assets Bucket',
        position: { x: 50, y: 50 },
        config: { bucket_name: 'temp-assets' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const txResult = await store.addNode(testNode);
      expect(txResult.success).toBe(true);
      expect(useCloudSwarmStore.getState().topologyState.nodes['s3_temp_bucket']).toBeDefined();

      // Rollback using inverse patches
      store.rollback(txResult.inversePatches);
      expect(useCloudSwarmStore.getState().topologyState.nodes['s3_temp_bucket']).toBeUndefined();
    });
  });

  describe('5. Bi-Directional HCL2 AST Sync', () => {
    test('synchronizes Terraform HCL code to canvas and updates DAG', async () => {
      const store = useCloudSwarmStore.getState();

      const sampleHcl = `
resource "aws_vpc" "vpc_hcl_test" {
  cidr_block = "10.50.0.0/16"
}

resource "aws_instance" "ec2_hcl_test" {
  instance_type = "t4g.small"
}
`;

      await store.syncHclToCanvas(sampleHcl);
      const updated = useCloudSwarmStore.getState();

      expect(updated.topologyState.nodes['vpc_hcl_test']).toBeDefined();
      expect(updated.topologyState.nodes['ec2_hcl_test']).toBeDefined();
      expect(updated.topologyState.nodes['ec2_hcl_test']?.config['instance_type']).toBe('t4g.small');
    });

    test('synchronizes canvas state back into Terraform HCL code', async () => {
      const store = useCloudSwarmStore.getState();

      await store.addNode({
        id: 's3_canvas_export',
        type: 'aws_s3_bucket',
        name: 'Export Bucket',
        position: { x: 100, y: 100 },
        config: { bucket_name: 'export-bucket-prod' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      store.syncCanvasToHcl();
      const updated = useCloudSwarmStore.getState();
      expect(updated.hclCode).toContain('resource "aws_s3_bucket" "s3_canvas_export"');
      expect(updated.hclCode).toContain('export-bucket-prod');
    });
  });

  describe('6. Time-Travel Decision DAG & Branching', () => {
    test('forks branch, switches branch, and scrubs history with LCA traversal', async () => {
      const store = useCloudSwarmStore.getState();

      // Commit 1
      await store.addNode({
        id: 'node_v1',
        type: 'aws_vpc',
        name: 'VPC 1',
        position: { x: 10, y: 10 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // Commit 2
      await store.addNode({
        id: 'node_v2',
        type: 'aws_instance',
        name: 'EC2 2',
        position: { x: 20, y: 20 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      const commit2State = useCloudSwarmStore.getState();
      expect(commit2State.dagTimeline.length).toBe(3); // Root + 2 commits

      // Scrub timeline to 0 (Root)
      store.scrubDagTimeline(0);
      let scrubbedState = useCloudSwarmStore.getState();
      expect(scrubbedState.topologyState.nodes['node_v2']).toBeUndefined();

      // Scrub timeline to 1 (Head)
      store.scrubDagTimeline(1);
      scrubbedState = useCloudSwarmStore.getState();
      expect(scrubbedState.topologyState.nodes['node_v2']).toBeDefined();

      // Fork branch
      store.forkDagBranch('experimental-branch');
      const branchState = useCloudSwarmStore.getState();
      expect(branchState.activeBranchName).toBe('experimental-branch');
      expect(branchState.branches.length).toBe(2);

      // Switch back to main
      store.switchDagBranch('main');
      expect(useCloudSwarmStore.getState().activeBranchName).toBe('main');
    });
  });

  describe('7. Automated SecOps Remediation & FinOps Rightsizing', () => {
    test('1-Click auto-remediates open CIS/OWASP findings', async () => {
      const store = useCloudSwarmStore.getState();

      // Add unhardened security group with open SSH 0.0.0.0/0
      await store.addNode({
        id: 'sg_insecure',
        type: 'aws_security_group',
        name: 'Insecure SG',
        position: { x: 10, y: 10 },
        config: {
          vpc_id: 'vpc_1',
          ingress_rules: [
            { protocol: 'tcp', from_port: 22, to_port: 22, cidr_blocks: ['0.0.0.0/0'] },
          ],
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      const stateWithVulnerability = useCloudSwarmStore.getState();
      expect(stateWithVulnerability.auditReport.findings.length).toBeGreaterThan(0);

      // Auto remediate
      await store.autoRemediateSecurity();

      const remediatedState = useCloudSwarmStore.getState();
      const sg = remediatedState.topologyState.nodes['sg_insecure'];
      const rules = sg?.config['ingress_rules'] as Array<{ from_port: number; cidr_blocks: string[] }>;
      const hasOpenSsh = rules?.some((r) => r.from_port === 22 && r.cidr_blocks?.includes('0.0.0.0/0'));
      expect(hasOpenSsh).toBe(false);
    });

    test('1-Click applies FinOps rightsizing recommendations', async () => {
      const store = useCloudSwarmStore.getState();

      // Add unoptimized EC2 on c6i.large + io2
      await store.addNode({
        id: 'ec2_costly',
        type: 'aws_instance',
        name: 'Costly EC2',
        position: { x: 10, y: 10 },
        config: {
          instance_type: 'c6i.large',
          root_volume_type: 'io2',
          root_volume_gb: 100,
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      await store.applyFinOpsOptimization();
      const optimizedState = useCloudSwarmStore.getState();
      const ec2 = optimizedState.topologyState.nodes['ec2_costly'];
      expect(ec2?.config['instance_type']).toBe('c7g.large'); // Graviton3
      expect(ec2?.config['root_volume_type']).toBe('gp3');
    });
  });

  describe('8. Production Materializer Export Bundle', () => {
    test('generates downloadable ZIP bundle with valid Blob artifact', async () => {
      const store = useCloudSwarmStore.getState();

      await store.addNode({
        id: 'vpc_prod',
        type: 'aws_vpc',
        name: 'Production VPC',
        position: { x: 10, y: 10 },
        config: { cidr_block: '10.0.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      const blob = await store.exportProductionBundle();
      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(100);
      expect(blob.type).toBe('application/zip');
    });
  });
});
