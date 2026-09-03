/**
 * RFC 6902 JSON Patch & State Transaction Types
 */
import type { Patch as ImmerPatch } from 'immer';
import type { AgentId } from './swarm';

export type RFC6902Op = 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';

export interface RFC6902Patch {
  readonly op: RFC6902Op;
  readonly path: string;
  readonly value?: unknown;
  readonly from?: string;
}

export type AnyPatch = RFC6902Patch | ImmerPatch;

export interface StateTransaction {
  readonly id: string;
  readonly agentId: AgentId;
  readonly description: string;
  readonly patches: readonly RFC6902Patch[];
  readonly expectedVersions?: Readonly<Record<string, number>>;
  readonly baseVersion?: number;
  readonly timestamp: number;
}

export interface TransactionResult {
  readonly success: boolean;
  readonly version: number;
  readonly transactionId: string;
  readonly agentId: AgentId;
  readonly patches: readonly RFC6902Patch[];
  readonly inversePatches: readonly RFC6902Patch[];
  readonly executionTimeMs: number;
  readonly casFailedKey?: string;
  readonly conflictError?: string;
}

export interface RollbackResult {
  readonly success: boolean;
  readonly version: number;
  readonly rolledBackPatchesCount: number;
  readonly executionTimeMs: number;
  readonly error?: string;
}

/**
 * Utility functions for RFC 6902 / Immer patch conversions
 */
export function formatJsonPointer(path: (string | number)[] | string): string {
  if (typeof path === 'string') {
    return path.startsWith('/') ? path : `/${path}`;
  }
  if (path.length === 0) return '';
  return '/' + path.map((segment) => String(segment).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
}

export function parseJsonPointer(pointer: string): string[] {
  if (!pointer || pointer === '/') return [];
  const clean = pointer.startsWith('/') ? pointer.slice(1) : pointer;
  return clean.split('/').map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

export function immerToRfcPatch(patch: ImmerPatch): RFC6902Patch {
  return {
    op: patch.op as RFC6902Op,
    path: formatJsonPointer(patch.path),
    value: patch.value,
  };
}

export function rfcToImmerPatch(patch: RFC6902Patch): ImmerPatch {
  return {
    op: patch.op as 'add' | 'remove' | 'replace',
    path: parseJsonPointer(patch.path),
    value: patch.value,
  };
}
