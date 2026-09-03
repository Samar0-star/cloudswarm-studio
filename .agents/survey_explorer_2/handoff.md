# Comprehensive Technical Survey Report: Resource Catalog & Multi-Cloud Terraform/OpenTofu Export Engine

**Agent**: `survey_explorer_2`  
**Working Directory**: `/Users/samaraldico/webmcp/.agents/survey_explorer_2`  
**Parent Agent ID**: `9afb113d-1dd5-4e00-b542-effb9bec5260`  
**Date**: 2026-08-29  
**Status**: Complete (Hard Handoff)

---

## 1. Observation

Direct observations from examining the codebase:

1. **Current Catalog Implementation**:
   - `src/core/catalog/resourceCatalog.ts`: **Does not exist yet**.
   - `src/types/topology.ts` (lines 6–16): Defines `AWSResourceType` union restricted to exactly 10 AWS primitives:
     ```typescript
     export type AWSResourceType =
       | 'aws_vpc'
       | 'aws_subnet'
       | 'aws_instance'
       | 'aws_ecs_cluster'
       | 'aws_eks_cluster'
       | 'aws_db_instance'
       | 'aws_s3_bucket'
       | 'aws_lb'
       | 'aws_security_group'
       | 'aws_iam_role';
     ```
   - `src/components/canvas/ResourcePalette.tsx` (lines 30–103): Hardcodes `RESOURCE_TEMPLATES` with only 9 AWS items (omitting `aws_iam_role`). No Azure or GCP primitives exist.
   - `src/core/webmcp/tools/topologyTools.ts` (lines 31–42): Restricts `AWS_RESOURCE_TYPES` array to the same 10 AWS types.
   - **Current Primitive Count**: **10 primitives total** (10 AWS, 0 Azure, 0 GCP). Target: **100+ primitives across AWS, Azure, and GCP**.

2. **Current HCL Export Engine**:
   - `src/core/export/ProductionMaterializer.ts` (lines 352–374): `generateMainTf` hardcodes the `aws` provider block only (`hashicorp/aws ~> 5.0`). Azure (`hashicorp/azurerm`) and GCP (`hashicorp/google`) provider declarations are completely missing.
   - `src/core/export/ProductionMaterializer.ts` (lines 301–347): `generateVariablesTf` only defines AWS variables (`aws_region`, `environment`, `project_name`, `vpc_cidr`, `db_password`, `tags`).
   - `src/core/export/ProductionMaterializer.ts` (lines 379–413): `generateOutputsTf` only extracts attributes for 4 AWS types (`aws_vpc`, `aws_lb`, `aws_db_instance`, `aws_s3_bucket`).
   - `src/core/export/ProductionMaterializer.ts` (lines 16–145): Features a standalone, zero-dependency in-memory `SimpleZipBuilder` using PKZIP format with CRC-32 checksums and DataView binary packing, generating downloadable ZIP bundles with SHA-256 signed audit certificates (`generateAuditCertificate`).
   - `src/core/export/ProductionMaterializer.ts` (lines 252–296): `generateDockerfile` produces a multi-stage production Dockerfile (`node:20-alpine` builder -> `nginx:alpine` runtime with non-root user `nginx:101`).

3. **Current HCL Sync Engine (`src/core/sync/HCLSyncEngine.ts`)**:
   - Lines 613–624: `hclToCanvas` maintains a hardcoded `knownTypes` set of only the 10 AWS types and defaults any unrecognized block type to `aws_instance`.
   - Lines 803–972: `renderNodeAttributes` has explicit HCL rendering blocks only for the 10 AWS types, falling back to a flat key-value dumper for unknown types.
   - Lines 1035–1116: Reference parsing (`extractEdgesFromNode` and `extractReferenceId`) only matches AWS-style HCL references (`aws_[a-z_]+\.([a-zA-Z0-9_]+)\.id`). Azure (`azurerm_*`) and GCP (`google_*`) reference extraction is not supported.

4. **Test Suite & Build Health**:
   - Ran `npm test`: **21 test suites passed, 371 tests passed (100% pass rate in 1.56s)**.
   - Ran `npm run build`: `tsc -b && vite build` compiled with **0 TypeScript errors (Strict Mode)**.

---

## 2. Logic Chain

