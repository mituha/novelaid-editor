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
      const openAiMessages = messages.map(m => this.mapMessage(m));
      const tools = this.mapTools(options?.tools);

      const payload: any = {
        model: this.modelName,
        messages: openAiMessages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
      };

      if (tools) {
        payload.tools = tools;
      }

      console.log(`[OpenAIProvider] chat started. Tools available:`, tools?.length || 0);

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const responseMessage = response.data.choices[0].message;
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        // Just return the string representation for non-streaming chat if tool calls happen
        return `[Tool Call Request: ${responseMessage.tool_calls.map((tc: any) => tc.function?.name).join(', ')}]`;
      }
      return responseMessage.content || '';
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      throw new Error(`OpenAI chat failed: ${errorMessage}`);
    }
  }

  private mapMessage(m: ChatMessage): any {
    if (m.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: m.tool_call_id,
        content: m.content || '',
      };
    } else if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args),
          }
        })),
      };
    }
    return { role: m.role, content: m.content };
  }

  private mapTools(tools?: any[]): any[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }
    }));
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
    const openAiMessages = messages.map(m => this.mapMessage(m));
    const tools = this.mapTools(options?.tools);

    const payload: any = {
      model: this.modelName,
      messages: openAiMessages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: true,
    };

    if (tools) {
      payload.tools = tools;
    }

    console.log(`[OpenAIProvider] streamChat started. Tools available:`, tools?.length || 0);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let partialLine = '';

    // Track active tool calls being streamed
    let activeToolCalls: { [index: number]: { id: string; name: string; args: string } } = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkText = decoder.decode(value, { stream: true });
      const lines = (partialLine + chunkText).split('\n');
      partialLine = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices?.[0]?.delta;

            if (delta) {
              // Handle tool calls
              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index;
                  if (!activeToolCalls[idx]) {
                    activeToolCalls[idx] = { id: tc.id || '', name: tc.function?.name || '', args: '' };
                  }
                  if (tc.function?.arguments) {
                    activeToolCalls[idx].args += tc.function.arguments;
                  }
                }
              }

              if (delta.reasoning_content) {
                yield { content: delta.reasoning_content, type: 'thought' };
              }
              if (delta.content) {
                yield { content: delta.content, type: 'text' };
              }
            }
          } catch (e) {
            // Ignore parse errors on incomplete chunks
          }
        }
      }
    }

    // Yield completed tool calls at the end of the stream
    for (const idx in activeToolCalls) {
      const tc = activeToolCalls[idx];
      console.log(`[OpenAIProvider] Yielding toolCallRequest:`, tc.name);
      yield {
        type: 'tool_call',
        content: '',
        metadata: {
          tool_call: {
            id: tc.id || `call_${Date.now()}`,
            name: tc.name,
            args: tc.args ? JSON.parse(tc.args) : {},
          },
        },
      };
    }
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
