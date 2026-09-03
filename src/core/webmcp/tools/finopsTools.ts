/**
 * FinOps Multi-Cloud Pricing & Cost Engine Tools (WebMCP Protocol)
 *
 * Exposes WebMCP tools for:
 * 1. Single Resource Rate Card Pricing across AWS, Azure, GCP (query_resource_pricing)
 * 2. 60 FPS Real-time Aggregated Topology Cost Calculation (calculate_topology_cost)
 * 3. Multi-Cloud Cost-Saving Architectural Optimizations (optimize_cost_allocation)
 */

import type {
  WebMCPTool,
  WebMCPToolResult,
  WebMCPExecutionContext,
  WebModelContextAPI,
} from '../../../types/webmcp';
import type {
  CostItem,
  CostCategory,
  CostOptimizationRecommendation,
} from '../../../types/audit';
import type { TopologyState, CloudResourceNode, CloudResourceType } from '../../../types/topology';
import { getResourceSchema } from '../../catalog/resourceCatalog';

export const HOURS_PER_MONTH = 730;

export const AWS_PRICING_CATALOG = {
  ec2: {
    't3.micro': 0.0104,
    't3.small': 0.0208,
    't3.medium': 0.0416,
    't3.large': 0.0832,
    'c6i.large': 0.085,
    'c6i.xlarge': 0.17,
    'c6i.2xlarge': 0.34,
    'c6i.4xlarge': 0.68,
    'c7g.large': 0.0723,
    'c7g.xlarge': 0.1446,
    'c7g.2xlarge': 0.2892,
    'm6i.large': 0.096,
    'm6i.xlarge': 0.192,
    'm6i.4xlarge': 0.768,
    'r6i.large': 0.126,
    'r6g.xlarge': 0.2016,
    't4g.micro': 0.0084,
    't4g.small': 0.0168,
    't4g.medium': 0.0336,
    't4g.xlarge': 0.1344,
    'g5.xlarge': 1.005,
    'g5.2xlarge': 1.212,
    'p4d.24xlarge': 32.77,
  } as Record<string, number>,

  rds: {
    'db.t4g.micro': 0.018,
    'db.t4g.medium': 0.073,
    'db.m6g.large': 0.182,
    'db.r6g.large': 0.24,
    'db.r6g.xlarge': 0.48,
  } as Record<string, number>,

  storage: {
    ebs_gp3: 0.08,
    ebs_gp2: 0.1,
    ebs_io2: 0.125,
    ebs_io2_iops: 0.065,
    s3_standard: 0.023,
    rds_storage_gp3: 0.115,
  },

  fargate: {
    vcpu_per_hr: 0.04048,
    gb_per_hr: 0.004445,
  },

  fabric: {
    eks_cluster_fee_monthly: 73.0,
    alb_base_monthly: 16.2,
    nat_gateway_monthly: 32.85,
  },
};

export const AZURE_PRICING_CATALOG = {
  vm: {
    Standard_B2s: 0.0416,
    Standard_D2s_v5: 0.096,
    Standard_D4s_v5: 0.192,
    Standard_D8s_v5: 0.384,
    Standard_NC6s_v3: 1.06,
  } as Record<string, number>,

  storage: {
    premium_ssd_gp_per_gb: 0.154,
    blob_hot_gb: 0.0208,
  },

  fabric: {
    app_gateway_monthly: 125.0,
    nat_gateway_monthly: 32.85,
    aks_cluster_monthly: 0.0,
  },
};

export const GCP_PRICING_CATALOG = {
  gce: {
    'e2-micro': 0.0084,
    'e2-small': 0.0168,
    'e2-medium': 0.0336,
    'e2-standard-2': 0.067,
    'e2-standard-4': 0.134,
    'n2-standard-4': 0.194,
    'c2-standard-4': 0.209,
    'a2-highgpu-1g': 3.674,
  } as Record<string, number>,

  storage: {
    pd_standard_gb: 0.04,
    pd_balanced_gb: 0.1,
    pd_ssd_gb: 0.17,
    gcs_standard_gb: 0.02,
  },

  fabric: {
    gke_cluster_monthly: 73.0,
    forwarding_rule_monthly: 18.25,
    cloud_nat_monthly: 32.85,
  },
};