1. **Gap Analysis (Catalog)**:
   - Current primitive count is 10 (AWS only).
   - Requirement R2 demands 100+ primitives spanning AWS, Azure, and GCP across 6 domains: Compute, Storage, Databases, Networking, Security & IAM, AI/ML & Analytics.
   - To achieve this without breaking type safety, `src/types/topology.ts` and a new `src/core/catalog/resourceCatalog.ts` must define a unified `CloudResourceType` union (or generic provider-prefixed resource type) with 108+ structured primitives (~36 AWS, ~36 Azure, ~36 GCP).

2. **Gap Analysis (HCL Export & Sync Engine)**:
   - `ProductionMaterializer` must be updated so `generateMainTf`, `generateVariablesTf`, `generateOutputsTf`, `generateTerraformTfvars`, and `generateReadme` support multi-cloud deployments where a single architecture can combine AWS, Azure, and GCP resources simultaneously.
   - `HCLSyncEngine` requires parser support for `azurerm_*` and `google_*` resource blocks, nested blocks (e.g. `features {}`, `network_interface {}`, `os_disk {}`), and multi-cloud reference graph edge synthesis.

3. **UI Integration**:
   - `ResourcePalette.tsx` must be upgraded to consume the central `resourceCatalog.ts`, adding provider tabs (`All`, `AWS`, `Azure`, `GCP`), category filters (6 categories), instant text search, and a primitive counter showing 100+ items.
   - `NodeInspector.tsx` must dynamically render property editors for Azure (e.g. VM size `Standard_D4s_v5`, OS disk, VNet selector) and GCP (e.g. machine type `n2-standard-8`, Cloud SQL tier, GCS storage class) with instant FinOps recalculation.

---

## 3. Caveats

- Expanding `CloudResourceType` from 10 to 100+ primitives must preserve backward compatibility with existing tests (`src/tests/hclSync.test.ts`, `src/tests/materializer.test.ts`, `src/tests/pricing.test.ts`) that expect AWS types to function identically.
- Live AST synchronization (`HCLSyncEngine`) for 100+ primitives should use a modular table-driven generator map rather than a giant 100-case switch statement to maintain maintainability and sub-millisecond AST compilation speed.

---

## 4. Conclusion

CloudSwarm Studio has a solid, 100% passing core architecture with high-fidelity AST parsing, in-memory ZIP bundle materialization, and multi-stage Dockerfile generation. However, both the resource catalog (10 vs 100+ primitives) and the Terraform export engine (AWS-only vs multi-cloud `aws`/`azurerm`/`google`) require systematic expansion to achieve the target enterprise multi-cloud state.

---

## 5. Verification Method

To verify codebase survey findings:
1. Run test suite:
   ```bash
   npm test
   ```
2. Verify TypeScript strict mode compilation:
   ```bash
   npm run build
   ```
3. Inspect current type definitions:
   ```bash
   cat src/types/topology.ts
   ```
4. Inspect export materializer:
   ```bash
   cat src/core/export/ProductionMaterializer.ts
   ```

---

## 6. Comprehensive Technical Inventory & Architecture Specification

### 6.1 Multi-Cloud Resource Catalog Breakdown (108 Primitives)

To achieve 100+ cloud primitives across AWS, Azure, and GCP, the proposed architecture establishes **108 distinct cloud primitives** (36 AWS, 36 Azure, 36 GCP) categorized across 6 primary architecture domains:

```
+---------------------------------------------------------------------------------------+
|                       CLOUDSWARM STUDIO RESOURCE CATALOG (108 PRIMITIVES)             |
+-------------------+--------------------+--------------------+-------------------------+
| Category          | AWS (36 Total)     | Azure (36 Total)   | GCP (36 Total)          |
+-------------------+--------------------+--------------------+-------------------------+
| Compute           | 8 primitives       | 8 primitives       | 8 primitives            |
| Storage           | 6 primitives       | 6 primitives       | 6 primitives            |
| Databases & Cache | 7 primitives       | 7 primitives       | 7 primitives            |
| Networking & CDN  | 7 primitives       | 7 primitives       | 7 primitives            |
| Security & IAM    | 5 primitives       | 5 primitives       | 5 primitives            |
| AI/ML & Analytics | 3 primitives       | 3 primitives       | 3 primitives            |
+-------------------+--------------------+--------------------+-------------------------+
```

