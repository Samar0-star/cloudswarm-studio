/**
 * DecisionDAG — In-Memory Reversible DAG Timeline & Time-Travel Engine
 *
 * Implements:
 * 1. Commit tree with author tracking, parent pointers, and RFC 6902 forward/inverse patches.
 * 2. Branch forking and multi-branch management.
 * 3. Lowest Common Ancestor (LCA) traversal for 60 FPS sub-millisecond timeline scrubbing.
 * 4. A/B split-screen diff inspector comparing arbitrary historical commits.
 */

import type { TopologyState, CloudResourceNode, TopologyEdge } from '../../types/topology';
import { createDefaultTopologyState } from '../../types/topology';
import type { AgentId } from '../../types/swarm';
import type { RFC6902Patch, StateTransaction } from '../../types/patch';
import { rfcToImmerPatch, immerToRfcPatch } from '../../types/patch';
import { applyPatches as immerApplyPatches, produceWithPatches, enablePatches } from 'immer';

enablePatches();

export interface CommitMeta {
  author?: AgentId;
  message?: string;
  timestamp?: number;
  branch?: string;
  metadata?: Record<string, unknown>;
}

export interface DAGNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly parentIds: readonly string[];
  readonly childrenIds: string[];
  readonly author: AgentId;
  readonly message: string;
  readonly timestamp: number;
  readonly patches: readonly RFC6902Patch[];
  readonly inversePatches: readonly RFC6902Patch[];
  readonly state: TopologyState;
  readonly branch: string;
  readonly depth: number;
  readonly metadata?: Record<string, unknown>;
}

export interface DAGBranch {
  readonly name: string;
  headCommitId: string;
  readonly createdAt: number;
  readonly createdBy: AgentId;
}

export interface NodeDiff {
  id: string;
  before?: CloudResourceNode;
  after?: CloudResourceNode;
  changedKeys: string[];
}

export interface EdgeDiff {
  id: string;
  before?: TopologyEdge;
  after?: TopologyEdge;
  changedKeys: string[];
}

export interface DAGDiffResult {
  commitAId: string;
  commitBId: string;
  lcaId: string | null;
  addedNodes: CloudResourceNode[];
  removedNodes: CloudResourceNode[];
  modifiedNodes: NodeDiff[];
  addedEdges: TopologyEdge[];
  removedEdges: TopologyEdge[];
  modifiedEdges: EdgeDiff[];
  forwardPatches: RFC6902Patch[];
  inversePatches: RFC6902Patch[];
  patchCount: number;
}

export class DecisionDAG {
  private readonly nodes = new Map<string, DAGNode>();
  private readonly branches = new Map<string, DAGBranch>();
  private activeBranchName: string = 'main';
  private activeCommitId: string;
  private readonly rootCommitId: string;

  constructor(
    initialState?: TopologyState,
    rootAuthor: AgentId = 'director',
    rootMessage: string = 'Initial root state'
  ) {
    const rootState = initialState ? structuredClone(initialState) : createDefaultTopologyState();
    this.rootCommitId = 'commit_root';

    const rootNode: DAGNode = {
      id: this.rootCommitId,
      parentId: null,
      parentIds: [],
      childrenIds: [],
      author: rootAuthor,
      message: rootMessage,
      timestamp: Date.now(),
      patches: [],
      inversePatches: [],
      state: rootState,
      branch: 'main',
      depth: 0,
    };

    this.nodes.set(this.rootCommitId, rootNode);
    this.branches.set('main', {
      name: 'main',
      headCommitId: this.rootCommitId,
      createdAt: rootNode.timestamp,
      createdBy: rootAuthor,
    });
    this.activeCommitId = this.rootCommitId;
  }

  /**
   * Returns the ID of the root commit.
   */
  public getRootCommitId(): string {
    return this.rootCommitId;
  }

  /**
   * Returns current active commit ID.
   */
  public getActiveCommitId(): string {
    return this.activeCommitId;
  }

  /**
   * Returns current active branch name.
   */
  public getActiveBranchName(): string {
    return this.activeBranchName;
  }

