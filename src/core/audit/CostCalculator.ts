/**
 * FinOps Multi-Cloud Live Pricing & Cost Calculator Engine
 *
 * Real-time rate card evaluations ($/mo and $/hr) based on standard 730 hours/month across:
 * - Amazon Web Services (AWS): EC2, Graviton3, RDS Multi-AZ, S3, ALB, EBS gp3/io2, EKS, Fargate, Lambda
 * - Microsoft Azure: Virtual Machines (B/D/F/E series, ARM Ampere), Azure SQL, Cosmos DB, Managed Disks, AKS
 * - Google Cloud Platform (GCP): Compute Engine (E2/N2/C2/C3), Cloud SQL, Cloud Storage, GKE, Cloud Run
 * - GPU Accelerated Workloads: NVIDIA A100, H100, A10G, T4, L4 across all 3 providers
 * - Storage Tiers: Standard, Infrequent/Nearline, Archive/Coldline/Glacier, Provisioned IOPS
 * - Automated Multi-Cloud Rightsizing Recommendations: Graviton, gp3, Azure B-series/Premium SSD, GCP E2/Balanced PD
 * - RFC 4180 CSV Export Routine with category and provider subtotals
 */

import type {
  CostItem,
  CostCategory,
  CostOptimizationRecommendation,
} from '../../types/audit';
import type {
  TopologyState,
  CloudResourceNode,
  CloudProvider,
} from '../../types/topology';
import {
  HOURS_PER_MONTH,
  AWS_PRICING_CATALOG,
  AZURE_PRICING_CATALOG,
  GCP_PRICING_CATALOG,
  getProviderFromResourceType,
  getCategoryFromResourceType,
} from '../pricing/rateCards';

export {
  HOURS_PER_MONTH,
  AWS_PRICING_CATALOG,
  AZURE_PRICING_CATALOG,
  GCP_PRICING_CATALOG,
  getProviderFromResourceType,
  getCategoryFromResourceType,
};

export interface TopologyCostBreakdown {
  totalMonthlyUsd: number;
  totalHourlyUsd: number;
  items: CostItem[];
  categoryTotals: Record<CostCategory, number>;
  providerTotals: Record<CloudProvider, number>;
  potentialSavingsUsd: number;
}

/**
 * Calculates pricing for an individual resource node based on its type and configuration across AWS, Azure, and GCP.
 */
