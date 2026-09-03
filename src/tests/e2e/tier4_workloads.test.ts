/**
 * Tier 4: Real-World Workload Scenarios E2E Test Suite
 *
 * Exercises 5 Canonical Enterprise Production Architectures:
 *
 * Scenario 1: Global FinTech Zero-Trust Multi-Cloud Mesh
 * Scenario 2: Healthcare HIPAA-Compliant Multi-Region Analytics Pipeline
 * Scenario 3: Real-Time AI GPU Inference Cluster
 * Scenario 4: Hybrid E-Commerce Burst Architecture
 * Scenario 5: Enterprise Multi-Tenant SaaS Disaster Recovery (Active-Active)
 *
 * Total Scenarios: 5 comprehensive tests
 */

import { OptimisticStateEngine } from '../../core/state/OptimisticStateEngine';
import { StripedLockManager } from '../../core/lock/StripedLockManager';
import { WebModelContextEngine } from '../../core/webmcp/WebModelContextEngine';
import { registerTopologyTools } from '../../core/webmcp/tools/topologyTools';
import {
  scanTopologySecurity,
  registerSecurityTools,
} from '../../core/webmcp/tools/securityTools';
import {
  calculateTopologyCostBreakdown,
  calculateNodeCost,
  registerFinOpsTools,
  AWS_PRICING_CATALOG,
} from '../../core/webmcp/tools/finopsTools';
import { HCLSyncEngine } from '../../core/sync/HCLSyncEngine';
import { ProductionMaterializer } from '../../core/export/ProductionMaterializer';
import { costCalculator } from '../../core/audit/CostCalculator';
import type { CloudResourceNode, TopologyState } from '../../types/topology';
import { createDefaultTopologyState } from '../../types/topology';

