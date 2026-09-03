/**
 * Multi-Cloud Topology Graph & Resource Primitive Types (AWS, Azure, GCP)
 */
import type { AgentId } from './swarm';

export type CloudProvider = 'aws' | 'azure' | 'google';

export type ResourceCategory =
  | 'Compute'
  | 'Storage'
  | 'Database'
  | 'Network'
  | 'Security'
  | 'AI/ML';

export type { CostCategory } from './audit';

// ==========================================
// 108 Cloud Primitive Type Unions
// ==========================================

// AWS Primitives (36 Total)
export type AWSComputeType =
  | 'aws_instance'
  | 'aws_instance_compute'
  | 'aws_instance_gpu'
  | 'aws_eks_cluster'
  | 'aws_ecs_cluster'
  | 'aws_lambda_function'
  | 'aws_apprunner_service'
  | 'aws_batch_compute_environment';

export type AWSStorageType =
  | 'aws_s3_bucket'
  | 'aws_ebs_volume'
  | 'aws_efs_file_system'
  | 'aws_glacier_vault'
  | 'aws_fsx_lustre_file_system'
  | 'aws_backup_vault';

export type AWSDatabaseType =
  | 'aws_db_instance'
  | 'aws_rds_cluster'
  | 'aws_dynamodb_table'
  | 'aws_elasticache_cluster'
  | 'aws_redshift_cluster'
  | 'aws_neptune_cluster'
  | 'aws_opensearch_domain';

export type AWSNetworkingType =
  | 'aws_vpc'
  | 'aws_subnet'
  | 'aws_lb'
  | 'aws_nat_gateway'
  | 'aws_internet_gateway'
  | 'aws_ec2_transit_gateway'
  | 'aws_cloudfront_distribution';

export type AWSSecurityType =
  | 'aws_security_group'
  | 'aws_iam_role'
  | 'aws_kms_key'
  | 'aws_wafv2_web_acl'
  | 'aws_secretsmanager_secret';

export type AWSAnalyticsType =
  | 'aws_sagemaker_endpoint'
  | 'aws_sagemaker_notebook_instance'
  | 'aws_emr_cluster';

export type AWSPrimitiveType =
  | AWSComputeType
  | AWSStorageType
  | AWSDatabaseType
  | AWSNetworkingType
  | AWSSecurityType
  | AWSAnalyticsType;

// Azure Primitives (36 Total)
export type AzureComputeType =
  | 'azurerm_linux_virtual_machine'
  | 'azurerm_windows_virtual_machine'
  | 'azurerm_virtual_machine_gpu'
  | 'azurerm_kubernetes_cluster'
  | 'azurerm_container_group'
  | 'azurerm_linux_function_app'
  | 'azurerm_app_service'
  | 'azurerm_spring_cloud_service';

export type AzureStorageType =
  | 'azurerm_storage_account'
  | 'azurerm_storage_container'
  | 'azurerm_managed_disk'
  | 'azurerm_storage_share'
  | 'azurerm_data_lake_storage_gen2'
  | 'azurerm_backup_vault';

export type AzureDatabaseType =
  | 'azurerm_mssql_database'
  | 'azurerm_postgresql_flexible_server'
  | 'azurerm_cosmosdb_account'
  | 'azurerm_redis_cache'
  | 'azurerm_synapse_workspace'
  | 'azurerm_kusto_cluster'
  | 'azurerm_mariadb_server';

export type AzureNetworkingType =
  | 'azurerm_virtual_network'
  | 'azurerm_subnet'
  | 'azurerm_lb'
  | 'azurerm_application_gateway'
  | 'azurerm_nat_gateway'
  | 'azurerm_virtual_wan'
  | 'azurerm_cdn_profile';

export type AzureSecurityType =
  | 'azurerm_network_security_group'
  | 'azurerm_role_definition'
  | 'azurerm_key_vault'
  | 'azurerm_web_application_firewall_policy'
  | 'azurerm_security_center_subscription_pricing';

export type AzureAnalyticsType =
  | 'azurerm_machine_learning_workspace'
  | 'azurerm_cognitive_account'
  | 'azurerm_databricks_workspace';

export type AzurePrimitiveType =
  | AzureComputeType
  | AzureStorageType
  | AzureDatabaseType
  | AzureNetworkingType
  | AzureSecurityType
  | AzureAnalyticsType;