export function calculateNodeCost(node: CloudResourceNode): CostItem {
  const type = node.type;
  const cfg = node.config || {};
  const provider = getProviderFromResourceType(type);

  let monthlyUsd = 0;
  let hourlyUsd = 0;
  let category: CostCategory = getCategoryFromResourceType(type);
  let details = '';

  // =========================================================================
  // 1. AWS RESOURCES
  // =========================================================================
  if (provider === 'aws') {
    switch (type) {
      case 'aws_instance':
      case 'aws_instance_compute':
      case 'aws_instance_gpu': {
        category = 'Compute';
        const defaultInst = type === 'aws_instance_compute' ? 'c6i.large' : type === 'aws_instance_gpu' ? 'g5.xlarge' : 't3.medium';
        const instType = String(cfg.instance_type ?? defaultInst);
        const hourlyRate = AWS_PRICING_CATALOG.ec2[instType] ?? (type === 'aws_instance_gpu' ? 1.006 : 0.0416);
        const computeMonthly = hourlyRate * HOURS_PER_MONTH;

        // Storage calculation
        const volGb = Number(cfg.root_volume_gb ?? (type === 'aws_instance_compute' ? 50 : 30));
        const volType = String(cfg.root_volume_type ?? 'gp3');
        let storageMonthly = volGb * AWS_PRICING_CATALOG.storage.ebs_gp3;

        if (volType === 'gp2') {
          storageMonthly = volGb * AWS_PRICING_CATALOG.storage.ebs_gp2;
        } else if (volType === 'io2') {
          const iops = Number(cfg.iops ?? 3000);
          storageMonthly =
            volGb * AWS_PRICING_CATALOG.storage.ebs_io2 +
            iops * AWS_PRICING_CATALOG.storage.ebs_io2_iops;
        }

        monthlyUsd = computeMonthly + storageMonthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `EC2 (${instType}) + ${volGb}GB ${volType}${volType === 'io2' ? ` (${cfg.iops ?? 3000} IOPS)` : ''}`;
        break;
      }

      case 'aws_db_instance':
      case 'aws_rds_cluster': {
        category = 'Database';
        const instClass = String(cfg.instance_class ?? 'db.t4g.medium');
        const baseHourly = AWS_PRICING_CATALOG.rds[instClass] ?? 0.073;
        // Default to Multi-AZ unless explicitly configured false
        const multiAz = cfg.multi_az !== undefined ? Boolean(cfg.multi_az) : true;
        const mult = multiAz ? 2.0 : 1.0;
        const rdsCompute = baseHourly * mult * HOURS_PER_MONTH;

        const storageGb = Number(cfg.allocated_storage_gb ?? 50);
        const storageType = String(cfg.storage_type ?? 'gp3');
        const storageRate =
          storageType === 'io2'
            ? AWS_PRICING_CATALOG.storage.rds_storage_io2
            : AWS_PRICING_CATALOG.storage.rds_storage_gp3;
        const storageMonthly = storageGb * storageRate * mult;

        monthlyUsd = rdsCompute + storageMonthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `RDS (${instClass}, ${multiAz ? 'Multi-AZ' : 'Single-AZ'}) + ${storageGb}GB ${storageType}`;
        break;
      }

      case 'aws_dynamodb_table': {
        category = 'Database';
        const wcu = Number(cfg.write_capacity ?? 5);
        const rcu = Number(cfg.read_capacity ?? 5);
        monthlyUsd = (wcu * 0.47) + (rcu * 0.09); // Correct provisioned capacity math
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `DynamoDB Table (${wcu} WCU / ${rcu} RCU)`;
        break;
      }

      case 'aws_elasticache_cluster': {
        category = 'Database';
        const nodeType = String(cfg.node_type ?? 'cache.t4g.medium');
        const numNodes = Number(cfg.num_cache_nodes ?? 2);
        const rate = (AWS_PRICING_CATALOG.ec2[nodeType.replace('cache.', '')] ?? 0.034) * numNodes;
        monthlyUsd = rate * HOURS_PER_MONTH;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `ElastiCache Redis (${numNodes}x ${nodeType})`;
        break;
      }

      case 'aws_redshift_cluster': {
        category = 'Database';
        const nodeType = String(cfg.node_type ?? 'dc2.large');
        const numNodes = Number(cfg.number_of_nodes ?? 2);
        const rate = 0.25 * numNodes;
        monthlyUsd = rate * HOURS_PER_MONTH;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `Redshift Data Warehouse (${numNodes}x ${nodeType})`;
        break;
      }

      case 'aws_eks_cluster': {
        category = 'Compute';
        const clusterBase = AWS_PRICING_CATALOG.fabric.eks_cluster_fee_monthly;
        let nodesCost = 0;
        const nodeGroups =
          (cfg.node_groups as Array<{
            instance_type?: string;
            desired_size?: number;
            capacity_type?: string;
          }>) ?? [];

        for (const ng of nodeGroups) {
          const ngType = String(ng.instance_type ?? 't3.medium');
          const size = Number(ng.desired_size ?? 3);
          const hourly = AWS_PRICING_CATALOG.ec2[ngType] ?? 0.0416;
          const discount = ng.capacity_type === 'SPOT' ? 0.3 : 1.0;
          nodesCost += hourly * discount * size * HOURS_PER_MONTH;
        }

        monthlyUsd = clusterBase + nodesCost;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `EKS Control Plane ($73/mo) + ${nodeGroups.length} Managed Node Group(s)`;
        break;
      }

      case 'aws_ecs_cluster': {
        category = 'Compute';
        const launchType = String(cfg.launch_type ?? 'FARGATE').toUpperCase();
        if (launchType === 'FARGATE') {
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
        } else {
          monthlyUsd = 0;
          hourlyUsd = 0;
          details = 'ECS EC2 Launch Type (Compute billed via EC2 instances)';
        }
        break;
      }

      case 'aws_lambda_function': {
        category = 'Compute';
        monthlyUsd = 5.0; // Baseline execution allowance
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'AWS Lambda Serverless Execution Tier ($5.00/mo base)';
        break;
      }

      case 'aws_apprunner_service': {
        category = 'Compute';
        monthlyUsd = 25.0; // Baseline 1 vCPU / 2GB RAM container
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'AWS App Runner Fully Managed Service';
        break;
      }

      case 'aws_batch_compute_environment': {
        category = 'Compute';
        monthlyUsd = 40.0;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'AWS Batch Compute Environment';
        break;
      }

      case 'aws_s3_bucket': {
        category = 'Storage';
        const estStorageGb = Number(cfg.estimated_storage_gb ?? 100);
        monthlyUsd = estStorageGb * AWS_PRICING_CATALOG.storage.s3_standard;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `S3 Standard Storage (${estStorageGb}GB baseline @ $0.023/GB)`;
        break;
      }

      case 'aws_ebs_volume': {
        category = 'Storage';
        const sizeGb = Number(cfg.size_gb ?? 100);
        const volType = String(cfg.volume_type ?? 'gp3');
        const rate = volType === 'gp2' ? 0.10 : volType === 'io2' ? 0.125 : 0.08;
        const iops = volType === 'io2' ? Number(cfg.iops ?? 3000) * 0.065 : 0;
        monthlyUsd = sizeGb * rate + iops;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `EBS Volume (${sizeGb}GB ${volType})`;
        break;
      }

      case 'aws_efs_file_system': {
        category = 'Storage';
        const sizeGb = Number(cfg.storage_gb ?? 100);
        monthlyUsd = sizeGb * AWS_PRICING_CATALOG.storage.efs_standard;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `EFS Elastic File System (${sizeGb}GB @ $0.30/GB)`;
        break;
      }

      case 'aws_glacier_vault': {
        category = 'Storage';
        const sizeGb = Number(cfg.storage_gb ?? 500);
        monthlyUsd = sizeGb * AWS_PRICING_CATALOG.storage.s3_glacier;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `S3 Glacier Vault Archive (${sizeGb}GB @ $0.004/GB)`;
        break;
      }

      case 'aws_lb': {
        category = 'Networking';
        monthlyUsd = AWS_PRICING_CATALOG.fabric.alb_base_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        const lbType = String(cfg.load_balancer_type ?? 'application');
        details = `${lbType.toUpperCase()} Load Balancer Base Rate ($16.20/mo)`;
        break;
      }

      case 'aws_nat_gateway': {
        category = 'Networking';
        monthlyUsd = AWS_PRICING_CATALOG.fabric.nat_gateway_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'AWS Managed NAT Gateway ($32.85/mo base)';
        break;
      }

      case 'aws_ec2_transit_gateway': {
        category = 'Networking';
        monthlyUsd = AWS_PRICING_CATALOG.fabric.transit_gateway_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'AWS Transit Gateway Hub ($36.50/mo base)';
        break;
      }

      case 'aws_cloudfront_distribution': {
        category = 'Networking';
        monthlyUsd = 8.50; // 100GB traffic baseline
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'CloudFront Global CDN (100GB baseline)';
        break;
      }

      case 'aws_sagemaker_endpoint': {
        category = 'Compute';
        const instType = String(cfg.instance_type ?? 'ml.m5.xlarge');
        const hourlyRate = 0.20;
        monthlyUsd = hourlyRate * HOURS_PER_MONTH;
        hourlyUsd = hourlyRate;
        details = `SageMaker Inference Endpoint (${instType})`;
        break;
      }

      case 'aws_emr_cluster': {
        category = 'Compute';
        monthlyUsd = 140.0;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'AWS EMR Big Data Spark Cluster';
        break;
      }

      case 'aws_kms_key': {
        category = 'Security';
        monthlyUsd = AWS_PRICING_CATALOG.fabric.kms_key_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'AWS KMS Customer Managed Key ($1.00/mo)';
        break;
      }

      case 'aws_secretsmanager_secret': {
        category = 'Security';
        monthlyUsd = AWS_PRICING_CATALOG.fabric.secretsmanager_secret_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'AWS Secrets Manager Secret ($0.40/mo)';
        break;
      }

      case 'aws_wafv2_web_acl': {
        category = 'Security';
        monthlyUsd = AWS_PRICING_CATALOG.fabric.wafv2_acl_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'AWS WAFv2 Web ACL Rule Set ($5.00/mo)';
        break;
      }

      case 'aws_vpc':
      case 'aws_subnet':
      case 'aws_security_group':
      case 'aws_iam_role':
      case 'aws_internet_gateway':
      default: {
        category = 'Base Fabric';
        monthlyUsd = 0;
        hourlyUsd = 0;
        details = 'Included in AWS Base Fabric ($0.00/mo)';
        break;
      }
    }
  }

  // =========================================================================
  // 2. AZURE RESOURCES
  // =========================================================================
  else if (provider === 'azure') {
    switch (type) {
      case 'azurerm_linux_virtual_machine':
      case 'azurerm_windows_virtual_machine':
      case 'azurerm_virtual_machine_gpu': {
        category = 'Compute';
        const defaultVm = type === 'azurerm_virtual_machine_gpu' ? 'Standard_NV36ads_A10_v5' : 'Standard_D2s_v5';
        const vmSize = String(cfg.vm_size ?? defaultVm);
        const hourlyRate = AZURE_PRICING_CATALOG.vm[vmSize] ?? (type === 'azurerm_virtual_machine_gpu' ? 1.006 : 0.096);
        const osSurcharge = type === 'azurerm_windows_virtual_machine' ? 0.04 : 0;
        const computeMonthly = (hourlyRate + osSurcharge) * HOURS_PER_MONTH;

        // OS disk storage
        const osDisk = (cfg.os_disk as { disk_size_gb?: number; storage_account_type?: string }) ?? {};
        const diskSizeGb = Number(osDisk.disk_size_gb ?? 30);
        const diskType = String(osDisk.storage_account_type ?? 'Premium_LRS');
        const diskRate =
          diskType === 'Standard_LRS'
            ? AZURE_PRICING_CATALOG.storage.disk_standard_hdd
            : diskType === 'StandardSSD_LRS'
            ? AZURE_PRICING_CATALOG.storage.disk_standard_ssd
            : AZURE_PRICING_CATALOG.storage.disk_premium_ssd;
        const diskMonthly = diskSizeGb * diskRate;

        monthlyUsd = computeMonthly + diskMonthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `Azure VM (${vmSize}) + ${diskSizeGb}GB ${diskType}`;
        break;
      }

      case 'azurerm_kubernetes_cluster': {
        category = 'Compute';
        const defaultPool = (cfg.default_node_pool as { vm_size?: string; node_count?: number }) ?? {};
        const vmSize = String(defaultPool.vm_size ?? 'Standard_D2s_v5');
        const nodeCount = Number(defaultPool.node_count ?? 3);
        const hourlyRate = AZURE_PRICING_CATALOG.vm[vmSize] ?? 0.096;
        const nodeCostMonthly = hourlyRate * nodeCount * HOURS_PER_MONTH;
        const clusterFee = AZURE_PRICING_CATALOG.container.aks_management_monthly;

        monthlyUsd = clusterFee + nodeCostMonthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `AKS (${nodeCount}x ${vmSize} worker nodes)`;
        break;
      }

      case 'azurerm_container_group': {
        category = 'Compute';
        const cpu = Number(cfg.cpu ?? 1);
        const memoryGb = Number(cfg.memory_gb ?? 2);
        const hourly =
          cpu * AZURE_PRICING_CATALOG.container.aci_vcpu_per_hr +
          memoryGb * AZURE_PRICING_CATALOG.container.aci_gb_per_hr;
        monthlyUsd = hourly * HOURS_PER_MONTH;
        hourlyUsd = hourly;
        details = `Azure Container Instances (${cpu} vCPU / ${memoryGb}GB RAM)`;
        break;
      }

      case 'azurerm_app_service': {
        category = 'Compute';
        const sku = String(cfg.sku_name ?? 'B1');
        monthlyUsd = sku.startsWith('P') ? 83.95 : sku.startsWith('S') ? 73.0 : 13.14;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `Azure App Service (${sku})`;
        break;
      }

      case 'azurerm_linux_function_app': {
        category = 'Compute';
        monthlyUsd = 5.0; // Serverless baseline
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Azure Function App Serverless Consumption';
        break;
      }

      case 'azurerm_mssql_database': {
        category = 'Database';
        const sku = String(cfg.sku_name ?? 'S0');
        const hourlyRate = AZURE_PRICING_CATALOG.database[sku] ?? 0.0205;
        const computeMonthly = hourlyRate * HOURS_PER_MONTH;
        const maxGb = Number(cfg.max_size_gb ?? 50);
        const storageMonthly = maxGb * 0.115;

        monthlyUsd = computeMonthly + storageMonthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `Azure SQL Database (${sku}) + ${maxGb}GB Storage`;
        break;
      }

      case 'azurerm_postgresql_flexible_server': {
        category = 'Database';
        const sku = String(cfg.sku_name ?? 'Standard_B2s');
        const hourlyRate = AZURE_PRICING_CATALOG.database[sku] ?? 0.036;
        const storageGb = Number(cfg.storage_mb ? Number(cfg.storage_mb) / 1024 : 32);
        monthlyUsd = hourlyRate * HOURS_PER_MONTH + storageGb * 0.115;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `Azure PostgreSQL Flexible (${sku}) + ${storageGb}GB Storage`;
        break;
      }

      case 'azurerm_cosmosdb_account': {
        category = 'Database';
        const ru = Number(cfg.total_throughput_limit ?? 400);
        const ruHourly = (ru / 100) * 0.008;
        monthlyUsd = ruHourly * HOURS_PER_MONTH + 5.0;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `Azure Cosmos DB (${ru} RU/s Multi-Model)`;
        break;
      }

      case 'azurerm_redis_cache': {
        category = 'Database';
        const sku = String(cfg.sku_name ?? 'Standard');
        monthlyUsd = sku === 'Premium' ? 410.0 : 73.0;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `Azure Cache for Redis (${sku})`;
        break;
      }

      case 'azurerm_synapse_workspace': {
        category = 'Database';
        monthlyUsd = 1.51 * HOURS_PER_MONTH;
        hourlyUsd = 1.51;
        details = 'Azure Synapse Analytics DW100c';
        break;
      }

      case 'azurerm_storage_account':
      case 'azurerm_storage_container': {
        category = 'Storage';
        const tier = String(cfg.account_tier ?? 'Standard');
        const estStorageGb = Number(cfg.estimated_storage_gb ?? 100);
        const rate = tier === 'Premium' ? 0.135 : AZURE_PRICING_CATALOG.storage.blob_hot;
        monthlyUsd = estStorageGb * rate;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `Azure Blob Storage (${tier} ${estStorageGb}GB @ $${rate}/GB)`;
        break;
      }

      case 'azurerm_managed_disk': {
        category = 'Storage';
        const diskSizeGb = Number(cfg.disk_size_gb ?? 100);
        const storageType = String(cfg.storage_account_type ?? 'Premium_LRS');
        const rate =
          storageType === 'Standard_LRS'
            ? AZURE_PRICING_CATALOG.storage.disk_standard_hdd
            : storageType === 'StandardSSD_LRS'
            ? AZURE_PRICING_CATALOG.storage.disk_standard_ssd
            : AZURE_PRICING_CATALOG.storage.disk_premium_ssd;
        monthlyUsd = diskSizeGb * rate;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `Azure Managed Disk (${diskSizeGb}GB ${storageType})`;
        break;
      }

      case 'azurerm_data_lake_storage_gen2': {
        category = 'Storage';
        const sizeGb = Number(cfg.storage_gb ?? 200);
        monthlyUsd = sizeGb * AZURE_PRICING_CATALOG.storage.data_lake_gen2;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `Azure Data Lake Gen2 (${sizeGb}GB @ $0.018/GB)`;
        break;
      }

      case 'azurerm_application_gateway': {
        category = 'Networking';
        monthlyUsd = AZURE_PRICING_CATALOG.fabric.app_gateway_base_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Azure Application Gateway (Standard_v2 $18.25/mo base)';
        break;
      }

      case 'azurerm_lb': {
        category = 'Networking';
        monthlyUsd = AZURE_PRICING_CATALOG.fabric.load_balancer_base_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Azure Standard Load Balancer ($18.25/mo base)';
        break;
      }

      case 'azurerm_nat_gateway': {
        category = 'Networking';
        monthlyUsd = AZURE_PRICING_CATALOG.fabric.nat_gateway_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Azure NAT Gateway ($32.85/mo)';
        break;
      }

      case 'azurerm_virtual_wan': {
        category = 'Networking';
        monthlyUsd = AZURE_PRICING_CATALOG.fabric.virtual_wan_hub_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Azure Virtual WAN Hub ($73.00/mo)';
        break;
      }

      case 'azurerm_cdn_profile': {
        category = 'Networking';
        monthlyUsd = 8.10;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Azure CDN Profile (Standard)';
        break;
      }

      case 'azurerm_key_vault': {
        category = 'Security';
        monthlyUsd = 0.0;
        hourlyUsd = 0.0;
        details = 'Azure Key Vault (Free base, transactional billing)';
        break;
      }

      case 'azurerm_web_application_firewall_policy': {
        category = 'Security';
        monthlyUsd = AZURE_PRICING_CATALOG.fabric.waf_policy_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Azure WAF Policy ($5.00/mo)';
        break;
      }

      case 'azurerm_databricks_workspace': {
        category = 'Compute';
        monthlyUsd = 120.0;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Azure Databricks Lakehouse Workspace';
        break;
      }

      case 'azurerm_machine_learning_workspace': {
        category = 'Compute';
        monthlyUsd = 45.0;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Azure Machine Learning Workspace';
        break;
      }

      case 'azurerm_virtual_network':
      case 'azurerm_subnet':
      case 'azurerm_network_security_group':
      case 'azurerm_role_definition':
      default: {
        category = 'Base Fabric';
        monthlyUsd = 0;
        hourlyUsd = 0;
        details = 'Included in Azure Base Fabric ($0.00/mo)';
        break;
      }
    }
  }

  // =========================================================================
  // 3. GCP RESOURCES
  // =========================================================================
  else if (provider === 'google') {
    switch (type) {
      case 'google_compute_instance':
      case 'google_compute_instance_optimized':
      case 'google_compute_instance_gpu': {
        category = 'Compute';
        const defaultMachine =
          type === 'google_compute_instance_optimized'
            ? 'c2-standard-4'
            : type === 'google_compute_instance_gpu'
            ? 'g2-standard-4'
            : 'e2-medium';
        const machineType = String(cfg.machine_type ?? defaultMachine);
        const hourlyRate = GCP_PRICING_CATALOG.gce[machineType] ?? (type === 'google_compute_instance_gpu' ? 1.006 : 0.0336);
        const computeMonthly = hourlyRate * HOURS_PER_MONTH;

        // Boot disk storage
        const bootDisk = (cfg.boot_disk as { size_gb?: number; type?: string }) ?? {};
        const diskSizeGb = Number(bootDisk.size_gb ?? 30);
        const diskType = String(bootDisk.type ?? 'pd-balanced');
        const diskRate =
          diskType === 'pd-standard'
            ? GCP_PRICING_CATALOG.storage.pd_standard
            : diskType === 'pd-ssd'
            ? GCP_PRICING_CATALOG.storage.pd_ssd
            : GCP_PRICING_CATALOG.storage.pd_balanced;
        const diskMonthly = diskSizeGb * diskRate;

        monthlyUsd = computeMonthly + diskMonthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `GCE (${machineType}) + ${diskSizeGb}GB ${diskType}`;
        break;
      }

      case 'google_container_cluster': {
        category = 'Compute';
        const nodeConfig = (cfg.node_config as { machine_type?: string; spot?: boolean; preemptible?: boolean }) ?? {};
        const machineType = String(nodeConfig.machine_type ?? 'e2-medium');
        const nodeCount = Number(cfg.initial_node_count ?? 3);
        const isSpot = Boolean(nodeConfig.spot || nodeConfig.preemptible);
        const discount = isSpot ? 0.3 : 1.0;
        const hourlyRate = GCP_PRICING_CATALOG.gce[machineType] ?? 0.0336;
        const nodesCostMonthly = hourlyRate * discount * nodeCount * HOURS_PER_MONTH;
        const clusterFee = GCP_PRICING_CATALOG.container.gke_cluster_fee_monthly;

        monthlyUsd = clusterFee + nodesCostMonthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `GKE Control Plane ($73/mo) + ${nodeCount}x ${machineType} (${isSpot ? 'Spot' : 'On-Demand'})`;
        break;
      }

      case 'google_cloud_run_service': {
        category = 'Compute';
        monthlyUsd = 12.50; // Serverless container baseline
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Google Cloud Run Serverless Service';
        break;
      }

      case 'google_cloudfunctions_function': {
        category = 'Compute';
        monthlyUsd = 5.0; // Baseline serverless execution
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Google Cloud Functions Serverless';
        break;
      }

      case 'google_app_engine_standard_app_version': {
        category = 'Compute';
        const hourly = 0.05;
        monthlyUsd = hourly * HOURS_PER_MONTH;
        hourlyUsd = hourly;
        details = 'Google App Engine Standard';
        break;
      }

      case 'google_sql_database_instance': {
        category = 'Database';
        const tier = String(cfg.tier ?? 'db-custom-2-7680');
        const hourlyRate = GCP_PRICING_CATALOG.database[tier] ?? 0.098;
        const isRegional = cfg.availability_type === 'REGIONAL';
        const mult = isRegional ? 2.0 : 1.0;
        const computeMonthly = hourlyRate * mult * HOURS_PER_MONTH;

        const diskGb = Number(cfg.disk_size ?? 50);
        const diskType = String(cfg.disk_type ?? 'PD_SSD');
        const diskRate = diskType === 'PD_HDD' ? 0.09 : 0.17;
        const storageMonthly = diskGb * diskRate * mult;

        monthlyUsd = computeMonthly + storageMonthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `Cloud SQL (${tier}, ${isRegional ? 'HA Regional' : 'Zonal'}) + ${diskGb}GB ${diskType}`;
        break;
      }

      case 'google_spanner_instance': {
        category = 'Database';
        monthlyUsd = 0.90 * HOURS_PER_MONTH;
        hourlyUsd = 0.90;
        details = 'Google Cloud Spanner (1 Node $657.00/mo)';
        break;
      }

      case 'google_firestore_database': {
        category = 'Database';
        monthlyUsd = 10.0;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Google Cloud Firestore NoSQL Database';
        break;
      }

      case 'google_bigtable_instance': {
        category = 'Database';
        monthlyUsd = 0.65 * HOURS_PER_MONTH;
        hourlyUsd = 0.65;
        details = 'Google Cloud Bigtable (1 Node $474.50/mo)';
        break;
      }

      case 'google_redis_instance': {
        category = 'Database';
        monthlyUsd = 0.049 * HOURS_PER_MONTH;
        hourlyUsd = 0.049;
        details = 'Memorystore Redis (1GB Standard)';
        break;
      }

      case 'google_bigquery_dataset': {
        category = 'Database';
        monthlyUsd = 20.0; // Storage + query analysis allowance
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Google BigQuery Serverless Data Warehouse';
        break;
      }

      case 'google_alloydb_cluster': {
        category = 'Database';
        monthlyUsd = 0.25 * HOURS_PER_MONTH;
        hourlyUsd = 0.25;
        details = 'Google AlloyDB for PostgreSQL';
        break;
      }

      case 'google_storage_bucket':
      case 'google_storage_bucket_archive': {
        category = 'Storage';
        const storageClass = String(cfg.storage_class ?? (type === 'google_storage_bucket_archive' ? 'ARCHIVE' : 'STANDARD'));
        const sizeGb = Number(cfg.estimated_storage_gb ?? (type === 'google_storage_bucket_archive' ? 500 : 100));
        const rate =
          storageClass === 'NEARLINE'
            ? GCP_PRICING_CATALOG.storage.bucket_nearline
            : storageClass === 'COLDLINE'
            ? GCP_PRICING_CATALOG.storage.bucket_coldline
            : storageClass === 'ARCHIVE'
            ? GCP_PRICING_CATALOG.storage.bucket_archive
            : GCP_PRICING_CATALOG.storage.bucket_standard;
        monthlyUsd = sizeGb * rate;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `GCS Bucket (${storageClass} ${sizeGb}GB @ $${rate}/GB)`;
        break;
      }

      case 'google_compute_disk':
      case 'google_compute_region_disk': {
        category = 'Storage';
        const sizeGb = Number(cfg.size_gb ?? 100);
        const diskType = String(cfg.type ?? 'pd-balanced');
        const rate =
          diskType === 'pd-standard'
            ? GCP_PRICING_CATALOG.storage.pd_standard
            : diskType === 'pd-ssd'
            ? GCP_PRICING_CATALOG.storage.pd_ssd
            : GCP_PRICING_CATALOG.storage.pd_balanced;
        monthlyUsd = sizeGb * rate;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `GCP Persistent Disk (${sizeGb}GB ${diskType})`;
        break;
      }

      case 'google_filestore_instance': {
        category = 'Storage';
        const sizeGb = Number(cfg.size_gb ?? 1000);
        monthlyUsd = sizeGb * GCP_PRICING_CATALOG.storage.filestore_basic;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = `Google Filestore NFS (${sizeGb}GB @ $0.20/GB)`;
        break;
      }

      case 'google_compute_global_forwarding_rule':
      case 'google_compute_backend_service': {
        category = 'Networking';
        monthlyUsd = GCP_PRICING_CATALOG.fabric.forwarding_rule_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Google Cloud Load Balancing ($18.25/mo base)';
        break;
      }

      case 'google_compute_router_nat': {
        category = 'Networking';
        monthlyUsd = GCP_PRICING_CATALOG.fabric.cloud_nat_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Google Cloud NAT ($32.85/mo)';
        break;
      }

      case 'google_compute_vpn_gateway': {
        category = 'Networking';
        monthlyUsd = GCP_PRICING_CATALOG.fabric.vpn_gateway_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Google Cloud HA VPN Gateway ($36.50/mo)';
        break;
      }

      case 'google_vertex_ai_endpoint': {
        category = 'Compute';
        monthlyUsd = GCP_PRICING_CATALOG.fabric.vertex_ai_endpoint_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Google Vertex AI Prediction Endpoint';
        break;
      }

      case 'google_dataproc_cluster': {
        category = 'Compute';
        monthlyUsd = 135.0;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Google Dataproc Spark/Hadoop Cluster';
        break;
      }

      case 'google_kms_crypto_key': {
        category = 'Security';
        monthlyUsd = GCP_PRICING_CATALOG.fabric.kms_crypto_key_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Google Cloud KMS Crypto Key ($0.06/mo)';
        break;
      }

      case 'google_secret_manager_secret': {
        category = 'Security';
        monthlyUsd = GCP_PRICING_CATALOG.fabric.secret_manager_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Google Secret Manager Secret ($0.06/mo)';
        break;
      }

      case 'google_compute_security_policy': {
        category = 'Security';
        monthlyUsd = GCP_PRICING_CATALOG.fabric.cloud_armor_policy_monthly;
        hourlyUsd = monthlyUsd / HOURS_PER_MONTH;
        details = 'Google Cloud Armor Security Policy ($5.00/mo)';
        break;
      }

      case 'google_compute_network':
      case 'google_compute_subnetwork':
      case 'google_compute_firewall':
      case 'google_service_account':
      default: {
        category = 'Base Fabric';
        monthlyUsd = 0;
        hourlyUsd = 0;
        details = 'Included in GCP Base Fabric ($0.00/mo)';
        break;
      }
    }
  }

  // Final sanity checks on returned cost numbers
  const safeMonthly = Number.isFinite(monthlyUsd) ? Math.max(0, monthlyUsd) : 0;
  const safeHourly = Number.isFinite(hourlyUsd) ? Math.max(0, hourlyUsd) : safeMonthly / HOURS_PER_MONTH;

  return {
    nodeId: node.id,
    name: node.name,
    type,
    provider,
    monthlyUsd: Math.round(safeMonthly * 100) / 100,
    hourlyUsd: Math.round(safeHourly * 10000) / 10000,
    category,
    details: details || `${type} resource configuration`,
  };
}

