/**
 * NVIDIA NIM Frontier Model Streaming Client
 *
 * Connects to NVIDIA NIM (OpenAI-compatible) endpoint:
 * Via proxy: /api/nim/chat/completions (bypasses browser CORS)
 * Or direct: https://integrate.api.nvidia.com/v1/chat/completions
 *
 * Supported Models:
 * - moonshotai/kimi-k3 (Fast frontier reasoning & tool calling)
 * - nvidia/llama-3.1-nemotron-70b-instruct (Frontier architecture synthesis)
 * - meta/llama-3.2-90b-vision-instruct (High-scale macro planning)
 */

import type { WebMCPTool } from '../../types/webmcp';

export interface NimChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

export interface NimCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface NimStreamChunk {
  contentChunk?: string;
  thoughtChunk?: string;
  toolCallChunk?: {
    index: number;
    id?: string;
    name?: string;
    arguments?: string;
  };
  isDone: boolean;
}

export class NvidiaNimClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(
    apiKey: string = '',
    baseUrl?: string,
    defaultModel: string = 'moonshotai/kimi-k3'
  ) {
    this.apiKey = apiKey.trim();
    const fallbackUrl = typeof window !== 'undefined' ? '/api/nim' : 'https://integrate.api.nvidia.com/v1';
    this.baseUrl = (baseUrl || fallbackUrl).replace(/\/+$/, '');
    this.defaultModel = defaultModel;
  }

  public setApiKey(key: string): void {
    this.apiKey = key.trim();
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public hasApiKey(): boolean {
    return this.apiKey.length > 0;
  }

  public setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  public getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Converts WebMCP tools to OpenAI/NVIDIA NIM function schemas.
   */
  public formatWebMCPToolsForNim(tools: WebMCPTool[]): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: (tool.inputSchema as unknown) as Record<string, unknown>,
      },
    }));
  }

  /**
   * Dispatches a streaming request to NVIDIA NIM and yields tokens/tool calls.
   */
  public async *streamChatCompletion(
    messages: NimChatMessage[],
    tools?: WebMCPTool[],
    options?: NimCompletionOptions
  ): AsyncGenerator<NimStreamChunk, void, unknown> {
    if (!this.apiKey) {
      throw new Error('NVIDIA NIM API key is missing. Please set your NVIDIA_API_KEY in settings.');
    }

    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? 0.2;
    const max_tokens = options?.max_tokens ?? 2048;

    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens,
      stream: true,
    };

    if (tools && tools.length > 0) {
      payload.tools = this.formatWebMCPToolsForNim(tools);
      payload.tool_choice = 'auto';
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchErr) {
      throw new Error(`Failed to connect to NVIDIA NIM (${this.baseUrl}). Ensure the dev server proxy is running.`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NVIDIA NIM Error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body returned from NVIDIA NIM.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed === 'data: [DONE]') {
          yield { isDone: true };
          return;
        }

        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;
            if (!delta) continue;

            // Handle streaming thoughts / reasoning tokens
            const thought = delta.reasoning_content || delta.thought || '';
            const content = delta.content || '';

            // Handle streaming tool calls
            let toolCallChunk = undefined;
            if (delta.tool_calls && delta.tool_calls.length > 0) {
              const tc = delta.tool_calls[0];
              toolCallChunk = {
                index: tc.index ?? 0,
                id: tc.id,
                name: tc.function?.name,
                arguments: tc.function?.arguments,
              };
            }

            yield {
              contentChunk: content,
              thoughtChunk: thought,
              toolCallChunk,
              isDone: false,
            };
          } catch {
            // Ignore parse errors on partial chunks
          }
        }
      }
    }

    yield { isDone: true };
  }

  /**
   * Generates a structured JSON completion with NVIDIA NIM.
   */
  public async generateJsonCompletion<T = unknown>(
    messages: NimChatMessage[],
    options?: NimCompletionOptions
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('NVIDIA NIM API key is missing. Please set your NVIDIA_API_KEY in settings.');
    }

    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? 0.1;
    const max_tokens = options?.max_tokens ?? 2048;

    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens,
      stream: false,
      response_format: { type: 'json_object' },
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error(`Failed to connect to NVIDIA NIM (${this.baseUrl}). Ensure the dev server proxy is running.`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NVIDIA NIM Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content ?? '';
    const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned) as T;
  }

  /**
   * Generates a non-streaming chat completion with NVIDIA NIM.
   */
  public async chatCompletion(
    messages: NimChatMessage[],
    tools?: WebMCPTool[],
    options?: NimCompletionOptions
  ): Promise<{ content: string; toolCalls?: Array<{ id?: string; name?: string; arguments?: string }> }> {
    let content = '';
    const toolCalls: Array<{ id?: string; name?: string; arguments?: string }> = [];

    for await (const chunk of this.streamChatCompletion(messages, tools, options)) {
      if (chunk.contentChunk) content += chunk.contentChunk;
      if (chunk.toolCallChunk) toolCalls.push(chunk.toolCallChunk);
    }

    return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }
}

