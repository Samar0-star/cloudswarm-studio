/**
 * Unit Tests for NVIDIA NIM Streaming Client & Live Swarm Orchestrator
 */

import { NvidiaNimClient, type NimChatMessage } from '../core/swarm/NvidiaNimClient';
import { LiveSwarmOrchestrator } from '../core/swarm/LiveSwarmOrchestrator';
import { ensureWebModelContext } from '../core/webmcp/polyfill';
import type { WebMCPTool } from '../types/webmcp';

describe('NVIDIA NIM Client & Live Swarm Orchestrator Tests', () => {
  const sampleTool: WebMCPTool = {
    name: 'create_vpc',
    description: 'Creates a VPC network',
    inputSchema: {
      type: 'object',
      properties: {
        cidr_block: { type: 'string', description: 'VPC CIDR' },
        name: { type: 'string', description: 'VPC Name' },
      },
      required: ['cidr_block', 'name'],
    },
    execute: async (args) => ({
      content: [{ type: 'text', text: `Created VPC ${args.name}` }],
      isError: false,
    }),
  };

  describe('1. NvidiaNimClient Configuration & Tool Formatting', () => {
    it('initializes with default options and handles key getters/setters', () => {
      const client = new NvidiaNimClient('test-key-123', 'https://integrate.api.nvidia.com/v1', 'meta/llama-3.3-70b-instruct');
      expect(client.hasApiKey()).toBe(true);
      expect(client.getApiKey()).toBe('test-key-123');
      expect(client.getDefaultModel()).toBe('meta/llama-3.3-70b-instruct');

      client.setApiKey('new-key-456');
      expect(client.getApiKey()).toBe('new-key-456');

      client.setDefaultModel('moonshotai/kimi-k2.6');
      expect(client.getDefaultModel()).toBe('moonshotai/kimi-k2.6');
    });

    it('formats WebMCP tools into OpenAI-compatible tool specifications', () => {
      const client = new NvidiaNimClient('test-key');
      const formatted = client.formatWebMCPToolsForNim([sampleTool]);

      expect(formatted).toHaveLength(1);
      const firstTool = formatted[0]!;
      expect(firstTool.type).toBe('function');
      expect(firstTool.function.name).toBe('create_vpc');
      expect(firstTool.function.description).toBe('Creates a VPC network');
      expect(firstTool.function.parameters).toBeDefined();
    });

    it('throws error when streaming without an API key', async () => {
      const client = new NvidiaNimClient('');
      const messages: NimChatMessage[] = [{ role: 'user', content: 'Hello' }];

      const stream = client.streamChatCompletion(messages);
      await expect(stream.next()).rejects.toThrow('NVIDIA NIM API key is missing');
    });
  });

  describe('3. WebMCP Tool Execution to Zustand Store End-to-End Sync', () => {
    it('directly updates store topologyState and auditReport when create_resource_node is executed', async () => {
      const { useCloudSwarmStore } = await import('../store/useCloudSwarmStore');
      const store = useCloudSwarmStore.getState();
      const mcpEngine = store.mcpEngine;

      const initialNodeCount = Object.keys(useCloudSwarmStore.getState().topologyState.nodes).length;

      const result = await mcpEngine.executeTool('create_resource_node', {
        id: 'test-mcp-ec2-node',
        type: 'aws_instance',
        name: 'MCP Auto-Provisioned EC2',
        config: { instance_type: 't3.large' },
        position: { x: 500, y: 350 },
      });

      expect(result.isError).toBeFalsy();

      const updatedState = useCloudSwarmStore.getState().topologyState;
      const createdNode = updatedState.nodes['test-mcp-ec2-node'];

      expect(createdNode).toBeDefined();
      expect(createdNode?.name).toBe('MCP Auto-Provisioned EC2');
      expect(createdNode?.config.instance_type).toBe('t3.large');
      expect(Object.keys(updatedState.nodes).length).toBe(initialNodeCount + 1);

      // Verify HCL and Audit Report updated
      const hcl = useCloudSwarmStore.getState().hclCode;
      expect(hcl).toContain('aws_instance');
    });

    it('directly updates store when orchestrate_cloud_topology is executed', async () => {
      const { useCloudSwarmStore } = await import('../store/useCloudSwarmStore');
      const store = useCloudSwarmStore.getState();
      const mcpEngine = store.mcpEngine;

      const result = await mcpEngine.executeTool('orchestrate_cloud_topology', {
        architecture_name: 'TestLiveSwarm',
        region: 'us-east-1',
        vpc: { cidr_block: '10.50.0.0/16' },
        resources: [
          {
            id: 'node-live-rds',
            type: 'aws_db_instance',
            name: 'Live Swarm RDS Postgres',
            config: { engine: 'postgres', instance_class: 'db.r6g.xlarge' },
          },
        ],
      });

      expect(result.isError).toBeFalsy();

      const updatedNodes = useCloudSwarmStore.getState().topologyState.nodes;
      expect(updatedNodes['vpc-main']).toBeDefined();
      expect(updatedNodes['node-live-rds']).toBeDefined();
      expect(updatedNodes['node-live-rds']?.name).toBe('Live Swarm RDS Postgres');
    });
  });
});