/**
 * Computes aggregated monthly and hourly infrastructure cost breakdown across a topology state.
 */
export function calculateTopologyCostBreakdown(state: TopologyState): TopologyCostBreakdown {
  const items: CostItem[] = [];
  const categoryTotals: Record<CostCategory, number> = {
    Compute: 0,
    Database: 0,
    Storage: 0,
    Networking: 0,
    Security: 0,
    'Base Fabric': 0,
  };

  const providerTotals: Record<CloudProvider, number> = {
    aws: 0,
    azure: 0,
    google: 0,
  };

  let totalMonthlyUsd = 0;
  let totalHourlyUsd = 0;

  for (const node of Object.values(state.nodes)) {
    const cost = calculateNodeCost(node);
    items.push(cost);

    categoryTotals[cost.category] = (categoryTotals[cost.category] ?? 0) + cost.monthlyUsd;
    const provider = (cost.provider as CloudProvider) || getProviderFromResourceType(cost.type);
    providerTotals[provider] = (providerTotals[provider] ?? 0) + cost.monthlyUsd;

    totalMonthlyUsd += cost.monthlyUsd;
    totalHourlyUsd += cost.hourlyUsd;
  }

  // Potential savings estimation across all providers
  let potentialSavingsUsd = 0;
  for (const node of Object.values(state.nodes)) {
    const cost = calculateNodeCost(node);

    // AWS Rightsizing
    if (node.type === 'aws_instance' || node.type === 'aws_instance_compute') {
      const instType = String(node.config['instance_type'] ?? '');
      if (
        instType.startsWith('c6i.') ||
        instType.startsWith('m6i.') ||
        instType.startsWith('m5.') ||
        instType.startsWith('c5.') ||
        instType.startsWith('r6i.')
      ) {
        potentialSavingsUsd += cost.monthlyUsd * 0.18;
      }
      if (node.config['root_volume_type'] === 'gp2' || node.config['root_volume_type'] === 'io2') {
        potentialSavingsUsd += 15.0;
      }
    } else if (node.type === 'aws_eks_cluster') {
      const nodeGroups =
        (node.config['node_groups'] as Array<{ capacity_type?: string }>) ?? [];
      const onDemandNgs = nodeGroups.filter((ng) => ng.capacity_type !== 'SPOT');
      if (onDemandNgs.length > 0) {
        potentialSavingsUsd += 48.0;
      }
    }

    // Azure Rightsizing
    else if (node.type === 'azurerm_linux_virtual_machine' || node.type === 'azurerm_windows_virtual_machine') {
      const vmSize = String(node.config['vm_size'] ?? '');
      if (vmSize.startsWith('Standard_D') || vmSize.startsWith('Standard_F')) {
        potentialSavingsUsd += cost.monthlyUsd * 0.20;
      }
      const osDisk = (node.config['os_disk'] as { storage_account_type?: string }) ?? {};
      if (osDisk.storage_account_type === 'Standard_LRS') {
        potentialSavingsUsd += 8.0;
      }
    } else if (node.type === 'azurerm_kubernetes_cluster') {
      potentialSavingsUsd += 42.0; // Spot node pool migration potential
    }

    // GCP Rightsizing
    else if (node.type === 'google_compute_instance') {
      const machineType = String(node.config['machine_type'] ?? '');
      if (machineType.startsWith('n1-') || machineType.startsWith('n2-')) {
        potentialSavingsUsd += cost.monthlyUsd * 0.22;
      }
      const bootDisk = (node.config['boot_disk'] as { type?: string }) ?? {};
      if (bootDisk.type === 'pd-standard') {
        potentialSavingsUsd += 6.0;
      }
    } else if (node.type === 'google_container_cluster') {
      const nodeConfig = (node.config['node_config'] as { spot?: boolean; preemptible?: boolean }) ?? {};
      if (!nodeConfig.spot && !nodeConfig.preemptible) {
        potentialSavingsUsd += 45.0;
      }
    }
  }

  return {
    totalMonthlyUsd: Math.round(totalMonthlyUsd * 100) / 100,
    totalHourlyUsd: Math.round(totalHourlyUsd * 10000) / 10000,
    items,
    categoryTotals: {
      Compute: Math.round((categoryTotals.Compute ?? 0) * 100) / 100,
      Database: Math.round((categoryTotals.Database ?? 0) * 100) / 100,
      Storage: Math.round((categoryTotals.Storage ?? 0) * 100) / 100,
      Networking: Math.round((categoryTotals.Networking ?? 0) * 100) / 100,
      Security: Math.round((categoryTotals.Security ?? 0) * 100) / 100,
      'Base Fabric': Math.round((categoryTotals['Base Fabric'] ?? 0) * 100) / 100,
    },
    providerTotals: {
      aws: Math.round((providerTotals.aws ?? 0) * 100) / 100,
      azure: Math.round((providerTotals.azure ?? 0) * 100) / 100,
      google: Math.round((providerTotals.google ?? 0) * 100) / 100,
    },
    potentialSavingsUsd: Math.round(potentialSavingsUsd * 100) / 100,
  };
}

