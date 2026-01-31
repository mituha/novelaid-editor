import { LMStudioClient } from '@lmstudio/sdk';
import { BaseProvider } from './BaseProvider';
import { GenerateOptions, ChatMessage } from '../interface';

export class LMStudioProvider extends BaseProvider {
  private client: LMStudioClient;

  /**
   * @param modelName The specific model identifier to load/use in LMStudio.
   * @param baseUrl The base URL of the LMStudio server (default: ws://localhost:1234)
   */
  constructor(modelName: string, baseUrl: string = 'ws://localhost:1234') {
    super(modelName);
    this.client = new LMStudioClient({
      baseUrl,
    });
  }

  async generateContent(prompt: string, options?: GenerateOptions): Promise<string> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }

  async chat(messages: ChatMessage[], options?: GenerateOptions): Promise<string> {
    try {
      const model = await this.client.llm.model(this.modelName);

      const prediction = await model.respond(messages, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens
      });

      return prediction.content;
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
      const model = await this.client.llm.model(this.modelName);

      const prediction = model.respond(messages, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });

      // The SDK might return an object that contains the stream, or is itself async iterable.
      // Based on error "predictionStream is not async iterable", and checking docs/examples pattern:
      // If it's a standard iterator:
      for await (const chunk of prediction) {
        yield chunk.content;
      }
    } catch (error) {
      console.error('LMStudio stream error:', error);
      throw error;
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
