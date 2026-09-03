/**
 * Multi-Cloud FinOps Rate Cards (AWS, Azure, Google Cloud Platform)
 *
 * Real-time rate cards ($/mo and $/hr) based on standard 730 hours/month:
 * - Compute: vCPU, RAM, GPU (NVIDIA A100, H100, A10G, T4, L4), General Purpose, Compute-Optimized, Memory-Optimized
 * - Storage: Standard, Infrequent/Cool, Archive/Glacier, Provisioned IOPS, Managed Disks, Persistent Disks
 * - Databases: RDS/Aurora, Azure SQL/Cosmos DB/Postgres Flexible, Cloud SQL/Spanner/Bigtable/BigQuery/AlloyDB
 * - Containers & Serverless: EKS/ECS Fargate/Lambda, AKS/Container Apps/Functions, GKE/Cloud Run/Cloud Functions
 * - Fabric & Networking: Load Balancers, NAT Gateways, Transit Gateways, VPNs, WAF, Security/KMS
 */

import type { CloudProvider, CostCategory } from '../../types/topology';

/**
 * Standard monthly hours constant (365 days * 24 hrs / 12 months = 730 hrs/month)
 */
export const HOURS_PER_MONTH = 730;

// ============================================================================
// 1. AWS PRICING RATE CARDS
// ============================================================================
export const AWS_PRICING_CATALOG = {
  ec2: {
    // General Purpose (Burstable t3/t4g and Standard m5/m6i/m6g)
    't3.nano': 0.0052,
    't3.micro': 0.0104,
    't3.small': 0.0208,
    't3.medium': 0.0416,
    't3.large': 0.0832,
    't3.xlarge': 0.1664,
    't3.2xlarge': 0.3328,
    't4g.nano': 0.0042,
    't4g.micro': 0.0084,
    't4g.small': 0.0168,
    't4g.medium': 0.0336,
    't4g.large': 0.0672,
    't4g.xlarge': 0.1344,
    't4g.2xlarge': 0.2688,
    'm5.large': 0.096,
    'm5.xlarge': 0.192,
    'm6i.large': 0.096,
    'm6i.xlarge': 0.192,
    'm6i.2xlarge': 0.384,
    'm6i.4xlarge': 0.768,
    'm6g.large': 0.077,
    'm6g.xlarge': 0.154,
    'm6g.2xlarge': 0.308,
    'm6g.4xlarge': 0.616,

    // Compute-Optimized (c5, c6i, c7g Graviton3)
    'c5.large': 0.085,
    'c5.xlarge': 0.17,
    'c6i.large': 0.085,
    'c6i.xlarge': 0.17,
    'c6i.2xlarge': 0.34,
    'c6i.4xlarge': 0.68,
    'c7g.large': 0.0723,
    'c7g.xlarge': 0.1446,
    'c7g.2xlarge': 0.2892,
    'c7g.4xlarge': 0.5784,
    'c7g.8xlarge': 1.1568,

    // Memory-Optimized (r6i, r6g Graviton3)
    'r6i.large': 0.126,
    'r6i.xlarge': 0.252,
    'r6g.large': 0.1008,
    'r6g.xlarge': 0.2016,
    'r6g.2xlarge': 0.4032,
    'r6g.4xlarge': 0.8064,
    'r6g.8xlarge': 1.6128,

    // GPU Accelerated Compute (NVIDIA T4, A10G, A100, H100)
    'g4dn.xlarge': 0.526,     // 1x NVIDIA T4 (16GB)
    'g4dn.2xlarge': 0.752,
    'g5.xlarge': 1.006,       // 1x NVIDIA A10G (24GB)
    'g5.2xlarge': 1.212,      // 1x NVIDIA A10G (24GB) + 8 vCPU
    'g5.4xlarge': 1.624,      // 1x NVIDIA A10G (24GB) + 16 vCPU
    'g5.8xlarge': 2.448,      // 1x NVIDIA A10G (24GB) + 32 vCPU
    'g5.12xlarge': 5.672,     // 4x NVIDIA A10G (96GB)
    'p4d.24xlarge': 32.77,    // 8x NVIDIA A100 (320GB SXM4)
    'p4de.24xlarge': 40.96,   // 8x NVIDIA A100 (640GB SXM4)
    'p5.48xlarge': 98.32,     // 8x NVIDIA H100 (640GB SXM5)
  } as Record<string, number>,

  rds: {
    'db.t3.micro': 0.021,
    'db.t3.small': 0.041,
    'db.t3.medium': 0.082,
    'db.t4g.micro': 0.018,
    'db.t4g.small': 0.036,
    'db.t4g.medium': 0.073,
    'db.t4g.large': 0.146,
    'db.t4g.xlarge': 0.292,
    'db.m6i.large': 0.20,
    'db.m6g.large': 0.182,
    'db.m6g.xlarge': 0.364,
    'db.r6i.large': 0.264,
    'db.r6g.large': 0.24,
    'db.r6g.xlarge': 0.48,
    'db.r6g.2xlarge': 0.96,
    'db.r6g.4xlarge': 1.92,
    'db.r6g.8xlarge': 3.84,
  } as Record<string, number>,

  storage: {
    ebs_gp3: 0.08,             // $/GB-mo
    ebs_gp2: 0.10,             // $/GB-mo
    ebs_io2: 0.125,            // $/GB-mo
    ebs_io2_iops: 0.065,       // $/IOPS-mo
    s3_standard: 0.023,        // $/GB-mo
    s3_ia: 0.0125,             // $/GB-mo
    s3_glacier: 0.004,         // $/GB-mo
    s3_deep_archive: 0.00099,  // $/GB-mo
    efs_standard: 0.30,        // $/GB-mo
    fsx_lustre: 0.14,          // $/GB-mo
    rds_storage_gp3: 0.115,    // $/GB-mo
    rds_storage_io2: 0.15,     // $/GB-mo
  },

  fargate: {
    vcpu_per_hr: 0.04048,      // $/vCPU-hr
    gb_per_hr: 0.004445,       // $/GB-hr
  },

  fabric: {
    eks_cluster_fee_monthly: 73.0,  // $0.10/hr * 730 = $73.00/mo
    alb_base_monthly: 16.2,         // Base Application Load Balancer rate $/mo
    nat_gateway_monthly: 32.85,     // $0.045/hr * 730 = $32.85/mo
    vpc_endpoint_monthly: 7.3,      // $0.01/hr * 730
    transit_gateway_monthly: 36.5,  // $0.05/hr * 730
    cloudfront_per_gb: 0.085,
    kms_key_monthly: 1.0,
    secretsmanager_secret_monthly: 0.40,
    wafv2_acl_monthly: 5.0,
    sagemaker_endpoint_base_monthly: 73.0,
    redshift_base_hourly: 0.25,
    elasticache_base_hourly: 0.034,
    dynamodb_base_monthly: 5.0,
  },
};

