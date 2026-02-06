
export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export type MessageRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

/**
 * Represents a chunk of data from an AI provider stream.
 * This allows for structured content like thought processes, tool calls, etc.
 */
export interface StreamChunk {
  type: 'text' | 'thought' | 'tool_call' | 'error';
  content: string;
  metadata?: Record<string, any>;
}

export interface AIProvider {
  /**
   * The identifier/name of the model being used.
   */
  readonly modelName: string;

  /**
   * Generates content based on the provided prompt.
   * @param prompt The user input prompt.
   * @param options Optional configuration for generation.
   * @returns A promise resolving to the generated text.
   */
  generateContent(prompt: string, options?: GenerateOptions): Promise<string>;

  /**
   * Generates content in a chat format.
   * @param messages The chat history.
   * @param options Optional configuration for generation.
   * @returns A promise resolving to the final message text.
   */
  chat(messages: ChatMessage[], options?: GenerateOptions): Promise<string>;

  /**
   * Streams content based on the provided prompt.
   * @param prompt The user input prompt.
   * @param options Optional configuration for generation.
   * @returns An async generator yielding structured chunks.
   */
  streamContent(
    prompt: string,
    options?: GenerateOptions,
  ): AsyncGenerator<StreamChunk>;

  /**
   * Streams content in a chat format.
   * @param messages The chat history.
   * @param options Optional configuration for generation.
   * @returns An async generator yielding structured chunks.
   */
  streamChat(
    messages: ChatMessage[],
    options?: GenerateOptions,
  ): AsyncGenerator<StreamChunk>;

  /**
   * Lists available models for this provider.
   * @returns A promise resolving to a list of model names.
   */
  listModels(): Promise<string[]>;
}
