import { LMStudioClient } from '@lmstudio/sdk';
import { BaseProvider } from './BaseProvider';
import { GenerateOptions, ChatMessage, StreamChunk } from '../interface';

export class LMStudioProvider extends BaseProvider {
  private client: LMStudioClient;

  /**
   * @param modelName The specific model identifier to load/use in LMStudio.
   * @param baseUrl The base URL of the LMStudio server (default: ws://localhost:1234)
   */
  constructor(modelName: string, baseUrl: string = 'ws://localhost:1234') {
    super(modelName);
    this.client = new LMStudioClient({ baseUrl });
  }

  async generateContent(
    prompt: string,
    options?: GenerateOptions,
  ): Promise<string> {
    const model = await this.client.llm.model(this.modelName);
    const result = await model.respond(prompt, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });
    return result.content;
  }

  async chat(
    messages: ChatMessage[],
    options?: GenerateOptions,
  ): Promise<string> {
    const model = await this.client.llm.model(this.modelName);

    // LMStudio format mapping
    const lmMessages: any[] = messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user', // Often tool results need to be returned as User strings or specific tool parts
          content: `[Tool Result for ${m.name}]\n${m.content}`,
        };
      } else if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
        return {
          role: 'assistant',
          content: m.content || `[Called Tool: ${m.tool_calls.map(tc => tc.name).join(', ')}]`
        };
      }
      return { role: m.role as "system" | "user" | "assistant", content: m.content || '' };
    });

    // We must map our Tools to LMStudio's Function tool format
    let rawTools: any = undefined;
    if (options?.tools && options.tools.length > 0) {
      rawTools = {
        type: 'toolArray',
        tools: options.tools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          }
        }))
      };
    }

    const result = await model.respond(lmMessages, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    //  rawTools, 現状、respondでのツール利用は非サポート？ actを使用する必要がある？
    });
    return result.content;
  }

  async *streamContent(
    prompt: string,
    options?: GenerateOptions,
  ): AsyncGenerator<StreamChunk> {
    const model = await this.client.llm.model(this.modelName);
    const prediction = model.respond(prompt, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });

    for await (const chunk of prediction) {
      const reasoningType = (chunk as any).reasoningType;
      if (
        reasoningType === 'reasoningStartTag' ||
        reasoningType === 'reasoningEndTag'
      ) {
        continue;
      }
      const isReasoning = reasoningType === 'reasoning';
      yield {
        content: chunk.content,
        type: isReasoning ? 'thought' : 'text',
      };
    }
  }

  async *streamChat(
    messages: ChatMessage[],
    options?: GenerateOptions,
  ): AsyncGenerator<StreamChunk> {
    const model = await this.client.llm.model(this.modelName);

    // LMStudio format mapping
    const lmMessages: any[] = messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user', // Often tool results need to be returned as User strings or specific tool parts
          content: `[Tool Result for ${m.name}]\n${m.content}`,
        };
      } else if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
        return {
          role: 'assistant',
          content: m.content || `[Called Tool: ${m.tool_calls.map(tc => tc.name).join(', ')}]`
        };
      }
      return { role: m.role, content: m.content };
    });

    // We must map our Tools to LMStudio's Function tool format
    let rawTools: any = undefined;
    if (options?.tools && options.tools.length > 0) {
      rawTools = {
        type: 'toolArray',
        tools: options.tools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          }
        }))
      };
    }

    console.log(`[LMStudioProvider] streamChat started. Tools available:`, rawTools?.tools?.length || 0);
    console.log(`[LMStudioProvider] Sending messages:`, JSON.stringify(lmMessages, null, 2));

    const prediction = model.respond(lmMessages, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      rawTools,
    });

    let chunkCount = 0;
    for await (const chunk of prediction) {
      chunkCount++;
      // DEBUG: Log the first few chunks to see raw structure coming from SDK
      if (chunkCount <= 3) {
        console.log(`[LMStudioProvider] Raw chunk ${chunkCount}:`, JSON.stringify(chunk));
      }

      if ((chunk as any).type === 'toolCallRequest') {
        const req = (chunk as any).toolCallRequest;
        console.log(`[LMStudioProvider] Yielding toolCallRequest:`, req.name, req.arguments);
        yield {
          type: 'tool_call',
          content: '',
          metadata: {
            tool_call: {
              id: (chunk as any).toolCallRequestId || `call_${Date.now()}`,
              name: req.name,
              args: typeof req.arguments === 'string' ? JSON.parse(req.arguments) : req.arguments,
            },
          },
        };
        continue;
      }

      const reasoningType = (chunk as any).reasoningType;
      if (
        reasoningType === 'reasoningStartTag' ||
        reasoningType === 'reasoningEndTag'
      ) {
        continue;
      }
      const isReasoning = reasoningType === 'reasoning';
      yield {
        content: chunk.content || '',
        type: isReasoning ? 'thought' : 'text',
      };
    }
  }

  async listModels(): Promise<string[]> {
    try {
      // Try to list downloaded models first (more relevant usually)
      if ((this.client.system as any)?.listDownloadedModels) {
        const models = await (this.client.system as any).listDownloadedModels();
        return models.map((m: any) => m.path || m.id || m);
      }

      // If listDownloadedModels is not available or fails, we might try other methods
      // or just return empty for now if SDK changed significantly.
      return [];
    } catch (error) {
      console.warn('LMStudio listModels failed:', error);
      return [];
    }
  }
}