/**
 * Standard contract method for monthly cost calculation.
 */
export function calculateMonthlyCost(state: TopologyState): {
  totalMonthlyCostUsd: number;
  totalHourlyCostUsd: number;
  items: CostItem[];
  categoryTotals: Record<CostCategory, number>;
  providerTotals: Record<CloudProvider, number>;
  potentialSavingsUsd: number;
} {
  const result = calculateTopologyCostBreakdown(state);
  return {
    totalMonthlyCostUsd: result.totalMonthlyUsd,
    totalHourlyCostUsd: result.totalHourlyUsd,
    items: result.items,
    categoryTotals: result.categoryTotals,
    providerTotals: result.providerTotals,
    potentialSavingsUsd: result.potentialSavingsUsd,
  };
}

/**
 * Generates actionable Multi-Cloud FinOps cost optimization recommendations.
 */
export function generateCostRecommendations(state: TopologyState): CostOptimizationRecommendation[] {
  const recs: CostOptimizationRecommendation[] = [];

  // =========================================================================
  // 1. AWS Recommendations
  // =========================================================================

  // 1.1 Graviton Migration Recommendation (x86 -> ARM64 Graviton3)
  const x86Nodes = Object.values(state.nodes).filter((n) => {
    if (n.type !== 'aws_instance' && n.type !== 'aws_instance_compute') return false;
    const t = String(n.config['instance_type'] ?? '');
    return (
      t.startsWith('c6i.') ||
      t.startsWith('m6i.') ||
      t.startsWith('m5.') ||
      t.startsWith('c5.') ||
      t.startsWith('r6i.')
    );
  });

  if (x86Nodes.length > 0) {
    const savings = x86Nodes.length * 14.5;
    recs.push({
      id: 'FIN-REC-001',
      title: 'Migrate x86 EC2 Instances to AWS Graviton (c7g/t4g)',
      category: 'Graviton',
      description: `Switching ${x86Nodes.length} x86 instance(s) to ARM64 Graviton instances delivers up to 20% cost savings with improved price-performance.`,
      estimatedSavingsMonthlyUsd: Math.round(savings * 100) / 100,
      targetNodeIds: x86Nodes.map((n) => n.id),
      actionType: 'MIGRATE_GRAVITON',
    });
  }

  // 1.2 Storage Modernization: gp2 / io2 -> gp3
  const legacyStorageNodes = Object.values(state.nodes).filter(
    (n) =>
      (n.type === 'aws_instance' || n.type === 'aws_ebs_volume') &&
      (n.config['root_volume_type'] === 'gp2' ||
        n.config['root_volume_type'] === 'io2' ||
        n.config['volume_type'] === 'gp2' ||
        n.config['volume_type'] === 'io2')
  );

  if (legacyStorageNodes.length > 0) {
    const savings = legacyStorageNodes.length * 22.0;
    recs.push({
      id: 'FIN-REC-002',
      title: 'Upgrade EBS Volumes to gp3 (Baseline 3,000 IOPS)',
      category: 'Storage',
      description: `Migrating ${legacyStorageNodes.length} volume(s) to gp3 reduces $/GB storage expenditure by 20% and includes 3,000 baseline IOPS without extra provisioning fees.`,
      estimatedSavingsMonthlyUsd: Math.round(savings * 100) / 100,
      targetNodeIds: legacyStorageNodes.map((n) => n.id),
      actionType: 'UPGRADE_EBS_GP3',
    });
  }

  // 1.3 EKS Spot Worker Nodes
  const eksClusters = Object.values(state.nodes).filter((n) => n.type === 'aws_eks_cluster');
  for (const eks of eksClusters) {
    const ngs =
      (eks.config['node_groups'] as Array<{ capacity_type?: string }>) ?? [];
    const onDemandNgs = ngs.filter((ng) => ng.capacity_type !== 'SPOT');
    if (onDemandNgs.length > 0) {
      recs.push({
        id: `FIN-REC-003-${eks.id}`,
        title: `Adopt Spot Capacity for Non-Critical EKS Node Groups (${eks.name})`,
        category: 'Spot',
        description:
          'Utilizing Spot instances for stateless microservices can reduce worker node compute expenditure by up to 70%.',
        estimatedSavingsMonthlyUsd: 48.0,
        targetNodeIds: [eks.id],
        actionType: 'ENABLE_EKS_SPOT',
      });
    }
  }

  // =========================================================================
  // 2. Azure Recommendations
  // =========================================================================

  // 2.1 Azure VM B-Series / Ampere ARM Rightsizing
  const azureUnoptimizedVms = Object.values(state.nodes).filter((n) => {
    if (n.type !== 'azurerm_linux_virtual_machine' && n.type !== 'azurerm_windows_virtual_machine') return false;
    const vmSize = String(n.config['vm_size'] ?? '');
    return vmSize.startsWith('Standard_D') || vmSize.startsWith('Standard_F');
  });

  if (azureUnoptimizedVms.length > 0) {
    const savings = azureUnoptimizedVms.length * 28.0;
    recs.push({
      id: 'FIN-REC-AZ-001',
      title: 'Rightsize Azure VMs to B-Series Burstable or Ampere ARM (Dpsv5)',
      category: 'Architecture',
      description: `Switching ${azureUnoptimizedVms.length} Azure VM(s) to Burstable B-Series or ARM64 Ampere Altra instances reduces monthly compute expenditure by up to 25%.`,
      estimatedSavingsMonthlyUsd: Math.round(savings * 100) / 100,
      targetNodeIds: azureUnoptimizedVms.map((n) => n.id),
      actionType: 'RIGHTSIZE_AZURE_VM',
    });
  }

  // 2.2 Azure Disk Modernization (HDD -> Premium SSD / Standard SSD)
  const azureLegacyDisks = Object.values(state.nodes).filter((n) => {
    if (n.type === 'azurerm_managed_disk' && n.config['storage_account_type'] === 'Standard_LRS') return true;
    if (
      (n.type === 'azurerm_linux_virtual_machine' || n.type === 'azurerm_windows_virtual_machine') &&
      (n.config['os_disk'] as { storage_account_type?: string })?.storage_account_type === 'Standard_LRS'
    ) {
      return true;
    }
    return false;
  });

  if (azureLegacyDisks.length > 0) {
    const savings = azureLegacyDisks.length * 12.0;
    recs.push({
      id: 'FIN-REC-AZ-002',
      title: 'Modernize Azure Managed Disks to Premium / Standard SSD',
      category: 'Storage',
      description: `Upgrading ${azureLegacyDisks.length} Azure disk(s) eliminates spinning HDD latency bottlenecks while maintaining cost predictability.`,
      estimatedSavingsMonthlyUsd: Math.round(savings * 100) / 100,
      targetNodeIds: azureLegacyDisks.map((n) => n.id),
      actionType: 'MODERNIZE_AZURE_DISK',
    });
  }

  // 2.3 Azure AKS Spot Node Pools
  const aksClusters = Object.values(state.nodes).filter((n) => n.type === 'azurerm_kubernetes_cluster');
  if (aksClusters.length > 0) {
    for (const aks of aksClusters) {
      recs.push({
        id: `FIN-REC-AZ-003-${aks.id}`,
        title: `Enable Spot Node Pools for Azure Kubernetes Service (${aks.name})`,
        category: 'Spot',
        description: 'Deploying AKS agent pools on Azure Spot Virtual Machines achieves up to 60% savings on container workloads.',
        estimatedSavingsMonthlyUsd: 42.0,
        targetNodeIds: [aks.id],
        actionType: 'ENABLE_AKS_SPOT',
      });
    }
  }

  // =========================================================================
  // 3. GCP Recommendations
  // =========================================================================

  // 3.1 GCP E2 Cost-Optimized Rightsizing
  const gcpUnoptimizedInstances = Object.values(state.nodes).filter((n) => {
    if (n.type !== 'google_compute_instance') return false;
    const machine = String(n.config['machine_type'] ?? '');
    return machine.startsWith('n1-') || machine.startsWith('n2-');
  });

  if (gcpUnoptimizedInstances.length > 0) {
    const savings = gcpUnoptimizedInstances.length * 24.5;
    recs.push({
      id: 'FIN-REC-GCP-001',
      title: 'Migrate GCE Instances to Cost-Optimized E2 Family',
      category: 'Architecture',
      description: `Transitioning ${gcpUnoptimizedInstances.length} GCE instance(s) to second-generation E2 instances lowers unit vCPU and memory rates by up to 30%.`,
      estimatedSavingsMonthlyUsd: Math.round(savings * 100) / 100,
      targetNodeIds: gcpUnoptimizedInstances.map((n) => n.id),
      actionType: 'MIGRATE_GCP_E2',
    });
  }

  // 3.2 GCP Balanced Persistent Disk Modernization
  const gcpLegacyDisks = Object.values(state.nodes).filter((n) => {
    if (n.type === 'google_compute_disk' && n.config['type'] === 'pd-standard') return true;
    if (
      n.type === 'google_compute_instance' &&
      (n.config['boot_disk'] as { type?: string })?.type === 'pd-standard'
    ) {
      return true;
    }
    return false;
  });

  if (gcpLegacyDisks.length > 0) {
    const savings = gcpLegacyDisks.length * 15.0;
    recs.push({
      id: 'FIN-REC-GCP-002',
      title: 'Upgrade GCE Persistent Disks to Balanced SSD (pd-balanced)',
      category: 'Storage',
      description: `Migrating ${gcpLegacyDisks.length} disk(s) to pd-balanced delivers up to 5x performance improvement with optimal price-per-gigabyte.`,
      estimatedSavingsMonthlyUsd: Math.round(savings * 100) / 100,
      targetNodeIds: gcpLegacyDisks.map((n) => n.id),
      actionType: 'UPGRADE_GCP_BALANCED_PD',
    });
  }

  // 3.3 GCP GKE Spot / Preemptible Nodes
  const gkeClusters = Object.values(state.nodes).filter((n) => {
    if (n.type !== 'google_container_cluster') return false;
    const nodeConfig = (n.config['node_config'] as { spot?: boolean; preemptible?: boolean }) ?? {};
    return !nodeConfig.spot && !nodeConfig.preemptible;
  });

  if (gkeClusters.length > 0) {
    for (const gke of gkeClusters) {
      recs.push({
        id: `FIN-REC-GCP-003-${gke.id}`,
        title: `Adopt Spot / Preemptible Nodes for GKE Cluster (${gke.name})`,
        category: 'Spot',
        description: 'Using GKE Spot VMs for worker pools reduces container compute expenditure by up to 70%.',
        estimatedSavingsMonthlyUsd: 45.0,
        targetNodeIds: [gke.id],
        actionType: 'ENABLE_GKE_SPOT',
      });
    }
  }

  return recs;
}