// GCP Primitives (36 Total)
export type GCPComputeType =
  | 'google_compute_instance'
  | 'google_compute_instance_optimized'
  | 'google_compute_instance_gpu'
  | 'google_container_cluster'
  | 'google_cloud_run_service'
  | 'google_cloudfunctions_function'
  | 'google_app_engine_standard_app_version'
  | 'google_compute_instance_group_manager';

export type GCPStorageType =
  | 'google_storage_bucket'
  | 'google_compute_disk'
  | 'google_filestore_instance'
  | 'google_storage_bucket_archive'
  | 'google_compute_region_disk'
  | 'google_backup_dr_management_server';

export type GCPDatabaseType =
  | 'google_sql_database_instance'
  | 'google_spanner_instance'
  | 'google_firestore_database'
  | 'google_bigtable_instance'
  | 'google_redis_instance'
  | 'google_bigquery_dataset'
  | 'google_alloydb_cluster';

export type GCPNetworkingType =
  | 'google_compute_network'
  | 'google_compute_subnetwork'
  | 'google_compute_global_forwarding_rule'
  | 'google_compute_router_nat'
  | 'google_compute_vpn_gateway'
  | 'google_compute_network_peering'
  | 'google_compute_backend_service';

export type GCPSecurityType =
  | 'google_compute_firewall'
  | 'google_service_account'
  | 'google_kms_crypto_key'
  | 'google_compute_security_policy'
  | 'google_secret_manager_secret';

export type GCPAnalyticsType =
  | 'google_vertex_ai_endpoint'
  | 'google_notebooks_instance'
  | 'google_dataproc_cluster';

export type GCPPrimitiveType =
  | GCPComputeType
  | GCPStorageType
  | GCPDatabaseType
  | GCPNetworkingType
  | GCPSecurityType
  | GCPAnalyticsType;

// Unified Cloud Resource Type Union across AWS, Azure, and GCP (108 primitives)
export type CloudResourceType =
  | AWSPrimitiveType
  | AzurePrimitiveType
  | GCPPrimitiveType;

// Backwards compatibility aliases
export type AWSResourceType = CloudResourceType;
export type AzureResourceType = AzurePrimitiveType;
export type GCPResourceType = GCPPrimitiveType;

// Core AWS 10 Primitives (for legacy backwards compatibility)
export type AWSResourceTypeCore =
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

// ==========================================
// AWS Resource Configurations
// ==========================================

export interface VpcConfig {
  cidr_block: string;
  enable_dns_hostnames?: boolean;
  enable_dns_support?: boolean;
  instance_tenancy?: 'default' | 'dedicated';
  tags?: Record<string, string>;
}

export interface SubnetConfig {
  vpc_id: string;
  cidr_block: string;
  availability_zone: string;
  is_public: boolean;
  map_public_ip_on_launch?: boolean;
  tags?: Record<string, string>;
}

export interface EC2Config {
  instance_type: string;
  subnet_id?: string;
  ami?: string;
  root_volume_gb?: number;
  root_volume_type?: 'gp3' | 'gp2' | 'io2';
  iops?: number;
  http_tokens?: 'optional' | 'required';
  security_group_ids?: string[];
  iam_instance_profile?: string;
  tags?: Record<string, string>;
}

export interface ECSConfig {
  cluster_name: string;
  launch_type: 'FARGATE' | 'EC2';
  cpu?: number;
  memory_mb?: number;
  desired_count?: number;
  subnet_ids?: string[];
  container_image?: string;
  container_port?: number;
  tags?: Record<string, string>;
}

export interface EKSNodeGroup {
  name: string;
  instance_type: string;
  capacity_type?: 'ON_DEMAND' | 'SPOT';
  desired_size: number;
  min_size?: number;
  max_size?: number;
}

export interface EKSConfig {
  cluster_name: string;
  kubernetes_version?: string;
  subnet_ids: string[];
  node_groups?: EKSNodeGroup[];
  endpoint_private_access?: boolean;
  endpoint_public_access?: boolean;
  tags?: Record<string, string>;
}

export interface RDSConfig {
  engine: 'postgres' | 'mysql' | 'aurora-postgresql' | 'aurora-mysql' | 'mariadb';
  engine_version?: string;
  instance_class: string;
  allocated_storage_gb: number;
  storage_type?: 'gp3' | 'io2';
  multi_az?: boolean;
  storage_encrypted?: boolean;
  kms_key_id?: string;
  backup_retention_period?: number;
  publicly_accessible?: boolean;
  subnet_ids?: string[];
  tags?: Record<string, string>;
}

