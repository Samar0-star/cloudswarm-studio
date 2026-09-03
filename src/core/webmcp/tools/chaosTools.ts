import { WebMCPTool, WebMCPExecutionContext, WebMCPToolResult } from '../../../types/webmcp';
import { useCloudSwarmStore } from '../../../store/useCloudSwarmStore';

export function createTriggerChaosTool(): WebMCPTool {
  return {
    name: 'trigger_chaos_gorilla',
    description: 'Simulates a massive Multi-AZ (Availability Zone) infrastructure outage to test the self-healing and resilience of the architecture.',
    category: 'security',
    secureContext: true,
    untrustedContentHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        scenario_id: { type: 'string', description: 'Optional ID of the chaos scenario to trigger.' }
      }
    },
    async execute(params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> {
      const scenarioId = typeof params.scenario_id === 'string' ? params.scenario_id : undefined;
      const result = await useCloudSwarmStore.getState().triggerChaosScenario(scenarioId);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'ext-1' }
      };
    }
  };
}

export function createTriggerThreatTool(): WebMCPTool {
  return {
    name: 'trigger_threat_attack',
    description: 'Simulates an aggressive Red-Team security attack against the architecture to test the zero-trust shield.',
    category: 'security',
    secureContext: true,
    untrustedContentHint: true,
    inputSchema: {
      type: 'object',
      properties: {
        threat_id: { type: 'string', description: 'Optional ID of the threat to trigger.' }
      }
    },
    async execute(params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> {
      const threatId = typeof params.threat_id === 'string' ? params.threat_id : undefined;
      const result = await useCloudSwarmStore.getState().triggerThreatScenario(threatId);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'ext-1' }
      };
    }
  };
}

export function createTriggerSelfHealingTool(): WebMCPTool {
  return {
    name: 'trigger_self_healing',
    description:
      'Dispatches autonomous multi-agent swarm remediation to automatically isolate compromised resources, repair downed AZ instances, and enforce least-privilege policies.',
    category: 'security',
    secureContext: true,
    inputSchema: {
      type: 'object',
      properties: {
        incident_id: { type: 'string', description: 'Optional specific incident identifier to resolve.' },
      },
    },
    async execute(params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> {
      const store = useCloudSwarmStore.getState();
      await store.autoRemediateSecurity();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'healed',
            message: 'Multi-agent self-healing remediation completed successfully across compute and security tiers.',
            remediated_findings: store.auditReport.findings.filter((f) => f.severity === 'low' || f.severity === 'LOW').length,
            current_cis_score: store.auditReport.securityScore,
            current_security_posture: store.auditReport.grade,
          }, null, 2),
        }],
        meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'beta' },
      };
    },
  };
}

export function createGetActiveIncidentsTool(): WebMCPTool {
  return {
    name: 'get_active_incidents',
    description:
      'Returns the list of active simulated infrastructure outages, chaos incidents, and Red-Team threat attacks.',
    category: 'security',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute(_params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> {
      const store = useCloudSwarmStore.getState();
      const nodes = store.topologyState.nodes;
      const failedNodes = Object.values(nodes).filter((n) => n.metadata?.status === 'warning' || n.metadata?.status === 'error');

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            active_outages_count: failedNodes.length,
            failed_nodes: failedNodes.map((n) => ({ id: n.id, name: n.name, type: n.type, status: n.metadata?.status })),
            active_security_findings_count: store.auditReport.findings.length,
            critical_findings: store.auditReport.findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'critical').length,
            high_findings: store.auditReport.findings.filter((f) => f.severity === 'HIGH' || f.severity === 'high').length,
          }, null, 2),
        }],
        meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'beta' },
      };
    },
  };
}

export function registerChaosTools(engine: any): () => void {
  const unregisterPromises: Array<Promise<() => void> | (() => void)> = [];
  unregisterPromises.push(engine.registerTool(createTriggerChaosTool()));
  unregisterPromises.push(engine.registerTool(createTriggerThreatTool()));
  unregisterPromises.push(engine.registerTool(createTriggerSelfHealingTool()));
  unregisterPromises.push(engine.registerTool(createGetActiveIncidentsTool()));
  return () => {
    for (const p of unregisterPromises) {
      Promise.resolve(p).then(fn => fn && fn());
    }
  };
}
