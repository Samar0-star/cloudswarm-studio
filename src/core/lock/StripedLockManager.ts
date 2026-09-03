/**
 * StripedLockManager — Multi-Agent Concurrency & Deadlock-Free Locking Engine
 *
 * Mathematical Guarantee:
 * To eliminate Coffman Circular Wait, all entity IDs requested in a batch are deduplicated
 * and sorted in strict lexicographical order before acquisition.
 *
 * Leases are bound to a Time-To-Live (TTL, default 3000ms) to ensure automatic recovery
 * if an agent encounters a runtime failure or unhandled exception.
 */

import type { AgentId } from '../../types/swarm';

export interface LockLease {
  readonly entityId: string;
  readonly holder: AgentId;
  readonly acquiredAt: number;
  expiresAt: number;
  readonly leaseTtlMs: number;
}

export interface LockHandle {
  readonly lockIds: readonly string[];
  readonly agentId: AgentId;
  readonly acquiredAt: number;
  readonly expiresAt: number;
  readonly leaseTtlMs: number;
  release: () => Promise<void>;
  isExpired: () => boolean;
  renew: (additionalTtlMs?: number) => boolean;
}

export interface LockAcquisitionOptions {
  ttlMs?: number;
  retryOnContention?: boolean;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  timeoutMs?: number;
}

export interface ActiveLockRecord {
  entityId: string;
  agentId: AgentId;
  acquiredAt: number;
  expiresAt: number;
  leaseTtlMs: number;
}

export class StripedLockManager {
  private readonly lockTable = new Map<string, LockLease>();
  private readonly numStripes: number;
  private readonly defaultTtlMs: number;

