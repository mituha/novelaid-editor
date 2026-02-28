import { IpcMainEvent } from 'electron';
import path from 'path';
import { ProviderFactory } from './ProviderFactory';
import { PERSONAS, CHAT_ROLES } from '../../common/constants/personas';
import { MetadataService } from '../metadataService';
import { readDocument } from '../metadata';
import { ToolService } from './tools/ToolService';
import { searchDocumentsTool, readDocumentTool } from './tools/definitions/documentTools';

export class AIService {
  private static instance: AIService;

  private constructor() {
    this.registerTools();
  }

  private registerTools() {
    const toolService = ToolService.getInstance();
    toolService.registerTool(searchDocumentsTool);
    toolService.registerTool(readDocumentTool);
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * List available models for a given provider
   */
  public async listModels(config: any): Promise<any[]> {
    try {
      const providerType = config.provider || 'lmstudio';
      const factoryConfig: any = {
        type: providerType,
        modelName: 'dummy',
      };

      if (providerType === 'lmstudio') {
        factoryConfig.baseUrl = config.lmstudio?.baseUrl || 'ws://localhost:1234';
      } else if (providerType === 'gemini') {
        factoryConfig.apiKey =
          config.gemini?.apiKey ||
          process.env.GOOGLE_API_KEY ||
          process.env.GEMINI_API_KEY;
      } else if (providerType === 'openai') {
        factoryConfig.baseUrl = config.openai?.baseUrl || 'http://localhost:1234/v1';
        factoryConfig.apiKey = config.openai?.apiKey;
      }

      const provider = ProviderFactory.createProvider(factoryConfig);
      return await provider.listModels();
    } catch (error) {
      console.error('[AIService] List Models Error:', error);
      return [];
    }
  }

  /**
   * Generate content based on a single prompt
   */
  public async generate(prompt: string, config: any): Promise<string> {
    try {
      const provider = this.createProvider(config);
      return await provider.generateContent(prompt);
    } catch (error) {
      console.error('[AIService] Generation Error:', error);
      throw error;
    }
  }

  /**
   * Handle non-streaming chat request
   */
  public async chat(messages: any[], config: any): Promise<any> {
    try {
      const provider = this.createProvider(config);
      return await provider.chat(messages);
    } catch (error) {
      console.error('[AIService] Chat Error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chat request
   */
  public async streamChat(
    event: IpcMainEvent,
    messages: any[],
    config: any,
    personaId?: string,
    roleId?: string,
    path?: string,
  ): Promise<void> {
    try {
      const provider = this.createProvider(config);
      const apiMessages = await this.prepareMessages(
        messages,
        personaId,
        roleId,
      );
      const toolService = ToolService.getInstance();
      const tools = config.disableTools
        ? undefined
        : toolService.getToolDefinitions();

      let isDone = false;
      let loopCount = 0;
      const MAX_LOOPS = 5;

      while (!isDone && loopCount < MAX_LOOPS) {
        loopCount++;
        console.log(`[AIService] Starting streamChat loop ${loopCount}/${MAX_LOOPS}`);
        const stream = provider.streamChat(apiMessages, { tools, ...config });

        let toolCallChunk: any = null;
        let assistantText = '';

        for await (const chunk of stream) {
          if (chunk.type === 'tool_call') {
            console.log('[AIService] Received tool_call from provider:', chunk.metadata?.tool_call?.name);
            toolCallChunk = chunk;
            event.reply('ai:streamChat:data', chunk, path);
          } else {
            if (chunk.type === 'text') {
              assistantText += chunk.content;
            }
            event.reply('ai:streamChat:data', chunk, path);
          }
        }

        if (toolCallChunk && toolCallChunk.metadata?.tool_call) {
          const call = toolCallChunk.metadata.tool_call;
          console.log(`[AIService] Executing tool: ${call.name} with args:`, call.args);

          apiMessages.push({
            role: 'assistant',
            content: assistantText,
            tool_calls: [{ id: call.id, name: call.name, args: call.args }],
          });

          let toolResultContent = '';
          try {
            const res = await toolService.executeTool(call.name, call.args);
            toolResultContent = typeof res === 'string' ? res : JSON.stringify(res);
            console.log(`[AIService] Tool execution successful, result length: ${toolResultContent.length}`);
          } catch (err: any) {
            toolResultContent = JSON.stringify({ error: err.message });
            console.log(`[AIService] Tool execution failed: ${err.message}`);
          }

          apiMessages.push({
            role: 'tool',
            content: toolResultContent,
            name: call.name,
            tool_call_id: call.id,
          });
        } else {
          isDone = true;
        }
      }

      event.reply('ai:streamChat:end', path);
    } catch (error) {
      console.error('[AIService] Stream Chat Error:', error);
      event.reply(
        'ai:streamChat:error',
        error instanceof Error ? error.message : String(error),
        path,
      );
    }
  }

  /**
   * Helper to create a provider instance from configuration
   */
  private createProvider(config: any) {
    const providerType = config.provider || 'lmstudio';
    const factoryConfig: any = {
      type: providerType,
      modelName: 'local-model',
    };

    if (providerType === 'lmstudio') {
      factoryConfig.modelName = config.lmstudio?.model || 'local-model';
      factoryConfig.baseUrl = config.lmstudio?.baseUrl || 'ws://localhost:1234';
    } else if (providerType === 'gemini') {
      factoryConfig.modelName = config.gemini?.model || 'gemini-1.5-flash';
      factoryConfig.apiKey =
        config.gemini?.apiKey ||
        process.env.GOOGLE_API_KEY ||
        process.env.GEMINI_API_KEY;
    } else if (providerType === 'openai') {
      factoryConfig.modelName = config.openai?.model || 'gpt-3.5-turbo';
      factoryConfig.baseUrl = config.openai?.baseUrl || 'http://localhost:1234/v1';
      factoryConfig.apiKey = config.openai?.apiKey;
    }

    return ProviderFactory.createProvider(factoryConfig);
  }

  /**
   * Helper to prepare messages with system prompts and persona settings
   */
  private async prepareMessages(
    messages: any[],
    personaId?: string,
    roleId?: string,
  ): Promise<any[]> {
    const apiMessages = [...messages];

    // Get role-specific system prompt
    const targetRoleId = roleId || 'assistant';
    const role = CHAT_ROLES.find((r) => r.id === targetRoleId) || CHAT_ROLES[0];

    // Add role system prompt
    apiMessages.unshift({ role: 'system', content: role.systemPrompt });

    // Add persona prompt if specified
    if (personaId) {
      const staticPersona = PERSONAS.find((p) => p.id === personaId);
      if (staticPersona) {
        apiMessages.unshift({ role: 'system', content: staticPersona.systemPrompt });
      } else {
        // Try dynamic persona from metadata
        const metadataService = MetadataService.getInstance();
        const character = await metadataService.findCharacterById(personaId);
        if (character) {
          const charName =
            character.metadata.name ||
            path.basename(character.path, path.extname(character.path));

          // Core identity prompt
          apiMessages.unshift({
            role: 'system',
            content: `あなたは「${charName}」として振る舞ってください。提供された設定を遵守し、徹底的にそのキャラクターになりきって会話してください。`,
          });

          // Inject file content as background info
          const doc = await readDocument(character.path);
          if (doc.content) {
            apiMessages.unshift({
              role: 'system',
              content: `【キャラクター設定・背景情報】\n${doc.content}`,
            });
          }
          if (character.metadata.chat?.persona) {
            apiMessages.unshift({
              role: 'system',
              content: `【性格・口調設定】\n${character.metadata.chat.persona}`,
            });
          }
        }
      }
    }

    return apiMessages;
  }
}
