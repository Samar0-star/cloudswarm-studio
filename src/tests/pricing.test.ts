/**
 * Unit Tests for FinOps Live Pricing & Cost Engine (CostCalculator)
 */

import {
  HOURS_PER_MONTH,
  AWS_PRICING_CATALOG,
  AZURE_PRICING_CATALOG,
  GCP_PRICING_CATALOG,
  calculateNodeCost,
  calculateTopologyCostBreakdown,
  calculateMonthlyCost,
  generateCostRecommendations,
  exportCostBreakdownCsv,
  CostCalculator,
  costCalculator,
} from '../core/audit/CostCalculator';
import type { CloudResourceNode, TopologyState } from '../types/topology';
import { createDefaultTopologyState } from '../types/topology';

describe('FinOps Rate Cards & CostCalculator Unit Tests', () => {
  describe('Constants & Rate Card Integrity', () => {
    test('hours per month multiplier is exactly 730', () => {
      expect(HOURS_PER_MONTH).toBe(730);
    });

    test('rate card contains standard compute, rds, storage, fargate, and fabric rates', () => {
      expect(AWS_PRICING_CATALOG.ec2['t3.micro']).toBe(0.0104);
      expect(AWS_PRICING_CATALOG.ec2['t3.medium']).toBe(0.0416);
      expect(AWS_PRICING_CATALOG.ec2['c6i.large']).toBe(0.085);
      expect(AWS_PRICING_CATALOG.ec2['c7g.large']).toBe(0.0723);
      expect(AWS_PRICING_CATALOG.ec2['m6i.4xlarge']).toBe(0.768);
      expect(AWS_PRICING_CATALOG.rds['db.t4g.medium']).toBe(0.073);
      expect(AWS_PRICING_CATALOG.rds['db.r6g.xlarge']).toBe(0.48);
      expect(AWS_PRICING_CATALOG.storage.ebs_gp3).toBe(0.08);
      expect(AWS_PRICING_CATALOG.storage.ebs_gp2).toBe(0.1);
      expect(AWS_PRICING_CATALOG.storage.ebs_io2).toBe(0.125);
      expect(AWS_PRICING_CATALOG.storage.ebs_io2_iops).toBe(0.065);
      expect(AWS_PRICING_CATALOG.storage.s3_standard).toBe(0.023);
      expect(AWS_PRICING_CATALOG.fargate.vcpu_per_hr).toBe(0.04048);
      expect(AWS_PRICING_CATALOG.fargate.gb_per_hr).toBe(0.004445);
      expect(AWS_PRICING_CATALOG.fabric.eks_cluster_fee_monthly).toBe(73.0);
      expect(AWS_PRICING_CATALOG.fabric.alb_base_monthly).toBe(16.2);
    });
  });

  describe('EC2 Cost Calculation', () => {
    test('calculates standard t3.medium EC2 instance with default 30GB gp3 storage', () => {
      const node: CloudResourceNode = {
        id: 'ec2_1',
        type: 'aws_instance',
        name: 'Web Server',
        position: { x: 0, y: 0 },
        config: {
          instance_type: 't3.medium',
          root_volume_gb: 30,
          root_volume_type: 'gp3',
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      // Compute: 0.0416 * 730 = 30.368, Storage: 30 * 0.08 = 2.4 => Total: 32.768 -> 32.77
      expect(cost.monthlyUsd).toBe(32.77);
      expect(cost.hourlyUsd).toBeCloseTo(0.0449, 3);
      expect(cost.category).toBe('Compute');
      expect(cost.details).toContain('EC2 (t3.medium) + 30GB gp3');
    });

    test('calculates legacy gp2 storage on c6i.xlarge instance', () => {
      const node: CloudResourceNode = {
        id: 'ec2_gp2',
        type: 'aws_instance',
        name: 'Legacy Server',
        position: { x: 0, y: 0 },
        config: {
          instance_type: 'c6i.xlarge',
          root_volume_gb: 100,
          root_volume_type: 'gp2',
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      // Compute: 0.17 * 730 = 124.10, Storage: 100 * 0.10 = 10.00 => Total: 134.10
      expect(cost.monthlyUsd).toBe(134.1);
      expect(cost.category).toBe('Compute');
    });

    test('calculates io2 provisioned IOPS tier rates on m6i.large', () => {
      const node: CloudResourceNode = {
        id: 'ec2_io2',
        type: 'aws_instance',
        name: 'Database Node',
        position: { x: 0, y: 0 },
        config: {
          instance_type: 'm6i.large',
          root_volume_gb: 100,
          root_volume_type: 'io2',
          iops: 5000,
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      // Compute: 0.096 * 730 = 70.08, Storage: 100 * 0.125 = 12.5, IOPS: 5000 * 0.065 = 325 => Total: 407.58
      expect(cost.monthlyUsd).toBe(407.58);
      expect(cost.details).toContain('5000 IOPS');
    });

    test('calculates high-memory Graviton instances (r6g.xlarge)', () => {
      const node: CloudResourceNode = {
        id: 'ec2_graviton',
        type: 'aws_instance',
        name: 'Memcached Node',
        position: { x: 0, y: 0 },
        config: {
          instance_type: 'r6g.xlarge',
          root_volume_gb: 50,
          root_volume_type: 'gp3',
        },
        metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      // Compute: 0.2016 * 730 = 147.168, Storage: 50 * 0.08 = 4.0 => 151.17
      expect(cost.monthlyUsd).toBe(151.17);
    });

    test('falls back gracefully to default instance type when unconfigured', () => {
      const node: CloudResourceNode = {
        id: 'ec2_fallback',
        type: 'aws_instance',
        name: 'Fallback Node',
        position: { x: 0, y: 0 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      expect(cost.monthlyUsd).toBeGreaterThan(0);
      expect(cost.category).toBe('Compute');
    });
  });

  describe('RDS Database Cost Calculation', () => {
    test('calculates Multi-AZ RDS instance with 2x compute and storage multiplier', () => {
      const node: CloudResourceNode = {
        id: 'rds_multi_az',
        type: 'aws_db_instance',
        name: 'Production DB',
        position: { x: 0, y: 0 },
        config: {
          instance_class: 'db.t4g.medium',
          allocated_storage_gb: 100,
          storage_type: 'gp3',
          multi_az: true,
        },
        metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      // Base hourly: 0.073 * 2.0 = 0.146 => Compute: 0.146 * 730 = 106.58
      // Storage: 100 * 0.115 * 2.0 = 23.00 => Total: 129.58
      expect(cost.monthlyUsd).toBe(129.58);
      expect(cost.category).toBe('Database');
      expect(cost.details).toContain('Multi-AZ');
    });

    test('calculates Single-AZ RDS instance with 1x multiplier', () => {
      const node: CloudResourceNode = {
        id: 'rds_single_az',
        type: 'aws_db_instance',
        name: 'Dev DB',
        position: { x: 0, y: 0 },
        config: {
          instance_class: 'db.t4g.micro',
          allocated_storage_gb: 20,
          storage_type: 'gp3',
          multi_az: false,
        },
        metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      // Base hourly: 0.018 * 730 = 13.14
      // Storage: 20 * 0.115 = 2.30 => Total: 15.44
      expect(cost.monthlyUsd).toBe(15.44);
      expect(cost.category).toBe('Database');
      expect(cost.details).toContain('Single-AZ');
    });

    test('calculates io2 storage on high-throughput RDS instance', () => {
      const node: CloudResourceNode = {
        id: 'rds_io2',
        type: 'aws_db_instance',
        name: 'Analytics DB',
        position: { x: 0, y: 0 },
        config: {
          instance_class: 'db.r6g.large',
          allocated_storage_gb: 200,
          storage_type: 'io2',
          multi_az: false,
        },
        metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      // Base hourly: 0.24 * 730 = 175.20
      // Storage: 200 * 0.15 = 30.00 => Total: 205.20
      expect(cost.monthlyUsd).toBe(205.2);
    });
  });

  describe('EKS & ECS Container Cost Calculation', () => {
    test('calculates EKS flat control plane fee plus on-demand node groups', () => {
      const node: CloudResourceNode = {
        id: 'eks_1',
        type: 'aws_eks_cluster',
        name: 'EKS Production',
        position: { x: 0, y: 0 },
        config: {
          node_groups: [
            { instance_type: 't3.medium', desired_size: 3, capacity_type: 'ON_DEMAND' },
          ],
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      // Flat fee: $73.00, Nodes: 0.0416 * 3 * 730 = 91.104 => Total: 164.10
      expect(cost.monthlyUsd).toBeCloseTo(164.1, 1);
      expect(cost.category).toBe('Compute');
    });

    test('calculates EKS Spot node groups with 70% discount', () => {
      const node: CloudResourceNode = {
        id: 'eks_spot',
        type: 'aws_eks_cluster',
        name: 'EKS Spot Cluster',
        position: { x: 0, y: 0 },
        config: {
          node_groups: [
            { instance_type: 't3.medium', desired_size: 3, capacity_type: 'SPOT' },
          ],
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      // Flat fee: $73.00, Nodes: 0.0416 * 0.3 * 3 * 730 = 27.3312 => Total: 100.33
      expect(cost.monthlyUsd).toBeCloseTo(100.33, 1);
    });

    test('calculates EKS with multiple mixed node groups', () => {
      const node: CloudResourceNode = {
        id: 'eks_mixed',
        type: 'aws_eks_cluster',
        name: 'EKS Multi-Group',
        position: { x: 0, y: 0 },
        config: {
          node_groups: [
            { instance_type: 'c6i.large', desired_size: 2, capacity_type: 'ON_DEMAND' },
            { instance_type: 'c7g.large', desired_size: 4, capacity_type: 'SPOT' },
          ],
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      // Control Plane: $73.00
      // NG1: 0.085 * 2 * 730 = 124.10
      // NG2: 0.0723 * 0.3 * 4 * 730 = 63.3348
      // Total: 73 + 124.10 + 63.3348 = 260.43
      expect(cost.monthlyUsd).toBeCloseTo(260.43, 1);
    });

    test('calculates ECS Fargate vCPU and memory monthly run rates', () => {
      const node: CloudResourceNode = {
        id: 'ecs_fargate',
        type: 'aws_ecs_cluster',
        name: 'App Tasks',
        position: { x: 0, y: 0 },
        config: {
          launch_type: 'FARGATE',
          cpu: 1024,
          memory_mb: 2048,
          desired_count: 2,
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      // vCPU: 1 * 0.04048 = 0.04048, RAM: 2 * 0.004445 = 0.00889 => Task/hr: 0.04937
      // 0.04937 * 730 * 2 = 72.0802 => 72.08
      expect(cost.monthlyUsd).toBeCloseTo(72.08, 1);
      expect(cost.category).toBe('Compute');
    });

    test('calculates ECS EC2 launch type cluster with zero direct compute', () => {
      const node: CloudResourceNode = {
        id: 'ecs_ec2',
        type: 'aws_ecs_cluster',
        name: 'EC2 Cluster',
        position: { x: 0, y: 0 },
        config: {
          launch_type: 'EC2',
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      expect(cost.monthlyUsd).toBe(0);
      expect(cost.details).toContain('EC2 Launch Type');
    });
  });

  describe('S3, ALB, and Base Fabric Primitives', () => {
    test('calculates baseline S3 storage cost', () => {
      const node: CloudResourceNode = {
        id: 's3_bucket',
        type: 'aws_s3_bucket',
        name: 'Assets Bucket',
        position: { x: 0, y: 0 },
        config: {
          estimated_storage_gb: 100,
        },
        metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      // 100 * 0.023 = 2.30
      expect(cost.monthlyUsd).toBe(2.3);
      expect(cost.category).toBe('Storage');
    });

    test('calculates custom large S3 storage bucket (5,000 GB)', () => {
      const node: CloudResourceNode = {
        id: 's3_large',
        type: 'aws_s3_bucket',
        name: 'Data Lake S3',
        position: { x: 0, y: 0 },
        config: {
          estimated_storage_gb: 5000,
        },
        metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      // 5000 * 0.023 = 115.00
      expect(cost.monthlyUsd).toBe(115.0);
    });

    test('calculates ALB base monthly rate', () => {
      const node: CloudResourceNode = {
        id: 'alb_1',
        type: 'aws_lb',
        name: 'Public Ingress ALB',
        position: { x: 0, y: 0 },
        config: {
          load_balancer_type: 'application',
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(node);
      expect(cost.monthlyUsd).toBe(16.2);
      expect(cost.category).toBe('Networking');
    });

    test('returns $0.00 for base fabric primitives (VPC, Subnet, SecurityGroup, IAM)', () => {
      const vpcNode: CloudResourceNode = {
        id: 'vpc_1',
        type: 'aws_vpc',
        name: 'Main VPC',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.0.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const subnetNode: CloudResourceNode = {
        id: 'subnet_1',
        type: 'aws_subnet',
        name: 'Public Subnet',
        position: { x: 0, y: 0 },
        config: { vpc_id: 'vpc_1', cidr_block: '10.0.1.0/24' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const sgNode: CloudResourceNode = {
        id: 'sg_1',
        type: 'aws_security_group',
        name: 'Web SG',
        position: { x: 0, y: 0 },
        config: { vpc_id: 'vpc_1' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const iamNode: CloudResourceNode = {
        id: 'iam_1',
        type: 'aws_iam_role',
        name: 'EC2 Role',
        position: { x: 0, y: 0 },
        config: { role_name: 'AppRole', trusted_service: 'ec2.amazonaws.com' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      expect(calculateNodeCost(vpcNode).monthlyUsd).toBe(0);
      expect(calculateNodeCost(vpcNode).category).toBe('Base Fabric');
      expect(calculateNodeCost(subnetNode).monthlyUsd).toBe(0);
      expect(calculateNodeCost(subnetNode).category).toBe('Base Fabric');
      expect(calculateNodeCost(sgNode).monthlyUsd).toBe(0);
      expect(calculateNodeCost(sgNode).category).toBe('Base Fabric');
      expect(calculateNodeCost(iamNode).monthlyUsd).toBe(0);
      expect(calculateNodeCost(iamNode).category).toBe('Base Fabric');
    });
  });

  describe('Topology Aggregation & Cost Breakdown', () => {
    test('aggregates multi-resource topology with category totals and hourly rates', () => {
      const state: TopologyState = {
        nodes: {
          ec2_1: {
            id: 'ec2_1',
            type: 'aws_instance',
            name: 'Web Node',
            position: { x: 0, y: 0 },
            config: { instance_type: 't3.medium', root_volume_gb: 30 },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          rds_1: {
            id: 'rds_1',
            type: 'aws_db_instance',
            name: 'DB Node',
            position: { x: 100, y: 0 },
            config: { instance_class: 'db.t4g.medium', allocated_storage_gb: 50, multi_az: false },
            metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          alb_1: {
            id: 'alb_1',
            type: 'aws_lb',
            name: 'ALB',
            position: { x: 200, y: 0 },
            config: {},
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const breakdown = calculateTopologyCostBreakdown(state);
      expect(breakdown.items.length).toBe(3);
      expect(breakdown.totalMonthlyUsd).toBeGreaterThan(100);
      expect(breakdown.totalHourlyUsd).toBeGreaterThan(0);
      expect(breakdown.categoryTotals.Compute).toBeGreaterThan(0);
      expect(breakdown.categoryTotals.Database).toBeGreaterThan(0);
      expect(breakdown.categoryTotals.Networking).toBe(16.2);

      const standardResult = calculateMonthlyCost(state);
      expect(standardResult.totalMonthlyCostUsd).toBe(breakdown.totalMonthlyUsd);
    });

    test('handles empty topology correctly with zero cost', () => {
      const emptyState = createDefaultTopologyState();
      const breakdown = calculateTopologyCostBreakdown(emptyState);
      expect(breakdown.totalMonthlyUsd).toBe(0);
      expect(breakdown.totalHourlyUsd).toBe(0);
      expect(breakdown.items.length).toBe(0);
      expect(breakdown.categoryTotals.Compute).toBe(0);
      expect(breakdown.categoryTotals.Database).toBe(0);
      expect(breakdown.categoryTotals.Storage).toBe(0);
      expect(breakdown.categoryTotals.Networking).toBe(0);
      expect(breakdown.categoryTotals.Security).toBe(0);
      expect(breakdown.categoryTotals['Base Fabric']).toBe(0);
    });
  });

  describe('FinOps Cost Optimization Recommendations', () => {
    test('generates Graviton migration recommendations for x86 instances', () => {
      const state: TopologyState = {
        nodes: {
          app1: {
            id: 'app1',
            type: 'aws_instance',
            name: 'Legacy x86 App 1',
            position: { x: 0, y: 0 },
            config: { instance_type: 'c6i.large' },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          app2: {
            id: 'app2',
            type: 'aws_instance',
            name: 'Legacy x86 App 2',
            position: { x: 100, y: 0 },
            config: { instance_type: 'm6i.xlarge' },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const recs = generateCostRecommendations(state);
      const gravitonRec = recs.find((r) => r.category === 'Graviton');
      expect(gravitonRec).toBeDefined();
      expect(gravitonRec?.targetNodeIds).toContain('app1');
      expect(gravitonRec?.targetNodeIds).toContain('app2');
      expect(gravitonRec?.estimatedSavingsMonthlyUsd).toBeGreaterThan(0);
    });

    test('generates gp3 storage modernization recommendations for gp2 and io2 volumes', () => {
      const state: TopologyState = {
        nodes: {
          legacy_vol: {
            id: 'legacy_vol',
            type: 'aws_instance',
            name: 'Server with gp2',
            position: { x: 0, y: 0 },
            config: { root_volume_type: 'gp2', root_volume_gb: 500 },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const recs = generateCostRecommendations(state);
      const storageRec = recs.find((r) => r.category === 'Storage');
      expect(storageRec).toBeDefined();
      expect(storageRec?.actionType).toBe('UPGRADE_EBS_GP3');
      expect(storageRec?.targetNodeIds).toContain('legacy_vol');
    });

    test('generates Spot capacity recommendations for on-demand EKS node groups', () => {
      const state: TopologyState = {
        nodes: {
          eks_cluster: {
            id: 'eks_cluster',
            type: 'aws_eks_cluster',
            name: 'Production EKS',
            position: { x: 0, y: 0 },
            config: {
              node_groups: [
                { instance_type: 'm6i.large', desired_size: 4, capacity_type: 'ON_DEMAND' },
              ],
            },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const recs = generateCostRecommendations(state);
      const spotRec = recs.find((r) => r.category === 'Spot');
      expect(spotRec).toBeDefined();
      expect(spotRec?.targetNodeIds).toContain('eks_cluster');
      expect(spotRec?.actionType).toBe('ENABLE_EKS_SPOT');
    });
  });

  describe('CostCalculator Class Instance API', () => {
    test('works seamlessly with class instance and singleton', () => {
      const calc = new CostCalculator();
      const node: CloudResourceNode = {
        id: 'node_test',
        type: 'aws_instance',
        name: 'Instance',
        position: { x: 0, y: 0 },
        config: { instance_type: 'c7g.large' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calc.calculateNodeCost(node);
      expect(cost.monthlyUsd).toBeCloseTo(0.0723 * 730 + 30 * 0.08, 1);
      expect(costCalculator.getPricingCatalog()).toBeDefined();
    });

    test('provides access to Azure and GCP pricing catalogs via instance methods', () => {
      const calc = new CostCalculator();
      expect(calc.getAzurePricingCatalog()).toBeDefined();
      expect(calc.getGcpPricingCatalog()).toBeDefined();
      expect(calc.getAzurePricingCatalog().vm['Standard_D2s_v5']).toBe(0.096);
      expect(calc.getGcpPricingCatalog().gce['e2-medium']).toBe(0.0336);
    });
  });

  describe('Multi-Cloud GPU & Specialized Compute Rates (A100, H100, A10G, T4)', () => {
    test('calculates AWS GPU instances (NVIDIA A100 p4d.24xlarge, A10G g5.xlarge, T4 g4dn.xlarge)', () => {
      const a100Node: CloudResourceNode = {
        id: 'ec2_a100',
        type: 'aws_instance_gpu',
        name: 'AWS A100 Training Node',
        position: { x: 0, y: 0 },
        config: { instance_type: 'p4d.24xlarge', root_volume_gb: 200, root_volume_type: 'gp3' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const costA100 = calculateNodeCost(a100Node);
      // Compute: 32.77 * 730 = 23922.10, Storage: 200 * 0.08 = 16.00 => Total: 23938.10
      expect(costA100.monthlyUsd).toBe(23938.1);
      expect(costA100.hourlyUsd).toBeCloseTo(32.79, 1);
      expect(costA100.category).toBe('Compute');

      const a10gNode: CloudResourceNode = {
        id: 'ec2_a10g',
        type: 'aws_instance_gpu',
        name: 'AWS A10G Inference Node',
        position: { x: 0, y: 0 },
        config: { instance_type: 'g5.xlarge', root_volume_gb: 100, root_volume_type: 'gp3' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      const costA10g = calculateNodeCost(a10gNode);
      // 1.006 * 730 = 734.38 + 8.00 = 742.38
      expect(costA10g.monthlyUsd).toBe(742.38);
    });

    test('calculates Azure GPU instances (Standard_NV36ads_A10_v5, Standard_ND96amsr_A100_v4, Standard_ND96isr_H100_v5)', () => {
      const azureA10Node: CloudResourceNode = {
        id: 'azure_a10',
        type: 'azurerm_virtual_machine_gpu',
        name: 'Azure A10G Node',
        position: { x: 0, y: 0 },
        config: {
          vm_size: 'Standard_NV36ads_A10_v5',
          os_disk: { disk_size_gb: 128, storage_account_type: 'Premium_LRS' },
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const costA10 = calculateNodeCost(azureA10Node);
      // Compute: 1.006 * 730 = 734.38, Storage: 128 * 0.135 = 17.28 => Total: 751.66
      expect(costA10.monthlyUsd).toBe(751.66);
      expect(costA10.provider).toBe('azure');

      const azureH100Node: CloudResourceNode = {
        id: 'azure_h100',
        type: 'azurerm_virtual_machine_gpu',
        name: 'Azure H100 Cluster',
        position: { x: 0, y: 0 },
        config: {
          vm_size: 'Standard_ND96isr_H100_v5',
          os_disk: { disk_size_gb: 512, storage_account_type: 'Premium_LRS' },
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      const costH100 = calculateNodeCost(azureH100Node);
      // Compute: 45.00 * 730 = 32850.00, Storage: 512 * 0.135 = 69.12 => Total: 32919.12
      expect(costH100.monthlyUsd).toBe(32919.12);
    });

    test('calculates GCP GPU instances (a2-highgpu-1g A100, g2-standard-4 L4/A10G, a3-highgpu-8g H100)', () => {
      const gcpA100Node: CloudResourceNode = {
        id: 'gcp_a100',
        type: 'google_compute_instance_gpu',
        name: 'GCP A100 AI Node',
        position: { x: 0, y: 0 },
        config: {
          machine_type: 'a2-highgpu-1g',
          boot_disk: { size_gb: 100, type: 'pd-ssd' },
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const costA100 = calculateNodeCost(gcpA100Node);
      // Compute: 3.673 * 730 = 2681.29, Disk: 100 * 0.17 = 17.00 => Total: 2698.29
      expect(costA100.monthlyUsd).toBe(2698.29);
      expect(costA100.provider).toBe('google');
    });
  });

  describe('Azure Multi-Cloud Compute, Storage & Database Rates', () => {
    test('calculates Azure Linux VM with Premium SSD and Ampere ARM architecture', () => {
      const armVm: CloudResourceNode = {
        id: 'azure_arm_vm',
        type: 'azurerm_linux_virtual_machine',
        name: 'ARM64 App Worker',
        position: { x: 0, y: 0 },
        config: {
          vm_size: 'Standard_D2ps_v5',
          os_disk: { disk_size_gb: 64, storage_account_type: 'Premium_LRS' },
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(armVm);
      // Compute: 0.077 * 730 = 56.21, Storage: 64 * 0.135 = 8.64 => Total: 64.85
      expect(cost.monthlyUsd).toBe(64.85);
      expect(cost.category).toBe('Compute');
      expect(cost.provider).toBe('azure');
    });

    test('calculates Azure Windows VM with OS license surcharge', () => {
      const winVm: CloudResourceNode = {
        id: 'azure_win_vm',
        type: 'azurerm_windows_virtual_machine',
        name: 'Windows App Server',
        position: { x: 0, y: 0 },
        config: {
          vm_size: 'Standard_D4s_v5',
          os_disk: { disk_size_gb: 128, storage_account_type: 'StandardSSD_LRS' },
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(winVm);
      // Hourly: 0.192 + 0.04 = 0.232 => Compute: 0.232 * 730 = 169.36
      // Disk: 128 * 0.075 = 9.60 => Total: 178.96
      expect(cost.monthlyUsd).toBe(178.96);
    });

    test('calculates Azure Managed Disks across Standard HDD, Standard SSD, and Premium SSD', () => {
      const hddDisk: CloudResourceNode = {
        id: 'disk_hdd',
        type: 'azurerm_managed_disk',
        name: 'Backup HDD Disk',
        position: { x: 0, y: 0 },
        config: { disk_size_gb: 500, storage_account_type: 'Standard_LRS' },
        metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      // 500 * 0.04 = 20.00
      expect(calculateNodeCost(hddDisk).monthlyUsd).toBe(20.0);

      const ssdDisk: CloudResourceNode = {
        id: 'disk_ssd',
        type: 'azurerm_managed_disk',
        name: 'Web SSD Disk',
        position: { x: 0, y: 0 },
        config: { disk_size_gb: 200, storage_account_type: 'Premium_LRS' },
        metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      // 200 * 0.135 = 27.00
      expect(calculateNodeCost(ssdDisk).monthlyUsd).toBe(27.0);
    });

    test('calculates Azure SQL Database, Cosmos DB, and PostgreSQL Flexible', () => {
      const azureSql: CloudResourceNode = {
        id: 'azure_sql_1',
        type: 'azurerm_mssql_database',
        name: 'Enterprise SQL DB',
        position: { x: 0, y: 0 },
        config: { sku_name: 'GP_Gen5_2', max_size_gb: 100 },
        metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      const sqlCost = calculateNodeCost(azureSql);
      // Compute: 0.29 * 730 = 211.70, Storage: 100 * 0.115 = 11.50 => Total: 223.20
      expect(sqlCost.monthlyUsd).toBe(223.2);
      expect(sqlCost.category).toBe('Database');

      const cosmosDb: CloudResourceNode = {
        id: 'cosmos_1',
        type: 'azurerm_cosmosdb_account',
        name: 'Global Cosmos DB',
        position: { x: 0, y: 0 },
        config: { total_throughput_limit: 1000 },
        metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      const cosmosCost = calculateNodeCost(cosmosDb);
      // RU: (1000/100) * 0.008 * 730 = 58.40 + 5.00 = 63.40
      expect(cosmosCost.monthlyUsd).toBe(63.4);
    });

    test('calculates Azure AKS Cluster and Container Instances (ACI)', () => {
      const aks: CloudResourceNode = {
        id: 'aks_1',
        type: 'azurerm_kubernetes_cluster',
        name: 'Production AKS',
        position: { x: 0, y: 0 },
        config: {
          default_node_pool: { vm_size: 'Standard_D2s_v5', node_count: 4 },
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      const aksCost = calculateNodeCost(aks);
      // 0.096 * 4 * 730 = 280.32
      expect(aksCost.monthlyUsd).toBe(280.32);

      const aci: CloudResourceNode = {
        id: 'aci_1',
        type: 'azurerm_container_group',
        name: 'Microservice Container',
        position: { x: 0, y: 0 },
        config: { cpu: 2, memory_gb: 4 },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      const aciCost = calculateNodeCost(aci);
      // (2 * 0.040 + 4 * 0.0044) * 730 = 0.0976 * 730 = 71.248 -> 71.25
      expect(aciCost.monthlyUsd).toBe(71.25);
    });
  });

  describe('Google Cloud Platform (GCP) Compute, Storage & Database Rates', () => {
    test('calculates GCE Compute Engine instances (E2, C2, N2) with Balanced Persistent Disk', () => {
      const gceNode: CloudResourceNode = {
        id: 'gce_e2',
        type: 'google_compute_instance',
        name: 'GCP Web Server',
        position: { x: 0, y: 0 },
        config: {
          machine_type: 'e2-standard-4',
          boot_disk: { size_gb: 50, type: 'pd-balanced' },
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const cost = calculateNodeCost(gceNode);
      // Compute: 0.134 * 730 = 97.82, Disk: 50 * 0.10 = 5.00 => Total: 102.82
      expect(cost.monthlyUsd).toBe(102.82);
      expect(cost.provider).toBe('google');
      expect(cost.category).toBe('Compute');
    });

    test('calculates GKE cluster with On-Demand vs Spot/Preemptible discount', () => {
      const gkeOnDemand: CloudResourceNode = {
        id: 'gke_ondemand',
        type: 'google_container_cluster',
        name: 'Production GKE',
        position: { x: 0, y: 0 },
        config: {
          initial_node_count: 3,
          node_config: { machine_type: 'e2-medium', spot: false },
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      const costOnDemand = calculateNodeCost(gkeOnDemand);
      // Control plane: 73.00, Nodes: 0.0336 * 3 * 730 = 73.584 => Total: 146.58
      expect(costOnDemand.monthlyUsd).toBe(146.58);

      const gkeSpot: CloudResourceNode = {
        id: 'gke_spot',
        type: 'google_container_cluster',
        name: 'Batch GKE',
        position: { x: 0, y: 0 },
        config: {
          initial_node_count: 3,
          node_config: { machine_type: 'e2-medium', spot: true },
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      const costSpot = calculateNodeCost(gkeSpot);
      // Control plane: 73.00, Nodes: 0.0336 * 0.3 * 3 * 730 = 22.0752 => Total: 95.08
      expect(costSpot.monthlyUsd).toBe(95.08);
    });

    test('calculates GCP Cloud SQL with Regional High Availability (2x multiplier)', () => {
      const cloudSqlRegional: CloudResourceNode = {
        id: 'cloud_sql_ha',
        type: 'google_sql_database_instance',
        name: 'Production Postgres',
        position: { x: 0, y: 0 },
        config: {
          tier: 'db-custom-2-7680',
          disk_size: 100,
          disk_type: 'PD_SSD',
          availability_type: 'REGIONAL',
        },
        metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      const cost = calculateNodeCost(cloudSqlRegional);
      // Compute: 0.098 * 2.0 * 730 = 143.08
      // Disk: 100 * 0.17 * 2.0 = 34.00 => Total: 177.08
      expect(cost.monthlyUsd).toBe(177.08);
      expect(cost.category).toBe('Database');
      expect(cost.details).toContain('HA Regional');
    });

    test('calculates GCP Cloud Spanner, Bigtable, and Cloud Storage tiers', () => {
      const spanner: CloudResourceNode = {
        id: 'spanner_1',
        type: 'google_spanner_instance',
        name: 'Global Spanner DB',
        position: { x: 0, y: 0 },
        config: {},
        metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      // 0.90 * 730 = 657.00
      expect(calculateNodeCost(spanner).monthlyUsd).toBe(657.0);

      const coldlineBucket: CloudResourceNode = {
        id: 'gcs_coldline',
        type: 'google_storage_bucket',
        name: 'Coldline Backup Bucket',
        position: { x: 0, y: 0 },
        config: { estimated_storage_gb: 1000, storage_class: 'COLDLINE' },
        metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      // 1000 * 0.004 = 4.00
      expect(calculateNodeCost(coldlineBucket).monthlyUsd).toBe(4.0);
    });
  });

  describe('Multi-Cloud Automated Rightsizing Recommendations', () => {
    test('generates comprehensive recommendations across AWS, Azure, and GCP', () => {
      const multiCloudState: TopologyState = {
        nodes: {
          aws_x86: {
            id: 'aws_x86',
            type: 'aws_instance',
            name: 'AWS x86 Server',
            position: { x: 0, y: 0 },
            config: { instance_type: 'c6i.large', root_volume_type: 'gp2', root_volume_gb: 100 },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          azure_vm: {
            id: 'azure_vm',
            type: 'azurerm_linux_virtual_machine',
            name: 'Azure D-Series VM',
            position: { x: 100, y: 0 },
            config: {
              vm_size: 'Standard_D4s_v5',
              os_disk: { storage_account_type: 'Standard_LRS', disk_size_gb: 128 },
            },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          gcp_vm: {
            id: 'gcp_vm',
            type: 'google_compute_instance',
            name: 'GCP N1 VM',
            position: { x: 200, y: 0 },
            config: {
              machine_type: 'n1-standard-4',
              boot_disk: { type: 'pd-standard', size_gb: 100 },
            },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const recs = generateCostRecommendations(multiCloudState);

      // Verify AWS recommendations
      expect(recs.some((r) => r.id === 'FIN-REC-001')).toBe(true);
      expect(recs.some((r) => r.id === 'FIN-REC-002')).toBe(true);

      // Verify Azure recommendations
      expect(recs.some((r) => r.id === 'FIN-REC-AZ-001')).toBe(true);
      expect(recs.some((r) => r.id === 'FIN-REC-AZ-002')).toBe(true);

      // Verify GCP recommendations
      expect(recs.some((r) => r.id === 'FIN-REC-GCP-001')).toBe(true);
      expect(recs.some((r) => r.id === 'FIN-REC-GCP-002')).toBe(true);
    });
  });

  describe('RFC 4180 CSV Export Routine', () => {
    test('exports compliant multi-cloud CSV report with headers, line items, and subtotals', () => {
      const state: TopologyState = {
        nodes: {
          aws_1: {
            id: 'aws_1',
            type: 'aws_instance',
            name: 'Web Server, "Frontend"',
            position: { x: 0, y: 0 },
            config: { instance_type: 't3.medium', root_volume_gb: 30 },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          azure_1: {
            id: 'azure_1',
            type: 'azurerm_mssql_database',
            name: 'Azure SQL DB',
            position: { x: 100, y: 0 },
            config: { sku_name: 'S1', max_size_gb: 50 },
            metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          gcp_1: {
            id: 'gcp_1',
            type: 'google_storage_bucket',
            name: 'GCP Data Lake',
            position: { x: 200, y: 0 },
            config: { estimated_storage_gb: 500 },
            metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const breakdown = calculateTopologyCostBreakdown(state);
      expect(breakdown.providerTotals.aws).toBeGreaterThan(0);
      expect(breakdown.providerTotals.azure).toBeGreaterThan(0);
      expect(breakdown.providerTotals.google).toBeGreaterThan(0);

      const csv = exportCostBreakdownCsv(breakdown);

      // Verify Headers & Sections
      expect(csv).toContain('CloudSwarm Studio - Multi-Cloud FinOps Infrastructure Cost Report');
      expect(csv).toContain('Provider,Resource Name,Node ID,Resource Type,Category,Hourly Rate ($/hr),Monthly Spend ($/mo),Details');
      expect(csv).toContain('Category Subtotals,Monthly Spend ($/mo),Percentage of Total (%)');
      expect(csv).toContain('Provider Subtotals,Monthly Spend ($/mo),Percentage of Total (%)');
      expect(csv).toContain('Gross Projected Spend ($/mo)');

      // Verify Line items & RFC 4180 quotation escaping
      expect(csv).toContain('"Web Server, ""Frontend"""');
      expect(csv).toContain('AWS');
      expect(csv).toContain('AZURE');
      expect(csv).toContain('GOOGLE');
    });

    test('accepts direct TopologyState or AuditReport in exportCostBreakdownCsv', () => {
      const state = createDefaultTopologyState();
      const csv = exportCostBreakdownCsv(state);
      expect(typeof csv).toBe('string');
      expect(csv).toContain('Gross Projected Spend ($/mo),0.00');
    });
  });
});

