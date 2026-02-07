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
      maxPredictedTokens: options?.maxTokens,
    });
    return result.content;
  }

  async chat(
    messages: ChatMessage[],
    options?: GenerateOptions,
  ): Promise<string> {
    const model = await this.client.llm.model(this.modelName);
    const result = await model.respond(
      messages.map((m) => ({ role: m.role, content: m.content })),
      {
        temperature: options?.temperature,
        maxPredictedTokens: options?.maxTokens,
      },
    );
    return result.content;
  }

  async *streamContent(
    prompt: string,
    options?: GenerateOptions,
  ): AsyncGenerator<StreamChunk> {
    const model = await this.client.llm.model(this.modelName);
    const prediction = model.respond(prompt, {
      temperature: options?.temperature,
      maxPredictedTokens: options?.maxTokens,
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
    const prediction = model.respond(
      messages.map((m) => ({ role: m.role, content: m.content })),
      {
        temperature: options?.temperature,
        maxPredictedTokens: options?.maxTokens,
      },
    );

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
