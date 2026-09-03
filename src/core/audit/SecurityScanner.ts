/**
 * CIS Benchmarks & OWASP Cloud Security Scanner Engine
 *
 * 100-point security scoring engine evaluating CIS benchmarks & OWASP rules:
 * - Open SSH/RDP ingress (-25 pts)
 * - Public RDS (-20 pts)
 * - Unencrypted S3 (-15 pts)
 * - Missing S3 public access block (-15 pts)
 * - Wildcard IAM (-15 pts)
 * - IMDSv1 on EC2 (-10 pts)
 * - ALB HTTP without TLS redirect (-10 pts)
 * - Auto-remediation patch generation & least-privilege policy synthesis
 */

import type {
  SecurityFinding,
  SecuritySeverity,
  AuditGrade,
} from '../../types/audit';
import { computeAuditGrade } from '../../types/audit';
import type { TopologyState } from '../../types/topology';
import type { RFC6902Patch } from '../../types/patch';

export interface SecurityScanResult {
  score: number;
  grade: AuditGrade;
  status: 'PASS' | 'PASS_WITH_WARNINGS' | 'CRITICAL_FAIL';
  findings: SecurityFinding[];
  passedRules: string[];
}

export interface SecurityRuleDefinition {
  id: string;
  rule: string;
  severity: SecuritySeverity;
  category: string;
  penalty: number;
  description: string;
}

export const SECURITY_RULES: SecurityRuleDefinition[] = [
  {
    id: 'SEC-001',
    rule: 'CIS-AWS-4.1-NO-UNRESTRICTED-SSH-RDP',
    severity: 'CRITICAL',
    category: 'NETWORK_SECURITY',
    penalty: 25,
    description: 'Security groups must not allow unrestricted ingress (0.0.0.0/0) on port 22 (SSH) or 3389 (RDP).',
  },
  {
    id: 'SEC-002',
    rule: 'CIS-AWS-2.3.1-NO-PUBLIC-RDS',
    severity: 'CRITICAL',
    category: 'DATABASE_SECURITY',
    penalty: 20,
    description: 'RDS Database instances must not be publicly accessible.',
  },
  {
    id: 'SEC-003',
    rule: 'CIS-AWS-2.1.1-S3-ENCRYPTION',
    severity: 'HIGH',
    category: 'DATA_PROTECTION',
    penalty: 15,
    description: 'S3 Buckets must enforce server-side encryption with AWS KMS or AES-256.',
  },
  {
    id: 'SEC-004',
    rule: 'CIS-AWS-2.1.2-S3-BLOCK-PUBLIC-ACCESS',
    severity: 'HIGH',
    category: 'DATA_PROTECTION',
    penalty: 15,
    description: 'S3 Buckets must enforce all 4 S3 Public Access Block settings.',
  },
  {
    id: 'SEC-005',
    rule: 'OWASP-CLOUD-01-WILDCARD-IAM',
    severity: 'HIGH',
    category: 'IAM_LEAST_PRIVILEGE',
    penalty: 15,
    description: 'IAM Roles and policies must not contain wildcard "*" Action or Resource permissions.',
  },
  {
    id: 'SEC-006',
    rule: 'CIS-AWS-2.1.3-EC2-IMDSV2',
    severity: 'MEDIUM',
    category: 'COMPUTE_SECURITY',
    penalty: 10,
    description: 'EC2 Instances must mandate IMDSv2 (http_tokens = required) to prevent SSRF vulnerabilities.',
  },
  {
    id: 'SEC-007',
    rule: 'CIS-AWS-4.2-ALB-HTTPS-ENFORCEMENT',
    severity: 'MEDIUM',
    category: 'NETWORK_SECURITY',
    penalty: 10,
    description: 'Application Load Balancers must configure an HTTPS TLS listener.',
  },
];

/**
 * Scans a topology state for security violations and computes compliance score.
 */
