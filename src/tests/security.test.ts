/**
 * Unit Tests for CIS Benchmarks & OWASP Security Engine (SecurityScanner)
 */

import {
  SECURITY_RULES,
  scanTopologySecurity,
  scanSecurityCompliance,
  generateRemediationPatches,
  generateLeastPrivilegePolicyDocument,
  SecurityScanner,
  securityScanner,
} from '../core/audit/SecurityScanner';
import type { TopologyState } from '../types/topology';
import { createDefaultTopologyState } from '../types/topology';

describe('SecurityScanner & OWASP Engine Unit Tests', () => {
  describe('Rule Catalog Integrity', () => {
    test('defines 7 core CIS & OWASP security rules with penalties totaling >= 100', () => {
      expect(SECURITY_RULES.length).toBe(7);
      const totalPenalty = SECURITY_RULES.reduce((sum, r) => sum + r.penalty, 0);
      expect(totalPenalty).toBe(110); // 25 + 20 + 15 + 15 + 15 + 10 + 10 = 110
    });
  });

  describe('Clean Topology Baseline', () => {
    test('awards 100 points, Grade A+, and PASS status to fully hardened topology', () => {
      const state: TopologyState = {
        nodes: {
          vpc1: {
            id: 'vpc1',
            type: 'aws_vpc',
            name: 'VPC',
            position: { x: 0, y: 0 },
            config: { cidr_block: '10.0.0.0/16' },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          sg1: {
            id: 'sg1',
            type: 'aws_security_group',
            name: 'Hardened SG',
            position: { x: 100, y: 0 },
            config: {
              ingress_rules: [
                { protocol: 'tcp', from_port: 443, to_port: 443, cidr_blocks: ['0.0.0.0/0'] },
                { protocol: 'tcp', from_port: 22, to_port: 22, cidr_blocks: ['10.0.0.0/16'] },
              ],
            },
            metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          db1: {
            id: 'db1',
            type: 'aws_db_instance',
            name: 'Private DB',
            position: { x: 200, y: 0 },
            config: { publicly_accessible: false, storage_encrypted: true },
            metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          s3_1: {
            id: 's3_1',
            type: 'aws_s3_bucket',
            name: 'Encrypted S3',
            position: { x: 300, y: 0 },
            config: {
              encryption: { sse_algorithm: 'aws:kms' },
              block_public_access: {
                block_public_acls: true,
                block_public_policy: true,
                ignore_public_acls: true,
                restrict_public_buckets: true,
              },
            },
            metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          ec2_1: {
            id: 'ec2_1',
            type: 'aws_instance',
            name: 'Hardened EC2',
            position: { x: 400, y: 0 },
            config: { http_tokens: 'required' },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          alb1: {
            id: 'alb1',
            type: 'aws_lb',
            name: 'TLS ALB',
            position: { x: 500, y: 0 },
            config: {
              listeners: [{ port: 443, protocol: 'HTTPS' }],
            },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          iam1: {
            id: 'iam1',
            type: 'aws_iam_role',
            name: 'Least Privilege Role',
            position: { x: 600, y: 0 },
            config: {
              inline_policy: {
                policy_document: '{"Statement":[{"Action":["s3:GetObject"],"Resource":"arn:aws:s3:::bucket/*"}]}',
              },
            },
            metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const scan = scanTopologySecurity(state);
      expect(scan.score).toBe(100);
      expect(scan.grade).toBe('A+');
      expect(scan.status).toBe('PASS');
      expect(scan.findings.length).toBe(0);
      expect(scan.passedRules.length).toBe(7);
    });

    test('handles empty topology with 100/100 score and 0 findings', () => {
      const emptyState = createDefaultTopologyState();
      const scan = scanSecurityCompliance(emptyState);
      expect(scan.score).toBe(100);
      expect(scan.findings.length).toBe(0);
    });
  });

  describe('Individual Security Rule Detections & Penalties', () => {
    test('Rule 1: penalizes open SSH/RDP ingress by exactly 25 points (CRITICAL)', () => {
      const state: TopologyState = {
        nodes: {
          sg_ssh: {
            id: 'sg_ssh',
            type: 'aws_security_group',
            name: 'Open SSH SG',
            position: { x: 0, y: 0 },
            config: {
              ingress_rules: [
                { protocol: 'tcp', from_port: 22, to_port: 22, cidr_blocks: ['0.0.0.0/0'] },
              ],
            },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const scan = scanTopologySecurity(state);
      expect(scan.score).toBe(75);
      expect(scan.grade).toBe('B');
      expect(scan.findings[0]?.rule).toBe('CIS-AWS-4.1-NO-UNRESTRICTED-SSH-RDP');
      expect(scan.findings[0]?.severity).toBe('CRITICAL');
      expect(scan.findings[0]?.penalty).toBe(25);
    });

    test('Rule 1: penalizes IPv6 open ingress (::/0) on RDP port 3389', () => {
      const state: TopologyState = {
        nodes: {
          sg_rdp: {
            id: 'sg_rdp',
            type: 'aws_security_group',
            name: 'Open RDP SG',
            position: { x: 0, y: 0 },
            config: {
              ingress_rules: [
                { protocol: 'tcp', from_port: 3389, to_port: 3389, cidr_blocks: ['::/0'] },
              ],
            },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const scan = scanTopologySecurity(state);
      expect(scan.score).toBe(75);
      expect(scan.findings[0]?.penalty).toBe(25);
    });

    test('Rule 2: penalizes public RDS instance by 20 points (CRITICAL)', () => {
      const state: TopologyState = {
        nodes: {
          db_public: {
            id: 'db_public',
            type: 'aws_db_instance',
            name: 'Public DB',
            position: { x: 0, y: 0 },
            config: { publicly_accessible: true },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const scan = scanTopologySecurity(state);
      expect(scan.score).toBe(80);
      expect(scan.grade).toBe('B');
      expect(scan.findings[0]?.rule).toBe('CIS-AWS-2.3.1-NO-PUBLIC-RDS');
      expect(scan.findings[0]?.penalty).toBe(20);
    });

    test('Rule 3 & 4: penalizes unencrypted S3 and missing public access blocks (15 pts each, HIGH)', () => {
      const state: TopologyState = {
        nodes: {
          s3_insecure: {
            id: 's3_insecure',
            type: 'aws_s3_bucket',
            name: 'Insecure S3',
            position: { x: 0, y: 0 },
            config: { bucket_name: 'test-bucket' },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const scan = scanTopologySecurity(state);
      expect(scan.score).toBe(70); // 100 - 15 - 15 = 70
      expect(scan.grade).toBe('B');
      expect(scan.findings.some((f) => f.rule === 'CIS-AWS-2.1.1-S3-ENCRYPTION')).toBe(true);
      expect(scan.findings.some((f) => f.rule === 'CIS-AWS-2.1.2-S3-BLOCK-PUBLIC-ACCESS')).toBe(true);
    });

    test('Rule 5: penalizes wildcard IAM policy by 15 points (HIGH)', () => {
      const state: TopologyState = {
        nodes: {
          iam_wildcard: {
            id: 'iam_wildcard',
            type: 'aws_iam_role',
            name: 'Admin Role',
            position: { x: 0, y: 0 },
            config: {
              inline_policy: {
                policy_document: '{"Statement":[{"Action":"*","Resource":"*"}]}',
              },
            },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const scan = scanTopologySecurity(state);
      expect(scan.score).toBe(85);
      expect(scan.grade).toBe('A');
      expect(scan.findings[0]?.rule).toBe('OWASP-CLOUD-01-WILDCARD-IAM');
      expect(scan.findings[0]?.penalty).toBe(15);
    });

    test('Rule 5: penalizes IAM Role with AdministratorAccess managed policy ARN', () => {
      const state: TopologyState = {
        nodes: {
          iam_admin: {
            id: 'iam_admin',
            type: 'aws_iam_role',
            name: 'Full Admin Role',
            position: { x: 0, y: 0 },
            config: {
              managed_policy_arns: ['arn:aws:iam::aws:policy/AdministratorAccess'],
            },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const scan = scanTopologySecurity(state);
      expect(scan.score).toBe(85);
      expect(scan.findings[0]?.rule).toBe('OWASP-CLOUD-01-WILDCARD-IAM');
    });

    test('Rule 6: penalizes missing IMDSv2 by 10 points (MEDIUM)', () => {
      const state: TopologyState = {
        nodes: {
          ec2_imdsv1: {
            id: 'ec2_imdsv1',
            type: 'aws_instance',
            name: 'EC2 IMDSv1',
            position: { x: 0, y: 0 },
            config: { http_tokens: 'optional' },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const scan = scanTopologySecurity(state);
      expect(scan.score).toBe(90);
      expect(scan.grade).toBe('A');
      expect(scan.findings[0]?.rule).toBe('CIS-AWS-2.1.3-EC2-IMDSV2');
      expect(scan.findings[0]?.penalty).toBe(10);
    });

    test('Rule 7: penalizes ALB without HTTPS listener by 10 points (MEDIUM)', () => {
      const state: TopologyState = {
        nodes: {
          alb_http_only: {
            id: 'alb_http_only',
            type: 'aws_lb',
            name: 'Plain HTTP ALB',
            position: { x: 0, y: 0 },
            config: {
              listeners: [{ port: 80, protocol: 'HTTP' }],
            },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const scan = scanTopologySecurity(state);
      expect(scan.score).toBe(90);
      expect(scan.grade).toBe('A');
      expect(scan.findings[0]?.rule).toBe('CIS-AWS-4.2-ALB-HTTPS-ENFORCEMENT');
      expect(scan.findings[0]?.penalty).toBe(10);
    });
  });

  describe('Composite Violations & Score Clamping', () => {
    test('clamps composite score to minimum 0 on multiple catastrophic violations', () => {
      const state: TopologyState = {
        nodes: {
          sg1: {
            id: 'sg1',
            type: 'aws_security_group',
            name: 'Open SSH',
            position: { x: 0, y: 0 },
            config: { ingress_rules: [{ protocol: 'tcp', from_port: 22, to_port: 22, cidr_blocks: ['0.0.0.0/0'] }] },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          sg2: {
            id: 'sg2',
            type: 'aws_security_group',
            name: 'Open RDP',
            position: { x: 0, y: 0 },
            config: { ingress_rules: [{ protocol: 'tcp', from_port: 3389, to_port: 3389, cidr_blocks: ['0.0.0.0/0'] }] },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          db1: {
            id: 'db1',
            type: 'aws_db_instance',
            name: 'Public DB',
            position: { x: 0, y: 0 },
            config: { publicly_accessible: true },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          s3_1: {
            id: 's3_1',
            type: 'aws_s3_bucket',
            name: 'Insecure S3',
            position: { x: 0, y: 0 },
            config: {},
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          ec2_1: {
            id: 'ec2_1',
            type: 'aws_instance',
            name: 'EC2',
            position: { x: 0, y: 0 },
            config: { http_tokens: 'optional' },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const scan = scanTopologySecurity(state);
      // Total penalties: 25 + 25 + 20 + 30 + 10 = 110 => Clamped to 0
      expect(scan.score).toBe(0);
      expect(scan.grade).toBe('F');
      expect(scan.status).toBe('CRITICAL_FAIL');
    });

    test('supports target node ID filtering to isolate scan scope', () => {
      const state: TopologyState = {
        nodes: {
          sg_bad: {
            id: 'sg_bad',
            type: 'aws_security_group',
            name: 'Open SG',
            position: { x: 0, y: 0 },
            config: { ingress_rules: [{ protocol: 'tcp', from_port: 22, to_port: 22, cidr_blocks: ['0.0.0.0/0'] }] },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          ec2_good: {
            id: 'ec2_good',
            type: 'aws_instance',
            name: 'Clean EC2',
            position: { x: 0, y: 0 },
            config: { http_tokens: 'required' },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const targetScan = scanTopologySecurity(state, ['ec2_good']);
      expect(targetScan.score).toBe(100);
      expect(targetScan.findings.length).toBe(0);
    });
  });

  describe('Auto-Remediation Patch Generation', () => {
    test('generates valid RFC 6902 patches for all detected violations', () => {
      const state: TopologyState = {
        nodes: {
          sg_bad: {
            id: 'sg_bad',
            type: 'aws_security_group',
            name: 'Open SG',
            position: { x: 0, y: 0 },
            config: { ingress_rules: [{ protocol: 'tcp', from_port: 22, to_port: 22, cidr_blocks: ['0.0.0.0/0'] }] },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          s3_bad: {
            id: 's3_bad',
            type: 'aws_s3_bucket',
            name: 'Plain S3',
            position: { x: 0, y: 0 },
            config: {},
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          ec2_bad: {
            id: 'ec2_bad',
            type: 'aws_instance',
            name: 'EC2',
            position: { x: 0, y: 0 },
            config: { http_tokens: 'optional' },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          alb_bad: {
            id: 'alb_bad',
            type: 'aws_lb',
            name: 'HTTP ALB',
            position: { x: 0, y: 0 },
            config: { listeners: [{ port: 80, protocol: 'HTTP' }] },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const patches = generateRemediationPatches(state);
      expect(patches.length).toBeGreaterThan(0);

      // Verify SG patch
      const sgPatch = patches.find((p) => p.path === '/nodes/sg_bad/config/ingress_rules');
      expect(sgPatch).toBeDefined();
      expect(sgPatch?.op).toBe('replace');

      // Verify S3 patches
      const s3EncPatch = patches.find((p) => p.path === '/nodes/s3_bad/config/encryption');
      expect(s3EncPatch).toBeDefined();
      expect(s3EncPatch?.value).toEqual({ sse_algorithm: 'aws:kms', kms_key_id: 'alias/aws/s3' });

      const s3BpaPatch = patches.find((p) => p.path === '/nodes/s3_bad/config/block_public_access');
      expect(s3BpaPatch).toBeDefined();

      // Verify EC2 patch
      const ec2Patch = patches.find((p) => p.path === '/nodes/ec2_bad/config/http_tokens');
      expect(ec2Patch).toBeDefined();
      expect(ec2Patch?.value).toBe('required');

      // Verify ALB patch
      const albPatch = patches.find((p) => p.path === '/nodes/alb_bad/config/listeners');
      expect(albPatch).toBeDefined();
    });
  });

  describe('Least-Privilege IAM Policy Generation', () => {
    test('synthesizes strict least-privilege IAM policy document with condition keys', () => {
      const doc = generateLeastPrivilegePolicyDocument(
        's3_read_write',
        'arn:aws:s3:::prod-customer-data/*',
        ['s3:GetObject', 's3:PutObject'],
        true,
        '1.3'
      );

      expect(doc['Version']).toBe('2012-10-17');
      const statement = (doc['Statement'] as Array<Record<string, unknown>>)[0];
      expect(statement).toBeDefined();
      expect(statement?.['Effect']).toBe('Allow');
      expect(statement?.['Action']).toEqual(['s3:GetObject', 's3:PutObject']);
      expect(statement?.['Resource']).toBe('arn:aws:s3:::prod-customer-data/*');

      const condition = statement?.['Condition'] as Record<string, Record<string, string>>;
      expect(condition?.['Bool']?.['aws:SecureTransport']).toBe('true');
      expect(condition?.['Bool']?.['aws:MultiFactorAuthPresent']).toBe('true');
      expect(condition?.['NumericGreaterThanEquals']?.['s3:TlsVersion']).toBe('1.3');
    });

    test('synthesizes DynamoDB CRUD policy with defaults when actions are omitted', () => {
      const doc = generateLeastPrivilegePolicyDocument(
        'dynamodb_crud',
        'arn:aws:dynamodb:us-east-1:123456789012:table/Orders'
      );

      const statement = (doc['Statement'] as Array<Record<string, unknown>>)[0];
      expect(statement?.['Action']).toContain('dynamodb:GetItem');
      expect(statement?.['Action']).toContain('dynamodb:PutItem');
      expect(statement?.['Action']).toContain('dynamodb:UpdateItem');
      expect(statement?.['Action']).toContain('dynamodb:DeleteItem');
    });
  });

  describe('SecurityScanner Class Instance API', () => {
    test('class instance provides full scan and remediation methods', () => {
      const scanner = new SecurityScanner();
      const state = createDefaultTopologyState();
      expect(scanner.scan(state).score).toBe(100);
      expect(securityScanner.scanSecurityCompliance(state).score).toBe(100);
    });
  });
});