/**
 * Calculates pricing for a single node based on its type and configuration across AWS, Azure, and GCP.
 */
export function calculateNodeCost(node: CloudResourceNode): CostItem & { resourceName?: string; resourceType?: string } {
  const type = node.type;
  const cfg = node.config;

  let monthlyUsd = 0;
  let hourlyUsd = 0;
  let category: CostCategory = 'Base Fabric';
  let details = '';

  switch (type) {
    // -------------------------------------------------------------
    // Base Fabric Primitives ($0.00)
    // -------------------------------------------------------------
    case 'aws_vpc':
    case 'aws_subnet':
    case 'aws_security_group':
    case 'aws_iam_role':
    case 'aws_internet_gateway':
    case 'azurerm_virtual_network':
    case 'azurerm_subnet':
    case 'azurerm_network_security_group':
    case 'azurerm_role_definition':
    case 'google_compute_network':
    case 'google_compute_subnetwork':
    case 'google_compute_firewall':
    case 'google_service_account':
    case 'google_compute_network_peering': {
      category = 'Base Fabric';
      monthlyUsd = 0;
      hourlyUsd = 0;
      details = 'Included in Base Fabric ($0.00/mo)';
      break;
    }

    // -------------------------------------------------------------
    // AWS Compute
    // -------------------------------------------------------------
    case 'aws_instance':
    case 'aws_instance_compute':
    case 'aws_instance_gpu': {
      category = 'Compute';
      const instType = String(cfg.instance_type ?? 't3.medium');
      const hourlyRate = AWS_PRICING_CATALOG.ec2[instType] ?? 0.0416;
      const computeMonthly = hourlyRate * HOURS_PER_MONTH;

      // Storage
      const volGb = cfg.root_volume_gb !== undefined ? Number(cfg.root_volume_gb) : 0;
      const volType = String(cfg.root_volume_type ?? 'gp3');
      let storageMonthly = 0;
      if (volGb > 0) {
        if (volType === 'gp2') {
          storageMonthly = volGb * AWS_PRICING_CATALOG.storage.ebs_gp2;
        } else if (volType === 'io2') {
          const iops = Number(cfg.iops ?? 3000);
          storageMonthly =
            volGb * AWS_PRICING_CATALOG.storage.ebs_io2 +
            iops * AWS_PRICING_CATALOG.storage.ebs_io2_iops;
        } else {
          storageMonthly = volGb * AWS_PRICING_CATALOG.storage.ebs_gp3;
        }
      }

      monthlyUsd = computeMonthly + storageMonthly;
      hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
      details =
        volGb > 0
          ? `EC2 (${instType}) + ${volGb}GB ${volType}${volType === 'io2' ? ` (${cfg.iops ?? 3000} IOPS)` : ''}`
          : `EC2 (${instType})`;
      break;
    }

    case 'aws_db_instance': {
      category = 'Database';
      const instClass = String(cfg.instance_class ?? 'db.t4g.medium');
      const baseHourly = AWS_PRICING_CATALOG.rds[instClass] ?? 0.073;
      const multiAz = Boolean(cfg.multi_az ?? true);
      const mult = multiAz ? 2.0 : 1.0;
      const rdsCompute = baseHourly * mult * HOURS_PER_MONTH;

      const storageGb = Number(cfg.allocated_storage_gb ?? 50);
      const storageMonthly = storageGb * AWS_PRICING_CATALOG.storage.rds_storage_gp3 * (multiAz ? 2.0 : 1.0);

      monthlyUsd = rdsCompute + storageMonthly;
      hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
      details = `RDS (${instClass}, ${multiAz ? 'Multi-AZ' : 'Single-AZ'}) + ${storageGb}GB storage`;
      break;
    }

    case 'aws_eks_cluster': {
      category = 'Compute';
      const clusterBase = AWS_PRICING_CATALOG.fabric.eks_cluster_fee_monthly;
      let nodesCost = 0;
      const nodeGroups = (cfg.node_groups as Array<{ instance_type?: string; desired_size?: number; capacity_type?: string }>) ?? [];

      for (const ng of nodeGroups) {
        const ngType = String(ng.instance_type ?? 't3.medium');
        const size = Number(ng.desired_size ?? 3);
        const hourly = AWS_PRICING_CATALOG.ec2[ngType] ?? 0.0416;
        const discount = ng.capacity_type === 'SPOT' ? 0.3 : 1.0;
        nodesCost += hourly * discount * size * HOURS_PER_MONTH;
      }

      monthlyUsd = clusterBase + nodesCost;
      hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
      details = `EKS Control Plane ($73/mo) + ${nodeGroups.length} Managed Node Groups`;
      break;
    }

    case 'aws_ecs_cluster': {
      category = 'Compute';
      const launchType = String(cfg.launch_type ?? 'FARGATE');
      if (launchType === 'EC2') {
        monthlyUsd = 0;
        hourlyUsd = 0;
        details = 'ECS EC2 Launch Type (Underlying instances billed separately)';
      } else {
        const cpu = Number(cfg.cpu ?? 1024);
        const memoryMb = Number(cfg.memory_mb ?? 2048);
        const count = Number(cfg.desired_count ?? 2);

        const vcpu = cpu / 1024;
        const memoryGb = memoryMb / 1024;

        const hourlyPerTask =
          vcpu * AWS_PRICING_CATALOG.fargate.vcpu_per_hr +
          memoryGb * AWS_PRICING_CATALOG.fargate.gb_per_hr;

        monthlyUsd = hourlyPerTask * count * HOURS_PER_MONTH;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `ECS Fargate (${count} tasks x ${vcpu} vCPU / ${memoryGb}GB RAM)`;
      }
      break;
    }

    case 'aws_lb': {
      category = 'Networking';
      monthlyUsd = AWS_PRICING_CATALOG.fabric.alb_base_monthly;
      hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
      details = 'Application Load Balancer Base Rate';
      break;
    }

    case 'aws_s3_bucket': {
      category = 'Storage';
      const estStorageGb = Number(cfg.estimated_storage_gb ?? 100);
      monthlyUsd = estStorageGb * AWS_PRICING_CATALOG.storage.s3_standard;
      hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
      details = `S3 Standard Storage (${estStorageGb}GB baseline)`;
      break;
    }

    // -------------------------------------------------------------
    // Azure Primitives
    // -------------------------------------------------------------
    case 'azurerm_linux_virtual_machine':
    case 'azurerm_windows_virtual_machine':
    case 'azurerm_virtual_machine_gpu': {
      category = 'Compute';
      const vmSize = String(cfg.vm_size ?? 'Standard_D4s_v5');
      const hourly = AZURE_PRICING_CATALOG.vm[vmSize] ?? 0.192;
      monthlyUsd = hourly * HOURS_PER_MONTH;
      hourlyUsd = hourly;
      details = `Azure VM (${vmSize})`;
      break;
    }

    case 'azurerm_kubernetes_cluster': {
      category = 'Compute';
      const pool = (cfg.default_node_pool as { node_count?: number; vm_size?: string }) ?? {};
      const nodeCount = Number(pool.node_count ?? 3);
      const vmSize = String(pool.vm_size ?? 'Standard_D4s_v5');
      const hourly = AZURE_PRICING_CATALOG.vm[vmSize] ?? 0.192;
      monthlyUsd = nodeCount * hourly * HOURS_PER_MONTH;
      hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
      details = `AKS (${nodeCount}x ${vmSize})`;
      break;
    }

    case 'azurerm_storage_account':
    case 'azurerm_storage_container': {
      category = 'Storage';
      monthlyUsd = 2.08;
      hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
      details = 'Azure Blob Storage (100GB Baseline)';
      break;
    }

    case 'azurerm_mssql_database':
    case 'azurerm_postgresql_flexible_server': {
      category = 'Database';
      monthlyUsd = 248.2;
      hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
      details = 'Azure Managed Database Tier';
      break;
    }

    case 'azurerm_application_gateway': {
      category = 'Networking';
      monthlyUsd = AZURE_PRICING_CATALOG.fabric.app_gateway_monthly;
      hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
      details = 'Azure Application Gateway';
      break;
    }

    // -------------------------------------------------------------
    // GCP Primitives
    // -------------------------------------------------------------
    case 'google_compute_instance':
    case 'google_compute_instance_optimized':
    case 'google_compute_instance_gpu': {
      category = 'Compute';
      const machineType = String(cfg.machine_type ?? 'e2-standard-4');
      const hourly = GCP_PRICING_CATALOG.gce[machineType] ?? 0.134;
      monthlyUsd = hourly * HOURS_PER_MONTH;
      hourlyUsd = hourly;
      details = `GCE (${machineType})`;
      break;
    }

    case 'google_container_cluster': {
      category = 'Compute';
      const clusterFee = GCP_PRICING_CATALOG.fabric.gke_cluster_monthly;
      const count = Number(cfg.initial_node_count ?? 3);
      const nodeHourly = GCP_PRICING_CATALOG.gce['e2-standard-4'] ?? 0.134;
      monthlyUsd = clusterFee + count * nodeHourly * HOURS_PER_MONTH;
      hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
      details = `GKE Control Plane ($73/mo) + ${count} Nodes`;
      break;
    }

    case 'google_storage_bucket': {
      category = 'Storage';
      monthlyUsd = 2.0;
      hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
      details = 'Google Cloud Storage (100GB Baseline)';
      break;
    }

    case 'google_sql_database_instance': {
      category = 'Database';
      monthlyUsd = 219.0;
      hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
      details = 'Cloud SQL PostgreSQL Instance';
      break;
    }

    case 'google_compute_global_forwarding_rule': {
      category = 'Networking';
      monthlyUsd = GCP_PRICING_CATALOG.fabric.forwarding_rule_monthly;
      hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
      details = 'Google Cloud Load Balancer';
      break;
    }

    // Fallback: look up in resourceCatalog schema
    default: {
      const schema = getResourceSchema(type);
      if (schema) {
        category = schema.category === 'AI/ML' ? 'Compute' : schema.category === 'Network' ? 'Networking' : schema.category;
        monthlyUsd = schema.pricingModel.baseMonthlyRate;
        hourlyUsd = schema.pricingModel.hourlyRate ?? monthlyUsd / HOURS_PER_MONTH;
        details = `${schema.name} ($${monthlyUsd.toFixed(2)}/mo)`;
      } else {
        category = 'Base Fabric';
        monthlyUsd = 0;
        hourlyUsd = 0;
        details = 'Included in Base Fabric ($0.00/mo)';
      }
      break;
    }
  }

  return {
    nodeId: node.id,
    name: node.name,
    resourceName: node.name,
    type,
    resourceType: type,
    monthlyUsd: Math.round(monthlyUsd * 100) / 100,
    hourlyUsd: Math.round(hourlyUsd * 10000) / 10000,
    category,
    details,
  };
}