export function scanTopologySecurity(
  state: TopologyState,
  targetNodeIds?: string[]
): SecurityScanResult {
  const nodesToScan = targetNodeIds
    ? Object.values(state.nodes).filter((n) => targetNodeIds.includes(n.id))
    : Object.values(state.nodes);

  const findings: SecurityFinding[] = [];
  const passedRules = new Set<string>();
  let totalPenalty = 0;

  // Rule 1: No open SSH/RDP on Security Groups (0.0.0.0/0 on 22 or 3389)
  let r1Failed = false;
  for (const node of nodesToScan) {
    if (node.type === 'aws_security_group') {
      const ingressRules =
        (node.config.ingress_rules as Array<{
          from_port?: number;
          to_port?: number;
          cidr_blocks?: string[];
        }>) ?? [];

      for (const rule of ingressRules) {
        const fromPort = rule.from_port ?? 0;
        const toPort = rule.to_port ?? 0;
        const cidrs = rule.cidr_blocks ?? [];
        const isPort22or3389 =
          (fromPort <= 22 && toPort >= 22) || (fromPort <= 3389 && toPort >= 3389);
        const isOpenCidr = cidrs.includes('0.0.0.0/0') || cidrs.includes('::/0');

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
            message: `Security Group '${node.name}' (${node.id}) allows unrestricted ingress from 0.0.0.0/0 on sensitive port ${
              fromPort === 22 ? '22 (SSH)' : '3389 (RDP)'
            }.`,
            remediation:
              'Restrict ingress to internal VPC CIDR (e.g. 10.0.0.0/16), AWS SSM Session Manager, or private bastion subnets.',
            remediationHcl: 'ingress {\n  cidr_blocks = ["10.0.0.0/16"]\n}',
          });
        }
      }
    }
  }
  if (!r1Failed) passedRules.add('CIS-AWS-4.1-NO-UNRESTRICTED-SSH-RDP');

  // Rule 2: RDS Database must not be publicly accessible
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
          message: `Database instance '${node.name}' (${node.id}) has 'publicly_accessible = true', exposing database listener ports to public internet.`,
          remediation: 'Set publicly_accessible = false and deploy inside private isolated database subnets.',
          remediationHcl: 'publicly_accessible = false',
        });
      }
    }
  }
  if (!r2Failed) passedRules.add('CIS-AWS-2.3.1-NO-PUBLIC-RDS');

  // Rule 3: S3 Bucket Encryption
  let r3Failed = false;
  for (const node of nodesToScan) {
    if (node.type === 'aws_s3_bucket') {
      const encryption = node.config.encryption as { sse_algorithm?: string } | undefined;
      const isEncrypted =
        encryption?.sse_algorithm === 'aws:kms' || encryption?.sse_algorithm === 'AES256';
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
          remediation: 'Configure server-side encryption with AWS KMS (aws:kms) or AES256.',
          remediationHcl:
            'server_side_encryption_configuration {\n  rule {\n    apply_server_side_encryption_by_default {\n      sse_algorithm = "aws:kms"\n    }\n  }\n}',
        });
      }
    }
  }
  if (!r3Failed) passedRules.add('CIS-AWS-2.1.1-S3-ENCRYPTION');

  // Rule 4: S3 Bucket Block Public Access
  let r4Failed = false;
  for (const node of nodesToScan) {
    if (node.type === 'aws_s3_bucket') {
      const bpa = node.config.block_public_access as
        | {
            block_public_acls?: boolean;
            block_public_policy?: boolean;
            ignore_public_acls?: boolean;
            restrict_public_buckets?: boolean;
          }
        | undefined;

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
          message: `S3 Bucket '${node.name}' (${node.id}) does not enforce all 4 S3 Public Access Block controls.`,
          remediation:
            'Enable block_public_acls, block_public_policy, ignore_public_acls, and restrict_public_buckets.',
          remediationHcl:
            'block_public_acls = true\nblock_public_policy = true\nignore_public_acls = true\nrestrict_public_buckets = true',
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
      const hasWildcard =
        policyDoc.includes('"Action": "*"') ||
        policyDoc.includes('"Resource": "*"') ||
        policyDoc.includes('"Action":"*"') ||
        policyDoc.includes('"Resource":"*"') ||
        policyDoc.includes("'*'") ||
        (node.config.managed_policy_arns as string[] | undefined)?.includes(
          'arn:aws:iam::aws:policy/AdministratorAccess'
        );

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
          message: `IAM Role '${node.name}' contains wildcard '*' Action or Resource permissions.`,
          remediation:
            'Replace wildcard actions with explicit least-privilege IAM operations and exact resource ARNs.',
          remediationHcl: 'Action = ["s3:GetObject", "s3:PutObject"]',
        });
      }
    }
  }
  if (!r5Failed) passedRules.add('OWASP-CLOUD-01-WILDCARD-IAM');

  // Rule 6: EC2 IMDSv2 Enforcement
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
          remediationHcl: 'metadata_options {\n  http_tokens = "required"\n}',
        });
      }
    }
  }
  if (!r6Failed) passedRules.add('CIS-AWS-2.1.3-EC2-IMDSV2');

  // Rule 7: ALB HTTPS Listener
  let r7Failed = false;
  for (const node of nodesToScan) {
    if (node.type === 'aws_lb') {
      const listeners =
        (node.config.listeners as Array<{ protocol?: string; port?: number }>) ?? [];
      const hasHttps = listeners.some(
        (l) => l.protocol?.toUpperCase() === 'HTTPS' || l.port === 443
      );
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
          message: `Application Load Balancer '${node.name}' (${node.id}) does not configure an HTTPS TLS listener.`,
          remediation:
            'Add an HTTPS listener (port 443) with TLS 1.2+ SSL policy and ACM certificate.',
          remediationHcl:
            'listener {\n  port = 443\n  protocol = "HTTPS"\n  ssl_policy = "ELBSecurityPolicy-TLS13-1-2-2021-06"\n}',
        });
      }
    }
  }
  if (!r7Failed) passedRules.add('CIS-AWS-4.2-ALB-HTTPS-ENFORCEMENT');

  const score = Math.max(0, 100 - totalPenalty);
  const grade = computeAuditGrade(score);

  let status: 'PASS' | 'PASS_WITH_WARNINGS' | 'CRITICAL_FAIL' = 'PASS';
  if (score < 70) {
    status = 'CRITICAL_FAIL';
  } else if (score < 100) {
    status = 'PASS_WITH_WARNINGS';
  }

  return {
    score,
    grade,
    status,
    findings,
    passedRules: Array.from(passedRules),
  };
}

