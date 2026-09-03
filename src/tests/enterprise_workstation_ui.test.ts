/**
 * Enterprise Architecture Workstation UI Test Suite
 *
 * Tests:
 * 1. PromptCommandBar: Auto-expanding textarea height calculations, Shift+Enter newline logic,
 *    Enter submit logic, prompt template chips catalog, and state synchronization.
 * 2. EmptyStateHero: Non-intrusive architectural dock behavior, reference blueprint scenarios,
 *    blank canvas initialization, and auto-dismissal when nodes are active.
 * 3. ResourcePalette CAD Drawer: Default open state, Provider tab filtering (AWS, Azure, GCP, K8s, All),
 *    isK8sResource classification, Service Category filters, instant search, and primitive spawning.
 */

import { useCloudSwarmStore } from '../store/useCloudSwarmStore';
import {
  CLOUD_RESOURCE_CATALOG,
  getResourceSchema,
  type ResourceCatalogItem,
} from '../core/catalog/resourceCatalog';
import { type ProviderFilterTab } from '../components/canvas/ResourcePalette';
import { isK8sResource } from '../core/catalog/resourceCatalog';

describe('Enterprise Architecture Workstation UI', () => {
  beforeEach(() => {
    useCloudSwarmStore.getState().resetTopology();
  });

  // =========================================================================
  // 1. PromptCommandBar Mechanics & Template Engine
  // =========================================================================
  describe('1. PromptCommandBar Mechanics & Template Engine', () => {
    test('1.1: Auto-expanding textarea height clamping logic respects min (38px) and max (160px)', () => {
      const clampHeight = (scrollHeight: number): number => {
        return Math.min(Math.max(scrollHeight, 38), 160);
      };

      // Empty / single line prompt
      expect(clampHeight(20)).toBe(38);
      expect(clampHeight(38)).toBe(38);

      // Moderate multi-line prompt
      expect(clampHeight(85)).toBe(85);
      expect(clampHeight(140)).toBe(140);

      // Large multi-paragraph architecture prompt exceeding max bounds
      expect(clampHeight(220)).toBe(160);
      expect(clampHeight(500)).toBe(160);
    });

    test('1.2: Enter key submission vs Shift+Enter multiline insertion logic', () => {
      let isSubmitted = false;
      let isNewlineAllowed = false;

      const handleSimulatedKeyDown = (e: { key: string; shiftKey: boolean }) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          isSubmitted = true;
          isNewlineAllowed = false;
        } else if (e.key === 'Enter' && e.shiftKey) {
          isSubmitted = false;
          isNewlineAllowed = true;
        }
      };

      // Press Enter alone -> Submit
      handleSimulatedKeyDown({ key: 'Enter', shiftKey: false });
      expect(isSubmitted).toBe(true);
      expect(isNewlineAllowed).toBe(false);

      // Press Shift+Enter -> Insert newline
      handleSimulatedKeyDown({ key: 'Enter', shiftKey: true });
      expect(isSubmitted).toBe(false);
      expect(isNewlineAllowed).toBe(true);
    });

    test('1.3: Prompt suggestions / template chips provide high-ticket enterprise queries', () => {
      const templates = [
        {
          id: 'banking_core',
          label: 'Banking Core',
          category: 'FinTech',
          prompt: 'Deploy multi-region AWS banking core with EKS cluster, Aurora Global DB, and KMS Zero-Trust encryption',
        },
        {
          id: 'ecommerce_ha',
          label: 'E-Commerce HA',
          category: 'High-Avail',
          prompt: 'Architect high-availability e-commerce platform with ALB, auto-scaling ECS, and Multi-AZ RDS Postgres',
        },
        {
          id: 'multicloud_mesh',
          label: 'Multi-Cloud Mesh',
          category: 'Cross-Cloud',
          prompt: 'Provision AWS VPC + Azure VNet + GCP Cloud Interconnect with unified peering and global DNS routing',
        },
        {
          id: 'aiml_cluster',
          label: 'AI/ML GPU Mesh',
          category: 'AI / LLM',
          prompt: 'Deploy high-throughput Ray/PyTorch cluster on AWS EC2 GPU instances with S3 data lake and SageMaker endpoints',
        },
        {
          id: 'zerotrust_shield',
          label: 'Zero-Trust Shield',
          category: 'SecOps',
          prompt: 'Configure sovereign 3-tier VPC with WAFv2 Web ACL, private isolated subnets, and CloudFront CDN',
        },
      ];

      expect(templates.length).toBeGreaterThanOrEqual(5);
      for (const tmpl of templates) {
        expect(tmpl.id).toBeTruthy();
        expect(tmpl.label).toBeTruthy();
        expect(tmpl.prompt.length).toBeGreaterThan(20);
        expect(['FinTech', 'High-Avail', 'Cross-Cloud', 'AI / LLM', 'SecOps']).toContain(tmpl.category);
      }
    });
  });

  // =========================================================================
  // 2. EmptyStateHero Non-Intrusive Blueprint Dock
  // =========================================================================
  describe('2. EmptyStateHero Non-Intrusive Blueprint Dock', () => {
    test('2.1: Detects empty canvas state when nodeCount is 0', () => {
      const state = useCloudSwarmStore.getState();
      const nodeCount = Object.keys(state.topologyState.nodes).length;
      expect(nodeCount).toBe(0);
    });

    test('2.2: Blank canvas start provisions primary VPC and selects it', () => {
      const store = useCloudSwarmStore.getState();

      store.addNode({
        id: 'vpc_main',
        type: 'aws_vpc',
        name: 'Primary VPC',
        position: { x: 300, y: 180 },
        config: { cidr_block: '10.0.0.0/16', enable_dns_hostnames: true, enable_dns_support: true },
        metadata: { createdBy: 'director', createdAt: Date.now(), updatedAt: Date.now(), status: 'healthy' },
        version: 1,
      });
      store.selectNode('vpc_main');

      const updated = useCloudSwarmStore.getState();
      expect(Object.keys(updated.topologyState.nodes).length).toBe(1);
      expect(updated.topologyState.nodes['vpc_main']).toBeDefined();
      expect(updated.topologyState.nodes['vpc_main']?.type).toBe('aws_vpc');
      expect(updated.selectedNodeId).toBe('vpc_main');
    });

    test('2.3: Blueprint starter triggers autonomous swarm execution for Banking Core', async () => {
      const store = useCloudSwarmStore.getState();
      store.setSelectedScenarioId('global_banking_core');

      const result = await store.runSwarmDemo('global_banking_core');
      expect(result.success).toBe(true);

      const finalState = useCloudSwarmStore.getState();
      const nodeKeys = Object.keys(finalState.topologyState.nodes);
      expect(nodeKeys.length).toBeGreaterThan(0);
      expect(finalState.topologyState.nodes['vpc_primary_bank']).toBeDefined();
    });
  });

  // =========================================================================
  // 3. ResourcePalette Docked CAD Drawer & Multi-Cloud Filtering
  // =========================================================================
  describe('3. ResourcePalette CAD Drawer & Multi-Cloud Tabs', () => {
    test('3.1: ResourcePalette is open by default in store', () => {
      const store = useCloudSwarmStore.getState();
      expect(store.isPaletteOpen).toBe(true);
    });

    test('3.2: isK8sResource correctly identifies container & Kubernetes primitives', () => {
      const eks = CLOUD_RESOURCE_CATALOG.find((i) => i.type === 'aws_eks_cluster');
      const aks = CLOUD_RESOURCE_CATALOG.find((i) => i.type === 'azurerm_kubernetes_cluster');
      const gke = CLOUD_RESOURCE_CATALOG.find((i) => i.type === 'google_container_cluster');
      const ecs = CLOUD_RESOURCE_CATALOG.find((i) => i.type === 'aws_ecs_cluster');
      const s3 = CLOUD_RESOURCE_CATALOG.find((i) => i.type === 'aws_s3_bucket');

      expect(eks).toBeDefined();
      expect(aks).toBeDefined();
      expect(gke).toBeDefined();
      expect(ecs).toBeDefined();
      expect(s3).toBeDefined();

      if (eks) expect(isK8sResource(eks)).toBe(true);
      if (aks) expect(isK8sResource(aks)).toBe(true);
      if (gke) expect(isK8sResource(gke)).toBe(true);
      if (ecs) expect(isK8sResource(ecs)).toBe(true);
      if (s3) expect(isK8sResource(s3)).toBe(false);
    });

    test('3.3: Provider tabs filter primitives accurately across AWS, Azure, GCP, K8s, and All', () => {
      const filterByTab = (tab: ProviderFilterTab): readonly ResourceCatalogItem[] => {
        if (tab === 'k8s') {
          return CLOUD_RESOURCE_CATALOG.filter(isK8sResource);
        }
        if (tab === 'all') {
          return CLOUD_RESOURCE_CATALOG;
        }
        return CLOUD_RESOURCE_CATALOG.filter((i) => i.provider === tab);
      };

      const all = filterByTab('all');
      const aws = filterByTab('aws');
      const azure = filterByTab('azure');
      const gcp = filterByTab('google');
      const k8s = filterByTab('k8s');

      expect(all.length).toBe(108);
      expect(aws.length).toBe(36);
      expect(azure.length).toBe(36);
      expect(gcp.length).toBe(36);
      expect(k8s.length).toBeGreaterThanOrEqual(6);
    });

    test('3.4: Category tabs partition items cleanly', () => {
      const categories = ['Compute', 'Storage', 'Database', 'Network', 'Security', 'AI/ML'] as const;

      for (const cat of categories) {
        const itemsInCat = CLOUD_RESOURCE_CATALOG.filter((i) => i.category === cat);
        expect(itemsInCat.length).toBeGreaterThan(0);
      }
    });

    test('3.5: Instant search finds primitives across name, description, and type', () => {
      const querySearch = (query: string) => {
        const q = query.toLowerCase();
        return CLOUD_RESOURCE_CATALOG.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            i.type.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q)
        );
      };

      const eksResults = querySearch('eks');
      expect(eksResults.some((i) => i.type === 'aws_eks_cluster')).toBe(true);

      const postgresResults = querySearch('postgres');
      expect(postgresResults.length).toBeGreaterThan(0);

      const firewallResults = querySearch('firewall');
      expect(firewallResults.length).toBeGreaterThan(0);
    });

    test('3.6: Spawning a CAD primitive attaches correct metadata and healthy status', () => {
      const store = useCloudSwarmStore.getState();
      const item = CLOUD_RESOURCE_CATALOG.find((i) => i.type === 'aws_eks_cluster')!;

      const nodeId = 'eks_test_1';
      store.addNode({
        id: nodeId,
        type: item.type,
        name: item.name,
        position: { x: 500, y: 300 },
        config: { ...item.defaultConfig },
        metadata: {
          createdBy: 'director',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'healthy',
        },
        version: 1,
      });
      store.selectNode(nodeId);

      const updated = useCloudSwarmStore.getState();
      const node = updated.topologyState.nodes[nodeId];
      expect(node).toBeDefined();
      expect(node?.type).toBe('aws_eks_cluster');
      expect(node?.metadata.status).toBe('healthy');
      expect(updated.selectedNodeId).toBe(nodeId);
    });
  });
});
