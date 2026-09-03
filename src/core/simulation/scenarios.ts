/**
 * Deterministic Swarm Simulation Scenarios
 *
 * Preset production scenarios demonstrating Alpha -> Beta -> Gamma multi-agent orchestration:
 * 1. E-Commerce High-Availability Fabric
 * 2. FinTech Zero-Trust Banking Core
 * 3. Cloud-Native Microservices Mesh
 */

import type { AgentId } from '../../types/swarm';
import type { RFC6902Patch } from '../../types/patch';
import type { CloudResourceNode, TopologyEdge } from '../../types/topology';

export interface SimStepDefinition {
  stepIndex: number;
  agentId: AgentId;
  role: string;
  action: string;
  toolName?: string;
  thought: string;
  patchSummary: string;
  patches: readonly RFC6902Patch[];
  costDeltaMonthlyUsd?: number;
  securityScoreDelta?: number;
  targetResourceId?: string;
  executionBadge?: string;
}

export interface SimulationScenario {
  id: string;
  name: string;
  category: 'ecommerce' | 'fintech' | 'microservices' | 'general';
  description: string;
  targetArchitecture: string;
  initialPrompt: string;
  steps: readonly SimStepDefinition[];
}

// ============================================================================
// Scenario 1: E-Commerce High-Availability Fabric
// ============================================================================

const ECOMMERCE_VPC: CloudResourceNode = {
  id: 'vpc_ecom',
  type: 'aws_vpc',
  name: 'E-Commerce Production VPC',
  position: { x: 740, y: 130 },
  config: {
    cidr_block: '10.0.0.0/16',
    enable_dns_hostnames: true,
    enable_dns_support: true,
    tags: { Environment: 'Production', Project: 'ECommerce-Store' },
  },
  metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
  version: 1,
};

const ECOMMERCE_SUBNET_PUB: CloudResourceNode = {
  id: 'sub_ecom_pub_1',
  type: 'aws_subnet',
  name: 'Public Subnet AZ-A',
  parentId: 'vpc_ecom',
  position: { x: 390, y: 265 },
  config: {
    vpc_id: 'vpc_ecom',
    cidr_block: '10.0.1.0/24',
    availability_zone: 'us-east-1a',
    is_public: true,
    map_public_ip_on_launch: true,
  },
  metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
  version: 1,
};

const ECOMMERCE_SUBNET_PRIV: CloudResourceNode = {
  id: 'sub_ecom_priv_1',
  type: 'aws_subnet',
  name: 'Private App Subnet AZ-A',
  parentId: 'vpc_ecom',
  position: { x: 740, y: 265 },
  config: {
    vpc_id: 'vpc_ecom',
    cidr_block: '10.0.10.0/24',
    availability_zone: 'us-east-1a',
    is_public: false,
    map_public_ip_on_launch: false,
  },
  metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
  version: 1,
};

const ECOMMERCE_ALB: CloudResourceNode = {
  id: 'alb_ecom_front',
  type: 'aws_lb',
  name: 'Public Ingress ALB',
  position: { x: 390, y: 130 },
  config: {
    name: 'alb-prod-ecommerce',
    internal: false,
    load_balancer_type: 'application',
    subnet_ids: ['sub_ecom_pub_1'],
    security_group_ids: ['sg_ecom_web'],
  },
  metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
  version: 1,
};

const ECOMMERCE_EC2: CloudResourceNode = {
  id: 'ec2_ecom_web',
  type: 'aws_instance',
  name: 'Web Storefront App Fleet',
  parentId: 'sub_ecom_priv_1',
  position: { x: 740, y: 400 },
  config: {
    instance_type: 'c6i.large',
    subnet_id: 'sub_ecom_priv_1',
    ami: 'ami-0c55b159cbfafe1f0',
    root_volume_gb: 50,
    root_volume_type: 'io2',
    iops: 3000,
    http_tokens: 'optional', // Initially unhardened IMDSv1
  },
  metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
  version: 1,
};

const ECOMMERCE_RDS: CloudResourceNode = {
  id: 'rds_ecom_db',
  type: 'aws_db_instance',
  name: 'Store Orders Postgres DB',
  parentId: 'sub_ecom_priv_1',
  position: { x: 1090, y: 265 },
  config: {
    engine: 'postgres',
    engine_version: '15.4',
    instance_class: 'db.r6g.xlarge',
    allocated_storage_gb: 200,
    storage_type: 'io2',
    multi_az: true,
    storage_encrypted: false, // Initially unhardened
    publicly_accessible: false,
    subnet_ids: ['sub_ecom_priv_1'],
  },
  metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
  version: 1,
};

const ECOMMERCE_S3: CloudResourceNode = {
  id: 's3_ecom_assets',
  type: 'aws_s3_bucket',
  name: 'Product Media & Images S3',
  position: { x: 1090, y: 400 },
  config: {
    bucket_name: 'ecommerce-catalog-assets-prod',
    versioning_enabled: false,
    block_public_access: {
      block_public_acls: false,
      block_public_policy: false,
      ignore_public_acls: false,
      restrict_public_buckets: false,
    },
  },
  metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
  version: 1,
};

const ECOMMERCE_SG: CloudResourceNode = {
  id: 'sg_ecom_web',
  type: 'aws_security_group',
  name: 'Web ALB Security Group',
  position: { x: 390, y: 400 },
  config: {
    name: 'sg-ecom-alb',
    description: 'Allow HTTPS Ingress and SSH from 0.0.0.0/0',
    vpc_id: 'vpc_ecom',
    ingress_rules: [
      { protocol: 'tcp', from_port: 443, to_port: 443, cidr_blocks: ['0.0.0.0/0'], description: 'HTTPS Public' },
      { protocol: 'tcp', from_port: 80, to_port: 80, cidr_blocks: ['0.0.0.0/0'], description: 'HTTP Public' },
      { protocol: 'tcp', from_port: 22, to_port: 22, cidr_blocks: ['0.0.0.0/0'], description: 'SSH Insecure Ingress' },
    ],
  },
  metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
  version: 1,
};

const ECOMMERCE_EDGE_VPC_PUB: TopologyEdge = {
  id: 'edge_vpc_sub_pub',
  source: 'vpc_ecom',
  target: 'sub_ecom_pub_1',
  type: 'contains',
  label: 'VPC SUBNET',
  version: 1,
};

const ECOMMERCE_EDGE_VPC_PRIV: TopologyEdge = {
  id: 'edge_vpc_sub_priv',
  source: 'vpc_ecom',
  target: 'sub_ecom_priv_1',
  type: 'contains',
  label: 'VPC SUBNET',
  version: 1,
};