/**
 * Standard contract method for security compliance scanning.
 */
export function scanSecurityCompliance(state: TopologyState): {
  score: number;
  grade: AuditGrade;
  status: 'PASS' | 'PASS_WITH_WARNINGS' | 'CRITICAL_FAIL';
  findings: SecurityFinding[];
  passedRules: string[];
} {
  return scanTopologySecurity(state);
}

/**
 * Generates RFC 6902-compliant patches to auto-remediate security findings.
 */
export function generateRemediationPatches(
  state: TopologyState,
  targetFindingIds?: string[]
): RFC6902Patch[] {
  const scan = scanTopologySecurity(state);
  const patches: RFC6902Patch[] = [];

  const findingsToRemediate = targetFindingIds
    ? scan.findings.filter((f) => targetFindingIds.includes(f.id))
    : scan.findings;

  for (const finding of findingsToRemediate) {
    const node = state.nodes[finding.target_node_id];
    if (!node) continue;

    switch (finding.rule) {
      case 'CIS-AWS-4.1-NO-UNRESTRICTED-SSH-RDP': {
        const ingressRules =
          (node.config.ingress_rules as Array<{
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
          if (isSensitive && (rule.cidr_blocks?.includes('0.0.0.0/0') || rule.cidr_blocks?.includes('::/0'))) {
            return {
              ...rule,
              cidr_blocks: ['10.0.0.0/16'],
              description: 'Hardened: Restrict ingress to internal VPC CIDR',
            };
          }
          return rule;
        });

        patches.push({
          op: 'replace',
          path: `/nodes/${node.id}/config/ingress_rules`,
          value: hardenedRules,
        });
        break;
      }

      case 'CIS-AWS-2.3.1-NO-PUBLIC-RDS': {
        patches.push({
          op: 'replace',
          path: `/nodes/${node.id}/config/publicly_accessible`,
          value: false,
        });
        patches.push({
          op: 'add',
          path: `/nodes/${node.id}/config/storage_encrypted`,
          value: true,
        });
        break;
      }

      case 'CIS-AWS-2.1.1-S3-ENCRYPTION': {
        patches.push({
          op: 'add',
          path: `/nodes/${node.id}/config/encryption`,
          value: {
            sse_algorithm: 'aws:kms',
            kms_key_id: 'alias/aws/s3',
          },
        });
        patches.push({
          op: 'add',
          path: `/nodes/${node.id}/config/enforce_ssl_tls_requests`,
          value: true,
        });
        break;
      }

      case 'CIS-AWS-2.1.2-S3-BLOCK-PUBLIC-ACCESS': {
        patches.push({
          op: 'add',
          path: `/nodes/${node.id}/config/block_public_access`,
          value: {
            block_public_acls: true,
            block_public_policy: true,
            ignore_public_acls: true,
            restrict_public_buckets: true,
          },
        });
        break;
      }

      case 'OWASP-CLOUD-01-WILDCARD-IAM': {
        const leastPrivilegeDoc = JSON.stringify(
          {
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'LeastPrivilegeHardenedPolicy',
                Effect: 'Allow',
                Action: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
                Resource: ['arn:aws:s3:::app-data-prod', 'arn:aws:s3:::app-data-prod/*'],
                Condition: {
                  Bool: { 'aws:SecureTransport': 'true' },
                },
              },
            ],
          },
          null,
          2
        );

        patches.push({
          op: 'replace',
          path: `/nodes/${node.id}/config/inline_policy`,
          value: {
            policy_name: 'LeastPrivilegeRolePolicy',
            policy_document: leastPrivilegeDoc,
          },
        });
        break;
      }

      case 'CIS-AWS-2.1.3-EC2-IMDSV2': {
        patches.push({
          op: 'add',
          path: `/nodes/${node.id}/config/http_tokens`,
          value: 'required',
        });
        break;
      }

      case 'CIS-AWS-4.2-ALB-HTTPS-ENFORCEMENT': {
        const currentListeners =
          (node.config.listeners as Array<Record<string, unknown>>) ?? [];
        const updatedListeners = [
          ...currentListeners,
          {
            port: 443,
            protocol: 'HTTPS',
            ssl_policy: 'ELBSecurityPolicy-TLS13-1-2-2021-06',
            certificate_arn: 'arn:aws:acm:us-east-1:123456789012:certificate/example-cert',
          },
        ];

        patches.push({
          op: 'replace',
          path: `/nodes/${node.id}/config/listeners`,
          value: updatedListeners,
        });
        break;
      }
    }
  }

  return patches;
}