#### Detailed Primitive Inventory by Category:

#### A. Compute (24 Primitives)
- **AWS (8)**:
  1. `aws_instance` — EC2 General Purpose VM (t3/t4g/m6i)
  2. `aws_instance_compute` — EC2 Compute-Optimized VM (c6i/c7g)
  3. `aws_instance_gpu` — EC2 GPU Acceleration Cluster (p4d.24xlarge / g5.xlarge / NVIDIA A100)
  4. `aws_eks_cluster` — Managed Elastic Kubernetes Service (EKS Control Plane & NodeGroups)
  5. `aws_ecs_cluster` — Elastic Container Service (ECS Fargate / EC2 launch types)
  6. `aws_lambda_function` — Serverless Event-Driven Compute (Node.js/Python/Go)
  7. `aws_apprunner_service` — Fully Managed Container Application Runner
  8. `aws_batch_compute_environment` — Batch High-Throughput Computing Cluster
- **Azure (8)**:
  9. `azurerm_linux_virtual_machine` — Azure Linux General Purpose VM (Standard_B2s/D4s_v5)
  10. `azurerm_windows_virtual_machine` — Azure Windows Enterprise Server VM
  11. `azurerm_virtual_machine_gpu` — Azure GPU Accelerated VM (NDv4 / NCv3 / NVIDIA A100)
  12. `azurerm_kubernetes_cluster` — Azure Kubernetes Service (AKS Cluster & System/User pools)
  13. `azurerm_container_group` — Azure Container Instances (ACI Serverless Containers)
  14. `azurerm_linux_function_app` — Azure Functions Serverless Compute App
  15. `azurerm_app_service` — Azure App Service / Web App PaaS
  16. `azurerm_spring_cloud_service` — Azure Spring Apps Microservices Engine
- **GCP (8)**:
  17. `google_compute_instance` — Google Compute Engine General VM (e2-standard / n2-standard)
  18. `google_compute_instance_optimized` — GCE Compute Optimized VM (c2-standard / c3-highcpu)
  19. `google_compute_instance_gpu` — GCE Accelerator-Optimized GPU VM (a2-highgpu / g2-standard / NVIDIA A100/H100)
  20. `google_container_cluster` — Google Kubernetes Engine (GKE Standard & Autopilot)
  21. `google_cloud_run_service` — Cloud Run Fully Managed Serverless Containers
  22. `google_cloudfunctions_function` — Google Cloud Functions Serverless Execution
  23. `google_app_engine_standard_app_version` — Google App Engine Serverless PaaS
  24. `google_compute_instance_group_manager` — GCE Managed Instance Group (MIG Auto-Scaling)

#### B. Storage (18 Primitives)
- **AWS (6)**:
  25. `aws_s3_bucket` — Object Storage Bucket (Standard, S3-IA, Intelligent-Tiering)
  26. `aws_ebs_volume` — Elastic Block Store Volume (gp3 / io2 Block Storage)
  27. `aws_efs_file_system` — Elastic File System (Managed NFS File Storage)
  28. `aws_glacier_vault` — S3 Glacier Deep Archive Storage Vault
  29. `aws_fsx_lustre_file_system` — High-Performance FSx for Lustre Parallel File System
  30. `aws_backup_vault` — Centralized Automated AWS Backup Vault
- **Azure (6)**:
  31. `azurerm_storage_account` — Azure Storage Account (Blob / Table / Queue)
  32. `azurerm_storage_container` — Azure Blob Storage Container (Hot / Cool / Archive)
  33. `azurerm_managed_disk` — Azure Managed Disk (Standard HDD, Premium SSD, Ultra Disk)
  34. `azurerm_storage_share` — Azure Files Managed SMB / NFS File Shares
  35. `azurerm_data_lake_storage_gen2` — Azure Data Lake Storage Gen2 (Hierarchical Namespace)
  36. `azurerm_backup_vault` — Azure Recovery Services / Backup Vault
