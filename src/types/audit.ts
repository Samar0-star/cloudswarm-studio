/**
 * Security & FinOps Audit Types
 */
import type { AWSResourceType, CloudProvider } from './topology';

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityFinding {
  readonly id: string;
  readonly rule: string;
  readonly severity: SecuritySeverity;
  readonly category: string;
  readonly target_node_id: string;
  readonly message: string;
  readonly remediation: string;
  readonly penalty?: number;
  readonly remediationHcl?: string;
}

export type CostCategory = 'Compute' | 'Database' | 'Storage' | 'Networking' | 'Security' | 'Base Fabric';

export interface CostItem {
  readonly nodeId: string;
  readonly name: string;
  readonly type: AWSResourceType;
  readonly monthlyUsd: number;
  readonly hourlyUsd: number;
  readonly category: CostCategory;
  readonly provider?: CloudProvider;
  readonly details?: string;
}

export interface CostBreakdown {
  readonly compute: number;
  readonly database: number;
  readonly storage: number;
  readonly networking: number;
  readonly security: number;
  readonly totalMonthlyUsd: number;
  readonly totalHourlyUsd: number;
  readonly potentialSavingsUsd?: number;
}

export interface CostOptimizationRecommendation {
  readonly id: string;
  readonly title: string;
  readonly category: 'Graviton' | 'Spot' | 'Storage' | 'Idle' | 'Architecture';
  readonly description: string;
  readonly estimatedSavingsMonthlyUsd: number;
  readonly targetNodeIds: readonly string[];
  readonly actionType: string;
}

export type AuditGrade = 'A+' | 'A' | 'B' | 'C' | 'F';

export interface AuditReport {
  readonly totalMonthlyCostUsd: number;
  readonly totalHourlyCostUsd: number;
  readonly costBreakdown: readonly CostItem[];
  readonly categoryTotals: Readonly<Record<CostCategory, number>>;
  readonly securityScore: number;
  readonly grade: AuditGrade;
  readonly findings: readonly SecurityFinding[];
  readonly passedRules: readonly string[];
  readonly timestamp: number;
  readonly potentialSavingsUsd?: number;
  readonly recommendations?: readonly CostOptimizationRecommendation[];
  readonly stateSignature?: string;
}

export function computeAuditGrade(score: number): AuditGrade {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'F';
}
