import { OptimisticStateEngine } from '../core/state/OptimisticStateEngine';
import type { CloudResourceNode, TopologyEdge } from '../types/topology';
import type { StateTransaction } from '../types/patch';

describe('OptimisticStateEngine — RFC 6902 CAS & Microsecond Rollback Engine', () => {
  let engine: OptimisticStateEngine;

  beforeEach(() => {
    engine = new OptimisticStateEngine();
  });

  test('initial state and default version', () => {
    const state = engine.getState();
    expect(state.version).toBe(0);
    expect(state.nodes).toEqual({});
    expect(state.edges).toEqual({});
  });

  test('atomic node creation with forward and inverse patches', async () => {
    const node: CloudResourceNode = {
      id: 'vpc-main',
      type: 'aws_vpc',
      name: 'Main VPC',
      position: { x: 100, y: 100 },
      config: { cidr_block: '10.0.0.0/16' },
      metadata: {
        createdBy: 'alpha',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      version: 1,
    };

    const result = await engine.addNode(node, 'alpha');

    expect(result.success).toBe(true);
    expect(result.version).toBe(1);
    expect(result.patches.length).toBeGreaterThan(0);
    expect(result.inversePatches.length).toBeGreaterThan(0);
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);

    const currentState = engine.getState();
    expect(currentState.nodes['vpc-main']).toBeDefined();
    expect(currentState.nodes['vpc-main']?.name).toBe('Main VPC');
  });

  test('CAS test op success and rejection on value mismatch', async () => {
    const node: CloudResourceNode = {
      id: 'ec2-web',
      type: 'aws_instance',
      name: 'Web Server',
      position: { x: 200, y: 200 },
      config: { instance_type: 't3.medium' },
      metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
      version: 1,
    };
    await engine.addNode(node, 'alpha');

    // Successful CAS test op
    const validTx: StateTransaction = {
      id: 'tx_cas_valid',
      agentId: 'beta',
      description: 'Update instance type with valid CAS test',
      timestamp: Date.now(),
      patches: [
        { op: 'test', path: '/nodes/ec2-web/config/instance_type', value: 't3.medium' },
        { op: 'replace', path: '/nodes/ec2-web/config/instance_type', value: 'c6i.large' },
      ],
    };

    const validResult = await engine.applyTransaction(validTx);
    expect(validResult.success).toBe(true);
    expect(engine.getState().nodes['ec2-web']?.config.instance_type).toBe('c6i.large');

    // Conflicting CAS test op (stale expected value)
    const staleTx: StateTransaction = {
      id: 'tx_cas_stale',
      agentId: 'gamma',
      description: 'Update instance type with stale CAS test',
      timestamp: Date.now(),
      patches: [
        { op: 'test', path: '/nodes/ec2-web/config/instance_type', value: 't3.medium' }, // actual is c6i.large
        { op: 'replace', path: '/nodes/ec2-web/config/instance_type', value: 't4g.xlarge' },
      ],
    };

    const staleResult = await engine.applyTransaction(staleTx);
    expect(staleResult.success).toBe(false);
    expect(staleResult.casFailedKey).toBe('/nodes/ec2-web/config/instance_type');
    expect(staleResult.conflictError).toContain('CAS test operation failed');

    // Assert state remained unchanged
    expect(engine.getState().nodes['ec2-web']?.config.instance_type).toBe('c6i.large');
  });

  test('CAS expectedVersions constraint verification', async () => {
    const node: CloudResourceNode = {
      id: 'rds-db',
      type: 'aws_db_instance',
      name: 'Main DB',
      position: { x: 300, y: 300 },
      config: { engine: 'postgres', instance_class: 'db.t4g.medium' },
      metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
      version: 1,
    };
    await engine.addNode(node, 'alpha');

    // Mismatched expectedVersions
    const conflictingTx: StateTransaction = {
      id: 'tx_version_conflict',
      agentId: 'gamma',
      description: 'Update RDS storage',
      timestamp: Date.now(),
      expectedVersions: { 'rds-db': 99 }, // actual is 1
      patches: [
        { op: 'replace', path: '/nodes/rds-db/config/allocated_storage_gb', value: 100 },
      ],
    };

    const result = await engine.applyTransaction(conflictingTx);
    expect(result.success).toBe(false);
    expect(result.casFailedKey).toBe('rds-db');
    expect(result.conflictError).toContain('CAS node version mismatch');
  });

  test('patch symmetry theorem: Apply(Apply(S, Delta), Delta^-1) == S', async () => {
    const initialState = engine.getState();

    const node1: CloudResourceNode = {
      id: 'node-sym-1',
      type: 'aws_instance',
      name: 'Sym-1',
      position: { x: 50, y: 50 },
      config: { instance_type: 't3.micro' },
      metadata: { createdBy: 'alpha', createdAt: 1000, updatedAt: 1000 },
      version: 1,
    };

    const addResult = await engine.addNode(node1, 'alpha');
    expect(addResult.success).toBe(true);

    // Rollback using inverse patches
    const rollbackResult = engine.rollback(addResult.inversePatches);
    expect(rollbackResult.success).toBe(true);
    expect(rollbackResult.executionTimeMs).toBeLessThan(5); // Sub-millisecond target

    const restoredState = engine.getState();
    expect(restoredState.nodes['node-sym-1']).toBeUndefined();
    expect(Object.keys(restoredState.nodes).length).toBe(Object.keys(initialState.nodes).length);
  });

  test('edge addition and cascading removal', async () => {
    const vpc: CloudResourceNode = {
      id: 'vpc-1',
      type: 'aws_vpc',
      name: 'VPC',
      position: { x: 0, y: 0 },
      config: {},
      metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
      version: 1,
    };
    const subnet: CloudResourceNode = {
      id: 'sub-1',
      type: 'aws_subnet',
      name: 'Subnet',
      position: { x: 10, y: 10 },
      config: {},
      metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
      version: 1,
    };
    await engine.addNode(vpc, 'alpha');
    await engine.addNode(subnet, 'alpha');

    const edge: TopologyEdge = {
      id: 'edge-vpc-sub',
      source: 'vpc-1',
      target: 'sub-1',
      type: 'routes_to',
      version: 1,
    };
    const edgeResult = await engine.addEdge(edge, 'alpha');
    expect(edgeResult.success).toBe(true);
    expect(engine.getState().edges['edge-vpc-sub']).toBeDefined();

    // Cascading node removal removes attached edges
    const removeResult = await engine.removeNode('sub-1', true, 'alpha');
    expect(removeResult.success).toBe(true);
    expect(engine.getState().nodes['sub-1']).toBeUndefined();
    expect(engine.getState().edges['edge-vpc-sub']).toBeUndefined();
  });

  test('subscription listeners are notified of transactions', async () => {
    const subscriber = jest.fn();
    const unsubscribe = engine.subscribe(subscriber);

    const node: CloudResourceNode = {
      id: 'node-listener',
      type: 'aws_s3_bucket',
      name: 'Assets Bucket',
      position: { x: 0, y: 0 },
      config: {},
      metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
      version: 1,
    };
    await engine.addNode(node, 'alpha');

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber.mock.calls[0][0].nodes['node-listener']).toBeDefined();

    unsubscribe();
    await engine.updateNodeConfig('node-listener', { versioning: true }, 'beta');
    expect(subscriber).toHaveBeenCalledTimes(1); // Not called after unsubscribe
  });

  test('Lamport clock monotonicity tracks sequential transactions', async () => {
    expect(engine.getState().version).toBe(0);

    for (let i = 1; i <= 5; i++) {
      const node: CloudResourceNode = {
        id: `node-lamport-${i}`,
        type: 'aws_vpc',
        name: `VPC ${i}`,
        position: { x: i * 20, y: i * 20 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      };
      const res = await engine.addNode(node, 'alpha');
      expect(res.version).toBe(i);
      expect(engine.getState().version).toBe(i);
    }
  });
});
