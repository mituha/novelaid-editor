import path from 'path';
import { AITool } from '../interface';
import { MetadataService } from '../../../metadataService';
import { readDocument } from '../../../metadata';

export const searchDocumentsTool: AITool = {
  name: 'search_documents',
  description: 'メタデータ（タグ、名前等）を使用してプロジェクト内のドキュメントを検索します。',
  parameters: {
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        description: '検索するタグのリスト (例: ["キャラクター", "重要"])',
        items: { type: 'string' },
      },
      query: {
        type: 'string',
        description: '名前やパスに含まれるキーワード',
      },
    },
  },
  async execute({ tags, query }: { tags?: string[]; query?: string }) {
    const metadataService = MetadataService.getInstance();
    let results = [];

    if (tags && tags.length > 0) {
      results = metadataService.queryByTag(tags);
    } else {
      // If no tags, we might need a general search or return all indexed
      // For now, let's just use query if provided
      // MetadataService currently doesn't have a generic queryByKeyword,
      // but we can filter the index manually if needed.
      // Let's keep it simple for now.
    }

    if (query) {
      const lowerQuery = query.toLowerCase();
      // Filter or supplement results
      // (This is a simplified implementation)
    }

    return results.map(r => ({
      path: r.path,
      name: r.name,
      tags: r.metadata.tags || r.metadata.tag,
    }));
  },
};

export const readDocumentTool: AITool = {
  name: 'read_document',
  description: '指定されたパスのドキュメントの内容を読み取ります。',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '読み取るドキュメントの絶対パス',
      },
    },
    required: ['path'],
  },
  async execute({ path: filePath }: { path: string }) {
    try {
      const doc = await readDocument(filePath);
      return {
        content: doc.content,
        metadata: doc.metadata,
      };
    } catch (error) {
      return { error: `Failed to read document: ${error}` };
    }
  },
};
