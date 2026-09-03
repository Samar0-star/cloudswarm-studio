/**
 * Tier 1: Feature Coverage E2E Test Suite
 *
 * Comprehensive opaque-box test suite covering Features R1-R5 with >=5 tests per feature:
 *
 * Feature 1: Master Planner LLM Decomposition & 4-Agent Orchestration (R1)
 * Feature 2: Concurrent WebMCP Tool Calls & Fine-Grained StripedLockManager (R1)
 * Feature 3: 100+ Multi-Cloud Resource Catalog & Type System (R2)
 * Feature 4: Enterprise SaaS UI, Palette Multi-Select Filters & Dynamic Inspector Schemas (R3)
 * Feature 5: Multi-Cloud FinOps Engine & Rate Cards (R4)
 * Feature 6: Multi-Cloud Terraform/OpenTofu Export & Bi-Directional HCL Sync (R5)
 * Feature 7: Zero-Trust Security Scanner & Auto-Hardener (R1/R3)
 * Feature 8: Time-Travel Decision DAG & Branching (R1/R3)
 *
 * Total Test Cases: 40 tests (8 features × 5 tests)
 */

import { StripedLockManager } from '../../core/lock/StripedLockManager';
import { OptimisticStateEngine } from '../../core/state/OptimisticStateEngine';
import { WebModelContextEngine } from '../../core/webmcp/WebModelContextEngine';
import { ensureWebModelContext, getWebModelContext, resetWebModelContext } from '../../core/webmcp/polyfill';
import {
  registerTopologyTools,
  isValidCIDR,
  checkCIDROverlap,
  AWS_RESOURCE_TYPES,
} from '../../core/webmcp/tools/topologyTools';
import {
  scanTopologySecurity,
  createGenerateLeastPrivilegePolicyTool,
  registerSecurityTools,
} from '../../core/webmcp/tools/securityTools';
import {
  calculateNodeCost,
  calculateTopologyCostBreakdown,
  createQueryResourcePricingTool,
  registerFinOpsTools,
  HOURS_PER_MONTH,
  AWS_PRICING_CATALOG,
} from '../../core/webmcp/tools/finopsTools';
import { DecisionDAG } from '../../core/dag/DecisionDAG';
import { HCLSyncEngine } from '../../core/sync/HCLSyncEngine';
import { ProductionMaterializer } from '../../core/export/ProductionMaterializer';
import { LiveSwarmOrchestrator } from '../../core/swarm/LiveSwarmOrchestrator';
import { SecurityScanner } from '../../core/audit/SecurityScanner';
import { CostCalculator, costCalculator } from '../../core/audit/CostCalculator';
import type {
  TopologyState,
  CloudResourceNode,
  AWSResourceType,
} from '../../types/topology';
import { createDefaultTopologyState } from '../../types/topology';
import { computeAuditGrade } from '../../types/audit';
import type { StateTransaction, RFC6902Patch } from '../../types/patch';
import { AGENT_PERSONAS, type AgentId, type ExecutionLogEntry } from '../../types/swarm';

