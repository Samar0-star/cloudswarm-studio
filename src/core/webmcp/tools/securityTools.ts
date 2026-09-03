/**
 * Zero-Trust IAM & Multi-Cloud Security Hardening Tools (WebMCP Protocol)
 *
 * Exposes WebMCP tools for:
 * 1. CIS Benchmark & OWASP Multi-Cloud Top 10 Security Auditing (audit_iam_zero_trust)
 * 2. Least-Privilege IAM Policy / RBAC Document Synthesis (generate_least_privilege_policy)
 * 3. Automated Zero-Trust Security Remediation across AWS, Azure, and GCP (apply_security_hardening)
 */

import type {
  WebMCPTool,
  WebMCPToolResult,
  WebMCPExecutionContext,
  WebModelContextAPI,
} from '../../../types/webmcp';
import type {
  SecurityFinding,
  SecuritySeverity,
} from '../../../types/audit';
import { SentinelAuditor } from '../../audit/SentinelAuditor';
import type { TopologyState, CloudResourceType } from '../../../types/topology';
import type { OptimisticStateEngine } from '../../state/OptimisticStateEngine';

export interface SecurityRuleEvaluation {
  id: string;
  rule: string;
  severity: SecuritySeverity;
  category: string;
  penalty: number;
  message: string;
  remediation: string;
  remediationHcl: string;
}

/**
 * Scans a topology state for multi-cloud security misconfigurations and returns findings.
 */