const ECOMMERCE_EDGE_SUB_PUB_ALB: TopologyEdge = {
  id: 'edge_sub_pub_alb',
  source: 'sub_ecom_pub_1',
  target: 'alb_ecom_front',
  type: 'attached_to',
  label: 'INGRESS',
  version: 1,
};

const ECOMMERCE_EDGE_SG_ALB: TopologyEdge = {
  id: 'edge_sg_alb',
  source: 'sg_ecom_web',
  target: 'alb_ecom_front',
  type: 'protects',
  label: 'SECURITY',
  version: 1,
};

const ECOMMERCE_EDGE_ALB_EC2: TopologyEdge = {
  id: 'edge_alb_ec2',
  source: 'alb_ecom_front',
  target: 'ec2_ecom_web',
  type: 'routes_to',
  port: 8080,
  protocol: 'HTTP',
  version: 1,
};

const ECOMMERCE_EDGE_SUB_PRIV_EC2: TopologyEdge = {
  id: 'edge_sub_priv_ec2',
  source: 'sub_ecom_priv_1',
  target: 'ec2_ecom_web',
  type: 'contains',
  label: 'COMPUTE',
  version: 1,
};

const ECOMMERCE_EDGE_EC2_RDS: TopologyEdge = {
  id: 'edge_ec2_rds',
  source: 'ec2_ecom_web',
  target: 'rds_ecom_db',
  type: 'routes_to',
  port: 5432,
  protocol: 'PostgreSQL',
  version: 1,
};

const ECOMMERCE_EDGE_EC2_S3: TopologyEdge = {
  id: 'edge_ec2_s3',
  source: 'ec2_ecom_web',
  target: 's3_ecom_assets',
  type: 'stores_in',
  protocol: 'HTTPS:443',
  label: 'S3 MEDIA',
  version: 1,
};

export const ECOMMERCE_SCENARIO: SimulationScenario = {
  id: 'ecommerce_ha',
  name: 'E-Commerce High-Availability Fabric',
  category: 'ecommerce',
  description: 'Scalable 3-tier retail fabric with public ingress ALB, private EC2 compute, Multi-AZ RDS Postgres, and S3 media storage.',
  targetArchitecture: 'Multi-AZ AWS Architecture: VPC (10.0.0.0/16) -> ALB -> Autoscaling EC2 -> Multi-AZ RDS Postgres + S3 Storage',
  initialPrompt: 'Deploy a high-availability production infrastructure for our global e-commerce retail platform with strict zero-trust security and cost optimization.',
  steps: [
    // Alpha Steps: Topology Provisioning
    {
      stepIndex: 1,
      agentId: 'alpha',
      role: 'Topology & Network Architect',
      action: 'SPAWN_VPC_HA_NETWORK',
      toolName: 'create_vpc',
      thought: 'Provisioning multi-tier isolated VPC fabric with public and private subnets across availability zones.',
      patchSummary: 'Created aws_vpc (10.0.0.0/16) and dual availability zone subnets.',
      patches: [
        { op: 'add', path: '/nodes/vpc_ecom', value: ECOMMERCE_VPC },
        { op: 'add', path: '/nodes/sub_ecom_pub_1', value: ECOMMERCE_SUBNET_PUB },
        { op: 'add', path: '/nodes/sub_ecom_priv_1', value: ECOMMERCE_SUBNET_PRIV },
        { op: 'add', path: '/edges/edge_vpc_sub_pub', value: ECOMMERCE_EDGE_VPC_PUB },
        { op: 'add', path: '/edges/edge_vpc_sub_priv', value: ECOMMERCE_EDGE_VPC_PRIV },
      ],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: +10,
      targetResourceId: 'vpc_ecom',
      executionBadge: '0.24ms',
    },
    {
      stepIndex: 2,
      agentId: 'alpha',
      role: 'Topology & Network Architect',
      action: 'DEPLOY_COMPUTE_AND_DATA_LAYER',
      toolName: 'create_compute_cluster',
      thought: 'Placing Application Load Balancer in public subnet, EC2 fleet and RDS Postgres in private subnet with S3 storage.',
      patchSummary: 'Created ALB, EC2 web fleet, RDS Multi-AZ instance, S3 bucket, Security Group, and topology routes.',
      patches: [
        { op: 'add', path: '/nodes/sg_ecom_web', value: ECOMMERCE_SG },
        { op: 'add', path: '/nodes/alb_ecom_front', value: ECOMMERCE_ALB },
        { op: 'add', path: '/nodes/ec2_ecom_web', value: ECOMMERCE_EC2 },
        { op: 'add', path: '/nodes/rds_ecom_db', value: ECOMMERCE_RDS },
        { op: 'add', path: '/nodes/s3_ecom_assets', value: ECOMMERCE_S3 },
        { op: 'add', path: '/edges/edge_sub_pub_alb', value: ECOMMERCE_EDGE_SUB_PUB_ALB },
        { op: 'add', path: '/edges/edge_sg_alb', value: ECOMMERCE_EDGE_SG_ALB },
        { op: 'add', path: '/edges/edge_alb_ec2', value: ECOMMERCE_EDGE_ALB_EC2 },
        { op: 'add', path: '/edges/edge_sub_priv_ec2', value: ECOMMERCE_EDGE_SUB_PRIV_EC2 },
        { op: 'add', path: '/edges/edge_ec2_rds', value: ECOMMERCE_EDGE_EC2_RDS },
        { op: 'add', path: '/edges/edge_ec2_s3', value: ECOMMERCE_EDGE_EC2_S3 },
      ],
      costDeltaMonthlyUsd: +612.45,
      securityScoreDelta: -15, // Security issues detected (open SSH, IMDSv1, plain S3)
      targetResourceId: 'ec2_ecom_web',
      executionBadge: '0.48ms',
    },

    // Beta Steps: Zero-Trust SecOps Hardening
    {
      stepIndex: 3,
      agentId: 'beta',
      role: 'Zero-Trust SecOps Guardian',
      action: 'SCAN_OWASP_AND_CIS_BENCHMARKS',
      toolName: 'scan_topology_security',
      thought: 'Detected 4 critical vulnerabilities: SSH port 22 open to 0.0.0.0/0, unencrypted RDS storage, missing S3 public access block, and IMDSv1 enabled.',
      patchSummary: 'SecOps vulnerability scan flagged open ingress, plaintext storage, and legacy IMDS.',
      patches: [],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: 0,
      targetResourceId: 'sg_ecom_web',
      executionBadge: '0.19ms',
    },
    {
      stepIndex: 4,
      agentId: 'beta',
      role: 'Zero-Trust SecOps Guardian',
      action: 'AUTO_REMEDIATE_SECURITY_VULNERABILITIES',
      toolName: 'remediate_security_findings',
      thought: 'Eliminating SSH ingress 0.0.0.0/0, enforcing IMDSv2 (http_tokens=required), enabling S3 SSE-AES256 + Block Public Access, and enabling RDS storage encryption.',
      patchSummary: 'Hardened Security Group rules, upgraded IMDS to v2, enabled S3 Public Access Block & AES256 encryption, enabled RDS encryption.',
      patches: [
        {
          op: 'replace',
          path: '/nodes/sg_ecom_web/config/ingress_rules',
          value: [
            { protocol: 'tcp', from_port: 443, to_port: 443, cidr_blocks: ['0.0.0.0/0'], description: 'HTTPS Public' },
            { protocol: 'tcp', from_port: 80, to_port: 80, cidr_blocks: ['0.0.0.0/0'], description: 'HTTP Public' },
          ],
        },
        {
          op: 'replace',
          path: '/nodes/ec2_ecom_web/config/http_tokens',
          value: 'required',
        },
        {
          op: 'replace',
          path: '/nodes/s3_ecom_assets/config/block_public_access',
          value: {
            block_public_acls: true,
            block_public_policy: true,
            ignore_public_acls: true,
            restrict_public_buckets: true,
          },
        },
        {
          op: 'replace',
          path: '/nodes/s3_ecom_assets/config/encryption',
          value: { sse_algorithm: 'AES256' },
        },
        {
          op: 'replace',
          path: '/nodes/rds_ecom_db/config/storage_encrypted',
          value: true,
        },
      ],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: +45, // Score rises to 95/100
      targetResourceId: 'sg_ecom_web',
      executionBadge: '0.35ms',
    },

    // Gamma Steps: FinOps Cost Optimization
    {
      stepIndex: 5,
      agentId: 'gamma',
      role: 'FinOps Live Auditor',
      action: 'EVALUATE_FINOPS_RATE_CARDS',
      toolName: 'query_resource_pricing',
      thought: 'Analyzing AWS rate cards: EC2 c6i.large ($0.085/hr) can rightsize to Graviton3 c7g.large ($0.072/hr, 15% savings + 20% compute performance). RDS storage on io2 ($0.125/GB + $0.065/IOPS) can convert to gp3 ($0.08/GB with 3000 free baseline IOPS).',
      patchSummary: 'Calculated monthly spend breakdown and identified $184.20/mo in direct FinOps optimization savings.',
      patches: [],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: 0,
      targetResourceId: 'ec2_ecom_web',
      executionBadge: '0.22ms',
    },
    {
      stepIndex: 6,
      agentId: 'gamma',
      role: 'FinOps Live Auditor',
      action: 'APPLY_FINOPS_RIGHTSIZING_OPTIMIZATION',
      toolName: 'apply_cost_optimizations',
      thought: 'Applying Graviton3 migration for EC2 fleet and converting RDS & EC2 storage to gp3. Monthly cost reduced from $612.45 to $428.25.',
      patchSummary: 'Migrated EC2 to c7g.large (Graviton3), converted EBS to gp3, converted RDS storage to gp3.',
      patches: [
        {
          op: 'replace',
          path: '/nodes/ec2_ecom_web/config/instance_type',
          value: 'c7g.large',
        },
        {
          op: 'replace',
          path: '/nodes/ec2_ecom_web/config/root_volume_type',
          value: 'gp3',
        },
        {
          op: 'replace',
          path: '/nodes/rds_ecom_db/config/storage_type',
          value: 'gp3',
        },
      ],
      costDeltaMonthlyUsd: -184.20,
      securityScoreDelta: 0,
      targetResourceId: 'ec2_ecom_web',
      executionBadge: '0.31ms',
    },
  ],
};

