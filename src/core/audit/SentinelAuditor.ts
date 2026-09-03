/**
 * Sentinel Auditor — Reactive 60 FPS Security & FinOps Audit Engine
 *
 * Combines CostCalculator and SecurityScanner into a high-performance continuous
 * auditor with deterministic SHA-256 state signatures, memoization, and reactive subscriptions.
 */

import type {
  AuditReport,
  AuditGrade,
  CostItem,
  CostCategory,
  SecurityFinding,
} from '../../types/audit';
import type { TopologyState } from '../../types/topology';
import type { RFC6902Patch } from '../../types/patch';
import {
  CostCalculator,
  calculateMonthlyCost,
} from './CostCalculator';
import {
  SecurityScanner,
  scanSecurityCompliance,
  generateRemediationPatches,
} from './SecurityScanner';

/**
 * Standard SHA-256 round constants.
 */
const SHA256_K: readonly number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/**
 * Pure TypeScript synchronous SHA-256 implementation for deterministic,
 * zero-latency state hashing across Node and Browser environments.
 */
export function computeSha256(input: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  // UTF-8 encode input string to byte array
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      i++;
      const nextCode = input.charCodeAt(i);
      const fullCode = 0x10000 + (((code & 0x3ff) << 10) | (nextCode & 0x3ff));
      bytes.push(
        0xf0 | (fullCode >> 18),
        0x80 | ((fullCode >> 12) & 0x3f),
        0x80 | ((fullCode >> 6) & 0x3f),
        0x80 | (fullCode & 0x3f)
      );
    }
  }

  const bitLength = bytes.length * 8;

  // Append padding bit '1' (0x80)
  bytes.push(0x80);

  // Pad with zeros until message length % 64 === 56 (448 bits)
  while ((bytes.length + 8) % 64 !== 0) {
    bytes.push(0x00);
  }

  // Append original length in bits as 64-bit big-endian integer
  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;

  bytes.push((highBits >>> 24) & 0xff);
  bytes.push((highBits >>> 16) & 0xff);
  bytes.push((highBits >>> 8) & 0xff);
  bytes.push(highBits & 0xff);
  bytes.push((lowBits >>> 24) & 0xff);
  bytes.push((lowBits >>> 16) & 0xff);
  bytes.push((lowBits >>> 8) & 0xff);
  bytes.push(lowBits & 0xff);

  // Initial state variables
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  // Process 512-bit (64-byte) blocks
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const idx = offset + i * 4;
      const b0 = bytes[idx] ?? 0;
      const b1 = bytes[idx + 1] ?? 0;
      const b2 = bytes[idx + 2] ?? 0;
      const b3 = bytes[idx + 3] ?? 0;
      w[i] = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
    }

    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = (((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + (SHA256_K[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  function toHex(val: number): string {
    return val.toString(16).padStart(8, '0');
  }

  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
}

/**
 * Computes a canonical deterministic SHA-256 signature for a topology state.
 */
export function computeTopologySignature(state: TopologyState): string {
  // Sort nodes and edges deterministically
  const sortedNodeKeys = Object.keys(state.nodes).sort();
  const canonicalNodes = sortedNodeKeys.map((k) => {
    const node = state.nodes[k];
    if (!node) return null;
    return {
      id: node.id,
      type: node.type,
      name: node.name,
      config: node.config,
    };
  });

  const sortedEdgeKeys = Object.keys(state.edges).sort();
  const canonicalEdges = sortedEdgeKeys.map((k) => {
    const edge = state.edges[k];
    if (!edge) return null;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
    };
  });

  const canonicalPayload = JSON.stringify({
    version: state.version,
    nodes: canonicalNodes,
    edges: canonicalEdges,
  });

  return computeSha256(canonicalPayload);
}

/**
 * Master Sentinel Auditor combining FinOps Cost Engine and CIS/OWASP Security Scanner.
 */
export class SentinelAuditor {
  private costCalculator: CostCalculator;
  private securityScanner: SecurityScanner;

  // Memoization cache for 60 FPS reactive updates
  private cachedSignature: string | null = null;
  private cachedVersion = -1;
  private cachedReport: AuditReport | null = null;

  // Reactive listeners
  private listeners: Set<(report: AuditReport) => void> = new Set();

  constructor(costCalc?: CostCalculator, secScan?: SecurityScanner) {
    this.costCalculator = costCalc ?? new CostCalculator();
    this.securityScanner = secScan ?? new SecurityScanner();
  }

  /**
   * Generates a SHA-256 cryptographic signature representing the canonical state.
   */
  public generateStateSignature(state: TopologyState): string {
    return computeTopologySignature(state);
  }

  /**
   * Full unified audit combining cost breakdown and security evaluation.
   * Leverages internal memoization to guarantee <1ms latency at 60 FPS.
   */
  public auditTopology(state: TopologyState): AuditReport {
    const currentSignature = this.generateStateSignature(state);

    // Cache hit: return previous report if state is unchanged
    if (
      this.cachedReport !== null &&
      this.cachedVersion === state.version &&
      this.cachedSignature === currentSignature
    ) {
      return this.cachedReport;
    }

    const costBreakdown = this.costCalculator.calculateTopologyCost(state);
    const recommendations = this.costCalculator.generateRecommendations(state);
    const securityResult = this.securityScanner.scan(state);

    const report: AuditReport = {
      totalMonthlyCostUsd: costBreakdown.totalMonthlyUsd,
      totalHourlyCostUsd: costBreakdown.totalHourlyUsd,
      costBreakdown: costBreakdown.items,
      categoryTotals: costBreakdown.categoryTotals,
      securityScore: securityResult.score,
      grade: securityResult.grade,
      findings: securityResult.findings,
      passedRules: securityResult.passedRules,
      timestamp: Date.now(),
      potentialSavingsUsd: costBreakdown.potentialSavingsUsd,
      recommendations,
      stateSignature: currentSignature,
    };

    // Update cache
    this.cachedSignature = currentSignature;
    this.cachedVersion = state.version;
    this.cachedReport = report;

    // Notify reactive subscribers
    for (const listener of this.listeners) {
      try {
        listener(report);
      } catch (err) {
        console.error('Error in SentinelAuditor subscription listener:', err);
      }
    }

    return report;
  }

  /**
   * Calculates monthly and hourly costs for topology.
   */
  public calculateMonthlyCost(state: TopologyState): {
    totalMonthlyCostUsd: number;
    totalHourlyCostUsd: number;
    items: CostItem[];
    categoryTotals: Record<CostCategory, number>;
    potentialSavingsUsd: number;
  } {
    return calculateMonthlyCost(state);
  }

  /**
   * Evaluates security posture and compliance score.
   */
  public scanSecurityCompliance(state: TopologyState): {
    score: number;
    grade: AuditGrade;
    status: 'PASS' | 'PASS_WITH_WARNINGS' | 'CRITICAL_FAIL';
    findings: SecurityFinding[];
    passedRules: string[];
  } {
    return scanSecurityCompliance(state);
  }

  /**
   * Generates auto-remediation patches for all or selected security findings.
   */
  public generateRemediationPatches(
    state: TopologyState,
    targetFindingIds?: string[]
  ): RFC6902Patch[] {
    return generateRemediationPatches(state, targetFindingIds);
  }

  /**
   * Subscribes to real-time audit updates. Returns unsubscribe callback.
   */
  public subscribe(listener: (report: AuditReport) => void): () => void {
    this.listeners.add(listener);
    if (this.cachedReport) {
      listener(this.cachedReport);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Gets the most recently generated audit report, if any.
   */
  public getLatestReport(): AuditReport | null {
    return this.cachedReport;
  }

  /**
   * Clears the internal memoization cache.
   */
  public clearCache(): void {
    this.cachedSignature = null;
    this.cachedVersion = -1;
    this.cachedReport = null;
  }
}

export const sentinelAuditor = new SentinelAuditor();

/**
 * Functional export for direct integration.
 */
export function auditTopology(state: TopologyState): AuditReport {
  return sentinelAuditor.auditTopology(state);
}
