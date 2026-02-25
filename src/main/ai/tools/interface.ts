export interface AIToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: any; // For array type
  properties?: Record<string, any>; // For object type
  required?: string[]; // For object type
}

export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AIToolParameter>;
    required?: string[];
  };
}

export interface AITool extends AIToolDefinition {
  execute(args: any): Promise<any>;
}