- **GCP (6)**:
  37. `google_storage_bucket` — Google Cloud Storage Bucket (Standard / Nearline / Coldline / Archive)
  38. `google_compute_disk` — Persistent Disk (Standard, Balanced, SSD, Extreme Disk)
  39. `google_filestore_instance` — Google Cloud Filestore Managed NFS File Storage
  40. `google_storage_bucket_archive` — Cloud Storage Archive Tier Long-Term Cold Storage
  41. `google_compute_region_disk` — Regional Persistent Disk High-Availability Replication
  42. `google_backup_dr_management_server` — Google Cloud Backup and Disaster Recovery Service

#### C. Databases & In-Memory Caches (21 Primitives)
- **AWS (7)**:
  43. `aws_db_instance` — Relational Database Service (RDS PostgreSQL / MySQL / MariaDB)
  44. `aws_rds_cluster` — Amazon Aurora Global Multi-Region / Serverless v2 Cluster
  45. `aws_dynamodb_table` — Amazon DynamoDB Fully Managed Serverless NoSQL Database
  46. `aws_elasticache_cluster` — Amazon ElastiCache In-Memory Redis / Memcached Cache
  47. `aws_redshift_cluster` — Amazon Redshift Petabyte-Scale Cloud Data Warehouse
  48. `aws_neptune_cluster` — Amazon Neptune Fully Managed Graph Database Engine
  49. `aws_opensearch_domain` — Amazon OpenSearch Managed Search & Analytics Cluster
- **Azure (7)**:
  50. `azurerm_mssql_database` — Azure SQL Database Serverless / Hyperscale Tier
  51. `azurerm_postgresql_flexible_server` — Azure Database for PostgreSQL Flexible Server
  52. `azurerm_cosmosdb_account` — Azure Cosmos DB Globally Distributed Multi-Model NoSQL DB
  53. `azurerm_redis_cache` — Azure Cache for Redis In-Memory Enterprise Accelerator
  54. `azurerm_synapse_workspace` — Azure Synapse Analytics Data Warehouse & SQL Pool
  55. `azurerm_kusto_cluster` — Azure Data Explorer (Kusto) Time-Series Analytics
  56. `azurerm_mariadb_server` — Azure Database for MariaDB Managed Database
- **GCP (7)**:
  57. `google_sql_database_instance` — Google Cloud SQL (PostgreSQL / MySQL / SQL Server)
  58. `google_spanner_instance` — Google Cloud Spanner Unlimited Scalability Relational DB
  59. `google_firestore_database` — Google Cloud Firestore Serverless Document NoSQL Database
  60. `google_bigtable_instance` — Google Cloud Bigtable Low-Latency High-Throughput NoSQL
  61. `google_redis_instance` — Google Cloud Memorystore for Redis In-Memory Cache
  62. `google_bigquery_dataset` — Google BigQuery Serverless Petabyte Data Warehouse
  63. `google_alloydb_cluster` — Google AlloyDB for PostgreSQL Enterprise Database

#### D. Networking & Content Delivery (21 Primitives)
- **AWS (7)**:
  64. `aws_vpc` — Virtual Private Cloud Isolated Network Fabric
  65. `aws_subnet` — Availability Zone Public / Private Subnet Tier
  66. `aws_lb` — Elastic Load Balancing (Application Load Balancer / Network Load Balancer)
  67. `aws_nat_gateway` — Highly Available Managed Outbound NAT Gateway
  68. `aws_internet_gateway` — VPC Internet Gateway for Public Routing
  69. `aws_ec2_transit_gateway` — Centralized Transit Gateway Network Router
  70. `aws_cloudfront_distribution` — CloudFront Low-Latency Global Edge CDN
- **Azure (7)**:
  71. `azurerm_virtual_network` — Azure Virtual Network (VNet)
  72. `azurerm_subnet` — Azure VNet Subnet Network Partition
  73. `azurerm_lb` — Azure Load Balancer (Layer-4 High-Throughput Load Balancer)
  74. `azurerm_application_gateway` — Azure Application Gateway (Layer-7 ALB with SSL Offload)
  75. `azurerm_nat_gateway` — Azure Virtual Network NAT Gateway
  76. `azurerm_virtual_wan` — Azure Virtual WAN Hub-and-Spoke Mesh Network
  77. `azurerm_cdn_profile` — Azure Front Door & CDN Global Edge Accelerator