/**
 * Computes the aggregated monthly and hourly infrastructure cost for a multi-cloud topology state.
 */
export function calculateTopologyCostBreakdown(state: TopologyState): {
  totalMonthlyUsd: number;
  totalHourlyUsd: number;
  items: CostItem[];
  categoryTotals: Record<CostCategory, number>;
  potentialSavingsUsd: number;
} {
  const items: CostItem[] = [];
  const categoryTotals: Record<CostCategory, number> = {
    Compute: 0,
    Database: 0,
    Storage: 0,
    Networking: 0,
    Security: 0,
    'Base Fabric': 0,
  };

  let totalMonthlyUsd = 0;
  let totalHourlyUsd = 0;

  for (const node of Object.values(state.nodes)) {
    const cost = calculateNodeCost(node);
    items.push(cost);
    categoryTotals[cost.category] = (categoryTotals[cost.category] || 0) + cost.monthlyUsd;
    totalMonthlyUsd += cost.monthlyUsd;
    totalHourlyUsd += cost.hourlyUsd;
  }

  // Potential savings estimation
  let potentialSavingsUsd = 0;
  for (const node of Object.values(state.nodes)) {
    if (node.type === 'aws_instance') {
      const instType = String(node.config.instance_type ?? '');
      if (instType.startsWith('c6i.') || instType.startsWith('m6i.')) {
        potentialSavingsUsd += calculateNodeCost(node).monthlyUsd * 0.18;
      }
      if (node.config.root_volume_type === 'gp2' || node.config.root_volume_type === 'io2') {
        potentialSavingsUsd += 15.0;
      }
    } else if (node.type === 'azurerm_linux_virtual_machine') {
      potentialSavingsUsd += 25.0;
    } else if (node.type === 'google_compute_instance') {
      potentialSavingsUsd += 18.0;
    }
  }

  return {
    totalMonthlyUsd: Math.round(totalMonthlyUsd * 100) / 100,
    totalHourlyUsd: Math.round(totalHourlyUsd * 10000) / 10000,
    items,
    categoryTotals,
    potentialSavingsUsd: Math.round(potentialSavingsUsd * 100) / 100,
  };
}

