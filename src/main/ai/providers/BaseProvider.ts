import {
  AIProvider,
  GenerateOptions,
  ChatMessage,
  StreamChunk,
} from '../interface';

export abstract class BaseProvider implements AIProvider {
  constructor(public readonly modelName: string) {}

  abstract generateContent(
    prompt: string,
    options?: GenerateOptions,
  ): Promise<string>;

  abstract chat(
    messages: ChatMessage[],
    options?: GenerateOptions,
  ): Promise<string>;

  abstract streamContent(
    prompt: string,
    options?: GenerateOptions,
  ): AsyncGenerator<StreamChunk>;

  abstract streamChat(
    messages: ChatMessage[],
    options?: GenerateOptions,
  ): AsyncGenerator<StreamChunk>;

  abstract listModels(): Promise<string[]>;
}
