/**
 * CloudSwarm Studio — Master Zustand Store
 *
 * Unifies:
 * 1. OptimisticStateEngine & StripedLockManager (Deadlock-free concurrency & CAS rollbacks)
 * 2. WebModelContextEngine (document.modelContext browser standard)
 * 3. SentinelAuditor (60 FPS $/mo FinOps pricing & OWASP/CIS security audit)
 * 4. DecisionDAG (Time-travel DAG history, LCA delta scrubbing, A/B branching)
 * 5. HCLSyncEngine (Live bidirectional Canvas <-> Terraform HCL2 AST sync)
 * 6. DeterministicSwarmSim (Zero-key 3-agent swarm execution in <100ms)
 * 7. ProductionMaterializer (1-click export generator)
 */

import { create } from 'zustand';
import type {
  TopologyState,
  CloudResourceNode,
  TopologyEdge,
  NodePosition,
} from '../types/topology';
import { createDefaultTopologyState } from '../types/topology';
import type {
  AgentId,
  AgentPresenceState,
  ExecutionLogEntry,
  SwarmActionType,
} from '../types/swarm';
import { AGENT_PERSONAS } from '../types/swarm';
import type { RFC6902Patch, StateTransaction, TransactionResult } from '../types/patch';
import type { AuditReport } from '../types/audit';
import { StripedLockManager, type ActiveLockRecord } from '../core/lock/StripedLockManager';
import { OptimisticStateEngine } from '../core/state/OptimisticStateEngine';
import { ensureWebModelContext } from '../core/webmcp/polyfill';
import type { WebModelContextAPI } from '../types/webmcp';
import { SentinelAuditor } from '../core/audit/SentinelAuditor';
import { DecisionDAG, type DAGNode, type DAGBranch, type DAGDiffResult } from '../core/dag/DecisionDAG';
import { HCLSyncEngine } from '../core/sync/HCLSyncEngine';
import { DeterministicSwarmSim, type SimStep, type SimReport } from '../core/simulation/DeterministicSwarmSim';
import { PRESET_SCENARIOS, type SimulationScenario } from '../core/simulation/scenarios';
import { ProductionMaterializer } from '../core/export/ProductionMaterializer';
import { NvidiaNimClient } from '../core/swarm/NvidiaNimClient';
import { GeminiClient } from '../core/swarm/GeminiClient';
import { LiveSwarmOrchestrator } from '../core/swarm/LiveSwarmOrchestrator';
import { registerTopologyTools } from '../core/webmcp/tools/topologyTools';
import { registerSecurityTools } from '../core/webmcp/tools/securityTools';
import { applyAutoLayout, autoConnectTopology } from '../core/layout/autoLayout';
import { registerFinOpsTools } from "../core/webmcp/tools/finopsTools";
import { registerChaosTools } from "../core/webmcp/tools/chaosTools";
import { registerDAGTools } from '../core/webmcp/tools/dagTools';
import { registerHCLTools } from '../core/webmcp/tools/hclTools';
import { registerCatalogTools } from '../core/webmcp/tools/catalogTools';
import { CLOUD_RESOURCE_CATALOG } from '../core/catalog/resourceCatalog';
import { ChaosSimulator, CHAOS_SCENARIOS, type ChaosIncident, type ChaosRemediationResult } from '../core/chaos/ChaosSimulator';
import { ThreatDefenseSimulator, THREAT_VECTORS, type ThreatVector, type ThreatDefenseResult } from '../core/threat/ThreatDefenseSimulator';

// ============================================================================
// Store State Interface
// ============================================================================

export interface CloudSwarmState {
  // Core Engines
  lockManager: StripedLockManager;
  stateEngine: OptimisticStateEngine;
  mcpEngine: WebModelContextAPI;
  auditor: SentinelAuditor;
  dag: DecisionDAG;
  swarmSim: DeterministicSwarmSim;

  // Topology State
  topologyState: TopologyState;
  selectedNodeId: string | null;
  inspectedNodeId: string | null;
  hoveredNodeId: string | null;
  selectedEdgeId: string | null;

  // Multi-Agent Multiplayer Spatial Presence
  agentPresences: Record<AgentId, AgentPresenceState>;
  activeLocks: ActiveLockRecord[];

  // HUD & Execution Logs
  executionLogs: ExecutionLogEntry[];
  auditReport: AuditReport;
  activeHudTab: 'terminal' | 'diff' | 'auditor';
  isDrawerOpen: boolean;
  drawerHeight: number;

  // Time-Travel Decision DAG
  dagTimeline: DAGNode[];
  activeCommitId: string;
  activeBranchName: string;
  branches: DAGBranch[];
  isSplitComparisonOpen: boolean;
  splitCompareCommitId: string | null;
  splitDiffResult: DAGDiffResult | null;

  // Bi-Directional HCL Editor
  hclCode: string;
  isHclDirty: boolean;
  isHclEditorOpen: boolean;

  // LLM Engine & API Configuration
  engineMode: 'live_gemini' | 'live_nim' | 'simulator';
  nvidiaApiKey: string;
  googleApiKeys: string[];
  selectedModel: string;
  isApiSettingsOpen: boolean;
  nimClient: NvidiaNimClient;
  geminiClient: GeminiClient;
  liveOrchestrator: LiveSwarmOrchestrator;
  // Swarm Simulator & Concurrency
  isSimulating: boolean;
  simulationProgress: number; // 0 to 100
  selectedScenarioId: string;
  stepDelayMs: number;

  // Production Exporter
  isExportModalOpen: boolean;
  isExporting: boolean;

  // Canvas Viewport Controls
  canvasZoom: number;
  canvasPan: { x: number; y: number };

  // Actions
  setEngineMode: (mode: 'live_gemini' | 'live_nim' | 'simulator') => void;
  setNvidiaApiKey: (key: string) => void;
  setGoogleApiKeys: (keys: string | string[]) => void;
  setSelectedModel: (model: string) => void;
  setIsApiSettingsOpen: (open: boolean) => void;
  addExecutionLog: (log: { agentId: AgentId; actionType: SwarmActionType; summary: string; targetEntityId?: string; durationMs?: number }) => void;
  executeSwarmPrompt: (userPrompt: string, singleAgentOnly?: boolean) => Promise<void>;
  updateNode: (nodeId: string, updates: Partial<CloudResourceNode>) => Promise<TransactionResult>;

  runSwarmDemo: (scenarioId?: string) => Promise<SimReport>;
  stopSwarmDemo: () => void;
  setSelectedScenarioId: (id: string) => void;
  setStepDelayMs: (ms: number) => void;

  applyTransaction: (tx: StateTransaction) => Promise<TransactionResult>;
  rollback: (inversePatches: readonly RFC6902Patch[]) => void;
  acquireLock: (entityIds: string[], agentId: AgentId) => Promise<boolean>;
  releaseLock: (entityIds: string[], agentId: AgentId) => Promise<void>;

  updateAgentPresence: (agentId: AgentId, updates: Partial<AgentPresenceState>) => void;
  selectNode: (nodeId: string | null) => void;
  openInspector: (nodeId: string | null) => void;
  closeInspector: () => void;
  setHoveredNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;

  moveNode: (nodeId: string, position: NodePosition) => Promise<TransactionResult | void>;
  addNode: (node: CloudResourceNode, agentId?: AgentId) => Promise<TransactionResult>;
  removeNode: (nodeId: string, agentId?: AgentId) => Promise<TransactionResult>;
  updateNodeConfig: (nodeId: string, configPatch: Record<string, unknown>, agentId?: AgentId) => Promise<TransactionResult>;
  addEdge: (edge: TopologyEdge, agentId?: AgentId) => Promise<TransactionResult>;
  removeEdge: (edgeId: string, agentId?: AgentId) => Promise<TransactionResult>;
  applyAutoLayoutToCanvas: () => void;

  autoRemediateSecurity: (findingIds?: string[]) => Promise<void>;
  applyFinOpsOptimization: () => Promise<void>;
  summonAgent: (
    agentId: AgentId,
    targetNodeId?: string,
    actionType?: 'inspect' | 'remediate' | 'optimize' | 'autowire' | 'chaos'
  ) => Promise<void>;

  setHclCode: (code: string) => void;
  syncHclToCanvas: (hclString: string) => Promise<void>;
  syncCanvasToHcl: () => void;

  scrubDagTimeline: (ratio: number) => void;
  checkoutDagCommit: (commitId: string) => void;
  forkDagBranch: (name: string, fromCommitId?: string) => void;
  switchDagBranch: (name: string) => void;
  openSplitComparison: (commitAId?: string, commitBId?: string) => void;
  closeSplitComparison: () => void;

  setActiveHudTab: (tab: 'terminal' | 'diff' | 'auditor') => void;
  setIsDrawerOpen: (open: boolean) => void;
  setDrawerHeight: (height: number) => void;
  setIsHclEditorOpen: (open: boolean) => void;
  setIsExportModalOpen: (open: boolean) => void;

  isCostModalOpen: boolean;
  setIsCostModalOpen: (open: boolean) => void;
  isSecurityModalOpen: boolean;
  setIsSecurityModalOpen: (open: boolean) => void;
  monthlyBudgetUsd: number;
  setMonthlyBudgetUsd: (budget: number) => void;
  isPaletteOpen: boolean;
  setIsPaletteOpen: (open: boolean) => void;
  lastExecutionSummary: {
    title: string;
    costUsd: number;
    cisScore: number;
    nodeCount: number;
    durationSec: number;
    timestamp: number;
  } | null;
  setLastExecutionSummary: (summary: {
    title: string;
    costUsd: number;
    cisScore: number;
    nodeCount: number;
    durationSec: number;
    timestamp: number;
  } | null) => void;
  isSummaryCardVisible: boolean;
  setIsSummaryCardVisible: (visible: boolean) => void;