/**
 * Analyzes topology for actionable multi-cloud cost saving recommendations.
 */
export function generateCostRecommendations(state: TopologyState): CostOptimizationRecommendation[] {
  const recs: CostOptimizationRecommendation[] = [];

  // 1. AWS Graviton Migration Recommendation
  const x86Nodes = Object.values(state.nodes).filter(
    (n) =>
      n.type === 'aws_instance' &&
      (String(n.config.instance_type).startsWith('c6i.') || String(n.config.instance_type).startsWith('m6i.'))
  );
  if (x86Nodes.length > 0) {
    const savings = x86Nodes.length * 14.5;
    recs.push({
      id: 'FIN-REC-001',
      title: 'Migrate x86 EC2 Instances to AWS Graviton (c7g/t4g)',
      category: 'Graviton',
      description: `Switching ${x86Nodes.length} x86 instance(s) to ARM64 Graviton instances delivers up to 20% cost savings with better performance per watt.`,
      estimatedSavingsMonthlyUsd: Math.round(savings * 100) / 100,
      targetNodeIds: x86Nodes.map((n) => n.id),
      actionType: 'MIGRATE_GRAVITON',
    });
  }

  // 2. Storage Modernization: gp2 / io2 -> gp3
  const legacyStorageNodes = Object.values(state.nodes).filter(
    (n) => n.type === 'aws_instance' && (n.config.root_volume_type === 'gp2' || n.config.root_volume_type === 'io2')
  );
  if (legacyStorageNodes.length > 0) {
    const savings = legacyStorageNodes.length * 22.0;
    recs.push({
      id: 'FIN-REC-002',
      title: 'Upgrade EBS Volumes to gp3 (Baseline 3,000 IOPS)',
      category: 'Storage',
      description: `Migrating ${legacyStorageNodes.length} volume(s) to gp3 reduces $/GB storage cost by 20% and provides free baseline 3,000 IOPS and 125 MB/s throughput.`,
      estimatedSavingsMonthlyUsd: Math.round(savings * 100) / 100,
      targetNodeIds: legacyStorageNodes.map((n) => n.id),
      actionType: 'UPGRADE_EBS_GP3',
    });
  }

  // 3. EKS Spot Worker Nodes
  const eksClusters = Object.values(state.nodes).filter((n) => n.type === 'aws_eks_cluster');
  for (const eks of eksClusters) {
    const ngs = (eks.config.node_groups as Array<{ capacity_type?: string }>) ?? [];
    const onDemandNgs = ngs.filter((ng) => ng.capacity_type !== 'SPOT');
    if (onDemandNgs.length > 0) {
      recs.push({
        id: `FIN-REC-003-${eks.id}`,
        title: `Adopt Spot Capacity for Non-Critical EKS Node Groups (${eks.name})`,
        category: 'Spot',
        description: 'Utilizing Spot instances for stateless microservices can reduce worker node compute expenditure by up to 70%.',
        estimatedSavingsMonthlyUsd: 48.0,
        targetNodeIds: [eks.id],
        actionType: 'ENABLE_EKS_SPOT',
      });
    }
  }

  // 4. Azure VM Sizing Optimization
  const azureVmNodes = Object.values(state.nodes).filter((n) => n.type === 'azurerm_linux_virtual_machine');
  if (azureVmNodes.length > 0) {
    recs.push({
      id: 'FIN-REC-004-AZURE',
      title: 'Optimize Azure Virtual Machine SKU Sizing',
      category: 'Architecture',
      description: 'Rightsize Azure D-series instances to B-series or Dpsv5 ARM64 series for up to 30% savings.',
      estimatedSavingsMonthlyUsd: 35.0,
      targetNodeIds: azureVmNodes.map((n) => n.id),
      actionType: 'RIGHTSIZE_AZURE_VM',
    });
  }

  // 5. GCP GCE Sizing Optimization
  const gcpNodes = Object.values(state.nodes).filter((n) => n.type === 'google_compute_instance');
  if (gcpNodes.length > 0) {
    recs.push({
      id: 'FIN-REC-005-GCP',
      title: 'Optimize GCP Compute Engine Machine Types (Tau T2A / E2)',
      category: 'Architecture',
      description: 'Convert standard N2 instances to Tau T2A ARM64 or E2 cost-optimized instances for improved price-performance.',
      estimatedSavingsMonthlyUsd: 28.0,
      targetNodeIds: gcpNodes.map((n) => n.id),
      actionType: 'RIGHTSIZE_GCP_VM',
    });
  }

  return recs;
}

