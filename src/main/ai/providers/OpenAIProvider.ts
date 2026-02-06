import axios from 'axios';
import { BaseProvider } from './BaseProvider';
import { GenerateOptions, ChatMessage, StreamChunk } from '../interface';

export class OpenAIProvider extends BaseProvider {
  private baseUrl: string;
  private apiKey?: string;

  /**
   * @param modelName The specific model identifier.
   * @param baseUrl The base URL of the OpenAI compatible server (e.g. http://localhost:1234/v1)
   * @param apiKey The API key (optional for local servers)
   */
  constructor(modelName: string, baseUrl: string, apiKey?: string) {
    super(modelName);
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  async generateContent(
    prompt: string,
    options?: GenerateOptions,
  ): Promise<string> {
    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );
    return response.data.choices[0].message.content;
  }

  async chat(
    messages: ChatMessage[],
    options?: GenerateOptions,
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.modelName,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data.choices[0].message.content;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      throw new Error(`OpenAI chat failed: ${errorMessage}`);
    }
  }

  async *streamContent(
    prompt: string,
    options?: GenerateOptions,
  ): AsyncGenerator<StreamChunk> {
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
    for await (const chunk of this.streamChat(messages, options)) {
      yield chunk;
    }
  }

  async *streamChat(
    messages: ChatMessage[],
    options?: GenerateOptions,
  ): AsyncGenerator<StreamChunk> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        stream: true,
      }),
    });

    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let partialLine = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkText = decoder.decode(value, { stream: true });
      const lines = (partialLine + chunkText).split('\n');
      partialLine = lines.pop() || '';

      for (const line of lines) {
        const parsed = this.parseStreamLineComplex(line);
        if (parsed) {
          yield parsed;
        }
      }
    }
  }

  private parseStreamLineComplex(line: string): StreamChunk | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'data: [DONE]') return null;
    if (trimmed.startsWith('data: ')) {
      try {
        const data = JSON.parse(trimmed.slice(6));
        const delta = data.choices?.[0]?.delta;
        if (delta?.reasoning_content) {
          return { content: delta.reasoning_content, type: 'thought' };
        }
        if (delta?.content) {
          return { content: delta.content, type: 'text' };
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
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.data.data.map((m: any) => m.id);
    } catch (error) {
      console.warn('OpenAI listModels failed:', error);
      return [];
    }
  }
}
