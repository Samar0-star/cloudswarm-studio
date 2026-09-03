/**
 * Decision DAG & Time Travel WebMCP Tools
 *
 * Exposes time travel, branch forking, branch comparison, and commit lineage to WebMCP agents:
 * - time_travel_to_step
 * - fork_architecture_branch
 * - switch_architecture_branch
 * - compare_architecture_branches
 * - get_dag_history
 */

import type {
  WebMCPTool,
  WebMCPToolResult,
  WebMCPExecutionContext,
  WebModelContextAPI,
} from '../../../types/webmcp';
import type { DecisionDAG, DAGNode, DAGDiffResult, NodeDiff } from '../../dag/DecisionDAG';
import type { TopologyState, CloudResourceNode } from '../../../types/topology';
import type { AgentId } from '../../../types/swarm';

export interface DAGToolDependencies {
  getDag: () => DecisionDAG;
  getState: () => TopologyState;
  setState: (state: TopologyState) => void;
  checkoutCommit?: (commitId: string) => void;
  forkBranch?: (name: string, fromCommitId?: string) => void;
  switchBranch?: (name: string) => void;
}

export function registerDAGTools(
  mcp: WebModelContextAPI,
  deps: DAGToolDependencies
): () => void {
  const tools: WebMCPTool[] = [
    {
      name: 'time_travel_to_step',
      description:
        'Rewinds or fast-forwards the canvas topology to any historical commit step in the Decision DAG timeline.',
      category: 'topology',
      inputSchema: {
        type: 'object',
        required: ['step_index'],
        properties: {
          step_index: {
            type: 'number',
            description: 'Zero-based index of the target historical step in the Decision DAG.',
          },
        },
      },
      execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
        const dag = deps.getDag();
        const stepIndex = Number(params.step_index ?? 0);
        const timeline = dag.getTimeline();

        if (stepIndex < 0 || stepIndex >= timeline.length) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Invalid step_index '${stepIndex}'. Valid range is 0 to ${Math.max(0, timeline.length - 1)}.`,
            }],
            meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'chatgpt' },
          };
        }

        const targetCommit = timeline[stepIndex];
        if (!targetCommit) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Commit at step ${stepIndex} not found.` }],
            meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'chatgpt' },
          };
        }

        if (deps.checkoutCommit) {
          deps.checkoutCommit(targetCommit.id);
        } else {
          const checkedState = dag.checkout(targetCommit.id);
          deps.setState(checkedState);
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              time_traveled_to_step: stepIndex,
              commit_id: targetCommit.id,
              author: targetCommit.author,
              message: targetCommit.message,
              node_count: Object.keys(targetCommit.state.nodes).length,
              edge_count: Object.keys(targetCommit.state.edges).length,
            }, null, 2),
          }],
          meta: {
            executionTimeMs: 0,
            agentId: context?.agentId ?? 'chatgpt',
            stepIndex,
            commitId: targetCommit.id,
          },
        };
      },
    },

    {
      name: 'fork_architecture_branch',
      description:
        'Creates an isolated experimental architecture branch (e.g. "disaster-recovery-plan", "arm64-graviton-migration") to test topology alternatives without altering main.',
      category: 'topology',
      inputSchema: {
        type: 'object',
        required: ['branch_name'],
        properties: {
          branch_name: {
            type: 'string',
            description: 'Name of the new branch (e.g. "dr-eu-central", "serverless-redesign").',
          },
          from_commit_id: {
            type: 'string',
            description: 'Optional commit ID to fork from. Defaults to active commit head.',
          },
        },
      },
      execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
        const dag = deps.getDag();
        const branchName = String(params.branch_name).trim().replace(/\s+/g, '-');
        const fromCommitId = params.from_commit_id ? String(params.from_commit_id) : undefined;
        const author = (context?.agentId as AgentId) ?? 'alpha';

        if (deps.forkBranch) {
          deps.forkBranch(branchName, fromCommitId);
        } else {
          dag.forkBranch(branchName, fromCommitId, author);
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              created_branch: branchName,
              forked_from_commit: fromCommitId ?? dag.getActiveCommitId(),
              author,
              all_branches: dag.listBranches().map((b) => b.name),
            }, null, 2),
          }],
          meta: { executionTimeMs: 0, agentId: author, branchName },
        };
      },
    },

    {
      name: 'switch_architecture_branch',
      description:
        'Switches the active visual canvas between branches (e.g. switching between "main" and "dr-site").',
      category: 'topology',
      inputSchema: {
        type: 'object',
        required: ['branch_name'],
        properties: {
          branch_name: {
            type: 'string',
            description: 'Name of the branch to switch to.',
          },
        },
      },
      execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
        const dag = deps.getDag();
        const branchName = String(params.branch_name).trim();

        if (deps.switchBranch) {
          deps.switchBranch(branchName);
        } else {
          const state = dag.switchBranch(branchName);
          deps.setState(state);
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              active_branch: branchName,
              active_commit_id: dag.getActiveCommitId(),
              nodes: Object.keys(deps.getState().nodes).length,
            }, null, 2),
          }],
          meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'chatgpt', branchName },
        };
      },
    },

    {
      name: 'compare_architecture_branches',
      description:
        'Computes deep structural, cost, and security diffs between two branches or commits in the Decision DAG.',
      category: 'topology',
      inputSchema: {
        type: 'object',
        required: ['commit_a', 'commit_b'],
        properties: {
          commit_a: {
            type: 'string',
            description: 'Commit ID or branch name for comparison base.',
          },
          commit_b: {
            type: 'string',
            description: 'Commit ID or branch name for comparison target.',
          },
        },
      },
      execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
        const dag = deps.getDag();
        let commitAId = String(params.commit_a);
        let commitBId = String(params.commit_b);

        // Resolve branch names if passed
        const branches = dag.listBranches();
        const bA = branches.find((b) => b.name === commitAId);
        if (bA) commitAId = bA.headCommitId;
        const bB = branches.find((b) => b.name === commitBId);
        if (bB) commitBId = bB.headCommitId;

        const diff: DAGDiffResult = dag.getDiff(commitAId, commitBId);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              commitA: commitAId,
              commitB: commitBId,
              added_nodes_count: diff.addedNodes.length,
              added_nodes: diff.addedNodes.map((n: CloudResourceNode) => ({ id: n.id, type: n.type, name: n.name })),
              removed_nodes_count: diff.removedNodes.length,
              removed_nodes: diff.removedNodes.map((n: CloudResourceNode) => ({ id: n.id, type: n.type, name: n.name })),
              modified_nodes_count: diff.modifiedNodes.length,
              modified_nodes: diff.modifiedNodes.map((m: NodeDiff) => ({ id: m.id, changedKeys: m.changedKeys })),
              patch_count: diff.patchCount,
            }, null, 2),
          }],
          meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'chatgpt' },
        };
      },
    },

    {
      name: 'get_dag_history',
      description:
        'Returns the complete Decision DAG commit timeline, active branch, and all historical state commits.',
      category: 'topology',
      inputSchema: {
        type: 'object',
        properties: {
          branch: {
            type: 'string',
            description: 'Optional branch name filter.',
          },
        },
      },
      execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
        const dag = deps.getDag();
        const timeline = dag.getTimeline();
        const branchFilter = params.branch ? String(params.branch) : null;

        const filtered = branchFilter
          ? timeline.filter((c: DAGNode) => c.branch === branchFilter)
          : timeline;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              active_branch: dag.getActiveBranch().name,
              total_commits: timeline.length,
              commits: filtered.map((c: DAGNode, idx: number) => ({
                step_index: idx,
                commit_id: c.id,
                author: c.author,
                message: c.message,
                branch: c.branch,
                timestamp: c.timestamp,
                patch_count: c.patches.length,
                node_count: Object.keys(c.state.nodes).length,
              })),
            }, null, 2),
          }],
          meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'chatgpt' },
        };
      },
    },
  ];

  const unregisters = tools.map((tool) => mcp.registerTool(tool));
  return () => {
    unregisters.forEach((unreg) => {
      if (typeof unreg === 'function') unreg();
    });
  };
}