/**
 * Creates the query_resource_pricing WebMCP tool.
 */
export function createQueryResourcePricingTool(): WebMCPTool {
  return {
    name: 'query_resource_pricing',
    description: 'Calculates real-time monthly and hourly cost breakdown for any of the 108 cloud primitives across AWS, Azure, and GCP.',
    category: 'finops',
    inputSchema: {
      type: 'object',
      required: ['resource_type', 'config'],
      properties: {
        resource_type: {
          type: 'string',
          description: 'Multi-Cloud Primitive Type (AWS, Azure, or GCP).',
        },
        region: { type: 'string', default: 'us-east-1', description: 'Target deployment region.' },
        config: {
          type: 'object',
          description: 'Resource specific sizing configuration.',
        },
      },
    },
    execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
      const agentId = context?.agentId ?? 'gamma';
      const type = String(params.resource_type) as CloudResourceType;
      const config = (params.config as Record<string, unknown>) ?? {};

      const syntheticNode: CloudResourceNode = {
        id: 'query-node',
        type,
        name: 'Query Sample',
        position: { x: 0, y: 0 },
        config,
        metadata: {
          createdBy: agentId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        version: 1,
      };

      const cost = calculateNodeCost(syntheticNode);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(cost, null, 2),
          },
        ],
        meta: {
          executionTimeMs: 0,
          agentId,
          costDeltaMonthlyUsd: cost.monthlyUsd,
        },
      };
    },
  };
}

