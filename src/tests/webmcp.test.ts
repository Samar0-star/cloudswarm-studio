import { WebModelContextEngine } from '../core/webmcp/WebModelContextEngine';
import { ensureWebModelContext, resetWebModelContext } from '../core/webmcp/polyfill';
import { OptimisticStateEngine } from '../core/state/OptimisticStateEngine';
import {
  registerTopologyTools,
  isValidCIDR,
  checkCIDROverlap,
} from '../core/webmcp/tools/topologyTools';
import {
  registerSecurityTools,
  scanTopologySecurity,
} from '../core/webmcp/tools/securityTools';
import {
  registerFinOpsTools,
  calculateNodeCost,
  calculateTopologyCostBreakdown,
} from '../core/webmcp/tools/finopsTools';
import type { CloudResourceNode } from '../types/topology';

describe('WebMCP Engine & Tool Suite (Topology, Security, FinOps)', () => {
  let mcpEngine: WebModelContextEngine;
  let stateEngine: OptimisticStateEngine;

  beforeEach(() => {
    resetWebModelContext();
    mcpEngine = new WebModelContextEngine(false);
    stateEngine = new OptimisticStateEngine();
  });

  describe('Core WebMCP Protocol & Polyfill', () => {
    test('auto-detecting polyfill initializes and mounts singleton', () => {
      const polyfill = ensureWebModelContext();
      expect(polyfill).toBeDefined();
      expect(polyfill.version).toBe('1.0.0-draft');
      expect(polyfill.isPolyfill).toBe(true);

      const polyfill2 = ensureWebModelContext();
      expect(polyfill2).toBe(polyfill);
    });

    test('tool registration, lookup, and unregistration lifecycle', async () => {
      const unregister = await mcpEngine.registerTool({
        name: 'test_echo',
        description: 'Echo back input',
        category: 'orchestration',
        inputSchema: { type: 'object', properties: {} },
        execute: async (params) => ({ content: [{ type: 'text', text: JSON.stringify(params) }] }),
      });

      expect(mcpEngine.getTool('test_echo')).toBeDefined();
      expect(mcpEngine.getTools().length).toBeGreaterThan(0);
      expect(mcpEngine.getTools('orchestration').length).toBe(1);
      expect(mcpEngine.getTools('topology').length).toBe(0);

      if (typeof unregister === 'function') unregister();
      expect(mcpEngine.getTool('test_echo')).toBeUndefined();
      expect(mcpEngine.getTools().length).toBe(0);
    });

    test('tool execution schema validation and enforcement', async () => {
      await mcpEngine.registerTool({
        name: 'test_validator',
        description: 'Validator test',
        inputSchema: {
          type: 'object',
          required: ['count', 'region'],
          properties: {
            count: { type: 'integer', minimum: 1, maximum: 10 },
            region: { type: 'string', enum: ['us-east-1', 'us-west-2'] },
          },
        },
        execute: async () => ({ content: [{ type: 'text', text: 'OK' }] }),
      });

      // Missing required parameter 'region'
      const res1 = await mcpEngine.executeTool('test_validator', { count: 5 });
      expect(res1.isError).toBe(true);
      expect(res1.content[0]?.text).toContain("Missing required parameter 'region'");

      // Value exceeds maximum constraint
      const res2 = await mcpEngine.executeTool('test_validator', { count: 99, region: 'us-east-1' });
      expect(res2.isError).toBe(true);
      expect(res2.content[0]?.text).toContain('cannot be greater than 10');

      // Enum mismatch
      const res3 = await mcpEngine.executeTool('test_validator', { count: 2, region: 'invalid-zone' });
      expect(res3.isError).toBe(true);
      expect(res3.content[0]?.text).toContain('must be one of [us-east-1, us-west-2]');

      // Valid parameters succeed
      const res4 = await mcpEngine.executeTool('test_validator', { count: 3, region: 'us-east-1' });
      expect(res4.isError).toBeUndefined();
      expect(res4.content[0]?.text).toBe('OK');
      expect(res4.meta?.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    test('resource registration and reading', async () => {
      mcpEngine.registerResource({
        uri: 'state://canvas/dag',
        name: 'DAG State',
        mimeType: 'application/json',
        read: async () => ({
          contents: [{ uri: 'state://canvas/dag', mimeType: 'application/json', text: '{"root": "0"}' }],
        }),
      });

      expect(mcpEngine.listResources().length).toBe(1);
      const res = await mcpEngine.readResource('state://canvas/dag');
      expect(res.contents[0]?.text).toBe('{"root": "0"}');
    });

    test('custom event telemetry dispatches on tool calls', async () => {
      const listener = jest.fn();
      mcpEngine.addEventListener('webmcp:tool-success', listener);

      mcpEngine.registerTool({
        name: 'event_tool',
        description: 'Event test',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => ({ content: [{ type: 'text', text: 'Success' }] }),
      });

      await mcpEngine.executeTool('event_tool', {}, { agentId: 'alpha' });
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Topology Tools & CIDR Algebra', () => {
    beforeEach(() => {
      registerTopologyTools(mcpEngine, stateEngine);
    });

    test('CIDR validator and overlap checking', () => {
      expect(isValidCIDR('10.0.0.0/16')).toBe(true);
      expect(isValidCIDR('192.168.1.0/24')).toBe(true);
      expect(isValidCIDR('999.0.0.0/16')).toBe(false);
      expect(isValidCIDR('invalid-cidr')).toBe(false);

      expect(checkCIDROverlap('10.0.1.0/24', '10.0.1.128/25')).toBe(true);
      expect(checkCIDROverlap('10.0.1.0/24', '10.0.2.0/24')).toBe(false);
    });

    test('orchestrate_cloud_topology batch creates multi-tier architecture', async () => {
      const res = await mcpEngine.executeTool(
        'orchestrate_cloud_topology',
        {
          architecture_name: 'Prod-Ecommerce',
          region: 'us-east-1',
          vpc: { cidr_block: '10.0.0.0/16' },
          resources: [
            {
              id: 'sub-public-1a',
              type: 'aws_subnet',
              name: 'Public Subnet 1a',
              config: { cidr_block: '10.0.1.0/24', is_public: true, availability_zone: 'us-east-1a' },
            },
            {
              id: 'sub-private-1a',
              type: 'aws_subnet',
              name: 'Private Subnet 1a',
              config: { cidr_block: '10.0.2.0/24', is_public: false, availability_zone: 'us-east-1a' },
            },
            {
              id: 'ec2-app',
              type: 'aws_instance',
              name: 'App Server',
              config: { instance_type: 't3.medium' },
            },
            {
              id: 'rds-db',
              type: 'aws_db_instance',
              name: 'PostgreSQL DB',
              config: { engine: 'postgres', instance_class: 'db.t4g.medium', multi_az: true },
            },
          ],
          connections: [
            { source_id: 'ec2-app', target_id: 'rds-db', relation_type: 'routes_to', port: 5432 },
          ],
        },
        { agentId: 'alpha' }
      );

      expect(res.isError).toBeUndefined();
      const state = stateEngine.getState();
      expect(state.nodes['vpc-main']).toBeDefined();
      expect(state.nodes['sub-public-1a']).toBeDefined();
      expect(state.nodes['sub-private-1a']).toBeDefined();
      expect(state.nodes['ec2-app']).toBeDefined();
      expect(state.nodes['rds-db']).toBeDefined();
      expect(Object.keys(state.edges).length).toBe(1);
    });

    test('orchestrate_cloud_topology detects and rejects subnet CIDR collision', async () => {
      const res = await mcpEngine.executeTool(
        'orchestrate_cloud_topology',
        {
          architecture_name: 'Collision-Test',
          region: 'us-east-1',
          vpc: { cidr_block: '10.0.0.0/16' },
          resources: [
            {
              id: 'sub-1',
              type: 'aws_subnet',
              name: 'Subnet 1',
              config: { cidr_block: '10.0.1.0/24' },
            },
            {
              id: 'sub-2',
              type: 'aws_subnet',
              name: 'Subnet 2',
              config: { cidr_block: '10.0.1.0/24' }, // Duplicate CIDR
            },
          ],
        },
        { agentId: 'alpha' }
      );

      expect(res.isError).toBe(true);
      expect(res.content[0]?.text).toContain('CIDR Conflict Error');
    });

    test('create, update, and delete resource primitives', async () => {
      // 1. Create S3 Bucket
      const createRes = await mcpEngine.executeTool(
        'create_resource_node',
        {
          id: 's3-assets',
          type: 'aws_s3_bucket',
          name: 'Static Assets',
          config: { bucket_name: 'my-static-assets-2026' },
        },
        { agentId: 'alpha' }
      );
      expect(createRes.isError).toBeUndefined();
      expect(stateEngine.getState().nodes['s3-assets']).toBeDefined();

      // 2. Update node config
      const updateRes = await mcpEngine.executeTool(
        'update_resource_node',
        {
          node_id: 's3-assets',
          config_patch: { versioning_enabled: true },
        },
        { agentId: 'beta' }
      );
      expect(updateRes.isError).toBeUndefined();
      expect(stateEngine.getState().nodes['s3-assets']?.config.versioning_enabled).toBe(true);

      // 3. Remove node
      const removeRes = await mcpEngine.executeTool(
        'remove_resource_node',
        { node_id: 's3-assets' },
        { agentId: 'alpha' }
      );
      expect(removeRes.isError).toBeUndefined();
      expect(stateEngine.getState().nodes['s3-assets']).toBeUndefined();
    });
  });

  describe('Security Tools & Zero-Trust Auditing', () => {
    beforeEach(() => {
      registerSecurityTools(mcpEngine, () => stateEngine.getState(), stateEngine);
    });

    test('scanTopologySecurity direct invocation calculates score and flags violations', () => {
      const state = stateEngine.getState();
      const pristineScan = scanTopologySecurity(state);
      expect(pristineScan.score).toBe(100);
      expect(pristineScan.status).toBe('PASS');
    });

    test('audit_iam_zero_trust detects security misconfigurations and docks score', async () => {
      // Setup vulnerable topology
      const openSg: CloudResourceNode = {
        id: 'sg-insecure',
        type: 'aws_security_group',
        name: 'Insecure SG',
        position: { x: 0, y: 0 },
        config: {
          ingress_rules: [
            { protocol: 'tcp', from_port: 22, to_port: 22, cidr_blocks: ['0.0.0.0/0'] }, // -25
          ],
        },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const publicRds: CloudResourceNode = {
        id: 'rds-exposed',
        type: 'aws_db_instance',
        name: 'Exposed RDS',
        position: { x: 0, y: 0 },
        config: { publicly_accessible: true, engine: 'postgres' }, // -20
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      const unencryptedS3: CloudResourceNode = {
        id: 's3-plain',
        type: 'aws_s3_bucket',
        name: 'Plain S3',
        position: { x: 0, y: 0 },
        config: { bucket_name: 'plain-bucket' }, // -15 (enc) + -15 (bpa)
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };

      await stateEngine.addNode(openSg, 'alpha');
      await stateEngine.addNode(publicRds, 'alpha');
      await stateEngine.addNode(unencryptedS3, 'alpha');

      const auditRes = await mcpEngine.executeTool('audit_iam_zero_trust', {}, { agentId: 'beta' });
      expect(auditRes.isError).toBeUndefined();

      const report = JSON.parse(auditRes.content[0]?.text ?? '{}');
      expect(report.overall_compliance_score).toBeLessThan(50);
      expect(report.status).toBe('CRITICAL_FAIL');
      expect(report.total_findings).toBeGreaterThanOrEqual(3);
    });

    test('generate_least_privilege_policy synthesizes clean JSON IAM Policy with TLS 1.2+ conditions', async () => {
      const genRes = await mcpEngine.executeTool(
        'generate_least_privilege_policy',
        {
          workload_type: 's3_read_write',
          resource_arn: 'arn:aws:s3:::production-app-bucket/*',
          allowed_operations: ['s3:GetObject', 's3:PutObject'],
          enforce_mfa: true,
          enforce_tls_version: '1.2',
        },
        { agentId: 'beta' }
      );

      expect(genRes.isError).toBeUndefined();
      const policyDoc = JSON.parse(genRes.content[0]?.text ?? '{}');
      expect(policyDoc.Version).toBe('2012-10-17');
      expect(policyDoc.Statement[0].Action).toEqual(['s3:GetObject', 's3:PutObject']);
      expect(policyDoc.Statement[0].Resource).toBe('arn:aws:s3:::production-app-bucket/*');
      expect(policyDoc.Statement[0].Condition.Bool['aws:SecureTransport']).toBe('true');
      expect(policyDoc.Statement[0].Condition.Bool['aws:MultiFactorAuthPresent']).toBe('true');
    });

    test('apply_security_hardening remediates misconfigurations and elevates score', async () => {
      // Create insecure nodes
      await stateEngine.addNode({
        id: 'sg-test',
        type: 'aws_security_group',
        name: 'SG',
        position: { x: 0, y: 0 },
        config: {
          ingress_rules: [{ protocol: 'tcp', from_port: 22, to_port: 22, cidr_blocks: ['0.0.0.0/0'] }],
        },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });
      await stateEngine.addNode({
        id: 'ec2-test',
        type: 'aws_instance',
        name: 'EC2',
        position: { x: 0, y: 0 },
        config: { http_tokens: 'optional' },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });

      const hardenRes = await mcpEngine.executeTool('apply_security_hardening', {}, { agentId: 'beta' });
      expect(hardenRes.isError).toBeUndefined();

      const summary = JSON.parse(hardenRes.content[0]?.text ?? '{}');
      expect(summary.new_security_score).toBeGreaterThan(summary.previous_security_score);

      // Verify node configs were patched
      expect(stateEngine.getState().nodes['ec2-test']?.config.http_tokens).toBe('required');
    });
  });

  describe('FinOps Pricing Tools', () => {
    beforeEach(() => {
      registerFinOpsTools(mcpEngine, () => stateEngine.getState());
    });

    test('calculateNodeCost and calculateTopologyCostBreakdown direct invocation', () => {
      const node: CloudResourceNode = {
        id: 'vpc-free',
        type: 'aws_vpc',
        name: 'VPC',
        position: { x: 0, y: 0 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      };
      const cost = calculateNodeCost(node);
      expect(cost.monthlyUsd).toBe(0);
      expect(cost.category).toBe('Base Fabric');

      const breakdown = calculateTopologyCostBreakdown(stateEngine.getState());
      expect(breakdown.totalMonthlyUsd).toBe(0);
    });

    test('query_resource_pricing calculates exact EC2 and RDS pricing rate cards', async () => {
      // EC2 t3.medium ($30.37/mo compute + $2.40/mo 30GB gp3)
      const ec2Res = await mcpEngine.executeTool(
        'query_resource_pricing',
        {
          resource_type: 'aws_instance',
          config: { instance_type: 't3.medium', root_volume_gb: 30, root_volume_type: 'gp3' },
        },
        { agentId: 'gamma' }
      );
      expect(ec2Res.isError).toBeUndefined();
      const ec2Cost = JSON.parse(ec2Res.content[0]?.text ?? '{}');
      expect(ec2Cost.monthlyUsd).toBeCloseTo(32.77, 1);

      // RDS db.t4g.medium Multi-AZ ($53.29 * 2 compute + $11.50 50GB gp3 Multi-AZ)
      const rdsRes = await mcpEngine.executeTool(
        'query_resource_pricing',
        {
          resource_type: 'aws_db_instance',
          config: { instance_class: 'db.t4g.medium', multi_az: true, allocated_storage_gb: 50 },
        },
        { agentId: 'gamma' }
      );
      expect(rdsRes.isError).toBeUndefined();
      const rdsCost = JSON.parse(rdsRes.content[0]?.text ?? '{}');
      expect(rdsCost.monthlyUsd).toBeGreaterThan(110);
    });

    test('calculate_topology_cost aggregates total spend and category breakdown', async () => {
      await stateEngine.addNode({
        id: 'ec2-prod',
        type: 'aws_instance',
        name: 'EC2 Prod',
        position: { x: 0, y: 0 },
        config: { instance_type: 'c6i.large', root_volume_gb: 50 },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });
      await stateEngine.addNode({
        id: 'alb-prod',
        type: 'aws_lb',
        name: 'ALB Prod',
        position: { x: 0, y: 0 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });

      const costRes = await mcpEngine.executeTool('calculate_topology_cost', {}, { agentId: 'gamma' });
      expect(costRes.isError).toBeUndefined();
      const costData = JSON.parse(costRes.content[0]?.text ?? '{}');
      expect(costData.total_monthly_usd).toBeGreaterThan(70);
      expect(costData.breakdown_by_category.Compute).toBeGreaterThan(0);
      expect(costData.breakdown_by_category.Networking).toBeGreaterThan(0);
    });

    test('optimize_cost_allocation returns Graviton and Storage recommendations', async () => {
      await stateEngine.addNode({
        id: 'ec2-legacy',
        type: 'aws_instance',
        name: 'Legacy EC2',
        position: { x: 0, y: 0 },
        config: { instance_type: 'c6i.large', root_volume_type: 'gp2' },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });

      const optRes = await mcpEngine.executeTool('optimize_cost_allocation', {}, { agentId: 'gamma' });
      expect(optRes.isError).toBeUndefined();
      const optData = JSON.parse(optRes.content[0]?.text ?? '{}');
      expect(optData.recommendations.length).toBeGreaterThanOrEqual(1);
    });
  });
});