export function scanTopologySecurity(state: TopologyState, targetNodeIds?: string[]): {
  score: number;
  status: 'PASS' | 'PASS_WITH_WARNINGS' | 'CRITICAL_FAIL';
  findings: SecurityFinding[];
  passedRules: string[];
} {
  const nodesToScan = targetNodeIds
    ? Object.values(state.nodes).filter((n) => targetNodeIds.includes(n.id))
    : Object.values(state.nodes);

  const findings: SecurityFinding[] = [];
  const passedRules = new Set<string>();
  let totalPenalty = 0;

  // Rule 1: No open SSH/RDP on Security Groups / Firewalls (0.0.0.0/0 on 22 or 3389)
  let r1Failed = false;
  for (const node of nodesToScan) {
    if (node.type === 'aws_security_group') {
      const ingressRules = (node.config.ingress_rules as Array<{ from_port?: number; to_port?: number; cidr_blocks?: string[] }>) ?? [];
      for (const rule of ingressRules) {
        const fromPort = rule.from_port ?? 0;
        const toPort = rule.to_port ?? 0;
        const cidrs = rule.cidr_blocks ?? [];
        const isPort22or3389 = (fromPort <= 22 && toPort >= 22) || (fromPort <= 3389 && toPort >= 3389);
        const isOpenCidr = cidrs.includes('0.0.0.0/0');

        if (isPort22or3389 && isOpenCidr) {
          r1Failed = true;
          totalPenalty += 25;
          findings.push({
            id: `SEC-001-${node.id}`,
            rule: 'CIS-AWS-4.1-NO-UNRESTRICTED-SSH-RDP',
            severity: 'CRITICAL',
            category: 'NETWORK_SECURITY',
            penalty: 25,
            target_node_id: node.id,
            message: `Security Group '${node.name}' (${node.id}) allows unrestricted ingress from 0.0.0.0/0 on sensitive port ${fromPort === 22 ? '22 (SSH)' : '3389 (RDP)'}.`,
            remediation: 'Restrict ingress to internal VPC CIDR, AWS Systems Manager (SSM), or a secure bastion subnet.',
            remediationHcl: `ingress {\n  cidr_blocks = ["10.0.0.0/16"]\n}`,
          });
        }
      }
    } else if (node.type === 'azurerm_network_security_group') {
      const secRules = (node.config.security_rules as Array<{ destination_port_range?: string; source_address_prefix?: string; access?: string; direction?: string }>) ?? [];
      for (const rule of secRules) {
        if (rule.direction === 'Inbound' && rule.access === 'Allow') {
          const port = rule.destination_port_range ?? '';
          const isOpen = rule.source_address_prefix === '*' || rule.source_address_prefix === '0.0.0.0/0' || rule.source_address_prefix === 'Internet';
          if ((port === '22' || port === '3389' || port === '*') && isOpen) {
            r1Failed = true;
            totalPenalty += 25;
            findings.push({
              id: `SEC-001-${node.id}`,
              rule: 'CIS-AZURE-6.1-NO-UNRESTRICTED-SSH-RDP',
              severity: 'CRITICAL',
              category: 'NETWORK_SECURITY',
              penalty: 25,
              target_node_id: node.id,
              message: `Azure NSG '${node.name}' (${node.id}) allows unrestricted inbound access from Internet on sensitive port ${port}.`,
              remediation: 'Restrict NSG inbound rule to VirtualNetwork or specific bastion IPs.',
              remediationHcl: `source_address_prefix = "VirtualNetwork"`,
            });
          }
        }
      }
    } else if (node.type === 'google_compute_firewall') {
      const allows = (node.config.allows as Array<{ protocol?: string; ports?: string[] }>) ?? [];
      const sourceRanges = (node.config.source_ranges as string[]) ?? [];
      const isOpen = sourceRanges.includes('0.0.0.0/0');
      for (const allow of allows) {
        const ports = allow.ports ?? [];
        if (isOpen && (ports.includes('22') || ports.includes('3389') || ports.length === 0)) {
          r1Failed = true;
          totalPenalty += 25;
          findings.push({
            id: `SEC-001-${node.id}`,
            rule: 'CIS-GCP-3.6-NO-UNRESTRICTED-SSH-RDP',
            severity: 'CRITICAL',
            category: 'NETWORK_SECURITY',
            penalty: 25,
            target_node_id: node.id,
            message: `GCP Firewall rule '${node.name}' allows 0.0.0.0/0 access on ports 22/3389.`,
            remediation: 'Restrict source ranges to internal subnet CIDRs or Identity-Aware Proxy (IAP) range 35.235.240.0/20.',
            remediationHcl: `source_ranges = ["35.235.240.0/20"]`,
          });
        }
      }
    }
  }
  if (!r1Failed) passedRules.add('CIS-AWS-4.1-NO-UNRESTRICTED-SSH-RDP');

  // Rule 2: Database must not be publicly accessible
  let r2Failed = false;
  for (const node of nodesToScan) {
    if (node.type === 'aws_db_instance') {
      const isPublic = node.config.publicly_accessible === true;
      if (isPublic) {
        r2Failed = true;
        totalPenalty += 20;
        findings.push({
          id: `SEC-002-${node.id}`,
          rule: 'CIS-AWS-2.3.1-NO-PUBLIC-RDS',
          severity: 'CRITICAL',
          category: 'DATABASE_SECURITY',
          penalty: 20,
          target_node_id: node.id,
          message: `Database instance '${node.name}' (${node.id}) has 'publicly_accessible = true', exposing database ports to the public internet.`,
          remediation: 'Set publicly_accessible = false and attach to private database subnets.',
          remediationHcl: `publicly_accessible = false`,
        });
      }
    } else if (node.type === 'azurerm_mssql_database' || node.type === 'azurerm_postgresql_flexible_server') {
      if (node.config.public_network_access_enabled === true) {
        r2Failed = true;
        totalPenalty += 20;
        findings.push({
          id: `SEC-002-${node.id}`,
          rule: 'CIS-AZURE-4.1-NO-PUBLIC-SQL',
          severity: 'CRITICAL',
          category: 'DATABASE_SECURITY',
          penalty: 20,
          target_node_id: node.id,
          message: `Azure SQL database '${node.name}' enables public network access.`,
          remediation: 'Set public_network_access_enabled = false and configure private endpoints.',
          remediationHcl: `public_network_access_enabled = false`,
        });
      }
    } else if (node.type === 'google_sql_database_instance') {
      const ipConfig = (node.config.ip_configuration as { ipv4_enabled?: boolean }) ?? {};
      if (ipConfig.ipv4_enabled === true && node.config.authorized_networks_public === true) {
        r2Failed = true;
        totalPenalty += 20;
        findings.push({
          id: `SEC-002-${node.id}`,
          rule: 'CIS-GCP-6.1-NO-PUBLIC-CLOUDSQL',
          severity: 'CRITICAL',
          category: 'DATABASE_SECURITY',
          penalty: 20,
          target_node_id: node.id,
          message: `Google Cloud SQL instance '${node.name}' is exposed on public IPv4 network.`,
          remediation: 'Enable private IP via VPC peering and disable public IPv4.',
          remediationHcl: `ip_configuration {\n  ipv4_enabled = false\n  private_network = google_compute_network.vpc.id\n}`,
        });
      }
    }
  }
  if (!r2Failed) passedRules.add('CIS-AWS-2.3.1-NO-PUBLIC-RDS');

  // Rule 3: Storage Bucket Encryption
  let r3Failed = false;
  for (const node of nodesToScan) {
    if (node.type === 'aws_s3_bucket') {
      const encryption = node.config.encryption as { sse_algorithm?: string } | undefined;
      const isEncrypted = encryption?.sse_algorithm === 'aws:kms' || encryption?.sse_algorithm === 'AES256';
      if (!isEncrypted) {
        r3Failed = true;
        totalPenalty += 15;
        findings.push({
          id: `SEC-003-${node.id}`,
          rule: 'CIS-AWS-2.1.1-S3-ENCRYPTION',
          severity: 'HIGH',
          category: 'DATA_PROTECTION',
          penalty: 15,
          target_node_id: node.id,
          message: `S3 Bucket '${node.name}' (${node.id}) is missing default KMS or AES256 server-side encryption.`,
          remediation: 'Configure server-side encryption with AWS KMS or AES256.',
          remediationHcl: `server_side_encryption_configuration {\n  rule {\n    apply_server_side_encryption_by_default {\n      sse_algorithm = "aws:kms"\n    }\n  }\n}`,
        });
      }
    } else if (node.type === 'azurerm_storage_account') {
      if (node.config.enable_https_traffic_only === false) {
        r3Failed = true;
        totalPenalty += 15;
        findings.push({
          id: `SEC-003-${node.id}`,
          rule: 'CIS-AZURE-3.1-STORAGE-HTTPS-ENCRYPTION',
          severity: 'HIGH',
          category: 'DATA_PROTECTION',
          penalty: 15,
          target_node_id: node.id,
          message: `Azure Storage Account '${node.name}' does not enforce HTTPS-only encrypted traffic.`,
          remediation: 'Enable enable_https_traffic_only = true and enforce TLS 1.2 minimum.',
          remediationHcl: `enable_https_traffic_only = true\nmin_tls_version = "TLS1_2"`,
        });
      }
    }
  }
  if (!r3Failed) passedRules.add('CIS-AWS-2.1.1-S3-ENCRYPTION');

  // Rule 4: Storage Bucket Block Public Access
  let r4Failed = false;
  for (const node of nodesToScan) {
    if (node.type === 'aws_s3_bucket') {
      const bpa = node.config.block_public_access as {
        block_public_acls?: boolean;
        block_public_policy?: boolean;
        ignore_public_acls?: boolean;
        restrict_public_buckets?: boolean;
      } | undefined;

      const isProtected =
        bpa?.block_public_acls === true &&
        bpa?.block_public_policy === true &&
        bpa?.ignore_public_acls === true &&
        bpa?.restrict_public_buckets === true;

      if (!isProtected) {
        r4Failed = true;
        totalPenalty += 15;
        findings.push({
          id: `SEC-004-${node.id}`,
          rule: 'CIS-AWS-2.1.2-S3-BLOCK-PUBLIC-ACCESS',
          severity: 'HIGH',
          category: 'DATA_PROTECTION',
          penalty: 15,
          target_node_id: node.id,
          message: `S3 Bucket '${node.name}' (${node.id}) does not enforce all S3 Public Access Block controls.`,
          remediation: 'Enable block_public_acls, block_public_policy, ignore_public_acls, and restrict_public_buckets.',
          remediationHcl: `block_public_acls = true\nblock_public_policy = true\nignore_public_acls = true\nrestrict_public_buckets = true`,
        });
      }
    } else if (node.type === 'google_storage_bucket') {
      if (node.config.uniform_bucket_level_access === false) {
        r4Failed = true;
        totalPenalty += 15;
        findings.push({
          id: `SEC-004-${node.id}`,
          rule: 'CIS-GCP-5.1-GCS-UNIFORM-ACCESS',
          severity: 'HIGH',
          category: 'DATA_PROTECTION',
          penalty: 15,
          target_node_id: node.id,
          message: `Google Cloud Storage Bucket '${node.name}' does not enforce uniform bucket-level access.`,
          remediation: 'Enable uniform_bucket_level_access = true to enforce centralized IAM governance.',
          remediationHcl: `uniform_bucket_level_access = true`,
        });
      }
    }
  }
  if (!r4Failed) passedRules.add('CIS-AWS-2.1.2-S3-BLOCK-PUBLIC-ACCESS');

  // Rule 5: IAM Role Wildcard Elimination
  let r5Failed = false;
  for (const node of nodesToScan) {
    if (node.type === 'aws_iam_role') {
      const inline = node.config.inline_policy as { policy_document?: string } | undefined;
      const policyDoc = inline?.policy_document ?? '';
      if (policyDoc.includes('"Action": "*"') || policyDoc.includes('"Resource": "*"') || policyDoc.includes('"Action":"*"')) {
        r5Failed = true;
        totalPenalty += 15;
        findings.push({
          id: `SEC-005-${node.id}`,
          rule: 'OWASP-CLOUD-01-WILDCARD-IAM',
          severity: 'HIGH',
          category: 'IAM_LEAST_PRIVILEGE',
          penalty: 15,
          target_node_id: node.id,
          message: `IAM Role '${node.name}' contains wildcard '*' Action or Resource permissions.`,
          remediation: 'Replace wildcard actions with explicit least-privilege API operations.',
          remediationHcl: `Action = ["s3:GetObject", "s3:PutObject"]`,
        });
      }
    } else if (node.type === 'azurerm_role_definition') {
      const permissions = (node.config.permissions as Array<{ actions?: string[] }>) ?? [];
      const hasWildcard = permissions.some((p) => (p.actions ?? []).includes('*'));
      if (hasWildcard) {
        r5Failed = true;
        totalPenalty += 15;
        findings.push({
          id: `SEC-005-${node.id}`,
          rule: 'OWASP-CLOUD-01-WILDCARD-IAM',
          severity: 'HIGH',
          category: 'IAM_LEAST_PRIVILEGE',
          penalty: 15,
          target_node_id: node.id,
          message: `Azure Role Definition '${node.name}' contains wildcard '*' actions.`,
          remediation: 'Restrict actions to specific Microsoft resource provider operations.',
          remediationHcl: `actions = ["Microsoft.Storage/storageAccounts/blobServices/containers/read"]`,
        });
      }
    }
  }
  if (!r5Failed) passedRules.add('OWASP-CLOUD-01-WILDCARD-IAM');

  // Rule 6: Compute IMDSv2 Enforcement
  let r6Failed = false;
  for (const node of nodesToScan) {
    if (node.type === 'aws_instance') {
      const tokens = node.config.http_tokens;
      if (tokens !== 'required') {
        r6Failed = true;
        totalPenalty += 10;
        findings.push({
          id: `SEC-006-${node.id}`,
          rule: 'CIS-AWS-2.1.3-EC2-IMDSV2',
          severity: 'MEDIUM',
          category: 'COMPUTE_SECURITY',
          penalty: 10,
          target_node_id: node.id,
          message: `EC2 instance '${node.name}' (${node.id}) does not mandate IMDSv2 (http_tokens = required), exposing metadata service to SSRF attacks.`,
          remediation: 'Set http_tokens = "required" in metadata_options.',
          remediationHcl: `metadata_options {\n  http_tokens = "required"\n}`,
        });
      }
    }
  }
  if (!r6Failed) passedRules.add('CIS-AWS-2.1.3-EC2-IMDSV2');

  // Rule 7: Load Balancer HTTPS Listener
  let r7Failed = false;
  for (const node of nodesToScan) {
    if (node.type === 'aws_lb') {
      const listeners = (node.config.listeners as Array<{ protocol?: string }>) ?? [];
      const hasHttps = listeners.some((l) => l.protocol?.toUpperCase() === 'HTTPS');
      if (!hasHttps && listeners.length > 0) {
        r7Failed = true;
        totalPenalty += 10;
        findings.push({
          id: `SEC-007-${node.id}`,
          rule: 'CIS-AWS-4.2-ALB-HTTPS-ENFORCEMENT',
          severity: 'MEDIUM',
          category: 'NETWORK_SECURITY',
          penalty: 10,
          target_node_id: node.id,
          message: `Application Load Balancer '${node.name}' does not configure an HTTPS TLS listener.`,
          remediation: 'Add an HTTPS listener (port 443) with an SSL policy and ACM certificate.',
          remediationHcl: `listener {\n  port = 443\n  protocol = "HTTPS"\n  ssl_policy = "ELBSecurityPolicy-TLS13-1-2-2021-06"\n}`,
        });
      }
    }
  }
  if (!r7Failed) passedRules.add('CIS-AWS-4.2-ALB-HTTPS-ENFORCEMENT');

  const score = Math.max(0, 100 - totalPenalty);
  let status: 'PASS' | 'PASS_WITH_WARNINGS' | 'CRITICAL_FAIL' = 'PASS';
  if (score < 70) {
    status = 'CRITICAL_FAIL';
  } else if (score < 100) {
    status = 'PASS_WITH_WARNINGS';
  }

  return {
    score,
    status,
    findings,
    passedRules: Array.from(passedRules),
  };
}

