import { GoogleGenAI } from '@google/genai';
import { BaseProvider } from './BaseProvider';
import { GenerateOptions, ChatMessage, StreamChunk } from '../interface';

export class GeminiProvider extends BaseProvider {
  private client: GoogleGenAI;

  constructor(modelName: string, apiKey: string) {
    super(modelName);
    if (!apiKey) {
      throw new Error(
        'Gemini APIキーが設定されていません。アプリの設定画面で入力するか、環境変数 GOOGLE_API_KEY を設定してください。',
      );
    }
    this.client = new GoogleGenAI({ apiKey });
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
    return result.text || '';
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
    return result.text || '';
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
            yield { content: (part as any).thought, type: 'thought' };
          } else if (part.text) {
            yield { content: part.text, type: 'text' };
          }
        }
      } else {
        const text = chunk.text;
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
            yield { content: (part as any).thought, type: 'thought' };
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
      'gemini-3-flash',        // 最新：高速・高性能
      'gemini-3-pro',         // 最新：高知能・推論重視
      'gemini-2.0-flash-exp', // 2.0世代の高速版
      'gemini-1.5-pro',       // 1.5世代の安定版（長文コンテキストに強い）
      'gemini-1.5-flash',     // 1.5世代の軽量版
      'gemini-1.0-pro',       // 旧世代の安定版
    ];
  }
}