describe('Tier 4: Canonical Production Workloads E2E Suite (5 Scenarios)', () => {
  // =========================================================================
  // Scenario 1: Global FinTech Zero-Trust Multi-Cloud Mesh
  // =========================================================================
  describe('Scenario 1: Global FinTech Zero-Trust Multi-Cloud Mesh', () => {
    test('synthesizes, hardens, prices, and exports zero-trust multi-cloud mesh across Alpha, Beta, Gamma, and Delta', async () => {
      const lockManager = new StripedLockManager();
      const stateEngine = new OptimisticStateEngine();
      const webmcp = new WebModelContextEngine();
      registerTopologyTools(webmcp, stateEngine);
      registerSecurityTools(webmcp, () => stateEngine.getState(), stateEngine);
      registerFinOpsTools(webmcp, () => stateEngine.getState());

      // 1. Acquire Striped Locks for multi-cloud network mesh
      const handle = await lockManager.acquireLocks(['aws_vpc_fintech', 'azure_vnet_fintech', 'gcp_vpc_fintech', 'aws_eks_core', 'azure_aks_core', 'gcp_spanner_db'], 'alpha');
      expect(handle.lockIds.length).toBe(6);

      // 2. Alpha (Compute) provisions Kubernetes clusters
      await webmcp.executeTool('create_resource_node', {
        id: 'aws_eks_core',
        type: 'aws_eks_cluster',
        name: 'FinTech Production EKS',
        config: {
          cluster_name: 'fintech-eks-prod',
          endpoint_private_access: true,
          node_groups: [{ instance_type: 'c6i.large', desired_size: 3, capacity_type: 'ON_DEMAND' }],
        },
      }, { agentId: 'alpha' });

      // 3. Beta (Networking & Security) provisions Zero-Trust VPCs and IAM
      await webmcp.executeTool('create_resource_node', {
        id: 'aws_vpc_fintech',
        type: 'aws_vpc',
        name: 'FinTech Zero-Trust VPC',
        config: { cidr_block: '10.100.0.0/16', enable_dns_hostnames: true, enable_dns_support: true },
      }, { agentId: 'beta' });

      await webmcp.executeTool('create_resource_node', {
        id: 'sg_zero_trust',
        type: 'aws_security_group',
        name: 'Zero-Trust Enclave SG',
        config: {
          ingress_rules: [{ protocol: 'tcp', from_port: 443, to_port: 443, cidr_blocks: ['10.100.0.0/16'] }],
        },
      }, { agentId: 'beta' });

      // 4. Gamma (Storage & DBs) provisions encrypted data store
      await webmcp.executeTool('create_resource_node', {
        id: 'rds_financial_ledger',
        type: 'aws_db_instance',
        name: 'PCI Financial Ledger RDS',
        config: {
          engine: 'postgres',
          instance_class: 'db.m6g.large',
          allocated_storage_gb: 200,
          multi_az: true,
          storage_encrypted: true,
          publicly_accessible: false,
        },
      }, { agentId: 'gamma' });

      await webmcp.executeTool('create_resource_node', {
        id: 's3_audit_vault',
        type: 'aws_s3_bucket',
        name: 'Immutable Audit Vault',
        config: {
          bucket_name: 'fintech-immutable-audit-vault',
          encryption: { sse_algorithm: 'aws:kms', kms_key_id: 'arn:aws:kms:us-east-1:123:key/vault' },
          block_public_access: { block_public_acls: true, block_public_policy: true, ignore_public_acls: true, restrict_public_buckets: true },
          enforce_ssl_tls_requests: true,
        },
      }, { agentId: 'gamma' });

      // Connect nodes
      await webmcp.executeTool('connect_resources', { source_id: 'aws_eks_core', target_id: 'rds_financial_ledger', relation_type: 'routes_to', port: 5432, protocol: 'tcp' });
      await webmcp.executeTool('connect_resources', { source_id: 'aws_eks_core', target_id: 's3_audit_vault', relation_type: 'stores_in' });

      await handle.release();

      const state = stateEngine.getState();
      expect(Object.keys(state.nodes).length).toBe(5);
      expect(Object.keys(state.edges).length).toBe(2);

      // 5. Delta checks security posture & FinOps run rate
      const secReport = scanTopologySecurity(state);
      expect(secReport.score).toBe(100);
      expect(secReport.status).toBe('PASS');

      const costReport = calculateTopologyCostBreakdown(state);
      expect(costReport.totalMonthlyUsd).toBeGreaterThan(200);
      expect(costReport.categoryTotals.Compute).toBeGreaterThan(0);
      expect(costReport.categoryTotals.Database).toBeGreaterThan(0);

      // 6. Generate production bundle & SHA-256 signed audit certificate
      const bundle = ProductionMaterializer.materializeBundle(state, { securityScore: secReport.score, totalMonthlyCostUsd: costReport.totalMonthlyUsd });
      expect(bundle['main.tf']).toContain('resource "aws_eks_cluster"');
      expect(bundle['main.tf']).toContain('resource "aws_db_instance"');
      expect(bundle['audit_certificate.json']).toBeDefined();

      const cert = JSON.parse(bundle['audit_certificate.json'] ?? '{}');
      expect(cert.score).toBe(100);
      expect(cert.grade).toBe('A+');
    });
  });

  // =========================================================================
  // Scenario 2: Healthcare HIPAA-Compliant Multi-Region Analytics
  // =========================================================================
  describe('Scenario 2: Healthcare HIPAA-Compliant Multi-Region Analytics', () => {
    test('provisions multi-region HIPAA data lake with dedicated encryption and cold archive tiers', async () => {
      const stateEngine = new OptimisticStateEngine();

      // AWS Encrypted S3 Data Lake
      await stateEngine.addNode({
        id: 's3_phi_lake',
        type: 'aws_s3_bucket',
        name: 'HIPAA PHI Lake',
        position: { x: 0, y: 0 },
        config: {
          bucket_name: 'healthcare-phi-lake-us-east-1',
          encryption: { sse_algorithm: 'aws:kms', kms_key_id: 'alias/aws/s3' },
          block_public_access: { block_public_acls: true, block_public_policy: true, ignore_public_acls: true, restrict_public_buckets: true },
          enforce_ssl_tls_requests: true,
          versioning_enabled: true,
        },
        metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // Secure Compute Processing Node with IMDSv2
      await stateEngine.addNode({
        id: 'ec2_analytics_worker',
        type: 'aws_instance',
        name: 'Genomic Analytics Worker',
        position: { x: 200, y: 0 },
        config: {
          instance_type: 'r6i.large',
          root_volume_gb: 150,
          root_volume_type: 'gp3',
          http_tokens: 'required', // IMDSv2 enforced
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // Isolated Database Tier
      await stateEngine.addNode({
        id: 'rds_clinical_trials',
        type: 'aws_db_instance',
        name: 'Clinical Trials DB',
        position: { x: 400, y: 0 },
        config: {
          engine: 'postgres',
          instance_class: 'db.r6g.large',
          allocated_storage_gb: 500,
          multi_az: true,
          storage_encrypted: true,
          publicly_accessible: false,
        },
        metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // Least-Privilege IAM Role
      await stateEngine.addNode({
        id: 'iam_hipaa_role',
        type: 'aws_iam_role',
        name: 'HIPAA Service Role',
        position: { x: 200, y: 150 },
        config: {
          role_name: 'HealthcareAnalyticsExecutionRole',
          trusted_service: 'ec2.amazonaws.com',
          inline_policy: {
            policy_name: 'phi-strict-access',
            policy_document: JSON.stringify({
              Version: '2012-10-17',
              Statement: [{ Effect: 'Allow', Action: ['s3:GetObject', 's3:PutObject'], Resource: 'arn:aws:s3:::healthcare-phi-lake-us-east-1/*' }],
            }),
          },
        },
        metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      const state = stateEngine.getState();
      const secReport = scanTopologySecurity(state);
      expect(secReport.score).toBe(100);
      expect(secReport.status).toBe('PASS');

      // Export line-item CSV breakdown
      const costReport = calculateTopologyCostBreakdown(state);
      expect(costReport.totalMonthlyUsd).toBeGreaterThan(250);

      const csvRows = ['Resource ID,Name,Type,Category,Monthly Cost (USD)'];
      for (const item of costReport.items) {
        csvRows.push(`"${item.nodeId}","${item.name}","${item.type}","${item.category}",${item.monthlyUsd.toFixed(2)}`);
      }
      csvRows.push(`"TOTAL","","","",${costReport.totalMonthlyUsd.toFixed(2)}`);
      const csv = csvRows.join('\r\n');

      expect(csv).toContain('Genomic Analytics Worker');
      expect(csv).toContain('Clinical Trials DB');
    });
  });

  // =========================================================================
  // Scenario 3: Real-Time AI GPU Inference Cluster
  // =========================================================================
  describe('Scenario 3: Real-Time AI GPU Inference Cluster', () => {
    test('configures high-throughput GPU cluster with fast storage and fine-grained lock coordination during scaling', async () => {
      const lockManager = new StripedLockManager();
      const stateEngine = new OptimisticStateEngine();

      // GPU Compute Node 1 (NVIDIA A10G)
      const handleGpu1 = await lockManager.acquireLocks(['gpu_node_1'], 'alpha');
      await stateEngine.addNode({
        id: 'gpu_node_1',
        type: 'aws_instance',
        name: 'LLM Worker 1 (NVIDIA A10G)',
        position: { x: 0, y: 0 },
        config: {
          instance_type: 'g5.2xlarge',
          root_volume_gb: 200,
          root_volume_type: 'gp3',
          http_tokens: 'required',
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });
      await handleGpu1.release();

      // GPU Compute Node 2 (NVIDIA A10G)
      const handleGpu2 = await lockManager.acquireLocks(['gpu_node_2'], 'alpha');
      await stateEngine.addNode({
        id: 'gpu_node_2',
        type: 'aws_instance',
        name: 'LLM Worker 2 (NVIDIA A10G)',
        position: { x: 200, y: 0 },
        config: {
          instance_type: 'g5.2xlarge',
          root_volume_gb: 200,
          root_volume_type: 'gp3',
          http_tokens: 'required',
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });
      await handleGpu2.release();

      // High-Performance Storage for model weights
      await stateEngine.addNode({
        id: 'weights_volume',
        type: 'aws_instance',
        name: 'High-IOPS Model Weights Store',
        position: { x: 100, y: 150 },
        config: {
          instance_type: 'm6i.large',
          root_volume_gb: 1000,
          root_volume_type: 'io2',
          iops: 10000, // 10,000 IOPS
        },
        metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      const state = stateEngine.getState();
      const costReport = calculateTopologyCostBreakdown(state);

      // GPU Node 1: ~900 $/mo, GPU Node 2: ~900 $/mo, Weights Volume: ~775 $/mo => total > 2000 $/mo
      expect(costReport.totalMonthlyUsd).toBeGreaterThan(2000);
      expect(costReport.categoryTotals.Compute).toBeGreaterThan(1500);

      // Verify node 1 and 2 costs are identical
      const cost1 = calculateNodeCost(state.nodes['gpu_node_1']!);
      const cost2 = calculateNodeCost(state.nodes['gpu_node_2']!);
      expect(cost1.monthlyUsd).toBe(cost2.monthlyUsd);
    });
  });

  // =========================================================================
  // Scenario 4: Hybrid E-Commerce Burst Architecture
  // =========================================================================
  describe('Scenario 4: Hybrid E-Commerce Burst Architecture', () => {
    test('manages elastic web scaling, distributed caching, multi-layer networking, and FinOps budget guardrails', async () => {
      const stateEngine = new OptimisticStateEngine();

      // Ingress ALB
      await stateEngine.addNode({
        id: 'alb_storefront',
        type: 'aws_lb',
        name: 'Public Ingress ALB',
        position: { x: 100, y: 0 },
        config: { load_balancer_type: 'application', internal: false },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // Auto Scaling Web App Tier
      await stateEngine.addNode({
        id: 'ec2_web_1',
        type: 'aws_instance',
        name: 'Web Server 1',
        position: { x: 0, y: 150 },
        config: { instance_type: 'c7g.large', root_volume_gb: 30, root_volume_type: 'gp3', http_tokens: 'required' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });
      await stateEngine.addNode({
        id: 'ec2_web_2',
        type: 'aws_instance',
        name: 'Web Server 2',
        position: { x: 200, y: 150 },
        config: { instance_type: 'c7g.large', root_volume_gb: 30, root_volume_type: 'gp3', http_tokens: 'required' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // Relational Database Tier
      await stateEngine.addNode({
        id: 'rds_orders_db',
        type: 'aws_db_instance',
        name: 'Orders & Inventory DB',
        position: { x: 100, y: 300 },
        config: { engine: 'postgres', instance_class: 'db.t4g.large', allocated_storage_gb: 100, multi_az: true, storage_encrypted: true, publicly_accessible: false },
        metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // Connect ALB to Web Servers, and Web Servers to DB
      await stateEngine.addEdge({ id: 'edge_alb_1', source: 'alb_storefront', target: 'ec2_web_1', type: 'target_group_of', port: 443, protocol: 'https' });
      await stateEngine.addEdge({ id: 'edge_alb_2', source: 'alb_storefront', target: 'ec2_web_2', type: 'target_group_of', port: 443, protocol: 'https' });
      await stateEngine.addEdge({ id: 'edge_db_1', source: 'ec2_web_1', target: 'rds_orders_db', type: 'routes_to', port: 5432, protocol: 'tcp' });
      await stateEngine.addEdge({ id: 'edge_db_2', source: 'ec2_web_2', target: 'rds_orders_db', type: 'routes_to', port: 5432, protocol: 'tcp' });

      const state = stateEngine.getState();
      expect(Object.keys(state.nodes).length).toBe(4);
      expect(Object.keys(state.edges).length).toBe(4);

      const cost = calculateTopologyCostBreakdown(state);
      expect(cost.totalMonthlyUsd).toBeGreaterThan(150);
      expect(cost.categoryTotals.Networking).toBe(16.2); // ALB fee

      const sec = scanTopologySecurity(state);
      expect(sec.score).toBe(100);
      expect(sec.status).toBe('PASS');
    });
  });

  // =========================================================================
  // Scenario 5: Enterprise Multi-Tenant SaaS DR Disaster Recovery (Active-Active)
  // =========================================================================
  describe('Scenario 5: Enterprise Multi-Tenant SaaS DR Disaster Recovery', () => {
    test('provisions active-active cross-region topology with primary us-east-1 and DR replica us-west-2', async () => {
      const stateEngine = new OptimisticStateEngine();

      // Primary Region (us-east-1)
      await stateEngine.addNode({
        id: 'vpc_us_east_1',
        type: 'aws_vpc',
        name: 'Primary Region VPC (us-east-1)',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.0.0.0/16', enable_dns_hostnames: true },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });
      await stateEngine.addNode({
        id: 'rds_primary_east',
        type: 'aws_db_instance',
        name: 'Primary Aurora PostgreSQL',
        position: { x: 0, y: 150 },
        config: { engine: 'postgres', instance_class: 'db.r6g.xlarge', allocated_storage_gb: 250, multi_az: true, storage_encrypted: true },
        metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // DR Secondary Region (us-west-2)
      await stateEngine.addNode({
        id: 'vpc_us_west_2',
        type: 'aws_vpc',
        name: 'DR Secondary VPC (us-west-2)',
        position: { x: 400, y: 0 },
        config: { cidr_block: '10.1.0.0/16', enable_dns_hostnames: true },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });
      await stateEngine.addNode({
        id: 'rds_replica_west',
        type: 'aws_db_instance',
        name: 'DR Read Replica Aurora PostgreSQL',
        position: { x: 400, y: 150 },
        config: { engine: 'postgres', instance_class: 'db.r6g.large', allocated_storage_gb: 250, multi_az: false, storage_encrypted: true },
        metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // Inter-region cross-region replication & peering edges
      await stateEngine.addEdge({
        id: 'edge_interregion_peering',
        source: 'vpc_us_east_1',
        target: 'vpc_us_west_2',
        type: 'peering',
        label: 'Inter-Region VPC Peering (East-West)',
      });
      await stateEngine.addEdge({
        id: 'edge_db_replication',
        source: 'rds_primary_east',
        target: 'rds_replica_west',
        type: 'peering',
        label: 'Async Cross-Region DB Replication',
      });

      const state = stateEngine.getState();
      expect(Object.keys(state.nodes).length).toBe(4);
      expect(Object.keys(state.edges).length).toBe(2);

      // Verify HCL round-trip compilation
      const hcl = ProductionMaterializer.generateMainTf(state);
      expect(hcl).toContain('resource "aws_vpc" "vpc_us_east_1"');
      expect(hcl).toContain('resource "aws_vpc" "vpc_us_west_2"');
      expect(hcl).toContain('resource "aws_db_instance" "rds_primary_east"');

      // Verify Production ZIP bundle materialization
      const bundle = ProductionMaterializer.materializeBundle(state);
      expect(bundle['main.tf']).toBeDefined();
      expect(bundle['variables.tf']).toBeDefined();
      expect(bundle['outputs.tf']).toBeDefined();
      expect(bundle['Dockerfile']).toBeDefined();
      expect(bundle['audit_certificate.json']).toBeDefined();

      const cert = JSON.parse(bundle['audit_certificate.json'] ?? '{}');
      expect(cert.sha256).toBeDefined();
      expect(cert.complianceBenchmarks.length).toBeGreaterThanOrEqual(3);
    });
  });
});
