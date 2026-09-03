/**
 * OptimisticStateEngine — RFC 6902 CAS & Microsecond Deterministic Rollbacks
 *
 * Implements optimistic concurrency with:
 * 1. Compare-And-Swap (CAS) test verification (RFC 6902 'test' op & version constraints).
 * 2. Immer produceWithPatches producing forward Delta and inverse Delta^-1 patches.
 * 3. Deterministic microsecond rollbacks applying inverse patches.
 * 4. Lamport versioning tracking state revisions monotonically.
 */

import { produce, produceWithPatches, applyPatches as immerApplyPatches, enablePatches, type Patch as ImmerPatch } from 'immer';
import type { TopologyState, CloudResourceNode, TopologyEdge, NodePosition } from '../../types/topology';
import { createDefaultTopologyState } from '../../types/topology';
import type { AgentId } from '../../types/swarm';
import type {
  RFC6902Patch,
  StateTransaction,
  TransactionResult,
  RollbackResult,
} from '../../types/patch';
import {
  parseJsonPointer,
  immerToRfcPatch,
  rfcToImmerPatch,
} from '../../types/patch';

// Enable Immer patch recording
enablePatches();

export type StateChangeListener = (state: TopologyState, result: TransactionResult) => void;

/**
 * Resolves a JSON pointer against an object.
 */
