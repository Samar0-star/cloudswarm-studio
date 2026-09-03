/**
 * Unit Tests for Multi-Cloud Resource Catalog (108 Primitives) & Multi-Cloud WebMCP Tools
 */

import {
  CLOUD_RESOURCE_CATALOG,
  getResourceSchema,
  getResourceCatalogItem,
  getCatalogItemsByProvider,
  getCatalogItemsByCategory,
  searchCatalogItems,
  validateResourceConfig,
  getAllResourceTypes,
  getProviderForResourceType,
  getCategoryForResourceType,
  getTotalPrimitiveCount,
} from '../core/catalog/resourceCatalog';
import type {
  CloudProvider,
  ResourceCategory,
  CloudResourceNode,
  TopologyState,
} from '../types/topology';
import { createDefaultTopologyState } from '../types/topology';
import { WebModelContextEngine } from '../core/webmcp/WebModelContextEngine';
import { OptimisticStateEngine } from '../core/state/OptimisticStateEngine';
import {
  registerTopologyTools,
  ALL_CLOUD_RESOURCE_TYPES,
  AWS_RESOURCE_TYPES,
} from '../core/webmcp/tools/topologyTools';
import {
  registerSecurityTools,
  scanTopologySecurity,
} from '../core/webmcp/tools/securityTools';
import {
  registerFinOpsTools,
  calculateNodeCost,
  calculateTopologyCostBreakdown,
  generateCostRecommendations,
} from '../core/webmcp/tools/finopsTools';