/**
 * Creates the calculate_topology_cost WebMCP tool.
 */
export function createCalculateTopologyCostTool(getState: () => TopologyState): WebMCPTool {
  return {
    name: 'calculate_topology_cost',
    description:
      'Calculates complete real-time aggregated monthly and hourly infrastructure cost across all nodes in the canvas DAG across AWS, Azure, and GCP.',
    category: 'finops',
    inputSchema: {
      type: 'object',
      properties: {
        currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'], default: 'USD' },
        include_recommendations: { type: 'boolean', default: true },
      },
    },
    execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
      const agentId = context?.agentId ?? 'gamma';
      const state = getState();
      const breakdown = calculateTopologyCostBreakdown(state);
      const recs = params.include_recommendations !== false ? generateCostRecommendations(state) : [];

      const reportPayload = {
        total_monthly_usd: breakdown.totalMonthlyUsd,
        total_hourly_usd: breakdown.totalHourlyUsd,
        breakdown_by_category: breakdown.categoryTotals,
        itemized_nodes: breakdown.items,
        potential_monthly_savings_usd: breakdown.potentialSavingsUsd,
        recommendations: recs,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(reportPayload, null, 2),
          },
        ],
        meta: {
          executionTimeMs: 0,
          agentId,
          costDeltaMonthlyUsd: breakdown.totalMonthlyUsd,
        },
      };
    },
  };
}

/**
 * Creates the optimize_cost_allocation WebMCP tool.
 */