  // VIP Guided Judge Tour
  isTourOpen: boolean;
  currentTourStep: number;
  setIsTourOpen: (open: boolean) => void;
  setCurrentTourStep: (step: number) => void;

  // Chaos Gorilla & Self-Healing Simulator
  isChaosActive: boolean;
  activeChaosIncident: ChaosIncident | null;
  triggerChaosScenario: (scenarioId?: string) => Promise<ChaosRemediationResult>;

  // Red-Team Threat Attack & Defense Simulator
  isThreatSimActive: boolean;
  activeThreatVector: ThreatVector | null;
  isShieldActive: boolean;
  triggerThreatScenario: (threatId?: string) => Promise<ThreatDefenseResult>;

  setCanvasZoom: (zoom: number) => void;
  setCanvasPan: (pan: { x: number; y: number }) => void;
  resetCanvasView: () => void;

  exportProductionBundle: () => Promise<Blob>;
  resetTopology: () => void;
  loadSavedTopology: (savedState: TopologyState) => void;
  logAction: (agentId: AgentId, actionType: SwarmActionType, message: string, latencyMs?: number, targetResourceId?: string, metadata?: Record<string, unknown>) => void;
}

// ============================================================================
// Default Initial States
// ============================================================================

const initialPresences: Record<AgentId, AgentPresenceState> = {
  alpha: {
    agentId: 'alpha',
    currentX: 180,
    currentY: 90,
    targetX: 180,
    targetY: 90,
    velocityX: 0,
    velocityY: 0,
    activeNodeId: null,
    thoughtText: 'Atlas: Compute & infra architect standing by.',
    thoughtTimestamp: Date.now(),
    isInspecting: false,
    isVisible: false,
    opacity: 0,
    actionLabel: 'Standing by',
  },
  beta: {
    agentId: 'beta',
    currentX: 860,
    currentY: 90,
    targetX: 860,
    targetY: 90,
    velocityX: 0,
    velocityY: 0,
    activeNodeId: null,
    thoughtText: 'Breach: Sentinel Zero-Trust shield armed.',
    thoughtTimestamp: Date.now(),
    isInspecting: false,
    isVisible: false,
    opacity: 0,
    actionLabel: 'Standing by',
  },
  gamma: {
    agentId: 'gamma',
    currentX: 180,
    currentY: 560,
    targetX: 180,
    targetY: 560,
    velocityX: 0,
    velocityY: 0,
    activeNodeId: null,
    thoughtText: 'Forge: Database & storage lake ready.',
    thoughtTimestamp: Date.now(),
    isInspecting: false,
    isVisible: false,
    opacity: 0,
    actionLabel: 'Standing by',
  },
  delta: {
    agentId: 'delta',
    currentX: 860,
    currentY: 560,
    targetX: 860,
    targetY: 560,
    velocityX: 0,
    velocityY: 0,
    activeNodeId: null,
    thoughtText: 'Cost: FinOps rate card engine active.',
    thoughtTimestamp: Date.now(),
    isInspecting: false,
    isVisible: false,
    opacity: 0,
    actionLabel: 'Standing by',
  },
  director: {
    agentId: 'director',
    currentX: 100,
    currentY: 100,
    targetX: 100,
    targetY: 100,
    velocityX: 0,
    velocityY: 0,
    activeNodeId: null,
    thoughtText: 'Human Director in control.',
    thoughtTimestamp: Date.now(),
    isInspecting: false,
  },
  human: {
    agentId: 'human',
    currentX: 100,
    currentY: 100,
    targetX: 100,
    targetY: 100,
    velocityX: 0,
    velocityY: 0,
    activeNodeId: null,
    thoughtText: 'Human Director in control.',
    thoughtTimestamp: Date.now(),
    isInspecting: false,
  },
  'ext-1': {
    agentId: 'ext-1',
    currentX: -200,
    currentY: -200,
    targetX: -200,
    targetY: -200,
    velocityX: 0,
    velocityY: 0,
    activeNodeId: null,
    thoughtText: 'WebMCP Terminal Agent 1 ready.',
    thoughtTimestamp: Date.now(),
    isInspecting: false,
    isClicking: false,
    actionLabel: 'Standing by',
    isVisible: false,
    opacity: 0,
  },
  'ext-2': {
    agentId: 'ext-2',
    currentX: -200,
    currentY: -200,
    targetX: -200,
    targetY: -200,
    velocityX: 0,
    velocityY: 0,
    activeNodeId: null,
    thoughtText: 'WebMCP Terminal Agent 2 ready.',
    thoughtTimestamp: Date.now(),
    isInspecting: false,
    isClicking: false,
    actionLabel: 'Standing by',
    isVisible: false,
    opacity: 0,
  },
  'ext-3': {
    agentId: 'ext-3',
    currentX: -200,
    currentY: -200,
    targetX: -200,
    targetY: -200,
    velocityX: 0,
    velocityY: 0,
    activeNodeId: null,
    thoughtText: 'WebMCP Terminal Agent 3 ready.',
    thoughtTimestamp: Date.now(),
    isInspecting: false,
    isClicking: false,
    actionLabel: 'Standing by',
    isVisible: false,
    opacity: 0,
  },
  'ext-4': {
    agentId: 'ext-4',
    currentX: -200,
    currentY: -200,
    targetX: -200,
    targetY: -200,
    velocityX: 0,
    velocityY: 0,
    activeNodeId: null,
    thoughtText: 'WebMCP Terminal Agent 4 ready.',
    thoughtTimestamp: Date.now(),
    isInspecting: false,
    isClicking: false,
    actionLabel: 'Standing by',
    isVisible: false,
    opacity: 0,
  },
};

// ============================================================================
// Zustand Store Implementation
// ============================================================================

