/**
 * WebModelContextEngine — Core WebMCP Protocol Engine
 *
 * Implements the official Web Model Context Protocol specification for client-side
 * tool registration, validation, sandboxed execution, and DOM CustomEvent telemetry.
 */

import type {
  WebModelContextAPI,
  WebMCPTool,
  WebMCPResource,
  WebMCPExecutionContext,
  WebMCPToolResult,
  WebMCPResourceContent,
  ToolInputSchema,
  JSONSchemaProperty,
} from '../../types/webmcp';
import type { AgentId } from '../../types/swarm';

export class WebModelContextEngine implements WebModelContextAPI {
  public readonly version = '1.0.0-draft';
  public readonly isPolyfill: boolean;

  private readonly toolsMap = new Map<string, WebMCPTool>();
  private readonly resources = new Map<string, WebMCPResource>();
  private readonly eventTarget = new EventTarget();
  private externalAgentCounter = 1;

  constructor(isPolyfill: boolean = false) {
    this.isPolyfill = isPolyfill;
    if (typeof window !== 'undefined') {
      try {
        (window as any).__realExecuteTool__ = (name: string, params?: Record<string, unknown>, context?: Partial<WebMCPExecutionContext>) => {
          return this.executeTool(name, params, context);
        };
      } catch {}
    }
  }

  /**
   * Registers a new WebMCP tool.
   * Returns an unregister handle.
   */
  public async registerTool(tool: WebMCPTool): Promise<() => void> {
    if (!tool.name || typeof tool.execute !== 'function') {
      throw new Error('WebMCP: Invalid tool registration. Name and execute function are required.');
    }

    this.toolsMap.set(tool.name, tool);
    this.dispatchEvent('webmcp:registered', {
      type: 'tool',
      name: tool.name,
      category: tool.category,
      description: tool.description,
    });

    if (typeof window !== 'undefined') {
      try {
        const mc = (window as any).modelContext;
        if (mc && mc !== this && typeof mc.registerTool === 'function') {
          mc.registerTool(tool);
        }
      } catch {}
    }

    if (typeof document !== 'undefined') {
      try {
        const docMc = (document as any).modelContext;
        if (docMc && docMc !== this && typeof docMc.registerTool === 'function') {
          docMc.registerTool(tool);
        }
      } catch {}
    }

    if (typeof navigator !== 'undefined') {
      try {
        const navMc = (navigator as any).modelContext;
        if (navMc && navMc !== this && typeof navMc.registerTool === 'function') {
          navMc.registerTool(tool);
        }
      } catch {}
    }

    return () => {
      this.unregisterTool(tool.name);
    };
  }

  /**
   * Unregisters a WebMCP tool by name.
   */
  public unregisterTool(name: string): boolean {
    const existed = this.toolsMap.delete(name);
    if (existed) {
      this.dispatchEvent('webmcp:unregistered', { type: 'tool', name });
    }
    return existed;
  }

  /**
   * Lists all registered WebMCP tools, optionally filtered by category.
   */
  public getTools(category?: string): WebMCPTool[] {
    const allTools = Array.from(this.toolsMap.values());
    if (category) {
      return allTools.filter((tool) => tool.category === category);
    }
    return allTools;
  }

  /**
   * Gets a specific registered tool by name.
   */
  public getTool(name: string): WebMCPTool | undefined {
    return this.toolsMap.get(name);
  }

  /**
   * Validates parameters against a JSON Schema.
   */
  private validateParams(schema: ToolInputSchema, params: Record<string, unknown>): { valid: boolean; error?: string } {
    if (schema.required) {
      for (const requiredKey of schema.required) {
        if (params[requiredKey] === undefined || params[requiredKey] === null) {
          return {
            valid: false,
            error: `Validation Error: Missing required parameter '${requiredKey}'.`,
          };
        }
      }
    }

    for (const [key, value] of Object.entries(params)) {
      const propSchema = schema.properties?.[key];
      if (propSchema) {
        const typeCheck = this.validatePropertyType(key, value, propSchema);
        if (!typeCheck.valid) {
          return typeCheck;
        }
      } else if (schema.additionalProperties === false) {
        return {
          valid: false,
          error: `Validation Error: Unexpected property '${key}' not allowed by schema.`,
        };
      }
    }

    return { valid: true };
  }