export function createOptimizeCostAllocationTool(getState: () => TopologyState): WebMCPTool {
  return {
    name: 'optimize_cost_allocation',
    description:
      'Analyzes the topology for multi-cloud FinOps optimization opportunities (e.g. Graviton ARM64 conversions, Spot instances, Azure/GCP rightsizing, storage tiering).',
    category: 'finops',
    inputSchema: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'],
          default: 'BALANCED',
        },
      },
    },
    execute: async (_params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
      const agentId = context?.agentId ?? 'gamma';
      const state = getState();
      const recommendations = generateCostRecommendations(state);
      const totalSavings = recommendations.reduce((sum, r) => sum + r.estimatedSavingsMonthlyUsd, 0);

      const payload = {
        recommendations_count: recommendations.length,
        total_potential_savings_monthly_usd: Math.round(totalSavings * 100) / 100,
        recommendations,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(payload, null, 2),
          },
        ],
        meta: {
          executionTimeMs: 0,
          agentId,
        },
      };
    },
  };
}

export function createGetFinopsBreakdownTool(getState: () => TopologyState): WebMCPTool {
  return {
    name: 'get_finops_breakdown',
    description:
      'Returns an executive FinOps cost breakdown grouped by cloud provider (AWS vs Azure vs GCP) and architectural layer (Compute, Storage, Database, Network).',
    category: 'finops',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute(_params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> {
      const state = getState();
      const nodes = Object.values(state.nodes);

      const byProvider: Record<string, number> = { aws: 0, azure: 0, google: 0 };
      const byCategory: Record<string, number> = { compute: 0, storage: 0, database: 0, network: 0, security: 0 };
      const itemized: Array<{ id: string; name: string; type: string; provider: string; monthly_usd: number }> = [];

      let totalMonthly = 0;

      for (const node of nodes) {
        const cost = calculateNodeCost(node);
        totalMonthly += cost.monthlyUsd;

        const p = node.type.startsWith('azure') ? 'azure' : node.type.startsWith('google') ? 'google' : 'aws';
        byProvider[p] = (byProvider[p] || 0) + cost.monthlyUsd;

        const cat = node.type.includes('db') || node.type.includes('sql') || node.type.includes('postgres') || node.type.includes('redis')
          ? 'database'
          : node.type.includes('s3') || node.type.includes('storage') || node.type.includes('bucket')
          ? 'storage'
          : node.type.includes('vpc') || node.type.includes('subnet') || node.type.includes('lb') || node.type.includes('gateway')
          ? 'network'
          : node.type.includes('iam') || node.type.includes('kms') || node.type.includes('waf') || node.type.includes('security')
          ? 'security'
          : 'compute';

        byCategory[cat] = (byCategory[cat] || 0) + cost.monthlyUsd;

        itemized.push({
          id: node.id,
          name: node.name,
          type: node.type,
          provider: p,
          monthly_usd: Math.round(cost.monthlyUsd * 100) / 100,
        });
      }

      itemized.sort((a, b) => b.monthly_usd - a.monthly_usd);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total_monthly_usd: Math.round(totalMonthly * 100) / 100,
            total_hourly_usd: Math.round((totalMonthly / HOURS_PER_MONTH) * 1000) / 1000,
            by_provider: Object.fromEntries(Object.entries(byProvider).map(([k, v]) => [k, Math.round(v * 100) / 100])),
            by_category: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, Math.round(v * 100) / 100])),
            top_5_cost_drivers: itemized.slice(0, 5),
          }, null, 2),
        }],
        meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'delta' },
      };
    },
  };
}

/**
 * Registers all FinOps tools into a WebMCP context engine.
 */
export function registerFinOpsTools(
  engine: WebModelContextAPI,
  getState: () => TopologyState
): () => void {
  const unregisterPromises: Array<Promise<() => void> | (() => void)> = [];

  unregisterPromises.push(engine.registerTool(createQueryResourcePricingTool()));
  unregisterPromises.push(engine.registerTool(createCalculateTopologyCostTool(getState)));
  unregisterPromises.push(engine.registerTool(createOptimizeCostAllocationTool(getState)));
  unregisterPromises.push(engine.registerTool(createGetFinopsBreakdownTool(getState)));

  return () => {
    for (const p of unregisterPromises) {
      Promise.resolve(p).then(fn => fn && fn());
    }
  };
}
