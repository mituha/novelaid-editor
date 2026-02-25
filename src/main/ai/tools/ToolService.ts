import { AITool, AIToolDefinition } from './interface';

export class ToolService {
  private static instance: ToolService;
  private tools: Map<string, AITool> = new Map();

  private constructor() {}

  public static getInstance(): ToolService {
    if (!ToolService.instance) {
      ToolService.instance = new ToolService();
    }
    return ToolService.instance;
  }

  public registerTool(tool: AITool) {
    this.tools.set(tool.name, tool);
  }

  public getToolDefinitions(): AIToolDefinition[] {
    return Array.from(this.tools.values()).map(({ execute, ...def }) => def);
  }

  public async executeTool(name: string, args: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    console.log(`[ToolService] Executing tool: ${name} with args:`, args);
    try {
      const result = await tool.execute(args);
      return result;
    } catch (error) {
      console.error(`[ToolService] Error executing tool ${name}:`, error);
      throw error;
    }
  }
}