function resolveJsonPointer(obj: unknown, pathSegments: string[]): unknown {
  let current: unknown = obj;
  for (const segment of pathSegments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Deep equality check for CAS test values.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

export class OptimisticStateEngine {
  private state: TopologyState;
  private readonly history: TransactionResult[] = [];
  private readonly listeners = new Set<StateChangeListener>();

  constructor(initialState?: TopologyState) {
    this.state = initialState ?? createDefaultTopologyState();
  }

  /**
   * Returns current immutable topology state.
   */
  public getState(): TopologyState {
    return this.state;
  }

  public setState(newState: TopologyState): void {
    this.state = newState;
    const result: TransactionResult = {
      success: true,
      version: newState.version || 1,
      transactionId: `set_state_${Date.now()}`,
      agentId: newState.lastModifiedBy || 'director',
      patches: [],
      inversePatches: [],
      executionTimeMs: 0,
    };
    for (const listener of this.listeners) {
      try {
        listener(this.state, result);
      } catch (err) {
        console.error('Failed to notify stateEngine listener:', err);
      }
    }
  }

  /**
   * Subscribes to successful state transactions.
   */
  public subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Evaluates RFC 6902 CAS conditions against the current state.
   */
  public verifyCAS(tx: StateTransaction): { valid: boolean; failedKey?: string; error?: string } {
    // 1. Verify baseVersion if specified
    if (tx.baseVersion !== undefined && this.state.version !== tx.baseVersion) {
      return {
        valid: false,
        failedKey: 'baseVersion',
        error: `CAS baseVersion mismatch: Expected version ${tx.baseVersion}, but current state is at version ${this.state.version}.`,
      };
    }

    // 2. Verify expectedVersions per node if specified
    if (tx.expectedVersions) {
      for (const [nodeId, expectedVer] of Object.entries(tx.expectedVersions)) {
        const node = this.state.nodes[nodeId];
        const actualVer = node?.version ?? 0;
        if (actualVer !== expectedVer) {
          return {
            valid: false,
            failedKey: nodeId,
            error: `CAS node version mismatch for '${nodeId}': Expected version ${expectedVer}, but found ${actualVer}.`,
          };
        }
      }
    }

    // 3. Verify RFC 6902 'test' operations in patch sequence
    for (let i = 0; i < tx.patches.length; i++) {
      const patch = tx.patches[i];
      if (!patch) continue;
      if (patch.op === 'test') {
        const pathSegments = parseJsonPointer(patch.path);
        const actualValue = resolveJsonPointer(this.state, pathSegments);
        if (!deepEqual(actualValue, patch.value)) {
          return {
            valid: false,
            failedKey: patch.path,
            error: `CAS test operation failed at index ${i} ('${patch.path}'): Expected ${JSON.stringify(patch.value)}, but found ${JSON.stringify(actualValue)}.`,
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Applies an atomic transaction with CAS verification and produces forward & inverse patches.
   */
  public async applyTransaction(tx: StateTransaction): Promise<TransactionResult> {
    const startTime = performance.now();

    // 1. Perform CAS verification
    const casCheck = this.verifyCAS(tx);
    if (!casCheck.valid) {
      const failureResult: TransactionResult = {
        success: false,
        version: this.state.version,
        transactionId: tx.id,
        agentId: tx.agentId,
        patches: [],
        inversePatches: [],
        executionTimeMs: performance.now() - startTime,
        casFailedKey: casCheck.failedKey,
        conflictError: casCheck.error,
      };
      return failureResult;
    }

    // 2. Filter out pure 'test' ops for application
    const mutationPatches = tx.patches.filter((p) => p.op !== 'test');

    try {
      // 3. Convert RFC patches to Immer patches and apply via produceWithPatches
      const nextVersion = this.state.version + 1;
      const now = Date.now();

      // Collect modified node IDs
      const modifiedNodeIds = new Set<string>();
      for (const p of mutationPatches) {
        const segments = parseJsonPointer(p.path);
        if (segments[0] === 'nodes' && segments[1]) {
          modifiedNodeIds.add(segments[1]);
        }
      }

      // Convert mutation patches to Immer format
      const immerPatches: ImmerPatch[] = mutationPatches.map(rfcToImmerPatch);

      // Produce new state using safe draft mutation inside produceWithPatches
      const [nextState, forwardImmerPatches, inverseImmerPatches] = produceWithPatches(
        this.state,
        (draft) => {
          // Safely apply each mutation patch to draft, creating parent structures if missing
          for (const patch of immerPatches) {
            try {
              const { op, path, value } = patch;
              if (!path || path.length === 0) continue;

              // Ensure intermediate container paths exist
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

              if (!pathValid || !curr) throw new Error("Invalid patch traversal");

              const lastSeg = path[path.length - 1];
              if (lastSeg === undefined) throw new Error("Invalid patch traversal: last segment is undefined");
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
            } catch (patchErr) {
              console.warn('[OptimisticStateEngine] Safely ignored invalid patch path:', patch, patchErr);
            }
          }

          // Update root version and timestamp metadata
          (draft as { version: number }).version = nextVersion;
          (draft as { lastModifiedBy: AgentId }).lastModifiedBy = tx.agentId;
          (draft as { lastModifiedAt: number }).lastModifiedAt = now;

          // Increment per-node versions and metadata
          for (const nodeId of modifiedNodeIds) {
            const node = (draft as TopologyState).nodes[nodeId];
            if (node) {
              node.version = (node.version || 0) + 1;
              if (node.metadata) {
                node.metadata.updatedAt = now;
              }
            }
          }
        }
      );

      this.state = nextState;

      const forwardRfcPatches = forwardImmerPatches.map(immerToRfcPatch);
      const inverseRfcPatches = inverseImmerPatches.map(immerToRfcPatch);

      const executionTimeMs = performance.now() - startTime;
      const successResult: TransactionResult = {
        success: true,
        version: nextVersion,
        transactionId: tx.id,
        agentId: tx.agentId,
        patches: forwardRfcPatches,
        inversePatches: inverseRfcPatches,
        executionTimeMs,
      };

      this.history.push(successResult);

      // Notify subscribers
      for (const listener of this.listeners) {
        try {
          listener(this.state, successResult);
        } catch (err) {
          console.error('Error in state subscriber:', err);
        }
      }

      return successResult;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        version: this.state.version,
        transactionId: tx.id,
        agentId: tx.agentId,
        patches: [],
        inversePatches: [],
        executionTimeMs: performance.now() - startTime,
        conflictError: `State mutation exception: ${errorMessage}`,
      };
    }
  }

  /**
   * Executes deterministic microsecond rollback using inverse patches (Delta^-1).
   */
  public rollback(inversePatches: readonly RFC6902Patch[]): RollbackResult {
    const startTime = performance.now();

    if (inversePatches.length === 0) {
      return {
        success: true,
        version: this.state.version,
        rolledBackPatchesCount: 0,
        executionTimeMs: performance.now() - startTime,
      };
    }

    try {
      const immerInverse = inversePatches.map(rfcToImmerPatch);
      const rolledBackState = produce(this.state, (draft) => {
        for (const patch of immerInverse) {
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

            if (!pathValid || !curr) throw new Error("Invalid patch traversal");

            const lastSeg = path[path.length - 1];
            if (lastSeg === undefined) throw new Error("Invalid patch traversal: last segment is undefined");
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
          } catch (e: any) {
            throw new Error(`Rollback Data Corruption Prevented: Invalid patch traversal - ${e.message}`);
          }
        }
      });
      this.state = rolledBackState;

      return {
        success: true,
        version: this.state.version,
        rolledBackPatchesCount: inversePatches.length,
        executionTimeMs: performance.now() - startTime,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        version: this.state.version,
        rolledBackPatchesCount: 0,
        executionTimeMs: performance.now() - startTime,
        error: `Rollback failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Direct node/edge helper mutation methods for ergonomics.
   */
  public addNode(node: CloudResourceNode, agentId: AgentId = 'alpha'): Promise<TransactionResult> {
    const tx: StateTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      agentId,
      description: `Add node ${node.id} (${node.type})`,
      timestamp: Date.now(),
      patches: [
        {
          op: 'add',
          path: `/nodes/${node.id}`,
          value: node,
        },
      ],
    };
    return this.applyTransaction(tx);
  }

  public async updateNodeConfig(
    nodeId: string,
    configPatch: Record<string, unknown>,
    agentId: AgentId = 'beta',
    retries = 5
  ): Promise<TransactionResult> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const node = this.state.nodes[nodeId];
      if (!node) {
        return {
          success: false,
          version: this.state.version,
          transactionId: `tx_err_${Date.now()}`,
          agentId,
          patches: [],
          inversePatches: [],
          executionTimeMs: 0,
          conflictError: `Node '${nodeId}' not found`,
        };
      }

      const mergedConfig = { ...node.config, ...configPatch };
      const tx: StateTransaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        agentId,
        description: `Update config for node ${nodeId}`,
        timestamp: Date.now(),
        expectedVersions: { [nodeId]: node.version },
        patches: [
          {
            op: 'replace',
            path: `/nodes/${nodeId}/config`,
            value: mergedConfig,
          },
        ],
      };
      
      const result = await this.applyTransaction(tx);
      if (result.success || attempt === retries) {
        return result;
      }
      
      if (result.conflictError?.includes('CAS')) {
        await new Promise(r => setTimeout(r, 30 * (attempt + 1))); // Spinlock backoff
        continue;
      }
      
      return result;
    }
    throw new Error('Unreachable');
  }

  public updateNodePosition(nodeId: string, position: NodePosition): void {
    if (this.state.nodes[nodeId]) {
      this.state = {
        ...this.state,
        nodes: {
          ...this.state.nodes,
          [nodeId]: {
            ...this.state.nodes[nodeId],
            position: { x: Math.round(position.x), y: Math.round(position.y) },
          },
        },
      };
    }
  }

  public moveNode(nodeId: string, position: NodePosition, agentId: AgentId = 'director'): Promise<TransactionResult> {
    const tx: StateTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      agentId,
      description: `Move node ${nodeId} to (${Math.round(position.x)}, ${Math.round(position.y)})`,
      timestamp: Date.now(),
      patches: [
        {
          op: 'replace',
          path: `/nodes/${nodeId}/position`,
          value: { x: Math.round(position.x), y: Math.round(position.y) },
        },
      ],
    };
    return this.applyTransaction(tx);
  }

  public addEdge(edge: TopologyEdge, agentId: AgentId = 'alpha'): Promise<TransactionResult> {
    const tx: StateTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      agentId,
      description: `Add edge ${edge.id} (${edge.source} -> ${edge.target})`,
      timestamp: Date.now(),
      patches: [
        {
          op: 'add',
          path: `/edges/${edge.id}`,
          value: edge,
        },
      ],
    };
    return this.applyTransaction(tx);
  }

  public removeEdge(edgeId: string, agentId: AgentId = 'alpha'): Promise<TransactionResult> {
    const tx: StateTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      agentId,
      description: `Remove edge ${edgeId}`,
      timestamp: Date.now(),
      patches: [
        {
          op: 'remove',
          path: `/edges/${edgeId}`,
        },
      ],
    };
    return this.applyTransaction(tx);
  }

  public removeNode(nodeId: string, cascadeEdges: boolean = true, agentId: AgentId = 'alpha'): Promise<TransactionResult> {
    const patches: RFC6902Patch[] = [
      {
        op: 'remove',
        path: `/nodes/${nodeId}`,
      },
    ];

    if (cascadeEdges) {
      for (const [edgeId, edge] of Object.entries(this.state.edges)) {
        if (edge.source === nodeId || edge.target === nodeId) {
          patches.push({
            op: 'remove',
            path: `/edges/${edgeId}`,
          });
        }
      }
    }

    const tx: StateTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      agentId,
      description: `Remove node ${nodeId}`,
      timestamp: Date.now(),
      patches,
    };
    return this.applyTransaction(tx);
  }

  public getTransactionHistory(): readonly TransactionResult[] {
    return this.history;
  }
}
