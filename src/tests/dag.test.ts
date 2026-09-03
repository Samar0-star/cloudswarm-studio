/**
 * Unit Tests for DecisionDAG — In-Memory Reversible DAG & Time-Travel Engine
 */

import { DecisionDAG } from '../core/dag/DecisionDAG';
import type { CloudResourceNode, TopologyEdge, TopologyState } from '../types/topology';
import { createDefaultTopologyState } from '../types/topology';
import type { StateTransaction } from '../types/patch';

describe('DecisionDAG — Reversible Patch Tree & LCA Time-Travel Engine', () => {
  let dag: DecisionDAG;
  let initialVpc: CloudResourceNode;
  let initialSubnet: CloudResourceNode;

  beforeEach(() => {
    initialVpc = {
      id: 'vpc_main',
      type: 'aws_vpc',
      name: 'Main VPC',
      position: { x: 100, y: 100 },
      config: { cidr_block: '10.0.0.0/16' },
      metadata: { createdBy: 'alpha', createdAt: 1000, updatedAt: 1000 },
      version: 1,
    };

    initialSubnet = {
      id: 'sub_pub',
      type: 'aws_subnet',
      name: 'Public Subnet',
      parentId: 'vpc_main',
      position: { x: 150, y: 200 },
      config: { vpc_id: 'vpc_main', cidr_block: '10.0.1.0/24' },
      metadata: { createdBy: 'alpha', createdAt: 1000, updatedAt: 1000 },
      version: 1,
    };

    dag = new DecisionDAG();
  });

  describe('DAG Initialization & Root State', () => {
    test('initializes with root commit at depth 0 on main branch', () => {
      expect(dag.getRootCommitId()).toBe('commit_root');
      expect(dag.getActiveCommitId()).toBe('commit_root');
      expect(dag.getActiveBranchName()).toBe('main');

      const root = dag.getCommit('commit_root');
      expect(root).toBeDefined();
      expect(root?.depth).toBe(0);
      expect(root?.parentId).toBeNull();
      expect(root?.author).toBe('director');
      expect(root?.message).toBe('Initial root state');
      expect(root?.childrenIds).toEqual([]);
    });

    test('initializes with custom initial state if supplied', () => {
      const customState: TopologyState = {
        nodes: { vpc_main: initialVpc },
        edges: {},
        version: 1,
      };
      const customDag = new DecisionDAG(customState, 'alpha', 'Custom genesis');
      const root = customDag.getCommit('commit_root');
      expect(root?.state.nodes['vpc_main']).toBeDefined();
      expect(root?.author).toBe('alpha');
      expect(root?.message).toBe('Custom genesis');
    });
  });

  describe('Commit Progression & Author Tracking', () => {
    test('appends commits sequentially with parent-child linkage and author metadata', () => {
      const c1 = dag.addCommit({
        message: 'Alpha: Add VPC',
        author: 'alpha',
        patches: [{ op: 'add', path: '/nodes/vpc_main', value: initialVpc }],
      });

      expect(c1.parentId).toBe('commit_root');
      expect(c1.author).toBe('alpha');
      expect(c1.depth).toBe(1);
      expect(c1.state.nodes['vpc_main']).toBeDefined();
      expect(dag.getActiveCommitId()).toBe(c1.id);

      const root = dag.getCommit('commit_root');
      expect(root?.childrenIds).toContain(c1.id);

      const c2 = dag.addCommit({
        message: 'Beta: Add Subnet',
        author: 'beta',
        patches: [{ op: 'add', path: '/nodes/sub_pub', value: initialSubnet }],
      });

      expect(c2.parentId).toBe(c1.id);
      expect(c2.author).toBe('beta');
      expect(c2.depth).toBe(2);
      expect(c2.state.nodes['sub_pub']).toBeDefined();
      expect(dag.getActiveCommitId()).toBe(c2.id);
    });

    test('supports StateTransaction inputs directly', () => {
      const tx: StateTransaction = {
        id: 'tx_secops_sg',
        agentId: 'beta',
        description: 'SecOps SG Lock',
        timestamp: 2000,
        patches: [
          {
            op: 'add',
            path: '/nodes/sg_1',
            value: {
              id: 'sg_1',
              type: 'aws_security_group',
              name: 'SG 1',
              position: { x: 0, y: 0 },
              config: {},
              metadata: { createdBy: 'beta', createdAt: 2000, updatedAt: 2000 },
              version: 1,
            },
          },
        ],
      };

      const commit = dag.addCommit(tx);
      expect(commit.id).toBe('tx_secops_sg');
      expect(commit.author).toBe('beta');
      expect(commit.message).toBe('SecOps SG Lock');
      expect(commit.state.nodes['sg_1']).toBeDefined();
    });
  });

  describe('Branch Forking & Multi-Branch Management', () => {
    test('forks new branch from historical commit and switches active branch', () => {
      const c1 = dag.addCommit({
        message: 'Alpha: Add VPC',
        author: 'alpha',
        patches: [{ op: 'add', path: '/nodes/vpc_main', value: initialVpc }],
      });

      const branch = dag.forkBranch('feature/secops_hardening', c1.id, 'beta');
      expect(branch.name).toBe('feature/secops_hardening');
      expect(branch.headCommitId).toBe(c1.id);
      expect(branch.createdBy).toBe('beta');
      expect(dag.getActiveBranchName()).toBe('feature/secops_hardening');

      // Commit onto new branch
      const cBranch1 = dag.addCommit({
        message: 'Beta: Hardening rules',
        author: 'beta',
        patches: [],
      });

      expect(cBranch1.branch).toBe('feature/secops_hardening');
      expect(dag.getActiveBranch().headCommitId).toBe(cBranch1.id);

      // Verify main branch head is still c1
      expect(dag.getBranch('main')?.headCommitId).toBe(c1.id);
    });

    test('switching branch updates active branch and checks out head state', () => {
      const c1 = dag.addCommit({
        message: 'C1 on main',
        author: 'alpha',
        patches: [{ op: 'add', path: '/nodes/vpc_main', value: initialVpc }],
      });

      dag.forkBranch('exp_finops', c1.id, 'gamma');
      dag.addCommit({
        message: 'C_exp on exp_finops',
        author: 'gamma',
        patches: [{ op: 'add', path: '/nodes/sub_pub', value: initialSubnet }],
      });

      // Switch back to main
      const mainState = dag.switchBranch('main');
      expect(dag.getActiveBranchName()).toBe('main');
      expect(dag.getActiveCommitId()).toBe(c1.id);
      expect(mainState.nodes['vpc_main']).toBeDefined();
      expect(mainState.nodes['sub_pub']).toBeUndefined();

      // Switch back to exp_finops
      const expState = dag.switchBranch('exp_finops');
      expect(dag.getActiveBranchName()).toBe('exp_finops');
      expect(expState.nodes['sub_pub']).toBeDefined();
    });

    test('throws when forking duplicate branch name or from non-existent commit', () => {
      expect(() => dag.forkBranch('main')).toThrow("Branch 'main' already exists");
      expect(() => dag.forkBranch('invalid', 'ghost_commit_id')).toThrow("Source commit 'ghost_commit_id' not found");
    });
  });

  describe('Lowest Common Ancestor (LCA) Traversal', () => {
    test('finds LCA between self, parent-child, and divergent sibling branches', () => {
      // Tree structure:
      // Root -> C1 (VPC) -> C2 (Subnet on main)
      //                  -> C3 (Forked SecOps) -> C4 (Hardened)
      const c1 = dag.addCommit({ message: 'C1 VPC', author: 'alpha', patches: [{ op: 'add', path: '/nodes/vpc_main', value: initialVpc }] });
      const c2 = dag.addCommit({ message: 'C2 Subnet', author: 'alpha', patches: [{ op: 'add', path: '/nodes/sub_pub', value: initialSubnet }] });

      dag.forkBranch('secops', c1.id, 'beta');
      const c3 = dag.addCommit({ message: 'C3 SG', author: 'beta', patches: [] });
      const c4 = dag.addCommit({ message: 'C4 Audit', author: 'beta', patches: [] });

      // Self LCA
      expect(dag.findLCA(c1.id, c1.id)?.id).toBe(c1.id);

      // Parent-child LCA
      expect(dag.findLCA(c1.id, c2.id)?.id).toBe(c1.id);
      expect(dag.findLCA(c2.id, c1.id)?.id).toBe(c1.id);

      // Sibling fork LCA: C2 and C4 should have C1 as LCA
      expect(dag.findLCA(c2.id, c4.id)?.id).toBe(c1.id);
      expect(dag.findLCA(c3.id, c4.id)?.id).toBe(c3.id);

      // Fork and Root
      expect(dag.findLCA('commit_root', c4.id)?.id).toBe('commit_root');
    });

    test('computes path traversal through LCA for fast net-patch delta calculation', () => {
      const c1 = dag.addCommit({ message: 'C1', author: 'alpha', patches: [] });
      const c2 = dag.addCommit({ message: 'C2', author: 'alpha', patches: [] });

      dag.forkBranch('branchB', c1.id);
      const c3 = dag.addCommit({ message: 'C3', author: 'beta', patches: [] });

      const traversal = dag.getPathBetweenCommits(c2.id, c3.id);
      expect(traversal.lca.id).toBe(c1.id);
      expect(traversal.pathDownToLCA.map((n) => n.id)).toEqual([c2.id]);
      expect(traversal.pathUpFromLCAToTarget.map((n) => n.id)).toEqual([c3.id]);
    });
  });

  describe('60 FPS Time-Travel Checkout & Scrubbing', () => {
    test('checkout restores exact historical state and active commit ID', () => {
      const c1 = dag.addCommit({ message: 'C1 VPC', author: 'alpha', patches: [{ op: 'add', path: '/nodes/vpc_main', value: initialVpc }] });
      const c2 = dag.addCommit({ message: 'C2 Subnet', author: 'alpha', patches: [{ op: 'add', path: '/nodes/sub_pub', value: initialSubnet }] });

      // Checkout C1
      const stateC1 = dag.checkout(c1.id);
      expect(dag.getActiveCommitId()).toBe(c1.id);
      expect(stateC1.nodes['vpc_main']).toBeDefined();
      expect(stateC1.nodes['sub_pub']).toBeUndefined();

      // Checkout root
      const stateRoot = dag.checkout('commit_root');
      expect(dag.getActiveCommitId()).toBe('commit_root');
      expect(Object.keys(stateRoot.nodes).length).toBe(0);

      // Checkout C2
      const stateC2 = dag.checkout(c2.id);
      expect(dag.getActiveCommitId()).toBe(c2.id);
      expect(stateC2.nodes['sub_pub']).toBeDefined();
    });

    test('scrubTo smoothly interpolates from 0.0 (root) to 1.0 (head)', () => {
      const c1 = dag.addCommit({ message: 'C1', author: 'alpha', patches: [{ op: 'add', path: '/nodes/vpc_main', value: initialVpc }] });
      const c2 = dag.addCommit({ message: 'C2', author: 'alpha', patches: [{ op: 'add', path: '/nodes/sub_pub', value: initialSubnet }] });

      const s0 = dag.scrubTo(0.0);
      expect(dag.getActiveCommitId()).toBe('commit_root');
      expect(Object.keys(s0.nodes).length).toBe(0);

      const s50 = dag.scrubTo(0.5);
      expect(dag.getActiveCommitId()).toBe(c1.id);
      expect(s50.nodes['vpc_main']).toBeDefined();

      const s100 = dag.scrubTo(1.0);
      expect(dag.getActiveCommitId()).toBe(c2.id);
      expect(s100.nodes['sub_pub']).toBeDefined();
    });

    test('throws on checkout of non-existent commit', () => {
      expect(() => dag.checkout('unknown_id')).toThrow("Commit 'unknown_id' not found");
    });
  });

  describe('A/B Split-Screen Diff Inspector', () => {
    test('computes added, removed, and modified nodes between arbitrary branches', () => {
      const cRoot = 'commit_root';

      // Commit 1: Add VPC & Subnet
      const c1 = dag.addCommit({
        message: 'C1',
        author: 'alpha',
        patches: [
          { op: 'add', path: '/nodes/vpc_main', value: initialVpc },
          { op: 'add', path: '/nodes/sub_pub', value: initialSubnet },
        ],
      });

      // Branch A: Modifies VPC CIDR and adds EC2
      dag.forkBranch('branchA', c1.id);
      const cA = dag.addCommit({
        message: 'Branch A changes',
        author: 'alpha',
        patches: [
          { op: 'replace', path: '/nodes/vpc_main/config/cidr_block', value: '172.16.0.0/16' },
          {
            op: 'add',
            path: '/nodes/ec2_a',
            value: {
              id: 'ec2_a',
              type: 'aws_instance',
              name: 'EC2 A',
              position: { x: 0, y: 0 },
              config: { instance_type: 't3.micro' },
              metadata: { createdBy: 'alpha', createdAt: 1000, updatedAt: 1000 },
              version: 1,
            },
          },
        ],
      });

      // Branch B: Removes Subnet and adds S3
      dag.forkBranch('branchB', c1.id);
      const cB = dag.addCommit({
        message: 'Branch B changes',
        author: 'beta',
        patches: [
          { op: 'remove', path: '/nodes/sub_pub' },
          {
            op: 'add',
            path: '/nodes/s3_b',
            value: {
              id: 's3_b',
              type: 'aws_s3_bucket',
              name: 'S3 B',
              position: { x: 0, y: 0 },
              config: { bucket_name: 'b-bucket' },
              metadata: { createdBy: 'beta', createdAt: 1000, updatedAt: 1000 },
              version: 1,
            },
          },
        ],
      });

      // Compare Branch A with Branch B
      const diff = dag.getDiff(cA.id, cB.id);

      expect(diff.commitAId).toBe(cA.id);
      expect(diff.commitBId).toBe(cB.id);
      expect(diff.lcaId).toBe(c1.id);

      // S3 B was added in B
      expect(diff.addedNodes.map((n) => n.id)).toContain('s3_b');
      // EC2 A and Subnet were removed/not in B
      expect(diff.removedNodes.map((n) => n.id)).toContain('ec2_a');
      expect(diff.removedNodes.map((n) => n.id)).toContain('sub_pub');

      // VPC was modified (CIDR changed from 172.16.0.0/16 in A to 10.0.0.0/16 in B)
      const vpcMod = diff.modifiedNodes.find((m) => m.id === 'vpc_main');
      expect(vpcMod).toBeDefined();
      expect(vpcMod?.changedKeys).toContain('config.cidr_block');
    });

    test('compares edge differences between commits', () => {
      const edge: TopologyEdge = {
        id: 'e1',
        source: 'vpc_main',
        target: 'sub_pub',
        type: 'routes_to',
        version: 1,
      };

      const c1 = dag.addCommit({
        message: 'Add edge',
        author: 'alpha',
        patches: [{ op: 'add', path: '/edges/e1', value: edge }],
      });

      const diff = dag.getDiff('commit_root', c1.id);
      expect(diff.addedEdges.map((e) => e.id)).toContain('e1');
      expect(diff.removedEdges).toEqual([]);
    });
  });

  describe('Timeline & Export', () => {
    test('getTimeline returns all commits in chronological order', () => {
      dag.addCommit({ message: 'Alpha 1', author: 'alpha', patches: [] });
      dag.addCommit({ message: 'Beta 1', author: 'beta', patches: [] });
      dag.addCommit({ message: 'Gamma 1', author: 'gamma', patches: [] });

      const timeline = dag.getTimeline();
      expect(timeline.length).toBe(4); // root + 3
      expect(timeline.map((c) => c.author)).toEqual(['director', 'alpha', 'beta', 'gamma']);
    });

    test('getBranchTimeline returns linear ancestry for specific branch', () => {
      const c1 = dag.addCommit({ message: 'C1', author: 'alpha', patches: [] });
      dag.forkBranch('feat', c1.id);
      const cFeat = dag.addCommit({ message: 'CFeat', author: 'beta', patches: [] });

      const mainLineage = dag.getBranchTimeline('main');
      expect(mainLineage.map((c) => c.id)).toEqual(['commit_root', c1.id]);

      const featLineage = dag.getBranchTimeline('feat');
      expect(featLineage.map((c) => c.id)).toEqual(['commit_root', c1.id, cFeat.id]);
    });

    test('exportDAG returns serializable DAG representation', () => {
      dag.addCommit({ message: 'C1', author: 'alpha', patches: [] });
      const exported = dag.exportDAG();

      expect(exported.nodes.length).toBe(2);
      expect(exported.branches['main']).toBeDefined();
      expect(exported.activeBranchName).toBe('main');
    });
  });
});
