import { GoogleGenerativeAI } from '@google/genai';
import { BaseProvider } from './BaseProvider';
import { GenerateOptions } from '../interface';

export class GeminiProvider extends BaseProvider {
  private genAI: GoogleGenerativeAI;
  private model: any; // Using any because the type definition might vary or be complex

  /**
   * @param apiKey The API key for Google GenAI.
   * @param modelName The model name (e.g., 'gemini-1.5-flash').
   */
  constructor(apiKey: string, modelName: string) {
    super(modelName);
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }

  async generateContent(prompt: string, options?: GenerateOptions): Promise<string> {
    try {
      const result = await this.model.generateContent({
        contents: [
            { role: 'user', parts: [{ text: prompt }] }
        ],
        generationConfig: {
          temperature: options?.temperature,
          maxOutputTokens: options?.maxTokens,
        },
        systemInstruction: options?.systemPrompt
      });
      return result.response.text();
    } catch (error) {
      console.error('Gemini generation error:', error);
      throw error;
    }
  }

  async *streamContent(prompt: string, options?: GenerateOptions): AsyncGenerator<string> {
    try {
      const result = await this.model.generateContentStream({
        contents: [
            { role: 'user', parts: [{ text: prompt }] }
        ],
        generationConfig: {
            temperature: options?.temperature,
            maxOutputTokens: options?.maxTokens,
        },
        systemInstruction: options?.systemPrompt
      });

      for await (const chunk of result.stream) {
        yield chunk.text();
      }
    } catch (error) {
      console.error('Gemini streaming error:', error);
      throw error;
    }
  }
}