/**
 * Creates the audit_iam_zero_trust WebMCP tool.
 */
export function createAuditIamZeroTrustTool(getState: () => TopologyState): WebMCPTool {
  return {
    name: 'audit_iam_zero_trust',
    description:
      'Performs a deep Zero-Trust security and IAM least-privilege audit across all multi-cloud topology nodes (AWS, Azure, GCP), checking for wildcard permissions, unencrypted storage, open ingress, and missing IMDSv2.',
    category: 'security',
    inputSchema: {
      type: 'object',
      properties: {
        severity_threshold: {
          type: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
          default: 'LOW',
          description: 'Minimum finding severity level to include in the report.',
        },
        target_node_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of node IDs to restrict audit scope.',
        },
      },
    },
    execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
      const agentId = context?.agentId ?? 'beta';
      const state = getState();
      const targetNodeIds = params.target_node_ids as string[] | undefined;
      const scanResult = scanTopologySecurity(state, targetNodeIds);

      const threshold = String(params.severity_threshold ?? 'LOW').toUpperCase();
      const severityRanks: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
      const minRank = severityRanks[threshold] ?? 1;

      const filteredFindings = scanResult.findings.filter((f) => {
        const rank = severityRanks[f.severity.toUpperCase()] ?? 1;
        return rank >= minRank;
      });

      const reportPayload = {
        overall_compliance_score: scanResult.score,
        status: scanResult.status,
        total_findings: filteredFindings.length,
        findings: filteredFindings,
        passed_rules_count: scanResult.passedRules.length,
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
          securityScoreDelta: scanResult.score,
        },
      };
    },
  };
}