export interface S3EncryptionConfig {
  sse_algorithm: 'AES256' | 'aws:kms';
  kms_key_id?: string;
}

export interface S3BlockPublicAccessConfig {
  block_public_acls: boolean;
  block_public_policy: boolean;
  ignore_public_acls: boolean;
  restrict_public_buckets: boolean;
}

export interface S3Config {
  bucket_name: string;
  versioning_enabled?: boolean;
  encryption?: S3EncryptionConfig;
  block_public_access?: S3BlockPublicAccessConfig;
  enforce_ssl_tls_requests?: boolean;
  tags?: Record<string, string>;
}

export interface ALBListenerConfig {
  port: number;
  protocol: 'HTTP' | 'HTTPS';
  ssl_policy?: string;
  certificate_arn?: string;
}

export interface ALBConfig {
  name: string;
  internal?: boolean;
  load_balancer_type?: 'application' | 'network';
  subnet_ids: string[];
  security_group_ids?: string[];
  listeners?: ALBListenerConfig[];
  tags?: Record<string, string>;
}

export interface SecurityGroupRule {
  protocol: string;
  from_port: number;
  to_port: number;
  cidr_blocks?: string[];
  source_security_group_id?: string;
  description?: string;
}

export interface SecurityGroupConfig {
  name: string;
  description?: string;
  vpc_id: string;
  ingress_rules?: SecurityGroupRule[];
  egress_rules?: SecurityGroupRule[];
  tags?: Record<string, string>;
}

export interface IAMRoleConfig {
  role_name: string;
  trusted_service: string;
  managed_policy_arns?: string[];
  inline_policy?: {
    policy_name: string;
    policy_document: string;
  };
  tags?: Record<string, string>;
}

// ==========================================
// Azure Resource Configurations
// ==========================================

export interface AzureVNetConfig {
  address_space: string[];
  location: string;
  resource_group_name: string;
  dns_servers?: string[];
  tags?: Record<string, string>;
}

export interface AzureSubnetConfig {
  virtual_network_name: string;
  resource_group_name: string;
  address_prefixes: string[];
  service_endpoints?: string[];
  tags?: Record<string, string>;
}

export interface AzureVMConfig {
  vm_size: string;
  admin_username: string;
  location: string;
  resource_group_name: string;
  network_interface_ids?: string[];
  os_disk?: {
    caching?: string;
    storage_account_type?: string;
    disk_size_gb?: number;
  };
  tags?: Record<string, string>;
}

export interface AzureAKSConfig {
  cluster_name: string;
  dns_prefix: string;
  location: string;
  resource_group_name: string;
  kubernetes_version?: string;
  default_node_pool: {
    name: string;
    node_count: number;
    vm_size: string;
    enable_auto_scaling?: boolean;
    min_count?: number;
    max_count?: number;
  };
  identity?: {
    type: string;
  };
  tags?: Record<string, string>;
}

export interface AzureSqlConfig {
  server_name: string;
  database_name: string;
  location: string;
  resource_group_name: string;
  sku_name?: string;
  max_size_gb?: number;
  geo_redundant_backup?: boolean;
  tags?: Record<string, string>;
}

export interface AzureStorageAccountConfig {
  account_name: string;
  location: string;
  resource_group_name: string;
  account_tier: 'Standard' | 'Premium';
  account_replication_type: 'LRS' | 'GRS' | 'RAGRS' | 'ZRS';
  enable_https_traffic_only?: boolean;
  min_tls_version?: 'TLS1_2' | 'TLS1_3';
  tags?: Record<string, string>;
}

export interface AzureKeyVaultConfig {
  vault_name: string;
  location: string;
  resource_group_name: string;
  sku_name: 'standard' | 'premium';
  purge_protection_enabled?: boolean;
  soft_delete_retention_days?: number;
  tags?: Record<string, string>;
}

export interface AzureNSGConfig {
  name: string;
  location: string;
  resource_group_name: string;
  security_rules?: Array<{
    name: string;
    priority: number;
    direction: 'Inbound' | 'Outbound';
    access: 'Allow' | 'Deny';
    protocol: string;
    source_port_range: string;
    destination_port_range: string;
    source_address_prefix: string;
    destination_address_prefix: string;
  }>;
  tags?: Record<string, string>;
}

// ==========================================
// GCP Resource Configurations
// ==========================================

export interface GCPNetworkConfig {
  network_name: string;
  auto_create_subnetworks?: boolean;
  routing_mode?: 'REGIONAL' | 'GLOBAL';
  mtu?: number;
  project?: string;
}