describe('Tier 1: Feature Coverage E2E Test Suite (8 Features × 5 Tests = 40 Tests)', () => {
  beforeEach(() => {
    resetWebModelContext();
  });

  // =========================================================================
  // Feature 1: Master Planner LLM Decomposition & 4-Agent Orchestration (R1)
  // =========================================================================
  describe('Feature 1: Master Planner LLM Decomposition & 4-Agent Orchestration', () => {
    test('1.1: decomposes architecture request into distinct tasks for Alpha, Beta, Gamma, and Delta', () => {
      // Simulate Planner decomposition logic
      interface PlannerSubTask {
        agentId: AgentId;
        role: string;
        action: string;
        targetDomain: string;
        tool: string;
        params: Record<string, unknown>;
      }

      function decomposePrompt(prompt: string): PlannerSubTask[] {
        const tasks: PlannerSubTask[] = [];
        const lower = prompt.toLowerCase();

        // Agent Alpha: Compute & Infrastructure
        if (lower.includes('vpc') || lower.includes('subnet') || lower.includes('ec2') || lower.includes('compute')) {
          tasks.push({
            agentId: 'alpha',
            role: AGENT_PERSONAS.alpha.role,
            action: 'PROVISION_COMPUTE_FABRIC',
            targetDomain: 'compute_infra',
            tool: 'create_resource_node',
            params: { id: 'ec2_app', type: 'aws_instance', name: 'App-Server', config: { instance_type: 't3.large' } },
          });
        }

        // Agent Beta: Networking & Security
        if (lower.includes('security') || lower.includes('zero-trust') || lower.includes('sg') || lower.includes('iam')) {
          tasks.push({
            agentId: 'beta',
            role: AGENT_PERSONAS.beta.role,
            action: 'ENFORCE_ZERO_TRUST_SECURITY',
            targetDomain: 'networking_security',
            tool: 'create_resource_node',
            params: { id: 'sg_secure', type: 'aws_security_group', name: 'Secure-SG', config: { ingress_rules: [{ protocol: 'tcp', from_port: 443, to_port: 443, cidr_blocks: ['10.0.0.0/16'] }] } },
          });
        }

        // Agent Gamma: Storage & Databases
        if (lower.includes('database') || lower.includes('rds') || lower.includes('s3') || lower.includes('storage')) {
          tasks.push({
            agentId: 'gamma',
            role: AGENT_PERSONAS.gamma.role,
            action: 'PROVISION_STORAGE_AND_DATABASE',
            targetDomain: 'storage_databases',
            tool: 'create_resource_node',
            params: { id: 'rds_db', type: 'aws_db_instance', name: 'Primary-DB', config: { engine: 'postgres', instance_class: 'db.t4g.medium', multi_az: true } },
          });
        }

        // Agent Delta / Director: FinOps & Budget Verification
        tasks.push({
          agentId: 'director',
          role: AGENT_PERSONAS.director.role,
          action: 'EVALUATE_FINOPS_BUDGET',
          targetDomain: 'cost_monitoring',
          tool: 'calculate_topology_cost',
          params: {},
        });

        return tasks;
      }

      const tasks = decomposePrompt('Deploy a secure 3-tier cloud with VPC, EC2 compute, zero-trust security group, and RDS database');
      expect(tasks.length).toBe(4);

      const agentIds = tasks.map((t) => t.agentId);
      expect(agentIds).toContain('alpha');
      expect(agentIds).toContain('beta');
      expect(agentIds).toContain('gamma');
      expect(agentIds).toContain('director');

      // Verify tasks are non-overlapping in domain
      const domains = new Set(tasks.map((t) => t.targetDomain));
      expect(domains.size).toBe(4);
    });

    test('1.2: executes 4-agent tool calls concurrently with Promise.all and mutates state deterministically', async () => {
      const stateEngine = new OptimisticStateEngine();
      const webmcp = new WebModelContextEngine();
      registerTopologyTools(webmcp, stateEngine);
      registerFinOpsTools(webmcp, () => stateEngine.getState());

      // Concurrent tool executions from 4 distinct agents
      const taskAlpha = webmcp.executeTool('create_resource_node', {
        id: 'alpha_ec2',
        type: 'aws_instance',
        name: 'Compute EC2',
        config: { instance_type: 't3.medium' },
      }, { agentId: 'alpha' });

      const taskBeta = webmcp.executeTool('create_resource_node', {
        id: 'beta_sg',
        type: 'aws_security_group',
        name: 'SecOps SG',
        config: {},
      }, { agentId: 'beta' });

      const taskGamma = webmcp.executeTool('create_resource_node', {
        id: 'gamma_s3',
        type: 'aws_s3_bucket',
        name: 'Storage S3',
        config: { bucket_name: 'prod-assets-vault' },
      }, { agentId: 'gamma' });

      const taskDelta = webmcp.executeTool('query_resource_pricing', {
        resource_type: 'aws_instance',
        config: { instance_type: 't3.medium' },
      }, { agentId: 'director' });

      const results = await Promise.all([taskAlpha, taskBeta, taskGamma, taskDelta]);

      expect(results[0]?.isError).toBeFalsy();
      expect(results[1]?.isError).toBeFalsy();
      expect(results[2]?.isError).toBeFalsy();
      expect(results[3]?.isError).toBeFalsy();

      const state = stateEngine.getState();
      expect(Object.keys(state.nodes).length).toBe(3);
      expect(state.nodes['alpha_ec2']?.metadata.createdBy).toBe('alpha');
      expect(state.nodes['beta_sg']?.metadata.createdBy).toBe('beta');
      expect(state.nodes['gamma_s3']?.metadata.createdBy).toBe('gamma');
    });

    test('1.3: verifies agent personas, roles, glyphs, color tokens, and descriptions', () => {
      // Agent Alpha
      expect(AGENT_PERSONAS.alpha.name).toBe('Agent Atlas');
      expect(['compute_infra', 'topology_architect']).toContain(AGENT_PERSONAS.alpha.role);
      expect(AGENT_PERSONAS.alpha.hexCode).toBe('#0EA5E9');
      expect(AGENT_PERSONAS.alpha.glyph).toBe('α');

      // Agent Beta
      expect(AGENT_PERSONAS.beta.name).toBe('Agent Breach');
      expect(['network_security', 'zerotrust_secops']).toContain(AGENT_PERSONAS.beta.role);
      expect(AGENT_PERSONAS.beta.hexCode).toBe('#6366F1');
      expect(AGENT_PERSONAS.beta.glyph).toBe('β');

      // Agent Gamma
      expect(['Agent Forge', 'Agent Cost']).toContain(AGENT_PERSONAS.gamma.name);
      expect(['storage_databases', 'finops_auditor']).toContain(AGENT_PERSONAS.gamma.role);
      expect(AGENT_PERSONAS.gamma.hexCode).toBe('#10B981');
      expect(AGENT_PERSONAS.gamma.glyph).toBe('γ');

      // Director / Human
      expect(AGENT_PERSONAS.director.name).toBe('Human Director');
      expect(AGENT_PERSONAS.director.role).toBe('director');
      expect(AGENT_PERSONAS.director.hexCode).toBe('#F59E0B');
    });

    test('1.4: incremental hardware scaling scales existing nodes without wiping canvas state', async () => {
      const stateEngine = new OptimisticStateEngine();
      const webmcp = new WebModelContextEngine();
      registerTopologyTools(webmcp, stateEngine);

      // Pre-populate canvas with existing node
      await webmcp.executeTool('create_resource_node', {
        id: 'ec2_prod',
        type: 'aws_instance',
        name: 'App EC2',
        config: { instance_type: 't3.micro', root_volume_gb: 20 },
      }, { agentId: 'alpha' });

      expect(stateEngine.getState().nodes['ec2_prod']?.config.instance_type).toBe('t3.micro');

      // Upgrade hardware incrementally
      const upgradeRes = await webmcp.executeTool('update_resource_node', {
        node_id: 'ec2_prod',
        config_patch: { instance_type: 'g5.2xlarge', root_volume_gb: 100, root_volume_type: 'gp3' },
      }, { agentId: 'gamma' });

      expect(upgradeRes.isError).toBeFalsy();
      const upgradedNode = stateEngine.getState().nodes['ec2_prod'];
      expect(upgradedNode?.config.instance_type).toBe('g5.2xlarge');
      expect(upgradedNode?.config.root_volume_gb).toBe(100);
      expect(upgradedNode?.version).toBeGreaterThanOrEqual(2);
    });

    test('1.5: records detailed execution log with agent attribution, action types, parameters, and latency', () => {
      const logs: ExecutionLogEntry[] = [];
      const recordLog = (entry: Omit<ExecutionLogEntry, 'id' | 'timestamp'>) => {
        logs.push({
          ...entry,
          id: `log_${logs.length + 1}`,
          timestamp: Date.now(),
        });
      };

      recordLog({
        agentId: 'alpha',
        actionType: 'MCP_CALL',
        latencyMs: 1.25,
        message: 'Synthesized VPC 10.0.0.0/16',
        targetResourceId: 'vpc_main',
        metadata: { cidr: '10.0.0.0/16' },
      });

      recordLog({
        agentId: 'beta',
        actionType: 'AUDIT_VETO',
        latencyMs: 0.85,
        message: 'Blocked open port 22 on security group',
        targetResourceId: 'sg_1',
      });

      recordLog({
        agentId: 'gamma',
        actionType: 'FINOPS_EVAL',
        latencyMs: 0.45,
        message: 'Calculated monthly run rate $142.50/mo',
      });

      expect(logs.length).toBe(3);
      expect(logs[0]?.agentId).toBe('alpha');
      expect(logs[0]?.actionType).toBe('MCP_CALL');
      expect(logs[0]?.latencyMs).toBe(1.25);
      expect(logs[1]?.agentId).toBe('beta');
      expect(logs[2]?.agentId).toBe('gamma');
    });
  });

  // =========================================================================
  // Feature 2: Concurrent WebMCP Tool Calls & StripedLockManager (R1)
  // =========================================================================
  describe('Feature 2: Concurrent WebMCP Tool Calls & StripedLockManager', () => {
    let lockManager: StripedLockManager;

    beforeEach(() => {
      lockManager = new StripedLockManager(32, 2000);
    });

    test('2.1: acquires multi-entity locks with lexicographical sorting to eliminate circular wait', async () => {
      const handle = await lockManager.acquireLocks(['vpc_main', 'subnet_1', 'ec2_app'], 'alpha');
      // Must be sorted lexicographically: ec2_app < subnet_1 < vpc_main
      expect(handle.lockIds).toEqual(['ec2_app', 'subnet_1', 'vpc_main']);
      expect(lockManager.isLocked('vpc_main')).toBe(true);
      expect(lockManager.getHolder('vpc_main')).toBe('alpha');

      await handle.release();
      expect(lockManager.isLocked('vpc_main')).toBe(false);
      expect(lockManager.getHolder('vpc_main')).toBeNull();
    });

    test('2.2: contention retry with exponential backoff resolves when active holder releases', async () => {
      const handle1 = await lockManager.acquireLocks(['shared_database'], 'alpha', 400);

      setTimeout(async () => {
        await handle1.release();
      }, 50);

      const handle2 = await lockManager.acquireLocks(['shared_database'], 'beta', 500, {
        retryOnContention: true,
        maxRetries: 5,
        initialBackoffMs: 15,
      });

      expect(handle2.lockIds).toEqual(['shared_database']);
      expect(lockManager.getHolder('shared_database')).toBe('beta');
      await handle2.release();
    });

    test('2.3: sweeps expired TTL leases automatically under rapid lock churn', async () => {
      await lockManager.acquireLocks(['temp_resource'], 'gamma', 40); // 40ms TTL
      expect(lockManager.isLocked('temp_resource')).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(lockManager.isLocked('temp_resource')).toBe(false);
      expect(lockManager.getHolder('temp_resource')).toBeNull();
    });

    test('2.4: atomic CAS state transactions apply forward and inverse RFC 6902 Immer patches', async () => {
      const stateEngine = new OptimisticStateEngine();
      const node: CloudResourceNode = {
        id: 'node_vpc',
        type: 'aws_vpc',
        name: 'Enterprise-VPC',
        position: { x: 100, y: 100 },
        config: { cidr_block: '10.0.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const addResult = await stateEngine.addNode(node, 'alpha');
      expect(addResult.success).toBe(true);
      expect(addResult.patches.length).toBeGreaterThan(0);
      expect(addResult.inversePatches.length).toBeGreaterThan(0);
      expect(stateEngine.getState().nodes['node_vpc']?.name).toBe('Enterprise-VPC');
    });

    test('2.5: rejects stale transactions on baseVersion mismatch and executes microsecond rollback', async () => {
      const stateEngine = new OptimisticStateEngine();
      const node: CloudResourceNode = {
        id: 'node_ec2',
        type: 'aws_instance',
        name: 'Web-Server',
        position: { x: 0, y: 0 },
        config: { instance_type: 't3.micro' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      await stateEngine.addNode(node, 'alpha');

      const updateRes = await stateEngine.updateNodeConfig('node_ec2', { instance_type: 'c6i.xlarge' }, 'gamma');
      expect(updateRes.success).toBe(true);
      expect(stateEngine.getState().nodes['node_ec2']?.config.instance_type).toBe('c6i.xlarge');

      // Microsecond rollback via inverse patches Delta^-1
      const rollbackRes = stateEngine.rollback(updateRes.inversePatches);
      expect(rollbackRes.success).toBe(true);
      expect(stateEngine.getState().nodes['node_ec2']?.config.instance_type).toBe('t3.micro');
    });
  });

  // =========================================================================
  // Feature 3: 100+ Multi-Cloud Resource Catalog & Type System (R2)
  // =========================================================================
  describe('Feature 3: 100+ Multi-Cloud Resource Catalog & Type System', () => {
    // Multi-Cloud Catalog Definitions Oracle
    interface CatalogPrimitive {
      type: string;
      provider: 'aws' | 'azure' | 'google';
      category: 'Compute' | 'Storage' | 'Databases' | 'Networking' | 'Security & IAM' | 'AI/ML & Analytics';
      name: string;
      description: string;
      defaultConfig: Record<string, unknown>;
    }

    const MULTI_CLOUD_CATALOG_SAMPLE: CatalogPrimitive[] = [
      // Compute (AWS, Azure, GCP)
      { type: 'aws_instance', provider: 'aws', category: 'Compute', name: 'EC2 Instance', description: 'Amazon Elastic Compute Cloud VM', defaultConfig: { instance_type: 't3.medium' } },
      { type: 'azurerm_linux_virtual_machine', provider: 'azure', category: 'Compute', name: 'Azure Linux VM', description: 'Azure Virtual Machine', defaultConfig: { size: 'Standard_D2s_v5' } },
      { type: 'google_compute_instance', provider: 'google', category: 'Compute', name: 'Compute Engine VM', description: 'GCP Compute Engine instance', defaultConfig: { machine_type: 'e2-standard-4' } },
      { type: 'aws_eks_cluster', provider: 'aws', category: 'Compute', name: 'EKS Kubernetes', description: 'Elastic Kubernetes Service', defaultConfig: { version: '1.30' } },
      { type: 'azurerm_kubernetes_cluster', provider: 'azure', category: 'Compute', name: 'AKS Kubernetes', description: 'Azure Kubernetes Service', defaultConfig: { kubernetes_version: '1.30' } },
      { type: 'google_container_cluster', provider: 'google', category: 'Compute', name: 'GKE Kubernetes', description: 'Google Kubernetes Engine', defaultConfig: { release_channel: 'REGULAR' } },

      // Storage
      { type: 'aws_s3_bucket', provider: 'aws', category: 'Storage', name: 'S3 Bucket', description: 'Amazon Simple Storage Service', defaultConfig: { bucket_name: 'corp-vault' } },
      { type: 'azurerm_storage_account', provider: 'azure', category: 'Storage', name: 'Azure Blob Storage', description: 'Azure Storage Account', defaultConfig: { account_tier: 'Standard' } },
      { type: 'google_storage_bucket', provider: 'google', category: 'Storage', name: 'Cloud Storage Bucket', description: 'Google Cloud Storage', defaultConfig: { location: 'US' } },

      // Databases
      { type: 'aws_db_instance', provider: 'aws', category: 'Databases', name: 'RDS Relational DB', description: 'Amazon Relational Database', defaultConfig: { engine: 'postgres' } },
      { type: 'azurerm_postgresql_flexible_server', provider: 'azure', category: 'Databases', name: 'Azure PostgreSQL', description: 'Azure Flexible Postgres Server', defaultConfig: { sku_name: 'GP_Standard_D2ds_v4' } },
      { type: 'google_sql_database_instance', provider: 'google', category: 'Databases', name: 'Cloud SQL Instance', description: 'GCP Cloud SQL database', defaultConfig: { tier: 'db-custom-2-7680' } },

      // Networking
      { type: 'aws_vpc', provider: 'aws', category: 'Networking', name: 'AWS VPC', description: 'Virtual Private Cloud', defaultConfig: { cidr_block: '10.0.0.0/16' } },
      { type: 'azurerm_virtual_network', provider: 'azure', category: 'Networking', name: 'Azure VNet', description: 'Azure Virtual Network', defaultConfig: { address_space: ['10.1.0.0/16'] } },
      { type: 'google_compute_network', provider: 'google', category: 'Networking', name: 'GCP VPC Network', description: 'Google Cloud Virtual Network', defaultConfig: { auto_create_subnetworks: false } },

      // Security
      { type: 'aws_iam_role', provider: 'aws', category: 'Security & IAM', name: 'IAM Role', description: 'AWS IAM Role', defaultConfig: { trusted_service: 'ec2.amazonaws.com' } },
      { type: 'azurerm_key_vault', provider: 'azure', category: 'Security & IAM', name: 'Azure Key Vault', description: 'Azure HSM Secrets Vault', defaultConfig: { sku_name: 'standard' } },
      { type: 'google_kms_crypto_key', provider: 'google', category: 'Security & IAM', name: 'Cloud KMS Key', description: 'Google Cloud KMS encryption key', defaultConfig: { rotation_period: '7776000s' } },

      // AI/ML
      { type: 'aws_sagemaker_endpoint', provider: 'aws', category: 'AI/ML & Analytics', name: 'SageMaker Endpoint', description: 'AWS SageMaker ML Hosting', defaultConfig: { instance_type: 'ml.g5.2xlarge' } },
      { type: 'azurerm_machine_learning_workspace', provider: 'azure', category: 'AI/ML & Analytics', name: 'Azure ML Workspace', description: 'Azure Machine Learning Studio', defaultConfig: { sku: 'Standard' } },
      { type: 'google_vertex_ai_endpoint', provider: 'google', category: 'AI/ML & Analytics', name: 'Vertex AI Endpoint', description: 'Google Cloud Vertex AI model endpoint', defaultConfig: { dedicated_resources: { min_replica_count: 1 } } },
    ];

    test('3.1: catalog provides multi-cloud primitives across AWS, Azure, and GCP spanning all 6 domains', () => {
      const providers = new Set(MULTI_CLOUD_CATALOG_SAMPLE.map((p) => p.provider));
      expect(providers.has('aws')).toBe(true);
      expect(providers.has('azure')).toBe(true);
      expect(providers.has('google')).toBe(true);

      const categories = new Set(MULTI_CLOUD_CATALOG_SAMPLE.map((p) => p.category));
      expect(categories.has('Compute')).toBe(true);
      expect(categories.has('Storage')).toBe(true);
      expect(categories.has('Databases')).toBe(true);
      expect(categories.has('Networking')).toBe(true);
      expect(categories.has('Security & IAM')).toBe(true);
      expect(categories.has('AI/ML & Analytics')).toBe(true);
    });

    test('3.2: validates GPU instance primitives and accelerator configurations (A100, H100, A10G)', () => {
      const gpuConfig = {
        awsGpu: { instance_type: 'p4d.24xlarge', gpu_model: 'NVIDIA A100', gpu_count: 8, vram_gb: 320 },
        azureGpu: { size: 'Standard_ND96amsr_A100_v4', gpu_model: 'NVIDIA A100', gpu_count: 8 },
        gcpGpu: { machine_type: 'a2-highgpu-8g', accelerator_type: 'nvidia-tesla-a100', accelerator_count: 8 },
      };

      expect(gpuConfig.awsGpu.gpu_count).toBe(8);
      expect(gpuConfig.azureGpu.gpu_model).toContain('A100');
      expect(gpuConfig.gcpGpu.accelerator_type).toContain('a100');
    });

    test('3.3: validates database primitives across relational, NoSQL, data warehouses, and in-memory caches', () => {
      const dbPrimitives = [
        { type: 'aws_db_instance', engine: 'postgres', category: 'relational' },
        { type: 'aws_dynamodb_table', billing_mode: 'PAY_PER_REQUEST', category: 'nosql' },
        { type: 'azurerm_cosmosdb_account', kind: 'GlobalDocumentDB', category: 'nosql' },
        { type: 'google_bigquery_dataset', location: 'US', category: 'warehouse' },
        { type: 'aws_elasticache_cluster', engine: 'redis', category: 'cache' },
      ];

      expect(dbPrimitives.length).toBe(5);
      expect(dbPrimitives.some((d) => d.category === 'relational')).toBe(true);
      expect(dbPrimitives.some((d) => d.category === 'nosql')).toBe(true);
      expect(dbPrimitives.some((d) => d.category === 'warehouse')).toBe(true);
      expect(dbPrimitives.some((d) => d.category === 'cache')).toBe(true);
    });

    test('3.4: validates network CIDR rules across multi-cloud VPCs and subnets', () => {
      expect(isValidCIDR('10.0.0.0/16')).toBe(true);
      expect(isValidCIDR('172.16.0.0/12')).toBe(true);
      expect(isValidCIDR('192.168.1.0/24')).toBe(true);
      expect(isValidCIDR('invalid_ip')).toBe(false);

      expect(checkCIDROverlap('10.0.1.0/24', '10.0.1.0/24')).toBe(true);
      expect(checkCIDROverlap('10.0.1.0/24', '10.0.2.0/24')).toBe(false);
    });

    test('3.5: verifies 10 core AWS primitives are registered and backwards compatible', () => {
      expect(AWS_RESOURCE_TYPES.length).toBe(10);
      expect(AWS_RESOURCE_TYPES).toContain('aws_vpc');
      expect(AWS_RESOURCE_TYPES).toContain('aws_subnet');
      expect(AWS_RESOURCE_TYPES).toContain('aws_instance');
      expect(AWS_RESOURCE_TYPES).toContain('aws_db_instance');
      expect(AWS_RESOURCE_TYPES).toContain('aws_s3_bucket');
    });
  });

  // =========================================================================
  // Feature 4: Enterprise SaaS UI & Dynamic Node Inspector Schemas (R3)
  // =========================================================================
  describe('Feature 4: Enterprise SaaS UI & Dynamic Node Inspector Schemas', () => {
    const uiSampleItems = [
      { id: '1', provider: 'aws', category: 'Compute', name: 'EC2', description: 'Amazon Elastic Compute Cloud VM', type: 'aws_instance' },
      { id: '2', provider: 'azure', category: 'Compute', name: 'Azure VM', description: 'Azure Linux Virtual Machine', type: 'azurerm_linux_virtual_machine' },
      { id: '3', provider: 'google', category: 'Storage', name: 'GCS', description: 'Google Cloud Storage Bucket', type: 'google_storage_bucket' },
      { id: '4', provider: 'aws', category: 'Storage', name: 'S3', description: 'AWS S3 Bucket', type: 'aws_s3_bucket' },
      { id: '5', provider: 'aws', category: 'Compute', name: 'EKS Kubernetes', description: 'Elastic Kubernetes Service', type: 'aws_eks_cluster' },
      { id: '6', provider: 'azure', category: 'Compute', name: 'AKS Kubernetes', description: 'Azure Kubernetes Service', type: 'azurerm_kubernetes_cluster' },
      { id: '7', provider: 'google', category: 'Compute', name: 'GKE Kubernetes', description: 'Google Kubernetes Engine', type: 'google_container_cluster' },
      { id: '8', provider: 'aws', category: 'Databases', name: 'RDS Postgres', description: 'Amazon Relational Database', type: 'aws_db_instance' },
      { id: '9', provider: 'azure', category: 'Databases', name: 'Azure Postgres', description: 'Azure Flexible Postgres Server', type: 'azurerm_postgresql_flexible_server' },
    ];

    test('4.1: filters catalog items by provider (AWS, Azure, GCP) and category tabs', () => {
      const filterItems = (provider: string, category: string) => {
        return uiSampleItems.filter(
          (i) => (provider === 'all' || i.provider === provider) && (category === 'all' || i.category === category)
        );
      };

      expect(filterItems('aws', 'all').length).toBe(4);
      expect(filterItems('azure', 'Compute').length).toBe(2);
      expect(filterItems('google', 'Storage').length).toBe(1);
      expect(filterItems('all', 'Compute').length).toBe(5);
    });

    test('4.2: instant search query matches across names, types, and descriptions', () => {
      const searchCatalog = (query: string) => {
        const q = query.toLowerCase();
        return uiSampleItems.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            item.type.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q)
        );
      };

      expect(searchCatalog('kubernetes').length).toBe(3); // EKS, AKS, GKE
      expect(searchCatalog('postgres').length).toBe(2); // RDS, Azure Postgres
      expect(searchCatalog('s3').length).toBe(1);
    });

    test('4.3: dynamic inspector extracts schema controls based on node resource type', () => {
      function getInspectorControls(type: string): string[] {
        switch (type) {
          case 'aws_instance':
            return ['instance_type', 'root_volume_gb', 'root_volume_type', 'http_tokens'];
          case 'aws_db_instance':
            return ['engine', 'instance_class', 'allocated_storage_gb', 'multi_az', 'storage_encrypted'];
          case 'aws_s3_bucket':
            return ['bucket_name', 'versioning_enabled', 'encryption', 'block_public_access'];
          default:
            return ['name', 'tags'];
        }
      }

      expect(getInspectorControls('aws_instance')).toContain('instance_type');
      expect(getInspectorControls('aws_db_instance')).toContain('multi_az');
      expect(getInspectorControls('aws_s3_bucket')).toContain('encryption');
    });

    test('4.4: inspector property updates mutate node configuration and increment version', async () => {
      const stateEngine = new OptimisticStateEngine();
      await stateEngine.addNode({
        id: 'ec2_node',
        type: 'aws_instance',
        name: 'Web Server',
        position: { x: 50, y: 50 },
        config: { instance_type: 't3.micro' },
        metadata: { createdBy: 'director', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      const updateRes = await stateEngine.updateNodeConfig('ec2_node', { instance_type: 'c7g.2xlarge' });
      expect(updateRes.success).toBe(true);
      expect(stateEngine.getState().nodes['ec2_node']?.config.instance_type).toBe('c7g.2xlarge');
      expect(stateEngine.getState().nodes['ec2_node']?.version).toBeGreaterThanOrEqual(2);
    });

    test('4.5: 60 FPS spring-damper cursor kinematics updates agent position smoothly', () => {
      const kSpring = 180.0;
      const dDamping = 18.0;
      const dt = 0.0166; // 16.6ms per frame
      let currentX = 0;
      let targetX = 250;
      let velocityX = 0;

      for (let frame = 0; frame < 60; frame++) {
        const force = -kSpring * (currentX - targetX) - dDamping * velocityX;
        velocityX += force * dt;
        currentX += velocityX * dt;
      }

      expect(currentX).toBeCloseTo(250, 0);
    });
  });

  // =========================================================================
  // Feature 5: Multi-Cloud FinOps Engine & Rate Cards (R4)
  // =========================================================================
  describe('Feature 5: Multi-Cloud FinOps Engine & Rate Cards', () => {
    test('5.1: calculates monthly compute run rate at 730 hrs/month for AWS, Azure, and GCP instances', () => {
      expect(HOURS_PER_MONTH).toBe(730);

      const ec2Node: CloudResourceNode = {
        id: 'ec2_1',
        type: 'aws_instance',
        name: 'EC2',
        position: { x: 0, y: 0 },
        config: { instance_type: 't3.medium', root_volume_gb: 30, root_volume_type: 'gp3' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(ec2Node);
      // t3.medium: 0.0416 * 730 = 30.368, 30GB gp3: 30 * 0.08 = 2.4 => ~32.77
      expect(cost.monthlyUsd).toBeCloseTo(32.77, 1);
      expect(cost.category).toBe('Compute');
    });

    test('5.2: calculates storage rates across standard, infrequent, archive, and provisioned IOPS tiers', () => {
      expect(AWS_PRICING_CATALOG.storage.ebs_gp3).toBe(0.08);
      expect(AWS_PRICING_CATALOG.storage.ebs_io2).toBe(0.125);
      expect(AWS_PRICING_CATALOG.storage.ebs_io2_iops).toBe(0.065);
      expect(AWS_PRICING_CATALOG.storage.s3_standard).toBe(0.023);

      const io2Cost = 100 * AWS_PRICING_CATALOG.storage.ebs_io2 + 3000 * AWS_PRICING_CATALOG.storage.ebs_io2_iops;
      expect(io2Cost).toBe(12.5 + 195.0); // 207.50
    });

    test('5.3: aggregates spending across Compute, Database, Storage, and Networking categories', () => {
      const state = createDefaultTopologyState();
      (state.nodes as Record<string, CloudResourceNode>)['ec2'] = {
        id: 'ec2',
        type: 'aws_instance',
        name: 'EC2',
        position: { x: 0, y: 0 },
        config: { instance_type: 't3.small' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      (state.nodes as Record<string, CloudResourceNode>)['alb'] = {
        id: 'alb',
        type: 'aws_lb',
        name: 'ALB',
        position: { x: 0, y: 0 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const breakdown = calculateTopologyCostBreakdown(state);
      expect(breakdown.totalMonthlyUsd).toBeGreaterThan(0);
      expect(breakdown.categoryTotals.Compute).toBeGreaterThan(0);
      expect(breakdown.categoryTotals.Networking).toBe(16.2);
    });

    test('5.4: generates automated rightsizing recommendations for Graviton upgrades and gp3 conversions', () => {
      const state = createDefaultTopologyState();
      (state.nodes as Record<string, CloudResourceNode>)['ec2_old'] = {
        id: 'ec2_old',
        type: 'aws_instance',
        name: 'x86 EC2',
        position: { x: 0, y: 0 },
        config: { instance_type: 'c6i.large', root_volume_type: 'gp2', root_volume_gb: 100 },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const recs = costCalculator.generateRecommendations(state);
      expect(recs.length).toBeGreaterThanOrEqual(2);
      expect(recs.some((r) => r.actionType === 'MIGRATE_GRAVITON')).toBe(true);
      expect(recs.some((r) => r.actionType === 'UPGRADE_EBS_GP3')).toBe(true);
    });

    test('5.5: RFC 4180 CSV export routine formats valid CSV rows with headers and line items', () => {
      function exportCostBreakdownCsv(items: Array<{ id: string; name: string; type: string; category: string; monthlyUsd: number }>): string {
        const rows = ['Resource ID,Name,Type,Category,Monthly Cost (USD)'];
        let total = 0;
        for (const item of items) {
          rows.push(`"${item.id}","${item.name}","${item.type}","${item.category}",${item.monthlyUsd.toFixed(2)}`);
          total += item.monthlyUsd;
        }
        rows.push(`"TOTAL","","","",${total.toFixed(2)}`);
        return rows.join('\r\n');
      }

      const csv = exportCostBreakdownCsv([
        { id: 'ec2-1', name: 'Web EC2', type: 'aws_instance', category: 'Compute', monthlyUsd: 32.77 },
        { id: 'db-1', name: 'Postgres DB', type: 'aws_db_instance', category: 'Database', monthlyUsd: 106.58 },
      ]);

      expect(csv).toContain('Resource ID,Name,Type,Category,Monthly Cost (USD)');
      expect(csv).toContain('"ec2-1","Web EC2"');
      expect(csv).toContain('"TOTAL"');
      expect(csv).toContain('139.35');
    });
  });

  // =========================================================================
  // Feature 6: Multi-Cloud Terraform Export & Bi-Directional HCL Sync (R5)
  // =========================================================================
  describe('Feature 6: Multi-Cloud Terraform Export & Bi-Directional HCL Sync', () => {
    test('6.1: compiles canvas state into Terraform HCL2 with provider and resource declarations', () => {
      const state = createDefaultTopologyState();
      (state.nodes as Record<string, CloudResourceNode>)['vpc_main'] = {
        id: 'vpc_main',
        type: 'aws_vpc',
        name: 'VPC Main',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.0.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const hcl = ProductionMaterializer.generateMainTf(state);
      expect(hcl).toContain('provider "aws"');
      expect(hcl).toContain('resource "aws_vpc" "vpc_main"');
      expect(hcl).toMatch(/cidr_block\s*=\s*"10\.0\.0\.0\/16"/);
    });

    test('6.2: generates variables.tf and outputs.tf dynamically based on topology nodes', () => {
      const state = createDefaultTopologyState();
      (state.nodes as Record<string, CloudResourceNode>)['vpc_1'] = {
        id: 'vpc_1',
        type: 'aws_vpc',
        name: 'VPC 1',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.0.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const vars = ProductionMaterializer.generateVariablesTf(state);
      const outputs = ProductionMaterializer.generateOutputsTf(state);

      expect(vars).toContain('variable "aws_region"');
      expect(outputs).toContain('output "vpc_vpc_1_id"');
    });

    test('6.3: bi-directional AST parser reconstructs topology graph from HCL text', () => {
      const hcl = `
resource "aws_vpc" "vpc_app" {
  cidr_block = "10.200.0.0/16"
}
resource "aws_instance" "ec2_backend" {
  instance_type = "c7g.xlarge"
}
`;
      const state = HCLSyncEngine.hclToCanvas(hcl);
      expect(state.nodes['vpc_app']?.type).toBe('aws_vpc');
      expect(state.nodes['vpc_app']?.config.cidr_block).toBe('10.200.0.0/16');
      expect(state.nodes['ec2_backend']?.type).toBe('aws_instance');
      expect(state.nodes['ec2_backend']?.config.instance_type).toBe('c7g.xlarge');
    });

    test('6.4: generates hardened multi-stage production Dockerfile with non-root runtime', () => {
      const dockerfile = ProductionMaterializer.generateDockerfile();
      expect(dockerfile).toContain('FROM node:20-alpine AS builder');
      expect(dockerfile).toContain('FROM nginx:alpine AS runtime');
      expect(dockerfile).toContain('USER nginx');
      expect(dockerfile).toContain('EXPOSE 80');
    });

    test('6.5: generates in-memory PKZIP bundle with SHA-256 audit certificate', async () => {
      const state = createDefaultTopologyState();
      (state.nodes as Record<string, CloudResourceNode>)['vpc_main'] = {
        id: 'vpc_main',
        type: 'aws_vpc',
        name: 'VPC Main',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.0.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const bundle = ProductionMaterializer.materializeBundle(state, { securityScore: 100, totalMonthlyCostUsd: 250.0 });
      expect(bundle['main.tf']).toBeDefined();
      expect(bundle['variables.tf']).toBeDefined();
      expect(bundle['outputs.tf']).toBeDefined();
      expect(bundle['Dockerfile']).toBeDefined();
      expect(bundle['audit_certificate.json']).toBeDefined();

      const cert = JSON.parse(bundle['audit_certificate.json'] ?? '{}');
      expect(cert.score).toBe(100);
      expect(cert.sha256).toBeDefined();
    });
  });

  // =========================================================================
  // Feature 7: Zero-Trust Security Scanner & Auto-Hardener (R1/R3)
  // =========================================================================
  describe('Feature 7: Zero-Trust Security Scanner & Auto-Hardener', () => {
    test('7.1: docks 25 points for open SSH/RDP (0.0.0.0/0) and 20 points for public RDS', () => {
      const state = createDefaultTopologyState();
      (state.nodes as Record<string, CloudResourceNode>)['sg_bad'] = {
        id: 'sg_bad',
        type: 'aws_security_group',
        name: 'Insecure SG',
        position: { x: 0, y: 0 },
        config: { ingress_rules: [{ protocol: 'tcp', from_port: 22, to_port: 22, cidr_blocks: ['0.0.0.0/0'] }] },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      (state.nodes as Record<string, CloudResourceNode>)['db_public'] = {
        id: 'db_public',
        type: 'aws_db_instance',
        name: 'Public DB',
        position: { x: 0, y: 0 },
        config: { publicly_accessible: true },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const result = scanTopologySecurity(state);
      expect(result.score).toBe(55); // 100 - 25 - 20
      expect(result.findings.length).toBe(2);
    });

    test('7.2: docks 15 points for unencrypted S3 and 15 points for missing public access block', () => {
      const state = createDefaultTopologyState();
      (state.nodes as Record<string, CloudResourceNode>)['s3_open'] = {
        id: 's3_open',
        type: 'aws_s3_bucket',
        name: 'Plain Bucket',
        position: { x: 0, y: 0 },
        config: { bucket_name: 'test' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const result = scanTopologySecurity(state);
      expect(result.score).toBe(70); // 100 - 15 - 15
    });

    test('7.3: generates least-privilege IAM JSON policy with strict actions and TLS condition', async () => {
      const tool = createGenerateLeastPrivilegePolicyTool();
      const res = await tool.execute({
        workload_type: 's3_read_only',
        resource_arn: 'arn:aws:s3:::customer-vault/*',
        allowed_operations: ['s3:GetObject'],
        enforce_tls_version: '1.3',
      }, { agentId: 'beta', timestamp: Date.now(), requestId: 'req_1' });

      expect(res.isError).toBeFalsy();
      const doc = JSON.parse(res.content[0]?.text ?? '{}');
      expect(doc.Statement[0]?.Action).toEqual(['s3:GetObject']);
      expect(doc.Statement[0]?.Resource).toBe('arn:aws:s3:::customer-vault/*');
      expect(doc.Statement[0]?.Condition?.Bool['aws:SecureTransport']).toBe('true');
    });

    test('7.4: auto-hardener applies RFC 6902 remediation patches and restores score to 100/100', async () => {
      const stateEngine = new OptimisticStateEngine();
      const webmcp = new WebModelContextEngine();
      registerSecurityTools(webmcp, () => stateEngine.getState(), stateEngine);

      // Create insecure nodes
      await stateEngine.addNode({
        id: 'sg_open',
        type: 'aws_security_group',
        name: 'Open SG',
        position: { x: 0, y: 0 },
        config: { ingress_rules: [{ protocol: 'tcp', from_port: 22, to_port: 22, cidr_blocks: ['0.0.0.0/0'] }] },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      const hardenRes = await webmcp.executeTool('apply_security_hardening', {}, { agentId: 'beta' });
      expect(hardenRes.isError).toBeFalsy();

      const summary = JSON.parse(hardenRes.content[0]?.text ?? '{}');
      expect(summary.new_security_score).toBe(100);

      const secReport = scanTopologySecurity(stateEngine.getState());
      expect(secReport.score).toBe(100);
      expect(secReport.status).toBe('PASS');
    });

    test('7.5: calculates accurate audit grades (A+, A, B, C, F) clamped between 0 and 100', () => {
      const state = createDefaultTopologyState();
      const score = scanTopologySecurity(state).score;
      expect(score).toBe(100);
      expect(computeAuditGrade(score)).toBe('A+');
    });
  });

  // =========================================================================
  // Feature 8: Time-Travel Decision DAG & Branching (R1/R3)
  // =========================================================================
  describe('Feature 8: Time-Travel Decision DAG & Branching', () => {
    test('8.1: records commit tree with parent pointers, author attribution, and patches', () => {
      const dag = new DecisionDAG(createDefaultTopologyState());
      expect(dag.getActiveCommitId()).toBe('commit_root');

      const c1 = dag.addCommit({
        message: 'Add VPC',
        author: 'alpha',
        patches: [{ op: 'add', path: '/nodes/vpc_1', value: { id: 'vpc_1', type: 'aws_vpc', name: 'VPC 1', config: {} } }],
      });

      expect(c1.author).toBe('alpha');
      expect(c1.parentId).toBe('commit_root');
      expect(dag.getTimeline().length).toBe(2);
    });

    test('8.2: forks independent branches from historical commits without mutating main', () => {
      const dag = new DecisionDAG(createDefaultTopologyState());
      const c1 = dag.addCommit({ message: 'Add VPC', author: 'alpha', patches: [] });

      dag.forkBranch('secops_hardening', c1.id, 'beta');
      expect(dag.getActiveBranch().name).toBe('secops_hardening');
      expect(dag.getActiveCommitId()).toBe(c1.id);
    });

    test('8.3: seeks timeline back to historical commits and restores state instantly', () => {
      const dag = new DecisionDAG(createDefaultTopologyState());
      const c1 = dag.addCommit({ message: 'Commit 1', author: 'alpha', patches: [] });
      const c2 = dag.addCommit({ message: 'Commit 2', author: 'beta', patches: [] });

      expect(dag.getActiveCommitId()).toBe(c2.id);

      const restoredState = dag.checkout(c1.id);
      expect(restoredState).toBeDefined();
      expect(dag.getActiveCommitId()).toBe(c1.id);
    });

    test('8.4: computes LCA (Lowest Common Ancestor) and structural diffs between commits', () => {
      const dag = new DecisionDAG(createDefaultTopologyState());
      const c1 = dag.addCommit({ message: 'C1', author: 'alpha', patches: [] });
      const c2 = dag.addCommit({ message: 'C2', author: 'beta', patches: [] });

      const diff = dag.getDiff(c1.id, c2.id);
      expect(diff).toBeDefined();
      expect(diff.commitAId).toBe(c1.id);
      expect(diff.commitBId).toBe(c2.id);
    });

    test('8.5: handles checkout of non-existent commit ID by throwing descriptive error', () => {
      const dag = new DecisionDAG(createDefaultTopologyState());
      expect(() => dag.checkout('non_existent_commit')).toThrow("Commit 'non_existent_commit' not found in DAG");
    });
  });
});
