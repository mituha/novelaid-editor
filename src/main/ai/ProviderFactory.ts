import { AIProvider } from './interface';
import { LMStudioProvider } from './providers/LMStudioProvider';
import { GeminiProvider } from './providers/GeminiProvider';

export type ProviderType = 'lmstudio' | 'gemini';

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
      default:
        throw new Error(`Unsupported provider type: ${config.type}`);
    }
  }
}
