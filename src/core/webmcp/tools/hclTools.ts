/**
 * Bidirectional Terraform HCL WebMCP Tools
 *
 * Exposes AST-level Terraform HCL compilation and deserialization to WebMCP agents:
 * - export_terraform_hcl
 * - import_terraform_hcl
 */

import type {
  WebMCPTool,
  WebMCPToolResult,
  WebMCPExecutionContext,
  WebModelContextAPI,
} from '../../../types/webmcp';
import type { TopologyState } from '../../../types/topology';
import { HCLSyncEngine } from '../../sync/HCLSyncEngine';

export interface HCLToolDependencies {
  getState: () => TopologyState;
  setState: (state: TopologyState) => void;
  syncHclToCanvas?: (hcl: string) => Promise<void>;
}

export function registerHCLTools(
  mcp: WebModelContextAPI,
  deps: HCLToolDependencies
): () => void {
  const tools: WebMCPTool[] = [
    {
      name: 'export_terraform_hcl',
      description:
        'Compiles the current visual canvas architecture into production-ready, syntax-valid HashiCorp Terraform / OpenTofu HCL2 code.',
      category: 'topology',
      inputSchema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['hcl', 'json'],
            default: 'hcl',
            description: 'Output format: "hcl" for standard Terraform code, or "json" for Terraform JSON.',
          },
        },
      },
      execute: async (_params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
        const state = deps.getState();
        const hclCode = HCLSyncEngine.canvasToHcl(state);
        const nodeCount = Object.keys(state.nodes).length;
        const edgeCount = Object.keys(state.edges).length;

        return {
          content: [{
            type: 'text',
            text: hclCode,
          }],
          meta: {
            executionTimeMs: 0,
            agentId: context?.agentId ?? 'chatgpt',
            nodeCount,
            edgeCount,
            generatedAt: Date.now(),
          },
        };
      },
    },

    {
      name: 'import_terraform_hcl',
      description:
        'Parses raw Terraform HCL2 code and materializes it into interactive cloud resource nodes and directed edges on the canvas.',
      category: 'topology',
      inputSchema: {
        type: 'object',
        required: ['hcl_code'],
        properties: {
          hcl_code: {
            type: 'string',
            description: 'Raw Terraform / OpenTofu HCL2 code containing resource blocks (e.g. resource "aws_vpc" "main" { ... }).',
          },
        },
      },
      execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
        const hclCode = String(params.hcl_code ?? '');
        if (!hclCode.trim()) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Error: hcl_code cannot be empty.' }],
            meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'chatgpt' },
          };
        }

        try {
          if (deps.syncHclToCanvas) {
            await deps.syncHclToCanvas(hclCode);
          } else {
            const parsedState = HCLSyncEngine.hclToCanvas(hclCode);
            deps.setState(parsedState);
          }

          const updatedState = deps.getState();
          const nodeCount = Object.keys(updatedState.nodes).length;
          const edgeCount = Object.keys(updatedState.edges).length;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                status: 'success',
                message: `Successfully materialized ${nodeCount} resources and ${edgeCount} connections from Terraform HCL.`,
                materialized_nodes: Object.values(updatedState.nodes).map((n) => ({
                  id: n.id,
                  type: n.type,
                  name: n.name,
                })),
              }, null, 2),
            }],
            meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'chatgpt', nodeCount, edgeCount },
          };
        } catch (err) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Terraform HCL Parsing Error: ${err instanceof Error ? err.message : String(err)}`,
            }],
            meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'chatgpt' },
          };
        }
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
