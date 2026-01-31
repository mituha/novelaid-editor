import { AIProvider } from './interface';
import { LMStudioProvider } from './providers/LMStudioProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';

export type ProviderType = 'lmstudio' | 'gemini' | 'openai';

export interface ProviderConfig {
  type: ProviderType;
  // Common config
  modelName: string;

  // LMStudio specific
  baseUrl?: string;

  // Gemini specific
  apiKey?: string;
}

export class ProviderFactory {
  static createProvider(config: ProviderConfig): AIProvider {
    switch (config.type) {
      case 'lmstudio':
        return new LMStudioProvider(config.modelName, config.baseUrl);
      case 'gemini':
        if (!config.apiKey) {
          throw new Error('API key is required for Gemini provider');
        }
        return new GeminiProvider(config.apiKey, config.modelName);
      case 'openai':
        if (!config.baseUrl) {
            throw new Error('Base URL is required for OpenAI provider');
        }
        return new OpenAIProvider(config.modelName, config.baseUrl, config.apiKey || '');
      default:
        throw new Error(`Unsupported provider type: ${config.type}`);
    }
  }
}