// ============================================================================
// Scenario 2: FinTech Zero-Trust Banking Core
// ============================================================================

export const FINTECH_SCENARIO: SimulationScenario = {
  id: 'fintech_zerotrust',
  name: 'FinTech Zero-Trust Banking Core',
  category: 'fintech',
  description: 'Ultra-strict PCI-DSS Level 1 & SOC2 compliant banking infrastructure with dedicated KMS HSM, isolated private EKS cluster, and Aurora Serverless v2.',
  targetArchitecture: 'Zero-Trust PCI-DSS Architecture: Dual-VPC Isolated Enclave -> EKS Banking Core -> Aurora PostgreSQL -> Customer Managed KMS Key',
  initialPrompt: 'Architect an enterprise FinTech payment gateway core meeting PCI-DSS 4.0 requirements, zero 0.0.0.0/0 ingress, and automated cost optimization.',
  steps: [
    {
      stepIndex: 1,
      agentId: 'alpha',
      role: 'Topology & Network Architect',
      action: 'SPAWN_FINTECH_ISOLATED_ENCLAVE',
      toolName: 'create_vpc',
      thought: 'Creating dual-isolated banking VPC (10.100.0.0/16) with private-only subnets for EKS and Aurora database.',
      patchSummary: 'Spawned banking VPC with private EKS and Aurora database subnets.',
      patches: [
        {
          op: 'add',
          path: '/nodes/vpc_banking',
          value: {
            id: 'vpc_banking',
            type: 'aws_vpc',
            name: 'FinTech Banking Enclave VPC',
            position: { x: 740, y: 130 },
            config: { cidr_block: '10.100.0.0/16', enable_dns_hostnames: true, enable_dns_support: true },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/nodes/sub_bank_eks',
          value: {
            id: 'sub_bank_eks',
            type: 'aws_subnet',
            name: 'Private EKS Banking Subnet',
            parentId: 'vpc_banking',
            position: { x: 390, y: 265 },
            config: { vpc_id: 'vpc_banking', cidr_block: '10.100.1.0/24', availability_zone: 'us-east-1a', is_public: false },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/nodes/sub_bank_db',
          value: {
            id: 'sub_bank_db',
            type: 'aws_subnet',
            name: 'Private DB Subnet',
            parentId: 'vpc_banking',
            position: { x: 1090, y: 265 },
            config: { vpc_id: 'vpc_banking', cidr_block: '10.100.2.0/24', availability_zone: 'us-east-1b', is_public: false },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_fintech_vpc_sub_eks',
          value: {
            id: 'edge_fintech_vpc_sub_eks',
            source: 'vpc_banking',
            target: 'sub_bank_eks',
            type: 'contains',
            label: 'VPC SUBNET',
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_fintech_vpc_sub_db',
          value: {
            id: 'edge_fintech_vpc_sub_db',
            source: 'vpc_banking',
            target: 'sub_bank_db',
            type: 'contains',
            label: 'VPC SUBNET',
            version: 1,
          },
        },
      ],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: +15,
      targetResourceId: 'vpc_banking',
      executionBadge: '0.28ms',
    },
    {
      stepIndex: 2,
      agentId: 'alpha',
      role: 'Topology & Network Architect',
      action: 'DEPLOY_EKS_AND_AURORA_CORE',
      toolName: 'create_eks_cluster',
      thought: 'Provisioning EKS Banking Cluster, Multi-AZ Aurora Postgres DB, and IAM Role for service account binding.',
      patchSummary: 'Created EKS banking cluster, Aurora DB, and IAM Role.',
      patches: [
        {
          op: 'add',
          path: '/nodes/eks_banking_core',
          value: {
            id: 'eks_banking_core',
            type: 'aws_eks_cluster',
            name: 'Banking Core EKS Cluster',
            position: { x: 390, y: 400 },
            config: {
              cluster_name: 'eks-banking-prod',
              kubernetes_version: '1.29',
              subnet_ids: ['sub_bank_eks'],
              endpoint_private_access: true,
              endpoint_public_access: true, // Needs hardening
            },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/nodes/db_aurora_ledger',
          value: {
            id: 'db_aurora_ledger',
            type: 'aws_db_instance',
            name: 'Immutable Financial Ledger Aurora DB',
            position: { x: 1090, y: 400 },
            config: {
              engine: 'aurora-postgresql',
              instance_class: 'db.r6g.2xlarge',
              allocated_storage_gb: 500,
              multi_az: true,
              storage_encrypted: true,
              kms_key_id: 'alias/aws/rds', // Default key, needs customer managed KMS
            },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/nodes/iam_banking_app',
          value: {
            id: 'iam_banking_app',
            type: 'aws_iam_role',
            name: 'Banking App Pod IAM Role',
            position: { x: 740, y: 400 },
            config: {
              role_name: 'banking-app-service-role',
              trusted_service: 'eks',
              managed_policy_arns: ['arn:aws:iam::aws:policy/AdministratorAccess'], // Wildcard policy needs elimination
            },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_fintech_sub_eks',
          value: {
            id: 'edge_fintech_sub_eks',
            source: 'sub_bank_eks',
            target: 'eks_banking_core',
            type: 'contains',
            label: 'HOSTS',
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_fintech_sub_db',
          value: {
            id: 'edge_fintech_sub_db',
            source: 'sub_bank_db',
            target: 'db_aurora_ledger',
            type: 'contains',
            label: 'HOSTS',
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_fintech_eks_db',
          value: {
            id: 'edge_fintech_eks_db',
            source: 'eks_banking_core',
            target: 'db_aurora_ledger',
            type: 'routes_to',
            port: 5432,
            protocol: 'PostgreSQL',
            label: 'SQL LEDGER',
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_fintech_iam_eks',
          value: {
            id: 'edge_fintech_iam_eks',
            source: 'iam_banking_app',
            target: 'eks_banking_core',
            type: 'protects',
            label: 'IRSA ROLE',
            version: 1,
          },
        },
      ],
      costDeltaMonthlyUsd: +890.00,
      securityScoreDelta: -25,
      targetResourceId: 'eks_banking_core',
      executionBadge: '0.44ms',
    },
    {
      stepIndex: 3,
      agentId: 'beta',
      role: 'Zero-Trust SecOps Guardian',
      action: 'ENFORCE_PCI_DSS_ZERO_TRUST',
      toolName: 'enforce_least_privilege',
      thought: 'Eliminating AdministratorAccess wildcard on IAM Role. Restricting EKS cluster endpoint to private VPC access only. Setting KMS key rotation.',
      patchSummary: 'Enforced least-privilege IAM policy without wildcards, disabled EKS public endpoint.',
      patches: [
        {
          op: 'replace',
          path: '/nodes/iam_banking_app/config/managed_policy_arns',
          value: ['arn:aws:iam::aws:policy/AmazonAuroraReadOnlyAccess'],
        },
        {
          op: 'replace',
          path: '/nodes/eks_banking_core/config/endpoint_public_access',
          value: false,
        },
      ],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: +55, // Reaches 98/100
      targetResourceId: 'iam_banking_app',
      executionBadge: '0.32ms',
    },
    {
      stepIndex: 4,
      agentId: 'gamma',
      role: 'FinOps Live Auditor',
      action: 'OPTIMIZE_AURORA_SERVERLESS_SCALING',
      toolName: 'optimize_database_tier',
      thought: 'Converting fixed db.r6g.2xlarge ($1.04/hr) to Aurora Serverless v2 with auto-scaling ACUs (0.5 to 16 ACUs). Estimated monthly savings: $320.00/mo.',
      patchSummary: 'Converted Aurora instance class to Serverless v2 dynamic scaling.',
      patches: [
        {
          op: 'replace',
          path: '/nodes/db_aurora_ledger/config/instance_class',
          value: 'db.serverless',
        },
      ],
      costDeltaMonthlyUsd: -320.00,
      securityScoreDelta: 0,
      targetResourceId: 'db_aurora_ledger',
      executionBadge: '0.26ms',
    },
  ],
};

// ============================================================================
// Scenario 3: Cloud-Native Microservices Mesh
// ============================================================================

export const MICROSERVICES_SCENARIO: SimulationScenario = {
  id: 'microservices_mesh',
  name: 'Cloud-Native Microservices Mesh',
  category: 'microservices',
  description: 'Event-driven containerized microservices fabric using AWS ECS Fargate, S3 static assets, and Application Load Balancer.',
  targetArchitecture: 'Microservices Mesh: VPC -> ALB -> ECS Fargate Services -> S3 Static Bucket',
  initialPrompt: 'Deploy a resilient microservices mesh with ECS Fargate, auto-healing containers, and minimal idle cloud spend.',
  steps: [
    {
      stepIndex: 1,
      agentId: 'alpha',
      role: 'Topology & Network Architect',
      action: 'SPAWN_MICROSERVICES_FABRIC',
      toolName: 'create_ecs_cluster',
      thought: 'Deploying ECS Fargate cluster with VPC, ALB, and container task definitions.',
      patchSummary: 'Created VPC, ALB, ECS Cluster, and S3 assets bucket.',
      patches: [
        {
          op: 'add',
          path: '/nodes/vpc_mesh',
          value: {
            id: 'vpc_mesh',
            type: 'aws_vpc',
            name: 'Microservices Mesh VPC',
            position: { x: 390, y: 130 },
            config: { cidr_block: '172.20.0.0/16' },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/nodes/alb_mesh_ingress',
          value: {
            id: 'alb_mesh_ingress',
            type: 'aws_alb',
            name: 'Public Ingress ALB',
            parentId: 'vpc_mesh',
            position: { x: 390, y: 265 },
            config: { name: 'alb-microservices-ingress', internet_facing: true },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/nodes/ecs_mesh_cluster',
          value: {
            id: 'ecs_mesh_cluster',
            type: 'aws_ecs_cluster',
            name: 'Production ECS Fargate Mesh',
            position: { x: 740, y: 265 },
            config: { cluster_name: 'ecs-prod-mesh', launch_type: 'FARGATE', cpu: 1024, memory_mb: 2048, desired_count: 4 },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/nodes/s3_mesh_assets',
          value: {
            id: 's3_mesh_assets',
            type: 'aws_s3_bucket',
            name: 'Static Microservice Assets S3',
            position: { x: 1090, y: 265 },
            config: { bucket_prefix: 'mesh-static-assets', versioning: true },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_micro_vpc_ecs',
          value: {
            id: 'edge_micro_vpc_ecs',
            source: 'vpc_mesh',
            target: 'ecs_mesh_cluster',
            type: 'contains',
            label: 'VPC CLUSTER',
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_micro_alb_ecs',
          value: {
            id: 'edge_micro_alb_ecs',
            source: 'alb_mesh_ingress',
            target: 'ecs_mesh_cluster',
            type: 'routes_to',
            label: 'HTTP:8080',
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_micro_ecs_s3',
          value: {
            id: 'edge_micro_ecs_s3',
            source: 'ecs_mesh_cluster',
            target: 's3_mesh_assets',
            type: 'stores_in',
            label: 'ASSET STORE',
            version: 1,
          },
        },
      ],
      costDeltaMonthlyUsd: +180.00,
      securityScoreDelta: +10,
      targetResourceId: 'ecs_mesh_cluster',
      executionBadge: '0.21ms',
    },
    {
      stepIndex: 2,
      agentId: 'beta',
      role: 'Zero-Trust SecOps Guardian',
      action: 'HARDEN_CONTAINER_RUNTIME',
      toolName: 'harden_ecs_security',
      thought: 'Enforcing read-only root filesystems and non-root UID 10001 container runtimes.',
      patchSummary: 'Hardened container execution permissions.',
      patches: [],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: +30,
      targetResourceId: 'ecs_mesh_cluster',
      executionBadge: '0.17ms',
    },
    {
      stepIndex: 3,
      agentId: 'gamma',
      role: 'FinOps Live Auditor',
      action: 'APPLY_FARGATE_SPOT_OPTIMIZATION',
      toolName: 'optimize_fargate_pricing',
      thought: 'Allocating 70% of non-critical microservice tasks to Fargate Spot for 70% per-task compute savings.',
      patchSummary: 'Applied Fargate Spot capacity provider weighting.',
      patches: [],
      costDeltaMonthlyUsd: -65.00,
      securityScoreDelta: 0,
      targetResourceId: 'ecs_mesh_cluster',
      executionBadge: '0.23ms',
    },
  ],
};

// ============================================================================
// Scenario 4: Global Tier-1 Multi-Region Sovereign Banking Core (Ultra-Complex)
// ============================================================================

export const GLOBAL_BANKING_SCENARIO: SimulationScenario = {
  id: 'global_banking_core',
  name: 'Global Multi-Region Sovereign Banking Core (24-Step Enterprise Setup)',
  category: 'fintech',
  description:
    'Ultra-complex 24-stage financial architecture: Multi-Region VPC Peering, EKS Graviton Cluster, Multi-AZ Aurora Postgres, KMS HSM Encryption, Zero-Trust SecOps hardening, and FinOps pricing.',
  targetArchitecture: 'Global Tier-1 Multi-Region Sovereign Banking Fabric',
  initialPrompt:
    'Design and deploy a fault-tolerant, multi-region sovereign banking mesh with EKS, Aurora Global DB, ElastiCache Redis, KMS encryption, and Zero-Trust CIS hardening.',
  steps: [
    {
      stepIndex: 1,
      agentId: 'alpha',
      role: 'Cloud Infrastructure Architect',
      action: 'SPAWN_PRIMARY_REGION_VPC',
      toolName: 'create_resource_node',
      thought: 'Atlas: Synthesizing Primary Production VPC in us-east-1 (10.100.0.0/16)...',
      patchSummary: 'Created Primary us-east-1 Banking VPC',
      patches: [
        {
          op: 'add',
          path: '/nodes/vpc_primary_bank',
          value: {
            id: 'vpc_primary_bank',
            type: 'aws_vpc',
            name: 'Primary Banking VPC (us-east-1)',
            position: { x: 390, y: 130 },
            config: { cidr_block: '10.100.0.0/16', enable_dns_hostnames: true, enable_dns_support: true },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
      ],
      costDeltaMonthlyUsd: +0.00,
      securityScoreDelta: +5,
      targetResourceId: 'vpc_primary_bank',
      executionBadge: '1.2ms',
    },
    {
      stepIndex: 2,
      agentId: 'alpha',
      role: 'Cloud Infrastructure Architect',
      action: 'ALLOCATE_PUBLIC_INGRESS_SUBNET',
      toolName: 'create_resource_node',
      thought: 'Atlas: Allocating Public Ingress Subnet Tier in us-east-1a (10.100.1.0/24)...',
      patchSummary: 'Created Public Ingress Subnet AZ-A',
      patches: [
        {
          op: 'add',
          path: '/nodes/sub_bank_pub_1',
          value: {
            id: 'sub_bank_pub_1',
            type: 'aws_subnet',
            name: 'Public Ingress Subnet 1A',
            parentId: 'vpc_primary_bank',
            position: { x: 390, y: 265 },
            config: { cidr_block: '10.100.1.0/24', is_public: true, availability_zone: 'us-east-1a' },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_bank_vpc_pub',
          value: {
            id: 'edge_bank_vpc_pub',
            source: 'vpc_primary_bank',
            target: 'sub_bank_pub_1',
            type: 'contains',
            label: 'VPC SUBNET',
            version: 1,
          },
        },
      ],
      costDeltaMonthlyUsd: +0.00,
      securityScoreDelta: +5,
      targetResourceId: 'sub_bank_pub_1',
      executionBadge: '0.8ms',
    },
    {
      stepIndex: 3,
      agentId: 'alpha',
      role: 'Cloud Infrastructure Architect',
      action: 'ALLOCATE_PRIVATE_CORE_SUBNET',
      toolName: 'create_resource_node',
      thought: 'Atlas: Allocating Isolated Core Banking Application Subnet in us-east-1b (10.100.10.0/24)...',
      patchSummary: 'Created Private Core Subnet AZ-B',
      patches: [
        {
          op: 'add',
          path: '/nodes/sub_bank_priv_1',
          value: {
            id: 'sub_bank_priv_1',
            type: 'aws_subnet',
            name: 'Private Core Banking Subnet 1B',
            parentId: 'vpc_primary_bank',
            position: { x: 740, y: 265 },
            config: { cidr_block: '10.100.10.0/24', is_public: false, availability_zone: 'us-east-1b' },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_bank_vpc_priv',
          value: {
            id: 'edge_bank_vpc_priv',
            source: 'vpc_primary_bank',
            target: 'sub_bank_priv_1',
            type: 'contains',
            label: 'VPC SUBNET',
            version: 1,
          },
        },
      ],
      costDeltaMonthlyUsd: +0.00,
      securityScoreDelta: +10,
      targetResourceId: 'sub_bank_priv_1',
      executionBadge: '0.9ms',
    },
    {
      stepIndex: 4,
      agentId: 'alpha',
      role: 'Cloud Infrastructure Architect',
      action: 'SPAWN_DR_REGION_VPC',
      toolName: 'create_resource_node',
      thought: 'Atlas: Provisioning Disaster Recovery Secondary VPC in eu-central-1 (10.200.0.0/16)...',
      patchSummary: 'Created DR Secondary VPC (eu-central-1)',
      patches: [
        {
          op: 'add',
          path: '/nodes/vpc_dr_bank',
          value: {
            id: 'vpc_dr_bank',
            type: 'aws_vpc',
            name: 'Disaster Recovery VPC (eu-central-1)',
            position: { x: 1090, y: 130 },
            config: { cidr_block: '10.200.0.0/16', enable_dns_hostnames: true },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_bank_vpc_peering',
          value: {
            id: 'edge_bank_vpc_peering',
            source: 'vpc_primary_bank',
            target: 'vpc_dr_bank',
            type: 'peered_with',
            label: 'REGION PEERING',
            version: 1,
          },
        },
      ],
      costDeltaMonthlyUsd: +0.00,
      securityScoreDelta: +10,
      targetResourceId: 'vpc_dr_bank',
      executionBadge: '1.4ms',
    },
    {
      stepIndex: 5,
      agentId: 'alpha',
      role: 'Cloud Infrastructure Architect',
      action: 'DEPLOY_INGRESS_APPLICATION_LOAD_BALANCER',
      toolName: 'create_resource_node',
      thought: 'Atlas: Deploying redundant Application Load Balancer with SSL offloading...',
      patchSummary: 'Deployed Core Ingress ALB',
      patches: [
        {
          op: 'add',
          path: '/nodes/alb_bank_ingress',
          value: {
            id: 'alb_bank_ingress',
            type: 'aws_lb',
            name: 'Sovereign Banking Ingress ALB',
            position: { x: 390, y: 400 },
            config: { load_balancer_type: 'application', internal: false, enable_deletion_protection: true },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_bank_sub_alb',
          value: {
            id: 'edge_bank_sub_alb',
            source: 'sub_bank_pub_1',
            target: 'alb_bank_ingress',
            type: 'attached_to',
            label: 'INGRESS',
            version: 1,
          },
        },
      ],
      costDeltaMonthlyUsd: +22.50,
      securityScoreDelta: +5,
      targetResourceId: 'alb_bank_ingress',
      executionBadge: '1.1ms',
    },
    {
      stepIndex: 6,
      agentId: 'alpha',
      role: 'Cloud Infrastructure Architect',
      action: 'PROVISION_EKS_KUBERNETES_CLUSTER',
      toolName: 'create_resource_node',
      thought: 'Atlas: Synthesizing Production EKS Kubernetes Control Plane with envelope encryption...',
      patchSummary: 'Provisioned EKS Banking Cluster',
      patches: [
        {
          op: 'add',
          path: '/nodes/eks_bank_core',
          value: {
            id: 'eks_bank_core',
            type: 'aws_eks_cluster',
            name: 'EKS Core Banking Mesh',
            position: { x: 740, y: 400 },
            config: { cluster_name: 'eks-bank-prod', version: '1.30', endpoint_private_access: true },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_bank_alb_eks',
          value: {
            id: 'edge_bank_alb_eks',
            source: 'alb_bank_ingress',
            target: 'eks_bank_core',
            type: 'routes_to',
            port: 443,
            protocol: 'HTTPS',
            label: 'PORT:443',
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_bank_sub_eks',
          value: {
            id: 'edge_bank_sub_eks',
            source: 'sub_bank_priv_1',
            target: 'eks_bank_core',
            type: 'contains',
            label: 'K8S WORKERS',
            version: 1,
          },
        },
      ],
      costDeltaMonthlyUsd: +73.00,
      securityScoreDelta: +10,
      targetResourceId: 'eks_bank_core',
      executionBadge: '1.8ms',
    },
    {
      stepIndex: 7,
      agentId: 'alpha',
      role: 'Cloud Infrastructure Architect',
      action: 'PROVISION_AURORA_POSTGRES_CLUSTER',
      toolName: 'create_resource_node',
      thought: 'Atlas: Provisioning Multi-AZ Aurora PostgreSQL Global Database with read replicas...',
      patchSummary: 'Provisioned Aurora PostgreSQL Global DB',
      patches: [
        {
          op: 'add',
          path: '/nodes/db_aurora_bank',
          value: {
            id: 'db_aurora_bank',
            type: 'aws_db_instance',
            name: 'Aurora Postgres Financial Ledger',
            position: { x: 1090, y: 265 },
            config: { engine: 'aurora-postgresql', instance_class: 'db.r6g.xlarge', multi_az: true, storage_encrypted: false },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_bank_eks_db',
          value: {
            id: 'edge_bank_eks_db',
            source: 'eks_bank_core',
            target: 'db_aurora_bank',
            type: 'routes_to',
            port: 5432,
            protocol: 'PostgreSQL',
            label: 'SQL:5432',
            version: 1,
          },
        },
      ],
      costDeltaMonthlyUsd: +180.00,
      securityScoreDelta: -10, // unencrypted initially to trigger SecOps remediation
      targetResourceId: 'db_aurora_bank',
      executionBadge: '2.1ms',
    },
    {
      stepIndex: 8,
      agentId: 'alpha',
      role: 'Cloud Infrastructure Architect',
      action: 'PROVISION_S3_FINANCIAL_VAULT',
      toolName: 'create_resource_node',
      thought: 'Atlas: Provisioning Immutable S3 Financial Transaction Lake & Audit Vault...',
      patchSummary: 'Provisioned S3 Audit Vault Lake',
      patches: [
        {
          op: 'add',
          path: '/nodes/s3_bank_vault',
          value: {
            id: 's3_bank_vault',
            type: 'aws_s3_bucket',
            name: 'Financial Ledger Audit Lake',
            position: { x: 1090, y: 400 },
            config: { bucket_name: 'corp-bank-audit-vault-prod', versioning: { status: 'Enabled' } },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        {
          op: 'add',
          path: '/edges/edge_bank_eks_s3',
          value: {
            id: 'edge_bank_eks_s3',
            source: 'eks_bank_core',
            target: 's3_bank_vault',
            type: 'stores_in',
            protocol: 'HTTPS:443',
            label: 'AUDIT VAULT',
            version: 1,
          },
        },
      ],
      costDeltaMonthlyUsd: +15.00,
      securityScoreDelta: -5,
      targetResourceId: 's3_bank_vault',
      executionBadge: '1.0ms',
    },
    {
      stepIndex: 9,
      agentId: 'beta',
      role: 'Zero-Trust SecOps Guardian',
      action: 'INSPECT_AND_LOCK_AURORA_DB',
      toolName: 'acquire_entity_lock',
      thought: 'Breach: Detected unencrypted Aurora storage! Acquiring entity lock on database node...',
      patchSummary: 'Acquired exclusive SecOps lock on Aurora DB',
      patches: [],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: 0,
      targetResourceId: 'db_aurora_bank',
      executionBadge: '0.12ms',
    },
    {
      stepIndex: 10,
      agentId: 'beta',
      role: 'Zero-Trust SecOps Guardian',
      action: 'ENFORCE_AURORA_STORAGE_ENCRYPTION',
      toolName: 'apply_security_hardening',
      thought: 'Breach: Enforcing AES-256 KMS customer-managed key encryption and SSL/TLS 1.3 requirement.',
      patchSummary: 'Hardened Aurora DB: Encrypted & Private',
      patches: [
        {
          op: 'replace',
          path: '/nodes/db_aurora_bank/config/storage_encrypted',
          value: true,
        },
        {
          op: 'replace',
          path: '/nodes/db_aurora_bank/config/publicly_accessible',
          value: false,
        },
      ],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: +25,
      targetResourceId: 'db_aurora_bank',
      executionBadge: '0.35ms',
    },
    {
      stepIndex: 11,
      agentId: 'beta',
      role: 'Zero-Trust SecOps Guardian',
      action: 'INSPECT_AND_LOCK_S3_VAULT',
      toolName: 'acquire_entity_lock',
      thought: 'Breach: Inspecting S3 Vault permissions. Acquiring entity lock on s3_bank_vault...',
      patchSummary: 'Acquired exclusive SecOps lock on S3 Vault',
      patches: [],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: 0,
      targetResourceId: 's3_bank_vault',
      executionBadge: '0.14ms',
    },
    {
      stepIndex: 12,
      agentId: 'beta',
      role: 'Zero-Trust SecOps Guardian',
      action: 'ENFORCE_S3_BLOCK_PUBLIC_ACCESS',
      toolName: 'apply_security_hardening',
      thought: 'Breach: Enforcing S3 Block Public Access (all 4 flags) and SSE-KMS bucket keys.',
      patchSummary: 'Enforced Zero-Trust S3 Public Block & KMS',
      patches: [
        {
          op: 'replace',
          path: '/nodes/s3_bank_vault/config/block_public_access',
          value: {
            block_public_acls: true,
            block_public_policy: true,
            ignore_public_acls: true,
            restrict_public_buckets: true,
          },
        },
      ],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: +20,
      targetResourceId: 's3_bank_vault',
      executionBadge: '0.28ms',
    },
    {
      stepIndex: 13,
      agentId: 'beta',
      role: 'Zero-Trust SecOps Guardian',
      action: 'HARDEN_EKS_METADATA_SERVICE_V2',
      toolName: 'harden_eks_security',
      thought: 'Breach: Enforcing IMDSv2 (http_tokens=required) and private Kubernetes API server endpoint.',
      patchSummary: 'Hardened EKS Node Groups with IMDSv2',
      patches: [
        {
          op: 'replace',
          path: '/nodes/eks_bank_core/config/endpoint_private_access',
          value: true,
        },
      ],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: +20,
      targetResourceId: 'eks_bank_core',
      executionBadge: '0.31ms',
    },
    {
      stepIndex: 14,
      agentId: 'beta',
      role: 'Zero-Trust SecOps Guardian',
      action: 'ATTACH_WAF_BOT_CONTROL_TO_ALB',
      toolName: 'attach_security_waf',
      thought: 'Breach: Attaching AWS WAF Rate-Limiting rules and Bot Control ACL to public ALB.',
      patchSummary: 'Attached AWS WAF Bot Control to Ingress ALB',
      patches: [
        {
          op: 'replace',
          path: '/nodes/alb_bank_ingress/config/waf_fail_open',
          value: false,
        },
      ],
      costDeltaMonthlyUsd: +5.00,
      securityScoreDelta: +15,
      targetResourceId: 'alb_bank_ingress',
      executionBadge: '0.42ms',
    },
    {
      stepIndex: 15,
      agentId: 'beta',
      role: 'Zero-Trust SecOps Guardian',
      action: 'VERIFY_CIS_AWS_BENCHMARKS',
      toolName: 'audit_iam_zero_trust',
      thought: 'Breach: Running full CIS AWS Benchmark scan. All 14 security controls verified: 100/100 (A+).',
      patchSummary: 'CIS AWS Benchmark Score: 100/100 (A+)',
      patches: [],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: +10,
      targetResourceId: 'vpc_primary_bank',
      executionBadge: '0.55ms',
    },
    {
      stepIndex: 16,
      agentId: 'delta',
      role: 'FinOps Live Auditor',
      action: 'INSPECT_AND_LOCK_EKS_COMPUTE',
      toolName: 'acquire_entity_lock',
      thought: 'Cost: Auditing EKS Kubernetes compute spend. Acquiring lock on eks_bank_core...',
      patchSummary: 'Acquired FinOps lock on EKS Compute',
      patches: [],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: 0,
      targetResourceId: 'eks_bank_core',
      executionBadge: '0.15ms',
    },
    {
      stepIndex: 17,
      agentId: 'delta',
      role: 'FinOps Live Auditor',
      action: 'CONVERT_EKS_TO_GRAVITON3',
      toolName: 'optimize_compute_pricing',
      thought: 'Cost: Converting node groups to AWS Graviton3 (c7g.2xlarge ARM64). Saving 40% compute cost.',
      patchSummary: 'Converted EKS Compute to AWS Graviton3 (ARM64)',
      patches: [
        {
          op: 'replace',
          path: '/nodes/eks_bank_core/config/instance_type',
          value: 'c7g.2xlarge',
        },
      ],
      costDeltaMonthlyUsd: -38.00,
      securityScoreDelta: 0,
      targetResourceId: 'eks_bank_core',
      executionBadge: '0.40ms',
    },
    {
      stepIndex: 18,
      agentId: 'delta',
      role: 'FinOps Live Auditor',
      action: 'INSPECT_AND_LOCK_AURORA_DB',
      toolName: 'acquire_entity_lock',
      thought: 'Cost: Auditing Aurora DB rate cards. Acquiring lock on db_aurora_bank...',
      patchSummary: 'Acquired FinOps lock on Aurora DB',
      patches: [],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: 0,
      targetResourceId: 'db_aurora_bank',
      executionBadge: '0.12ms',
    },
    {
      stepIndex: 19,
      agentId: 'delta',
      role: 'FinOps Live Auditor',
      action: 'OPTIMIZE_AURORA_SERVERLESS_V2',
      toolName: 'optimize_cost_allocation',
      thought: 'Cost: Enabling Aurora Serverless v2 dynamic scaling (0.5 to 8 ACUs) for off-peak auto-pausing.',
      patchSummary: 'Applied Aurora Serverless v2 Elastic Scaling',
      patches: [
        {
          op: 'replace',
          path: '/nodes/db_aurora_bank/config/instance_class',
          value: 'db.serverless',
        },
      ],
      costDeltaMonthlyUsd: -55.00,
      securityScoreDelta: 0,
      targetResourceId: 'db_aurora_bank',
      executionBadge: '0.48ms',
    },
    {
      stepIndex: 20,
      agentId: 'delta',
      role: 'FinOps Live Auditor',
      action: 'ENABLE_S3_GLACIER_LIFECYCLE',
      toolName: 'optimize_storage_tier',
      thought: 'Cost: Applying 30-day lifecycle rule transitioning cold transaction logs to S3 Glacier Deep Archive.',
      patchSummary: 'Configured S3 Glacier Deep Archive Tiering',
      patches: [],
      costDeltaMonthlyUsd: -8.00,
      securityScoreDelta: 0,
      targetResourceId: 's3_bank_vault',
      executionBadge: '0.22ms',
    },
    {
      stepIndex: 21,
      agentId: 'delta',
      role: 'FinOps Live Auditor',
      action: 'EVALUATE_3YEAR_SAVINGS_PLANS',
      toolName: 'calculate_topology_cost',
      thought: 'Cost: Querying 3-year Compute Savings Plan rate cards. Net monthly spend reduced to $189.50/mo.',
      patchSummary: 'Calculated 3-Year Savings Plan Run-Rate',
      patches: [],
      costDeltaMonthlyUsd: -32.00,
      securityScoreDelta: 0,
      targetResourceId: 'vpc_primary_bank',
      executionBadge: '0.36ms',
    },
    {
      stepIndex: 22,
      agentId: 'alpha',
      role: 'Cloud Infrastructure Architect',
      action: 'SYNTHESIZE_TERRAFORM_HCL2',
      toolName: 'sync_hcl_code',
      thought: 'Atlas: Synthesizing complete production Terraform HCL2 manifest across all 8 primitives...',
      patchSummary: 'Synthesized 100% Valid Terraform HCL2 Code',
      patches: [],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: 0,
      targetResourceId: 'vpc_primary_bank',
      executionBadge: '1.5ms',
    },
    {
      stepIndex: 23,
      agentId: 'alpha',
      role: 'Cloud Infrastructure Architect',
      action: 'COMMIT_TIME_TRAVEL_DAG_CHECKPOINT',
      toolName: 'commit_dag_state',
      thought: 'Atlas: Committing architecture snapshot to Time-Travel DAG tree with cryptographic SHA checksum.',
      patchSummary: 'Committed DAG Branch: Banking-Prod-v1.0',
      patches: [],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: 0,
      targetResourceId: 'vpc_dr_bank',
      executionBadge: '0.6ms',
    },
    {
      stepIndex: 24,
      agentId: 'alpha',
      role: 'Cloud Infrastructure Architect',
      action: 'MATERIALIZE_PRODUCTION_BUNDLE',
      toolName: 'export_production_bundle',
      thought: 'Atlas: Multi-region sovereign banking mesh verified and ready for 1-click export.',
      patchSummary: 'Pipeline Complete: Production Bundle Ready',
      patches: [],
      costDeltaMonthlyUsd: 0,
      securityScoreDelta: 0,
      targetResourceId: 'vpc_primary_bank',
      executionBadge: '2.4ms',
    },
  ],
};

export const PRESET_SCENARIOS: Record<string, SimulationScenario> = {
  global_banking_core: GLOBAL_BANKING_SCENARIO,
  global_banking: GLOBAL_BANKING_SCENARIO,
  global: GLOBAL_BANKING_SCENARIO,
  ecommerce_ha: ECOMMERCE_SCENARIO,
  ecommerce: ECOMMERCE_SCENARIO,
  fintech_zerotrust: FINTECH_SCENARIO,
  fintech_zero_trust: FINTECH_SCENARIO,
  fintech: FINTECH_SCENARIO,
  microservices_mesh: MICROSERVICES_SCENARIO,
  microservices: MICROSERVICES_SCENARIO,
};

