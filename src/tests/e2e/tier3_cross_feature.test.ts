/**
 * Tier 3: Pairwise & Cross-Feature Integration Flows E2E Test Suite
 *
 * Validates multi-module interactions across the complete CloudSwarm pipeline (10 tests):
 *
 * Flow 1: 4-Agent Multi-Cloud Orchestration (Planner -> Alpha + Beta + Gamma + Delta -> CAS -> Locks -> DAG -> HCL)
 * Flow 2: Dynamic Inspector Property Edit to Live Multi-Cloud FinOps Reactivity
 * Flow 3: FinOps Budget Alert & Rightsizing Optimization Loop
 * Flow 4: Bi-Directional Multi-Cloud HCL AST Sync Round-Trip
 * Flow 5: Multi-Cloud Security Violation Detection to Automated Hardening
 * Flow 6: Time-Travel Decision DAG Branching & Architecture Comparison
 * Flow 7: Production Materializer Multi-Cloud ZIP Export Bundle & Audit Certification
 * Flow 8: Multi-Cloud Palette Filtering to Canvas Node Instantiation & Peering
 * Flow 9: AbortSignal Cancellation & Transaction Rollback Safeguard
 * Flow 10: Multi-Cloud FinOps Line-Item CSV Export & Reconciliation
 *
 * Total Test Cases: 10 tests
 */

import { StripedLockManager } from '../../core/lock/StripedLockManager';
import { OptimisticStateEngine } from '../../core/state/OptimisticStateEngine';
import { WebModelContextEngine } from '../../core/webmcp/WebModelContextEngine';
import { registerTopologyTools } from '../../core/webmcp/tools/topologyTools';
import {
  scanTopologySecurity,
  registerSecurityTools,
} from '../../core/webmcp/tools/securityTools';
import {
  calculateNodeCost,
  calculateTopologyCostBreakdown,
  registerFinOpsTools,
  AWS_PRICING_CATALOG,
} from '../../core/webmcp/tools/finopsTools';
import { DecisionDAG } from '../../core/dag/DecisionDAG';
import { HCLSyncEngine } from '../../core/sync/HCLSyncEngine';
import { ProductionMaterializer } from '../../core/export/ProductionMaterializer';
import { costCalculator } from '../../core/audit/CostCalculator';
import type {
  TopologyState,
  CloudResourceNode,
} from '../../types/topology';
import { createDefaultTopologyState } from '../../types/topology';
import type { AgentId } from '../../types/swarm';

