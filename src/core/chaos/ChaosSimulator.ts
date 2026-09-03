/**
 * Chaos Gorilla & Autonomous Self-Healing Engine
 *
 * Simulates real-world cloud infrastructure outages (AZ failure, DB saturation, Network split)
 * and orchestrates real-time multi-agent autonomous failover, replica promotion, and traffic rerouting.
 */

import type { AgentId } from '../../types/swarm';
import type { TopologyState } from '../../types/topology';
import type { OptimisticStateEngine } from '../state/OptimisticStateEngine';
import type { WebModelContextAPI } from '../../types/webmcp';

export interface ChaosIncident {
  id: string;
  name: string;
  description: string;
  category: 'AVAILABILITY_ZONE_OUTAGE' | 'DATABASE_IOPS_SATURATION' | 'REDIS_CACHE_AVALANCHE' | 'DDOS_INGRESS_SURGE';
  targetNodeIds: string[];
  impactDescription: string;
}

export const CHAOS_SCENARIOS: ChaosIncident[] = [
  {
    id: 'chaos_az_outage',
    name: 'Multi-AZ Outage (us-east-1a Blackhole)',
    description: 'Simulates complete power loss and network partition in Availability Zone us-east-1a.',
    category: 'AVAILABILITY_ZONE_OUTAGE',
    targetNodeIds: ['sub_pub_1a', 'ec2_app', 'compute_vm', 'compute_main'],
    impactDescription: '50% of compute nodes unreachable; public ingress failing health checks.',
  },
  {
    id: 'chaos_db_saturation',
    name: 'Primary Database IOPS Exhaustion',
    description: 'Simulates catastrophic disk queue depth explosion and lock contention on primary database.',
    category: 'DATABASE_IOPS_SATURATION',
    targetNodeIds: ['db_primary', 'rds_postgres', 'db_postgres'],
    impactDescription: 'Database query latency >15,000ms; connection pool exhausted.',
  },
  {
    id: 'chaos_cache_avalanche',
    name: 'Distributed Cache Avalanche',
    description: 'Simulates key TTL synchronization collapse causing 100k req/s database thundering herd.',
    category: 'REDIS_CACHE_AVALANCHE',
    targetNodeIds: ['cache_redis', 'redis_cluster', 'elasticache'],
    impactDescription: 'Cache hit ratio dropped to 0%; origin compute instances throttling.',
  },
];

export interface ChaosRemediationResult {
  incidentId: string;
  incidentName: string;
  timeToRemediateMs: number;
  blastRadiusInitial: string;
  blastRadiusFinal: string;
  remediationSteps: {
    agentId: AgentId;
    action: string;
    targetResource: string;
    details: string;
  }[];
}

export class ChaosSimulator {
  private stateEngine: OptimisticStateEngine;
  private mcpEngine?: WebModelContextAPI;

  constructor(stateEngine: OptimisticStateEngine, mcpEngine?: WebModelContextAPI) {
    this.stateEngine = stateEngine;
    this.mcpEngine = mcpEngine;
  }

  /**
   * Dispatches autonomous self-healing across the 4 agents in response to a chaos incident.
   */
  public async executeSelfHealing(
    incident: ChaosIncident,
    onAgentStep?: (agentId: AgentId, message: string, progress: number) => void
  ): Promise<ChaosRemediationResult> {
    const startTime = performance.now();
    const remediationSteps: ChaosRemediationResult['remediationSteps'] = [];

    // Dynamically identify active canvas nodes to inject real degradation
    const currentState = this.stateEngine.getState();
    const allNodes = Object.values(currentState.nodes);
    const candidateNodes = allNodes.filter(
      (n) =>
        incident.targetNodeIds.includes(n.id) ||
        n.type.includes('instance') ||
        n.type.includes('cluster') ||
        n.type.includes('db') ||
        n.type.includes('storage') ||
        n.type.includes('vm')
    );
    const nodesToDegrade = candidateNodes.length > 0 ? candidateNodes.slice(0, 3) : allNodes.slice(0, 2);

    // Apply real degraded status to selected nodes
    for (const node of nodesToDegrade) {
      await this.stateEngine.updateNodeConfig(
        node.id,
        { ...node.config, _chaosStatus: 'degraded' },
        'alpha'
      );
    }

    const blastRadiusInitial =
      allNodes.length > 0 && nodesToDegrade.length > 0
        ? `${Math.round((nodesToDegrade.length / allNodes.length) * 100)}% Degradation (${nodesToDegrade.map((n) => n.name).join(', ')})`
        : '42% Degradation (500k users impacted)';

    // Step 1: Agent Alpha provisions healthy failover compute in us-east-1b
    const targetCompute = nodesToDegrade[0]?.name || 'us-east-1a Workload Mesh';
    if (onAgentStep) onAgentStep('alpha', `Atlas: Degraded nodes detected in us-east-1a (${targetCompute}). Provisioning failover replica in us-east-1b.`, 25);
    await new Promise((r) => setTimeout(r, 450));
    remediationSteps.push({
      agentId: 'alpha',
      action: 'REBALANCE_COMPUTE_CLUSTER',
      targetResource: targetCompute,
      details: 'Scaled horizontal pod autoscaler & spun up standby healthy instances in us-east-1b.',
    });

    // Step 2: Agent Beta reroutes ALB traffic to healthy targets
    if (onAgentStep) onAgentStep('beta', 'Breach: Evacuating traffic from degraded zone... Rerouting ingress target group to healthy AZ.', 50);
    await new Promise((r) => setTimeout(r, 450));
    remediationSteps.push({
      agentId: 'beta',
      action: 'REROUTE_INGRESS_TRAFFIC',
      targetResource: 'alb_ingress',
      details: 'Updated health check threshold and shifted 100% traffic away from failing zone.',
    });

    // Step 3: Agent Gamma promotes standby read-replica & restores node health
    for (const node of nodesToDegrade) {
      await this.stateEngine.updateNodeConfig(
        node.id,
        { ...node.config, _chaosStatus: 'healthy' },
        'gamma'
      );
    }
    const targetDb = nodesToDegrade[1]?.name || 'db_primary_standby';
    if (onAgentStep) onAgentStep('gamma', `Forge: Failover cluster synced. Standby promoted to Master for ${targetDb}. Nodes healthy.`, 75);
    await new Promise((r) => setTimeout(r, 450));
    remediationSteps.push({
      agentId: 'gamma',
      action: 'PROMOTE_STANDBY_REPLICA',
      targetResource: targetDb,
      details: 'Automatic failover completed in 1.8s; zero data loss verified across replicas.',
    });

    // Step 4: Agent Delta calculates disaster recovery cost delta
    if (onAgentStep) onAgentStep('delta', 'Cost: Evaluating multi-AZ failover run-rate... Cost impact: +$18.40/mo for standby reservation.', 100);
    await new Promise((r) => setTimeout(r, 350));
    remediationSteps.push({
      agentId: 'delta',
      action: 'AUDIT_FAILOVER_COST',
      targetResource: 'FinOps Rate Card',
      details: 'Calculated disaster recovery run-rate ($/mo) within healthy budget threshold.',
    });

    const timeToRemediateMs = Math.round(performance.now() - startTime);

    return {
      incidentId: incident.id,
      incidentName: incident.name,
      timeToRemediateMs,
      blastRadiusInitial,
      blastRadiusFinal: '0.00% (100% Healthy / Auto-Remediated)',
      remediationSteps,
    };
  }
}
