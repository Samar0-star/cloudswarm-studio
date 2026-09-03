import { GeminiClient } from '../core/swarm/GeminiClient';
import type { WebMCPTool } from '../types/webmcp';

describe('GeminiClient Multi-Key Rotation & Tool Calling Engine', () => {
  const sampleKeys = [
    'AIzaSyMockKeyAlpha1234567890abcdefghij',
    'AIzaSyMockKeyBeta1234567890abcdefghijk',
    'AIzaSyMockKeyGamma1234567890abcdefghij',
  ];

  it('initializes with multi-key pool and rotates round-robin', () => {
    const client = new GeminiClient(sampleKeys);
    expect(client.hasApiKey()).toBe(true);
    expect(client.getApiKeys().length).toBe(3);

    const first = client.getActiveKey();
    expect(first).toBe(sampleKeys[0]);

    const second = client.rotateKey();
    expect(second).toBe(sampleKeys[1]);

    const third = client.rotateKey();
    expect(third).toBe(sampleKeys[2]);

    const fourth = client.rotateKey();
    expect(fourth).toBe(sampleKeys[0]);
  });

  it('formats WebMCP tools into OpenAI-compatible tool specifications', () => {
    const client = new GeminiClient(sampleKeys);
    const mockTools: WebMCPTool[] = [
      {
        name: 'orchestrate_cloud_topology',
        description: 'Synthesizes full AWS cloud architecture',
        inputSchema: {
          type: 'object',
          properties: {
            architecture_name: { type: 'string' },
            region: { type: 'string' },
          },
          required: ['architecture_name'],
        },
        execute: async () => ({ content: [{ type: 'text', text: 'success' }] }),
      },
    ];

    const formatted = client.formatWebMCPToolsForGemini(mockTools);
    expect(formatted.length).toBe(1);
    expect(formatted[0]!.type).toBe('function');
    expect((formatted[0]!.function as any).name).toBe('orchestrate_cloud_topology');
    expect((formatted[0]!.function as any).parameters.required).toContain('architecture_name');
  });

  it('handles comma-separated and JSON array key inputs gracefully', () => {
    const client = new GeminiClient('key1, key2, key3');
    expect(client.getApiKeys()).toEqual(['key1', 'key2', 'key3']);

    const clientJson = new GeminiClient('["keyA", "keyB"]');
    expect(clientJson.getApiKeys()).toEqual(['keyA', 'keyB']);
  });

  it('throws informative error when attempting chat completion without keys', async () => {
    const client = new GeminiClient([]);
    await expect(async () => {
      for await (const _ of client.streamChatCompletion([{ role: 'user', content: 'test' }])) {
        // should throw before yield
      }
    }).rejects.toThrow('Google Gemini API keys are missing');
  });
});
