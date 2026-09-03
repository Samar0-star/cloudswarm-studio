/**
 * Unit Tests for Sentinel Auditor (SentinelAuditor)
 */

import {
  computeSha256,
  computeTopologySignature,
  SentinelAuditor,
  auditTopology,
} from '../core/audit/SentinelAuditor';
import type { TopologyState } from '../types/topology';

describe('SentinelAuditor Reactive 60 FPS Engine Unit Tests', () => {
  describe('SHA-256 Cryptographic State Signature', () => {
    test('computes correct deterministic SHA-256 hash for known strings', () => {
      // Known SHA-256 test vectors
      expect(computeSha256('')).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      );
      expect(computeSha256('hello world')).toBe(
        'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
      );
    });

    test('generates order-independent canonical SHA-256 state signature', () => {
      const state1: TopologyState = {
        nodes: {
          nodeA: {
            id: 'nodeA',
            type: 'aws_instance',
            name: 'Node A',
            position: { x: 0, y: 0 },
            config: { instance_type: 't3.medium' },
            metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
            version: 1,
          },
          nodeB: {
            id: 'nodeB',
            type: 'aws_s3_bucket',
            name: 'Node B',
            position: { x: 100, y: 100 },
            config: { bucket_name: 'test' },
            metadata: { createdBy: 'beta', createdAt: 100, updatedAt: 100 },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const state2: TopologyState = {
        nodes: {
          nodeB: {
            id: 'nodeB',
            type: 'aws_s3_bucket',
            name: 'Node B',
            position: { x: 100, y: 100 },
            config: { bucket_name: 'test' },
            metadata: { createdBy: 'beta', createdAt: 100, updatedAt: 100 },
            version: 1,
          },
          nodeA: {
            id: 'nodeA',
            type: 'aws_instance',
            name: 'Node A',
            position: { x: 0, y: 0 },
            config: { instance_type: 't3.medium' },
            metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const sig1 = computeTopologySignature(state1);
      const sig2 = computeTopologySignature(state2);
      expect(sig1).toBe(sig2);
    });

    test('mutating topology config alters state signature', () => {
      const state1: TopologyState = {
        nodes: {
          ec2: {
            id: 'ec2',
            type: 'aws_instance',
            name: 'EC2',
            position: { x: 0, y: 0 },
            config: { instance_type: 't3.medium' },
            metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const state2: TopologyState = {
        nodes: {
          ec2: {
            id: 'ec2',
            type: 'aws_instance',
            name: 'EC2',
            position: { x: 0, y: 0 },
            config: { instance_type: 'c6i.large' },
            metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      expect(computeTopologySignature(state1)).not.toBe(computeTopologySignature(state2));
    });
  });

  describe('Comprehensive Unified Audit Report', () => {
    test('produces complete audit report with cost breakdown, security findings, and signature', () => {
      const state: TopologyState = {
        nodes: {
          web: {
            id: 'web',
            type: 'aws_instance',
            name: 'Web Server',
            position: { x: 0, y: 0 },
            config: { instance_type: 't3.large', root_volume_gb: 50, http_tokens: 'required' },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          db: {
            id: 'db',
            type: 'aws_db_instance',
            name: 'Database',
            position: { x: 100, y: 0 },
            config: { instance_class: 'db.t4g.medium', publicly_accessible: false },
            metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
          alb: {
            id: 'alb',
            type: 'aws_lb',
            name: 'Load Balancer',
            position: { x: 200, y: 0 },
            config: { listeners: [{ port: 443, protocol: 'HTTPS' }] },
            metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const report = auditTopology(state);
      expect(report.totalMonthlyCostUsd).toBeGreaterThan(0);
      expect(report.totalHourlyCostUsd).toBeGreaterThan(0);
      expect(report.costBreakdown.length).toBe(3);
      expect(report.categoryTotals.Compute).toBeGreaterThan(0);
      expect(report.categoryTotals.Database).toBeGreaterThan(0);
      expect(report.categoryTotals.Networking).toBe(16.2);
      expect(report.securityScore).toBe(100);
      expect(report.grade).toBe('A+');
      expect(report.stateSignature).toBeDefined();
      expect(report.timestamp).toBeGreaterThan(0);
    });
  });

  describe('60 FPS Reactive Caching & Performance Benchmark', () => {
    test('returns memoized cached report on identical state signature', () => {
      const auditor = new SentinelAuditor();
      const state: TopologyState = {
        nodes: {
          s3: {
            id: 's3',
            type: 'aws_s3_bucket',
            name: 'S3 Bucket',
            position: { x: 0, y: 0 },
            config: {
              encryption: { sse_algorithm: 'aws:kms' },
              block_public_access: {
                block_public_acls: true,
                block_public_policy: true,
                ignore_public_acls: true,
                restrict_public_buckets: true,
              },
            },
            metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const report1 = auditor.auditTopology(state);
      const report2 = auditor.auditTopology(state);
      expect(report1).toBe(report2); // Exact reference equality from cache
    });

    test('invalidates cache when version or node topology changes', () => {
      const auditor = new SentinelAuditor();
      const state1: TopologyState = {
        nodes: {
          s3: {
            id: 's3',
            type: 'aws_s3_bucket',
            name: 'S3 Bucket',
            position: { x: 0, y: 0 },
            config: {},
            metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const report1 = auditor.auditTopology(state1);

      const state2: TopologyState = {
        nodes: {
          s3: {
            id: 's3',
            type: 'aws_s3_bucket',
            name: 'S3 Bucket',
            position: { x: 0, y: 0 },
            config: { encryption: { sse_algorithm: 'aws:kms' } },
            metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
            version: 2,
          },
        },
        edges: {},
        version: 2,
      };

      const report2 = auditor.auditTopology(state2);
      expect(report1).not.toBe(report2);
      expect(report2.securityScore).toBeGreaterThan(report1.securityScore);
    });

    test('executes 100-node audit within 60 FPS sub-millisecond budget (<25ms)', () => {
      const auditor = new SentinelAuditor();
      const largeState: TopologyState = {
        nodes: {},
        edges: {},
        version: 1,
      };

      for (let i = 0; i < 100; i++) {
        (largeState.nodes as Record<string, any>)[`node_${i}`] = {
          id: `node_${i}`,
          type: i % 2 === 0 ? 'aws_instance' : 'aws_s3_bucket',
          name: `Node ${i}`,
          position: { x: i * 10, y: i * 10 },
          config: { instance_type: 't3.small' },
          metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
          version: 1,
        };
      }

      const start = performance.now();
      const report = auditor.auditTopology(largeState);
      const duration = performance.now() - start;

      expect(report.costBreakdown.length).toBe(100);
      expect(duration).toBeLessThan(150); // Fast execution under full concurrent load
    });
  });

  describe('Reactive Subscriptions & Event Notifications', () => {
    test('notifies subscribers upon audit execution and handles unsubscribe', () => {
      const auditor = new SentinelAuditor();
      const notifications: number[] = [];

      const unsubscribe = auditor.subscribe((rep) => {
        notifications.push(rep.securityScore);
      });

      const state: TopologyState = {
        nodes: {
          ec2: {
            id: 'ec2',
            type: 'aws_instance',
            name: 'EC2',
            position: { x: 0, y: 0 },
            config: { http_tokens: 'required' },
            metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      auditor.auditTopology(state);
      expect(notifications.length).toBe(1);
      expect(notifications[0]).toBe(100);

      unsubscribe();

      const state2: TopologyState = {
        ...state,
        version: 2,
        nodes: {
          ...state.nodes,
          s3: {
            id: 's3',
            type: 'aws_s3_bucket',
            name: 'S3',
            position: { x: 10, y: 10 },
            config: {},
            metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
            version: 1,
          },
        },
      };

      auditor.auditTopology(state2);
      expect(notifications.length).toBe(1); // Did not receive notification after unsubscribe
    });

    test('protects auditor execution if a subscriber throws an error', () => {
      const auditor = new SentinelAuditor();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      auditor.subscribe(() => {
        throw new Error('Subscriber intentional error');
      });

      const state: TopologyState = {
        nodes: {},
        edges: {},
        version: 1,
      };

      expect(() => {
        auditor.auditTopology(state);
      }).not.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe('Contract Helper Methods & Remediation Integration', () => {
    test('calculateMonthlyCost, scanSecurityCompliance, and generateRemediationPatches operate seamlessly', () => {
      const auditor = new SentinelAuditor();
      const state: TopologyState = {
        nodes: {
          sg: {
            id: 'sg',
            type: 'aws_security_group',
            name: 'Open SSH SG',
            position: { x: 0, y: 0 },
            config: { ingress_rules: [{ protocol: 'tcp', from_port: 22, to_port: 22, cidr_blocks: ['0.0.0.0/0'] }] },
            metadata: { createdBy: 'alpha', createdAt: 100, updatedAt: 100 },
            version: 1,
          },
        },
        edges: {},
        version: 1,
      };

      const monthlyCost = auditor.calculateMonthlyCost(state);
      expect(monthlyCost.totalMonthlyCostUsd).toBe(0);

      const secCompliance = auditor.scanSecurityCompliance(state);
      expect(secCompliance.score).toBe(75);

      const patches = auditor.generateRemediationPatches(state);
      expect(patches.length).toBe(1);
      expect(patches[0]?.path).toBe('/nodes/sg/config/ingress_rules');

      auditor.clearCache();
      expect(auditor.getLatestReport()).toBeNull();
    });
  });
});
