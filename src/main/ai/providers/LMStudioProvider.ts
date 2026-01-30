import { LMStudioClient } from '@lmstudio/sdk';
import { BaseProvider } from './BaseProvider';
import { GenerateOptions } from '../interface';

export class LMStudioProvider extends BaseProvider {
  private client: LMStudioClient;

  /**
   * @param modelName The specific model identifier to load/use in LMStudio.
   * @param baseUrl The base URL of the LMStudio server (default: http://127.0.0.1:1234)
   */
  constructor(modelName: string, baseUrl: string = 'http://127.0.0.1:1234') {
    super(modelName);
    this.client = new LMStudioClient({
      baseUrl,
    });
  }

  async generateContent(prompt: string, options?: GenerateOptions): Promise<string> {
    try {
      const model = await this.client.llm.get(this.modelName);

      const prediction = await model.respond([
        { role: 'system', content: options?.systemPrompt || 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ], {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens
      });

      return prediction.content;
    } catch (error) {
      console.error('LMStudio generation error:', error);
      throw error;
    }
  }

  async *streamContent(prompt: string, options?: GenerateOptions): AsyncGenerator<string> {
    try {
      const model = await this.client.llm.get(this.modelName);

      const predictionStream = await model.respond([
        { role: 'system', content: options?.systemPrompt || 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ], {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });

      for await (const chunk of predictionStream) {
        yield chunk.content;
      }
    } catch (error) {
      console.error('LMStudio streaming error:', error);
      throw error;
    }
  }
}
