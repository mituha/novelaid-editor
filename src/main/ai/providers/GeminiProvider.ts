import { createGoogleAI } from '@google/genai';
import { BaseProvider } from './BaseProvider';
import { GenerateOptions, ChatMessage, StreamChunk } from '../interface';

export class GeminiProvider extends BaseProvider {
  private client: ReturnType<typeof createGoogleAI>;

  constructor(modelName: string, apiKey: string) {
    super(modelName);
    this.client = createGoogleAI({ apiKey });
  }

  async generateContent(
    prompt: string,
    options?: GenerateOptions,
  ): Promise<string> {
    const result = await this.client.models.generateContent({
      model: this.modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: options?.maxTokens,
        temperature: options?.temperature,
        systemInstruction: options?.systemPrompt,
      },
    });
    return result.text() || '';
  }

  async chat(
    messages: ChatMessage[],
    options?: GenerateOptions,
  ): Promise<string> {
    const result = await this.client.models.generateContent({
      model: this.modelName,
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      config: {
        maxOutputTokens: options?.maxTokens,
        temperature: options?.temperature,
        systemInstruction: options?.systemPrompt,
      },
    });
    return result.text() || '';
  }

  async *streamContent(
    prompt: string,
    options?: GenerateOptions,
  ): AsyncGenerator<StreamChunk> {
    const stream = await this.client.models.generateContentStream({
      model: this.modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: options?.maxTokens,
        temperature: options?.temperature,
        systemInstruction: options?.systemPrompt,
      },
    });

    for await (const chunk of stream.stream) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if ('thought' in part && (part as any).thought) {
            yield { content: (part as any).text, type: 'thought' };
          } else if (part.text) {
            yield { content: part.text, type: 'text' };
          }
        }
      } else {
        const text = chunk.text();
        if (text) yield { content: text, type: 'text' };
      }
    }
  }

  async *streamChat(
    messages: ChatMessage[],
    options?: GenerateOptions,
  ): AsyncGenerator<StreamChunk> {
    const stream = await this.client.models.generateContentStream({
      model: this.modelName,
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      config: {
        maxOutputTokens: options?.maxTokens,
        temperature: options?.temperature,
        systemInstruction: options?.systemPrompt,
      },
    });

    for await (const chunk of stream.stream) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if ('thought' in part && (part as any).thought) {
            yield { content: (part as any).text, type: 'thought' };
          } else if (part.text) {
            yield { content: part.text, type: 'text' };
          }
        }
      } else {
        const text = chunk.text();
        if (text) yield { content: text, type: 'text' };
      }
    }
  }

  async listModels(): Promise<string[]> {
    return [
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-1.0-pro',
    ];
  }
}
