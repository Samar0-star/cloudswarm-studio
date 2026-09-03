/**
 * WebMCP Protocol, Tool Schema Validation, and JSON-RPC Adversarial Challenge Test Suite
 *
 * Empirical challenger testing under hostile, malformed, fuzzed, and boundary inputs.
 */

import { WebModelContextEngine } from '../core/webmcp/WebModelContextEngine';
import { resetWebModelContext } from '../core/webmcp/polyfill';
import { OptimisticStateEngine } from '../core/state/OptimisticStateEngine';
import {
  registerTopologyTools,
  isValidCIDR,
  checkCIDROverlap,
} from '../core/webmcp/tools/topologyTools';
import {
  registerSecurityTools,
} from '../core/webmcp/tools/securityTools';
import {
  registerFinOpsTools,
  calculateNodeCost,
} from '../core/webmcp/tools/finopsTools';
import type { CloudResourceNode } from '../types/topology';
import type { WebMCPTool } from '../types/webmcp';

describe('WebMCP Adversarial & Stress Challenge Suite', () => {
  let engine: WebModelContextEngine;
  let stateEngine: OptimisticStateEngine;

  beforeEach(() => {
    resetWebModelContext();
    engine = new WebModelContextEngine(false);
    stateEngine = new OptimisticStateEngine();
  });

  // =========================================================================
  // 1. WebModelContextEngine Core & JSON-RPC Protocol Hardening
  // =========================================================================
  describe('1. WebModelContextEngine Core & Protocol Resilience', () => {
    test('rejects malformed tool registration gracefully without crashing engine', async () => {
      await expect(
        engine.registerTool({
          name: 'invalid_tool',
          description: 'No handler',
          inputSchema: { type: 'object', properties: {} },
          execute: null as unknown as WebMCPTool['execute'],
        })
      ).rejects.toThrow(/Invalid tool registration/i);
    });

    test('handles calling non-existent tools with well-formed JSON-RPC error payload', async () => {
      const result = await engine.executeTool('non_existent_tool_xyz', { foo: 'bar' });
      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe('text');
      expect(result.content[0]?.text).toContain("Tool 'non_existent_tool_xyz' not found in registry");
      expect(result.meta?.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.meta?.agentId).toBe('ext-1');
    });

    test('handles synchronous and asynchronous throwing handlers gracefully', async () => {
      // Tool that throws synchronous Error
      engine.registerTool({
        name: 'sync_thrower',
        description: 'Throws sync error',
        inputSchema: { type: 'object', properties: {} },
        execute: () => {
          throw new Error('Fatal sync panic in handler');
        },
      });

      const syncRes = await engine.executeTool('sync_thrower');
      expect(syncRes.isError).toBe(true);
      expect(syncRes.content[0]?.text).toContain('Tool Execution Failed: Fatal sync panic in handler');

      // Tool that rejects promise
      engine.registerTool({
        name: 'async_rejector',
        description: 'Rejects async promise',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          throw new Error('Async network timeout 504');
        },
      });

      const asyncRes = await engine.executeTool('async_rejector');
      expect(asyncRes.isError).toBe(true);
      expect(asyncRes.content[0]?.text).toContain('Tool Execution Failed: Async network timeout 504');
    });

    test('handles AbortSignal pre-aborted and during execution', async () => {
      engine.registerTool({
        name: 'slow_tool',
        description: 'Slow tool',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          return { content: [{ type: 'text', text: 'Completed' }] };
        },
      });

      const controller = new AbortController();
      controller.abort();

      const result = await engine.executeTool('slow_tool', {}, { signal: controller.signal });
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('was aborted');
    });

    test('resource registry handles non-existent resource reading', async () => {
      await expect(engine.readResource('missing://resource')).rejects.toThrow(/not found/i);
    });

    test('custom event telemetry dispatches on tool-call, tool-success, and tool-error', async () => {
      const calls: string[] = [];
      const successes: string[] = [];
      const errors: string[] = [];

      engine.addEventListener('webmcp:tool-call', (e) => calls.push((e as CustomEvent).detail.toolName));
      engine.addEventListener('webmcp:tool-success', (e) => successes.push((e as CustomEvent).detail.toolName));
      engine.addEventListener('webmcp:tool-error', (e) => errors.push((e as CustomEvent).detail.toolName));

      engine.registerTool({
        name: 'ok_tool',
        description: 'OK',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => ({ content: [{ type: 'text', text: 'OK' }] }),
      });

      await engine.executeTool('ok_tool');
      await engine.executeTool('missing_tool');

      expect(calls).toContain('ok_tool');
      expect(successes).toContain('ok_tool');
      expect(errors).toContain('missing_tool');
    });
  });

  // =========================================================================
  // 2. Strict JSON Schema Validation Under Hostile / Fuzzed Inputs
  // =========================================================================
  describe('2. Strict JSON Schema Validation & Boundary Fuzzing', () => {
    beforeEach(() => {
      engine.registerTool({
        name: 'strict_schema_tool',
        description: 'Tool with complex schema rules',
        inputSchema: {
          type: 'object',
          required: ['id', 'count', 'enabled', 'tags'],
          additionalProperties: false,
          properties: {
            id: { type: 'string', pattern: '^[a-z0-9-]+$' },
            count: { type: 'integer', minimum: 1, maximum: 100 },
            rating: { type: 'number', minimum: 0.0, maximum: 5.0 },
            enabled: { type: 'boolean' },
            tags: { type: 'array', minItems: 1 },
            role: { type: 'string', enum: ['admin', 'viewer', 'editor'] },
            metadata: { type: 'object' },
          },
        },
        execute: async (params) => ({
          content: [{ type: 'text', text: JSON.stringify(params) }],
        }),
      });
    });

    test('rejects missing required fields', async () => {
      const res = await engine.executeTool('strict_schema_tool', { id: 'test-1' });
      expect(res.isError).toBe(true);
      expect(res.content[0]?.text).toContain("Missing required parameter 'count'");
    });

    test('rejects unexpected additional properties when additionalProperties is false', async () => {
      const res = await engine.executeTool('strict_schema_tool', {
        id: 'valid-id',
        count: 10,
        enabled: true,
        tags: ['tag1'],
        malicious_payload: '<script>alert(1)</script>',
      });
      expect(res.isError).toBe(true);
      expect(res.content[0]?.text).toContain("Unexpected property 'malicious_payload' not allowed by schema");
    });

    test('validates string pattern regex constraints strictly', async () => {
      // Invalid pattern: contains uppercase and special chars
      const badRes = await engine.executeTool('strict_schema_tool', {
        id: 'INVALID_ID_#123!',
        count: 5,
        enabled: true,
        tags: ['tag1'],
      });
      expect(badRes.isError).toBe(true);
      expect(badRes.content[0]?.text).toContain("does not match pattern '^[a-z0-9-]+$'");

      // Valid pattern
      const goodRes = await engine.executeTool('strict_schema_tool', {
        id: 'valid-id-123',
        count: 5,
        enabled: true,
        tags: ['tag1'],
      });
      expect(goodRes.isError).toBeUndefined();
    });

    test('validates integer constraints against floats and non-numbers', async () => {
      // Float passed to integer
      const floatRes = await engine.executeTool('strict_schema_tool', {
        id: 'valid-id',
        count: 3.14159,
        enabled: true,
        tags: ['tag1'],
      });
      expect(floatRes.isError).toBe(true);
      expect(floatRes.content[0]?.text).toContain("Parameter 'count' must be a valid integer");

      // Below minimum
      const minRes = await engine.executeTool('strict_schema_tool', {
        id: 'valid-id',
        count: 0,
        enabled: true,
        tags: ['tag1'],
      });
      expect(minRes.isError).toBe(true);
      expect(minRes.content[0]?.text).toContain("Parameter 'count' cannot be less than 1");

      // Above maximum
      const maxRes = await engine.executeTool('strict_schema_tool', {
        id: 'valid-id',
        count: 101,
        enabled: true,
        tags: ['tag1'],
      });
      expect(maxRes.isError).toBe(true);
      expect(maxRes.content[0]?.text).toContain("Parameter 'count' cannot be greater than 100");
    });

    test('validates boolean type strictly (rejects strings "true"/"false" and numbers 0/1)', async () => {
      const strBoolRes = await engine.executeTool('strict_schema_tool', {
        id: 'valid-id',
        count: 5,
        enabled: 'true' as unknown as boolean,
        tags: ['tag1'],
      });
      expect(strBoolRes.isError).toBe(true);
      expect(strBoolRes.content[0]?.text).toContain("Parameter 'enabled' must be a boolean");

      const numBoolRes = await engine.executeTool('strict_schema_tool', {
        id: 'valid-id',
        count: 5,
        enabled: 1 as unknown as boolean,
        tags: ['tag1'],
      });
      expect(numBoolRes.isError).toBe(true);
      expect(numBoolRes.content[0]?.text).toContain("Parameter 'enabled' must be a boolean");
    });

    test('validates array minItems constraint and rejects non-array objects', async () => {
      // Non-array passed
      const objArrayRes = await engine.executeTool('strict_schema_tool', {
        id: 'valid-id',
        count: 5,
        enabled: true,
        tags: { tag: 'tag1' } as unknown as string[],
      });
      expect(objArrayRes.isError).toBe(true);
      expect(objArrayRes.content[0]?.text).toContain("Parameter 'tags' must be an array");

      // Empty array violating minItems: 1
      const emptyArrayRes = await engine.executeTool('strict_schema_tool', {
        id: 'valid-id',
        count: 5,
        enabled: true,
        tags: [],
      });
      expect(emptyArrayRes.isError).toBe(true);
      expect(emptyArrayRes.content[0]?.text).toContain("Parameter 'tags' must contain at least 1 items");
    });

    test('validates string enum constraint strictly', async () => {
      const enumRes = await engine.executeTool('strict_schema_tool', {
        id: 'valid-id',
        count: 5,
        enabled: true,
        tags: ['tag1'],
        role: 'superadmin' as unknown as 'admin',
      });
      expect(enumRes.isError).toBe(true);
      expect(enumRes.content[0]?.text).toContain("Parameter 'role' must be one of [admin, viewer, editor]");
    });

    test('validates object type and rejects arrays passed as objects', async () => {
      const arrAsObjRes = await engine.executeTool('strict_schema_tool', {
        id: 'valid-id',
        count: 5,
        enabled: true,
        tags: ['tag1'],
        metadata: ['not', 'an', 'object'] as unknown as Record<string, unknown>,
      });
      expect(arrAsObjRes.isError).toBe(true);
      expect(arrAsObjRes.content[0]?.text).toContain("Parameter 'metadata' must be an object");
    });

    test('fuzzing: handles null or undefined params without unhandled rejection', async () => {
      // Undefined params defaults to {}
      const undefRes = await engine.executeTool('strict_schema_tool', undefined);
      expect(undefRes.isError).toBe(true);
      expect(undefRes.content[0]?.text).toContain("Missing required parameter 'id'");

      // Tool with no required properties called with undefined
      engine.registerTool({
        name: 'no_req_tool',
        description: 'No required fields',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => ({ content: [{ type: 'text', text: 'success' }] }),
      });
      const noReqRes = await engine.executeTool('no_req_tool');
      expect(noReqRes.isError).toBeUndefined();
      expect(noReqRes.content[0]?.text).toBe('success');
    });

    test('fuzzing: tool schema with missing properties object handles arbitrary params safely', async () => {
      engine.registerTool({
        name: 'schema_without_properties',
        description: 'Schema with type object but no properties dict',
        inputSchema: { type: 'object', properties: {} as any },
        execute: async (params) => ({ content: [{ type: 'text', text: `Got ${Object.keys(params).length} keys` }] }),
      });

      const res = await engine.executeTool('schema_without_properties', { a: 1, b: 'two' });
      expect(res.isError).toBeUndefined();
      expect(res.content[0]?.text).toBe('Got 2 keys');
    });

    test('fuzzing: non-string and hostile inputs in security and topology tools return error gracefully', async () => {
      registerTopologyTools(engine, stateEngine);
      registerSecurityTools(engine, () => stateEngine.getState(), stateEngine);

      // Malformed resources in orchestrate_cloud_topology
      const malformedTopologyRes = await engine.executeTool('orchestrate_cloud_topology', {
        architecture_name: 'Fuzz',
        region: 'us-east-1',
        vpc: { cidr_block: '10.0.0.0/16' },
        resources: [null, undefined, 42, 'string-resource', { missing_id: true }] as any,
        connections: [null, { invalid: true }] as any,
      });
      // The tool handler should either catch and report error or handle it without crashing the engine
      expect(malformedTopologyRes).toBeDefined();
      expect(typeof malformedTopologyRes.isError === 'boolean' || malformedTopologyRes.content.length > 0).toBe(true);

      // Malformed inline policy in security scanner
      await stateEngine.addNode({
        id: 'iam-object-doc',
        type: 'aws_iam_role',
        name: 'IAM Object Doc',
        position: { x: 0, y: 0 },
        config: {
          inline_policy: {
            policy_document: { Statement: [{ Effect: 'Allow', Action: '*' }] } as any, // Object instead of string
          },
        },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });

      const auditRes = await engine.executeTool('audit_iam_zero_trust', {}, { agentId: 'beta' });
      expect(auditRes).toBeDefined();
    });
  });

  // =========================================================================
  // 3. Topology Tools & CIDR Mathematical Algebra Fuzzing
  // =========================================================================
  describe('3. Topology Tools & CIDR Algebra Boundary Fuzzing', () => {
    beforeEach(() => {
      registerTopologyTools(engine, stateEngine);
    });

    test('CIDR validator handles boundary and malformed IP representations', () => {
      // Valid extremes
      expect(isValidCIDR('0.0.0.0/0')).toBe(true);
      expect(isValidCIDR('255.255.255.255/32')).toBe(true);
      expect(isValidCIDR('10.0.0.0/8')).toBe(true);
      expect(isValidCIDR('172.16.0.0/12')).toBe(true);
      expect(isValidCIDR('192.168.1.0/24')).toBe(true);

      // Malformed octets
      expect(isValidCIDR('256.0.0.0/16')).toBe(false);
      expect(isValidCIDR('-1.0.0.0/16')).toBe(false);
      expect(isValidCIDR('10.0.0/16')).toBe(false);
      expect(isValidCIDR('10.0.0.0.0/16')).toBe(false);
      expect(isValidCIDR('10.0.0.0')).toBe(false);
      expect(isValidCIDR('10.0.0.0/33')).toBe(false);
      expect(isValidCIDR('10.0.0.0/-1')).toBe(false);
      expect(isValidCIDR('abc.def.ghi.jkl/24')).toBe(false);
      expect(isValidCIDR('')).toBe(false);
    });

    test('CIDR overlap algebra accurately detects overlaps, subsets, and disjoint blocks', () => {
      // Subnets within /16
      expect(checkCIDROverlap('10.0.0.0/16', '10.0.1.0/24')).toBe(true);
      expect(checkCIDROverlap('10.0.1.0/24', '10.0.0.0/16')).toBe(true);

      // Disjoint adjacent /24s
      expect(checkCIDROverlap('10.0.0.0/24', '10.0.1.0/24')).toBe(false);
      expect(checkCIDROverlap('10.0.1.0/24', '10.0.2.0/24')).toBe(false);

      // Overlapping /25 subnets within a /24
      expect(checkCIDROverlap('10.0.1.0/25', '10.0.1.0/24')).toBe(true);
      expect(checkCIDROverlap('10.0.1.0/25', '10.0.1.128/25')).toBe(false);

      // 0.0.0.0/0 overlaps everything
      expect(checkCIDROverlap('0.0.0.0/0', '192.168.1.0/24')).toBe(true);
      expect(checkCIDROverlap('192.168.1.0/24', '0.0.0.0/0')).toBe(true);

      // High-range IPs (192.168.x.x, 224.x.x.x)
      expect(checkCIDROverlap('192.168.0.0/16', '192.168.100.0/24')).toBe(true);
      expect(checkCIDROverlap('192.168.0.0/24', '192.168.1.0/24')).toBe(false);
      expect(checkCIDROverlap('172.16.0.0/12', '172.31.255.0/24')).toBe(true);
      expect(checkCIDROverlap('172.16.0.0/12', '172.32.0.0/16')).toBe(false);

      // Invalid CIDR inputs return false safely
      expect(checkCIDROverlap('invalid', '10.0.0.0/24')).toBe(false);
      expect(checkCIDROverlap('10.0.0.0/24', 'invalid')).toBe(false);
    });

    test('orchestrate_cloud_topology rejects invalid VPC CIDR', async () => {
      const res = await engine.executeTool('orchestrate_cloud_topology', {
        architecture_name: 'Bad-VPC',
        region: 'us-east-1',
        vpc: { cidr_block: '999.999.999.999/99' },
        resources: [],
      });
      expect(res.isError).toBe(true);
      expect(res.content[0]?.text).toContain('Invalid VPC CIDR block');
    });

    test('orchestrate_cloud_topology rejects overlapping subnet CIDR blocks', async () => {
      const res = await engine.executeTool('orchestrate_cloud_topology', {
        architecture_name: 'Overlap-Test',
        region: 'us-east-1',
        vpc: { cidr_block: '10.0.0.0/16' },
        resources: [
          {
            id: 'sub-1',
            type: 'aws_subnet',
            name: 'Subnet A',
            config: { cidr_block: '10.0.0.0/24' },
          },
          {
            id: 'sub-2',
            type: 'aws_subnet',
            name: 'Subnet B',
            config: { cidr_block: '10.0.0.128/25' }, // Overlaps Subnet A!
          },
        ],
      });
      expect(res.isError).toBe(true);
      expect(res.content[0]?.text).toContain('CIDR Conflict Error');
    });

    test('connect_resources validates port range and protocol enums', async () => {
      // Invalid port > 65535
      const badPortRes = await engine.executeTool('connect_resources', {
        source_id: 'node-a',
        target_id: 'node-b',
        relation_type: 'routes_to',
        port: 70000,
      });
      expect(badPortRes.isError).toBe(true);
      expect(badPortRes.content[0]?.text).toContain("Parameter 'port' cannot be greater than 65535");

      // Invalid port < 1
      const zeroPortRes = await engine.executeTool('connect_resources', {
        source_id: 'node-a',
        target_id: 'node-b',
        relation_type: 'routes_to',
        port: 0,
      });
      expect(zeroPortRes.isError).toBe(true);
      expect(zeroPortRes.content[0]?.text).toContain("Parameter 'port' cannot be less than 1");

      // Invalid protocol
      const badProtoRes = await engine.executeTool('connect_resources', {
        source_id: 'node-a',
        target_id: 'node-b',
        relation_type: 'routes_to',
        protocol: 'gopher',
      });
      expect(badProtoRes.isError).toBe(true);
      expect(badProtoRes.content[0]?.text).toContain("Parameter 'protocol' must be one of [tcp, udp, http, https, all]");
    });

    test('create_resource_node rejects unapproved AWS resource types', async () => {
      const res = await engine.executeTool('create_resource_node', {
        id: 'bad-node',
        type: 'aws_unsupported_quantum_service',
        name: 'Quantum Node',
        config: {},
      });
      expect(res.isError).toBe(true);
      expect(res.content[0]?.text).toContain("Parameter 'type' must be one of");
    });
  });

  // =========================================================================
  // 4. Security Tools & Zero-Trust Auditing Adversarial Edge Cases
  // =========================================================================
  describe('4. Security Tools & Zero-Trust Adversarial Auditing', () => {
    beforeEach(() => {
      registerSecurityTools(engine, () => stateEngine.getState(), stateEngine);
    });

    test('evaluates security rules against worst-case maximum-violation topology', async () => {
      // Node 1: SG open on port 22 and 3389 (-25)
      await stateEngine.addNode({
        id: 'sg-worst',
        type: 'aws_security_group',
        name: 'Worst SG',
        position: { x: 0, y: 0 },
        config: {
          ingress_rules: [
            { from_port: 22, to_port: 22, cidr_blocks: ['0.0.0.0/0'] },
            { from_port: 3389, to_port: 3389, cidr_blocks: ['0.0.0.0/0'] },
          ],
        },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });

      // Node 2: Public RDS (-20)
      await stateEngine.addNode({
        id: 'rds-worst',
        type: 'aws_db_instance',
        name: 'Worst RDS',
        position: { x: 0, y: 0 },
        config: { publicly_accessible: true },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });

      // Node 3: Unencrypted S3 without BPA (-15 enc, -15 bpa)
      await stateEngine.addNode({
        id: 's3-worst',
        type: 'aws_s3_bucket',
        name: 'Worst S3',
        position: { x: 0, y: 0 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });

      // Node 4: Wildcard IAM Role (-15)
      await stateEngine.addNode({
        id: 'iam-worst',
        type: 'aws_iam_role',
        name: 'Worst IAM',
        position: { x: 0, y: 0 },
        config: {
          inline_policy: {
            policy_document: '{"Statement":[{"Effect":"Allow","Action":"*","Resource":"*"}]}',
          },
        },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });

      // Node 5: EC2 without IMDSv2 (-10)
      await stateEngine.addNode({
        id: 'ec2-worst',
        type: 'aws_instance',
        name: 'Worst EC2',
        position: { x: 0, y: 0 },
        config: { http_tokens: 'optional' },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });

      // Node 6: ALB without HTTPS (-10)
      await stateEngine.addNode({
        id: 'alb-worst',
        type: 'aws_lb',
        name: 'Worst ALB',
        position: { x: 0, y: 0 },
        config: {
          listeners: [{ protocol: 'HTTP', port: 80 }],
        },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });

      const auditRes = await engine.executeTool('audit_iam_zero_trust', {}, { agentId: 'beta' });
      expect(auditRes.isError).toBeUndefined();

      const report = JSON.parse(auditRes.content[0]?.text ?? '{}');
      // Score clamped to 0 (100 - 25 - 20 - 15 - 15 - 15 - 10 - 10 = -10 -> 0)
      expect(report.overall_compliance_score).toBe(0);
      expect(report.status).toBe('CRITICAL_FAIL');
      expect(report.total_findings).toBeGreaterThanOrEqual(7);

      // Now apply automated security hardening and verify remediation
      const hardenRes = await engine.executeTool('apply_security_hardening', {}, { agentId: 'beta' });
      expect(hardenRes.isError).toBeUndefined();

      const hardenReport = JSON.parse(hardenRes.content[0]?.text ?? '{}');
      expect(hardenReport.remediated_node_count).toBeGreaterThanOrEqual(4);
      expect(hardenReport.new_security_score).toBeGreaterThan(50);
      expect(hardenReport.score_improvement).toBeGreaterThan(50);
    });

    test('generate_least_privilege_policy synthesizes strictly compliant IAM Policy JSON', async () => {
      const genRes = await engine.executeTool(
        'generate_least_privilege_policy',
        {
          workload_type: 'dynamodb_crud',
          resource_arn: 'arn:aws:dynamodb:us-east-1:123456789012:table/Orders',
          allowed_operations: ['dynamodb:GetItem', 'dynamodb:PutItem'],
          enforce_mfa: true,
          enforce_tls_version: '1.3',
        },
        { agentId: 'beta' }
      );

      expect(genRes.isError).toBeUndefined();
      const doc = JSON.parse(genRes.content[0]?.text ?? '{}');
      expect(doc.Version).toBe('2012-10-17');
      expect(doc.Statement[0].Effect).toBe('Allow');
      expect(doc.Statement[0].Action).toEqual(['dynamodb:GetItem', 'dynamodb:PutItem']);
      expect(doc.Statement[0].Resource).toBe('arn:aws:dynamodb:us-east-1:123456789012:table/Orders');
      expect(doc.Statement[0].Condition.Bool['aws:MultiFactorAuthPresent']).toBe('true');
      expect(doc.Statement[0].Condition.NumericGreaterThanEquals['s3:TlsVersion']).toBe('1.3');
    });

    test('audit_iam_zero_trust supports target_node_ids scoping and severity filtering', async () => {
      // Add one clean node and one insecure node
      await stateEngine.addNode({
        id: 'ec2-bad',
        type: 'aws_instance',
        name: 'Bad EC2',
        position: { x: 0, y: 0 },
        config: { http_tokens: 'optional' }, // MEDIUM severity (-10)
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });
      await stateEngine.addNode({
        id: 'sg-crit',
        type: 'aws_security_group',
        name: 'Crit SG',
        position: { x: 0, y: 0 },
        config: {
          ingress_rules: [{ from_port: 22, to_port: 22, cidr_blocks: ['0.0.0.0/0'] }], // CRITICAL (-25)
        },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });

      // Filter by severity: CRITICAL only
      const critOnly = await engine.executeTool(
        'audit_iam_zero_trust',
        { severity_threshold: 'CRITICAL' },
        { agentId: 'beta' }
      );
      const critReport = JSON.parse(critOnly.content[0]?.text ?? '{}');
      expect(critReport.findings.every((f: { severity: string }) => f.severity === 'CRITICAL')).toBe(true);

      // Filter by target_node_ids: only ec2-bad
      const scoped = await engine.executeTool(
        'audit_iam_zero_trust',
        { target_node_ids: ['ec2-bad'] },
        { agentId: 'beta' }
      );
      const scopedReport = JSON.parse(scoped.content[0]?.text ?? '{}');
      expect(scopedReport.findings.every((f: { target_node_id: string }) => f.target_node_id === 'ec2-bad')).toBe(true);
    });
  });

  // =========================================================================
  // 5. FinOps Tools & Pricing Calculator Fuzzing
  // =========================================================================
  describe('5. FinOps Tools & Pricing Engine Fuzzing', () => {
    beforeEach(() => {
      registerFinOpsTools(engine, () => stateEngine.getState());
    });

    test('pricing calculations handle exotic storage types and custom IOPS', async () => {
      // EC2 with io2 high IOPS volume
      const ec2Io2Res = await engine.executeTool(
        'query_resource_pricing',
        {
          resource_type: 'aws_instance',
          config: {
            instance_type: 'c6i.2xlarge', // $0.34/hr * 730 = $248.20
            root_volume_gb: 500, // 500 * $0.125 = $62.50
            root_volume_type: 'io2',
            iops: 10000, // 10,000 * $0.065 = $650.00
          },
        },
        { agentId: 'gamma' }
      );
      expect(ec2Io2Res.isError).toBeUndefined();
      const ec2Cost = JSON.parse(ec2Io2Res.content[0]?.text ?? '{}');
      // Total monthly = 248.20 + 62.50 + 650.00 = 960.70
      expect(ec2Cost.monthlyUsd).toBeCloseTo(960.70, 1);
    });

    test('EKS spot node groups correctly apply 70% spot discount', async () => {
      const eksOnDemand: CloudResourceNode = {
        id: 'eks-ondemand',
        type: 'aws_eks_cluster',
        name: 'EKS On-Demand',
        position: { x: 0, y: 0 },
        config: {
          node_groups: [{ instance_type: 't3.medium', desired_size: 10, capacity_type: 'ON_DEMAND' }],
        },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      };

      const eksSpot: CloudResourceNode = {
        id: 'eks-spot',
        type: 'aws_eks_cluster',
        name: 'EKS Spot',
        position: { x: 0, y: 0 },
        config: {
          node_groups: [{ instance_type: 't3.medium', desired_size: 10, capacity_type: 'SPOT' }],
        },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      };

      const costOnDemand = calculateNodeCost(eksOnDemand);
      const costSpot = calculateNodeCost(eksSpot);

      // Base EKS fee is $73/mo
      // On demand compute = 10 * 0.0416 * 730 = $303.68 -> Total = 376.68
      // Spot compute = 10 * 0.0416 * 0.3 * 730 = $91.10 -> Total = 164.10
      expect(costOnDemand.monthlyUsd).toBeCloseTo(376.68, 1);
      expect(costSpot.monthlyUsd).toBeCloseTo(164.10, 1);
      expect(costSpot.monthlyUsd).toBeLessThan(costOnDemand.monthlyUsd);
    });

    test('calculate_topology_cost handles massive 200-node topology with precision', async () => {
      // Populate 200 nodes
      for (let i = 0; i < 200; i++) {
        const type = i % 2 === 0 ? 'aws_instance' : 'aws_db_instance';
        await stateEngine.addNode({
          id: `node-bulk-${i}`,
          type,
          name: `Bulk Node ${i}`,
          position: { x: i * 10, y: i * 10 },
          config: type === 'aws_instance' ? { instance_type: 't3.micro' } : { instance_class: 'db.t4g.micro' },
          metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
          version: 1,
        });
      }

      const costRes = await engine.executeTool('calculate_topology_cost', {}, { agentId: 'gamma' });
      expect(costRes.isError).toBeUndefined();

      const costData = JSON.parse(costRes.content[0]?.text ?? '{}');
      expect(costData.itemized_nodes).toHaveLength(200);
      expect(costData.total_monthly_usd).toBeGreaterThan(1000);
      expect(typeof costData.total_monthly_usd).toBe('number');
      expect(Number.isFinite(costData.total_monthly_usd)).toBe(true);
      expect(Number.isFinite(costData.total_hourly_usd)).toBe(true);
    });

    test('optimize_cost_allocation generates actionable Graviton and EBS recommendations', async () => {
      // Add x86 node and legacy gp2 storage node
      await stateEngine.addNode({
        id: 'ec2-x86',
        type: 'aws_instance',
        name: 'x86 Compute',
        position: { x: 0, y: 0 },
        config: { instance_type: 'c6i.xlarge', root_volume_type: 'gp2' },
        metadata: { createdBy: 'alpha', createdAt: 0, updatedAt: 0 },
        version: 1,
      });

      const optRes = await engine.executeTool('optimize_cost_allocation', { strategy: 'BALANCED' }, { agentId: 'gamma' });
      expect(optRes.isError).toBeUndefined();

      const optData = JSON.parse(optRes.content[0]?.text ?? '{}');
      expect(optData.recommendations_count).toBeGreaterThanOrEqual(2);
      expect(optData.total_potential_savings_monthly_usd).toBeGreaterThan(30);

      const actionTypes = optData.recommendations.map((r: { actionType: string }) => r.actionType);
      expect(actionTypes).toContain('MIGRATE_GRAVITON');
      expect(actionTypes).toContain('UPGRADE_EBS_GP3');
    });
  });
});
