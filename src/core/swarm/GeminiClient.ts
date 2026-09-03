/**
 * High-Speed Google Gemini Multi-Key Client with Automatic Key Rotation & Failover
 *
 * Implements:
 * 1. Round-robin multi-key pooling for high-throughput concurrency across 3 agents.
 * 2. Instant automatic failover on 429 (Rate Limit) or 403 (Quota) errors.
 * 3. OpenAI-compatible streaming SSE parser for tool calls and reasoning chunks.
 */

import type { WebMCPTool } from '../../types/webmcp';

export interface GeminiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface GeminiStreamChunk {
  contentChunk?: string;
  thoughtChunk?: string;
  toolCallChunk?: {
    name?: string;
    arguments?: string;
    id?: string;
  };
  finishReason?: string | null;
  activeKeyIndex?: number;
}

export class GeminiClient {
  private apiKeys: string[] = [];
  private currentKeyIndex: number = 0;
  private defaultModel: string = 'gemini-3.7-flash';
  private baseUrl: string = '/api/gemini/v1beta/openai';

  constructor(
    keys: string | string[] = [],
    baseUrl: string = '/api/gemini/v1beta/openai',
    defaultModel: string = 'gemini-3.7-flash'
  ) {
    this.setApiKeys(keys);
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  public setApiKeys(keys: string | string[]): void {
    if (Array.isArray(keys)) {
      this.apiKeys = keys.map((k) => k.trim()).filter((k) => k.length > 0);
    } else if (typeof keys === 'string' && keys.trim().length > 0) {
      // Support comma-separated or JSON array strings
      try {
        const parsed = JSON.parse(keys);
        if (Array.isArray(parsed)) {
          this.apiKeys = parsed.map((k) => String(k).trim()).filter((k) => k.length > 0);
          return;
        }
      } catch {
        // Not JSON
      }
      this.apiKeys = keys.split(',').map((k) => k.trim()).filter((k) => k.length > 0);
    } else {
      this.apiKeys = [];
    }
  }

  public getApiKeys(): string[] {
    return [...this.apiKeys];
  }

  public hasApiKey(): boolean {
    return this.apiKeys.length > 0;
  }

  public getActiveKey(): string {
    if (this.apiKeys.length === 0) return '';
    return this.apiKeys[this.currentKeyIndex % this.apiKeys.length]!;
  }

  public rotateKey(): string {
    if (this.apiKeys.length <= 1) return this.getActiveKey();
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return this.getActiveKey();
  }

  public getDefaultModel(): string {
    return this.defaultModel;
  }

  public setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  /**
   * Formats WebMCP tools into OpenAI-compatible tool specifications.
   */
  public formatWebMCPToolsForGemini(tools: WebMCPTool[]): Array<Record<string, unknown>> {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema ?? { type: 'object', properties: {} },
      },
    }));
  }

  /**
   * Streams chat completions with automatic key failover on 429/403 errors.
   */
  public async *streamChatCompletion(
    messages: GeminiChatMessage[],
    tools?: WebMCPTool[],
    modelOverride?: string
  ): AsyncGenerator<GeminiStreamChunk, void, unknown> {
    if (!this.hasApiKey()) {
      throw new Error('Google Gemini API keys are missing. Please provide at least one key.');
    }

    const model = modelOverride || this.defaultModel;
    const formattedTools = tools && tools.length > 0 ? this.formatWebMCPToolsForGemini(tools) : undefined;

    const payload: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      temperature: 0.2,
      max_tokens: 2048,
    };

    if (formattedTools) {
      payload.tools = formattedTools;
      payload.tool_choice = 'auto';
    }

    let attempts = 0;
    const maxAttempts = Math.max(3, this.apiKeys.length);
    let lastError: Error | null = null;

    while (attempts < maxAttempts) {
      const activeKey = this.getActiveKey();
      const currentKeyIdx = this.currentKeyIndex;

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          if (response.status === 429 || response.status === 403) {
            console.warn(`[GeminiClient] Key #${currentKeyIdx + 1} hit ${response.status}. Rotating key...`);
            this.rotateKey();
            attempts++;
            continue;
          }
          throw new Error(`Gemini API error [${response.status}]: ${errorText || response.statusText}`);
        }

        if (!response.body) {
          throw new Error('ReadableStream not supported on this browser.');
        }

        // Advance key for next independent request to balance load
        this.rotateKey();

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;

            if (trimmed === 'data: [DONE]') {
              yield { finishReason: 'stop', activeKeyIndex: currentKeyIdx };
              return;
            }

            if (trimmed.startsWith('data: ')) {
              try {
                const json = JSON.parse(trimmed.slice(6));
                const choice = json.choices?.[0];
                if (!choice) continue;

                const delta = choice.delta;
                const finishReason = choice.finish_reason;

                const chunk: GeminiStreamChunk = {
                  finishReason,
                  activeKeyIndex: currentKeyIdx,
                };

                if (delta?.content) {
                  chunk.contentChunk = delta.content;
                }

                if (delta?.tool_calls && delta.tool_calls.length > 0) {
                  const tc = delta.tool_calls[0];
                  chunk.toolCallChunk = {
                    id: tc.id,
                    name: tc.function?.name,
                    arguments: tc.function?.arguments,
                  };
                }

                yield chunk;
              } catch {
                // Ignore incomplete SSE chunk json
              }
            }
          }
        }

        return;
      } catch (err: any) {
        lastError = err;
        console.warn(`[GeminiClient] Request failed on key #${currentKeyIdx + 1}: ${err.message}. Retrying...`);
        this.rotateKey();
        attempts++;
      }
    }

    throw lastError || new Error('All Gemini API keys in pool failed or exhausted.');
  }

  /**
   * Generates a non-streaming structured JSON completion with key failover.
   */
  public async generateJsonCompletion<T = unknown>(
    messages: GeminiChatMessage[],
    modelOverride?: string
  ): Promise<T> {
    if (!this.hasApiKey()) {
      throw new Error('Google Gemini API keys are missing. Please provide at least one key.');
    }

    const model = modelOverride || this.defaultModel;
    const payload: Record<string, unknown> = {
      model,
      messages,
      stream: false,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    };

    let attempts = 0;
    const maxAttempts = Math.min(2, Math.max(1, this.apiKeys.length));
    let lastError: Error | null = null;

    while (attempts < maxAttempts) {
      const activeKey = this.getActiveKey();
      const currentKeyIdx = this.currentKeyIndex;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          if (response.status === 429 || response.status === 403) {
            console.warn(`[GeminiClient] Key #${currentKeyIdx + 1} hit ${response.status}. Rotating key...`);
            this.rotateKey();
            attempts++;
            continue;
          }
          throw new Error(`Gemini API error [${response.status}]: ${errorText || response.statusText}`);
        }

        this.rotateKey();
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content ?? '';
        const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        return JSON.parse(cleaned) as T;
      } catch (err: any) {
        lastError = err;
        console.warn(`[GeminiClient] JSON generation failed on key #${currentKeyIdx + 1}: ${err.message}.`);
        this.rotateKey();
        attempts++;
      }
    }

    throw lastError || new Error('All Gemini API keys failed for JSON completion.');
  }

  /**
   * Generates a non-streaming chat completion.
   */
  public async chatCompletion(
    messages: GeminiChatMessage[],
    tools?: WebMCPTool[],
    modelOverride?: string
  ): Promise<{ content: string; toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }> }> {
    let content = '';
    const toolCalls: any[] = [];

    for await (const chunk of this.streamChatCompletion(messages, tools, modelOverride)) {
      if (chunk.contentChunk) content += chunk.contentChunk;
      if (chunk.toolCallChunk) toolCalls.push(chunk.toolCallChunk);
    }

    return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }
}