  constructor(numStripes: number = 64, defaultTtlMs: number = 3000) {
    this.numStripes = Math.max(1, numStripes);
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Hashes an entity ID to a stripe bucket index.
   */
  public getStripe(entityId: string): number {
    let hash = 0;
    for (let i = 0; i < entityId.length; i++) {
      hash = (hash << 5) - hash + entityId.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % this.numStripes;
  }

  /**
   * Acquires locks on a set of entity IDs with guaranteed deadlock-free ordering
   * and optional exponential backoff on contention.
   */
  public async acquireLocks(
    entityIds: string[],
    agentId: AgentId,
    ttlMs: number = this.defaultTtlMs,
    options?: LockAcquisitionOptions
  ): Promise<LockHandle> {
    const effectiveTtl = options?.ttlMs ?? ttlMs;
    const retry = options?.retryOnContention ?? false;
    const maxRetries = options?.maxRetries ?? 5;
    const initialBackoff = options?.initialBackoffMs ?? 10;
    const maxBackoff = options?.maxBackoffMs ?? 200;
    const timeoutMs = options?.timeoutMs ?? (retry ? 1000 : 0);

    // 1. Deduplicate and sort entity IDs lexicographically to eliminate circular wait
    const sortedIds = Array.from(new Set(entityIds)).sort();
    if (sortedIds.length === 0) {
      let currentExpiresAt = Date.now() + effectiveTtl;
      return {
        lockIds: [],
        agentId,
        acquiredAt: Date.now(),
        get expiresAt() {
          return currentExpiresAt;
        },
        leaseTtlMs: effectiveTtl,
        release: async () => {},
        isExpired: () => false,
        renew: (additionalTtl: number = effectiveTtl) => {
          currentExpiresAt = Date.now() + additionalTtl;
          return true;
        },
      };
    }

    const startTime = Date.now();
    let attempt = 0;

    while (true) {
      this.sweepExpiredLeases();

      const tryResult = this.tryAcquireBatch(sortedIds, agentId, effectiveTtl);
      if (tryResult.success) {
        const now = Date.now();
        let currentExpiresAt = now + effectiveTtl;
        const handle: LockHandle = {
          lockIds: sortedIds,
          agentId,
          acquiredAt: now,
          get expiresAt() {
            return currentExpiresAt;
          },
          leaseTtlMs: effectiveTtl,
          release: async () => {
            await this.releaseLocks(sortedIds, agentId);
          },
          isExpired: () => {
            const current = Date.now();
            for (const id of sortedIds) {
              const lease = this.lockTable.get(id);
              if (!lease || lease.holder !== agentId || lease.expiresAt <= current) {
                return true;
              }
            }
            return false;
          },
          renew: (additionalTtl: number = effectiveTtl) => {
            const renewed = this.renewBatch(sortedIds, agentId, additionalTtl);
            if (renewed) {
              currentExpiresAt = Date.now() + additionalTtl;
            }
            return renewed;
          },
        };
        return handle;
      }

      // Check if we should retry
      if (!retry || attempt >= maxRetries || (Date.now() - startTime) >= timeoutMs) {
        throw new Error(
          `LOCK_ACQUISITION_TIMEOUT: Failed to acquire locks on [${sortedIds.join(', ')}] for agent '${agentId}'. Contended by '${tryResult.contendedBy}' on '${tryResult.contendedResource}'`
        );
      }

      // Exponential backoff with jitter
      attempt++;
      const backoff = Math.min(
        maxBackoff,
        initialBackoff * Math.pow(1.5, attempt) + Math.random() * 10
      );
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  /**
   * Internal non-blocking atomic attempt to acquire all sorted IDs.
   */
  private tryAcquireBatch(
    sortedIds: string[],
    agentId: AgentId,
    ttlMs: number
  ): { success: boolean; contendedResource?: string; contendedBy?: AgentId } {
    const now = Date.now();

    // Check for conflicts
    for (const id of sortedIds) {
      const lease = this.lockTable.get(id);
      if (lease && lease.expiresAt > now && lease.holder !== agentId) {
        return {
          success: false,
          contendedResource: id,
          contendedBy: lease.holder,
        };
      }
    }

    // Atomic assignment
    for (const id of sortedIds) {
      this.lockTable.set(id, {
        entityId: id,
        holder: agentId,
        acquiredAt: now,
        expiresAt: now + ttlMs,
        leaseTtlMs: ttlMs,
      });
    }

    return { success: true };
  }

  /**
   * Releases locks by handle or entity ID list.
   */
  public async releaseLocks(
    handleOrIds: LockHandle | string[],
    agentId?: AgentId
  ): Promise<void> {
    const ids = Array.isArray(handleOrIds) ? handleOrIds : handleOrIds.lockIds;
    const targetAgent = Array.isArray(handleOrIds) ? agentId : handleOrIds.agentId;

    for (const id of ids) {
      const lease = this.lockTable.get(id);
      if (lease) {
        if (!targetAgent || lease.holder === targetAgent) {
          this.lockTable.delete(id);
        }
      }
    }
  }

  /**
   * Checks if an entity is currently locked.
   */
  public isLocked(entityId: string): boolean {
    const lease = this.lockTable.get(entityId);
    if (!lease) return false;
    if (lease.expiresAt <= Date.now()) {
      this.lockTable.delete(entityId);
      return false;
    }
    return true;
  }

  /**
   * Returns current holder of an entity lock, or null if unlocked/expired.
   */
  public getHolder(entityId: string): AgentId | null {
    const lease = this.lockTable.get(entityId);
    if (!lease) return null;
    if (lease.expiresAt <= Date.now()) {
      this.lockTable.delete(entityId);
      return null;
    }
    return lease.holder;
  }

  /**
   * Checks if all entities in the list are held by the specified agent.
   */
  public isHeldBy(entityIds: string[], agentId: AgentId): boolean {
    const now = Date.now();
    for (const id of entityIds) {
      const lease = this.lockTable.get(id);
      if (!lease || lease.holder !== agentId || lease.expiresAt <= now) {
        return false;
      }
    }
    return true;
  }

  /**
   * Renews the TTL of a single entity lock.
   */
  public renewLock(entityId: string, agentId: AgentId, additionalTtlMs: number = this.defaultTtlMs): boolean {
    const lease = this.lockTable.get(entityId);
    if (!lease || lease.holder !== agentId || lease.expiresAt <= Date.now()) {
      return false;
    }
    lease.expiresAt = Date.now() + additionalTtlMs;
    return true;
  }

  /**
   * Renews a batch of entity locks.
   */
  private renewBatch(entityIds: string[], agentId: AgentId, additionalTtlMs: number): boolean {
    const now = Date.now();
    for (const id of entityIds) {
      const lease = this.lockTable.get(id);
      if (!lease || lease.holder !== agentId || lease.expiresAt <= now) {
        return false;
      }
    }
    for (const id of entityIds) {
      const lease = this.lockTable.get(id);
      if (lease) {
        lease.expiresAt = now + additionalTtlMs;
      }
    }
    return true;
  }

  /**
   * Sweeps expired leases from the lock table.
   * Returns number of leases reclaimed.
   */
  public sweepExpiredLeases(): number {
    const now = Date.now();
    let reclaimed = 0;
    for (const [id, lease] of this.lockTable.entries()) {
      if (lease.expiresAt <= now) {
        this.lockTable.delete(id);
        reclaimed++;
      }
    }
    return reclaimed;
  }

  /**
   * Returns snapshot of all currently active (non-expired) locks.
   */
  public getActiveLocks(): ActiveLockRecord[] {
    const now = Date.now();
    const active: ActiveLockRecord[] = [];
    for (const [id, lease] of this.lockTable.entries()) {
      if (lease.expiresAt > now) {
        active.push({
          entityId: id,
          agentId: lease.holder,
          acquiredAt: lease.acquiredAt,
          expiresAt: lease.expiresAt,
          leaseTtlMs: lease.leaseTtlMs,
        });
      } else {
        this.lockTable.delete(id);
      }
    }
    return active;
  }

  /**
   * Force releases all locks across all entities (useful for reset/cleanup).
   */
  public clearAll(): void {
    this.lockTable.clear();
  }
}