- **GCP (7)**:
  78. `google_compute_network` — Google Cloud VPC Network (Global Software-Defined Network)
  79. `google_compute_subnetwork` — Regional Subnet Network Partition
  80. `google_compute_global_forwarding_rule` — Google Cloud Load Balancing (Global External HTTP(S) LB)
  81. `google_compute_router_nat` — Google Cloud NAT Gateway Outbound Translation
  82. `google_compute_vpn_gateway` — Google Cloud HA-VPN IPsec Site-to-Site Gateway
  83. `google_compute_network_peering` — VPC Network Peering Private Interconnect
  84. `google_compute_backend_service` — Google Cloud CDN Edge Cache & Acceleration

#### E. Security, Identity & Zero-Trust IAM (15 Primitives)
- **AWS (5)**:
  85. `aws_security_group` — Stateful Security Group Virtual Firewall
  86. `aws_iam_role` — IAM Role with Trust Policy & Least-Privilege Permissions
  87. `aws_kms_key` — Key Management Service (KMS) Hardware Security Module (HSM) Encryption Key
  88. `aws_wafv2_web_acl` — WAF v2 Web Access Control List (DDoS / SQLi / XSS Shield)
  89. `aws_secretsmanager_secret` — AWS Secrets Manager Automated Credential Rotation
- **Azure (5)**:
  90. `azurerm_network_security_group` — Azure Network Security Group (NSG) Stateful Firewall Rules
  91. `azurerm_role_definition` — Azure Role-Based Access Control (RBAC) & Managed Identity
  92. `azurerm_key_vault` — Azure Key Vault Cryptographic Secret & HSM Key Enclave
  93. `azurerm_web_application_firewall_policy` — Azure WAF Policy for Layer-7 Application Protection
  94. `azurerm_security_center_subscription_pricing` — Microsoft Defender for Cloud Continuous SecOps
- **GCP (5)**:
  95. `google_compute_firewall` — Google Cloud VPC Stateful Firewall Rules
  96. `google_service_account` — Google Cloud IAM Service Account & Workload Identity
  97. `google_kms_crypto_key` — Google Cloud KMS Symmetric/Asymmetric Key Ring
  98. `google_compute_security_policy` — Google Cloud Armor WAF & Layer-7 DDoS Mitigation Policy
  99. `google_secret_manager_secret` — Google Cloud Secret Manager Enterprise Secret Vault

#### F. AI/ML, GPU Acceleration & Big Data Analytics (9 Primitives)
- **AWS (3)**:
  100. `aws_sagemaker_endpoint` — Amazon SageMaker Real-Time Inference AI Endpoint
  101. `aws_sagemaker_notebook_instance` — Amazon SageMaker ML Development Workspace
  102. `aws_emr_cluster` — Amazon EMR Distributed Apache Spark / Hadoop Cluster
- **Azure (3)**:
  103. `azurerm_machine_learning_workspace` — Azure Machine Learning Enterprise AI Studio
  104. `azurerm_cognitive_account` — Azure OpenAI & Cognitive Services Enterprise Endpoint
  105. `azurerm_databricks_workspace` — Azure Databricks Managed Apache Spark Lakehouse
- **GCP (3)**:
  106. `google_vertex_ai_endpoint` — Google Vertex AI Foundation Model Serving Endpoint
  107. `google_notebooks_instance` — Google Cloud Vertex AI Managed JupyterLab Notebook
  108. `google_dataproc_cluster` — Google Cloud Dataproc Serverless Apache Spark / Presto Cluster

---

### 6.2 Multi-Cloud Terraform / OpenTofu Export Engine Architecture

#### A. Multi-Cloud Provider Blocks (`main.tf`)
The unified exporter must dynamically analyze the topology graph and inject provider blocks based on active node types:
```hcl
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

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region
  default_tags {
    tags = var.tags
  }
}

# Azure Provider Configuration
provider "azurerm" {
  features {}
  subscription_id = var.azure_subscription_id
}

# GCP Provider Configuration
provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
  zone    = var.gcp_zone
}
```