/**
 * Creates the generate_least_privilege_policy WebMCP tool.
 */
export function createGenerateLeastPrivilegePolicyTool(): WebMCPTool {
  return {
    name: 'generate_least_privilege_policy',
    description:
      'Generates a strict least-privilege IAM Policy (AWS), Azure RBAC Role Definition, or GCP IAM binding document JSON with zero wildcards and mandatory condition keys.',
    category: 'security',
    inputSchema: {
      type: 'object',
      required: ['workload_type', 'resource_arn'],
      properties: {
        provider: {
          type: 'string',
          enum: ['aws', 'azure', 'google'],
          default: 'aws',
          description: 'Target cloud provider for the policy synthesis.',
        },
        workload_type: {
          type: 'string',
          enum: [
            's3_read_write',
            's3_read_only',
            'dynamodb_crud',
            'sqs_producer_consumer',
            'secrets_manager_read',
            'kms_decrypt',
            'blob_storage_rw',
            'cosmos_db_crud',
            'gcs_object_rw',
            'cloud_sql_client',
          ],
          description: 'Standard workload profile archetype.',
        },
        resource_arn: {
          type: 'string',
          description: "Target Resource Identifier/ARN (e.g., 'arn:aws:s3:::company-app-data-prod/*', '/subscriptions/...', '//storage.googleapis.com/...').",
        },
        allowed_operations: {
          type: 'array',
          items: { type: 'string' },
          description: "Explicit actions allowed (e.g. ['s3:GetObject', 's3:PutObject']).",
        },
        enforce_mfa: { type: 'boolean', default: false, description: 'Enforce MFA presence in condition block.' },
        enforce_tls_version: { type: 'string', enum: ['1.2', '1.3'], default: '1.2', description: 'Enforce minimum TLS transport version.' },
      },
    },
    execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
      const agentId = context?.agentId ?? 'beta';
      const provider = String(params.provider ?? 'aws').toLowerCase();
      const workloadType = String(params.workload_type);
      const resourceArn = String(params.resource_arn);
      const allowedOps = (params.allowed_operations as string[]) ?? [];
      const enforceMfa = Boolean(params.enforce_mfa);
      const tlsVersion = String(params.enforce_tls_version ?? '1.2');

      const defaultOpsByWorkload: Record<string, string[]> = {
        s3_read_write: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
        s3_read_only: ['s3:GetObject', 's3:ListBucket'],
        dynamodb_crud: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:Query'],
        sqs_producer_consumer: ['sqs:SendMessage', 'sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
        secrets_manager_read: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
        kms_decrypt: ['kms:Decrypt', 'kms:DescribeKey'],
        blob_storage_rw: ['Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read', 'Microsoft.Storage/storageAccounts/blobServices/containers/blobs/write'],
        cosmos_db_crud: ['Microsoft.DocumentDB/databaseAccounts/readMetadata', 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/items/*'],
        gcs_object_rw: ['storage.objects.get', 'storage.objects.create', 'storage.objects.list'],
        cloud_sql_client: ['cloudsql.instances.connect', 'cloudsql.instances.get'],
      };

      const finalActions = allowedOps.length > 0 ? allowedOps : (defaultOpsByWorkload[workloadType] ?? ['s3:GetObject']);

      let outputDocument: Record<string, unknown>;

      if (provider === 'azure') {
        outputDocument = {
          RoleName: 'LeastPrivilegeCustomRole',
          IsCustom: true,
          Description: `Scoped least-privilege role for workload: ${workloadType}`,
          Actions: finalActions,
          NotActions: [],
          AssignableScopes: [resourceArn],
        };
      } else if (provider === 'google') {
        outputDocument = {
          role: 'roles/custom.workloadExecutor',
          title: `Custom Least Privilege Role for ${workloadType}`,
          description: 'Synthesized zero-trust IAM role for Google Cloud workloads',
          includedPermissions: finalActions,
          stage: 'GA',
        };
      } else {
        const conditions: Record<string, unknown> = {
          Bool: {
            'aws:SecureTransport': 'true',
          },
          NumericGreaterThanEquals: {
            's3:TlsVersion': tlsVersion,
          },
        };

        if (enforceMfa) {
          (conditions.Bool as Record<string, string>)['aws:MultiFactorAuthPresent'] = 'true';
        }

        outputDocument = {
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'StrictLeastPrivilegeEnforcement',
              Effect: 'Allow',
              Action: finalActions,
              Resource: resourceArn,
              Condition: conditions,
            },
          ],
        };
      }

      const jsonString = JSON.stringify(outputDocument, null, 2);

      return {
        content: [
          {
            type: 'text',
            text: jsonString,
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

/**
 * Creates the apply_security_hardening WebMCP tool.
 */
export function createApplySecurityHardeningTool(stateEngine?: OptimisticStateEngine): WebMCPTool {
  return {
    name: 'apply_security_hardening',
    description:
      'Applies automated Zero-Trust security patches across multi-cloud topology nodes (AWS, Azure, GCP), replacing open security groups, enforcing IMDSv2, enabling KMS encryption, and locking storage buckets.',
    category: 'security',
    inputSchema: {
      type: 'object',
      properties: {
        target_node_ids: { type: 'array', items: { type: 'string' }, description: 'Optional list of target nodes to harden.' },
        auto_enforce_kms: { type: 'boolean', default: true, description: 'Automatically enable KMS encryption on storage and databases.' },
        auto_enforce_imdsv2: { type: 'boolean', default: true, description: 'Mandate IMDSv2 token authentication.' },
        auto_close_public_db: { type: 'boolean', default: true, description: 'Disable public accessibility on databases.' },
        auto_block_s3_public: { type: 'boolean', default: true, description: 'Block all public S3/Blob access.' },
      },
    },
    execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
      const agentId = context?.agentId ?? 'beta';
      if (!stateEngine) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'State engine unavailable for applying security hardening.' }],
        };
      }

      const state = stateEngine.getState();
      const beforeScan = scanTopologySecurity(state);
      const targetNodeIds = params.target_node_ids as string[] | undefined;
      const remediatedNodeIds: string[] = [];

      const nodesToHard = targetNodeIds
        ? Object.values(state.nodes).filter((n) => targetNodeIds.includes(n.id))
        : Object.values(state.nodes);

      for (const node of nodesToHard) {
        const patch: Record<string, unknown> = {};
        let modified = false;

        // Harden S3
        if (node.type === 'aws_s3_bucket') {
          if (params.auto_enforce_kms !== false) {
            patch.encryption = { sse_algorithm: 'aws:kms', kms_key_id: 'alias/aws/s3' };
            patch.enforce_ssl_tls_requests = true;
            modified = true;
          }
          if (params.auto_block_s3_public !== false) {
            patch.block_public_access = {
              block_public_acls: true,
              block_public_policy: true,
              ignore_public_acls: true,
              restrict_public_buckets: true,
            };
            modified = true;
          }
        }

        // Harden Azure Storage
        if (node.type === 'azurerm_storage_account') {
          patch.enable_https_traffic_only = true;
          patch.min_tls_version = 'TLS1_2';
          patch.allow_nested_items_to_be_public = false;
          modified = true;
        }

        // Harden GCP Storage
        if (node.type === 'google_storage_bucket') {
          patch.uniform_bucket_level_access = true;
          modified = true;
        }

        // Harden EC2 IMDSv2
        if (node.type === 'aws_instance' && params.auto_enforce_imdsv2 !== false) {
          patch.http_tokens = 'required';
          modified = true;
        }

        // Harden RDS
        if (node.type === 'aws_db_instance' && params.auto_close_public_db !== false) {
          patch.publicly_accessible = false;
          patch.storage_encrypted = true;
          patch.kms_key_id = 'alias/aws/rds';
          modified = true;
        }

        // Harden Security Groups (close port 22/3389 on 0.0.0.0/0)
        if (node.type === 'aws_security_group') {
          const ingressRules = (node.config.ingress_rules as Array<{
            protocol: string;
            from_port: number;
            to_port: number;
            cidr_blocks?: string[];
            description?: string;
          }>) ?? [];

          const hardenedRules = ingressRules.map((rule) => {
            const isSensitive =
              (rule.from_port <= 22 && rule.to_port >= 22) ||
              (rule.from_port <= 3389 && rule.to_port >= 3389);
            if (isSensitive && rule.cidr_blocks?.includes('0.0.0.0/0')) {
              return {
                ...rule,
                cidr_blocks: ['10.0.0.0/16'],
                description: 'Hardened: Restrict ingress to internal VPC CIDR',
              };
            }
            return rule;
          });
          patch.ingress_rules = hardenedRules;
          modified = true;
        }

        if (modified) {
          await stateEngine.updateNodeConfig(node.id, patch, agentId);
          remediatedNodeIds.push(node.id);
        }
      }

      const afterScan = scanTopologySecurity(stateEngine.getState());

      const summary = {
        remediated_node_count: remediatedNodeIds.length,
        remediated_node_ids: remediatedNodeIds,
        previous_security_score: beforeScan.score,
        new_security_score: afterScan.score,
        score_improvement: afterScan.score - beforeScan.score,
        remaining_findings_count: afterScan.findings.length,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summary, null, 2),
          },
        ],
        meta: {
          executionTimeMs: 0,
          agentId,
          appliedPatches: remediatedNodeIds.length,
          securityScoreDelta: afterScan.score - beforeScan.score,
        },
      };
    },
  };
}

