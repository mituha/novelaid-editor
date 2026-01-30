
export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
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
   * Streams content based on the provided prompt.
   * @param prompt The user input prompt.
   * @param options Optional configuration for generation.
   * @returns An async generator yielding chunks of generated text.
   */
  streamContent(prompt: string, options?: GenerateOptions): AsyncGenerator<string>;
}
