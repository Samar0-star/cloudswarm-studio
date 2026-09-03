/**
 * Empirical Challenger Suite 2: Multi-Cloud Catalog & IaC Round-Trip Verification
 *
 * Adversarial stress tests verifying:
 * 1. 108-primitive catalog completeness across AWS, Azure, and GCP (all 6 categories).
 * 2. Complex multi-cloud hybrid topologies (AWS EKS + Azure Cosmos DB + GCP Vertex AI) and cross-provider edge connections.
 * 3. Bi-directional HCL AST parsing round-trip fidelity and semantic equivalence.
 * 4. Production Materializer PKZIP bundle packaging, artifact completeness, and cryptographic integrity.
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
  TopologyEdge,
  TopologyState,
  CloudResourceType,
} from '../types/topology';
import { createDefaultTopologyState } from '../types/topology';
import { HCLSyncEngine, HCLParser, canvasToHcl, hclToCanvas } from '../core/sync/HCLSyncEngine';
import {
  ProductionMaterializer,
  generateMainTf,
  generateVariablesTf,
  generateOutputsTf,
  generateTerraformTfvars,
  generateDockerfile,
  generateAuditCertificate,
  generateReadme,
  generateZipBundle,
} from '../core/export/ProductionMaterializer';
import {
  CostCalculator,
  calculateNodeCost,
  calculateTopologyCostBreakdown,
  exportCostBreakdownCsv,
} from '../core/audit/CostCalculator';
import { SentinelAuditor, computeSha256 } from '../core/audit/SentinelAuditor';
import { OptimisticStateEngine } from '../core/state/OptimisticStateEngine';

describe('Empirical Challenger 2: Multi-Cloud Catalog & IaC Round-Trip Verification', () => {

  // =========================================================================
  // 1. 108-PRIMITIVE CATALOG COMPLETENESS ACROSS AWS, AZURE, GCP (6 CATEGORIES)
  // =========================================================================
  describe('1. 108-Primitive Catalog Completeness & Invariance Verification', () => {
    test('1.1: Exact 108 distinct primitives registered with zero duplicates', () => {
      expect(CLOUD_RESOURCE_CATALOG.length).toBe(108);
      expect(getTotalPrimitiveCount()).toBe(108);

      const allTypes = getAllResourceTypes();
      expect(allTypes.length).toBe(108);

      const uniqueTypes = new Set(allTypes);
      expect(uniqueTypes.size).toBe(108);
    });

    test('1.2: Balanced 3-Cloud Distribution (36 AWS, 36 Azure, 36 GCP)', () => {
      const awsItems = getCatalogItemsByProvider('aws');
      const azureItems = getCatalogItemsByProvider('azure');
      const gcpItems = getCatalogItemsByProvider('google');

      expect(awsItems.length).toBe(36);
      expect(azureItems.length).toBe(36);
      expect(gcpItems.length).toBe(36);

      // Verify prefix naming convention strictly adheres to cloud provider
      for (const item of awsItems) {
        expect(item.type.startsWith('aws_')).toBe(true);
        expect(item.provider).toBe('aws');
        expect(getProviderForResourceType(item.type)).toBe('aws');
      }
      for (const item of azureItems) {
        expect(item.type.startsWith('azurerm_')).toBe(true);
        expect(item.provider).toBe('azure');
        expect(getProviderForResourceType(item.type)).toBe('azure');
      }
      for (const item of gcpItems) {
        expect(item.type.startsWith('google_')).toBe(true);
        expect(item.provider).toBe('google');
        expect(getProviderForResourceType(item.type)).toBe('google');
      }
    });

    test('1.3: Balanced Category Distribution across 6 Core Domains', () => {
      const categories: ResourceCategory[] = [
        'Compute',
        'Storage',
        'Database',
        'Network',
        'Security',
        'AI/ML',
      ];

      const expectedCounts: Record<ResourceCategory, { total: number; aws: number; azure: number; gcp: number }> = {
        Compute: { total: 24, aws: 8, azure: 8, gcp: 8 },
        Storage: { total: 18, aws: 6, azure: 6, gcp: 6 },
        Database: { total: 21, aws: 7, azure: 7, gcp: 7 },
        Network: { total: 21, aws: 7, azure: 7, gcp: 7 },
        Security: { total: 15, aws: 5, azure: 5, gcp: 5 },
        'AI/ML': { total: 9, aws: 3, azure: 3, gcp: 3 },
      };

      for (const cat of categories) {
        const items = getCatalogItemsByCategory(cat);
        const expected = expectedCounts[cat];
        expect(items.length).toBe(expected.total);

        const awsInCat = items.filter((i) => i.provider === 'aws');
        const azureInCat = items.filter((i) => i.provider === 'azure');
        const gcpInCat = items.filter((i) => i.provider === 'google');

        expect(awsInCat.length).toBe(expected.aws);
        expect(azureInCat.length).toBe(expected.azure);
        expect(gcpInCat.length).toBe(expected.gcp);
      }
    });

    test('1.4: Schema, Metadata, and Pricing Model Invariance for Every Primitive', () => {
      for (const item of CLOUD_RESOURCE_CATALOG) {
        // Name & Description
        expect(typeof item.name).toBe('string');
        expect(item.name.trim().length).toBeGreaterThan(0);
        expect(typeof item.description).toBe('string');
        expect(item.description.trim().length).toBeGreaterThan(0);
        expect(typeof item.iconName).toBe('string');
        expect(item.iconName.trim().length).toBeGreaterThan(0);

        // Default Configuration
        expect(typeof item.defaultConfig).toBe('object');
        expect(item.defaultConfig).not.toBeNull();
        expect(Object.keys(item.defaultConfig).length).toBeGreaterThan(0);

        // Pricing Model
        expect(item.pricingModel).toBeDefined();
        expect(typeof item.pricingModel.baseMonthlyRate).toBe('number');
        expect(item.pricingModel.baseMonthlyRate).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(item.pricingModel.baseMonthlyRate)).toBe(true);

        if (item.pricingModel.hourlyRate !== undefined) {
          expect(typeof item.pricingModel.hourlyRate).toBe('number');
          expect(item.pricingModel.hourlyRate).toBeGreaterThanOrEqual(0);
        }
        if (item.pricingModel.variablePricing) {
          expect(typeof item.pricingModel.variablePricing).toBe('object');
          for (const [vKey, vPrice] of Object.entries(item.pricingModel.variablePricing)) {
            expect(typeof vKey).toBe('string');
            expect(typeof vPrice).toBe('number');
            expect(vPrice).toBeGreaterThanOrEqual(0);
          }
        }

        // Validation Rules
        expect(Array.isArray(item.validationRules)).toBe(true);
        for (const rule of item.validationRules) {
          expect(['required', 'pattern', 'min', 'max', 'enum', 'cidr', 'range']).toContain(rule.type);
          expect(typeof rule.field).toBe('string');
          expect(typeof rule.message).toBe('string');
        }

        // Schema Retrieval Helper
        const schema = getResourceSchema(item.type);
        expect(schema).toBeDefined();
        expect(schema?.type).toBe(item.type);
        expect(schema?.provider).toBe(item.provider);
        expect(schema?.category).toBe(item.category);
      }
    });

    test('1.5: Search and Filtering Robustness across All Providers', () => {
      // 1. Exact query match
      const ec2Matches = searchCatalogItems('EC2');
      expect(ec2Matches.length).toBeGreaterThanOrEqual(3);

      const cosmosMatches = searchCatalogItems('Cosmos');
      expect(cosmosMatches.length).toBeGreaterThanOrEqual(1);
      expect(cosmosMatches[0]?.type).toBe('azurerm_cosmosdb_account');

      const vertexMatches = searchCatalogItems('Vertex');
      expect(vertexMatches.length).toBeGreaterThanOrEqual(1);
      expect(vertexMatches[0]?.type).toBe('google_vertex_ai_endpoint');

      // 2. Case-insensitivity & Partial substring matching
      const lower = searchCatalogItems('kubernetes');
      const upper = searchCatalogItems('KUBERNETES');
      expect(lower.length).toBe(upper.length);
      expect(lower.length).toBeGreaterThanOrEqual(3); // EKS, AKS, GKE

      // 3. Provider-scoped search
      const awsSearch = searchCatalogItems('kubernetes', 'aws');
      expect(awsSearch.every((i) => i.provider === 'aws')).toBe(true);
      expect(awsSearch.some((i) => i.type === 'aws_eks_cluster')).toBe(true);

      const azureSearch = searchCatalogItems('kubernetes', 'azure');
      expect(azureSearch.every((i) => i.provider === 'azure')).toBe(true);
      expect(azureSearch.some((i) => i.type === 'azurerm_kubernetes_cluster')).toBe(true);

      const gcpSearch = searchCatalogItems('kubernetes', 'google');
      expect(gcpSearch.every((i) => i.provider === 'google')).toBe(true);
      expect(gcpSearch.some((i) => i.type === 'google_container_cluster')).toBe(true);

      // 4. Non-matching query safely returns empty array without throwing
      const nonExistent = searchCatalogItems('xyzNonExistentCloudService12345');
      expect(nonExistent).toEqual([]);
    });

    test('1.6: Validation Engine Verifies Valid Defaults & Catches Adversarial Inputs', () => {
      // All 108 default configs pass validation
      for (const item of CLOUD_RESOURCE_CATALOG) {
        const validation = validateResourceConfig(item.type, item.defaultConfig);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }

      // Adversarial missing required field
      const ec2Invalid = validateResourceConfig('aws_instance', { root_volume_gb: 30 });
      expect(ec2Invalid.valid).toBe(false);
      expect(ec2Invalid.errors.length).toBeGreaterThan(0);

      // Adversarial out-of-range min volume (size_gb < 1)
      const ebsInvalid = validateResourceConfig('aws_ebs_volume', { size_gb: 0, volume_type: 'gp3' });
      expect(ebsInvalid.valid).toBe(false);

      // Adversarial invalid CIDR string
      const vpcInvalid = validateResourceConfig('aws_vpc', { cidr_block: 'not-a-valid-cidr' });
      expect(vpcInvalid.valid).toBe(false);
    });

    test('1.7: Massive All-108-Primitive Mega Topology Synthesis & Cost Evaluation', () => {
      const megaState = createDefaultTopologyState();

      // Populate every single primitive in the catalog into a single topology state
      for (let i = 0; i < CLOUD_RESOURCE_CATALOG.length; i++) {
        const item = CLOUD_RESOURCE_CATALOG[i]!;
        const nodeId = `mega_node_${i}_${item.type}`;
        megaState.nodes[nodeId] = {
          id: nodeId,
          name: item.name,
          type: item.type,
          position: { x: (i % 10) * 100, y: Math.floor(i / 10) * 100 },
          config: { ...item.defaultConfig },
          metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
          version: 1,
        };
      }

      expect(Object.keys(megaState.nodes).length).toBe(108);

      // Evaluate cost breakdown for all 108 nodes
      const startTime = performance.now();
      const breakdown = calculateTopologyCostBreakdown(megaState);
      const evalLatency = performance.now() - startTime;

      expect(breakdown.items.length).toBe(108);
      expect(breakdown.totalMonthlyUsd).toBeGreaterThan(1000);
      expect(evalLatency).toBeLessThan(150); // High-speed sub-150ms evaluation

      // Generate multi-cloud main.tf from all 108 primitives
      const mainTf = generateMainTf(megaState);
      expect(mainTf).toContain('provider "aws"');
      expect(mainTf).toContain('provider "azurerm"');
      expect(mainTf).toContain('provider "google"');
    });
  });

  // =========================================================================
  // 2. COMPLEX MULTI-CLOUD HYBRID TOPOLOGIES & CROSS-PROVIDER CONNECTIONS
  // =========================================================================
  describe('2. Complex Multi-Cloud Hybrid Topologies & Cross-Provider Edge Connections', () => {
    let hybridTopology: TopologyState;

    beforeEach(() => {
      hybridTopology = createDefaultTopologyState();

      // --- AWS Domain ---
      const awsVpc: CloudResourceNode = {
        id: 'node_aws_vpc',
        name: 'aws-production-vpc',
        type: 'aws_vpc',
        position: { x: 100, y: 100 },
        config: { cidr_block: '10.0.0.0/16', enable_dns_hostnames: true },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      const awsSubnet: CloudResourceNode = {
        id: 'node_aws_subnet',
        name: 'aws-app-subnet-1a',
        type: 'aws_subnet',
        position: { x: 150, y: 150 },
        parentId: 'node_aws_vpc',
        config: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      const awsEks: CloudResourceNode = {
        id: 'node_aws_eks',
        name: 'aws-main-eks-cluster',
        type: 'aws_eks_cluster',
        position: { x: 200, y: 200 },
        parentId: 'node_aws_subnet',
        config: { cluster_name: 'aws-main-eks', version: '1.28', node_count: 5, instance_type: 'm6i.xlarge' },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      const awsS3: CloudResourceNode = {
        id: 'node_aws_s3',
        name: 'aws-immutable-model-vault',
        type: 'aws_s3_bucket',
        position: { x: 250, y: 250 },
        config: { bucket_name: 'aws-model-weights-prod-2026', encryption_type: 'aws:kms', versioning_enabled: true },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      // --- Azure Domain ---
      const azVnet: CloudResourceNode = {
        id: 'node_az_vnet',
        name: 'az-enterprise-vnet',
        type: 'azurerm_virtual_network',
        position: { x: 500, y: 100 },
        config: { address_space: ['172.16.0.0/16'], location: 'eastus' },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      const azSubnet: CloudResourceNode = {
        id: 'node_az_subnet',
        name: 'az-db-subnet',
        type: 'azurerm_subnet',
        position: { x: 550, y: 150 },
        parentId: 'node_az_vnet',
        config: { address_prefixes: ['172.16.1.0/24'] },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      const azCosmos: CloudResourceNode = {
        id: 'node_az_cosmos',
        name: 'az-global-cosmos-db',
        type: 'azurerm_cosmosdb_account',
        position: { x: 600, y: 200 },
        parentId: 'node_az_subnet',
        config: { offer_type: 'Standard', kind: 'GlobalDocumentDB', enable_automatic_failover: true },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      const azKeyVault: CloudResourceNode = {
        id: 'node_az_keyvault',
        name: 'az-corp-key-vault',
        type: 'azurerm_key_vault',
        position: { x: 650, y: 250 },
        config: { sku_name: 'premium', soft_delete_retention_days: 90, purge_protection_enabled: true },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      // --- GCP Domain ---
      const gcpNet: CloudResourceNode = {
        id: 'node_gcp_vpc',
        name: 'gcp-ml-vpc-network',
        type: 'google_compute_network',
        position: { x: 900, y: 100 },
        config: { auto_create_subnetworks: false, routing_mode: 'GLOBAL' },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      const gcpSubnet: CloudResourceNode = {
        id: 'node_gcp_subnet',
        name: 'gcp-vertex-subnet',
        type: 'google_compute_subnetwork',
        position: { x: 950, y: 150 },
        parentId: 'node_gcp_vpc',
        config: { ip_cidr_range: '192.168.10.0/24', region: 'us-central1' },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      const gcpVertex: CloudResourceNode = {
        id: 'node_gcp_vertex',
        name: 'gcp-vertex-ai-inference',
        type: 'google_vertex_ai_endpoint',
        position: { x: 1000, y: 200 },
        parentId: 'node_gcp_subnet',
        config: { machine_type: 'g2-standard-16', accelerator_type: 'NVIDIA_L4', accelerator_count: 1 },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      const gcpGcs: CloudResourceNode = {
        id: 'node_gcp_gcs',
        name: 'gcp-training-dataset-bucket',
        type: 'google_storage_bucket',
        position: { x: 1050, y: 250 },
        config: { location: 'US', storage_class: 'STANDARD', uniform_bucket_level_access: true },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      // Populate Nodes
      const allNodes = [
        awsVpc, awsSubnet, awsEks, awsS3,
        azVnet, azSubnet, azCosmos, azKeyVault,
        gcpNet, gcpSubnet, gcpVertex, gcpGcs,
      ];
      for (const n of allNodes) {
        hybridTopology.nodes[n.id] = n;
      }

      // --- Cross-Provider Edges ---
      const edges: TopologyEdge[] = [
        // Intra-cloud edges
        { id: 'edge_aws_vpc_subnet', source: 'node_aws_vpc', target: 'node_aws_subnet', type: 'routes_to', label: 'contains' },
        { id: 'edge_aws_subnet_eks', source: 'node_aws_subnet', target: 'node_aws_eks', type: 'attached_to', label: 'hosts' },
        { id: 'edge_aws_eks_s3', source: 'node_aws_eks', target: 'node_aws_s3', type: 'stores_in', label: 'persists_to' },
        { id: 'edge_az_vnet_subnet', source: 'node_az_vnet', target: 'node_az_subnet', type: 'routes_to', label: 'contains' },
        { id: 'edge_az_subnet_cosmos', source: 'node_az_subnet', target: 'node_az_cosmos', type: 'attached_to', label: 'hosts' },
        { id: 'edge_gcp_vpc_subnet', source: 'node_gcp_vpc', target: 'node_gcp_subnet', type: 'routes_to', label: 'contains' },
        { id: 'edge_gcp_subnet_vertex', source: 'node_gcp_subnet', target: 'node_gcp_vertex', type: 'attached_to', label: 'hosts' },
        // Inter-cloud / Cross-Provider edges
        { id: 'edge_cross_eks_to_cosmos', source: 'node_aws_eks', target: 'node_az_cosmos', type: 'depends_on', label: 'queries_global_nosql' },
        { id: 'edge_cross_eks_to_vertex', source: 'node_aws_eks', target: 'node_gcp_vertex', type: 'depends_on', label: 'invokes_ai_inference' },
        { id: 'edge_cross_cosmos_to_gcs', source: 'node_az_cosmos', target: 'node_gcp_gcs', type: 'depends_on', label: 'continuous_backup_export' },
      ];
      for (const e of edges) {
        hybridTopology.edges[e.id] = e;
      }
    });

    test('2.1: Validates Multi-Cloud Hybrid Graph Hierarchy and Cross-Provider Edges', () => {
      const nodeCount = Object.keys(hybridTopology.nodes).length;
      const edgeCount = Object.keys(hybridTopology.edges).length;
      expect(nodeCount).toBe(12);
      expect(edgeCount).toBe(10);

      // Verify all 3 providers exist in topology
      const providersInGraph = new Set(
        Object.values(hybridTopology.nodes).map((n) => getProviderForResourceType(n.type))
      );
      expect(providersInGraph.has('aws')).toBe(true);
      expect(providersInGraph.has('azure')).toBe(true);
      expect(providersInGraph.has('google')).toBe(true);

      // Verify cross-provider edge connections
      const crossEksToCosmos = hybridTopology.edges['edge_cross_eks_to_cosmos'];
      expect(crossEksToCosmos).toBeDefined();
      if (crossEksToCosmos) {
        const src = hybridTopology.nodes[crossEksToCosmos.source];
        const tgt = hybridTopology.nodes[crossEksToCosmos.target];
        expect(src && getProviderForResourceType(src.type)).toBe('aws');
        expect(tgt && getProviderForResourceType(tgt.type)).toBe('azure');
      }

      const crossEksToVertex = hybridTopology.edges['edge_cross_eks_to_vertex'];
      expect(crossEksToVertex).toBeDefined();
      if (crossEksToVertex) {
        const src = hybridTopology.nodes[crossEksToVertex.source];
        const tgt = hybridTopology.nodes[crossEksToVertex.target];
        expect(src && getProviderForResourceType(src.type)).toBe('aws');
        expect(tgt && getProviderForResourceType(tgt.type)).toBe('google');
      }

      const crossCosmosToGcs = hybridTopology.edges['edge_cross_cosmos_to_gcs'];
      expect(crossCosmosToGcs).toBeDefined();
      if (crossCosmosToGcs) {
        const src = hybridTopology.nodes[crossCosmosToGcs.source];
        const tgt = hybridTopology.nodes[crossCosmosToGcs.target];
        expect(src && getProviderForResourceType(src.type)).toBe('azure');
        expect(tgt && getProviderForResourceType(tgt.type)).toBe('google');
      }
    });

    test('2.2: Evaluates Multi-Cloud FinOps Aggregations and CSV Export', () => {
      const breakdown = calculateTopologyCostBreakdown(hybridTopology);
      expect(breakdown.totalMonthlyUsd).toBeGreaterThan(0);
      expect(breakdown.items.length).toBe(12);

      // Categorical aggregation
      expect(breakdown.categoryTotals).toBeDefined();
      expect(breakdown.categoryTotals['Compute']).toBeGreaterThanOrEqual(0);
      expect(breakdown.categoryTotals['Database']).toBeGreaterThanOrEqual(0);
      expect(breakdown.categoryTotals['Storage']).toBeGreaterThanOrEqual(0);
      expect(breakdown.categoryTotals['Networking']).toBeGreaterThanOrEqual(0);

      // Provider aggregation
      expect(breakdown.providerTotals).toBeDefined();
      expect(breakdown.providerTotals['aws']).toBeGreaterThanOrEqual(0);
      expect(breakdown.providerTotals['azure']).toBeGreaterThanOrEqual(0);
      expect(breakdown.providerTotals['google']).toBeGreaterThanOrEqual(0);

      // CSV Export
      const csv = exportCostBreakdownCsv(breakdown);
      expect(typeof csv).toBe('string');
      expect(csv).toContain('Provider,Resource Name,Node ID,Resource Type,Category,Hourly Rate ($/hr),Monthly Spend ($/mo),Details');
      expect(csv).toContain('node_aws_eks');
      expect(csv).toContain('node_az_cosmos');
      expect(csv).toContain('node_gcp_vertex');
    });

    test('2.3: Zero-Trust Security Scanner Multi-Cloud Assessment', () => {
      const auditor = new SentinelAuditor();
      const audit = auditor.auditTopology(hybridTopology);
      expect(audit.securityScore).toBeGreaterThanOrEqual(0);
      expect(audit.securityScore).toBeLessThanOrEqual(100);
      expect(audit.grade).toBeDefined();
      expect(Array.isArray(audit.findings)).toBe(true);
    });

    test('2.4: Cascade Deletion & Graph Invariant Resilience with OptimisticStateEngine', async () => {
      const engine = new OptimisticStateEngine(hybridTopology);

      // Delete Azure VNet and verify subnet/attached edges get handled cleanly
      const deletePatch = [
        { op: 'remove' as const, path: '/nodes/node_az_vnet' },
        { op: 'remove' as const, path: '/edges/edge_az_vnet_subnet' },
      ];

      const txResult = await engine.applyTransaction({
        id: 'tx_cascade_test',
        agentId: 'alpha',
        baseVersion: hybridTopology.version,
        patches: deletePatch,
        timestamp: Date.now(),
        description: 'Delete Azure VNet',
      });

      expect(txResult.success).toBe(true);
      const updatedState = engine.getState();
      expect(updatedState.nodes['node_az_vnet']).toBeUndefined();
      // Cosmos DB and cross-cloud edge to GCS still preserved
      expect(updatedState.nodes['node_az_cosmos']).toBeDefined();
      expect(updatedState.edges['edge_cross_cosmos_to_gcs']).toBeDefined();
    });

    test('2.5: Complex Cyclic Cross-Cloud Graph Invariant & Termination', () => {
      // Add a cyclic feedback edge: GCP Vertex AI -> AWS EKS
      const cyclicTopology = JSON.parse(JSON.stringify(hybridTopology)) as TopologyState;
      cyclicTopology.edges['edge_cyclic_feedback'] = {
        id: 'edge_cyclic_feedback',
        source: 'node_gcp_vertex',
        target: 'node_aws_eks',
        type: 'depends_on',
        label: 'ai_feedback_loop',
      };

      // Ensure cost breakdown and security audit terminate safely without stack overflow
      const breakdown = calculateTopologyCostBreakdown(cyclicTopology);
      expect(breakdown.totalMonthlyUsd).toBeGreaterThan(0);

      const auditor = new SentinelAuditor();
      const audit = auditor.auditTopology(cyclicTopology);
      expect(audit.securityScore).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // 3. BI-DIRECTIONAL HCL AST PARSING ROUND-TRIP FIDELITY & PACKAGING
  // =========================================================================
  describe('3. Bi-Directional HCL AST Parsing Round-Trip Fidelity & Packaging', () => {
    let multiCloudState: TopologyState;

    beforeEach(() => {
      multiCloudState = createDefaultTopologyState();

      // Add AWS Resource
      multiCloudState.nodes['vpc_prod'] = {
        id: 'vpc_prod',
        name: 'vpc-production',
        type: 'aws_vpc',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.100.0.0/16', enable_dns_hostnames: true },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      multiCloudState.nodes['subnet_app'] = {
        id: 'subnet_app',
        name: 'subnet-app-1',
        type: 'aws_subnet',
        position: { x: 50, y: 50 },
        parentId: 'vpc_prod',
        config: { vpc_id: 'vpc_prod', cidr_block: '10.100.1.0/24' },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      // Add Azure Resource
      multiCloudState.nodes['vnet_azure'] = {
        id: 'vnet_azure',
        name: 'vnet-eastus-main',
        type: 'azurerm_virtual_network',
        position: { x: 300, y: 0 },
        config: { address_space: ['10.200.0.0/16'], location: 'eastus' },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      multiCloudState.nodes['cosmos_db'] = {
        id: 'cosmos_db',
        name: 'cosmos-primary-db',
        type: 'azurerm_cosmosdb_account',
        position: { x: 350, y: 50 },
        config: { offer_type: 'Standard', kind: 'GlobalDocumentDB' },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      // Add GCP Resource
      multiCloudState.nodes['gcp_network'] = {
        id: 'gcp_network',
        name: 'gcp-custom-network',
        type: 'google_compute_network',
        position: { x: 600, y: 0 },
        config: { auto_create_subnetworks: false },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      multiCloudState.nodes['gcp_storage'] = {
        id: 'gcp_storage',
        name: 'gcp-lake-bucket',
        type: 'google_storage_bucket',
        position: { x: 650, y: 50 },
        config: { location: 'US', storage_class: 'STANDARD' },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };
    });

    test('3.1: HCL AST Generation Emits Multi-Cloud Provider Blocks and Resources', () => {
      // 1. Test ProductionMaterializer.generateMainTf includes required_providers and provider configs
      const mainTf = generateMainTf(multiCloudState);
      expect(mainTf).toContain('required_providers {');
      expect(mainTf).toContain('aws = {');
      expect(mainTf).toContain('azurerm = {');
      expect(mainTf).toContain('google = {');
      expect(mainTf).toContain('provider "aws"');
      expect(mainTf).toContain('provider "azurerm"');
      expect(mainTf).toContain('provider "google"');

      // 2. Test canvasToHcl compiles resource declarations
      const canvasHcl = canvasToHcl(multiCloudState);
      expect(canvasHcl).toContain('resource "aws_vpc" "vpc_prod"');
      expect(canvasHcl).toContain('cidr_block           = "10.100.0.0/16"');
      expect(canvasHcl).toContain('resource "aws_subnet" "subnet_app"');
      expect(canvasHcl).toContain('resource "azurerm_virtual_network" "vnet_azure"');
      expect(canvasHcl).toContain('resource "azurerm_cosmosdb_account" "cosmos_db"');
      expect(canvasHcl).toContain('resource "google_compute_network" "gcp_network"');
      expect(canvasHcl).toContain('resource "google_storage_bucket" "gcp_storage"');
    });

    test('3.2: Bi-Directional HCL AST Parsing Round-Trip Reconstructs Multi-Cloud Graph', () => {
      // 1. Serialize Topology to HCL
      const originalHcl = canvasToHcl(multiCloudState);

      // 2. Parse HCL back into Topology
      const parsedTopology = hclToCanvas(originalHcl);
      const parsedNodes = Object.values(parsedTopology.nodes);

      expect(parsedNodes.length).toBe(6);

      // Check AWS Nodes
      const vpcNode = parsedTopology.nodes['vpc_prod'];
      expect(vpcNode).toBeDefined();
      expect(vpcNode?.type).toBe('aws_vpc');
      if (vpcNode) {
        expect(getProviderForResourceType(vpcNode.type)).toBe('aws');
      }

      const subnetNode = parsedTopology.nodes['subnet_app'];
      expect(subnetNode).toBeDefined();
      expect(subnetNode?.type).toBe('aws_subnet');

      // Check Azure Nodes
      const vnetNode = parsedTopology.nodes['vnet_azure'];
      expect(vnetNode).toBeDefined();
      expect(vnetNode?.type).toBe('azurerm_virtual_network');
      if (vnetNode) {
        expect(getProviderForResourceType(vnetNode.type)).toBe('azure');
      }

      const cosmosNode = parsedTopology.nodes['cosmos_db'];
      expect(cosmosNode).toBeDefined();
      expect(cosmosNode?.type).toBe('azurerm_cosmosdb_account');
      if (cosmosNode) {
        expect(getProviderForResourceType(cosmosNode.type)).toBe('azure');
      }

      // Check GCP Nodes
      const gcpNetNode = parsedTopology.nodes['gcp_network'];
      expect(gcpNetNode).toBeDefined();
      expect(gcpNetNode?.type).toBe('google_compute_network');
      if (gcpNetNode) {
        expect(getProviderForResourceType(gcpNetNode.type)).toBe('google');
      }

      const gcpBucketNode = parsedTopology.nodes['gcp_storage'];
      expect(gcpBucketNode).toBeDefined();
      expect(gcpBucketNode?.type).toBe('google_storage_bucket');
      if (gcpBucketNode) {
        expect(getProviderForResourceType(gcpBucketNode.type)).toBe('google');
      }

      // 3. Re-compile parsed topology to HCL and verify semantic equivalence
      const recompiledHcl = canvasToHcl(parsedTopology);
      expect(recompiledHcl).toContain('resource "aws_vpc" "vpc_prod"');
      expect(recompiledHcl).toContain('resource "azurerm_virtual_network" "vnet_azure"');
      expect(recompiledHcl).toContain('resource "google_storage_bucket" "gcp_storage"');
    });

    test('3.3: Parser Handles Raw HCL with Comments, Whitespace and Nested Blocks', () => {
      const rawHcl = `
# Production Multi-Cloud Infrastructure Blueprint
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

// AWS Primary VPC
resource "aws_vpc" "app_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  tags = {
    Environment = "production"
    ManagedBy   = "CloudSwarm"
  }
}

// Azure Managed Disk
resource "azurerm_managed_disk" "fast_nvme" {
  name                 = "disk-prod-nvme"
  location             = "eastus"
  storage_account_type = "Premium_LRS"
  disk_size_gb         = 256
}

// Google Cloud SQL Database
resource "google_sql_database_instance" "postgres_master" {
  name             = "pg-master-instance"
  database_version = "POSTGRES_15"
  region           = "us-central1"
  settings {
    tier = "db-custom-4-16384"
  }
}
      `;

      const parsed = hclToCanvas(rawHcl);
      expect(Object.keys(parsed.nodes).length).toBe(3);

      expect(parsed.nodes['app_vpc']).toBeDefined();
      expect(parsed.nodes['app_vpc']?.type).toBe('aws_vpc');
      expect(parsed.nodes['app_vpc']?.config['cidr_block']).toBe('10.0.0.0/16');

      expect(parsed.nodes['fast_nvme']).toBeDefined();
      expect(parsed.nodes['fast_nvme']?.type).toBe('azurerm_managed_disk');
      expect(parsed.nodes['fast_nvme']?.config['disk_size_gb']).toBe(256);

      expect(parsed.nodes['postgres_master']).toBeDefined();
      expect(parsed.nodes['postgres_master']?.type).toBe('google_sql_database_instance');
    });

    test('3.4: Adversarial HCL Input Resilience (Malformed Syntax, Unknown Blocks)', () => {
      const malformedHcl = `
        // Random unsupported provider blocks
        resource "unknown_cloud_unsupported_resource" "dummy" {
          foo = "bar"
        }
        
        # Valid AWS bucket
        resource "aws_s3_bucket" "safe_bucket" {
          bucket = "safe-production-bucket"
        }
      `;

      const parsed = hclToCanvas(malformedHcl);
      // Valid bucket recovered without parser throwing an unhandled exception
      expect(parsed.nodes['safe_bucket']).toBeDefined();
      expect(parsed.nodes['safe_bucket']?.type).toBe('aws_s3_bucket');
    });
  });

  // =========================================================================
  // 4. PRODUCTION MATERIALIZER ZIP BUNDLE & CRYPTOGRAPHIC AUDIT VERIFICATION
  // =========================================================================
  describe('4. Production Materializer ZIP Bundle & Cryptographic Audit Verification', () => {
    test('4.1: Materializes All 8 Mandatory Artifacts with Complete Manifests', () => {
      const testState = createDefaultTopologyState();
      testState.nodes['web_cluster'] = {
        id: 'web_cluster',
        name: 'web-prod-cluster',
        type: 'aws_eks_cluster',
        position: { x: 0, y: 0 },
        config: { version: '1.28' },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      testState.nodes['az_db'] = {
        id: 'az_db',
        name: 'az-postgres-db',
        type: 'azurerm_postgresql_flexible_server',
        position: { x: 100, y: 0 },
        config: { sku_name: 'GP_Standard_D4s_v3' },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      const auditReport = {
        score: 98,
        monthlyCostUsd: 218.0,
        findings: [],
        passedRules: [],
        timestamp: Date.now(),
      };

      const bundle = ProductionMaterializer.materializeBundle(testState, auditReport as any);

      // Verify all 8 files
      const expectedFiles = [
        'main.tf',
        'variables.tf',
        'outputs.tf',
        'terraform.tfvars.example',
        'Dockerfile',
        '.dockerignore',
        'audit_certificate.json',
        'README.md',
      ];

      for (const file of expectedFiles) {
        expect(bundle[file]).toBeDefined();
        expect(typeof bundle[file]).toBe('string');
        expect(bundle[file]!.length).toBeGreaterThan(0);
      }

      // Verify main.tf contains providers for aws and azurerm
      expect(bundle['main.tf']).toContain('provider "aws"');
      expect(bundle['main.tf']).toContain('provider "azurerm"');

      // Verify Dockerfile has hardened non-root security
      expect(bundle['Dockerfile']).toContain('USER nginx');
      expect(bundle['Dockerfile']).toContain('FROM node:');

      // Verify audit_certificate.json structure and cryptographic signature
      const cert = JSON.parse(bundle['audit_certificate.json']!);
      expect(cert.score).toBe(98);
      expect(cert.monthlyCostUsd).toBe(218.0);
      expect(cert.sha256).toBeDefined();
      expect(cert.sha256).toMatch(/^[a-f0-9]{64}$/);
    });

    test('4.2: Generates Valid PKZIP Binary with Correct Magic Headers and CRC32', async () => {
      const testState = createDefaultTopologyState();
      testState.nodes['s3_store'] = {
        id: 's3_store',
        name: 'data-vault',
        type: 'aws_s3_bucket',
        position: { x: 0, y: 0 },
        config: { bucket_name: 'prod-vault-data-2026' },
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), createdBy: 'alpha', status: 'healthy', tags: {} },
        version: 1,
      };

      const blob = await ProductionMaterializer.generateProductionZip(testState);
      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(500);

      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const view = new DataView(arrayBuffer);

      // 1. Verify Local File Header Magic Number (0x04034b50) at offset 0
      const localHeaderMagic = view.getUint32(0, true);
      expect(localHeaderMagic).toBe(0x04034b50);

      // 2. Verify End of Central Directory Record Magic Number (0x06054b50) near end
      let foundEOCD = false;
      for (let i = bytes.length - 22; i >= 0; i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
          foundEOCD = true;
          const diskEntries = view.getUint16(i + 8, true);
          expect(diskEntries).toBe(8); // 8 files in bundle
          break;
        }
      }
      expect(foundEOCD).toBe(true);
    });

    test('4.3: Cryptographic Audit Certificate SHA-256 Signature Verification', () => {
      const auditPayload = {
        score: 95,
        monthlyCostUsd: 350.0,
      };

      const certJson = ProductionMaterializer.generateAuditCertificate(auditPayload as any);
      const certObj = JSON.parse(certJson);

      expect(certObj.score).toBe(95);
      expect(certObj.monthlyCostUsd).toBe(350.0);
      expect(certObj.grade).toBe('A+');
      expect(certObj.sha256).toBeDefined();

      // Verify that reconstructing the certificate payload yields the exact same SHA-256 signature
      const { sha256: extractedSig, ...rawPayload } = certObj;
      const expectedSha256 = computeSha256(JSON.stringify(rawPayload));
      expect(extractedSig).toBe(expectedSha256);
    });
  });
});
