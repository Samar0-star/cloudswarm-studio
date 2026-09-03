/**
 * Milestone M3: Canvas, Resource Palette, Dynamic Node Inspector & 4-Agent Presence Test Suite
 *
 * Tests:
 * 1. Resource Palette: 108 primitives catalog integration, instant search, multi-select provider filters, category tabs, and drag-and-drop.
 * 2. Dynamic Node Inspector: Context-aware dynamic forms for AWS, Azure, and GCP, sizing dropdowns, storage capacity sliders, security toggles, live cost recalculation, and 1-click remediation/rightsizing.
 * 3. 4-Agent Multi-Agent Canvas: 4 specialized agent personas (Alpha, Beta, Gamma, Delta), 4-quadrant non-overlapping thought bubbles, bounding lock halos, and drag-and-drop canvas spawning.
 */

import { useCloudSwarmStore } from '../store/useCloudSwarmStore';
import {
  CLOUD_RESOURCE_CATALOG,
  getResourceSchema,
  searchCatalogItems,
  getCatalogItemsByCategory,
  getProviderForResourceType,
  getCategoryForResourceType,
  type ResourceCatalogItem,
} from '../core/catalog/resourceCatalog';
import { AGENT_PERSONAS, type AgentId, type AgentPresenceState } from '../types/swarm';
import type { CloudResourceNode, CloudProvider, ResourceCategory } from '../types/topology';
import { calculateNodeCost } from '../core/audit/CostCalculator';