/**
 * Generates strict least-privilege IAM policy document JSON.
 */
export function generateLeastPrivilegePolicyDocument(
  workloadType: string,
  resourceArn: string,
  allowedOperations?: string[],
  enforceMfa = false,
  tlsVersion = '1.2'
): Record<string, unknown> {
  const defaultOpsByWorkload: Record<string, string[]> = {
    s3_read_write: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
    s3_read_only: ['s3:GetObject', 's3:ListBucket'],
    dynamodb_crud: [
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
      'dynamodb:DeleteItem',
      'dynamodb:Query',
    ],
    sqs_producer_consumer: [
      'sqs:SendMessage',
      'sqs:ReceiveMessage',
      'sqs:DeleteMessage',
      'sqs:GetQueueAttributes',
    ],
    secrets_manager_read: [
      'secretsmanager:GetSecretValue',
      'secretsmanager:DescribeSecret',
    ],
    kms_decrypt: ['kms:Decrypt', 'kms:DescribeKey'],
  };

  const finalActions =
    allowedOperations && allowedOperations.length > 0
      ? allowedOperations
      : defaultOpsByWorkload[workloadType] ?? ['s3:GetObject'];

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

  return {
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

/**
 * SecurityScanner class encapsulating security auditing and remediation.
 */
export class SecurityScanner {
  public scan(state: TopologyState, targetNodeIds?: string[]): SecurityScanResult {
    return scanTopologySecurity(state, targetNodeIds);
  }

  public scanSecurityCompliance(state: TopologyState): SecurityScanResult {
    return scanSecurityCompliance(state);
  }

  public generateRemediationPatches(
    state: TopologyState,
    targetFindingIds?: string[]
  ): RFC6902Patch[] {
    return generateRemediationPatches(state, targetFindingIds);
  }

  public generateLeastPrivilegePolicy(
    workloadType: string,
    resourceArn: string,
    allowedOperations?: string[],
    enforceMfa = false,
    tlsVersion = '1.2'
  ): Record<string, unknown> {
    return generateLeastPrivilegePolicyDocument(
      workloadType,
      resourceArn,
      allowedOperations,
      enforceMfa,
      tlsVersion
    );
  }
}

export const securityScanner = new SecurityScanner();