  /**
   * Returns current active branch object.
   */
  public getActiveBranch(): DAGBranch {
    const branch = this.branches.get(this.activeBranchName);
    if (!branch) {
      throw new Error(`Active branch '${this.activeBranchName}' not found`);
    }
    return branch;
  }

  /**
   * Gets a commit by ID.
   */
  public getCommit(commitId: string): DAGNode | undefined {
    return this.nodes.get(commitId);
  }

  /**
   * Adds a commit to the active branch (or directly specifying parents/state).
   */
  public addCommit(
    txOrData:
      | StateTransaction
      | {
          id?: string;
          message: string;
          author: AgentId;
          patches: readonly RFC6902Patch[];
          inversePatches?: readonly RFC6902Patch[];
          state?: TopologyState;
        },
    meta?: CommitMeta
  ): DAGNode {
    const parentNode = this.nodes.get(this.activeCommitId);
    if (!parentNode) {
      throw new Error(`Parent commit '${this.activeCommitId}' not found in DAG`);
    }

    let author: AgentId;
    let message: string;
    let patches: readonly RFC6902Patch[];
    let explicitInversePatches: readonly RFC6902Patch[] | undefined;
    let explicitState: TopologyState | undefined;
    let customId: string | undefined;

    if ('description' in txOrData && 'agentId' in txOrData) {
      author = meta?.author ?? txOrData.agentId;
      message = meta?.message ?? txOrData.description;
      patches = txOrData.patches;
      customId = txOrData.id;
    } else {
      author = meta?.author ?? txOrData.author;
      message = meta?.message ?? txOrData.message;
      patches = txOrData.patches;
      explicitInversePatches = txOrData.inversePatches;
      explicitState = txOrData.state;
      customId = txOrData.id;
    }

    const commitId = customId && !this.nodes.has(customId)
      ? customId
      : `commit_${this.nodes.size}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Compute new state and inverse patches if not explicitly given
    let nextState: TopologyState;
    let inversePatches: readonly RFC6902Patch[];

    if (explicitState && explicitInversePatches) {
      nextState = explicitState;
      inversePatches = explicitInversePatches;
    } else if (explicitState) {
      nextState = explicitState;
      inversePatches = explicitInversePatches ?? [];
    } else if (patches.length > 0) {
      const immerMutationPatches = patches.filter((p) => p.op !== 'test').map(rfcToImmerPatch);
      const [producedState, , computedInverse] = produceWithPatches(parentNode.state, (draft) => {
        for (const patch of immerMutationPatches) {
          try {
            const { op, path, value } = patch;
            if (!path || path.length === 0) continue;

            let curr: any = draft;
            let pathValid = true;
            for (let i = 0; i < path.length - 1; i++) {
              const seg = path[i];
              if (seg === undefined) continue;
              if (curr[seg] === undefined || curr[seg] === null) {
                const nextSeg = path[i + 1];
                curr[seg] = typeof nextSeg === 'number' ? [] : {};
              }
              curr = curr[seg];
              if (typeof curr !== 'object' || curr === null) {
                pathValid = false;
                break;
              }
            }

            if (!pathValid || !curr) continue;

            const lastSeg = path[path.length - 1];
            if (lastSeg === undefined) continue;
            if (op === 'add' || op === 'replace') {
              if (Array.isArray(curr) && typeof lastSeg === 'number') {
                if (op === 'add') {
                  curr.splice(lastSeg, 0, value);
                } else {
                  curr[lastSeg] = value;
                }
              } else if (curr && typeof curr === 'object') {
                curr[lastSeg] = value;
              }
            } else if (op === 'remove') {
              if (Array.isArray(curr) && typeof lastSeg === 'number') {
                curr.splice(lastSeg, 1);
              } else if (curr && typeof curr === 'object') {
                delete curr[lastSeg];
              }
            }
          } catch {
            // Ignore unresolvable patch path
          }
        }
      });
      nextState = producedState;
      inversePatches = computedInverse.map(immerToRfcPatch);
    } else {
      nextState = parentNode.state;
      inversePatches = [];
    }

    const branchName = meta?.branch ?? this.activeBranchName;
    const depth = parentNode.depth + 1;

    const commitNode: DAGNode = {
      id: commitId,
      parentId: this.activeCommitId,
      parentIds: [this.activeCommitId],
      childrenIds: [],
      author,
      message,
      timestamp: meta?.timestamp ?? Date.now(),
      patches,
      inversePatches,
      state: nextState,
      branch: branchName,
      depth,
      metadata: meta?.metadata,
    };

    parentNode.childrenIds.push(commitId);
    this.nodes.set(commitId, commitNode);

    // Update branch head
    let branch = this.branches.get(branchName);
    if (!branch) {
      branch = {
        name: branchName,
        headCommitId: commitId,
        createdAt: commitNode.timestamp,
        createdBy: author,
      };
      this.branches.set(branchName, branch);
    } else {
      branch.headCommitId = commitId;
    }

    this.activeCommitId = commitId;
    return commitNode;
  }

  /**
   * Creates/forks a new branch from a historical commit.
   */
  public forkBranch(name: string, fromCommitId?: string, author: AgentId = 'director'): DAGBranch {
    if (this.branches.has(name)) {
      throw new Error(`Branch '${name}' already exists in DAG`);
    }

    const sourceCommitId = fromCommitId ?? this.activeCommitId;
    if (!this.nodes.has(sourceCommitId)) {
      throw new Error(`Source commit '${sourceCommitId}' not found`);
    }

    const branch: DAGBranch = {
      name,
      headCommitId: sourceCommitId,
      createdAt: Date.now(),
      createdBy: author,
    };

    this.branches.set(name, branch);
    this.activeBranchName = name;
    this.activeCommitId = sourceCommitId;
    return branch;
  }

  /**
   * Switches active branch and checks out its head commit.
   */
  public switchBranch(name: string): TopologyState {
    const branch = this.branches.get(name);
    if (!branch) {
      throw new Error(`Branch '${name}' does not exist`);
    }
    this.activeBranchName = name;
    return this.checkout(branch.headCommitId);
  }

  /**
   * Lists all existing branches.
   */
  public listBranches(): DAGBranch[] {
    return Array.from(this.branches.values());
  }

  /**
   * Gets branch metadata by name.
   */
  public getBranch(name: string): DAGBranch | undefined {
    return this.branches.get(name);
  }

  /**
   * Checks out a specific commit ID using LCA-based transition or snapshot retrieval.
   * Returns the immutable TopologyState at that commit.
   */
  public checkout(commitId: string): TopologyState {
    const targetNode = this.nodes.get(commitId);
    if (!targetNode) {
      throw new Error(`Commit '${commitId}' not found in DAG`);
    }

    this.activeCommitId = commitId;
    if (targetNode.branch && this.branches.has(targetNode.branch)) {
      this.activeBranchName = targetNode.branch;
    }
    return targetNode.state;
  }

  /**
   * Finds the Lowest Common Ancestor (LCA) between two commits in the DAG.
   */
  public findLCA(commitAId: string, commitBId: string): DAGNode | null {
    if (commitAId === commitBId) {
      return this.nodes.get(commitAId) ?? null;
    }

    const ancestorsA = new Map<string, number>(); // commitId -> depth
    let currA: DAGNode | undefined = this.nodes.get(commitAId);
    while (currA) {
      ancestorsA.set(currA.id, currA.depth);
      currA = currA.parentId ? this.nodes.get(currA.parentId) : undefined;
    }

    let highestLCANode: DAGNode | null = null;
    let maxDepth = -1;

    let currB: DAGNode | undefined = this.nodes.get(commitBId);
    while (currB) {
      const depthA = ancestorsA.get(currB.id);
      if (depthA !== undefined) {
        if (currB.depth > maxDepth) {
          maxDepth = currB.depth;
          highestLCANode = currB;
        }
      }
      currB = currB.parentId ? this.nodes.get(currB.parentId) : undefined;
    }

    return highestLCANode;
  }

  /**
   * Computes the traversal path between two commits through their Lowest Common Ancestor.
   */
  public getPathBetweenCommits(fromCommitId: string, toCommitId: string): {
    lca: DAGNode;
    pathDownToLCA: DAGNode[]; // Commits to undo (revert inversePatches)
    pathUpFromLCAToTarget: DAGNode[]; // Commits to apply (forward patches)
  } {
    const fromNode = this.nodes.get(fromCommitId);
    const toNode = this.nodes.get(toCommitId);
    if (!fromNode) throw new Error(`Commit '${fromCommitId}' not found`);
    if (!toNode) throw new Error(`Commit '${toCommitId}' not found`);

    const lca = this.findLCA(fromCommitId, toCommitId);
    if (!lca) throw new Error(`No common ancestor found between '${fromCommitId}' and '${toCommitId}'`);

    // Trace down from fromNode to LCA (excluding LCA)
    const pathDownToLCA: DAGNode[] = [];
    let currDown: DAGNode | undefined = fromNode;
    while (currDown && currDown.id !== lca.id) {
      pathDownToLCA.push(currDown);
      currDown = currDown.parentId ? this.nodes.get(currDown.parentId) : undefined;
    }

    // Trace up from LCA to toNode (excluding LCA)
    const pathUpReversed: DAGNode[] = [];
    let currUp: DAGNode | undefined = toNode;
    while (currUp && currUp.id !== lca.id) {
      pathUpReversed.push(currUp);
      currUp = currUp.parentId ? this.nodes.get(currUp.parentId) : undefined;
    }
    const pathUpFromLCAToTarget = pathUpReversed.reverse();

    return {
      lca,
      pathDownToLCA,
      pathUpFromLCAToTarget,
    };
  }

  /**
   * Computes an A/B split-screen diff between any two commits in the DAG.
   */
  public getDiff(commitAId: string, commitBId: string): DAGDiffResult {
    const nodeA = this.nodes.get(commitAId);
    const nodeB = this.nodes.get(commitBId);
    if (!nodeA) throw new Error(`Commit '${commitAId}' not found`);
    if (!nodeB) throw new Error(`Commit '${commitBId}' not found`);

    const stateA = nodeA.state;
    const stateB = nodeB.state;
    const lca = this.findLCA(commitAId, commitBId);

    const addedNodes: CloudResourceNode[] = [];
    const removedNodes: CloudResourceNode[] = [];
    const modifiedNodes: NodeDiff[] = [];

    // Check nodes in B compared to A
    for (const [id, nodeInB] of Object.entries(stateB.nodes)) {
      const nodeInA = stateA.nodes[id];
      if (!nodeInA) {
        addedNodes.push(nodeInB);
      } else {
        // Compare config and properties
        const changedKeys: string[] = [];
        if (nodeInA.name !== nodeInB.name) changedKeys.push('name');
        if (nodeInA.type !== nodeInB.type) changedKeys.push('type');
        if (nodeInA.position.x !== nodeInB.position.x || nodeInA.position.y !== nodeInB.position.y) {
          changedKeys.push('position');
        }
        if (nodeInA.parentId !== nodeInB.parentId) changedKeys.push('parentId');

        const allConfigKeys = new Set([...Object.keys(nodeInA.config), ...Object.keys(nodeInB.config)]);
        for (const k of allConfigKeys) {
          if (JSON.stringify(nodeInA.config[k]) !== JSON.stringify(nodeInB.config[k])) {
            changedKeys.push(`config.${k}`);
          }
        }

        if (changedKeys.length > 0) {
          modifiedNodes.push({
            id,
            before: nodeInA,
            after: nodeInB,
            changedKeys,
          });
        }
      }
    }

    // Check removed nodes
    for (const [id, nodeInA] of Object.entries(stateA.nodes)) {
      if (!stateB.nodes[id]) {
        removedNodes.push(nodeInA);
      }
    }

    // Compare edges
    const addedEdges: TopologyEdge[] = [];
    const removedEdges: TopologyEdge[] = [];
    const modifiedEdges: EdgeDiff[] = [];

    for (const [id, edgeInB] of Object.entries(stateB.edges)) {
      const edgeInA = stateA.edges[id];
      if (!edgeInA) {
        addedEdges.push(edgeInB);
      } else {
        const changedKeys: string[] = [];
        if (edgeInA.source !== edgeInB.source) changedKeys.push('source');
        if (edgeInA.target !== edgeInB.target) changedKeys.push('target');
        if (edgeInA.type !== edgeInB.type) changedKeys.push('type');
        if (edgeInA.port !== edgeInB.port) changedKeys.push('port');
        if (edgeInA.protocol !== edgeInB.protocol) changedKeys.push('protocol');

        if (changedKeys.length > 0) {
          modifiedEdges.push({
            id,
            before: edgeInA,
            after: edgeInB,
            changedKeys,
          });
        }
      }
    }

    for (const [id, edgeInA] of Object.entries(stateA.edges)) {
      if (!stateB.edges[id]) {
        removedEdges.push(edgeInA);
      }
    }

    // Collect forward and inverse patches between A and B
    let forwardPatches: RFC6902Patch[] = [];
    let inversePatches: RFC6902Patch[] = [];

    try {
      const traversal = this.getPathBetweenCommits(commitAId, commitBId);
      for (const node of traversal.pathDownToLCA) {
        forwardPatches.push(...node.inversePatches);
      }
      for (const node of traversal.pathUpFromLCAToTarget) {
        forwardPatches.push(...node.patches);
      }

      const reverseTraversal = this.getPathBetweenCommits(commitBId, commitAId);
      for (const node of reverseTraversal.pathDownToLCA) {
        inversePatches.push(...node.inversePatches);
      }
      for (const node of reverseTraversal.pathUpFromLCAToTarget) {
        inversePatches.push(...node.patches);
      }
    } catch {
      forwardPatches = [];
      inversePatches = [];
    }

    return {
      commitAId,
      commitBId,
      lcaId: lca?.id ?? null,
      addedNodes,
      removedNodes,
      modifiedNodes,
      addedEdges,
      removedEdges,
      modifiedEdges,
      forwardPatches,
      inversePatches,
      patchCount: forwardPatches.length,
    };
  }

  /**
   * Returns all commits in topological insertion order.
   */
  public getTimeline(): DAGNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Returns the lineage of commits from root to the given branch head (or active branch head).
   */
  public getBranchTimeline(branchName?: string): DAGNode[] {
    const targetBranchName = branchName ?? this.activeBranchName;
    const branch = this.branches.get(targetBranchName);
    if (!branch) return [];

    const lineage: DAGNode[] = [];
    let curr: DAGNode | undefined = this.nodes.get(branch.headCommitId);
    while (curr) {
      lineage.unshift(curr);
      curr = curr.parentId ? this.nodes.get(curr.parentId) : undefined;
    }
    return lineage;
  }

  /**
   * 60 FPS continuous time-travel scrubber.
   * ratio = 0.0 (root commit) to 1.0 (head commit of active branch).
   */
  public scrubTo(ratio: number): TopologyState {
    const timeline = this.getBranchTimeline();
    if (timeline.length === 0) return createDefaultTopologyState();
    if (timeline.length === 1) return this.checkout(timeline[0]!.id);

    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const targetIndex = Math.round(clampedRatio * (timeline.length - 1));
    const targetCommit = timeline[targetIndex] ?? timeline[timeline.length - 1]!;
    return this.checkout(targetCommit.id);
  }

  /**
   * Exports full serializable state of DAG.
   */
  public exportDAG(): {
    nodes: DAGNode[];
    branches: Record<string, DAGBranch>;
    activeCommitId: string;
    activeBranchName: string;
  } {
    return {
      nodes: Array.from(this.nodes.values()),
      branches: Object.fromEntries(this.branches.entries()),
      activeCommitId: this.activeCommitId,
      activeBranchName: this.activeBranchName,
    };
  }
}