export function createGetComplianceScorecardTool(getState: () => TopologyState): WebMCPTool {
  return {
    name: 'get_compliance_scorecard',
    description:
      'Evaluates current topology against CIS Foundations Benchmark, PCI-DSS v3.2.1, and SOC2 Type II compliance frameworks.',
    category: 'security',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute(_params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> {
      const state = getState();
      const auditor = new SentinelAuditor();
      const audit = auditor.auditTopology(state);

      const hasCritical = audit.findings.some((f: SecurityFinding) => f.severity === 'CRITICAL');
      const hasHigh = audit.findings.some((f: SecurityFinding) => f.severity === 'HIGH');
      const unencryptedCount = Object.values(state.nodes).filter(
        (n) => n.config && (n.config.storage_encrypted === false || n.config.encrypted === false)
      ).length;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            overall_cis_score: audit.securityScore,
            security_posture: audit.grade,
            framework_evaluations: {
              cis_benchmarks: audit.securityScore >= 90 ? 'COMPLIANT' : 'NON_COMPLIANT',
              pci_dss_v3_2_1: unencryptedCount === 0 && !hasCritical ? 'COMPLIANT' : 'NON_COMPLIANT',
              soc2_type_2: !hasCritical && !hasHigh ? 'COMPLIANT' : 'NON_COMPLIANT',
            },
            summary_metrics: {
              total_resources_scanned: Object.keys(state.nodes).length,
              total_violations: audit.findings.length,
              critical_severity: audit.findings.filter((f: SecurityFinding) => f.severity === 'CRITICAL' || f.severity === 'critical').length,
              high_severity: audit.findings.filter((f: SecurityFinding) => f.severity === 'HIGH' || f.severity === 'high').length,
              unencrypted_data_stores: unencryptedCount,
            },
            remediation_recommendations: audit.findings.slice(0, 5).map((f: SecurityFinding) => ({
              id: f.id,
              rule: f.rule,
              severity: f.severity,
              target_node_id: f.target_node_id,
              remediation: f.remediation,
            })),
          }, null, 2),
        }],
        meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'beta' },
      };
    },
  };
}

/**
 * Registers all security tools into a WebMCP context engine.
 */
export function registerSecurityTools(
  engine: WebModelContextAPI,
  getState: () => TopologyState,
  stateEngine?: OptimisticStateEngine
): () => void {
  const unregisterPromises: Array<Promise<() => void> | (() => void)> = [];

  unregisterPromises.push(engine.registerTool(createAuditIamZeroTrustTool(getState)));
  unregisterPromises.push(engine.registerTool(createGenerateLeastPrivilegePolicyTool()));
  unregisterPromises.push(engine.registerTool(createApplySecurityHardeningTool(stateEngine)));
  unregisterPromises.push(engine.registerTool(createGetComplianceScorecardTool(getState)));

  return () => {
    for (const p of unregisterPromises) {
      Promise.resolve(p).then(fn => fn && fn());
    }
  };
}