#### B. Parameterized Declarations (`variables.tf` & `terraform.tfvars.example`)
```hcl
variable "aws_region" {
  description = "Target AWS Region"
  type        = string
  default     = "us-east-1"
}

variable "azure_location" {
  description = "Target Azure Data Center Region"
  type        = string
  default     = "eastus"
}

variable "azure_subscription_id" {
  description = "Azure Active Subscription ID"
  type        = string
  default     = "00000000-0000-0000-0000-000000000000"
}

variable "gcp_project_id" {
  description = "Google Cloud Project ID"
  type        = string
  default     = "cloudswarm-production"
}

variable "gcp_region" {
  description = "Target Google Cloud Region"
  type        = string
  default     = "us-central1"
}

variable "gcp_zone" {
  description = "Target Google Cloud Availability Zone"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Deployment Stage (production, staging, development)"
  type        = string
  default     = "production"
}

variable "tags" {
  description = "Universal resource tags applied across all infrastructure resources"
  type        = map(string)
  default = {
    OrchestratedBy = "CloudSwarmStudio"
    ManagedBy      = "Terraform"
    SecurityTier   = "ZeroTrust"
  }
}
```

#### C. Comprehensive Outputs (`outputs.tf`)
The exporter dynamically generates line items for all provisioned endpoints:
- **AWS**: VPC IDs, EC2 public IPs, ALB DNS names, RDS endpoints, S3 bucket ARNs, EKS cluster endpoints.
- **Azure**: VNet IDs, VM public IP addresses, App Gateway public FQDNs, Cosmos DB endpoints, PostgreSQL connection strings, Key Vault URIs.
- **GCP**: VPC network self-links, GCE VM external NAT IPs, Cloud SQL connection names, GCS bucket URLs, GKE cluster endpoints.

#### D. Production Bundle Contents (8 Artifacts in Downloadable PKZIP):
1. `main.tf` — Complete multi-cloud infrastructure manifest.
2. `variables.tf` — Multi-cloud input variable definitions.
3. `outputs.tf` — Multi-cloud connection endpoints & resource identifiers.
4. `terraform.tfvars.example` — Ready-to-use sample configuration.
5. `Dockerfile` — Multi-stage hardened Node 20 / Nginx runtime.
6. `.dockerignore` — Optimized build ignore rules.
7. `audit_certificate.json` — Cryptographically signed (SHA-256) SecOps & FinOps audit summary.
8. `README.md` — Complete deployment guide covering `terraform init/plan/apply`, `az`, `gcloud`, `aws`, and `docker`.

---

### 6.3 Catalog Data Structure & Implementation Blueprint (`resourceCatalog.ts`)

```typescript
export interface ResourceCatalogItem {
  type: string;
  provider: 'aws' | 'azure' | 'google';
  category: 'Compute' | 'Storage' | 'Database' | 'Network' | 'Security' | 'AI/ML';
  name: string;
  description: string;
  iconName: string;
  defaultConfig: Record<string, unknown>;
  pricingModel: {
    baseMonthlyRate: number;
    unitLabel?: string;
  };
  validationRules?: Record<string, unknown>;
}

export const CLOUD_RESOURCE_CATALOG: ResourceCatalogItem[] = [
  // 108 Items registered here...
];
```

---

## 7. Next Steps for Implementation Team

1. **Phase 1 (Types & Catalog)**:
   - Create `src/core/catalog/resourceCatalog.ts` implementing all 108 primitives.
   - Update `src/types/topology.ts` to export `CloudResourceType = AWSResourceType | AzureResourceType | GCPResourceType`.
2. **Phase 2 (HCL Engine & Exporter)**:
   - Update `src/core/export/ProductionMaterializer.ts` to generate multi-cloud `main.tf`, `variables.tf`, `outputs.tf`, `README.md`.
   - Update `src/core/sync/HCLSyncEngine.ts` to support AST parsing and edge reconstruction for `azurerm_*` and `google_*`.
3. **Phase 3 (UI Upgrades)**:
   - Update `ResourcePalette.tsx` with provider tabs (`All`, `AWS`, `Azure`, `GCP`) and 6-category filters.
   - Update `NodeInspector.tsx` with dynamic property controls for Azure and GCP resources.
4. **Phase 4 (Testing & Verification)**:
   - Write comprehensive unit tests for catalog items, multi-cloud HCL generation, and bundle materialization.
   - Verify 100% test pass rate (`npm test`) and zero TypeScript errors (`npm run build`).