  private validatePropertyType(
    key: string,
    value: unknown,
    propSchema: JSONSchemaProperty
  ): { valid: boolean; error?: string } {
    if (value === undefined || value === null) {
      return { valid: true };
    }

    switch (propSchema.type) {
      case 'string':
        if (typeof value !== 'string') {
          return { valid: false, error: `Validation Error: Parameter '${key}' must be a string.` };
        }
        if (propSchema.enum && !propSchema.enum.includes(value)) {
          return {
            valid: false,
            error: `Validation Error: Parameter '${key}' must be one of [${propSchema.enum.join(', ')}].`,
          };
        }
        if (propSchema.pattern) {
          const regex = new RegExp(propSchema.pattern);
          if (!regex.test(value)) {
            return {
              valid: false,
              error: `Validation Error: Parameter '${key}' does not match pattern '${propSchema.pattern}'.`,
            };
          }
        }
        break;

      case 'number':
      case 'integer':
        if (typeof value !== 'number' || (propSchema.type === 'integer' && !Number.isInteger(value))) {
          return {
            valid: false,
            error: `Validation Error: Parameter '${key}' must be a valid ${propSchema.type}.`,
          };
        }
        if (propSchema.minimum !== undefined && value < propSchema.minimum) {
          return {
            valid: false,
            error: `Validation Error: Parameter '${key}' cannot be less than ${propSchema.minimum}.`,
          };
        }
        if (propSchema.maximum !== undefined && value > propSchema.maximum) {
          return {
            valid: false,
            error: `Validation Error: Parameter '${key}' cannot be greater than ${propSchema.maximum}.`,
          };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return { valid: false, error: `Validation Error: Parameter '${key}' must be a boolean.` };
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return { valid: false, error: `Validation Error: Parameter '${key}' must be an array.` };
        }
        if (propSchema.minItems !== undefined && value.length < propSchema.minItems) {
          return {
            valid: false,
            error: `Validation Error: Parameter '${key}' must contain at least ${propSchema.minItems} items.`,
          };
        }
        if (propSchema.items) {
          for (let i = 0; i < value.length; i++) {
            const itemCheck = this.validatePropertyType(`${key}[${i}]`, value[i], propSchema.items as JSONSchemaProperty);
            if (!itemCheck.valid) return itemCheck;
          }
        }
        break;

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value) || value === null) {
          return { valid: false, error: `Validation Error: Parameter '${key}' must be an object.` };
        }
        if (propSchema.properties) {
          const nestedSchema: ToolInputSchema = {
            type: 'object',
            properties: propSchema.properties,
            required: propSchema.required,
            additionalProperties: typeof propSchema.additionalProperties === 'boolean' ? propSchema.additionalProperties : undefined
          };
          const objCheck = this.validateParams(nestedSchema, value as Record<string, unknown>);
          if (!objCheck.valid) {
            return { valid: false, error: `Validation Error in '${key}': ${objCheck.error}` };
          }
        } else if (propSchema.additionalProperties === false) {
          // If no properties defined but additionalProperties is false, object must be empty
          if (Object.keys(value).length > 0) {
            return { valid: false, error: `Validation Error: Parameter '${key}' does not allow additional properties.` };
          }
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Invokes a registered WebMCP tool with schema validation and telemetry.
   */
  public async executeTool(
    name: string,
    params: Record<string, unknown> = {},
    context?: Partial<WebMCPExecutionContext>
  ): Promise<WebMCPToolResult> {
    const startTime = performance.now();
    const tool = this.toolsMap.get(name);

    // If no specific internal agent is driving this (e.g. from ChatGPT Desktop),
    // assign a parallel external agent ID (ext-1 through ext-4)
    let assignedAgentId: AgentId = context?.agentId as AgentId;
    if (!assignedAgentId) {
      assignedAgentId = `ext-${this.externalAgentCounter}` as AgentId;
      this.externalAgentCounter = (this.externalAgentCounter % 4) + 1;
    }

    const execContext: WebMCPExecutionContext = {
      agentId: assignedAgentId,
      timestamp: Date.now(),
      requestId: context?.requestId ?? `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      signal: context?.signal,
    };

    if (!tool) {
      const notFoundResult: WebMCPToolResult = {
        isError: true,
        content: [{ type: 'text', text: `WebMCP Error: Tool '${name}' not found in registry.` }],
        meta: {
          executionTimeMs: performance.now() - startTime,
          agentId: execContext.agentId,
        },
      };
      this.dispatchEvent('webmcp:tool-error', { toolName: name, error: notFoundResult, context: execContext });
      return notFoundResult;
    }

    // Check for abort signal
    if (execContext.signal?.aborted) {
      const abortResult: WebMCPToolResult = {
        isError: true,
        content: [{ type: 'text', text: `WebMCP Error: Tool execution for '${name}' was aborted.` }],
        meta: {
          executionTimeMs: performance.now() - startTime,
          agentId: execContext.agentId,
        },
      };
      return abortResult;
    }

    // WebMCP-Phalanx Security Enforcement
    if (tool.secureContext && typeof window !== 'undefined' && window.isSecureContext === false) {
      const securityError: WebMCPToolResult = {
        isError: true,
        content: [{ type: 'text', text: `WebMCP Security Veto: Tool '${name}' requires a SecureContext (HTTPS).` }],
        meta: { executionTimeMs: performance.now() - startTime, agentId: execContext.agentId },
      };
      this.dispatchEvent('webmcp:tool-error', { toolName: name, error: securityError.content[0]?.text ?? 'Security error', context: execContext });
      return securityError;
    }
    
    // Explicit mutation guard for readOnlyHint
    if (tool.readOnlyHint) {
       // Sandbox the execution context to prevent optimistic state mutation?
       execContext.isReadOnly = true; 
    }

    // Parameter aliasing for resilient multi-agent & external LLM execution
    const normalizedParams: Record<string, unknown> = { ...params };
    if (name === 'time_travel_to_step') {
      if (normalizedParams.step_index === undefined) {
        normalizedParams.step_index = 0;
      }
    } else if (name === 'compare_architecture_branches') {
      if (normalizedParams.branch_a !== undefined && normalizedParams.commit_a === undefined) {
        normalizedParams.commit_a = normalizedParams.branch_a;
      }
      if (normalizedParams.branch_b !== undefined && normalizedParams.commit_b === undefined) {
        normalizedParams.commit_b = normalizedParams.branch_b;
      }
    } else if (name === 'get_primitive_schema' || name === 'query_resource_pricing') {
      if (normalizedParams.primitive_type !== undefined && normalizedParams.resource_type === undefined) {
        normalizedParams.resource_type = normalizedParams.primitive_type;
      }
      if (normalizedParams.resource_type !== undefined && normalizedParams.primitive_type === undefined) {
        normalizedParams.primitive_type = normalizedParams.resource_type;
      }
      if (name === 'query_resource_pricing' && normalizedParams.config === undefined) {
        normalizedParams.config = {};
      }
    } else if (name === 'generate_least_privilege_policy') {
      if (normalizedParams.service !== undefined && normalizedParams.workload_type === undefined) {
        normalizedParams.workload_type = 's3_read_write';
      }
    } else if (name === 'create_resource_node') {
      if (normalizedParams.type === 'aws_waf_web_acl') {
        normalizedParams.type = 'aws_wafv2_web_acl';
      }
      if (!normalizedParams.id && (normalizedParams.name || normalizedParams.type)) {
        const baseName = String(normalizedParams.name || normalizedParams.type || 'node')
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '_');
        normalizedParams.id = `${baseName}_${Math.random().toString(36).substring(2, 7)}`;
      }
    }

    this.dispatchEvent('webmcp:tool-call', {
      toolName: name,
      params: normalizedParams,
      context: execContext,
    });

    // Validate parameters
    const validation = this.validateParams(tool.inputSchema, normalizedParams);
    if (!validation.valid) {
      const validationErrorResult: WebMCPToolResult = {
        isError: true,
        content: [{ type: 'text', text: validation.error ?? 'Invalid parameters' }],
        meta: {
          executionTimeMs: performance.now() - startTime,
          agentId: execContext.agentId,
        },
      };
      this.dispatchEvent('webmcp:tool-error', {
        toolName: name,
        error: validation.error,
        context: execContext,
      });
      return validationErrorResult;
    }

    try {
      const result = await tool.execute(normalizedParams, execContext);
      const executionTimeMs = performance.now() - startTime;

      const enrichedResult: WebMCPToolResult = {
        ...result,
        meta: {
          ...result.meta,
          executionTimeMs,
          agentId: execContext.agentId,
        },
      };

      this.dispatchEvent('webmcp:tool-success', {
        toolName: name,
        result: enrichedResult,
        context: execContext,
      });

      return enrichedResult;
    } catch (err: unknown) {
      const executionTimeMs = performance.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorResult: WebMCPToolResult = {
        isError: true,
        content: [{ type: 'text', text: `Tool Execution Failed: ${errorMessage}` }],
        meta: {
          executionTimeMs,
          agentId: execContext.agentId,
        },
      };

      this.dispatchEvent('webmcp:tool-error', {
        toolName: name,
        error: errorMessage,
        context: execContext,
      });

      return errorResult;
    }
  }

  /**
   * Registers a stateful resource context.
   */
  public registerResource(resource: WebMCPResource): () => void {
    this.resources.set(resource.uri, resource);
    this.dispatchEvent('webmcp:registered', {
      type: 'resource',
      uri: resource.uri,
      name: resource.name,
    });

    if (typeof document !== 'undefined') {
      try {
        const docMc = (document as any).modelContext;
        if (docMc && docMc !== this && typeof docMc.registerResource === 'function') {
          docMc.registerResource(resource);
        }
      } catch {}
    }

    if (typeof navigator !== 'undefined') {
      try {
        const navMc = (navigator as any).modelContext;
        if (navMc && navMc !== this && typeof navMc.registerResource === 'function') {
          navMc.registerResource(resource);
        }
      } catch {}
    }

    return () => {
      this.unregisterResource(resource.uri);
    };
  }

  public unregisterResource(uri: string): boolean {
    const existed = this.resources.delete(uri);
    if (existed) {
      this.dispatchEvent('webmcp:unregistered', { type: 'resource', uri });
    }
    return existed;
  }

  public listResources(): WebMCPResource[] {
    return Array.from(this.resources.values());
  }

  public getResources(): WebMCPResource[] {
    return this.listResources();
  }

  public get tools(): WebMCPTool[] {
    return this.getTools();
  }

  public get toolsList(): WebMCPTool[] {
    return this.getTools();
  }

  public getResource(uri: string): WebMCPResource | undefined {
    return this.resources.get(uri);
  }

  public async readResource(uri: string): Promise<{ readonly contents: readonly WebMCPResourceContent[] }> {
    const resource = this.resources.get(uri);
    if (!resource) {
      throw new Error(`WebMCP: Resource '${uri}' not found.`);
    }
    const result = await resource.read();
    this.dispatchEvent('webmcp:resource-read', { uri, resourceName: resource.name });
    return result;
  }

  public addEventListener(event: string, listener: (e: CustomEvent) => void): void {
    this.eventTarget.addEventListener(event, listener as EventListener);
  }

  public removeEventListener(event: string, listener: (e: CustomEvent) => void): void {
    this.eventTarget.removeEventListener(event, listener as EventListener);
  }

  private dispatchEvent(name: string, detail: unknown): void {
    if (typeof CustomEvent !== 'undefined') {
      const event = new CustomEvent(name, { detail, bubbles: true });
      this.eventTarget.dispatchEvent(event);

      // Also dispatch on global document if present
      if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
        try {
          document.dispatchEvent(event);
        } catch {
          // Ignore DOM propagation errors in test environments
        }
      }
    }
  }
}