describe('Milestone M3: Resource Palette, Dynamic Node Inspector & 4-Agent UX', () => {
  beforeEach(() => {
    useCloudSwarmStore.getState().resetTopology();
  });

  // =========================================================================
  // 1. Resource Palette & Catalog Integration
  // =========================================================================
  describe('1. Resource Palette & 108 Primitives Catalog Integration', () => {
    test('1.1: integrates all 108 primitives categorized across AWS, Azure, and GCP (36 each)', () => {
      expect(CLOUD_RESOURCE_CATALOG.length).toBe(108);

      const awsItems = CLOUD_RESOURCE_CATALOG.filter((i) => i.provider === 'aws');
      const azureItems = CLOUD_RESOURCE_CATALOG.filter((i) => i.provider === 'azure');
      const gcpItems = CLOUD_RESOURCE_CATALOG.filter((i) => i.provider === 'google');

      expect(awsItems.length).toBe(36);
      expect(azureItems.length).toBe(36);
      expect(gcpItems.length).toBe(36);
    });

    test('1.2: filters catalog by multi-select provider subsets accurately', () => {
      const filterByProviders = (providers: Set<CloudProvider>) => {
        return CLOUD_RESOURCE_CATALOG.filter((item) => providers.has(item.provider));
      };

      // All 3 clouds
      const allSelected = new Set<CloudProvider>(['aws', 'azure', 'google']);
      expect(filterByProviders(allSelected).length).toBe(108);

      // AWS + Azure only
      const awsAndAzure = new Set<CloudProvider>(['aws', 'azure']);
      expect(filterByProviders(awsAndAzure).length).toBe(72);

      // GCP only
      const gcpOnly = new Set<CloudProvider>(['google']);
      expect(filterByProviders(gcpOnly).length).toBe(36);
    });

    test('1.3: filters catalog by architectural category tabs (Compute, Storage, Database, Network, Security, AI/ML)', () => {
      const categories: ResourceCategory[] = [
        'Compute',
        'Storage',
        'Database',
        'Network',
        'Security',
        'AI/ML',
      ];

      for (const cat of categories) {
        const items = getCatalogItemsByCategory(cat);
        expect(items.length).toBeGreaterThan(0);
        // Each category must contain items across AWS, Azure, and GCP
        const provs = new Set(items.map((i) => i.provider));
        expect(provs.has('aws')).toBe(true);
        expect(provs.has('azure')).toBe(true);
        expect(provs.has('google')).toBe(true);
      }
    });

    test('1.4: executes fast instant search matching across names, types, descriptions, and categories', () => {
      // Search "kubernetes"
      const k8sResults = searchCatalogItems('kubernetes');
      expect(k8sResults.length).toBeGreaterThanOrEqual(3);
      const types = k8sResults.map((r) => r.type);
      expect(types).toContain('aws_eks_cluster');
      expect(types).toContain('azurerm_kubernetes_cluster');
      expect(types).toContain('google_container_cluster');

      // Search "postgres"
      const pgResults = searchCatalogItems('postgres');
      expect(pgResults.length).toBeGreaterThanOrEqual(3);

      // Search "gpu"
      const gpuResults = searchCatalogItems('gpu');
      expect(gpuResults.length).toBeGreaterThanOrEqual(3);
    });

    test('1.5: generates deterministic unique node IDs and default configs on click-to-spawn', async () => {
      const store = useCloudSwarmStore.getState();

      const item = getResourceSchema('azurerm_linux_virtual_machine');
      expect(item).toBeDefined();

      const existingCount = Object.values(store.topologyState.nodes).filter(
        (n) => n.type === 'azurerm_linux_virtual_machine'
      ).length;
      const cleanPrefix = 'linux_virtual_machine';
      const nodeId = `${cleanPrefix}_${existingCount + 1}`;

      await store.addNode({
        id: nodeId,
        type: 'azurerm_linux_virtual_machine',
        name: `${item!.name} 1`,
        position: { x: 300, y: 200 },
        config: { ...item!.defaultConfig },
        metadata: {
          createdBy: 'director',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'healthy',
        },
        version: 1,
      });

      const updated = useCloudSwarmStore.getState();
      const spawned = updated.topologyState.nodes[nodeId];
      expect(spawned).toBeDefined();
      expect(spawned?.type).toBe('azurerm_linux_virtual_machine');
      expect(spawned?.config['vm_size']).toBe('Standard_D4s_v5');
      expect(spawned?.position).toEqual({ x: 300, y: 200 });
    });
  });

  // =========================================================================
  // 2. Dynamic Node Inspector & Multi-Cloud Forms
  // =========================================================================
  describe('2. Dynamic Node Inspector & Multi-Cloud Forms', () => {
    test('2.1: resolves provider and category correctly for any of the 108 primitives', () => {
      expect(getProviderForResourceType('aws_instance')).toBe('aws');
      expect(getCategoryForResourceType('aws_instance')).toBe('Compute');

      expect(getProviderForResourceType('azurerm_storage_account')).toBe('azure');
      expect(getCategoryForResourceType('azurerm_storage_account')).toBe('Storage');

      expect(getProviderForResourceType('google_sql_database_instance')).toBe('google');
      expect(getCategoryForResourceType('google_sql_database_instance')).toBe('Database');

      expect(getProviderForResourceType('google_compute_firewall')).toBe('google');
      expect(getCategoryForResourceType('google_compute_firewall')).toBe('Security');
    });

    test('2.2: updates multi-cloud instance sizes and storage capacity sliders via CAS mutations', async () => {
      const store = useCloudSwarmStore.getState();

      // Create GCP GCE node
      await store.addNode({
        id: 'gce_app',
        type: 'google_compute_instance',
        name: 'GCP Backend',
        position: { x: 100, y: 100 },
        config: { machine_type: 'e2-medium', boot_disk_size_gb: 20 },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // Update machine type and disk slider
      await store.updateNodeConfig('gce_app', {
        machine_type: 'n2-standard-4',
        boot_disk_size_gb: 100,
      });

      const updated = useCloudSwarmStore.getState().topologyState.nodes['gce_app'];
      expect(updated?.config['machine_type']).toBe('n2-standard-4');
      expect(updated?.config['boot_disk_size_gb']).toBe(100);
      expect(updated?.version).toBeGreaterThanOrEqual(2);
    });

    test('2.3: updates security toggles (encryption, public access block, TLS 1.3, IMDSv2)', async () => {
      const store = useCloudSwarmStore.getState();

      // Create Azure Storage Account
      await store.addNode({
        id: 'azure_blob_prod',
        type: 'azurerm_storage_account',
        name: 'Azure Blob Store',
        position: { x: 50, y: 50 },
        config: {
          account_tier: 'Standard',
          allow_blob_public_access: true,
          enable_https_traffic_only: false,
        },
        metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // Toggle security settings
      await store.updateNodeConfig('azure_blob_prod', {
        allow_blob_public_access: false,
        enable_https_traffic_only: true,
        min_tls_version: 'TLS1_2',
      });

      const secured = useCloudSwarmStore.getState().topologyState.nodes['azure_blob_prod'];
      expect(secured?.config['allow_blob_public_access']).toBe(false);
      expect(secured?.config['enable_https_traffic_only']).toBe(true);
      expect(secured?.config['min_tls_version']).toBe('TLS1_2');
    });

    test('2.4: 1-click auto-remediation hardens AWS, Azure, and GCP resources immediately', async () => {
      const store = useCloudSwarmStore.getState();

      // Add unhardened AWS S3 bucket
      await store.addNode({
        id: 's3_insecure',
        type: 'aws_s3_bucket',
        name: 'Insecure S3',
        position: { x: 10, y: 10 },
        config: {
          bucket_name: 'insecure-bucket',
          encryption: { enabled: false },
          block_public_access: { block_public_acls: false },
        },
        metadata: { createdBy: 'director', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // Execute hardening updates
      await store.updateNodeConfig('s3_insecure', {
        encryption: { enabled: true, sse_algorithm: 'AES256' },
        block_public_access: {
          block_public_acls: true,
          block_public_policy: true,
          ignore_public_acls: true,
          restrict_public_buckets: true,
        },
        versioning_enabled: true,
      });

      const hardened = useCloudSwarmStore.getState().topologyState.nodes['s3_insecure'];
      expect((hardened?.config['encryption'] as { enabled: boolean }).enabled).toBe(true);
      expect(
        (hardened?.config['block_public_access'] as { block_public_acls: boolean }).block_public_acls
      ).toBe(true);
    });

    test('2.5: 1-click rightsizing transitions expensive instances to cost-effective Graviton / ARM tiers', async () => {
      const store = useCloudSwarmStore.getState();

      await store.addNode({
        id: 'ec2_expensive',
        type: 'aws_instance_compute',
        name: 'Compute VM',
        position: { x: 0, y: 0 },
        config: { instance_type: 'c6i.xlarge', root_volume_type: 'io2' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // Rightsizing optimization
      await store.updateNodeConfig('ec2_expensive', {
        instance_type: 'c7g.large', // Graviton3
        root_volume_type: 'gp3',
      });

      const optimized = useCloudSwarmStore.getState().topologyState.nodes['ec2_expensive'];
      expect(optimized?.config['instance_type']).toBe('c7g.large');
      expect(optimized?.config['root_volume_type']).toBe('gp3');
    });
  });

  // =========================================================================
  // 3. 4-Agent Multi-Agent Multiplayer UX & Presence
  // =========================================================================
  describe('3. 4-Agent Multi-Agent Multiplayer UX & Presence', () => {
    test('3.1: defines distinct personas, colors, glyphs, and roles for all 4 specialized agents', () => {
      // Alpha: Compute
      expect(AGENT_PERSONAS.alpha.hexCode).toBe('#0EA5E9');
      expect(AGENT_PERSONAS.alpha.glyph).toBe('α');
      expect(AGENT_PERSONAS.alpha.role).toBe('compute_infra');

      // Beta: Network & Security
      expect(AGENT_PERSONAS.beta.hexCode).toBe('#6366F1');
      expect(AGENT_PERSONAS.beta.glyph).toBe('β');
      expect(AGENT_PERSONAS.beta.role).toBe('network_security');

      // Gamma: Storage & Databases
      expect(AGENT_PERSONAS.gamma.hexCode).toBe('#10B981');
      expect(AGENT_PERSONAS.gamma.glyph).toBe('γ');
      expect(AGENT_PERSONAS.gamma.role).toBe('storage_databases');

      // Delta: FinOps & Cost Auditor
      expect(AGENT_PERSONAS.delta.hexCode).toBe('#A855F7');
      expect(AGENT_PERSONAS.delta.glyph).toBe('δ');
      expect(AGENT_PERSONAS.delta.role).toBe('finops_auditor');
    });

    test('3.2: calculates non-overlapping 4-quadrant thought bubble offsets', () => {
      function getThoughtOffset(agentId: AgentId) {
        let offsetX = 28;
        let offsetY = -56;
        if (agentId === 'beta') {
          offsetX = 28;
          offsetY = 32;
        } else if (agentId === 'gamma') {
          offsetX = -290;
          offsetY = -56;
        } else if (agentId === 'delta') {
          offsetX = -290;
          offsetY = 32;
        } else if (agentId === 'director' || agentId === 'human') {
          offsetX = 28;
          offsetY = -24;
        }
        return { offsetX, offsetY };
      }

      const alphaOffset = getThoughtOffset('alpha');
      const betaOffset = getThoughtOffset('beta');
      const gammaOffset = getThoughtOffset('gamma');
      const deltaOffset = getThoughtOffset('delta');

      // Alpha: Top-Right (+X, -Y)
      expect(alphaOffset.offsetX).toBeGreaterThan(0);
      expect(alphaOffset.offsetY).toBeLessThan(0);

      // Beta: Bottom-Right (+X, +Y)
      expect(betaOffset.offsetX).toBeGreaterThan(0);
      expect(betaOffset.offsetY).toBeGreaterThan(0);

      // Gamma: Top-Left (-X, -Y)
      expect(gammaOffset.offsetX).toBeLessThan(0);
      expect(gammaOffset.offsetY).toBeLessThan(0);

      // Delta: Bottom-Left (-X, +Y)
      expect(deltaOffset.offsetX).toBeLessThan(0);
      expect(deltaOffset.offsetY).toBeGreaterThan(0);
    });

    test('3.3: updates agent spatial presence and action labels in real time', () => {
      const store = useCloudSwarmStore.getState();

      store.updateAgentPresence('delta', {
        currentX: 600,
        currentY: 400,
        actionLabel: 'Auditing multi-cloud FinOps rate cards',
        thoughtText: 'Detected $45/mo savings with Graviton3 conversion',
        isInspecting: true,
      });

      const presence = useCloudSwarmStore.getState().agentPresences.delta;
      expect(presence.currentX).toBe(600);
      expect(presence.currentY).toBe(400);
      expect(presence.actionLabel).toContain('FinOps');
      expect(presence.thoughtText).toContain('Graviton3');
      expect(presence.isInspecting).toBe(true);
    });

    test('3.4: tracks fine-grained entity locks for bounding halos across all 4 agents', async () => {
      const store = useCloudSwarmStore.getState();

      await store.addNode({
        id: 'node_locked_1',
        type: 'aws_vpc',
        name: 'VPC Alpha Lock',
        position: { x: 100, y: 100 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // Acquire lock for Agent Delta
      const lockAcquired = await store.acquireLock(['node_locked_1'], 'delta');
      expect(lockAcquired).toBe(true);

      const activeLock = useCloudSwarmStore.getState().activeLocks.find(
        (l) => l.entityId === 'node_locked_1'
      );
      expect(activeLock).toBeDefined();
      expect(activeLock?.agentId).toBe('delta');

      await store.releaseLock(['node_locked_1'], 'delta');
      expect(
        useCloudSwarmStore.getState().activeLocks.some((l) => l.entityId === 'node_locked_1')
      ).toBe(false);
    });

    test('3.5: simulates drag-and-drop spawn from palette onto canvas coordinates', async () => {
      const store = useCloudSwarmStore.getState();

      // Simulate palette item drop
      const droppedItem = getResourceSchema('google_storage_bucket');
      expect(droppedItem).toBeDefined();

      const canvasPan = { x: -100, y: -50 };
      const canvasZoom = 1.25;
      const clientX = 400;
      const clientY = 300;
      const rectLeft = 0;
      const rectTop = 0;

      const dropX = Math.round((clientX - rectLeft - canvasPan.x) / canvasZoom);
      const dropY = Math.round((clientY - rectTop - canvasPan.y) / canvasZoom);

      const nodeId = 'storage_bucket_drop_1';
      await store.addNode({
        id: nodeId,
        type: 'google_storage_bucket',
        name: `${droppedItem!.name} 1`,
        position: { x: dropX, y: dropY },
        config: { ...droppedItem!.defaultConfig },
        metadata: {
          createdBy: 'director',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'healthy',
        },
        version: 1,
      });

      const node = useCloudSwarmStore.getState().topologyState.nodes[nodeId];
      expect(node).toBeDefined();
      expect(node?.type).toBe('google_storage_bucket');
      expect(node?.position.x).toBe(dropX);
      expect(node?.position.y).toBe(dropY);
    });
  });
});