export interface GCPSubnetConfig {
  subnetwork_name: string;
  network: string;
  ip_cidr_range: string;
  region: string;
  private_ip_google_access?: boolean;
  project?: string;
}

export interface GCPGCEConfig {
  instance_name: string;
  machine_type: string;
  zone: string;
  boot_disk?: {
    size_gb?: number;
    type?: 'pd-standard' | 'pd-balanced' | 'pd-ssd' | 'pd-extreme';
    image?: string;
  };
  network_interfaces?: Array<{
    network?: string;
    subnetwork?: string;
  }>;
  tags?: string[];
  project?: string;
}

export interface GCPGKEConfig {
  cluster_name: string;
  location: string;
  initial_node_count?: number;
  node_config?: {
    machine_type?: string;
    disk_size_gb?: number;
    disk_type?: string;
    preemptible?: boolean;
    spot?: boolean;
    oauth_scopes?: string[];
  };
  enable_autopilot?: boolean;
  project?: string;
}

export interface GCPCloudSqlConfig {
  instance_name: string;
  database_version: string;
  region: string;
  tier: string;
  disk_size?: number;
  disk_type?: 'PD_SSD' | 'PD_HDD';
  availability_type?: 'REGIONAL' | 'ZONAL';
  backup_configuration?: {
    enabled?: boolean;
    point_in_time_recovery_enabled?: boolean;
  };
  project?: string;
}

export interface GCPStorageBucketConfig {
  bucket_name: string;
  location: string;
  storage_class?: 'STANDARD' | 'NEARLINE' | 'COLDLINE' | 'ARCHIVE';
  uniform_bucket_level_access?: boolean;
  versioning?: {
    enabled: boolean;
  };
  project?: string;
}

export interface GCPFirewallConfig {
  firewall_name: string;
  network: string;
  direction?: 'INGRESS' | 'EGRESS';
  priority?: number;
  allows?: Array<{
    protocol: string;
    ports?: string[];
  }>;
  source_ranges?: string[];
  target_tags?: string[];
  project?: string;
}

// ==========================================
// Unified Resource Config Union
// ==========================================

export type ResourceConfig =
  | VpcConfig
  | SubnetConfig
  | EC2Config
  | ECSConfig
  | EKSConfig
  | RDSConfig
  | S3Config
  | ALBConfig
  | SecurityGroupConfig
  | IAMRoleConfig
  | AzureVNetConfig
  | AzureSubnetConfig
  | AzureVMConfig
  | AzureAKSConfig
  | AzureSqlConfig
  | AzureStorageAccountConfig
  | AzureKeyVaultConfig
  | AzureNSGConfig
  | GCPNetworkConfig
  | GCPSubnetConfig
  | GCPGCEConfig
  | GCPGKEConfig
  | GCPCloudSqlConfig
  | GCPStorageBucketConfig
  | GCPFirewallConfig
  | Record<string, unknown>;

// ==========================================
// Graph Node, Edge & Topology State
// ==========================================

export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeMetadata {
  createdBy: AgentId;
  createdAt: number;
  updatedAt: number;
  tags?: Record<string, string>;
  status?: 'healthy' | 'warning' | 'error' | 'syncing';
}

export interface CloudResourceNode {
  readonly id: string;
  readonly type: CloudResourceType;
  readonly name: string;
  position: NodePosition;
  width?: number;
  height?: number;
  parentId?: string;
  config: Record<string, unknown>;
  metadata: NodeMetadata;
  version: number;
}

export type TopologyEdgeRelation =
  | 'routes_to'
  | 'attached_to'
  | 'target_group_of'
  | 'assumes_role'
  | 'stores_in'
  | 'depends_on'
  | 'network_flow'
  | 'security_attachment'
  | 'iam_binding'
  | 'peering'
  | 'contains'
  | 'reads_from';

export interface TopologyEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly type: TopologyEdgeRelation | string;
  port?: number;
  protocol?: string;
  label?: string;
  version?: number;
}

export interface TopologyState {
  readonly nodes: Record<string, CloudResourceNode>;
  readonly edges: Record<string, TopologyEdge>;
  readonly version: number;
  readonly lastModifiedBy?: AgentId;
  readonly lastModifiedAt?: number;
}

export function createDefaultTopologyState(): TopologyState {
  return {
    nodes: {},
    edges: {},
    version: 0,
  };
}
