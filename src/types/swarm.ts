/**
 * Agent Swarm Types for CloudSwarm Studio
 */

export type AgentId =
  | 'alpha'
  | 'beta'
  | 'gamma'
  | 'delta'
  | 'director'
  | 'human'
  | 'ext-1'
  | 'ext-2'
  | 'ext-3'
  | 'ext-4';

export type AgentRole =
  | 'compute_infra'
  | 'network_security'
  | 'storage_databases'
  | 'finops_auditor'
  | 'topology_architect'
  | 'zerotrust_secops'
  | 'director'
  | 'external_mcp';

export interface AgentPersona {
  readonly id: AgentId;
  readonly name: string;
  readonly role: AgentRole;
  readonly color: string;
  readonly hexCode: string;
  readonly glowFilter: string;
  readonly glyph: string;
  readonly avatar: string;
  readonly description: string;
}

export const AGENT_PERSONAS: Record<AgentId, AgentPersona> = {
  alpha: {
    id: 'alpha',
    name: 'Agent Atlas',
    role: 'compute_infra',
    color: 'Sky Blue',
    hexCode: '#0EA5E9',
    glowFilter: 'none',
    glyph: 'α',
    avatar: 'cpu',
    description: 'Compute & Infrastructure Architect — Synthesizes VMs (EC2/Azure VM/GCE), Kubernetes/Containers (EKS/AKS/GKE/ECS), GPU clusters (p4d/g5/NDv4/A2), and Load Balancers.',
  },
  beta: {
    id: 'beta',
    name: 'Agent Breach',
    role: 'network_security',
    color: 'Indigo',
    hexCode: '#6366F1',
    glowFilter: 'none',
    glyph: 'β',
    avatar: 'shield-alert',
    description: 'Networking & Security — Provisions VPCs/VNets, subnets, route tables, security groups, firewalls, IAM roles, KMS/Key Vault, and WAF rules.',
  },
  gamma: {
    id: 'gamma',
    name: 'Agent Forge',
    role: 'storage_databases',
    color: 'Emerald',
    hexCode: '#10B981',
    glowFilter: 'none',
    glyph: 'γ',
    avatar: 'database',
    description: 'Storage & Databases — Provisions Relational DBs (RDS/Azure SQL/Cloud SQL), NoSQL (DynamoDB/Cosmos DB/Firestore), Object storage (S3/Azure Blob/GCS), Block storage (EBS/Managed Disks), and Data Lakes.',
  },
  delta: {
    id: 'delta',
    name: 'Agent Cost',
    role: 'finops_auditor',
    color: 'Purple',
    hexCode: '#A855F7',
    glowFilter: 'none',
    glyph: 'δ',
    avatar: 'dollar-sign',
    description: 'Cost & FinOps Auditor — Calculates real-time multi-cloud run-rate pricing ($/mo), generates budget alerts, and executes rightsizing recommendations.',
  },
  director: {
    id: 'director',
    name: 'Human Director',
    role: 'director',
    color: 'Amber',
    hexCode: '#F59E0B',
    glowFilter: 'none',
    glyph: '👑',
    avatar: 'user',
    description: 'Human Supervisor & Swarm Director — Directs multi-agent workflows and inspects nodes.',
  },
  human: {
    id: 'human',
    name: 'Human Director',
    role: 'director',
    color: 'Amber',
    hexCode: '#F59E0B',
    glowFilter: 'none',
    glyph: '👑',
    avatar: 'user',
    description: 'Human Supervisor & Swarm Director — Directs multi-agent workflows and inspects nodes.',
  },
  'ext-1': {
    id: 'ext-1',
    name: 'Agent Atlas',
    role: 'compute_infra',
    color: 'Sky Blue',
    hexCode: '#0EA5E9',
    glowFilter: 'none',
    glyph: 'α',
    avatar: 'cpu',
    description: 'Compute & Infrastructure Architect.',
  },
  'ext-2': {
    id: 'ext-2',
    name: 'Agent Breach',
    role: 'network_security',
    color: 'Indigo',
    hexCode: '#6366F1',
    glowFilter: 'none',
    glyph: 'β',
    avatar: 'shield-alert',
    description: 'Networking & Security Guardian.',
  },
  'ext-3': {
    id: 'ext-3',
    name: 'Agent Forge',
    role: 'storage_databases',
    color: 'Emerald',
    hexCode: '#10B981',
    glowFilter: 'none',
    glyph: 'γ',
    avatar: 'database',
    description: 'Storage & Databases Specialist.',
  },
  'ext-4': {
    id: 'ext-4',
    name: 'Agent Cost',
    role: 'finops_auditor',
    color: 'Purple',
    hexCode: '#A855F7',
    glowFilter: 'none',
    glyph: 'δ',
    avatar: 'dollar-sign',
    description: 'Cost & FinOps Auditor.',
  },
};

/**
 * Returns the AgentPersona for any agent ID with 100% crash-proof fallback.
 * Maps any external client to the 4 core swarm agents (Atlas, Breach, Forge, Cost).
 */
export function getAgentPersona(agentId?: string | null): AgentPersona {
  if (!agentId) return AGENT_PERSONAS.alpha;
  const direct = (AGENT_PERSONAS as Record<string, AgentPersona>)[agentId];
  if (direct) return direct;

  const lower = agentId.toLowerCase();
  if (lower.includes('sec') || lower.includes('breach') || lower.includes('net') || lower.includes('guard')) {
    return AGENT_PERSONAS.beta;
  }
  if (lower.includes('db') || lower.includes('data') || lower.includes('store') || lower.includes('forge')) {
    return AGENT_PERSONAS.gamma;
  }
  if (lower.includes('cost') || lower.includes('finops') || lower.includes('price')) {
    return AGENT_PERSONAS.delta;
  }
  return AGENT_PERSONAS.alpha;
}

export interface AgentPresenceState {
  readonly agentId: AgentId;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  velocityX: number;
  velocityY: number;
  activeNodeId: string | null;
  thoughtText: string | null;
  thoughtTimestamp: number;
  isInspecting: boolean;
  isClicking?: boolean;
  actionLabel?: string;
  isDragging?: boolean;
  draggedItemType?: string;
  draggedItemName?: string;
  isVisible?: boolean;
  opacity?: number;
}

export type SwarmActionType =
  | 'LOCK'
  | 'UNLOCK'
  | 'CAS_APPLY'
  | 'CAS_ROLLBACK'
  | 'MCP_CALL'
  | 'MCP_SUCCESS'
  | 'AUDIT_VETO'
  | 'AUDIT_PASS'
  | 'FINOPS_EVAL'
  | 'SYNC_HCL'
  | 'BRANCH_FORK'
  | 'PLANNER_DECOMPOSE'
  | 'SMART_MERGE'
  | 'SWARM_PAIR_PROGRAMMING';

export interface ExecutionLogEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly latencyMs: number;
  readonly agentId: AgentId;
  readonly actionType: SwarmActionType;
  readonly message: string;
  readonly targetResourceId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface AgentSubTask {
  readonly id: string;
  readonly agentId: 'alpha' | 'beta' | 'gamma' | 'delta';
  readonly taskType: string;
  readonly description: string;
  readonly tool: string;
  readonly params: Record<string, unknown>;
  readonly targetResourceIds?: string[];
  readonly dependencies?: string[];
}

export interface SwarmDecompositionPlan {
  readonly planId: string;
  readonly architectureName: string;
  readonly targetCloud?: 'aws' | 'azure' | 'gcp' | 'multi';
  readonly reasoning: string;
  readonly tasks: AgentSubTask[];
}