// ============================================================================
// 2. AZURE PRICING RATE CARDS
// ============================================================================
export const AZURE_PRICING_CATALOG = {
  vm: {
    // General Purpose (B-Series Burstable & D-Series Standard)
    'Standard_B1s': 0.0104,
    'Standard_B2s': 0.0416,
    'Standard_B2ms': 0.0832,
    'Standard_B4ms': 0.1664,
    'Standard_D2s_v5': 0.096,
    'Standard_D4s_v5': 0.192,
    'Standard_D8s_v5': 0.384,
    'Standard_D16s_v5': 0.768,
    'Standard_D2ps_v5': 0.077,   // ARM64 Ampere Altra
    'Standard_D4ps_v5': 0.154,

    // Compute-Optimized (F-Series)
    'Standard_F2s_v2': 0.085,
    'Standard_F4s_v2': 0.169,
    'Standard_F8s_v2': 0.338,
    'Standard_F16s_v2': 0.677,

    // Memory-Optimized (E-Series)
    'Standard_E2s_v5': 0.126,
    'Standard_E4s_v5': 0.252,
    'Standard_E8s_v5': 0.504,
    'Standard_E16s_v5': 1.008,
    'Standard_E2ps_v5': 0.101,   // ARM64 Ampere Altra

    // GPU Accelerated Compute (NC, NV, ND Series)
    'Standard_NC4as_T4_v3': 0.526,    // 1x NVIDIA T4 (16GB)
    'Standard_NC8as_T4_v3': 0.752,
    'Standard_NV36ads_A10_v5': 1.006, // 1x NVIDIA A10G (24GB)
    'Standard_NV72ads_A10_v5': 2.012,
    'Standard_ND96amsr_A100_v4': 32.77, // 8x NVIDIA A100 (320GB)
    'Standard_ND96isr_H100_v5': 45.00,  // 8x NVIDIA H100 (640GB)
  } as Record<string, number>,

  database: {
    // Azure SQL Database
    'Basic': 0.0068,             // ~$4.99/mo
    'S0': 0.0205,                // ~$15.00/mo
    'S1': 0.0411,                // ~$30.00/mo
    'S2': 0.1027,                // ~$75.00/mo
    'GP_Gen5_2': 0.2900,         // ~$211.70/mo (General Purpose 2 vCore)
    'GP_Gen5_4': 0.5800,         // ~$423.40/mo (General Purpose 4 vCore)
    'BC_Gen5_2': 0.6500,         // Business Critical 2 vCore

    // Azure PostgreSQL Flexible Server
    'Standard_B1ms': 0.018,
    'Standard_B2s': 0.036,
    'Standard_D2ds_v5': 0.198,
    'Standard_E2ds_v5': 0.264,

    // Cosmos DB, Redis, Synapse
    'cosmos_base_hourly': 0.032, // Baseline 400 RU/s = ~$23.36/mo
    'redis_standard_hourly': 0.10, // Standard C1 ~$73.00/mo
    'synapse_dw100c_hourly': 1.51,
  } as Record<string, number>,

  storage: {
    blob_hot: 0.018,             // $/GB-mo
    blob_cool: 0.010,            // $/GB-mo
    blob_archive: 0.00099,       // $/GB-mo
    disk_standard_hdd: 0.040,    // $/GB-mo (Standard_LRS)
    disk_standard_ssd: 0.075,    // $/GB-mo (StandardSSD_LRS)
    disk_premium_ssd: 0.135,     // $/GB-mo (Premium_LRS)
    disk_ultra: 0.180,           // $/GB-mo (UltraSSD_LRS)
    disk_ultra_iops: 0.005,      // $/IOPS-mo
    azure_files: 0.060,          // $/GB-mo
    data_lake_gen2: 0.018,       // $/GB-mo
  },

  container: {
    aks_management_monthly: 0.0, // Free cluster management default (or $73/mo for SLA tier)
    aks_sla_monthly: 73.0,
    aci_vcpu_per_hr: 0.040,      // Azure Container Instances
    aci_gb_per_hr: 0.0044,
    app_service_b1_monthly: 13.14,
    app_service_s1_monthly: 73.0,
  },

  fabric: {
    app_gateway_base_monthly: 18.25, // $0.025/hr * 730 = $18.25/mo
    load_balancer_base_monthly: 18.25,
    nat_gateway_monthly: 32.85,
    virtual_wan_hub_monthly: 73.0,
    key_vault_monthly: 0.0,          // $0.00 base, billed per operation
    cdn_per_gb: 0.081,
    waf_policy_monthly: 5.0,
    defender_monthly: 15.0,
    databricks_dbu_hourly: 0.40,
    ml_workspace_base_monthly: 0.0,
  },
};

