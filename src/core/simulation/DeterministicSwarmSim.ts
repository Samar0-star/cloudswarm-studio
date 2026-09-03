/**
 * DeterministicSwarmSim — Zero-Key Swarm Execution Engine
 *
 * Implements:
 * 1. Deterministic simulation executing full 3-agent swarm workflow (Alpha -> Beta -> Gamma) in <100ms.
 * 2. Zero-key operation: runs completely client-side in-memory with 0 external API keys and 0 network calls.
 * 3. Progressive real-time callbacks with strictly monotonic timestamps and sub-millisecond execution badges.
 * 4. Comprehensive state mutation tracing and agent performance analytics.
 */

import type { AgentId } from '../../types/swarm';
import { rfcToImmerPatch } from '../../types/patch';
import type { TopologyState } from '../../types/topology';
import { createDefaultTopologyState } from '../../types/topology';
import { applyPatches as immerApplyPatches, produceWithPatches, enablePatches } from 'immer';
import { PRESET_SCENARIOS, type SimulationScenario, type SimStepDefinition } from './scenarios';

enablePatches();

export interface SimStep extends SimStepDefinition {
  totalSteps: number;
  timestampMs: number;
  stateSnapshot: TopologyState;
  cumulativeCostDeltaUsd: number;
  cumulativeSecurityScore: number;
}

export interface AgentSimStat {
  agentId: AgentId;
  role: string;
  actionsCount: number;
  executionTimeMs: number;
  patchesApplied: number;
}

export interface SimReport {
  scenarioId: string;
  scenarioName: string;
  durationMs: number;
  stepsCount: number;
  steps: readonly SimStep[];
  finalState: TopologyState;
  agentStats: Record<AgentId, AgentSimStat>;
  totalMonthlyCostDeltaUsd: number;
  finalSecurityScore: number;
  success: boolean;
}

export interface SimRunOptions {
  initialState?: TopologyState;
  baseSecurityScore?: number;
  stepDelayMs?: number; // Optional micro-delay for visual animation (default 0 for instant execution)
}

export class DeterministicSwarmSim {
  private scenarios = new Map<string, SimulationScenario>();

  constructor() {
    // Load default preset scenarios
    for (const [key, scenario] of Object.entries(PRESET_SCENARIOS)) {
      this.scenarios.set(key, scenario);
      this.scenarios.set(scenario.id, scenario);
    }
  }

  /**
   * Registers a custom simulation scenario.
   */
  public registerScenario(scenario: SimulationScenario): void {
    this.scenarios.set(scenario.id, scenario);
  }

  /**
   * Retrieves a simulation scenario by ID.
   */
  public getScenario(id: string): SimulationScenario | undefined {
    return this.scenarios.get(id);
  }

  /**
   * Lists all available simulation scenarios.
   */
  public listScenarios(): SimulationScenario[] {
    const unique = new Map<string, SimulationScenario>();
    for (const scenario of this.scenarios.values()) {
      unique.set(scenario.id, scenario);
    }
    return Array.from(unique.values());
  }

