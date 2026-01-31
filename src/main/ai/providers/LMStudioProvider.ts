import { BaseProvider } from './BaseProvider';
import { GenerateOptions, ChatMessage } from '../interface';

export class LMStudioProvider extends BaseProvider {
  private baseUrl: string;

  /**
   * @param modelName The specific model identifier to load/use in LMStudio.
   * @param baseUrl The base URL of the LMStudio server (default: ws://localhost:1234)
   */
  constructor(modelName: string, baseUrl: string = 'ws://localhost:1234') {
    super(modelName);
    // LM Studio SDK uses ws://, but for REST API we need http://
    // We accept ws:// to satisfy user preference/config but convert internally.
    this.baseUrl = baseUrl.replace('ws://', 'http://').replace('wss://', 'https://');
  }

  async generateContent(prompt: string, options?: GenerateOptions): Promise<string> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }

  async chat(messages: ChatMessage[], options?: GenerateOptions): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: messages,
          temperature: options?.temperature ?? 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`LMStudio chat error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('LMStudio chat error:', error);
      throw error;
    }
  }

  async *streamContent(prompt: string, options?: GenerateOptions): AsyncGenerator<string> {
     yield* this.streamChat([{ role: 'user', content: prompt }], options);
  }

  async *streamChat(messages: ChatMessage[], options?: GenerateOptions): AsyncGenerator<string> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: messages,
          stream: true,
          temperature: options?.temperature ?? 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`LMStudio stream error: ${response.status} ${response.statusText}`);
      }

      if (!response.body) return;

      // Compatibility for Node fetch body (NodeJS.ReadableStream) or Web Stream
      const stream = response.body as any;

      // If it has getReader, use it (Electron/Web)
      if (typeof stream.getReader === 'function') {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line

          for (const line of lines) {
             const content = this.parseStreamLine(line);
             if (content) yield content;
          }
        }
      } else {
        // Node-like stream (async iterable)
        const decoder = new TextDecoder();
        let buffer = '';
        for await (const chunk of stream) {
            const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
            buffer += text;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const content = this.parseStreamLine(line);
                if (content) yield content;
            }
        }
      }

    } catch (error) {
      console.error('LMStudio streamChat error:', error);
      throw error;
    }
  }

  private parseStreamLine(line: string): string | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'data: [DONE]') return null;
    if (trimmed.startsWith('data: ')) {
      try {
        const data = JSON.parse(trimmed.slice(6));
        return data.choices?.[0]?.delta?.content || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`);
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }
      const data = await response.json() as any;
      // OpenAI format: { data: [{ id: 'model-id', ... }] }
      if (Array.isArray(data.data)) {
          return data.data.map((m: any) => m.id);
      }
      return [];
    } catch (error) {
      console.warn('LMStudio listModels failed:', error);
      return [];
    }
  }
}