// ============================================================================
// 3. GCP PRICING RATE CARDS
// ============================================================================
export const GCP_PRICING_CATALOG = {
  gce: {
    // General Purpose (E2 Cost-Optimized & N2 Standard)
    'e2-micro': 0.0084,
    'e2-small': 0.0168,
    'e2-medium': 0.0336,
    'e2-standard-2': 0.067,
    'e2-standard-4': 0.134,
    'e2-standard-8': 0.268,
    'n2-standard-2': 0.097,
    'n2-standard-4': 0.194,
    'n2-standard-8': 0.388,
    'n2-standard-16': 0.776,

    // Compute-Optimized (C2, C3)
    'c2-standard-4': 0.2088,
    'c2-standard-8': 0.4176,
    'c2-standard-16': 0.8352,
    'c3-standard-4': 0.174,
    'c3-standard-8': 0.348,

    // Memory-Optimized (N2 HighMem)
    'n2-highmem-2': 0.131,
    'n2-highmem-4': 0.262,
    'n2-highmem-8': 0.524,
    'n2-highmem-16': 1.048,

    // GPU Accelerated Compute (NVIDIA T4, A10G/L4, A100, H100)
    'n1-standard-4-t4': 0.526,    // 1x NVIDIA T4 (16GB)
    'g2-standard-4': 1.006,       // 1x NVIDIA L4 / A10G equivalent (24GB)
    'g2-standard-8': 1.486,
    'a2-highgpu-1g': 3.673,       // 1x NVIDIA A100 (40GB)
    'a2-highgpu-8g': 29.384,      // 8x NVIDIA A100 (320GB)
    'a2-megagpu-16g': 32.77,      // 16x NVIDIA A100 (640GB)
    'a3-highgpu-8g': 45.00,       // 8x NVIDIA H100 (640GB SXM5)
  } as Record<string, number>,

  database: {
    // Cloud SQL (Postgres / MySQL)
    'db-f1-micro': 0.015,
    'db-g1-small': 0.030,
    'db-custom-2-7680': 0.098,
    'db-custom-4-15360': 0.196,
    'db-custom-8-30720': 0.392,
    'db-n1-standard-2': 0.105,
    'db-n1-standard-4': 0.210,

    // Spanner, Bigtable, Firestore, Memorystore, AlloyDB
    'spanner_node_hourly': 0.90,  // $657.00/mo per node
    'bigtable_node_hourly': 0.65, // $474.50/mo per node
    'memorystore_1gb_hourly': 0.049,
    'memorystore_ha_1gb_hourly': 0.098,
    'alloydb_2vcpu_hourly': 0.25,
  } as Record<string, number>,

  storage: {
    bucket_standard: 0.020,      // $/GB-mo
    bucket_nearline: 0.010,      // $/GB-mo
    bucket_coldline: 0.004,      // $/GB-mo
    bucket_archive: 0.0012,      // $/GB-mo
    pd_standard: 0.040,          // $/GB-mo (Standard HDD)
    pd_balanced: 0.100,          // $/GB-mo (Balanced Persistent Disk)
    pd_ssd: 0.170,               // $/GB-mo (Performance SSD)
    pd_extreme: 0.250,           // $/GB-mo (Extreme Persistent Disk)
    filestore_basic: 0.200,      // $/GB-mo
    filestore_enterprise: 0.300, // $/GB-mo
  },

  container: {
    gke_cluster_fee_monthly: 73.0, // $0.10/hr * 730 = $73.00/mo (Free tier applies to first cluster)
    cloud_run_vcpu_per_hr: 0.0864, // $0.00002400/vCPU-s * 3600
    cloud_run_gb_per_hr: 0.009,    // $0.00000250/GiB-s * 3600
    cloud_functions_base: 0.0,
    app_engine_f1_hourly: 0.05,
  },

  fabric: {
    forwarding_rule_monthly: 18.25, // Cloud Load Balancing base ($0.025/hr * 730)
    cloud_nat_monthly: 32.85,       // $0.045/hr * 730
    vpn_gateway_monthly: 36.50,     // $0.05/hr * 730
    cloud_cdn_per_gb: 0.080,
    kms_crypto_key_monthly: 0.06,
    secret_manager_monthly: 0.06,
    cloud_armor_policy_monthly: 5.0,
    vertex_ai_endpoint_monthly: 73.0,
    dataproc_cluster_hourly: 0.10,
  },
};