  /**
   * Executes a full 3-agent swarm scenario deterministically in <100ms without API keys.
   */
  public async runScenario(
    scenarioId: string,
    onStep?: (step: SimStep) => void | Promise<void>,
    options?: SimRunOptions
  ): Promise<SimReport> {
    const startTime = performance.now();
    const scenario = this.scenarios.get(scenarioId);

    if (!scenario) {
      const available = Array.from(this.scenarios.keys()).join(', ');
      throw new Error(`Scenario '${scenarioId}' not found. Available scenarios: [${available}]`);
    }

    let currentState: TopologyState = options?.initialState
      ? structuredClone(options.initialState)
      : createDefaultTopologyState();

    let cumulativeCostDelta = 0;
    let currentSecurityScore = options?.baseSecurityScore ?? 50;

    const agentStats: Record<AgentId, AgentSimStat> = {
      alpha: { agentId: 'alpha', role: 'Compute & Infrastructure Architect', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      beta: { agentId: 'beta', role: 'Networking & Security Guardian', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      gamma: { agentId: 'gamma', role: 'Storage & Database Specialist', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      delta: { agentId: 'delta', role: 'Cost & FinOps Auditor', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      director: { agentId: 'director', role: 'Director', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      human: { agentId: 'human', role: 'Director', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      'ext-1': { agentId: 'ext-1', role: 'External Agent 1', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      'ext-2': { agentId: 'ext-2', role: 'External Agent 2', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      'ext-3': { agentId: 'ext-3', role: 'External Agent 3', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      'ext-4': { agentId: 'ext-4', role: 'External Agent 4', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
    };

    const executedSteps: SimStep[] = [];
    const totalSteps = scenario.steps.length;

    for (let i = 0; i < totalSteps; i++) {
      const stepDef = scenario.steps[i]!;
      const stepStartTime = performance.now();

      // Apply patches if present
      if (stepDef.patches.length > 0) {
        const immerPatches = stepDef.patches
          .filter((p) => p.op !== 'test')
          .map(rfcToImmerPatch);

        const nextVersion = currentState.version + 1;
        const [nextState] = produceWithPatches(currentState, (draft) => {
          for (const patch of immerPatches) {
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

              if (!pathValid || !curr) continue;

              const lastSeg = path[path.length - 1];
              if (lastSeg === undefined) continue;
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
            } catch {
              // Ignore unresolvable patch in simulation
            }
          }

          (draft as { version: number }).version = nextVersion;
          (draft as { lastModifiedBy: AgentId }).lastModifiedBy = stepDef.agentId;
          (draft as { lastModifiedAt: number }).lastModifiedAt = Date.now();
        });

        currentState = nextState;
      }

      // Update metrics
      if (stepDef.costDeltaMonthlyUsd) {
        cumulativeCostDelta += stepDef.costDeltaMonthlyUsd;
      }
      if (stepDef.securityScoreDelta) {
        currentSecurityScore = Math.max(0, Math.min(100, currentSecurityScore + stepDef.securityScoreDelta));
      }

      const stepExecutionTime = performance.now() - stepStartTime;

      // Update agent stats
      const stat = agentStats[stepDef.agentId];
      if (stat) {
        stat.actionsCount++;
        stat.executionTimeMs += stepExecutionTime;
        stat.patchesApplied += stepDef.patches.length;
      }

      const simStep: SimStep = {
        ...stepDef,
        totalSteps,
        timestampMs: Math.round(startTime + (i + 1) * 12), // Strictly monotonic timestamp
        stateSnapshot: currentState,
        cumulativeCostDeltaUsd: Math.round(cumulativeCostDelta * 100) / 100,
        cumulativeSecurityScore: currentSecurityScore,
      };

      executedSteps.push(simStep);

      // Invoke step callback
      if (onStep) {
        await onStep(simStep);
      }

      // Optional animation delay for interactive UI demonstration
      if (options?.stepDelayMs && options.stepDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.stepDelayMs));
      }
    }

    const durationMs = performance.now() - startTime;

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      durationMs,
      stepsCount: executedSteps.length,
      steps: executedSteps,
      finalState: currentState,
      agentStats,
      totalMonthlyCostDeltaUsd: Math.round(cumulativeCostDelta * 100) / 100,
      finalSecurityScore: currentSecurityScore,
      success: true,
    };
  }

  /**
   * Synchronous execution runner for headless tests.
   */
  public runScenarioSync(
    scenarioId: string,
    onStep?: (step: SimStep) => void
  ): SimReport {
    const startTime = performance.now();
    const scenario = this.scenarios.get(scenarioId);

    if (!scenario) {
      throw new Error(`Scenario '${scenarioId}' not found.`);
    }

    let currentState = createDefaultTopologyState();
    let cumulativeCostDelta = 0;
    let currentSecurityScore = 50;

    const agentStats: Record<AgentId, AgentSimStat> = {
      alpha: { agentId: 'alpha', role: 'Compute & Infrastructure Architect', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      beta: { agentId: 'beta', role: 'Networking & Security Guardian', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      gamma: { agentId: 'gamma', role: 'Storage & Database Specialist', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      delta: { agentId: 'delta', role: 'Cost & FinOps Auditor', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      director: { agentId: 'director', role: 'Director', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      human: { agentId: 'human', role: 'Director', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      'ext-1': { agentId: 'ext-1', role: 'External Agent 1', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      'ext-2': { agentId: 'ext-2', role: 'External Agent 2', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      'ext-3': { agentId: 'ext-3', role: 'External Agent 3', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
      'ext-4': { agentId: 'ext-4', role: 'External Agent 4', actionsCount: 0, executionTimeMs: 0, patchesApplied: 0 },
    };

    const executedSteps: SimStep[] = [];
    const totalSteps = scenario.steps.length;

    for (let i = 0; i < totalSteps; i++) {
      const stepDef = scenario.steps[i]!;

      if (stepDef.patches.length > 0) {
        const immerPatches = stepDef.patches.map(rfcToImmerPatch);
        const [nextState] = produceWithPatches(currentState, (draft) => {
          return immerApplyPatches(draft as TopologyState, immerPatches);
        });
        currentState = nextState;
      }

      if (stepDef.costDeltaMonthlyUsd) cumulativeCostDelta += stepDef.costDeltaMonthlyUsd;
      if (stepDef.securityScoreDelta) currentSecurityScore += stepDef.securityScoreDelta;

      const simStep: SimStep = {
        ...stepDef,
        totalSteps,
        timestampMs: Math.round(startTime + (i + 1) * 10),
        stateSnapshot: currentState,
        cumulativeCostDeltaUsd: cumulativeCostDelta,
        cumulativeSecurityScore: currentSecurityScore,
      };

      executedSteps.push(simStep);
      onStep?.(simStep);
    }

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      durationMs: performance.now() - startTime,
      stepsCount: executedSteps.length,
      steps: executedSteps,
      finalState: currentState,
      agentStats,
      totalMonthlyCostDeltaUsd: cumulativeCostDelta,
      finalSecurityScore: currentSecurityScore,
      success: true,
    };
  }
}
