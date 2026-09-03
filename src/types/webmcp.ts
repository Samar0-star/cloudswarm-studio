/**
 * WebMCP Protocol Specification Types (document.modelContext / window.modelContext)
 */
import type { AgentId } from './swarm';

export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: readonly (string | number | boolean)[];
  properties?: Record<string, JSONSchemaProperty>;
  items?: JSONSchemaProperty;
  required?: readonly string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  default?: unknown;
  additionalProperties?: boolean | JSONSchemaProperty;
  minItems?: number;
  maxItems?: number;
}

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: readonly string[];
  additionalProperties?: boolean;
}

export interface WebMCPExecutionContext {
  readonly agentId: AgentId;
  readonly timestamp: number;
  readonly requestId: string;
  readonly signal?: AbortSignal;
  isReadOnly?: boolean;
}

export interface WebMCPContentItem {
  readonly type: 'text' | 'image' | 'resource';
  readonly text?: string;
  readonly data?: string;
  readonly mimeType?: string;
  readonly resource?: {
    readonly uri: string;
    readonly text?: string;
  };
}

export interface WebMCPToolResult {
  readonly content: readonly WebMCPContentItem[];
  readonly isError?: boolean;
  readonly meta?: {
    readonly executionTimeMs: number;
    readonly agentId: string;
    readonly appliedPatches?: number;
    readonly costDeltaMonthlyUsd?: number;
    readonly securityScoreDelta?: number;
    readonly [key: string]: unknown;
  };
}

export interface WebMCPTool {
  readonly name: string;
  readonly description: string;
  readonly category?: 'topology' | 'security' | 'finops' | 'orchestration';
  readonly readOnlyHint?: boolean;
  readonly untrustedContentHint?: boolean;
  readonly secureContext?: boolean;
  readonly inputSchema: ToolInputSchema;
  readonly execute: (
    params: Record<string, unknown>,
    context?: WebMCPExecutionContext
  ) => Promise<WebMCPToolResult>;
}

export interface WebMCPResourceContent {
  readonly uri: string;
  readonly mimeType: string;
  readonly text?: string;
  readonly blob?: string;
}

export interface WebMCPResource {
  readonly uri: string;
  readonly name: string;
  readonly mimeType: string;
  readonly description?: string;
  readonly read: () => Promise<{ readonly contents: readonly WebMCPResourceContent[] }>;
}

export interface WebModelContextAPI {
  readonly version: string;
  readonly isPolyfill: boolean;
  registerTool(tool: WebMCPTool): Promise<() => void> | (() => void);
  unregisterTool(name: string): boolean;
  getTools(category?: string): WebMCPTool[];
  getTool(name: string): WebMCPTool | undefined;
  executeTool(
    name: string,
    params?: Record<string, unknown>,
    context?: Partial<WebMCPExecutionContext>
  ): Promise<WebMCPToolResult>;
  registerResource(resource: WebMCPResource): () => void;
  unregisterResource?(uri: string): boolean;
  listResources(): WebMCPResource[];
  getResource?(uri: string): WebMCPResource | undefined;
  readResource(uri: string): Promise<{ readonly contents: readonly WebMCPResourceContent[] }>;
  addEventListener(event: string, listener: (e: CustomEvent) => void): void;
  removeEventListener(event: string, listener: (e: CustomEvent) => void): void;
}