/**
 * Helper to escape RFC 4180 CSV fields containing quotes, commas, or newlines.
 */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Formats full RFC 4180 compliant CSV string representing the multi-cloud infrastructure cost breakdown.
 */
export function exportCostBreakdownCsv(
  data:
    | TopologyCostBreakdown
    | {
        items?: CostItem[];
        costBreakdown?: readonly CostItem[];
        totalMonthlyUsd?: number;
        totalMonthlyCostUsd?: number;
        totalHourlyUsd?: number;
        totalHourlyCostUsd?: number;
        categoryTotals?: Record<string, number>;
        providerTotals?: Record<string, number>;
        potentialSavingsUsd?: number;
      }
    | TopologyState
): string {
  let breakdown: TopologyCostBreakdown;

  if ('nodes' in data) {
    breakdown = calculateTopologyCostBreakdown(data as TopologyState);
  } else {
    const rawItems = (data.items ?? (data as { costBreakdown?: readonly CostItem[] }).costBreakdown ?? []) as CostItem[];
    const totalMonthly = Number(data.totalMonthlyUsd ?? (data as { totalMonthlyCostUsd?: number }).totalMonthlyCostUsd ?? 0);
    const totalHourly = Number(data.totalHourlyUsd ?? (data as { totalHourlyCostUsd?: number }).totalHourlyCostUsd ?? 0);
    const catTotals = (data.categoryTotals ?? {
      Compute: 0,
      Database: 0,
      Storage: 0,
      Networking: 0,
      Security: 0,
      'Base Fabric': 0,
    }) as Record<CostCategory, number>;
    const provTotals = (data.providerTotals ?? {
      aws: 0,
      azure: 0,
      google: 0,
    }) as Record<CloudProvider, number>;
    const savings = Number(data.potentialSavingsUsd ?? 0);

    breakdown = {
      totalMonthlyUsd: totalMonthly,
      totalHourlyUsd: totalHourly,
      items: rawItems,
      categoryTotals: catTotals,
      providerTotals: provTotals,
      potentialSavingsUsd: savings,
    };
  }

  const lines: string[] = [];

  // Section 1: Line Item Breakdown
  lines.push('CloudSwarm Studio - Multi-Cloud FinOps Infrastructure Cost Report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Provider,Resource Name,Node ID,Resource Type,Category,Hourly Rate ($/hr),Monthly Spend ($/mo),Details');

  for (const item of breakdown.items) {
    const prov = (item.provider ? item.provider.toUpperCase() : getProviderFromResourceType(item.type).toUpperCase());
    const row = [
      escapeCsvCell(prov),
      escapeCsvCell(item.name),
      escapeCsvCell(item.nodeId),
      escapeCsvCell(item.type),
      escapeCsvCell(item.category),
      item.hourlyUsd.toFixed(4),
      item.monthlyUsd.toFixed(2),
      escapeCsvCell(item.details ?? ''),
    ];
    lines.push(row.join(','));
  }

  // Section 2: Category Subtotals
  lines.push('');
  lines.push('Category Subtotals,Monthly Spend ($/mo),Percentage of Total (%)');
  const total = Math.max(0.01, breakdown.totalMonthlyUsd);
  for (const [category, amount] of Object.entries(breakdown.categoryTotals)) {
    const pct = ((Number(amount) / total) * 100).toFixed(1);
    lines.push(`${escapeCsvCell(category)},${Number(amount).toFixed(2)},${pct}%`);
  }

  // Section 3: Provider Subtotals
  lines.push('');
  lines.push('Provider Subtotals,Monthly Spend ($/mo),Percentage of Total (%)');
  for (const [provider, amount] of Object.entries(breakdown.providerTotals)) {
    const provLabel = provider === 'aws' ? 'Amazon Web Services (AWS)' : provider === 'azure' ? 'Microsoft Azure' : 'Google Cloud Platform (GCP)';
    const pct = ((Number(amount) / total) * 100).toFixed(1);
    lines.push(`${escapeCsvCell(provLabel)},${Number(amount).toFixed(2)},${pct}%`);
  }

  // Section 4: Summary Totals & Optimization Potential
  lines.push('');
  lines.push('Summary Metric,Amount ($)');
  lines.push(`Gross Projected Spend ($/mo),${breakdown.totalMonthlyUsd.toFixed(2)}`);
  lines.push(`Total Hourly Run-Rate ($/hr),${breakdown.totalHourlyUsd.toFixed(4)}`);
  lines.push(`Potential Monthly Savings ($/mo),${breakdown.potentialSavingsUsd.toFixed(2)}`);
  const netOptimized = Math.max(0, breakdown.totalMonthlyUsd - breakdown.potentialSavingsUsd);
  lines.push(`Net Optimized Spend ($/mo),${netOptimized.toFixed(2)}`);

  return lines.join('\r\n');
}