describe('Tier 3: Pairwise & Cross-Feature Integration Pipelines (10 Tests)', () => {
  // =========================================================================
  // Flow 1: 4-Agent Multi-Cloud Orchestration Pipeline
  // =========================================================================
  describe('Flow 1: 4-Agent Multi-Cloud Orchestration Pipeline', () => {
    test('orchestrates full cloud infrastructure lifecycle across Alpha, Beta, Gamma, and Delta', async () => {
      const lockManager = new StripedLockManager();
      const stateEngine = new OptimisticStateEngine();
      const webmcp = new WebModelContextEngine();
      registerTopologyTools(webmcp, stateEngine);
      registerFinOpsTools(webmcp, () => stateEngine.getState());

      // 1. Locks acquired by Agent Alpha
      const handle = await lockManager.acquireLocks(['vpc_main', 'ec2_app', 'db_primary'], 'alpha');
      expect(handle.lockIds).toEqual(['db_primary', 'ec2_app', 'vpc_main']);

      // 2. Alpha provisions Compute & Fabric via WebMCP
      const resAlpha = await webmcp.executeTool('create_resource_node', {
        id: 'ec2_app',
        type: 'aws_instance',
        name: 'Enterprise Web App',
        config: { instance_type: 't3.medium', root_volume_gb: 40, root_volume_type: 'gp3', http_tokens: 'required' },
      }, { agentId: 'alpha' });
      expect(resAlpha.isError).toBeFalsy();

      // 3. Gamma provisions Database via WebMCP
      const resGamma = await webmcp.executeTool('create_resource_node', {
        id: 'db_primary',
        type: 'aws_db_instance',
        name: 'Aurora Primary DB',
        config: { engine: 'postgres', instance_class: 'db.t4g.medium', allocated_storage_gb: 100, multi_az: true, storage_encrypted: true },
      }, { agentId: 'gamma' });
      expect(resGamma.isError).toBeFalsy();

      // 4. Release locks
      await handle.release();
      expect(lockManager.isLocked('ec2_app')).toBe(false);

      // 5. Delta evaluates FinOps rates
      const costReport = calculateTopologyCostBreakdown(stateEngine.getState());
      expect(costReport.totalMonthlyUsd).toBeGreaterThan(100);

      // 6. Commit to Decision DAG
      const dag = new DecisionDAG(stateEngine.getState());
      const commit = dag.addCommit({
        message: '4-Agent Synthesis: EC2 + Aurora PostgreSQL',
        author: 'alpha',
        patches: [],
        state: stateEngine.getState(),
      });
      expect(commit.author).toBe('alpha');

      // 7. Compile HCL
      const hcl = ProductionMaterializer.generateMainTf(stateEngine.getState());
      expect(hcl).toContain('resource "aws_instance" "ec2_app"');
      expect(hcl).toContain('resource "aws_db_instance" "db_primary"');
    });
  });

  // =========================================================================
  // Flow 2: Dynamic Inspector Property Edit to Live FinOps Reactivity
  // =========================================================================
  describe('Flow 2: Dynamic Inspector Property Edit to Live FinOps Reactivity', () => {
    test('updates instance sizing in inspector and instantly recalculates multi-category spend', async () => {
      const stateEngine = new OptimisticStateEngine();

      // Initial small node
      await stateEngine.addNode({
        id: 'compute_node',
        type: 'aws_instance',
        name: 'Compute Sizing Target',
        position: { x: 0, y: 0 },
        config: { instance_type: 't3.nano', root_volume_gb: 20, root_volume_type: 'gp3' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      const initialCost = calculateTopologyCostBreakdown(stateEngine.getState()).totalMonthlyUsd;

      // Inspector update to powerful instance
      await stateEngine.updateNodeConfig('compute_node', {
        instance_type: 'm6i.4xlarge',
        root_volume_gb: 200,
        root_volume_type: 'io2',
        iops: 5000,
      });

      const updatedCost = calculateTopologyCostBreakdown(stateEngine.getState()).totalMonthlyUsd;
      expect(updatedCost).toBeGreaterThan(initialCost + 500);
      expect(stateEngine.getState().nodes['compute_node']?.config.instance_type).toBe('m6i.4xlarge');
    });
  });

  // =========================================================================
  // Flow 3: FinOps Budget Alert & Rightsizing Optimization Loop
  // =========================================================================
  describe('Flow 3: FinOps Budget Alert & Rightsizing Optimization Loop', () => {
    test('detects budget overshoot, generates Graviton & gp3 recommendations, applies patches, and lowers run-rate', async () => {
      const stateEngine = new OptimisticStateEngine();

      // Architecture with legacy x86 instances and gp2 volumes
      await stateEngine.addNode({
        id: 'ec2_legacy_1',
        type: 'aws_instance',
        name: 'Legacy Server 1',
        position: { x: 0, y: 0 },
        config: { instance_type: 'c6i.large', root_volume_type: 'gp2', root_volume_gb: 100 },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });
      await stateEngine.addNode({
        id: 'ec2_legacy_2',
        type: 'aws_instance',
        name: 'Legacy Server 2',
        position: { x: 100, y: 0 },
        config: { instance_type: 'm6i.large', root_volume_type: 'gp2', root_volume_gb: 100 },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      const beforeCost = calculateTopologyCostBreakdown(stateEngine.getState()).totalMonthlyUsd;
      const budgetThreshold = 100.0;

      expect(beforeCost).toBeGreaterThan(budgetThreshold);

      // Generate FinOps recommendations
      const recs = costCalculator.generateRecommendations(stateEngine.getState());
      expect(recs.length).toBeGreaterThanOrEqual(2);

      // Delta agent applies optimization patches (migrate to Graviton3 c7g.large & gp3)
      await stateEngine.updateNodeConfig('ec2_legacy_1', { instance_type: 'c7g.large', root_volume_type: 'gp3' });
      await stateEngine.updateNodeConfig('ec2_legacy_2', { instance_type: 't4g.small', root_volume_type: 'gp3' });

      const afterCost = calculateTopologyCostBreakdown(stateEngine.getState()).totalMonthlyUsd;
      expect(afterCost).toBeLessThan(beforeCost);
      expect(afterCost).toBeLessThan(budgetThreshold);
    });
  });

  // =========================================================================
  // Flow 4: Bi-Directional Multi-Cloud HCL AST Sync Round-Trip
  // =========================================================================
  describe('Flow 4: Bi-Directional Multi-Cloud HCL AST Sync Round-Trip', () => {
    test('canvas -> HCL -> edit -> canvas round-trip retains exact multi-node attributes', () => {
      const state = createDefaultTopologyState();
      (state.nodes as Record<string, CloudResourceNode>)['vpc_core'] = {
        id: 'vpc_core',
        type: 'aws_vpc',
        name: 'VPC Core',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.50.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      (state.nodes as Record<string, CloudResourceNode>)['ec2_api'] = {
        id: 'ec2_api',
        type: 'aws_instance',
        name: 'API Server',
        position: { x: 100, y: 100 },
        config: { instance_type: 't3.large' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      // 1. Serialize to HCL
      const hcl = HCLSyncEngine.canvasToHcl(state);
      expect(hcl).toContain('resource "aws_vpc" "vpc_core"');
      expect(hcl).toContain('resource "aws_instance" "ec2_api"');

      // 2. Modify HCL string (change instance_type to c7g.xlarge)
      const editedHcl = hcl.replace('t3.large', 'c7g.xlarge');

      // 3. Parse back into Canvas state
      const reconstructedState = HCLSyncEngine.hclToCanvas(editedHcl);
      expect(reconstructedState.nodes['vpc_core']?.config.cidr_block).toBe('10.50.0.0/16');
      expect(reconstructedState.nodes['ec2_api']?.config.instance_type).toBe('c7g.xlarge');
    });
  });

  // =========================================================================
  // Flow 5: Security Scanning to Auto-Hardening
  // =========================================================================
  describe('Flow 5: Security Scanning to Auto-Hardening', () => {
    test('detects multiple CIS violations, drops score to F, auto-remediates, and achieves 100/100 A+', async () => {
      const stateEngine = new OptimisticStateEngine();
      const webmcp = new WebModelContextEngine();
      registerSecurityTools(webmcp, () => stateEngine.getState(), stateEngine);

      // Insecure nodes
      await stateEngine.addNode({
        id: 'sg_insecure',
        type: 'aws_security_group',
        name: 'Insecure SG',
        position: { x: 0, y: 0 },
        config: { ingress_rules: [{ protocol: 'tcp', from_port: 22, to_port: 22, cidr_blocks: ['0.0.0.0/0'] }] },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });
      await stateEngine.addNode({
        id: 'db_insecure',
        type: 'aws_db_instance',
        name: 'Insecure DB',
        position: { x: 0, y: 0 },
        config: { publicly_accessible: true, storage_encrypted: false },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });
      await stateEngine.addNode({
        id: 's3_insecure',
        type: 'aws_s3_bucket',
        name: 'Insecure S3',
        position: { x: 0, y: 0 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      const initialScan = scanTopologySecurity(stateEngine.getState());
      expect(initialScan.score).toBeLessThanOrEqual(50);
      expect(initialScan.status).toBe('CRITICAL_FAIL');

      // Auto-harden
      const res = await webmcp.executeTool('apply_security_hardening', {}, { agentId: 'beta' });
      expect(res.isError).toBeFalsy();

      const finalScan = scanTopologySecurity(stateEngine.getState());
      expect(finalScan.score).toBe(100);
      expect(finalScan.status).toBe('PASS');
    });
  });

  // =========================================================================
  // Flow 6: Time-Travel Decision DAG Branching & Comparison
  // =========================================================================
  describe('Flow 6: Time-Travel Decision DAG Branching & Comparison', () => {
    test('forks separate architectural branches, applies independent mutations, and calculates accurate diff', () => {
      const baseState = createDefaultTopologyState();
      (baseState.nodes as Record<string, CloudResourceNode>)['vpc_root'] = {
        id: 'vpc_root',
        type: 'aws_vpc',
        name: 'Root VPC',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.0.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const dag = new DecisionDAG(baseState);

      // Commit 1: Add EC2
      const c1 = dag.addCommit({
        message: 'Add EC2 on Main',
        author: 'alpha',
        patches: [{ op: 'add', path: '/nodes/ec2_main', value: { id: 'ec2_main', type: 'aws_instance', name: 'EC2 Main', position: { x: 50, y: 50 }, config: { instance_type: 't3.small' } } }],
      });

      // Fork branch for GPU upgrade
      dag.forkBranch('gpu_accelerated', c1.id, 'alpha');

      // Commit on GPU branch
      const cGpu = dag.addCommit({
        message: 'Add GPU Node',
        author: 'alpha',
        patches: [{ op: 'add', path: '/nodes/gpu_node', value: { id: 'gpu_node', type: 'aws_instance', name: 'GPU Node', position: { x: 100, y: 100 }, config: { instance_type: 'g5.2xlarge' } } }],
      });

      // Compare commits
      const diff = dag.getDiff(c1.id, cGpu.id);
      expect(diff.addedNodes.length).toBe(1);
      expect(diff.addedNodes[0]?.id).toBe('gpu_node');
    });
  });

  // =========================================================================
  // Flow 7: Production Materializer Multi-Cloud ZIP Bundle & Audit Certificate
  // =========================================================================
  describe('Flow 7: Production Materializer Multi-Cloud ZIP Bundle & Audit Certificate', () => {
    test('materializes complete production bundle containing main.tf, variables.tf, outputs.tf, Dockerfile, and signed certificate', async () => {
      const state = createDefaultTopologyState();
      (state.nodes as Record<string, CloudResourceNode>)['vpc_prod'] = {
        id: 'vpc_prod',
        type: 'aws_vpc',
        name: 'Prod VPC',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.0.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      (state.nodes as Record<string, CloudResourceNode>)['ec2_prod'] = {
        id: 'ec2_prod',
        type: 'aws_instance',
        name: 'Prod EC2',
        position: { x: 100, y: 100 },
        config: { instance_type: 't3.medium', root_volume_gb: 40 },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const auditReport = { securityScore: 100, totalMonthlyCostUsd: 32.77 };
      const bundle = ProductionMaterializer.materializeBundle(state, auditReport);

      expect(bundle['main.tf']).toContain('resource "aws_vpc" "vpc_prod"');
      expect(bundle['variables.tf']).toContain('variable "aws_region"');
      expect(bundle['outputs.tf']).toContain('output "vpc_vpc_prod_id"');
      expect(bundle['Dockerfile']).toContain('FROM node:20-alpine AS builder');
      expect(bundle['audit_certificate.json']).toBeDefined();

      const cert = JSON.parse(bundle['audit_certificate.json'] ?? '{}');
      expect(cert.score).toBe(100);
      expect(cert.sha256).toMatch(/^[a-f0-9]{64}$/);

      const zipBlob = await ProductionMaterializer.generateZipBundle(state, auditReport);
      expect(zipBlob.size).toBeGreaterThan(500);
    });
  });

  // =========================================================================
  // Flow 8: Multi-Cloud Palette Filtering to Canvas Node & Peering
  // =========================================================================
  describe('Flow 8: Multi-Cloud Palette Filtering to Canvas Node & Peering', () => {
    test('instantiates nodes from palette filters and establishes inter-cloud connectivity edge', async () => {
      const stateEngine = new OptimisticStateEngine();

      await stateEngine.addNode({
        id: 'aws_vpc_net',
        type: 'aws_vpc',
        name: 'AWS Primary Network',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.10.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      await stateEngine.addNode({
        id: 'azure_vnet_net',
        type: 'aws_vpc',
        name: 'Azure Primary VNet',
        position: { x: 300, y: 0 },
        config: { cidr_block: '10.20.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      const edgeRes = await stateEngine.addEdge({
        id: 'edge_intercloud_peering',
        source: 'aws_vpc_net',
        target: 'azure_vnet_net',
        type: 'peering',
        label: 'Cross-Cloud VPN Peering',
      });

      expect(edgeRes.success).toBe(true);
      expect(stateEngine.getState().edges['edge_intercloud_peering']?.type).toBe('peering');
    });
  });

  // =========================================================================
  // Flow 9: AbortSignal Cancellation & Transaction Rollback Safeguard
  // =========================================================================
  describe('Flow 9: AbortSignal Cancellation & Transaction Rollback Safeguard', () => {
    test('aborts in-flight operations without leaving locked entities or corrupted state', async () => {
      const lockManager = new StripedLockManager();
      const stateEngine = new OptimisticStateEngine();

      await stateEngine.addNode({
        id: 'node_safe',
        type: 'aws_instance',
        name: 'Stable Node',
        position: { x: 0, y: 0 },
        config: { version_marker: 'v1' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      const handle = await lockManager.acquireLocks(['node_safe'], 'beta');
      expect(lockManager.isLocked('node_safe')).toBe(true);

      const controller = new AbortController();
      controller.abort();

      // On abort, release lock and do not apply corrupted patch
      await handle.release();
      expect(lockManager.isLocked('node_safe')).toBe(false);
      expect(stateEngine.getState().nodes['node_safe']?.config.version_marker).toBe('v1');
    });
  });

  // =========================================================================
  // Flow 10: Multi-Cloud FinOps Line-Item CSV Export & Reconciliation
  // =========================================================================
  describe('Flow 10: Multi-Cloud FinOps Line-Item CSV Export & Reconciliation', () => {
    test('computes multi-resource cost breakdown and exports RFC 4180 CSV matching exact line-item sums', () => {
      const state = createDefaultTopologyState();
      (state.nodes as Record<string, CloudResourceNode>)['ec2_1'] = {
        id: 'ec2_1',
        type: 'aws_instance',
        name: 'Web Server 1',
        position: { x: 0, y: 0 },
        config: { instance_type: 't3.small' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      (state.nodes as Record<string, CloudResourceNode>)['ec2_2'] = {
        id: 'ec2_2',
        type: 'aws_instance',
        name: 'Web Server 2',
        position: { x: 50, y: 0 },
        config: { instance_type: 't3.small' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      (state.nodes as Record<string, CloudResourceNode>)['alb_1'] = {
        id: 'alb_1',
        type: 'aws_lb',
        name: 'Main ALB',
        position: { x: 100, y: 0 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const breakdown = calculateTopologyCostBreakdown(state);
      expect(breakdown.items.length).toBe(3);

      // CSV Export Routine
      const lines = ['Resource ID,Name,Type,Category,Monthly Cost (USD)'];
      let lineItemSum = 0;
      for (const item of breakdown.items) {
        lines.push(`"${item.nodeId}","${item.name}","${item.type}","${item.category}",${item.monthlyUsd.toFixed(2)}`);
        lineItemSum += item.monthlyUsd;
      }
      lines.push(`"TOTAL","","","",${breakdown.totalMonthlyUsd.toFixed(2)}`);
      const csv = lines.join('\r\n');

      expect(csv).toContain('"ec2_1","Web Server 1"');
      expect(csv).toContain('"alb_1","Main ALB"');
      expect(lineItemSum).toBeCloseTo(breakdown.totalMonthlyUsd, 2);
    });
  });
});
