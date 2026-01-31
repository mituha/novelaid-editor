import { GoogleGenerativeAI } from '@google/genai';
import { BaseProvider } from './BaseProvider';
import { GenerateOptions, ChatMessage } from '../interface';

export class GeminiProvider extends BaseProvider {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string, modelName: string) {
    super(modelName);
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }

  async generateContent(prompt: string, options?: GenerateOptions): Promise<string> {
     return this.chat([{ role: 'user', content: prompt }], options);
  }

  private prepareChatHistory(messages: ChatMessage[], options?: GenerateOptions) {
      // Separate system message if any
      let systemInstruction = options?.systemPrompt;
      const history = [];

      // Filter out system messages from history and set systemInstruction if not already set
      for(const msg of messages) {
          if (msg.role === 'system') {
              if (!systemInstruction) systemInstruction = msg.content;
          } else {
              history.push({
                  role: msg.role === 'assistant' ? 'model' : 'user',
                  parts: [{ text: msg.content }]
              });
          }
      }

      // The last message is the new message to send
      const lastMessage = history.pop();

      if (!lastMessage) {
          throw new Error('No user message found to send.');
      }

      // Configure model with system instruction if present
      const model = systemInstruction
          ? this.genAI.getGenerativeModel({ model: this.modelName, systemInstruction })
          : this.model;

      const chat = model.startChat({
         history: history,
         generationConfig: {
            temperature: options?.temperature,
            maxOutputTokens: options?.maxTokens,
         }
      });

      return { chat, lastMessage };
  }

  async chat(messages: ChatMessage[], options?: GenerateOptions): Promise<string> {
    try {
      const { chat, lastMessage } = this.prepareChatHistory(messages, options);
      const result = await chat.sendMessage(lastMessage.parts[0].text);
      return result.response.text();
    } catch (error) {
      console.error('Gemini chat error:', error);
      throw error;
    }
  }

  async *streamContent(prompt: string, options?: GenerateOptions): AsyncGenerator<string> {
     yield* this.streamChat([{ role: 'user', content: prompt }], options);
  }

  async *streamChat(messages: ChatMessage[], options?: GenerateOptions): AsyncGenerator<string> {
    try {
      const { chat, lastMessage } = this.prepareChatHistory(messages, options);
      const result = await chat.sendMessageStream(lastMessage.parts[0].text);

      for await (const chunk of result.stream) {
        yield chunk.text();
      }
    } catch (error) {
      console.error('Gemini streamChat error:', error);
      throw error;
    }
  }


  async listModels(): Promise<string[]> {
      // Currently hardcoded standard models.
      // Dynamic listing requires a different API call structure not directly exposed on the generativeModel instance easily
      // or requires extra permissions/setup. keeping it simple for now.
      return [
        'gemini-2.0-flash-exp',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.0-pro'
      ];
  }
}