// ============================================================================
// Multi-Cloud Helper Utilities
// ============================================================================

/**
 * Resolves cloud provider for any resource type string.
 */
export function getProviderFromResourceType(type?: string): CloudProvider {
  if (!type || typeof type !== 'string') return 'aws';
  if (type.startsWith('azurerm_')) return 'azure';
  if (type.startsWith('google_')) return 'google';
  return 'aws';
}

/**
 * Resolves default cost category for a given resource type.
 */
export function getCategoryFromResourceType(type?: string): CostCategory {
  if (!type || typeof type !== 'string') return 'Compute';
  if (
    type.includes('instance') ||
    type.includes('virtual_machine') ||
    type.includes('cluster') ||
    type.includes('container') ||
    type.includes('function') ||
    type.includes('batch') ||
    type.includes('run') ||
    type.includes('app_service') ||
    type.includes('spring') ||
    type.includes('sagemaker') ||
    type.includes('machine_learning') ||
    type.includes('vertex_ai') ||
    type.includes('databricks') ||
    type.includes('emr') ||
    type.includes('dataproc') ||
    type.includes('notebook')
  ) {
    return 'Compute';
  }

  if (
    type.includes('db_') ||
    type.includes('sql') ||
    type.includes('rds') ||
    type.includes('dynamodb') ||
    type.includes('cosmos') ||
    type.includes('redis') ||
    type.includes('elasticache') ||
    type.includes('redshift') ||
    type.includes('synapse') ||
    type.includes('spanner') ||
    type.includes('firestore') ||
    type.includes('bigtable') ||
    type.includes('bigquery') ||
    type.includes('alloydb') ||
    type.includes('neptune') ||
    type.includes('kusto') ||
    type.includes('mariadb')
  ) {
    return 'Database';
  }

  if (
    type.includes('s3') ||
    type.includes('blob') ||
    type.includes('storage') ||
    type.includes('bucket') ||
    type.includes('disk') ||
    type.includes('ebs') ||
    type.includes('efs') ||
    type.includes('fsx') ||
    type.includes('glacier') ||
    type.includes('filestore') ||
    type.includes('vault') ||
    type.includes('backup') ||
    type.includes('lake')
  ) {
    return 'Storage';
  }

  if (
    type.includes('vpc') ||
    type.includes('vnet') ||
    type.includes('network') ||
    type.includes('subnet') ||
    type.includes('lb') ||
    type.includes('gateway') ||
    type.includes('cdn') ||
    type.includes('route') ||
    type.includes('transit') ||
    type.includes('wan') ||
    type.includes('peering') ||
    type.includes('forwarding')
  ) {
    return 'Networking';
  }

  if (
    type.includes('security') ||
    type.includes('firewall') ||
    type.includes('iam') ||
    type.includes('role') ||
    type.includes('key') ||
    type.includes('vault') ||
    type.includes('kms') ||
    type.includes('secret') ||
    type.includes('waf') ||
    type.includes('shield') ||
    type.includes('defender') ||
    type.includes('service_account')
  ) {
    return 'Security';
  }

  return 'Base Fabric';
}
