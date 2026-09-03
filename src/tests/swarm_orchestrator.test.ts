/**
 * Unit & Integration Tests for Milestone M1 (Requirement R1):
 * 4 Specialized AI Agents & Master Planner LLM Decomposition
 */

import { LiveSwarmOrchestrator } from '../core/swarm/LiveSwarmOrchestrator';
import { GeminiClient } from '../core/swarm/GeminiClient';
import { NvidiaNimClient } from '../core/swarm/NvidiaNimClient';
import { OptimisticStateEngine } from '../core/state/OptimisticStateEngine';
import { WebModelContextEngine } from '../core/webmcp/WebModelContextEngine';
import { registerTopologyTools } from '../core/webmcp/tools/topologyTools';
import { registerSecurityTools } from '../core/webmcp/tools/securityTools';
import { registerFinOpsTools } from '../core/webmcp/tools/finopsTools';
import { AGENT_PERSONAS, type AgentId, type SwarmDecompositionPlan } from '../types/swarm';
import { StripedLockManager } from '../core/lock/StripedLockManager';

describe('Milestone M1: 4 Specialized AI Agents & Master Planner Pipeline', () => {
  let stateEngine: OptimisticStateEngine;
  let webmcp: WebModelContextEngine;
  let lockManager: StripedLockManager;
  let orchestrator: LiveSwarmOrchestrator;
  let executionLogs: any[];

  beforeEach(() => {
    stateEngine = new OptimisticStateEngine();
    webmcp = new WebModelContextEngine();
    lockManager = new StripedLockManager(64, 3000);
    executionLogs = [];

    registerTopologyTools(webmcp, stateEngine);
    registerSecurityTools(webmcp, () => stateEngine.getState(), stateEngine);
    registerFinOpsTools(webmcp, () => stateEngine.getState());

    orchestrator = new LiveSwarmOrchestrator(
      new GeminiClient([]),
      webmcp,
      () => ({
        topologyState: stateEngine.getState(),
        updateAgentPresence: () => {},
        addExecutionLog: (log) => executionLogs.push(log),
        selectNode: () => {},
        stepDelayMs: 0,
        acquireLock: async (ids, agent) => {
          await lockManager.acquireLocks(ids, agent);
          return true;
        },
        releaseLock: async (ids, agent) => {
          await lockManager.releaseLocks(ids, agent);
        },
        logAction: (agentId, actionType, message, latencyMs, targetResourceId, metadata) => {
          executionLogs.push({ agentId, actionType, message, latencyMs, targetResourceId, metadata });
        },
      }),
      () => {},
      new NvidiaNimClient('')
    );
  });

  describe('1. 4 Specialized AI Agent Personas & Domain Specialization', () => {
    it('verifies 4 distinct agent personas (Alpha, Beta, Gamma, Delta) and their configurations', () => {
      // Alpha: Compute & Infrastructure
      expect(AGENT_PERSONAS.alpha.id).toBe('alpha');
      expect(AGENT_PERSONAS.alpha.name).toBe('Agent Atlas');
      expect(['compute_infra', 'topology_architect']).toContain(AGENT_PERSONAS.alpha.role);
      expect(AGENT_PERSONAS.alpha.hexCode).toBe('#0EA5E9');
      expect(AGENT_PERSONAS.alpha.glyph).toBe('α');

      // Beta: Networking & Security
      expect(AGENT_PERSONAS.beta.id).toBe('beta');
      expect(AGENT_PERSONAS.beta.name).toBe('Agent Breach');
      expect(['network_security', 'zerotrust_secops']).toContain(AGENT_PERSONAS.beta.role);
      expect(AGENT_PERSONAS.beta.hexCode).toBe('#6366F1');
      expect(AGENT_PERSONAS.beta.glyph).toBe('β');

      // Gamma: Storage & Databases
      expect(AGENT_PERSONAS.gamma.id).toBe('gamma');
      expect(['Agent Forge', 'Agent Cost']).toContain(AGENT_PERSONAS.gamma.name);
      expect(['storage_databases', 'finops_auditor']).toContain(AGENT_PERSONAS.gamma.role);
      expect(AGENT_PERSONAS.gamma.hexCode).toBe('#10B981');
      expect(AGENT_PERSONAS.gamma.glyph).toBe('γ');

      // Delta: Cost & FinOps Auditor
      expect(AGENT_PERSONAS.delta.id).toBe('delta');
      expect(['Agent Delta', 'Agent Cost']).toContain(AGENT_PERSONAS.delta.name);
      expect(AGENT_PERSONAS.delta.role).toBe('finops_auditor');
      expect(AGENT_PERSONAS.delta.hexCode).toBe('#A855F7');
      expect(AGENT_PERSONAS.delta.glyph).toBe('δ');
    });
  });

  describe('2. Master Planner LLM JSON Decomposition', () => {
    it('decomposes a user cloud request into non-overlapping JSON sub-tasks for Alpha, Beta, Gamma, and Delta', async () => {
      const plan: SwarmDecompositionPlan = await orchestrator.decomposePrompt(
        'Deploy a high-availability EKS cluster with multi-AZ PostgreSQL database, secure VPC, S3 data lake, and FinOps budget alerts'
      );

      expect(plan).toBeDefined();
      expect(plan.planId).toBeDefined();
      expect(plan.tasks.length).toBeGreaterThanOrEqual(4);

      const agentIds = plan.tasks.map((t) => t.agentId);
      expect(agentIds).toContain('alpha');
      expect(agentIds).toContain('beta');
      expect(agentIds).toContain('gamma');
      expect(agentIds).toContain('delta');

      // Check task non-overlapping roles
      const alphaTask = plan.tasks.find((t) => t.agentId === 'alpha');
      expect(alphaTask?.tool).toBe('create_resource_node');
      expect(alphaTask?.params.type).toMatch(/aws_eks_cluster|aws_instance|aws_lb/);

      const betaTask = plan.tasks.find((t) => t.agentId === 'beta');
      expect(betaTask?.tool).toMatch(/create_resource_node|apply_security_hardening/);

      const gammaTask = plan.tasks.find((t) => t.agentId === 'gamma');
      expect(gammaTask?.tool).toMatch(/create_resource_node|update_node_config/);

      const deltaTask = plan.tasks.find((t) => t.agentId === 'delta');
      expect(deltaTask?.tool).toMatch(/query_resource_pricing|calculate_topology_cost|optimize_cost_allocation/);

      // Verify planner decomposition log entry
      expect(executionLogs.some((l) => l.actionType === 'PLANNER_DECOMPOSE')).toBe(true);
    });

    it('decomposes GPU-accelerated AI architecture request appropriately', async () => {
      const plan = await orchestrator.decomposePrompt(
        'Synthesize NVIDIA A10G GPU cluster with Aurora database and encrypted S3 storage'
      );

      const alphaTask = plan.tasks.find((t) => t.agentId === 'alpha');
      expect(alphaTask).toBeDefined();
      expect(JSON.stringify(alphaTask?.params)).toMatch(/g5\.2xlarge|aws_instance|gpu/i);
    });
  });

  describe('3. Concurrent Multi-Agent Execution with Promise.all and Striped Locks', () => {
    it('executes 4-agent parallel tool calls concurrently with Promise.all and mutates Zustand topology state', async () => {
      await orchestrator.executeParallelSwarm(
        'Deploy resilient 3-tier web app with VPC, public subnet, private subnet, EKS compute, Aurora DB, and S3 bucket'
      );

      const finalState = stateEngine.getState();
      const nodeIds = Object.keys(finalState.nodes);

      expect(nodeIds.length).toBeGreaterThanOrEqual(4);
      expect(finalState.nodes['vpc_main']).toBeDefined();
      expect(finalState.nodes['db_primary']).toBeDefined();
      expect(finalState.nodes['s3_data_lake']).toBeDefined();

      // Verify database encryption was applied by Gamma/Beta
      expect(finalState.nodes['db_primary']?.config.storage_encrypted).toBe(true);

      // Verify execution logs contain attribution from all agents
      const loggedAgents = new Set(executionLogs.map((l) => l.agentId));
      expect(loggedAgents.has('alpha')).toBe(true);
      expect(loggedAgents.has('beta')).toBe(true);
      expect(loggedAgents.has('gamma') || loggedAgents.has('director')).toBe(true);
      expect(loggedAgents.has('delta')).toBe(true);
    });

    it('performs context-aware incremental hardware scaling without wiping existing topology', async () => {
      // First, create initial topology
      await webmcp.executeTool('create_resource_node', {
        id: 'ec2_app',
        type: 'aws_instance',
        name: 'App Server (EC2)',
        config: { instance_type: 't3.large' },
        position: { x: 380, y: 320 },
      }, { agentId: 'alpha' });

      await webmcp.executeTool('create_resource_node', {
        id: 'db_primary',
        type: 'aws_db_instance',
        name: 'Aurora PostgreSQL Multi-AZ',
        config: { engine: 'postgres', instance_class: 'db.r6g.xlarge' },
        position: { x: 640, y: 320 },
      }, { agentId: 'gamma' });

      const initialCount = Object.keys(stateEngine.getState().nodes).length;
      expect(initialCount).toBe(2);

      // Execute incremental GPU upgrade prompt
      await orchestrator.executeIncrementalUpgrade('Upgrade compute to NVIDIA GPU with high memory database');

      const updatedNodes = stateEngine.getState().nodes;
      expect(Object.keys(updatedNodes).length).toBe(initialCount);

      // Compute node should be upgraded to GPU instance
      expect(updatedNodes['ec2_app']?.config.instance_type).toBe('g5.2xlarge');
      expect(updatedNodes['ec2_app']?.config.root_volume_type).toBe('gp3');

      // Database node should be scaled to high-memory class
      expect(updatedNodes['db_primary']?.config.instance_class).toBe('db.r6g.4xlarge');
      expect(updatedNodes['db_primary']?.config.storage_encrypted).toBe(true);
    });
  });
});