export const useCloudSwarmStore = create<CloudSwarmState>((set, get) => {
  // Initialize Singletons
  const lockManager = new StripedLockManager(64, 3000);
  const stateEngine = new OptimisticStateEngine();
  const mcpEngine = ensureWebModelContext();
  const auditor = new SentinelAuditor();
  const initialTopology = createDefaultTopologyState();
  const dag = new DecisionDAG(initialTopology, 'director', 'Initial Root Canvas');
  const swarmSim = new DeterministicSwarmSim();

  const initialReport = auditor.auditTopology(initialTopology);
  const initialHcl = HCLSyncEngine.canvasToHcl(initialTopology);

  const defaultApiKey =
    typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem('CLOUD_SWARM_NVIDIA_KEY') || ''
      : '';
  const envKeys =
    typeof process !== 'undefined' && process.env
      ? (process.env.VITE_GEMINI_API_KEYS || process.env.VITE_GEMINI_API_KEY || '')
      : '';
  const defaultGoogleKeys = envKeys ? envKeys.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0) : [];
  const storedGoogleKeys =
    typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem('CLOUD_SWARM_GOOGLE_KEYS')
      : null;
  const initialGoogleKeys = storedGoogleKeys ? storedGoogleKeys.split(',') : defaultGoogleKeys;

  const geminiClient = new GeminiClient(initialGoogleKeys, '/api/gemini/v1beta/openai', 'gemini-2.5-flash');
  const nimClient = new NvidiaNimClient(defaultApiKey);
  const liveOrchestrator = new LiveSwarmOrchestrator(
    geminiClient,
    mcpEngine,
    () => get() as any,
    (partial) => set(partial as any),
    nimClient
  );

  // Register WebMCP tools with this stateEngine so tool invocations mutate the active state
  registerTopologyTools(mcpEngine, stateEngine);
  registerSecurityTools(mcpEngine, () => get()?.topologyState ?? stateEngine.getState(), stateEngine);
  registerFinOpsTools(mcpEngine, () => get()?.topologyState ?? stateEngine.getState());
  registerChaosTools(mcpEngine);
  registerCatalogTools(mcpEngine);

  registerDAGTools(mcpEngine, {
    getDag: () => dag,
    getState: () => get()?.topologyState ?? stateEngine.getState(),
    setState: (newState) => {
      stateEngine.setState(newState);
      set({ topologyState: newState });
    },
    checkoutCommit: (commitId) => get()?.checkoutDagCommit?.(commitId),
    forkBranch: (name, fromCommitId) => get()?.forkDagBranch?.(name, fromCommitId),
    switchBranch: (name) => get()?.switchDagBranch?.(name),
  });

  registerHCLTools(mcpEngine, {
    getState: () => get()?.topologyState ?? stateEngine.getState(),
    setState: (newState) => {
      stateEngine.setState(newState);
      set({ topologyState: newState });
    },
    syncHclToCanvas: async (hcl) => {
      await get()?.syncHclToCanvas?.(hcl);
    },
  });

  // Register WebMCP resources so external agents (ChatGPT Desktop, Claude, Terminal) can inspect live state
  if (typeof mcpEngine.registerResource === 'function') {
    try {
      mcpEngine.registerResource({
        uri: 'cloudswarm://topology/current',
        name: 'Current Canvas Topology',
        description: 'Live snapshot of all nodes, edges, and configurations currently on the CloudSwarm Studio canvas.',
        mimeType: 'application/json',
        read: async () => ({
          contents: [{
            uri: 'cloudswarm://topology/current',
            mimeType: 'application/json',
            text: JSON.stringify(get()?.topologyState ?? stateEngine.getState()),
          }],
        }),
      });

      mcpEngine.registerResource({
        uri: 'cloudswarm://dag/history',
        name: 'Decision DAG Timeline & History',
        description: 'Chronological commit lineage, author records, and branch pointers in the Decision DAG.',
        mimeType: 'application/json',
        read: async () => ({
          contents: [{
            uri: 'cloudswarm://dag/history',
            mimeType: 'application/json',
            text: JSON.stringify({
              active_branch: dag.getActiveBranch().name,
              commits: dag.getTimeline().map((c: DAGNode, i: number) => ({
                step_index: i,
                id: c.id,
                author: c.author,
                message: c.message,
                branch: c.branch,
                timestamp: c.timestamp,
                node_count: Object.keys(c.state.nodes).length,
              })),
            }),
          }],
        }),
      });

      mcpEngine.registerResource({
        uri: 'cloudswarm://terraform/hcl',
        name: 'Generated Terraform HCL Code',
        description: 'Real-time compilable HashiCorp Terraform / OpenTofu HCL2 code for the current canvas topology.',
        mimeType: 'text/plain',
        read: async () => ({
          contents: [{
            uri: 'cloudswarm://terraform/hcl',
            mimeType: 'text/plain',
            text: HCLSyncEngine.canvasToHcl(get()?.topologyState ?? stateEngine.getState()),
          }],
        }),
      });

      mcpEngine.registerResource({
        uri: 'cloudswarm://audit/security',
        name: 'Security & Zero-Trust Audit Report',
        description: 'Real-time CIS benchmark score, posture, and findings list for the active topology.',
        mimeType: 'application/json',
        read: async () => ({
          contents: [{
            uri: 'cloudswarm://audit/security',
            mimeType: 'application/json',
            text: JSON.stringify(get()?.auditReport ?? {}),
          }],
        }),
      });

      mcpEngine.registerResource({
        uri: 'cloudswarm://catalog/primitives',
        name: 'Cloud CAD Primitives Catalog',
        description: 'Full catalog of 108 cloud primitives across AWS, Azure, and GCP.',
        mimeType: 'application/json',
        read: async () => ({
          contents: [{
            uri: 'cloudswarm://catalog/primitives',
            mimeType: 'application/json',
            text: JSON.stringify(CLOUD_RESOURCE_CATALOG),
          }],
        }),
      });
    } catch (e) {
      console.warn('[WebMCP] Failed to register resources:', e);
    }
  }

  // Attach live WebMCP protocol telemetry listeners to log external and internal agent calls
  mcpEngine.addEventListener('webmcp:tool-call', (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail) {
      const toolName = detail.toolName || 'unknown_tool';
      const explicit = detail.context?.agentId;

      // Map tool call to the corresponding specialized swarm agent among the 4 (Alpha, Beta, Gamma, Delta)
      let targetAgentId: AgentId = 'alpha';
      if (
        explicit === 'alpha' ||
        explicit === 'beta' ||
        explicit === 'gamma' ||
        explicit === 'delta' ||
        (typeof explicit === 'string' && explicit.startsWith('ext-'))
      ) {
        targetAgentId = explicit as AgentId;
      } else {
        const lowerTool = toolName.toLowerCase();
        if (
          lowerTool.includes('security') ||
          lowerTool.includes('iam') ||
          lowerTool.includes('threat') ||
          lowerTool.includes('audit') ||
          lowerTool.includes('compliance') ||
          lowerTool.includes('policy') ||
          lowerTool.includes('hardening') ||
          lowerTool.includes('chaos') ||
          lowerTool.includes('self_healing') ||
          lowerTool.includes('incident')
        ) {
          targetAgentId = 'beta'; // Agent Breach (Security & Networking)
        } else if (
          lowerTool.includes('cost') ||
          lowerTool.includes('pricing') ||
          lowerTool.includes('finops') ||
          lowerTool.includes('lock') ||
          lowerTool.includes('allocation')
        ) {
          targetAgentId = 'delta'; // Agent Cost (FinOps Auditor)
        } else {
          const rawType = String(detail.params?.type || detail.params?.resource_type || '');
          const rawId = String(detail.params?.id || detail.params?.node_id || detail.params?.target_id || '');
          if (
            rawType.includes('db') ||
            rawType.includes('sql') ||
            rawType.includes('storage') ||
            rawType.includes('s3') ||
            rawType.includes('bucket') ||
            rawType.includes('postgres') ||
            rawType.includes('redis') ||
            rawType.includes('dynamo') ||
            rawType.includes('cosmos') ||
            rawId.includes('db') ||
            rawId.includes('data') ||
            rawId.includes('storage')
          ) {
            targetAgentId = 'gamma'; // Agent Forge (Storage & Databases)
          } else {
            targetAgentId = 'alpha'; // Agent Atlas (Compute & Infrastructure)
          }
        }
      }

      const storeState = get();
      if (storeState?.logAction) {
        storeState.logAction(
          targetAgentId,
          'MCP_CALL',
          `[WebMCP] Tool Invoc: ${toolName}(${JSON.stringify(detail.params || {})})`,
          0.1
        );
      }

      if (storeState?.updateAgentPresence) {
        if (externalAgentTimeouts.has(targetAgentId)) {
          clearTimeout(externalAgentTimeouts.get(targetAgentId)!);
          externalAgentTimeouts.delete(targetAgentId);
        }

        const nodes = storeState.topologyState?.nodes ?? {};

        // Special handling for connect_resources: multi-hop source -> target glide and clicks
        if (toolName === 'connect_resources') {
          const rawSourceId = String(detail.params?.source_id ?? detail.params?.sourceNodeId ?? detail.params?.source ?? '');
          const rawTargetId = String(detail.params?.target_id ?? detail.params?.targetNodeId ?? detail.params?.target ?? '');

          const sourceNode = nodes[rawSourceId] || Object.values(nodes).find((n) => n.name === rawSourceId || n.id.toLowerCase() === rawSourceId.toLowerCase());
          const targetNode = nodes[rawTargetId] || Object.values(nodes).find((n) => n.name === rawTargetId || n.id.toLowerCase() === rawTargetId.toLowerCase());

          const sourceX = sourceNode ? sourceNode.position.x + 115 : 280;
          const sourceY = sourceNode ? sourceNode.position.y + 40 : 200;
          const targetX = targetNode ? targetNode.position.x + 115 : sourceX + 250;
          const targetY = targetNode ? targetNode.position.y + 40 : sourceY;

          // Step 1: Target sourceNode (center), trigger click
          storeState.updateAgentPresence(targetAgentId, {
            isVisible: true,
            opacity: 1,
            actionLabel: `Connecting ${sourceNode?.name || rawSourceId}...`,
            targetX: sourceX,
            targetY: sourceY,
            activeNodeId: sourceNode?.id || rawSourceId || null,
            isInspecting: true,
            isClicking: true,
          });

          const clickTimer1 = setTimeout(() => {
            get()?.updateAgentPresence(targetAgentId, { isClicking: false });
          }, 200);
          if (typeof clickTimer1 === 'object' && clickTimer1 !== null && 'unref' in clickTimer1) (clickTimer1 as any).unref();

          // Step 2: After 250ms, target targetNode (center) with action label and trigger click!
          const connectTimer = setTimeout(() => {
            get()?.updateAgentPresence(targetAgentId, {
              targetX,
              targetY,
              activeNodeId: targetNode?.id || rawTargetId || null,
              actionLabel: `Linking to ${targetNode?.name || rawTargetId}`,
              isClicking: true,
            });
            const clickTimer2 = setTimeout(() => {
              get()?.updateAgentPresence(targetAgentId, { isClicking: false });
            }, 300);
            if (typeof clickTimer2 === 'object' && clickTimer2 !== null && 'unref' in clickTimer2) (clickTimer2 as any).unref();
          }, 250);
          if (typeof connectTimer === 'object' && connectTimer !== null && 'unref' in connectTimer) (connectTimer as any).unref();
          return;
        }

        // Target exact node center (node.position.x + 115, node.position.y + 40)
        let targetX: number;
        let targetY: number;

        const targetNodeId = String(detail.params?.node_id ?? detail.params?.id ?? detail.params?.source_id ?? '');
        const targetNode = nodes[targetNodeId] || Object.values(nodes).find((n) => n.name === targetNodeId || n.id.toLowerCase() === targetNodeId.toLowerCase());

        if (detail.params?.position && typeof detail.params.position === 'object') {
          const pos = detail.params.position as { x?: number; y?: number };
          const posX = typeof pos.x === 'number' ? pos.x : 200;
          const posY = typeof pos.y === 'number' ? pos.y : 200;
          targetX = posX + 115;
          targetY = posY + 40;
        } else if (targetNode) {
          targetX = targetNode.position.x + 115;
          targetY = targetNode.position.y + 40;
        } else {
          const count = Object.keys(nodes).length;
          const defaultX = 420 + (count % 4) * 320;
          const defaultY = 220 + Math.floor(count / 4) * 180;
          targetX = defaultX + 115;
          targetY = defaultY + 40;
        }

        storeState.updateAgentPresence(targetAgentId, {
          isVisible: true,
          opacity: 1,
          actionLabel: `Executing ${toolName}`,
          targetX,
          targetY,
          activeNodeId: targetNode?.id || targetNodeId || null,
          isInspecting: true,
          isClicking: true,
        });

        // Dispatch isClicking: true for 300ms so AgentCursor triggers visual radar ripple and depressed pointer animation
        const clickTimer = setTimeout(() => {
          get()?.updateAgentPresence(targetAgentId, { isClicking: false });
        }, 300);
        if (typeof clickTimer === 'object' && clickTimer !== null && 'unref' in clickTimer) (clickTimer as any).unref();
      }
    }
  });

  const externalAgentTimeouts = new Map<string, NodeJS.Timeout>();

  mcpEngine.addEventListener('webmcp:tool-success', (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail) {
      const toolName = detail.toolName || 'unknown_tool';
      const explicit = detail.context?.agentId;
      let targetAgentId: AgentId = 'alpha';
      if (
        explicit === 'alpha' ||
        explicit === 'beta' ||
        explicit === 'gamma' ||
        explicit === 'delta' ||
        (typeof explicit === 'string' && explicit.startsWith('ext-'))
      ) {
        targetAgentId = explicit as AgentId;
      } else {
        const lowerTool = toolName.toLowerCase();
        if (
          lowerTool.includes('security') ||
          lowerTool.includes('iam') ||
          lowerTool.includes('threat') ||
          lowerTool.includes('audit') ||
          lowerTool.includes('compliance') ||
          lowerTool.includes('policy') ||
          lowerTool.includes('hardening') ||
          lowerTool.includes('chaos') ||
          lowerTool.includes('self_healing') ||
          lowerTool.includes('incident')
        ) {
          targetAgentId = 'beta';
        } else if (
          lowerTool.includes('cost') ||
          lowerTool.includes('pricing') ||
          lowerTool.includes('finops') ||
          lowerTool.includes('lock') ||
          lowerTool.includes('allocation')
        ) {
          targetAgentId = 'delta';
        } else {
          targetAgentId = 'alpha';
        }
      }

      const executionTimeMs = detail.result?.meta?.executionTimeMs ?? 0.1;
      const storeState = get();
      if (storeState?.logAction) {
        storeState.logAction(
          targetAgentId,
          'MCP_SUCCESS',
          `[WebMCP] Tool Success: ${toolName} (${executionTimeMs.toFixed(1)}ms)`,
          executionTimeMs
        );
      }

      const isCoreAgent = ['alpha', 'beta', 'gamma', 'delta'].includes(targetAgentId);
      const isExtAgent = targetAgentId.startsWith('ext-');

      if (storeState?.updateAgentPresence) {
        storeState.updateAgentPresence(targetAgentId, {
          actionLabel: 'Success',
          isInspecting: false,
          isClicking: false,
          isVisible: true,
          opacity: 1,
        });
        if (externalAgentTimeouts.has(targetAgentId)) {
          clearTimeout(externalAgentTimeouts.get(targetAgentId)!);
        }

        const timer = setTimeout(() => {
          get()?.updateAgentPresence(targetAgentId, {
            actionLabel: isCoreAgent ? 'Standing by' : 'Ready (Synced)',
            isVisible: true,
            opacity: 1,
            isInspecting: false,
            isClicking: false,
          });
          externalAgentTimeouts.delete(targetAgentId);

          const fadeTimer = setTimeout(() => {
            get()?.updateAgentPresence(targetAgentId, {
              actionLabel: undefined,
              isVisible: false,
              opacity: 0,
            });
          }, 1200);
          if (typeof fadeTimer === 'object' && fadeTimer !== null && 'unref' in fadeTimer) (fadeTimer as any).unref();
        }, 1200);
        if (typeof timer === 'object' && timer !== null && 'unref' in timer) (timer as any).unref();
        externalAgentTimeouts.set(targetAgentId, timer);
      }
    }
  });

  mcpEngine.addEventListener('webmcp:tool-error', (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail) {
      const agentId = (detail.context?.agentId as AgentId) || 'director';
      const toolName = detail.toolName || 'unknown_tool';
      const errorMsg = typeof detail.error === 'string' ? detail.error : JSON.stringify(detail.error || {});
      const storeState = get();
      if (storeState?.logAction) {
        storeState.logAction(
          agentId,
          'AUDIT_VETO',
          `[WebMCP] Tool Error: ${toolName} -> ${errorMsg}`,
          0.1
        );
      }
      if (agentId.startsWith('ext-') && storeState?.updateAgentPresence) {
        storeState.updateAgentPresence(agentId, {
          actionLabel: 'Failed',
          isInspecting: false,
          isClicking: false,
          isVisible: true,
          opacity: 1,
        });
        if (externalAgentTimeouts.has(agentId)) clearTimeout(externalAgentTimeouts.get(agentId)!);
        const timer = setTimeout(() => {
          get()?.updateAgentPresence(agentId, {
            actionLabel: undefined,
            isVisible: false,
            opacity: 0,
            isInspecting: false,
            isClicking: false,
          });
          externalAgentTimeouts.delete(agentId);
        }, 1000);
        if (typeof timer === 'object' && timer !== null && 'unref' in timer) (timer as any).unref();
        externalAgentTimeouts.set(agentId, timer);
      }
    }
  });

  // Subscribe stateEngine transactions directly to Zustand state & React UI
  stateEngine.subscribe((nextState) => {
    const currentAuditor = get()?.auditor ?? auditor;
    const currentDag = get()?.dag ?? dag;
    const nextReport = currentAuditor.auditTopology(nextState);
    const nextHcl = HCLSyncEngine.canvasToHcl(nextState);

    set({
      topologyState: nextState,
      auditReport: nextReport,
      hclCode: nextHcl,
      isHclDirty: false,
      dagTimeline: currentDag.getTimeline(),
      activeCommitId: currentDag.getActiveCommitId(),
      branches: currentDag.listBranches(),
    });
  });

  return {
    lockManager,
    stateEngine,
    mcpEngine,
    auditor,
    dag,
    swarmSim,
    nimClient,
    geminiClient,
    liveOrchestrator,

    engineMode: initialGoogleKeys.length > 0 ? 'live_gemini' : 'simulator',
    nvidiaApiKey: defaultApiKey,
    googleApiKeys: initialGoogleKeys,
    selectedModel: 'gemini-3.7-flash',
    isApiSettingsOpen: false,

    setEngineMode: (mode) => set({ engineMode: mode }),
    setGoogleApiKeys: (keys) => {
      const arr = Array.isArray(keys) ? keys : keys.split(',').map((k) => k.trim()).filter((k) => k.length > 0);
      get().geminiClient.setApiKeys(arr);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('CLOUD_SWARM_GOOGLE_KEYS', arr.join(','));
      }
      set({ googleApiKeys: arr });
    },
    setNvidiaApiKey: (key) => {
      get().nimClient.setApiKey(key);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('CLOUD_SWARM_NVIDIA_KEY', key);
      }
      set({ nvidiaApiKey: key });
    },

    setSelectedModel: (model) => {
      get().geminiClient.setDefaultModel(model);
      get().nimClient.setDefaultModel(model);
      set({ selectedModel: model });
    },
    setIsApiSettingsOpen: (open) => set({ isApiSettingsOpen: open }),
    addExecutionLog: ({ agentId, actionType, summary, targetEntityId, durationMs = 0.25 }) => {
      get().logAction(agentId, actionType, summary, durationMs, targetEntityId);
    },
    executeSwarmPrompt: async (userPrompt: string, singleAgentOnly: boolean = false) => {
      const { liveOrchestrator, runSwarmDemo } = get();
      if (userPrompt && userPrompt.trim()) {
        await liveOrchestrator.executeLivePrompt(userPrompt, singleAgentOnly);
      } else {
        await runSwarmDemo();
      }
    },
    updateNode: async (nodeId, updates) => {
      const node = get().topologyState.nodes[nodeId];
      if (!node) {
        return {
          success: false,
          version: get().topologyState.version,
          transactionId: `err_${Date.now()}`,
          agentId: 'director',
          patches: [],
          inversePatches: [],
          executionTimeMs: 0,
          conflictError: 'Node not found',
        };
      }
      const patches: RFC6902Patch[] = [];
      if (updates.name !== undefined) {
        patches.push({ op: 'replace', path: `/nodes/${nodeId}/name`, value: updates.name });
      }
      if (updates.config !== undefined) {
        const mergedConfig = { ...node.config, ...updates.config };
        patches.push({ op: 'replace', path: `/nodes/${nodeId}/config`, value: mergedConfig });
      }
      if (updates.position !== undefined) {
        patches.push({ op: 'replace', path: `/nodes/${nodeId}/position`, value: updates.position });
      }
      if (updates.metadata !== undefined) {
        const mergedMetadata = { ...node.metadata, ...updates.metadata };
        patches.push({ op: 'replace', path: `/nodes/${nodeId}/metadata`, value: mergedMetadata });
      }
      if (patches.length === 0) {
        return {
          success: true,
          version: get().topologyState.version,
          transactionId: `noop_${Date.now()}`,
          agentId: 'director',
          patches: [],
          inversePatches: [],
          executionTimeMs: 0,
        };
      }
      const tx: StateTransaction = {
        id: `tx_node_upd_${Date.now()}`,
        agentId: 'director',
        description: `Update node ${node.name}`,
        timestamp: Date.now(),
        expectedVersions: { [nodeId]: node.version },
        patches,
      };
      return get().applyTransaction(tx);
    },

    topologyState: initialTopology,
    selectedNodeId: null,
    inspectedNodeId: null,
    hoveredNodeId: null,
    selectedEdgeId: null,

    agentPresences: initialPresences,
    activeLocks: [],

    executionLogs: [
      {
        id: 'log_init_0',
        timestamp: Date.now(),
        latencyMs: 0.12,
        agentId: 'director',
        actionType: 'MCP_CALL',
        message: 'CloudSwarm Studio initialized. Concurrency core & WebMCP tool registry active.',
      },
    ],
    auditReport: initialReport,
    activeHudTab: 'terminal',
    isDrawerOpen: false,
    drawerHeight: 230,

    isCostModalOpen: false,
    setIsCostModalOpen: (open) => set({ isCostModalOpen: open }),
    isSecurityModalOpen: false,
    setIsSecurityModalOpen: (open) => set({ isSecurityModalOpen: open }),
    monthlyBudgetUsd: 1500,
    setMonthlyBudgetUsd: (budget) => set({ monthlyBudgetUsd: budget }),
    isPaletteOpen: true,
    setIsPaletteOpen: (open) => set({ isPaletteOpen: open }),
    lastExecutionSummary: null,
    setLastExecutionSummary: (summary) => set({ lastExecutionSummary: summary }),
    isSummaryCardVisible: false,
    setIsSummaryCardVisible: (visible) => set({ isSummaryCardVisible: visible }),

    dagTimeline: dag.getTimeline(),
    activeCommitId: dag.getActiveCommitId(),
    activeBranchName: dag.getActiveBranchName(),
    branches: dag.listBranches(),
    isSplitComparisonOpen: false,
    splitCompareCommitId: null,
    splitDiffResult: null,

    hclCode: initialHcl,
    isHclDirty: false,
    isHclEditorOpen: false,

    isSimulating: false,
    simulationProgress: 0,
    selectedScenarioId: 'ecommerce_ha',
    stepDelayMs: typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 0 : 500,

    isExportModalOpen: false,
    isExporting: false,

    canvasZoom: 1.15,
    canvasPan: { x: 0, y: 0 },

    // ========================================================================
    // Logging Helper
    // ========================================================================
    logAction: (agentId, actionType, message, latencyMs = 0.25, targetResourceId, metadata) => {
      const entry: ExecutionLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        latencyMs: Math.round(latencyMs * 100) / 100,
        agentId,
        actionType,
        message,
        targetResourceId,
        metadata,
      };

      set((state) => ({
        executionLogs: [entry, ...state.executionLogs].slice(0, 100),
      }));
    },

    // ========================================================================
    // 1-Click Swarm Simulation Runner
    // ========================================================================
    runSwarmDemo: async (scenarioId) => {
      const targetId = scenarioId ?? get().selectedScenarioId;
      const sim = get().swarmSim;
      const simAuditor = get().auditor;
      const simDag = get().dag;

      const currentNodes = get().topologyState.nodes;
      const hasExistingUserNodes = Object.keys(currentNodes).length > 0;

      // Preserve existing human-placed nodes if present; otherwise start clean
      const initialNodes = hasExistingUserNodes ? { ...currentNodes } : {};
      const initialEdges = hasExistingUserNodes ? { ...get().topologyState.edges } : {};

      const baseState: TopologyState = {
        nodes: initialNodes,
        edges: initialEdges,
        version: get().topologyState.version + 1,
      };

      if (!hasExistingUserNodes) {
        get().stateEngine.setState(baseState);
      }

      // Concurrently activate ALL 4 agent personas in their architectural zones
      const activePresences: Record<string, AgentPresenceState> = { ...get().agentPresences };
      const agentInitPositions: Record<string, { x: number; y: number; thought: string; action: string }> = {
        alpha: { x: 260, y: 160, thought: 'Atlas: Preparing Compute & Cluster topology...', action: 'Compute & Infra' },
        beta: { x: 440, y: 120, thought: 'Breach: Auditing Zero-Trust CIS boundaries & VPCs...', action: 'Networking & SecOps' },
        gamma: { x: 620, y: 280, thought: 'Forge: Synthesizing Storage & Multi-AZ Databases...', action: 'Storage & Databases' },
        delta: { x: 800, y: 180, thought: 'Cost: Computing real-time multi-cloud FinOps rate cards...', action: 'FinOps Auditor' },
      };

      for (const [id, cfg] of Object.entries(agentInitPositions)) {
        if (activePresences[id]) {
          activePresences[id] = {
            ...activePresences[id],
            isVisible: true,
            opacity: 1,
            targetX: cfg.x,
            targetY: cfg.y,
            thoughtText: cfg.thought,
            actionLabel: cfg.action,
            isClicking: true,
          };
        }
      }

      set({
        isSimulating: true,
        simulationProgress: 0,
        selectedScenarioId: targetId,
        topologyState: baseState,
        agentPresences: activePresences as Record<AgentId, AgentPresenceState>,
        selectedNodeId: null,
        selectedEdgeId: null,
        hoveredNodeId: null,
      });

      get().logAction(
        'director',
        'MCP_CALL',
        `Initiating multi-agent Swarm Demo scenario: '${targetId}'`,
        0.18
      );

      const onStepCallback = async (step: SimStep) => {
        const total = step.totalSteps > 0 ? step.totalSteps : 6;
        const progress = Math.round((step.stepIndex / total) * 100);

        // Update active node target position based on step's target resource
        let targetX = 300;
        let targetY = 250;
        if (step.targetResourceId && step.stateSnapshot.nodes[step.targetResourceId]) {
          const targetNode = step.stateSnapshot.nodes[step.targetResourceId];
          if (targetNode) {
            if (step.agentId === 'alpha') {
              targetX = targetNode.position.x + 35;
              targetY = targetNode.position.y + 16;
            } else if (step.agentId === 'beta') {
              targetX = targetNode.position.x + 195;
              targetY = targetNode.position.y + 16;
            } else if (step.agentId === 'gamma') {
              targetX = targetNode.position.x + 110;
              targetY = targetNode.position.y + 58;
            } else {
              targetX = targetNode.position.x + 80;
              targetY = targetNode.position.y + 40;
            }
          }
        } else if (step.agentId === 'alpha') {
          targetX = 180 + step.stepIndex * 60;
          targetY = 160 + (step.stepIndex % 3) * 80;
        } else if (step.agentId === 'beta') {
          targetX = 360 + step.stepIndex * 50;
          targetY = 220;
        } else if (step.agentId === 'gamma') {
          targetX = 580 + step.stepIndex * 40;
          targetY = 280;
        }

        // Compute live audit report
        const report = simAuditor.auditTopology(step.stateSnapshot);

        // Record commit to DAG
        const commitNode = simDag.addCommit(
          {
            message: `[${step.agentId.toUpperCase()}] ${step.action}: ${step.patchSummary}`,
            author: step.agentId,
            patches: step.patches,
            state: step.stateSnapshot,
          },
          {
            author: step.agentId,
            message: step.patchSummary,
          }
        );

        // Generate HCL
        const nextHcl = HCLSyncEngine.canvasToHcl(step.stateSnapshot);

        // Update state
          set((current) => {
          const updatedPresences = { ...current.agentPresences };
          // Keep ALL 4 agent personas visible concurrently throughout simulation
          for (const aId of ['alpha', 'beta', 'gamma', 'delta'] as AgentId[]) {
            if (updatedPresences[aId]) {
              updatedPresences[aId] = {
                ...updatedPresences[aId],
                isVisible: true,
                opacity: 1,
              };
            }
          }

          const currentPresence = updatedPresences[step.agentId];
          if (currentPresence) {
            updatedPresences[step.agentId] = {
              ...currentPresence,
              targetX,
              targetY,
              isVisible: true,
              opacity: 1,
              activeNodeId: step.targetResourceId ?? null,
              thoughtText: step.thought,
              thoughtTimestamp: Date.now(),
              isInspecting: true,
              isClicking: true,
              isDragging: false,
              actionLabel: step.action,
            };
          }

          const clickTimer = setTimeout(() => {
            get().updateAgentPresence(step.agentId, { isClicking: false });
          }, 500);
          if (typeof clickTimer === 'object' && clickTimer !== null && 'unref' in clickTimer) {
            (clickTimer as any).unref();
          }

          // Build log entry
          const logEntry: ExecutionLogEntry = {
            id: `log_sim_${step.stepIndex}_${Date.now()}`,
            timestamp: Date.now(),
            latencyMs: parseFloat(step.executionBadge?.replace('ms', '') || '0.35'),
            agentId: step.agentId,
            actionType: 'CAS_APPLY',
            message: `${step.action} — ${step.patchSummary}`,
            targetResourceId: step.targetResourceId,
            metadata: { toolName: step.toolName, costDelta: step.costDeltaMonthlyUsd, secDelta: step.securityScoreDelta },
          };

          // CRITICAL FIX: Merge live human-placed nodes & edges so simulation doesn't erase human work
          const mergedNodes: Record<string, any> = { ...current.topologyState.nodes };
          for (const [nodeId, incomingNode] of Object.entries(step.stateSnapshot.nodes)) {
            const existingNode = current.topologyState.nodes[nodeId];
            if (existingNode) {
              mergedNodes[nodeId] = {
                ...incomingNode,
                position: { ...existingNode.position },
              };
            } else {
              mergedNodes[nodeId] = incomingNode;
            }
          }
          const mergedEdges: Record<string, any> = {
            ...current.topologyState.edges,
            ...step.stateSnapshot.edges,
          };
          const mergedSnapshot = {
            ...step.stateSnapshot,
            nodes: mergedNodes,
            edges: mergedEdges,
          };

          get().stateEngine.setState(mergedSnapshot);

          return {
            topologyState: mergedSnapshot,
            agentPresences: updatedPresences,
            executionLogs: [logEntry, ...current.executionLogs].slice(0, 100),
            auditReport: report,
            hclCode: nextHcl,
            isHclDirty: false,
            simulationProgress: progress,
            dagTimeline: simDag.getBranchTimeline(),
            activeCommitId: commitNode.id,
            branches: simDag.listBranches(),
          };
        });
      };

      try {
        const report = await sim.runScenario(
          targetId,
          onStepCallback,
          {
            stepDelayMs: get().stepDelayMs,
            baseSecurityScore: 50,
          }
        );

        get().logAction(
          'director',
          'FINOPS_EVAL',
          `Swarm simulation finished successfully in ${Math.round(report.durationMs)}ms. Security: ${report.finalSecurityScore}/100, Cost Delta: $${report.totalMonthlyCostDeltaUsd}/mo.`,
          report.durationMs
        );

        const finalAudit = get().auditReport;
        const nodeCount = Object.keys(get().topologyState.nodes).length;

        set({
          isSimulating: false,
          simulationProgress: 100,
          isSummaryCardVisible: true,
          lastExecutionSummary: {
            title: `${targetId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Provisioned`,
            costUsd: finalAudit.totalMonthlyCostUsd ?? 0,
            cisScore: finalAudit.securityScore ?? 100,
            nodeCount: nodeCount,
            durationSec: parseFloat((report.durationMs / 1000).toFixed(1)),
            timestamp: Date.now(),
          },
        });

        // Transition all 4 agents into calm standing by state after completion
        setTimeout(() => {
          set((state) => {
            const stoodBy: Record<string, AgentPresenceState> = {};
            for (const [id, pres] of Object.entries(state.agentPresences)) {
              stoodBy[id] = {
                ...pres,
                isClicking: false,
                isDragging: false,
                isInspecting: false,
                actionLabel: 'Standing by',
              };
            }
            return { agentPresences: stoodBy as Record<AgentId, AgentPresenceState> };
          });
        }, 2000);

        return report;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        get().logAction('director', 'AUDIT_VETO', `Simulation error: ${errorMessage}`, 0.5);
        set({ isSimulating: false });
        throw err;
      }
    },

    stopSwarmDemo: () => {
      if (typeof window !== 'undefined') {
        window.fetch('/api/webmcp/stop').catch(() => {});
      }
      set((state) => {
        const clearedPresences = { ...state.agentPresences };
        for (const key of Object.keys(clearedPresences) as AgentId[]) {
          clearedPresences[key] = {
            ...clearedPresences[key],
            agentId: key,
            isClicking: false,
            isInspecting: false,
            isDragging: false,
            actionLabel: 'Standing by',
            isVisible: true,
            opacity: 1,
          };
        }
        return {
          isSimulating: false,
          simulationProgress: 0,
          agentPresences: clearedPresences,
        };
      });
      get().logAction('director', 'AUDIT_VETO', 'Simulation & execution halted by Human Director.', 0.1);
    },

    setSelectedScenarioId: (id) => set({ selectedScenarioId: id }),
    setStepDelayMs: (ms) => set({ stepDelayMs: Math.max(0, ms) }),

    // ========================================================================
    // State Mutation & Locking Engine Integration
    // ========================================================================
    applyTransaction: async (tx) => {
      const engine = get().stateEngine;
      const auditor = get().auditor;
      const dag = get().dag;

      const result = await engine.applyTransaction(tx);
      if (result.success) {
        const nextState = engine.getState();
        const nextReport = auditor.auditTopology(nextState);
        const nextHcl = HCLSyncEngine.canvasToHcl(nextState);

        const commitNode = dag.addCommit(tx, {
          author: tx.agentId,
          message: tx.description,
        });

        get().logAction(
          tx.agentId,
          'CAS_APPLY',
          `Transaction applied: ${tx.description}`,
          result.executionTimeMs,
          undefined,
          { patchesCount: tx.patches.length }
        );

        set({
          topologyState: nextState,
          auditReport: nextReport,
          hclCode: nextHcl,
          isHclDirty: false,
          dagTimeline: dag.getTimeline(),
          activeCommitId: commitNode.id,
          branches: dag.listBranches(),
        });
      } else {
        get().logAction(
          tx.agentId,
          'CAS_ROLLBACK',
          `Transaction failed CAS check: ${result.conflictError ?? 'Conflict'}`,
          result.executionTimeMs
        );
      }

      return result;
    },

    rollback: (inversePatches) => {
      const engine = get().stateEngine;
      const auditor = get().auditor;

      const result = engine.rollback(inversePatches);
      if (result.success) {
        const rolledState = engine.getState();
        const rolledReport = auditor.auditTopology(rolledState);
        const rolledHcl = HCLSyncEngine.canvasToHcl(rolledState);

        get().logAction(
          'director',
          'CAS_ROLLBACK',
          `Rolled back ${result.rolledBackPatchesCount} patches in ${result.executionTimeMs.toFixed(2)}ms.`,
          result.executionTimeMs
        );

        set({
          topologyState: rolledState,
          auditReport: rolledReport,
          hclCode: rolledHcl,
          isHclDirty: false,
        });
      }
    },

    acquireLock: async (entityIds, agentId) => {
      const lockMgr = get().lockManager;
      try {
        await lockMgr.acquireLocks(entityIds, agentId, 3000, { retryOnContention: true });
        set({ activeLocks: lockMgr.getActiveLocks() });
        get().logAction(agentId, 'LOCK', `Acquired locks on [${entityIds.join(', ')}]`, 0.2);
        return true;
      } catch {
        return false;
      }
    },

    releaseLock: async (entityIds, agentId) => {
      const lockMgr = get().lockManager;
      await lockMgr.releaseLocks(entityIds, agentId);
      set({ activeLocks: lockMgr.getActiveLocks() });
      get().logAction(agentId, 'UNLOCK', `Released locks on [${entityIds.join(', ')}]`, 0.1);
    },

    // ========================================================================
    // Spatial Multiplayer Presence
    // ========================================================================
    updateAgentPresence: (agentId, updates) => {
      set((state) => {
        let current = state.agentPresences[agentId];
        if (!current) {
          // If it's a dynamic external agent, initialize its base state so it can be added
          if (agentId.startsWith('ext-')) {
            current = {
              agentId,
              currentX: 500,
              currentY: 300,
              targetX: 500,
              targetY: 300,
              velocityX: 0,
              velocityY: 0,
              activeNodeId: null,
              thoughtText: null,
              thoughtTimestamp: 0,
              isInspecting: false,
              isVisible: false,
              opacity: 0,
            };
          } else {
            return state;
          }
        }
        
        return {
          agentPresences: {
            ...state.agentPresences,
            [agentId]: {
              ...current,
              ...updates,
            },
          },
        };
      });
    },

    selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null }),
    openInspector: (nodeId) => set({ inspectedNodeId: nodeId, selectedNodeId: nodeId, selectedEdgeId: null }),
    closeInspector: () => set({ inspectedNodeId: null }),
    setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),
    selectEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: null, inspectedNodeId: null }),

    // ========================================================================
    // Interactive Canvas CRUD Actions
    // ========================================================================
    moveNode: async (nodeId, position) => {
      set((state) => {
        const node = state.topologyState.nodes[nodeId];
        if (!node) return state;
        return {
          topologyState: {
            ...state.topologyState,
            nodes: {
              ...state.topologyState.nodes,
              [nodeId]: {
                ...node,
                position: { x: Math.round(position.x), y: Math.round(position.y) },
              },
            },
          },
        };
      });

      // Synchronously sync stateEngine so subsequent transactions never revert positions
      const engine = get().stateEngine;
      if (engine && typeof (engine as any).updateNodePosition === 'function') {
        (engine as any).updateNodePosition(nodeId, position);
      }
    },

    addNode: (node, agentId = 'alpha') => {
      const tx: StateTransaction = {
        id: `tx_add_${Date.now()}`,
        agentId,
        description: `Add resource ${node.name} (${node.type})`,
        timestamp: Date.now(),
        patches: [
          {
            op: 'add',
            path: `/nodes/${node.id}`,
            value: node,
          },
        ],
      };
      return get().applyTransaction(tx);
    },

    removeNode: (nodeId, agentId = 'alpha') => {
      const curr = get().topologyState.nodes[nodeId];
      const nodeName = curr?.name ?? nodeId;
      const patches: RFC6902Patch[] = [
        {
          op: 'remove',
          path: `/nodes/${nodeId}`,
        },
      ];

      // Cascade remove edges
      for (const [edgeId, edge] of Object.entries(get().topologyState.edges)) {
        if (edge.source === nodeId || edge.target === nodeId) {
          patches.push({
            op: 'remove',
            path: `/edges/${edgeId}`,
          });
        }
      }

      const tx: StateTransaction = {
        id: `tx_rm_${Date.now()}`,
        agentId,
        description: `Remove resource ${nodeName}`,
        timestamp: Date.now(),
        patches,
      };
      return get().applyTransaction(tx);
    },

    updateNodeConfig: async (nodeId, configPatch, agentId = 'beta') => {
      let retries = 3;
      let lastResult;
      while (retries > 0) {
        const node = get().topologyState.nodes[nodeId];
        if (!node) {
          return {
            success: false,
            version: get().topologyState.version,
            transactionId: `err_${Date.now()}`,
            agentId,
            patches: [],
            inversePatches: [],
            executionTimeMs: 0,
            conflictError: 'Node not found',
          };
        }

        const mergedConfig = { ...node.config, ...configPatch };
        const tx: StateTransaction = {
          id: `tx_cfg_${Date.now()}_${retries}`,
          agentId,
          description: `Update configuration on ${node.name}`,
          timestamp: Date.now(),
          expectedVersions: { [nodeId]: node.version },
          patches: [
            {
              op: 'replace',
              path: `/nodes/${nodeId}/config`,
              value: mergedConfig,
            },
          ],
        };
        
        lastResult = await get().applyTransaction(tx);
        if (lastResult.success) {
          return lastResult;
        }
        
        // If conflict occurred, back off and retry
        if (lastResult.conflictError) {
          retries--;
          await new Promise(r => setTimeout(r, Math.random() * 50 + 20)); // jitter backoff
          continue;
        }
        return lastResult;
      }
      return lastResult || { success: false, conflictError: 'Max retries exceeded' } as any;
    },

    addEdge: (edge, agentId = 'alpha') => {
      // Guarantee stateEngine's node positions match the store before applying transaction
      const engine = get().stateEngine;
      const storeNodes = get().topologyState.nodes;
      if (engine && storeNodes && typeof (engine as any).updateNodePosition === 'function') {
        for (const [id, node] of Object.entries(storeNodes)) {
          if (node && node.position) {
            (engine as any).updateNodePosition(id, node.position);
          }
        }
      }

      const tx: StateTransaction = {
        id: `tx_edge_${Date.now()}`,
        agentId,
        description: `Connect ${edge.source} -> ${edge.target} (${edge.type})`,
        timestamp: Date.now(),
        patches: [
          {
            op: 'add',
            path: `/edges/${edge.id}`,
            value: edge,
          },
        ],
      };
      return get().applyTransaction(tx);
    },

    removeEdge: (edgeId, agentId = 'alpha') => {
      const tx: StateTransaction = {
        id: `tx_rm_edge_${Date.now()}`,
        agentId,
        description: `Remove connection ${edgeId}`,
        timestamp: Date.now(),
        patches: [
          {
            op: 'remove',
            path: `/edges/${edgeId}`,
          },
        ],
      };
      return get().applyTransaction(tx);
    },

    applyAutoLayoutToCanvas: () => {
      const current = get().topologyState;
      const rearranged = autoConnectTopology(current);
      get().stateEngine.setState(rearranged);
      const report = get().auditor.auditTopology(rearranged);
      const hcl = HCLSyncEngine.canvasToHcl(rearranged);
      set({
        topologyState: rearranged,
        auditReport: report,
        hclCode: hcl,
      });
      get().logAction('director', 'CAS_APPLY', 'Applied Hierarchical Auto-Layout across infrastructure mesh', 0.1);
    },

    // ========================================================================
    // Automated SecOps Hardening & FinOps Optimization
    // ========================================================================
    autoRemediateSecurity: async (findingIds) => {
      const state = get().topologyState;
      const auditor = get().auditor;
      const patches = auditor.generateRemediationPatches(state, findingIds);

      if (patches.length === 0) {
        get().logAction('beta', 'AUDIT_VETO', 'No open security findings require remediation.', 0.1);
        return;
      }

      const tx: StateTransaction = {
        id: `tx_sec_remediate_${Date.now()}`,
        agentId: 'beta',
        description: `Auto-remediated ${patches.length} security findings (CIS Benchmark & Least Privilege)`,
        timestamp: Date.now(),
        patches,
      };

      await get().applyTransaction(tx);
    },

    applyFinOpsOptimization: async () => {
      const state = get().topologyState;
      const patches: RFC6902Patch[] = [];

      for (const node of Object.values(state.nodes)) {
        if (node.type === 'aws_instance') {
          if (node.config['instance_type'] === 'c6i.large') {
            patches.push({ op: 'replace', path: `/nodes/${node.id}/config/instance_type`, value: 'c7g.large' });
          }
          if (node.config['root_volume_type'] === 'io2') {
            patches.push({ op: 'replace', path: `/nodes/${node.id}/config/root_volume_type`, value: 'gp3' });
          }
        } else if (node.type === 'aws_db_instance') {
          if (node.config['storage_type'] === 'io2') {
            patches.push({ op: 'replace', path: `/nodes/${node.id}/config/storage_type`, value: 'gp3' });
          }
          if (node.config['instance_class'] === 'db.r6g.2xlarge') {
            patches.push({ op: 'replace', path: `/nodes/${node.id}/config/instance_class`, value: 'db.serverless' });
          }
        }
      }

      if (patches.length === 0) {
        get().logAction('gamma', 'FINOPS_EVAL', 'Topology is already fully cost-optimized.', 0.1);
        return;
      }

      const tx: StateTransaction = {
        id: `tx_finops_opt_${Date.now()}`,
        agentId: 'gamma',
        description: `Applied ${patches.length} FinOps Rightsizing optimizations (Graviton3 & gp3)`,
        timestamp: Date.now(),
        patches,
      };

      await get().applyTransaction(tx);
    },

    summonAgent: async (agentId, targetNodeId, actionType = 'inspect') => {
      const nodes = get().topologyState.nodes;
      const targetNode = targetNodeId ? nodes[targetNodeId] : (get().selectedNodeId ? nodes[get().selectedNodeId!] : null);

      const homePositions: Record<string, { x: number; y: number }> = {
        alpha: { x: 180, y: 90 },
        beta: { x: 860, y: 90 },
        gamma: { x: 180, y: 560 },
        delta: { x: 860, y: 560 },
      };

      const targetX = targetNode ? targetNode.position.x + 120 : (homePositions[agentId]?.x ?? 300);
      const targetY = targetNode ? targetNode.position.y - 25 : (homePositions[agentId]?.y ?? 200);

      const actionLabels: Record<string, string> = {
        inspect: `${AGENT_PERSONAS[agentId]?.name ?? agentId}: Inspecting`,
        remediate: 'Zero-Trust Hardening',
        optimize: 'FinOps Rate Card Audit',
        autowire: 'Smart Topology Routing',
        chaos: 'Resilience Stress Test',
      };

      const personaThoughts: Partial<Record<AgentId, string>> = {
        alpha: targetNode 
          ? `Atlas: Analyzing ${targetNode.name} capacity and compute throughput. Redundant failover paths verified.`
          : 'Atlas: Compute & infra orchestrator standing by for director instructions.',
        beta: targetNode 
          ? `Breach: Auditing ${targetNode.name} for CIS compliance. Enforcing Zero-Trust isolation & KMS envelope encryption.`
          : 'Breach: Sentinel perimeter monitor armed and actively deflecting intrusion attempts.',
        gamma: targetNode 
          ? `Forge: Inspecting ${targetNode.name} IOPS profiles and persistent storage backup replication.`
          : 'Forge: Storage lakehouse and database consistency coordinators ready.',
        delta: targetNode 
          ? `Cost: Auditing monthly run-rate for ${targetNode.name}. Applied multi-cloud spot & reserved instance rate cards.`
          : 'Cost: Live FinOps budget tracking active across AWS, Azure, and GCP.',
        director: 'Human Director in command.',
        human: 'Human Director in command.',
      };

      // Immediately reflect spatial cursor movement and active status
      get().updateAgentPresence(agentId, {
        isVisible: true,
        opacity: 1,
        targetX,
        targetY,
        activeNodeId: targetNode?.id ?? null,
        isInspecting: true,
        isClicking: true,
        actionLabel: actionLabels[actionType] ?? 'Co-Pilot Active',
        thoughtText: personaThoughts[agentId] ?? `${agentId} active.`,
        thoughtTimestamp: Date.now(),
      });

      // Non-blocking lock acquisition for visual entity halo
      if (targetNode) {
        get().acquireLock([targetNode.id], agentId).catch(() => {});
      }

      // Execute action if requested
      if (actionType === 'remediate') {
        if (targetNode) {
          await get().updateNodeConfig(targetNode.id, {
            imds_v2: true,
            storage_encrypted: true,
            publicly_accessible: false,
            enable_ssl: true,
          }, agentId);
        }
        await get().autoRemediateSecurity();
      } else if (actionType === 'optimize') {
        await get().applyFinOpsOptimization();
      } else if (actionType === 'autowire' && targetNode) {
        const otherNodes = Object.values(nodes).filter((n) => n.id !== targetNode.id);
        if (otherNodes.length > 0) {
          const closest = otherNodes.reduce((prev, curr) => {
            const dPrev = Math.hypot(prev.position.x - targetNode.position.x, prev.position.y - targetNode.position.y);
            const dCurr = Math.hypot(curr.position.x - targetNode.position.x, curr.position.y - targetNode.position.y);
            return dCurr < dPrev ? curr : prev;
          });
          await get().addEdge({
            id: `edge_${targetNode.id}_${closest.id}_${Date.now()}`,
            source: targetNode.id,
            target: closest.id,
            type: 'routes_to',
            label: 'CO-PILOT ROUTE',
            version: 1,
          }, agentId);
        }
      } else if (actionType === 'chaos' && targetNode) {
        await get().updateNode(targetNode.id, { metadata: { ...targetNode.metadata, status: 'warning' } });
        setTimeout(async () => {
          await get().updateNode(targetNode.id, { metadata: { ...targetNode.metadata, status: 'healthy' } });
        }, 1800);
      }

      get().logAction(
        agentId,
        'SWARM_PAIR_PROGRAMMING',
        `Human summoned ${AGENT_PERSONAS[agentId]?.name ?? agentId} to ${targetNode?.name ?? 'canvas'} (${actionType})`,
        0.2
      );

      setTimeout(async () => {
        if (targetNode) {
          await get().releaseLock([targetNode.id], agentId);
        }
        get().updateAgentPresence(agentId, {
          isClicking: false,
          isInspecting: false,
          actionLabel: 'Standing by',
        });
      }, 2200);
    },

    // ========================================================================
    // Live Bi-Directional HCL Editor Actions
    // ========================================================================
    setHclCode: (code) => set({ hclCode: code, isHclDirty: true }),

    syncHclToCanvas: async (hclString) => {
      const oldState = get().topologyState;
      const patches = HCLSyncEngine.computePatchesFromHcl(oldState, hclString);

      if (patches.length === 0) {
        set({ isHclDirty: false });
        return;
      }

      const tx: StateTransaction = {
        id: `tx_hcl_sync_${Date.now()}`,
        agentId: 'director',
        description: `Synchronized live HCL edits to Canvas (${patches.length} patches)`,
        timestamp: Date.now(),
        patches,
      };

      await get().applyTransaction(tx);
      set({ isHclDirty: false });
    },

    syncCanvasToHcl: () => {
      const state = get().topologyState;
      const hcl = HCLSyncEngine.canvasToHcl(state);
      set({ hclCode: hcl, isHclDirty: false });
    },

    // ========================================================================
    // Time-Travel Decision DAG Actions
    // ========================================================================
    scrubDagTimeline: (ratio) => {
      const dag = get().dag;
      const targetState = dag.scrubTo(ratio);
      get().stateEngine.setState(targetState);
      const auditor = get().auditor;
      const report = auditor.auditTopology(targetState);
      const hcl = HCLSyncEngine.canvasToHcl(targetState);

      set({
        topologyState: targetState,
        auditReport: report,
        hclCode: hcl,
        isHclDirty: false,
        activeCommitId: dag.getActiveCommitId(),
      });
    },

    checkoutDagCommit: (commitId) => {
      const dag = get().dag;
      const targetState = dag.checkout(commitId);
      get().stateEngine.setState(targetState);
      const auditor = get().auditor;
      const report = auditor.auditTopology(targetState);
      const hcl = HCLSyncEngine.canvasToHcl(targetState);

      get().logAction('director', 'CAS_APPLY', `Checked out DAG commit: ${commitId}`, 0.1);

      set({
        topologyState: targetState,
        auditReport: report,
        hclCode: hcl,
        isHclDirty: false,
        activeCommitId: commitId,
        activeBranchName: dag.getActiveBranchName(),
      });
    },

    forkDagBranch: (name, fromCommitId) => {
      const dag = get().dag;
      const branch = dag.forkBranch(name, fromCommitId, 'director');
      get().logAction('director', 'BRANCH_FORK', `Forked new branch '${name}' from commit ${branch.headCommitId}`, 0.1);

      set({
        branches: dag.listBranches(),
        activeBranchName: name,
        activeCommitId: branch.headCommitId,
      });
    },

    switchDagBranch: (name) => {
      const dag = get().dag;
      const targetState = dag.switchBranch(name);
      get().stateEngine.setState(targetState);
      const auditor = get().auditor;
      const report = auditor.auditTopology(targetState);
      const hcl = HCLSyncEngine.canvasToHcl(targetState);

      get().logAction('director', 'BRANCH_FORK', `Switched to branch '${name}'`, 0.1);

      set({
        topologyState: targetState,
        auditReport: report,
        hclCode: hcl,
        isHclDirty: false,
        activeBranchName: name,
        activeCommitId: dag.getActiveCommitId(),
      });
    },

    openSplitComparison: (commitAId?: string, commitBId?: string) => {
      const dag = get().dag;
      let targetA = commitAId;
      let targetB = commitBId;

      // Auto-populate if missing or if only 1 branch exists
      const branches = dag.listBranches();
      if (!targetA || !targetB) {
        if (branches.length >= 2) {
          targetA = branches[0]!.headCommitId;
          targetB = branches[1]!.headCommitId;
        } else {
          // Auto-fork an experimental comparison branch so A/B Split always renders
          dag.forkBranch('staging-canary');
          dag.addCommit({
            author: 'delta',
            message: 'A/B Canary: FinOps Graviton3 & Zero-Trust Hardening',
            patches: [],
          });
          const updatedBranches = dag.listBranches();
          targetA = updatedBranches[0]?.headCommitId || dag.getActiveCommitId();
          targetB = updatedBranches[1]?.headCommitId || dag.getActiveCommitId();
          set({ branches: updatedBranches });
        }
      }

      // Resolve branch names to commit IDs if branch names were passed
      const branchObjA = dag.listBranches().find((b) => b.name === targetA);
      if (branchObjA) targetA = branchObjA.headCommitId;
      const branchObjB = dag.listBranches().find((b) => b.name === targetB);
      if (branchObjB) targetB = branchObjB.headCommitId;

      // Safe fallback if target commit does not exist
      if (!dag.getCommit(targetA!)) targetA = dag.getActiveCommitId();
      if (!dag.getCommit(targetB!)) targetB = dag.getActiveCommitId();

      const diff = dag.getDiff(targetA!, targetB!);
      set({
        isSplitComparisonOpen: true,
        splitCompareCommitId: targetB!,
        splitDiffResult: diff,
        isDrawerOpen: true,
        activeHudTab: 'diff',
        drawerHeight: Math.max(340, get().drawerHeight),
      });
    },

    closeSplitComparison: () => {
      set({
        isSplitComparisonOpen: false,
        splitCompareCommitId: null,
        splitDiffResult: null,
      });
    },

    // ========================================================================
    // UI Panel Controls
    // ========================================================================
    setActiveHudTab: (tab) => set({ activeHudTab: tab }),
    setIsDrawerOpen: (open) => set({ isDrawerOpen: open }),
    setDrawerHeight: (height) => set({ drawerHeight: Math.max(140, Math.min(600, height)) }),
    setIsHclEditorOpen: (open) => {
      if (open) get().syncCanvasToHcl();
      set({ isHclEditorOpen: open });
    },
    setIsExportModalOpen: (open) => set({ isExportModalOpen: open }),

    // ========================================================================
    // VIP Guided Judge Tour
    // ========================================================================
    isTourOpen: false,
    currentTourStep: 0,
    setIsTourOpen: (open) => set({ isTourOpen: open, currentTourStep: open ? 0 : 0 }),
    setCurrentTourStep: (step) => set({ currentTourStep: step }),

    // ========================================================================
    // Chaos Gorilla & Autonomous Self-Healing Simulator
    // ========================================================================
    isChaosActive: false,
    activeChaosIncident: null,
    triggerChaosScenario: async (scenarioId) => {
      const scenario = CHAOS_SCENARIOS.find((s) => s.id === scenarioId) || CHAOS_SCENARIOS[0]!;
      const stateEngine = get().stateEngine;
      const chaosSim = new ChaosSimulator(stateEngine);

      set({ isChaosActive: true, activeChaosIncident: scenario });
      get().logAction('director', 'AUDIT_VETO', `🚨 CHAOS INJECTION: ${scenario.name}`, 0.5);

      const result = await chaosSim.executeSelfHealing(scenario, (agentId, message) => {
        get().updateAgentPresence(agentId, {
          thoughtText: message,
          thoughtTimestamp: Date.now(),
          isClicking: true,
        });
        get().logAction(agentId, 'MCP_CALL', message, 15);
      });

      set({ isChaosActive: false, activeChaosIncident: null });
      for (const ag of ['alpha', 'beta', 'gamma', 'delta'] as const) {
        get().updateAgentPresence(ag, { isClicking: false, actionLabel: 'Standing by' });
      }
      get().logAction('director', 'AUDIT_PASS', `✅ AUTONOMOUS HEALING COMPLETE in ${result.timeToRemediateMs}ms. Blast radius: ${result.blastRadiusFinal}`, result.timeToRemediateMs);
      return result;
    },

    // ========================================================================
    // Red-Team Threat Attack & Zero-Trust Defense Simulator
    // ========================================================================
    isThreatSimActive: false,
    activeThreatVector: null,
    isShieldActive: false,
    triggerThreatScenario: async (threatId) => {
      const threat = THREAT_VECTORS.find((t) => t.id === threatId) || THREAT_VECTORS[0]!;
      const stateEngine = get().stateEngine;
      const threatSim = new ThreatDefenseSimulator(stateEngine);

      set({ isThreatSimActive: true, activeThreatVector: threat, isShieldActive: false });
      get().logAction('director', 'AUDIT_VETO', `🚨 ADVERSARY ATTACK: ${threat.name}`, 0.5);

      const result = await threatSim.executeThreatDefense(threat, (agentId, message, score) => {
        get().updateAgentPresence(agentId, {
          thoughtText: message,
          thoughtTimestamp: Date.now(),
          isClicking: true,
        });
        if (score === 100) {
          set({ isShieldActive: true });
        }
        get().logAction(agentId, 'MCP_CALL', message, 20);
      });

      set({ isThreatSimActive: false, activeThreatVector: null });
      for (const ag of ['alpha', 'beta', 'gamma', 'delta'] as const) {
        get().updateAgentPresence(ag, { isClicking: false, actionLabel: 'Standing by' });
      }
      setTimeout(() => set({ isShieldActive: false }), 4000);
      get().logAction('beta', 'AUDIT_PASS', `🛡️ ZERO-TRUST SHIELD DEFLECTED ATTACK. Security: ${result.finalCisScore}/100 A+`, 35);
      return result;
    },

    // ========================================================================
    // Viewport Controls
    // ========================================================================
    setCanvasZoom: (zoom) => set({ canvasZoom: Math.max(0.2, Math.min(2.5, zoom)) }),
    setCanvasPan: (pan) => set({ canvasPan: pan }),
    resetCanvasView: () => set({ canvasZoom: 1.15, canvasPan: { x: 0, y: 0 } }),

    // ========================================================================
    // 1-Click Production Materializer Export
    // ========================================================================
    exportProductionBundle: async () => {
      set({ isExporting: true });
      try {
        const state = get().topologyState;
        const report = get().auditReport;
        const blob = await ProductionMaterializer.generateZipBundle(state, report);
        get().logAction('director', 'MCP_CALL', 'Generated downloadable production deployment bundle (ZIP).', 0.8);
        set({ isExporting: false });
        return blob;
      } catch (err) {
        set({ isExporting: false });
        throw err;
      }
    },

    resetTopology: () => {
      const defaultState = createDefaultTopologyState();
      get().stateEngine.setState(defaultState);

      const auditor = new SentinelAuditor();
      const dag = new DecisionDAG(defaultState, 'director', 'Initial Root Canvas');
      const report = auditor.auditTopology(defaultState);
      const hcl = HCLSyncEngine.canvasToHcl(defaultState);

      set({
        topologyState: defaultState,
        dag,
        auditor,
        dagTimeline: dag.getTimeline(),
        activeCommitId: dag.getActiveCommitId(),
        activeBranchName: dag.getActiveBranchName(),
        branches: dag.listBranches(),
        selectedNodeId: null,
        inspectedNodeId: null,
        hoveredNodeId: null,
        selectedEdgeId: null,
        auditReport: report,
        hclCode: hcl,
        isHclDirty: false,
        activeLocks: [],
        agentPresences: initialPresences,
        isSimulating: false,
        simulationProgress: 0,
        isSummaryCardVisible: false,
        lastExecutionSummary: null,
        isChaosActive: false,
        activeChaosIncident: null,
        isThreatSimActive: false,
        activeThreatVector: null,
        isShieldActive: false,
        isSplitComparisonOpen: false,
        splitCompareCommitId: null,
        splitDiffResult: null,
      });
    },

    loadSavedTopology: (savedState: TopologyState) => {
      if (!savedState || !savedState.nodes) return;
      get().stateEngine.setState(savedState);
      const currentAuditor = get()?.auditor || new SentinelAuditor();
      const report = currentAuditor.auditTopology(savedState);
      const hcl = HCLSyncEngine.canvasToHcl(savedState);
      set({
        topologyState: savedState,
        auditReport: report,
        hclCode: hcl,
        isHclDirty: false,
      });
    },
  };
});

if (typeof window !== 'undefined') {
  (window as any).useCloudSwarmStore = useCloudSwarmStore;
}