/**
 * CostCalculator class encapsulating rate cards and calculation routines.
 */
export class CostCalculator {
  private customAwsCatalog: typeof AWS_PRICING_CATALOG;
  private customAzureCatalog: typeof AZURE_PRICING_CATALOG;
  private customGcpCatalog: typeof GCP_PRICING_CATALOG;

  constructor(
    customAws?: Partial<typeof AWS_PRICING_CATALOG>,
    customAzure?: Partial<typeof AZURE_PRICING_CATALOG>,
    customGcp?: Partial<typeof GCP_PRICING_CATALOG>
  ) {
    this.customAwsCatalog = {
      ...AWS_PRICING_CATALOG,
      ...customAws,
    };
    this.customAzureCatalog = {
      ...AZURE_PRICING_CATALOG,
      ...customAzure,
    };
    this.customGcpCatalog = {
      ...GCP_PRICING_CATALOG,
      ...customGcp,
    };
  }

  public calculateNodeCost(node: CloudResourceNode): CostItem {
    return calculateNodeCost(node);
  }

  public calculateTopologyCost(state: TopologyState): TopologyCostBreakdown {
    return calculateTopologyCostBreakdown(state);
  }

  public calculateMonthlyCost(state: TopologyState): {
    totalMonthlyCostUsd: number;
    totalHourlyCostUsd: number;
    items: CostItem[];
    categoryTotals: Record<CostCategory, number>;
    providerTotals: Record<CloudProvider, number>;
    potentialSavingsUsd: number;
  } {
    return calculateMonthlyCost(state);
  }

  public generateRecommendations(state: TopologyState): CostOptimizationRecommendation[] {
    return generateCostRecommendations(state);
  }

  public exportCsv(breakdownOrState: TopologyCostBreakdown | TopologyState): string {
    return exportCostBreakdownCsv(breakdownOrState);
  }

  public getPricingCatalog(): typeof AWS_PRICING_CATALOG {
    return this.customAwsCatalog;
  }

  public getAzurePricingCatalog(): typeof AZURE_PRICING_CATALOG {
    return this.customAzureCatalog;
  }

  public getGcpPricingCatalog(): typeof GCP_PRICING_CATALOG {
    return this.customGcpCatalog;
  }
}

export const costCalculator = new CostCalculator();