describe('Resource Catalog (108 Multi-Cloud Primitives) Test Suite', () => {
  describe('Catalog Volume & Primitive Integrity', () => {
    test('contains exactly 108 total cloud primitives', () => {
      expect(CLOUD_RESOURCE_CATALOG.length).toBe(108);
      expect(getTotalPrimitiveCount()).toBe(108);
      expect(getAllResourceTypes().length).toBe(108);
    });

    test('contains unique primitive types with zero duplicates', () => {
      const typeSet = new Set<string>();
      for (const item of CLOUD_RESOURCE_CATALOG) {
        expect(typeSet.has(item.type)).toBe(false);
        typeSet.add(item.type);
      }
      expect(typeSet.size).toBe(108);
    });

    test('distributes exactly 36 primitives per provider (AWS, Azure, GCP)', () => {
      const awsItems = getCatalogItemsByProvider('aws');
      const azureItems = getCatalogItemsByProvider('azure');
      const gcpItems = getCatalogItemsByProvider('google');

      expect(awsItems.length).toBe(36);
      expect(azureItems.length).toBe(36);
      expect(gcpItems.length).toBe(36);
    });

    test('distributes primitives across all 6 primary architectural domains', () => {
      const computeItems = getCatalogItemsByCategory('Compute');
      const storageItems = getCatalogItemsByCategory('Storage');
      const databaseItems = getCatalogItemsByCategory('Database');
      const networkItems = getCatalogItemsByCategory('Network');
      const securityItems = getCatalogItemsByCategory('Security');
      const aimlItems = getCatalogItemsByCategory('AI/ML');

      // 24 Compute = 8 AWS + 8 Azure + 8 GCP
      expect(computeItems.length).toBe(24);
      // 18 Storage = 6 AWS + 6 Azure + 6 GCP
      expect(storageItems.length).toBe(18);
      // 21 Database = 7 AWS + 7 Azure + 7 GCP
      expect(databaseItems.length).toBe(21);
      // 21 Network = 7 AWS + 7 Azure + 7 GCP
      expect(networkItems.length).toBe(21);
      // 15 Security = 5 AWS + 5 Azure + 5 GCP
      expect(securityItems.length).toBe(15);
      // 9 AI/ML = 3 AWS + 3 Azure + 3 GCP
      expect(aimlItems.length).toBe(9);

      // Total sum = 108
      expect(
        computeItems.length +
          storageItems.length +
          databaseItems.length +
          networkItems.length +
          securityItems.length +
          aimlItems.length
      ).toBe(108);
    });
  });

  describe('Primitive Schema Completeness & Pricing Rules', () => {
    test('every primitive has name, description, iconName, valid defaultConfig, pricingModel, and validationRules', () => {
      const validProviders: CloudProvider[] = ['aws', 'azure', 'google'];
      const validCategories: ResourceCategory[] = ['Compute', 'Storage', 'Database', 'Network', 'Security', 'AI/ML'];

      for (const item of CLOUD_RESOURCE_CATALOG) {
        expect(typeof item.type).toBe('string');
        expect(item.type.length).toBeGreaterThan(0);

        expect(validProviders).toContain(item.provider);
        expect(validCategories).toContain(item.category);

        expect(typeof item.name).toBe('string');
        expect(item.name.length).toBeGreaterThan(0);

        expect(typeof item.description).toBe('string');
        expect(item.description.length).toBeGreaterThan(10);

        expect(typeof item.iconName).toBe('string');
        expect(item.iconName.length).toBeGreaterThan(0);

        expect(typeof item.defaultConfig).toBe('object');
        expect(item.defaultConfig).not.toBeNull();

        expect(typeof item.pricingModel).toBe('object');
        expect(item.pricingModel.baseMonthlyRate).toBeGreaterThanOrEqual(0);

        expect(Array.isArray(item.validationRules)).toBe(true);
      }
    });

    test('validates GPU accelerators are present across AWS, Azure, and GCP', () => {
      const awsGpu = getResourceSchema('aws_instance_gpu');
      const azureGpu = getResourceSchema('azurerm_virtual_machine_gpu');
      const gcpGpu = getResourceSchema('google_compute_instance_gpu');

      expect(awsGpu).toBeDefined();
      expect(awsGpu?.pricingModel.baseMonthlyRate).toBeGreaterThan(500);

      expect(azureGpu).toBeDefined();
      expect(azureGpu?.pricingModel.baseMonthlyRate).toBeGreaterThan(500);

      expect(gcpGpu).toBeDefined();
      expect(gcpGpu?.pricingModel.baseMonthlyRate).toBeGreaterThan(500);
    });

    test('validates Kubernetes primitives across AWS (EKS), Azure (AKS), and GCP (GKE)', () => {
      const eks = getResourceSchema('aws_eks_cluster');
      const aks = getResourceSchema('azurerm_kubernetes_cluster');
      const gke = getResourceSchema('google_container_cluster');

      expect(eks?.category).toBe('Compute');
      expect(aks?.category).toBe('Compute');
      expect(gke?.category).toBe('Compute');

      expect(eks?.provider).toBe('aws');
      expect(aks?.provider).toBe('azure');
      expect(gke?.provider).toBe('google');
    });

    test('validates Serverless primitives across AWS (Lambda), Azure (Functions), and GCP (Cloud Functions / Cloud Run)', () => {
      const lambda = getResourceSchema('aws_lambda_function');
      const azureFunc = getResourceSchema('azurerm_linux_function_app');
      const gcpFunc = getResourceSchema('google_cloudfunctions_function');
      const cloudRun = getResourceSchema('google_cloud_run_service');

      expect(lambda).toBeDefined();
      expect(azureFunc).toBeDefined();
      expect(gcpFunc).toBeDefined();
      expect(cloudRun).toBeDefined();
    });
  });

  describe('Catalog Helper & Search Engine Functions', () => {
    test('getResourceSchema and getResourceCatalogItem retrieve items by exact type', () => {
      const s3 = getResourceSchema('aws_s3_bucket');
      expect(s3?.name).toContain('S3');

      const blob = getResourceCatalogItem('azurerm_storage_account');
      expect(blob?.name).toContain('Storage Account');

      const gcs = getResourceSchema('google_storage_bucket');
      expect(gcs?.name).toContain('Google Cloud Storage');

      expect(getResourceSchema('non_existent_primitive')).toBeUndefined();
    });

    test('getProviderForResourceType and getCategoryForResourceType return correct metadata', () => {
      expect(getProviderForResourceType('aws_instance')).toBe('aws');
      expect(getProviderForResourceType('azurerm_linux_virtual_machine')).toBe('azure');
      expect(getProviderForResourceType('google_compute_instance')).toBe('google');

      expect(getCategoryForResourceType('aws_db_instance')).toBe('Database');
      expect(getCategoryForResourceType('azurerm_virtual_network')).toBe('Network');
      expect(getCategoryForResourceType('google_kms_crypto_key')).toBe('Security');
      expect(getCategoryForResourceType('aws_sagemaker_endpoint')).toBe('AI/ML');
    });

    test('searchCatalogItems filters by text query across name, type, description, and tags', () => {
      const redisResults = searchCatalogItems('redis');
      expect(redisResults.length).toBe(3); // ElastiCache Redis, Azure Redis, GCP Memorystore Redis

      const postgresResults = searchCatalogItems('postgres');
      expect(postgresResults.length).toBeGreaterThanOrEqual(3);

      const awsCompute = searchCatalogItems('', 'aws', 'Compute');
      expect(awsCompute.length).toBe(8);

      const azureStorage = searchCatalogItems('', 'azure', 'Storage');
      expect(azureStorage.length).toBe(6);

      const gcpSecurity = searchCatalogItems('', 'google', 'Security');
      expect(gcpSecurity.length).toBe(5);
    });

    test('validateResourceConfig correctly validates required fields and CIDR rules', () => {
      // Missing required field
      const invalidEc2 = validateResourceConfig('aws_instance', { root_volume_gb: 30 });
      expect(invalidEc2.valid).toBe(false);
      expect(invalidEc2.errors.length).toBeGreaterThan(0);

      // Valid EC2
      const validEc2 = validateResourceConfig('aws_instance', { instance_type: 't3.medium', root_volume_gb: 30 });
      expect(validEc2.valid).toBe(true);

      // CIDR validation on VPC
      const invalidVpc = validateResourceConfig('aws_vpc', { cidr_block: 'not-a-cidr' });
      expect(invalidVpc.valid).toBe(false);

      const validVpc = validateResourceConfig('aws_vpc', { cidr_block: '10.0.0.0/16' });
      expect(validVpc.valid).toBe(true);
    });
  });

  describe('Multi-Cloud WebMCP Tools Integration', () => {
    let mcpEngine: WebModelContextEngine;
    let stateEngine: OptimisticStateEngine;

    beforeEach(() => {
      mcpEngine = new WebModelContextEngine(false);
      stateEngine = new OptimisticStateEngine();
      registerTopologyTools(mcpEngine, stateEngine);
      registerSecurityTools(mcpEngine, () => stateEngine.getState(), stateEngine);
      registerFinOpsTools(mcpEngine, () => stateEngine.getState());
    });

    test('ALL_CLOUD_RESOURCE_TYPES contains all 108 primitives and AWS_RESOURCE_TYPES contains core 10', () => {
      expect(ALL_CLOUD_RESOURCE_TYPES.length).toBe(108);
      expect(AWS_RESOURCE_TYPES.length).toBe(10);
    });

    test('create_resource_node provisions Azure and GCP primitives successfully', async () => {
      // 1. Create Azure VM
      const azureVmRes = await mcpEngine.executeTool(
        'create_resource_node',
        {
          id: 'azure-vm-01',
          type: 'azurerm_linux_virtual_machine',
          name: 'Azure Web VM',
          config: { vm_size: 'Standard_D4s_v5', location: 'eastus' },
        },
        { agentId: 'alpha' }
      );
      expect(azureVmRes.isError).toBeUndefined();
      expect(stateEngine.getState().nodes['azure-vm-01']).toBeDefined();
      expect(stateEngine.getState().nodes['azure-vm-01']?.type).toBe('azurerm_linux_virtual_machine');

      // 2. Create GCP GKE Cluster
      const gkeRes = await mcpEngine.executeTool(
        'create_resource_node',
        {
          id: 'gcp-gke-01',
          type: 'google_container_cluster',
          name: 'GCP GKE Production',
          config: { cluster_name: 'prod-gke', location: 'us-central1' },
        },
        { agentId: 'alpha' }
      );
      expect(gkeRes.isError).toBeUndefined();
      expect(stateEngine.getState().nodes['gcp-gke-01']).toBeDefined();
      expect(stateEngine.getState().nodes['gcp-gke-01']?.type).toBe('google_container_cluster');
    });

    test('query_resource_pricing calculates rates for Azure and GCP primitives', async () => {
      // Azure VM Standard_D4s_v5 ($0.192 * 730 = $140.16)
      const azureCostRes = await mcpEngine.executeTool(
        'query_resource_pricing',
        {
          resource_type: 'azurerm_linux_virtual_machine',
          config: { vm_size: 'Standard_D4s_v5' },
        },
        { agentId: 'gamma' }
      );
      expect(azureCostRes.isError).toBeUndefined();
      const azureCost = JSON.parse(azureCostRes.content[0]?.text ?? '{}');
      expect(azureCost.monthlyUsd).toBeCloseTo(140.16, 1);
      expect(azureCost.category).toBe('Compute');

      // GCP GCE e2-standard-4 ($0.134 * 730 = $97.82)
      const gcpCostRes = await mcpEngine.executeTool(
        'query_resource_pricing',
        {
          resource_type: 'google_compute_instance',
          config: { machine_type: 'e2-standard-4' },
        },
        { agentId: 'gamma' }
      );
      expect(gcpCostRes.isError).toBeUndefined();
      const gcpCost = JSON.parse(gcpCostRes.content[0]?.text ?? '{}');
      expect(gcpCost.monthlyUsd).toBeCloseTo(97.82, 1);
      expect(gcpCost.category).toBe('Compute');
    });

    test('calculate_topology_cost aggregates mixed multi-cloud topology (AWS + Azure + GCP)', async () => {
      await stateEngine.addNode(
        {
          id: 'aws-ec2',
          type: 'aws_instance',
          name: 'AWS Node',
          position: { x: 0, y: 0 },
          config: { instance_type: 't3.medium', root_volume_gb: 30 },
          metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
          version: 1,
        },
        'alpha'
      );

      await stateEngine.addNode(
        {
          id: 'azure-vm',
          type: 'azurerm_linux_virtual_machine',
          name: 'Azure Node',
          position: { x: 100, y: 0 },
          config: { vm_size: 'Standard_D4s_v5' },
          metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
          version: 1,
        },
        'alpha'
      );

      await stateEngine.addNode(
        {
          id: 'gcp-gce',
          type: 'google_compute_instance',
          name: 'GCP Node',
          position: { x: 200, y: 0 },
          config: { machine_type: 'e2-standard-4' },
          metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
          version: 1,
        },
        'alpha'
      );

      const totalRes = await mcpEngine.executeTool('calculate_topology_cost', {}, { agentId: 'gamma' });
      expect(totalRes.isError).toBeUndefined();
      const totalData = JSON.parse(totalRes.content[0]?.text ?? '{}');
      // ~32.77 (AWS) + ~140.16 (Azure) + ~97.82 (GCP) = ~270.75
      expect(totalData.total_monthly_usd).toBeGreaterThan(250);
      expect(totalData.breakdown_by_category.Compute).toBeGreaterThan(250);
      expect(totalData.itemized_nodes.length).toBe(3);
    });

    test('generate_least_privilege_policy synthesizes policies for Azure and GCP providers', async () => {
      // Azure RBAC Role Synthesis
      const azurePolicyRes = await mcpEngine.executeTool(
        'generate_least_privilege_policy',
        {
          provider: 'azure',
          workload_type: 'blob_storage_rw',
          resource_arn: '/subscriptions/12345678/resourceGroups/rg1',
          allowed_operations: ['Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read'],
        },
        { agentId: 'beta' }
      );
      expect(azurePolicyRes.isError).toBeUndefined();
      const azureDoc = JSON.parse(azurePolicyRes.content[0]?.text ?? '{}');
      expect(azureDoc.RoleName).toBe('LeastPrivilegeCustomRole');
      expect(azureDoc.Actions).toEqual(['Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read']);

      // GCP IAM Role Synthesis
      const gcpPolicyRes = await mcpEngine.executeTool(
        'generate_least_privilege_policy',
        {
          provider: 'google',
          workload_type: 'gcs_object_rw',
          resource_arn: '//storage.googleapis.com/projects/_/buckets/my-bucket',
          allowed_operations: ['storage.objects.get', 'storage.objects.list'],
        },
        { agentId: 'beta' }
      );
      expect(gcpPolicyRes.isError).toBeUndefined();
      const gcpDoc = JSON.parse(gcpPolicyRes.content[0]?.text ?? '{}');
      expect(gcpDoc.role).toBe('roles/custom.workloadExecutor');
      expect(gcpDoc.includedPermissions).toEqual(['storage.objects.get', 'storage.objects.list']);
    });
  });
});
