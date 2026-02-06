import { BaseProvider } from './BaseProvider';
import { GenerateOptions, ChatMessage } from '../interface';

export class OpenAIProvider extends BaseProvider {
  private baseUrl: string;
  private apiKey: string;

  /**
   * @param modelName The specific model identifier.
   * @param baseUrl The base URL of the OpenAI compatible server (e.g. http://localhost:1234/v1)
   * @param apiKey The API key (optional for local servers)
   */
  constructor(modelName: string, baseUrl: string, apiKey: string = '') {
    super(modelName);
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  async generateContent(prompt: string, options?: GenerateOptions): Promise<string> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }

  async chat(messages: ChatMessage[], options?: GenerateOptions): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: messages,
          temperature: options?.temperature ?? 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI chat error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('OpenAI chat error:', error);
      throw error;
    }
  }

  async *streamContent(prompt: string, options?: GenerateOptions): AsyncGenerator<string> {
     yield* this.streamChat([{ role: 'user', content: prompt }], options);
  }

  async *streamChat(messages: ChatMessage[], options?: GenerateOptions): AsyncGenerator<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: messages,
          stream: true,
          temperature: options?.temperature ?? 0.7,
        }),
      });

      if (!response.ok) {
         const errorText = await response.text();
        throw new Error(`OpenAI stream error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      if (!response.body) return;

      const stream = response.body as any;
      let isInReasoning = false;

      const handleLine = (line: string): string | null => {
        const result = this.parseStreamLineComplex(line);
        if (!result) return null;

        let output = '';
        if (result.type === 'reasoning' && !isInReasoning) {
          output = `<thought>${result.content}`;
          isInReasoning = true;
        } else if (result.type === 'content' && isInReasoning) {
          output = `</thought>${result.content}`;
          isInReasoning = false;
        } else {
          output = result.content;
        }
        return output;
      };

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
          buffer = lines.pop() || '';

          for (const line of lines) {
             const content = handleLine(line);
             if (content) yield content;
          }
        }
      } else {
        const decoder = new TextDecoder();
        let buffer = '';
        for await (const chunk of stream) {
            const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
            buffer += text;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const content = handleLine(line);
                if (content) yield content;
            }
        }
      }

      if (isInReasoning) {
        yield '</thought>';
      }

    } catch (error) {
      console.error('OpenAI streamChat error:', error);
      throw error;
    }
  }

  private parseStreamLineComplex(line: string): { content: string, type: 'reasoning' | 'content' } | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'data: [DONE]') return null;
    if (trimmed.startsWith('data: ')) {
      try {
        const data = JSON.parse(trimmed.slice(6));
        const delta = data.choices?.[0]?.delta;
        if (delta?.reasoning_content) {
          return { content: delta.reasoning_content, type: 'reasoning' };
        }
        if (delta?.content) {
          return { content: delta.content, type: 'content' };
        }
        return null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
         headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }
      const data = await response.json() as any;
      if (Array.isArray(data.data)) {
          return data.data.map((m: any) => m.id);
      }
      return [];
    } catch (error) {
      console.warn('OpenAI listModels failed:', error);
      return [];
    }
  }
}
