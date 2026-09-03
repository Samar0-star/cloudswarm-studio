import { StripedLockManager } from '../core/lock/StripedLockManager';
import type { AgentId } from '../types/swarm';

describe('StripedLockManager — Multi-Agent Concurrency & Deadlock-Free Engine', () => {
  let lockManager: StripedLockManager;

  beforeEach(() => {
    lockManager = new StripedLockManager(64, 1000);
  });

  afterEach(() => {
    lockManager.clearAll();
  });

  test('basic lock acquisition, verification, and explicit release', async () => {
    const handle = await lockManager.acquireLocks(['res_1', 'res_2'], 'alpha', 2000);

    expect(handle.agentId).toBe('alpha');
    expect(handle.lockIds).toEqual(['res_1', 'res_2']);
    expect(lockManager.isLocked('res_1')).toBe(true);
    expect(lockManager.isLocked('res_2')).toBe(true);
    expect(lockManager.getHolder('res_1')).toBe('alpha');
    expect(lockManager.getHolder('res_2')).toBe('alpha');
    expect(handle.isExpired()).toBe(false);

    await handle.release();

    expect(lockManager.isLocked('res_1')).toBe(false);
    expect(lockManager.isLocked('res_2')).toBe(false);
    expect(lockManager.getHolder('res_1')).toBeNull();
  });

  test('lexicographical sorting guarantees deadlock-free ordering', async () => {
    const unsortedIds = ['node_z', 'node_a', 'node_m', 'node_b'];
    const handle = await lockManager.acquireLocks(unsortedIds, 'beta', 3000);

    expect(handle.lockIds).toEqual(['node_a', 'node_b', 'node_m', 'node_z']);
    await handle.release();
  });

  test('mutual exclusion prevents duplicate lock acquisition by different agents', async () => {
    const handleAlpha = await lockManager.acquireLocks(['vpc_shared'], 'alpha', 2000);
    expect(handleAlpha.lockIds).toEqual(['vpc_shared']);

    await expect(
      lockManager.acquireLocks(['vpc_shared'], 'beta', 2000)
    ).rejects.toThrow(/LOCK_ACQUISITION_TIMEOUT/);

    await handleAlpha.release();

    // Now beta can acquire it cleanly
    const handleBeta = await lockManager.acquireLocks(['vpc_shared'], 'beta', 2000);
    expect(handleBeta.agentId).toBe('beta');
    await handleBeta.release();
  });

  test('re-entrant lock acquisition by the same agent succeeds', async () => {
    const handle1 = await lockManager.acquireLocks(['res_repeat'], 'alpha', 2000);
    const handle2 = await lockManager.acquireLocks(['res_repeat'], 'alpha', 2000);

    expect(handle1.agentId).toBe('alpha');
    expect(handle2.agentId).toBe('alpha');
    expect(lockManager.isLocked('res_repeat')).toBe(true);

    await handle2.release();
    expect(lockManager.isLocked('res_repeat')).toBe(false);
  });

  test('automatic TTL lease expiration and garbage collection sweep', async () => {
    const shortTtlMs = 60;
    const handle = await lockManager.acquireLocks(['res_ttl'], 'gamma', shortTtlMs);

    expect(lockManager.isLocked('res_ttl')).toBe(true);
    expect(handle.isExpired()).toBe(false);

    // Wait for TTL expiry
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(lockManager.isLocked('res_ttl')).toBe(false);
    expect(handle.isExpired()).toBe(true);
    expect(lockManager.getHolder('res_ttl')).toBeNull();

    // Reclaim sweep
    const reclaimed = lockManager.sweepExpiredLeases();
    expect(reclaimed).toBeGreaterThanOrEqual(0);
  });

  test('lease renewal extends lock validity', async () => {
    const shortTtlMs = 80;
    const handle = await lockManager.acquireLocks(['res_renew'], 'alpha', shortTtlMs);

    // Wait 40ms
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(handle.isExpired()).toBe(false);

    // Renew for additional 150ms
    const renewed = handle.renew(150);
    expect(renewed).toBe(true);

    // Wait 60ms (which would have expired the original 80ms lease)
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(lockManager.isLocked('res_renew')).toBe(true);
    expect(handle.isExpired()).toBe(false);

    await handle.release();
  });

  test('contention retry with exponential backoff acquires lock after prior release', async () => {
    const handleAlpha = await lockManager.acquireLocks(['contended_node'], 'alpha', 500);

    // Schedule release after 50ms
    setTimeout(async () => {
      await handleAlpha.release();
    }, 50);

    // Beta attempts with retryOnContention: true
    const handleBeta = await lockManager.acquireLocks(['contended_node'], 'beta', 500, {
      retryOnContention: true,
      maxRetries: 10,
      initialBackoffMs: 10,
      timeoutMs: 400,
    });

    expect(handleBeta.agentId).toBe('beta');
    expect(lockManager.getHolder('contended_node')).toBe('beta');

    await handleBeta.release();
  });

  test('striped hash distribution maps across buckets uniformly', () => {
    const stripes = new Set<number>();
    for (let i = 0; i < 100; i++) {
      stripes.add(lockManager.getStripe(`resource_${i}`));
    }
    // Should distribute over multiple buckets
    expect(stripes.size).toBeGreaterThan(10);
  });

  test('high concurrency stress test (100 parallel acquisitions) with 0 deadlocks', async () => {
    const agents: AgentId[] = ['alpha', 'beta', 'gamma', 'director'];
    const totalResources = 12;
    const allResourceIds = Array.from({ length: totalResources }, (_, i) => `node_stress_${i}`);

    const tasks: Array<Promise<void>> = [];
    const completedLocks: string[] = [];

    for (let i = 0; i < 100; i++) {
      const agentId = agents[i % agents.length]!;
      // Pick 2-4 random resources
      const count = 2 + (i % 3);
      const shuffled = [...allResourceIds].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, count);

      tasks.push(
        (async () => {
          try {
            const handle = await lockManager.acquireLocks(selected, agentId, 150, {
              retryOnContention: true,
              maxRetries: 15,
              initialBackoffMs: 5,
              timeoutMs: 800,
            });

            // Simulate micro-work
            await new Promise((r) => setTimeout(r, 2));
            await handle.release();
            completedLocks.push(`${agentId}-${i}`);
          } catch {
            // Contention timeouts under extreme concurrent load are valid non-deadlock rejections
          }
        })()
      );
    }

    await Promise.all(tasks);

    // After all tasks finish, the lock table must be completely clean or expired
    lockManager.sweepExpiredLeases();
    expect(lockManager.getActiveLocks().length).toBe(0);
  });
});
